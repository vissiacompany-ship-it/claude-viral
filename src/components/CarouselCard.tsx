'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Carousel } from '@/types'
import { LayoutGrid, Pencil, Download, Trash2, Clock, Eye } from 'lucide-react'
import InstagramPreview from '@/components/InstagramPreview'

export function CarouselCard({ carousel, profileName, onDelete }: {
  carousel: Carousel
  profileName: string
  onDelete: (id: string) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [caption, setCaption] = useState(carousel.content.caption || '')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionError, setCaptionError] = useState('')

  const gerarLegenda = async () => {
    setCaptionLoading(true)
    setCaptionError('')
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: carousel.content.slides.map(s => ({ tag: s.tag, title: s.title, subtitle: s.subtitle, body: s.body })),
          handle: carousel.briefing.niche,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar a legenda')
      setCaption(data.caption)
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : 'Falha ao gerar a legenda')
    } finally {
      setCaptionLoading(false)
    }
  }
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
              <button className="p-2.5 rounded-lg text-black" style={{ background: 'var(--grad)' }} title="Editar">
                <Pencil size={15}/>
              </button>
            </Link>
          )}
          <button onClick={() => setPreviewOpen(true)} className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} title="Ver no Instagram">
            <Eye size={15}/>
          </button>
          <button onClick={download} disabled={downloading} className="p-2.5 rounded-lg disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} title="Baixar">
            <Download size={15}/>
          </button>
          <button onClick={() => onDelete(carousel.id)} className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,107,107,0.5)', color: '#ff8080' }} title="Excluir">
            <Trash2 size={15}/>
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
      {previewOpen && (
        <InstagramPreview
          carousel={carousel}
          caption={caption}
          onCaptionChange={setCaption}
          onClose={() => setPreviewOpen(false)}
          onGenerate={gerarLegenda}
          generating={captionLoading}
          genError={captionError}
        />
      )}
    </div>
  )
}

export function SkeletonCard() {
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
