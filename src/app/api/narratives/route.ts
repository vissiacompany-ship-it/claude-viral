import { NextRequest, NextResponse } from 'next/server'
import { getNarratives, saveNarrative, deleteNarrative } from '@/lib/storage'
import { Narrative } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET() {
  return NextResponse.json(getNarratives())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Narrative>
  const narrative: Narrative = {
    id: body.id || uuid(),
    profileId: body.profileId,
    ideaId: body.ideaId,
    title: body.title || 'Narrativa sem título',
    content: body.content || '',
    pillar: body.pillar,
    highlights: body.highlights,
    usedInCarousel: body.usedInCarousel || false,
    createdAt: body.createdAt || new Date().toISOString(),
  }
  saveNarrative(narrative)
  return NextResponse.json(narrative)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteNarrative(id)
  return NextResponse.json({ ok: true })
}
