import { NextRequest, NextResponse } from 'next/server'
import { getChatConversations, getChatConversation, saveChatConversation, deleteChatConversation } from '@/lib/storage'
import { ChatConversation } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (id) {
    const conversation = getChatConversation(id)
    if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(conversation)
  }
  return NextResponse.json(getChatConversations())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<ChatConversation>
  const now = new Date().toISOString()
  const existing = body.id ? getChatConversation(body.id) : null
  const conversation: ChatConversation = {
    id: body.id || uuid(),
    title: body.title || 'Conversa sem título',
    skill: body.skill || 'geral',
    profileId: body.profileId,
    messages: body.messages || [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }
  saveChatConversation(conversation)
  return NextResponse.json(conversation)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteChatConversation(id)
  return NextResponse.json({ ok: true })
}
