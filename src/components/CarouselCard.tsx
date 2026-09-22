'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Carousel } from '@/types'
import { LayoutGrid, Pencil, Download, Trash2, Clock, Eye, Check, Loader2 } from 'lucide-react'
import InstagramPreview from '@/components/InstagramPreview'

export function CarouselCard({ carousel, profileName, templateName, onDelete, selectMode, selected, onToggleSelect }: {
  carousel: Carousel
  profileName: string
  templateName?: string
  onDelete: (id: string) => void
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewCarousel, setPreviewCarousel] = useState<Carousel | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [caption, setCaption] = useState(carousel.content.caption || '')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionError, setCaptionError] = useState('')

  // A listagem (esse card) recebe o carrossel "leve" — sem as fotos de cada slide, pra não
  // deixar o Dashboard/Meu Conteúdo lentos (ver comentário em /api/carousels). O preview do
  // Instagram precisa das fotos de verdade, então busca a versão completa só na hora de abrir.
  const openPreview = async () => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    try {
      const full = await fetch(`/api/carousels?id=${carousel.id}`).then(r => r.json())
      setPreviewCarousel(full)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Antes disso, gerar aqui na Biblioteca só guardava a legenda no estado local do card —
  // some ao sair da tela, e o editor (que lê content.caption do carrossel salvo) nunca ficava
  // sabendo que já existia uma. Agora salva de volta no carrossel na hora — busca a versão
  // completa (esse card só recebe a versão "leve", sem fotos, pra listagem não ficar lenta),
  // funde só o campo caption nela, e re-salva o carrossel inteiro sem tocar em mais nada.
  const [hasCaption, setHasCaption] = useState(!!carousel.content.caption)
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
      const full = await fetch(`/api/carousels?id=${carousel.id}`).then(r => r.json())
      await fetch('/api/carousels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...full, content: { ...full.content, caption: data.caption } }),
      })
      setHasCaption(true)
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
    <div className={`rounded-2xl overflow-hidden group relative${selectMode ? ' cursor-pointer' : ''}`}
      style={{ background: 'var(--bo-cloud)', border: selected ? '2px solid var(--bo-accent)' : '1px solid var(--bo-hairline)' }}
      onClick={selectMode ? onToggleSelect : undefined}>
      {selectMode && (
        <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: selected ? 'var(--bo-accent)' : 'rgba(0,0,0,0.5)', border: '1.5px solid #fff' }}>
          {selected && <Check size={14} className="text-black" strokeWidth={3}/>}
        </div>
      )}
      <div className="relative h-48 flex items-center justify-center" style={{ background: 'var(--bo-mist)' }}>
        {carousel.thumbnail ? (
          <img src={carousel.thumbnail} alt={carousel.title} className="w-full h-full object-cover"/>
        ) : (
          <div className="flex flex-col items-center gap-2" style={{ color: 'var(--bo-graphite)' }}>
            <LayoutGrid size={28}/>
            <span className="text-xs">Sem preview</span>
          </div>
        )}
        {!selectMode && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" style={{ background: 'rgba(0,0,0,0.6)' }}>
            {carousel.templateId && (
              <Link href={`/template/${carousel.templateId}?carouselId=${carousel.id}`}>
                <button className="p-2.5 rounded-lg text-black" style={{ background: 'var(--grad)' }} title="Editar">
                  <Pencil size={15}/>
                </button>
              </Link>
            )}
            <button onClick={openPreview} className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} title="Ver no Instagram">
              <Eye size={15}/>
            </button>
            <button onClick={download} disabled={downloading} className="p-2.5 rounded-lg disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }} title="Baixar">
              <Download size={15}/>
            </button>
            <button onClick={() => onDelete(carousel.id)} className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,107,107,0.5)', color: '#ff8080' }} title="Excluir">
              <Trash2 size={15}/>
            </button>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold truncate">{carousel.title}</p>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasCaption && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 9 }} title="Legenda já gerada pra esse carrossel">
                <Check size={9}/> Legenda
              </span>
            )}
            <div className="w-2 h-2 rounded-full mt-0.5" style={{ background: statusColor[carousel.status] || '#8a8a92' }}/>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          <p className="text-xs truncate" style={{ color: 'var(--bo-graphite)' }}>{profileName}</p>
          {templateName && (
            <>
              <span className="flex-shrink-0" style={{ color: 'var(--bo-hairline)' }}>·</span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded flex-shrink-0 min-w-0" style={{ background: 'var(--bo-mist)', color: 'var(--bo-graphite)', fontSize: 10 }} title={templateName}>
                <LayoutGrid size={9} className="flex-shrink-0"/>
                <span className="truncate">{templateName}</span>
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--bo-graphite)' }}>
          <Clock size={11}/>
          <span>{new Date(carousel.createdAt).toLocaleDateString('pt-BR')}</span>
          <span className="ml-auto px-1.5 py-0.5 rounded font-semibold" style={{ background: statusColor[carousel.status], color: carousel.status === 'done' ? '#000' : '#fff', fontSize: 10 }}>
            {carousel.status}
          </span>
        </div>
      </div>
      {previewOpen && previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <Loader2 size={28} className="animate-spin" style={{ color: '#fff' }}/>
        </div>
      )}
      {previewOpen && previewCarousel && (
        <InstagramPreview
          carousel={previewCarousel}
          caption={caption}
          onCaptionChange={setCaption}
          onClose={() => {
            // Também salva se a pessoa editou a legenda à mão aqui no preview (não só quando
            // gera com IA) — sem isso, um ajuste manual também sumiria ao fechar.
            if (caption !== (carousel.content.caption || '')) {
              fetch(`/api/carousels?id=${carousel.id}`).then(r => r.json()).then(full =>
                fetch('/api/carousels', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...full, content: { ...full.content, caption } }),
                })
              ).then(() => setHasCaption(!!caption)).catch(() => {})
            }
            setPreviewOpen(false); setPreviewCarousel(null)
          }}
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
