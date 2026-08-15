import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'

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

async function callGeminiImage(prompt: string, model: string, apiKey: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
  const body = await req.json() as { prompt: string; apiKey?: string; model?: string }
  const settings = getSettings()

  const apiKey = body.apiKey || settings.geminiApiKey
  const model = body.model || settings.geminiModel || 'imagen-3.0-fast-generate-001'
  const { prompt } = body

  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key não configurada. Vá em Configurações para adicionar.' }, { status: 400 })
  }

  try {
    const isImagen = IMAGEN_MODELS.includes(model)
    const image = isImagen
      ? await callImagen(prompt, model, apiKey)
      : await callGeminiImage(prompt, model, apiKey)
    return NextResponse.json({ image })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha na geração de imagem' },
      { status: 500 }
    )
  }
}
