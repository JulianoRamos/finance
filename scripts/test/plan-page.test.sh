#!/usr/bin/env bash
#
# Testes dos argumentos e da pasta do ticket do script da página do plano
# (.claude/skills/plan-ticket/scripts/plan-page.sh): o `--pai` obrigatório e validado, a página
# gravada em <tickets>/<pai>/<ticket>/ e as regras do .gitignore na profundidade nova. O script roda
# num repositório temporário, com um comando do Node de mentira. Rodam na máquina, como o script,
# porque ele usa o `git` e o `bash`, que o contêiner `harness` não tem. Quem chama é o scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$ROOT/.claude/skills/plan-ticket/scripts/plan-page.sh"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

project="$(mktemp -d)"
trap 'rm -rf "$project"' EXIT
git -C "$project" init -q
git -C "$project" config user.email t@t
git -C "$project" config user.name t
printf '%s\n' 'docs/tickets/*/*/*' '!docs/tickets/*/*/aceite.md' >"$project/.gitignore"
echo x >"$project/a.txt"
git -C "$project" add -A
git -C "$project" -c commit.gpgsign=false -c core.hooksPath=/dev/null commit -q -m base || exit 2

# O comando do Node de mentira: lê as fontes e imprime uma página mínima.
fake_node="$project/fake-node.sh"
printf '#!/usr/bin/env bash\ncat >/dev/null\necho "<html>página</html>"\n' >"$fake_node"
chmod +x "$fake_node"

# plan <argumentos...>: roda o script no projeto temporário com os valores fixos, e deixa a saída de
# erro em $err e o código em $code.
plan() {
  err="$(cd "$project" && "$SCRIPT" --tickets docs/tickets --node "$fake_node" --contrato nenhum "$@" 2>&1 >/dev/null)"
  code=$?
}

contains() {
  [[ "$err" == *"$1"* ]]
}

plan --ticket PROJ-2
check "recusa a chamada sem o --pai, dizendo qual argumento falta" test $code -eq 2 -a -n "$err"
check "a mensagem de quando falta o --pai o nomeia" contains "--pai"

plan --pai pai --ticket PROJ-2
check "recusa um --pai que não tem a forma PREFIXO-N" test $code -eq 2
check "a mensagem do --pai inválido o cita" contains '`pai`'

plan --pai PROJ-1 --ticket PROJ-2
check "sem a mensagem proposta, para pedindo a mensagem na pasta da issue pai e do ticket" test $code -eq 1
check "a mensagem proposta é esperada em <tickets>/<pai>/<ticket>/plano.msg" contains "docs/tickets/PROJ-1/PROJ-2/plano.msg"

mkdir -p "$project/docs/tickets/PROJ-1/PROJ-2"
echo "docs: plan x (PROJ-2)" >"$project/docs/tickets/PROJ-1/PROJ-2/plano.msg"
plan --pai PROJ-1 --ticket PROJ-2
check "monta a página na pasta do ticket, dentro da pasta da issue pai" test $code -eq 0 -a -f "$project/docs/tickets/PROJ-1/PROJ-2/plano.html"

# O .gitignore de antes da pasta da issue pai ignora a pasta do ticket inteira, aceite incluído.
printf '%s\n' 'docs/tickets/*/*' '!docs/tickets/*/aceite.md' >"$project/.gitignore"
plan --pai PROJ-1 --ticket PROJ-2
check "recusa o .gitignore da profundidade antiga: a regra da pasta ignora o aceite" test $code -eq 2
check "a mensagem diz que o aceite é ignorado" contains 'ignora o docs/tickets/PROJ-1/PROJ-2/aceite.md'
check "a mensagem manda trocar a regra obsoleta da pasta" contains 'troque a regra que ignora a própria pasta'
check "a mensagem traz as regras da profundidade nova" contains '`docs/tickets/*/*/*` e `!docs/tickets/*/*/aceite.md`'

# Sem nenhuma regra, a página e a mensagem seriam versionadas: é a outra recusa.
: >"$project/.gitignore"
plan --pai PROJ-1 --ticket PROJ-2
check "recusa o .gitignore que não ignora a página do ticket" test $code -eq 2
check "a mensagem diz qual arquivo não é ignorado" contains 'não ignora o docs/tickets/PROJ-1/PROJ-2/plano.html'
check "a mensagem pede as linhas novas" contains 'acrescente ao .gitignore as linhas'

# As regras novas passam de novo.
printf '%s\n' 'docs/tickets/*/*/*' '!docs/tickets/*/*/aceite.md' >"$project/.gitignore"
plan --pai PROJ-1 --ticket PROJ-2
check "aceita as regras da profundidade nova" test $code -eq 0

finish "do script da página do plano"
