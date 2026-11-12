#!/usr/bin/env bash
#
# Baixa a referência visual de um ticket: as telas do repositório de protótipos que o ticket cita,
# num commit fixo, para a pasta dele, em <tickets>/<pai>/<ticket>/referencia/. A /plan-ticket o
# chama quando o ticket tem a seção "Referência visual" (AGENTS.md da raiz, "Referência visual"), e a
# implementação e a revisão de conformidade leem essa cópia, e não o protótipo atual, que anda à
# frente do código.
#
#   scripts/referencia-visual.sh <pai> <ticket> <commit> <tela>...
#
# <commit> é o hash do commit do protótipo que o ticket cita (de 7 a 40 caracteres hexadecimais), e
# não uma branch nem uma tag, que mudam. Cada <tela> é o nome do arquivo sem o `.dc.html`, como
# `Lancamentos`. O repositório é o `JulianoRamos/finance-prototipo`, ou o de PROTOTYPE_REPO.
#
# A pasta `referencia/` é refeita a cada chamada: só ficam nela as telas desta chamada e o
# `origem.txt`, com o repositório, o commit completo e as telas, para a cópia poder ser refeita. O
# .gitignore a deixa fora do Git, como tudo na pasta do ticket, salvo o aceite.md.
#
# Roda na máquina e precisa do `git` e do `gh` com acesso ao repositório de protótipos. Sai com 0
# quando baixa todas as telas, 1 quando o GitHub não entrega o commit ou uma tela (e aí não deixa a
# pasta pela metade) e 2 quando um argumento falta ou não vale.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

REPO="${PROTOTYPE_REPO:-JulianoRamos/finance-prototipo}"
TICKETS_DIR=docs/tickets
USAGE='scripts/referencia-visual.sh <pai> <ticket> <commit> <tela>...'

# Não baixou: o erro e o que fazer.
# stop <código> <erro> <como corrigir>
stop() {
  printf '\n%s\n' "$2" >&2
  printf 'Como corrigir: %s\n' "$3" >&2
  exit "$1"
}

[[ $# -ge 4 ]] ||
  stop 2 "Faltam argumentos: o comando é \`$USAGE\`." \
    "passe a issue pai, o ticket, o commit do protótipo e ao menos uma tela, como \`scripts/referencia-visual.sh KAN-1 KAN-12 a1b2c3d Lancamentos Nav\`."

pai="$1" ticket="$2" commit="$3"
shift 3
telas=("$@")

[[ "$pai" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]] ||
  stop 2 "\`$pai\` não é o identificador de uma issue pai." "passe a chave da issue pai do ticket, como \`KAN-1\`."
[[ "$ticket" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]] ||
  stop 2 "\`$ticket\` não é o identificador de um ticket." "passe a chave do ticket, como \`KAN-12\`."
[[ "$commit" =~ ^[0-9a-f]{7,40}$ ]] ||
  stop 2 "\`$commit\` não é o hash de um commit." \
    "passe o hash do commit do protótipo que o ticket cita (de 7 a 40 caracteres hexadecimais), e não uma branch nem uma tag, que mudam."
for tela in "${telas[@]}"; do
  [[ "$tela" =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]] ||
    stop 2 "\`$tela\` não é o nome de uma tela." \
      "passe o nome do arquivo da tela sem o \`.dc.html\` e sem pasta, como \`Lancamentos\`."
done

dir="$TICKETS_DIR/$pai/$ticket/referencia"
git check-ignore -q --no-index "$dir/origem.txt" ||
  stop 2 "O $dir não seria ignorado pelo Git, e a cópia do protótipo iria para um commit." \
    "confira as regras de $TICKETS_DIR no .gitignore: ele ignora tudo na pasta do ticket, salvo o aceite.md."

command -v gh >/dev/null 2>&1 ||
  stop 1 "O \`gh\` não está instalado, e é por ele que as telas são baixadas." "instale o GitHub CLI e rode \`gh auth login\`."

full="$(gh api "repos/$REPO/commits/$commit" --jq .sha 2>/dev/null)"
[[ "$full" =~ ^[0-9a-f]{40}$ ]] ||
  stop 1 "O GitHub não entregou o commit $commit do $REPO." \
    "confira o hash na seção \"Referência visual\" do ticket e o acesso do \`gh\` ao repositório, com \`gh auth status\`."

# Baixa numa pasta temporária ao lado, e só troca a referência quando todas as telas chegaram.
tmp="$(mktemp -d "${TMPDIR:-/tmp}/referencia.XXXXXX")" ||
  stop 1 "Não deu para criar uma pasta temporária." "confira o espaço e as permissões da pasta temporária."
trap 'rm -rf "$tmp"' EXIT

for tela in "${telas[@]}"; do
  gh api -H 'Accept: application/vnd.github.raw' "repos/$REPO/contents/$tela.dc.html?ref=$full" \
    >"$tmp/$tela.dc.html" 2>/dev/null ||
    stop 1 "A tela $tela não existe no commit ${full:0:7} do $REPO." \
      "confira o nome da tela na seção \"Referência visual\" do ticket: é o nome do arquivo sem o \`.dc.html\`."
done

{
  printf 'Repositório: %s\n' "$REPO"
  printf 'Commit: %s\n' "$full"
  printf 'Telas:\n'
  printf -- '- %s\n' "${telas[@]}"
} >"$tmp/origem.txt"

mkdir -p "$(dirname "$dir")" &&
  rm -rf "$dir" &&
  mv "$tmp" "$dir" ||
  stop 1 "Não deu para gravar a referência em $dir." "confira as permissões da pasta do ticket."
trap - EXIT

printf 'Referência visual de %s em %s: %s@%s\n' "$ticket" "$dir" "$REPO" "${full:0:7}"
printf -- '- %s\n' "${telas[@]}"
