'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff, Check, Settings, Zap } from 'lucide-react'

const GEMINI_MODELS = [
  {
    value: 'imagen-3.0-fast-generate-001',
    label: 'Imagen 3 Fast',
    desc: 'Rápido e econômico. Ideal para uso diário e testes de composição.',
    badge: 'Recomendado',
  },
  {
    value: 'imagen-3.0-generate-001',
    label: 'Imagen 3',
    desc: 'Qualidade máxima, mais lento. Use para as imagens finais de publicação.',
    badge: 'Alta qualidade',
  },
  {
    value: 'gemini-2.0-flash-exp',
    label: 'Gemini 2.0 Flash',
    desc: 'Modelo multimodal experimental. Gera imagem via texto com contexto narrativo.',
    badge: 'Experimental',
  },
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [model, setModel] = useState('imagen-3.0-fast-generate-001')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((data: { geminiApiKeyMasked: string; geminiModel: string }) => {
      setSavedKey(data.geminiApiKeyMasked || '')
      setModel(data.geminiModel || 'imagen-3.0-fast-generate-001')
      setLoading(false)
    })
  }, [])

  const save = async () => {
    const body: { geminiModel: string; geminiApiKey?: string } = { geminiModel: model }
    if (apiKey.trim()) body.geminiApiKey = apiKey.trim()
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
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div className="min-h-screen p-8">
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

        {/* Gemini section */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} style={{ color: '#e8421a' }}/>
            <h2 className="font-bold">Google Gemini — Geração de Imagens</h2>
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
                    ? { background: 'rgba(166,255,62,0.08)', border: '2px solid var(--accent)' }
                    : { background: 'var(--bg3)', border: '2px solid transparent' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{m.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: m.badge === 'Recomendado' ? 'rgba(232,66,26,0.15)' : 'var(--bg2)',
                      color: m.badge === 'Recomendado' ? '#e8421a' : 'var(--muted)'
                    }}>{m.badge}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.desc}</p>
                  <p className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)', fontSize: 10 }}>{m.value}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Claude section */}
        <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold mb-3">Claude — Geração de Conteúdo</h2>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <Check size={16} style={{ color: '#22c55e' }}/>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#22c55e' }}>Claude conectado via extensão VS Code</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Usa o Claude já logado na sua máquina. Nenhuma API key necessária.</p>
            </div>
          </div>
        </div>

        <button onClick={save} className="w-full py-3.5 rounded-xl font-semibold text-black flex items-center justify-center gap-2" style={{ background: 'var(--grad)' }}>
          {saved ? <><Check size={16}/> Salvo!</> : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}
