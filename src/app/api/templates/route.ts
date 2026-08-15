import { NextRequest, NextResponse } from 'next/server'
import { getTemplates, getTemplate, saveTemplate, deleteTemplate } from '@/lib/storage'
import { CarouselTemplate } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (id) {
    const template = getTemplate(id)
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(template)
  }
  return NextResponse.json(getTemplates())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<CarouselTemplate>
  const template: CarouselTemplate = {
    id: body.id || uuid(),
    name: body.name || 'Novo modelo',
    description: body.description || '',
    thumbnail: body.thumbnail,
    slides: body.slides || [],
    createdAt: body.createdAt || new Date().toISOString(),
  }
  saveTemplate(template)
  return NextResponse.json(template)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteTemplate(id)
  return NextResponse.json({ ok: true })
}
