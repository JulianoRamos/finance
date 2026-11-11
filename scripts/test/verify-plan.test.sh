#!/usr/bin/env bash
#
# Testes dos argumentos do modo `plan` do scripts/verify.sh: a ordem antiga (`plan <ticket> [<commit>]`)
# é recusada com a ordem nova (`plan <pai> <ticket> [<commit>]`) e um exemplo. Só os casos recusados
# rodam aqui, porque param antes de chamar a página do plano. Rodam na máquina, como o verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

# plan <argumentos...>: roda `verify.sh plan` e deixa a saída de erro em $err e o código em $code.
plan() {
  err="$(cd "$ROOT" && scripts/verify.sh plan "$@" 2>&1 >/dev/null)"
  code=$?
}

contains() {
  [[ "$err" == *"$1"* ]]
}

plan PROJ-171
check "recusa só o ticket, com código 2" test $code -eq 2
check "diz que falta o <pai>" contains "falta o <pai>"
check "mostra a ordem nova, com exemplo" contains "plan <pai> <ticket> [<commit>]"
check "o exemplo traz uma issue pai e um ticket" contains "scripts/verify.sh plan PROJ-1 PROJ-123"

plan PROJ-171 abc1234
check "recusa a ordem antiga, ticket e commit, com código 2" test $code -eq 2
check "diz que o comando agora é com o <pai>" contains "plan <pai> <ticket> [<commit>]"

plan pai PROJ-171
check "recusa um <pai> que não tem a forma PREFIXO-N" test $code -eq 2
check "a mensagem do <pai> inválido mostra o comando novo" contains "plan <pai> <ticket> [<commit>]"

plan PROJ-162 ticket
check "recusa um <ticket> que não tem a forma PREFIXO-N" test $code -eq 2
check "a mensagem do <ticket> inválido mostra o comando novo" contains "plan <pai> <ticket> [<commit>]"

finish "do modo plan do verify.sh"
