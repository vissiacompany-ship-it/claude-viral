import { Profile, ReferenceItem, ContentPillar, Narrative, Carousel } from '@/types'
import { CONTENT_PILLARS, PILLAR_ORDER } from '@/lib/pillars'
import fs from 'fs'
import path from 'path'

export { CONTENT_PILLARS } from '@/lib/pillars'

export type SlideType = 'cover' | 'title-only' | 'body'

// Alguns modelos visuais (ex: Retrato & Texto) intercalam slides "capa" (foto cheia, só
// título curto + subtítulo curto, sem campo de corpo) no MEIO do carrossel, não só no
// slide 1. Sem essa informação, o roteiro trata todo slide do meio como "corpo normal" e
// escreve um parágrafo de TEXTO — que não tem onde entrar nesse tipo de slide e acaba
// despejado dentro do SUBTITULO (que é curto por natureza), saindo gigante e cortado na tela.
// Usado tanto por generate-narrative (roteiro novo) quanto adjust-narrative (reescrever o
// que já existe), pra nunca escrever um bloco que o slide de destino não consegue exibir.
export function buildSlideStructureNote(slideTypes?: SlideType[]): string {
  if (!slideTypes?.length) return ''
  const labels: Record<SlideType, string> = {
    'cover': 'CAPA — só TITULO curto (um mini-gancho) + SUBTITULO curto (1 linha de apoio). NUNCA escreva TEXTO aqui, esse tipo de slide não tem corpo.',
    'title-only': 'SÓ-TÍTULO — só TITULO. Esse slide não tem corpo nem subtítulo separado; se tiver mais de uma ideia, junte tudo numa frase só dentro do próprio TITULO.',
    'body': 'TEXTO normal (TITULO é opcional nesse tipo).',
  }
  const spec = slideTypes.map((t, i) => `Slide ${i + 1}: ${labels[t]}`).join('\n')
  return `\n\nESTRUTURA REAL do modelo visual escolhido pra esse carrossel — cada slide só pode usar os campos que o tipo dele realmente tem (usar o campo errado faz o texto sumir da tela ou ficar cortado, porque o modelo não tem esse espaço visual naquele slide):\n${spec}\n\nQuando um slide do tipo CAPA aparecer no meio do carrossel (não só no slide 1), trate-o como uma pausa visual de foto com um mini-gancho da seção — título curto e direto, nunca um parágrafo desenvolvido.`
}

// Às vezes o modelo cola uma frase de confirmação antes do roteiro ("Aqui está o roteiro
// revisado:") ou uma explicação do que mudou depois do último bloco — contra a instrução
// explícita de nunca fazer isso, mas acontece o suficiente pra precisar de uma rede de
// segurança. Sem isso, essa pollução vira texto de slide de verdade (o preâmbulo gruda antes
// do 1º bloco, a explicação gruda no final do ÚLTIMO bloco — o CTA saía corrompido).
export function cleanNarrativeOutput(text: string): string {
  const startMatch = text.match(/(TITULO_NARRATIVA:|^[ \t]*(TAG|TITULO|SUBTITULO|TEXTO|LISTA):)/m)
  let out = startMatch ? text.slice(text.indexOf(startMatch[0])) : text
  // Explicação colada no final: sempre um "título" em negrito isolado numa linha própria
  // seguido de dois-pontos (ex: "**O que mudei e por quê:**") — nunca é conteúdo de slide,
  // que só usa negrito INLINE dentro de uma linha TEXTO, nunca como linha isolada.
  const endMatch = out.search(/\n\*\*[^*\n]+:\*\*\s*\n/)
  if (endMatch !== -1) out = out.slice(0, endMatch)
  return out.trim()
}

export function buildPillarContext(pillar?: ContentPillar): string {
  if (!pillar) return ''
  const p = CONTENT_PILLARS[pillar]
  if (!p) return ''
  return `Pilar de conteúdo: ${p.label} (funil: ${p.funil}).\n${p.instruction}\n${p.revealMechanism ? '' : 'Regra deste pilar: NÃO nomeie nem explique o Real Problema/Mecanismo do Perfil aqui, mesmo que o Perfil tenha essa informação — isso fica reservado pro pilar Mecanismo.'}`
}

// Anti-repetição: pega os títulos/ângulos mais recentes desse perfil (narrativas + carrosséis
// já gerados) e devolve como lista, pra IA saber o que já foi usado e não repetir o mesmo
// ângulo/gancho — sem isso, gerar 5 peças/dia pro mesmo perfil satura rápido.
export function buildRecentAnglesContext(profileId: string | undefined, narratives: Narrative[], carousels: Carousel[], limit = 20): string {
  if (!profileId) return ''
  const recentNarratives = narratives.filter(n => n.profileId === profileId).slice(0, limit).map(n => n.title)
  const recentCarousels = carousels.filter(c => c.profileId === profileId).slice(0, limit).map(c => c.title)
  const all = Array.from(new Set([...recentNarratives, ...recentCarousels])).slice(0, limit)
  if (!all.length) return ''
  return `Ângulos/títulos já usados recentemente por esse perfil (NUNCA repita o mesmo ângulo, gancho ou mecanismo de abertura — precisa ser um ângulo genuinamente novo):\n${all.map(t => `- ${t}`).join('\n')}`
}

// Quando a pessoa não escolhe pilar (fluxo rápido do modal), o sistema escolhe sozinho —
// pega o pilar menos usado recentemente por esse perfil, pra manter a grade de calendário
// variada sem exigir que ela pense nisso toda vez. Sem histórico, sorteia.
export function pickAutoPillar(profileId: string | undefined, narratives: Narrative[], carousels: Carousel[]): ContentPillar {
  if (!profileId) return PILLAR_ORDER[Math.floor(Math.random() * PILLAR_ORDER.length)]
  const usedRecently = [
    ...narratives.filter(n => n.profileId === profileId).slice(0, 12).map(n => n.pillar),
    ...carousels.filter(c => c.profileId === profileId).slice(0, 12).map(c => c.briefing?.pillar),
  ].filter((p): p is ContentPillar => !!p)
  const counts = Object.fromEntries(PILLAR_ORDER.map(p => [p, 0])) as Record<ContentPillar, number>
  usedRecently.forEach(p => { counts[p] = (counts[p] || 0) + 1 })
  const minCount = Math.min(...PILLAR_ORDER.map(p => counts[p]))
  const leastUsed = PILLAR_ORDER.filter(p => counts[p] === minCount)
  return leastUsed[Math.floor(Math.random() * leastUsed.length)]
}

// Mesmas regras de escrita da Etapa 2 do CLAUDE.md, resumidas — usadas por todo endpoint de
// IA que gera ideia/gancho/narrativa, pra manter uma só voz em qualquer ponto do produto.
// Regra de parágrafo/negrito do corpo (TEXTO) — usada tanto na geração quanto no ajuste de
// roteiro, pra nunca sair um bloco de texto corrido sem nenhuma ênfase nem quebra.
export const BODY_FORMATTING_RULES = `Formatação do corpo (TEXTO), em todo slide a partir do 2º que tiver corpo — nunca deixar como bloco único e chapado de texto corrido:
- Parágrafo: se o corpo do slide tiver mais de uma ideia/passo/beat (ex: a frustração e depois a virada, ou um contexto e depois o exemplo), separe em 2 linhas "TEXTO:" seguidas dentro do mesmo bloco — cada uma vira um parágrafo. Só use 1 linha TEXTO quando o corpo for curto e for genuinamente uma ideia só.
- Negrito: dentro de CADA linha TEXTO, envolva em **duplo asterisco** só o trecho que mais carrega a ideia daquele parágrafo — o "soco" da frase, nunca uma palavra qualquer. É OBRIGATÓRIO ter pelo menos 1 trecho em negrito em praticamente todo slide com corpo (raramente 2 no mesmo parágrafo, nunca mais que isso) — só pule o negrito quando o corpo daquele slide específico for uma frase muito curta (1 linha) onde marcar qualquer trecho ficaria artificial. Nunca negrite a frase inteira, nunca negrite o parágrafo inteiro. O trecho em negrito tem que continuar fazendo sentido lido sozinho, fora do resto da frase.
- LIMITE DE TAMANHO (regra rígida, nunca ultrapasse — o slide tem altura fixa e o texto que passar do limite é cortado, não aparece): cada linha TEXTO tem no máximo 220 caracteres (~2-3 linhas visuais); no máximo 2 linhas TEXTO por slide (ou seja, no máximo 2 parágrafos) — se o conteúdo pede mais que isso, corte pro essencial ou divida em outro slide, nunca estoure o limite. TITULO (headline) tem no máximo 90 caracteres. SUBTITULO tem no máximo 130 caracteres. Prefira SEMPRE o lado mais curto dentro desses limites — texto enxuto sobra espaço, texto no limite exato do máximo já é arriscado.`

export const WRITING_RULES = `Regras de escrita, sempre: proibido frase que funciona pra qualquer nicho trocado, proibido estrutura binária ("não é X, é Y", "sem X, sem Y", "menos X, mais Y", "deixa de ser X pra ser Y"), proibido cacoete de IA ("e isso muda tudo", "no fim das contas"/"ao final do dia", "a pergunta que fica"/"a questão é"/"o ponto é", "a lógica funciona assim"), proibido abertura de redação ("em um mundo onde", "vivemos em uma era"), proibido 2ª pessoa no corpo ("você precisa", "é preciso", "devemos"), proibido dado sem número+fonte+ano (nunca "estudos mostram"/"especialistas dizem"/"muitas empresas"/"a maioria das pessoas"/"recentemente" sem data/"no Brasil" sem dado específico — sempre nomear ou cortar a alegação), proibido abrir com pergunta óbvia ou frase de preparação ("hoje vamos falar sobre", "antes de começar", "todo mundo já ouviu falar de"), proibido fechar anunciando o próximo ("continua no próximo slide", "mas tem mais"), proibido CTA cordial ("espero que tenha gostado", "obrigado por acompanhar"), proibido emoji. Proibido enchimento vazio: "cada vez mais" (usar o dado real), "de forma clara/consistente/natural", "simplesmente", "basicamente", "claro que" genérico, "na prática" como abertura de frase. Proibido jargão corporativo quando existe equivalente coloquial (ecossistema→sistema/mercado, sinergia→integração, disruptivo→que quebra o padrão, stakeholders→envolvidos, mindset→mentalidade, storytelling→narrativa, benchmark como verbo→comparar) — exceção só quando o jargão é da identidade do próprio nicho (ex: "CAC" em marketing de performance), aí explica na 1ª ocorrência. Proibido anglicismo numérico em texto corrido ("10+ anos", "5x maior" — escrever "mais de 10 anos", "cinco vezes maior"). No gancho: proibido declaração direta sem tensão, "descubra/saiba/conheça"/"revelamos"/"descobrimos", formato de lista, motivacional vazio, "quando X vira Y", "a ascensão de", "o impacto de", "virou" como verbo principal — e precisa ativar pelo menos 2 dessas sensações: medo/alerta, indignação, curiosidade, identidade, nostalgia, aspiração. Obrigatório: artigo em todo substantivo, 1 ideia por bloco, frases curtas alternando com uma mais longa, conectivo natural (porque, só que, por isso, enquanto, mas, aí, então). Teste do tom de IA antes de fechar qualquer bloco — se a resposta for SIM pra qualquer uma, reescrever: (1) qualquer conta de 10k+ seguidores no nicho poderia ter escrito isso? (2) funciona trocando o sujeito por qualquer outro sem mudar uma palavra? (3) soa conclusão de redação escolar? (4) motiva sem informar nada concreto?`

// Destilado do sistema BrandsDecoded (272k seguidores, R$4M em 14 meses, 100% orgânico,
// calibrado em 1.168 posts reais) — dados de lift medidos, não suposição. Usado no gancho
// (slide 1/capa) tanto em generate-hooks quanto no slide 1 de generate-narrative, pra dar ao
// modelo um padrão testado em vez de inventar estrutura nova a cada geração.
export const HOOK_ENGINE = `Engine de gancho (dados reais de performance, banco BrandsDecoded — 1.168 posts analisados):

Padrões com lift POSITIVO medido (usar pelo menos 1 por gancho):
- Brasil/Contexto Nacional: +155% — conecta com identidade brasileira
- Fim/Morte/Crise: +119% — algo mudando, acabando ou em risco
- Geracional: +119% — rotula comportamento de uma geração específica (Gen Z, Millennials)
- Novidade: +99% — anuncia tendência emergente, virada recente

Padrões com lift NEGATIVO medido (evitar):
- Declaração Direta: -29% — afirma sem provocar curiosidade
- Revelação genérica ("descubra/saiba/conheça"): -42% — formato saturado

Estruturas de gancho comprovadas:
1. Fórmula Dois-Pontos — "[Reenquadramento provocativo]: [hook que gera curiosidade]" (ex real, 115k likes: "A Morte do Gosto Pessoal: Como a Dopamina Digital Nos Tornou Indiferentes")
2. Pergunta Geracional — "Por que [geração] está [comportamento inesperado]?" (ex real, 53k likes: "Por que os Millennials Estão Sofrendo com Crises de Meia-Idade aos 30 Anos?")
3. Contraste/Antítese — dois elementos opostos que o cérebro precisa resolver (ex real, 42k likes: "Por que a Gen Z Parou de Vestir a Camisa e Começou a Tratar Emprego Como Contrato")
4. Investigando [Fenômeno] — tom jornalístico/documental (ex real, 27k likes: "Investigando a Ascensão das Festas Diurnas em Coffee Shops")
5. Nome/Marca + Revelação Inesperada — âncora de atenção com referência concreta (ex real, 53k likes: "Jaden Smith abriu um restaurante onde ninguém paga: o novo modelo de negócios que confronta o capitalismo")

Esses exemplos são inspiração de PADRÃO estrutural, nunca copiar o texto — o conteúdo do gancho sempre vem do Perfil/ângulo desse carrossel específico, nunca do banco.

Checklist de rejeição do gancho (reescrever se cair em qualquer um, nunca remover e nunca entregar sabendo que reprovou):
- Declaração direta sem tensão
- "Descubra/saiba/conheça" ou revelação genérica
- Formato de lista ("5 dicas de...")
- Motivacional vazio (sem dado, sem conflito, sem personalidade)
- Tom de IA — leria em voz alta soando como qualquer conta de 10k+ seguidores poderia ter escrito?
- "Quando X vira Y", "a ascensão de", "o impacto de", "por que X está mudando Y", "virou" como verbo principal do gancho`

// Pares certo/errado extraídos do Manual de Qualidade BrandsDecoded — few-shot real de reescrita,
// não regra abstrata. Objetivo: mostrar ao modelo o ANTES/DEPOIS de cada defeito mais comum,
// porque lista de proibição ("não faça X") ensina o modelo a evitar tique, não a escrever bem.
export const QUALITY_EXAMPLES = `Exemplos de reescrita (mesma ideia, antes ruim / depois bom — use como referência de nível, não copie o conteúdo):

Fluidez (texto picotado vira parágrafo de reportagem):
Ruim: "Vendas é execução. Performance importa. Resultado define carreira. Melhor vendedor vence."
Bom: "Vendas é execução individual, porque performance no cara a cara é o que conta quando o resultado precisa aparecer — e o melhor vendedor vence no talento puro aplicado com consistência."

Estrutura binária (nunca "não é X, é Y" — reescrever em prosa com conector real):
Ruim: "Engajamento vem de identificação emocional, não de expertise."
Bom: "Engajamento nasce quando o leitor se reconhece no tema — e esse reconhecimento acontece muito antes de qualquer expertise entrar em cena."

Densidade (genérico vira concreto com âncora real do perfil/proofBank):
Ruim: "Empresas estão adotando novas tecnologias para melhorar resultados."
Bom: "O Strava tem 120 milhões de usuários e 40 milhões de atividades por semana porque gamificação com rankings reduz churn em 50%." (só use número assim quando vier confirmado no Perfil — sem isso, fica a observação qualitativa, nunca o número inventado)

Tom editorial (1 frase longa com vírgula vira 2 frases curtas com ponto):
Ruim: "Neymar lança marca enquanto está afastado, e a marca nasce como categoria construída a partir do acessório que o público reconhece."
Bom: "Neymar lança a marca enquanto está afastado. A marca nasce como continuação clara da personalidade que o público reconhece."

Fechamento (nunca resumo nem pergunta retórica — vira genuína virada final):
Ruim: "No final, o que os dados mostram é que o tema certo faz toda a diferença."
Bom: "Os 1.168 posts provam que distribuição e qualidade não competem — mas a distribuição vem primeiro. Quem ignora isso está produzindo para a bolha, não para o crescimento."

Teste rápido antes de entregar qualquer bloco: tire artigos, conectivos e adjetivos — o que sobra é substância real (nome, número, mecanismo específico) ou é genérico e funcionaria com qualquer sujeito no lugar? Se genérico, reescrever do zero, não só ajustar palavra.`

// Doutrina completa (destilada de 7 clássicos de copywriting/direct-response — Schwartz,
// Makepeace/AWAI, Caples, Carlton, Fladlien) — ver src/lib/copy-knowledge/DOUTRINA.md.
// Lida uma vez do disco e cacheada em memória; se o arquivo sumir, os endpoints seguem
// funcionando só com WRITING_RULES (nunca falha por causa disso).
let _copyDoctrineCache: string | null = null
export function getCopyDoctrine(): string {
  if (_copyDoctrineCache !== null) return _copyDoctrineCache
  try {
    _copyDoctrineCache = fs.readFileSync(path.join(process.cwd(), 'src/lib/copy-knowledge/DOUTRINA.md'), 'utf-8')
  } catch {
    _copyDoctrineCache = ''
  }
  return _copyDoctrineCache
}

export function buildProfileContext(profile?: Partial<Profile> | null): string {
  if (!profile) return ''
  const lines = [
    profile.niche && `Nicho: ${profile.niche}${profile.subniche ? ` (${profile.subniche})` : ''}`,
    profile.professionalOneLiner && `Quem é: ${profile.professionalOneLiner}`,
    profile.audience && `Cliente ideal: ${profile.audience}`,
    profile.realProblem && `Real Problema: ${profile.realProblem}`,
    profile.desiredOutcome && `Desejo Universal: ${profile.desiredOutcome}`,
    profile.emotionalDriver && `Driver Emocional: ${profile.emotionalDriver}`,
    profile.mechanism && `Mecanismo Único: ${profile.mechanism}`,
    (profile.promiseResult || profile.promiseDeadline || profile.promiseObjection) &&
      `Promessa: ${profile.promiseResult || ''} ${profile.promiseDeadline ? `em ${profile.promiseDeadline}` : ''} ${profile.promiseObjection ? `(mesmo que ${profile.promiseObjection})` : ''}`.trim(),
    profile.pastAttempts?.length && `Tentativas frustradas do público: ${profile.pastAttempts.join(', ')}`,
    profile.lifeTransformation && `Transformação de vida: ${profile.lifeTransformation}`,
    profile.proofBank?.length && `Provas reais que a pessoa já tem (usar só isso, nunca inventar dado além disso): ${profile.proofBank.join(' | ')}`,
    profile.positioningBeliefs?.length && `Crenças de posicionamento (o que ela defende vs. o que o mercado ensina errado — ótimo material pra ângulo contrarian/autoridade): ${profile.positioningBeliefs.join(' | ')}`,
    profile.coreValues?.length && `Valores inegociáveis: ${profile.coreValues.join(' | ')}`,
    profile.successDefinition && `O que é sucesso pra ela: ${profile.successDefinition}`,
    profile.whatYouReject && `O que ela abomina no próprio nicho: ${profile.whatYouReject}`,
    profile.shadowTrait && `"Sombra" que ela topa mostrar (imperfeição/vulnerabilidade real): ${profile.shadowTrait}`,
    profile.awarenessLevel && `Nível de consciência do público: ${profile.awarenessLevel}`,
    profile.marketSophistication && `Nível de sofisticação do mercado: ${profile.marketSophistication}`,
    profile.formality && `Formalidade: ${profile.formality === 'formal' ? 'formal' : 'informal'}`,
    profile.voicePersonality?.length && `Personalidade de tom: ${profile.voicePersonality.join(', ')}`,
    profile.voiceReference && `Espelho de escrita (a que tipo de texto essa voz se parece): ${profile.voiceReference}`,
    profile.signaturePhrases?.length && `Palavras de assinatura: ${profile.signaturePhrases.join(', ')}`,
    profile.avoidWords?.length && `NUNCA usar: ${profile.avoidWords.join(', ')}`,
    profile.extraInstructions && `Instruções extras dessa marca (sempre aplicar): ${profile.extraInstructions}`,
  ].filter(Boolean)
  return lines.length ? `Perfil da marca:\n${lines.join('\n')}` : ''
}

export function buildReferenceContext(items?: ReferenceItem[] | null): string {
  if (!items?.length) return ''
  const formulaItems = items.filter(i => !i.storeOriginal)
  const originalItems = items.filter(i => i.storeOriginal && i.fullText)

  const parts: string[] = []
  if (formulaItems.length) {
    const list = formulaItems.map(i => `- "${i.title}" (${i.format}): ${i.formula}${i.mechanicPreserved?.length ? ` — mecânica: ${i.mechanicPreserved.join('; ')}` : ''}`).join('\n')
    parts.push(`Padrões da Biblioteca de Referências que a pessoa quer usar como inspiração estrutural (NUNCA copie o texto, só o padrão):\n${list}`)
  }
  if (originalItems.length) {
    // Item guardado por decisão explícita da pessoa como carrossel completo (não fórmula) —
    // aqui ela pediu pra usar como molde forte: seguir de perto estrutura, ritmo, sequência de
    // blocos e tamanho de cada um, mas o CONTEÚDO (fatos, exemplos, nomes) tem que ser
    // sempre do Perfil da marca acima, nunca do carrossel de referência.
    const list = originalItems.map(i => `--- Referência "${i.title}" (${i.format})${i.mechanicPreserved?.length ? ` — por que funciona: ${i.mechanicPreserved.join('; ')}` : ''} ---\n${i.fullText}`).join('\n\n')
    parts.push(`Carrossel(s) completo(s) que a pessoa guardou como molde FORTE (ela pediu explicitamente pra clonar a estrutura desse conteúdo, não só se inspirar): siga de perto a sequência de blocos, o ritmo e o tamanho aproximado de cada slide desse exemplo — mas todo fato, exemplo, nome e dado do carrossel final tem que vir do Perfil da marca acima, nunca do texto de referência abaixo (ele é só o molde de forma, nunca a fonte do conteúdo):\n\n${list}`)
  }
  return parts.join('\n\n')
}
