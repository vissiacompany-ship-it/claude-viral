'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CarouselTemplate } from '@/types'
import { ArrowLeft, LayoutTemplate } from 'lucide-react'

export default function TemplatesPicker() {
  const [templates, setTemplates] = useState<CarouselTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 8000)
    fetch('/api/templates', { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(t => { setTemplates(t); setLoading(false) })
      .catch(e => { setError(e.name === 'AbortError' ? 'Sem resposta do servidor (timeout). Feche a aba e abra de novo.' : (e.message || 'Falha ao carregar')); setLoading(false) })
      .finally(() => clearTimeout(timeout))
  }, [])

  return (
    <div className="min-h-screen">
      <div className="p-8" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <Link href="/"><ArrowLeft size={18} style={{ color: 'var(--muted)' }}/></Link>
          <h1 className="text-2xl font-bold">Escolha o modelo</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Cada modelo já tem a estrutura (posição, fundo, imagem) definida — você só preenche o conteúdo.</p>
      </div>

      <div className="p-8">
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>Carregando…</p>
        ) : error ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--bg2)', border: '1px dashed #d94b4b' }}>
            <p className="text-lg font-semibold mb-2" style={{ color: '#e08a8a' }}>Erro ao carregar modelos</p>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{error}</p>
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl font-semibold text-black text-sm" style={{ background: 'var(--grad)' }}>
              Tentar de novo
            </button>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--bg2)', border: '1px dashed var(--border)' }}>
            <p className="text-lg font-semibold mb-2">Nenhum modelo ainda</p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Manda a referência visual que você quer usar como padrão.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {templates.map(t => (
              <Link key={t.id} href={`/template/${t.id}`} className="block">
                <div className="rounded-2xl p-6 cursor-pointer hover:opacity-90 transition-opacity h-full" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: 'var(--grad)' }}>
                    <LayoutTemplate size={20} className="text-black"/>
                  </div>
                  <h3 className="font-bold mb-2">{t.name}</h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>{t.description}</p>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                    {t.slides.length} slides
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
