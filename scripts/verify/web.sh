# Grupo de verificação da web (apps/web), carregado pelo scripts/verify.sh. O que cada função define
# está no README.md desta pasta.
#
# Tudo roda no contêiner `web`, que já tem de estar no ar. Os testes de ponta a ponta rodam no
# Playwright desse contêiner, contra a web nele mesmo, que chama a api pela rede interna.

# Onde a web responde, dentro do contêiner dela.
WEB_URL=http://127.0.0.1:3000

web_reports=(playwright:reports/playwright.json)

web_fast() {
  require_container web
  # A checagem de tipos gera antes os tipos do cliente a partir da cópia da especificação da api:
  # uma rota que muda quebra aqui, no mesmo PR.
  step "web: tipos" \
    "corrija os erros de tipo acima, em apps/web; se vierem do cliente da api, confira a cópia da especificação em apps/api/openapi.json." \
    in_container web pnpm -s typecheck
  step "web: lint e formatação" \
    "corrija o que o ESLint apontou, em apps/web; a formatação se corrige com \`$EXEC web pnpm format\`." \
    in_container web pnpm -s lint
}

web_full() {
  web_fast
  step "web: ponta a ponta (Playwright)" \
    "corrija o teste ou o código que falhou; o trace do teste fica em apps/web/test-results/, e um arquivo roda com \`$EXEC web pnpm test:e2e <arquivo>\`." \
    web_e2e
}

# A web tem de estar respondendo. Os contêineres das apps são as próprias apps no ar, então não há o
# que subir aqui: o `require_container` do `web_fast` já exige o contêiner, e o `up --wait` (o da CI,
# antes do verify.sh) espera o healthcheck, que é esta mesma rota.
web_running() {
  responds web "$WEB_URL/health" ||
    fail "A web não está respondendo em $WEB_URL/health, no contêiner dela, e os testes de ponta a ponta rodam contra ela." \
      "veja o log com \`${COMPOSE[*]} logs web\` e suba o ambiente com \`${COMPOSE[*]} up -d --build --wait\`."
}

web_e2e() {
  web_running &&
    # Relatório antigo não vale como evidência desta execução.
    in_container web sh -c 'rm -f reports/playwright.json && pnpm -s test:e2e' &&
    check_report web playwright reports/playwright.json
}
