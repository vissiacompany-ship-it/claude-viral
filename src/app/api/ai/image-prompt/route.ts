import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const { title, subtitle, body, tag } = await req.json() as {
    title?: string; subtitle?: string; body?: string; tag?: string
  }
  const context = [tag, title, subtitle, body].filter(Boolean).join(' — ').trim()
  if (!context) {
    return NextResponse.json({ error: 'Esse slide ainda não tem texto pra basear a imagem.' }, { status: 400 })
  }

  const prompt = `Você é o gerador padrão de prompt de imagem do Claude Viral — usado em todo slide de todo carrossel do produto, sempre a partir do texto real daquele slide. Escreva UM prompt de geração de imagem em inglês, pronto pra colar em ferramentas como Midjourney, ChatGPT ou Gemini, pra ilustrar este trecho de um carrossel de Instagram: "${context}"

O objetivo número 1 é fator viral: uma imagem que quebra o padrão visual do feed e trava o dedo no scroll — não uma ilustração bonitinha e genérica que a pessoa passa reto. Pense em tensão visual, escala inesperada, ângulo incomum, contraste forte, ou um momento tão específico e concreto que prende o olho por curiosidade.

Regras obrigatórias, sempre (não são sobre este slide em particular — valem pra todo prompt que você gerar):
- UMA cena só, um único sujeito/momento central — nunca split-screen, diptych, colagem, grid ou "duas fotos lado a lado". Se o texto do slide sugerir duas ideias, escolha a mais forte das duas e construa a cena em cima só dela.
- PROIBIDO clichê visual de IA: sem mão tocando holograma/rede neural brilhante, sem robô apertando mão de humano, sem cérebro digital azul flutuando, sem overlay de "dados"/circuitos por cima de qualquer coisa, sem pessoa genérica sorrindo pra tela de notebook. Isso é o oposto de fator viral — todo mundo já viu e ignora.
- A cena tem que ser concreta e específica, amarrada ao que o texto do slide realmente diz — uma pessoa real fazendo algo real, um objeto físico, um momento tangível — nunca uma metáfora abstrata de tecnologia/conceito. Pense em como um fotojornalista ou fotógrafo editorial composaria a cena, não como um gerador de imagem genérico composaria.
- Use vocabulário técnico de fotografia profissional (lente específica, abertura, tipo de iluminação, ângulo, profundidade de campo) e peça qualidade cinematográfica, 8K, ultra-detalhada — isso é sobre COMO fotografar a cena concreta que quebra padrão, não um substituto por ter essa cena.
- Não inclua texto nem tipografia na imagem.

Responda SOMENTE com o prompt final em inglês, sem aspas, sem explicação, sem markdown.`

  try {
    const raw = await callClaudeChat(prompt)
    return NextResponse.json({ prompt: extractPlainText(raw) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao gerar o prompt' },
      { status: 500 }
    )
  }
}
