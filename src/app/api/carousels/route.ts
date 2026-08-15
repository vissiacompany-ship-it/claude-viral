import { NextRequest, NextResponse } from 'next/server'
import { getCarousels, saveCarousel, deleteCarousel } from '@/lib/storage'
import { Carousel } from '@/types'
import { v4 as uuid } from 'uuid'
import { generateSlideHTML } from '@/lib/html-renderer'
import { launchBrowser } from '@/lib/browser'

// Renderiza o slide 1 (via Playwright) e devolve uma miniatura JPEG pequena em base64
// pra usar de preview no dashboard — se der erro, some sem quebrar o save.
async function renderThumbnail(carousel: Carousel): Promise<string | undefined> {
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
  const carousels = getCarousels()
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
  saveCarousel(carousel)
  return NextResponse.json(carousel)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json() as Partial<Carousel> & { id: string }
  const { getCarousel } = await import('@/lib/storage')
  const existing = getCarousel(body.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated: Carousel = { ...existing, ...body, updatedAt: new Date().toISOString() }
  saveCarousel(updated)
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteCarousel(id)
  return NextResponse.json({ ok: true })
}
