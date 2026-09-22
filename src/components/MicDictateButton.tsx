'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

// Ditado por voz usando a Web Speech API do navegador (Chrome/Edge) — não depende de nenhum
// serviço externo nem de chave de API. Cada trecho finalizado (a pessoa faz uma pausa) chega
// via onTranscript pra quem estiver usando o botão decidir onde encaixar o texto.
interface SpeechRecognitionResultLike { isFinal: boolean; [index: number]: { transcript: string } }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

export default function MicDictateButton({ onTranscript, className }: { onTranscript: (text: string) => void; className?: string }) {
  const [supported, setSupported] = useState(() => !!getRecognitionCtor())
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const Ctor = getRecognitionCtor()
    if (!Ctor) { setSupported(false); return }
    setError('')
    const recognition = new Ctor()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) onTranscript(result[0].transcript.trim())
      }
    }
    recognition.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Permissão de microfone negada.' : 'Não consegui captar o áudio.')
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  if (!supported) return null

  return (
    <span className="inline-flex items-center gap-1.5">
      <button type="button" onClick={toggle} title={listening ? 'Parar ditado' : 'Falar em vez de digitar'}
        className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${className || ''}`}
        style={listening ? { background: '#ef4444', color: '#fff' } : { background: 'var(--bg3)', color: 'var(--muted)' }}>
        {listening ? <Square size={12}/> : <Mic size={13}/>}
      </button>
      {listening && <span className="text-[10px] font-semibold" style={{ color: '#ef4444' }}>ouvindo…</span>}
      {error && <span className="text-[10px]" style={{ color: '#ef4444' }}>{error}</span>}
    </span>
  )
}
