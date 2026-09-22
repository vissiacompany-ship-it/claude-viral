'use client'

import { useState, useCallback, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmState {
  message: string
  danger: boolean
  resolve: (v: boolean) => void
}

// Substitui o confirm() nativo do navegador (aquela caixinha feia "localhost:3000 diz...")
// por um modal no estilo do app. Uso: const { confirm, ConfirmModal } = useConfirm(); depois
// `if (!(await confirm('Excluir isso?'))) return` no lugar de `if (!confirm(...)) return`, e
// <ConfirmModal/> uma vez em algum lugar do JSX da página (fica invisível até ser chamado).
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((message: string, opts?: { danger?: boolean }) => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve
      setState({ message, danger: opts?.danger ?? true, resolve })
    })
  }, [])

  const close = (result: boolean) => {
    resolveRef.current?.(result)
    resolveRef.current = null
    setState(null)
  }

  const ConfirmModal = state ? (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => close(false)}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={state.danger ? { background: 'rgba(255,80,80,0.14)', color: '#ff8080' } : { background: 'rgba(255,138,30,0.14)', color: 'var(--accent2)' }}>
            <AlertTriangle size={17}/>
          </div>
          <p className="text-[14.5px] leading-snug pt-1.5" style={{ color: 'var(--text)' }}>{state.message}</p>
        </div>
        <div className="flex items-center gap-2.5 justify-end">
          <button onClick={() => close(false)}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Cancelar
          </button>
          <button onClick={() => close(true)}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={state.danger
              ? { background: 'rgba(255,80,80,0.16)', border: '1px solid rgba(255,80,80,0.4)', color: '#ff8080' }
              : { background: 'var(--grad)', color: '#000' }}>
            {state.danger ? 'Excluir' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, ConfirmModal }
}
