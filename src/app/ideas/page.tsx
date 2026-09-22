'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Profile, Idea, Narrative, ContentPillar, SlideHighlight } from '@/types'
import { CONTENT_PILLARS, PILLAR_ORDER } from '@/lib/pillars'
import { splitBlocos, parseBloco } from '@/lib/bulk-parse'
import { ArrowLeft, Sparkles, Loader2, Bookmark, Trash2, Copy, Check, ChevronRight, Lightbulb, Zap, FileText, LayoutGrid, Search, Heart, Plus, X, Bold, Italic, Underline, SlidersHorizontal } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { CONTENT_PREFILL_KEY } from '@/components/CreateCarouselModal'
import { TREND_PREFILL_KEY } from '@/app/trends/page'

const HIGHLIGHT_COLORS = ['#ff8a1e', '#facc15', '#4ade80', '#38bdf8', '#f472b6', '#ffffff']

interface EditableBlock { tag: string; title: string; subtitle: string; body: string }

type Step = 'setup' | 'options' | 'confirm' | 'narrative'
type Tab = 'gerar' | 'banco-ideias' | 'banco-narrativas'

const STEP_LABELS: Record<Step, string> = { setup: 'Briefing', options: 'Escolher ângulo', confirm: 'Confirmar', narrative: 'Roteiro pronto' }
const STEP_ORDER: Step[] = ['setup', 'options', 'confirm', 'narrative']

interface IdeaOption { text: string; angleType?: string; pillar?: ContentPillar }
interface HookOption { hook: string; pattern: string; why: string }

export default function IdeasPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('gerar')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [savedIdeas, setSavedIdeas] = useState<Idea[]>([])
  const [savedNarratives, setSavedNarratives] = useState<Narrative[]>([])

  // Prefill vindo de "Usar essa" na tela de Tendências (perfil + tema já preenchidos) — lido
  // uma vez só, na inicialização preguiçosa do useState, em vez de setState dentro de efeito.
  const trendPrefill = (): { profileId?: string; topic?: string } => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = sessionStorage.getItem(TREND_PREFILL_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  }

  const [step, setStep] = useState<Step>('setup')
  const [profileId, setProfileId] = useState(() => trendPrefill().profileId || '')
  const [topic, setTopic] = useState(() => trendPrefill().topic || '')
  const [cta, setCta] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [ideaOptions, setIdeaOptions] = useState<IdeaOption[]>([])
  const [chosen, setChosen] = useState('')
  const [chosenPillar, setChosenPillar] = useState<ContentPillar | undefined>(undefined)

  const [narrative, setNarrative] = useState<{ title: string; content: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Trocar o gancho depois que a narrativa já saiu — em vez de escolher o gancho antes,
  // isoladamente, sem ver o resto do roteiro
  const [showRegenHooks, setShowRegenHooks] = useState(false)
  const [regenHooks, setRegenHooks] = useState<HookOption[]>([])
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenError, setRegenError] = useState('')

  // Painel de visualização/edição de uma narrativa salva no Banco (clique no card) — bloco a
  // bloco, com formatação (negrito/itálico/sublinhado/cor) ligada ao destaque real do slide.
  const [openNarrative, setOpenNarrative] = useState<Narrative | null>(null)
  const [openNarrativeBlocks, setOpenNarrativeBlocks] = useState<EditableBlock[]>([])
  const [openNarrativeHighlights, setOpenNarrativeHighlights] = useState<SlideHighlight[]>([])
  const [activeSel, setActiveSel] = useState<{ text: string } | null>(null)
  const [openNarrativeBusy, setOpenNarrativeBusy] = useState(false)
  const [openNarrativeError, setOpenNarrativeError] = useState('')
  const [openNarrativeCopied, setOpenNarrativeCopied] = useState(false)

  // Painel de Ganchos — 3 variações + análise do roteiro, aberto de dentro do painel de
  // narrativa acima.
  const [showHooksPanel, setShowHooksPanel] = useState(false)
  const [hooksAnalysis, setHooksAnalysis] = useState<{ tema: string; pontoForte: string; seguraFinal: string } | null>(null)
  const [hooksOptions, setHooksOptions] = useState<Array<{ pattern: string; hook: string; doRoteiro: string; porQueFunciona: string }>>([])
  const [hooksLoading, setHooksLoading] = useState(false)
  const [hooksError, setHooksError] = useState('')
  const [hooksCopiedIdx, setHooksCopiedIdx] = useState<number | null>(null)

  // Painel Ajustar Roteiro — ajuste geral (roteiro inteiro) ou por seção (1 bloco só)
  const [showAdjustPanel, setShowAdjustPanel] = useState(false)
  const [adjustMode, setAdjustMode] = useState<'geral' | 'secao'>('geral')
  const [adjustSectionIdx, setAdjustSectionIdx] = useState(0)
  const [adjustInstruction, setAdjustInstruction] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  // "load" fica exposto pra recarregar depois de salvar/apagar um item (banco de ideias e
  // de narrativas chamam de novo mais abaixo); a busca inicial roda separada, com "ignore"
  // pra não aplicar a resposta se o efeito já tiver rodado de novo antes do fetch terminar.
  const load = useCallback(async () => {
    const [p, i, n] = await Promise.all([
      fetch('/api/profiles').then(x => x.json()),
      fetch('/api/ideas').then(x => x.json()),
      fetch('/api/narratives').then(x => x.json()),
    ])
    setProfiles(p); setSavedIdeas(i); setSavedNarratives(n)
  }, [])

  useEffect(() => {
    let ignore = false
    Promise.all([
      fetch('/api/profiles').then(x => x.json()),
      fetch('/api/ideas').then(x => x.json()),
      fetch('/api/narratives').then(x => x.json()),
    ]).then(([p, i, n]) => {
      if (ignore) return
      setProfiles(p); setSavedIdeas(i); setSavedNarratives(n)
    })
    return () => { ignore = true }
  }, [])

  // Limpa a chave depois de consumida (o valor em si já foi lido pelos useState acima) —
  // não define nenhum state, só housekeeping, então não conflita com a regra de efeitos.
  useEffect(() => { sessionStorage.removeItem(TREND_PREFILL_KEY) }, [])

  const profile = profiles.find(p => p.id === profileId)

  const generateOptions = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profileId || undefined, topic: topic || undefined }),
      }).then(r => r.json())
      if (res.error) { setError(res.error) }
      else {
        setIdeaOptions(res.ideas || [])
        setStep('options')
      }
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  const regenerateHooks = async () => {
    if (!narrative) return
    setShowRegenHooks(true)
    setRegenLoading(true)
    setRegenError('')
    try {
      const res = await fetch('/api/ai/generate-hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profileId || undefined, topic: topic || undefined, narrativeContext: narrative.content }),
      }).then(r => r.json())
      if (res.error) setRegenError(res.error)
      else setRegenHooks(res.hooks || [])
    } catch (e) {
      setRegenError(String(e))
    }
    setRegenLoading(false)
  }

  const applyHook = (hook: string) => {
    if (!narrative) return
    const updated = narrative.content.replace(/^TITULO:.*$/m, () => `TITULO: ${hook}`)
    setNarrative({ ...narrative, content: updated })
    setShowRegenHooks(false)
    setRegenHooks([])
  }

  const pickOption = (text: string, pillar?: ContentPillar) => {
    setChosen(text)
    setChosenPillar(pillar)
    setStep('confirm')
  }

  // Recebe os valores explícitos em vez de ler do state — assim dá pra chamar direto de um
  // card do Banco de Ideias, sem esperar um setState aplicar antes do fetch disparar.
  const runGenerateNarrative = async (opts: { profileId?: string; seed?: string; pillar?: ContentPillar }) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: opts.profileId || undefined, seed: opts.seed, topic: opts.seed ? undefined : (topic || undefined), pillar: opts.pillar, cta: cta.trim() || undefined }),
      }).then(r => r.json())
      if (res.error) setError(res.error)
      else { setNarrative(res); setStep('narrative') }
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  const generateNarrative = () => runGenerateNarrative({ profileId, seed: chosen, pillar: chosenPillar })

  // Atalho direto do Banco de Ideias — pula options/confirm e vai reto pra narrativa gerada.
  const generateNarrativeFromBank = (idea: Idea) => {
    setTab('gerar')
    setProfileId(idea.profileId || profileId)
    setChosen(idea.text)
    setChosenPillar(idea.pillar)
    setStep('confirm')
    runGenerateNarrative({ profileId: idea.profileId || profileId, seed: idea.text, pillar: idea.pillar })
  }

  // Atalho direto do Banco de Narrativas — leva o texto pronto (com os destaques marcados no
  // roteiro) pro assistente "Criar Conteúdo". Se o painel dessa narrativa está aberto, usa o
  // rascunho em edição (mesmo sem ter clicado em Salvar ainda); senão usa a versão salva.
  const createContentFromNarrative = (n: Narrative) => {
    const live = openNarrative?.id === n.id
    const content = live ? serializeBlocks(openNarrativeBlocks) : n.content
    const highlights = live ? openNarrativeHighlights : (n.highlights || [])
    sessionStorage.setItem(CONTENT_PREFILL_KEY, JSON.stringify({ profileId: n.profileId, content, highlights }))
    router.push('/?criar=1')
  }

  const saveIdeaToBank = async (text: string, angleType?: string, pillar?: ContentPillar, fromAI = true) => {
    await fetch('/api/ideas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profileId || undefined, text, angleType, pillar, fromAI }),
    })
    load()
  }

  const toggleIdeaFavorite = async (idea: Idea) => {
    const updated = { ...idea, favorite: !idea.favorite }
    setSavedIdeas(prev => prev.map(i => i.id === idea.id ? updated : i))
    await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
  }

  // Busca/filtros do Banco de Ideias
  const [ideaSearch, setIdeaSearch] = useState('')
  const [ideaFilterProfile, setIdeaFilterProfile] = useState('')
  const [ideaFilterPillar, setIdeaFilterPillar] = useState<ContentPillar | ''>('')
  const [ideaFilterFav, setIdeaFilterFav] = useState(false)
  const [addingIdea, setAddingIdea] = useState(false)
  const [newIdeaText, setNewIdeaText] = useState('')
  const [newIdeaPillar, setNewIdeaPillar] = useState<ContentPillar | undefined>(undefined)

  const filteredIdeas = savedIdeas.filter(i =>
    (!ideaSearch.trim() || i.text.toLowerCase().includes(ideaSearch.trim().toLowerCase())) &&
    (!ideaFilterProfile || i.profileId === ideaFilterProfile) &&
    (!ideaFilterPillar || i.pillar === ideaFilterPillar) &&
    (!ideaFilterFav || i.favorite)
  )

  const addManualIdea = async () => {
    if (!newIdeaText.trim()) return
    await saveIdeaToBank(newIdeaText.trim(), undefined, newIdeaPillar, false)
    setNewIdeaText(''); setNewIdeaPillar(undefined); setAddingIdea(false)
  }

  const saveNarrativeToBank = async () => {
    if (!narrative) return
    await fetch('/api/narratives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profileId || undefined, title: narrative.title, content: narrative.content, pillar: chosenPillar }),
    })
    load()
  }

  // "Criar Conteúdo" direto da tela de narrativa recém-gerada (antes só existia depois de
  // salvar no Banco e abrir o card de novo — faltava esse atalho aqui). Salva no Banco (pra
  // não perder o roteiro) e já leva pro assistente de criação com o conteúdo pronto.
  const createContentFromDraft = async () => {
    if (!narrative) return
    await saveNarrativeToBank()
    sessionStorage.setItem(CONTENT_PREFILL_KEY, JSON.stringify({ profileId: profileId || undefined, content: narrative.content, highlights: [] }))
    router.push('/?criar=1')
  }

  const deleteIdea = async (id: string) => {
    await fetch('/api/ideas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSavedIdeas(prev => prev.filter(i => i.id !== id))
  }

  const deleteNarrative = async (id: string) => {
    await fetch('/api/narratives', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setSavedNarratives(prev => prev.filter(n => n.id !== id))
  }

  const blocksFromContent = (content: string): EditableBlock[] =>
    splitBlocos(content).map(b => { const p = parseBloco(b); return { tag: p.tag, title: p.title, subtitle: p.subtitle, body: p.body } })

  const serializeBlocks = (blocks: EditableBlock[]): string =>
    blocks.map(b => {
      const lines: string[] = []
      if (b.tag) lines.push(`TAG: ${b.tag}`)
      if (b.title) lines.push(`TITULO: ${b.title}`)
      if (b.subtitle) lines.push(`SUBTITULO: ${b.subtitle}`)
      if (b.body) lines.push(`TEXTO: ${b.body}`)
      return lines.join('\n')
    }).join('\n---\n')

  const openNarrativeCard = (n: Narrative) => {
    setOpenNarrative(n)
    setOpenNarrativeBlocks(blocksFromContent(n.content))
    setOpenNarrativeHighlights(n.highlights || [])
    setActiveSel(null)
    setOpenNarrativeError('')
  }

  const closeNarrativeCard = () => {
    setOpenNarrative(null)
    setOpenNarrativeError('')
  }

  const updateBlockField = (i: number, field: 'title' | 'body', value: string) => {
    setOpenNarrativeBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b))
  }

  const blockRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollToBlock = (i: number) => {
    blockRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const captureSelection = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const text = el.value.substring(el.selectionStart ?? 0, el.selectionEnd ?? 0)
    setActiveSel(text.trim() ? { text: text.trim() } : null)
  }

  const applyFormat = (patch: Partial<SlideHighlight>) => {
    if (!activeSel?.text) return
    const word = activeSel.text
    setOpenNarrativeHighlights(prev => {
      const idx = prev.findIndex(h => h.word.toLowerCase() === word.toLowerCase())
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...patch }; return next }
      return [...prev, { word, color: 'inherit', ...patch }]
    })
  }

  const removeHighlight = (idx: number) => setOpenNarrativeHighlights(prev => prev.filter((_, i) => i !== idx))

  const saveNarrativeEdit = async () => {
    if (!openNarrative) return
    const updated = { ...openNarrative, content: serializeBlocks(openNarrativeBlocks), highlights: openNarrativeHighlights }
    await fetch('/api/narratives', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSavedNarratives(prev => prev.map(n => n.id === updated.id ? updated : n))
    setOpenNarrative(updated)
  }

  const regenerateNarrativeCard = async () => {
    if (!openNarrative) return
    setOpenNarrativeBusy(true)
    setOpenNarrativeError('')
    try {
      const res = await fetch('/api/ai/generate-narrative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: openNarrative.profileId || undefined, seed: openNarrative.title, pillar: openNarrative.pillar }),
      }).then(r => r.json())
      if (res.error) { setOpenNarrativeError(res.error) }
      else {
        const updated = { ...openNarrative, title: res.title || openNarrative.title, content: res.content || '', highlights: [] }
        await fetch('/api/narratives', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
        setSavedNarratives(prev => prev.map(n => n.id === updated.id ? updated : n))
        setOpenNarrative(updated)
        setOpenNarrativeBlocks(blocksFromContent(updated.content))
        setOpenNarrativeHighlights([])
      }
    } catch (e) {
      setOpenNarrativeError(String(e))
    }
    setOpenNarrativeBusy(false)
  }

  const generateHooksPanel = async () => {
    if (!openNarrative) return
    setShowHooksPanel(true)
    setHooksLoading(true)
    setHooksError('')
    try {
      const res = await fetch('/api/ai/generate-hooks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: openNarrative.profileId || undefined, pillar: openNarrative.pillar, narrativeContext: serializeBlocks(openNarrativeBlocks) }),
      }).then(r => r.json())
      if (res.error) { setHooksError(res.error) }
      else { setHooksAnalysis(res.analysis || null); setHooksOptions(res.hooks || []) }
    } catch (e) {
      setHooksError(String(e))
    }
    setHooksLoading(false)
  }

  const pickHookForNarrative = (hook: string) => {
    setOpenNarrativeBlocks(prev => prev.map((b, i) => i === 0 ? { ...b, title: hook } : b))
    setShowHooksPanel(false)
  }

  const runAdjustNarrative = async (instruction: string) => {
    if (!openNarrative || !instruction.trim()) return
    setAdjustLoading(true)
    setAdjustError('')
    try {
      const sectionLabel = adjustMode === 'secao' ? (openNarrativeBlocks[adjustSectionIdx]?.tag || `Slide ${adjustSectionIdx + 1}`) : undefined
      const res = await fetch('/api/ai/adjust-narrative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: openNarrative.profileId,
          content: serializeBlocks(openNarrativeBlocks),
          instruction,
          sectionIndex: adjustMode === 'secao' ? adjustSectionIdx : undefined,
          sectionLabel,
        }),
      }).then(r => r.json())
      if (res.error) { setAdjustError(res.error) }
      else {
        setOpenNarrativeBlocks(blocksFromContent(res.content || ''))
        setShowAdjustPanel(false)
        setAdjustInstruction('')
      }
    } catch (e) {
      setAdjustError(String(e))
    }
    setAdjustLoading(false)
  }

  const copyContent = () => {
    if (!narrative) return
    navigator.clipboard.writeText(narrative.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setStep('setup'); setIdeaOptions([]); setChosen(''); setChosenPillar(undefined); setNarrative(null); setError('')
    setShowRegenHooks(false); setRegenHooks([]); setRegenError('')
  }

  const stepIndex = STEP_ORDER.indexOf(step)

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="ideas"/>
      <main className="flex-1 overflow-auto p-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <button className="p-2.5 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <ArrowLeft size={18}/>
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Ideias & Narrativas</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Escreva ângulos e roteiros com antecedência, sem precisar montar o carrossel agora</p>
            </div>
          </div>

          <div className="flex gap-2 mb-8 p-1 rounded-xl w-fit" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <button onClick={() => setTab('gerar')} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={tab === 'gerar' ? { background: 'var(--grad)', color: '#000' } : { color: 'var(--muted)' }}>
              Gerar
            </button>
            <button onClick={() => setTab('banco-ideias')} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={tab === 'banco-ideias' ? { background: 'var(--grad)', color: '#000' } : { color: 'var(--muted)' }}>
              Banco de Ideias ({savedIdeas.length})
            </button>
            <button onClick={() => setTab('banco-narrativas')} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={tab === 'banco-narrativas' ? { background: 'var(--grad)', color: '#000' } : { color: 'var(--muted)' }}>
              Banco de Narrativas ({savedNarratives.length})
            </button>
          </div>

          {tab === 'gerar' && (
            <div className="flex items-center gap-2 mb-8">
              {STEP_ORDER.map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={i <= stepIndex ? { background: 'var(--grad)', color: '#000' } : { background: 'var(--bg3)', color: 'var(--muted)' }}>
                      {i + 1}
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap hidden sm:inline" style={{ color: i <= stepIndex ? 'var(--text)' : 'var(--muted)' }}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                  {i < STEP_ORDER.length - 1 && <div className="h-px flex-1" style={{ background: i < stepIndex ? 'var(--accent)' : 'var(--border)' }}/>}
                </div>
              ))}
            </div>
          )}

          {tab === 'banco-ideias' && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>{filteredIdeas.length} {filteredIdeas.length === 1 ? 'ideia' : 'ideias'}</p>
                <button onClick={() => setAddingIdea(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
                  <Plus size={14}/> Nova ideia
                </button>
              </div>

              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}/>
                  <input value={ideaSearch} onChange={e => setIdeaSearch(e.target.value)} placeholder="Buscar ideia..." className="w-full pl-9 text-sm py-2.5"/>
                </div>
                <select value={ideaFilterProfile} onChange={e => setIdeaFilterProfile(e.target.value)} className="text-sm py-2.5 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="">Todos os perfis</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={ideaFilterPillar} onChange={e => setIdeaFilterPillar(e.target.value as ContentPillar | '')} className="text-sm py-2.5 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="">Todos os pilares</option>
                  {PILLAR_ORDER.map(p => <option key={p} value={p}>{CONTENT_PILLARS[p].label}</option>)}
                </select>
                <button onClick={() => setIdeaFilterFav(v => !v)} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-medium"
                  style={ideaFilterFav ? { background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid var(--accent)' } : { background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid transparent' }}>
                  <Heart size={14} fill={ideaFilterFav ? 'currentColor' : 'none'}/> Favoritas
                </button>
              </div>

              {addingIdea && (
                <div className="p-5 rounded-2xl mb-4" style={{ background: 'var(--bg2)', border: '1.5px solid var(--accent)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Nova ideia manual</p>
                    <button onClick={() => { setAddingIdea(false); setNewIdeaText('') }} style={{ color: 'var(--muted)' }}><X size={16}/></button>
                  </div>
                  <textarea value={newIdeaText} onChange={e => setNewIdeaText(e.target.value)} rows={2} className="w-full text-sm resize-none mb-3" placeholder="Escreva o ângulo em 1 frase..."/>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {PILLAR_ORDER.map(p => (
                      <button key={p} type="button" onClick={() => setNewIdeaPillar(v => v === p ? undefined : p)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium"
                        style={newIdeaPillar === p ? { background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid var(--accent)' } : { background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid transparent' }}>
                        {CONTENT_PILLARS[p].label}
                      </button>
                    ))}
                  </div>
                  <button onClick={addManualIdea} disabled={!newIdeaText.trim()} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>Salvar ideia</button>
                </div>
              )}

              {filteredIdeas.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>{savedIdeas.length === 0 ? 'Nenhuma ideia salva ainda.' : 'Nenhuma ideia bate com esse filtro.'}</p>}
              <div className="grid grid-cols-3 gap-4">
                {filteredIdeas.map(i => (
                  <div key={i.id} className="p-5 rounded-2xl flex flex-col relative" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <button onClick={() => toggleIdeaFavorite(i)} className="absolute top-4 right-4" style={{ color: i.favorite ? '#ef4444' : 'var(--muted)' }}>
                      <Heart size={15} fill={i.favorite ? 'currentColor' : 'none'}/>
                    </button>
                    <Lightbulb size={16} style={{ color: 'var(--accent2)' }} className="mb-3"/>
                    <p className="text-sm flex-1 mb-4 pr-5">{i.text}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mb-4">
                      {i.pillar && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.14)', color: 'var(--accent2)' }}>{CONTENT_PILLARS[i.pillar]?.label || i.pillar}</span>}
                      {i.angleType && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>{i.angleType}</span>}
                      {i.fromAI !== false && <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}><Sparkles size={9}/> IA</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => generateNarrativeFromBank(i)} disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>
                        <Sparkles size={12}/> Gerar narrativa
                      </button>
                      <button onClick={() => deleteIdea(i.id)} className="p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'banco-narrativas' && (
            <div>
              {savedNarratives.length === 0 && <p className="text-sm" style={{ color: 'var(--muted)' }}>Nenhuma narrativa salva ainda.</p>}
              <div className="grid grid-cols-3 gap-4">
                {savedNarratives.map(n => (
                  <div key={n.id} onClick={() => openNarrativeCard(n)} className="p-5 rounded-2xl flex flex-col text-left cursor-pointer transition-all hover:brightness-110" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <FileText size={16} style={{ color: 'var(--accent2)' }} className="mb-3"/>
                    <p className="text-sm font-semibold flex-1 mb-4">{n.title}</p>
                    {n.pillar && (
                      <div className="mb-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.14)', color: 'var(--accent2)' }}>{CONTENT_PILLARS[n.pillar]?.label || n.pillar}</span>
                      </div>
                    )}
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => createContentFromNarrative(n)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-black" style={{ background: 'var(--grad)' }}>
                        <LayoutGrid size={12}/> Criar Conteúdo
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(n.content)} className="p-2 rounded-lg flex-shrink-0" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}><Copy size={13}/></button>
                      <button onClick={() => deleteNarrative(n.id)} className="p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><Trash2 size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'gerar' && step === 'setup' && (
            <div className="rounded-2xl p-8" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2.5 mb-2 text-base font-bold" style={{ color: 'var(--accent2)' }}>
                <Lightbulb size={19}/> Novo briefing
              </div>
              <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
                Ângulos de carrossel — 1 frase cada, pra escolher e depois virar roteiro completo. Se não gostar do gancho depois de pronto, dá pra trocar na tela final.
              </p>

              <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Perfil (opcional, mas melhora muito)</label>
              <div className="grid grid-cols-3 gap-2.5 mb-7">
                <button type="button" onClick={() => setProfileId('')} className="p-4 rounded-xl text-left text-sm font-medium transition-all"
                  style={!profileId ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)', color: 'var(--accent2)' } : { background: 'var(--bg3)', border: '2px solid transparent', color: 'var(--muted)' }}>
                  Sem perfil — vou descrever no tema
                </button>
                {profiles.map(p => (
                  <button key={p.id} type="button" onClick={() => setProfileId(p.id)} className="flex items-center gap-2.5 p-4 rounded-xl text-left text-sm font-medium transition-all"
                    style={profileId === p.id ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)', color: 'var(--accent2)' } : { background: 'var(--bg3)', border: '2px solid transparent' }}>
                    {p.logo ? <img src={p.logo} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0"/> : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: p.primaryColor }}>{p.name[0]}</div>}
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>

              <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Tema {profile ? '(opcional — o Perfil já tem bastante contexto)' : ''}
              </label>
              <textarea className="w-full h-24 resize-none mb-7 text-sm" placeholder="Ex: por que ninguém fala sobre..." value={topic} onChange={e => setTopic(e.target.value)}/>

              <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                CTA desejado (opcional{profile?.extraInstructions ? ' — sem preencher, usa o padrão do Perfil' : ''})
              </label>
              <input className="w-full mb-7 text-sm" placeholder='Ex: comentar a palavra "GUIA" pra receber o material' value={cta} onChange={e => setCta(e.target.value)}/>

              {error && <p className="text-sm mb-4" style={{ color: '#ef4444' }}>{error}</p>}
              <button onClick={generateOptions} disabled={loading || (!profileId && !topic.trim())} className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>
                {loading ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>} Gerar ideias
              </button>
            </div>
          )}

          {tab === 'gerar' && step === 'options' && (
            <div className="space-y-3">
              {ideaOptions.map((o, i) => (
                <div key={i} className="p-5 rounded-2xl flex items-center gap-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <div className="flex-1">
                    <p className="text-[15px] mb-2">{o.text}</p>
                    <div className="flex gap-1.5">
                      {o.pillar && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.14)', color: 'var(--accent2)' }}>{CONTENT_PILLARS[o.pillar]?.label || o.pillar}</span>}
                      {o.angleType && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>{o.angleType}</span>}
                    </div>
                  </div>
                  <button onClick={() => saveIdeaToBank(o.text, o.angleType, o.pillar)} className="p-2.5 rounded-lg flex-shrink-0" style={{ background: 'var(--bg3)', color: 'var(--muted)' }} title="Salvar no Banco"><Bookmark size={15}/></button>
                  <button onClick={() => pickOption(o.text, o.pillar)} className="flex items-center gap-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-black flex-shrink-0" style={{ background: 'var(--grad)' }}>Usar <ChevronRight size={15}/></button>
                </div>
              ))}
              <button onClick={reset} className="text-sm font-medium mt-1" style={{ color: 'var(--muted)' }}>← Voltar</button>
            </div>
          )}

          {tab === 'gerar' && step === 'confirm' && (
            <div className="rounded-2xl p-8 max-w-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <h2 className="text-lg font-bold mb-5">Tudo certo pra gerar?</h2>
              <div className="space-y-3 mb-8 text-sm">
                <p><strong>Perfil:</strong> {profile?.name || 'nenhum'}</p>
                <p><strong>Ângulo escolhido:</strong> {chosen}</p>
                {chosenPillar && <p><strong>Pilar:</strong> {CONTENT_PILLARS[chosenPillar]?.label || chosenPillar}</p>}
                {topic && <p><strong>Tema:</strong> {topic}</p>}
              </div>
              {error && <p className="text-sm mb-4" style={{ color: '#ef4444' }}>{error}</p>}
              <div className="flex gap-3">
                <button onClick={generateNarrative} disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>
                  {loading ? <Loader2 size={17} className="animate-spin"/> : <Sparkles size={17}/>} Gerar narrativa completa
                </button>
                <button onClick={() => setStep('options')} className="px-6 py-3.5 rounded-xl font-semibold" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>Voltar</button>
              </div>
            </div>
          )}

          {tab === 'gerar' && step === 'narrative' && narrative && (
            <div className="rounded-2xl p-8" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">{narrative.title}</h2>
                <div className="flex gap-2">
                  <button onClick={copyContent} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--bg3)' }}>
                    {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button onClick={saveNarrativeToBank} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)' }}>
                    <Bookmark size={14}/> Salvar no Banco
                  </button>
                  <button onClick={createContentFromDraft} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
                    <FileText size={14}/> Criar Conteúdo
                  </button>
                </div>
              </div>
              <pre className="text-sm p-5 rounded-xl whitespace-pre-wrap font-mono mb-4" style={{ background: 'var(--bg3)', lineHeight: 1.6 }}>{narrative.content}</pre>
              <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
                Copie esse bloco e cole no campo &quot;Colar todo o conteúdo&quot; de um modelo, no editor de carrossel.
              </p>

              <div className="mb-5 p-5 rounded-xl" style={{ background: 'var(--bg3)' }}>
                {!showRegenHooks ? (
                  <button onClick={regenerateHooks} className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent2)' }}>
                    <Zap size={14}/> Não gostei do gancho — gerar variações
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent2)' }}>
                        <Zap size={14}/> Variações de gancho pra essa narrativa
                      </span>
                      <button onClick={() => setShowRegenHooks(false)} className="text-xs" style={{ color: 'var(--muted)' }}>Fechar</button>
                    </div>
                    {regenLoading && <p className="text-xs flex items-center gap-2" style={{ color: 'var(--muted)' }}><Loader2 size={12} className="animate-spin"/> Gerando...</p>}
                    {regenError && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>{regenError}</p>}
                    <div className="space-y-2">
                      {regenHooks.map((o, i) => (
                        <div key={i} className="p-3.5 rounded-lg" style={{ background: 'var(--bg2)' }}>
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <p className="text-sm font-semibold flex-1">{o.hook}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>{o.pattern}</span>
                          </div>
                          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{o.why}</p>
                          <button onClick={() => applyHook(o.hook)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-black" style={{ background: 'var(--grad)' }}>Usar esse gancho</button>
                        </div>
                      ))}
                    </div>
                    {!regenLoading && regenHooks.length > 0 && (
                      <button onClick={regenerateHooks} className="text-xs mt-3" style={{ color: 'var(--muted)' }}>← Gerar outras variações</button>
                    )}
                  </>
                )}
              </div>

              <button onClick={reset} className="text-sm font-medium" style={{ color: 'var(--muted)' }}>← Gerar outra</button>
            </div>
          )}
        </div>
      </main>

      {openNarrative && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={closeNarrativeCard}>
          <div className="h-full w-full max-w-4xl flex flex-col" style={{ background: 'var(--bg2)', borderLeft: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold text-sm">{openNarrative.title}</h2>
              <button onClick={closeNarrativeCard} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
            </div>

            {/* Toolbar de formatação — aplica na última seleção feita em qualquer campo */}
            <div className="flex items-center gap-1 px-5 py-2 flex-wrap flex-shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
              <button title="Negrito" disabled={!activeSel} onMouseDown={e => e.preventDefault()} onClick={() => applyFormat({ weight: 800 })}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text)' }}><Bold size={14}/></button>
              <button title="Itálico" disabled={!activeSel} onMouseDown={e => e.preventDefault()} onClick={() => applyFormat({ italic: true })}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text)' }}><Italic size={14}/></button>
              <button title="Sublinhado" disabled={!activeSel} onMouseDown={e => e.preventDefault()} onClick={() => applyFormat({ underline: true })}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text)' }}><Underline size={14}/></button>
              <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }}/>
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c} title={`Cor ${c}`} disabled={!activeSel} onMouseDown={e => e.preventDefault()} onClick={() => applyFormat({ color: c })}
                  className="w-5 h-5 rounded-full flex-shrink-0 disabled:opacity-30" style={{ background: c, border: '1px solid var(--border)' }}/>
              ))}
              <span className="text-[11px] ml-2" style={{ color: 'var(--muted)' }}>{activeSel ? `"${activeSel.text}"` : 'Selecione um trecho pra formatar'}</span>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Índice de slides — clique pula direto pro slide na coluna de conteúdo */}
              <div className="w-36 flex-shrink-0 overflow-y-auto py-3 px-2 space-y-0.5" style={{ borderRight: '1px solid var(--border)' }}>
                {openNarrativeBlocks.map((block, i) => (
                  <button key={i} onClick={() => scrollToBlock(i)}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-[11px] leading-tight transition-colors hover:brightness-125"
                    style={{ background: 'var(--bg3)' }}>
                    <span className="block font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--accent2)', fontSize: 9 }}>{block.tag || `Slide ${i + 1}`}</span>
                    <span className="block truncate" style={{ color: 'var(--muted)' }}>{block.title || block.body || '—'}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {openNarrativeBlocks.map((block, i) => (
                  <div key={i} ref={el => { blockRefs.current[i] = el }} className="mb-3 pb-3" style={{ borderBottom: i < openNarrativeBlocks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }}/>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent2)' }}>{block.tag || `Slide ${i + 1}`}</span>
                    </div>
                    {(block.title || block.subtitle) && (
                      <input value={block.title} onChange={e => updateBlockField(i, 'title', e.target.value)} onSelect={captureSelection}
                        className="w-full font-bold text-sm mb-1.5 bg-transparent border-0 px-0 py-0 focus:ring-0 focus:outline-none"/>
                    )}
                    <textarea value={block.body} onChange={e => updateBlockField(i, 'body', e.target.value)} onSelect={captureSelection}
                      rows={Math.max(2, Math.ceil((block.body.length || 1) / 70))}
                      className="w-full text-[13px] bg-transparent border-0 px-0 py-0 resize-none focus:ring-0 focus:outline-none" style={{ lineHeight: 1.5 }}/>
                  </div>
                ))}

                {openNarrativeHighlights.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {openNarrativeHighlights.map((h, idx) => (
                      <span key={idx} className="text-[11px] pl-2.5 pr-1.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'var(--bg3)' }}>
                        <span style={{ color: h.color === 'inherit' ? 'var(--text)' : h.color, fontWeight: h.weight || 400, fontStyle: h.italic ? 'italic' : 'normal', textDecoration: h.underline ? 'underline' : 'none' }}>{h.word}</span>
                        <button onClick={() => removeHighlight(idx)} style={{ color: 'var(--muted)' }}><X size={11}/></button>
                      </span>
                    ))}
                  </div>
                )}
                {openNarrativeError && <p className="text-sm mt-3" style={{ color: '#ef4444' }}>{openNarrativeError}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={() => {
                  navigator.clipboard.writeText(serializeBlocks(openNarrativeBlocks))
                  setOpenNarrativeCopied(true)
                  setTimeout(() => setOpenNarrativeCopied(false), 1800)
                }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--bg3)' }}>
                {openNarrativeCopied ? <Check size={14}/> : <Copy size={14}/>} {openNarrativeCopied ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={generateHooksPanel} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                <Zap size={14}/> Ganchos
              </button>
              <button onClick={() => { setShowAdjustPanel(true); setAdjustMode('geral'); setAdjustError('') }} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                <SlidersHorizontal size={14}/> Ajustar
              </button>
              <button onClick={saveNarrativeEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
                Salvar alterações
              </button>
              <button onClick={regenerateNarrativeCard} disabled={openNarrativeBusy} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                {openNarrativeBusy ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} Gerar de novo
              </button>
              <button onClick={() => createContentFromNarrative(openNarrative)} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
                <LayoutGrid size={14}/> Criar Conteúdo
              </button>
            </div>
          </div>
        </div>
      )}

      {showHooksPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setShowHooksPanel(false)}>
          <div className="w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent2)' }}>Especialista em Ganchos</p>
                <h2 className="font-bold text-sm flex items-center gap-2"><Zap size={15} style={{ color: 'var(--accent2)' }}/> Para o scroll nos 3 primeiros segundos</h2>
              </div>
              <button onClick={() => setShowHooksPanel(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {hooksLoading && (
                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--muted)' }}><Loader2 size={14} className="animate-spin"/> Gerando 3 ganchos...</p>
              )}
              {hooksError && <p className="text-sm" style={{ color: '#ef4444' }}>{hooksError}</p>}

              {!hooksLoading && hooksAnalysis && (
                <div className="p-4 rounded-xl mb-5" style={{ background: 'var(--bg3)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Análise do roteiro</p>
                  <p className="text-xs mb-1.5"><strong>Tema:</strong> {hooksAnalysis.tema}</p>
                  <p className="text-xs mb-1.5"><strong>Ponto mais forte:</strong> {hooksAnalysis.pontoForte}</p>
                  <p className="text-xs"><strong>Segura pro final:</strong> {hooksAnalysis.seguraFinal}</p>
                </div>
              )}

              {!hooksLoading && hooksOptions.map((h, i) => (
                <div key={i} className="p-4 rounded-xl mb-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent2)' }}>Opção {i + 1} — {h.pattern}</span>
                    <button onClick={() => {
                        navigator.clipboard.writeText(h.hook)
                        setHooksCopiedIdx(i)
                        setTimeout(() => setHooksCopiedIdx(null), 1500)
                      }} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
                      {hooksCopiedIdx === i ? <Check size={11}/> : <Copy size={11}/>} {hooksCopiedIdx === i ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-sm font-semibold mb-2">&quot;{h.hook}&quot;</p>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}><Zap size={10} className="inline mr-1"/> Do roteiro: {h.doRoteiro}</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}><Sparkles size={10} className="inline mr-1"/> Por que funciona: {h.porQueFunciona}</p>
                  <button onClick={() => pickHookForNarrative(h.hook)} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-black" style={{ background: 'var(--grad)' }}>
                    <Plus size={12}/> Usar no roteiro
                  </button>
                </div>
              ))}
            </div>

            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={generateHooksPanel} disabled={hooksLoading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-black disabled:opacity-60" style={{ background: 'var(--grad)' }}>
                {hooksLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} Gerar de novo
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdjustPanel && openNarrative && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={() => setShowAdjustPanel(false)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="font-bold text-sm flex items-center gap-2"><SlidersHorizontal size={15} style={{ color: 'var(--accent2)' }}/> Ajustar roteiro</h2>
              <button onClick={() => setShowAdjustPanel(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
            </div>

            <div className="p-6">
              <div className="flex gap-2 mb-4 p-1 rounded-xl w-fit" style={{ background: 'var(--bg3)' }}>
                <button onClick={() => setAdjustMode('geral')} className="px-4 py-2 rounded-lg text-xs font-semibold"
                  style={adjustMode === 'geral' ? { background: 'var(--grad)', color: '#000' } : { color: 'var(--muted)' }}>Ajuste geral</button>
                <button onClick={() => setAdjustMode('secao')} className="px-4 py-2 rounded-lg text-xs font-semibold"
                  style={adjustMode === 'secao' ? { background: 'var(--grad)', color: '#000' } : { color: 'var(--muted)' }}>Ajuste por seção</button>
              </div>

              {adjustMode === 'geral' ? (
                <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Escreve tudo o que quer mudar e eu reescrevo o roteiro inteiro, mantendo a estrutura dos blocos.</p>
              ) : (
                <>
                  <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Escolhe a seção — só ela muda, o resto do roteiro fica intocado.</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {openNarrativeBlocks.map((b, i) => (
                      <button key={i} onClick={() => setAdjustSectionIdx(i)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                        style={adjustSectionIdx === i ? { background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid var(--accent)' } : { background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid transparent' }}>
                        {b.tag || `Slide ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>O que você quer mudar?</label>
              <textarea value={adjustInstruction} onChange={e => setAdjustInstruction(e.target.value)} rows={3} className="w-full text-sm resize-none mb-3"
                placeholder="Ex: deixa o tom mais leve, troca o exemplo do porteiro por um do meu nicho e encurta o final"/>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {['Deixa mais curto', 'Deixa mais informal', 'Troca o CTA', 'Mais energia no gancho', 'Mais emoção', 'Tira jargão'].map(preset => (
                  <button key={preset} onClick={() => setAdjustInstruction(preset)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                    style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                    {preset}
                  </button>
                ))}
              </div>

              {adjustError && <p className="text-xs mb-3" style={{ color: '#ef4444' }}>{adjustError}</p>}
              <button onClick={() => runAdjustNarrative(adjustInstruction)} disabled={adjustLoading || !adjustInstruction.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>
                {adjustLoading ? <Loader2 size={16} className="animate-spin"/> : <><Sparkles size={16}/> Reescrever roteiro →</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
