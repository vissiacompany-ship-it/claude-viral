import fs from 'fs'
import path from 'path'
import { Profile, Carousel, CarouselTemplate, ChatConversation, ReferenceItem, Idea, Narrative, Trend, GalleryImage } from '@/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
const CAROUSELS_FILE = path.join(DATA_DIR, 'carousels.json')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')
const CHATS_FILE = path.join(DATA_DIR, 'chat-conversations.json')
const REFERENCES_FILE = path.join(DATA_DIR, 'reference-items.json')
const IDEAS_FILE = path.join(DATA_DIR, 'idea-bank.json')
const NARRATIVES_FILE = path.join(DATA_DIR, 'narrative-bank.json')
const TRENDS_FILE = path.join(DATA_DIR, 'trends.json')
const GALLERY_FILE = path.join(DATA_DIR, 'gallery.json')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJSON(file: string, data: unknown) {
  ensureDataDir()
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// Profiles
export function getProfiles(): Profile[] {
  return readJSON<Profile[]>(PROFILES_FILE, [])
}

export function saveProfile(profile: Profile): void {
  const profiles = getProfiles()
  const idx = profiles.findIndex(p => p.id === profile.id)
  if (idx >= 0) profiles[idx] = profile
  else profiles.push(profile)
  writeJSON(PROFILES_FILE, profiles)
}

export function deleteProfile(id: string): void {
  const profiles = getProfiles().filter(p => p.id !== id)
  writeJSON(PROFILES_FILE, profiles)
}

// Carousels
export function getCarousels(): Carousel[] {
  return readJSON<Carousel[]>(CAROUSELS_FILE, [])
}

export function getCarousel(id: string): Carousel | null {
  return getCarousels().find(c => c.id === id) ?? null
}

export function saveCarousel(carousel: Carousel): void {
  const carousels = getCarousels()
  const idx = carousels.findIndex(c => c.id === carousel.id)
  if (idx >= 0) carousels[idx] = carousel
  else carousels.push(carousel)
  writeJSON(CAROUSELS_FILE, carousels)
}

export function deleteCarousel(id: string): void {
  const carousels = getCarousels().filter(c => c.id !== id)
  writeJSON(CAROUSELS_FILE, carousels)
}

// Templates (modelos de estrutura fixa)
export function getTemplates(): CarouselTemplate[] {
  return readJSON<CarouselTemplate[]>(TEMPLATES_FILE, [])
}

export function getTemplate(id: string): CarouselTemplate | null {
  return getTemplates().find(t => t.id === id) ?? null
}

export function saveTemplate(template: CarouselTemplate): void {
  const templates = getTemplates()
  const idx = templates.findIndex(t => t.id === template.id)
  if (idx >= 0) templates[idx] = template
  else templates.push(template)
  writeJSON(TEMPLATES_FILE, templates)
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter(t => t.id !== id)
  writeJSON(TEMPLATES_FILE, templates)
}

// Conversas do Chat (histórico — salvar e continuar depois)
export function getChatConversations(): ChatConversation[] {
  return readJSON<ChatConversation[]>(CHATS_FILE, [])
}

export function getChatConversation(id: string): ChatConversation | null {
  return getChatConversations().find(c => c.id === id) ?? null
}

export function saveChatConversation(conversation: ChatConversation): void {
  const conversations = getChatConversations()
  const idx = conversations.findIndex(c => c.id === conversation.id)
  if (idx >= 0) conversations[idx] = conversation
  else conversations.unshift(conversation)
  writeJSON(CHATS_FILE, conversations)
}

export function deleteChatConversation(id: string): void {
  const conversations = getChatConversations().filter(c => c.id !== id)
  writeJSON(CHATS_FILE, conversations)
}

// Biblioteca de Referências
export function getReferenceItems(): ReferenceItem[] {
  return readJSON<ReferenceItem[]>(REFERENCES_FILE, [])
}

export function saveReferenceItem(item: ReferenceItem): void {
  const items = getReferenceItems()
  const idx = items.findIndex(i => i.id === item.id)
  if (idx >= 0) items[idx] = item
  else items.unshift(item)
  writeJSON(REFERENCES_FILE, items)
}

export function deleteReferenceItem(id: string): void {
  const items = getReferenceItems().filter(i => i.id !== id)
  writeJSON(REFERENCES_FILE, items)
}

// Banco de Ideias
export function getIdeas(): Idea[] {
  return readJSON<Idea[]>(IDEAS_FILE, [])
}

export function saveIdea(idea: Idea): void {
  const ideas = getIdeas()
  const idx = ideas.findIndex(i => i.id === idea.id)
  if (idx >= 0) ideas[idx] = idea
  else ideas.unshift(idea)
  writeJSON(IDEAS_FILE, ideas)
}

export function deleteIdea(id: string): void {
  writeJSON(IDEAS_FILE, getIdeas().filter(i => i.id !== id))
}

// Banco de Narrativas
export function getNarratives(): Narrative[] {
  return readJSON<Narrative[]>(NARRATIVES_FILE, [])
}

export function saveNarrative(narrative: Narrative): void {
  const narratives = getNarratives()
  const idx = narratives.findIndex(n => n.id === narrative.id)
  if (idx >= 0) narratives[idx] = narrative
  else narratives.unshift(narrative)
  writeJSON(NARRATIVES_FILE, narratives)
}

export function deleteNarrative(id: string): void {
  writeJSON(NARRATIVES_FILE, getNarratives().filter(n => n.id !== id))
}

// Tendências
export function getTrends(): Trend[] {
  return readJSON<Trend[]>(TRENDS_FILE, [])
}

export function saveTrend(trend: Trend): void {
  const trends = getTrends()
  const idx = trends.findIndex(t => t.id === trend.id)
  if (idx >= 0) trends[idx] = trend
  else trends.unshift(trend)
  writeJSON(TRENDS_FILE, trends)
}

export function deleteTrend(id: string): void {
  writeJSON(TRENDS_FILE, getTrends().filter(t => t.id !== id))
}

// Galeria de imagens (por perfil) — upload manual + toda imagem gerada em qualquer carrossel
export function getGalleryImages(): GalleryImage[] {
  return readJSON<GalleryImage[]>(GALLERY_FILE, [])
}

export function getGalleryImagesByProfile(profileId: string): GalleryImage[] {
  return getGalleryImages().filter(g => g.profileId === profileId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveGalleryImage(image: GalleryImage): void {
  const images = getGalleryImages()
  images.unshift(image)
  writeJSON(GALLERY_FILE, images)
}

export function deleteGalleryImage(id: string): void {
  writeJSON(GALLERY_FILE, getGalleryImages().filter(g => g.id !== id))
}
