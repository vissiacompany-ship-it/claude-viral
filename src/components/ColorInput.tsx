'use client'

import { useState, useRef, useEffect } from 'react'
import { Pipette } from 'lucide-react'

const PRESETS = [
  '#FF6A1E', '#FFC94A', '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#111111', '#FFFFFF',
]

// API nativa do Chrome/Edge (window.EyeDropper) — deixa escolher uma cor de qualquer
// pixel na tela, não só da nossa paleta. Indisponível no Firefox/Safari; nesse caso o
// botão do conta-gotas simplesmente não aparece (sem quebrar nada).
type EyeDropperResult = { sRGBHex: string }
type EyeDropperCtor = new () => { open: () => Promise<EyeDropperResult> }
declare global {
  interface Window { EyeDropper?: EyeDropperCtor }
}

// Substitui o <input type="color"> nativo (o seletor do sistema operacional, que não dá
// pra estilizar e foge completamente da identidade visual) por um popover próprio: swatch +
// campo hex + presets rápidos. Usado em todo lugar do app que precisa escolher uma cor sólida.
export default function ColorInput({ value, onChange, size = 32 }: {
  value: string
  onChange: (hex: string) => void
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHex(value) }, [value])

  // Fixed (não absolute) — escapa de qualquer painel com overflow:auto/hidden por perto
  // (senão o popover fica cortado ou "atrás" de outra coisa, dependendo de onde o botão
  // está na tela). Posição calculada na hora de abrir, com folga pra não estourar a borda.
  const toggleOpen = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const popW = 200
      let left = r.left
      if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8
      setPos({ top: r.bottom + 6, left })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const commitHex = (v: string) => {
    setHex(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
  }

  const pickFromScreen = async () => {
    if (!window.EyeDropper) return
    try {
      const result = await new window.EyeDropper().open()
      commitHex(result.sRGBHex)
    } catch { /* usuário cancelou (Esc) — não faz nada */ }
  }

  return (
    <div className="relative inline-block">
      <button ref={btnRef} type="button" onClick={toggleOpen}
        className="rounded-lg flex-shrink-0"
        style={{ width: size, height: size, background: value || '#000000', border: '1.5px solid var(--border2)' }}/>
      {open && (
        <div ref={popRef} className="fixed p-3 rounded-xl z-[200] space-y-2.5"
          style={{ top: pos.top, left: pos.left, width: 200, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 12px 32px rgba(0,0,0,.5)' }}>
          <div className="flex items-center gap-2">
            <div className="rounded-lg flex-shrink-0" style={{ width: 28, height: 28, background: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : value, border: '1.5px solid var(--border2)' }}/>
            <input value={hex} onChange={e => commitHex(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-mono" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}/>
            {typeof window !== 'undefined' && window.EyeDropper && (
              <button type="button" onClick={pickFromScreen} title="Pegar cor de qualquer lugar da tela"
                className="p-1.5 rounded-lg flex-shrink-0" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--accent2)' }}>
                <Pipette size={14}/>
              </button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESETS.map(c => (
              <button key={c} type="button" onClick={() => { commitHex(c); }}
                className="rounded-md aspect-square" style={{ background: c, border: c.toUpperCase() === hex.toUpperCase() ? '2px solid var(--accent)' : '1px solid var(--border2)' }}/>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
