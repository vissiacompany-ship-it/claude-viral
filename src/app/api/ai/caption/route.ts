import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const { slides, handle } = await req.json() as {
    slides: Array<{ tag?: string; title?: string; subtitle?: string; body?: string }>
    handle?: string
  }
  const roteiro = slides
    .map((s, i) => [s.tag, s.title, s.subtitle, s.body].filter(Boolean).join(' — '))
    .filter(Boolean)
    .map((t, i) => `Slide ${i + 1}: ${t}`)
    .join('\n')

  if (!roteiro.trim()) {
    return NextResponse.json({ error: 'Esse carrossel ainda não tem texto pra basear a legenda.' }, { status: 400 })
  }

  const prompt = `Escreva a legenda de Instagram pra este carrossel${handle ? ` (perfil @${handle})` : ''}, baseada SOMENTE no que está nos slides abaixo — não invente fato, dado ou promessa que não esteja aqui:

${roteiro}

Regras da legenda:
- Primeira linha é o gancho — reforça a mesma tensão da capa, não repete a headline literalmente, dá um motivo extra pra pessoa arrastar o carrossel inteiro.
- Corpo curto (3-5 linhas), com quebras de linha (parágrafos curtos, nunca um bloco só), tom de conversa direta — nada de "descubra", "saiba mais", clichê motivacional ou 2ª pessoa tipo "você precisa".
- Termina com uma chamada pra ação clara, alinhada ao que o último slide já pede (comentar palavra, salvar, seguir, etc — deduz do slide final).
- Depois da legenda, pula uma linha e coloca de 5 a 8 hashtags relevantes ao tema (misturando 2-3 amplas e o resto de nicho específico), sem hashtag genérica tipo #instagood #viral.
- Não usa emoji em excesso — no máximo 1 ou 2, se fizer sentido.

Responda SOMENTE com a legenda final pronta pra colar no Instagram (texto + hashtags), sem explicação, sem markdown, sem aspas.`

  try {
    const raw = await callClaudeChat(prompt)
    return NextResponse.json({ caption: extractPlainText(raw) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao gerar a legenda' },
      { status: 500 }
    )
  }
}
