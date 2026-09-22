import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Carousel } from '@/types'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'carousels')
const GALLERY_DIR = path.join(process.cwd(), 'public', 'uploads', 'gallery')

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
}

// Converte uma imagem em base64 (data URL, do jeito que o editor guarda enquanto a pessoa
// está mexendo) num arquivo de verdade dentro de public/uploads/carousels — e devolve o
// caminho público (/uploads/carousels/xxx.jpg) pra guardar no lugar dela. Isso é o que
// mantém o data/carousels.json pequeno: sem isso, cada carrossel salvo carrega o peso de
// TODAS as suas fotos em base64 dentro do JSON, e toda a listagem (Dashboard, Meu Conteúdo)
// fica proporcionalmente mais lenta a cada carrossel novo. Uma string que já é um caminho
// (não começa com "data:") passa direto — evita reescrever o arquivo a cada save sem mudança.
export function persistImage(value: string | undefined): string | undefined {
  if (!value || !value.startsWith('data:')) return value
  const match = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return value
  const [, mime, b64] = match
  const ext = EXT_BY_MIME[mime] || 'jpg'
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  const filename = `${randomUUID()}.${ext}`
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(b64, 'base64'))
  return `/uploads/carousels/${filename}`
}

export function persistImages(values: string[] | undefined): string[] | undefined {
  return values?.map(v => persistImage(v) || v)
}

// Mesma lógica de persistImage, mas pra galeria — pasta separada (public/uploads/gallery) pra
// nunca misturar com as fotos de carrossel. Sempre exige um data: URL (a galeria nunca aceita
// um caminho já persistido de volta, evita duplicar arquivo).
export function persistGalleryImage(value: string): string | undefined {
  const match = value.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return undefined
  const [, mime, b64] = match
  const ext = EXT_BY_MIME[mime] || 'jpg'
  if (!fs.existsSync(GALLERY_DIR)) fs.mkdirSync(GALLERY_DIR, { recursive: true })
  const filename = `${randomUUID()}.${ext}`
  fs.writeFileSync(path.join(GALLERY_DIR, filename), Buffer.from(b64, 'base64'))
  return `/uploads/gallery/${filename}`
}

// Caminho inverso de persistImage — só usado na HORA DE RENDERIZAR (export em PNG, miniatura
// do dashboard), nunca salvo de volta no disco. O Playwright que tira o screenshot chama
// page.setContent() com o HTML puro, sem base URL nenhuma (não é uma navegação de verdade pra
// http://localhost:3000) — então um caminho raiz-relativo tipo "/uploads/carousels/xxx.jpg"
// nunca resolve nesse contexto e a imagem simplesmente não aparece no PNG (era por isso que
// o export e a miniatura saíam sem foto depois do primeiro save, quando a imagem já tinha
// virado arquivo). Ler o arquivo local direto e virar data URL evita esse problema de vez —
// nem depende de rede/porta nenhuma, já que é tudo no mesmo processo do servidor.
export function inlineImage(value: string | undefined): string | undefined {
  if (!value || !value.startsWith('/uploads/')) return value
  try {
    const filePath = path.join(process.cwd(), 'public', value)
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(value).slice(1).toLowerCase()
    const mime = MIME_BY_EXT[ext] || 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return value
  }
}

export function inlineCarouselImages(carousel: Carousel): Carousel {
  return {
    ...carousel,
    // O avatar/logo do perfil (badge redondo ao lado do @handle) sofre do mesmo problema —
    // também vira /uploads/carousels/xxx.jpg no save, e sem inlinar aqui saía sem foto
    // (só o círculo de cor lisa) em toda exportação/miniatura, do mesmo jeito que a foto do
    // slide saía sem imagem antes dessa correção.
    briefing: { ...carousel.briefing, avatarImage: inlineImage(carousel.briefing.avatarImage) },
    content: {
      ...carousel.content,
      slides: carousel.content.slides.map(s => ({
        ...s,
        image: inlineImage(s.image),
        images: s.images?.map(v => inlineImage(v) || v),
      })),
    },
  }
}
