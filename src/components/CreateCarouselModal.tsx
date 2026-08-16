'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, CarouselTemplate, SlideTemplateDef } from '@/types'
import { X, ChevronLeft, ChevronRight, Upload, Trash2, LayoutGrid, User, FileText, Image as ImageIcon, Layers, Plus, RefreshCw } from 'lucide-react'
import { parseBloco, splitBlocos, bulkInstructions } from '@/lib/bulk-parse'
import { adaptSlideCount } from '@/lib/adapt-slide-count'

export const PENDING_GENERATION_KEY = 'pendingCarouselGeneration'

export interface PendingGeneration {
  templateId: string
  carouselTitle: string
  profileId: string
  slideDefs: SlideTemplateDef[] // estrutura do template já ajustada pra quantidade escolhida
  images: string[] // data URLs, na ordem — 1 por slide que tem imagem, na ordem dos slides
  imagePrompts?: string[] // prompt gerado por IA, mesma ordem de "images" — pré-carrega o painel "Gerar prompt de imagem" do editor
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
  // Antes o botão "Continuar" só ficava desabilitado quando faltava preencher algo — clicar
  // nele desabilitado não faz nada, sem avisar qual campo tá faltando. Agora ele sempre
  // responde ao clique: se faltar algo, marca em vermelho o campo específico.
  const [validationAttempted, setValidationAttempted] = useState(false)

  // Imagens: 3 jeitos de preencher — subir manualmente, gerar só os prompts (pra colar em
  // outra ferramenta depois), ou gerar as imagens de verdade com IA (Claude escreve o
  // prompt, Gemini gera). Os prompts/imagens seguem a MESMA ordem de "images" — o slide de
  // imagem N recebe o prompt/imagem N, igual já funciona pro upload manual.
  const [imageMode, setImageMode] = useState<'upload' | 'prompt' | 'ai'>('upload')
  const [imageGenBusy, setImageGenBusy] = useState(false)
  const [imageGenProgress, setImageGenProgress] = useState('')
  const [imageGenError, setImageGenError] = useState('')
  const [imagePrompts, setImagePrompts] = useState<string[]>([])

  const [refreshingProfiles, setRefreshingProfiles] = useState(false)
  const reloadProfiles = () => {
    setRefreshingProfiles(true)
    fetch('/api/profiles').then(r => r.json()).then(setProfiles).finally(() => setRefreshingProfiles(false))
  }

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

  // Texto de cada slide que tem imagem, na mesma ordem que "images"/"imagePrompts" — usa o
  // conteúdo que a pessoa já colou no passo anterior, cruzando com quais posições do
  // template têm bloco de imagem.
  const imageSlideTexts = () => {
    const blocos = splitBlocos(content)
    const out: { title: string; subtitle: string; body: string }[] = []
    adaptedDefs.forEach((def, i) => {
      if (!def.hasImage) return
      const bloco = blocos[i]
      out.push(bloco ? parseBloco(bloco) : { title: '', subtitle: '', body: '' })
    })
    return out
  }

  const gerarPromptsEmLote = async () => {
    setImageGenBusy(true); setImageGenError(''); setImagePrompts([])
    const items = imageSlideTexts()
    const prompts: string[] = []
    for (let i = 0; i < items.length; i++) {
      setImageGenProgress(`Gerando prompt ${i + 1} de ${items.length}…`)
      try {
        const res = await fetch('/api/ai/image-prompt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: items[i].title, subtitle: items[i].subtitle, body: items[i].body })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Falha')
        prompts.push(data.prompt)
      } catch {
        prompts.push('')
      }
    }
    setImagePrompts(prompts)
    setImageGenBusy(false); setImageGenProgress('')
  }

  const gerarImagensComIA = async () => {
    setImageGenBusy(true); setImageGenError('')
    const items = imageSlideTexts()
    const newImages: string[] = []
    const newPrompts: string[] = []
    for (let i = 0; i < items.length; i++) {
      setImageGenProgress(`Gerando imagem ${i + 1} de ${items.length}…`)
      try {
        const pRes = await fetch('/api/ai/image-prompt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: items[i].title, subtitle: items[i].subtitle, body: items[i].body })
        })
        const pData = await pRes.json()
        if (!pRes.ok) throw new Error(pData.error || 'Falha ao gerar o prompt')
        newPrompts.push(pData.prompt)
        const iRes = await fetch('/api/gemini', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: pData.prompt })
        })
        const iData = await iRes.json()
        if (!iRes.ok) throw new Error(iData.error || 'Falha ao gerar a imagem')
        newImages.push(iData.image)
      } catch (e) {
        setImageGenError(prev => `${prev ? prev + '\n' : ''}Imagem ${i + 1}: ${e instanceof Error ? e.message : 'falhou'}`)
      }
    }
    setImages(prev => [...prev, ...newImages])
    setImagePrompts(prev => [...prev, ...newPrompts])
    setImageGenBusy(false); setImageGenProgress('')
  }

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
        return { index: i + 1, tag: parsed.tag, title: parsed.title, subtitle: parsed.subtitle, body: parsed.body }
      })

      const pending: PendingGeneration = {
        templateId, carouselTitle, profileId, slideDefs: adaptedDefs, images,
        imagePrompts: imagePrompts.length ? imagePrompts : undefined, slides,
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><User size={13}/> Qual perfil é esse carrossel?</p>
                    <button onClick={reloadProfiles} disabled={refreshingProfiles} title="Atualizar lista"
                      className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: 'var(--muted)' }}>
                      <RefreshCw size={13} className={refreshingProfiles ? 'animate-spin' : ''}/>
                    </button>
                  </div>
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
                    <a href="/profiles" target="_blank" rel="noopener noreferrer" className="block">
                      <div className="w-full flex items-center gap-2 text-left px-4 py-3 rounded-xl text-sm font-semibold"
                        style={{ border: '1px dashed var(--border)', color: 'var(--accent)' }}>
                        <Plus size={15}/> Criar novo perfil
                      </div>
                    </a>
                    <p className="text-[10px] px-1" style={{ color: 'var(--muted)' }}>Abre numa aba nova — depois de criar, volta aqui e clica no ↻ pra atualizar a lista.</p>
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
                  {validationAttempted && !templateId && (
                    <p className="text-[11px] mt-2" style={{ color: '#e05252' }}>Escolhe um modelo pra continuar.</p>
                  )}
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
                        style={{ background: slideCount === n ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: slideCount === n ? 'var(--accent2)' : 'var(--text)', border: slideCount === n ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
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
                    <input value={carouselTitle} onChange={e => setCarouselTitle(e.target.value)} placeholder="Ex: 5 erros que travam sua autoridade" className="mt-1.5"
                      style={validationAttempted && !carouselTitle.trim() ? { border: '1px solid #e05252' } : undefined}/>
                    {validationAttempted && !carouselTitle.trim() && (
                      <p className="text-[11px] mt-1" style={{ color: '#e05252' }}>Preenche o nome pra continuar.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><FileText size={13}/> Conteúdo completo</label>
                    <p className="text-[11px] mb-1.5" style={{ color: 'var(--muted)' }}>{bulkInstructions(adaptedDefs).hint}</p>
                    <textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
                      placeholder={bulkInstructions(adaptedDefs).placeholder}
                      className="resize-none"
                      style={validationAttempted && !content.trim() ? { border: '1px solid #e05252' } : undefined}/>
                    {validationAttempted && !content.trim() && (
                      <p className="text-[11px] mt-1" style={{ color: '#e05252' }}>Cola o conteúdo pra continuar.</p>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><ImageIcon size={13}/> Imagens</p>
                  <p className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
                    Esse carrossel tem {imageSlots} slide(s) com imagem.
                  </p>
                  <p className="text-[13px] mb-4 px-3 py-2 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                    Não precisa resolver isso agora — dá pra deixar sem imagem e adicionar depois, direto no editor.
                  </p>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <button onClick={() => setImageMode('upload')}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center"
                      style={{ background: imageMode === 'upload' ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', border: imageMode === 'upload' ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      <Upload size={17} style={{ color: imageMode === 'upload' ? 'var(--accent2)' : 'var(--muted)' }}/>
                      <span className="text-[12px] font-semibold" style={{ color: imageMode === 'upload' ? 'var(--accent2)' : 'var(--text)' }}>Enviar minhas fotos</span>
                    </button>
                    <button onClick={() => setImageMode('prompt')}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center"
                      style={{ background: imageMode === 'prompt' ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', border: imageMode === 'prompt' ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      <FileText size={17} style={{ color: imageMode === 'prompt' ? 'var(--accent2)' : 'var(--muted)' }}/>
                      <span className="text-[12px] font-semibold" style={{ color: imageMode === 'prompt' ? 'var(--accent2)' : 'var(--text)' }}>Gerar prompt (texto)</span>
                    </button>
                    <button onClick={() => setImageMode('ai')}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center"
                      style={{ background: imageMode === 'ai' ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', border: imageMode === 'ai' ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      <ImageIcon size={17} style={{ color: imageMode === 'ai' ? 'var(--accent2)' : 'var(--muted)' }}/>
                      <span className="text-[12px] font-semibold" style={{ color: imageMode === 'ai' ? 'var(--accent2)' : 'var(--text)' }}>Gerar imagem com IA</span>
                    </button>
                  </div>

                  {imageMode === 'upload' && (
                    <>
                      <p className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
                        Suba as fotos na ordem que quer que apareçam — a 1ª foto vai pro 1º slide com imagem, a 2ª pro seguinte, e assim por diante.
                      </p>
                      <label className="flex items-center justify-center gap-2 px-3 py-6 rounded-xl text-sm cursor-pointer mb-3"
                        style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                        <Upload size={16}/> Enviar imagens
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)}/>
                      </label>
                    </>
                  )}

                  {(imageMode === 'prompt' || imageMode === 'ai') && (
                    <div className="mb-3 p-3 rounded-xl" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <p className="text-[13px] mb-3" style={{ color: 'var(--text)' }}>
                        Com base nos <strong>{imageSlots} slide(s) com imagem</strong> e no conteúdo que você já colou, vou gerar <strong>{imageSlots} {imageMode === 'prompt' ? 'prompt(s) de imagem' : 'imagem(ns)'}</strong>, um por slide, nessa ordem.
                      </p>
                      <button onClick={imageMode === 'prompt' ? gerarPromptsEmLote : gerarImagensComIA} disabled={imageGenBusy || imageSlots === 0}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                        style={{ background: 'var(--grad)', color: '#000' }}>
                        {imageGenBusy ? (imageGenProgress || 'Gerando…') : `Confirmar e gerar ${imageSlots} ${imageMode === 'prompt' ? 'prompt(s)' : 'imagem(ns)'}`}
                      </button>
                      {imageGenError && <p className="text-[11px] mt-2 whitespace-pre-wrap" style={{ color: '#f87171' }}>{imageGenError}</p>}
                      {imageMode === 'prompt' && imagePrompts.length > 0 && !imageGenBusy && (
                        <div className="mt-3 space-y-2">
                          {imagePrompts.map((p, i) => (
                            <div key={i} className="p-2 rounded-lg text-[11px]" style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>
                              <span className="font-semibold" style={{ color: 'var(--text)' }}>Slide {i + 1}: </span>{p || '(falhou — tenta gerar de novo depois no editor)'}
                            </div>
                          ))}
                          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Esses prompts já vão junto pro editor — cada slide com imagem já chega com o prompt pronto pra copiar ou gerar a imagem.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {images.map((src, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden group" style={{ border: '1px solid var(--border)' }}>
                          <img src={src} alt="" className="w-full h-20 object-cover"/>
                          <span className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>{i + 1}</span>
                          <button onClick={() => removeImage(i)} className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }}>
                            <Trash2 size={14} className="text-black"/>
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
          <button onClick={() => { if (step === 0) { onClose() } else { setStep(s => s - 1); setValidationAttempted(false) } }} disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
            <ChevronLeft size={15}/> {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>
          {!isLastStep ? (
            <button onClick={() => { if (canNext()) { setStep(s => s + 1); setValidationAttempted(false) } else { setValidationAttempted(true) } }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
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
