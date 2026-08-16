'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Carousel, Profile } from '@/types'
import { LayoutGrid, Plus, User } from 'lucide-react'
import CreateCarouselModal from '@/components/CreateCarouselModal'
import Sidebar from '@/components/Sidebar'
import { CarouselCard, SkeletonCard } from '@/components/CarouselCard'

export default function Dashboard() {
  const [carousels, setCarousels] = useState<Carousel[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

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

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="dashboard"/>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--bo-hairline)' }}>
          <h1 className="text-xl font-bold tracking-[-0.01em] mb-1">Olá, Paulo</h1>
          <p className="text-[12px]" style={{ color: 'var(--bo-graphite)' }}>Vamos criar conteúdo viral hoje?</p>
        </div>

        <div className="p-8">
          {/* Action cards */}
          <div className="grid grid-cols-2 gap-4 mb-10 items-stretch">
            <Link href="/profiles" className="block h-full">
              <div className="h-full flex flex-col rounded-2xl p-6 cursor-pointer transition-colors hover:brightness-110" style={{ background: 'var(--bo-cloud)', border: '1px solid var(--bo-hairline)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--bo-mist)' }}>
                  <User size={20} style={{ color: 'var(--bo-ink)' }}/>
                </div>
                <h3 className="font-bold mb-2">Perfis</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--bo-graphite)' }}>Configure sua marca, nicho, tom e identidade visual.</p>
                <span className="text-sm font-semibold mt-auto" style={{ color: 'var(--bo-accent)' }}>Gerenciar →</span>
              </div>
            </Link>
            <button onClick={() => setShowCreate(true)} className="block text-left w-full h-full">
              <div className="h-full flex flex-col rounded-2xl p-6 cursor-pointer transition-colors hover:brightness-110" style={{ background: 'var(--bo-cloud)', border: '1px solid var(--bo-hairline)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--bo-mist)' }}>
                  <LayoutGrid size={18} style={{ color: 'var(--bo-ink)' }}/>
                </div>
                <h3 className="font-bold mb-2">Criar carrossel</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--bo-graphite)' }}>Cola o conteúdo, sobe as imagens, escolhe o modelo — tudo já distribuído nos slides, e você cai no editor pronto pra ajustar e baixar.</p>
                <span className="text-sm font-semibold mt-auto" style={{ color: 'var(--bo-accent)' }}>Criar carrossel →</span>
              </div>
            </button>
          </div>

          {/* Carousels list */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-lg">
              Carrosséis gerados{' '}
              <span className="text-sm font-normal ml-2 px-2 py-0.5 rounded-full" style={{ background: 'var(--bo-mist)', color: 'var(--bo-graphite)' }}>
                {carousels.length}
              </span>
            </h2>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black transition-all hover:brightness-110" style={{ background: 'var(--grad)' }}>
              <Plus size={16}/> Criar carrossel
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <SkeletonCard key={i}/>)}
            </div>
          ) : carousels.length === 0 ? (
            <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--bo-cloud)', border: '1px dashed var(--bo-hairline2)' }}>
              <p className="text-lg font-semibold mb-2">Nenhum carrossel ainda</p>
              <p className="text-sm mb-6" style={{ color: 'var(--bo-graphite)' }}>Crie seu primeiro carrossel escolhendo um modelo</p>
              <button onClick={() => setShowCreate(true)} className="px-6 py-3 rounded-xl font-semibold text-black hover:brightness-110" style={{ background: 'var(--grad)' }}>
                Criar primeiro carrossel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {carousels.map(c => (
                <CarouselCard key={c.id} carousel={c} profileName={profileName(c.profileId)} onDelete={deleteCarousel}/>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreate && <CreateCarouselModal onClose={() => setShowCreate(false)}/>}
    </div>
  )
}
