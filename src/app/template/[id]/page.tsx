'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Carousel, Slide, CarouselTemplate, SlideTemplateDef, SlideHighlight, Profile } from '@/types'
import { generateSlideHTML, generateSlideInner, derivePalette } from '@/lib/html-renderer'
import { ArrowLeft, Upload, Save, ClipboardPaste, Plus, Copy, FlipHorizontal2, X, ChevronRight, Image as ImageIcon, Layers, Palette, Type, MoveVertical, Highlighter, FileText, RotateCcw, Download, Check } from 'lucide-react'
import { PENDING_GENERATION_KEY, PendingGeneration } from '@/components/CreateCarouselModal'
import { parseBloco, splitBlocos } from '@/lib/bulk-parse'

const FONTES = ['Barlow Condensed', 'Plus Jakarta Sans', 'Space Grotesk', 'Poppins', 'Playfair Display', 'Archivo Black', 'Source Serif 4']

interface FieldState {
  tag: string
  title: string
  subtitle: string
  body: string
  ctaWord: string
  image?: string
  images: (string | undefined)[]
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
  image: undefined, images: [], imagePosition: { x: 50, y: 50 }, imageZoom: 100,
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

  const [template, setTemplate] = useState<CarouselTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [handle, setHandle] = useState('eusoupaulofigueirdo')
  const [primaryColor, setPrimaryColor] = useState('#A8573C')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState('')
  const [perfilBlockOpen, setPerfilBlockOpen] = useState(false)
  const [avatarImage, setAvatarImage] = useState<string | undefined>(undefined)
  const [brandText, setBrandText] = useState('')
  const [brandPosition, setBrandPosition] = useState<'tl' | 'tr' | 'bl' | 'br'>('tr')
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

  const buildHighlightPatch = (color: string) => ({
    color,
    ...(selStyle.bold ? { weight: 800 } : {}),
    ...(selStyle.italic ? { italic: true } : {}),
    ...(selStyle.underline ? { underline: true } : {}),
    ...(selStyle.tarja ? { background: color, color: '#111' } : {}),
  })

  const applySelectionHighlight = (color: string) => {
    if (!textSel) return
    setFields(prev => prev.map((f, idx) => idx === active
      ? { ...f, highlights: [...f.highlights, { word: textSel.text, ...buildHighlightPatch(color) }] }
      : f))
    setTextSel(null)
    setSelStyle({ bold: false, italic: false, underline: false, tarja: false })
  }
  const applyQueuedHighlights = (color: string) => {
    if (!hlQueue.length) return
    const patch = buildHighlightPatch(color)
    setFields(prev => prev.map((f, idx) => idx === active
      ? { ...f, highlights: [...f.highlights, ...hlQueue.map(word => ({ word, ...patch }))] }
      : f))
    setHlQueue([])
    setSelStyle({ bold: false, italic: false, underline: false, tarja: false })
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
        setPrimaryColor(c.briefing.primaryColor || '#A8573C')
        setAvatarImage(c.briefing.avatarImage)
        setBrandText(c.briefing.brandText || '')
        setBrandPosition(c.briefing.brandPosition || 'tr')
        setAvatarSize(c.briefing.avatarSize || 70)
        setHandleSize(c.briefing.handleSize || 30)
        setHandleColor(c.briefing.handleColor || '')
        setVerifiedBadge(c.briefing.verifiedBadge !== false)
        setSlideDefs(c.content.slides.map((s, i) => slideDefFromSlide(s, i)))
        setFields(c.content.slides.map(s => fieldFromSlide(s)))
        setSavedId(c.id)
      })
      .catch(() => { /* se falhar, só continua com os padrões do template */ })
  }, [carouselId, template])

  useEffect(() => {
    fetch('/api/profiles').then(r => r.json()).then(setProfiles).catch(() => {})
  }, [])

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
    setFields(defs.map((def, i) => {
      const base = fieldFromDef(def)
      const s = pending.slides.find(sl => sl.index === i + 1)
      const patch: Partial<FieldState> = {}
      if (s) {
        if (s.title !== undefined) patch.title = s.title
        // Capa não tem campo de corpo — se o bloco veio sem a tag SUBTITULO: explícita,
        // o texto extra (que caiu em "body") vira subtítulo em vez de sumir.
        if (def.background === 'cover') {
          if (s.subtitle || s.body) patch.subtitle = s.subtitle || s.body
        } else if (def.hasBody && s.body !== undefined) {
          patch.body = s.body
        }
        if (def.hasTag && s.tag !== undefined) patch.tag = s.tag
      }
      if (def.hasImage && imgCursor < pending.images.length) {
        patch.image = pending.images[imgCursor]
        imgCursor++
      }
      return { ...base, ...patch }
    }))

    // Lê a largura/altura reais de cada imagem atribuída, pra zoom/posição funcionarem sem distorcer.
    setTimeout(() => {
      setFields(prev => {
        prev.forEach((f, i) => {
          if (!f.image) return
          readImageDims(f.image).then(({ w, h }) => {
            setFields(cur => cur.map((c, idx) => idx === i ? { ...c, imageNaturalW: w, imageNaturalH: h } : c))
          })
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
        setPrimaryColor(p.primaryColor || '#A8573C')
        setAvatarImage(p.logo || undefined)
        setBrandText(p.brandText || '')
        setBrandPosition(p.brandPosition || 'tr')
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
    setPrimaryColor(p.primaryColor || '#A8573C')
    setAvatarImage(p.logo || undefined)
    setBrandText(p.brandText || '')
    setBrandPosition(p.brandPosition || 'tr')
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

  const distribuirConteudo = () => {
    const blocos = splitBlocos(bulkText)
    setFields(prev => prev.map((f, i) => {
      const bloco = blocos[i]
      if (!bloco) return f
      const parsed = parseBloco(bloco)
      // Capa não tem campo de corpo — se o bloco veio sem a tag SUBTITULO: explícita
      // (modo simples: 1ª linha = título, resto = corpo), esse "resto" vira subtítulo
      // da capa em vez de sumir silenciosamente num campo que o slide não usa.
      const isCover = slideDefs[i]?.background === 'cover'
      return {
        ...f,
        title: parsed.title || f.title,
        subtitle: (isCover ? (parsed.subtitle || parsed.body) : parsed.subtitle) || f.subtitle,
        body: isCover ? f.body : (parsed.body || f.body),
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
        images: def.imageLayout && def.imageLayout !== 'none' ? f.images.filter((x): x is string => !!x) : undefined,
        imageZooms: def.imageLayout && def.imageLayout !== 'none' ? f.imageZooms : undefined,
        imagePositions: def.imageLayout && def.imageLayout !== 'none' ? f.imagePositions : undefined,
        imageMirrors: def.imageLayout && def.imageLayout !== 'none' ? f.imageMirrors : undefined,
        imageLayout: def.imageLayout,
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
        profileId: profileId, mode: 'content', input: '', niche: handle,
        primaryColor, visualStyle: 'minimal', carouselType: 'tese',
        cta: '', slideCount: slides.length as 5 | 7 | 9 | 12, imageCount: 0, accentColor: primaryColor,
        fontHeadline: '', fontBody: '', avatarImage, brandText, brandPosition,
        avatarSize, handleSize, handleColor: handleColor || undefined, verifiedBadge,
      },
      content: {
        triagem: '', eixo: '', funil: '',
        headlines: [], selectedHeadline: 0,
        spine: { headline: '', hook: '', mechanism: '', proof: '', application: '', direction: '' },
        slides, caption: '',
      },
      visualStyle: 'minimal',
      status: 'editing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }, [fields, handle, primaryColor, avatarImage, brandText, brandPosition, avatarSize, handleSize, handleColor, verifiedBadge, carouselTitle, profileId, template, slideDefs])

  // O iframe do preview monta uma vez só e recebe atualizações por postMessage (troca só
  // o conteúdo por dentro, sem recarregar o documento) — por isso dá pra ser 100% ao vivo,
  // a cada pixel arrastado, sem piscar.
  const slideHTML = (i: number) => carousel ? generateSlideHTML(carousel, carousel.content.slides[i]) : ''
  const slideBodyHTML = (i: number) => carousel ? generateSlideInner(carousel, carousel.content.slides[i]) : ''

  // As variáveis de cor (--P etc) ficam no <head>, que o postMessage não substitui —
  // por isso mandamos elas separado, direto pro CSS do iframe, sempre que a cor mudar.
  const cssVars = useMemo(() => {
    const p = derivePalette(primaryColor || '#A8573C')
    return { '--P': p.P, '--PL': p.PL, '--PD': p.PD, '--LB': p.LB, '--DB': p.DB, '--LR': p.LR, '--G': p.G }
  }, [primaryColor])

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
      <div className="flex items-center gap-3 px-5 py-3" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/"><ArrowLeft size={18} style={{ color: 'var(--muted)' }}/></Link>
        <input ref={titleInputRef} value={carouselTitle} onChange={e => { setCarouselTitle(e.target.value); setTitleMissing(false) }}
          placeholder="Nome do carrossel"
          className="font-bold text-sm px-2 py-1.5 rounded-lg"
          style={{ background: 'var(--bg3)', border: `1px solid ${titleMissing ? '#e05252' : 'var(--border)'}`, width: 220 }}/>
        <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }}/>
        <select value={profileId} onChange={e => aplicarPerfil(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', maxWidth: 180 }}>
          <option value="">Manual (preencher abaixo)</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => setPerfilBlockOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: perfilBlockOpen ? 'var(--grad)' : 'var(--bg3)', color: perfilBlockOpen ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
          Dados do perfil <ChevronRight size={12} style={{ transform: perfilBlockOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
        </button>
        <button onClick={() => setBulkOpen(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: bulkOpen ? 'var(--grad)' : 'var(--bg3)', color: bulkOpen ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
          <ClipboardPaste size={13}/> Colar todo o conteúdo
        </button>
        <div className="flex-1"/>
        {savedMsg && <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>Salvo ✓</span>}
        <button onClick={baixar} disabled={downloading || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <Download size={15}/> {downloading ? 'Gerando…' : 'Baixar carrossel'}
        </button>
        <button onClick={salvar} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black"
          style={{ background: 'var(--grad)' }}>
          <Save size={15}/> {saving ? 'Salvando…' : 'Salvar carrossel'}
        </button>
      </div>

      {profiles.length === 0 && !profileId && (
        <p className="text-[11px] px-5 py-1.5" style={{ color: 'var(--muted)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          Nenhum perfil salvo ainda — <Link href="/profiles" className="underline">crie um</Link> pra reutilizar handle/cor/avatar sem preencher toda vez.
        </p>
      )}

      {perfilBlockOpen && (
        <div className="px-5 py-4 grid grid-cols-4 gap-4 overflow-y-auto" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', maxHeight: '38vh' }}>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Handle</label>
            <input value={handle} onChange={e => setHandle(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Cor primária</label>
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
              className="w-full mt-1 h-9 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Foto de perfil (avatar)</label>
            <div className="flex items-center gap-2 mt-1">
              {avatarImage && <img src={avatarImage} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0"/>}
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer"
                style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                <Upload size={13}/> {avatarImage ? 'Trocar' : 'Enviar foto'}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])}/>
              </label>
              {avatarImage && (
                <button onClick={() => setAvatarImage(undefined)} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={14}/></button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Texto da marca (rodapé pequeno)</label>
            <input value={brandText} onChange={e => setBrandText(e.target.value)}
              placeholder="Ex: Powered by Claude Viral"
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
            {brandText && (
              <div className="flex gap-1 mt-2">
                {(['tl', 'tr', 'bl', 'br'] as const).map(p => (
                  <button key={p} onClick={() => setBrandPosition(p)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                    style={{ background: brandPosition === p ? 'var(--grad)' : 'var(--bg3)', color: brandPosition === p ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
                    {p === 'tl' ? 'Sup. esq.' : p === 'tr' ? 'Sup. dir.' : p === 'bl' ? 'Inf. esq.' : 'Inf. dir.'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SliderField label="Tamanho do avatar (padrão)" value={avatarSize || 70} min={24} max={260} unit="px"
            onChange={v => setAvatarSize(v)}/>
          <SliderField label="Tamanho do texto do perfil (padrão)" value={handleSize || 30} min={16} max={56} unit="px"
            onChange={v => setHandleSize(v)}/>
          <div>
            <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Cor do texto do perfil (padrão)</label>
            <div className="flex items-center gap-1 mt-1">
              <input type="color" value={handleColor || '#111111'} onChange={e => setHandleColor(e.target.value)}
                className="w-9 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
              {handleColor && (
                <button onClick={() => setHandleColor('')} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
              )}
            </div>
          </div>
          <button onClick={() => setVerifiedBadge(v => !v)}
            className="flex items-center justify-between px-3 py-2 rounded-lg self-end"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Selo de verificado</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2"
              style={{ background: verifiedBadge ? 'var(--grad)' : 'var(--bg2)', color: verifiedBadge ? '#000' : 'var(--muted)' }}>
              {verifiedBadge ? 'Mostrando' : 'Escondido'}
            </span>
          </button>
        </div>
      )}

      {bulkOpen && (
        <div className="px-5 py-4 space-y-2" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Cola os {slideDefs.length} blocos separados por uma linha só com <code>---</code>. Marca cada linha com <code>TITULO:</code>, <code>SUBTITULO:</code>, <code>TEXTO:</code> ou <code>LISTA:</code> pra dizer o que ela é (sem tag nenhuma, cai no modo simples: primeira linha = título).</p>
          <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={6}
            placeholder={'TITULO: Headline do slide 1\nTEXTO: Primeiro parágrafo\nTEXTO: Segundo parágrafo\n---\nTITULO: Headline do slide 2\nLISTA: Item um\nLISTA: Item dois\n---\n...'}
            className="w-full px-3 py-2 rounded-lg text-xs resize-none" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
          <button onClick={distribuirConteudo}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-black" style={{ background: 'var(--grad)' }}>
            Distribuir nos {slideDefs.length} slides
          </button>
        </div>
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
                onToggle={k => setSelStyle(s => ({ ...s, [k]: !s[k] }))}
                onColor={applyQueuedHighlights} onCancel={() => setHlQueue([])}/>
            </div>
          )}

          {def.hasImage && (
          <AccordionSection title="Imagem de Fundo" icon={<ImageIcon size={14}/>}
            onReset={() => resetFields(active, ['image', 'images', 'imagePosition', 'imageZoom', 'imageMirror', 'imagePositions', 'imageZooms', 'imageMirrors', 'imageHeight'])}>
          {def.imageLayout && def.imageLayout !== 'none' ? (
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
                        style={{ background: f.imageMirrors[slot] ? 'var(--grad)' : 'var(--bg3)', color: f.imageMirrors[slot] ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
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
              {def.background === 'cover' && f.image && (
                <div className="mt-2 space-y-2">
                  <SliderField label="Zoom" value={f.imageZoom} min={100} max={250} unit="%"
                    onChange={v => updateField(active, { imageZoom: v })}/>
                  <SliderField label="Posição X" value={f.imagePosition.x} min={0} max={100} unit="%"
                    onChange={v => updateField(active, { imagePosition: { ...f.imagePosition, x: v } })}/>
                  <SliderField label="Posição Y" value={f.imagePosition.y} min={0} max={100} unit="%"
                    onChange={v => updateField(active, { imagePosition: { ...f.imagePosition, y: v } })}/>
                  <button onClick={() => updateField(active, { imageMirror: !f.imageMirror })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.imageMirror ? 'var(--grad)' : 'var(--bg2)', color: f.imageMirror ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
                    <FlipHorizontal2 size={12}/> Espelhar imagem
                  </button>
                </div>
              )}
            </div>
          )}
          </AccordionSection>
          )}

          {def.hasImage && (f.image || f.images.some(Boolean)) && (
            <AccordionSection title="Sombra / Degradê" icon={<Layers size={14}/>}
              onReset={() => resetFields(active, ['gradientOn', 'gradientColor', 'gradientDir', 'gradientExtent'])}>
              <button onClick={() => updateField(active, { gradientOn: !f.gradientOn })}
                className="w-full flex items-center justify-between px-1 py-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Degradê na imagem</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: f.gradientOn ? 'var(--grad)' : 'var(--bg3)', color: f.gradientOn ? '#000' : 'var(--muted)' }}>
                  {f.gradientOn ? 'Ligado' : 'Desligado'}
                </span>
              </button>
              {f.gradientOn && (
                <div className="mt-2 space-y-2 px-1 pb-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] flex-shrink-0" style={{ color: 'var(--muted)' }}>Cor</label>
                    <input type="color" value={f.gradientColor} onChange={e => updateField(active, { gradientColor: e.target.value })}
                      className="w-9 h-8 rounded-lg" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                    <div className="flex gap-1 flex-1">
                      {(['top', 'bottom', 'left', 'right'] as const).map(dir => (
                        <button key={dir} onClick={() => updateField(active, { gradientDir: dir })}
                          className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                          style={{ background: f.gradientDir === dir ? 'var(--grad)' : 'var(--bg3)', color: f.gradientDir === dir ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
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
            <AccordionSection title="Fundo do Slide" icon={<Palette size={14}/>}
              onReset={() => resetFields(active, ['slideBg'])}>
              <p className="text-[10px] mb-1" style={{ color: 'var(--muted)' }}>Cor por trás do slide (só aparece onde não tem imagem cobrindo).</p>
              <div className="flex items-center gap-2">
                <input type="color" value={f.slideBg || '#ffffff'} onChange={e => updateField(active, { slideBg: e.target.value })}
                  className="w-9 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
                {f.slideBg && (
                  <button onClick={() => updateField(active, { slideBg: '' })}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    <X size={12}/> Usar padrão (branco)
                  </button>
                )}
              </div>
            </AccordionSection>
          )}

          <AccordionSection title="Texto & Conteúdo" icon={<FileText size={14}/>}>
            {def.hasTag && (
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Tag (rótulo pequeno)</label>
                <input value={f.tag} onChange={e => updateField(active, { tag: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{def.background === 'cover' ? 'Headline (capa)' : def.isCTA ? 'Headline do CTA' : 'Título'}</label>
              <textarea value={f.title} onChange={e => updateField(active, { title: e.target.value })}
                onSelect={handleSelect('title')} onMouseUp={handleSelect('title')} onKeyUp={handleSelect('title')}
                rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
              {textSel?.field === 'title' && textSel.source === 'field' && (
                <SelectionToolbar text={textSel.text} style={selStyle}
                  onToggle={k => setSelStyle(s => ({ ...s, [k]: !s[k] }))}
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
                    onToggle={k => setSelStyle(s => ({ ...s, [k]: !s[k] }))}
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
                    onToggle={k => setSelStyle(s => ({ ...s, [k]: !s[k] }))}
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

          <AccordionSection title="Tipografia" icon={<Type size={14}/>}
            onReset={() => resetFields(active, ['fontFamilyHead', 'fontFamilyBody', 'titleColor', 'bodyColor', 'titleSize', 'bodySize', 'titleWeight', 'bodyWeight', 'titleLineHeight', 'bodyLineHeight', 'textAlign'])}>
            <div>
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Alinhamento do texto (título e corpo)</label>
              <div className="flex gap-1 mt-1">
                {(['left', 'center', 'right', 'justify'] as const).map(a => (
                  <button key={a} onClick={() => updateField(active, { textAlign: a })}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.textAlign === a ? 'var(--grad)' : 'var(--bg3)', color: f.textAlign === a ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
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
                    <input type="color" value={f.titleColor || '#161311'}
                      onChange={e => updateField(active, { titleColor: e.target.value })}
                      className="w-9 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
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
                    <input type="color" value={f.bodyColor || '#2a2a2a'}
                      onChange={e => updateField(active, { bodyColor: e.target.value })}
                      className="w-9 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
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
                    <input type="color" value={f.bodyColor || '#ffffff'}
                      onChange={e => updateField(active, { bodyColor: e.target.value })}
                      className="w-9 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
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

          <AccordionSection title="Layout do Texto" icon={<MoveVertical size={14}/>}
            onReset={() => resetFields(active, ['marginH', 'marginV', 'blockGap', 'textAnchor'])}>
            <div>
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Posição do texto no slide</label>
              <div className="flex gap-1 mt-1">
                {(['top', 'center', 'bottom'] as const).map(a => (
                  <button key={a} onClick={() => updateField(active, { textAnchor: a })}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.textAnchor === a ? 'var(--grad)' : 'var(--bg3)', color: f.textAnchor === a ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
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

          <AccordionSection title="Destaques & Formatação" icon={<Highlighter size={14}/>}
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
                      style={{ background: already ? 'var(--grad)' : 'var(--bg2)', border: '1px solid var(--border)', color: already ? '#000' : 'var(--text)' }}>
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
                    <input type="color" value={h.color} onChange={e => updateHighlight(active, hi, { color: e.target.value })}
                      className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                    <button onClick={() => removeHighlight(active, hi)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select value={h.fontFamily || ''} onChange={e => updateHighlight(active, hi, { fontFamily: e.target.value || undefined })}
                      className="flex-1 min-w-0 px-1.5 py-1.5 rounded-lg text-[10px]" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <option value="">Fonte padrão</option>
                      {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                    <select value={h.weight || ''} onChange={e => updateHighlight(active, hi, { weight: e.target.value ? Number(e.target.value) : undefined })}
                      className="px-1.5 py-1.5 rounded-lg text-[10px] flex-shrink-0" style={{ width: 64, background: 'var(--bg3)', border: '1px solid var(--border)', color: h.weight ? '#000' : 'var(--muted)' }}>
                      <option value="">Peso</option>
                      {[300, 400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <button onClick={() => updateHighlight(active, hi, { underline: !h.underline })}
                      className="w-8 h-8 rounded-lg flex-shrink-0 text-xs font-bold flex items-center justify-center"
                      style={{ background: h.underline ? 'var(--grad)' : 'var(--bg3)', color: h.underline ? '#000' : 'var(--muted)', border: '1px solid var(--border)', textDecoration: 'underline' }}>
                      S
                    </button>
                    <button onClick={() => updateHighlight(active, hi, { italic: !h.italic })}
                      className="w-8 h-8 rounded-lg flex-shrink-0 text-xs font-bold italic flex items-center justify-center"
                      style={{ background: h.italic ? 'var(--grad)' : 'var(--bg3)', color: h.italic ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
                      I
                    </button>
                    <button onClick={() => updateHighlight(active, hi, h.background ? { background: undefined } : { background: h.color, color: '#111111' })}
                      title="Tarja (fundo colorido)"
                      className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ background: h.background ? 'var(--grad)' : 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <Highlighter size={13} style={{ color: h.background ? '#000' : 'var(--muted)' }}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection title="Badge de Perfil (só esse slide)" icon={<Copy size={14}/>}
            onReset={() => resetFields(active, ['avatarSizeOverride', 'handleSizeOverride', 'handleColorOverride'])}>
            <p className="text-[10px] mb-1" style={{ color: 'var(--muted)' }}>Por padrão usa o tamanho/cor definidos em &quot;Dados do perfil&quot;. Ajuste aqui só se quiser diferente nesse slide.</p>
            <SliderField label="Tamanho do avatar" value={f.avatarSizeOverride || avatarSize} min={24} max={260} unit="px"
              onChange={v => updateField(active, { avatarSizeOverride: v })}/>
            <SliderField label="Tamanho do texto" value={f.handleSizeOverride || handleSize} min={16} max={56} unit="px"
              onChange={v => updateField(active, { handleSizeOverride: v })}/>
            <div>
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor do texto</label>
              <div className="flex items-center gap-1 mt-1">
                <input type="color" value={f.handleColorOverride || handleColor || '#111111'}
                  onChange={e => updateField(active, { handleColorOverride: e.target.value })}
                  className="w-9 h-8 rounded-lg flex-shrink-0" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
                {f.handleColorOverride && (
                  <button onClick={() => updateField(active, { handleColorOverride: '' })} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}><X size={13}/></button>
                )}
              </div>
            </div>
          </AccordionSection>
        </div>

        {/* Preview ao vivo — slide real é 1080x1350, escalado pra caber. Também dá pra
            selecionar o texto direto aqui (arrastando o mouse em cima) pra destacar. */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center gap-3 p-8" style={{ background: '#000' }}>
          <ScaledSlide html={slideHTML(active)} bodyHtml={slideBodyHTML(active)} cssVars={cssVars} boxWidth={360} boxHeight={450} onTextSelect={handlePreviewSelect}/>
          {textSel?.source === 'preview' && (
            <div className="w-full max-w-[360px]">
              <SelectionToolbar text={textSel.text} style={selStyle}
                onToggle={k => setSelStyle(s => ({ ...s, [k]: !s[k] }))}
                onColor={applySelectionHighlight} onCancel={() => setTextSel(null)} onQueue={queueSelection}/>
            </div>
          )}
        </div>

        {/* Trilha de miniaturas — arrasta pra reordenar, X pra excluir, + no final pra adicionar */}
        <div className="w-56 flex-shrink-0 overflow-auto p-3 space-y-3" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <button onClick={() => { setMultiSelect(v => !v); setSelected(new Set()) }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
            style={{ background: multiSelect ? 'var(--grad)' : 'var(--bg3)', color: multiSelect ? '#000' : 'var(--muted)', border: '1px solid var(--border)' }}>
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
    <div className="mt-1.5 p-2 rounded-lg flex items-center gap-2 flex-wrap fade-in" style={{ background: 'var(--bg3)', border: '1px solid var(--accent)' }}>
      <span className="text-[10px] font-semibold truncate max-w-[110px]" style={{ color: 'var(--muted)' }}>&quot;{text}&quot;</span>
      <div className="flex items-center gap-1">
        {HL_COLORS.map(c => (
          <button key={c} onClick={() => onColor(c)} title="Aplicar essa cor"
            className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: c, border: '1.5px solid rgba(255,255,255,0.3)' }}/>
        ))}
      </div>
      {onQueue && (
        <button onClick={onQueue} title="Marcar e selecionar outra (aplica cor depois, em todas de uma vez)"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <Plus size={11}/> Marcar mais
        </button>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <button onClick={() => onToggle('bold')} title="Negrito"
          className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold"
          style={{ background: style.bold ? 'var(--grad)' : 'var(--bg2)', color: style.bold ? '#000' : 'var(--muted)' }}>B</button>
        <button onClick={() => onToggle('italic')} title="Itálico"
          className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold italic"
          style={{ background: style.italic ? 'var(--grad)' : 'var(--bg2)', color: style.italic ? '#000' : 'var(--muted)' }}>I</button>
        <button onClick={() => onToggle('underline')} title="Sublinhado"
          className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold underline"
          style={{ background: style.underline ? 'var(--grad)' : 'var(--bg2)', color: style.underline ? '#000' : 'var(--muted)' }}>S</button>
        <button onClick={() => onToggle('tarja')} title="Tarja (fundo colorido)"
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: style.tarja ? 'var(--grad)' : 'var(--bg2)' }}>
          <Highlighter size={12} style={{ color: style.tarja ? '#000' : 'var(--muted)' }}/>
        </button>
        <button onClick={onCancel} title="Cancelar" className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--muted)' }}>
          <X size={12}/>
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
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="w-full flex items-center justify-between px-3 py-2.5" style={{ background: 'var(--bg2)' }}>
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {icon}{title}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
        </button>
        {onReset && (
          <button onClick={e => { e.stopPropagation(); onReset() }}
            title="Restaurar padrão"
            className="ml-2 p-1 rounded-md flex-shrink-0" style={{ color: 'var(--muted)' }}>
            <RotateCcw size={12}/>
          </button>
        )}
      </div>
      {open && <div className="p-3 space-y-3">{children}</div>}
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
