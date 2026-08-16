'use client'

import { useState, useEffect, useCallback } from 'react'
import { Carousel, Profile } from '@/types'
import Sidebar from '@/components/Sidebar'
import { CarouselCard, SkeletonCard } from '@/components/CarouselCard'

export default function LibraryPage() {
  const [carousels, setCarousels] = useState<Carousel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      fetch('/api/carousels').then(r => r.json()),
      fetch('/api/profiles').then(r => r.json()),
    ])
    setCarousels(c)
    setProfiles(p)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteCarousel = async (id: string) => {
    if (!confirm('Excluir este carrossel?')) return
    await fetch('/api/carousels', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' }
    })
    setCarousels(prev => prev.filter(c => c.id !== id))
  }

  const profileName = (id: string) => profiles.find(p => p.id === id)?.name || '—'

  const filtered = carousels.filter(c =>
    !query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()) || profileName(c.profileId).toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="library"/>

      <main className="flex-1 overflow-auto">
        <div className="px-8 pt-6 pb-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--bo-hairline)' }}>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.01em] mb-1">Biblioteca</h1>
            <p className="text-[12px]" style={{ color: 'var(--bo-graphite)' }}>Todos os carrosséis que você já criou, num só lugar.</p>
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por título ou perfil..."
            className="px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--bo-mist)', border: '1px solid var(--bo-hairline)', width: 280 }}/>
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
                <CarouselCard key={c.id} carousel={c} profileName={profileName(c.profileId)} onDelete={deleteCarousel}/>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
