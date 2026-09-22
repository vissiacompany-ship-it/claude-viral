'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, Check, Settings, Zap } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

// Imagen 3/4 e o Gemini 2.0 Flash foram descontinuados pelo Google (Gemini 2.0 Flash
// desligado em jun/2026, Imagen 4 desliga em 17/08/2026). Em agosto/2026 o Google lançou a
// geração seguinte ("Nano Banana 2" e "Nano Banana Pro"), então agora tem opção de verdade
// além do padrão barato — preços oficiais em ai.google.dev/gemini-api/docs/pricing.
const GEMINI_MODELS = [
  {
    value: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image (Nano Banana)',
    desc: 'O mais barato. Rápido e com boa qualidade pro dia a dia. ~$0,039 por imagem.',
    badge: 'Recomendado',
  },
  {
    value: 'gemini-3.1-flash-image',
    label: 'Gemini 3.1 Flash Image (Nano Banana 2)',
    desc: 'Geração mais nova que a 2.5 — melhor consistência e detalhe, custo um pouco maior. ~$0,045 a $0,151 por imagem (varia pela resolução).',
    badge: 'Atualizado',
  },
  {
    value: 'gemini-3-pro-image',
    label: 'Gemini 3 Pro Image (Nano Banana Pro)',
    desc: 'Qualidade profissional — melhor composição, texto legível na imagem, mais fiel ao prompt. O mais caro. ~$0,134 (2K) a $0,24 (4K) por imagem.',
    badge: 'Melhor qualidade',
  },
]

type TextProvider = 'claude-cli' | 'anthropic-api' | 'openai' | 'gemini'

const TEXT_PROVIDERS: { value: TextProvider; label: string; desc: string }[] = [
  { value: 'claude-cli', label: 'Claude Code (CLI)', desc: 'Usa o Claude já logado na sua máquina. Nenhuma API key necessária — é o padrão.' },
  { value: 'anthropic-api', label: 'API do Claude (Anthropic)', desc: 'Usa sua própria API key da Anthropic, sem depender do Claude Code instalado.' },
  { value: 'openai', label: 'API da OpenAI', desc: 'Usa GPT via sua própria API key da OpenAI.' },
  { value: 'gemini', label: 'API do Gemini (Google)', desc: 'Usa Gemini via sua própria API key do Google.' },
]

// Modelos do Claude Code (CLI) — só os "apelidos" que a própria CLI aceita em --model, sem
// data/versão fixa (a CLI resolve pro modelo mais atual daquela família). "Fable" é o mais
// recente das opções leves/experimentais; nem toda conta/plano tem acesso a todas.
const CLAUDE_CLI_MODELS = [
  { value: '', label: 'Padrão da sessão logada', desc: 'Não força nenhum modelo — usa o que já estiver ativo no seu Claude Code (o que você escolheu com /model, ou o padrão do seu plano).', badge: 'Recomendado' },
  { value: 'sonnet', label: 'Sonnet', desc: 'Melhor custo-benefício — o modelo principal do dia a dia.' },
  { value: 'opus', label: 'Opus', desc: 'O mais avançado. Mais caro e um pouco mais lento — pode não estar disponível em todo plano.' },
  { value: 'haiku', label: 'Haiku', desc: 'O mais rápido e barato. Ótimo pra tarefas simples.' },
  { value: 'custom', label: 'Outro modelo', desc: 'Digite o apelido ou ID exato (ex: fable) — útil se sua conta tiver acesso a um modelo que não está nessa lista.' },
]

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', desc: 'Melhor custo-benefício — recomendado para o dia a dia.', badge: 'Recomendado' },
  { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1', desc: 'O mais avançado. Mais caro e um pouco mais lento.' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', desc: 'O mais rápido e barato. Ótimo pra tarefas simples.' },
  { value: 'custom', label: 'Outro modelo', desc: 'Digite o nome exato de um modelo lançado depois desta lista.' },
]

// IDs de modelo do Gemini mudam rápido (gemini-2.5-flash saiu de circulação em ago/2026) —
// por isso sempre com opção "Outro modelo" pra nunca ficar travado de novo por um ID vencido.
const GEMINI_TEXT_MODELS = [
  { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', desc: 'Modelo atual do tier gratuito — recomendado.', badge: 'Recomendado' },
  { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash', desc: 'Geração anterior, ainda ativa em alguns projetos.' },
  { value: 'custom', label: 'Outro modelo', desc: 'Digite o ID exato — útil se o Google trocar o nome de novo.' },
]

const OPENAI_MODELS = [
  { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', desc: 'Modelo principal da OpenAI pra trabalho complexo — o mais capaz da família atual.', badge: 'Recomendado' },
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', desc: 'Equilíbrio entre capacidade e custo — bom pra uso do dia a dia.' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', desc: 'Mais rápido e mais barato, pra tarefas simples em volume alto.' },
  { value: 'gpt-4.1', label: 'GPT-4.1 (antigo)', desc: 'Geração anterior — mantido caso sua chave ainda não tenha acesso à família 5.6.' },
  { value: 'custom', label: 'Outro modelo', desc: 'Digite o nome exato de um modelo lançado depois desta lista.' },
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [model, setModel] = useState('gemini-2.5-flash-image')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [textProvider, setTextProvider] = useState<TextProvider>('claude-cli')
  const [geminiTextKey, setGeminiTextKey] = useState('')
  const [geminiTextKeyMasked, setGeminiTextKeyMasked] = useState('')
  const [showGeminiTextKey, setShowGeminiTextKey] = useState(false)
  const [geminiTextModel, setGeminiTextModel] = useState('gemini-3.6-flash')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [anthropicKeyMasked, setAnthropicKeyMasked] = useState('')
  const [claudeCliModel, setClaudeCliModel] = useState('')
  const [anthropicModel, setAnthropicModel] = useState('claude-sonnet-4-5-20250929')
  const [openaiKey, setOpenaiKey] = useState('')
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState('')
  const [openaiModel, setOpenaiModel] = useState('gpt-5.6-sol')
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((data: {
      geminiApiKeyMasked: string; geminiModel: string
      textProvider?: TextProvider; geminiTextApiKeyMasked?: string; geminiTextModel?: string
      claudeCliModel?: string
      anthropicApiKeyMasked?: string; anthropicModel?: string
      openaiApiKeyMasked?: string; openaiModel?: string
    }) => {
      setSavedKey(data.geminiApiKeyMasked || '')
      setModel(data.geminiModel || 'gemini-2.5-flash-image')
      setTextProvider(data.textProvider || 'claude-cli')
      setClaudeCliModel(data.claudeCliModel || '')
      setGeminiTextKeyMasked(data.geminiTextApiKeyMasked || '')
      setGeminiTextModel(data.geminiTextModel || 'gemini-3.6-flash')
      setAnthropicKeyMasked(data.anthropicApiKeyMasked || '')
      setAnthropicModel(data.anthropicModel || 'claude-sonnet-4-5-20250929')
      setOpenaiKeyMasked(data.openaiApiKeyMasked || '')
      setOpenaiModel(data.openaiModel || 'gpt-5.6-sol')
      setLoading(false)
    })
  }, [])

  const save = async () => {
    const body: Record<string, string> = { geminiModel: model, textProvider, geminiTextModel, claudeCliModel, anthropicModel, openaiModel }
    if (apiKey.trim()) body.geminiApiKey = apiKey.trim()
    if (geminiTextKey.trim()) body.geminiTextApiKey = geminiTextKey.trim()
    if (anthropicKey.trim()) body.anthropicApiKey = anthropicKey.trim()
    if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim()
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setSaved(true)
    if (apiKey.trim()) {
      setSavedKey(apiKey.slice(0, 6) + '••••••••••••••••' + apiKey.slice(-4))
      setApiKey('')
    }
    if (geminiTextKey.trim()) {
      setGeminiTextKeyMasked(geminiTextKey.slice(0, 6) + '••••••••••••••••' + geminiTextKey.slice(-4))
      setGeminiTextKey('')
    }
    if (anthropicKey.trim()) {
      setAnthropicKeyMasked(anthropicKey.slice(0, 6) + '••••••••••••••••' + anthropicKey.slice(-4))
      setAnthropicKey('')
    }
    if (openaiKey.trim()) {
      setOpenaiKeyMasked(openaiKey.slice(0, 6) + '••••••••••••••••' + openaiKey.slice(-4))
      setOpenaiKey('')
    }
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="settings"/>
      <main className="flex-1 overflow-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button className="p-2 rounded-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <ArrowLeft size={18}/>
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Settings size={18}/> Configurações</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>API keys e modelos de IA</p>
          </div>
        </div>

        {/* Geração de Imagens */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} style={{ color: 'var(--accent2)' }}/>
            <h2 className="font-bold">Geração de Imagens</h2>
          </div>

          {/* API Key */}
          <div className="mb-6">
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              API Key do Gemini
            </label>
            {savedKey && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-mono" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                <Check size={12}/> Chave salva: {savedKey}
              </div>
            )}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={savedKey ? 'Cole uma nova chave para substituir...' : 'AIza...'}
                className="w-full pr-10"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
                {showKey ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Obtenha sua chave em <span className="font-mono">aistudio.google.com</span> → Get API Key. A chave fica salva localmente só no seu computador.
            </p>
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Modelo de geração de imagem
            </label>
            <div className="space-y-2">
              {GEMINI_MODELS.map(m => (
                <button key={m.value} onClick={() => setModel(m.value)} className="w-full p-4 rounded-xl text-left transition-all"
                  style={model === m.value
                    ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)' }
                    : { background: 'var(--bg3)', border: '2px solid transparent' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{m.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: m.badge === 'Recomendado' ? 'rgba(255,138,30,0.16)' : 'var(--bg2)',
                      color: m.badge === 'Recomendado' ? 'var(--accent2)' : 'var(--muted)'
                    }}>{m.badge}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.desc}</p>
                  <p className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)', fontSize: 10 }}>{m.value}</p>
                </button>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
              O padrão é o mais barato — troca pra Nano Banana 2 ou Pro quando quiser mais qualidade num carrossel específico. Imagen 3/4 e o Gemini 2.0 Flash foram descontinuados pelo Google e não aparecem mais aqui.
            </p>
          </div>
        </div>

        {/* Geração de texto/copy */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold mb-1">Geração de Conteúdo — chat, legenda, prompts de imagem</h2>
          <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
            Por padrão o Claude Viral usa o Claude Code já logado na sua máquina, sem precisar de nenhuma chave.
            Se um dia você não quiser depender do CLI, pode usar sua própria API key de qualquer uma dessas.
          </p>

          <div className="space-y-2 mb-5">
            {TEXT_PROVIDERS.map(p => (
              <button key={p.value} type="button" onClick={() => setTextProvider(p.value)} className="w-full p-4 rounded-xl text-left transition-all"
                style={textProvider === p.value
                  ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)' }
                  : { background: 'var(--bg3)', border: '2px solid transparent' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{p.label}</span>
                  {p.value === 'claude-cli' && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                      <Check size={11}/> Sem chave
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{p.desc}</p>
              </button>
            ))}
          </div>

          {textProvider === 'claude-cli' && (
            <div className="p-4 rounded-xl mb-2" style={{ background: 'var(--bg3)' }}>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Modelo</label>
              <div className="space-y-2 mb-2">
                {CLAUDE_CLI_MODELS.map(m => {
                  const isCustomCard = m.value === 'custom'
                  const active = isCustomCard ? !CLAUDE_CLI_MODELS.some(o => o.value !== 'custom' && o.value === claudeCliModel) : claudeCliModel === m.value
                  return (
                    <button key={m.value} type="button"
                      onClick={() => setClaudeCliModel(isCustomCard ? 'fable' : m.value)}
                      className="w-full p-3 rounded-lg text-left transition-all"
                      style={active ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)' } : { background: 'var(--bg2)', border: '2px solid transparent' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs">{m.label}</span>
                        {m.badge && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)' }}>{m.badge}</span>}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.desc}</p>
                    </button>
                  )
                })}
              </div>
              {!CLAUDE_CLI_MODELS.some(o => o.value !== 'custom' && o.value === claudeCliModel) && (
                <input className="w-full mb-2" placeholder="Ex: fable" value={claudeCliModel} onChange={e => setClaudeCliModel(e.target.value)}/>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                Isso só troca o modelo dentro do Claude Viral — não muda o modelo padrão que você usa no terminal do Claude Code.
              </p>
            </div>
          )}

          {textProvider === 'anthropic-api' && (
            <div className="p-4 rounded-xl mb-2" style={{ background: 'var(--bg3)' }}>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>API Key da Anthropic</label>
              {anthropicKeyMasked && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-mono" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  <Check size={12}/> Chave salva: {anthropicKeyMasked}
                </div>
              )}
              <div className="relative mb-3">
                <input type={showAnthropicKey ? 'text' : 'password'} value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)}
                  placeholder={anthropicKeyMasked ? 'Cole uma nova chave para substituir...' : 'sk-ant-...'} className="w-full pr-10"/>
                <button type="button" onClick={() => setShowAnthropicKey(!showAnthropicKey)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
                  {showAnthropicKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Modelo</label>
              <div className="space-y-2 mb-2">
                {ANTHROPIC_MODELS.map(m => {
                  const isCustomCard = m.value === 'custom'
                  const active = isCustomCard ? !ANTHROPIC_MODELS.some(o => o.value !== 'custom' && o.value === anthropicModel) : anthropicModel === m.value
                  return (
                    <button key={m.value} type="button"
                      onClick={() => setAnthropicModel(isCustomCard ? '' : m.value)}
                      className="w-full p-3 rounded-lg text-left transition-all"
                      style={active ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)' } : { background: 'var(--bg2)', border: '2px solid transparent' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs">{m.label}</span>
                        {m.badge && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)' }}>{m.badge}</span>}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.desc}</p>
                    </button>
                  )
                })}
              </div>
              {!ANTHROPIC_MODELS.some(o => o.value !== 'custom' && o.value === anthropicModel) && (
                <input className="w-full mb-2" placeholder="Ex: claude-sonnet-4-6-20260101" value={anthropicModel} onChange={e => setAnthropicModel(e.target.value)}/>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Obtenha sua chave em <span className="font-mono">console.anthropic.com</span>.</p>
            </div>
          )}

          {textProvider === 'openai' && (
            <div className="p-4 rounded-xl mb-2" style={{ background: 'var(--bg3)' }}>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>API Key da OpenAI</label>
              {openaiKeyMasked && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-mono" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  <Check size={12}/> Chave salva: {openaiKeyMasked}
                </div>
              )}
              <div className="relative mb-3">
                <input type={showOpenaiKey ? 'text' : 'password'} value={openaiKey} onChange={e => setOpenaiKey(e.target.value)}
                  placeholder={openaiKeyMasked ? 'Cole uma nova chave para substituir...' : 'sk-...'} className="w-full pr-10"/>
                <button type="button" onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
                  {showOpenaiKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Modelo</label>
              <div className="space-y-2 mb-2">
                {OPENAI_MODELS.map(m => {
                  const isCustomCard = m.value === 'custom'
                  const active = isCustomCard ? !OPENAI_MODELS.some(o => o.value !== 'custom' && o.value === openaiModel) : openaiModel === m.value
                  return (
                    <button key={m.value} type="button"
                      onClick={() => setOpenaiModel(isCustomCard ? '' : m.value)}
                      className="w-full p-3 rounded-lg text-left transition-all"
                      style={active ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)' } : { background: 'var(--bg2)', border: '2px solid transparent' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs">{m.label}</span>
                        {m.badge && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)' }}>{m.badge}</span>}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.desc}</p>
                    </button>
                  )
                })}
              </div>
              {!OPENAI_MODELS.some(o => o.value !== 'custom' && o.value === openaiModel) && (
                <input className="w-full mb-2" placeholder="Ex: gpt-5.2" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)}/>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Obtenha sua chave em <span className="font-mono">platform.openai.com</span>.</p>
            </div>
          )}

          {textProvider === 'gemini' && (
            <div className="p-4 rounded-xl mb-2" style={{ background: 'var(--bg3)' }}>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>API Key do Gemini (texto)</label>
              {geminiTextKeyMasked && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs font-mono" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                  <Check size={12}/> Chave salva: {geminiTextKeyMasked}
                </div>
              )}
              <div className="relative mb-3">
                <input type={showGeminiTextKey ? 'text' : 'password'} value={geminiTextKey} onChange={e => setGeminiTextKey(e.target.value)}
                  placeholder={geminiTextKeyMasked ? 'Cole uma nova chave para substituir...' : 'AIza...'} className="w-full pr-10"/>
                <button type="button" onClick={() => setShowGeminiTextKey(!showGeminiTextKey)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
                  {showGeminiTextKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Use uma chave <strong>diferente</strong> da configurada em Geração de Imagens — essa aqui precisa vir de um
                projeto no Google AI Studio <strong>sem faturamento habilitado</strong>, senão ela cai no plano pago e perde
                o tier gratuito. Obtenha em <span className="font-mono">aistudio.google.com</span> → Get API Key → crie
                um projeto novo, sem ativar billing.
              </p>

              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Modelo</label>
              <div className="space-y-2 mb-2">
                {GEMINI_TEXT_MODELS.map(m => {
                  const isCustomCard = m.value === 'custom'
                  const active = isCustomCard ? !GEMINI_TEXT_MODELS.some(o => o.value !== 'custom' && o.value === geminiTextModel) : geminiTextModel === m.value
                  return (
                    <button key={m.value} type="button"
                      onClick={() => setGeminiTextModel(isCustomCard ? '' : m.value)}
                      className="w-full p-3 rounded-lg text-left transition-all"
                      style={active ? { background: 'rgba(255,138,30,0.1)', border: '2px solid var(--accent)' } : { background: 'var(--bg2)', border: '2px solid transparent' }}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-xs">{m.label}</span>
                        {m.badge && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)' }}>{m.badge}</span>}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.desc}</p>
                    </button>
                  )
                })}
              </div>
              {!GEMINI_TEXT_MODELS.some(o => o.value !== 'custom' && o.value === geminiTextModel) && (
                <input className="w-full mb-2" placeholder="Ex: gemini-4.0-flash" value={geminiTextModel} onChange={e => setGeminiTextModel(e.target.value)}/>
              )}
            </div>
          )}
        </div>

        <button onClick={save} className="w-full py-3.5 rounded-xl font-semibold text-black flex items-center justify-center gap-2" style={{ background: 'var(--grad)' }}>
          {saved ? <><Check size={16}/> Salvo!</> : 'Salvar configurações'}
        </button>
      </div>
      </main>
    </div>
  )
}
