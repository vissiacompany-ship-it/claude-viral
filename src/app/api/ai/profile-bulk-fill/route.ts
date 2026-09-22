import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'

// Preenchimento em massa do Perfil — a pessoa escreve tudo que sabe num texto livre e a IA
// distribui isso nos campos certos, em vez de preencher campo por campo. Nunca inventa nada
// que não esteja implícito no texto — campo que não dá pra inferir fica de fora da resposta,
// pra pessoa preencher/revisar manualmente depois.
const SYSTEM = `Você extrai informação de um texto livre que a pessoa escreveu sobre o próprio negócio/marca, e distribui isso nos campos de um formulário de Perfil do Claude Viral.

Regra inegociável: só preencha um campo se o texto realmente disser ou implicar isso com clareza. Se não der pra inferir, OMITA o campo inteiro da resposta (nunca invente, nunca force um valor genérico só pra preencher). Isso vale especialmente pro campo "proofBank" (Provas Reais) — só preencha se o texto citar um resultado/número/caso concreto e real, nunca um exemplo genérico.

Campos disponíveis (preencha só os que der pra inferir, no formato exato):
{
  "name": "string — nome do perfil/marca, se mencionado",
  "instagram": "string — @ do Instagram sem o @, se mencionado",
  "niche": "string — nicho/área de atuação",
  "subniche": "string — subnicho, se específico o suficiente",
  "professionalOneLiner": "string — quem a pessoa é profissionalmente, 1 frase",
  "audienceType": "'b2c' | 'b2b' | 'mix'",
  "sells": ["array, só valores exatos entre: Infoproduto, Mentoria/Consultoria, Serviço, Produto físico, SaaS/Software, Outro"],
  "audience": "string — cliente ideal em 1 linha",
  "realProblem": "string — a causa raiz do problema do público, com nome próprio, não o sintoma óbvio",
  "desiredOutcome": "string — o que o público deseja no fundo",
  "emotionalDriver": "string — a emoção que move a decisão de compra",
  "awarenessLevel": "um valor exato entre: nao-sabe, sabe-problema, conhece-solucoes, conhece-voce, pronto",
  "marketSophistication": "um valor exato entre: primeira-vez, ja-viram, ceticos, so-mecanismo-novo, so-prova",
  "mechanism": "string — nome do método/mecanismo único",
  "promiseResult": "string — o que a pessoa recebe",
  "promiseDeadline": "string — em quanto tempo",
  "promiseObjection": "string — 'mesmo que ela ache que...'",
  "pastAttempts": ["array de coisas que o público já tentou e não resolveu"],
  "lifeTransformation": "string — como a vida da pessoa muda depois",
  "proofBank": ["array — só resultados/casos/números REAIS e específicos citados no texto, nunca inventado"],
  "positioningBeliefs": ["array no formato 'Eu defendo X — o mercado ensina Y', só se o texto tiver esse tipo de contraste"],
  "coreValues": ["array de valores inegociáveis, cada um já com como se vive isso na prática"],
  "successDefinition": "string — o que é sucesso pra essa pessoa",
  "whatYouReject": "string — o que ela abomina no próprio nicho",
  "shadowTrait": "string — imperfeição/vulnerabilidade que ela topa mostrar",
  "formality": "'formal' | 'informal'",
  "voicePersonality": ["array, só valores exatos entre: Direta, Didática, Provocativa, Energética, Sóbria, Acolhedora, Polêmica, Sarcástica, Inspiradora, Técnica"],
  "voiceReference": "string — 'como um tipo de texto/voz' que descreve como essa marca soa",
  "signaturePhrases": ["array de palavras/frases que a pessoa costuma usar"],
  "avoidWords": ["array de palavras que nunca devem ser usadas"],
  "brandText": "string — texto de rodapé da marca, se mencionado",
  "extraInstructions": "string — instruções extras de tom/estilo, se houver"
}

Responda só o objeto JSON, sem markdown, sem explicação — só os campos que você conseguiu inferir com confiança.`

export async function POST(req: NextRequest) {
  const { rawText } = await req.json() as { rawText: string }
  if (!rawText?.trim()) return NextResponse.json({ error: 'Escreva alguma coisa sobre o seu negócio primeiro' }, { status: 400 })

  const prompt = `${SYSTEM}\n\nTexto que a pessoa escreveu sobre o próprio negócio/marca:\n\n${rawText.trim()}`

  try {
    const raw = await callClaudeChat(prompt)
    const text = extractPlainText(raw)
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('A IA não retornou um resultado válido')
    const parsed = JSON.parse(text.slice(start, end + 1))
    return NextResponse.json({ profile: parsed })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
