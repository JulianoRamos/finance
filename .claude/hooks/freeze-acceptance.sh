#!/usr/bin/env bash
#
# Hook de antes da edição do Claude Code (evento PreToolUse, ferramentas de edição de arquivo).
# O arquivo de aceite de um ticket fica congelado depois do commit de plano: quando o agente vai
# editar um docs/tickets/<issue>/<ticket>/aceite.md que já está em commit, nega a edição. Criar um arquivo
# de aceite novo e editar qualquer outro arquivo, inclusive os outros da pasta do ticket, continuam
# liberados.
#
# Sai com 0 para deixar a edição rodar e com 2 para negá-la. No 2, o que foi escrito na saída de
# erro volta para o agente.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

# O hook recebe um JSON pela entrada padrão, com o arquivo em `tool_input.file_path` (ou em
# `tool_input.notebook_path`, no NotebookEdit).
input="$(cat)"

# O arquivo de aceite de um ticket, a partir da raiz do projeto.
ACCEPTANCE='^docs/tickets/[^/]+/[^/]+/aceite\.md$'
# O mesmo arquivo citado em qualquer ponto de um texto, para a entrada ilegível.
MENTION='docs/tickets/[^/[:space:]"]+/[^/[:space:]"]+/aceite\.md'
# O de antes da pasta da issue pai, de um nível só: continua congelado, e a mensagem diz onde ele fica.
OLD_ACCEPTANCE='^docs/tickets/[^/]+/aceite\.md$'
OLD_MENTION='docs/tickets/[^/[:space:]"]+/aceite\.md'

deny() {
  {
    echo "A edição foi negada: $1 está congelado desde o commit de plano."
    echo "Descongelar é do usuário, no editor ou no terminal. Não contorne o bloqueio: se o critério mudou de verdade, peça ao usuário que edite o arquivo de aceite."
  } >&2
  exit 2
}

file="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input" 2>/dev/null)" || file=""

# Sem conseguir ler o arquivo, qualquer menção a um arquivo de aceite conta como edição de aceite
# versionado, para a falha do `jq` não liberar a edição.
if [[ -z "$file" ]]; then
  [[ "$input" =~ $MENTION || "$input" =~ $OLD_MENTION ]] && deny "o arquivo de aceite citado na entrada"
  exit 0
fi

# O caminho a partir da raiz do projeto, sem `.` nem `..`, resolvido só no texto, como o `realpath -m`
# do GNU, que o macOS não tem. A raiz vale como a sessão a vê ($PWD) e com os links resolvidos (`pwd
# -P`). Um caminho fora da raiz falha, e um que sobe acima da `/` também.
# relative_path <caminho>
relative_path() {
  local path="$1" part root
  local -a parts=() out=()
  [[ "$path" == /* ]] || path="$PWD/$path"
  IFS=/ read -r -a parts <<<"$path"
  for part in "${parts[@]}"; do
    case "$part" in
      '' | .) ;;
      ..) [[ ${#out[@]} -gt 0 ]] || return 1; unset 'out[${#out[@]}-1]' ;;
      *) out+=("$part") ;;
    esac
  done
  path="/$(IFS=/; echo "${out[*]}")"
  for root in "$PWD" "$(pwd -P)"; do
    if [[ "$path" == "$root" ]]; then echo .; return 0; fi
    if [[ "$path" == "$root"/* ]]; then echo "${path#"$root"/}"; return 0; fi
  done
  # Fora da raiz: não é um arquivo de aceite do projeto.
  echo "$path"
}

# Se o caminho não pode ser normalizado, vale a mesma regra da entrada ilegível.
relative="$(relative_path "$file")" || {
  [[ "$file" =~ $MENTION || "$file" =~ $OLD_MENTION ]] && deny "o arquivo de aceite citado na entrada"
  exit 0
}
if [[ "$relative" =~ $OLD_ACCEPTANCE ]]; then
  git cat-file -e "HEAD:$relative" 2>/dev/null &&
    deny "$relative, no caminho antigo (mova-o para docs/tickets/<issue>/<ticket>/, com um commit do usuário)"
  exit 0
fi
[[ "$relative" =~ $ACCEPTANCE ]] || exit 0

# Só o que já está em commit está congelado: o arquivo novo do plano em andamento é liberado.
git cat-file -e "HEAD:$relative" 2>/dev/null && deny "$relative"
exit 0
