'use client'

import { useState, useRef, useEffect } from 'react'
import ColorInput from './ColorInput'

// Swatch + popover pra cor de um destaque (palavra marcada) — sólida, degradê, ou um
// atalho de 1 clique pra usar a mesma cor primária já definida no perfil.
export default function HighlightColorField({ color, colors, profileColor, onChange }: {
  color: string
  colors?: string[]
  profileColor: string
  onChange: (patch: { color?: string; colors?: string[] }) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const isGradient = (colors?.length || 0) > 1

  // fixed (não absolute) — mesmo motivo do ColorInput: escapa de qualquer painel com
  // overflow por perto, que senão cortava ou empurrava o popover pra trás de outra coisa.
  const toggleOpen = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const popW = 210
      let left = r.right - popW
      if (left < 8) left = 8
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

  const useProfileColor = () => onChange({ color: profileColor, colors: undefined })
  const useSolid = () => onChange({ colors: undefined })
  const useGradient = () => { if (!isGradient) onChange({ colors: [color, '#c026d3'] }) }
  const setCount = (n: number) => {
    const base = colors && colors.length ? colors : [color, '#c026d3']
    const next = [...base]
    while (next.length < n) next.push('#c026d3')
    onChange({ colors: next.slice(0, n) })
  }
  const setStop = (i: number, v: string) => {
    const next = [...(colors || [color, '#c026d3'])]
    next[i] = v
    onChange({ colors: next })
  }

  return (
    <div className="relative flex-shrink-0">
      <button ref={btnRef} type="button" onClick={toggleOpen}
        className="w-8 h-8 rounded-lg flex-shrink-0"
        style={{ background: isGradient ? `linear-gradient(90deg, ${colors!.join(', ')})` : color, border: '1.5px solid var(--border2)' }}/>
      {open && (
        <div ref={popRef} className="fixed p-3 rounded-xl z-[200] space-y-2"
          style={{ top: pos.top, left: pos.left, width: 210, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 12px 32px rgba(0,0,0,.5)' }}>
          <button onClick={useProfileColor}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-semibold"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: profileColor }}/>
            Usar cor do perfil
          </button>
          <div className="flex gap-1">
            <button type="button" onClick={useSolid}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: !isGradient ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: !isGradient ? 'var(--accent2)' : 'var(--muted)', border: !isGradient ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
              Sólida
            </button>
            <button type="button" onClick={useGradient}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: isGradient ? 'rgba(255,138,30,0.16)' : 'var(--bg3)', color: isGradient ? 'var(--accent2)' : 'var(--muted)', border: isGradient ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
              Degradê
            </button>
          </div>
          {!isGradient ? (
            <ColorInput value={color} onChange={v => onChange({ color: v })} size={32}/>
          ) : (
            <div>
              <div className="flex gap-1 mb-1.5">
                {[2, 3, 4].map(n => (
                  <button key={n} type="button" onClick={() => setCount(n)}
                    className="flex-1 py-1 rounded-md text-[10px] font-semibold"
                    style={{ background: (colors?.length || 0) === n ? 'var(--bg3)' : 'transparent', color: (colors?.length || 0) === n ? 'var(--text)' : 'var(--muted)', border: '1px solid var(--border)' }}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {(colors || []).map((c, i) => (
                  <ColorInput key={i} value={c} onChange={v => setStop(i, v)} size={28}/>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
