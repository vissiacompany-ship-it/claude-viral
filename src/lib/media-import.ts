// Baixa e prepara conteúdo (link do Instagram ou arquivo anexado) pra virar item da
// Biblioteca de Referências. Usa ferramentas locais (yt-dlp, instaloader, ffmpeg, Whisper
// local) — nenhuma delas exige chave de API paga. Se alguma não estiver instalada, falha com
// uma mensagem clara em vez de travar, e a pessoa pode anexar o arquivo manualmente.
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

const execAsync = promisify(exec)

function hasBinary(bin: string): boolean {
  try {
    require('child_process').execSync(`command -v ${bin}`, { stdio: 'ignore' }) // eslint-disable-line @typescript-eslint/no-require-imports
    return true
  } catch {
    return false
  }
}

export function newTmpDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function cleanupDir(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* melhor esforço */ }
}

// Baixa um Reels/vídeo do Instagram via yt-dlp. Falha (de propósito) em posts que são só
// imagem/carrossel — quem chama tenta downloadInstagramImages em seguida.
export async function downloadInstagramVideo(url: string, dir: string): Promise<{ videoPath: string; caption?: string }> {
  if (!hasBinary('yt-dlp')) throw new Error('yt-dlp não está instalado nessa máquina.')
  const outTemplate = path.join(dir, 'video.%(ext)s')
  await execAsync(`yt-dlp -f "mp4/best" -o "${outTemplate}" --write-description --no-warnings "${url}"`, {
    timeout: 120000, maxBuffer: 20 * 1024 * 1024,
  })
  const files = fs.readdirSync(dir)
  const videoFile = files.find(f => f.startsWith('video.') && !f.endsWith('.description'))
  if (!videoFile) throw new Error('yt-dlp não retornou vídeo pra esse link — provavelmente é um post de imagem.')
  const descFile = files.find(f => f.endsWith('.description'))
  const caption = descFile ? fs.readFileSync(path.join(dir, descFile), 'utf-8').trim() : undefined
  return { videoPath: path.join(dir, videoFile), caption }
}

// Baixa imagem(ns) de um post/carrossel do Instagram via instaloader (funciona pra posts
// públicos, sem precisar de login — pode falhar se o Instagram exigir login pra essa conta).
export async function downloadInstagramImages(url: string, dir: string): Promise<{ imagePaths: string[]; caption?: string }> {
  if (!hasBinary('python3')) throw new Error('python3 não encontrado nessa máquina.')
  const match = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)
  if (!match) throw new Error('Não reconheci esse link como um post do Instagram.')
  const shortcode = match[1]
  try {
    await execAsync(`python3 -m instaloader --no-videos --no-metadata-json --no-profile-pic --dirname-pattern="." -- -${shortcode}`, {
      timeout: 120000, maxBuffer: 20 * 1024 * 1024, cwd: dir,
    })
  } catch (e) {
    throw new Error(`Não consegui baixar esse post (o Instagram pode estar pedindo login pra esse conteúdo). Anexe o arquivo manualmente. Detalhe: ${e instanceof Error ? e.message : String(e)}`)
  }
  const files = fs.readdirSync(dir)
  const imagePaths = files.filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')).sort().map(f => path.join(dir, f))
  const captionFile = files.find(f => f.endsWith('.txt'))
  const caption = captionFile ? fs.readFileSync(path.join(dir, captionFile), 'utf-8').trim() : undefined
  if (!imagePaths.length) throw new Error('Não encontrei nenhuma imagem nesse post.')
  return { imagePaths, caption }
}

// Extrai até `max` frames espaçados do vídeo, pra IA analisar visualmente sem precisar rodar
// o vídeo inteiro.
export async function extractFrames(videoPath: string, dir: string, max = 6): Promise<string[]> {
  if (!hasBinary('ffmpeg')) throw new Error('ffmpeg não está instalado nessa máquina.')
  const pattern = path.join(dir, 'frame_%02d.jpg')
  await execAsync(`ffmpeg -y -i "${videoPath}" -vf "fps=1/3" -frames:v ${max} "${pattern}"`, {
    timeout: 60000, maxBuffer: 20 * 1024 * 1024,
  })
  const files = fs.readdirSync(dir).filter(f => f.startsWith('frame_')).sort()
  return files.map(f => path.join(dir, f))
}

export async function extractAudio(videoPath: string, dir: string): Promise<string> {
  if (!hasBinary('ffmpeg')) throw new Error('ffmpeg não está instalado nessa máquina.')
  const audioPath = path.join(dir, 'audio.mp3')
  await execAsync(`ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 "${audioPath}"`, {
    timeout: 60000, maxBuffer: 20 * 1024 * 1024,
  })
  return audioPath
}

// Copia imagens da pasta temporária de import pra dentro de public/references/<id>/, pra
// ficarem servidas pelo Next.js em /references/<id>/arquivo.ext — usado só quando a pessoa
// opta explicitamente por guardar o carrossel na íntegra na Biblioteca (storeOriginal), em vez
// do modo padrão (fórmula abstraída, sem guardar arquivo nenhum).
export function persistImagesToPublic(imagePaths: string[], referenceId: string): string[] {
  const destDir = path.join(process.cwd(), 'public', 'references', referenceId)
  fs.mkdirSync(destDir, { recursive: true })
  return imagePaths.map((src, i) => {
    const ext = path.extname(src) || '.jpg'
    const destName = `img${i + 1}${ext}`
    fs.copyFileSync(src, path.join(destDir, destName))
    return `/references/${referenceId}/${destName}`
  })
}

// Transcrição 100% local via Whisper (pacote Python openai-whisper) — nunca usa API paga.
// Best-effort: se não estiver instalado ou falhar, retorna undefined em vez de derrubar o
// import inteiro (a análise segue só com as imagens/legenda).
export async function transcribeAudio(audioPath: string, dir: string): Promise<string | undefined> {
  if (!hasBinary('python3')) return undefined
  try {
    await execAsync(`python3 -m whisper "${audioPath}" --model base --language Portuguese --output_format txt --output_dir "${dir}" --fp16 False`, {
      timeout: 300000, maxBuffer: 20 * 1024 * 1024,
    })
    const txtPath = audioPath.replace(/\.[^.]+$/, '.txt')
    if (fs.existsSync(txtPath)) return fs.readFileSync(txtPath, 'utf-8').trim() || undefined
    return undefined
  } catch {
    return undefined
  }
}
