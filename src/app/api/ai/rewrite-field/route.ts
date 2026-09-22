import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractJSON } from '@/lib/claude'
import { getProfiles } from '@/lib/storage'
import { ContentPillar } from '@/types'
import { buildProfileContext, buildPillarContext, WRITING_RULES, BODY_FORMATTING_RULES } from '@/lib/narrative-prompts'

const FIELD_LABEL: Record<string, string> = {
  title: 'título/headline',
  subtitle: 'subheadline/linha de apoio',
  body: 'corpo (texto principal)',
}

export async function POST(req: NextRequest) {
  const { field, tag, title, subtitle, body, isCTA, profileId, pillar, instruction } = await req.json() as {
    field: 'title' | 'subtitle' | 'body'
    tag?: string; title?: string; subtitle?: string; body?: string
    isCTA?: boolean; profileId?: string; pillar?: ContentPillar; instruction?: string
  }

  if (!FIELD_LABEL[field]) {
    return NextResponse.json({ error: 'Campo inválido' }, { status: 400 })
  }

  const profile = profileId ? getProfiles().find(p => p.id === profileId) : undefined
  const profileCtx = buildProfileContext(profile)
  const pillarCtx = buildPillarContext(pillar)

  const otherFields = [
    tag && `Tag do slide: ${tag}`,
    field !== 'title' && title && `Título atual do slide: ${title}`,
    field !== 'subtitle' && subtitle && `Subheadline atual do slide: ${subtitle}`,
    field !== 'body' && body && `Corpo atual do slide: ${body}`,
  ].filter(Boolean).join('\n')

  const currentValue = field === 'title' ? title : field === 'subtitle' ? subtitle : body

  const ctaNote = isCTA
    ? '\nEsse é o slide de CTA (fecho do carrossel) — a ação tem que ser diretiva e clara, nunca cordial, e se pedir comentário precisa nomear uma palavra-chave específica.'
    : ''
  const instructionNote = instruction?.trim()
    ? `\n\nDireção específica da pessoa pra essa reescrita (prioridade alta): "${instruction.trim()}"`
    : ''
  const bodyFormatNote = field === 'body' ? `\n\n${BODY_FORMATTING_RULES}` : ''

  const prompt = `Você reescreve UM campo específico (${FIELD_LABEL[field]}) de um slide de carrossel viral do Claude Viral — os outros campos do slide já estão prontos e não mudam, só esse.

${profileCtx}
${pillarCtx}

Contexto do slide (pra manter coerência, mas você só reescreve o campo pedido):
${otherFields || '(slide ainda sem outros campos preenchidos)'}
${currentValue ? `\nValor atual desse campo (pra você melhorar/variar, não repetir igual): "${currentValue}"` : ''}
${ctaNote}${instructionNote}

${WRITING_RULES}${bodyFormatNote}

Escreva 3 variações GENUINAMENTE diferentes entre si (ângulos ou construções de frase diferentes, não sinônimos da mesma frase) pro campo ${FIELD_LABEL[field]}, todas coerentes com o resto do slide acima.

Responda SÓ com um JSON puro, sem markdown, sem crases, exatamente neste formato:
{"options":["opção 1","opção 2","opção 3"]}`

  try {
    const raw = await callClaudeChat(prompt)
    const parsed = extractJSON(raw) as { options?: string[] }
    const options = (parsed.options || []).filter(Boolean).slice(0, 3)
    if (!options.length) throw new Error('Não veio nenhuma opção')
    return NextResponse.json({ options })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar opções' }, { status: 500 })
  }
}
