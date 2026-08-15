import { NextRequest, NextResponse } from 'next/server'
import { getCarousel } from '@/lib/storage'
import { generateHTML, generateSlideHTML } from '@/lib/html-renderer'
import { VisualStyle } from '@/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const carousel = getCarousel(id)
  if (!carousel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const slideParam = searchParams.get('slide')
  const styleParam = searchParams.get('style') as VisualStyle | null

  if (styleParam) carousel.visualStyle = styleParam

  let html: string
  if (slideParam !== null) {
    const idx = parseInt(slideParam, 10)
    const slide = carousel.content.slides[idx]
    if (!slide) return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
    html = generateSlideHTML(carousel, slide)
  } else {
    html = generateHTML(carousel)
  }

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  })
}
