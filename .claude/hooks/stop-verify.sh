#!/usr/bin/env bash
#
# Hook de fim de turno do Claude Code (evento Stop). Quando o agente tenta encerrar o turno, roda
# o modo rápido do scripts/verify.sh nas apps em que a sessão dele editou arquivos. Quem anota esses
# arquivos, por sessão, é o record-touched.sh. Cada sessão só responde pelos arquivos dela: o erro
# que outra sessão deixou no mesmo clone não bloqueia este turno, só avisa. Se falhar num arquivo da
# sessão, devolve a saída ao agente, que continua o trabalho. A edição por shell não é anotada,
# então ela não entra nessa conta.
#
# Sai com 0 para deixar o turno encerrar e com 2 para bloquear. No 2, o que foi escrito na
# saída de erro volta para o agente.
#
# A variável HARNESS_VERIFY troca o scripts/verify.sh, e só os testes do hook a usam: ela só vale
# com a HARNESS_TEST=1, que os testes também definem.

set -uo pipefail

# Sem a pasta de estado do harness (a raiz do projeto não se alcança), nada pode ser anotado nem
# conferido. Não bloqueia, mas não passa calado: o aviso diz que a verificação não rodou.
STATE_UNAVAILABLE="Hook de fim de turno: a pasta de estado do harness não está disponível (a raiz do projeto não se alcança), então nada foi verificado. O modo completo do verify.sh confere a árvore inteira."
state_unavailable() {
  jq -n --arg message "$STATE_UNAVAILABLE" '{systemMessage: $message}' 2>/dev/null ||
    printf '{"systemMessage": "%s"}\n' "$STATE_UNAVAILABLE"
  exit 0
}

# shellcheck source=../../scripts/harness-dir.sh
source "${0%/*}/../../scripts/harness-dir.sh"
[[ -n "$HARNESS_DIR" ]] || state_unavailable
cd "${HARNESS_DIR%/.harness}" || state_unavailable

# Depois de tantos bloqueios seguidos, o hook deixa o turno encerrar e avisa o usuário,
# para um erro que o agente não consegue corrigir não virar um laço sem fim.
MAX_BLOCKS=3
VERIFY="scripts/verify.sh"
[[ "${HARNESS_TEST:-}" == 1 && -n "${HARNESS_VERIFY:-}" ]] && VERIFY="$HARNESS_VERIFY"

# Sem a sessão, ou sem o `jq` para lê-la, nada foi anotado nem pode ser conferido. Não bloqueia, mas
# também não passa calado: o aviso diz que a verificação não rodou.
UNATTRIBUTABLE="Hook de fim de turno: não foi possível atribuir a sessão (identificador ausente, inválido ou sem o jq na máquina), então nada foi verificado. O modo completo do verify.sh confere a árvore inteira."
unattributable() {
  jq -n --arg message "$UNATTRIBUTABLE" '{systemMessage: $message}' 2>/dev/null ||
    printf '{"systemMessage": "%s"}\n' "$UNATTRIBUTABLE"
  exit 0
}

# O hook recebe um JSON pela entrada padrão. Só o identificador da sessão interessa, e ele entra no
# nome dos arquivos de estado, então só vale com letras, dígitos, `_` e `-`.
command -v jq >/dev/null 2>&1 || unattributable
session="$(jq -r '.session_id | select(type == "string" and test("\\A[A-Za-z0-9_-]+\\z"))' 2>/dev/null || true)"
[[ "$session" =~ ^[A-Za-z0-9_-]+$ ]] || unattributable

state_dir="$HARNESS_DIR"
mkdir -p "$state_dir"
blocks_file="$state_dir/stop-blocks-$session"
touched_file="$state_dir/touched-$session"

# A data do registro é a do último uso: a sessão em uso não some na limpeza.
[[ -s "$touched_file" ]] && touch "$touched_file"

# Os estados com mais de sete dias são de sessões que acabaram.
find "$state_dir" -maxdepth 1 -type f \( -name 'touched-*' -o -name 'fast-ok-*' -o -name 'stop-blocks-*' \) -mtime +7 -delete 2>/dev/null

# Sem arquivo anotado pela sessão, não há o que verificar: o turno encerra sem rodar nada.
if [[ ! -s "$touched_file" ]]; then
  rm -f "$blocks_file"
  exit 0
fi

# Bloqueia o encerramento e devolve a mensagem ao agente, até o limite de MAX_BLOCKS.
#   block <resumo de uma linha> <como resolver, em uma linha> <detalhe para o agente>
block() {
  local summary="$1" fix="$2" detail="$3"
  local blocks=$(($(cat "$blocks_file" 2>/dev/null || echo 0) + 1))

  if [[ $blocks -gt $MAX_BLOCKS ]]; then
    rm -f "$blocks_file"
    # O `jq` escapa o que vier nas mensagens, como o nome de uma referência do Git.
    jq -n \
      --arg message "Hook de fim de turno: $summary, mesmo depois de $MAX_BLOCKS tentativas de correção. O agente encerrou o turno sem resolver. $fix" \
      '{systemMessage: $message}' ||
      printf '{"systemMessage": "Hook de fim de turno: a verificação continua falhando, e o agente encerrou o turno sem resolver."}\n'
    exit 0
  fi

  echo "$blocks" >"$blocks_file"
  {
    echo "O turno não pode encerrar: $summary (tentativa $blocks de $MAX_BLOCKS)."
    echo "Como resolver: $fix"
    [[ -n "$detail" ]] && echo "$detail"
  } >&2
  exit 2
}

# Os arquivos que a sessão anotou nesta app, só os que ainda existem, ordenados e sem repetição.
touched_in() {
  local file
  [[ -f "$touched_file" ]] || return 0
  while IFS= read -r file; do
    [[ -f "$file" ]] && printf '%s\n' "$file"
  done < <(awk -v prefix="apps/$1/" 'index($0, prefix) == 1' "$touched_file" | sort -u)
}

# Resumo do conteúdo dos arquivos que a sessão anotou na app. Se ele é o mesmo da última verificação
# aprovada, não há o que verificar de novo. Um arquivo por vez, sem o `xargs -d` do GNU, que o macOS
# não tem.
fingerprint() {
  local file
  touched_in "$1" | while IFS= read -r file; do sha256sum -- "$file"; done | sha256sum | cut -d' ' -f1
}


# Sem a lista, nenhuma app seria verificada e o turno passaria calado. Por isso a falha bloqueia.
apps="$("$VERIFY" apps)" ||
  block "não deu para ler a lista de apps do scripts/verify.sh" \
    "Rode \`scripts/verify.sh apps\` e corrija o erro." \
    ""

projects=()
for project in $apps; do
  [[ -z "$(touched_in "$project")" ]] && continue
  [[ "$(cat "$state_dir/fast-ok-$session-$project" 2>/dev/null)" == "$(fingerprint "$project")" ]] && continue
  projects+=("$project")
done

if [[ ${#projects[@]} -eq 0 ]]; then
  rm -f "$blocks_file"
  exit 0
fi

output="$("$VERIFY" fast "${projects[@]}" 2>&1)"
status=$?

if [[ $status -eq 0 ]]; then
  for project in "${projects[@]}"; do
    fingerprint "$project" >"$state_dir/fast-ok-$session-$project"
  done
  rm -f "$blocks_file"
  exit 0
fi

# Os caminhos dos ERROS (avisos não contam) de um trecho da saída, como a ferramenta os escreve, só
# para os passos de formato conhecido. Os demais (testes, build, tipos de rota) não dão caminho, e a
# falha deles bloqueia. Relativos à pasta da app, ou absolutos no contêiner, onde a app fica em /app.
#   error_paths <nome do passo> <trecho da saída>
# - `tipos` (tsc): `caminho(linha,coluna): error TS...`; o sufixo `(linha,coluna): error TS` delimita o caminho, que pode ter parênteses (grupos de rota do Next.js, `app/(auth)/...`)
# - `lint` (oxlint): um bloco que começa com `x ` é erro, e `!` é aviso; o caminho vem em `,-[caminho:linha:coluna]`
# - `lint` (eslint): o caminho sozinho na linha, e depois os problemas dele, `linha:coluna  error` ou `warning`
# Limite: caminho com espaço não é reconhecido, e a falha dele bloqueia por não ter atribuição.
error_paths() {
  case "${1#*: }" in
    tipos) sed -nE 's/^(.+)\([0-9]+,[0-9]+\): error TS[0-9]+:.*/\1/p' <<<"$2" ;;
    lint)
      awk '
        /^ +x /  { err = 1; next }
        /^ +! /  { err = 0; next }
        /^ *,-\[/ {
          if (err) { path = $0; sub(/^ *,-\[/, "", path); sub(/:[0-9]+:[0-9]+\].*$/, "", path); print path }
          next
        }
        /^\/?[^ ]+\.(ts|tsx|js|jsx|mjs|cjs)$/ { file = $0; next }
        /^ +[0-9]+:[0-9]+ +error / { if (file != "") print file }
      ' <<<"$2"
      ;;
  esac | sed -E 's#^/app/##; s#^\./##' | sort -u
}

# Diz se o passo de tipos traz um diagnóstico global, `error TSnnnn:` sem o prefixo `caminho(linha,coluna):`
# (como o TS2688). Ele não é de arquivo nenhum, e vale mesmo que haja erros com caminho no mesmo passo.
#   has_pathless_error <nome do passo> <trecho da saída>
has_pathless_error() {
  [[ "${1#*: }" == tipos ]] && grep -qE '^ *error TS[0-9]+:' <<<"$2"
}

# Os nomes dos passos que falharam, do resumo `REPROVADO` no fim da saída.
failed_steps() {
  sed -n '/^REPROVADO/,$p' <<<"$output" | sed -n 's/^- //p'
}

# O trecho da saída de um passo, do `=== nome` até o próximo.
step_output() {
  awk -v header="=== $1" '/^=== /{ on = ($0 == header) } on' <<<"$output"
}

# Diz se algum erro está num arquivo que a sessão anotou, ou se uma falha não tem arquivo a que
# atribuí-la. Um passo que falhou sem caminho de erro conta como bloqueio, para não passar uma falha
# que ninguém sabe de quem é. Imprime o motivo e sai com 0 quando é para bloquear.
blocking_reason() {
  local step path project steps paths
  steps="$(failed_steps)"
  [[ -z "$steps" ]] && { echo "não deu para atribuir a falha a um arquivo, porque a saída não traz o resumo dos passos que falharam"; return 0; }
  while IFS= read -r step; do
    # O prefixo do nome do passo (`API:`, `Web:`) diz de qual app é o erro, e o caminho só vale nela.
    project="${step%%:*}"
    project="${project,,}"
    [[ " ${projects[*]} " == *" $project "* ]] || { echo "não deu para atribuir o passo \"$step\" a uma app verificada"; return 0; }
    local out
    out="$(step_output "$step")"
    has_pathless_error "$step" "$out" && { echo "o passo \"$step\" traz um diagnóstico global, sem arquivo"; return 0; }
    paths="$(error_paths "$step" "$out")"
    [[ -z "$paths" ]] && { echo "não deu para atribuir a falha do passo \"$step\" a um arquivo"; return 0; }
    while IFS= read -r path; do
      grep -qxF -- "apps/$project/$path" "$touched_file" && { echo "há erro em arquivo que a sessão editou"; return 0; }
    done <<<"$paths"
  done <<<"$steps"
  return 1
}

if reason="$(blocking_reason)"; then
  # O fim da saída traz o resumo do que falhou e como corrigir.
  block "a verificação rápida de ${projects[*]} não passou" \
    "Rode \`scripts/verify.sh fast ${projects[*]}\` para ver o erro." \
    "Leia a saída abaixo, corrija a causa e só então encerre. Não contorne a verificação.
Motivo do bloqueio: $reason.

$(echo "$output" | tail -n 80)"
fi

# Todos os erros estão em arquivos que a sessão não editou: de outra sessão no mesmo clone, ou de um
# arquivo que depende do que esta sessão mudou. Não bloqueia, e a aprovação não é gravada.
rm -f "$blocks_file"
jq -n \
  --arg message "Hook de fim de turno: a verificação rápida de ${projects[*]} falhou só em arquivos que esta sessão não tocou. Podem ser de outra sessão no mesmo clone, ou de um arquivo que depende do que você mudou. O turno encerrou, e o modo completo do verify.sh confere esses arquivos." \
  '{systemMessage: $message}' ||
  printf '{"systemMessage": "Hook de fim de turno: a verificação rápida falhou só em arquivos que esta sessão não tocou. O modo completo confere esses arquivos."}\n'
exit 0
