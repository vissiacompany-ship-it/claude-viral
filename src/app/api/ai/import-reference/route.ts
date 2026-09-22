import { NextRequest, NextResponse } from 'next/server'
import { runClaudeWithFiles, extractPlainText } from '@/lib/claude'
import { newTmpDir, cleanupDir, downloadInstagramVideo, downloadInstagramImages, extractFrames, extractAudio, transcribeAudio, persistImagesToPublic } from '@/lib/media-import'
import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'

// Modo padrão (storeOriginal=false, comportamento de sempre): a Biblioteca nunca guarda o
// conteúdo original de outra conta — só a estrutura, generalizada em [colchetes].
const SYSTEM_FORMULA = `Você analisa um conteúdo real (imagens de um post do Instagram, extraídas por ferramenta automática) pra virar um item reutilizável na Biblioteca de Referências da pessoa.

Regra inegociável: nunca reproduza texto original, nome de marca, nome de pessoa, número/dado específico do conteúdo analisado. Generalize tudo em [colchetes] — ex: "[Nome da pessoa] resolveu [problema específico] em [prazo]" no lugar de citar quem/o quê real. Extraia só o PADRÃO estrutural por trás — nunca copie a frase, legenda ou transcrição literalmente.

Responda em JSON, só o objeto, sem markdown, nesse formato exato:
{
  "title": "nome curto do padrão (ex: Gancho de contraste de status)",
  "formula": "a fórmula com [colchetes], pronta pra reusar em qualquer nicho",
  "mechanicPreserved": ["item 1 do que faz isso funcionar", "item 2", "item 3"]
}`

// Modo storeOriginal=true — decisão explícita da pessoa de guardar o carrossel na íntegra
// (imagem + texto completo), pra depois usar como molde forte em "Gerar baseado nesse". Aqui
// a IA pode transcrever o texto literal em vez de abstrair.
const SYSTEM_ORIGINAL = `Você analisa um conteúdo real (imagens de um post do Instagram, extraídas por ferramenta automática) pra virar um item da Biblioteca de Referências da pessoa, guardado NA ÍNTEGRA (ela pediu explicitamente pra guardar o conteúdo completo, não uma fórmula abstraída).

Transcreva o texto de cada slide/imagem literalmente (título, subtítulo, corpo, legenda), na ordem em que aparece. Não invente texto que não esteja visível nas imagens.

Responda em JSON, só o objeto, sem markdown, nesse formato exato:
{
  "title": "nome curto pra identificar esse carrossel depois (ex: Carrossel sobre geração Nickelodeon)",
  "fullText": "o texto completo transcrito, um bloco por slide, separado por --- (ou o texto/legenda corrido se não for carrossel)",
  "mechanicPreserved": ["item 1 do que faz isso funcionar", "item 2", "item 3"]
}`

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    url?: string
    fileBase64?: string
    fileName?: string
    mimeType?: string
    format?: string
    storeOriginal?: boolean
  }

  let dir: string | undefined
  try {
    let imagePaths: string[] = []
    let transcript: string | undefined
    let caption: string | undefined
    let detectedFormat = body.format

    if (body.url?.trim()) {
      dir = newTmpDir('cv_import')
      try {
        const { videoPath, caption: cap } = await downloadInstagramVideo(body.url.trim(), dir)
        caption = cap
        imagePaths = await extractFrames(videoPath, dir)
        const audioPath = await extractAudio(videoPath, dir)
        transcript = await transcribeAudio(audioPath, dir)
        detectedFormat = detectedFormat || 'reels'
      } catch {
        const { imagePaths: imgs, caption: cap } = await downloadInstagramImages(body.url.trim(), dir)
        imagePaths = imgs
        caption = cap
        detectedFormat = detectedFormat || (imgs.length > 1 ? 'carrossel' : 'post-unico')
      }
    } else if (body.fileBase64 && body.fileName) {
      dir = newTmpDir('cv_import')
      const isVideo = (body.mimeType || '').startsWith('video/')
      const ext = path.extname(body.fileName) || (isVideo ? '.mp4' : '.jpg')
      const savedPath = path.join(dir, `upload${ext}`)
      fs.writeFileSync(savedPath, Buffer.from(body.fileBase64, 'base64'))
      if (isVideo) {
        imagePaths = await extractFrames(savedPath, dir)
        const audioPath = await extractAudio(savedPath, dir)
        transcript = await transcribeAudio(audioPath, dir)
        detectedFormat = detectedFormat || 'reels'
      } else {
        imagePaths = [savedPath]
        detectedFormat = detectedFormat || 'post-unico'
      }
    } else {
      return NextResponse.json({ error: 'Envie um link do Instagram ou anexe um arquivo' }, { status: 400 })
    }

    if (!imagePaths.length) {
      return NextResponse.json({ error: 'Não consegui extrair nenhuma imagem desse conteúdo' }, { status: 500 })
    }

    const storeOriginal = !!body.storeOriginal
    const system = storeOriginal ? SYSTEM_ORIGINAL : SYSTEM_FORMULA
    const captionLabel = storeOriginal ? 'Legenda original do post (transcreva o que for texto de slide, ignore o resto)' : 'Legenda original do post (só como contexto, NUNCA reproduza literalmente)'
    const transcriptLabel = storeOriginal ? 'Transcrição do áudio' : 'Transcrição do áudio (só como contexto, NUNCA reproduza literalmente)'

    const prompt = `${system}

Formato detectado: ${detectedFormat}
${caption ? `\n${captionLabel}:\n${caption}\n` : ''}${transcript ? `\n${transcriptLabel}:\n${transcript}\n` : ''}
Imagens pra você analisar (leia cada uma com sua ferramenta Read antes de responder):
${imagePaths.map(p => `- ${p}`).join('\n')}

${storeOriginal ? 'Transcreva o texto de cada imagem/slide, na ordem, e só então responda no formato JSON pedido acima.' : 'Descreva pra si mesmo o que está acontecendo visualmente e no texto, identifique o padrão estrutural por trás, e só então responda no formato JSON pedido acima.'}`

    const raw = await runClaudeWithFiles(prompt, dir)
    const text = extractPlainText(raw)
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) {
      // A IA às vezes recusa (com razão) e explica por que em texto solto — ex: conteúdo
      // baixado não tem nada analisável. Repassar a explicação em vez de um erro genérico.
      throw new Error(text.trim().slice(0, 400) || 'A IA não retornou um resultado válido')
    }

    if (storeOriginal) {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { title: string; fullText: string; mechanicPreserved: string[] }
      const referenceId = uuid()
      const publicImages = persistImagesToPublic(imagePaths, referenceId)
      return NextResponse.json({ ...parsed, format: detectedFormat, id: referenceId, images: publicImages, storeOriginal: true })
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { title: string; formula: string; mechanicPreserved: string[] }
    return NextResponse.json({ ...parsed, format: detectedFormat })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  } finally {
    if (dir) cleanupDir(dir)
  }
}
