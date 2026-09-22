import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'

// Regra fixa de todo o projeto: a Biblioteca de Referências nunca guarda o conteúdo original
// de terceiros — só a estrutura, generalizada, com [colchetes] pra preencher. Isso protege
// quem compra o Claude Viral de reproduzir marca, persona ou dado de outra pessoa sem querer.
const SYSTEM = `Você extrai a ESTRUTURA de um conteúdo viral que a pessoa descreveu ter visto (carrossel, reels, post, etc), pra virar um item reutilizável na Biblioteca de Referências dela.

Regra inegociável: nunca reproduza o texto original, nome de marca, nome de pessoa, número/dado específico do exemplo original. Generalize tudo em [colchetes] — ex: "[Nome da pessoa] resolveu [problema específico] em [prazo]" no lugar de citar quem/o quê real. Se a pessoa colar o texto original de outra conta, extraia só o PADRÃO estrutural por trás — nunca copie a frase.

Responda em JSON, só o objeto, sem markdown, nesse formato exato:
{
  "title": "nome curto do padrão (ex: Gancho de contraste de status)",
  "formula": "a fórmula com [colchetes], pronta pra reusar em qualquer nicho",
  "mechanicPreserved": ["item 1 do que faz isso funcionar", "item 2", "item 3"]
}`

export async function POST(req: NextRequest) {
  const { rawText, format } = await req.json() as { rawText: string; format?: string }
  if (!rawText?.trim()) return NextResponse.json({ error: 'Descreva o que você viu' }, { status: 400 })

  const prompt = `${SYSTEM}\n\nFormato do conteúdo: ${format || 'carrossel'}\n\nO que a pessoa descreveu ter visto:\n${rawText}`

  try {
    const raw = await callClaudeChat(prompt)
    const text = extractPlainText(raw)
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { title: string; formula: string; mechanicPreserved: string[] }
    return NextResponse.json(parsed)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
