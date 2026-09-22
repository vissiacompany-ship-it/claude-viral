'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, CarouselTemplate, SlideTemplateDef, ContentPillar, SlideHighlight } from '@/types'
import { X, ChevronLeft, ChevronRight, Upload, Trash2, LayoutGrid, User, FileText, Image as ImageIcon, Plus, RefreshCw, Sparkles, Wrench, Copy, Loader2, CheckCircle2, Circle } from 'lucide-react'
import { parseBloco, splitBlocos, bulkInstructions, externalAIPrompt } from '@/lib/bulk-parse'
import { adaptSlideCount } from '@/lib/adapt-slide-count'
import MicDictateButton from '@/components/MicDictateButton'

export const PENDING_GENERATION_KEY = 'pendingCarouselGeneration'
// Prefill vindo do Banco de Narrativas ("Criar Conteúdo" num item salvo) — perfil e texto já
// prontos, a pessoa só escolhe o modelo. Lido uma vez no mount e removido em seguida.
export const CONTENT_PREFILL_KEY = 'cvContentPrefill'

export interface PendingGeneration {
  templateId: string
  carouselTitle: string
  profileId: string
  slideDefs: SlideTemplateDef[] // estrutura do template já ajustada pra quantidade escolhida
  images: string[] // data URLs, na ordem — 1 por slide que tem imagem, na ordem dos slides
  imagePrompts?: string[] // prompt gerado por IA, mesma ordem de "images" — pré-carrega o painel "Gerar prompt de imagem" do editor
  slides: Array<{ index: number; tag?: string; title?: string; subtitle?: string; body?: string }>
  pillar?: ContentPillar // pilar de conteúdo escolhido no passo de ideia — segue pro briefing salvo e influencia o prompt de imagem (ex: noticia-cultura ancora a cena em algo do momento)
  // Negrito/itálico/sublinhado/cor marcados no editor de roteiro (Banco de Narrativas) — cada
  // entrada só "pega" nos slides onde a palavra realmente aparece, casamento é por texto.
  highlights?: SlideHighlight[]
  // Se true, o editor gera sozinho (progressivamente, um de cada vez) a imagem de todo slot
  // com bloco de imagem que ainda não veio preenchido em "images" — sem segurar a navegação
  // pro editor esperando isso terminar.
  autoGenerateImages?: boolean
  // Presente só quando isso vem de "Trocar modelo" num carrossel já salvo — sinaliza que é
  // pra continuar atualizando ESSE registro (não criar um novo) depois da troca de estrutura.
  carouselId?: string
}

const STEP_LABELS = ['Perfil', 'Modelo', 'Conteúdo']

// Prefill do Banco de Narrativas ("Criar Conteúdo" num item salvo) — perfil + conteúdo já
// prontos, só falta escolher o modelo. Lido direto (fora do componente pra ficar puro/sem
// closure) uma vez por render — barato (só sessionStorage.getItem+JSON.parse), e como só é
// consumido nos valores iniciais dos useState abaixo, recomputar em renders depois do mount
// não tem efeito nenhum (React ignora o valor inicial depois da primeira renderização).
function readContentPrefill(): { profileId?: string; content?: string; highlights?: SlideHighlight[] } {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(CONTENT_PREFILL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export default function CreateCarouselModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const contentPrefill = readContentPrefill()
  const prefillSlideCount = contentPrefill.content ? splitBlocos(contentPrefill.content).length : 0
  const [step, setStep] = useState(contentPrefill.content ? 1 : 0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [templates, setTemplates] = useState<CarouselTemplate[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)

  const [profileId, setProfileId] = useState(contentPrefill.profileId || '')
  const [templateId, setTemplateId] = useState('')
  const [slideCount, setSlideCount] = useState(prefillSlideCount > 0 ? Math.max(1, Math.min(20, prefillSlideCount)) : 9)
  // Quando ligado (padrão), ninguém clicou num número específico — a quantidade se ajusta
  // sozinha pelo conteúdo colado/gerado, ou fica no valor padrão que o back-end escolher.
  const [autoSlideCount, setAutoSlideCount] = useState(prefillSlideCount === 0)
  const [content, setContent] = useState(contentPrefill.content || '')
  // Destaques (negrito/itálico/sublinhado/cor) trazidos do editor de roteiro no Banco de
  // Narrativas — não editáveis aqui, só seguem junto pro carrossel final.
  const [contentHighlights] = useState<SlideHighlight[]>(contentPrefill.highlights || [])

  // Passo "Conteúdo" — escolhe entre gerar com IA (a partir de um tópico/material bruto) ou
  // escrever/colar manualmente. Sem escolha ainda = mostra o seletor (null).
  const [contentMode, setContentMode] = useState<'ia' | 'manual' | null>(contentPrefill.content ? 'manual' : null)
  // Seleção do card (IA/Manual) antes de confirmar — clicar no card só destaca, igual ao
  // resto do wizard (perfil, modelo); só "Continuar" no rodapé de fato entra no modo.
  const [pendingMode, setPendingMode] = useState<'ia' | 'manual' | null>(null)
  const [aiRawMaterial, setAiRawMaterial] = useState('')
  const [externalPromptCopied, setExternalPromptCopied] = useState(false)

  const [generating, setGenerating] = useState(false)
  // Índice do passo atual dentro de GENERATING_STEPS — vira uma checklist bonita em tela
  // cheia enquanto gera, em vez de só trocar o texto do botão (pedido do Paulo: o carregamento
  // precisa "mostrar o que está fazendo", não ficar preso ali no rodapé do modal).
  const [generatingStep, setGeneratingStep] = useState(0)
  const [error, setError] = useState('')
  // Antes o botão "Continuar" só ficava desabilitado quando faltava preencher algo — clicar
  // nele desabilitado não faz nada, sem avisar qual campo tá faltando. Agora ele sempre
  // responde ao clique: se faltar algo, marca em vermelho o campo específico.
  const [validationAttempted, setValidationAttempted] = useState(false)

  // Imagens: upload manual sempre disponível; o que faltar (ou tudo, se nada for enviado)
  // pode ser completado com IA na hora de criar — não precisa de passo/tela separada.
  const [fillRestWithAI, setFillRestWithAI] = useState(false)

  const [refreshingProfiles, setRefreshingProfiles] = useState(false)
  const reloadProfiles = () => {
    setRefreshingProfiles(true)
    fetch('/api/profiles').then(r => r.json()).then(setProfiles).finally(() => setRefreshingProfiles(false))
  }

  useEffect(() => {
    let ignore = false
    Promise.all([
      fetch('/api/profiles').then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
    ]).then(([p, t]) => {
      if (ignore) return
      setProfiles(p)
      setTemplates(t)
      setLoadingCatalog(false)
    })
    return () => { ignore = true }
  }, [])

  // Prefill do Banco de Narrativas — perfil + conteúdo já lidos nos useState acima (lazy
  // init); aqui só limpa a sessionStorage, sem chamar setState.
  useEffect(() => {
    sessionStorage.removeItem(CONTENT_PREFILL_KEY)
  }, [])

  const template = templates.find(t => t.id === templateId)
  const adaptedDefs = template ? adaptSlideCount(template.slides, slideCount) : []
  const imageSlots = adaptedDefs.filter(s => s.hasImage).length

  const applySlideCountFromContent = (text: string) => {
    if (!autoSlideCount) return
    const n = splitBlocos(text).length
    if (n > 0) setSlideCount(Math.max(1, Math.min(20, n)))
  }

  const copyExternalPrompt = async () => {
    await navigator.clipboard.writeText(externalAIPrompt(adaptedDefs, slideCount))
    setExternalPromptCopied(true)
    setTimeout(() => setExternalPromptCopied(false), 2000)
  }

  const [images, setImages] = useState<string[]>([])
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
    if (step === 0) return !!profileId
    if (step === 1) return !!templateId
    // No modo Manual precisa ter texto já escrito. No modo IA não — o material é opcional
    // (a IA pode partir só do Perfil) e a copy só é gerada de fato no passo final.
    if (step === 2) return contentMode === 'manual' ? content.trim().length > 0 : contentMode !== null
    return true
  }

  // No passo Conteúdo, "Continuar" tem 2 estágios: primeiro confirma o modo escolhido
  // (IA/Manual) sem sair do passo, só depois disso ele passa pro passo de Imagens.
  const handleContinue = () => {
    if (step === 2 && contentMode === null) {
      if (pendingMode) { setContentMode(pendingMode); setValidationAttempted(false) }
      else setValidationAttempted(true)
      return
    }
    if (canNext()) { setStep(s => s + 1); setValidationAttempted(false) }
    else setValidationAttempted(true)
  }

  // Passos mostrados na tela de carregamento — texto muda um pouco conforme o modo, porque
  // no Manual não existe etapa de "escrever" (o texto já veio pronto da pessoa).
  const generatingSteps = contentMode === 'ia'
    ? ['Escrevendo o roteiro com IA', 'Montando os slides', 'Abrindo o editor']
    : ['Preparando o conteúdo', 'Montando os slides', 'Abrindo o editor']

  const gerar = async () => {
    if (!templateId || !template) return
    setGenerating(true)
    setGeneratingStep(0)
    setError('')
    try {
      // No modo IA, a copy só é escrita agora — a pessoa só deu o material bruto/tópico lá
      // atrás, sem precisar revisar um rascunho intermediário antes de chegar no carrossel.
      let finalContent = content
      let pillar: ContentPillar | undefined
      if (contentMode === 'ia') {
        const topic = aiRawMaterial.trim() || undefined
        // Estrutura real do modelo — alguns modelos (ex: Retrato & Texto) intercalam slides
        // "capa" (foto cheia, só TITULO curto + SUBTITULO curto, sem corpo) no MEIO do
        // carrossel, não só no slide 1. Sem saber disso, a IA escreve um parágrafo normal de
        // TEXTO pra esse slide — e como ele não tem campo de corpo, o texto inteiro acaba
        // despejado dentro do SUBTITULO (curto por natureza), ficando gigante e cortado.
        // Usa o mesmo default (7) que o servidor usa quando slideCount não é enviado (modo
        // automático) — senão a estrutura mandada aqui poderia não bater com a quantidade que
        // o prompt de geração realmente vai mirar.
        const structDefs = autoSlideCount && template ? adaptSlideCount(template.slides, 7) : adaptedDefs
        const slideTypes = structDefs.map(d => d.background === 'cover' ? 'cover' : !d.hasBody ? 'title-only' : 'body')
        const res = await fetch('/api/ai/generate-narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: profileId || undefined, topic, slideCount: autoSlideCount ? undefined : slideCount, slideTypes }),
        }).then(r => r.json())
        if (res.error) throw new Error(res.error)
        finalContent = res.content || ''
        pillar = res.pillar
      }

      setGeneratingStep(1)
      const blocos = splitBlocos(finalContent)
      if (!blocos.length) throw new Error('Não achei nenhum bloco de conteúdo pra distribuir.')
      const slides = blocos.map((bloco, i) => {
        const parsed = parseBloco(bloco)
        return { index: i + 1, tag: parsed.tag, title: parsed.title, subtitle: parsed.subtitle, body: parsed.body }
      })
      // Recalcula a partir da quantidade de blocos que realmente veio (o slider "automático"
      // só reflete o conteúdo depois que ele existe — no modo IA isso só acontece agora).
      const finalDefs = autoSlideCount ? adaptSlideCount(template.slides, Math.max(1, Math.min(20, blocos.length))) : adaptedDefs

      setGeneratingStep(2)
      // As imagens com IA não são geradas aqui — pra não segurar a pessoa numa tela de espera
      // até todas ficarem prontas. Só os slots que já vieram de upload seguem junto; o resto
      // é sinalizado pro editor gerar sozinho, progressivamente, assim que a pessoa já estiver
      // vendo o carrossel com o texto preenchido.
      const pending: PendingGeneration = {
        templateId, carouselTitle: '', profileId, slideDefs: finalDefs, images,
        slides, pillar, autoGenerateImages: fillRestWithAI,
        highlights: contentHighlights.length ? contentHighlights : undefined,
      }
      sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
      router.push(`/template/${templateId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
      setGenerating(false)
    }
  }

  const isLastStep = step === STEP_LABELS.length - 1
  // No passo Conteúdo (agora o último), o botão de criar só aparece depois que um modo
  // (IA/Manual) já foi escolhido — antes disso, "Continuar" só confirma a escolha do card.
  const showCreateButton = isLastStep && contentMode !== null

  const slidePct = ((slideCount - 1) / (20 - 1)) * 100

  const slideCountRow = (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Número de slides</p>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 h-5 flex items-center cv-slider">
          <div className="absolute left-0 right-0 h-1.5 rounded-full" style={{ background: 'var(--bg3)' }}/>
          <div className="absolute left-0 h-1.5 rounded-full" style={{ width: `${slidePct}%`, background: 'var(--grad)' }}/>
          <input type="range" min={1} max={20} step={1} value={slideCount}
            onChange={e => { setSlideCount(Number(e.target.value)); setAutoSlideCount(false) }}
            className="relative w-full"/>
        </div>
        <span className="text-sm font-bold w-6 text-right flex-shrink-0" style={{ color: autoSlideCount ? 'var(--muted)' : 'var(--accent2)' }}>
          {slideCount}
        </span>
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
        {autoSlideCount
          ? (content.trim() ? `Ainda não mexeu — detectei ${slideCount} pelo conteúdo.` : 'Ainda não mexeu — decide sozinho pela quantidade de conteúdo.')
          : <>Travado em {slideCount}. <button onClick={() => setAutoSlideCount(true)} className="underline">Voltar pro automático</button></>}
      </p>
      <style jsx>{`
        .cv-slider input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 20px;
        }
        .cv-slider input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 3px solid var(--accent);
          cursor: pointer;
          margin-top: -1px;
        }
        .cv-slider input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 3px solid var(--accent);
          cursor: pointer;
        }
        .cv-slider input[type="range"]::-webkit-slider-runnable-track { background: transparent; }
        .cv-slider input[type="range"]::-moz-range-track { background: transparent; }
      `}</style>
    </div>
  )

  // Enquanto gera, troca o modal inteiro por uma tela de carregamento com checklist — antes
  // isso só aparecia como texto no botão ("Escrevendo e criando…"), o resto do formulário
  // continuava visível atrás, o que não deixava claro que algo estava de fato acontecendo.
  if (generating) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <Loader2 size={64} className="absolute animate-spin" style={{ color: 'var(--bg3)' }} strokeWidth={2}/>
            <Loader2 size={64} className="absolute animate-spin" style={{ color: 'var(--accent)', clipPath: 'inset(0 50% 0 0)' }} strokeWidth={2}/>
            <Sparkles size={22} style={{ color: 'var(--accent2)' }}/>
          </div>
          <div className="text-center">
            <p className="font-bold text-sm mb-1">Criando seu conteúdo</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Isso leva só alguns segundos…</p>
          </div>
          <div className="w-full space-y-3">
            {generatingSteps.map((label, i) => (
              <div key={label} className="flex items-center gap-2.5">
                {i < generatingStep ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--accent2)' }} className="flex-shrink-0"/>
                ) : i === generatingStep ? (
                  <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent)' }}/>
                ) : (
                  <Circle size={16} style={{ color: 'var(--border)' }} className="flex-shrink-0"/>
                )}
                <span className="text-xs" style={{
                  color: i <= generatingStep ? 'var(--text)' : 'var(--muted)',
                  fontWeight: i === generatingStep ? 600 : 400,
                }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

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
              <h2 className="font-bold text-sm">Criar Conteúdo</h2>
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
                    <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><User size={13}/> Qual perfil é esse conteúdo?</p>
                    <button onClick={reloadProfiles} disabled={refreshingProfiles} title="Atualizar lista"
                      className="p-1.5 rounded-lg disabled:opacity-40" style={{ color: 'var(--muted)' }}>
                      <RefreshCw size={13} className={refreshingProfiles ? 'animate-spin' : ''}/>
                    </button>
                  </div>
                  <div className="space-y-2">
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
                  {validationAttempted && !profileId && (
                    <p className="text-[11px] mt-2" style={{ color: '#e05252' }}>Escolhe um perfil pra continuar — todo conteúdo precisa estar ligado a um.</p>
                  )}
                </div>
              )}

              {step === 1 && (
                <div>
                  <p className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><LayoutGrid size={13}/> Escolha o modelo</p>
                  <div className="grid grid-cols-2 gap-3">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => setTemplateId(t.id)}
                        className="text-left rounded-xl overflow-hidden"
                        style={{ background: 'var(--bg3)', border: `1.5px solid ${templateId === t.id ? 'var(--accent)' : 'var(--border)'}` }}>
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-sm">{t.name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>
                              {t.slides.length} slides
                            </span>
                          </div>
                          <p className="text-[11px] line-clamp-2" style={{ color: 'var(--muted)' }}>{t.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>Quer um post estático? Escolhe o modelo normal — no próximo passo você seleciona 1 slide.</p>
                  {validationAttempted && !templateId && (
                    <p className="text-[11px] mt-2" style={{ color: '#e05252' }}>Escolhe um modelo pra continuar.</p>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {contentMode === null && (
                    <div>
                      <p className="text-sm font-bold text-center mb-1">Como deseja começar?</p>
                      <p className="text-[11px] text-center mb-5" style={{ color: 'var(--muted)' }}>Crie posts virais pra Instagram em segundos</p>
                      <div className="space-y-2.5">
                        <button onClick={() => setPendingMode('ia')}
                          className="w-full flex items-start gap-3 text-left p-4 rounded-xl"
                          style={{ background: 'var(--bg3)', border: `1.5px solid ${pendingMode === 'ia' ? 'var(--accent)' : 'var(--border)'}` }}>
                          <Sparkles size={18} style={{ color: pendingMode === 'ia' ? 'var(--accent2)' : 'var(--muted)' }} className="mt-0.5"/>
                          <div>
                            <p className="font-bold text-sm" style={{ color: pendingMode === 'ia' ? 'var(--accent2)' : 'var(--text)' }}>Usar IA</p>
                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Dê um tópico ou o material bruto que você já tem, e a IA escreve o roteiro completo no nosso padrão.</p>
                          </div>
                        </button>
                        <button onClick={() => setPendingMode('manual')}
                          className="w-full flex items-start gap-3 text-left p-4 rounded-xl"
                          style={{ background: 'var(--bg3)', border: `1.5px solid ${pendingMode === 'manual' ? 'var(--accent)' : 'var(--border)'}` }}>
                          <Wrench size={18} style={{ color: pendingMode === 'manual' ? 'var(--accent2)' : 'var(--muted)' }} className="mt-0.5"/>
                          <div>
                            <p className="font-bold text-sm" style={{ color: pendingMode === 'manual' ? 'var(--accent2)' : 'var(--text)' }}>Criação Manual</p>
                            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Escreva ou cole o texto pronto de cada slide você mesmo.</p>
                          </div>
                        </button>
                      </div>
                      {validationAttempted && !pendingMode && (
                        <p className="text-[11px] mt-2" style={{ color: '#e05252' }}>Escolhe uma opção pra continuar.</p>
                      )}
                    </div>
                  )}

                  {contentMode === 'ia' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-base font-bold block text-center mb-2">Sobre o que é seu conteúdo?</label>
                        <div className="flex justify-end mb-1"><MicDictateButton onTranscript={t => setAiRawMaterial(v => v ? `${v} ${t}` : t)}/></div>
                        <textarea value={aiRawMaterial} onChange={e => setAiRawMaterial(e.target.value)} rows={7} className="resize-none"
                          placeholder="Cole qualquer coisa: um texto, um link, um carrossel inteiro, só uma ideia solta — ou deixe em branco se ainda não tiver nada, a IA parte do Perfil."/>
                      </div>
                      {slideCountRow}
                    </div>
                  )}

                  {contentMode === 'manual' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><FileText size={13}/> Conteúdo completo</label>
                        <p className="text-[11px] mb-1.5" style={{ color: 'var(--muted)' }}>{bulkInstructions(adaptedDefs).hint}</p>
                        <button onClick={copyExternalPrompt} type="button"
                          className="flex items-center gap-1.5 mb-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                          style={{ background: 'var(--bg3)', color: 'var(--accent2)', border: '1px solid var(--border)' }}>
                          <Copy size={12}/> {externalPromptCopied ? 'Copiado!' : 'Copiar prompt pra escrever em outra IA'}
                        </button>
                        <textarea value={content} onChange={e => { setContent(e.target.value); applySlideCountFromContent(e.target.value) }} rows={10}
                          placeholder={bulkInstructions(adaptedDefs).placeholder}
                          className="resize-none"
                          style={validationAttempted && !content.trim() ? { border: '1px solid #e05252' } : undefined}/>
                        {validationAttempted && !content.trim() && (
                          <p className="text-[11px] mt-1" style={{ color: '#e05252' }}>Cola o conteúdo pra continuar.</p>
                        )}
                      </div>
                      {slideCountRow}
                    </div>
                  )}

                  {contentMode !== null && (
                    <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                        <ImageIcon size={13}/> Imagens {imageSlots > 0 && `(${imageSlots} slide${imageSlots > 1 ? 's' : ''} com imagem)`}
                      </p>
                      <label className="flex items-center justify-center gap-2 px-3 py-5 rounded-xl text-sm cursor-pointer mb-2"
                        style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                        <Upload size={16}/> Enviar minhas fotos
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)}/>
                      </label>
                      {images.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mb-2">
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
                      <button type="button" onClick={() => setFillRestWithAI(v => !v)}
                        className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left"
                        style={{ background: fillRestWithAI ? 'rgba(255,138,30,0.12)' : 'var(--bg3)', border: `1px solid ${fillRestWithAI ? 'var(--accent)' : 'var(--border)'}` }}>
                        <span className="flex items-center gap-2 text-xs font-medium" style={{ color: fillRestWithAI ? 'var(--accent2)' : 'var(--text)' }}>
                          <Sparkles size={14} style={{ color: fillRestWithAI ? 'var(--accent2)' : 'var(--muted)' }}/>
                          {images.length > 0
                            ? 'Completar com IA as imagens que eu não enviar'
                            : 'Gerar todas as imagens com IA'}
                        </span>
                        <span className="flex-shrink-0 relative rounded-full transition-colors" style={{ width: 38, height: 22, background: fillRestWithAI ? 'var(--accent)' : 'var(--border)' }}>
                          <span className="absolute top-[3px] rounded-full transition-all" style={{ width: 16, height: 16, background: '#fff', left: fillRestWithAI ? 19 : 3 }}/>
                        </span>
                      </button>
                      {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => {
              if (step === 0) { onClose(); return }
              // Dentro do passo Conteúdo, com um modo já escolhido, "Voltar" retorna pro
              // seletor de modo (sem perder o que já foi digitado) em vez de pular pro
              // passo anterior (Modelo) — senão parece que o modo escolhido "sumiu".
              if (step === 2 && contentMode !== null) { setContentMode(null); return }
              setStep(s => s - 1); setValidationAttempted(false)
            }} disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
            <ChevronLeft size={15}/> {step === 0 ? 'Cancelar' : 'Voltar'}
          </button>
          {!showCreateButton ? (
            <button onClick={handleContinue}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
              Continuar <ChevronRight size={15}/>
            </button>
          ) : (
            <button onClick={gerar} disabled={generating}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-60" style={{ background: 'var(--grad)' }}>
              {generating ? (contentMode === 'ia' ? 'Escrevendo e criando…' : 'Criando…') : 'Criar Conteúdo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
