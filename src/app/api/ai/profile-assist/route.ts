import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'
import { Profile } from '@/types'
import { buildProfileContext } from '@/lib/narrative-prompts'

// Uma pergunta-guia por campo difícil do Perfil — usada como instrução pro modelo quando a
// pessoa clica em "me ajuda". Cada uma pede 2-3 opções curtas, nunca uma resposta genérica
// que serviria pra qualquer nicho.
const FIELD_PROMPTS: Record<string, string> = {
  professionalOneLiner: 'Escreva 3 opções curtas de "quem essa pessoa é profissionalmente" (1 frase cada), no tom que ela usaria pra se apresentar — nunca genérico tipo "especialista em marketing".',
  realProblem: 'Sugira 3 nomes próprios diferentes para o "Real Problema" — a causa raiz por trás do que o público enfrenta, batizada com um nome específico que ninguém mais usa (não um jargão de coach qualquer).',
  desiredOutcome: 'Sugira 3 frases curtas para "o que o público deseja no fundo" (o Desejo Universal por trás da compra) — vá além do óbvio de superfície.',
  emotionalDriver: 'Sugira 3 emoções específicas (1-3 palavras cada) que provavelmente movem a decisão de compra desse público.',
  mechanism: 'Sugira 3 nomes próprios curtos e memoráveis para o método/mecanismo único dessa pessoa — como um nome de produto, não uma descrição.',
  promiseResult: 'Sugira 3 versões curtas de "o que a pessoa recebe" na promessa principal.',
  promiseDeadline: 'Sugira 3 prazos realistas e específicos pra promessa (nunca vago tipo "rápido").',
  promiseObjection: 'Sugira 3 frases curtas no formato "mesmo que ela ache que..." cobrindo a objeção mais comum desse público.',
  lifeTransformation: 'Escreva 3 frases curtas descrevendo como a vida da pessoa muda de verdade depois do resultado — concreto, não motivacional vazio.',
  pastAttempts: 'Liste 4-6 coisas curtas que esse público provavelmente já tentou antes e não resolveu o problema (uma por linha, sem numeração).',
  signaturePhrases: 'Sugira 4-6 palavras ou expressões curtas que combinam com o tom dessa marca e podem virar assinatura (uma por linha, sem numeração).',
  audience: 'Escreva 3 opções curtas (1 frase cada) descrevendo o cliente ideal desse negócio — quem é, o que faz, em que situação está.',
  extraInstructions: 'Sugira 3 instruções curtas e específicas que ajudariam a IA a escrever no tom certo pra essa marca (nunca genérico tipo "seja claro e objetivo").',
  voiceReference: 'Sugira 3 comparações curtas do tipo "como [um tipo de texto/voz]" que capturam como essa marca soaria ao escrever (ex: "como uma newsletter direta de startup", "como um professor explicando pro aluno mais novo") — nunca cite marca, veículo ou pessoa real, só o tipo de voz.',
  positioningBeliefs: 'Sugira 3 pares de crença de posicionamento no formato "Eu defendo [X específico] — o mercado/a maioria ensina [Y oposto]", baseados no Real Problema e Mecanismo Único do perfil. Tem que ser uma contraposição real e específica desse nicho, nunca genérica.',
  coreValues: 'Sugira 3 valores inegociáveis específicos dessa marca, cada um já incluindo em 1 frase como isso se mostra na prática (ex: "Transparência — mostro resultado real, nunca só print bonito"). Nunca valor genérico de LinkedIn tipo "excelência" ou "compromisso".',
  successDefinition: 'Sugira 3 frases curtas e pessoais de "o que é sucesso" pra essa marca — evite clichê de faturamento solto, ancore no que o Perfil já revela sobre motivação real dessa pessoa.',
  whatYouReject: 'Sugira 3 frases curtas do que essa marca provavelmente abomina no próprio nicho — práticas comuns da concorrência que vão contra o Real Problema/Mecanismo que ela defende.',
  shadowTrait: 'Sugira 3 frases curtas e honestas de uma imperfeição, erro passado ou lado menos polido que essa marca poderia assumir publicamente sem soar fabricado — baseado no que o Perfil já conta sobre a jornada dela.',
}

// Campos de escolha fixa (radio/toggle/tags de uma lista pré-definida) — aqui a IA não
// inventa texto livre, ela escolhe entre os valores exatos passados em `choices`.
const CHOICE_FIELD_PROMPTS: Record<string, string> = {
  awarenessLevel: 'Escolha, entre as opções de "value" abaixo, a que melhor descreve o nível de consciência desse público sobre o problema. Responda só com o "value" exato de 1 opção, nada mais.',
  marketSophistication: 'Escolha, entre as opções de "value" abaixo, a que melhor descreve quanto esse público já viu promessas parecidas. Responda só com o "value" exato de 1 opção, nada mais.',
  formality: 'Escolha, entre as opções de "value" abaixo, a que combina mais com o tom dessa marca. Responda só com o "value" exato de 1 opção, nada mais.',
  voicePersonality: 'Escolha, entre as opções de "value" abaixo, as 2-3 que melhor descrevem a personalidade dessa marca. Responda com o "value" exato de cada uma, uma por linha, sem numeração.',
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { field: string; profile: Partial<Profile>; hint?: string; choices?: { value: string; label: string }[] }
  const { field, profile, hint, choices } = body
  const instruction = choices?.length ? CHOICE_FIELD_PROMPTS[field] : FIELD_PROMPTS[field]
  if (!instruction) return NextResponse.json({ error: 'Campo sem suporte a IA' }, { status: 400 })

  // O próprio campo que a pessoa está preenchendo não conta como "contexto" — senão a IA
  // usaria um rascunho ruim do campo pra sugerir mais do mesmo.
  const profileWithoutField = { ...profile, [field]: undefined }
  const context = buildProfileContext(profileWithoutField)

  if (!context && !hint?.trim()) {
    return NextResponse.json({ error: 'Ainda não tem contexto no perfil pra IA se basear — escreva uma pista rápida no campo acima.' }, { status: 400 })
  }

  const choicesList = choices?.length ? `\nOpções disponíveis:\n${choices.map(c => `- value: "${c.value}" → ${c.label}`).join('\n')}\n` : ''

  const prompt = `Você está ajudando a preencher o Perfil de um usuário do Claude Viral, uma ferramenta de criação de carrosséis virais pra Instagram.

${context || '(a pessoa ainda não preencheu outros campos do perfil — baseie-se só na pista abaixo)'}
${hint?.trim() ? `\nPista extra que a pessoa deu agora, use como prioridade: ${hint.trim()}` : ''}
${choicesList}
Tarefa: ${instruction}

${choices?.length ? 'Responda só com o(s) "value" exato(s) listado(s) acima, uma por linha, sem numeração, sem explicação, sem markdown.' : 'As opções têm que ser específicas pro contexto acima — nunca genéricas a ponto de servir pra qualquer nicho. Responda só as opções, uma por linha, sem numeração, sem explicação, sem markdown, em português brasileiro.'}`

  try {
    const raw = await callClaudeChat(prompt)
    const text = extractPlainText(raw)
    let options = text.split('\n').map(l => l.replace(/^[-•\d.)\s]+/, '').trim()).filter(Boolean)
    if (choices?.length) {
      const validValues = new Set(choices.map(c => c.value))
      options = options.filter(o => validValues.has(o))
    }
    return NextResponse.json({ options })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
