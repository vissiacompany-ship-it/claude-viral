'use client'

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Carousel, Slide, CarouselTemplate, SlideTemplateDef, SlideHighlight, Profile, ContentPillar, ImageLayout, SlideStyle, GalleryImage } from '@/types'
import ImageReferencePicker, { ImageRef } from '@/components/ImageReferencePicker'
import { generateSlideHTML, generateSlideInner, derivePalette } from '@/lib/html-renderer'
import { ArrowLeft, Upload, Save, ClipboardPaste, Plus, Copy, FlipHorizontal2, X, ChevronRight, Image as ImageIcon, Palette, MoveVertical, Highlighter, FileText, RotateCcw, Download, Check, ZoomIn, ZoomOut, Sparkles, Smartphone, Loader2, Undo2 } from 'lucide-react'
import { PENDING_GENERATION_KEY, PendingGeneration } from '@/components/CreateCarouselModal'
import { parseBloco, splitBlocos, bulkInstructions, fieldsToBulkText } from '@/lib/bulk-parse'
import { adaptSlideCount } from '@/lib/adapt-slide-count'
import BrandColorField from '@/components/BrandColorField'
import InstagramPreview from '@/components/InstagramPreview'
import ColorInput from '@/components/ColorInput'

const FONTES = ['Barlow Condensed', 'Plus Jakarta Sans', 'Space Grotesk', 'Poppins', 'Playfair Display', 'Archivo Black', 'Source Serif 4', 'Bodoni Moda', 'Inter', 'Nunito']

// Fonte que cada estilo de slide realmente usa quando ninguém escolheu nada no seletor
// (hardcoded no CSS do html-renderer.ts) — usada só pra mostrar o nome real no dropdown de
// fonte em vez da palavra genérica "Padrão", sem mudar o comportamento (continua sem override).
const STYLE_DEFAULT_FONTS: Record<string, { head: string; body: string }> = {
  'editorial-serif': { head: 'Playfair Display', body: 'Inter' },
  'bold-sans': { head: 'Poppins', body: 'Poppins' },
  'step-guide': { head: 'Inter', body: 'Inter' },
  'photo-block': { head: 'Barlow Condensed', body: 'Plus Jakarta Sans' },
  'dark-story': { head: 'Inter', body: 'Inter' },
  'photo-quote': { head: 'Nunito', body: 'Nunito' },
}
function styleDefaultFont(style: SlideStyle | undefined, kind: 'head' | 'body'): string {
  return STYLE_DEFAULT_FONTS[style || '']?.[kind] || (kind === 'head' ? 'Barlow Condensed' : 'Plus Jakarta Sans')
}

// Nome automático pro carrossel — CV de "Claude Viral", nunca deixa o campo vazio (isso é o
// que travava "Salvar" sem avisar nada). A pessoa pode trocar o nome quando quiser.
const gerarNomeCarrossel = () => `CV-${Math.floor(10 + Math.random() * 90)}`

// "Trocar modelo" navega pra outra URL (/template/[outroId]) — o histórico de Desfazer em
// memória não sobrevive a isso porque a página inteira desmonta. Esse snapshot leve (sem
// imagem em base64 solta — usa os mesmos "images"/"slides" que o PendingGeneration já usa)
// fica em sessionStorage só o suficiente pra sobreviver à navegação; o "Desfazer" do topo
// detecta e consome ele assim que a página do modelo novo carrega.
const UNDO_MODEL_SWAP_KEY = 'cvUndoModelSwap'
interface UndoModelSwapSnapshot {
  fromTemplateId: string
  toTemplateId: string
  carouselId?: string
  carouselTitle: string
  pillar?: ContentPillar
  slideDefs: SlideTemplateDef[]
  slides: PendingGeneration['slides']
  images: string[]
}

// Layout de imagem "de verdade" pra esse slide — o do modelo, OU (só pro estilo step-guide,
// que já sabe posicionar imagem em cima/embaixo) o que a pessoa ligou na hora, mesmo o
// modelo não trazendo imagem por padrão. Usado tanto na barra lateral quanto ao montar o
// carrossel final, pra nunca os dois lados discordarem sobre se esse slide "tem imagem".
function effectiveImageLayout(def: SlideTemplateDef, f: FieldState): ImageLayout | undefined {
  if (def.imageLayout && def.imageLayout !== 'none') return def.imageLayout
  if (!def.hasImage && def.style === 'step-guide' && f.imageEnabled) return f.imageBelow ? 'bottom' : 'top'
  return undefined
}

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
  marginVBottom: number
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
  titleCase: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  bodyCase: 'uppercase' | 'lowercase' | 'capitalize' | 'none'
  hideAvatarRow: boolean
  imageEnabled: boolean // liga imagem num slide que por padrão do modelo não tem (só estilo step-guide, por ora)
  imagePlacement: 'top' | 'middle' | 'bottom' // só estilo editorial-serif (imagem única, não double/triple)
}

const emptyField = (): FieldState => ({
  tag: '', title: '', subtitle: '', body: '', ctaWord: '',
  image: undefined, images: [], hideImage: false, imageBelow: false, imagePosition: { x: 50, y: 50 }, imageZoom: 100,
  imageMirror: false, imagePositions: [], imageZooms: [], imageMirrors: [],
  imageNaturalW: 0, imageNaturalH: 0, imageNaturalWs: [], imageNaturalHs: [],
  imageHeight: 0, marginH: 0, marginV: 0, marginVBottom: 0, blockGap: 0, highlights: [],
  titleSize: 0, bodySize: 0, subtitleSize: 0, fontFamilyHead: '', fontFamilyBody: '', titleColor: '', bodyColor: '',
  titleWeight: 0, bodyWeight: 0, titleLineHeight: 0, bodyLineHeight: 0,
  gradientOn: false, gradientColor: '#000000', gradientDir: 'bottom', gradientExtent: 70,
  slideBg: '', textAnchor: 'top', textAlign: '',
  avatarSizeOverride: 0, handleSizeOverride: 0, handleColorOverride: '',
  titleCase: 'uppercase', bodyCase: 'none', hideAvatarRow: false, imageEnabled: false, imagePlacement: 'top',
})

// Aplica os padrões do próprio slide do catálogo (ex: capa com texto embaixo, branco, degradê)
// por cima do emptyField() — só entra em ação se o slide define algum default.
const fieldFromDef = (def: SlideTemplateDef): FieldState => ({
  ...emptyField(),
  textAnchor: def.defaultTextAnchor || 'top',
  imageBelow: def.imageLayout === 'bottom',
  imagePlacement: def.imageLayout === 'bottom' ? 'bottom' : 'top',
  gradientOn: def.defaultGradientOn || false,
  gradientDir: def.defaultGradientDir || 'bottom',
  gradientExtent: def.defaultGradientExtent || 70,
  titleColor: def.defaultTitleColor || '',
  bodyColor: def.defaultBodyColor || '',
  bodySize: def.defaultBodySize || 0,
  handleColorOverride: def.defaultHandleColor || '',
  handleSizeOverride: def.defaultHandleSize || 0,
  avatarSizeOverride: def.defaultAvatarSize || 0,
  imageZoom: def.defaultImageZoom || 100,
  imagePosition: def.defaultImagePosition || { x: 50, y: 50 },
  subtitle: def.defaultSubtitle || '',
  titleSize: def.defaultTitleSize || 0,
  titleWeight: def.defaultTitleWeight || 0,
  titleLineHeight: def.defaultTitleLineHeight || 0,
  subtitleSize: def.defaultSubtitleSize || 0,
  marginH: def.defaultMarginH || 0,
  marginVBottom: def.defaultMarginVBottom || 0,
  blockGap: def.defaultBlockGap || 0,
  bodyWeight: def.defaultBodyWeight || 0,
  bodyLineHeight: def.defaultBodyLineHeight || 0,
  imageHeight: def.defaultImageHeight || 0,
  textAlign: def.defaultTextAlign || '',
  titleCase: def.defaultTitleUppercase === false ? 'none' : 'uppercase',
  bodyCase: 'none',
  hideAvatarRow: def.defaultHideAvatarRow || false,
  fontFamilyHead: def.defaultFontFamilyHead || '',
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
  marginVBottom: s.marginVBottom || 0,
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
  titleCase: s.titleCase || (s.titleUppercase === false ? 'none' : 'uppercase'),
  bodyCase: s.bodyCase || 'none',
  hideAvatarRow: !!s.hideAvatarRow,
  imageEnabled: !!s.image,
  imagePlacement: s.imagePlacement || (s.imageLayout === 'bottom' ? 'bottom' : 'top'),
})

const IMG_COUNT: Record<string, number> = { top: 1, bottom: 1, 'double-bottom': 2, 'triple-top': 3, none: 0 }

// Quantos slots de imagem esse slide tem de verdade — igual à lógica que decide entre o campo
// único (f.image) e o array (f.images[]) na barra lateral, só que resumida num número, pra
// montar a lista "achatada" de todas as imagens do carrossel (painel "Imagens" da trilha).
function imageSlotCount(def: SlideTemplateDef, f: FieldState): number {
  if (f.hideImage || !(def.hasImage || f.imageEnabled)) return 0
  const eil = effectiveImageLayout(def, f)
  return eil ? (IMG_COUNT[eil] || 1) : 1
}

interface ImgSlotValue {
  image?: string
  position: { x: number; y: number }
  zoom: number
  mirror: boolean
  naturalW: number
  naturalH: number
}

// Lê/grava o "slot" de imagem certo pro slide (array f.images[] pros layouts com mais de uma
// foto, campo único f.image pros demais) — usado pelo painel "Imagens" pra tratar todo slot
// de todo slide de forma uniforme, sem se importar qual dos dois formatos esse slide usa.
function getSlotValue(def: SlideTemplateDef, f: FieldState, slot: number): ImgSlotValue {
  if (effectiveImageLayout(def, f)) {
    return {
      image: f.images[slot],
      position: f.imagePositions[slot] || { x: 50, y: 50 },
      zoom: f.imageZooms[slot] ?? 100,
      mirror: !!f.imageMirrors[slot],
      naturalW: f.imageNaturalWs[slot] || 0,
      naturalH: f.imageNaturalHs[slot] || 0,
    }
  }
  return { image: f.image, position: f.imagePosition, zoom: f.imageZoom, mirror: f.imageMirror, naturalW: f.imageNaturalW, naturalH: f.imageNaturalH }
}

function withSlotValue(def: SlideTemplateDef, f: FieldState, slot: number, v: ImgSlotValue): FieldState {
  if (effectiveImageLayout(def, f)) {
    const images = [...f.images]; images[slot] = v.image
    const imagePositions = [...f.imagePositions]; imagePositions[slot] = v.position
    const imageZooms = [...f.imageZooms]; imageZooms[slot] = v.zoom
    const imageMirrors = [...f.imageMirrors]; imageMirrors[slot] = v.mirror
    const imageNaturalWs = [...f.imageNaturalWs]; imageNaturalWs[slot] = v.naturalW
    const imageNaturalHs = [...f.imageNaturalHs]; imageNaturalHs[slot] = v.naturalH
    return { ...f, images, imagePositions, imageZooms, imageMirrors, imageNaturalWs, imageNaturalHs }
  }
  return { ...f, image: v.image, imagePosition: v.position, imageZoom: v.zoom, imageMirror: v.mirror, imageNaturalW: v.naturalW, imageNaturalH: v.naturalH }
}

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
  const [handle, setHandle] = useState('')
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
  const [brandTextVisible, setBrandTextVisible] = useState(true)
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
  // Pilar de conteúdo escolhido no passo de ideia (CreateCarouselModal) ou salvo no briefing —
  // segue pro prompt de imagem (ex: noticia-cultura ancora a cena em algo do momento).
  const [pillar, setPillar] = useState<ContentPillar | undefined>(undefined)
  const [fields, setFields] = useState<FieldState[]>([])
  const [slideDefs, setSlideDefs] = useState<SlideTemplateDef[]>([])
  // Histórico de "Desfazer" — guarda o slideDefs+fields de ANTES de uma ação que reestrutura
  // o carrossel (trocar estrutura de um slide, colar/distribuir conteúdo, excluir slide).
  // Fica só na memória (não serializa em sessionStorage) porque fields carrega imagem em
  // base64 antes do primeiro Salvar — pode pesar MBs, e sessionStorage tem limite de ~5-10MB.
  const [undoStack, setUndoStack] = useState<{ slideDefs: SlideTemplateDef[]; fields: FieldState[] }[]>([])
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  // Espelha savedId de forma síncrona (setState só reflete no próximo render) — evita a
  // corrida que criava carrossel duplicado: dois saves quase simultâneos (autosave + clique
  // em Salvar/Baixar, ou autosave disparando antes do fetch de um carrossel existente
  // terminar) liam savedId ainda null e cada um criava seu próprio registro novo em vez de
  // atualizar o mesmo. Toda escrita em savedId tem que passar por aqui também.
  const savedIdRef = useRef<string | null>(null)
  const setSavedIdBoth = (id: string | null) => { savedIdRef.current = id; setSavedId(id) }
  // Só true quando já sabemos se esse carrossel é novo ou já existe (?carouselId= na URL) —
  // enquanto isso não resolve, o autosave não pode disparar, senão cria um registro novo
  // antes de descobrir que já existia um pra atualizar.
  const [initialLoadDone, setInitialLoadDone] = useState(!carouselId)
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
  const regenBtnRef = useRef<HTMLButtonElement>(null)
  const [bulkPos, setBulkPos] = useState({ top: 0, left: 0 })
  const [captionPos, setCaptionPos] = useState({ top: 0, left: 0 })
  const [switchPos, setSwitchPos] = useState({ top: 0, left: 0 })
  const [batchImgPos, setBatchImgPos] = useState({ top: 0, left: 0 })
  const [regenPos, setRegenPos] = useState({ top: 0, left: 0 })
  // Refazer a copy do carrossel INTEIRO de uma vez a partir de uma sugestão — pedido do
  // Paulo: reescrever só uma headline não adianta quando o resto do carrossel foi escrito
  // em cima de outra ideia/ângulo; o contexto de todos os slides precisa mudar junto.
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenInstruction, setRegenInstruction] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenError, setRegenError] = useState('')
  const openBelow = (ref: React.RefObject<HTMLButtonElement | null>, setPos: (p: { top: number; left: number }) => void, setOpen: (v: boolean) => void) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, left: r.left })
    setOpen(true)
  }
  // Prompt de imagem gerado por slide (CLI do Claude) + geração real via Gemini, se
  // a API key estiver configurada em Configurações. Chave é "slide:slot" — slot sempre 0
  // pra slides de imagem única, e 0/1/2 pra layouts com mais de uma foto (double-bottom,
  // triple-top), senão gerar a 2ª/3ª imagem sobrescreveria sempre a mesma posição.
  const imgKey = (i: number, slot = 0) => `${i}:${slot}`
  const [imgPromptLoading, setImgPromptLoading] = useState<Record<string, boolean>>({})
  const [imgPromptText, setImgPromptText] = useState<Record<string, string>>({})
  const [imgPromptError, setImgPromptError] = useState<Record<string, string>>({})
  const [imgGenLoading, setImgGenLoading] = useState<Record<string, boolean>>({})
  const [imgPromptCopied, setImgPromptCopied] = useState<Record<string, boolean>>({})
  // Direção extra opcional que a pessoa escreve pra guiar a cena — o texto do slide continua
  // sendo a referência principal, isso só complementa quando ela quer pontuar algo específico.
  const [imgExtraHint, setImgExtraHint] = useState<Record<string, string>>({})
  const setImgExtraHintFor = (i: number, slot: number, value: string) => {
    const k = imgKey(i, slot)
    setImgExtraHint(p => ({ ...p, [k]: value }))
    // Muda a direção → o prompt já gerado fica desatualizado, força gerar de novo no próximo clique.
    setImgPromptText(p => { const n = { ...p }; delete n[k]; return n })
  }
  // Painel "Direção extra" some por padrão — só abre quando a pessoa clica em "Gerar prompt"
  // ou "Gerar imagem com IA", com um passo de confirmar antes de rodar de fato.
  const [imgGenPanel, setImgGenPanel] = useState<Record<string, 'prompt' | 'image' | undefined>>({})
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  // Referências de imagem escolhidas por slide/slot (galeria do perfil ou upload direto do
  // computador) — somadas à referência de estilo automática do perfil (se tiver) na hora de
  // gerar. Mesmo seletor usado no Gerador de Imagens, só que por slide.
  const [imgReferences, setImgReferences] = useState<Record<string, ImageRef[]>>({})
  // Galeria pra escolher imagem no carrossel mostra TODAS as fotos de TODOS os perfis, não só
  // do perfil ativo — é comum reaproveitar uma foto de outro cliente/perfil num carrossel novo.
  const [profileGallery, setProfileGallery] = useState<GalleryImage[]>([])
  useEffect(() => {
    if (!profiles.length) { setProfileGallery([]); return }
    let ignore = false
    Promise.all(profiles.map(p => fetch(`/api/gallery?profileId=${p.id}`).then(r => r.json() as Promise<GalleryImage[]>).catch(() => [])))
      .then(lists => {
        if (ignore) return
        const merged = lists.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        setProfileGallery(merged)
      })
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.length])
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  // Painel lateral: "Slides" (trilha de miniaturas, já existia) ou "Imagens" (todas as fotos
  // do carrossel juntas, pra arrastar e trocar de slide sem precisar entrar em cada um).
  const [panelTab, setPanelTab] = useState<'slides' | 'images' | 'gallery'>('slides')
  const [imgDragIndex, setImgDragIndex] = useState<number | null>(null)
  const imageSlots = useMemo(() => {
    const list: { slideIdx: number; slot: number }[] = []
    slideDefs.forEach((def, i) => {
      const f = fields[i]
      if (!f) return
      for (let s = 0; s < imageSlotCount(def, f); s++) list.push({ slideIdx: i, slot: s })
    })
    return list
  }, [slideDefs, fields])
  // Arrasta uma foto do painel "Imagens" de uma posição pra outra — só o valor da foto se move
  // (com zoom/posição/espelhamento juntos, porque foram ajustados pra ELA), os slides e a
  // quantidade de slots de cada um continuam os mesmos.
  const moverImagem = (from: number, to: number) => {
    if (from === to) return
    const values = imageSlots.map(({ slideIdx, slot }) => getSlotValue(slideDefs[slideIdx], fields[slideIdx], slot))
    const [item] = values.splice(from, 1)
    values.splice(to, 0, item)
    setFields(prev => {
      const next = [...prev]
      imageSlots.forEach(({ slideIdx, slot }, idx) => {
        next[slideIdx] = withSlotValue(slideDefs[slideIdx], next[slideIdx], slot, values[idx])
      })
      return next
    })
  }
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

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => setGeminiConfigured(!!s.geminiApiKey)).catch(() => {})
  }, [])

  const gerarPromptImagem = async (i: number, slot = 0): Promise<string | null> => {
    const fld = fields[i]
    const k = imgKey(i, slot)
    setImgPromptLoading(p => ({ ...p, [k]: true }))
    setImgPromptError(p => ({ ...p, [k]: '' }))
    try {
      const hasReferences = !!(profiles.find(p => p.id === profileId)?.imageStyleReference || imgReferences[k]?.length)
      const res = await fetch('/api/ai/image-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fld.title, subtitle: fld.subtitle, body: fld.body, tag: fld.tag, pillar, extra: imgExtraHint[k] || undefined, textAnchor: fld.textAnchor || undefined, hasReferences })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar o prompt')
      setImgPromptText(p => ({ ...p, [k]: data.prompt }))
      return data.prompt as string
    } catch (e) {
      setImgPromptError(p => ({ ...p, [k]: e instanceof Error ? e.message : 'Falha ao gerar o prompt' }))
      return null
    } finally {
      setImgPromptLoading(p => ({ ...p, [k]: false }))
    }
  }

  const copiarPromptImagem = (i: number, slot = 0) => {
    const k = imgKey(i, slot)
    navigator.clipboard.writeText(imgPromptText[k] || '')
    setImgPromptCopied(p => ({ ...p, [k]: true }))
    setTimeout(() => setImgPromptCopied(p => ({ ...p, [k]: false })), 1800)
  }

  const gerarImagemAgora = async (i: number, slot = 0, onStep?: (step: 'prompt' | 'image') => void) => {
    const k = imgKey(i, slot)
    setImgGenLoading(p => ({ ...p, [k]: true }))
    setImgPromptError(p => ({ ...p, [k]: '' }))
    try {
      // Se ainda não tem prompt gerado pra esse slide/slot, gera agora mesmo (a pessoa não
      // deveria precisar clicar em "Gerar prompt" antes só pra habilitar esse botão).
      let prompt = imgPromptText[k]
      if (!prompt) {
        onStep?.('prompt')
        prompt = (await gerarPromptImagem(i, slot)) || ''
      }
      if (!prompt) return
      onStep?.('image')
      // Referência de estilo do perfil (se tiver uma cadastrada) vai junto automaticamente —
      // sem passo manual nenhum — somada a qualquer referência escolhida à mão pra esse
      // slide/slot (galeria do perfil ou upload direto). Só tem efeito quando o provedor
      // ativo é o Gemini (OpenAI ignora, não aceita imagem de entrada nessa geração).
      const styleReference = profiles.find(p => p.id === profileId)?.imageStyleReference
      const manualRefs = imgReferences[k] || []
      const references: { image: string; note?: string }[] = [
        ...(styleReference ? [{ image: styleReference }] : []),
        ...manualRefs.map(r => ({ image: r.image, note: r.note || undefined })),
      ]
      const res = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, references: references.length ? references : undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar a imagem')
      // Toda imagem gerada em qualquer carrossel também cai na galeria do perfil — é o que
      // alimenta a Galeria Global do Gerador de Imagens (mesma tabela, sem duplicar sistema).
      if (profileId && data.image) {
        fetch('/api/gallery', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId, image: data.image, source: 'generated', prompt,
            references: references.length ? references.map(r => ({ url: r.image, note: r.note })) : undefined,
          })
        }).catch(() => {})
      }
      const def = slideDefs[i]
      const dims = await readImageDims(data.image)
      if (effectiveImageLayout(def, fields[i])) {
        setFields(prev => prev.map((f, idx) => {
          if (idx !== i) return f
          const images = [...f.images]; images[slot] = data.image
          const imageNaturalWs = [...f.imageNaturalWs]; imageNaturalWs[slot] = dims.w
          const imageNaturalHs = [...f.imageNaturalHs]; imageNaturalHs[slot] = dims.h
          return { ...f, images, imageNaturalWs, imageNaturalHs }
        }))
      } else {
        updateField(i, { image: data.image, imageNaturalW: dims.w, imageNaturalH: dims.h })
      }
    } catch (e) {
      setImgPromptError(p => ({ ...p, [k]: e instanceof Error ? e.message : 'Falha ao gerar a imagem' }))
    } finally {
      setImgGenLoading(p => ({ ...p, [k]: false }))
    }
  }

  // Botão geral do cabeçalho — varre TODOS os slides do carrossel, acha os que têm bloco
  // de imagem ligado mas ainda sem imagem nenhuma, e gera um por um (nunca em paralelo,
  // pra não virar bagunça de várias chamadas de CLI ao mesmo tempo), avisando o progresso.
  const [batchImgOpen, setBatchImgOpen] = useState(false)
  const [batchImgBusy, setBatchImgBusy] = useState(false)
  const [batchImgProgress, setBatchImgProgress] = useState('')

  // Slides com layout de várias fotos (double-bottom/triple-top) contam CADA slot vazio
  // separadamente — senão o botão em massa parava assim que o slot 0 tivesse imagem,
  // deixando o 2º/3º slot sempre sem gerar.
  const pendingImageSlides = (): Array<{ i: number; slot: number }> => slideDefs
    .flatMap((def, i) => {
      const f = fields[i]
      if (!f || !def.hasImage || f.hideImage) return []
      if (def.imageLayout && def.imageLayout !== 'none') {
        const count = IMG_COUNT[def.imageLayout] || 1
        return Array.from({ length: count }, (_, slot) => slot).filter(slot => !f.images?.[slot]).map(slot => ({ i, slot }))
      }
      return f.image ? [] : [{ i, slot: 0 }]
    })

  const gerarTodasImagens = async () => {
    const pending = pendingImageSlides()
    if (!pending.length || batchImgBusy) return
    setBatchImgBusy(true)
    for (let n = 0; n < pending.length; n++) {
      const { i, slot } = pending[n]
      setBatchImgProgress(`Imagem ${n + 1} de ${pending.length} — gerando prompt…`)
      await gerarImagemAgora(i, slot, step => {
        setBatchImgProgress(step === 'prompt'
          ? `Imagem ${n + 1} de ${pending.length} — gerando prompt…`
          : `Imagem ${n + 1} de ${pending.length} — gerando imagem… (pode levar até 1 min)`)
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
    // "Trocar modelo" também navega com ?carouselId= (pra continuar atualizando o mesmo
    // registro, em vez de criar um novo) e deixa um PendingGeneration já com a estrutura
    // nova esperando. Nesse caso específico, o conteúdo/estrutura vem de lá (efeito abaixo),
    // não do que já estava salvo — senão essa busca sobrescreveria a troca de volta pro
    // modelo antigo assim que o fetch terminasse.
    let skipContent = false
    try {
      const raw = sessionStorage.getItem(PENDING_GENERATION_KEY)
      if (raw) skipContent = (JSON.parse(raw) as PendingGeneration).carouselId === carouselId
    } catch { /* payload inválido, ignora */ }
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
        setPillar(c.briefing.pillar)
        if (!skipContent) {
          // Usa a def real do template (já carregada acima) — não reconstrói hasBody/hasTag
          // a partir do conteúdo salvo, senão um slide sem tag/corpo preenchido no momento
          // parece "não ter" esse campo mesmo quando o template define que ele existe.
          setSlideDefs(c.content.slides.map((s, i) => template.slides[i] || slideDefFromSlide(s, i)))
          setFields(c.content.slides.map(s => fieldFromSlide(s)))
          setCaption(c.content.caption || '')
        }
        setSavedIdBoth(c.id)
      })
      .catch(() => { /* se falhar, só continua com os padrões do template */ })
      .finally(() => setInitialLoadDone(true))
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
    // Guarda como o carrossel estava ANTES da troca — é o que permite "Desfazer" reverter
    // mesmo depois da navegação pro modelo novo (ver UNDO_MODEL_SWAP_KEY acima).
    try {
      const snapshot: UndoModelSwapSnapshot = {
        fromTemplateId: templateId, toTemplateId: newTemplateId,
        carouselId: savedId || carouselId || undefined, carouselTitle, pillar,
        slideDefs, slides: slidesContent, images,
      }
      sessionStorage.setItem(UNDO_MODEL_SWAP_KEY, JSON.stringify(snapshot))
    } catch {}
    const pending: PendingGeneration = {
      templateId: newTemplateId, carouselTitle, profileId, slideDefs: adaptedDefs, images, slides: slidesContent,
      carouselId: savedId || carouselId || undefined,
    }
    sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
    const targetId = savedId || carouselId
    router.push(`/template/${newTemplateId}${targetId ? `?carouselId=${targetId}` : ''}`)
  }

  // Refs sempre atualizadas de slideDefs/fields — updateField é useCallback (identidade
  // estável, recriado só quando targetIndices muda), então uma closure que lesse
  // slideDefs/fields direto do escopo do componente podia capturar um valor velho de um
  // render anterior. Lendo do ref em vez da variável, pushUndo/pushUndoThrottled sempre
  // pegam o estado mais recente, não importa de qual render a closure que os chama veio.
  const slideDefsRef = useRef(slideDefs)
  const fieldsRef = useRef(fields)
  useEffect(() => { slideDefsRef.current = slideDefs }, [slideDefs])
  useEffect(() => { fieldsRef.current = fields }, [fields])

  // Guarda o estado atual antes de uma ação que reestrutura o carrossel (trocar a estrutura
  // de um slide, colar/distribuir conteúdo, excluir slide) — é o que "Desfazer" restaura.
  const pushUndo = () => setUndoStack(prev => [...prev.slice(-14), { slideDefs: slideDefsRef.current, fields: fieldsRef.current }])

  // "Desfazer" só cobria as ações grandes acima — ajuste solto de campo (zoom, posição,
  // cor, degradê, tamanho...) nunca empurrava nada pro histórico, então Desfazer não fazia
  // nada depois de mexer num slider. Isso cobre esse caso, com throttle: sem isso, arrastar
  // um slider dispararia uma snapshot por PIXEL (o onChange dispara a cada tick), enchendo o
  // histórico com micro-estados e fazendo "1 desfazer" não voltar praticamente nada visível.
  // 700ms sem chamar de novo = considera que começou um gesto novo, salva 1 snapshot pra ele.
  const lastFieldPushRef = useRef(0)
  const pushUndoThrottled = () => {
    const now = Date.now()
    if (now - lastFieldPushRef.current > 700) {
      pushUndo()
      lastFieldPushRef.current = now
    }
  }

  // Detecta, assim que a página de um modelo novo carrega, se chegamos aqui através de
  // "Trocar modelo" (e não, por exemplo, abrindo um carrossel salvo direto) — só nesse caso
  // existe algo pra desfazer sem precisar de histórico em memória (que não sobrevive à troca).
  const [canUndoModelSwap, setCanUndoModelSwap] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UNDO_MODEL_SWAP_KEY)
      const snap: UndoModelSwapSnapshot | null = raw ? JSON.parse(raw) : null
      setCanUndoModelSwap(!!snap && snap.toTemplateId === templateId)
    } catch { setCanUndoModelSwap(false) }
  }, [templateId])

  const desfazer = () => {
    if (undoStack.length > 0) {
      const last = undoStack[undoStack.length - 1]
      setUndoStack(prev => prev.slice(0, -1))
      setSlideDefs(last.slideDefs)
      setFields(last.fields)
      return
    }
    if (!canUndoModelSwap) return
    try {
      const raw = sessionStorage.getItem(UNDO_MODEL_SWAP_KEY)
      if (!raw) return
      const snap = JSON.parse(raw) as UndoModelSwapSnapshot
      if (snap.toTemplateId !== templateId) return
      sessionStorage.removeItem(UNDO_MODEL_SWAP_KEY)
      const pending: PendingGeneration = {
        templateId: snap.fromTemplateId, carouselTitle: snap.carouselTitle, profileId,
        slideDefs: snap.slideDefs, images: snap.images, slides: snap.slides,
        pillar: snap.pillar, carouselId: snap.carouselId,
      }
      sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
      router.push(`/template/${snap.fromTemplateId}${snap.carouselId ? `?carouselId=${snap.carouselId}` : ''}`)
    } catch {}
  }

  const canUndo = undoStack.length > 0 || canUndoModelSwap

  // Vem do painel "Criar carrossel" (popup): a IA já distribuiu o conteúdo colado entre os
  // slides e o usuário já escolheu as imagens (na ordem) — só falta encaixar tudo nos campos
  // do editor, igual a se a pessoa tivesse preenchido manualmente slide por slide.
  useEffect(() => {
    if (!template) return
    const raw = sessionStorage.getItem(PENDING_GENERATION_KEY)
    if (!raw) {
      // Chegou direto num template (sem passar pelo wizard/chat) — ainda assim já nasce
      // com nome, pra "Salvar" nunca travar por falta de título. Só vale pra carrossel
      // realmente novo (sem ?carouselId=) — um já salvo tem seu nome carregado no efeito acima.
      if (!carouselId) setCarouselTitle(t => t || gerarNomeCarrossel())
      return
    }
    let pending: PendingGeneration
    try { pending = JSON.parse(raw) } catch { sessionStorage.removeItem(PENDING_GENERATION_KEY); if (!carouselId) setCarouselTitle(t => t || gerarNomeCarrossel()); return }
    // Isso só deve mexer em algo quando é: (a) carrossel realmente novo (sem ?carouselId= na
    // URL), ou (b) uma troca de modelo continuando ESSE MESMO carrossel (o "carouselId" que
    // veio dentro do pending bate com o da URL). Qualquer outro caso é resíduo de sessionStorage
    // de um fluxo abandonado — só limpa e não toca em nada do carrossel que está aberto agora.
    const isModelSwap = !!carouselId && pending.carouselId === carouselId
    if (carouselId && !isModelSwap) { sessionStorage.removeItem(PENDING_GENERATION_KEY); return }
    sessionStorage.removeItem(PENDING_GENERATION_KEY)
    if (pending.templateId !== template.id) return
    if (isModelSwap) setSavedIdBoth(pending.carouselId!)

    setCarouselTitle(pending.carouselTitle || gerarNomeCarrossel())
    if (pending.pillar) setPillar(pending.pillar)

    // A estrutura já vem ajustada pra quantidade de slides escolhida no wizard (pode ter
    // menos ou mais posições que o template padrão) — substitui os slideDefs por essa.
    const defs = pending.slideDefs?.length ? pending.slideDefs : template.slides
    setSlideDefs(defs)
    let imgCursor = 0
    const promptsByIndex: Record<string, string> = {}
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
        if (pending.imagePrompts?.[imgCursor]) promptsByIndex[imgKey(i)] = pending.imagePrompts[imgCursor]
        imgCursor++
      }
      // Destaques vindos do editor de roteiro (Banco de Narrativas) — cada entrada só entra
      // nesse slide se a palavra realmente aparece no título/subtítulo/corpo dele.
      if (pending.highlights?.length) {
        const slideText = `${patch.title ?? base.title} ${patch.subtitle ?? base.subtitle} ${patch.body ?? base.body}`.toLowerCase()
        const matched = pending.highlights.filter(h => h.word && slideText.includes(h.word.toLowerCase()))
        if (matched.length) patch.highlights = [...base.highlights, ...matched]
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
        setBrandTextVisible(p.brandTextVisible !== false)
        setBrandPosition(p.brandPosition || 'bl')
        setVerifiedBadge(p.verifiedBadge !== false)
      }).catch(() => {})
    }

    // Imagens com IA não foram geradas no painel "Criar Conteúdo" de propósito — sinaliza
    // aqui pra gerar sozinho, progressivamente, assim que os campos acima já estiverem no ar
    // (efeito separado logo abaixo, disparado só quando "fields" já tiver o conteúdo real).
    if (pending.autoGenerateImages) setAutoGenImages(true)
  }, [template, carouselId])

  // Dispara a geração em massa uma única vez, depois que os campos vindos do wizard já
  // estão no state (só aí "pendingImageSlides()" enxerga os slots vazios certos) — a pessoa
  // já está olhando pro editor com o texto pronto enquanto cada imagem vai aparecendo.
  const [autoGenImages, setAutoGenImages] = useState(false)
  useEffect(() => {
    if (!autoGenImages || fields.length === 0) return
    setAutoGenImages(false)
    gerarTodasImagens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenImages, fields.length])

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
    setBrandTextVisible(p.brandTextVisible !== false)
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
  // A estrutura nova pode ter campos diferentes da antiga (ex: capa não tem "corpo", modelo com
  // várias imagens usa images[] em vez de image) — sem migrar, o texto/imagem continuavam nos
  // campos antigos e simplesmente paravam de aparecer, dando a impressão de terem sumido.
  const trocarEstrutura = (targetIndex: number, base: SlideTemplateDef) => {
    pushUndo()
    const numero = targetIndex + 1
    const nomeBase = base.label.replace(/^\d+\s*·\s*/, '')
    setSlideDefs(prev => prev.map((d, i) => i === targetIndex
      ? { ...base, label: `${numero} · ${nomeBase}` }
      : d
    ))
    setFields(prev => prev.map((f, i) => {
      if (i !== targetIndex) return f
      const isCover = base.background === 'cover'
      const noBody = !base.hasBody && !isCover
      // Junta tudo que já tinha (título + subtítulo + corpo) numa lista única de "pedaços" de
      // texto, na ordem em que apareciam, pra redistribuir nos campos que a estrutura nova tem.
      const pedacos = [f.title, isCover ? (f.subtitle || f.body) : f.subtitle, noBody ? undefined : f.body].filter(Boolean) as string[]
      const novoTitle = noBody ? pedacos.join('\n\n') : (pedacos[0] || '')
      const novoSubtitle = isCover ? (pedacos[1] || pedacos.slice(1).join('\n\n')) : ''
      const novoBody = (!isCover && !noBody) ? (f.body || pedacos.slice(1).join('\n\n')) : ''
      const usaImagesArray = base.imageLayout && base.imageLayout !== 'none' && base.imageLayout !== 'top' && base.imageLayout !== 'bottom'
      const imagemUnica = f.image || f.images[0]
      return {
        ...f,
        title: novoTitle || f.title,
        subtitle: novoSubtitle || (isCover ? f.subtitle : ''),
        body: novoBody,
        image: (!usaImagesArray && base.hasImage) ? (f.image || imagemUnica) : undefined,
        images: (usaImagesArray && base.hasImage) ? (f.images.length ? f.images : (imagemUnica ? [imagemUnica] : [])) : f.images,
      }
    }))
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
    pushUndo()
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
    pushUndoThrottled()
    setFields(prev => {
      const targets = targetIndices(i)
      return prev.map((f, idx) => targets.has(idx) ? { ...f, ...patch } : f)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIndices])

  const setSlotArr = <T,>(arr: T[], slot: number, val: T, fallback: T): T[] => {
    const next = [...arr]
    while (next.length <= slot) next.push(fallback)
    next[slot] = val
    return next
  }
  const updateImgSlotZoom = (i: number, slot: number, v: number) => {
    pushUndoThrottled()
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => targets.has(idx) ? { ...f, imageZooms: setSlotArr(f.imageZooms, slot, v, 100) } : f))
  }
  const updateImgSlotPos = (i: number, slot: number, axis: 'x' | 'y', v: number) => {
    pushUndoThrottled()
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => {
      if (!targets.has(idx)) return f
      const cur = f.imagePositions[slot] || { x: 50, y: 50 }
      return { ...f, imagePositions: setSlotArr(f.imagePositions, slot, { ...cur, [axis]: v }, { x: 50, y: 50 }) }
    }))
  }
  const toggleImgSlotMirror = (i: number, slot: number) => {
    pushUndo()
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => {
      if (!targets.has(idx)) return f
      const cur = !!f.imageMirrors[slot]
      return { ...f, imageMirrors: setSlotArr(f.imageMirrors, slot, !cur, false) }
    }))
  }

  // Restaura só os campos passados pro padrão do MODELO (não zero/vazio) — usado nos botões
  // "restaurar padrão" das caixinhas. Antes usava emptyField() (zero puro), então "restaurar
  // padrão" apagava a margem/tamanho/cor que o modelo define (ex: Retrato & Texto com título
  // 60px) em vez de voltar pra esse valor configurado — parecia "trocar de modelo", não
  // "resetar". fieldFromDef(slideDefs[idx]) é o padrão de fábrica de verdade desse slide.
  const resetFields = (i: number, keys: (keyof FieldState)[]) => {
    const targets = targetIndices(i)
    setFields(prev => prev.map((f, idx) => {
      if (!targets.has(idx)) return f
      const defaults = fieldFromDef(slideDefs[idx])
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


  const distribuirConteudo = (text?: string) => {
    pushUndo()
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

  // Igual a distribuirConteudo, mas sem exigir TITULO:/TEXTO:/LISTA: — a pessoa cola o texto
  // corrido (ou já formatado, tanto faz) e a IA decide sozinha o que vira título, subtítulo,
  // corpo ou tag em cada slide, respeitando a estrutura do modelo atual. Nunca reescreve o
  // texto, só reorganiza — a chamada é a mesma se o modelo for trocado depois.
  const [bulkAILoading, setBulkAILoading] = useState(false)
  const [bulkAIError, setBulkAIError] = useState('')
  const distribuirConteudoIA = async (text?: string) => {
    const content = (text ?? bulkText).trim()
    if (!content) return
    setBulkAILoading(true)
    setBulkAIError('')
    try {
      const res = await fetch('/api/ai/distribute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, content })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao distribuir com IA')
      const slides = data.slides as Array<{ index: number; tag?: string; title?: string; subtitle?: string; body?: string }>
      pushUndo()
      setFields(prev => prev.map((f, i) => {
        const s = slides.find(x => x.index === i + 1)
        if (!s) return f
        return {
          ...f,
          tag: s.tag || f.tag,
          title: s.title || f.title,
          subtitle: s.subtitle || f.subtitle,
          body: s.body || f.body,
        }
      }))
      setBulkOpen(false)
      setBulkText('')
    } catch (e) {
      setBulkAIError(e instanceof Error ? e.message : 'Falha ao distribuir com IA')
    } finally {
      setBulkAILoading(false)
    }
  }

  // Refaz a copy do carrossel INTEIRO a partir de uma sugestão — diferente de "Refazer com
  // IA" (que só troca 1 campo por vez), isso reescreve todos os slides juntos, mantendo a
  // mesma estrutura (mesma função de cada slide — gancho continua gancho, CTA continua CTA),
  // porque mudar só uma headline não resolve quando o resto do carrossel foi escrito em cima
  // de outro ângulo/ideia. Reusa /api/ai/adjust-narrative (mesmo motor do "Ajustar Roteiro"
  // do Banco de Narrativas) — manda o carrossel atual como contexto, ela devolve tudo
  // reescrito no mesmo formato, e distribuirConteudo() já sabe encaixar isso nos campos
  // (inclusive fazendo o pushUndo — dá pra desfazer se não gostar do resultado).
  const regenerarCopyCompleto = async () => {
    setRegenLoading(true)
    setRegenError('')
    try {
      const content = fieldsToBulkText(fields.map((f, i) => ({
        tag: slideDefs[i]?.hasTag ? f.tag : '', title: f.title, subtitle: f.subtitle, body: f.body,
      })))
      const instruction = regenInstruction.trim()
        || 'Reescreva o carrossel inteiro do zero, mantendo o mesmo tema central e a mesma ideia, mas com abordagem, ângulo e frases novas — não repita as mesmas frases do original.'
      // Estrutura REAL de cada slide (não a do modelo original — reflete trocas manuais de
      // estrutura que a pessoa já tenha feito slide a slide) — evita a IA escrever um
      // parágrafo pra um slide "capa" no meio do carrossel, que não tem onde caber.
      const slideTypes = slideDefs.map(d => d.background === 'cover' ? 'cover' : !d.hasBody ? 'title-only' : 'body')
      const res = await fetch('/api/ai/adjust-narrative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, content, instruction, slideTypes }),
      }).then(r => r.json())
      if (res.error) throw new Error(res.error)
      distribuirConteudo(res.content)
      setRegenOpen(false)
      setRegenInstruction('')
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Falha ao regerar a copy')
    } finally {
      setRegenLoading(false)
    }
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
      saveUploadToGallery(dataUrl)
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
      saveUploadToGallery(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Upload manual (arquivo do computador) também entra na Galeria do perfil — antes só a
  // imagem gerada por IA dentro do carrossel caía lá, então toda foto que a pessoa já tinha
  // e só subiu direto ficava de fora, sem aparecer na Galeria depois.
  const saveUploadToGallery = (dataUrl: string) => {
    if (!profileId) return
    fetch('/api/gallery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, image: dataUrl, source: 'upload' }),
    }).catch(() => {})
  }

  // Aplica uma imagem já existente na galeria do perfil direto num slide/slot — mesmo destino
  // final do upload manual (uploadImage/uploadImageAt), só que sem precisar reler o arquivo:
  // a URL já persistida (/uploads/gallery/xxx.jpg) funciona direto como src.
  const applyGalleryImage = async (i: number, slot: number | undefined, url: string) => {
    const { w, h } = await readImageDims(url)
    if (slot !== undefined) {
      setFields(prev => prev.map((f, idx) => {
        if (idx !== i) return f
        const images = [...f.images]; images[slot] = url
        const imageNaturalWs = [...f.imageNaturalWs]; imageNaturalWs[slot] = w
        const imageNaturalHs = [...f.imageNaturalHs]; imageNaturalHs[slot] = h
        return { ...f, images, imageNaturalWs, imageNaturalHs }
      }))
    } else {
      updateField(i, { image: url, imageNaturalW: w, imageNaturalH: h })
    }
  }

  // Monta o Carousel completo (mesmo shape usado no resto do app) a partir dos campos preenchidos.
  // Calcula o "cover" certo em pixels reais (nunca em %), usando a largura/altura de
  // verdade da foto — só assim zoom amplia e posição arrasta sem NUNCA esticar a imagem.
  const computeCoverPx = (natW: number, natH: number, boxW: number, boxH: number, zoomPct: number) => {
    if (!natW || !natH || !boxW || !boxH) return undefined
    // "Cover" puro deixa pelo menos 1 eixo (o que não é o gargalo da proporção) com folga
    // ZERO por definição matemática — nesse eixo, arrastar a Posição não faz nada visível
    // até a pessoa aumentar o Zoom manualmente. Uma folga mínima de 12% garante que os dois
    // eixos tenham espaço real pra arrastar mesmo no zoom padrão (100%), sem inflar o
    // enquadramento padrão de toda imagem do app (esse cálculo é usado tanto na capa cheia
    // quanto nos cards de imagem comuns — uma folga grande aqui zoomava/cortava demais
    // toda foto de todo modelo, não só a capa). Pra explorar mais da foto, é o Zoom que
    // deve subir — o slider já vai bem mais alto agora (até 400%).
    const coverScale = Math.max(boxW / natW, boxH / natH) * 1.12
    const scale = coverScale * ((zoomPct || 100) / 100)
    return { w: Math.round(natW * scale), h: Math.round(natH * scale) }
  }

  const carousel: Carousel | null = useMemo(() => {
    if (!template || fields.length !== slideDefs.length) return null
    const slides: Slide[] = slideDefs.map((def, i) => {
      const f = fields[i]
      const eil = effectiveImageLayout(def, f)
      const contentW = 1080 - 2 * (f.marginH || 176)
      let imageBgSizePx: { w: number; h: number } | undefined
      let imageBgSizesPx: ({ w: number; h: number } | undefined)[] | undefined
      if (def.background === 'cover') {
        imageBgSizePx = computeCoverPx(f.imageNaturalW, f.imageNaturalH, 1080, 1350, f.imageZoom)
      } else if (eil) {
        const h = f.imageHeight || (eil === 'double-bottom' ? 340 : eil === 'triple-top' ? 400 : 480)
        const boxes: { w: number; h: number }[] =
          eil === 'double-bottom'
            ? [{ w: (contentW - 16) / 2, h }, { w: (contentW - 16) / 2, h }]
            : eil === 'triple-top'
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
        images: eil ? f.images.filter((x): x is string => !!x) : undefined,
        imageZooms: eil ? f.imageZooms : undefined,
        imagePositions: eil ? f.imagePositions : undefined,
        imageMirrors: eil ? f.imageMirrors : undefined,
        imageLayout: eil,
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
        titleCase: f.titleCase,
        imagePlacement: (eil === 'top' || eil === 'bottom') ? f.imagePlacement : undefined,
        bodyCase: f.bodyCase,
        hideAvatarRow: f.hideAvatarRow || undefined,
        avatarSize: f.avatarSizeOverride || undefined,
        handleSize: f.handleSizeOverride || undefined,
        handleColor: f.handleColorOverride || undefined,
        bgPattern: '',
        textLayout: '',
        marginH: f.marginH || 176,
        marginV: f.marginV || 0,
        marginVBottom: f.marginVBottom || undefined,
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
        fontHeadline: '', fontBody: '', avatarImage, brandText: brandTextVisible ? brandText : '', brandPosition,
        brandTextColor: brandTextColor || undefined, brandTextSize: brandTextSize || undefined, brandTextFont: brandTextFont || undefined,
        dotSize: dotSize !== 9 ? dotSize : undefined, dotsVisible: dotsVisible ? undefined : false,
        avatarSize, handleSize, handleColor: handleColor || undefined, verifiedBadge, pillar,
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
  }, [fields, handle, displayName, primaryColor, primaryColors, avatarImage, brandText, brandTextVisible, brandPosition, brandTextColor, brandTextSize, brandTextFont, dotSize, dotsVisible, avatarSize, handleSize, handleColor, verifiedBadge, pillar, carouselTitle, profileId, template, slideDefs, caption])

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
  // pelo botão "Salvar" quanto pelo "Baixar" (que precisa salvar antes de exportar) quanto
  // pelo autosave. savingPromiseRef serializa chamadas concorrentes (ex: autosave disparando
  // no exato momento em que a pessoa clica "Baixar") — sem isso, as duas liam savedId como
  // null ao mesmo tempo e cada uma criava seu PRÓPRIO carrossel novo em vez de atualizar o
  // mesmo (a causa dos registros duplicados/fantasma na Biblioteca).
  const savingPromiseRef = useRef<Promise<string | null> | null>(null)
  const salvarERetornarId = async (): Promise<string | null> => {
    if (savingPromiseRef.current) return savingPromiseRef.current
    const run = async (): Promise<string | null> => {
      if (!carousel) return null
      if (!carouselTitle.trim()) {
        setTitleMissing(true)
        titleInputRef.current?.focus()
        setTimeout(() => setTitleMissing(false), 2000)
        return null
      }
      setSaving(true)
      try {
        const res = await fetch('/api/carousels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...carousel, id: savedIdRef.current || undefined }),
        })
        const saved = await res.json()
        setSavedIdBoth(saved.id)
        return saved.id
      } finally {
        setSaving(false)
      }
    }
    const p = run()
    savingPromiseRef.current = p
    try {
      return await p
    } finally {
      savingPromiseRef.current = null
    }
  }

  const salvar = async () => {
    const id = await salvarERetornarId()
    if (id) {
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    }
  }

  // Salvamento automático — 2,5s depois da última mudança, sem precisar clicar em "Salvar".
  // Uma vez que o carrossel já tem conteúdo de verdade (ou já é um carrossel salvo antes),
  // ele fica salvo na Biblioteca desde então; se sair sem querer, o trabalho não some.
  // Duas guardas contra registro fantasma/duplicado na Biblioteca:
  // 1. `initialLoadDone` — se a URL tem ?carouselId=, espera confirmar (sucesso OU falha) se
  //    esse carrossel já existe antes de deixar o autosave rodar; senão ele dispara achando
  //    que é um carrossel novo (savedId ainda null) e cria um registro duplicado do mesmo.
  // 2. Só autosalva um carrossel NOVO (sem savedId nem ?carouselId=) depois que a pessoa
  //    escreveu ou colocou alguma imagem — abrir a tela e não mexer em nada não deveria virar
  //    um rascunho permanente sozinho na Biblioteca.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!carousel || saving || !initialLoadDone) return
    const isNewDraft = !savedIdRef.current && !carouselId
    const hasContent = fields.some(f =>
      f.title?.trim() || f.subtitle?.trim() || f.body?.trim() || f.tag?.trim() ||
      f.image || f.images?.some(Boolean))
    if (isNewDraft && !hasContent) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => { salvarERetornarId() }, 2500)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carousel, initialLoadDone])

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
  const eil = effectiveImageLayout(def, f)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" className="flex-shrink-0"><ArrowLeft size={18} style={{ color: 'var(--muted)' }}/></Link>
        <div className="relative flex-shrink min-w-0">
          <input ref={titleInputRef} value={carouselTitle} onChange={e => { setCarouselTitle(e.target.value); setTitleMissing(false) }}
            placeholder="Nome"
            className="font-bold text-sm px-2 py-1.5 rounded-lg w-full min-w-0"
            style={{ background: 'var(--bg3)', border: `1px solid ${titleMissing ? '#e05252' : 'var(--border)'}`, width: 90 }}/>
          {titleMissing && (
            <span className="absolute left-0 top-full mt-1 px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap z-10"
              style={{ background: '#e05252', color: '#fff' }}>
              Dá um nome antes de salvar
            </span>
          )}
        </div>
        <select value={profileId} onChange={e => aplicarPerfil(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs flex-shrink min-w-0" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', maxWidth: 150 }}>
          <option value="">Sem perfil</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="w-px h-6 flex-shrink-0" style={{ background: 'var(--border)' }}/>
        <div className="relative flex-shrink-0">
          <button onClick={() => setPerfilBlockOpen(v => !v)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: perfilBlockOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: perfilBlockOpen ? 'var(--accent2)' : 'var(--muted)', border: perfilBlockOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            Perfil <ChevronRight size={12} style={{ transform: perfilBlockOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
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
                  <button onClick={() => setBrandTextVisible(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Mostrar rodapé</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: brandTextVisible ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', color: brandTextVisible ? 'var(--accent2)' : 'var(--muted)' }}>
                      {brandTextVisible ? 'Sim' : 'Não'}
                    </span>
                  </button>
                  <input value={brandText} onChange={e => setBrandText(e.target.value)}
                    placeholder="Ex: Powered by Claude Viral"
                    disabled={!brandTextVisible}
                    className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
                  {brandTextVisible && brandText && (
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
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: bulkOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: bulkOpen ? 'var(--accent2)' : 'var(--muted)', border: bulkOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <ClipboardPaste size={13}/> Colar conteúdo
          </button>
          {bulkOpen && (
            <div className="fixed p-4 space-y-2 rounded-2xl overflow-y-auto z-50"
              style={{ top: bulkPos.top, left: bulkPos.left, width: 400, maxHeight: 'calc(100vh - 96px)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Colar todo o conteúdo</h3>
                <button onClick={() => setBulkOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{bulkInstructions(slideDefs).hint} Ou cola sem tag nenhuma e deixa a IA decidir onde cada parte entra.</p>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={8}
                placeholder={bulkInstructions(slideDefs).placeholder}
                className="w-full px-3 py-2 rounded-lg text-xs resize-none" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
              {bulkAIError && <p className="text-[11px]" style={{ color: '#ff8080' }}>{bulkAIError}</p>}
              <div className="flex gap-2">
                <button onClick={() => distribuirConteudo()} disabled={bulkAILoading}
                  className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  Distribuir nos {slideDefs.length} slides
                </button>
                <button onClick={() => distribuirConteudoIA()} disabled={bulkAILoading || !bulkText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>
                  <Sparkles size={13}/> {bulkAILoading ? 'Distribuindo…' : 'Distribuir com IA'}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button ref={regenBtnRef} onClick={() => regenOpen ? setRegenOpen(false) : openBelow(regenBtnRef, setRegenPos, setRegenOpen)}
            title="Reescreve todos os slides juntos — diferente de 'Refazer com IA' de um campo só, isso muda o carrossel inteiro coerentemente"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: regenOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: regenOpen ? 'var(--accent2)' : 'var(--muted)', border: regenOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <Sparkles size={13}/> Refazer copy do carrossel
          </button>
          {regenOpen && (
            <div className="fixed p-4 space-y-2.5 rounded-2xl overflow-y-auto z-50"
              style={{ top: regenPos.top, left: regenPos.left, width: 380, maxHeight: 'calc(100vh - 96px)', background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Refazer copy do carrossel inteiro</h3>
                <button onClick={() => setRegenOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Reescreve TODOS os slides juntos (mantendo a mesma estrutura — gancho continua gancho, CTA continua CTA), não só um campo. Dá pra desfazer depois com o botão &quot;Desfazer&quot; do topo.
              </p>
              <textarea value={regenInstruction} onChange={e => setRegenInstruction(e.target.value)} rows={4}
                placeholder='Ex: "muda o ângulo pra falar de medo em vez de curiosidade", "deixa mais direto e cru", "foca em quem já tentou e não conseguiu"... (deixe em branco pra só reescrever do zero mantendo a mesma ideia)'
                className="w-full px-3 py-2 rounded-lg text-xs resize-none" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
              {regenError && <p className="text-[11px]" style={{ color: '#ff8080' }}>{regenError}</p>}
              <button onClick={regenerarCopyCompleto} disabled={regenLoading}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-black disabled:opacity-60" style={{ background: 'var(--grad)' }}>
                {regenLoading ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>} {regenLoading ? 'Reescrevendo…' : `Reescrever os ${slideDefs.length} slides`}
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setIgPreviewOpen(true)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          <Smartphone size={13}/> Instagram
        </button>
        <div className="relative">
          <button ref={batchImgBtnRef}
            onClick={() => batchImgOpen ? setBatchImgOpen(false) : openBelow(batchImgBtnRef, setBatchImgPos, setBatchImgOpen)}
            disabled={batchImgBusy || (!batchImgOpen && pendingImageSlides().length === 0)}
            title={pendingImageSlides().length === 0 ? 'Todos os slides com bloco de imagem já têm imagem' : undefined}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap disabled:opacity-50"
            style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
            <Sparkles size={13}/> {batchImgBusy ? batchImgProgress : `Imagens${pendingImageSlides().length ? ` (${pendingImageSlides().length})` : ''}`}
          </button>
          {batchImgOpen && (
            <div className="fixed p-4 space-y-3 rounded-2xl z-50"
              style={{ top: batchImgPos.top, left: batchImgPos.left, width: 320, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Gerar imagens com IA</h3>
                <button onClick={() => setBatchImgOpen(false)} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {pendingImageSlides().length} imagem(ns) ainda faltam (contando cada foto de slides com mais de uma). Vou gerar um prompt e uma imagem pra cada, uma de cada vez (não em paralelo).
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
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: captionOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: captionOpen ? 'var(--accent2)' : 'var(--muted)', border: captionOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <Sparkles size={13}/> Legenda
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
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{ background: switchPickerOpen ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: switchPickerOpen ? 'var(--accent2)' : 'var(--muted)', border: switchPickerOpen ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            <Copy size={13}/> Modelo <ChevronRight size={12} style={{ transform: switchPickerOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
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
                  className="w-full text-left rounded-lg overflow-hidden disabled:opacity-40 flex items-center gap-2.5 p-2"
                  style={{ background: t.id === templateId ? 'var(--bg3)' : 'transparent' }}
                  onMouseOver={e => { if (t.id !== templateId) e.currentTarget.style.background = 'var(--bg3)' }}
                  onMouseOut={e => { if (t.id !== templateId) e.currentTarget.style.background = 'transparent' }}>
                  <span className="text-xs">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{t.name}</span>
                    {t.id === templateId && <span style={{ color: 'var(--muted)' }}> · atual</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={desfazer} disabled={!canUndo}
          title={canUndo ? 'Desfazer a última troca de estrutura/modelo/colagem' : 'Nada pra desfazer ainda'}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 disabled:opacity-40"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <Undo2 size={13}/> Desfazer
        </button>
        {savedMsg && <span className="text-xs font-semibold flex-shrink-0 whitespace-nowrap" style={{ color: '#4ade80' }}>Salvo ✓</span>}
        <button onClick={baixar} disabled={downloading || saving}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 ml-auto"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          <Download size={13}/> {downloading ? 'Gerando…' : 'Baixar'}
        </button>
        <button onClick={salvar} disabled={saving}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-black whitespace-nowrap flex-shrink-0"
          style={{ background: 'var(--grad)' }}>
          <Save size={13}/> {saving ? 'Salvando…' : 'Salvar'}
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

          <AccordionSection title="Conteúdo" icon={<FileText size={16}/>}
            onReset={() => resetFields(active, ['fontFamilyHead', 'fontFamilyBody', 'titleColor', 'bodyColor', 'titleSize', 'bodySize', 'subtitleSize', 'titleWeight', 'bodyWeight', 'titleLineHeight', 'bodyLineHeight', 'textAlign'])}>
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
            {def.hasTag && (
              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Tag (rótulo pequeno)</label>
                <input value={f.tag} onChange={e => updateField(active, { tag: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}/>
              </div>
            )}

            <AccordionSection title={def.background === 'cover' ? 'Headline (capa)' : def.isCTA ? 'Headline do CTA' : !def.hasBody ? 'Texto' : 'Título'} icon={<FileText size={14}/>}
              onReset={() => resetFields(active, ['fontFamilyHead', 'titleSize', 'titleWeight', 'titleLineHeight', 'titleCase'])}>
              <div className="mb-2">
                <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Fonte</label>
                <select value={f.fontFamilyHead} onChange={e => updateField(active, { fontFamilyHead: e.target.value })}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <option value="">{styleDefaultFont(def.style, 'head')} (padrão)</option>
                  {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-end mb-1">
                <AIRewriteField field="title" current={f.title} tag={f.tag} title={f.title} subtitle={f.subtitle} body={f.body}
                  isCTA={def.isCTA} profileId={profileId} pillar={pillar} onApply={text => updateField(active, { title: text })}/>
              </div>
              <RichTextField value={f.title} onChange={v => updateField(active, { title: v })} minHeight={def.hasBody ? 44 : 110}/>
              <CaseSelector value={f.titleCase} onChange={v => updateField(active, { titleCase: v })}/>
              <SliderField label="Tamanho" value={f.titleSize || (def.background === 'cover' ? 78 : 56)} min={24} max={130} unit="px"
                onChange={v => updateField(active, { titleSize: v })}/>
              <SliderField label="Espessura" value={f.titleWeight || 700} min={200} max={800} step={100}
                onChange={v => updateField(active, { titleWeight: v })}/>
              <SliderField label="Entre linhas" value={f.titleLineHeight || 1.3} min={0.9} max={2.2} step={0.05}
                onChange={v => updateField(active, { titleLineHeight: v })}/>
              <div className="flex items-center justify-between">
                <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor do texto</label>
                <ColorInput value={f.titleColor || '#ffffff'} onChange={v => updateField(active, { titleColor: v })} size={28}/>
              </div>
            </AccordionSection>

            {def.background === 'cover' && (
              <AccordionSection title="Subheadline" icon={<FileText size={14}/>}
                onReset={() => resetFields(active, ['fontFamilyBody', 'subtitleSize', 'bodyWeight', 'bodyLineHeight', 'bodyCase', 'bodyColor'])}>
                <div className="mb-2">
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Fonte</label>
                  <select value={f.fontFamilyBody} onChange={e => updateField(active, { fontFamilyBody: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <option value="">{styleDefaultFont(def.style, 'body')} (padrão)</option>
                    {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-end mb-1">
                  <AIRewriteField field="subtitle" current={f.subtitle} tag={f.tag} title={f.title} subtitle={f.subtitle} body={f.body}
                    isCTA={def.isCTA} profileId={profileId} pillar={pillar} onApply={text => updateField(active, { subtitle: text })}/>
                </div>
                <RichTextField value={f.subtitle} onChange={v => updateField(active, { subtitle: v })} minHeight={60}/>
                <CaseSelector value={f.bodyCase} onChange={v => updateField(active, { bodyCase: v })}/>
                <SliderField label="Tamanho" value={f.subtitleSize || 20} min={12} max={60} unit="px"
                  onChange={v => updateField(active, { subtitleSize: v })}/>
                <SliderField label="Espessura" value={f.bodyWeight || 500} min={200} max={800} step={100}
                  onChange={v => updateField(active, { bodyWeight: v })}/>
                <SliderField label="Entre linhas" value={f.bodyLineHeight || 1.4} min={0.9} max={2.2} step={0.05}
                  onChange={v => updateField(active, { bodyLineHeight: v })}/>
                <div className="flex items-center justify-between">
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor do texto</label>
                  <ColorInput value={f.bodyColor || '#ffffff'} onChange={v => updateField(active, { bodyColor: v })} size={28}/>
                </div>
              </AccordionSection>
            )}

            {def.hasBody && !def.isCTA && (
              <AccordionSection title="Corpo" icon={<FileText size={14}/>}
                onReset={() => resetFields(active, ['fontFamilyBody', 'bodySize', 'bodyWeight', 'bodyLineHeight', 'bodyCase', 'bodyColor'])}>
                <div className="mb-2">
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Fonte</label>
                  <select value={f.fontFamilyBody} onChange={e => updateField(active, { fontFamilyBody: e.target.value })}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <option value="">{styleDefaultFont(def.style, 'body')} (padrão)</option>
                    {FONTES.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-end mb-1">
                  <AIRewriteField field="body" current={f.body} tag={f.tag} title={f.title} subtitle={f.subtitle} body={f.body}
                    isCTA={def.isCTA} profileId={profileId} pillar={pillar} onApply={text => updateField(active, { body: text })}/>
                </div>
                <RichTextField value={f.body} onChange={v => updateField(active, { body: v })} minHeight={100}/>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Enter duas vezes = novo parágrafo.</p>
                <CaseSelector value={f.bodyCase} onChange={v => updateField(active, { bodyCase: v })}/>
                <SliderField label="Tamanho" value={f.bodySize || 30} min={14} max={50} unit="px"
                  onChange={v => updateField(active, { bodySize: v })}/>
                <SliderField label="Espessura" value={f.bodyWeight || 400} min={200} max={800} step={100}
                  onChange={v => updateField(active, { bodyWeight: v })}/>
                <SliderField label="Entre linhas" value={f.bodyLineHeight || 1.5} min={0.9} max={2.2} step={0.05}
                  onChange={v => updateField(active, { bodyLineHeight: v })}/>
                <div className="flex items-center justify-between">
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Cor do texto</label>
                  <ColorInput value={f.bodyColor || '#ffffff'} onChange={v => updateField(active, { bodyColor: v })} size={28}/>
                </div>
              </AccordionSection>
            )}

            {def.isCTA && (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Frase-ponte</label>
                    <AIRewriteField field="body" current={f.body} tag={f.tag} title={f.title} subtitle={f.subtitle} body={f.body}
                      isCTA profileId={profileId} pillar={pillar} onApply={text => updateField(active, { body: text })}/>
                  </div>
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

          {(def.hasImage || def.style === 'step-guide') && (
          <AccordionSection title="Imagem" icon={<ImageIcon size={16}/>}
            onReset={() => resetFields(active, ['image', 'images', 'hideImage', 'imageBelow', 'imagePlacement', 'imageEnabled', 'imagePosition', 'imageZoom', 'imageMirror', 'imagePositions', 'imageZooms', 'imageMirrors', 'imageHeight', 'gradientOn', 'gradientColor', 'gradientDir', 'gradientExtent', 'slideBg'])}>
          {!def.hasImage && def.style === 'step-guide' && (
            <button onClick={() => updateField(active, { imageEnabled: !f.imageEnabled })}
              className="w-full flex items-center justify-between px-1 py-1 mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Ativar imagem nesse slide</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: f.imageEnabled ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.imageEnabled ? 'var(--accent2)' : 'var(--muted)' }}>
                {f.imageEnabled ? 'Ligado' : 'Desligado — só texto'}
              </span>
            </button>
          )}
          {(def.hasImage || f.imageEnabled) && eil && (
            <button onClick={() => updateField(active, { hideImage: !f.hideImage })}
              className="w-full flex items-center justify-between px-1 py-1 mb-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Bloco de imagem nesse slide</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: !f.hideImage ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: !f.hideImage ? 'var(--accent2)' : 'var(--muted)' }}>
                {f.hideImage ? 'Removido — só texto' : 'Ligado'}
              </span>
            </button>
          )}
          {(def.hasImage || f.imageEnabled) && !f.hideImage && (eil === 'top' || eil === 'bottom') && (
            <div className="mb-2">
              <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Posição da imagem</label>
              <div className="flex gap-1 mt-1">
                {([
                  { value: 'top', label: 'Em cima do texto' },
                  ...(def.style === 'editorial-serif' && def.hasBody ? [{ value: 'middle', label: 'Abaixo do título' }] as const : []),
                  { value: 'bottom', label: 'Embaixo do texto' },
                ] as const).map(opt => (
                  <button key={opt.value} onClick={() => updateField(active, { imagePlacement: opt.value, imageBelow: opt.value === 'bottom' })}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.imagePlacement === opt.value ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.imagePlacement === opt.value ? 'var(--accent2)' : 'var(--muted)', border: f.imagePlacement === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!(def.hasImage || f.imageEnabled) ? null : f.hideImage ? null : eil ? (
            <div className="space-y-3">
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                {IMG_COUNT[eil] > 1 ? `Imagens (${IMG_COUNT[eil]})` : 'Imagem'}
              </label>
              {Array.from({ length: IMG_COUNT[eil] || 1 }).map((_, slot) => (
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
                  <button type="button" onClick={() => setPanelTab('gallery')}
                    className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <ImageIcon size={12}/> Selecionar da galeria
                  </button>
                  {/* Mesmo par de botões do slot único (capa) — "Gerar prompt" só escreve e
                      deixa copiar pra colar em outra ferramenta, "Gerar imagem" já gera aqui
                      dentro. Faltava só aqui no fluxo de múltiplas imagens (double-bottom,
                      triple-top etc), que tinha só o botão de gerar direto. */}
                  <div className="flex gap-1.5">
                    <button onClick={() => setImgGenPanel(p => ({ ...p, [imgKey(active, slot)]: p[imgKey(active, slot)] === 'prompt' ? undefined : 'prompt' }))}
                      disabled={imgGenLoading[imgKey(active, slot)] || imgPromptLoading[imgKey(active, slot)]}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-60"
                      style={{ background: imgGenPanel[imgKey(active, slot)] === 'prompt' ? 'rgba(255,138,30,0.24)' : 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
                      <Sparkles size={12}/> Gerar prompt
                    </button>
                    <button onClick={() => setImgGenPanel(p => ({ ...p, [imgKey(active, slot)]: p[imgKey(active, slot)] === 'image' ? undefined : 'image' }))}
                      disabled={imgGenLoading[imgKey(active, slot)] || imgPromptLoading[imgKey(active, slot)]}
                      title={!geminiConfigured ? 'Precisa da API key do Gemini em Configurações' : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-60"
                      style={{ background: 'var(--grad)', color: '#000' }}>
                      <Sparkles size={12}/> {(imgGenLoading[imgKey(active, slot)] || imgPromptLoading[imgKey(active, slot)]) ? 'Gerando…' : `Gerar imagem ${slot + 1}`}
                    </button>
                  </div>
                  {imgGenPanel[imgKey(active, slot)] && (
                    <div className="p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg3)', border: '1px solid var(--accent)' }}>
                      <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Direção extra pra IA (opcional)</label>
                      <textarea rows={2} className="w-full text-xs resize-none"
                        placeholder='Ex: "quero um close no rosto", "cena à noite", "sem gente na foto"...'
                        value={imgExtraHint[imgKey(active, slot)] || ''} onChange={e => setImgExtraHintFor(active, slot, e.target.value)}/>
                      <ImageReferencePicker
                        value={imgReferences[imgKey(active, slot)] || []}
                        onChange={v => setImgReferences(p => ({ ...p, [imgKey(active, slot)]: v }))}
                        gallery={profileGallery}/>
                      <button
                        onClick={async () => {
                          const action = imgGenPanel[imgKey(active, slot)]
                          if (action === 'prompt') await gerarPromptImagem(active, slot)
                          else await gerarImagemAgora(active, slot)
                          setImgGenPanel(p => ({ ...p, [imgKey(active, slot)]: undefined }))
                        }}
                        disabled={imgGenLoading[imgKey(active, slot)] || imgPromptLoading[imgKey(active, slot)]}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                        style={{ background: 'var(--grad)', color: '#000' }}>
                        {(imgGenLoading[imgKey(active, slot)] || imgPromptLoading[imgKey(active, slot)])
                          ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}
                        {(imgGenLoading[imgKey(active, slot)] || imgPromptLoading[imgKey(active, slot)]) ? 'Gerando…'
                          : imgGenPanel[imgKey(active, slot)] === 'prompt' ? 'Confirmar e gerar prompt' : 'Confirmar e gerar imagem'}
                      </button>
                    </div>
                  )}
                  {imgPromptError[imgKey(active, slot)] && (
                    <p className="text-[10px]" style={{ color: '#ff8080' }}>{imgPromptError[imgKey(active, slot)]}</p>
                  )}
                  {imgPromptText[imgKey(active, slot)] && (
                    <div className="p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text)' }}>{imgPromptText[imgKey(active, slot)]}</p>
                      <button onClick={() => copiarPromptImagem(active, slot)}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold"
                        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                        {imgPromptCopied[imgKey(active, slot)] ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar prompt</>}
                      </button>
                    </div>
                  )}
                  {f.images[slot] && (
                    <>
                      <img src={f.images[slot]} alt="" className="w-full h-20 object-cover rounded-lg"/>
                      <SliderField label="Zoom" value={f.imageZooms[slot] ?? 100} min={5} max={400}
                        onChange={v => updateImgSlotZoom(active, slot, v)} unit="%"/>
                      <SliderField label="Posição horizontal" value={f.imagePositions[slot]?.x ?? 50} min={0} max={100}
                        onChange={v => updateImgSlotPos(active, slot, 'x', v)} unit="%"/>
                      <SliderField label="Posição vertical" value={f.imagePositions[slot]?.y ?? 50} min={0} max={100}
                        onChange={v => updateImgSlotPos(active, slot, 'y', v)} unit="%"/>
                      {(f.imageZooms[slot] ?? 100) < 130 && (
                        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                          Posição em 0% ou 100% já é o limite da foto nesse zoom — aumenta o Zoom
                          primeiro pra liberar mais espaço pra arrastar.
                        </p>
                      )}
                      <button onClick={() => toggleImgSlotMirror(active, slot)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                        style={{ background: f.imageMirrors[slot] ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: f.imageMirrors[slot] ? 'var(--accent2)' : 'var(--muted)', border: f.imageMirrors[slot] ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                        <FlipHorizontal2 size={12}/> Espelhar
                      </button>
                    </>
                  )}
                </div>
              ))}
              <SliderField label="Altura do bloco de imagem" value={f.imageHeight || (eil === 'double-bottom' ? 340 : eil === 'triple-top' ? 400 : 480)}
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
              <button type="button" onClick={() => setPanelTab('gallery')}
                className="mt-1.5 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                <ImageIcon size={13}/> Selecionar da galeria
              </button>
              {f.image && <img src={f.image} alt="" className="mt-2 w-full h-24 object-cover rounded-lg"/>}

              {/* Gerar com IA — os dois botões ficam sempre visíveis logo abaixo da imagem;
                  a "Direção extra" só aparece depois de clicar em um deles, com um passo de
                  confirmar antes de rodar de verdade. */}
              <div className="mt-2 flex gap-1.5">
                <button onClick={() => setImgGenPanel(p => ({ ...p, [imgKey(active)]: p[imgKey(active)] === 'prompt' ? undefined : 'prompt' }))}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold"
                  style={{ background: imgGenPanel[imgKey(active)] === 'prompt' ? 'rgba(255,138,30,0.24)' : 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
                  <Sparkles size={13}/> Gerar prompt
                </button>
                <button onClick={() => setImgGenPanel(p => ({ ...p, [imgKey(active)]: p[imgKey(active)] === 'image' ? undefined : 'image' }))}
                  title={!geminiConfigured ? 'Precisa da API key do Gemini em Configurações' : undefined}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--grad)', color: '#000', opacity: imgGenPanel[imgKey(active)] === 'image' ? 1 : 0.9 }}>
                  <Sparkles size={13}/> Gerar imagem com IA
                </button>
              </div>

              {imgGenPanel[imgKey(active)] && (
                <div className="mt-2 p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg2)', border: '1px solid var(--accent)' }}>
                  <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Direção extra pra IA (opcional)</label>
                  <textarea rows={2} className="w-full text-xs resize-none"
                    placeholder='Ex: "quero um close no rosto", "cena à noite", "sem gente na foto"...'
                    value={imgExtraHint[imgKey(active)] || ''} onChange={e => setImgExtraHintFor(active, 0, e.target.value)}/>
                  <ImageReferencePicker
                    value={imgReferences[imgKey(active)] || []}
                    onChange={v => setImgReferences(p => ({ ...p, [imgKey(active)]: v }))}
                    gallery={profileGallery}/>
                  <button
                    onClick={async () => {
                      const action = imgGenPanel[imgKey(active)]
                      if (action === 'prompt') await gerarPromptImagem(active)
                      else await gerarImagemAgora(active)
                      setImgGenPanel(p => ({ ...p, [imgKey(active)]: undefined }))
                    }}
                    disabled={imgGenLoading[imgKey(active)] || imgPromptLoading[imgKey(active)]}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                    style={{ background: 'var(--grad)', color: '#000' }}>
                    {(imgGenLoading[imgKey(active)] || imgPromptLoading[imgKey(active)])
                      ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}
                    {(imgGenLoading[imgKey(active)] || imgPromptLoading[imgKey(active)]) ? 'Gerando…'
                      : imgGenPanel[imgKey(active)] === 'prompt' ? 'Confirmar e gerar prompt' : 'Confirmar e gerar imagem'}
                  </button>
                </div>
              )}
              {imgPromptError[imgKey(active)] && (
                <p className="text-[10px] mt-2" style={{ color: '#ff8080' }}>{imgPromptError[imgKey(active)]}</p>
              )}
              {imgPromptText[imgKey(active)] && (
                <div className="mt-2 p-2.5 rounded-lg space-y-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text)' }}>{imgPromptText[imgKey(active)]}</p>
                  <button onClick={() => copiarPromptImagem(active)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {imgPromptCopied[imgKey(active)] ? <><Check size={12}/> Copiado</> : <><Copy size={12}/> Copiar prompt</>}
                  </button>
                  {!geminiConfigured && (
                    <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      Cola esse prompt em qualquer ferramenta de imagem (ChatGPT, Gemini...), ou configure sua API key do Gemini em <Link href="/settings" className="underline">Configurações</Link> pra gerar direto aqui.
                    </p>
                  )}
                </div>
              )}

              {f.image && (
                <div className="mt-2 space-y-2">
                  <SliderField label="Zoom" value={f.imageZoom} min={5} max={400} unit="%"
                    onChange={v => updateField(active, { imageZoom: v })}/>
                  <SliderField label="Posição horizontal" value={f.imagePosition.x} min={0} max={100} unit="%"
                    onChange={v => updateField(active, { imagePosition: { ...f.imagePosition, x: v } })}/>
                  <SliderField label="Posição vertical" value={f.imagePosition.y} min={0} max={100} unit="%"
                    onChange={v => updateField(active, { imagePosition: { ...f.imagePosition, y: v } })}/>
                  {f.imageZoom < 130 && (
                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                      Posição em 0% ou 100% já é o limite da foto nesse zoom — se ainda sobra parte
                      que você quer mostrar, aumenta o Zoom primeiro (isso libera mais espaço pra
                      arrastar a Posição).
                    </p>
                  )}
                  <button onClick={() => updateField(active, { imageMirror: !f.imageMirror })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: f.imageMirror ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', color: f.imageMirror ? 'var(--accent2)' : 'var(--muted)', border: f.imageMirror ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                    <FlipHorizontal2 size={12}/> Espelhar imagem
                  </button>
                </div>
              )}
            </div>
          )}

          {(f.image || f.images.some(Boolean)) && (
            <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
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
            </div>
          )}
          {def.background !== 'cover' && (
            <div className="pt-3 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Fundo do slide</label>
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
            </div>
          )}
          </AccordionSection>
          )}

          <AccordionSection title="Layout" icon={<MoveVertical size={16}/>}
            onReset={() => resetFields(active, ['marginH', 'marginV', 'marginVBottom', 'blockGap', 'textAnchor'])}>
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
            <SliderField label="Lateral" value={f.marginH || 176} min={20} max={400} step={4} unit="px"
              onChange={v => updateField(active, { marginH: v })}/>
            <SliderField label="Topo extra" value={f.marginV || 0} min={-100} max={200} step={4} unit="px"
              onChange={v => updateField(active, { marginV: v })}/>
            <SliderField label="Margem inferior extra" value={f.marginVBottom || 0} min={-100} max={200} step={4} unit="px"
              onChange={v => updateField(active, { marginVBottom: v })}/>
            <SliderField label="Entre blocos" value={f.blockGap || 24} min={0} max={100} step={2} unit="px"
              onChange={v => updateField(active, { blockGap: v })}/>
          </AccordionSection>

          <AccordionSection title="Badge de Perfil" icon={<Copy size={16}/>}
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

        {/* Preview ao vivo — slide real é 1080x1350, escalado pra caber. Edição de texto
            fica só no painel da lateral esquerda, não aqui (o preview é só visualização).
            O painel de zoom fica sempre LOGO ABAIXO do slide, no fluxo normal (nunca
            sticky/flutuante) — sticky ficava sobreposto por cima da própria imagem. O
            conteúdo usa margin:auto em vez de justify-content:center — assim, com zoom
            alto, dá pra rolar até ver o slide inteiro em vez de cortar sem jeito de
            alcançar o resto. */}
        <div className="flex-1 relative overflow-auto flex flex-col items-center p-8" style={{ background: 'var(--bg-grad)' }}>
          <div className="flex flex-col items-center gap-3" style={{ margin: 'auto' }}>
            <ScaledSlide html={slideHTML(active)} bodyHtml={slideBodyHTML(active)} cssVars={cssVars}
              boxWidth={Math.round(450 * (previewZoom / 100))} boxHeight={Math.round(562 * (previewZoom / 100))}/>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
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
        </div>

        {/* Trilha de miniaturas — arrasta pra reordenar, X pra excluir, + no final pra adicionar */}
        <div className="w-56 flex-shrink-0 overflow-auto p-3 pb-16 space-y-3" style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg3)' }}>
            <button onClick={() => setPanelTab('slides')} className="flex-1 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: panelTab === 'slides' ? 'var(--bg2)' : 'transparent', color: panelTab === 'slides' ? 'var(--text)' : 'var(--muted)' }}>
              Slides
            </button>
            <button onClick={() => setPanelTab('images')} className="flex-1 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: panelTab === 'images' ? 'var(--bg2)' : 'transparent', color: panelTab === 'images' ? 'var(--text)' : 'var(--muted)' }}>
              Imagens
            </button>
            <button onClick={() => setPanelTab('gallery')} className="flex-1 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: panelTab === 'gallery' ? 'var(--bg2)' : 'transparent', color: panelTab === 'gallery' ? 'var(--text)' : 'var(--muted)' }}>
              Galeria
            </button>
          </div>
          {panelTab === 'gallery' && (
            <>
              <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
                {profileGallery.length === 0
                  ? 'Nenhuma imagem ainda em nenhum perfil — toda imagem gerada ou enviada aparece aqui.'
                  : `Clica numa foto pra aplicar no slide ${active + 1} (slide atual).`}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {profileGallery.map(g => {
                  const def = slideDefs[active]
                  const f = fields[active]
                  const eil = effectiveImageLayout(def, f)
                  const targetSlot = eil ? (() => {
                    const count = IMG_COUNT[eil] || 1
                    const empty = Array.from({ length: count }, (_, s) => s).find(s => !f?.images?.[s])
                    return empty ?? 0
                  })() : undefined
                  return (
                    <button key={g.id} onClick={() => applyGalleryImage(active, targetSlot, g.url)}
                      className="relative rounded-lg overflow-hidden aspect-square hover:opacity-80" style={{ border: '1px solid var(--border)' }}>
                      <img src={g.url} alt="" className="w-full h-full object-cover"/>
                      {g.source === 'generated' && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 rounded text-[8px] font-bold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>IA</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {panelTab === 'images' && (
            <>
              <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
                {imageSlots.length === 0
                  ? 'Nenhum slide desse carrossel tem bloco de imagem.'
                  : 'Arrasta pra trocar a foto de posição entre os slides.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {imageSlots.map(({ slideIdx, slot }, flatIdx) => {
                  const def = slideDefs[slideIdx]
                  const f = fields[slideIdx]
                  const v = getSlotValue(def, f, slot)
                  const eil = effectiveImageLayout(def, f)
                  return (
                    <div key={`${slideIdx}-${slot}`}
                      draggable
                      onDragStart={() => setImgDragIndex(flatIdx)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => { if (imgDragIndex !== null && imgDragIndex !== flatIdx) moverImagem(imgDragIndex, flatIdx); setImgDragIndex(null) }}
                      onDragEnd={() => setImgDragIndex(null)}
                      onClick={() => setActive(slideIdx)}
                      className="relative cursor-move rounded-lg overflow-hidden group aspect-square"
                      style={{ border: active === slideIdx ? '2px solid var(--accent)' : '1px solid var(--border)', opacity: imgDragIndex === flatIdx ? 0.4 : 1, background: 'var(--bg3)' }}>
                      {v.image ? (
                        <img src={v.image} alt="" className="w-full h-full object-cover"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={18} style={{ color: 'var(--muted)' }}/>
                        </div>
                      )}
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                        {slideIdx + 1}
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <label onClick={e => e.stopPropagation()} title={v.image ? 'Trocar imagem' : 'Enviar imagem'}
                          className="p-1 rounded-full cursor-pointer" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                          <Upload size={11}/>
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (eil) uploadImageAt(slideIdx, slot, file); else uploadImage(slideIdx, file)
                          }}/>
                        </label>
                        {v.image && (
                          <button onClick={e => { e.stopPropagation(); if (eil) removeImgSlot(slideIdx, slot); else removeImage(slideIdx) }}
                            title="Remover imagem" className="p-1 rounded-full" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                            <X size={11}/>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {panelTab === 'slides' && (
          <>
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
          </>
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
// Botão "Gerar/Refazer com IA" pra um campo de texto específico (título, subtítulo ou corpo)
// — abre um popover com instrução extra opcional e devolve 3 variações pra escolher. Cada
// campo tem o seu (não é um botão só pro slide inteiro), porque às vezes só o título tá ruim.
function AIRewriteField({ field, current, tag, title, subtitle, body, isCTA, profileId, pillar, onApply }: {
  field: 'title' | 'subtitle' | 'body'
  current: string
  tag: string; title: string; subtitle: string; body: string
  isCTA?: boolean
  profileId?: string
  pillar?: ContentPillar
  onApply: (text: string) => void
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  // top/bottom são exclusivos entre si — quando não cabe espaço embaixo do botão até o fim
  // da tela, o popover abre pra CIMA (ancorado por "bottom") em vez de vazar pra fora da
  // viewport sem jeito nenhum de rolar até o resto (era o bug: sempre abria só pra baixo,
  // com altura livre, e as 3 sugestões cortavam no fim da tela quando o botão tava embaixo).
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; maxHeight: number }>({ top: 0, left: 0, maxHeight: 400 })
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [options, setOptions] = useState<string[]>([])

  const gerar = async () => {
    setLoading(true); setError(''); setOptions([])
    try {
      const res = await fetch('/api/ai/rewrite-field', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, tag, title, subtitle, body, isCTA, profileId, pillar, instruction: instruction.trim() || undefined })
      }).then(r => r.json())
      if (res.error) setError(res.error)
      else setOptions(res.options || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar opções')
    }
    setLoading(false)
  }

  const toggle = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - 468))
      const spaceBelow = window.innerHeight - r.bottom - 12
      const spaceAbove = r.top - 12
      // Só abre pra cima quando embaixo tem pouco espaço E em cima tem mais — evita virar
      // pra cima à toa quando dá tranquilo pra baixo.
      if (spaceBelow < 320 && spaceAbove > spaceBelow) {
        setPos({ bottom: window.innerHeight - r.top + 6, left, maxHeight: spaceAbove })
      } else {
        setPos({ top: r.bottom + 6, left, maxHeight: spaceBelow })
      }
    }
    setOptions([]); setError(''); setOpen(true)
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle}
        className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--accent2)' }}>
        <Sparkles size={11}/> {current.trim() ? 'Refazer com IA' : 'Gerar com IA'}
      </button>
      {open && (
        <div className="fixed z-50 p-3 rounded-xl space-y-2.5 flex flex-col"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: 460, maxHeight: pos.maxHeight, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
          <div className="flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-bold flex items-center gap-1.5"><Sparkles size={13} style={{ color: 'var(--accent2)' }}/> Gerar com IA</span>
            <button onClick={() => setOpen(false)} style={{ color: 'var(--muted)' }}><X size={14}/></button>
          </div>
          <textarea rows={2} className="w-full text-xs resize-none flex-shrink-0" placeholder="Instrução extra (opcional) — ex: mais curto, tom de pergunta, foco em..."
            value={instruction} onChange={e => setInstruction(e.target.value)}/>
          <button onClick={gerar} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold disabled:opacity-60 flex-shrink-0"
            style={{ background: 'var(--grad)', color: '#000' }}>
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>} {loading ? 'Gerando…' : options.length ? 'Gerar de novo' : 'Gerar 3 opções'}
          </button>
          {error && <p className="text-[10px] flex-shrink-0" style={{ color: '#ff8080' }}>{error}</p>}
          {options.length > 0 && (
            // Empilhado (1 coluna) em vez de 3 colunas apertadas — cada headline precisa de
            // largura pra ler inteira sem espremer em 3 linhas minúsculas. A lista rola por
            // dentro (overflow-y) quando a tela é curta, em vez de cortar a última opção.
            <div className="space-y-2 overflow-y-auto min-h-0">
              {options.map((opt, i) => (
                <button key={i} onClick={() => { onApply(opt); setOpen(false); setOptions([]) }}
                  className="w-full p-2.5 rounded-lg text-left text-xs leading-snug transition-colors hover:brightness-125"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

const HL_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#eab308', '#a855f7', '#ffffff']

// Barra de formatação — em cima da pré-visualização central ela só aparece quando a pessoa
// seleciona um trecho ali (active=true nesse caso, sempre). Em cima dos campos da barra
// lateral (título/subtítulo/corpo) ela fica sempre visível, tipo Word/Google Docs: os botões
// ficam desabilitados até a pessoa selecionar um trecho no campo de baixo, aí é só clicar.
// Converte o texto simples salvo (**negrito**, *itálico*, ++sublinhado++, {{color:#hex}}...
// {{/color}}) pro HTML que a caixa de edição mostra — mesma marcação que o motor de
// renderização final (html-renderer.ts) já entende, então o que aparece aqui é o que sai
// no carrossel.
function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\+\+(.*?)\+\+/g, '<u>$1</u>')
    .replace(/\{\{color:(#[0-9a-fA-F]{3,8})\}\}(.*?)\{\{\/color\}\}/g, '<span style="color:$1">$2</span>')
    .replace(/\n/g, '<br>')
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g)
  if (!m) return '#000000'
  return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

// Caminho inverso — lê o HTML que ficou na caixa depois de editar/formatar e devolve pro
// texto simples com a mesma marcação, pra salvar em f.title/f.subtitle/f.body sem mudar o
// formato de dados (continua compatível com o que a IA já gera e com o parser de colagem).
function htmlToMd(root: Node): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { out += node.textContent || ''; return }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'BR') { out += '\n'; return }
    if (tag === 'DIV' || tag === 'P') { if (out.length > 0 && !out.endsWith('\n')) out += '\n' }
    let open = '', close = ''
    if (tag === 'B' || tag === 'STRONG') { open = close = '**' }
    else if (tag === 'I' || tag === 'EM') { open = close = '*' }
    else if (tag === 'U') { open = close = '++' }
    else if (tag === 'FONT' && el.getAttribute('color')) { open = `{{color:${el.getAttribute('color')}}}`; close = '{{/color}}' }
    else if (tag === 'SPAN' && el.style.color) { open = `{{color:${rgbToHex(el.style.color)}}}`; close = '{{/color}}' }
    out += open
    el.childNodes.forEach(walk)
    out += close
  }
  root.childNodes.forEach(walk)
  return out
}

// Campo de texto rico — negrito/itálico/sublinhado/cor aparecem DE VERDADE dentro da caixa
// enquanto edita (tipo Word/Docs), em vez de só no preview final. Guarda a última seleção
// real feita dentro da caixa (savedRange) pra sobreviver ao clique no seletor de cor (que
// tira o foco do campo) — sem isso, a cor seria aplicada no lugar errado ou em nada.
function RichTextField({ value, onChange, placeholder, minHeight = 40 }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const lastValue = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const [lastColor, setLastColor] = useState(HL_COLORS[0])
  // O seletor de cor manda onChange a cada pixel arrastado (pra dar feedback ao vivo).
  // Sem isso, cada frame do arraste re-selecionava tudo e criava um <span> novo por cima do
  // anterior — dezenas de spans aninhados em poucos segundos, corrompendo o texto. Guarda o
  // span criado na PRIMEIRA aplicação do arraste atual e só recolore ele nos frames seguintes;
  // é invalidado assim que a pessoa mexe na seleção/cursor de novo (novo trecho = novo span).
  const activeColorSpan = useRef<HTMLSpanElement | null>(null)
  const clearActiveColorSpan = () => { activeColorSpan.current = null }

  useLayoutEffect(() => {
    if (!ref.current || value === lastValue.current) return
    ref.current.innerHTML = mdToHtml(value)
    lastValue.current = value
  }, [value])

  const emitChange = () => {
    if (!ref.current) return
    const md = htmlToMd(ref.current)
    lastValue.current = md
    onChange(md)
  }

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  // Sem seleção de verdade (nunca marcou nada, ou só tem o cursor piscando) — aplica no
  // TEXTO INTEIRO em vez de não fazer nada. Só respeita um trecho específico quando a
  // pessoa realmente selecionou esse trecho antes de clicar em B/I/cor.
  const restoreSelection = () => {
    const sel = window.getSelection()
    if (!sel) return
    const hasRealSelection = !!savedRange.current && !savedRange.current.collapsed
    if (hasRealSelection) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current!)
    } else if (ref.current) {
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }

  const run = (fn: () => void) => {
    ref.current?.focus()
    restoreSelection()
    fn()
    emitChange()
  }

  const toggle = (cmd: 'bold' | 'italic' | 'underline') => run(() => {
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(cmd)
  })
  // Cor não usa execCommand('foreColor', ...) — essa API é antiga e inconsistente entre
  // navegadores. Em vez disso, envolve manualmente a seleção real num <span style="color:
  // ...">. IMPORTANTE: sempre extractContents()+insertNode() (nunca surroundContents) —
  // surroundContents lança exceção (ou, em alguns navegadores, corrompe o DOM duplicando
  // texto) sempre que a seleção não bate exatamente com a borda de um nó existente, o que
  // é o caso comum quando já tem outra palavra colorida do lado. extractContents cobre
  // esse caso e qualquer outro de forma confiável.
  const applyColor = (hex: string) => {
    // Continuação do mesmo arraste (o span já existe e ainda está no texto) — só recolore,
    // sem mexer em seleção nem criar outro span por cima.
    if (activeColorSpan.current && ref.current?.contains(activeColorSpan.current)) {
      activeColorSpan.current.style.color = hex
      setLastColor(hex)
      emitChange()
      return
    }
    run(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { setLastColor(hex); return }
      const range = sel.getRangeAt(0)
      const span = document.createElement('span')
      span.style.color = hex
      span.appendChild(range.extractContents())
      range.insertNode(span)
      ref.current?.normalize()
      sel.removeAllRanges()
      activeColorSpan.current = span
      setLastColor(hex)
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 relative">
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => toggle('bold')} title="Negrito"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>B</button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => toggle('italic')} title="Itálico"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold italic" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>I</button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => toggle('underline')} title="Sublinhado"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold underline" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>S</button>
        <div className="w-px h-5 mx-0.5" style={{ background: 'var(--border)' }}/>
        <div onMouseDown={e => e.preventDefault()} title="Cor do texto">
          <ColorInput value={lastColor} onChange={applyColor} size={20}/>
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onSelect={saveSelection}
        onMouseDown={clearActiveColorSpan}
        onMouseUp={saveSelection}
        onKeyDown={clearActiveColorSpan}
        onKeyUp={saveSelection}
        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')) }}
        data-placeholder={placeholder}
        className="rich-text-field w-full px-3 py-2 rounded-lg text-sm"
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', minHeight, outline: 'none', whiteSpace: 'pre-wrap' }}
      />
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

type TextCase = 'uppercase' | 'lowercase' | 'capitalize' | 'none'
const CASE_OPTIONS: { value: TextCase; label: string }[] = [
  { value: 'none', label: 'Aa' },
  { value: 'uppercase', label: 'ABC' },
  { value: 'lowercase', label: 'abc' },
  { value: 'capitalize', label: 'Abc' },
]

// Maiúsculo/minúsculo/primeira-maiúscula/como digitou — via CSS text-transform, não mexe
// no texto salvo (então trocar de opção nunca perde o que a pessoa escreveu).
function CaseSelector({ value, onChange }: { value: TextCase; onChange: (v: TextCase) => void }) {
  return (
    <div>
      <label className="text-[10px]" style={{ color: 'var(--muted)' }}>Caixa do texto</label>
      <div className="flex gap-1 mt-1">
        {CASE_OPTIONS.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: value === o.value ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: value === o.value ? 'var(--accent2)' : 'var(--muted)', border: value === o.value ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SliderField({ label, value, onChange, min, max, step = 1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  // Campo de número digitável: NÃO clampa a cada tecla (senão "450" vira "150" no meio
  // da digitação, porque "4" e "45" já são menores que o mínimo). Só valida ao sair do campo.
  // Sincroniza com "value" durante o render (padrão oficial do React pra "ajustar state
  // quando uma prop muda") em vez de useEffect — evita o round-trip extra de render.
  const [text, setText] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(String(value))
  }
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
  // Captura o html só na primeira renderização (useState, não useRef — ref não pode ser lido
  // durante o render; state sim, e como nunca é atualizado depois, o efeito é o mesmo: o
  // iframe monta uma vez só e as próximas mudanças chegam via postMessage, sem recarregar).
  const [initialHtml] = useState(html)
  const loadedRef = useRef(false)
  const pendingRef = useRef<Array<Record<string, unknown>>>([])

  const send = (msg: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow
    if (!win || !loadedRef.current) { pendingRef.current.push(msg); return }
    win.postMessage(msg, '*')
  }

  useEffect(() => {
    send({ type: 'slide-update', html: bodyHtml })
  }, [bodyHtml])

  useEffect(() => {
    if (cssVars) send({ type: 'vars-update', vars: cssVars })
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
        srcDoc={initialHtml}
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
