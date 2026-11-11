#!/usr/bin/env bash
#
# Testes do hook .claude/hooks/freeze-acceptance.sh, pela entrada que o Claude Code entrega a ele
# (um JSON pela entrada padrão) e pela decisão que ele devolve (0 libera, 2 nega). Rodam na máquina,
# como o hook, porque ele usa o `git` e o `jq`, que o contêiner `harness` não tem. Quem chama é o
# scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/.claude/hooks/freeze-acceptance.sh"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

for tool in git jq; do
  command -v "$tool" >/dev/null || { echo "Falta o \`$tool\` na máquina: o hook e o teste dele precisam dele."; exit 2; }
done

project="$(mktemp -d)"
trap 'rm -rf "$project"' EXIT
git -C "$project" init -q
git -C "$project" config user.email t@t
git -C "$project" config user.name t
t="docs/tickets/PROJ-100/PROJ-1"
mkdir -p "$project/$t" "$project/apps"
echo congelado >"$project/$t/aceite.md"
# Outro arquivo da pasta do ticket, em commit só para provar que o congelamento é só do aceite.
echo nota >"$project/$t/notas.md"
# Um aceite que ficou no desenho de um nível, de antes da pasta da issue pai.
mkdir -p "$project/docs/tickets/PROJ-7"
echo antigo >"$project/docs/tickets/PROJ-7/aceite.md"
echo x >"$project/apps/a.ts"
git -C "$project" add -A
git -C "$project" -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -q -m plano || exit 2

# O hook roda no projeto temporário.
export CLAUDE_PROJECT_DIR="$project"

# expect <código esperado> <nome> <JSON da entrada> [trecho esperado na saída de erro]
expect() {
  expect_hook "$HOOK" "$@"
}

expect 2 "nega a edição de um arquivo de aceite já versionado, e diz que descongelar é do usuário" \
  "{\"tool_input\":{\"file_path\":\"$project/$t/aceite.md\"}}" "Descongelar é do usuário"
expect 2 "nega a edição de um aceite versionado no caminho antigo, de um nível, e manda movê-lo para a pasta da issue pai" \
  "{\"tool_input\":{\"file_path\":\"$project/docs/tickets/PROJ-7/aceite.md\"}}" "docs/tickets/<issue>/<ticket>/"
expect 0 "libera a criação de um aceite novo no caminho antigo, de um nível" \
  "{\"tool_input\":{\"file_path\":\"$project/docs/tickets/PROJ-8/aceite.md\"}}"
expect 2 "nega a entrada ilegível que cita um aceite no caminho antigo" \
  "isto não é json docs/tickets/PROJ-7/aceite.md"
expect 0 "libera a criação de um arquivo de aceite novo, na pasta de outro ticket da mesma issue pai" \
  "{\"tool_input\":{\"file_path\":\"$project/docs/tickets/PROJ-100/PROJ-2/aceite.md\"}}"
expect 0 "libera a criação de um arquivo de aceite novo, na pasta de outra issue pai" \
  "{\"tool_input\":{\"file_path\":\"$project/docs/tickets/PROJ-200/PROJ-3/aceite.md\"}}"
expect 0 "libera a edição de outro arquivo da pasta do ticket, mesmo em commit" \
  "{\"tool_input\":{\"file_path\":\"$project/$t/notas.md\"}}"
expect 0 "libera a mensagem proposta do plano, na pasta do ticket" \
  "{\"tool_input\":{\"file_path\":\"$project/$t/plano.msg\"}}"
expect 0 "libera um arquivo da pasta de trabalho sem ticket" \
  "{\"tool_input\":{\"file_path\":\"$project/docs/tickets/sem-ticket/ajuste/review.diff\"}}"
expect 0 "libera a edição de um arquivo fora da pasta dos tickets" \
  "{\"tool_input\":{\"file_path\":\"$project/apps/a.ts\"}}"
expect 2 "nega o caminho que chega ao arquivo versionado por um \`..\`" \
  "{\"tool_input\":{\"file_path\":\"$project/apps/../$t/aceite.md\"}}"
expect 2 "nega a entrada ilegível que cita um arquivo de aceite" \
  "isto não é json $t/aceite.md"
expect 0 "libera a entrada ilegível que cita só outro arquivo da pasta do ticket" \
  "isto não é json $t/plano.msg"
expect 0 "libera a entrada ilegível que não cita a pasta dos tickets" \
  "isto não é json apps/a.ts"

finish "do hook"
