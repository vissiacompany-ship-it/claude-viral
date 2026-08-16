'use client'

import ColorInput from './ColorInput'

// Campo de cor da marca reutilizável — alterna entre 1 cor sólida e um degradê de 2 a 4
// cores. Usado tanto na tela de Perfis quanto no editor de template ("Dados do perfil").
export default function BrandColorField({ color, colors, onColorChange, onColorsChange, label = 'Cor da marca' }: {
  color: string
  colors: string[]
  onColorChange: (c: string) => void
  onColorsChange: (c: string[]) => void
  label?: string
}) {
  const isGradient = colors.length > 1

  const useSolid = () => onColorsChange([])
  const useGradient = () => {
    if (colors.length > 1) return
    onColorsChange([color, '#c026d3'])
  }
  const setCount = (n: number) => {
    const base = colors.length ? colors : [color, '#c026d3']
    const next = [...base]
    while (next.length < n) next.push('#c026d3')
    onColorsChange(next.slice(0, n))
  }
  const setStop = (i: number, v: string) => {
    const next = [...colors]
    next[i] = v
    onColorsChange(next)
  }

  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{label}</label>
      <div className="flex gap-1 mt-1 mb-2">
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
        <ColorInput value={color} onChange={onColorChange} size={36}/>
      ) : (
        <div>
          <div className="flex gap-1 mb-1.5">
            {[2, 3, 4].map(n => (
              <button key={n} type="button" onClick={() => setCount(n)}
                className="flex-1 py-1 rounded-md text-[10px] font-semibold"
                style={{ background: colors.length === n ? 'var(--bg3)' : 'transparent', color: colors.length === n ? 'var(--text)' : 'var(--muted)', border: '1px solid var(--border)' }}>
                {n} cores
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 mb-1.5">
            {colors.map((c, i) => (
              <ColorInput key={i} value={c} onChange={v => setStop(i, v)} size={36}/>
            ))}
          </div>
          <div className="w-full h-6 rounded-lg" style={{ background: `linear-gradient(90deg, ${colors.join(', ')})` }}/>
        </div>
      )}
    </div>
  )
}
