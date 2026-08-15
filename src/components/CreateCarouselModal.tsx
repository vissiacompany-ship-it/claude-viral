'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, CarouselTemplate, SlideTemplateDef } from '@/types'
import { X, ChevronLeft, ChevronRight, Upload, Trash2, LayoutGrid, User, FileText, Image as ImageIcon, Layers } from 'lucide-react'
import { parseBloco, splitBlocos } from '@/lib/bulk-parse'
import { adaptSlideCount } from '@/lib/adapt-slide-count'

export const PENDING_GENERATION_KEY = 'pendingCarouselGeneration'

export interface PendingGeneration {
  templateId: string
  carouselTitle: string
  profileId: string
  slideDefs: SlideTemplateDef[] // estrutura do template já ajustada pra quantidade escolhida
  images: string[] // data URLs, na ordem — 1 por slide que tem imagem, na ordem dos slides
  slides: Array<{ index: number; tag?: string; title?: string; subtitle?: string; body?: string }>
}

const STEP_LABELS = ['Perfil', 'Modelo', 'Slides', 'Conteúdo', 'Imagens']
const SLIDE_COUNTS = Array.from({ length: 16 }, (_, i) => i + 5) // 5..20

export default function CreateCarouselModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [templates, setTemplates] = useState<CarouselTemplate[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const [profileId, setProfileId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [slideCount, setSlideCount] = useState(9)
  const [carouselTitle, setCarouselTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/profiles').then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
    ]).then(([p, t]) => {
      setProfiles(p)
      setTemplates(t)
      setLoadingCatalog(false)
    })
  }, [])

  const template = templates.find(t => t.id === templateId)
  const adaptedDefs = template ? adaptSlideCount(template.slides, slideCount) : []
  const imageSlots = adaptedDefs.filter(s => s.hasImage).length

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => setImages(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(file)
    })
  }, [])

  const removeImage = (i: number) => setImages(prev => prev.filter((_, idx) => idx !== i))

  const canNext = () => {
    if (step === 1) return !!templateId
    if (step === 3) return content.trim().length > 0 && carouselTitle.trim().length > 0
    return true
  }

  const gerar = () => {
    if (!templateId || !template) return
    setGenerating(true)
    setError('')
    try {
      const blocos = splitBlocos(content)
      if (!blocos.length) throw new Error('Não achei nenhum bloco de conteúdo pra distribuir.')
      const slides = blocos.map((bloco, i) => {
        const parsed = parseBloco(bloco)
        return { index: i + 1, title: parsed.title, subtitle: parsed.subtitle, body: parsed.body }
      })

      const pending: PendingGeneration = {
        templateId, carouselTitle, profileId, slideDefs: adaptedDefs, images, slides,
      }
      sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
      router.push(`/template/${templateId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
      setGenerating(false)
    }
  }

  const isLastStep = step === STEP_LABELS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <LayoutGrid size={16} className="text-black"/>
            </div>
            <div>
              <h2 className="font-bold text-sm">Criar carrossel</h2>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{STEP_LABELS[step]} · {step + 1}/{STEP_LABELS.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: 'var(--bg3)' }}>
          <div className="h-full transition-all" style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%`, background: 'var(--grad)' }}/>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loadingCatalog ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Carregando…</p>
          ) : (
            <>
              {step === 0 && (
                <div>
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><User size={13}/> Qual perfil é esse carrossel?</p>
                  <div className="space-y-2">
                    <button onClick={() => setProfileId('')}
                      className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium"
                      style={{ background: !profileId ? 'var(--bg3)' : 'transparent', border: `1px solid ${!profileId ? 'var(--accent)' : 'var(--border)'}` }}>
                      Sem perfil (preencher manualmente depois)
                    </button>
                    {profiles.map(p => (
                      <button key={p.id} onClick={() => setProfileId(p.id)}
                        className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl text-sm font-medium"
                        style={{ background: profileId === p.id ? 'var(--bg3)' : 'transparent', border: `1px solid ${profileId === p.id ? 'var(--accent)' : 'var(--border)'}` }}>
                        {p.logo ? <img src={p.logo} alt="" className="w-7 h-7 rounded-full object-cover"/> : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: p.primaryColor }}>{p.name[0]}</div>}
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><LayoutGrid size={13}/> Escolha o modelo</p>
                  <div className="grid grid-cols-2 gap-3">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => setTemplateId(t.id)}
                        className="text-left p-4 rounded-xl"
                        style={{ background: 'var(--bg3)', border: `1.5px solid ${templateId === t.id ? 'var(--accent)' : 'var(--border)'}` }}>
                        <p className="font-bold text-sm mb-1">{t.name}</p>
                        <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>{t.description}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>{t.slides.length} slides no padrão</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><Layers size={13}/> Quantos slides esse carrossel vai ter?</p>
                  <p className="text-[11px] mb-3" style={{ color: 'var(--muted)' }}>Quem manda aqui é a sua copy — escolhe o número que bate com o conteúdo que você já tem pronto.</p>
                  <div className="grid grid-cols-6 gap-2">
                    {SLIDE_COUNTS.map(n => (
                      <button key={n} onClick={() => setSlideCount(n)}
                        className="py-2.5 rounded-lg text-sm font-semibold"
                        style={{ background: slideCount === n ? 'var(--grad)' : 'var(--bg3)', color: slideCount === n ? '#000' : 'var(--text)', border: '1px solid var(--border)' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><FileText size={13}/> Nome do carrossel</label>
                    <input value={carouselTitle} onChange={e => setCarouselTitle(e.target.value)} placeholder="Ex: 5 erros que travam sua autoridade" className="mt-1.5"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><FileText size={13}/> Conteúdo completo</label>
                    <p className="text-[11px] mb-1.5" style={{ color: 'var(--muted)' }}>
                      Cola o conteúdo dos {slideCount} slides de uma vez, separando cada slide com uma linha só com <code>---</code>.
                      Marca cada linha com <code>TITULO:</code>, <code>SUBTITULO:</code>, <code>TEXTO:</code> ou <code>LISTA:</code> (sem tag nenhuma, a 1ª linha do bloco vira título e o resto vira corpo).
                    </p>
                    <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
                      placeholder={'TITULO: Headline do slide 1\nTEXTO: Primeiro parágrafo\n---\nTITULO: Headline do slide 2\nLISTA: Item um\nLISTA: Item dois\n---\n...'}
                      className="resize-none"/>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><ImageIcon size={13}/> Imagens</p>
                  <p className="text-[11px] mb-3" style={{ color: 'var(--muted)' }}>
                    Esse carrossel tem {imageSlots} slide(s) com imagem. Suba as fotos na ordem que quer que apareçam — a 1ª foto vai pro 1º slide com imagem, a 2ª pro seguinte, e assim por diante.
                  </p>
                  <label className="flex items-center justify-center gap-2 px-3 py-6 rounded-xl text-sm cursor-pointer mb-3"
                    style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                    <Upload size={16}/> Enviar imagens
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)}/>
                  </label>
                  {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {images.map((src, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden group" style={{ border: '1px solid var(--border)' }}>
                          <img src={src} alt="" className="w-full h-20 object-cover"/>
                          <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>{i + 1}</span>
                          <button onClick={() => removeImage(i)} className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }}>
                            <Trash2 size={14} className="text-white"/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => step === 0 ? onClose() : setStep(s => s - 1)} disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
            <ChevronLeft size={15}/> {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>
          {!isLastStep ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40" style={{ background: 'var(--grad)' }}>
              Continuar <ChevronRight size={15}/>
            </button>
          ) : (
            <button onClick={gerar} disabled={generating}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-60" style={{ background: 'var(--grad)' }}>
              {generating ? 'Criando…' : 'Criar carrossel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
