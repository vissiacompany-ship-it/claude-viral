import { ContentPillar } from '@/types'

// Grade fixa de pilares — mesma estrutura pra qualquer perfil, porque resolve um problema de
// calendário (produção em volume, 5+ peças/dia) que a doutrina de copy sozinha não resolve:
// nem todo post pode ser fundo de funil revelando o mecanismo, senão queima o ângulo em
// semanas e entrega de graça o que sustenta o produto pago por trás do conteúdo.
// Sem dependência de fs/path de propósito — importado tanto no servidor (prompts) quanto no
// client (UI), então não pode carregar nada específico de Node aqui.
export const CONTENT_PILLARS: Record<ContentPillar, { label: string; funil: string; revealMechanism: boolean; instruction: string }> = {
  mecanismo: {
    label: 'Mecanismo',
    funil: 'Fundo',
    revealMechanism: true,
    instruction: 'Explica o Real Problema/Mecanismo do Perfil com nome próprio. É o único pilar que pode nomear o mecanismo — ainda assim, entregue só o suficiente pra a pessoa reconhecer o padrão, nunca o método completo de resolver (isso fica pro produto).',
  },
  'noticia-cultura': {
    label: 'Notícia/Cultura',
    funil: 'Topo',
    revealMechanism: false,
    instruction: 'Ancora num fato, tendência ou fenômeno cultural atual do nicho — não precisa citar o Real Problema/Mecanismo do Perfil, serve pra alcançar gente nova. Tom de investigação/leitura cultural, não de venda.',
  },
  'pratica-rapida': {
    label: 'Prática Rápida',
    funil: 'Meio',
    revealMechanism: false,
    instruction: 'Entrega 1 técnica/passo isolado, real e aplicável hoje, sem construir tese nenhuma por trás. Puro valor prático — nunca menciona o mecanismo nomeado do Perfil.',
  },
  'contra-crenca': {
    label: 'Contra-crença',
    funil: 'Meio',
    revealMechanism: false,
    instruction: 'Desmonta um conselho popular ou crença errada do nicho, sem precisar revelar o mecanismo do Perfil como solução — a virada aqui é derrubar o mito, não ensinar o método.',
  },
  'caso-observacao': {
    label: 'Caso/Observação',
    funil: 'Meio',
    revealMechanism: false,
    instruction: 'Uma cena ou observação real e específica, sem moral pesada nem venda no fim — mais leve, existe pra ser reconhecível e compartilhável, não pra ensinar.',
  },
  'provocacao-opiniao': {
    label: 'Provocação/Opinião',
    funil: 'Topo',
    revealMechanism: false,
    instruction: 'A marca dando uma opinião forte e pessoal sobre algo do nicho — constrói personalidade e posicionamento, não ensina nem vende.',
  },
}

export const PILLAR_ORDER: ContentPillar[] = ['mecanismo', 'noticia-cultura', 'pratica-rapida', 'contra-crenca', 'caso-observacao', 'provocacao-opiniao']
