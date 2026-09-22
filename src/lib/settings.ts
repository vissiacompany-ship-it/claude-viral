import fs from 'fs'
import path from 'path'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

export type TextProvider = 'claude-cli' | 'anthropic-api' | 'openai' | 'gemini'

export interface Settings {
  // Geração de imagem é só Gemini (Pollinations e ChatGPT já foram testados e removidos).
  geminiApiKey: string
  geminiModel: string
  // Geração de texto/copy (chat, legenda, prompts de imagem, distribuição de conteúdo).
  // 'claude-cli' usa o Claude Code já logado na máquina — não pede chave nenhuma.
  textProvider: TextProvider
  // Modelo passado como `--model` pro Claude CLI. Vazio = não passa a flag, a CLI usa
  // qualquer modelo que já estiver ativo na sessão logada (o que a pessoa escolheu com
  // `/model` dentro do próprio Claude Code, ou o padrão da conta/plano dela).
  claudeCliModel: string
  // Separada da geminiApiKey (que é da geração de imagem, sempre paga). Usar uma chave de um
  // projeto SEM faturamento habilitado é o que garante o tier gratuito de texto de verdade —
  // se billing está ligado no projeto (necessário pra imagem), a mesma chave perde o free tier.
  geminiTextApiKey: string
  geminiTextModel: string
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  openaiModel: string
}

const DEFAULTS: Settings = {
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash-image', // modelo atual do Google pra imagem — Imagen 3/4 e o Gemini 2.0 Flash foram descontinuados
  textProvider: 'claude-cli',
  claudeCliModel: '',
  geminiTextApiKey: '',
  geminiTextModel: 'gemini-3.6-flash',
  anthropicApiKey: '',
  anthropicModel: 'claude-sonnet-4-5-20250929',
  openaiApiKey: '',
  openaiModel: 'gpt-5.6-sol', // família GPT-5.6 (jul/2026) — GPT-4.1 é a geração anterior, ver OPENAI_MODELS em settings/page.tsx
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
