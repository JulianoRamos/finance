# Grupo de verificação da api (apps/api), carregado pelo scripts/verify.sh. O que cada função define
# está no README.md desta pasta. A api é a dona do contrato: a cópia da especificação e o schema do
# Prisma (LLD, seção 5).
#
# Os testes e as checagens rodam no contêiner `api`, que já tem de estar no ar. A visão do contrato
# roda na máquina (o `git` e o `oasdiff`, numa imagem fixa) e no contêiner `harness` (o renderizador).

API_OPENAPI=apps/api/openapi.json
API_SCHEMA=apps/api/prisma/schema
# Versão fixa, para o mesmo par de snapshots dar sempre o mesmo changelog.
API_OASDIFF_IMAGE=tufin/oasdiff:v1.34.1
# O snapshot de um ponto do Git em que a especificação ainda não existe: nenhuma rota.
API_EMPTY_SPEC='{"openapi":"3.0.0","info":{"title":"finance","version":"1"},"paths":{}}'
# O texto de documentação, que não muda o contrato. São os mesmos elementos que o
# scripts/contract-view.cjs ignora.
API_TEXT_ELEMENTS=description,examples,summary,title

CONTRACT_FILES+=("$API_OPENAPI" "$API_SCHEMA/")

api_reports=(vitest:reports/vitest.json)

api_fast() {
  require_container api
  step "api: tipos" \
    "corrija os erros de tipo acima, em apps/api, e confira com \`$EXEC api pnpm typecheck\`." \
    in_container api pnpm -s typecheck
  step "api: lint e formatação" \
    "corrija o que o ESLint apontou, em apps/api; a formatação se corrige com \`$EXEC api pnpm format\`." \
    in_container api pnpm -s lint
}

api_full() {
  api_fast
  step "api: cópia da especificação" \
    "gere a cópia com \`$EXEC api pnpm openapi:generate\`, confira o diff do $API_OPENAPI e faça o commit dele." \
    in_container api pnpm -s openapi:check
  step "api: testes (Vitest)" \
    "corrija o teste ou o código que falhou, em apps/api, e rode só o arquivo com \`$EXEC api pnpm test <arquivo>\`." \
    api_tests
}

api_tests() {
  # Relatório antigo não vale como evidência desta execução.
  in_container api sh -c 'rm -f reports/vitest.json && pnpm -s test:report' &&
    check_report api vitest reports/vitest.json
}

# A árvore do Git de um ponto: a do commit, o próprio id de uma árvore, ou, sem ponto, a da pasta de
# trabalho, com os arquivos do contrato que ainda não estão em commit.
# api_tree [<ponto>]
api_tree() {
  if [[ -n "${1:-}" ]]; then
    git rev-parse --verify --quiet "$1^{tree}"
  else
    worktree_tree "$API_OPENAPI" "$API_SCHEMA"
  fi
}

# O texto da especificação numa árvore, ou o snapshot vazio quando ela ainda não existe.
# api_snapshot <árvore>
api_snapshot() {
  git show "$1:$API_OPENAPI" 2>/dev/null || printf '%s\n' "$API_EMPTY_SPEC"
}

# O `oasdiff` sobre os snapshots `base.json` e `novo.json` de uma pasta.
# api_oasdiff <pasta> <argumentos do oasdiff...>
api_oasdiff() {
  local dir="$1"
  shift
  docker run --rm -v "$dir:/contrato:ro" "$API_OASDIFF_IMAGE" "$@"
}

# A visão legível do contrato e do schema entre duas árvores, no formato de saída do comando do
# contrato da skill de plano (formatos/contrato.md). O contrato muda quando o `oasdiff` acha diferença
# fora do texto de documentação. Sai com 0 quando o contrato ou o schema muda, 3 quando os dois estão
# iguais (a visão diz isso) e 1 quando não consegue comparar.
# api_render <rótulo de> <rótulo para> <árvore de> <árvore para>
api_render() {
  local from="$3" to="$4" dir schema changelog sources changed=no
  schema="$(plain_diff "$from" "$to" -- "$API_SCHEMA")" || return 1
  [[ -n "$schema" ]] && changed=yes
  dir="$(mktemp -d)" || return 1
  api_snapshot "$from" >"$dir/base.json" && api_snapshot "$to" >"$dir/novo.json" || { rm -rf "$dir"; return 1; }
  # As fontes do renderizador, em pares nome e valor terminados por NUL (scripts/contract-view.cjs).
  # Sem o changelog, ele diz que o snapshot é o mesmo nos dois pontos.
  sources=(base "$(cat "$dir/base.json")" novo "$(cat "$dir/novo.json")" schemaDiff "$schema")

  api_oasdiff "$dir" diff /contrato/base.json /contrato/novo.json \
    --exclude-elements "$API_TEXT_ELEMENTS" --fail-on-diff >/dev/null 2>&1
  case $? in
    0) ;;
    1)
      changed=yes
      changelog="$(api_oasdiff "$dir" changelog /contrato/base.json /contrato/novo.json)" ||
        { rm -rf "$dir"; api_oasdiff_failed; return 1; }
      sources+=(changelog "$changelog")
      ;;
    *)
      rm -rf "$dir"
      api_oasdiff_failed
      return 1
      ;;
  esac
  rm -rf "$dir"

  printf 'Contrato e schema de `%s` até `%s`.\n\n' "$1" "$2"
  printf '%s\0' "${sources[@]}" | node_in_harness scripts/contract-view.cjs - || return 1
  [[ $changed == yes ]] || return 3
}

api_oasdiff_failed() {
  fail "O \`oasdiff\` não conseguiu comparar os snapshots da especificação." \
    "confira se o $API_OPENAPI é uma especificação OpenAPI válida nos dois pontos e se o Docker baixa a imagem $API_OASDIFF_IMAGE."
}

# A visão do contrato entre dois pontos do Git. É o `scripts/verify.sh contract`.
# api_contract_view <de> [<para>]
api_contract_view() {
  local from to code
  from="$(api_tree "$1")" ||
    { fail "Não deu para ler a árvore de \`$1\`." "passe um commit ou o id de uma árvore deste repositório."; return 1; }
  to="$(api_tree "${2:-}")" ||
    { fail "Não deu para montar a árvore de \`${2:-a pasta de trabalho}\`." "confira o repositório com \`git status\`."; return 1; }
  api_render "$1" "${2:-a pasta de trabalho}" "$from" "$to"
  code=$?
  [[ $code -eq 0 || $code -eq 3 ]]
}

# O aviso de que o contrato ou o schema mudou depois do commit de plano: grava a visão do desvio no
# arquivo e avisa, ou diz que está igual ao planejado. Só falha quando não consegue comparar.
# api_contract_drift <commit de plano> <fim da branch, ou vazio para a pasta de trabalho> <arquivo>
api_contract_drift() {
  local plan="$1" head="$2" file="$3" short from to view code
  short="$(git rev-parse --short "$plan")"
  from="$(api_tree "$plan")" && to="$(api_tree "$head")" || {
    echo "Não deu para ler as árvores do commit de plano $short e de ${head:-a pasta de trabalho}, e o desvio do contrato não foi conferido."
    return 1
  }
  view="$(api_render "$plan" "${head:-a pasta de trabalho}" "$from" "$to")"
  code=$?
  case $code in
    3) echo "O contrato e o schema estão iguais ao planejado no commit de plano $short." ;;
    0)
      printf '%s\n' "$view" >>"$file"
      echo "::warning title=Contrato diferente do planejado::O contrato ou o schema da api mudou depois do commit de plano $short. A visão do desvio está em $file."
      ;;
    *)
      echo "Não deu para comparar o contrato do commit de plano $short com o de ${head:-a pasta de trabalho}, e o desvio do contrato não foi conferido."
      return 1
      ;;
  esac
}
