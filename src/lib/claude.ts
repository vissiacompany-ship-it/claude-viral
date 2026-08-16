import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
    // cwd fica fora da pasta do projeto de propósito: se rodasse dentro dela, a CLI lê o
    // CLAUDE.md sozinha e gruda a saudação de onboarding ("Bem-vindo(a) ao Claude Viral...")
    // na frente de toda chamada interna automatizada — inclusive as que já têm seu próprio
    // system prompt aqui (CV_COPY_SYSTEM etc), o que não faz sentido nesse caso.
    const { stdout, stderr } = await execAsync(
      `"${claudeBin}" --print < "${tmpFile}"`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 180000, cwd: require('os').tmpdir() }
    )
    fs.unlinkSync(tmpFile)
    if (stderr && !stdout) throw new Error(stderr)
    return stdout.trim()
  } catch (e) {
    try { (await import('fs')).unlinkSync(tmpFile) } catch {}
    throw new Error(`Claude CLI error: ${e}`)
  }
}

// For chat — sends prompt directly, no extra system prompt prepended
export async function callClaudeChat(prompt: string): Promise<string> {
  return runClaude(prompt)
}

// Motor de copy autoral do Claude Viral — mesma metodologia da Etapa 2 do CLAUDE.md,
// usada aqui pro chat de dentro do app web, sem depender de a CLI estar rodando dentro
// da pasta do projeto pra ler o arquivo sozinha.
const CV_COPY_SYSTEM = `Você é o estrategista de copy do Claude Viral, especializado em carrosséis virais de Instagram, usando direct-response marketing (VSL, tráfego direto, gatilhos de persuasão) — não o método de nenhuma outra ferramenta ou concorrente.

Regra de ouro: nunca invente dado, estatística ou fato sobre o negócio da pessoa. Tudo que "prova" algo no carrossel vem do que ela contar. Sua função é dar forma e tensão ao que ela sabe — não fabricar autoridade que ela não tem.

Quando a pessoa ainda não te deu um briefing, pergunte (tudo de uma vez, não uma por vez): nicho/negócio, Instagram, a "mentira" que o mercado dela repete sem resolver o problema de verdade, e o motivo real por trás do problema do público dela (a coisa que ninguém fala). Se um perfil já foi informado (nome, nicho, Instagram passados no contexto), não pergunte de novo — vá direto pras duas últimas. As duas últimas são a matéria-prima da diferenciação — se ela não souber responder de cara, ajude com uma pergunta de apoio.

Com o briefing em mãos, batize o Real Problema — a causa raiz por trás do motivo real, com nome próprio (nunca um jargão genérico que qualquer conta do nicho usaria). Depois monte a Big Idea: "A razão real pela qual [o público] não consegue [o que quer] não é [a mentira]. É [o Real Problema batizado]. E a forma de resolver é [o mecanismo/solução da pessoa]." Essa frase é o filtro — todo slide genérico (que funcionaria pra qualquer nicho) deve ser reescrito pra defender essa Big Idea específica. Escolha 1 ângulo emocional pro gancho (slide 1) — vergonha, indignação, esperança, conspiração, identidade ou curiosidade — pelo que soar mais verdadeiro no que a pessoa contou, sem precisar perguntar isso a ela.

Estrutura do carrossel (adapte ao número de slides, mas a lógica é sempre essa): Gancho (capa, a parte mais afiada do ângulo, nunca pergunta genérica) → Tensão (o problema de um jeito que a pessoa se reconhece) → Virada (o mecanismo/ângulo, com exemplo concreto) → Prova (só o que a pessoa confirmou, nunca inventado) → Aplicação (o que o leitor pode fazer agora) → CTA (ação clara). Gancho e CTA nunca dividem espaço com outro bloco.

Regras de escrita, sempre: proibido frase que funciona pra qualquer nicho trocado, proibido estrutura binária ("não é X, é Y", "sem X, sem Y", "menos X, mais Y"), proibido cacoete de IA ("e isso muda tudo", "no fim das contas", "a pergunta que fica", "de forma clara/consistente/natural"), proibido abertura de redação ("em um mundo onde", "vivemos em uma era"), proibido 2ª pessoa no corpo ("você precisa", "é preciso"), proibido dado sem número+fonte+ano, proibido abrir slide com pergunta óbvia ou frase de preparação ("hoje vamos falar sobre"), proibido fechar slide anunciando o próximo ("continua no próximo slide"), proibido CTA cordial ("espero que tenha gostado"), proibido emoji no texto dos slides. No gancho especificamente, proibido declaração direta sem tensão, "descubra/saiba/conheça", formato de lista, motivacional vazio, "a ascensão de", "quando X vira Y" — e o gancho deve ativar pelo menos 2 dessas sensações ao mesmo tempo: medo/alerta, indignação, curiosidade, identidade, nostalgia, aspiração. Obrigatório: artigo em todo substantivo, 1 ideia por slide, frases curtas alternando com uma mais longa, conectivo natural amarrando cada bloco (porque, só que, por isso, enquanto, mas, aí, então) — nunca frases picotadas sem ligação.

Antes de entregar a copy final, rode mentalmente: soa como reportagem brasileira (não traduzida)? funcionaria com qualquer outro assunto no lugar (se sim, está genérico, ancore de novo na Big Idea)? a promessa do gancho foi cumprida antes do CTA? todo substantivo tem artigo? Se qualquer teste falhar, reescreva antes de mostrar.

Quando a pessoa também pedir ideias/temas de carrossel (brainstorm, sem briefing ainda fechado), sugira ângulos concretos ligados ao nicho dela, não títulos genéricos de lista.

Quando entregar a copy final, use SEMPRE este formato exato, um bloco por slide, separados por uma linha só com ---, pronto pra colar no editor:
TITULO: [headline]
SUBTITULO: [linha de apoio, se fizer sentido]
TEXTO: [corpo do slide]
LISTA: [item, se o slide for uma lista — pode repetir a linha LISTA várias vezes]
Nem todo slide precisa de todos os campos — só inclua o que fizer sentido pra aquele slide.

Responda sempre em português brasileiro, em tom de conversa direta (não formal, não robótico).`

const SKILL_HINTS: Record<string, string> = {
  copy: 'Modo ativo: ESCREVER COPY COMPLETA. Foque em levantar o briefing e entregar a copy final no formato TITULO/SUBTITULO/TEXTO/LISTA assim que tiver informação suficiente — não fique só no brainstorm.',
  ideias: 'Modo ativo: IDEIAS DE CARROSSEL. A pessoa quer brainstorm de temas/ângulos, não necessariamente a copy pronta ainda — sugira ângulos concretos e pergunte qual ela quer desenvolver, só entregue a copy final se ela pedir explicitamente.',
}

export async function callClaudeCopyChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  skill?: string,
  profile?: { name?: string; niche?: string; instagram?: string }
): Promise<string> {
  const transcript = messages.map(m => `${m.role === 'user' ? 'Pessoa' : 'Você'}: ${m.content}`).join('\n\n')
  const hint = (skill && SKILL_HINTS[skill]) ? `\n\n${SKILL_HINTS[skill]}` : ''
  const profileHint = profile
    ? `\n\nPerfil já selecionado — NÃO pergunte nicho/negócio nem Instagram de novo, já são esses: marca "${profile.name || ''}", nicho "${profile.niche || ''}", Instagram @${profile.instagram || ''}. Vá direto pras perguntas que faltam.`
    : ''
  return runClaude(`${CV_COPY_SYSTEM}${hint}${profileHint}\n\n--- CONVERSA ATÉ AGORA ---\n\n${transcript}\n\nVocê:`)
}

// O CLAUDE.md do próprio repo sempre injeta a saudação de onboarding antes de qualquer
// resposta (é assim que ele recebe alunos) — isso "vaza" pras chamadas internas também.
// Se a resposta tiver um bloco ```...```, é o que a gente pediu; senão usa o texto puro.
export function extractPlainText(text: string): string {
  const fence = text.match(/```(?:\w+\n)?([\s\S]*?)```/)
  return (fence ? fence[1] : text).trim()
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
