import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'
import { getProfiles, getReferenceItems, getNarratives, getCarousels } from '@/lib/storage'
import { ContentPillar } from '@/types'
import { buildProfileContext, buildReferenceContext, buildPillarContext, buildRecentAnglesContext, pickAutoPillar, buildSlideStructureNote, cleanNarrativeOutput, WRITING_RULES, BODY_FORMATTING_RULES, getCopyDoctrine, HOOK_ENGINE, QUALITY_EXAMPLES, SlideType } from '@/lib/narrative-prompts'

export async function POST(req: NextRequest) {
  const { profileId, seed, topic, referenceIds, slideCount, pillar: pillarInput, cta, slideTypes } = await req.json() as {
    profileId?: string; seed?: string; topic?: string; referenceIds?: string[]; slideCount?: number; pillar?: ContentPillar; cta?: string
    slideTypes?: SlideType[]
  }

  const profile = profileId ? getProfiles().find(p => p.id === profileId) : undefined
  const references = referenceIds?.length ? getReferenceItems().filter(r => referenceIds.includes(r.id)) : undefined
  const narratives = getNarratives()
  const carousels = getCarousels()
  // Se a pessoa não escolheu pilar explicitamente (fluxo rápido do modal), o sistema decide
  // sozinho — evita que todo conteúdo caia sempre no pilar mais "fácil" pra IA (Mecanismo).
  const pillar = pillarInput || pickAutoPillar(profileId, narratives, carousels)
  const profileCtx = buildProfileContext(profile)
  const refCtx = buildReferenceContext(references)
  const pillarCtx = buildPillarContext(pillar)
  const antiRepeatCtx = buildRecentAnglesContext(profileId, narratives, carousels)
  const count = slideCount || 7
  const structureNote = buildSlideStructureNote(slideTypes)

  // Sem instrução explícita de CTA (nem por perfil, nem por essa geração), o padrão é o CTA
  // de comentário — o mecanismo mais forte pra gerar lead/DM automático — em vez de deixar
  // a IA "chutar" entre seguir/salvar/comentar sem direção nenhuma.
  const ctaInstruction = cta
    ? `CTA obrigatório desse roteiro (siga exatamente, adaptando só a redação): ${cta}`
    : `Nenhum CTA específico foi definido — use como padrão pedir pra comentar UMA palavra-chave específica e relevante pro tema do carrossel (ex: "comenta 'GUIA' que eu te mando o passo a passo"), nunca um pedido genérico tipo "comenta aqui" sem a palavra.`

  const prompt = `Você escreve o roteiro completo (Narrativa) de um carrossel viral pra Instagram, no método do Claude Viral.

Este conteúdo faz parte de uma produção em volume (várias peças por semana pro mesmo perfil) — não é copy de anúncio único. Antes de escrever, responda mentalmente as 3 perguntas de roteiro, e deixe a resposta guiar o texto:
1. Qual o objetivo desse roteiro (o que ele precisa fazer pelo perfil)?
2. O que ele ensina em termos práticos (o micro-resultado real que a pessoa leva, mesmo que pequeno)?
3. Qual a moral da história (a virada/insight que fica depois de ler)?

${profileCtx}
${pillarCtx}
${seed ? `ÂNGULO JÁ ESCOLHIDO E APROVADO PELA PESSOA — OBRIGATÓRIO, NÃO TROQUE: "${seed}"\nEsse é o gancho/ângulo que o slide 1 precisa desenvolver diretamente, palavra por palavra próximo do que está escrito acima — nunca substitua por outro ângulo emocional, desejo dominante ou mecanismo só porque o Perfil sugeriria uma direção diferente. O resto do carrossel (Tensão, Virada, Prova, Aplicação, CTA) desenvolve e aprofunda ESSE ângulo específico, nunca abre um ângulo novo no meio do caminho. Se esse ângulo já vier no formato "[Reenquadramento]: [gancho]" ou em 3 frases curtas (moldes da doutrina), preserve essa estrutura no slide 1, só ajuste o necessário pro tamanho do slide.` : ''}
${topic ? `Tema: ${topic}` : ''}
${refCtx}
${antiRepeatCtx}

Espinha dorsal narrativa completa — 9 papéis, nessa ordem, comprimidos proporcionalmente pra caber em ${count} slides (nunca pule Gancho, Prova ou CTA; funda papéis vizinhos quando ${count} for menor que 9 — ex: com 5 slides vira Gancho → Mecanismo (1+2 fundidos) → Prova → Aplicação/Direção (fundidos) → CTA):
1. Gancho (capa) — a parte mais afiada do ângulo, trava o dedo
2. Hook — dramatiza o problema de um jeito que a pessoa se reconhece, sem ainda explicar o motivo
3. Mecanismo pt.1 — começa a explicar o motivo/mecanismo por trás do problema
4. Mecanismo pt.2 — aprofunda o mecanismo com exemplo concreto (real, do Perfil ou do ângulo)
5. Prova — dado, caso ou observação real (só o que está confirmado no Perfil, nunca invente)
6. Expansão — amplia a implicação do mecanismo ou reformula a perspectiva ("o que isso muda", nunca resumo do que já foi dito)
7. Aplicação — uma técnica NOMEADA com passo real e concreto que o leitor pode aplicar agora, nunca só reconhecimento emocional reformulado de novo
8. Direção — a ponte entre a aplicação e o CTA: a consequência prática de agir nisso, prepara o pedido final sem ainda pedir
9. CTA/Fechamento (último slide, só isso) — última virada genuína + ação clara e diretiva, nunca cordial tipo "espero que tenha gostado"
Gancho e CTA nunca dividem espaço com outro papel.
${structureNote}

TITULO e SUBTITULO da capa (slide 1) nunca fazem o mesmo trabalho: TITULO trava o dedo no scroll (corte seco, rótulo/tensão do ângulo, nunca explica nem introduz); SUBTITULO é o que faz a pessoa arrastar pro slide 2 — entrega o motivo concreto de continuar lendo, ancorado nesse público específico, nunca uma segunda dose de curiosidade nem metáfora solta sem aterrar no problema real.

${HOOK_ENGINE}

O TITULO do slide 1 segue uma das estruturas da Engine de gancho acima (a não ser que ${seed ? 'o ângulo já aprovado acima defina outro formato — nesse caso preserve o formato do ângulo' : 'não haja ângulo pré-aprovado, aí escolha a estrutura mais forte pro tema'}). Rode o Checklist de Rejeição da Engine internamente antes de fixar o TITULO final — nunca entregue um TITULO que caia em algum item proibido.

O slide logo antes do CTA (fechamento) nunca resume o carrossel nem faz pergunta retórica sem resposta — faz uma última virada genuína (uma consequência ou reformulação que ainda não apareceu) e só então entrega pro CTA.

Regra de reprovação automática, sem exceção: qualquer alegação sobre o perfil/marca da pessoa (seguidores, "relatos no perfil", depoimento, print) que não esteja literalmente confirmada no Perfil acima é proibida — nunca infira, arredonde ou "suavize" isso a partir do que está escrito, corte a alegação inteira e use observação qualitativa sem fonte no lugar.

Instrução explícita da pessoa sempre vence o tom padrão do Perfil: se o ângulo/tema acima pede um enquadramento, intensidade ou opinião específica (mesmo mais provocador que o tom costumeiro documentado no Perfil), desenvolva o carrossel nessa linha — não suavize, remova ou substitua por conta própria o que ela explicitamente pediu. O tom do Perfil é o padrão só quando não há instrução explícita da pessoa pra essa peça. (Isso não abre exceção pra "Regra de ouro" abaixo: opinião forte não é a mesma coisa que dado fabricado — a intensidade do ângulo é livre, o fato factual continua tendo que ser real.)

Se o ângulo/tema acima já trouxer nomes, exemplos ou comparações concretas que a própria pessoa deu (um termo que ela cunhou, uma referência cultural nomeada, uma imagem concreta específica), use esses elementos diretamente nos slides — nunca troque por uma metáfora nova inventada por você. O detalhe real e específico que ela já trouxe é sempre mais forte que qualquer substituto "mais poético" genérico.

${ctaInstruction}

${WRITING_RULES}

${getCopyDoctrine()}

${QUALITY_EXAMPLES}

Regra de ouro: nunca invente dado, estatística ou fato que não esteja no Perfil acima. Se faltar prova concreta, use uma observação qualitativa em vez de inventar número.

Regra de proteção do produto: a Aplicação precisa ser real e funcional, mas parcial — ensine o suficiente pra gerar um micro-resultado genuíno, nunca o método completo (isso é o que sustenta o que a pessoa vende por trás do conteúdo). Prefira "bullet cego": entregue o benefício e um primeiro passo real, sem esgotar o mecanismo inteiro.

Entregue no formato exato abaixo, um bloco por slide, separados por uma linha só com ---:
TITULO: [headline]
SUBTITULO: [linha de apoio, se fizer sentido]
TEXTO: [corpo do slide]
Nem todo slide precisa de todos os campos.

${BODY_FORMATTING_RULES}

Antes de entregar, rode o QA mecânico da doutrina acima (seção 8) bloco a bloco — reescreva qualquer bloco que não passe no Teste de Densidade, tiver estrutura binária/cacote de IA, ou alegar algo do perfil não confirmado — nunca entregue sabendo que um bloco está abaixo disso.

Antes do primeiro bloco, escreva uma linha "TITULO_NARRATIVA: [nome curto pra essa narrativa, pra pessoa identificar no Banco de Narrativas depois]".`

  try {
    const raw = await callClaudeChat(prompt)
    const draft = cleanNarrativeOutput(extractPlainText(raw))

    // Segunda passada real de revisão (não é o modelo "conferindo a própria resposta" na mesma
    // geração — é uma chamada separada, só de crítica e reescrita, que enxerga o rascunho de
    // fora). Auto-checagem inline é fraca porque o modelo tende a confirmar o que acabou de
    // escrever; uma chamada nova, cujo único trabalho é reprovar bloco fraco, pega mais falha.
    const revisionPrompt = `Você é o editor que revisa este roteiro de carrossel ANTES de liberar pro usuário. Não escreveu o rascunho, só julga e corrige.

${profileCtx}

${WRITING_RULES}

${BODY_FORMATTING_RULES}

${QUALITY_EXAMPLES}

Rascunho a revisar:
"""
${draft}
"""

Releia bloco a bloco (cada TITULO/SUBTITULO/TEXTO). Pra cada um, rode mentalmente:
- Tem estrutura binária, cacoete de IA, ou "de forma X"? → reescrever
- É genérico (funcionaria com qualquer nicho/sujeito trocado)? → reescrever com âncora concreta
- Falta artigo em algum substantivo? → corrigir
- Alega dado/fato do perfil que não está confirmado no Perfil acima? → cortar a alegação, usar observação qualitativa
- Texto picotado sem conectivo natural? → reescrever em prosa fluida
- O TITULO/SUBTITULO da capa (slide 1) segue uma estrutura real de gancho (Dois-Pontos, Pergunta Geracional, Contraste, Investigando, Nome+Revelação) em vez de declaração direta ou motivacional vazio? → se não, reescrever
- A sequência de papéis (Gancho → Hook → Mecanismo pt.1 → Mecanismo pt.2 → Prova → Expansão → Aplicação → Direção → CTA, comprimida pra ${count} slides) foi respeitada na ordem certa — sem pular Prova, sem 2 slides fazendo o mesmo papel, sem Aplicação vindo antes da Prova? → se a ordem estiver errada, reorganizar o conteúdo entre os blocos
- O slide antes do CTA resume ou faz pergunta retórica em vez de virada genuína? → reescrever
- A promessa do gancho (slide 1) foi cumprida em algum ponto do carrossel? → se não, ajustar o bloco relevante pra cumprir
- Alguma linha TEXTO passa de 220 caracteres, tem mais de 2 linhas TEXTO no mesmo slide, TITULO passa de 90 caracteres ou SUBTITULO passa de 130? → CORTAR pro limite (nunca deixar passar — o slide corta o texto que não couber, e ninguém vê o que passou do limite)
- O slide tem corpo (TEXTO) mas nenhum trecho em **negrito**, sem ser um corpo de 1 linha genuinamente curto? → escolher o trecho mais decisivo do parágrafo e negritar
- Passa no teste do tom de IA (qualquer conta de 10k+ seguidores poderia ter escrito? funciona com qualquer sujeito trocado? soa redação escolar? motiva sem informar nada concreto)? → se sim pra qualquer uma, reescrever com âncora concreta do Perfil
- Tem "cada vez mais", jargão corporativo evitável (ecossistema, sinergia, disruptivo, stakeholders, mindset), ou anglicismo numérico ("10+ anos", "5x")? → cortar/substituir
- Algum slide do tipo CAPA (ver estrutura abaixo) recebeu TEXTO em vez de só TITULO+SUBTITULO curtos? → reescrever esse bloco como mini-gancho curto, nunca parágrafo
${structureNote}

Se um bloco já está bom, mantenha exatamente igual — não reescreva por reescrever. Devolva o roteiro INTEIRO revisado, no mesmo formato exato do rascunho (mesma quantidade de blocos, mesma separação "---", mesma linha TITULO_NARRATIVA no início). Nunca adicione comentário sobre o que foi corrigido — só o roteiro final.`

    const revisedRaw = await callClaudeChat(revisionPrompt)
    const text = cleanNarrativeOutput(extractPlainText(revisedRaw))

    const titleMatch = text.match(/TITULO_NARRATIVA:\s*(.+)/)
    const title = titleMatch ? titleMatch[1].trim() : (seed || topic || 'Narrativa sem título')
    const content = text.replace(/TITULO_NARRATIVA:\s*.+\n?/, '').trim()
    return NextResponse.json({ title, content, pillar })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
