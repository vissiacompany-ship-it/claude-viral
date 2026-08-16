'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Carousel, Slide, CarouselTemplate, SlideTemplateDef, SlideHighlight, Profile } from '@/types'
import { generateSlideHTML, generateSlideInner, derivePalette } from '@/lib/html-renderer'
import { ArrowLeft, Upload, Save, ClipboardPaste, Plus, Copy, FlipHorizontal2, X, ChevronRight, Image as ImageIcon, Layers, Palette, Type, MoveVertical, Highlighter, FileText, RotateCcw, Download, Check, ZoomIn, ZoomOut, Sparkles, Smartphone } from 'lucide-react'
import { PENDING_GENERATION_KEY, PendingGeneration } from '@/components/CreateCarouselModal'
import { parseBloco, splitBlocos, bulkInstructions } from '@/lib/bulk-parse'
import { adaptSlideCount } from '@/lib/adapt-slide-count'
import BrandColorField from '@/components/BrandColorField'
import InstagramPreview from '@/components/InstagramPreview'
import ColorInput from '@/components/ColorInput'
import HighlightColorField from '@/components/HighlightColorField'

const FONTES = ['Barlow Condensed', 'Plus Jakarta Sans', 'Space Grotesk', 'Poppins', 'Playfair Display', 'Archivo Black', 'Source Serif 4']

interface FieldState {
  tag: string
  title: string
  subtitle: string
  body: string
  ctaWord: string
  image?: string
  images: (string | undefined)[]
  hideImage: boolean
  imageBelow: boolean
  imagePosition: { x: number; y: number }
  imageZoom: number
  imageMirror: boolean
  imagePositions: { x: number; y: number }[]
  imageZooms: number[]
  imageMirrors: boolean[]
  imageNaturalW: number
  imageNaturalH: number
  imageNaturalWs: number[]
  imageNaturalHs: number[]
  imageHeight: number
  marginH: number
  marginV: number
  blockGap: number
  highlights: SlideHighlight[]
  titleSize: number
  bodySize: number
  subtitleSize: number
  fontFamilyHead: string
  fontFamilyBody: string
  titleColor: string
  bodyColor: string
  titleWeight: number
  bodyWeight: number
  titleLineHeight: number
  bodyLineHeight: number
  gradientOn: boolean
  gradientColor: string
  gradientDir: 'top' | 'bottom' | 'left' | 'right'
  gradientExtent: number
  slideBg: string
  textAnchor: 'top' | 'center' | 'bottom'
  textAlign: '' | 'left' | 'right' | 'center' | 'justify'
  avatarSizeOverride: number
  handleSizeOverride: number
  handleColorOverride: string
}

const emptyField = (): FieldState => ({
  tag: '', title: '', subtitle: '', body: '', ctaWord: '',
  image: undefined, images: [], hideImage: false, imageBelow: false, imagePosition: { x: 50, y: 50 }, imageZoom: 100,
  imageMirror: false, imagePositions: [], imageZooms: [], imageMirrors: [],
  imageNaturalW: 0, imageNaturalH: 0, imageNaturalWs: [], imageNaturalHs: [],
  imageHeight: 0, marginH: 0, marginV: 0, blockGap: 0, highlights: [],
  titleSize: 0, bodySize: 0, subtitleSize: 0, fontFamilyHead: '', fontFamilyBody: '', titleColor: '', bodyColor: '',
  titleWeight: 0, bodyWeight: 0, titleLineHeight: 0, bodyLineHeight: 0,
  gradientOn: false, gradientColor: '#000000', gradientDir: 'bottom', gradientExtent: 70,
  slideBg: '', textAnchor: 'top', textAlign: '',
  avatarSizeOverride: 0, handleSizeOverride: 0, handleColorOverride: '',
})

// Aplica os padrões do próprio slide do catálogo (ex: capa com texto embaixo, branco, degradê)
// por cima do emptyField() — só entra em ação se o slide define algum default.
const fieldFromDef = (def: SlideTemplateDef): FieldState => ({
  ...emptyField(),
  textAnchor: def.defaultTextAnchor || 'top',
  imageBelow: def.imageLayout === 'bottom',
  gradientOn: def.defaultGradientOn || false,
  gradientDir: def.defaultGradientDir || 'bottom',
  titleColor: def.defaultTitleColor || '',
  bodyColor: def.defaultBodyColor || '',
  bodySize: def.defaultBodySize || 0,
  handleColorOverride: def.defaultHandleColor || '',
  subtitle: def.defaultSubtitle || '',
  titleSize: def.defaultTitleSize || 0,
  titleWeight: def.defaultTitleWeight || 0,
  titleLineHeight: def.defaultTitleLineHeight || 0,
  subtitleSize: def.defaultSubtitleSize || 0,
  marginH: def.defaultMarginH || 0,
  blockGap: def.defaultBlockGap || 0,
  bodyWeight: def.defaultBodyWeight || 0,
  bodyLineHeight: def.defaultBodyLineHeight || 0,
  imageHeight: def.defaultImageHeight || 0,
})

// Pra retomar a edição de um carrossel já salvo: reconstrói a estrutura (SlideTemplateDef)
// e o conteúdo (FieldState) a partir de cada Slide salvo — assim o "Salvar carrossel"
// não é uma via de mão única, dá pra voltar e continuar mexendo depois.
const slideDefFromSlide = (s: Slide, i: number): SlideTemplateDef => {
  const layoutLabel = s.background === 'cover' ? 'Capa (foto cheia)'
    : s.imageLayout === 'top' ? 'Texto + imagem no topo'
    : s.imageLayout === 'bottom' ? 'Texto + imagem na base'
    : s.imageLayout === 'double-bottom' ? 'Texto + 2 imagens na base'
    : s.imageLayout === 'triple-top' ? '3 imagens no topo + texto'
    : 'Slide'
  return {
    background: s.background,
    label: `${i + 1} · ${layoutLabel}`,
    hasTag: !!s.tag,
    hasBody: s.background !== 'cover',
    hasImage: s.background === 'cover' || !!s.imageLayout,
    style: s.style,
    imageLayout: s.imageLayout,
  }
}

const fieldFromSlide = (s: Slide): FieldState => ({
  ...emptyField(),
  tag: s.tag || '',
  title: s.title || '',
  subtitle: s.subtitle || '',
  body: s.body || '',
  image: s.image,
  images: s.images ? [...s.images] : [],
  hideImage: !!s.hideImage,
  imageBelow: s.imageLayout === 'bottom',
  imagePosition: s.imagePosition || { x: 50, y: 50 },
  imageZoom: s.imageZoom || 100,
  imageMirror: !!s.imageMirror,
  imagePositions: s.imagePositions ? [...s.imagePositions] : [],
  imageZooms: s.imageZooms ? [...s.imageZooms] : [],
  imageMirrors: s.imageMirrors ? [...s.imageMirrors] : [],
  imageNaturalW: s.imageNaturalW || 0,
  imageNaturalH: s.imageNaturalH || 0,
  imageNaturalWs: s.imageNaturalWs ? [...s.imageNaturalWs] : [],
  imageNaturalHs: s.imageNaturalHs ? [...s.imageNaturalHs] : [],
  imageHeight: s.imageHeight || 0,
  marginH: s.marginH || 0,
  marginV: s.marginV || 0,
  blockGap: s.blockGap || 0,
  highlights: s.highlights || [],
  titleSize: s.titleSize || 0,
  bodySize: s.bodySize || 0,
  subtitleSize: s.subtitleSize || 0,
  fontFamilyHead: s.fontFamilyHead || '',
  fontFamilyBody: s.fontFamilyBody || '',
  titleColor: s.titleColor || '',
  bodyColor: s.bodyColor || '',
  titleWeight: s.titleWeight || 0,
  bodyWeight: s.bodyWeight || 0,
  titleLineHeight: s.titleLineHeight || 0,
  bodyLineHeight: s.bodyLineHeight || 0,
  gradientOn: !!s.gradientOn,
  gradientColor: s.gradientColor || '#000000',
  gradientDir: s.gradientDir || 'bottom',
  gradientExtent: s.gradientExtent ?? 70,
  slideBg: s.bgColor || '',
  textAnchor: s.textAnchor || 'top',
  textAlign: (s.textAlign as FieldState['textAlign']) || '',
  avatarSizeOverride: s.avatarSize || 0,
  handleSizeOverride: s.handleSize || 0,
  handleColorOverride: s.handleColor || '',
})

const IMG_COUNT: Record<string, number> = { top: 1, bottom: 1, 'double-bottom': 2, 'triple-top': 3, none: 0 }

export default function TemplateFillPage() {
  const params = useParams()
  const templateId = params.id as string
  const searchParams = useSearchParams()
  const carouselId = searchParams.get('carouselId')
  const router = useRouter()

  const [template, setTemplate] = useState<CarouselTemplate | null>(null)
  const [allTemplates, setAllTemplates] = useState<CarouselTemplate[]>([])
  const [switchPickerOpen, setSwitchPickerOpen] = useState(false)
  const [previewZoom, setPreviewZoom] = useState(100)
  const [loading, setLoading] = useState(true)
  const [handle, setHandle] = useState('eusoupaulofigueirdo')
  // Nome de exibição opcional (estilo X/Twitter: nome em negrito + @arroba embaixo, cinza).
  // Vazio = header mostra só o @arroba, como sempre foi.
  const [displayName, setDisplayName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#A8573C')
  // 2 a 4 cores = degradê na cor da marca; vazio/1 cor = usa só primaryColor (sólida)
  const [primaryColors, setPrimaryColors] = useState<string[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState('')
  const [perfilBlockOpen, setPerfilBlockOpen] = useState(false)
  const [avatarImage, setAvatarImage] = useState<string | undefined>(undefined)
  const [brandText, setBrandText] = useState('Powered by Claude Viral')
  const [brandPosition, setBrandPosition] = useState<'tl' | 'tr' | 'bl' | 'br'>('bl')
  const [brandTextColor, setBrandTextColor] = useState('')
  const [brandTextSize, setBrandTextSize] = useState(13)
  const [brandTextFont, setBrandTextFont] = useState('')
  const [dotSize, setDotSize] = useState(9)
  const [dotsVisible, setDotsVisible] = useState(true)
  const [avatarSize, setAvatarSize] = useState(70)
  const [handleSize, setHandleSize] = useState(30)
  const [handleColor, setHandleColor] = useState('')
  const [verifiedBadge, setVerifiedBadge] = useState(true)
  const [fields, setFields] = useState<FieldState[]>([])
  const [slideDefs, setSlideDefs] = useState<SlideTemplateDef[]>([])
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [carouselTitle, setCarouselTitle] = useState('')
  const [titleMissing, setTitleMissing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [savedMsg, setSavedMsg] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [caption, setCaption] = useState('')
  const [igPreviewOpen, setIgPreviewOpen] = useState(false)
  const [captionOpen, setCaptionOpen] = useState(false)
  const [captionLoading, setCaptionLoading] = useState(false)
  const [captionError, setCaptionError] = useState('')
  const [captionCopied, setCaptionCopied] = useState(false)
  // Painéis pequenos do cabeçalho (Colar conteúdo / Gerar legenda / Trocar modelo) abrem
  // fixos, ancorados embaixo do próprio botão que clicou — não presos na lateral esquerda
  // como o de Dados do perfil (que é maior). fixed escapa do overflow-x-auto do header,
  // que senão corta (clip) qualquer dropdown absolute que passe da borda da barra.
  const bulkBtnRef = useRef<HTMLButtonElement>(null)
  const captionBtnRef = useRef<HTMLButtonElement>(null)
  const switchBtnRef = useRef<HTMLButtonElement>(null)
  const batchImgBtnRef = useRef<HTMLButtonElement>(null)
  const [bulkPos, setBulkPos] = useState({ top: 0, left: 0 })
  const [captionPos, setCaptionPos] = useState({ top: 0, left: 0 })
  const [switchPos, setSwitchPos] = useState({ top: 0, left: 0 })
  const [batchImgPos, setBatchImgPos] = useState({ top: 0, left: 0 })
  const openBelow = (ref: React.RefObject<HTMLButtonElement | null>, setPos: (p: { top: number; left: number }) => void, setOpen: (v: boolean) => void) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, left: r.left })
    setOpen(true)
  }
  // Prompt de imagem gerado por slide (CLI do Claude) + geração real via Gemini, se
  // a API key estiver configurada em Configurações.
  const [imgPromptLoading, setImgPromptLoading] = useState<Record<number, boolean>>({})
  const [imgPromptText, setImgPromptText] = useState<Record<number, string>>({})
  const [imgPromptError, setImgPromptError] = useState<Record<number, string>>({})
  const [imgGenLoading, setImgGenLoading] = useState<Record<number, boolean>>({})
  const [imgPromptCopied, setImgPromptCopied] = useState<Record<number, boolean>>({})
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  // Seleção de texto (arrastar o mouse em cima da palavra/frase) pra destacar direto,
  // sem precisar clicar em chip nem digitar de novo no campo manual.
  const [textSel, setTextSel] = useState<{ field: 'title' | 'subtitle' | 'body'; text: string; source: 'field' | 'preview' } | null>(null)
  const [selStyle, setSelStyle] = useState({ bold: false, italic: false, underline: false, tarja: false })
  const handleSelect = (field: 'title' | 'subtitle' | 'body') => (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const text = el.value.slice(el.selectionStart, el.selectionEnd).trim()
    setTextSel(text ? { field, text, source: 'field' } : null)
  }
  const handlePreviewSelect = (sel: { field: 'title' | 'subtitle' | 'body'; text: string } | null) => {
    setTextSel(sel ? { ...sel, source: 'preview' } : null)
  }
  // Fila de destaque em lote: marca vários trechos (em qualquer ordem, campos diferentes
  // até) sem aplicar cor ainda — quando quiser, escolhe a cor/estilo UMA vez e aplica em
  // todos de uma vez, em vez de repetir a escolha de cor pra cada palavra.
  const [hlQueue, setHlQueue] = useState<string[]>([])
  const queueSelection = () => {
    if (!textSel) return
    setHlQueue(prev => prev.includes(textSel.text) ? prev : [...prev, textSel.text])
    setTextSel(null)
  }
  const removeFromQueue = (word: string) => setHlQueue(prev => prev.filter(w => w !== word))

  // Sempre devolve os 4 estilos de forma explícita (inclusive "desligado" = undefined) —
  // senão, ao destacar de novo em cima de um highlight que já existe, desligar B/I/S/tarja
  // não limpava o valor antigo (só sobrescrevia quando ligado).
  const buildStylePatch = (color: string, style = selStyle) => ({
    color: style.tarja ? '#111111' : color,
    weight: style.bold ? 800 : undefined,
    italic: style.italic || undefined,
    underline: style.underline || undefined,
    background: style.tarja ? color : undefined,
  })

  // Atualiza o highlight já existente pra essa palavra (se tiver) em vez de sempre empilhar
  // um novo — assim clicar em negrito/itálico depois de já ter aplicado cor edita no lugar.
  const upsertHighlight = (word: string, patch: Partial<SlideHighlight> & { color: string }) => {
    setFields(prev => prev.map((f, idx) => {
      if (idx !== active) return f
      const i = f.highlights.findIndex(h => h.word === word)
      if (i === -1) return { ...f, highlights: [...f.highlights, { word, ...patch }] }
      const next = [...f.highlights]
      next[i] = { ...next[i], ...patch }
      return { ...f, highlights: next }
    }))
  }

  const applySelectionHighlight = (color: string) => {
    if (!textSel) return
    upsertHighlight(textSel.text, buildStylePatch(color))
    setTextSel(null)
    setSelStyle({ bold: false, italic: false, underline: false, tarja: false })
  }
  const applyQueuedHighlights = (color: string) => {
    if (!hlQueue.length) return
    const patch = buildStylePatch(color)
    setFields(prev => prev.map((f, idx) => {
      if (idx !== active) return f
      let highlights = [...f.highlights]
      for (const word of hlQueue) {
        const i = highlights.findIndex(h => h.word === word)
        if (i === -1) highlights = [...highlights, { word, ...patch }]
        else highlights[i] = { ...highlights[i], ...patch }
      }
      return { ...f, highlights }
    }))
    setHlQueue([])
    setSelStyle({ bold: false, italic: false, underline: false, tarja: false })
  }
  // Clicar em B/I/S/tarja aplica na hora se já tiver uma palavra selecionada — não fica
  // esperando a pessoa clicar numa cor também (isso confundia: "selecionei negrito e não
  // mudou nada"). Se a palavra já tinha destaque, reaproveita a cor que já estava lá.
  const toggleSelStyle = (k: 'bold' | 'italic' | 'underline' | 'tarja') => {
    const next = { ...selStyle, [k]: !selStyle[k] }
    setSelStyle(next)
    if (textSel) {
      const existing = fields[active]?.highlights.find(h => h.word === textSel.text)
      const color = existing?.background || existing?.color || HL_COLORS[0]
      upsertHighlight(textSel.text, buildStylePatch(color, next))
    }
  }
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // Modo de seleção múltipla: qualquer mudança feita em qualquer painel (Layout, Tipografia,
  // etc.) aplica em todos os slides selecionados de uma vez, não só no slide ativo.
  const [multiSelect, setMultiSelect] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const toggleSelected = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }
  const [swapPickerOpen, setSwapPickerOpen] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Palavras do título/subtítulo/texto do slide ativo, únicas, na ordem em que aparecem —
  // vira botão clicável no "Destaque de palavra/frase" (clicar = destacar, não precisa digitar de novo).
  const wordsOf = (f: FieldState): string[] => {
    const text = [f.title, f.subtitle, f.body].filter(Boolean).join(' ')
    const seen = new Set<string>()
    const words: string[] = []
    text.split(/\s+/).forEach(raw => {
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
      if (w && !seen.has(w.toLowerCase())) { seen.add(w.toLowerCase()); words.push(w) }
    })
    return words
  }

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => setGeminiConfigured(!!s.geminiApiKey)).catch(() => {})
  }, [])

  const gerarPromptImagem = async (i: number): Promise<string | null> => {
    const fld = fields[i]
    setImgPromptLoading(p => ({ ...p, [i]: true }))
    setImgPromptError(p => ({ ...p, [i]: '' }))
    try {
      const res = await fetch('/api/ai/image-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fld.title, subtitle: fld.subtitle, body: fld.body, tag: fld.tag })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar o prompt')
      setImgPromptText(p => ({ ...p, [i]: data.prompt }))
      return data.prompt as string
    } catch (e) {
      setImgPromptError(p => ({ ...p, [i]: e instanceof Error ? e.message : 'Falha ao gerar o prompt' }))
      return null
    } finally {
      setImgPromptLoading(p => ({ ...p, [i]: false }))
    }
  }

  const copiarPromptImagem = (i: number) => {
    navigator.clipboard.writeText(imgPromptText[i] || '')
    setImgPromptCopied(p => ({ ...p, [i]: true }))
    setTimeout(() => setImgPromptCopied(p => ({ ...p, [i]: false })), 1800)
  }

  const gerarImagemAgora = async (i: number, onStep?: (step: 'prompt' | 'image') => void) => {
    setImgGenLoading(p => ({ ...p, [i]: true }))
    setImgPromptError(p => ({ ...p, [i]: '' }))
    try {
      // Se ainda não tem prompt gerado pra esse slide, gera agora mesmo (a pessoa não
      // deveria precisar clicar em "Gerar prompt" antes só pra habilitar esse botão).
      let prompt = imgPromptText[i]
      if (!prompt) {
        onStep?.('prompt')
        prompt = (await gerarPromptImagem(i)) || ''
      }
      if (!prompt) return
      onStep?.('image')
      const res = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar a imagem')
      const def = slideDefs[i]
      const dims = await readImageDims(data.image)
      if (def.imageLayout && def.imageLayout !== 'none') {
        setFields(prev => prev.map((f, idx) => {
          if (idx !== i) return f
          const images = [...f.images]; images[0] = data.image
          const imageNaturalWs = [...f.imageNaturalWs]; imageNaturalWs[0] = dims.w
          const imageNaturalHs = [...f.imageNaturalHs]; imageNaturalHs[0] = dims.h
          return { ...f, images, imageNaturalWs, imageNaturalHs }
        }))
      } else {
        updateField(i, { image: data.image, imageNaturalW: dims.w, imageNaturalH: dims.h })
      }
    } catch (e) {
      setImgPromptError(p => ({ ...p, [i]: e instanceof Error ? e.message : 'Falha ao gerar a imagem' }))
    } finally {
      setImgGenLoading(p => ({ ...p, [i]: false }))
    }
  }

  // Botão geral do cabeçalho — varre TODOS os slides do carrossel, acha os que têm bloco
  // de imagem ligado mas ainda sem imagem nenhuma, e gera um por um (nunca em paralelo,
  // pra não virar bagunça de várias chamadas de CLI ao mesmo tempo), avisando o progresso.
  const [batchImgOpen, setBatchImgOpen] = useState(false)
  const [batchImgBusy, setBatchImgBusy] = useState(false)
  const [batchImgProgress, setBatchImgProgress] = useState('')

  const pendingImageSlides = () => slideDefs
    .map((def, i) => ({ def, i, f: fields[i] }))
    .filter(({ def, f }) => f && def.hasImage && !f.hideImage &&
      (def.imageLayout && def.imageLayout !== 'none' ? !f.images?.[0] : !f.image))
    .map(x => x.i)

  const gerarTodasImagens = async () => {
    const indices = pendingImageSlides()
    if (!indices.length || batchImgBusy) return
    setBatchImgBusy(true)
    for (let n = 0; n < indices.length; n++) {
      setBatchImgProgress(`Slide ${n + 1} de ${indices.length} — gerando prompt…`)
      await gerarImagemAgora(indices[n], step => {
        setBatchImgProgress(step === 'prompt'
          ? `Slide ${n + 1} de ${indices.length} — gerando prompt…`
          : `Slide ${n + 1} de ${indices.length} — gerando imagem… (pode levar até 1 min)`)
      })
    }
    setBatchImgProgress('')
    setBatchImgBusy(false)
  }

  const gerarLegenda = async () => {
    setCaptionLoading(true)
    setCaptionError('')
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: fields.map(f => ({ tag: f.tag, title: f.title, subtitle: f.subtitle, body: f.body })),
          handle,
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

  const copiarLegenda = () => {
    navigator.clipboard.writeText(caption)
    setCaptionCopied(true)
    setTimeout(() => setCaptionCopied(false), 1800)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    let cancelled = false
    const timeout = setTimeout(() => ctrl.abort(), 8000)
    fetch(`/api/templates?id=${templateId}`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then((t: CarouselTemplate) => {
        // Em dev, o React monta/desmonta/remonta os efeitos uma vez (StrictMode) — sem essa
        // guarda, os dois fetches em voo resolvem em sequência e o segundo reseta os campos
        // pro padrão em branco por cima de qualquer conteúdo já aplicado (ex: pelo wizard).
        if (cancelled) return
        setTemplate(t)
        setSlideDefs(t.slides)
        setFields(t.slides.map(d => fieldFromDef(d)))
        // Padrão de perfil (foto/texto) específico desse template — vale pra todos os
        // slides, mas continua 100% ajustável depois em "Dados do perfil".
        if (t.id === 'quotes-bold-sans-9') {
          setAvatarSize(80)
          setHandleSize(30)
        }
        if (t.id === 'step-guide-6') {
          setAvatarSize(100)
          setHandleSize(40)
        }
        setLoading(false)
      })
      .catch(e => { if (!cancelled) { setLoadError(e.name === 'AbortError' ? 'Sem resposta do servidor (timeout). Feche a aba e abra de novo.' : (e.message || 'Falha ao carregar o modelo')); setLoading(false) } })
      .finally(() => clearTimeout(timeout))
    return () => { cancelled = true; ctrl.abort() }
  }, [templateId])

  // Se veio de um carrossel já salvo (?carouselId=), sobrescreve os padrões do template
  // com o que foi salvo — retomando a edição de onde parou, em vez de começar do zero.
  useEffect(() => {
    if (!carouselId || !template) return
    fetch(`/api/carousels?id=${carouselId}`)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then((c: Carousel) => {
        setCarouselTitle(c.title || '')
        setProfileId(c.profileId || '')
        setHandle(c.briefing.niche || '')
        setDisplayName(c.briefing.displayName || '')
        setPrimaryColor(c.briefing.primaryColor || '#A8573C')
        setPrimaryColors(c.briefing.primaryColors || [])
        setAvatarImage(c.briefing.avatarImage)
        setBrandText(c.briefing.brandText || 'Powered by Claude Viral')
        setBrandPosition(c.briefing.brandPosition || 'bl')
        setBrandTextColor(c.briefing.brandTextColor || '')
        setBrandTextSize(c.briefing.brandTextSize || 13)
        setBrandTextFont(c.briefing.brandTextFont || '')
        setDotSize(c.briefing.dotSize || 9)
        setDotsVisible(c.briefing.dotsVisible !== false)
        setAvatarSize(c.briefing.avatarSize || 70)
        setHandleSize(c.briefing.handleSize || 30)
        setHandleColor(c.briefing.handleColor || '')
        setVerifiedBadge(c.briefing.verifiedBadge !== false)
        // Usa a def real do template (já carregada acima) — não reconstrói hasBody/hasTag
        // a partir do conteúdo salvo, senão um slide sem tag/corpo preenchido no momento
        // parece "não ter" esse campo mesmo quando o template define que ele existe.
        setSlideDefs(c.content.slides.map((s, i) => template.slides[i] || slideDefFromSlide(s, i)))
        setFields(c.content.slides.map(s => fieldFromSlide(s)))
        setCaption(c.content.caption || '')
        setSavedId(c.id)
      })
      .catch(() => { /* se falhar, só continua com os padrões do template */ })
  }, [carouselId, template])

  useEffect(() => {
    fetch('/api/profiles').then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/templates').then(r => r.json()).then(setAllTemplates).catch(() => {})
  }, [])

  // Troca o modelo inteiro sem perder o que já foi digitado — empacota o conteúdo atual
  // (texto + imagens, na ordem) igual o painel "Criar carrossel" faz, e deixa a página do
  // novo modelo remontar tudo sozinha ao carregar.
  const trocarModelo = (newTemplateId: string) => {
    const novo = allTemplates.find(t => t.id === newTemplateId)
    if (!novo) return
    const adaptedDefs = adaptSlideCount(novo.slides, slideDefs.length)
    const images: string[] = []
    const slidesContent = fields.map((f, i) => {
      if (f.image) images.push(f.image)
      return { index: i + 1, tag: f.tag, title: f.title, subtitle: f.subtitle, body: f.body }
    })
    const pending: PendingGeneration = {
      templateId: newTemplateId, carouselTitle, profileId, slideDefs: adaptedDefs, images, slides: slidesContent,
    }
    sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
    router.push(`/template/${newTemplateId}`)
  }

  // Vem do painel "Criar carrossel" (popup): a IA já distribuiu o conteúdo colado entre os
  // slides e o usuário já escolheu as imagens (na ordem) — só falta encaixar tudo nos campos
  // do editor, igual a se a pessoa tivesse preenchido manualmente slide por slide.
  useEffect(() => {
    if (!template || carouselId) return
    const raw = sessionStorage.getItem(PENDING_GENERATION_KEY)
    if (!raw) return
    sessionStorage.removeItem(PENDING_GENERATION_KEY)
    let pending: PendingGeneration
    try { pending = JSON.parse(raw) } catch { return }
    if (pending.templateId !== template.id) return

    if (pending.carouselTitle) setCarouselTitle(pending.carouselTitle)

    // A estrutura já vem ajustada pra quantidade de slides escolhida no wizard (pode ter
    // menos ou mais posições que o template padrão) — substitui os slideDefs por essa.
    const defs = pending.slideDefs?.length ? pending.slideDefs : template.slides
    setSlideDefs(defs)
    let imgCursor = 0
    const promptsByIndex: Record<number, string> = {}
    setFields(defs.map((def, i) => {
      const base = fieldFromDef(def)
      const s = pending.slides.find(sl => sl.index === i + 1)
      const patch: Partial<FieldState> = {}
      if (s) {
        // Capa não tem campo de corpo — se o bloco veio sem a tag SUBTITULO: explícita,
        // o texto extra (que caiu em "body") vira subtítulo em vez de sumir. Modelos "só
        // texto" (sem corpo separado, ex: Tutorial Passo a Passo) juntam tudo no título.
        if (def.background === 'cover') {
          patch.title = s.title
          if (s.subtitle || s.body) patch.subtitle = s.subtitle || s.body
        } else if (!def.hasBody) {
          patch.title = [s.title, s.subtitle, s.body].filter(Boolean).join('\n\n')
        } else {
          if (s.title !== undefined) patch.title = s.title
          if (s.body !== undefined) patch.body = s.body
        }
        if (def.hasTag && s.tag !== undefined) patch.tag = s.tag
      }
      if (def.hasImage && imgCursor < pending.images.length) {
        // Templates com imageLayout (ex: card de screenshot) guardam a imagem no array
        // f.images[], não no campo único f.image — senão o painel de zoom/posição (que lê
        // do array) fica sem achar a imagem que foi atribuída aqui.
        if (def.imageLayout && def.imageLayout !== 'none') {
          patch.images = [pending.images[imgCursor]]
        } else {
          patch.image = pending.images[imgCursor]
        }
        if (pending.imagePrompts?.[imgCursor]) promptsByIndex[i] = pending.imagePrompts[imgCursor]
        imgCursor++
      }
      return { ...base, ...patch }
    }))
    if (Object.keys(promptsByIndex).length) setImgPromptText(p => ({ ...p, ...promptsByIndex }))

    // Lê a largura/altura reais de cada imagem atribuída, pra zoom/posição funcionarem sem distorcer.
    setTimeout(() => {
      setFields(prev => {
        prev.forEach((f, i) => {
          if (f.image) {
            readImageDims(f.image).then(({ w, h }) => {
              setFields(cur => cur.map((c, idx) => idx === i ? { ...c, imageNaturalW: w, imageNaturalH: h } : c))
            })
          }
          if (f.images[0]) {
            readImageDims(f.images[0]).then(({ w, h }) => {
              setFields(cur => cur.map((c, idx) => idx === i
                ? { ...c, imageNaturalWs: [w, ...c.imageNaturalWs.slice(1)], imageNaturalHs: [h, ...c.imageNaturalHs.slice(1)] }
                : c))
            })
          }
        })
        return prev
      })
    }, 0)

    if (pending.profileId) {
      fetch('/api/profiles').then(r => r.json()).then((ps: Profile[]) => {
        const p = ps.find(pr => pr.id === pending.profileId)
        setProfileId(pending.profileId)
        if (!p) return
        setHandle(p.instagram || '')
        setDisplayName(p.name || '')
        setPrimaryColor(p.primaryColor || '#A8573C')
        setPrimaryColors(p.primaryColors || [])
        setAvatarImage(p.logo || undefined)
        setBrandText(p.brandText || 'Powered by Claude Viral')
        setBrandPosition(p.brandPosition || 'bl')
        setVerifiedBadge(p.verifiedBadge !== false)
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, carouselId])

  // Aplica os dados salvos do perfil (handle, cor, avatar) — continua editável depois.
  const aplicarPerfil = (id: string) => {
    setProfileId(id)
    if (!id) return
    const p = profiles.find(pr => pr.id === id)
    if (!p) return
    // Substitui tudo pelo perfil escolhido — nunca deixa resquício do perfil anterior.
    setHandle(p.instagram || '')
    setDisplayName(p.name || '')
    setPrimaryColor(p.primaryColor || '#A8573C')
    setPrimaryColors(p.primaryColors || [])
    setAvatarImage(p.logo || undefined)
    setBrandText(p.brandText || 'Powered by Claude Viral')
    setBrandPosition(p.brandPosition || 'bl')
    setVerifiedBadge(p.verifiedBadge !== false)
  }

  // Catálogo de estruturas pra copiar sempre vem do template original (imutável) — assim,
  // mesmo que o slide 7 tenha virado uma "Capa", a estrutura original "7 · Capa" continua
  // disponível pra usar em outro lugar, nunca some da lista.
  const estruturasDisponiveis = template?.slides || []

  // Adiciona um slide novo clonando uma estrutura do catálogo original.
  const adicionarSlide = (base: SlideTemplateDef) => {
    const novoIndex = slideDefs.length
    const novoDef: SlideTemplateDef = {
      ...base,
      label: `${novoIndex + 1} · ${base.label.replace(/^\d+\s*·\s*/, '')} (cópia)`,
    }
    setSlideDefs(prev => [...prev, novoDef])
    setFields(prev => [...prev, fieldFromDef(base)])
    setActive(novoIndex)
    setAddPickerOpen(false)
  }

  // Troca a estrutura (layout) de um slide já existente, mantendo a posição e o conteúdo digitado.
  const trocarEstrutura = (targetIndex: number, base: SlideTemplateDef) => {
    const numero = targetIndex + 1
    const nomeBase = base.label.replace(/^\d+\s*·\s*/, '')
    setSlideDefs(prev => prev.map((d, i) => i === targetIndex
      ? { ...base, label: `${numero} · ${nomeBase}` }
      : d
    ))
    setSwapPickerOpen(false)
  }

  // Arrastar uma miniatura de um lugar pro outro (reordena estrutura + conteúdo juntos).
  const moverSlide = (from: number, to: number) => {
    setSlideDefs(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setFields(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setActive(to)
  }

  const removerSlide = (index: number) => {
    if (slideDefs.length <= 1) return
    setSlideDefs(prev => prev.filter((_, i) => i !== index))
    setFields(prev => prev.filter((_, i) => i !== index))
    setActive(prev => {
      if (index < prev) return prev - 1
      if (index === prev) return Math.max(0, prev - 1)
      return prev
    })
  }

  // Duplica um slide (estrutura + conteúdo digitado), inserindo logo depois dele.
  const duplicarSlideAt = (index: number) => {
    const defCopy: SlideTemplateDef = { ...slideDefs[index], label: `${slideDefs[index].label} (cópia)` }
    const fieldCopy: FieldState = { ...fields[index] }
    setSlideDefs(prev => [...prev.slice(0, index + 1), defCopy, ...prev.slice(index + 1)])
    setFields(prev => [...prev.slice(0, index + 1), fieldCopy, ...prev.slice(index + 1)])
    setActive(index + 1)
  }

  // Quando o modo "Selecionar vários" está ligado, qualquer ajuste de layout/estilo (não só
  // no painel Layout do Texto — tipografia, degradê, fundo, zoom/posição de imagem, badge de
  // perfil) aplica em todos os slides marcados de uma vez, em vez de só no slide ativo.
  const targetIndices = useCallback((i: number): Set<number> =>
    multiSelect && selected.size > 0 ? selected : new Set([i]), [multiSelect, selected])

  const updateField = useCallback((i: number, patch: Partial<FieldState>) => {
    setFields(prev => {
      const targets = targetIndices(i)
      return prev.map((f, idx) => targets.has(idx) ? { ...f, ...patch } : f)
    })
  }, [targetIndices])

  const setSlotArr = <T,>(arr: T[], slot: number, val: T, fallback: T): T[] => {
    const next = [...arr]
    while (next.length <= slot) next.push(fallback)
    next[slot] = val
    return next
  }
  const updateImgSlotZoom = (i: number, slot: number, v: number) => {
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => targets.has(idx) ? { ...f, imageZooms: setSlotArr(f.imageZooms, slot, v, 100) } : f))
  }
  const updateImgSlotPos = (i: number, slot: number, axis: 'x' | 'y', v: number) => {
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => {
      if (!targets.has(idx)) return f
      const cur = f.imagePositions[slot] || { x: 50, y: 50 }
      return { ...f, imagePositions: setSlotArr(f.imagePositions, slot, { ...cur, [axis]: v }, { x: 50, y: 50 }) }
    }))
  }
  const toggleImgSlotMirror = (i: number, slot: number) => {
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => {
      if (!targets.has(idx)) return f
      const cur = !!f.imageMirrors[slot]
      return { ...f, imageMirrors: setSlotArr(f.imageMirrors, slot, !cur, false) }
    }))
  }

  // Restaura só os campos passados pro padrão de fábrica (usado nos botões "restaurar padrão" das caixinhas).
  const resetFields = (i: number, keys: (keyof FieldState)[]) => {
    const defaults = emptyField()
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => {
      if (!targets.has(idx)) return f
      const patch: Partial<FieldState> = {}
      keys.forEach(k => { (patch as Record<string, unknown>)[k] = defaults[k] })
      return { ...f, ...patch }
    }))
  }
  const removeImage = (i: number) => {
    resetFields(i, ['image', 'imagePosition', 'imageZoom', 'imageMirror'])
  }
  const removeImgSlot = (i: number, slot: number) => {
    setFields(prev => prev.map((f, idx) => {
      if (idx !== i) return f
      const images = [...f.images]; images[slot] = undefined
      const imagePositions = [...f.imagePositions]; imagePositions[slot] = { x: 50, y: 50 }
      const imageZooms = [...f.imageZooms]; imageZooms[slot] = 100
      const imageMirrors = [...f.imageMirrors]; imageMirrors[slot] = false
      return { ...f, images, imagePositions, imageZooms, imageMirrors }
    }))
  }

  const addHighlight = (i: number) => {
    setFields(prev => prev.map((f, idx) => idx === i
      ? { ...f, highlights: [...f.highlights, { word: '', color: '#22c55e' }] }
      : f))
  }
  const updateHighlight = (i: number, hi: number, patch: Partial<SlideHighlight>) => {
    setFields(prev => prev.map((f, idx) => idx === i
      ? { ...f, highlights: f.highlights.map((h, hj) => hj === hi ? { ...h, ...patch } : h) }
      : f))
  }
  const removeHighlight = (i: number, hi: number) => {
    setFields(prev => prev.map((f, idx) => idx === i
      ? { ...f, highlights: f.highlights.filter((_, hj) => hj !== hi) }
      : f))
  }

  const distribuirConteudo = (text?: string) => {
    const blocos = splitBlocos(text ?? bulkText)
    setFields(prev => prev.map((f, i) => {
      const bloco = blocos[i]
      if (!bloco) return f
      const parsed = parseBloco(bloco)
      // Capa não tem campo de corpo — se o bloco veio sem a tag SUBTITULO: explícita
      // (modo simples: 1ª linha = título, resto = corpo), esse "resto" vira subtítulo
      // da capa em vez de sumir silenciosamente num campo que o slide não usa.
      const def = slideDefs[i]
      const isCover = def?.background === 'cover'
      // Modelos "só texto" (ex: Tutorial Passo a Passo) não têm campo de corpo separado —
      // tudo que viria como corpo/subtítulo se junta no próprio título, senão o texto
      // colado além da 1ª linha sumiria silenciosamente.
      const noBody = def && !def.hasBody && !isCover
      return {
        ...f,
        tag: (def?.hasTag && parsed.tag) || f.tag,
        title: noBody
          ? [parsed.title, parsed.subtitle, parsed.body].filter(Boolean).join('\n\n') || f.title
          : (parsed.title || f.title),
        subtitle: (isCover ? (parsed.subtitle || parsed.body) : parsed.subtitle) || f.subtitle,
        body: (isCover || noBody) ? f.body : (parsed.body || f.body),
      }
    }))
    setBulkOpen(false)
    setBulkText('')
  }

  // Lê a largura/altura reais do arquivo — usado pra calcular zoom em px sem nunca distorcer.
  const readImageDims = (dataUrl: string): Promise<{ w: number; h: number }> =>
    new Promise(resolve => {
      const img = new window.Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = dataUrl
    })

  const uploadImage = (i: number, file: File) => {
    const reader = new FileReader()
    reader.onload = async e => {
      const dataUrl = e.target?.result as string
      const { w, h } = await readImageDims(dataUrl)
      updateField(i, { image: dataUrl, imageNaturalW: w, imageNaturalH: h })
    }
    reader.readAsDataURL(file)
  }

  const uploadAvatar = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setAvatarImage(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const uploadImageAt = (i: number, slot: number, file: File) => {
    const reader = new FileReader()
    reader.onload = async e => {
      const dataUrl = e.target?.result as string
      const { w, h } = await readImageDims(dataUrl)
      setFields(prev => prev.map((f, idx) => {
        if (idx !== i) return f
        const images = [...f.images]; images[slot] = dataUrl
        const imageNaturalWs = [...f.imageNaturalWs]; imageNaturalWs[slot] = w
        const imageNaturalHs = [...f.imageNaturalHs]; imageNaturalHs[slot] = h
        return { ...f, images, imageNaturalWs, imageNaturalHs }
      }))
    }
    reader.readAsDataURL(file)
  }

  // Monta o Carousel completo (mesmo shape usado no resto do app) a partir dos campos preenchidos.
  // Calcula o "cover" certo em pixels reais (nunca em %), usando a largura/altura de
  // verdade da foto — só assim zoom amplia e posição arrasta sem NUNCA esticar a imagem.
  const computeCoverPx = (natW: number, natH: number, boxW: number, boxH: number, zoomPct: number) => {
    if (!natW || !natH || !boxW || !boxH) return undefined
    const coverScale = Math.max(boxW / natW, boxH / natH)
    const scale = coverScale * ((zoomPct || 100) / 100)
    return { w: Math.round(natW * scale), h: Math.round(natH * scale) }
  }

  const carousel: Carousel | null = useMemo(() => {
    if (!template || fields.length !== slideDefs.length) return null
    const slides: Slide[] = slideDefs.map((def, i) => {
      const f = fields[i]
      const contentW = 1080 - 2 * (f.marginH || 176)
      let imageBgSizePx: { w: number; h: number } | undefined
      let imageBgSizesPx: ({ w: number; h: number } | undefined)[] | undefined
      if (def.background === 'cover') {
        imageBgSizePx = computeCoverPx(f.imageNaturalW, f.imageNaturalH, 1080, 1350, f.imageZoom)
      } else if (def.imageLayout && def.imageLayout !== 'none') {
        const h = f.imageHeight || (def.imageLayout === 'double-bottom' ? 340 : def.imageLayout === 'triple-top' ? 400 : 480)
        const boxes: { w: number; h: number }[] =
          def.imageLayout === 'double-bottom'
            ? [{ w: (contentW - 16) / 2, h }, { w: (contentW - 16) / 2, h }]
            : def.imageLayout === 'triple-top'
            ? [{ w: contentW * 0.62, h }, { w: contentW * 0.38 - 14, h: (h - 14) / 2 }, { w: contentW * 0.38 - 14, h: (h - 14) / 2 }]
            : [{ w: contentW, h }]
        imageBgSizesPx = boxes.map((box, slot) =>
          computeCoverPx(f.imageNaturalWs[slot], f.imageNaturalHs[slot], box.w, box.h, f.imageZooms[slot] ?? 100))
      }
      const body = def.isCTA
        ? `${f.body}${f.ctaWord ? ' || ' + f.ctaWord.toUpperCase() : ''}`
        : f.body
      return {
        id: 'tpl-' + i,
        index: i + 1,
        background: def.background,
        tag: def.hasTag ? f.tag : '',
        title: f.title,
        titleSize: f.titleSize || 0,
        subtitle: f.subtitle,
        subtitleSize: f.subtitleSize || 0,
        body,
        image: def.hasImage ? f.image : undefined,
        hideImage: f.hideImage || undefined,
        images: def.imageLayout && def.imageLayout !== 'none' ? f.images.filter((x): x is string => !!x) : undefined,
        imageZooms: def.imageLayout && def.imageLayout !== 'none' ? f.imageZooms : undefined,
        imagePositions: def.imageLayout && def.imageLayout !== 'none' ? f.imagePositions : undefined,
        imageMirrors: def.imageLayout && def.imageLayout !== 'none' ? f.imageMirrors : undefined,
        imageLayout: def.style === 'step-guide' ? (f.imageBelow ? 'bottom' : 'top') : def.imageLayout,
        style: def.style,
        imagePosition: f.imagePosition,
        imageZoom: f.imageZoom,
        bodySize: f.bodySize || undefined,
        fontFamilyHead: f.fontFamilyHead || undefined,
        fontFamilyBody: f.fontFamilyBody || undefined,
        titleColor: f.titleColor || undefined,
        bodyColor: f.bodyColor || undefined,
        titleWeight: f.titleWeight || undefined,
        bodyWeight: f.bodyWeight || undefined,
        titleLineHeight: f.titleLineHeight || undefined,
        bodyLineHeight: f.bodyLineHeight || undefined,
        gradientOn: f.gradientOn || undefined,
        gradientColor: f.gradientColor || undefined,
        gradientDir: f.gradientDir || undefined,
        gradientExtent: f.gradientExtent,
        imageBgSizePx,
        imageBgSizesPx,
        imageNaturalW: f.imageNaturalW || undefined,
        imageNaturalH: f.imageNaturalH || undefined,
        imageNaturalWs: f.imageNaturalWs?.length ? f.imageNaturalWs : undefined,
        imageNaturalHs: f.imageNaturalHs?.length ? f.imageNaturalHs : undefined,
        imageMirror: f.imageMirror,
        imageHeight: f.imageHeight || undefined,
        imageOpacity: 100,
        overlayStyle: '',
        overlayOpacity: 0,
        bgColor: def.background !== 'cover' ? f.slideBg : '',
        textAnchor: f.textAnchor,
        textAlign: f.textAlign || undefined,
        avatarSize: f.avatarSizeOverride || undefined,
        handleSize: f.handleSizeOverride || undefined,
        handleColor: f.handleColorOverride || undefined,
        bgPattern: '',
        textLayout: '',
        marginH: f.marginH || 176,
        marginV: f.marginV || 0,
        blockGap: f.blockGap || undefined,
        highlights: f.highlights,
      }
    })
    return {
      id: 'preview',
      title: carouselTitle || template.name,
      profileId: profileId,
      templateId: template.id,
      briefing: {
        profileId: profileId, mode: 'content', input: '', niche: handle, displayName: displayName || undefined,
        primaryColor, primaryColors: primaryColors.length > 1 ? primaryColors : undefined, visualStyle: 'minimal', carouselType: 'tese',
        cta: '', slideCount: slides.length as 5 | 7 | 9 | 12, imageCount: 0, accentColor: primaryColor,
        fontHeadline: '', fontBody: '', avatarImage, brandText, brandPosition,
        brandTextColor: brandTextColor || undefined, brandTextSize: brandTextSize || undefined, brandTextFont: brandTextFont || undefined,
        dotSize: dotSize !== 9 ? dotSize : undefined, dotsVisible: dotsVisible ? undefined : false,
        avatarSize, handleSize, handleColor: handleColor || undefined, verifiedBadge,
      },
      content: {
        triagem: '', eixo: '', funil: '',
        headlines: [], selectedHeadline: 0,
        spine: { headline: '', hook: '', mechanism: '', proof: '', application: '', direction: '' },
        slides, caption,
      },
      visualStyle: 'minimal',
      status: 'editing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }, [fields, handle, displayName, primaryColor, primaryColors, avatarImage, brandText, brandPosition, brandTextColor, brandTextSize, brandTextFont, dotSize, dotsVisible, avatarSize, handleSize, handleColor, verifiedBadge, carouselTitle, profileId, template, slideDefs, caption])

  // O iframe do preview monta uma vez só e recebe atualizações por postMessage (troca só
  // o conteúdo por dentro, sem recarregar o documento) — por isso dá pra ser 100% ao vivo,
  // a cada pixel arrastado, sem piscar.
  const slideHTML = (i: number) => carousel ? generateSlideHTML(carousel, carousel.content.slides[i]) : ''
  const slideBodyHTML = (i: number) => carousel ? generateSlideInner(carousel, carousel.content.slides[i]) : ''

  // As variáveis de cor (--P etc) ficam no <head>, que o postMessage não substitui —
  // por isso mandamos elas separado, direto pro CSS do iframe, sempre que a cor mudar.
  const cssVars = useMemo(() => {
    const p = derivePalette(primaryColors.length > 1 ? primaryColors : (primaryColor || '#A8573C'))
    return { '--P': p.P, '--PS': p.PS, '--PL': p.PL, '--PD': p.PD, '--LB': p.LB, '--DB': p.DB, '--LR': p.LR, '--G': p.G }
  }, [primaryColor, primaryColors])

  // Salva (cria ou atualiza, reusando o mesmo id) e devolve o id salvo — usado tanto
  // pelo botão "Salvar" quanto pelo "Baixar" (que precisa salvar antes de exportar).
  const salvarERetornarId = async (): Promise<string | null> => {
    if (!carousel) return null
    if (!carouselTitle.trim()) {
      setTitleMissing(true)
      titleInputRef.current?.focus()
      setTimeout(() => setTitleMissing(false), 2000)
      return null
    }
    setSaving(true)
    const res = await fetch('/api/carousels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...carousel, id: savedId || undefined }),
    })
    const saved = await res.json()
    setSavedId(saved.id)
    setSaving(false)
    return saved.id
  }

  const salvar = async () => {
    const id = await salvarERetornarId()
    if (id) {
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    }
  }

  const baixar = async () => {
    const id = await salvarERetornarId()
    if (!id) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/carousels/${id}/export`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Erro ao exportar o carrossel.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(carouselTitle || 'carrossel').replace(/[^a-z0-9]/gi, '-')}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (loadError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ color: 'var(--muted)' }}>
        <p style={{ color: '#e08a8a' }}>Erro ao carregar modelo: {loadError}</p>
        <Link href="/templates" className="text-sm underline">Voltar pros modelos</Link>
      </div>
    )
  }
  if (loading || !template || !carousel) {
    return <div className="h-screen flex items-center justify-center" style={{ color: 'var(--muted)' }}>Carregando modelo…</div>
  }

  const def = slideDefs[active]
  const f = fields[active]

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto flex-nowrap" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex-shrink-0"><ArrowLeft size={18} style={{ color: 'var(--muted)' }}/></Link>
        <input ref={titleInputRef} value={carouselTitle} onChange={e => { setCarouselTitle(e.target.value); setTitleMissing(false) }}
          placeholder="Nome do carrossel"
          className="font-bold text-sm px-2.5 py-1.5 rounded-lg flex-shrink-0"
          style={{ background: 'var(--bg3)', border: `1px solid ${titleMissing ? '#e05252' : 'var(--border)'}`, width: 150 }}/>
        <div className="w-px h-6 flex-shrink-0" style={{ background: 'var(--border)' }}/>
        <select value={profileId} onChange={e => aplicarPerfil(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-sm flex-shrink-0" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', maxWidth: 150 }}>
          <option value="">Sem perfil</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="w-px h-6 flex-shrink-0" style={{ background: 'var(--border)' }}/>
        <div className="relative flex-shrink-0">
          <button onClick={() => setPerfilBlockOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: perfilBlockOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: perfilBlockOpen ? 'var(--accent2)' : 'var(--muted)', border: perfilBlockOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            Dados do perfil <ChevronRight size={12} style={{ transform: perfilBlockOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
          </button>
          {perfilBlockOpen && (
            <div className="fixed left-4 top-16 p-5 rounded-2xl overflow-y-auto z-50"
              style={{ width: 400, maxHeight: 'calc(100vh - 96px)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Dados do perfil</h3>
                <button onClick={() => setPerfilBlockOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Handle</label>
                    <input value={handle} onChange={e => setHandle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Nome de exibição</label>
                    <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ex: Seu Nome"
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                  </div>
                </div>
                <p className="text-[10px] -mt-3" style={{ color: 'var(--muted)' }}>Nome preenchido mostra nome em negrito + @handle embaixo (estilo X/Twitter). Vazio = só o @handle, como hoje.</p>

                <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--muted)' }}>Avatar</p>
                  <div className="flex items-center gap-2">
                    {avatarImage && <img src={avatarImage} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>}
                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
                      style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                      <Upload size={13}/> {avatarImage ? 'Trocar' : 'Enviar foto'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])}/>
                    </label>
                    {avatarImage && (
                      <button onClick={() => setAvatarImage(undefined)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--muted)' }}><X size={14}/></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <SliderField label="Tamanho" value={avatarSize || 70} min={24} max={260} unit="px"
                      onChange={v => setAvatarSize(v)}/>
                    <SliderField label="Tamanho do texto" value={handleSize || 30} min={16} max={56} unit="px"
                      onChange={v => setHandleSize(v)}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 items-end">
                    <div>
                      <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Cor do texto do perfil</label>
                      <div className="flex items-center gap-1 mt-1">
                        <ColorInput value={handleColor || '#111111'} onChange={setHandleColor} size={32}/>
                        {handleColor && (
                          <button onClick={() => setHandleColor('')} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setVerifiedBadge(v => !v)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg h-9"
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Selo</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2"
                        style={{ background: verifiedBadge ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', color: verifiedBadge ? 'var(--accent2)' : 'var(--muted)' }}>
                        {verifiedBadge ? 'Sim' : 'Não'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--muted)' }}>Cor da marca</p>
                  <BrandColorField label="" color={primaryColor} colors={primaryColors}
                    onColorChange={setPrimaryColor} onColorsChange={setPrimaryColors}/>
                </div>

                <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--muted)' }}>Rodapé de marca</p>
                  <input value={brandText} onChange={e => setBrandText(e.target.value)}
                    placeholder="Ex: Powered by Claude Viral"
                    className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                  {brandText && (
                    <>
                      <div className="flex gap-1 mt-2">
                        {(['tl', 'tr', 'bl', 'br'] as const).map(p => (
                          <button key={p} onClick={() => setBrandPosition(p)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                            style={{ background: brandPosition === p ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: brandPosition === p ? 'var(--accent2)' : 'var(--muted)', border: brandPosition === p ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                            {p === 'tl' ? 'Sup. esq.' : p === 'tr' ? 'Sup. dir.' : p === 'bl' ? 'Inf. esq.' : 'Inf. dir.'}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <ColorInput value={brandTextColor || '#26221f'} onChange={setBrandTextColor} size={32}/>
                        <select value={brandTextFont} onChange={e => setBrandTextFont(e.target.value)}
                          className="flex-1 px-2 py-2 rounded-lg text-xs" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                          <option value="">Fonte padrão</option>
                          {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                        </select>
                      </div>
                      <div className="mt-2">
                        <SliderField label="Tamanho" value={brandTextSize} min={9} max={28} unit="px"
                          onChange={setBrandTextSize}/>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--muted)' }}>Bolinhas de progresso</p>
                  <button onClick={() => setDotsVisible(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Mostrar bolinhas</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: dotsVisible ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', color: dotsVisible ? 'var(--accent2)' : 'var(--muted)' }}>
                      {dotsVisible ? 'Sim' : 'Não'}
                    </span>
                  </button>
                  {dotsVisible && (
                    <SliderField label="Tamanho" value={dotSize} min={4} max={20} unit="px"
                      onChange={setDotSize}/>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button ref={bulkBtnRef} onClick={() => bulkOpen ? setBulkOpen(false) : openBelow(bulkBtnRef, setBulkPos, setBulkOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: bulkOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: bulkOpen ? 'var(--accent2)' : 'var(--muted)', border: bulkOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <ClipboardPaste size={13}/> Colar todo o conteúdo
          </button>
          {bulkOpen && (
            <div className="fixed p-4 space-y-2 rounded-2xl overflow-y-auto z-50"
              style={{ top: bulkPos.top, left: bulkPos.left, width: 400, maxHeight: 'calc(100vh - 96px)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Colar todo o conteúdo</h3>
                <button onClick={() => setBulkOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{bulkInstructions(slideDefs).hint}</p>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8}
                placeholder={bulkInstructions(slideDefs).placeholder}
                className="w-full px-3 py-2 rounded-lg text-xs resize-none" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
              <button onClick={() => distribuirConteudo()}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-black" style={{ background: 'var(--grad)' }}>
                Distribuir nos {slideDefs.length} slides
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setIgPreviewOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <Smartphone size={13}/> Ver no Instagram
        </button>
        <div className="relative">
          <button ref={batchImgBtnRef}
            onClick={() => batchImgOpen ? setBatchImgOpen(false) : openBelow(batchImgBtnRef, setBatchImgPos, setBatchImgOpen)}
            disabled={batchImgBusy || (!batchImgOpen && pendingImageSlides().length === 0)}
            title={pendingImageSlides().length === 0 ? 'Todos os slides com bloco de imagem já têm imagem' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-50"
            style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
            <Sparkles size={13}/> {batchImgBusy ? batchImgProgress : `Gerar imagens${pendingImageSlides().length ? ` (${pendingImageSlides().length})` : ''}`}
          </button>
          {batchImgOpen && (
            <div className="fixed p-4 space-y-3 rounded-2xl z-50"
              style={{ top: batchImgPos.top, left: batchImgPos.left, width: 320, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Gerar imagens com IA</h3>
                <button onClick={() => setBatchImgOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {pendingImageSlides().length} slide(s) têm bloco de imagem ligado mas ainda estão sem imagem. Vou gerar um prompt e uma imagem pra cada, um de cada vez (não em paralelo).
              </p>
              <p className="text-[11px] px-2.5 py-2 rounded-lg" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                Não precisa fazer isso agora — você pode deixar sem imagem e gerar/enviar depois, slide por slide.
              </p>
              <button onClick={() => { setBatchImgOpen(false); gerarTodasImagens() }}
                disabled={pendingImageSlides().length === 0}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                style={{ background: 'var(--grad)', color: '#000' }}>
                Confirmar e gerar {pendingImageSlides().length} imagem(ns)
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <button ref={captionBtnRef} onClick={() => captionOpen ? setCaptionOpen(false) : openBelow(captionBtnRef, setCaptionPos, setCaptionOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: captionOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: captionOpen ? 'var(--accent2)' : 'var(--muted)', border: captionOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <Sparkles size={13}/> Gerar legenda
          </button>
          {captionOpen && (
            <div className="fixed p-4 space-y-2.5 rounded-2xl overflow-y-auto z-50"
              style={{ top: captionPos.top, left: captionPos.left, width: 400, maxHeight: 'calc(100vh - 96px)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Gerar legenda</h3>
                <button onClick={() => setCaptionOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Baseada só no que já está escrito nos slides — hook, corpo curto e CTA.</p>
              <button onClick={gerarLegenda} disabled={captionLoading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
                <Sparkles size={13}/> {captionLoading ? 'Gerando legenda…' : caption ? 'Gerar de novo' : 'Gerar legenda com IA'}
              </button>
              {captionError && <p className="text-[11px]" style={{ color: '#ff8080' }}>{captionError}</p>}
              {caption && (
                <>
                  <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={10}
                    className="w-full px-3 py-2 rounded-lg text-xs resize-none" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                  <button onClick={copiarLegenda}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {captionCopied ? <><Check size={13}/> Copiado</> : <><Copy size={13}/> Copiar legenda</>}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <button ref={switchBtnRef} onClick={() => switchPickerOpen ? setSwitchPickerOpen(false) : openBelow(switchBtnRef, setSwitchPos, setSwitchPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: switchPickerOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: switchPickerOpen ? 'var(--accent2)' : 'var(--muted)', border: switchPickerOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <Copy size={13}/> Trocar modelo <ChevronRight size={12} style={{ transform: switchPickerOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
          </button>
          {switchPickerOpen && (
            <div className="fixed p-3 space-y-1 rounded-2xl overflow-y-auto z-50" style={{ top: switchPos.top, left: switchPos.left, width: 300, maxHeight: 'calc(100vh - 96px)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between px-1 mb-1">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Trocar modelo</h3>
                <button onClick={() => setSwitchPickerOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-[11px] px-1 mb-1" style={{ color: 'var(--muted)' }}>Troca pra outro modelo mantendo o texto e as imagens que já foram preenchidos.</p>
              {allTemplates.map(t => (
                <button key={t.id} onClick={() => { setSwitchPickerOpen(false); trocarModelo(t.id) }}
                  disabled={t.id === templateId}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs disabled:opacity-40"
                  style={{ color: 'var(--text)', background: t.id === templateId ? 'var(--bg3)' : 'transparent' }}
                  onMouseOver={e => { if (t.id !== templateId) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseOut={e => { if (t.id !== templateId) e.currentTarget.style.background = 'transparent' }}>
                  <span className="font-semibold">{t.name}</span>
                  {t.id === templateId && <span style={{ color: 'var(--muted)' }}> · atual</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1"/>
        {savedMsg && <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#4ade80' }}>Salvo ✓</span>}
        <button onClick={baixar} disabled={downloading || saving}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <Download size={14}/> {downloading ? 'Gerando…' : 'Baixar'}
        </button>
        <button onClick={salvar} disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-black whitespace-nowrap flex-shrink-0"
          style={{ background: 'var(--grad)' }}>
          <Save size={14}/> {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {profiles.length === 0 && !profileId && (
        <p className="text-[11px] px-5 py-1.5" style={{ color: 'var(--muted)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          Nenhum perfil salvo ainda — <Link href="/profiles" className="underline">crie um</Link> pra reutilizar handle/cor/avatar sem preencher toda vez.
        </p>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Formulário do slide ativo */}
        <div className="w-96 flex-shrink-0 overflow-auto p-6 space-y-4" style={{ borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-base">{def.label}</h2>
            <button onClick={() => setSwapPickerOpen(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              <Copy size={11}/> Trocar estrutura
            </button>
          </div>
          {swapPickerOpen && (
            <div className="mb-3 p-2 rounded-xl space-y-1" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] px-1 mb-1" style={{ color: 'var(--muted)' }}>Usar o formato de qual modelo do catálogo?</p>
              {estruturasDisponiveis.map((d, i) => (
                <button key={i} onClick={() => trocarEstrutura(active, d)}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg text-xs"
                  style={{ color: 'var(--text)' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <Copy size={12}/> {d.label}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Preenche o texto — a posição já é fixa, o preview atualiza sozinho.</p>

          {hlQueue.length > 0 && (
            <div className="mb-4 p-2.5 rounded-xl space-y-2" style={{ background: 'var(--bg2)', border: '1px solid var(--accent)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold" style={{ color: 'var(--muted)' }}>{hlQueue.length} palavra(s) na fila de destaque</p>
                <button onClick={() => setHlQueue([])} className="text-[10px]" style={{ color: 'var(--muted)' }}>Limpar</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hlQueue.map(w => (
                  <span key={w} className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px]" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    {w}
                    <button onClick={() => removeFromQueue(w)} style={{ color: 'var(--muted)' }}><X size={10}/></button>
                  </span>
                ))}
              </div>
              <SelectionToolbar text={`aplicar em ${hlQueue.length}`} style={selStyle}
                onToggle={toggleSelStyle}
                onColor={applyQueuedHighlights} onCancel={() => setHlQueue([])}/>
            </div>
          )}

          {def.hasImage && (
          <AccordionSection title="Imagem de Fundo" icon={<ImageIcon size={16}/>}
            onReset={() => resetFields(active, ['image', 'images', 'hideImage', 'imageBelow', 'imagePosition', 'imageZoom', 'imageMirror', 'imagePositions', 'imageZooms', 'imageMirrors', 'imageHeight'])}>
          {def.imageLayout && def.imageLayout !== 'none' && (
            <button onClick={() => updateField(active, { hideImage: !f.hideImage })}
              className="w-full flex items-center justify-between px-1 py-1 mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Bloco de imagem nesse slide</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: !f.hideImage ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: !f.hideImage ? 'var(--accent2)' : 'var(--muted)' }}>
                {f.hideImage ? 'Removido — só texto' : 'Ligado'}
              </span>
            </button>
          )}
          {!f.hideImage && def.style === 'step-guide' && (
            <div className="mb-2">
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Posição da imagem</label>
              <div className="flex gap-1 mt-1">
                <button onClick={() => updateField(active, { imageBelow: false })}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                  style={{ background: !f.imageBelow ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: !f.imageBelow ? 'var(--accent2)' : 'var(--muted)', border: !f.imageBelow ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  Em cima do texto
                </button>
                <button onClick={() => updateField(active, { imageBelow: true })}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                  style={{ background: f.imageBelow ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.imageBelow ? 'var(--accent2)' : 'var(--muted)', border: f.imageBelow ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                  Embaixo do texto
                </button>
              </div>
            </div>
          )}
          {f.hideImage ? null : def.imageLayout && def.imageLayout !== 'none' ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                {IMG_COUNT[def.imageLayout] > 1 ? `Imagens (${IMG_COUNT[def.imageLayout]})` : 'Imagem'}
              </label>
              {Array.from({ length: IMG_COUNT[def.imageLayout] || 1 }).map((_, slot) => (
                <div key={slot} className="p-2 rounded-xl space-y-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 px-3 py-4 rounded-xl text-sm cursor-pointer"
                      style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                      <Upload size={14}/> {f.images[slot] ? `Trocar imagem ${slot + 1}` : `Enviar imagem ${slot + 1}`}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImageAt(active, slot, e.target.files[0])}/>
                    </label>
                    {f.images[slot] && (
                      <button onClick={() => removeImgSlot(active, slot)} className="p-2 rounded-lg flex-shrink-0" style={{ color: '#e08a8a' }}><X size={14}/></button>
                    )}
                  </div>
                  {f.images[slot] && (
                    <>
                      <img src={f.images[slot]} alt="" className="w-full h-20 object-cover rounded-lg"/>
                      <SliderField label="Zoom" value={f.imageZooms[slot] ?? 100} min={100} max={250}
                        onChange={v => updateImgSlotZoom(active, slot, v)} unit="%"/>
                      <SliderField label="Posição X" value={f.imagePositions[slot]?.x ?? 50} min={0} max={100}
                        onChange={v => updateImgSlotPos(active, slot, 'x', v)} unit="%"/>
                      <SliderField label="Posição Y" value={f.imagePositions[slot]?.y ?? 50} min={0} max={100}
                        onChange={v => updateImgSlotPos(active, slot, 'y', v)} unit="%"/>
                      <button onClick={() => toggleImgSlotMirror(active, slot)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                        style={{ background: f.imageMirrors[slot] ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.imageMirrors[slot] ? 'var(--accent2)' : 'var(--muted)', border: f.imageMirrors[slot] ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                        <FlipHorizontal2 size={12}/> Espelhar
                      </button>
                    </>
                  )}
                </div>
              ))}
              <SliderField label="Altura do bloco de imagem" value={f.imageHeight || (def.imageLayout === 'double-bottom' ? 340 : def.imageLayout === 'triple-top' ? 400 : 480)}
                min={150} max={700} step={10} unit="px"
                onChange={v => updateField(active, { imageHeight: v })}/>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{def.background === 'cover' ? 'Imagem de fundo' : 'Imagem'}</label>
                {f.image && (
                  <button onClick={() => removeImage(active)}
                    className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#e08a8a' }}>
                    <X size={12}/> Excluir
                  </button>
                )}
              </div>
              <label className="mt-1 flex items-center justify-center gap-2 px-3 py-6 rounded-xl text-sm cursor-pointer"
                style={{ background: 'var(--bg2)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                <Upload size={16}/> {f.image ? 'Trocar imagem' : 'Enviar imagem'}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(active, e.target.files[0])}/>
              </label>
              {f.image && <img src={f.image} alt="" className="mt-2 w-full h-24 object-cover rounded-lg"/>}
              {f.image && (
                <div className="mt-2 space-y-2">
                  <SliderField label="Zoom" value={f.imageZoom} min={100} max={250} unit="%"
                    onChange={v => updateField(active, { imageZoom: v })}/>
                  <SliderField label="Posição X" value={f.imagePosition.x} min={0} max={100} unit="%"
                    onChange={v => updateField(active, { imagePosition: { ...f.imagePosition, x: v } })}/>
                  <SliderField label="Posição Y" value={f.imagePosition.y} min={0} max={100} unit="%"
                    onChange={v => updateField(active, { imagePosition: { ...f.imagePosition, y: v } })}/>
                  <button onClick={() => updateField(active, { imageMirror: !f.imageMirror })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.imageMirror ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', color: f.imageMirror ? 'var(--accent2)' : 'var(--muted)', border: f.imageMirror ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    <FlipHorizontal2 size={12}/> Espelhar imagem
                  </button>
                </div>
              )}
            </div>
          )}

          {!f.hideImage && (
            <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex gap-1.5">
                <button onClick={() => gerarPromptImagem(active)} disabled={imgPromptLoading[active]}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                  style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
                  <Sparkles size={13}/> {imgPromptLoading[active] ? 'Gerando…' : 'Gerar prompt'}
                </button>
                <button onClick={() => gerarImagemAgora(active)} disabled={imgGenLoading[active] || imgPromptLoading[active]}
                  title={!geminiConfigured ? 'Precisa da API key do Gemini em Configurações' : undefined}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                  style={{ background: 'var(--grad)', color: '#000' }}>
                  <Sparkles size={13}/> {imgGenLoading[active] ? 'Gerando…' : 'Gerar imagem com IA'}
                </button>
              </div>
              {imgPromptError[active] && (
                <p className="text-[10px]" style={{ color: '#ff8080' }}>{imgPromptError[active]}</p>
              )}
              {imgPromptText[active] && (
                <div className="p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text)' }}>{imgPromptText[active]}</p>
                  <button onClick={() => copiarPromptImagem(active)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {imgPromptCopied[active] ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar prompt</>}
                  </button>
                  {!geminiConfigured && (
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      Cola esse prompt em qualquer ferramenta de imagem (ChatGPT, Gemini...), ou configure sua API key do Gemini em <Link href="/settings" className="underline">Configurações</Link> pra gerar direto aqui.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          </AccordionSection>
          )}

          {def.hasImage && (f.image || f.images.some(Boolean)) && (
            <AccordionSection title="Sombra / Degradê" icon={<Layers size={16}/>}
              onReset={() => resetFields(active, ['gradientOn', 'gradientColor', 'gradientDir', 'gradientExtent'])}>
              <button onClick={() => updateField(active, { gradientOn: !f.gradientOn })}
                className="w-full flex items-center justify-between px-1 py-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Degradê na imagem</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: f.gradientOn ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.gradientOn ? 'var(--accent2)' : 'var(--muted)' }}>
                  {f.gradientOn ? 'Ligado' : 'Desligado'}
                </span>
              </button>
              {f.gradientOn && (
                <div className="mt-2 space-y-2 px-1 pb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] flex-shrink-0" style={{ color: 'var(--muted)' }}>Cor</label>
                    <ColorInput value={f.gradientColor} onChange={v => updateField(active, { gradientColor: v })} size={32}/>
                    <div className="flex gap-1 flex-1">
                      {(['top', 'bottom', 'left', 'right'] as const).map(dir => (
                        <button key={dir} onClick={() => updateField(active, { gradientDir: dir })}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: f.gradientDir === dir ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.gradientDir === dir ? 'var(--accent2)' : 'var(--muted)', border: f.gradientDir === dir ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                          {dir === 'top' ? 'De cima' : dir === 'bottom' ? 'De baixo' : dir === 'left' ? 'Esq.' : 'Dir.'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SliderField label="Até onde sobe" value={f.gradientExtent} min={10} max={100} unit="%"
                    onChange={v => updateField(active, { gradientExtent: v })}/>
                </div>
              )}
            </AccordionSection>
          )}

          {def.background !== 'cover' && (
            <AccordionSection title="Fundo do Slide" icon={<Palette size={16}/>}
              onReset={() => resetFields(active, ['slideBg'])}>
              <p className="text-[10px] mb-1" style={{ color: 'var(--muted)' }}>Cor por trás do slide (só aparece onde não tem imagem cobrindo).</p>
              <div className="flex items-center gap-2">
                <ColorInput value={f.slideBg || (def.background === 'dark' ? '#0F0D0C' : '#F7F4F1')} onChange={v => updateField(active, { slideBg: v })} size={32}/>
                {f.slideBg && (
                  <button onClick={() => updateField(active, { slideBg: '' })}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <X size={12}/> Usar padrão ({def.background === 'dark' ? 'escuro' : 'claro'})
                  </button>
                )}
              </div>
            </AccordionSection>
          )}

          <AccordionSection title="Texto & Conteúdo" icon={<FileText size={16}/>}>
            {def.hasTag && (
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Tag (rótulo pequeno)</label>
                <input value={f.tag} onChange={e => updateField(active, { tag: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{def.background === 'cover' ? 'Headline (capa)' : def.isCTA ? 'Headline do CTA' : !def.hasBody ? 'Texto' : 'Título'}</label>
              <textarea value={f.title} onChange={e => updateField(active, { title: e.target.value })}
                onSelect={handleSelect('title')} onMouseUp={handleSelect('title')} onKeyUp={handleSelect('title')}
                rows={def.hasBody ? 2 : 6}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
              {textSel?.field === 'title' && textSel.source === 'field' && (
                <SelectionToolbar text={textSel.text} style={selStyle}
                  onToggle={toggleSelStyle}
                  onColor={applySelectionHighlight} onCancel={() => setTextSel(null)} onQueue={queueSelection}/>
              )}
            </div>

            {def.background === 'cover' && (
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Subheadline</label>
                <textarea value={f.subtitle} onChange={e => updateField(active, { subtitle: e.target.value })}
                  onSelect={handleSelect('subtitle')} onMouseUp={handleSelect('subtitle')} onKeyUp={handleSelect('subtitle')}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
                {textSel?.field === 'subtitle' && textSel.source === 'field' && (
                  <SelectionToolbar text={textSel.text} style={selStyle}
                    onToggle={toggleSelStyle}
                    onColor={applySelectionHighlight} onCancel={() => setTextSel(null)} onQueue={queueSelection}/>
                )}
                {def.style === 'editorial-serif' && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>**negrito** e __palavra verde__</p>
                )}
              </div>
            )}

            {def.hasBody && !def.isCTA && (
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Corpo</label>
                <textarea value={f.body} onChange={e => updateField(active, { body: e.target.value })}
                  onSelect={handleSelect('body')} onMouseUp={handleSelect('body')} onKeyUp={handleSelect('body')}
                  rows={5}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
                {textSel?.field === 'body' && textSel.source === 'field' && (
                  <SelectionToolbar text={textSel.text} style={selStyle}
                    onToggle={toggleSelStyle}
                    onColor={applySelectionHighlight} onCancel={() => setTextSel(null)} onQueue={queueSelection}/>
                )}
                {def.style === 'editorial-serif' && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>Linha em branco = novo parágrafo. **negrito** e __palavra verde__</p>
                )}
              </div>
            )}

            {def.isCTA && (
              <>
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Frase-ponte</label>
                  <textarea value={f.body} onChange={e => updateField(active, { body: e.target.value })} rows={3}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Palavra-chave (comenta X)</label>
                  <input value={f.ctaWord} onChange={e => updateField(active, { ctaWord: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg text-sm uppercase" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
                </div>
              </>
            )}
          </AccordionSection>

          <AccordionSection title="Tipografia" icon={<Type size={16}/>}
            onReset={() => resetFields(active, ['fontFamilyHead', 'fontFamilyBody', 'titleColor', 'bodyColor', 'titleSize', 'bodySize', 'titleWeight', 'bodyWeight', 'titleLineHeight', 'bodyLineHeight', 'textAlign'])}>
            <div>
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Alinhamento do texto (título e corpo)</label>
              <div className="flex gap-1 mt-1">
                {(['left', 'center', 'right', 'justify'] as const).map(a => (
                  <button key={a} onClick={() => updateField(active, { textAlign: a })}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.textAlign === a ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.textAlign === a ? 'var(--accent2)' : 'var(--muted)', border: f.textAlign === a ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    {a === 'left' ? 'Esquerda' : a === 'center' ? 'Centro' : a === 'right' ? 'Direita' : 'Justificado'}
                  </button>
                ))}
              </div>
            </div>
            <FieldGroup label="Título">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Fonte</label>
                  <select value={f.fontFamilyHead} onChange={e => updateField(active, { fontFamilyHead: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <option value="">Padrão</option>
                    {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor</label>
                  <div className="flex items-center gap-1 mt-1">
                    <ColorInput value={f.titleColor || '#161311'} onChange={v => updateField(active, { titleColor: v })} size={32}/>
                    {f.titleColor && (
                      <button onClick={() => updateField(active, { titleColor: '' })} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                    )}
                  </div>
                </div>
              </div>
              <SliderField label="Tamanho" value={f.titleSize || (def.background === 'cover' ? 78 : 56)} min={24} max={130} unit="px"
                onChange={v => updateField(active, { titleSize: v })}/>
              <SliderField label="Espessura" value={f.titleWeight || 700} min={200} max={800} step={100}
                onChange={v => updateField(active, { titleWeight: v })}/>
              <SliderField label="Entre linhas" value={f.titleLineHeight || 1.3} min={0.9} max={2.2} step={0.05}
                onChange={v => updateField(active, { titleLineHeight: v })}/>
            </FieldGroup>
            {def.hasBody && (
            <FieldGroup label="Corpo">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Fonte</label>
                  <select value={f.fontFamilyBody} onChange={e => updateField(active, { fontFamilyBody: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <option value="">Padrão</option>
                    {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor</label>
                  <div className="flex items-center gap-1 mt-1">
                    <ColorInput value={f.bodyColor || '#2a2a2a'} onChange={v => updateField(active, { bodyColor: v })} size={32}/>
                    {f.bodyColor && (
                      <button onClick={() => updateField(active, { bodyColor: '' })} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                    )}
                  </div>
                </div>
              </div>
              <SliderField label="Tamanho" value={f.bodySize || 30} min={14} max={50} unit="px"
                onChange={v => updateField(active, { bodySize: v })}/>
              <SliderField label="Espessura" value={f.bodyWeight || 400} min={200} max={800} step={100}
                onChange={v => updateField(active, { bodyWeight: v })}/>
              <SliderField label="Entre linhas" value={f.bodyLineHeight || 1.5} min={0.9} max={2.2} step={0.05}
                onChange={v => updateField(active, { bodyLineHeight: v })}/>
            </FieldGroup>
            )}
            {def.background === 'cover' && (
            <FieldGroup label="Subheadline">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Fonte</label>
                  <select value={f.fontFamilyBody} onChange={e => updateField(active, { fontFamilyBody: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <option value="">Padrão</option>
                    {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor</label>
                  <div className="flex items-center gap-1 mt-1">
                    <ColorInput value={f.bodyColor || '#ffffff'} onChange={v => updateField(active, { bodyColor: v })} size={32}/>
                    {f.bodyColor && (
                      <button onClick={() => updateField(active, { bodyColor: '' })} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                    )}
                  </div>
                </div>
              </div>
              <SliderField label="Tamanho" value={f.subtitleSize || 20} min={12} max={60} unit="px"
                onChange={v => updateField(active, { subtitleSize: v })}/>
              <SliderField label="Espessura" value={f.bodyWeight || 500} min={200} max={800} step={100}
                onChange={v => updateField(active, { bodyWeight: v })}/>
              <SliderField label="Entre linhas" value={f.bodyLineHeight || 1.4} min={0.9} max={2.2} step={0.05}
                onChange={v => updateField(active, { bodyLineHeight: v })}/>
            </FieldGroup>
            )}
          </AccordionSection>

          <AccordionSection title="Layout do Texto" icon={<MoveVertical size={16}/>}
            onReset={() => resetFields(active, ['marginH', 'marginV', 'blockGap', 'textAnchor'])}>
            <div>
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Posição do texto no slide</label>
              <div className="flex gap-1 mt-1">
                {(['top', 'center', 'bottom'] as const).map(a => (
                  <button key={a} onClick={() => updateField(active, { textAnchor: a })}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.textAnchor === a ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.textAnchor === a ? 'var(--accent2)' : 'var(--muted)', border: f.textAnchor === a ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    {a === 'top' ? 'Em cima' : a === 'center' ? 'No meio' : 'Embaixo'}
                  </button>
                ))}
              </div>
            </div>
            <SliderField label="Lateral" value={f.marginH || 176} min={20} max={220} step={4} unit="px"
              onChange={v => updateField(active, { marginH: v })}/>
            <SliderField label="Topo extra" value={f.marginV || 0} min={-100} max={200} step={4} unit="px"
              onChange={v => updateField(active, { marginV: v })}/>
            <SliderField label="Entre blocos" value={f.blockGap || 24} min={0} max={100} step={2} unit="px"
              onChange={v => updateField(active, { blockGap: v })}/>
          </AccordionSection>

          <AccordionSection title="Destaques & Formatação" icon={<Highlighter size={16}/>}
            onReset={() => resetFields(active, ['highlights'])}>
            <p className="text-[10px] mb-2" style={{ color: 'var(--muted)' }}>Clica na palavra pra marcar (some na fila de destaque aqui em cima — escolhe a cor lá). Pra destacar uma frase inteira, usa o campo manual embaixo.</p>
            {wordsOf(f).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {wordsOf(f).map(w => {
                  const already = hlQueue.includes(w) || f.highlights.some(h => h.word.toLowerCase() === w.toLowerCase())
                  return (
                    <button key={w} onClick={() => setHlQueue(prev => prev.includes(w) ? prev : [...prev, w])}
                      disabled={already}
                      className="px-2.5 py-1 rounded-full text-xs disabled:opacity-50"
                      style={{ background: already ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', border: already ? '1px solid var(--accent)' : '1px solid var(--border)', color: already ? 'var(--accent2)' : 'var(--text)' }}>
                      {w}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Destaques ativos</span>
              <button onClick={() => addHighlight(active)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                <Plus size={11}/> Frase manual
              </button>
            </div>
            <div className="space-y-2">
              {f.highlights.map((h, hi) => (
                <div key={hi} className="p-2 rounded-lg space-y-1.5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-1.5">
                    <input value={h.word} onChange={e => updateHighlight(active, hi, { word: e.target.value })}
                      placeholder="palavra ou frase" className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                    <HighlightColorField color={h.color} colors={h.colors} profileColor={primaryColors.length ? primaryColors[0] : primaryColor}
                      onChange={patch => updateHighlight(active, hi, patch)}/>
                    <button onClick={() => removeHighlight(active, hi)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select value={h.fontFamily || ''} onChange={e => updateHighlight(active, hi, { fontFamily: e.target.value || undefined })}
                      className="flex-1 min-w-0 px-1.5 py-1.5 rounded-lg text-[10px]" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <option value="">Fonte padrão</option>
                      {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                    <select value={h.weight || ''} onChange={e => updateHighlight(active, hi, { weight: e.target.value ? Number(e.target.value) : undefined })}
                      className="px-1.5 py-1.5 rounded-lg text-[10px] flex-shrink-0" style={{ width: 64, background: 'var(--bg3)', border: '1px solid var(--border)', color: h.weight ? 'var(--accent2)' : 'var(--muted)' }}>
                      <option value="">Peso</option>
                      {[300, 400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <button onClick={() => updateHighlight(active, hi, { underline: !h.underline })}
                      className="w-8 h-8 rounded-lg flex-shrink-0 text-xs font-bold flex items-center justify-center"
                      style={{ background: h.underline ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: h.underline ? 'var(--accent2)' : 'var(--muted)', border: h.underline ? '1px solid var(--accent)' : '1px solid var(--border)', textDecoration: 'underline' }}>
                      S
                    </button>
                    <button onClick={() => updateHighlight(active, hi, { italic: !h.italic })}
                      className="w-8 h-8 rounded-lg flex-shrink-0 text-xs font-bold italic flex items-center justify-center"
                      style={{ background: h.italic ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: h.italic ? 'var(--accent2)' : 'var(--muted)', border: h.italic ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      I
                    </button>
                    <button onClick={() => updateHighlight(active, hi, h.background ? { background: undefined } : { background: h.color, color: '#111111' })}
                      title="Tarja (fundo colorido)"
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ background: h.background ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', border: h.background ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      <Highlighter size={13} style={{ color: h.background ? 'var(--accent2)' : 'var(--muted)' }}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="Badge de Perfil (só esse slide)" icon={<Copy size={16}/>}
            onReset={() => resetFields(active, ['avatarSizeOverride', 'handleSizeOverride', 'handleColorOverride'])}>
            <p className="text-[10px] mb-1" style={{ color: 'var(--muted)' }}>Por padrão usa o tamanho/cor definidos em &quot;Dados do perfil&quot;. Ajuste aqui só se quiser diferente nesse slide.</p>
            <SliderField label="Tamanho do avatar" value={f.avatarSizeOverride || avatarSize} min={24} max={260} unit="px"
              onChange={v => updateField(active, { avatarSizeOverride: v })}/>
            <SliderField label="Tamanho do texto" value={f.handleSizeOverride || handleSize} min={16} max={56} unit="px"
              onChange={v => updateField(active, { handleSizeOverride: v })}/>
            <div>
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor do texto</label>
              <div className="flex items-center gap-1 mt-1">
                <ColorInput value={f.handleColorOverride || handleColor || '#111111'} onChange={v => updateField(active, { handleColorOverride: v })} size={32}/>
                {f.handleColorOverride && (
                  <button onClick={() => updateField(active, { handleColorOverride: '' })} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                )}
              </div>
            </div>
          </AccordionSection>
        </div>

        {/* Preview ao vivo — slide real é 1080x1350, escalado pra caber. Também dá pra
            selecionar o texto direto aqui (arrastando o mouse em cima) pra destacar.
            O painel de zoom fica fixo (não rola junto), e o conteúdo usa margin:auto em
            vez de justify-content:center — assim, com zoom alto, dá pra rolar até ver
            o slide inteiro em vez de cortar sem jeito de alcançar o resto. */}
        <div className="flex-1 relative overflow-auto flex flex-col items-center p-8" style={{ background: 'var(--bg-grad)' }}>
          <div className="flex flex-col items-center gap-3" style={{ margin: 'auto' }}>
            <ScaledSlide html={slideHTML(active)} bodyHtml={slideBodyHTML(active)} cssVars={cssVars}
              boxWidth={Math.round(450 * (previewZoom / 100))} boxHeight={Math.round(562 * (previewZoom / 100))} onTextSelect={handlePreviewSelect}/>
            {textSel?.source === 'preview' && (
              <div className="w-full" style={{ maxWidth: Math.round(450 * (previewZoom / 100)) }}>
                <SelectionToolbar text={textSel.text} style={selStyle}
                  onToggle={toggleSelStyle}
                  onColor={applySelectionHighlight} onCancel={() => setTextSel(null)} onQueue={queueSelection}/>
              </div>
            )}
          </div>
          <div className="sticky bottom-2 flex items-center gap-1 px-2 py-1.5 rounded-full" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            <button onClick={() => setPreviewZoom(z => Math.max(50, z - 25))} className="p-1.5 rounded-full hover:opacity-80" style={{ color: 'var(--muted)' }} title="Diminuir zoom">
              <ZoomOut size={14}/>
            </button>
            <button onClick={() => setPreviewZoom(100)} className="text-[11px] font-semibold w-11 text-center" style={{ color: 'var(--muted)' }} title="Redefinir zoom">
              {previewZoom}%
            </button>
            <button onClick={() => setPreviewZoom(z => Math.min(250, z + 25))} className="p-1.5 rounded-full hover:opacity-80" style={{ color: 'var(--muted)' }} title="Aumentar zoom">
              <ZoomIn size={14}/>
            </button>
          </div>
        </div>

        {/* Trilha de miniaturas — arrasta pra reordenar, X pra excluir, + no final pra adicionar */}
        <div className="w-56 flex-shrink-0 overflow-auto p-3 pb-16 space-y-3" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <button onClick={() => { setMultiSelect(v => !v); setSelected(new Set()) }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
            style={{ background: multiSelect ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: multiSelect ? 'var(--accent2)' : 'var(--muted)', border: multiSelect ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <Copy size={12}/> {multiSelect ? 'Sair da seleção' : 'Selecionar vários'}
          </button>
          {multiSelect && (
            <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
              {selected.size === 0 ? 'Marca os slides que quer alterar juntos' : `${selected.size} slide(s) selecionado(s) — qualquer ajuste vale pra todos eles`}
            </p>
          )}
          {slideDefs.map((_, i) => (
            <div key={i}
              draggable={!multiSelect}
              onDragStart={() => setDragIndex(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIndex !== null && dragIndex !== i) moverSlide(dragIndex, i); setDragIndex(null) }}
              onDragEnd={() => setDragIndex(null)}
              onClick={() => multiSelect ? toggleSelected(i) : setActive(i)}
              className="relative cursor-move rounded-lg overflow-hidden group"
              style={{ border: selected.has(i) ? '2px solid var(--accent)' : i === active ? '2px solid var(--accent)' : '1px solid var(--border)', opacity: dragIndex === i ? 0.4 : 1 }}>
              <ScaledSlide html={slideHTML(i)} bodyHtml={slideBodyHTML(i)} cssVars={cssVars} boxWidth={192} boxHeight={240} interactive={false} />
              {multiSelect && (
                <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: selected.has(i) ? 'var(--accent)' : 'rgba(0,0,0,0.55)', border: '1.5px solid #fff' }}>
                  {selected.has(i) && <Check size={12} className="text-black" strokeWidth={3}/>}
                </div>
              )}
              {!multiSelect && (
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); duplicarSlideAt(i) }}
                  title="Duplicar slide"
                  className="p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                  <Copy size={12}/>
                </button>
                {slideDefs.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); removerSlide(i) }}
                    title="Excluir slide"
                    className="p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                    <X size={12}/>
                  </button>
                )}
              </div>
              )}
            </div>
          ))}
          <button onClick={() => setAddPickerOpen(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-4 rounded-lg text-xs font-medium border border-dashed"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <Plus size={14}/> Adicionar
          </button>
          {addPickerOpen && (
            <div className="p-2 rounded-xl space-y-1" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] px-1 mb-1" style={{ color: 'var(--muted)' }}>Copiar estrutura de qual modelo do catálogo?</p>
              {estruturasDisponiveis.map((d, i) => (
                <button key={i} onClick={() => adicionarSlide(d)}
                  className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg text-xs"
                  style={{ color: 'var(--text)' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg2)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <Copy size={12}/> {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
      {igPreviewOpen && (
        <InstagramPreview carousel={carousel} caption={caption} onCaptionChange={setCaption} onClose={() => setIgPreviewOpen(false)}
          onGenerate={gerarLegenda} generating={captionLoading} genError={captionError}/>
      )}
    </div>
  )
}

// Controle de arrastar (slider) reutilizado nos ajustes finos do slide.
// O preview é um iframe (recria o slide inteiro a cada mudança), então arrastar
// e disparar onChange a cada pixel pisca. Aqui o thumb responde na hora (estado local)
// mas só avisa o pai (o que reconstrói o preview) depois de uma pequena pausa.
// Caixinha retrátil — clica no título, abre/fecha. Fica aberta entre trocas de slide
// (estado local do componente), pra não precisar reabrir toda vez.
// Agrupa campos relacionados (ex: tudo de "Título" separado de tudo de "Corpo")
// dentro de uma caixinha, com uma legenda pequena em cima.
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3 space-y-2.5" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
      <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>{label}</p>
      {children}
    </div>
  )
}

const HL_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#ffffff']

// Barrinha que aparece assim que a pessoa seleciona um trecho do texto (arrastando o mouse) —
// clica numa cor pra destacar na hora, com negrito/itálico/sublinhado/tarja como toggles antes.
function SelectionToolbar({ text, style, onToggle, onColor, onCancel, onQueue }: {
  text: string
  style: { bold: boolean; italic: boolean; underline: boolean; tarja: boolean }
  onToggle: (k: 'bold' | 'italic' | 'underline' | 'tarja') => void
  onColor: (color: string) => void
  onCancel: () => void
  onQueue?: () => void
}) {
  return (
    <div className="mt-1.5 p-2.5 rounded-xl flex items-center gap-2.5 flex-wrap fade-in" style={{ background: 'var(--bg2)', border: '1px solid var(--accent)', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
      <span className="text-[10px] font-semibold truncate max-w-[100px]" style={{ color: 'var(--muted)' }}>&quot;{text}&quot;</span>
      <div className="flex items-center gap-1">
        {HL_COLORS.map(c => (
          <button key={c} onClick={() => onColor(c)} title="Aplicar essa cor"
            className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: c, border: '1.5px solid rgba(255,255,255,0.3)' }}/>
        ))}
        <ColorInput value="#ffffff" onChange={onColor} size={24}/>
      </div>
      {onQueue && (
        <button onClick={onQueue} title="Marcar e selecionar outra (aplica cor depois, em todas de uma vez)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <Plus size={11}/> Marcar mais
        </button>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <button onClick={() => onToggle('bold')} title="Negrito"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold"
          style={{ background: style.bold ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: style.bold ? 'var(--accent2)' : 'var(--muted)', border: style.bold ? '1px solid var(--accent)' : '1px solid transparent' }}>B</button>
        <button onClick={() => onToggle('italic')} title="Itálico"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold italic"
          style={{ background: style.italic ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: style.italic ? 'var(--accent2)' : 'var(--muted)', border: style.italic ? '1px solid var(--accent)' : '1px solid transparent' }}>I</button>
        <button onClick={() => onToggle('underline')} title="Sublinhado"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold underline"
          style={{ background: style.underline ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: style.underline ? 'var(--accent2)' : 'var(--muted)', border: style.underline ? '1px solid var(--accent)' : '1px solid transparent' }}>S</button>
        <button onClick={() => onToggle('tarja')} title="Tarja (fundo colorido)"
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: style.tarja ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', border: style.tarja ? '1px solid var(--accent)' : '1px solid transparent' }}>
          <Highlighter size={13} style={{ color: style.tarja ? 'var(--accent2)' : 'var(--muted)' }}/>
        </button>
        <button onClick={onCancel} title="Fechar (fica salvo em Destaques & Formatação)" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: 'var(--muted)' }}>
          <X size={13}/>
        </button>
      </div>
    </div>
  )
}

function AccordionSection({ title, icon, children, defaultOpen = false, onReset }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; onReset?: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden transition-colors" style={{ border: `1px solid ${open ? 'var(--border2)' : 'var(--border)'}`, background: 'var(--bg2)' }}>
      <div className="w-full flex items-center justify-between px-3.5 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center justify-between min-w-0">
          <span className="flex items-center gap-3 text-[13.5px] font-semibold min-w-0" style={{ color: 'var(--text)' }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg3)', color: 'var(--accent2)' }}>
              {icon}
            </span>
            <span className="truncate">{title}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 ml-2" style={{ color: 'var(--muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
        </button>
        {onReset && (
          <button onClick={e => { e.stopPropagation(); onReset() }}
            title="Restaurar padrão"
            className="ml-2 p-1.5 rounded-lg flex-shrink-0 hover:brightness-125" style={{ color: 'var(--muted)', background: 'var(--bg3)' }}>
            <RotateCcw size={12}/>
          </button>
        )}
      </div>
      {open && <div className="px-3.5 pb-3.5 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  )
}

function SliderField({ label, value, onChange, min, max, step = 1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  // Campo de número digitável: NÃO clampa a cada tecla (senão "450" vira "150" no meio
  // da digitação, porque "4" e "45" já são menores que o mínimo). Só valida ao sair do campo.
  const [text, setText] = useState(String(value))
  useEffect(() => { setText(String(value)) }, [value])
  const commit = () => {
    const v = Number(text)
    if (!Number.isNaN(v) && text.trim() !== '') onChange(clamp(v))
    else setText(String(value))
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[10px]" style={{ color: 'var(--muted)' }}>{label}</label>
        <div className="flex items-center gap-0.5">
          <input type="number" value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur() } }}
            className="w-12 text-right text-[10px] font-semibold px-1 py-0.5 rounded"
            style={{ color: 'var(--text)', background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
          {unit && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{unit}</span>}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-1" style={{ accentColor: 'var(--accent)' }}/>
    </div>
  )
}

// Slide real é 1080x1350 nativo — escala visualmente pra caber na caixa, sem cortar.
// O iframe carrega o documento completo (com fontes/CSS) UMA vez só, no primeiro
// mount, e nunca mais recarrega — as próximas mudanças chegam por postMessage e só
// trocam o conteúdo por dentro (document.body.innerHTML), então não pisca nunca.
function ScaledSlide({ html, bodyHtml, cssVars, boxWidth, boxHeight, interactive = true, onTextSelect }: {
  html: string; bodyHtml: string; cssVars?: Record<string, string>; boxWidth: number; boxHeight: number; interactive?: boolean
  onTextSelect?: (sel: { field: 'title' | 'subtitle' | 'body'; text: string } | null) => void
}) {
  const NATIVE_W = 1080, NATIVE_H = 1350
  const scale = Math.min(boxWidth / NATIVE_W, boxHeight / NATIVE_H)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const initialHtmlRef = useRef(html)
  const loadedRef = useRef(false)
  const pendingRef = useRef<Array<Record<string, unknown>>>([])

  const send = (msg: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow
    if (!win || !loadedRef.current) { pendingRef.current.push(msg); return }
    win.postMessage(msg, '*')
  }

  useEffect(() => {
    send({ type: 'slide-update', html: bodyHtml })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml])

  useEffect(() => {
    if (cssVars) send({ type: 'vars-update', vars: cssVars })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cssVars])

  // Seleção de texto direto no preview (não nos campos de formulário) — o iframe avisa
  // por postMessage quando a pessoa arrasta o mouse em cima de um trecho renderizado.
  useEffect(() => {
    if (!onTextSelect) return
    const listener = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow || !e.data) return
      if (e.data.type === 'text-selected') onTextSelect({ field: e.data.field, text: e.data.text })
      else if (e.data.type === 'text-selection-cleared') onTextSelect(null)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [onTextSelect])

  return (
    <div style={{
      width: boxWidth, height: boxHeight, overflow: 'hidden', position: 'relative',
      borderRadius: 12, boxShadow: interactive ? '0 8px 40px rgba(0,0,0,.5)' : 'none',
      background: '#000',
    }}>
      <iframe
        ref={iframeRef}
        srcDoc={initialHtmlRef.current}
        onLoad={() => {
          loadedRef.current = true
          const win = iframeRef.current?.contentWindow
          pendingRef.current.forEach(msg => win?.postMessage(msg, '*'))
          pendingRef.current = []
        }}
        style={{
          width: NATIVE_W, height: NATIVE_H, border: 'none',
          transform: `scale(${scale})`, transformOrigin: 'top left',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
        title="slide-preview"
      />
    </div>
  )
}
