import { Carousel, Slide, VisualStyle } from '@/types'

export function derivePalette(primary: string) {
  return {
    P: primary,
    PL: primary + 'cc',
    PD: primary + '88',
    LB: '#F7F4F1',
    DB: '#0F0D0C',
    LR: '#E8E4E0',
    G: `linear-gradient(165deg, ${primary}88 0%, ${primary} 50%, ${primary}cc 100%)`,
  }
}

function renderSlideCSS(palette: ReturnType<typeof derivePalette>, style: VisualStyle): string {
  const { P, PL, DB, LB, LR, G } = palette
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 40px 20px; font-family: 'Plus Jakarta Sans', sans-serif; }

    :root {
      --P: ${P};
      --PL: ${PL};
      --DB: ${DB};
      --LB: ${LB};
      --LR: ${LR};
      --G: ${G};
      --F-HEAD: 'Barlow Condensed', 'Space Grotesk', sans-serif;
      --F-BODY: 'Plus Jakarta Sans', sans-serif;
    }

    .slide {
      width: 1080px;
      height: 1350px;
      position: relative;
      overflow: hidden;
      flex-shrink: 0;
    }

    /* Accent bar */
    .accent-bar {
      position: absolute; top: 0; left: 0; right: 0;
      height: 7px; z-index: 30;
      background: var(--G);
    }

    /* Brand bar */
    .brand-bar {
      position: absolute; top: 7px; left: 0; right: 0;
      padding: 32px 56px 0;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 20;
      font-family: var(--F-BODY);
      font-size: 14px; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase;
    }
    .brand-bar.on-light { color: rgba(15,13,12,0.45); }
    .brand-bar.on-dark  { color: rgba(255,255,255,0.45); }
    .brand-bar.on-grad  { color: rgba(255,255,255,0.50); }

    /* Progress bar */
    .prog {
      position: absolute; bottom: 0; left: 0; right: 0;
      padding: 0 56px 30px; z-index: 20;
      display: flex; align-items: center; gap: 16px;
    }
    .prog-track { flex: 1; height: 3px; border-radius: 2px; overflow: hidden; }
    .prog-fill  { height: 100%; border-radius: 2px; }
    .prog-num   { font-size: 15px; font-weight: 600; font-family: var(--F-BODY); }
    .on-light .prog-track { background: rgba(0,0,0,0.08); }
    .on-light .prog-fill  { background: var(--P); }
    .on-light .prog-num   { color: rgba(0,0,0,0.22); }
    .on-dark  .prog-track { background: rgba(255,255,255,0.10); }
    .on-dark  .prog-fill  { background: #fff; }
    .on-dark  .prog-num   { color: rgba(255,255,255,0.22); }
    .on-grad  .prog-track { background: rgba(255,255,255,0.15); }
    .on-grad  .prog-fill  { background: rgba(255,255,255,0.6); }
    .on-grad  .prog-num   { color: rgba(255,255,255,0.30); }

    /* Content area */
    .content {
      position: absolute;
      top: 110px; left: 56px; right: 56px; bottom: 80px;
      display: flex; flex-direction: column; justify-content: flex-end;
      padding-bottom: 40px;
    }

    /* Tag */
    .tag {
      font-family: var(--F-BODY);
      font-size: 13px; font-weight: 700;
      letter-spacing: 3px; text-transform: uppercase;
      margin-bottom: 24px;
    }
    .on-light .tag { color: var(--P); }
    .on-dark  .tag { color: var(--PL); }
    .on-grad  .tag { color: rgba(255,255,255,0.55); }

    /* === SLIDES === */

    /* COVER */
    .slide-cover { background: #000; }
    .capa-bg { position: absolute; inset: 0; overflow: hidden; }
    .capa-grad {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom,
        rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.08) 25%,
        rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.65) 55%,
        rgba(0,0,0,0.92) 75%, rgba(0,0,0,0.99) 100%
      );
    }
    .capa-headline-area {
      position: absolute; bottom: 120px; left: 0; right: 0;
      padding: 0 52px; z-index: 10;
    }
    .capa-badge {
      display: flex; align-items: center; gap: 14px;
      background: rgba(0,0,0,0.38);
      border: 1.5px solid rgba(255,255,255,0.12);
      border-radius: 60px; padding: 12px 26px 12px 14px;
      backdrop-filter: blur(10px); width: fit-content;
      margin-bottom: 32px;
    }
    .badge-dot {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--G); display: flex; align-items: center;
      justify-content: center; font-size: 16px; font-weight: 900; color: #fff;
      font-family: var(--F-BODY); overflow: hidden;
    }
    .badge-dot img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
    .badge-handle { font-family: var(--F-BODY); font-size: 22px; font-weight: 700; color: #fff; }
    .capa-headline {
      font-family: var(--F-HEAD);
      font-size: 96px; font-weight: 900;
      line-height: 0.93; letter-spacing: -3px; text-transform: uppercase;
      color: #fff;
    }
    .capa-headline em { color: var(--P); font-style: normal; }
    .capa-subtitle {
      font-family: var(--F-BODY); font-size: 36px; font-weight: 400;
      color: rgba(255,255,255,0.75); margin-top: 20px; font-style: italic;
    }
    .capa-subtitle em { color: var(--PL); font-style: italic; }

    /* DARK */
    .slide-dark { background: var(--DB); }
    .dark-h1 {
      font-family: var(--F-HEAD); font-size: 80px; font-weight: 900;
      line-height: 0.97; letter-spacing: -2px; text-transform: uppercase;
      color: #fff; margin-bottom: 36px;
    }
    .dark-h1 em { color: var(--P); font-style: normal; }
    .dark-body {
      font-family: var(--F-BODY); font-size: 38px; font-weight: 400;
      line-height: 1.5; color: rgba(255,255,255,0.55);
    }
    .dark-body p { margin-bottom: 28px; }
    .dark-body p:last-child { margin-bottom: 0; }
    .dark-body strong { color: #fff; font-weight: 700; }
    .dark-body em { color: var(--PL); font-style: normal; }
    .dark-card {
      background: rgba(255,255,255,0.04);
      border-left: 6px solid var(--P);
      border-radius: 16px; padding: 44px 48px; margin-bottom: 28px;
    }
    .dark-bg-num {
      position: absolute; right: -10px; bottom: 50px;
      font-family: var(--F-HEAD); font-size: 380px; font-weight: 900;
      color: rgba(255,255,255,0.04); line-height: 1; pointer-events: none;
    }
    .dark-table { width: 100%; border-collapse: collapse; }
    .dark-table th { background: var(--P); color: #fff; padding: 20px 24px; font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; text-align: left; font-family: var(--F-BODY); }
    .dark-table td { padding: 22px 24px; font-size: 26px; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.08); font-family: var(--F-BODY); color: rgba(255,255,255,0.7); }
    .dark-table tr:last-child td { border-bottom: none; }

    /* LIGHT */
    .slide-light { background: var(--LB); }
    .light-h1 {
      font-family: var(--F-HEAD); font-size: 72px; font-weight: 900;
      line-height: 1.0; letter-spacing: -1.5px; text-transform: uppercase;
      color: var(--DB); margin-bottom: 32px;
    }
    .light-h1 em { color: var(--P); font-style: normal; }
    .light-body {
      font-family: var(--F-BODY); font-size: 38px; font-weight: 400;
      line-height: 1.55; color: rgba(15,13,12,0.60);
    }
    .light-body p { margin-bottom: 28px; }
    .light-body p:last-child { margin-bottom: 0; }
    .light-body strong { color: var(--DB); font-weight: 800; }
    .light-body em { color: var(--P); font-style: normal; }
    .light-card {
      background: #fff; border-left: 7px solid var(--P);
      border-radius: 18px; padding: 52px 56px; margin-bottom: 20px;
    }
    .light-table { width: 100%; border-collapse: collapse; }
    .light-table th { background: var(--P); color: #fff; padding: 20px 24px; font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; text-align: left; font-family: var(--F-BODY); }
    .light-table td { padding: 22px 24px; font-size: 26px; font-weight: 500; border-bottom: 1px solid var(--LR); font-family: var(--F-BODY); color: rgba(15,13,12,0.7); }
    .light-table tr:last-child td { border-bottom: none; }

    /* GRADIENT */
    .slide-grad { background: var(--G); }
    .grad-h1 {
      font-family: var(--F-HEAD); font-size: 80px; font-weight: 900;
      line-height: 0.97; letter-spacing: -2px; text-transform: uppercase;
      color: #fff; margin-bottom: 40px;
    }
    .grad-body {
      font-family: var(--F-BODY); font-size: 38px; font-weight: 400;
      line-height: 1.55; color: rgba(255,255,255,0.65);
    }
    .grad-body p { margin-bottom: 28px; }
    .grad-body strong { color: #fff; font-weight: 700; }
    .grad-bg-num {
      position: absolute; right: -15px; bottom: 40px;
      font-family: var(--F-HEAD); font-size: 420px; font-weight: 900;
      color: rgba(255,255,255,0.06); line-height: 1; pointer-events: none;
    }

    /* CTA */
    .cta-bridge {
      font-family: var(--F-BODY); font-size: 38px; font-weight: 500;
      line-height: 1.5; color: rgba(15,13,12,0.55); margin-bottom: 48px;
    }
    .cta-bridge strong { color: var(--DB); font-weight: 800; }
    .cta-kbox {
      background: #fff; border: 3px solid rgba(15,13,12,0.10);
      border-radius: 20px; padding: 40px 48px; margin-bottom: 32px;
    }
    .cta-kinstr {
      font-family: var(--F-BODY); font-size: 20px; font-weight: 500;
      color: rgba(15,13,12,0.42); margin-bottom: 12px;
    }
    .cta-kword {
      font-family: var(--F-HEAD); font-size: 80px; font-weight: 900;
      color: var(--P); letter-spacing: -2px; line-height: 1; margin-bottom: 14px;
    }
    .cta-kbenefit {
      font-family: var(--F-BODY); font-size: 22px; font-weight: 500;
      line-height: 1.5; color: rgba(15,13,12,0.50);
    }
    .cta-footer { display: flex; align-items: center; gap: 16px; }
    .cta-footer-dot {
      width: 40px; height: 40px; border-radius: 50%; background: var(--G);
      display: flex; align-items: center; justify-content: center;
      font-family: var(--F-BODY); font-size: 16px; font-weight: 900; color: #fff;
    }
    .cta-footer-text { font-family: var(--F-BODY); font-size: 18px; color: rgba(15,13,12,0.35); }

    /* IMAGE overlay */
    .slide-img-bg { position: absolute; inset: 0; background-size: cover; background-position: center; z-index: 0; }
    .slide-img-overlay {
      position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(to bottom, rgba(4,4,22,0.80) 0%, rgba(4,4,22,0.70) 30%, rgba(4,4,22,0.75) 60%, rgba(4,4,22,0.90) 100%);
    }
    .with-img .content { z-index: 2; }

    /* img-box */
    .img-box { width: 100%; height: 360px; border-radius: 20px; overflow: hidden; margin-bottom: 36px; }
    .img-box img { width: 100%; height: 100%; object-fit: cover; }

    /* Arrow rows */
    .arrow-row { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 28px; }
    .arrow-icon { font-size: 32px; color: rgba(255,255,255,0.3); flex-shrink: 0; margin-top: 4px; }
    .on-light .arrow-icon { color: rgba(15,13,12,0.25); }

    /* ============ EDITORIAL SERIF (Modelo 2) ============ */
    .es-slide { width: 1080px; height: 1350px; position: relative; overflow: hidden; flex-shrink: 0; font-family: 'Inter', 'Plus Jakarta Sans', sans-serif; }
    .es-slide.es-light { background: #fff; }
    .es-slide.es-cover { background: #dfe6ea; }

    .es-cover-bg { position: absolute; inset: 0; overflow: hidden; }

    .es-avatar-row { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .es-cover .es-avatar-row { justify-content: center; }
    .es-avatar-dot { width: 44px; height: 44px; border-radius: 50%; background: var(--P); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; font-family: 'Inter', sans-serif; flex-shrink: 0; box-shadow: 0 0 0 2px #fff; overflow: hidden; }
    .es-avatar-dot img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
    .es-handle { font-family: 'Inter', sans-serif; font-size: 30px; font-weight: 600; color: #111; display: flex; align-items: center; gap: 8px; }
    .es-verified { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .es-verified svg { width: 100%; height: 100%; }

    .es-content { position: absolute; top: 78px; left: 64px; right: 64px; bottom: 66px; display: flex; flex-direction: column; gap: 24px; overflow: hidden; z-index: 5; }
    .es-cover .es-content { top: 56px; align-items: center; text-align: center; }
    .es-cover .es-headline, .es-cover .es-subtitle { align-self: stretch; }
    .es-content > * { min-width: 0; max-width: 100%; }

    .es-headline { font-family: 'Playfair Display', serif; font-weight: 700; text-transform: uppercase; line-height: 1.06; letter-spacing: -0.5px; color: #161311; margin: 0; overflow-wrap: break-word; word-break: break-word; flex-shrink: 0; }
    .es-cover .es-headline { font-size: 78px; }
    .es-light .es-headline { font-size: 56px; }
    .es-headline em { color: var(--P); font-style: normal; }

    .es-subtitle { font-family: 'Inter', sans-serif; font-size: 28px; font-weight: 400; line-height: 1.45; color: #2a2a2a; overflow-wrap: break-word; word-break: break-word; flex-shrink: 0; }
    .es-cover .es-subtitle { text-align: center; }
    .es-subtitle p { margin-bottom: 16px; }
    .es-subtitle p:last-child { margin-bottom: 0; }
    .es-subtitle strong { font-weight: 700; color: #111; }
    .es-subtitle em.highlight { color: var(--P); font-style: normal; font-weight: 700; }

    .es-body { font-family: 'Inter', sans-serif; font-size: 30px; font-weight: 400; line-height: 1.55; color: #2a2a2a; text-align: justify; overflow-wrap: break-word; word-break: break-word; flex-shrink: 0; }
    .es-body p { margin-bottom: 24px; }
    .es-body p:last-child { margin-bottom: 0; }
    .es-body strong { font-weight: 700; color: #111; }
    .es-body em.highlight { color: var(--P); font-style: normal; font-weight: 700; }

    .es-img-single { width: 100%; border-radius: 22px; overflow: hidden; flex-shrink: 0; position: relative; }
    .es-img-double { display: flex; gap: 16px; width: 100%; flex-shrink: 0; }
    .es-img-double .es-img-cell { flex: 1; border-radius: 20px; overflow: hidden; position: relative; }
    .es-img-triple { display: flex; gap: 14px; width: 100%; flex-shrink: 0; }
    .es-img-triple .es-img-big { flex: 0 0 62%; border-radius: 20px; overflow: hidden; position: relative; }
    .es-img-triple .es-img-stack { flex: 1; display: flex; flex-direction: column; gap: 14px; }
    .es-img-triple .es-img-stack .es-img-cell { flex: 1; border-radius: 20px; overflow: hidden; position: relative; }
    .es-img-placeholder { width: 100%; height: 100%; background: #f3f3f1; border: 2px dashed #c9c9c4; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
    .es-img-placeholder svg { width: 15%; height: 15%; opacity: 0.35; }

    .es-dots { position: absolute; bottom: 26px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 10px; z-index: 10; }
    .es-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(0,0,0,0.18); }
    .es-cover .es-dot { background: rgba(255,255,255,0.55); }
    .es-dot.on { background: var(--P); width: 11px; height: 11px; }

    /* ============ BOLD SANS (Modelo 4) — citações, avatar em pílula com anel colorido ============ */
    .bs-slide { width: 1080px; height: 1350px; position: relative; overflow: hidden; flex-shrink: 0; font-family: 'Poppins', sans-serif; }
    .bs-slide.bs-light { background: #fff; }
    .bs-cover-bg { position: absolute; inset: 0; overflow: hidden; background: #fff; }

    .bs-badge { display: inline-flex; align-items: center; align-self: flex-start; gap: 10px; background: #f2f2f2; border-radius: 999px; padding: 8px 22px 8px 8px; flex-shrink: 0; }
    .bs-cover .bs-badge { align-self: center; background: linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.3)); backdrop-filter: blur(6px); }
    .bs-ring { border-radius: 50%; padding: 3px; background: conic-gradient(from 180deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888, #f09433); flex-shrink: 0; }
    .bs-ring-gap { background: #fff; border-radius: 50%; padding: 2px; display: block; }
    .bs-avatar { border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--P); color: #fff; font-weight: 800; font-family: 'Poppins', sans-serif; }
    .bs-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; }
    .bs-handle { font-family: 'Poppins', sans-serif; font-weight: 600; color: #111; display: flex; align-items: center; gap: 6px; }
    .bs-cover .bs-handle { color: #fff; }
    .bs-verified { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bs-verified svg { width: 100%; height: 100%; }

    .bs-content { position: absolute; top: 0; left: 64px; right: 64px; bottom: 0; display: flex; flex-direction: column; gap: 32px; }
    .bs-cover .bs-content { justify-content: flex-end; padding-bottom: 90px; }

    .bs-headline { font-family: 'Poppins', sans-serif; font-weight: 500; line-height: 1.25; color: #fff; font-size: 55px; }
    .bs-headline strong { font-weight: 800; }

    .bs-body { font-family: 'Poppins', sans-serif; font-weight: 400; line-height: 1.25; color: #333; font-size: 50px; }
    .bs-body p { margin-bottom: 64px; }
    .bs-body p:last-child { margin-bottom: 0; }
    .bs-body strong { font-weight: 800; color: #111; }
    .bs-body em.highlight { color: var(--P); font-style: normal; font-weight: 800; }

    .bs-subtitle { text-align: center; font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 20px; color: rgba(255,255,255,0.75); }

    .bs-dots { position: absolute; bottom: 26px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 10px; z-index: 10; }
    .bs-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(0,0,0,0.15); }
    .bs-cover .bs-dot { background: rgba(255,255,255,0.5); }
    .bs-dot.on { background: var(--P); width: 11px; height: 11px; }
  `
}

function formatBody(text: string, highlights: SlideHighlightLite[] = []): string {
  if (!text) return ''
  // Split by double newline into paragraphs, apply markdown-ish formatting
  const paragraphs = text.split('\n\n').filter(Boolean)
  return paragraphs.map(p => {
    const formatted = applyHighlights(p, highlights)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<em class="highlight">$1</em>')
      .replace(/\n/g, '<br>')
    return `<p>${formatted}</p>`
  }).join('')
}

type SlideHighlightLite = { word: string; color: string; fontFamily?: string; underline?: boolean; italic?: boolean; weight?: number; background?: string }

function applyHighlights(title: string, highlights: SlideHighlightLite[]): string {
  let result = title
  for (const h of highlights) {
    if (!h.word) continue
    const escaped = h.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi')
    const styleParts = [`color:${h.color}`]
    if (h.fontFamily) styleParts.push(`font-family:'${h.fontFamily}', sans-serif`)
    if (h.underline) styleParts.push('text-decoration:underline')
    if (h.italic) styleParts.push('font-style:italic')
    if (h.weight) styleParts.push(`font-weight:${h.weight}`)
    if (h.background) styleParts.push(`background:${h.background}`, 'padding:0.05em 0.25em', 'border-radius:0.15em', 'box-decoration-break:clone', '-webkit-box-decoration-break:clone')
    result = result.replace(regex, `<span style="${styleParts.join(';')}">$1</span>`)
  }
  return result
}

// "cover" por si só só garante folga em UM eixo (o outro fecha exato) — por isso mover
// a posição às vezes não parecia fazer nada. Aplicamos uma sobra mínima de 12% sempre,
// garantindo espaço pra arrastar nos dois eixos, e o zoom soma em cima disso.
// IMPORTANTE: zoom/posição usam <img> com width/height MAIORES que o box (não transform:scale).
// transform:scale amplia a imagem DEPOIS que o recorte já foi decidido — não cria folga
// nenhuma pra posição arrastar. Aumentando a largura/altura reais é que muda o recorte.
// "cover" nunca deforma (preserva a proporção real da foto, sempre) — zoom é uma ampliação
// por cima disso via transform, não mexendo no recorte em si.
// Quando dá pra calcular o tamanho real em px (sabendo a largura/altura de verdade da
// foto), usa isso — garante zoom que amplia de fato e posição com folga real pra arrastar,
// sem nunca esticar. Sem essa informação, cai pra "cover" puro (sem distorcer, mas o
// quanto dá pra arrastar depende da proporção da foto).
function coverBgStyle(image: string | undefined, pos: { x: number; y: number } | undefined, mirror: boolean | undefined, sizePx?: { w: number; h: number }): string {
  if (!image) return 'background:#fff;'
  const mirrorT = mirror ? ' transform:scaleX(-1);transform-origin:center;' : ''
  const size = sizePx ? `${sizePx.w}px ${sizePx.h}px` : 'cover'
  return `background-image:url('${image}'); background-size:${size}; background-position:${pos?.x ?? 50}% ${pos?.y ?? 50}%; background-repeat:no-repeat;${mirrorT}`
}

function imageGradientOverlay(slide: Slide): string {
  if (!slide.gradientOn) return ''
  const color = slide.gradientColor || '#000000'
  const dir = slide.gradientDir || 'bottom'
  const extent = slide.gradientExtent ?? 50
  const dirMap: Record<string, string> = { bottom: 'to top', top: 'to bottom', left: 'to right', right: 'to left' }
  const gradient = `linear-gradient(${dirMap[dir]}, ${color}ff 0%, ${color}00 ${extent}%)`
  return `<div style="position:absolute;inset:0;background:${gradient};pointer-events:none;"></div>`
}

function titleStyle(slide: Slide): string {
  const parts: string[] = []
  if (slide.titleSize) parts.push(`font-size:${slide.titleSize}px`)
  if (slide.fontFamilyHead) parts.push(`font-family:'${slide.fontFamilyHead}', sans-serif`)
  if (slide.titleColor) parts.push(`color:${slide.titleColor}`)
  if (slide.titleWeight) parts.push(`font-weight:${slide.titleWeight}`)
  if (slide.titleLineHeight) parts.push(`line-height:${slide.titleLineHeight}`)
  if (slide.textAlign) parts.push(`text-align:${slide.textAlign}`)
  return parts.length ? ` style="${parts.join(';')}"` : ''
}
function bodyStyle(slide: Slide): string {
  const parts: string[] = []
  if (slide.bodySize) parts.push(`font-size:${slide.bodySize}px`)
  if (slide.fontFamilyBody) parts.push(`font-family:'${slide.fontFamilyBody}', sans-serif`)
  if (slide.bodyColor) parts.push(`color:${slide.bodyColor}`)
  if (slide.bodyWeight) parts.push(`font-weight:${slide.bodyWeight}`)
  if (slide.bodyLineHeight) parts.push(`line-height:${slide.bodyLineHeight}`)
  if (slide.textAlign) parts.push(`text-align:${slide.textAlign}`)
  return parts.length ? ` style="${parts.join(';')}"` : ''
}
// Subheadline (texto de apoio da capa) — usa tamanho próprio (subtitleSize), mas
// reaproveita fonte/cor/espessura do "Corpo" já que nenhuma capa tem os dois ao mesmo tempo.
function subtitleStyle(slide: Slide): string {
  const parts: string[] = []
  if (slide.subtitleSize) parts.push(`font-size:${slide.subtitleSize}px`)
  if (slide.fontFamilyBody) parts.push(`font-family:'${slide.fontFamilyBody}', sans-serif`)
  if (slide.bodyColor) parts.push(`color:${slide.bodyColor}`)
  if (slide.bodyWeight) parts.push(`font-weight:${slide.bodyWeight}`)
  if (slide.bodyLineHeight) parts.push(`line-height:${slide.bodyLineHeight}`)
  if (slide.textAlign) parts.push(`text-align:${slide.textAlign}`)
  return parts.length ? ` style="${parts.join(';')}"` : ''
}

// Mesma lógica do coverBgStyle: sem sobra mínima, "cover" às vezes fecha exato num eixo
// e mover a posição não faz nada visível. 35% de sobra garante que sempre dá pra notar.
function esImgBgStyle(image: string, pos?: { x: number; y: number }, mirror?: boolean, sizePx?: { w: number; h: number }): string {
  const mirrorT = mirror ? ' transform:scaleX(-1);transform-origin:center;' : ''
  const size = sizePx ? `${sizePx.w}px ${sizePx.h}px` : 'cover'
  return `width:100%;height:100%;background-image:url('${image}');background-size:${size};background-position:${pos?.x ?? 50}% ${pos?.y ?? 50}%;background-repeat:no-repeat;${mirrorT}`
}

function esImageBlock(
  layout: string | undefined, images: string[] | undefined, height?: number,
  positions?: { x: number; y: number }[], mirrors?: boolean[], gradientHTML?: string, sizesPx?: ({ w: number; h: number } | undefined)[]
): string {
  if (!layout || layout === 'none') return ''
  const grad = gradientHTML || ''
  const img = (i: number) => images?.[i]
    ? `<div style="${esImgBgStyle(images[i], positions?.[i], mirrors?.[i], sizesPx?.[i])}"></div>${grad}`
    : `<div class="es-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="#8a8a84" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
  if (layout === 'top' || layout === 'bottom') {
    return `<div class="es-img-single" style="height:${height || 480}px">${img(0)}</div>`
  }
  if (layout === 'double-bottom') {
    return `<div class="es-img-double" style="height:${height || 340}px"><div class="es-img-cell">${img(0)}</div><div class="es-img-cell">${img(1)}</div></div>`
  }
  if (layout === 'triple-top') {
    return `<div class="es-img-triple" style="height:${height || 400}px"><div class="es-img-big">${img(0)}</div><div class="es-img-stack"><div class="es-img-cell">${img(1)}</div><div class="es-img-cell">${img(2)}</div></div></div>`
  }
  return ''
}

function avatarInner(initial: string, avatarImage?: string): string {
  return avatarImage ? `<img src="${avatarImage}" alt=""/>` : initial
}

const BRAND_POS_CSS: Record<string, string> = {
  tl: 'top:28px;left:32px;', tr: 'top:28px;right:32px;',
  bl: 'bottom:28px;left:32px;', br: 'bottom:28px;right:32px;',
}
// "Logo da marca" na verdade é uma linha de texto pequena (tipo "Powered by X" nos
// rodapés de referência), não uma imagem — mantém o nome pro usuário, mas é texto.
function brandTextOverlay(text?: string, position?: string, onCover?: boolean): string {
  if (!text) return ''
  const pos = BRAND_POS_CSS[position || 'tr'] || BRAND_POS_CSS.tr
  const color = onCover ? 'rgba(255,255,255,0.65)' : 'rgba(15,13,12,0.35)'
  return `<div style="position:absolute;${pos}font:700 13px/1 'Inter', sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:${color};z-index:6;">${text}</div>`
}

function renderSlideEditorialSerif(
  slide: Slide, total: number, instagram: string, initial: string, avatarImage?: string,
  brandText?: string, brandPosition?: string, avatarSizeDefault?: number, handleSizeDefault?: number, handleColorDefault?: string,
  verifiedDefault?: boolean
): string {
  const titleWithHighlights = applyHighlights(slide.title || '', slide.highlights || [])
  const bodyHTML = formatBody(slide.body || '', slide.highlights || [])
  const subtitleHTML = formatBody(slide.subtitle || '', slide.highlights || [])
  const handle = instagram ? `@${instagram}` : 'sua marca'
  const avatarSize = slide.avatarSize || avatarSizeDefault || 70
  const handleSize = slide.handleSize || handleSizeDefault || 30
  const handleColor = slide.handleColor || handleColorDefault || '#111'
  const verifiedSize = Math.round(avatarSize * 0.5)
  const showVerified = verifiedDefault !== false
  // Selo de 8 pontas igual ao do Instagram (não é só um círculo com check).
  const verifiedBadge = showVerified ? `
        <span class="es-verified" style="width:${verifiedSize}px;height:${verifiedSize}px;">
          <svg viewBox="0 0 24 24" fill="none">
            <path fill="#3897f0" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
            <path d="m9 12 2 2 4-4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>` : ''
  const avatarRow = `
    <div class="es-avatar-row">
      <div class="es-avatar-dot" style="width:${avatarSize}px;height:${avatarSize}px;font-size:${Math.round(avatarSize * 0.41)}px;">${avatarInner(initial, avatarImage)}</div>
      <div class="es-handle" style="font-size:${handleSize}px;color:${handleColor};">${handle}${verifiedBadge}
      </div>
    </div>`
  const dots = `
    <div class="es-dots">
      ${Array.from({ length: total }).map((_, i) => `<span class="es-dot${i === slide.index - 1 ? ' on' : ''}"></span>`).join('')}
    </div>`

  const gap = slide.blockGap || 24
  const mh = slide.marginH || 176

  if (slide.background === 'cover') {
    const imgStyle = coverBgStyle(slide.image, slide.imagePosition, slide.imageMirror, slide.imageBgSizePx)
    const top = 56 + (slide.marginV || 0)
    return `
    <div class="es-slide es-cover">
      <div class="es-cover-bg" style="${imgStyle}"></div>
      ${imageGradientOverlay(slide)}
      <div class="es-content" style="gap:${gap}px; left:${mh}px; right:${mh}px; top:${top}px; justify-content:${slide.textAnchor === 'bottom' ? 'flex-end' : slide.textAnchor === 'center' ? 'center' : 'flex-start'};">
        ${avatarRow}
        ${slide.title ? `<div class="es-headline" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>` : ''}
        ${slide.subtitle ? `<div class="es-subtitle" data-field="subtitle"${subtitleStyle(slide)}>${subtitleHTML}</div>` : ''}
      </div>
      ${brandTextOverlay(brandText, brandPosition, true)}
      ${dots}
    </div>`
  }

  // light editorial-serif
  const imgBlock = esImageBlock(slide.imageLayout, slide.images, slide.imageHeight, slide.imagePositions, slide.imageMirrors, imageGradientOverlay(slide), slide.imageBgSizesPx)
  const isTopImg = slide.imageLayout === 'top' || slide.imageLayout === 'triple-top'
  const isBottomImg = slide.imageLayout === 'bottom' || slide.imageLayout === 'double-bottom'
  const top = 151 + (slide.marginV || 0)
  const bgStyle = slide.bgColor ? ` style="background:${slide.bgColor}"` : ''
  return `
  <div class="es-slide es-light"${bgStyle}>
    <div class="es-content" style="gap:${gap}px; left:${mh}px; right:${mh}px; top:${top}px; justify-content:${slide.textAnchor === 'bottom' ? 'flex-end' : slide.textAnchor === 'center' ? 'center' : 'flex-start'};">
      ${isTopImg ? imgBlock : ''}
      ${avatarRow}
      ${slide.title ? `<div class="es-headline" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>` : ''}
      ${slide.body ? `<div class="es-body" data-field="body"${bodyStyle(slide)}>${bodyHTML}</div>` : ''}
      ${isBottomImg ? imgBlock : ''}
    </div>
    ${brandTextOverlay(brandText, brandPosition, false)}
    ${dots}
  </div>`
}

// Estilo "citações" — capa com foto e frase em negrito parcial, slides internos só com
// texto (sem imagem), avatar em pílula com anel colorido tipo Instagram, sem rodapé fixo.
function renderSlideBoldSans(
  slide: Slide, total: number, instagram: string, initial: string, avatarImage?: string,
  brandText?: string, brandPosition?: string, avatarSizeDefault?: number, handleSizeDefault?: number, handleColorDefault?: string,
  verifiedDefault?: boolean
): string {
  const titleWithHighlights = applyHighlights(slide.title || '', slide.highlights || [])
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  const bodyHTML = formatBody(slide.body || '', slide.highlights || [])
  const handle = instagram ? `@${instagram}` : 'sua marca'
  const avatarSize = slide.avatarSize || avatarSizeDefault || 52
  const handleSize = slide.handleSize || handleSizeDefault || 30
  const handleColor = slide.handleColor || handleColorDefault || ''
  const verifiedSize = Math.round(avatarSize * 0.42)
  const showVerified = verifiedDefault !== false
  const verifiedBadge = showVerified ? `
        <span class="bs-verified" style="width:${verifiedSize}px;height:${verifiedSize}px;">
          <svg viewBox="0 0 24 24" fill="none">
            <path fill="#3897f0" d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
            <path d="m9 12 2 2 4-4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>` : ''
  const badge = `
    <div class="bs-badge">
      <div class="bs-ring" style="width:${avatarSize}px;height:${avatarSize}px;">
        <div class="bs-ring-gap" style="width:100%;height:100%;">
          <div class="bs-avatar" style="width:100%;height:100%;font-size:${Math.round(avatarSize * 0.4)}px;">${avatarInner(initial, avatarImage)}</div>
        </div>
      </div>
      <div class="bs-handle" style="font-size:${handleSize}px;${handleColor ? `color:${handleColor};` : ''}">${handle}${verifiedBadge}</div>
    </div>`
  const dots = `
    <div class="bs-dots">
      ${Array.from({ length: total }).map((_, i) => `<span class="bs-dot${i === slide.index - 1 ? ' on' : ''}"></span>`).join('')}
    </div>`
  const gap = slide.blockGap || 72
  const mh = slide.marginH || 64
  const subtitleWithHighlights = applyHighlights(slide.subtitle || '', slide.highlights || [])
  const subtitle = slide.subtitle
    ? `<div class="bs-subtitle" data-field="subtitle"${subtitleStyle(slide)}>${subtitleWithHighlights}</div>`
    : ''

  const justify = slide.textAnchor === 'bottom' ? 'flex-end' : slide.textAnchor === 'top' ? 'flex-start' : 'center'

  if (slide.background === 'cover') {
    const imgStyle = coverBgStyle(slide.image, slide.imagePosition, slide.imageMirror, slide.imageBgSizePx)
    const coverGap = slide.blockGap || 48
    return `
    <div class="bs-slide bs-cover">
      <div class="bs-cover-bg" style="${imgStyle}"></div>
      ${imageGradientOverlay(slide)}
      <div class="bs-content" style="gap:${coverGap}px; left:${mh}px; right:${mh}px; justify-content:${justify}; align-items:center; text-align:center;">
        ${badge}
        ${slide.title ? `<div class="bs-headline" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>` : ''}
        ${subtitle}
      </div>
      ${brandTextOverlay(brandText, brandPosition, true)}
      ${dots}
    </div>`
  }

  const bgStyle = slide.bgColor ? ` style="background:${slide.bgColor}"` : ''
  const imageBlock = slide.imageLayout && slide.imageLayout !== 'none' && slide.image
    ? esImageBlock(slide.imageLayout, [slide.image], slide.imageHeight, [slide.imagePosition], [slide.imageMirror], '', [slide.imageBgSizePx])
    : ''
  return `
  <div class="bs-slide bs-light"${bgStyle}>
    <div class="bs-content" style="gap:${gap}px; left:${mh}px; right:${mh}px; justify-content:${justify};">
      ${imageBlock}
      ${badge}
      ${slide.body ? `<div class="bs-body" data-field="body"${bodyStyle(slide)}>${bodyHTML}</div>` : ''}
    </div>
    ${brandTextOverlay(brandText, brandPosition, false)}
    ${dots}
  </div>`
}

function renderSlide(slide: Slide, total: number, instagram: string, initial: string, style: VisualStyle, avatarImage?: string, brandText?: string, brandPosition?: string, avatarSizeDefault?: number, handleSizeDefault?: number, handleColorDefault?: string, verifiedDefault?: boolean): string {
  if (slide.style === 'editorial-serif') {
    return renderSlideEditorialSerif(slide, total, instagram, initial, avatarImage, brandText, brandPosition, avatarSizeDefault, handleSizeDefault, handleColorDefault, verifiedDefault)
  }
  if (slide.style === 'bold-sans') {
    return renderSlideBoldSans(slide, total, instagram, initial, avatarImage, brandText, brandPosition, avatarSizeDefault, handleSizeDefault, handleColorDefault, verifiedDefault)
  }
  const progress = Math.round((slide.index / total) * 100)
  const bg = slide.background
  const onClass = bg === 'cover' ? 'on-dark' : bg === 'gradient' ? 'on-grad' : `on-${bg}`

  const accentBar = `<div class="accent-bar"></div>`
  const brandBar = `
    <div class="brand-bar ${onClass}">
      <span>Powered by Claude Viral</span>
      <span>${instagram ? `@${instagram}` : ''}</span>
      <span>2026 ®</span>
    </div>`
  const progressBar = `
    <div class="prog">
      <div class="prog-track"><div class="prog-fill" style="width:${progress}%"></div></div>
      <span class="prog-num">${slide.index}/${total}</span>
    </div>`

  const titleWithHighlights = applyHighlights(slide.title || '', slide.highlights || [])

  if (bg === 'cover') {
    const imgStyle = coverBgStyle(slide.image, slide.imagePosition, slide.imageMirror, slide.imageBgSizePx)
    return `
    <div class="slide slide-cover">
      <div class="capa-bg" style="${imgStyle}"></div>
      <div class="capa-grad"></div>
      ${imageGradientOverlay(slide)}
      ${accentBar}
      ${brandBar}
      <div class="capa-headline-area">
        <div class="capa-badge">
          <div class="badge-dot">${avatarInner(initial, avatarImage)}</div>
          <span class="badge-handle">${instagram ? `@${instagram}` : 'sua marca'}</span>
        </div>
        <div class="capa-headline" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>
        ${slide.subtitle ? `<div class="capa-subtitle">${slide.subtitle.replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/__(.+?)__/g, '<em>$1</em>')}</div>` : ''}
      </div>
      ${progressBar}
    </div>`
  }

  if (bg === 'gradient') {
    return `
    <div class="slide slide-grad ${onClass}">
      ${accentBar}
      ${brandBar}
      <div class="grad-bg-num">${slide.index}</div>
      <div class="content">
        ${slide.tag ? `<div class="tag">${slide.tag}</div>` : ''}
        ${slide.title ? `<div class="grad-h1" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>` : ''}
        ${slide.body ? `<div class="grad-body" data-field="body"${bodyStyle(slide)}>${formatBody(slide.body, slide.highlights || [])}</div>` : ''}
      </div>
      ${progressBar}
    </div>`
  }

  // CTA slide (last slide, light)
  if (slide.index === total) {
    const [bridge, ctaWord] = (slide.body || '').split('||').map(s => s.trim())
    return `
    <div class="slide slide-light ${onClass}">
      ${accentBar}
      ${brandBar}
      <div class="content">
        ${bridge ? `<div class="cta-bridge">${bridge.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>` : ''}
        ${slide.title ? `<div class="grad-h1" data-field="title" style="color:var(--DB)">${titleWithHighlights}</div>` : ''}
        ${ctaWord ? `
        <div class="cta-kbox">
          <div class="cta-kinstr">Comenta a palavra abaixo:</div>
          <div class="cta-kword">${ctaWord}</div>
          <div class="cta-kbenefit">e recebe o conteúdo direto na DM</div>
        </div>` : ''}
        <div class="cta-footer">
          <div class="cta-footer-dot">${initial}</div>
          <span class="cta-footer-text">${instagram ? `@${instagram}` : ''} · Claude Viral</span>
        </div>
      </div>
      ${progressBar}
    </div>`
  }

  // Dark slide
  if (bg === 'dark') {
    const hasImg = !!slide.image
    return `
    <div class="slide slide-dark ${onClass}${hasImg ? ' with-img' : ''}">
      ${hasImg ? `<div class="slide-img-bg" style="background-image:url('${slide.image}')"></div><div class="slide-img-overlay"></div>` : ''}
      ${accentBar}
      ${brandBar}
      <div class="dark-bg-num">${slide.index}</div>
      <div class="content">
        ${slide.tag ? `<div class="tag">${slide.tag}</div>` : ''}
        ${slide.title ? `<div class="dark-h1" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>` : ''}
        ${slide.body ? `<div class="dark-body" data-field="body"${bodyStyle(slide)}>${formatBody(slide.body, slide.highlights || [])}</div>` : ''}
      </div>
      ${progressBar}
    </div>`
  }

  // Light slide
  const hasImgBox = !!slide.image && !slide.title
  return `
  <div class="slide slide-light ${onClass}">
    ${accentBar}
    ${brandBar}
    <div class="content">
      ${hasImgBox ? `<div class="img-box"><img src="${slide.image}" alt=""/></div>` : ''}
      ${slide.tag ? `<div class="tag">${slide.tag}</div>` : ''}
      ${slide.title ? `<div class="light-h1" data-field="title"${titleStyle(slide)}>${titleWithHighlights}</div>` : ''}
      ${slide.body ? `<div class="light-body" data-field="body"${bodyStyle(slide)}>${formatBody(slide.body, slide.highlights || [])}</div>` : ''}
    </div>
    ${progressBar}
  </div>`
}

// Fragmento puro do slide (sem <html>/<head>/fontes) — usado tanto no documento inicial
// quanto pra mandar atualização via postMessage sem recarregar o iframe (evita o "piscar").
export function generateSlideInner(carousel: Carousel, slide: Slide): string {
  const { slides } = carousel.content
  const instagram = carousel.briefing.niche || ''
  const initial = (carousel.content.slides[0]?.title?.charAt(0) || 'C').toUpperCase()
  return renderSlide(slide, slides.length, instagram, initial, carousel.visualStyle, carousel.briefing.avatarImage, carousel.briefing.brandText, carousel.briefing.brandPosition, carousel.briefing.avatarSize, carousel.briefing.handleSize, carousel.briefing.handleColor, carousel.briefing.verifiedBadge)
}

export function generateSlideHTML(carousel: Carousel, slide: Slide): string {
  const palette = derivePalette(carousel.briefing.primaryColor || '#E8421A')
  const css = renderSlideCSS(palette, carousel.visualStyle)
  const slideHTML = generateSlideInner(carousel, slide)
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Slide ${slide.index}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@100..900&family=Plus+Jakarta+Sans:wght@200..800&family=Space+Grotesk:wght@300..700&family=Poppins:wght@200;300;400;500;600;700;800;900&family=Playfair+Display:wght@400..900&family=Archivo+Black&family=Inter:wght@200..800&family=Source+Serif+4:opsz,wght@8..60,200..900&display=swap" rel="stylesheet">
<style>
${css}
body { background: #111; padding: 0; margin: 0; display: block; }
</style>
<script>
window.addEventListener('message', function(e) {
  if (!e || !e.data) return;
  if (e.data.type === 'slide-update') {
    document.body.innerHTML = e.data.html;
  } else if (e.data.type === 'vars-update' && e.data.vars) {
    for (var k in e.data.vars) document.documentElement.style.setProperty(k, e.data.vars[k]);
  }
});
// Seleciona um trecho do texto direto no preview (arrastando o mouse em cima do que já
// está renderizado) — avisa o painel de fora pra mostrar a barrinha de destaque.
document.addEventListener('mouseup', function() {
  var sel = window.getSelection();
  var text = sel ? sel.toString().trim() : '';
  if (!text) { window.parent.postMessage({ type: 'text-selection-cleared' }, '*'); return; }
  var node = sel.anchorNode;
  var el = node && node.nodeType === 3 ? node.parentElement : node;
  while (el && el.getAttribute && !el.getAttribute('data-field')) el = el.parentElement;
  var field = el && el.getAttribute ? el.getAttribute('data-field') : null;
  if (field) window.parent.postMessage({ type: 'text-selected', field: field, text: text }, '*');
});
</script>
</head>
<body>${slideHTML}</body>
</html>`
}

export function generateHTML(carousel: Carousel): string {
  const palette = derivePalette(carousel.briefing.primaryColor || '#E8421A')
  const { slides } = carousel.content
  const profile = carousel.briefing
  const instagram = profile.niche ? `${profile.niche}` : ''
  const handle = carousel.content.spine?.headline ? carousel.content.slides[0]?.title?.charAt(0) || 'C' : 'C'
  const initial = handle.toUpperCase()

  const css = renderSlideCSS(palette, carousel.visualStyle)
  const slidesHTML = slides.map(s =>
    renderSlide(s, slides.length, instagram, initial, carousel.visualStyle, profile.avatarImage, profile.brandText, profile.brandPosition, profile.avatarSize, profile.handleSize, profile.handleColor, profile.verifiedBadge)
  ).join('\n')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${carousel.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@100..900&family=Plus+Jakarta+Sans:wght@200..800&family=Space+Grotesk:wght@300..700&family=Poppins:wght@200;300;400;500;600;700;800;900&family=Playfair+Display:wght@400..900&family=Archivo+Black&family=Inter:wght@200..800&family=Source+Serif+4:opsz,wght@8..60,200..900&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
${slidesHTML}
</body>
</html>`
}
