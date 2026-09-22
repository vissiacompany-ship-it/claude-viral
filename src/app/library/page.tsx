'use client'

import { useState, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import { Carousel, Profile, CarouselTemplate } from '@/types'
import Sidebar from '@/components/Sidebar'
import { CarouselCard, SkeletonCard } from '@/components/CarouselCard'
import { CarouselSortOrder, CAROUSEL_SORT_LABELS, sortCarousels } from '@/lib/sort-carousels'

export default function LibraryPage() {
  const [carousels, setCarousels] = useState<Carousel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [templates, setTemplates] = useState<CarouselTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterProfile, setFilterProfile] = useState('')
  const [sortOrder, setSortOrder] = useState<CarouselSortOrder>('recent')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Busca os dados uma vez, no mount — "ignore" evita aplicar a resposta se o componente
  // já tiver desmontado (ou o efeito rodado de novo) antes do fetch terminar.
  useEffect(() => {
    let ignore = false
    Promise.all([
      fetch('/api/carousels').then(r => r.json()),
      fetch('/api/profiles').then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
    ]).then(([c, p, t]) => {
      if (ignore) return
      setCarousels(c)
      setProfiles(p)
      setTemplates(t)
      setLoading(false)
    })
    return () => { ignore = true }
  }, [])

  const deleteCarousel = async (id: string) => {
    if (!confirm('Excluir este carrossel?')) return
    await fetch('/api/carousels', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' }
    })
    setCarousels(prev => prev.filter(c => c.id !== id))
  }

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const deleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Excluir ${selected.size} carrossel(is) selecionado(s)? Essa ação não pode ser desfeita.`)) return
    await Promise.all([...selected].map(id => fetch('/api/carousels', {
      method: 'DELETE', body: JSON.stringify({ id }), headers: { 'Content-Type': 'application/json' }
    })))
    setCarousels(prev => prev.filter(c => !selected.has(c.id)))
    setSelected(new Set())
    setSelectMode(false)
  }

  const profileName = (id: string) => profiles.find(p => p.id === id)?.name || '—'
  const templateName = (id?: string) => templates.find(t => t.id === id)?.name

  const filtered = sortCarousels(carousels.filter(c =>
    (!filterProfile || c.profileId === filterProfile) &&
    (!query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()) || profileName(c.profileId).toLowerCase().includes(query.trim().toLowerCase()))
  ), sortOrder)

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="library"/>

      <main className="flex-1 overflow-auto">
        <div className="px-8 pt-6 pb-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--bo-hairline)' }}>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] mb-1">Meu Conteúdo</h1>
            <p className="text-[12px]" style={{ color: 'var(--bo-graphite)' }}>Todos os carrosséis que você já criou, num só lugar.</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por título ou perfil..."
              className="px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--bo-mist)', border: '1px solid var(--bo-hairline)', width: 240 }}/>
            <select value={filterProfile} onChange={e => setFilterProfile(e.target.value)}
              className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--bo-mist)', border: '1px solid var(--bo-hairline)', color: 'var(--bo-ink)' }}>
              <option value="">Todos os perfis</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value as CarouselSortOrder)}
              className="text-sm px-3 py-2 rounded-xl" style={{ background: 'var(--bo-mist)', border: '1px solid var(--bo-hairline)', color: 'var(--bo-ink)' }}>
              {(Object.keys(CAROUSEL_SORT_LABELS) as CarouselSortOrder[]).map(k => (
                <option key={k} value={k}>{CAROUSEL_SORT_LABELS[k]}</option>
              ))}
            </select>
            {selectMode ? (
              <>
                <button onClick={deleteSelected} disabled={selected.size === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 whitespace-nowrap"
                  style={{ background: '#dc4444' }}>
                  <Trash2 size={14}/> Excluir {selected.size > 0 ? `(${selected.size})` : ''}
                </button>
                <button onClick={() => { setSelectMode(false); setSelected(new Set()) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap" style={{ background: 'var(--bo-mist)', border: '1px solid var(--bo-hairline)' }}>
                  <X size={14}/> Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setSelectMode(true)}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold" style={{ background: 'var(--bo-mist)', border: '1px solid var(--bo-hairline)' }}>
                Selecionar vários
              </button>
            )}
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i}/>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--bo-cloud)', border: '1px dashed var(--bo-hairline2)' }}>
              <p className="text-lg font-semibold mb-2">{carousels.length === 0 ? 'Nenhum carrossel ainda' : 'Nada encontrado'}</p>
              <p className="text-sm" style={{ color: 'var(--bo-graphite)' }}>{carousels.length === 0 ? 'Volte pro Dashboard e crie o primeiro.' : 'Tenta buscar por outro termo.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {filtered.map(c => (
                <CarouselCard key={c.id} carousel={c} profileName={profileName(c.profileId)} templateName={templateName(c.templateId)} onDelete={deleteCarousel}
                  selectMode={selectMode} selected={selected.has(c.id)} onToggleSelect={() => toggleSelected(c.id)}/>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
