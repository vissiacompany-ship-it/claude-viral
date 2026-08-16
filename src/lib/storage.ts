import fs from 'fs'
import path from 'path'
import { Profile, Carousel, CarouselTemplate, ChatConversation } from '@/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json')
const CAROUSELS_FILE = path.join(DATA_DIR, 'carousels.json')
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')
const CHATS_FILE = path.join(DATA_DIR, 'chat-conversations.json')

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
