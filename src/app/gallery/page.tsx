'use client'

import { useState, useEffect, useRef } from 'react'
import { Profile, GalleryImage } from '@/types'
import { Images, Loader2, X, Upload, Copy, Download, Trash2, Sparkles, ImageOff, Eye } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

type SourceFilter = 'todas' | 'generated' | 'upload'

// Sentinela pro seletor de perfil — "Todos" junta a galeria de todo perfil num só grid
// (cada imagem mostra de qual perfil ela é), em vez de forçar escolher um por vez.
const ALL_PROFILES = '__all__'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Painel dedicado só pra galeria — antes ela só aparecia como uma grade pequena (6
// colunas) dentro do Gerador de Imagens. Aqui é a coleção completa do perfil, em tela
// cheia, com upload manual, filtro por origem e detalhe/exclusão de cada imagem.
export default function GalleryPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState('')
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<SourceFilter>('todas')
  const [detailImage, setDetailImage] = useState<GalleryImage | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/profiles').then(r => r.json()).then((data: Profile[]) => {
      setProfiles(data)
      setProfileId(id => id || (data.length ? ALL_PROFILES : ''))
    })
  }, [])

  useEffect(() => {
    let ignore = false
    async function run() {
      if (!profileId) { if (!ignore) setGallery([]); return }
      if (!ignore) setLoading(true)
      try {
        const ids = profileId === ALL_PROFILES ? profiles.map(p => p.id) : [profileId]
        const lists = await Promise.all(
          ids.map(id => fetch(`/api/gallery?profileId=${id}`).then(r => r.json() as Promise<GalleryImage[]>))
        )
        const merged = lists.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        if (!ignore) setGallery(merged)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    run()
    return () => { ignore = true }
  }, [profileId, profiles])

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length || !profileId || profileId === ALL_PROFILES) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const image = await fileToDataUrl(file)
        const created: GalleryImage = await fetch('/api/gallery', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, image, source: 'upload' }),
        }).then(r => r.json())
        setGallery(g => [created, ...g])
      }
    } finally {
      setUploading(false)
    }
  }

  const excluir = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch('/api/gallery', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setGallery(g => g.filter(img => img.id !== id))
      setDetailImage(d => (d?.id === id ? null : d))
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = gallery.filter(g => filter === 'todas' || g.source === filter)

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="gallery"/>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-between mb-1 gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2"><Images size={20}/> Galeria</h1>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                Toda imagem gerada em qualquer carrossel desse perfil, mais o que você subir manualmente aqui.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={profileId} onChange={e => setProfileId(e.target.value)}
                className="px-3 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}
              >
                {profiles.length === 0 && <option value="">Nenhum perfil</option>}
                {profiles.length > 0 && <option value={ALL_PROFILES}>Todos os perfis</option>}
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => uploadFiles(e.target.files)}/>
              <button onClick={() => fileRef.current?.click()} disabled={!profileId || profileId === ALL_PROFILES || uploading}
                title={profileId === ALL_PROFILES ? 'Escolha um perfil específico pra subir imagem' : undefined}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50"
                style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
                {uploading ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                {uploading ? 'Enviando…' : 'Subir imagem'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-6 mb-4">
            {([
              { value: 'todas', label: 'Todas' },
              { value: 'generated', label: 'Geradas com IA' },
              { value: 'upload', label: 'Enviadas manualmente' },
            ] as { value: SourceFilter; label: string }[]).map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-all"
                style={filter === f.value
                  ? { background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }
                  : { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                {f.label}
              </button>
            ))}
            {loading && <Loader2 size={14} className="animate-spin ml-1" style={{ color: 'var(--muted)' }}/>}
          </div>

          {!profileId ? (
            <p className="text-[13px] mt-10 text-center" style={{ color: 'var(--muted)' }}>Crie um perfil primeiro pra ter uma galeria.</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 mt-16" style={{ color: 'var(--muted)' }}>
              <ImageOff size={28} className="opacity-50"/>
              <p className="text-[13px]">
                {gallery.length === 0
                  ? (profileId === ALL_PROFILES ? 'Nenhuma imagem ainda em nenhum perfil.' : 'Nenhuma imagem ainda pra esse perfil.')
                  : 'Nenhuma imagem nesse filtro.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filtered.map(g => (
                <div key={g.id} className="relative aspect-square rounded-xl overflow-hidden group" style={{ border: '1px solid var(--border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105"/>
                  {g.source === 'generated' && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                      <Sparkles size={9}/> IA
                    </span>
                  )}
                  {/* Ao passar o mouse: abrir (vê detalhe/receita) ou excluir direto, sem
                      precisar abrir o modal só pra achar o botão de excluir lá dentro. */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <button onClick={() => setDetailImage(g)} title="Abrir"
                      className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                      <Eye size={15}/>
                    </button>
                    <button onClick={() => excluir(g.id)} disabled={deletingId === g.id} title="Excluir"
                      className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50" style={{ background: 'rgba(255,80,80,0.25)', color: '#ff8080' }}>
                      {deletingId === g.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={14}/>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal: detalhe da imagem (receita + excluir) */}
      {detailImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setDetailImage(null)}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-2xl grid grid-cols-[1fr_320px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detailImage.url} alt="" className="w-full h-full object-cover"/>
            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[14px]">Detalhes</h3>
                <button onClick={() => setDetailImage(null)}><X size={18}/></button>
              </div>
              {detailImage.prompt ? (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Prompt usado</p>
                    <p className="text-[12.5px] leading-relaxed">{detailImage.prompt}</p>
                    <button onClick={() => navigator.clipboard.writeText(detailImage.prompt || '')}
                      className="mt-2 text-[11px] font-semibold flex items-center gap-1" style={{ color: 'var(--accent2)' }}>
                      <Copy size={11}/> Copiar prompt
                    </button>
                  </div>
                  {(detailImage.category || detailImage.style || detailImage.dimension) && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailImage.category && <span className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: 'var(--bg3)' }}>{detailImage.category}</span>}
                      {detailImage.style && <span className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: 'var(--bg3)' }}>{detailImage.style}</span>}
                      {detailImage.dimension && <span className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: 'var(--bg3)' }}>{detailImage.dimension}</span>}
                    </div>
                  )}
                  {detailImage.references && detailImage.references.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Referências combinadas</p>
                      <div className="flex flex-col gap-1.5">
                        {detailImage.references.map((r, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.url} alt="" className="w-9 h-9 rounded object-cover shrink-0" style={{ border: '1px solid var(--border)' }}/>
                            <p className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{r.note || 'Inspiração geral'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>Imagem enviada manualmente — sem receita de geração.</p>
              )}
              <div className="mt-auto flex items-center gap-2">
                <a href={detailImage.url} download className="flex-1 text-[12px] font-semibold flex items-center gap-1.5 py-2 justify-center rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <Download size={13}/> Baixar
                </a>
                <button onClick={() => excluir(detailImage.id)} disabled={deletingId === detailImage.id}
                  className="flex-1 text-[12px] font-semibold flex items-center gap-1.5 py-2 justify-center rounded-lg disabled:opacity-50"
                  style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.4)', color: '#ff8080' }}>
                  {deletingId === detailImage.id ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>} Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
