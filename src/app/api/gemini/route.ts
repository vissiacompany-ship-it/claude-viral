import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'
import { inlineImage } from '@/lib/image-store'

export interface ImageReference {
  image: string // data URL (upload direto) OU /uploads/... (vindo da galeria)
  note?: string // instrução livre opcional pra ESSA referência específica
}

const IMAGEN_MODELS = [
  'imagen-3.0-generate-001',
  'imagen-3.0-fast-generate-001',
  'imagegeneration@006',
]

async function callImagen(prompt: string, model: string, apiKey: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '4:5' }
      })
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Imagen error: ${err}`)
  }
  const data = await res.json() as { predictions?: Array<{ bytesBase64Encoded: string; mimeType: string }> }
  const pred = data.predictions?.[0]
  if (!pred) throw new Error('Sem imagem na resposta')
  return `data:${pred.mimeType || 'image/png'};base64,${pred.bytesBase64Encoded}`
}

// Referências (data URL ou caminho de arquivo já persistido, ex: vindo da galeria) são
// anexadas como imagem de entrada JUNTO com o texto, na mesma chamada de API — é a versão
// automatizada (sem passo manual, escala pra qualquer volume de geração) da técnica de "colar
// imagem de referência no chat" que funciona bem em ChatGPT/Gemini: o Gemini image-gen aceita
// várias imagens + texto na mesma requisição. Cada referência pode ter sua própria nota
// ("usa só o fundo dessa", "gostei da roupa dessa") — igual ao painel "Inspirações de Estilo"
// de referência que o Paulo mostrou, só que resolvido via API em vez de manual.
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  return match ? { mimeType: match[1], data: match[2] } : null
}

async function callGeminiImage(prompt: string, model: string, apiKey: string, references?: ImageReference[]) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  const resolved: Array<{ note?: string; parsed: { mimeType: string; data: string } }> = []
  for (const r of references || []) {
    const parsed = parseDataUrl(inlineImage(r.image) || r.image)
    if (parsed) resolved.push({ note: r.note, parsed })
  }

  if (resolved.length) {
    // Cada inlineData vem logo ANTES da instrução textual — ajuda o modelo a associar a
    // imagem 1/2/3 com a nota certa do texto (numerado na mesma ordem).
    resolved.forEach(r => parts.push({ inlineData: r.parsed }))
    const refLines = resolved.map((r, i) =>
      `Reference image ${i + 1}: ${r.note?.trim() || 'use as a general visual/style inspiration — subject, colors, mood, or composition, whatever fits naturally with the scene described below.'}`
    ).join('\n')
    parts.push({
      text: `You are given ${resolved.length} reference image(s) attached above, in this order. Use EACH reference ONLY for what its instruction below says — never copy elements, subjects or text from a reference beyond what its own instruction asks for. Do not literally collage the references together; blend their influence naturally into ONE new coherent photo.\n\n${refLines}\n\nNow generate a completely new image showing this scene: ${prompt}`,
    })
  } else {
    parts.push({ text: prompt })
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      })
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error: ${err}`)
  }
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>
  }
  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
  if (!part?.inlineData) throw new Error('Sem imagem na resposta')
  return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { prompt: string; apiKey?: string; model?: string; references?: ImageReference[] }
  const settings = getSettings()
  const { prompt, references } = body

  try {
    const apiKey = body.apiKey || settings.geminiApiKey
    const model = body.model || settings.geminiModel || 'gemini-2.5-flash-image'
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key não configurada. Vá em Configurações para adicionar.' }, { status: 400 })
    }
    const isImagen = IMAGEN_MODELS.includes(model)
    const image = isImagen
      ? await callImagen(prompt, model, apiKey)
      : await callGeminiImage(prompt, model, apiKey, references)
    return NextResponse.json({ image })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha na geração de imagem' },
      { status: 500 }
    )
  }
}
