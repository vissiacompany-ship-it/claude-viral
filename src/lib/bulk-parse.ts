// Parser compartilhado do "colar conteúdo em bloco" — usado tanto no painel de colagem
// dentro do editor quanto no wizard "Criar carrossel". Cola um texto único com os N blocos
// separados por uma linha "---". Cada linha pode vir marcada com TAG: / TITULO: / SUBTITULO:
// / TEXTO: / LISTA: pra dizer que elemento ela é, sem precisar reescrever a copy. Se o bloco
// não tiver nenhuma tag, cai no modo antigo: primeira linha = título, resto = corpo.

export const TAG_RE = /^(TAG|TITULO|SUBTITULO|TEXTO|LISTA)\s*:\s?(.*)$/i

export function parseBloco(bloco: string): { tag: string; title: string; subtitle: string; body: string } {
  const linhasRaw = bloco.split('\n')
  const temTag = linhasRaw.some(l => TAG_RE.test(l.trim()))
  if (!temTag) {
    const linhas = [...linhasRaw]
    while (linhas[0] !== undefined && /^#{1,6}\s/.test(linhas[0].trim())) linhas.shift()
    const primeiraRaw = (linhas[0] || '').trim()
    const primeira = primeiraRaw.replace(/^\*\*(.*)\*\*$/, '$1')
    const resto = linhas.slice(1).join('\n').trim()
    return { tag: '', title: primeira, subtitle: '', body: resto }
  }
  let tag = '', title = '', subtitle = ''
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
      if (tipo === 'TAG') tag = conteudo
      else if (tipo === 'TITULO') title = conteudo
      else if (tipo === 'SUBTITULO') subtitle = conteudo
      else if (tipo === 'TEXTO') { if (conteudo) paragrafos.push(conteudo) }
      else if (tipo === 'LISTA') { if (conteudo) listaAtual.push(conteudo) }
    }
  }
  flushLista()
  return { tag, title, subtitle, body: paragrafos.join('\n\n') }
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

interface DefLike { hasTag: boolean; hasBody: boolean }

// Orientação de colagem específica de CADA template — usada tanto no painel "Colar todo
// o conteúdo" do editor quanto no wizard "Criar carrossel", pra nunca mais os dois saírem
// dessincronizados (um mostrando a orientação certa, o outro a genérica de outro modelo).
// O texto devolvido também serve pra colar em qualquer IA externa gerar no formato certo.
export function bulkInstructions(defs: DefLike[]): { hint: string; placeholder: string } {
  const semCorpo = defs.every(d => !d.hasBody)
  const comTag = defs.some(d => d.hasTag)

  if (semCorpo) {
    return {
      hint: 'Cola os blocos separados por uma linha só com --- . Esse modelo não tem corpo separado — é só um texto por slide (pode ter quebra de linha), sem precisar de tag nenhuma.',
      placeholder: 'Texto do slide 1, pode ter mais de uma linha se quiser.\n---\nTexto do slide 2.\n---\n...',
    }
  }
  if (comTag) {
    return {
      hint: 'Cola os blocos separados por uma linha só com --- . Marca cada linha com TAG:, TITULO:, SUBTITULO:, TEXTO: ou LISTA: — esse modelo usa uma etiqueta curta (TAG) acima do título em cada slide.',
      placeholder: 'TAG: Categoria do slide 1\nTITULO: Headline do slide 1\nTEXTO: Primeiro parágrafo\n---\nTAG: Categoria do slide 2\nTITULO: Headline do slide 2\nLISTA: Item um\nLISTA: Item dois\n---\n...',
    }
  }
  return {
    hint: 'Cola o conteúdo de todos os slides de uma vez, separando cada slide com uma linha só com --- . Marca cada linha com TITULO:, SUBTITULO:, TEXTO: ou LISTA: (sem tag nenhuma, a 1ª linha do bloco vira título e o resto vira corpo).',
    placeholder: 'TITULO: Headline do slide 1\nTEXTO: Primeiro parágrafo\n---\nTITULO: Headline do slide 2\nLISTA: Item um\nLISTA: Item dois\n---\n...',
  }
}

// Caminho inverso do parseBloco: junta o conteúdo ATUAL dos campos de volta no formato
// TAG:/TITULO:/SUBTITULO:/TEXTO:, blocos separados por "---" — usado pra mandar o carrossel
// inteiro (como está agora) de contexto pra IA reescrever do zero (ver /api/ai/adjust-narrative
// e o botão "Refazer copy do carrossel" no editor). Não precisa ser perfeito byte a byte (é
// só contexto de entrada, a IA reescreve em cima), então body é quebrado por parágrafo (\n\n)
// em várias linhas TEXTO: — cada uma vira 1 parágrafo de novo do outro lado.
export function fieldsToBulkText(items: Array<{ tag?: string; title?: string; subtitle?: string; body?: string }>): string {
  return items.map(({ tag, title, subtitle, body }) => {
    const lines: string[] = []
    if (tag?.trim()) lines.push(`TAG: ${tag.trim()}`)
    if (title?.trim()) lines.push(`TITULO: ${title.trim()}`)
    if (subtitle?.trim()) lines.push(`SUBTITULO: ${subtitle.trim()}`)
    body?.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).forEach(p => lines.push(`TEXTO: ${p}`))
    return lines.join('\n')
  }).join('\n---\n')
}

// Prompt pronto pra copiar e colar em QUALQUER outra IA (ChatGPT, Gemini etc.) — pra quem
// prefere escrever a copy fora do Claude Viral e só trazer o resultado já pronto pra colar
// no campo de conteúdo. Reaproveita a mesma orientação de formato do bulkInstructions, pra
// nunca ficar dessincronizado com o que o parser realmente espera.
export function externalAIPrompt(defs: DefLike[], slideCount: number): string {
  const { hint, placeholder } = bulkInstructions(defs)
  return `Escreva o texto completo de um carrossel de Instagram com ${slideCount} slides — tom direto, jornalístico, sem clichê de IA (nada de "não é X, é Y", "e isso muda tudo", frase genérica que serviria pra qualquer assunto). Cada slide defende só 1 ideia.

${hint}

Formato exato a seguir (mantenha a estrutura, troque só o conteúdo):
${placeholder}

Agora escreva sobre: [DESCREVA AQUI O TEMA, OU COLE SEU MATERIAL BRUTO]`
}
