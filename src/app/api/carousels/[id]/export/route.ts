import { NextRequest, NextResponse } from 'next/server'
import { getCarousel } from '@/lib/storage'
import { generateSlideHTML } from '@/lib/html-renderer'
import { launchBrowser } from '@/lib/browser'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const carousel = getCarousel(id)
  if (!carousel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const browser = await launchBrowser()
    const page = (await (browser as { newPage: () => Promise<unknown> }).newPage()) as {
      setViewportSize: (s: { width: number; height: number }) => Promise<void>
      setContent: (h: string, o: Record<string, unknown>) => Promise<void>
      screenshot: (o: Record<string, unknown>) => Promise<Uint8Array>
      close?: () => Promise<void>
    }
    const closeBrowser = (browser as { close: () => Promise<void> }).close

    const { slides } = carousel.content
    const pngs: Uint8Array[] = []

    for (const slide of slides) {
      await page.setViewportSize({ width: 1080, height: 1350 })
      const html = generateSlideHTML(carousel, slide)
      await page.setContent(html, { waitUntil: 'networkidle' })
      const shot = await page.screenshot({ type: 'png', fullPage: false })
      pngs.push(shot)
    }

    await closeBrowser.call(browser)

    const JZ = require('jszip') // eslint-disable-line @typescript-eslint/no-require-imports
    const zip = new JZ()
    pngs.forEach((buf, i) => {
      zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, buf)
    })
    const blob: Blob = await zip.generateAsync({ type: 'blob' })

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${carousel.title.replace(/[^a-z0-9]/gi, '-')}.zip"`,
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({
      error: `Export não disponível: ${msg}. Instale: npm install playwright jszip && npx playwright install chromium`
    }, { status: 500 })
  }
}
