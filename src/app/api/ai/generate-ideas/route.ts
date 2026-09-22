import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'
import { getProfiles, getReferenceItems, getNarratives, getCarousels } from '@/lib/storage'
import { buildProfileContext, buildReferenceContext, buildRecentAnglesContext, CONTENT_PILLARS, WRITING_RULES } from '@/lib/narrative-prompts'

export async function POST(req: NextRequest) {
  const { profileId, topic, referenceIds } = await req.json() as { profileId?: string; topic?: string; referenceIds?: string[] }

  const profile = profileId ? getProfiles().find(p => p.id === profileId) : undefined
  const references = referenceIds?.length ? getReferenceItems().filter(r => referenceIds.includes(r.id)) : undefined
  const profileCtx = buildProfileContext(profile)
  const refCtx = buildReferenceContext(references)
  const antiRepeatCtx = buildRecentAnglesContext(profileId, getNarratives(), getCarousels())

  if (!profileCtx && !topic?.trim()) {
    return NextResponse.json({ error: 'Preencha um tema ou selecione um perfil com mais informação' }, { status: 400 })
  }

  const pillarList = (Object.entries(CONTENT_PILLARS) as Array<[string, typeof CONTENT_PILLARS[keyof typeof CONTENT_PILLARS]]>)
    .map(([key, p]) => `- ${key} (${p.label}, funil ${p.funil}): ${p.instruction}`).join('\n')

  const prompt = `Você gera ângulos (ideias) de carrossel viral pra Instagram, no método do Claude Viral (direct-response, não motivacional vazio).

Cada ideia gerada aqui é o que a pessoa vai aprovar e depois usar como ÂNGULO FINAL E OBRIGATÓRIO pra gerar o roteiro completo — não é um resumo de tema pra "desenvolver depois", é o próprio gancho que vai virar o slide 1 quase palavra por palavra. Por isso a régua de qualidade é a mesma de um gancho de capa, não de um título de pauta.

${profileCtx}
${topic ? `Material que a pessoa trouxe (pode ser um tema curto, ou um relato/transcrição rica em detalhes — nesse segundo caso, é MATÉRIA-PRIMA pra minerar, não um resumo pra parafrasear):\n"""\n${topic}\n"""` : 'Sem tema definido — use o Perfil acima pra sugerir ângulos que fazem sentido pra essa marca.'}
${refCtx}
${antiRepeatCtx}

${WRITING_RULES}

Regra mais importante de todas — CONCRETIZAR, nunca reafirmar a abstração: o Real Problema e o Mecanismo do Perfil acima estão escritos de forma abstrata/conceitual (é assim que ficam documentados). Uma ideia RUIM só repete essa abstração com outras palavras ("a sociedade nos molda sem percebermos", "isso muda como você pensa sobre X"). Uma ideia BOA traduz aquela abstração numa cena, objeto, situação ou detalhe específico e observável que qualquer pessoa do público já viu ou vive — algo que se possa apontar, não um conceito. Antes de escrever cada ideia, pergunte: "isso é uma coisa que dá pra ver acontecendo, ou é só a teoria reformulada?" Se for só teoria, troque por um exemplo concreto que ilustra a mesma teoria.

Se o material acima já trouxer nomes, exemplos, comparações ou um termo/apelido específico que a própria pessoa cunhou (ex: um nome que ela já deu pro fenômeno, uma comparação visual concreta, uma referência cultural nomeada) — USE esses elementos diretamente, não troque por uma metáfora nova inventada por você. Nunca abstraia o que ela já tornou concreto: se ela já deu nome ao fenômeno, esse é o nome; se ela já deu o exemplo visual, esse é o exemplo. Inventar um substituto mais "poético" ou genérico quando o material já tem o detalhe certo é o erro mais comum aqui — evite.

Instrução explícita da pessoa sempre vence o tom padrão do Perfil: se o material acima pede um ângulo, enquadramento ou intensidade específica pra ESSA geração (mesmo que mais provocador que o tom costumeiro documentado no Perfil), siga o que ela pediu — não suavize, remova ou substitua por conta própria o que ela explicitamente instruiu. As regras de tom do Perfil valem como padrão quando não há instrução explícita da pessoa; instrução explícita pontual manda mais que o padrão geral. (A única coisa que continua inegociável sempre: nunca inventar dado, estatística, fonte ou estudo que não exista — opinião/ângulo forte é diferente de fato fabricado.)

Teste da Marca em cada ideia: ela funcionaria com qualquer outro nicho no lugar, só trocando o assunto? Se sim, está genérica — reescreva ancorada num detalhe que só faz sentido pra ESSE nicho/perfil específico.

Gere exatamente 6 ideias — uma pra cada pilar de conteúdo abaixo, nessa ordem, cobrindo funil e função diferentes (não é pra escolher os melhores 6, é 1 ideia por pilar):
${pillarList}

Cada ideia é 1 frase concreta e específica (ou uma frase + hook de 2 partes separado por ":", tipo "[Reenquadramento do fenômeno]: [gancho de curiosidade]", quando fizer sentido) — nunca um título de tema genérico tipo "post sobre X", nunca uma tese abstrata solta. Ela precisa já funcionar como gancho de capa pronto, sem reescrita.

Além do texto e do pilar, classifique CADA ideia com exatamente 1 (um) ângulo emocional dominante — não combine dois com "|" nem liste mais de um, escolha o que mais pesa nessa ideia específica: vergonha, indignação, esperança, conspiração, identidade ou curiosidade.

Responda em JSON, só o array, sem markdown, na mesma ordem dos pilares listados acima:
[{ "text": "...", "pillar": "mecanismo|noticia-cultura|pratica-rapida|contra-crenca|caso-observacao|provocacao-opiniao", "angleType": "vergonha" }, ...]
(o campo "angleType" é sempre uma única palavra da lista, nunca duas)`

  try {
    const raw = await callClaudeChat(prompt)
    const text = extractPlainText(raw)
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')
    const ideas = JSON.parse(text.slice(start, end + 1))
    return NextResponse.json({ ideas })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
