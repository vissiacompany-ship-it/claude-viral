import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, extractPlainText } from '@/lib/claude'
import { ContentPillar } from '@/types'
import { CONTENT_PILLARS } from '@/lib/pillars'

export async function POST(req: NextRequest) {
  const { title, subtitle, body, tag, pillar, extra, textAnchor, hasReferences } = await req.json() as {
    title?: string; subtitle?: string; body?: string; tag?: string; pillar?: ContentPillar; extra?: string
    textAnchor?: 'top' | 'center' | 'bottom'; hasReferences?: boolean
  }
  const context = [tag, title, subtitle, body].filter(Boolean).join(' — ').trim()
  if (!context) {
    return NextResponse.json({ error: 'Esse slide ainda não tem texto pra basear a imagem.' }, { status: 400 })
  }
  const pillarNote = pillar === 'noticia-cultura'
    ? '\nEsse slide é do pilar Notícia/Cultura — priorize ancorar a cena em algo reconhecível do momento atual (um cenário, objeto ou situação que remete a algo em alta agora), sempre que o texto permitir, em vez de uma cena genérica atemporal.'
    : ''
  const extraNote = extra?.trim()
    ? `\n\nDIREÇÃO ESPECÍFICA da pessoa pra essa imagem (prioridade alta — ajuste a cena/composição/objeto pra atender isso, sem contradizer as regras obrigatórias abaixo): "${extra.trim()}"`
    : ''
  // O texto do slide é renderizado por CIMA da imagem, sempre na mesma faixa (topo, centro ou
  // base, conforme esse template) — se o assunto principal da cena cair bem ali, o texto some
  // em cima de detalhe visual concorrendo por atenção. Empurra o peso visual pra fora dessa
  // faixa, deixando exatamente essa área mais "calma" (menos detalhe, tom mais uniforme/escuro)
  // pra sobrar contraste e legibilidade pro texto por cima.
  const anchorNote = textAnchor === 'bottom'
    ? '\n\nCOMPOSIÇÃO OBRIGATÓRIA — o texto desse slide fica sobreposto na FAIXA DE BAIXO da imagem (os ~35-40% inferiores do quadro). Componha a cena com o assunto/detalhe principal concentrado na metade de CIMA do quadro; a faixa de baixo tem que ficar visualmente mais "calma" — menos detalhe, tom mais escuro/uniforme, sem elemento importante da cena ali — só o suficiente pra não competir com o texto por cima. Nunca centralize o rosto, o objeto principal ou o ponto de maior contraste bem na faixa de baixo.'
    : textAnchor === 'top'
    ? '\n\nCOMPOSIÇÃO OBRIGATÓRIA — o texto desse slide fica sobreposto na FAIXA DE CIMA da imagem (os ~35-40% superiores do quadro). Componha a cena com o assunto/detalhe principal concentrado na metade de BAIXO do quadro; a faixa de cima tem que ficar visualmente mais "calma" — menos detalhe, tom mais escuro/uniforme, sem elemento importante da cena ali — só o suficiente pra não competir com o texto por cima.'
    : ''
  const referenceNote = hasReferences
    ? '\n\nATENÇÃO — uma ou mais FOTOS DE REFERÊNCIA REAIS serão anexadas junto com esse prompt na hora de gerar (rosto/identidade de uma pessoa real, ou uma imagem de estilo/ambiente pra puxar a estética). Por causa disso: NÃO descreva a aparência física, rosto, roupa ou identidade de nenhuma pessoa — isso já vem da referência anexada, e descrever de novo do seu jeito só cria conflito com a foto real. Foque a cena em ação, pose, expressão, ambiente, luz e composição — tudo que a referência não define sozinha.'
    : ''

  const prompt = `Você é o gerador padrão de prompt de imagem do Claude Viral — usado em todo slide de todo carrossel do produto, sempre a partir do texto real daquele slide. Escreva UM prompt de geração de imagem em inglês, pronto pra colar em ferramentas como ChatGPT (DALL-E/GPT Image) ou Gemini, pra ilustrar este trecho de um carrossel de Instagram: "${context}"

IMPORTANTE sobre pra quais ferramentas esse prompt é calibrado: ChatGPT e Gemini respondem MELHOR a uma descrição de cena narrativa e vívida (como se fosse o roteiro de 1 frame de filme, contado em prosa) do que a uma lista de jargão técnico de câmera — jargão tipo "85mm f/1.8" tende a ser parcialmente ignorado por esses dois motores e não é o que te aproxima do resultado. O que realmente empurra o resultado pro nível de thumbnail viral profissional nessas duas ferramentas é: (1) ancorar o GÊNERO logo na primeira frase (ver regra abaixo), (2) grade de cor nomeada explicitamente, (3) um único efeito de luz simples e bem descrito — nunca um efeito complexo de composição digital que esses motores não sabem executar bem.

REGRA MÁXIMA, acima de qualquer outra — a imagem tem que ilustrar o que o texto do slide diz, de um jeito que a pessoa lendo entenda a ligação na hora, sem esforço. Isso vale tanto pra cena literal (a ação/objeto/momento que o texto descreve de fato) quanto pra uma metáfora visual CONCRETA E ESPECÍFICA (um objeto físico real que representa a ideia com precisão — ex: um espelho rachado pra "crise de identidade", uma corda esticada até quase arrebentar pra "no limite") — nunca uma metáfora abstrata de tecnologia/conceito (isso cai na lista de clichê de IA proibida abaixo). Se a cena (literal ou metáfora concreta) não for óbvia o suficiente pra alguém "resolver" o que ela representa em menos de 1 segundo, está errada, não importa quão interessante seja visualmente. Nunca desvie pra um sujeito só "relacionado" ou "parecido" sem intenção — a ligação com o texto precisa ser clara.
${pillarNote}${extraNote}${anchorNote}${referenceNote}

ANTES de decidir a cena, identifique se o texto usa alguma palavra/termo entre aspas ou em destaque como NOME DE CONCEITO, MECANISMO OU JARGÃO DE NEGÓCIO — não como o objeto físico que a palavra normalmente significa. Isso é comum em copy de marketing/vendas (ex: "veículo" como nome de uma oferta/método, "motor" como o mecanismo que gera resultado, "ponte" como uma etapa de funil, "chave" como o fator decisivo). Quando for esse o caso, a cena tem que representar literalmente a IDEIA DE NEGÓCIO por trás do termo (ex: diferenciação, algo isolado do resto, algo com identidade própria que não pode ser comparado diretamente a outros) — nunca o objeto físico que a palavra descreveria fora desse contexto (ex: "veículo" nesse sentido NUNCA vira carro, chave de carro ou qualquer coisa automotiva). Se não houver esse tipo de termo, ignore esse parágrafo e siga a regra máxima normalmente.

REGRA DE CONTEÚDO, sempre, sem exceção: a imagem é pra um carrossel de negócios/conteúdo no Instagram — profissional, apropriada pra qualquer público, sem nudez, sem roupa íntima, sem decote, sem corpo exposto ou sexualizado, sem violência gráfica. Se o texto menciona corpo, saúde, peso, estética ou fitness, a pessoa retratada está sempre vestida de forma comum e não sexualizada (roupa de rua, roupa de treino comum, ambiente do dia a dia) — o foco visual vai pro objeto, gesto, ambiente ou expressão, nunca pra exposição do corpo.

O objetivo número 2 é fator viral — no sentido de anúncio de direct-response, não de "arte bonita": a imagem é a thumbnail que precisa fazer o polegar da pessoa parar de rolar em menos de 1 segundo, do mesmo jeito que um anúncio pago bem feito faz. Uma imagem "bonita mas segura" (still de mão segurando objeto neutro num ambiente bem iluminado e genérico, sem rosto, sem tensão nenhuma) NÃO para o scroll, mesmo com qualidade técnica alta — é só uma foto de banco de imagens a mais. Mas fator viral nunca justifica fugir da regra máxima acima (relevância) ou da regra de conteúdo.

Escolha UM destes dispositivos concretos pra essa cena específica, sempre dentro do que o texto realmente descreve (nunca fique no genérico "tensão visual" abstrato — escolha um e execute ele até o fim):
- **Contraste lado a lado** — a cena mostra explicitamente dois estados opostos na mesma composição (antes/depois, quem faz X vs quem faz Y, dois resultados diferentes pro mesmo esforço) — um recurso clássico de anúncio de resposta direta, permitido e incentivado quando o texto descreve uma comparação
- **Print ou mockup de resultado real** — tela de celular/computador mostrando algo concreto e específico (um gráfico subindo, um número de resultado, uma conversa, um painel) como se fosse prova visual do que o texto afirma
- **Um objeto ou ambiente na condição mais extrema e concreta** — a versão mais crua e real de uma situação que o texto descreve (não a versão suavizada de banco de imagens), sempre sobre objeto/ambiente/gesto, nunca sobre expor o corpo de alguém
- **Expressão facial real, não posada** — rosto reagindo a algo (choque, frustração, alívio, exaustão, concentração) — nunca sorriso genérico de stock photo
- **Escala ou proporção que choca** — algo anormalmente grande, pequeno, cheio ou vazio pro contexto
- **Um detalhe físico específico e difícil de ignorar** — a textura, a marca, o objeto fora do lugar que conta a história sozinho
- **Metáfora visual concreta** — um objeto ou cena física real que representa a ideia do texto com precisão (nunca abstrata/tech-clichê) — só use quando existir um objeto concreto óbvio pra ideia; se não existir um óbvio, prefira outro dispositivo da lista
- **Ironia por contraste de status/expectativa** — colocar dois elementos que "não deveriam" estar juntos na mesma cena (luxo ao lado de algo banal ou de baixo status, um cenário aspiracional clichê com um objeto/produto que contradiz esse cenário) pra criar uma incoerência que força o olho a parar pra "resolver" a cena. É o mecanismo por trás de anúncio irônico/paródia — funciona por contraste de categoria e subversão do que a pessoa espera ver naquele tipo de cenário, nunca por expor o corpo de alguém como a piada

Regras obrigatórias, sempre (não são sobre este slide em particular — valem pra todo prompt que você gerar):
- Um único momento/composição central. Contraste lado a lado (o primeiro dispositivo acima) é permitido quando for a escolha certa pro conteúdo — mas não é o padrão automático; só use quando o texto descrever literalmente uma comparação. Fora isso, evite colagem/grid confuso de múltiplas cenas soltas sem relação entre si.
- A regra de conteúdo (sem nudez, sem corpo exposto ou sexualizado, sempre vestido de forma comum) vale pra CADA pessoa em cena, inclusive quando o dispositivo escolhido for contraste lado a lado ou ironia de status — nunca use exposição de corpo, tamanho de corpo ou aparência física de alguém como o elemento cômico/irônico da cena.
- Nunca use nome, logo ou embalagem de marca/produto/remédio real — se a cena precisa de um produto (remédio, suplemento, embalagem), descreva algo genérico e fictício, sem nome de marca real nenhum.
- PROIBIDO clichê visual de IA GENÉRICO: mão tocando holograma/rede neural brilhante só de enfeite, robô apertando mão de humano, cérebro digital azul flutuando sem motivo, overlay plano de "dados"/circuitos colado por cima de qualquer coisa sem lógica com a cena, pessoa genérica sorrindo pra tela de notebook, still de academia/escritório/lifestyle "bonito mas vazio" sem tensão real. Isso é diferente de um efeito de luz/energia bem executado (ver regra de composição VFX abaixo) — o problema do clichê é ser um adesivo solto sem física nem lógica, não o efeito digital em si.
- A cena tem que ser concreta e específica, amarrada ao que o texto do slide realmente diz — uma pessoa real fazendo algo real, um objeto físico, um momento tangível — nunca uma metáfora abstrata de tecnologia/conceito. Pense em como um fotojornalista ou fotógrafo editorial composaria a cena, não como um gerador de imagem genérico composaria.
- ÂNCORA DE GÊNERO, sempre na abertura do prompt (isso é o que mais influencia ChatGPT/Gemini a saírem do modo "foto de banco de imagens" pro modo "thumbnail profissional"): comece o prompt descrevendo o TIPO de imagem antes da cena em si — ex. "A cinematic photo-illustration in the style of a high-production viral Instagram/YouTube thumbnail, dramatic editorial photography with a documentary feel" — só depois entre na cena específica. Sem essa âncora de gênero, o motor tende a interpretar o pedido como "foto genérica bem iluminada" por padrão.
- Vocabulário de fotografia é permitido como TEMPERO leve (ex: "shallow depth of field", "cinematic lighting"), nunca como especificação técnica pesada (lente/abertura em número) — ChatGPT e Gemini tendem a ignorar parâmetro técnico numérico e ele só ocupa espaço que poderia reforçar a cena ou o gênero.
- Grade de cor cinematográfica por padrão em todo prompt: contraste complementar quente/frio — pele e luz principal em tom quente/âmbar, sombra e elemento de destaque em azul-petróleo/teal (cite isso explicitamente, ex. "cinematic teal and orange color grade") — a menos que o texto do slide claramente peça outra paleta (cena monocromática, clínica, ou outra emoção específica que essa grade contradiga).
- Luz dura e direcional de uma fonte só (estilo Rembrandt/side-light de still de cinema), nunca luz plana e uniforme de estúdio publicitário — fundo escuro ou desfocado, um único ponto de luz definindo a cena. Prefira enquadramento fechado (rosto, mãos, um detalhe específico) a corpo inteiro, e deixe espaço negativo generoso numa borda da composição pra caber o texto do slide por cima sem brigar com a cena.
- Se (e só se) o dispositivo escolhido envolver um elemento de luz/energia, prefira SEMPRE o efeito mais simples que ainda comunica a ideia (ex: brilho de tela de celular iluminando o rosto, luz de fundo forte criando silhueta, faísca/poeira pegando luz) em vez de um efeito de composição digital complexo (dissolução/fragmentação/holograma) — ChatGPT e Gemini renderizam luz simples de forma consistente, mas normalmente falham ou ficam com aparência ruim tentando um composite digital elaborado. Descreva o efeito simples com a luz iluminando fisicamente a pele/objeto de verdade (ex. "the phone screen casts a real blue glow on the hand and face").
- GRANULARIDADE POR MATERIAL/CAMADA (o que mais separa um prompt fraco de um que sai parecido com produção de verdade): nunca descreva um objeto ou pessoa de forma genérica — para CADA elemento físico presente na cena (roupa, pele, objeto principal, superfície), nomeie o material/textura específico e como a luz reage nele (ex: não "a person holding a phone", e sim "a hand with visible skin texture holding a matte black smartphone, the screen's cool light reflecting off the glass surface and the fingertips"). Quando a cena tiver mais de um material (tecido + metal + pele + tela, por exemplo), descreva o efeito da luz em cada um separadamente, não numa frase só genérica de "dramatic lighting".
- FUNDO EM CAMADAS (perto → médio → longe), sempre que a cena não for um close absoluto sem fundo visível: descreva o que está imediatamente atrás do assunto (perto), o que preenche o meio da cena (médio), e o que aparece ao fundo/horizonte (longe) — cada camada com sua própria luz/foco (fundo mais desfocado que o assunto). Prefira SEMPRE poucos elementos de fundo grandes e bem integrados a muitos elementos pequenos espalhados (isso é o que mais faz a imagem parecer "colagem" em vez de foto real) — e todo elemento de fundo/contexto tem que estar na MESMA luz/sombra da cena, nunca um ícone plano ou recorte colado sem sombra própria.
- Não inclua texto nem tipografia na imagem — o texto do slide já é renderizado por cima dela pelo próprio Claude Viral.
- Isso é pra um slide de carrossel do Instagram — formato SEMPRE vertical (retrato), nunca paisagem/horizontal nem widescreen de vídeo. Termine o prompt com uma instrução explícita de enquadramento nesse sentido, por exemplo "vertical 4:5 portrait orientation, full-bleed portrait composition" — e componha a cena pensando em enquadramento vertical desde o início (o assunto principal ocupando o eixo vertical do quadro), não uma cena horizontal só cortada depois.

Responda SOMENTE com o prompt final em inglês, sem aspas, sem explicação, sem markdown.`

  try {
    const raw = await callClaudeChat(prompt)
    return NextResponse.json({ prompt: extractPlainText(raw) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao gerar o prompt' },
      { status: 500 }
    )
  }
}
