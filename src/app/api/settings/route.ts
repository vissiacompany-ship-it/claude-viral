import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveSettings } from '@/lib/settings'

export async function GET() {
  const s = getSettings()
  // Mask API key for display
  const masked = s.geminiApiKey
    ? s.geminiApiKey.slice(0, 6) + '••••••••••••••••' + s.geminiApiKey.slice(-4)
    : ''
  return NextResponse.json({ ...s, geminiApiKeyMasked: masked })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { geminiApiKey?: string; geminiModel?: string }
  const updated = saveSettings(body)
  return NextResponse.json({ ok: true, geminiModel: updated.geminiModel })
}
