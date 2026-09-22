#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Primeira vez rodando — instalando (pode levar 1-2 minutos)..."
  npm install
fi

if ! curl -s -o /dev/null "http://localhost:3000"; then
  echo "Ligando o Claude Viral..."
  nohup npm run dev > /tmp/claude-viral-dev.log 2>&1 &
  for i in $(seq 1 30); do
    sleep 1
    if curl -s -o /dev/null "http://localhost:3000"; then
      break
    fi
  done
fi

open "http://localhost:3000"
echo
echo "Prontinho — se o navegador não abriu sozinho, acesse http://localhost:3000"
read -p "Pressione Enter para fechar esta janela..."
