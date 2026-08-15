// Parser compartilhado do "colar conteúdo em bloco" — usado tanto no painel de colagem
// dentro do editor quanto no wizard "Criar carrossel". Cola um texto único com os N blocos
// separados por uma linha "---". Cada linha pode vir marcada com TITULO: / SUBTITULO: /
// TEXTO: / LISTA: pra dizer que elemento ela é, sem precisar reescrever a copy. Se o bloco
// não tiver nenhuma tag, cai no modo antigo: primeira linha = título, resto = corpo.

export const TAG_RE = /^(TITULO|SUBTITULO|TEXTO|LISTA)\s*:\s?(.*)$/i

export function parseBloco(bloco: string): { title: string; subtitle: string; body: string } {
  const linhasRaw = bloco.split('\n')
  const temTag = linhasRaw.some(l => TAG_RE.test(l.trim()))
  if (!temTag) {
    const linhas = [...linhasRaw]
    while (linhas[0] !== undefined && /^#{1,6}\s/.test(linhas[0].trim())) linhas.shift()
    const primeiraRaw = (linhas[0] || '').trim()
    const primeira = primeiraRaw.replace(/^\*\*(.*)\*\*$/, '$1')
    const resto = linhas.slice(1).join('\n').trim()
    return { title: primeira, subtitle: '', body: resto }
  }
  let title = '', subtitle = ''
  const paragrafos: string[] = []
  let listaAtual: string[] = []
  const flushLista = () => {
    if (listaAtual.length) { paragrafos.push(listaAtual.join('\n')); listaAtual = [] }
  }
  for (const linhaRaw of linhasRaw) {
    const linha = linhaRaw.trim()
    const m = linha.match(TAG_RE)
    if (m) {
      const tipo = m[1].toUpperCase()
      const conteudo = m[2].trim()
      if (tipo !== 'LISTA') flushLista()
      if (tipo === 'TITULO') title = conteudo
      else if (tipo === 'SUBTITULO') subtitle = conteudo
      else if (tipo === 'TEXTO') { if (conteudo) paragrafos.push(conteudo) }
      else if (tipo === 'LISTA') { if (conteudo) listaAtual.push(conteudo) }
    }
  }
  flushLista()
  return { title, subtitle, body: paragrafos.join('\n\n') }
}

// Se colou com "---" separando os slides, usa isso (funciona mesmo com parágrafo em
// branco dentro do texto). Se não usou "---" nenhuma vez, cai pro modo simples: cada
// bloco separado por linha em branco vira um slide.
export function splitBlocos(text: string): string[] {
  const temSeparador = /\n\s*---\s*\n/.test(text.trim())
  return (temSeparador ? text.split(/\n\s*---\s*\n/) : text.split(/\n{2,}/))
    .map(b => b.trim())
    .filter(Boolean)
}
