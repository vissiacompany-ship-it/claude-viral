import { CarouselBriefing } from '@/types'

export function headlinesPrompt(briefing: CarouselBriefing, input: string): string {
  return `Gere exatamente 10 headlines para um carrossel Instagram com base no insumo abaixo.

INSUMO: ${input}

BRIEFING:
- Marca: ${briefing.niche}
- Tipo de carrossel: ${briefing.carouselType}
- Cor accent: ${briefing.accentColor}

DISTRIBUIÇÃO OBRIGATÓRIA:
- Opções 1-5: Investigação Cultural — estrutura: [Reenquadramento provocativo]: [Hook de curiosidade]
- Opções 6-10: Narrativa Magnética — estrutura: 3 frases com ponto: [Cenário concreto]. [Mecanismo]. [Tensão aberta]

DISTRIBUIÇÃO INTERNA:
1. Reenquadramento | 2. Conflito oculto | 3. Implicação sistêmica | 4. Contradição | 5. Ameaça/oportunidade
6. Nomeação | 7. Diagnóstico cultural | 8. Inversão | 9. Ambição de mercado | 10. Mecanismo social

VALIDAÇÃO ANTES DE ENTREGAR:
- IC (1-5): tem dois-pontos separando reenquadramento de hook? Se NÃO → reescrever
- NM (6-10): tem exatamente 3 frases com ponto? Se NÃO → reescrever
- Passa no checklist de rejeição? Se NÃO → reescrever

Retorne APENAS JSON válido no formato:
{
  "triagem": "1 frase com o ângulo central extraído",
  "eixo": "Mercado | Cases | Notícias | Cultura | Produto",
  "funil": "Topo | Meio | Fundo",
  "headlines": [
    { "index": 1, "text": "headline completa", "trigger": "Gatilho1 · Gatilho2" }
  ]
}`
}

export function spinePrompt(briefing: CarouselBriefing, input: string, headline: string): string {
  return `Monte a espinha dorsal narrativa para o carrossel abaixo.

INSUMO: ${input}
HEADLINE ESCOLHIDA: ${headline}
TIPO: ${briefing.carouselType}

Retorne APENAS JSON válido:
{
  "hook": "contextualiza a tensão da headline (2-3 frases jornalísticas)",
  "mechanism": "por que o fenômeno acontece (2-3 frases com dados)",
  "proof": "A) dado com fonte. B) dado com fonte. C) dado com fonte.",
  "application": "consequência mais ampla para o público (2-3 frases)",
  "direction": "próximo passo lógico sem CTA comercial (2-3 frases)"
}`
}

export function slidesPrompt(briefing: CarouselBriefing, headline: string, spine: Record<string, string>): string {
  const arcMap: Record<string, string> = {
    tendencia: 'Hook → Contexto → Mudança → Impacto → Ação → CTA',
    tese: 'Crença comum → Dados que desafiam → Verdade → Novo modelo → Aplicação → CTA',
    case: 'Resultado → Quem fez → Como → Princípio → Como replicar → CTA',
    previsao: 'Sinais fracos → Padrão → Direção → Quem se posiciona ganha → Ações → CTA'
  }

  const slideCountMap: Record<number, string> = {
    5: '1:Capa | 2:Hook+Contexto(dark) | 3:Prova(light) | 4:Aplicação+Direção(dark) | 5:CTA(light)',
    7: '1:Capa | 2:Hook(dark) | 3:Mecanismo(light) | 4:Prova(dark) | 5:Expansão(light) | 6:Direção(gradient) | 7:CTA(light)',
    9: '1:Capa | 2:Hook(dark) | 3:Contexto(light) | 4:Mecanismo(dark) | 5:Prova(light) | 6:Expansão(dark) | 7:Aplicação(light) | 8:Direção(gradient) | 9:CTA(light)',
    12: '1:Capa | 2:Hook(dark) | 3:Contexto(light) | 4:Mec.pt1(dark) | 5:Mec.pt2(light) | 6:Prova(dark) | 7:Dados(light) | 8:Expansão(dark) | 9:Caso(light) | 10:Aplicação(dark) | 11:Direção(gradient) | 12:CTA(light)'
  }

  return `Escreva o texto completo de cada slide para o carrossel abaixo.

HEADLINE: ${headline}
ESPINHA DORSAL:
- Hook: ${spine.hook}
- Mecanismo: ${spine.mechanism}
- Prova: ${spine.proof}
- Aplicação: ${spine.application}
- Direção: ${spine.direction}

SEQUÊNCIA (${briefing.slideCount} slides): ${slideCountMap[briefing.slideCount]}
ARCO NARRATIVO: ${arcMap[briefing.carouselType]}
CTA DO ÚLTIMO SLIDE: ${briefing.cta}

REGRAS DE COPY:
- Cada slide = máximo 2 blocos de texto
- Tom jornalístico, NUNCA motivacional
- Artigos sempre presentes (um/uma/o/a)
- Zero estruturas binárias ("não é X, é Y")
- Dados com fonte e ano
- Títulos internos: frases ancoradas e específicas, nunca genéricas
- Slide gradient: frase de impacto curta (2-4 palavras)

VALIDAÇÃO ANTES DE ENTREGAR (para cada slide):
- Teste da substituição: funciona com qualquer outro sujeito? Se sim → reescrever
- Teste do artigo: todo substantivo tem artigo?
- Teste binário: tem "não é X"? Se sim → reescrever

Retorne APENAS JSON válido:
{
  "slides": [
    {
      "index": 1,
      "background": "cover",
      "tag": "",
      "title": "HEADLINE DA CAPA UPPERCASE",
      "subtitle": "subtítulo opcional em itálico",
      "body": ""
    },
    {
      "index": 2,
      "background": "dark",
      "tag": "TAG DO SLIDE",
      "title": "TÍTULO INTERNO ANCORADO",
      "subtitle": "",
      "body": "Bloco 1 do texto.\n\nBloco 2 do texto com **negrito** e *accent*."
    }
  ],
  "caption": "Legenda Instagram completa com gancho + contexto + análise + CTA + hashtags"
}`
}

export function refineSlidePrompt(slideContent: string, instruction: string): string {
  return `Refine o conteúdo do slide abaixo seguindo a instrução:

CONTEÚDO ATUAL:
${slideContent}

INSTRUÇÃO: ${instruction}

Mantenha o tom jornalístico, artigos presentes, sem AI slop.
Retorne APENAS JSON: { "title": "...", "subtitle": "...", "body": "..." }`
}

export function captionPrompt(headline: string, slides: string, cta: string): string {
  return `Escreva a legenda Instagram para o carrossel abaixo.

HEADLINE: ${headline}
CONTEÚDO DOS SLIDES: ${slides}
CTA: ${cta}

FORMATO:
[GANCHO — máximo 125 caracteres, forte o suficiente pra parar o scroll]

[CONTEXTO — 2-3 frases explicando o tema]

[ANÁLISE — interpretação profunda em 2-3 frases]

Fontes: [fontes utilizadas, se houver]

💬 ${cta}

#[5 a 12 hashtags relevantes]

Retorne APENAS o texto da legenda, sem JSON, sem markdown.`
}
