export interface Profile {
  id: string
  name: string
  instagram: string

  // Identidade
  niche: string
  subniche?: string
  professionalOneLiner?: string // "quem você é profissionalmente" — afeta tom e exemplos
  audienceType?: 'b2c' | 'b2b' | 'mix'

  // Negócio & Oferta — audience aqui já é o ICP ("cliente ideal em 1 linha")
  sells?: string[] // Infoproduto, Mentoria/Consultoria, Serviço, Produto físico, SaaS/Software, Outro
  audience: string // Cliente ideal em 1 linha (ICP)
  realProblem?: string // causa raiz, nome próprio — "Real Problema" do Núcleo da Oferta

  // Diferencial — perguntas simples que alimentam a Árvore Narrativa por trás
  desiredOutcome?: string // Desejo Universal
  emotionalDriver?: string // Driver Emocional
  awarenessLevel?: string // Nível de Consciência (N1–N5, guardado em linguagem simples)
  marketSophistication?: string // Nível de Sofisticação (S1–S5)
  mechanism?: string // Mecanismo Único (nome próprio)
  promiseResult?: string // Promessa — o que a pessoa recebe
  promiseDeadline?: string // Promessa — até quando
  promiseObjection?: string // Promessa — "mesmo que ela ache que..."
  pastAttempts?: string[] // Tentativas Frustradas
  lifeTransformation?: string // Transformação de Vida
  proofBank?: string[] // Provas Reais — casos, números e resultados concretos que a pessoa já tem (nunca sugerido por IA)

  // Posicionamento — o que separa essa marca do resto do nicho, alimenta conteúdo de
  // autoridade/contrarian/conexão (não é sobre o produto, é sobre o ponto de vista)
  positioningBeliefs?: string[] // "eu defendo X — o mercado ensina Y" — pares de contraste
  coreValues?: string[] // valores inegociáveis, já incluindo como se vive isso na prática
  successDefinition?: string // o que é sucesso pra essa pessoa
  whatYouReject?: string // o que ela abomina no próprio nicho
  shadowTrait?: string // a imperfeição/lado que ela topa mostrar em público

  // Tom de voz
  formality?: 'formal' | 'informal'
  voicePersonality?: string[] // direta, didática, provocativa, energética, sóbria, acolhedora, polêmica, sarcástica, inspiradora, técnica
  voiceReference?: string // Espelho de Escrita — a que tipo de texto/voz essa marca se parece quando escreve
  signaturePhrases?: string[] // palavras/frases que costuma usar — viram assinatura
  avoidWords?: string[] // palavras que a IA nunca usa

  // Imagem de referência de estilo — anexada automaticamente (via API, nunca manual) em toda
  // geração de imagem com IA desse perfil, quando o provedor for Gemini. Ancora o resultado
  // no estilo visual específico dessa marca sem depender de colar print à mão em cada imagem —
  // essencial pra escalar produção (ex: 20 carrosséis/dia) sem passo manual repetido.
  imageStyleReference?: string
  extraInstructions: string
  primaryColor: string
  primaryColors?: string[] // 2 a 4 entradas = degradê; ausente/1 entrada = usa primaryColor (sólida)
  logo?: string
  brandText?: string
  // Padrão do carrossel novo pra esse perfil — sem isso, todo carrossel nascia com o rodapé
  // ligado (Sim) e a pessoa tinha que desligar manualmente em cada carrossel novo, mesmo já
  // tendo decidido isso pro perfil inteiro antes. undefined/true = mostra, false = não mostra.
  brandTextVisible?: boolean
  brandPosition?: 'tl' | 'tr' | 'bl' | 'br'
  verifiedBadge?: boolean
  createdAt: string
}

// Pilares do Sistema Viciante — grade fixa de funções de conteúdo, igual pra qualquer perfil.
// O que muda por perfil/nicho é o preenchimento de cada pilar (o assunto), nunca a lista.
export type ContentPillar = 'mecanismo' | 'noticia-cultura' | 'pratica-rapida' | 'contra-crenca' | 'caso-observacao' | 'provocacao-opiniao'

export type VisualStyle = 'minimal' | 'profile' | 'creators' | 'techviral'
export type CarouselType = 'tendencia' | 'tese' | 'case' | 'previsao'
export type SlideCount = 5 | 7 | 9 | 12
export type SlideBackground = 'dark' | 'light' | 'gradient' | 'cover'
export type SlideStyle = 'classic' | 'editorial-serif' | 'bold-sans' | 'step-guide' | 'photo-block' | 'dark-story' | 'photo-quote'
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
  imagePlacement?: 'top' | 'middle' | 'bottom' // só estilo editorial-serif (top/bottom simples, não double/triple) — "middle" = entre título e corpo
  titleUppercase?: boolean // legado — mantido só pra carrossel salvo antes do titleCase existir
  titleCase?: 'uppercase' | 'lowercase' | 'capitalize' | 'none' // MAIÚSCULO / minúsculo / Primeira Maiúscula / como foi digitado
  bodyCase?: 'uppercase' | 'lowercase' | 'capitalize' | 'none' // idem, pro corpo e subheadline
  hideAvatarRow?: boolean // esconde a linha de avatar+@handle nesse slide específico
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
  marginVBottom?: number
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
  pillar?: ContentPillar
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
  defaultGradientExtent?: number
  defaultHandleSize?: number
  defaultAvatarSize?: number
  defaultImageZoom?: number
  defaultImagePosition?: { x: number; y: number }
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
  defaultMarginVBottom?: number
  defaultBlockGap?: number
  defaultBodyWeight?: number
  defaultBodyLineHeight?: number
  defaultImageHeight?: number
  defaultTextAlign?: 'left' | 'right' | 'center' | 'justify'
  defaultTitleUppercase?: boolean
  defaultHideAvatarRow?: boolean
  defaultFontFamilyHead?: string
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

// Biblioteca de Referências — nunca guarda o conteúdo original de terceiros, só a fórmula
// estrutural extraída (com [colchetes] pra preencher) e o porquê ela funciona. Ver CLAUDE.md /
// a regra de todo o projeto: extrai estrutura, nunca copia marca/persona/dado do original.
export type ReferenceFormat = 'carrossel' | 'reels' | 'post-unico' | 'stories' | 'outro'

export interface ReferenceItem {
  id: string
  title: string
  format: ReferenceFormat
  sourceNote?: string // onde a pessoa viu (livre, nunca obrigatório — não é pra reproduzir o link)
  formula: string // a fórmula com [colchetes] pra preencher, sem nome de marca/pessoa do original
  mechanicPreserved: string[] // checklist "por que isso funciona" — o que preservar ao reusar
  tags?: string[]
  // Guardar o carrossel na íntegra (imagem + texto completo), por decisão explícita da pessoa
  // ao salvar — modo diferente do padrão (fórmula abstraída em [colchetes]). Quando
  // storeOriginal é true, fullText/images ficam preenchidos e "Gerar baseado nesse" usa o
  // conteúdo literal como molde forte, em vez da fórmula genérica.
  storeOriginal?: boolean
  fullText?: string // texto completo original (legenda, transcrição ou texto do carrossel)
  images?: string[] // caminhos públicos (/references/<id>/arquivo.ext) das imagens guardadas
  createdAt: string
}

// Galeria de imagens por perfil — 2 origens: "upload" (a pessoa sobe manualmente, ex: fotos
// reais do cliente pra usar como referência de identidade) e "generated" (toda imagem que o
// próprio Claude Viral gera em qualquer carrossel desse perfil entra aqui sozinha, sem passo
// manual). Serve de banco pra selecionar como referência na hora de gerar uma imagem nova —
// pode marcar várias de uma vez, cada uma com uma nota livre ("usa só o fundo dessa").
export interface GalleryImage {
  id: string
  profileId: string
  url: string // sempre um caminho persistido (/uploads/gallery/xxx.jpg), nunca base64 salvo em disco
  source: 'upload' | 'generated'
  label?: string // nome curto opcional (ex: "Foto de perfil", "Escritório")
  createdAt: string
  // "Receita" de geração — só existe pra source: 'generated'. Guardada pra poder mostrar, ao
  // clicar na imagem na galeria, exatamente o que foi usado pra gerar ela (prompt final +
  // quais referências/notas entraram na combinação).
  prompt?: string
  category?: string // 'pessoa' | 'produto' | 'livre' — do Gerador de Imagens
  style?: string // nome do estilo visual escolhido (ex: "Cinema", "Publicitário")
  dimension?: string // ex: "Stories 9:16", "Feed 4:5"
  references?: { url: string; note?: string }[]
}

// Banco de Ideias & Narrativas — escrever com antecedência, desacoplado do momento de montar
// um carrossel específico. Ideia = ângulo de 1 linha; Narrativa = roteiro completo derivado
// dela, já no formato TITULO/SUBTITULO/TEXTO/LISTA que o editor de template sabe colar.
export interface Idea {
  id: string
  profileId?: string
  text: string // o ângulo em 1 linha
  angleType?: string // vergonha, indignação, esperança, conspiração, identidade, curiosidade
  pillar?: ContentPillar
  favorite?: boolean
  fromAI?: boolean // false/undefined = a pessoa escreveu à mão ("+ Nova Ideia"), sem passar pela IA
  usedInNarrative?: boolean
  createdAt: string
}

// Tendência — assunto em alta pra usar como gancho/tema. 'global' não depende de nicho
// nenhum (Copa do Mundo, Natal, Black Friday); 'nicho' é específico de um perfil (ex:
// Ozempic pro nicho de saúde). Atualizada manualmente (a pessoa pede pro Claude Code
// pesquisar na web e preencher), não por scraping automático.
export interface Trend {
  id: string
  scope: 'global' | 'nicho'
  profileId?: string // obrigatório quando scope === 'nicho'
  text: string // o assunto em si, ex: "Ozempic", "Copa do Mundo 2026"
  note?: string // por que está em alta / como conecta com o nicho
  source?: 'manual' | 'auto' // 'auto' = veio de uma busca; usado pra saber o que substituir numa busca nova
  createdAt: string
}

export interface Narrative {
  id: string
  profileId?: string
  ideaId?: string
  title: string
  content: string // formato TITULO/SUBTITULO/TEXTO/LISTA/TAG, pronto pra colar no editor
  pillar?: ContentPillar
  // Negrito/itálico/sublinhado/cor marcados no editor do roteiro — mesma estrutura do
  // destaque de palavra do slide (SlideHighlight). Casamento é por texto da palavra, então
  // ao virar carrossel cada highlight só "pega" nos slides onde aquela palavra realmente
  // aparece — não precisa mapear highlight -> slide manualmente.
  highlights?: SlideHighlight[]
  usedInCarousel?: boolean
  createdAt: string
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
