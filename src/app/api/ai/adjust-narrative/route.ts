import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'
import { getProfiles } from '@/lib/storage'
import { buildProfileContext, buildSlideStructureNote, cleanNarrativeOutput, WRITING_RULES, BODY_FORMATTING_RULES, getCopyDoctrine, SlideType } from '@/lib/narrative-prompts'

// Reescreve um roteiro já pronto a partir de uma instrução livre (ou atalho rápido) — ajuste
// geral (o roteiro inteiro) ou por seção (só um bloco específico, os outros ficam intocados).
export async function POST(req: NextRequest) {
  const { profileId, content, instruction, sectionIndex, sectionLabel, slideTypes } = await req.json() as {
    profileId?: string; content: string; instruction: string; sectionIndex?: number; sectionLabel?: string
    slideTypes?: SlideType[]
  }

  if (!content?.trim() || !instruction?.trim()) {
    return NextResponse.json({ error: 'Preciso do roteiro atual e do que você quer mudar' }, { status: 400 })
  }

  const profile = profileId ? getProfiles().find(p => p.id === profileId) : undefined
  const profileCtx = buildProfileContext(profile)
  const scoped = sectionIndex !== undefined
  const structureNote = buildSlideStructureNote(slideTypes)

  const prompt = `Você reescreve um roteiro de carrossel do Claude Viral que já está pronto, aplicando só o ajuste pedido — sem perder o resto do trabalho já feito.

${profileCtx}

${WRITING_RULES}

${BODY_FORMATTING_RULES}
${structureNote}

${getCopyDoctrine()}

Roteiro atual (formato TAG/TITULO/SUBTITULO/TEXTO, um bloco por slide separado por ---):
${content}

${scoped
    ? `Ajuste por seção: mude SÓ o bloco "${sectionLabel || `Slide ${(sectionIndex ?? 0) + 1}`}" (posição ${(sectionIndex ?? 0) + 1} contando do primeiro) conforme a instrução abaixo. Todos os outros blocos devem voltar EXATAMENTE iguais ao original, char por char.`
    : 'Ajuste geral: aplique a instrução abaixo no roteiro inteiro, mantendo a estrutura de blocos (mesma quantidade de slides, mesma função de cada um — gancho continua gancho, CTA continua CTA) a menos que a instrução peça o contrário.'}

Instrução: ${instruction}

Regra de ouro: nunca invente dado, estatística ou fato que não esteja no Perfil acima ou já presente no roteiro original.

Devolva o roteiro completo reescrito, no mesmo formato exato (TAG:/TITULO:/SUBTITULO:/TEXTO:, blocos separados por uma linha só com ---). Nada além disso, sem comentário, sem explicação.`

  try {
    const raw = await callClaudeChat(prompt)
    const newContent = cleanNarrativeOutput(extractPlainText(raw))
    return NextResponse.json({ content: newContent })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
