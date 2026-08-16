import { NextRequest, NextResponse } from 'next/server'
import { callClaudeCopyChat, extractPlainText } from '@/lib/claude'

export async function POST(req: NextRequest) {
  const { messages, skill, profile } = await req.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    skill?: 'copy' | 'ideias' | 'geral'
    profile?: { name?: string; niche?: string; instagram?: string }
  }
  if (!messages?.length) {
    return NextResponse.json({ error: 'messages é obrigatório' }, { status: 400 })
  }
  try {
    const raw = await callClaudeCopyChat(messages, skill, profile)
    return NextResponse.json({ reply: extractPlainText(raw) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao conversar com o chat' },
      { status: 500 }
    )
  }
}
