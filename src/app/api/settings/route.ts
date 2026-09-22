import { NextRequest, NextResponse } from 'next/server'
import { getSettings, saveSettings, Settings } from '@/lib/settings'

function mask(key: string): string {
  return key ? key.slice(0, 6) + '••••••••••••••••' + key.slice(-4) : ''
}

export async function GET() {
  const s = getSettings()
  return NextResponse.json({
    ...s,
    geminiApiKeyMasked: mask(s.geminiApiKey),
    geminiTextApiKeyMasked: mask(s.geminiTextApiKey),
    anthropicApiKeyMasked: mask(s.anthropicApiKey),
    openaiApiKeyMasked: mask(s.openaiApiKey),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<Settings>
  const updated = saveSettings(body)
  return NextResponse.json({
    ok: true,
    geminiModel: updated.geminiModel,
    textProvider: updated.textProvider,
    geminiTextModel: updated.geminiTextModel,
    claudeCliModel: updated.claudeCliModel,
    anthropicModel: updated.anthropicModel,
    openaiModel: updated.openaiModel,
  })
}
