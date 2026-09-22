import { NextRequest, NextResponse } from 'next/server'
import { getIdeas, saveIdea, deleteIdea } from '@/lib/storage'
import { Idea } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET() {
  return NextResponse.json(getIdeas())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Idea>
  const idea: Idea = {
    id: body.id || uuid(),
    profileId: body.profileId,
    text: body.text || '',
    angleType: body.angleType,
    pillar: body.pillar,
    favorite: body.favorite || false,
    fromAI: body.fromAI,
    usedInNarrative: body.usedInNarrative || false,
    createdAt: body.createdAt || new Date().toISOString(),
  }
  saveIdea(idea)
  return NextResponse.json(idea)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteIdea(id)
  return NextResponse.json({ ok: true })
}
