#!/usr/bin/env bash
#
# Testes do aviso de aceite congelado do scripts/harness-guard.sh: só o arquivo de aceite na
# profundidade certa (docs/tickets/<issue>/<ticket>/aceite.md) conta. Rodam na máquina, num
# diretório temporário que faz as vezes da `main`. Quem chama é o scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GUARD="$ROOT/scripts/harness-guard.sh"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

main="$(mktemp -d)"
trap 'rm -rf "$main"' EXIT
for file in docs/tickets/PROJ-1/PROJ-2/aceite.md docs/tickets/PROJ-3/aceite.md docs/tickets/PROJ-1/PROJ-2/fundo/aceite.md; do
  mkdir -p "$main/$(dirname "$file")"
  echo x >"$main/$file"
done

# guard <caminho>: roda a guarda na `main` de mentira, com um caminho alterado, e deixa a saída em $out.
guard() {
  out="$(cd "$main" && "$GUARD" <<<"$1" 2>&1)"
}

lacks() {
  [[ "$out" != *"$1"* ]]
}

contains() {
  [[ "$out" == *"$1"* ]]
}

guard docs/tickets/PROJ-1/PROJ-2/aceite.md
check "avisa o aceite que já existe, na profundidade da issue pai e do ticket" contains "Aceite congelado alterado"
guard docs/tickets/PROJ-3/aceite.md
check "não avisa o aceite de um nível só" lacks "Aceite congelado alterado"
guard docs/tickets/PROJ-1/PROJ-2/fundo/aceite.md
check "não avisa o aceite fundo demais" lacks "Aceite congelado alterado"
guard docs/tickets/PROJ-1/PROJ-9/aceite.md
check "não avisa o aceite novo, que não existe na main" lacks "Aceite congelado alterado"

finish "da guarda do harness"
