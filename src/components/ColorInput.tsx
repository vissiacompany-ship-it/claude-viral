'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

type HSV = { h: number; s: number; v: number }

function hexToHsv(hex: string): HSV {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return { h: 0, s: 0, v: 0 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s: s * 100, v: max * 100 }
}

function hsvToHex({ h, s, v }: HSV): string {
  s /= 100; v /= 100
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

// Substitui o <input type="color"> nativo (o seletor do sistema operacional, que não dá
// pra estilizar e foge completamente da identidade visual) por um popover próprio: área de
// arrastar (matiz + saturação/brilho) + campo hex + presets rápidos + conta-gotas. Usado em
// todo lugar do app que precisa escolher uma cor sólida.
export default function ColorInput({ value, onChange, size = 32 }: {
  value: string
  onChange: (hex: string) => void
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(value)
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value))
  // Sincroniza com "value" durante o render (padrão oficial do React pra "ajustar state
  // quando uma prop muda") em vez de useEffect.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setHex(value)
    setHsv(hexToHsv(value))
  }
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  // Fixed (não absolute) — escapa de qualquer painel com overflow:auto/hidden por perto
  // (senão o popover fica cortado ou "atrás" de outra coisa, dependendo de onde o botão
  // está na tela). Posição calculada na hora de abrir, com folga pra não estourar a borda.
  const toggleOpen = () => {
    if (open) { setOpen(false); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const popW = 220
      const popH = 340 // altura aproximada do popover (área SV + matiz + hex + presets)
      let left = r.left
      if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8
      // Sem espaço embaixo (painel rolado pro fim, por ex.) — abre pra CIMA do botão em vez
      // de embaixo, senão o popover nasce cortado/inacessível na borda da tela.
      const top = r.bottom + 6 + popH > window.innerHeight
        ? Math.max(8, r.top - popH - 6)
        : r.bottom + 6
      setPos({ top, left })
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
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      setHsv(hexToHsv(v))
      onChange(v)
    }
  }

  // Arrastar dentro do quadrado = saturação (eixo X) + brilho (eixo Y, invertido: topo=100%).
  const dragSV = useCallback((clientX: number, clientY: number) => {
    const el = svRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - r.left, 0), r.width)
    const y = Math.min(Math.max(clientY - r.top, 0), r.height)
    setHsv(prev => {
      const next = { h: prev.h, s: (x / r.width) * 100, v: 100 - (y / r.height) * 100 }
      const h = hsvToHex(next)
      setHex(h)
      onChange(h)
      return next
    })
  }, [onChange])

  // Arrastar na barra horizontal = matiz (0-360).
  const dragHue = useCallback((clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - r.left, 0), r.width)
    setHsv(prev => {
      const next = { ...prev, h: (x / r.width) * 360 }
      const h = hsvToHex(next)
      setHex(h)
      onChange(h)
      return next
    })
  }, [onChange])

  const onSvPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragSV(e.clientX, e.clientY)
    const move = (ev: PointerEvent) => dragSV(ev.clientX, ev.clientY)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [dragSV])

  const onHuePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragHue(e.clientX)
    const move = (ev: PointerEvent) => dragHue(ev.clientX)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [dragHue])

  const pickFromScreen = async () => {
    if (!window.EyeDropper) return
    try {
      const result = await new window.EyeDropper().open()
      commitHex(result.sRGBHex)
    } catch { /* usuário cancelou (Esc) — não faz nada */ }
  }

  const hueColor = hsvToHex({ h: hsv.h, s: 100, v: 100 })

  return (
    <div className="relative inline-block">
      <button ref={btnRef} type="button" onClick={toggleOpen}
        className="rounded-lg flex-shrink-0"
        style={{ width: size, height: size, background: value || '#000000', border: '1.5px solid var(--border2)' }}/>
      {open && (
        <div ref={popRef} className="fixed p-3 rounded-xl z-[200] space-y-2.5"
          style={{ top: pos.top, left: pos.left, width: 220, background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 12px 32px rgba(0,0,0,.5)' }}>

          {/* Quadrado de saturação/brilho — arrasta livre pra qualquer tom da matiz atual */}
          <div ref={svRef} onPointerDown={onSvPointerDown}
            className="relative rounded-lg cursor-crosshair select-none"
            style={{
              width: '100%', height: 140, touchAction: 'none',
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
            }}>
            <div className="absolute rounded-full pointer-events-none"
              style={{
                width: 14, height: 14, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4), 0 1px 4px rgba(0,0,0,.5)',
                left: `${hsv.s}%`, top: `${100 - hsv.v}%`, transform: 'translate(-50%, -50%)',
                background: hex,
              }}/>
          </div>

          {/* Barra de matiz — arrasta pra trocar a cor base (o quadrado acima reage na hora) */}
          <div ref={hueRef} onPointerDown={onHuePointerDown}
            className="relative rounded-full cursor-pointer select-none"
            style={{
              width: '100%', height: 14, touchAction: 'none',
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}>
            <div className="absolute rounded-full pointer-events-none top-1/2"
              style={{
                width: 18, height: 18, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.4), 0 1px 4px rgba(0,0,0,.5)',
                left: `${(hsv.h / 360) * 100}%`, transform: 'translate(-50%, -50%)',
                background: hueColor,
              }}/>
          </div>

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
