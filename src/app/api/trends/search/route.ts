import { NextRequest, NextResponse } from 'next/server'
import { runTrendSearch, extractJSON } from '@/lib/claude'
import { getProfiles } from '@/lib/storage'
import { Trend } from '@/types'
import { v4 as uuid } from 'uuid'

interface TrendResult { text: string; note?: string }

// Resultado de busca é passageiro de propósito — a pessoa usa na hora (ou não) e sai da tela;
// não grava em disco, só devolve pro front-end guardar na memória da página enquanto ela
// estiver aberta. O que ela adicionar à mão (POST /api/trends) continua salvo normalmente.
export async function POST(req: NextRequest) {
  const { scope, profileId } = await req.json() as { scope: 'global' | 'nicho'; profileId?: string }
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  let prompt: string
  if (scope === 'global') {
    prompt = `Busque na web agora (data de hoje: ${today}) e me diga 5 assuntos GERAIS em alta / mais falados / mais pesquisados no Brasil neste momento — vale cultura pop, notícia, mercado, data comemorativa próxima, evento em andamento (Copa, eleição, etc.), qualquer coisa que sirva de gancho pra qualquer nicho.

Responda SÓ com um JSON puro, sem markdown, sem crases, exatamente neste formato:
{"trends":[{"text":"...","note":"por que está em alta, 1 frase curta"}]}`
  } else {
    const profile = profileId ? getProfiles().find(p => p.id === profileId) : undefined
    if (!profile) return NextResponse.json({ error: 'Selecione um perfil primeiro.' }, { status: 400 })
    prompt = `Busque na web agora (data de hoje: ${today}) e me diga 5 assuntos em alta especificamente no nicho "${profile.niche}"${profile.subniche ? ` (${profile.subniche})` : ''} no Brasil neste momento — um produto, polêmica, lançamento, notícia ou tendência de comportamento do público desse mercado específico.

Responda SÓ com um JSON puro, sem markdown, sem crases, exatamente neste formato:
{"trends":[{"text":"...","note":"como conecta com o nicho, 1 frase curta"}]}`
  }

  try {
    const raw = await runTrendSearch(prompt)
    const parsed = extractJSON(raw) as { trends?: TrendResult[] }
    const results = parsed.trends || []

    const created: Trend[] = results.map(r => ({
      id: uuid(),
      scope,
      profileId: scope === 'nicho' ? profileId : undefined,
      text: r.text,
      note: r.note,
      source: 'auto',
      createdAt: new Date().toISOString(),
    }))

    return NextResponse.json({ created })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar tendências' },
      { status: 500 }
    )
  }
}
