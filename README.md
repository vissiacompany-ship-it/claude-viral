# Claude Viral

Sistema completo de criação de carrossel viral pra Instagram — roda no seu computador, com o
Claude Code fazendo o trabalho técnico e a copy por você. Sem mensalidade além da licença do
Claude Pro, sem servidor externo, sem limite de uso.

---

## O que é

O Claude Viral transforma uma ideia solta (ou um conteúdo que você já tem) num carrossel
pronto pra postar — capa, texto de cada slide, imagem e legenda — sem precisar saber
programar, escrever prompt, nem abrir uma ferramenta de design. Você conversa em português
com uma IA que já sabe a estrutura de um carrossel que prende (gancho, tensão, virada, prova,
aplicação, CTA) e entrega o texto pronto; o editor visual cuida do resto.

## Como funciona

1. **Converse** — no chat, conte seu nicho, o que quer dizer, e a IA monta a copy completa do
   carrossel, slide por slide.
2. **Criar carrossel** — um clique já distribui o texto no modelo visual e te leva pro editor.
3. **Gerar imagens** — um clique gera (com IA) ou você sobe as fotos de cada slide.
4. **Baixar** — um clique exporta tudo pronto pra postar no Instagram.

## O que tem

- **4 templates visuais prontos** — editorial/foto, frase de impacto, tutorial passo a passo,
  foto + bloco de cor — cada um com paleta, fonte e layout ajustáveis
- **Motor de copy** — gera o texto de cada slide a partir de uma conversa, aplicando um
  checklist de qualidade editorial (nada de frase genérica ou "cara de IA")
- **Chat com histórico** — salva e retoma conversas anteriores, sem perder contexto
- **Geração de imagem por IA** — prompt e imagem gerados automaticamente por slide, ou upload
  manual se preferir
- **Editor visual completo** — cores (com conta-gotas), fontes, destaque de palavra/frase,
  posição de imagem, tudo ajustável sem código
- **Perfis de marca** — salve cor, fonte, logo e handle uma vez e reaproveite em todo carrossel
- **Preview do Instagram** — veja o carrossel exatamente como vai aparecer no feed antes de
  postar
- **Exportação em PNG** — pronto pra subir direto no Instagram

---

## O que você precisa

1. **Um computador** (Windows, Mac ou Linux)
2. **Licença do [Claude Pro](https://claude.ai/upgrade)** — é o que roda a inteligência artificial por trás de tudo
3. **Espaço no computador** pra baixar este projeto

Só isso. Você **não** precisa saber programar — o próprio sistema te guia pelo chat.

---

## Passo a passo

### 1. Instalar o Node.js

Baixe e instale em [nodejs.org](https://nodejs.org) (escolha a versão "LTS"). Isso é o que
permite o projeto rodar no seu computador.

### 2. Instalar o Claude Code

O Claude Code é a ferramenta da Anthropic que vai conversar com você e ligar o sistema
sozinha. Duas formas de instalar:

- **Terminal** — abra o Terminal (Mac/Linux) ou PowerShell (Windows) e rode:
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
- **VS Code** — instale a extensão "Claude Code" pela loja de extensões do VS Code.

Guia oficial (inglês): [docs.claude.com/claude-code](https://docs.claude.com/en/docs/claude-code)

### 3. Baixar este projeto

No botão verde **"Code"** no topo desta página, clique em **"Download ZIP"** e extraia a
pasta em qualquer lugar do seu computador. (Se você já usa git, `git clone` funciona também.)

### 4. Abrir o Claude Code dentro da pasta

- **Terminal**: navegue até a pasta extraída e rode `claude`
- **VS Code**: abra a pasta no VS Code e inicie o Claude Code pela extensão

### 5. Deixar a IA assumir

Assim que o Claude Code abrir, mande qualquer mensagem (ex: "oi", "pode começar"). O sistema
vai te perguntar se já está tudo rodando e, se não estiver, ele mesmo instala e liga tudo —
você só confirma "sim" ou "não" no chat. Depois disso, ele te ajuda a escrever a copy do seu
primeiro carrossel e te leva direto pro editor visual.

---

## Suporte

Dúvidas sobre o Claude Code em si (instalação, licença, etc.) — consulte a
[documentação oficial da Anthropic](https://docs.claude.com/en/docs/claude-code).
