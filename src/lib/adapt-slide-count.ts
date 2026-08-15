import { SlideTemplateDef } from '@/types'

// Ajusta a lista de slides de um template pra ter exatamente N posições — quem dita
// quantos slides o carrossel tem é a quantidade de conteúdo da pessoa, não o template.
// Encurtando: pega as primeiras N posições (mantém a ordem/estrutura original).
// Alongando: repete um slide de conteúdo comum (não-capa) até completar.
export function adaptSlideCount(defs: SlideTemplateDef[], count: number): SlideTemplateDef[] {
  if (count <= defs.length) return defs.slice(0, count)
  const filler = defs.find(d => d.background !== 'cover') || defs[defs.length - 1]
  const out = [...defs]
  while (out.length < count) out.push(filler)
  return out
}
