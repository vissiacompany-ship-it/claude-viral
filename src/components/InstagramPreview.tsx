'use client'

import { useState, useMemo, useRef } from 'react'
import { Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight, X, MoreHorizontal, Sparkles, Copy, Check } from 'lucide-react'
import { Carousel } from '@/types'
import { generateSlideHTML } from '@/lib/html-renderer'

// Simulação de como o carrossel fica postado no feed do Instagram — swipe pelos slides
// reais (renderizados com o mesmo HTML/CSS que o editor usa). A geração da legenda em si
// é a mesma função usada pelo botão "Gerar legenda" do cabeçalho (passada por prop) — aqui
// só mostra o botão quando ainda não tem legenda, ou o texto já gerado quando já tem.
export default function InstagramPreview({ carousel, caption, onCaptionChange, onClose, onGenerate, generating, genError }: {
  carousel: Carousel
  caption: string
  onCaptionChange: (c: string) => void
  onClose: () => void
  onGenerate: () => void
  generating: boolean
  genError: string
}) {
  const [active, setActive] = useState(0)
  const [editingCaption, setEditingCaption] = useState(false)
  const [expandCaption, setExpandCaption] = useState(false)
  const [copied, setCopied] = useState(false)
  const iframeRefs = useRef<Array<HTMLIFrameElement | null>>([])

  const copiar = () => {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const slidesHTML = useMemo(
    () => carousel.content.slides.map(s => generateSlideHTML(carousel, s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const total = slidesHTML.length
  const handle = carousel.briefing.niche || 'sua_marca'
  const avatarImage = carousel.briefing.avatarImage

  // Tamanho do "telefone" — grande o bastante pra ler o texto do slide direito, mas
  // limitado à altura da tela (min com 88vh) pra nunca estourar em monitores menores.
  const PHONE_W = 460
  const IMG_H = Math.round(PHONE_W * 1.25)
  const scale = PHONE_W / 1080

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="flex gap-4" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
      <div className="rounded-[28px] overflow-x-hidden overflow-y-auto flex flex-col" style={{ width: PHONE_W, maxHeight: '92vh', background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        {/* Post header */}
        <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'var(--grad)' }}>
            {avatarImage ? <img src={avatarImage} alt="" className="w-full h-full object-cover"/> : <span className="text-sm font-bold text-black">{handle.charAt(0).toUpperCase()}</span>}
          </div>
          <span className="text-[15px] font-semibold flex-1" style={{ color: '#111' }}>{handle}</span>
          <MoreHorizontal size={20} style={{ color: '#111' }}/>
          <button onClick={onClose} className="p-0.5"><X size={19} style={{ color: '#111' }}/></button>
        </div>

        {/* Slide (4:5, igual ao formato real 1080x1350) */}
        <div className="relative flex-shrink-0" style={{ width: PHONE_W, height: IMG_H, overflow: 'hidden' }}>
          <iframe
            ref={el => { iframeRefs.current[active] = el }}
            key={active}
            srcDoc={slidesHTML[active]}
            title={`slide-${active}`}
            style={{ width: 1080, height: 1350, border: 'none', transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}
          />
          {total > 1 && (
            <>
              {active > 0 && (
                <button onClick={() => setActive(a => a - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)', color: '#111' }}>
                  <ChevronLeft size={16}/>
                </button>
              )}
              {active < total - 1 && (
                <button onClick={() => setActive(a => a + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.9)', color: '#111' }}>
                  <ChevronRight size={16}/>
                </button>
              )}
              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                {active + 1}/{total}
              </div>
              <div className="absolute bottom-2.5 left-0 right-0 flex items-center justify-center gap-1">
                {slidesHTML.map((_, i) => (
                  <span key={i} className="rounded-full" style={{ width: i === active ? 5 : 4, height: i === active ? 5 : 4, background: i === active ? '#3897f0' : 'rgba(255,255,255,0.7)' }}/>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Barra de ações */}
        <div className="flex items-center gap-4 px-4 pt-3 flex-shrink-0" style={{ color: '#111' }}>
          <Heart size={26}/>
          <MessageCircle size={26} style={{ transform: 'scaleX(-1)' }}/>
          <Send size={24}/>
          <div className="flex-1"/>
          <Bookmark size={25}/>
        </div>
        <p className="px-4 pt-2 text-[15px] font-semibold flex-shrink-0" style={{ color: '#111' }}>1.247 curtidas</p>

        {/* Legenda — trunca em 2 linhas como um post de verdade, expande ao clicar */}
        <div className="px-4 pt-1.5 pb-4 flex-shrink-0">
          {caption ? (
            editingCaption ? (
              <textarea autoFocus value={caption} onChange={e => onCaptionChange(e.target.value)} onBlur={() => setEditingCaption(false)}
                rows={6} className="w-full text-[15px] resize-none outline-none" style={{ color: '#111', border: '1px solid #ddd', borderRadius: 8, padding: 8 }}/>
            ) : (
              <p className="text-[15px] leading-snug whitespace-pre-wrap cursor-text" style={{ color: '#111', display: '-webkit-box', WebkitLineClamp: expandCaption ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: expandCaption ? 'visible' : 'hidden' }}
                onClick={() => setEditingCaption(true)}>
                <span className="font-semibold">{handle}</span> {caption}
              </p>
            )
          ) : (
            <p className="text-[15px]" style={{ color: '#999' }}>Nenhuma legenda ainda.</p>
          )}
          {caption && !editingCaption && (
            <button onClick={() => setExpandCaption(v => !v)} className="text-[13px]" style={{ color: '#999' }}>{expandCaption ? 'ver menos' : 'mais'}</button>
          )}
          <p className="text-[11px] mt-1.5 uppercase" style={{ color: '#bbb' }}>Há 2 horas</p>
        </div>
      </div>

      {/* Painel da legenda: botão de gerar se ainda não tem, ou o texto + copiar se já tem */}
      <div className="rounded-2xl p-4 flex flex-col gap-3 flex-shrink-0 overflow-y-auto" style={{ width: 320, maxHeight: '92vh', background: 'var(--bg2)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Legenda</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--muted)' }}><X size={16}/></button>
        </div>
        {!caption ? (
          <button onClick={onGenerate} disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            style={{ background: 'rgba(255,138,30,0.16)', border: '1px solid var(--accent)', color: 'var(--accent2)' }}>
            <Sparkles size={13}/> {generating ? 'Gerando legenda…' : 'Gerar legenda com IA'}
          </button>
        ) : (
          <>
            <p className="text-xs whitespace-pre-wrap overflow-y-auto" style={{ color: 'var(--text)' }}>{caption}</p>
            <button onClick={copiar} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold flex-shrink-0" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {copied ? <><Check size={13}/> Copiado</> : <><Copy size={13}/> Copiar legenda</>}
            </button>
          </>
        )}
        {genError && <p className="text-[11px]" style={{ color: '#ff8080' }}>{genError}</p>}
      </div>
      </div>
    </div>
  )
}
