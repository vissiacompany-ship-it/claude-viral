import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'
import { getProfiles, getReferenceItems } from '@/lib/storage'
import { buildProfileContext, buildReferenceContext, WRITING_RULES, getCopyDoctrine, HOOK_ENGINE } from '@/lib/narrative-prompts'

// Modo leve de "Gerador de Ganchos" — dobrado dentro de Ideias & Narrativas (não é uma
// ferramenta separada). Cada opção sai com o tipo de padrão + o porquê funciona, pra pessoa
// aprender o mecanismo, não só copiar um texto pronto.
export async function POST(req: NextRequest) {
  const { profileId, topic, referenceIds, narrativeContext } = await req.json() as { profileId?: string; topic?: string; referenceIds?: string[]; narrativeContext?: string }

  const profile = profileId ? getProfiles().find(p => p.id === profileId) : undefined
  const references = referenceIds?.length ? getReferenceItems().filter(r => referenceIds.includes(r.id)) : undefined
  const profileCtx = buildProfileContext(profile)
  const refCtx = buildReferenceContext(references)

  if (!profileCtx && !topic?.trim() && !narrativeContext?.trim()) {
    return NextResponse.json({ error: 'Preencha um tema ou selecione um perfil com mais informação' }, { status: 400 })
  }

  const prompt = `Você é o especialista em ganchos do Claude Viral — sua única função é escrever a frase de abertura (slide 1, TITULO do primeiro bloco) de um carrossel de Instagram, treinado nos moldes do Sistema Viciante e na doutrina de copy do produto.

${profileCtx}
${topic ? `Tema: ${topic}` : 'Sem tema definido — use o Perfil acima.'}
${refCtx}

${WRITING_RULES}

${getCopyDoctrine()}

${HOOK_ENGINE}

${narrativeContext?.trim()
    ? `A narrativa completa abaixo já foi escrita e aprovada até aqui — só o gancho (TITULO do primeiro bloco) está sendo trocado. Gere 3 variações de gancho que continuem prendendo pro MESMO ângulo/mecanismo/promessa dessa narrativa (nunca mude o assunto):\n\n${narrativeContext.trim()}\n`
    : 'Gere 3 ganchos diferentes, cada um usando uma estrutura distinta da Engine de gancho acima (Dois-Pontos, Pergunta Geracional, Contraste/Antítese, Investigando, Nome/Marca + Revelação) — nunca a mesma estrutura duas vezes.'}

Antes das opções, faça uma análise curta do roteiro (compartilhada pelas 3 opções, não repita por gancho):
- tema: 1 frase com o ângulo central do roteiro
- pontoForte: qual é o argumento/virada mais forte do roteiro, que o gancho deveria puxar o leitor a querer ver
- seguraFinal: o que no roteiro garante que a promessa do gancho é cumprida até o CTA (prova de que não é clickbait vazio)

Pra cada gancho candidato, rode internamente (nunca mostre isso na resposta) o Checklist de Rejeição da Engine de gancho — se cair em qualquer item proibido, reescreva antes de incluir; só entregue os 3 que passaram.

Pra cada gancho aprovado: o padrão/estrutura usado (nome curto, ex: "Dois-Pontos", "Pergunta Geracional", "Contraste/Antítese", "Investigando", "Nome/Marca + Revelação"), o texto do gancho em si, uma nota "doRoteiro" (1 frase dizendo qual parte específica do roteiro esse gancho puxa/promete), e "porQueFunciona" (1 frase — qual padrão de lift e qual gatilho emocional ativa, e por que prende o dedo no scroll, nunca direção de câmera ou produção, isso é carrossel, não vídeo).

Responda em JSON, sem markdown:
{
  "analysis": { "tema": "...", "pontoForte": "...", "seguraFinal": "..." },
  "hooks": [{ "pattern": "...", "hook": "...", "doRoteiro": "...", "porQueFunciona": "..." }]
}`

  try {
    const raw = await callClaudeChat(prompt)
    const text = extractPlainText(raw)
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    const parsed = JSON.parse(text.slice(start, end + 1))
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
