import { NextRequest, NextResponse } from 'next/server'
import { getTemplate } from '@/lib/storage'
import { callClaudeChat, extractJSON } from '@/lib/claude'
import { BODY_FORMATTING_RULES } from '@/lib/narrative-prompts'

export async function POST(req: NextRequest) {
  const { templateId, content } = await req.json() as { templateId: string; content: string }
  if (!templateId || !content?.trim()) {
    return NextResponse.json({ error: 'templateId e content são obrigatórios' }, { status: 400 })
  }
  const template = getTemplate(templateId)
  if (!template) return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })

  const slidesSpec = template.slides.map((s, i) => ({
    index: i + 1,
    papel: s.label,
    tem_tag: s.hasTag,
    tem_subtitulo: s.background === 'cover',
    tem_corpo: s.hasBody,
    e_cta: !!s.isCTA,
  }))

  const prompt = `Você vai distribuir um texto de carrossel do Instagram, já pronto, dentro da estrutura fixa de um template. NÃO invente frases, dados ou afirmações novas — use SOMENTE o texto abaixo, apenas reorganizando, cortando e distribuindo entre os slides. Pode ajustar pontuação e quebras de linha pra caber melhor, mas o conteúdo tem que continuar sendo o que a pessoa escreveu.

ESTRUTURA DO TEMPLATE (${template.slides.length} slides, nessa ordem, cada um com seu papel):
${JSON.stringify(slidesSpec, null, 2)}

TEXTO COMPLETO FORNECIDO PELO USUÁRIO:
"""
${content.trim()}
"""

Retorne APENAS um JSON (array), um item por slide, na ordem, com essas chaves:
- "index": número do slide
- "tag": só preenche se "tem_tag" for true (rótulo curto, tipo categoria/kicker); senão ""
- "title": headline/título do slide (curto, direto)
- "subtitle": só preenche se "tem_subtitulo" for true (texto de apoio da capa); senão ""
- "body": só preenche se "tem_corpo" for true (corpo do slide, pode ter parágrafos separados por \\n\\n); senão ""

${BODY_FORMATTING_RULES}
Isso é FORMATAÇÃO, não invenção de conteúdo — envolver em **duplo asterisco** um trecho que já existe no texto original não conta como alterar o texto, é permitido mesmo com a regra de "não invente nada" acima. Aplique negrito também no "subtitle" quando ele existir, seguindo a mesma lógica do corpo.

Se o texto fornecido não for longo o suficiente pra preencher todos os slides com conteúdo próprio, distribua o que existe da forma mais natural possível entre os slides mais relevantes e deixe os campos vazios ("") nos slides que sobrarem — NUNCA invente conteúdo pra completar.`

  try {
    const raw = await callClaudeChat(prompt)
    const parsed = extractJSON(raw) as Array<{ index: number; tag?: string; title?: string; subtitle?: string; body?: string }>
    return NextResponse.json({ slides: parsed })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Falha ao distribuir conteúdo com IA: ${msg}` }, { status: 500 })
  }
}
