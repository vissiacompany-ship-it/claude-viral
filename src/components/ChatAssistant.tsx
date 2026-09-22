'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, Copy, Check, ArrowDownToLine, Wand2, Plus, Trash2, MessageSquare } from 'lucide-react'
import { Profile, CarouselTemplate, ChatConversation } from '@/types'
import { parseBloco, splitBlocos } from '@/lib/bulk-parse'
import { adaptSlideCount } from '@/lib/adapt-slide-count'
import { PENDING_GENERATION_KEY, PendingGeneration } from '@/components/CreateCarouselModal'

type Msg = { role: 'user' | 'assistant'; content: string }
type Skill = 'copy' | 'ideias' | 'geral'

const GERAL_STARTER = 'Oi! Sou o chat de copy do Claude Viral. Posso te ajudar a escrever um carrossel do zero (te faço umas perguntas rápidas de briefing) ou só jogar ideias de tema pra você postar. O que você quer fazer agora?'
const IDEIAS_STARTER = 'Bora pensar em ideias. Me conta seu nicho (ou o que você vende/ensina) e o tipo de gancho que você curte mais — polêmica, dado surpreendente, história real, contraintuitivo — que eu já jogo alguns ângulos concretos pra você escolher.'
const copyStarter = (profiles: Profile[]) => profiles.length
  ? `Bora escrever a copy do carrossel. Qual desses perfis é esse: ${profiles.map(p => `"${p.name}"`).join(', ')}? Se for outro, me diz o nicho/negócio e o Instagram que eu crio um perfil novo.`
  : 'Bora escrever a copy do carrossel. Você ainda não tem nenhum perfil salvo — me conta seu nicho/negócio e seu Instagram que eu crio um pra você e já sigo com o briefing.'

const SKILLS: { id: Skill; label: string; icon: string }[] = [
  { id: 'geral', label: 'Geral', icon: '💬' },
  { id: 'copy', label: 'Escrever carrossel', icon: '✍️' },
  { id: 'ideias', label: 'Ideias de carrossel', icon: '💡' },
]

// Chat de copy/ideias, usado tanto numa página própria (Sidebar → Chat) quanto
// dentro do editor de template (com onUseContent, pra jogar o resultado direto nos slides).
export default function ChatAssistant({ onUseContent }: { onUseContent?: (text: string) => void }) {
  const router = useRouter()
  const [skill, setSkill] = useState<Skill>('geral')
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GERAL_STARTER }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileId, setProfileId] = useState('')
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Histórico de conversas (salvar e continuar depois) só existe na página própria do
  // Chat — dentro do editor (onUseContent) a conversa é sempre efêmera, uma sessão só.
  const hasHistory = !onUseContent

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { fetch('/api/profiles').then(r => r.json()).then(setProfiles).catch(() => {}) }, [])
  useEffect(() => {
    if (!hasHistory) return
    fetch('/api/chat-conversations').then(r => r.json()).then(setConversations).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Salva (cria ou atualiza) a conversa depois de cada troca completa — assim ela já
  // aparece na lista e pode ser retomada depois, sem precisar clicar em "salvar" à parte.
  const persist = async (msgs: Msg[], skl: Skill, pid: string) => {
    if (!hasHistory || msgs.every(m => m.role === 'assistant')) return
    const firstUser = msgs.find(m => m.role === 'user')?.content || 'Nova conversa'
    const title = firstUser.slice(0, 60)
    try {
      const res = await fetch('/api/chat-conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeConversationId || undefined, title, skill: skl, profileId: pid || undefined, messages: msgs })
      })
      const saved: ChatConversation = await res.json()
      setActiveConversationId(saved.id)
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === saved.id)
        const next = idx >= 0 ? [...prev] : [saved, ...prev]
        if (idx >= 0) next[idx] = saved
        return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      })
    } catch { /* histórico é conveniência, não trava o chat se falhar */ }
  }

  const novaConversa = () => {
    setActiveConversationId('')
    setSkill('geral')
    setProfileId('')
    setMessages([{ role: 'assistant', content: GERAL_STARTER }])
    setError('')
  }

  const abrirConversa = (c: ChatConversation) => {
    setActiveConversationId(c.id)
    setSkill(c.skill)
    setProfileId(c.profileId || '')
    setMessages(c.messages.length ? c.messages : [{ role: 'assistant', content: GERAL_STARTER }])
    setError('')
  }

  const excluirConversa = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => prev.filter(c => c.id !== id))
    if (id === activeConversationId) novaConversa()
    fetch('/api/chat-conversations', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
    }).catch(() => {})
  }

  const selectedProfile = profiles.find(p => p.id === profileId)

  // Trocar de skill começa uma conversa nova nesse modo — evita misturar contexto de
  // "ideias" com o de "copy completa" na mesma thread. No modo copy, a escolha de perfil
  // acontece só na conversa (a pessoa digita o nome) — sem seletor separado na tela.
  const selectSkill = (s: Skill) => {
    setSkill(s)
    setProfileId('')
    setActiveConversationId('')
    const starter = s === 'geral' ? GERAL_STARTER : s === 'ideias' ? IDEIAS_STARTER : copyStarter(profiles)
    setMessages([{ role: 'assistant', content: starter }])
    setError('')
  }

  // Tenta reconhecer o perfil pelo nome dentro do que a pessoa acabou de digitar (ex:
  // "é o perfil da Marca X" ou só "Marca X") — sem exigir seleção numa lista à parte.
  const resolveProfileFromText = (text: string): Profile | undefined => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const t = norm(text)
    return profiles.find(p => p.name && t.includes(norm(p.name)))
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    let resolved = selectedProfile
    if (skill === 'copy' && !resolved) {
      const match = resolveProfileFromText(text)
      if (match) { resolved = match; setProfileId(match.id) }
    }
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/copy-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next, skill,
          profile: resolved ? { name: resolved.name, niche: resolved.niche, instagram: resolved.instagram } : undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao conversar com o chat')
      const withReply = [...next, { role: 'assistant' as const, content: data.reply }]
      setMessages(withReply)
      persist(withReply, skill, resolved?.id || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao conversar com o chat')
    } finally {
      setLoading(false)
    }
  }

  const isCopyBlock = (text: string) => /^TITULO\s*:/im.test(text)

  // Só **negrito** — é o único markdown que o assistente costuma usar nas respostas de
  // chat (a copy final em si não passa por aqui, ela mostra o texto cru pra copiar/usar).
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const renderMd = (text: string) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  const copiar = (text: string, i: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(i)
    setTimeout(() => setCopiedIdx(null), 1800)
  }

  // "Criar carrossel" — pega a copy que a IA acabou de entregar, monta o carrossel de
  // verdade (perfil + modelo + slides já distribuídos) e manda direto pro painel de
  // edição. Reaproveita o mesmo mecanismo do wizard (PendingGeneration via sessionStorage)
  // em vez de exigir que a pessoa copie/cole manualmente.
  const criarCarrossel = async (text: string, i: number) => {
    setCreatingIdx(i)
    setError('')
    try {
      const templates: CarouselTemplate[] = await fetch('/api/templates').then(r => r.json())
      if (!templates.length) throw new Error('Nenhum modelo de carrossel encontrado.')
      const blocos = splitBlocos(text)
      const slideCount = Math.max(5, Math.min(20, blocos.length))
      // Sem preferência de estilo dita na conversa — escolhe o modelo com quantidade de
      // slides mais próxima do que a copy tem, evitando o "Tutorial Passo a Passo" (ele
      // exige um único campo de texto por slide, não título/corpo/lista como essa copy).
      const candidatos = templates.filter(t => t.slides.some(s => s.hasBody))
      const escolhido = (candidatos.length ? candidatos : templates)
        .reduce((best, t) => Math.abs(t.slides.length - slideCount) < Math.abs(best.slides.length - slideCount) ? t : best)

      const slideDefs = adaptSlideCount(escolhido.slides, slideCount)
      const slides = blocos.slice(0, slideCount).map((bloco, idx) => {
        const parsed = parseBloco(bloco)
        return { index: idx + 1, tag: parsed.tag, title: parsed.title, subtitle: parsed.subtitle, body: parsed.body }
      })

      const pending: PendingGeneration = {
        templateId: escolhido.id,
        carouselTitle: slides[0]?.title?.slice(0, 60) || 'Novo Carrossel',
        profileId,
        slideDefs,
        images: [],
        slides,
      }
      sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
      router.push(`/template/${escolhido.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar o carrossel')
      setCreatingIdx(null)
    }
  }

  return (
    <div className="flex h-full gap-4 mx-auto w-full max-w-7xl">
      <div className="flex-1 flex flex-col h-full min-w-0">
      <div className="flex-1 overflow-y-auto space-y-4 px-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user'
                ? { background: 'var(--grad)', color: '#000' }
                : { background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)' }}>
              {m.role === 'assistant'
                ? <span dangerouslySetInnerHTML={{ __html: renderMd(m.content) }}/>
                : m.content}
              {m.role === 'assistant' && isCopyBlock(m.content) && (
                <div className="flex gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => copiar(m.content, i)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {copiedIdx === i ? <><Check size={14}/> Copiado</> : <><Copy size={14}/> Copiar</>}
                  </button>
                  {onUseContent && (
                    <button onClick={() => onUseContent(m.content)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold"
                      style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
                      <ArrowDownToLine size={14}/> Usar nos slides
                    </button>
                  )}
                  {!onUseContent && (
                    <button onClick={() => criarCarrossel(m.content, i)} disabled={creatingIdx === i}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-60"
                      style={{ background: 'var(--grad)', color: '#000' }}>
                      <Wand2 size={14}/> {creatingIdx === i ? 'Criando…' : 'Criar Conteúdo'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 text-[15px] flex items-center gap-2" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              <Sparkles size={15} className="pulse"/> Pensando…
            </div>
          </div>
        )}
        {error && <p className="text-[13px] text-center" style={{ color: '#ff8080' }}>{error}</p>}
        <div ref={bottomRef}/>
      </div>
      <div className="flex gap-2 pt-3 mt-1 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
        {SKILLS.map(s => (
          <button key={s.id} onClick={() => selectSkill(s.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold"
            style={skill === s.id
              ? { background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }
              : { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 pt-2" style={{ borderTop: 'none' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Escreve aqui... (Enter pra enviar, Shift+Enter pra quebrar linha)"
          rows={2} className="flex-1 px-4 py-3 rounded-lg text-[15px] resize-none"
          style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}/>
        <button onClick={send} disabled={loading || !input.trim()}
          className="p-3 rounded-lg disabled:opacity-40 flex-shrink-0" style={{ background: 'var(--grad)', color: '#000' }}>
          <Send size={18}/>
        </button>
      </div>
      </div>
      {hasHistory && (
        <div className="w-48 flex-shrink-0 flex flex-col gap-2 p-3 rounded-2xl h-full"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <button onClick={novaConversa}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold flex-shrink-0"
            style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
            <Plus size={14}/> Nova conversa
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-wide px-1 pt-1" style={{ color: 'var(--muted)' }}>Histórico</p>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {conversations.length === 0 && (
              <p className="text-[12px] px-1 pt-1 leading-relaxed" style={{ color: 'var(--muted)' }}>Suas conversas salvas aparecem aqui assim que você começar a escrever.</p>
            )}
            {conversations.map(c => (
              <button key={c.id} onClick={() => abrirConversa(c)}
                className="w-full flex items-start gap-1.5 px-2.5 py-2 rounded-lg text-left group"
                style={c.id === activeConversationId ? { background: 'var(--bg3)', border: '1px solid var(--border)' } : { border: '1px solid transparent' }}>
                <MessageSquare size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--muted)' }}/>
                <span className="flex-1 text-[12.5px] leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>{c.title}</span>
                <span onClick={e => excluirConversa(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 rounded" style={{ color: 'var(--muted)' }}>
                  <Trash2 size={12}/>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
