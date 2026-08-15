'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Carousel, Profile } from '@/types'
import { LayoutGrid, Plus, User, Trash2, Pencil, Download, Clock, Settings, Sparkles } from 'lucide-react'
import CreateCarouselModal from '@/components/CreateCarouselModal'

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

  const navItemCls = (active: boolean) =>
    `flex items-center gap-2.5 px-3 py-[7px] rounded-[10px] text-[13px] font-medium transition-all cursor-pointer ${
      active ? '' : 'hover:brightness-125'
    }`

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: 'var(--bo-cloud)' }}>
        <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: 'var(--bo-accent)' }}>
            <Sparkles size={14} className="text-black" strokeWidth={2}/>
          </div>
          <span className="text-[14px] font-semibold tracking-tight truncate">Claude Viral</span>
        </div>

        <nav className="flex-1 flex flex-col gap-4 px-3 py-1.5 min-h-0">
          <div>
            <p className="px-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--bo-ash)' }}>Principal</p>
            <div className="flex flex-col gap-0.5">
              <div className={navItemCls(true)} style={{ background: 'var(--bo-paper)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                <LayoutGrid size={15} strokeWidth={2.25}/> Dashboard
              </div>
              <Link href="/profiles">
                <div className={navItemCls(false)} style={{ color: 'var(--bo-graphite)' }}>
                  <User size={15} strokeWidth={1.75}/> Perfis
                </div>
              </Link>
            </div>
          </div>
        </nav>

        <div className="p-3 shrink-0">
          <Link href="/settings">
            <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs cursor-pointer transition-colors hover:brightness-125" style={{ color: 'var(--bo-graphite)' }}>
              <Settings size={13}/> Configurações
            </div>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--bo-hairline)' }}>
          <h1 className="text-xl font-bold tracking-[-0.01em] mb-1">Olá, Paulo</h1>
          <p className="text-[12px]" style={{ color: 'var(--bo-graphite)' }}>Vamos criar conteúdo viral hoje?</p>
        </div>

        <div className="p-8">
          {/* Action cards */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <Link href="/profiles" className="block">
              <div className="rounded-2xl p-6 cursor-pointer transition-colors hover:brightness-110" style={{ background: 'var(--bo-cloud)', border: '1px solid var(--bo-hairline)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--bo-mist)' }}>
                  <User size={20} style={{ color: 'var(--bo-ink)' }}/>
                </div>
                <h3 className="font-bold mb-2">Perfis</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--bo-graphite)' }}>Configure sua marca, nicho, tom e identidade visual.</p>
                <span className="text-sm font-semibold" style={{ color: 'var(--bo-accent)' }}>Gerenciar →</span>
              </div>
            </Link>
            <button onClick={() => setShowCreate(true)} className="block text-left w-full">
              <div className="rounded-2xl p-6 cursor-pointer transition-colors hover:brightness-110" style={{ background: 'var(--bo-cloud)', border: '1px solid var(--bo-hairline)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--bo-mist)' }}>
                  <LayoutGrid size={18} style={{ color: 'var(--bo-ink)' }}/>
                </div>
                <h3 className="font-bold mb-2">Criar carrossel</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--bo-graphite)' }}>Cola o conteúdo, sobe as imagens, escolhe o modelo — tudo já distribuído nos slides, e você cai no editor pronto pra ajustar e baixar.</p>
                <span className="text-sm font-semibold" style={{ color: 'var(--bo-accent)' }}>Criar carrossel →</span>
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
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black transition-colors" style={{ background: 'var(--bo-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bo-accent-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bo-accent)')}>
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
              <button onClick={() => setShowCreate(true)} className="px-6 py-3 rounded-xl font-semibold text-black" style={{ background: 'var(--bo-accent)' }}>
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

function CarouselCard({ carousel, profileName, onDelete }: {
  carousel: Carousel
  profileName: string
  onDelete: (id: string) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const statusColor: Record<string, string> = {
    draft: '#8a8a92', generating: '#f59e0b', editing: '#3b82f6', done: 'var(--bo-accent)'
  }

  const download = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/carousels/${carousel.id}/export`, { method: 'POST' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error || 'Erro ao exportar o carrossel.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${carousel.title.replace(/[^a-z0-9]/gi, '-')}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden group" style={{ background: 'var(--bo-cloud)', border: '1px solid var(--bo-hairline)' }}>
      <div className="relative h-48 flex items-center justify-center" style={{ background: 'var(--bo-mist)' }}>
        {carousel.thumbnail ? (
          <img src={carousel.thumbnail} alt={carousel.title} className="w-full h-full object-cover"/>
        ) : (
          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--bo-graphite)' }}>
            <LayoutGrid size={28}/>
            <span className="text-xs">Sem preview</span>
          </div>
        )}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.6)' }}>
          {carousel.templateId && (
            <Link href={`/template/${carousel.templateId}?carouselId=${carousel.id}`}>
              <button className="p-2 rounded-lg text-black" style={{ background: 'var(--bo-accent)' }} title="Editar">
                <Pencil size={14}/>
              </button>
            </Link>
          )}
          <button onClick={download} disabled={downloading} className="p-2 rounded-lg text-white disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.15)' }} title="Baixar">
            <Download size={14}/>
          </button>
          <button onClick={() => onDelete(carousel.id)} className="p-2 rounded-lg text-white" style={{ background: 'rgba(239,68,68,0.85)' }} title="Excluir">
            <Trash2 size={14}/>
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold truncate">{carousel.title}</p>
          <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: statusColor[carousel.status] || '#8a8a92' }}/>
        </div>
        <p className="text-xs mb-2 truncate" style={{ color: 'var(--bo-graphite)' }}>{profileName}</p>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--bo-graphite)' }}>
          <Clock size={11}/>
          <span>{new Date(carousel.createdAt).toLocaleDateString('pt-BR')}</span>
          <span className="ml-auto px-1.5 py-0.5 rounded font-semibold" style={{ background: statusColor[carousel.status], color: carousel.status === 'done' ? '#000' : '#fff', fontSize: 10 }}>
            {carousel.status}
          </span>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden pulse" style={{ background: 'var(--bo-cloud)', border: '1px solid var(--bo-hairline)' }}>
      <div className="h-48" style={{ background: 'var(--bo-mist)' }}/>
      <div className="p-4 space-y-2">
        <div className="h-4 rounded" style={{ background: 'var(--bo-mist)', width: '70%' }}/>
        <div className="h-3 rounded" style={{ background: 'var(--bo-mist)', width: '50%' }}/>
      </div>
    </div>
  )
}
