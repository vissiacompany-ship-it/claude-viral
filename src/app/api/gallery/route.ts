import { NextRequest, NextResponse } from 'next/server'
import { getGalleryImagesByProfile, saveGalleryImage, deleteGalleryImage } from '@/lib/storage'
import { persistGalleryImage } from '@/lib/image-store'
import { GalleryImage } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get('profileId')
  if (!profileId) return NextResponse.json({ error: 'profileId é obrigatório' }, { status: 400 })
  return NextResponse.json(getGalleryImagesByProfile(profileId))
}

// Adiciona 1 imagem à galeria — usado tanto pro upload manual (fotos do cliente) quanto pra
// salvar automaticamente toda imagem gerada em qualquer carrossel desse perfil.
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    profileId?: string; image?: string; source?: 'upload' | 'generated'; label?: string
    prompt?: string; category?: string; style?: string; dimension?: string
    references?: { url: string; note?: string }[]
  }
  if (!body.profileId || !body.image) {
    return NextResponse.json({ error: 'profileId e image são obrigatórios' }, { status: 400 })
  }
  const url = persistGalleryImage(body.image)
  if (!url) return NextResponse.json({ error: 'Imagem inválida (precisa ser um data URL)' }, { status: 400 })
  const item: GalleryImage = {
    id: uuid(),
    profileId: body.profileId,
    url,
    source: body.source || 'upload',
    label: body.label,
    createdAt: new Date().toISOString(),
    prompt: body.prompt,
    category: body.category,
    style: body.style,
    dimension: body.dimension,
    references: body.references,
  }
  saveGalleryImage(item)
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteGalleryImage(id)
  return NextResponse.json({ ok: true })
}
