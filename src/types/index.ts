export interface Profile {
  id: string
  name: string
  instagram: string
  niche: string
  audience: string
  tone: string
  contentType: string
  extraInstructions: string
  primaryColor: string
  primaryColors?: string[] // 2 a 4 entradas = degradê; ausente/1 entrada = usa primaryColor (sólida)
  logo?: string
  brandText?: string
  brandPosition?: 'tl' | 'tr' | 'bl' | 'br'
  verifiedBadge?: boolean
  createdAt: string
}

export type VisualStyle = 'minimal' | 'profile' | 'creators' | 'techviral'
export type CarouselType = 'tendencia' | 'tese' | 'case' | 'previsao'
export type SlideCount = 5 | 7 | 9 | 12
export type SlideBackground = 'dark' | 'light' | 'gradient' | 'cover'
export type SlideStyle = 'classic' | 'editorial-serif' | 'bold-sans' | 'step-guide' | 'photo-block'
export type ImageLayout = 'none' | 'top' | 'bottom' | 'double-bottom' | 'triple-top'

export interface SlideHighlight {
  word: string
  color: string
  colors?: string[] // 2 a 4 entradas = degradê no texto; ausente/1 entrada = usa color (sólida)
  fontFamily?: string
  underline?: boolean
  italic?: boolean
  weight?: number
  background?: string
}

export interface Slide {
  id: string
  index: number
  background: SlideBackground
  tag: string
  title: string
  titleSize: number
  subtitle: string
  subtitleSize: number
  bodySize?: number
  fontFamilyHead?: string
  fontFamilyBody?: string
  style?: SlideStyle
  imageLayout?: ImageLayout
  imageHeight?: number
  blockGap?: number
  titleColor?: string
  bodyColor?: string
  titleWeight?: number
  bodyWeight?: number
  titleLineHeight?: number
  bodyLineHeight?: number
  textAnchor?: 'top' | 'center' | 'bottom'
  textAlign?: 'left' | 'right' | 'center' | 'justify'
  gradientOn?: boolean
  gradientColor?: string
  gradientDir?: 'top' | 'bottom' | 'left' | 'right'
  gradientExtent?: number
  imageBgSizePx?: { w: number; h: number }
  imageBgSizesPx?: ({ w: number; h: number } | undefined)[]
  imageNaturalW?: number
  imageNaturalH?: number
  imageNaturalWs?: number[]
  imageNaturalHs?: number[]
  avatarSize?: number
  handleSize?: number
  handleColor?: string
  images?: string[] // base64, usado quando imageLayout precisa de mais de 1 imagem
  hideImage?: boolean // remove o bloco/card de imagem inteiro desse slide, mesmo o template tendo imagem por padrão
  imageZooms?: number[]
  imagePositions?: { x: number; y: number }[]
  imageMirrors?: boolean[]
  body: string
  image?: string // base64
  imagePosition: { x: number; y: number }
  imageZoom: number
  imageMirror: boolean
  imageOpacity: number
  overlayStyle: string
  overlayOpacity: number
  bgColor: string
  bgPattern: string
  textLayout: string
  marginH: number
  marginV: number
  highlights: SlideHighlight[]
  component?: 'table' | 'card' | 'stat' | 'arrows' | 'none'
  componentData?: Record<string, unknown>
}

export interface CarouselBriefing {
  profileId: string
  mode: 'content' | 'insight'
  input: string
  niche: string
  displayName?: string
  primaryColor: string
  primaryColors?: string[] // 2 a 4 entradas = degradê; ausente/1 entrada = usa primaryColor (sólida)
  visualStyle: VisualStyle
  carouselType: CarouselType
  cta: string
  slideCount: SlideCount
  imageCount: number
  accentColor: string
  fontHeadline: string
  fontBody: string
  avatarImage?: string
  avatarSize?: number
  handleSize?: number
  handleColor?: string
  verifiedBadge?: boolean
  brandText?: string
  brandPosition?: 'tl' | 'tr' | 'bl' | 'br'
  brandTextColor?: string
  brandTextSize?: number
  brandTextFont?: string
  dotSize?: number
  dotsVisible?: boolean
}

export interface CarouselContent {
  triagem: string
  eixo: string
  funil: string
  headlines: Array<{ index: number; text: string; trigger: string }>
  selectedHeadline: number
  spine: {
    headline: string
    hook: string
    mechanism: string
    proof: string
    application: string
    direction: string
  }
  slides: Slide[]
  caption: string
}

export interface Carousel {
  id: string
  title: string
  profileId: string
  templateId?: string
  briefing: CarouselBriefing
  content: CarouselContent
  visualStyle: VisualStyle
  status: 'draft' | 'generating' | 'editing' | 'done'
  createdAt: string
  updatedAt: string
  thumbnail?: string
}

export interface GenerationStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export interface SlideTemplateDef {
  background: SlideBackground
  label: string
  hasTag: boolean
  hasBody: boolean
  hasImage: boolean
  isCTA?: boolean
  style?: SlideStyle
  imageLayout?: ImageLayout
  defaultTextAnchor?: 'top' | 'center' | 'bottom'
  defaultGradientOn?: boolean
  defaultGradientDir?: 'top' | 'bottom' | 'left' | 'right'
  defaultTitleColor?: string
  defaultBodyColor?: string
  defaultBodySize?: number
  defaultHandleColor?: string
  defaultSubtitle?: string
  defaultTitleSize?: number
  defaultTitleWeight?: number
  defaultTitleLineHeight?: number
  defaultSubtitleSize?: number
  defaultMarginH?: number
  defaultBlockGap?: number
  defaultBodyWeight?: number
  defaultBodyLineHeight?: number
  defaultImageHeight?: number
}

export interface CarouselTemplate {
  id: string
  name: string
  description: string
  thumbnail?: string
  slides: SlideTemplateDef[]
  createdAt: string
}

export interface ChatConversation {
  id: string
  title: string
  skill: 'copy' | 'ideias' | 'geral'
  profileId?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  createdAt: string
  updatedAt: string
}

export type WizardStep =
  | 'profile'
  | 'content'
  | 'briefing'
  | 'headlines'
  | 'spine'
  | 'text'
  | 'images'
  | 'studio'
