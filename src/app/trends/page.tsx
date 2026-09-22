'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Trend } from '@/types'
import { TrendingUp, Globe2, Target, Plus, Trash2, ChevronRight, Sparkles, Search, Loader2, Check } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

export const TREND_PREFILL_KEY = 'cvTrendPrefill'

export default function TrendsPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [trends, setTrends] = useState<Trend[]>([])
  // Resultado de busca automática não é salvo em disco — só fica na memória desta página
  // enquanto ela estiver aberta. Sai da tela (navega pra outro lugar) e some sozinho, sem
  // precisar excluir manualmente. O que a pessoa adiciona à mão continua salvo (em "trends").
  const [autoResults, setAutoResults] = useState<Trend[]>([])
  const [profileId, setProfileId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [newGlobalText, setNewGlobalText] = useState('')
  const [newGlobalNote, setNewGlobalNote] = useState('')
  const [newNicheText, setNewNicheText] = useState('')
  const [newNicheNote, setNewNicheNote] = useState('')

  const [searchingGlobal, setSearchingGlobal] = useState(false)
  const [searchingNiche, setSearchingNiche] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Busca inicial — "ignore" evita aplicar a resposta se o efeito já tiver rodado de novo
  // (ex: HMR em dev) antes do fetch terminar.
  useEffect(() => {
    let ignore = false
    Promise.all([
      fetch('/api/profiles').then(r => r.json()),
      fetch('/api/trends').then(r => r.json()),
    ]).then(([p, t]) => {
      if (ignore) return
      setProfiles(p)
      setTrends(t)
      if (p.length > 0) setProfileId(id => id || p[0].id)
    })
    // Limpa o resultado de busca ao sair da tela — sem isso, se a navegação do app manter
    // essa página em cache (comum no Next.js ao ir e voltar rápido), o resultado antigo
    // continuava vivo na memória e reaparecia como se tivesse sido salvo.
    return () => { ignore = true; setAutoResults([]) }
  }, [])

  const globalTrends = [...autoResults.filter(t => t.scope === 'global'), ...trends.filter(t => t.scope === 'global')]
  const nicheTrends = [
    ...autoResults.filter(t => t.scope === 'nicho' && t.profileId === profileId),
    ...trends.filter(t => t.scope === 'nicho' && t.profileId === profileId),
  ]
  const profile = profiles.find(p => p.id === profileId)

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const addTrend = async (scope: 'global' | 'nicho') => {
    const text = scope === 'global' ? newGlobalText : newNicheText
    const note = scope === 'global' ? newGlobalNote : newNicheNote
    if (!text.trim()) return
    const created = await fetch('/api/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, profileId: scope === 'nicho' ? profileId : undefined, text: text.trim(), note: note.trim() || undefined }),
    }).then(r => r.json())
    setTrends(prev => [created, ...prev])
    if (scope === 'global') { setNewGlobalText(''); setNewGlobalNote('') }
    else { setNewNicheText(''); setNewNicheNote('') }
  }

  const removeTrend = async (t: Trend) => {
    if (t.source === 'auto') { setAutoResults(prev => prev.filter(x => x.id !== t.id)); return }
    setTrends(prev => prev.filter(x => x.id !== t.id))
    await fetch('/api/trends', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) })
  }

  const searchGlobal = async () => {
    setSearchingGlobal(true)
    setSearchError('')
    try {
      const res = await fetch('/api/trends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global' }),
      }).then(r => r.json())
      if (res.error) setSearchError(res.error)
      else setAutoResults(prev => [...prev.filter(t => t.scope !== 'global'), ...res.created])
    } catch (e) {
      setSearchError(String(e))
    }
    setSearchingGlobal(false)
  }

  const searchNiche = async () => {
    if (!profileId) return
    setSearchingNiche(true)
    setSearchError('')
    try {
      const res = await fetch('/api/trends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'nicho', profileId }),
      }).then(r => r.json())
      if (res.error) setSearchError(res.error)
      else setAutoResults(prev => [...prev.filter(t => !(t.scope === 'nicho' && t.profileId === profileId)), ...res.created])
    } catch (e) {
      setSearchError(String(e))
    }
    setSearchingNiche(false)
  }

  const trendTopic = (t: Trend) => t.note ? `${t.text} — ${t.note}` : t.text

  const applyTrend = (t: Trend) => {
    sessionStorage.setItem(TREND_PREFILL_KEY, JSON.stringify({
      profileId: t.scope === 'nicho' ? t.profileId : profileId || undefined,
      topic: trendTopic(t),
    }))
    router.push('/ideas')
  }

  // Junta as tendências marcadas (pode ser uma mistura de gerais e do nicho) num tópico só,
  // separado por linha — a tela de Ideias entende isso como material bruto pra IA combinar.
  const applySelected = (list: Trend[]) => {
    const chosen = list.filter(t => selected.has(t.id))
    if (chosen.length === 0) return
    if (chosen.length === 1) { applyTrend(chosen[0]); return }
    sessionStorage.setItem(TREND_PREFILL_KEY, JSON.stringify({
      profileId: chosen.find(t => t.scope === 'nicho')?.profileId || profileId || undefined,
      topic: chosen.map(trendTopic).join('\n'),
    }))
    router.push('/ideas')
  }

  const TrendRow = ({ t }: { t: Trend }) => (
    <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: 'var(--bg3)' }}>
      <button onClick={() => toggleSelected(t.id)} title="Selecionar"
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: selected.has(t.id) ? 'var(--accent)' : 'var(--bg2)', border: '1px solid var(--border2)' }}>
        {selected.has(t.id) && <Check size={12} className="text-black" strokeWidth={3}/>}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{t.text}</p>
        {t.note && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{t.note}</p>}
      </div>
      <button onClick={() => applyTrend(t)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-black flex-shrink-0" style={{ background: 'var(--grad)' }}>
        Usar essa <ChevronRight size={13}/>
      </button>
      <button onClick={() => removeTrend(t)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--muted)' }}><Trash2 size={14}/></button>
    </div>
  )

  const globalSelectedCount = globalTrends.filter(t => selected.has(t.id)).length
  const nicheSelectedCount = nicheTrends.filter(t => selected.has(t.id)).length

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="trends"/>
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2.5 mb-2 text-base font-bold" style={{ color: 'var(--accent2)' }}>
            <TrendingUp size={19}/> Tendências
          </div>
          <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
            O que está em alta agora — global (vale pra qualquer nicho) ou específico do seu segmento. Resultado de
            busca é só pra essa visita (não fica salvo) — marca uma ou várias e usa direto na tela de Ideias. O que
            você adiciona à mão continua salvo.
          </p>
          {searchError && <p className="text-sm mb-5" style={{ color: '#ef4444' }}>{searchError}</p>}

          {/* Globais */}
          <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Globe2 size={16} style={{ color: 'var(--accent2)' }}/> Gerais (mercado, mundo)
              </div>
              <div className="flex items-center gap-2">
                {globalSelectedCount > 0 && (
                  <button onClick={() => applySelected(globalTrends)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-black flex-shrink-0" style={{ background: 'var(--grad)' }}>
                    Usar {globalSelectedCount} selecionada{globalSelectedCount > 1 ? 's' : ''} <ChevronRight size={13}/>
                  </button>
                )}
                <button onClick={searchGlobal} disabled={searchingGlobal} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-black disabled:opacity-60 flex-shrink-0" style={{ background: 'var(--grad)' }}>
                  {searchingGlobal ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
                  {searchingGlobal ? 'Buscando...' : 'Buscar agora'}
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {globalTrends.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>Nenhuma tendência geral ainda.</p>}
              {globalTrends.map(t => <TrendRow key={t.id} t={t}/>)}
            </div>

            <div className="flex gap-2">
              <input value={newGlobalText} onChange={e => setNewGlobalText(e.target.value)} placeholder="Ex: Copa do Mundo 2026" className="flex-1"/>
              <input value={newGlobalNote} onChange={e => setNewGlobalNote(e.target.value)} placeholder="Por que está em alta (opcional)" className="flex-1"/>
              <button onClick={() => addTrend('global')} disabled={!newGlobalText.trim()} className="px-3.5 rounded-lg disabled:opacity-40" style={{ background: 'var(--bg3)' }}><Plus size={16}/></button>
            </div>
          </div>

          {/* Do nicho */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Target size={16} style={{ color: 'var(--accent2)' }}/> Do seu nicho
              </div>
              {profiles.length > 0 && (
                <div className="flex items-center gap-2">
                  {nicheSelectedCount > 0 && (
                    <button onClick={() => applySelected(nicheTrends)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-black flex-shrink-0" style={{ background: 'var(--grad)' }}>
                      Usar {nicheSelectedCount} selecionada{nicheSelectedCount > 1 ? 's' : ''} <ChevronRight size={13}/>
                    </button>
                  )}
                  <button onClick={searchNiche} disabled={searchingNiche || !profileId} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-black disabled:opacity-60 flex-shrink-0" style={{ background: 'var(--grad)' }}>
                    {searchingNiche ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
                    {searchingNiche ? 'Buscando...' : 'Buscar agora'}
                  </button>
                </div>
              )}
            </div>

            {profiles.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Crie um Perfil primeiro pra ter tendências específicas de nicho.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {profiles.map(p => (
                    <button key={p.id} onClick={() => setProfileId(p.id)} className="px-3.5 py-2 rounded-lg text-xs font-semibold"
                      style={profileId === p.id ? { background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid var(--accent)' } : { background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid transparent' }}>
                      {p.name}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 mb-4">
                  {nicheTrends.length === 0 && <p className="text-xs" style={{ color: 'var(--muted)' }}>Nenhuma tendência ainda pro perfil {profile?.name}.</p>}
                  {nicheTrends.map(t => <TrendRow key={t.id} t={t}/>)}
                </div>

                <div className="flex gap-2">
                  <input value={newNicheText} onChange={e => setNewNicheText(e.target.value)} placeholder="Ex: Ozempic" className="flex-1"/>
                  <input value={newNicheNote} onChange={e => setNewNicheNote(e.target.value)} placeholder="Como conecta com o nicho (opcional)" className="flex-1"/>
                  <button onClick={() => addTrend('nicho')} disabled={!newNicheText.trim()} className="px-3.5 rounded-lg disabled:opacity-40" style={{ background: 'var(--bg3)' }}><Plus size={16}/></button>
                </div>
              </>
            )}
          </div>

          <p className="text-xs mt-6 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <Sparkles size={13}/> A busca usa o mesmo provedor de IA configurado em Configurações (Claude Code
            local por padrão, ou sua própria chave de Anthropic/OpenAI/Gemini se tiver escolhido uma).
          </p>
        </div>
      </main>
    </div>
  )
}
