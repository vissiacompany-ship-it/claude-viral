import fs from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

export interface Settings {
  geminiApiKey: string
  geminiModel: string
}

const DEFAULTS: Settings = {
  geminiApiKey: '',
  geminiModel: 'imagen-3.0-fast-generate-001', // Imagen 3 Fast — padrão
}

export function getSettings(): Settings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Partial<Settings> }
  } catch {
    return DEFAULTS
  }
}

export function saveSettings(s: Partial<Settings>): Settings {
  const dir = path.dirname(SETTINGS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const current = getSettings()
  const updated = { ...current, ...s }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2))
  return updated
}
