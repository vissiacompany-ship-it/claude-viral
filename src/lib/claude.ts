import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const BD_SYSTEM = `Você é a Máquina de Carrosséis — um sistema completo de criação de carrosséis virais para Instagram, construído em cima da metodologia da BrandsDecoded: a conta que saiu do zero para 272 mil seguidores e R$4 milhões de faturamento em 14 meses, 100% orgânico, 100% carrossel.

Você não é um assistente genérico. Você é um sistema com opinião editorial, calibrado por dados reais de 1.168 posts analisados. Cada decisão — tema, ângulo, headline, layout — passa por esse filtro antes de chegar pro usuário.

MANDAMENTOS:
- Nunca inventar dados, fontes, estatísticas
- Nunca gerar conteúdo motivacional vazio, clichê ou AI slop
- Nunca usar estruturas binárias ("não é X, é Y")
- Nunca omitir artigos (um/uma/o/a)
- Tom jornalístico — como repórter da Folha de S.Paulo
- Nunca segunda pessoa ("você precisa", "você deve") no corpo dos slides
- Dados sempre com número + fonte + ano

PADRÕES DE LIFT POSITIVO:
- Brasil/Contexto Nacional: +155%
- Fim/Morte/Crise: +119%
- Geracional: +119%
- Novidade: +99%

CHECKLIST DE REJEIÇÃO DE HEADLINES:
❌ Declaração Direta — afirma sem provocar
❌ Revelação Genérica — começa com "descubra", "saiba", "conheça"
❌ Lista/Número de itens — "5 dicas para..."
❌ Motivacional Vazio — sem tensão, sem dado
❌ "quando X vira Y", "a ascensão de", "o impacto de", "virou" como verbo principal

FORMATO HEADLINES:
- Opções 1-5: Investigação Cultural: [Reenquadramento provocativo]: [Hook de curiosidade]
- Opções 6-10: Narrativa Magnética: [Cenário concreto]. [Mecanismo]. [Tensão aberta]

Responda SEMPRE em português brasileiro. Retorne APENAS JSON válido quando solicitado, sem markdown, sem explicações fora do JSON.`

function findClaudeBinary(): string {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const home = process.env.HOME || ''

  const absoluteCandidates: string[] = []

  // 1. VS Code extension (pick newest version first)
  const extDir = path.join(home, '.vscode', 'extensions')
  if (fs.existsSync(extDir)) {
    const entries = (fs.readdirSync(extDir) as string[])
      .filter((e: string) => e.startsWith('anthropic.claude-code-'))
      .sort()
      .reverse()
    for (const entry of entries) {
      absoluteCandidates.push(path.join(extDir, entry, 'resources', 'native-binary', 'claude'))
    }
  }

  // 2. Common system paths
  absoluteCandidates.push(
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(home, '.npm-global', 'bin', 'claude'),
    path.join(home, 'node', 'bin', 'claude'),
  )

  const found = absoluteCandidates.find((c: string) => fs.existsSync(c))
  return found || 'claude'
}

async function runClaude(fullPrompt: string): Promise<string> {
  const fs = await import('fs')
  const claudeBin = findClaudeBinary()
  const tmpFile = `/tmp/claude_prompt_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`
  fs.writeFileSync(tmpFile, fullPrompt, 'utf-8')
  try {
    const { stdout, stderr } = await execAsync(
      `"${claudeBin}" --print < "${tmpFile}"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 180000 }
    )
    fs.unlinkSync(tmpFile)
    if (stderr && !stdout) throw new Error(stderr)
    return stdout.trim()
  } catch (e) {
    try { (await import('fs')).unlinkSync(tmpFile) } catch {}
    throw new Error(`Claude CLI error: ${e}`)
  }
}

// For structured generation (headlines, spine, slides) — uses full BD system prompt
export async function callClaude(prompt: string): Promise<string> {
  return runClaude(`${BD_SYSTEM}\n\n${prompt}`)
}

// For chat — sends prompt directly without prepending the heavy BD system
export async function callClaudeChat(prompt: string): Promise<string> {
  return runClaude(prompt)
}

export function extractJSON(text: string): unknown {
  // Remove markdown code blocks if present
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  // Find JSON object or array
  const start = cleaned.indexOf('{') !== -1 ? cleaned.indexOf('{') : cleaned.indexOf('[')
  const isArray = cleaned.indexOf('[') !== -1 && (cleaned.indexOf('[') < cleaned.indexOf('{') || cleaned.indexOf('{') === -1)
  const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')

  if (start === -1 || end === -1) throw new Error('No JSON found in response')
  return JSON.parse(cleaned.slice(start, end + 1))
}
