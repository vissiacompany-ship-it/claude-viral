import { NextRequest, NextResponse } from 'next/server'
import { getCarousels, saveCarousel, deleteCarousel } from '@/lib/storage'
import { Carousel } from '@/types'
import { v4 as uuid } from 'uuid'
import { generateSlideHTML } from '@/lib/html-renderer'
import { launchBrowser } from '@/lib/browser'
import { persistImage, persistImages, inlineCarouselImages } from '@/lib/image-store'

// Troca toda foto em base64 (data URL) do carrossel por um caminho de arquivo de verdade
// antes de gravar no disco — é isso que mantém o data/carousels.json pequeno independente
// de quantas fotos o carrossel tiver (ver comentário detalhado no GET, abaixo).
function persistCarouselImages(carousel: Carousel): Carousel {
  return {
    ...carousel,
    thumbnail: persistImage(carousel.thumbnail),
    briefing: { ...carousel.briefing, avatarImage: persistImage(carousel.briefing.avatarImage) },
    content: {
      ...carousel.content,
      slides: carousel.content.slides.map(s => ({
        ...s,
        image: persistImage(s.image),
        images: persistImages(s.images),
      })),
    },
  }
}

// Renderiza o slide 1 (via Playwright) e devolve uma miniatura JPEG pequena em base64
// pra usar de preview no dashboard — se der erro, some sem quebrar o save.
async function renderThumbnail(carouselIn: Carousel): Promise<string | undefined> {
  // Numa atualização (carrossel já salvo antes), a imagem que chega aqui já é o caminho
  // persistido (/uploads/carousels/xxx.jpg), não mais o data URL original — sem inlinar de
  // volta pra base64, o Playwright (que renderiza via HTML solto, sem base URL nenhuma) não
  // consegue carregar esse caminho raiz-relativo, e a miniatura sai sem a foto.
  const carousel = inlineCarouselImages(carouselIn)
  const slide = carousel.content.slides[0]
  if (!slide) return undefined
  try {
    const browser = await launchBrowser()
    const page = (await (browser as { newPage: () => Promise<unknown> }).newPage()) as {
      setViewportSize: (s: { width: number; height: number }) => Promise<void>
      setContent: (h: string, o: Record<string, unknown>) => Promise<void>
      screenshot: (o: Record<string, unknown>) => Promise<Uint8Array>
    }
    await page.setViewportSize({ width: 1080, height: 1350 })
    await page.setContent(generateSlideHTML(carousel, slide), { waitUntil: 'networkidle' })
    const buf = await page.screenshot({ type: 'png' })
    await (browser as { close: () => Promise<void> }).close()

    const sharp = require('sharp') // eslint-disable-line @typescript-eslint/no-require-imports
    const resized: Buffer = await sharp(buf).resize(360, 450).jpeg({ quality: 72 }).toBuffer()
    return `data:image/jpeg;base64,${resized.toString('base64')}`
  } catch {
    return undefined
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (id) {
    const { getCarousel } = await import('@/lib/storage')
    const carousel = getCarousel(id)
    if (!carousel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(carousel)
  }
  // Listagem (Dashboard/Meu Conteúdo) só precisa de id/título/status/thumbnail pra montar os
  // cards — nunca das imagens de cada slide em base64. Sem isso, o JSON de resposta cresce
  // proporcional a TODAS as fotos de TODOS os carrosséis salvos (o arquivo em disco já passa
  // de 50MB com poucas dezenas de carrosséis), deixando a listagem cada vez mais lenta pra
  // sempre. A tela de edição sempre busca o carrossel individual (com ?id=) pra ter as fotos.
  const carousels = getCarousels().map(c => ({
    ...c,
    briefing: { ...c.briefing, avatarImage: undefined },
    content: { ...c.content, slides: c.content.slides.map(s => ({ ...s, image: undefined, images: undefined })) },
  }))
  return NextResponse.json(carousels)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Carousel>
  const now = new Date().toISOString()
  const carousel: Carousel = {
    id: body.id || uuid(),
    title: body.title || 'Novo Carrossel',
    profileId: body.profileId || '',
    templateId: body.templateId,
    briefing: body.briefing!,
    content: body.content || {
      triagem: '', eixo: '', funil: '',
      headlines: [], selectedHeadline: 0,
      spine: { headline: '', hook: '', mechanism: '', proof: '', application: '', direction: '' },
      slides: [], caption: ''
    },
    visualStyle: body.visualStyle || 'minimal',
    status: body.status || 'draft',
    createdAt: body.createdAt || now,
    updatedAt: now,
    thumbnail: body.thumbnail,
  }
  carousel.thumbnail = (await renderThumbnail(carousel)) || carousel.thumbnail
  const persisted = persistCarouselImages(carousel)
  saveCarousel(persisted)
  return NextResponse.json(persisted)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as Partial<Carousel> & { id: string }
  const { getCarousel } = await import('@/lib/storage')
  const existing = getCarousel(body.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = persistCarouselImages({ ...existing, ...body, updatedAt: new Date().toISOString() })
  saveCarousel(updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteCarousel(id)
  return NextResponse.json({ ok: true })
}
