'use client'

import { useState, useRef } from 'react'
import { GalleryImage } from '@/types'
import { Upload, Layers, X } from 'lucide-react'

export interface ImageRef { image: string; note: string }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Seletor compacto de referências de imagem — usado tanto no painel de gerar imagem do
// editor de carrossel quanto (versão maior, própria) no Gerador de Imagens. Cada referência
// pode vir do computador (upload direto) ou da galeria do perfil, e leva uma nota opcional
// ("usa o fundo dessa") que o Gemini recebe junto na hora de gerar.
export default function ImageReferencePicker({
  value, onChange, gallery,
}: {
  value: ImageRef[]
  onChange: (next: ImageRef[]) => void
  gallery: GalleryImage[]
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    const items: ImageRef[] = []
    for (const file of Array.from(files)) items.push({ image: await fileToDataUrl(file), note: '' })
    onChange([...value, ...items])
  }

  const addFromGallery = (img: GalleryImage) => {
    onChange([...value, { image: img.url, note: '' }])
    setPickerOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Referências de imagem (opcional)</label>
      {value.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 p-1 rounded-lg" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.image} alt="" className="w-7 h-7 rounded object-cover shrink-0"/>
          <input value={r.note} onChange={e => onChange(value.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x))}
            placeholder="O que aproveitar? Ex: fundo, roupa, iluminação..."
            className="flex-1 min-w-0 px-1.5 py-0.5 rounded text-[10.5px]" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
          <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="shrink-0 p-0.5">
            <X size={11} style={{ color: 'var(--muted)' }}/>
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <button onClick={() => fileRef.current?.click()}
          className="flex-1 py-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1" style={{ background: 'var(--bg3)', border: '1px dashed var(--border)', color: 'var(--muted)' }}>
          <Upload size={11}/> Computador
        </button>
        <button onClick={() => setPickerOpen(true)}
          className="flex-1 py-1.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-center gap-1" style={{ background: 'var(--bg3)', border: '1px dashed var(--border)', color: 'var(--muted)' }}>
          <Layers size={11}/> Galeria
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)}/>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setPickerOpen(false)}>
          <div className="w-full max-w-lg max-h-[70vh] overflow-auto rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[13px]">Selecionar da galeria</h3>
              <button onClick={() => setPickerOpen(false)}><X size={16}/></button>
            </div>
            {gallery.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>A galeria desse perfil ainda está vazia.</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {gallery.map(g => (
                  <button key={g.id} onClick={() => addFromGallery(g)} className="aspect-square rounded-lg overflow-hidden hover:opacity-80" style={{ border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt="" className="w-full h-full object-cover"/>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
