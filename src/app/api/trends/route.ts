import { NextRequest, NextResponse } from 'next/server'
import { getTrends, saveTrend, deleteTrend } from '@/lib/storage'
import { Trend } from '@/types'
import { v4 as uuid } from 'uuid'

export async function GET() {
  return NextResponse.json(getTrends())
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Trend>
  const trend: Trend = {
    id: body.id || uuid(),
    scope: body.scope === 'nicho' ? 'nicho' : 'global',
    profileId: body.scope === 'nicho' ? body.profileId : undefined,
    text: body.text || '',
    note: body.note || undefined,
    // Sempre "manual" — resultado de busca automática (source: "auto") nunca deve ser salvo
    // em disco por esse endpoint, só existe na memória do navegador enquanto a tela de
    // Tendências está aberta (ver comentário em /api/trends/search/route.ts).
    source: 'manual',
    createdAt: body.createdAt || new Date().toISOString(),
  }
  saveTrend(trend)
  return NextResponse.json(trend)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: string }
  deleteTrend(id)
  return NextResponse.json({ ok: true })
}
