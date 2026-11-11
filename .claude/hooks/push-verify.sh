#!/usr/bin/env bash
#
# Hook de antes do comando do Claude Code (evento PreToolUse, ferramenta Bash). Nega ao agente cinco
# comandos: o `scripts/verify.sh full` a um subagente, porque o modo completo é de quem fecha a tarefa;
# o `scripts/verify.sh unlock`, que tira a trava do modo completo e é só do usuário; o
# `scripts/verify.sh` com `CI=` ou `GITHUB_ACTIONS=` no comando, que desligaria a trava; o que mexe
# na pasta de estado do harness (`.harness/`), onde ficam a trava e a aprovação; e o `git push`
# que o `scripts/verify.sh prepush` não aprova, porque os commits trazem segredo ou o modo completo
# não aprovou o último commit. As guardas são para um agente que coopera, e não uma barreira de
# segurança.
#
# Sai com 0 para deixar o comando rodar e com 2 para negá-lo. No 2, o que foi escrito na saída de
# erro volta para o agente.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
# A instrução de destravar, a mesma das mensagens do verify.sh (FULL_LOCK_ASK).
# shellcheck source=../../scripts/full-lock.sh
source scripts/full-lock.sh 2>/dev/null
# A leitura do que é mexer na pasta de estado do harness e a das aspas, definidas num lugar só.
# shellcheck source=../../scripts/harness-state-guard.sh
source scripts/harness-state-guard.sh

# Nega o comando com as linhas dadas.
deny() {
  printf '%s\n' "$@" >&2
  exit 2
}

deny_unlock() {
  deny "O comando foi negado: só o usuário destrava o modo completo." "Como resolver: ${FULL_LOCK_ASK:-}"
}

deny_ci() {
  deny "O comando foi negado: \`CI=\` e \`GITHUB_ACTIONS=\` não vão no comando do scripts/verify.sh." \
    "Na máquina, o modo completo conta as reprovações repetidas e trava; essas variáveis desligariam a trava, e o veredito da CI é só da CI. Rode o \`scripts/verify.sh\` sem elas."
}

deny_subagent_full() {
  deny "O comando foi negado: subagente não roda o \`scripts/verify.sh full\`, nem o de algumas apps; o \`full\` é de quem o chamou." \
    "Termine com os testes ligados aos arquivos que mudou, com os comandos do AGENTS.md do projeto, e devolva o resultado dizendo o que rodou (AGENTS.md da raiz, \"Definição de pronto\")."
}

deny_state() {
  deny "O comando foi negado: a pasta de estado do harness (\`.harness/\`) guarda a trava (\`full-lock\`) e a aprovação (\`full-ok\`) do modo completo, e o estado é da verificação, não do agente." \
    "Não leia, não apague e não grave nada nela: quem mexe nesse estado é o scripts/verify.sh. Se o modo completo travou: ${FULL_LOCK_ASK:-}"
}

# Uma atribuição de variável de ambiente na frente de um comando.
assignment='[[:alnum:]_]+=[^[:space:]]*[[:space:]]+'
# A posição de um comando: o começo de uma linha ou depois de `;`, `&`, `|` ou `(`, com variáveis de
# ambiente na frente. Um texto que só cite o comando no meio de uma frase, como a mensagem de um
# commit, não está nessa posição.
at_command=$'(^|[;&|(\n])[[:space:]]*('"$assignment"')*'
# O `verify.sh` seguido do `unlock` em qualquer ponto do comando, e não só na posição de comando, para
# pegar também o que vem embrulhado (`timeout`, `nohup`, `bash -c`, `eval`, um `if`). Uma mensagem
# que cite os dois também é negada: o hook falha fechado.
verify_unlock='verify\.sh.*unlock'
# O modo completo do `verify.sh`, com ou sem apps, em qualquer ponto do comando, como o `unlock`.
verify_full="verify\\.sh[\"']?[[:space:]]+[\"']?full([^[:alnum:]_-]|\$)"
# Uma atribuição da variável CI ou GITHUB_ACTIONS: no começo, depois de um espaço (o que cobre o
# `export` e o `env`) ou depois de `;`, `&`, `|` ou `(`.
ci_assignment='(^|[[:space:];&|(])(CI|GITHUB_ACTIONS)='
# A mesma atribuição em qualquer ponto, para a entrada que o hook não consegue ler.
ci_mention='(^|[^[:alnum:]_])(CI|GITHUB_ACTIONS)='

# O `split_quotes` é do scripts/harness-state-guard.sh.

# Se o comando roda o `verify.sh` com `CI=` ou `GITHUB_ACTIONS=`: a atribuição fora das aspas, com o
# `verify.sh` em qualquer ponto, ou um trecho entre aspas que traga os dois, como o de um `bash -c`.
# Uma atribuição só citada entre aspas, como o padrão de um `grep` ou a mensagem de um commit, não
# conta.
# sets_ci <comando>
sets_ci() {
  local segment
  [[ "$1" == *verify.sh* && "$1" =~ (CI|GITHUB_ACTIONS)= ]] || return 1
  split_quotes "$1"
  [[ "$unquoted" =~ $ci_assignment ]] && return 0
  for segment in "${quoted[@]}"; do
    [[ "$segment" == *verify.sh* && "$segment" =~ $ci_assignment ]] && return 0
  done
  return 1
}
# `git push` como comando, com as opções globais do `git` (`-C <pasta>`, `-c <chave=valor>`,
# `--no-pager`) e então `push`. Não casa com `git stash push`.
git_push="${at_command}git([[:space:]]+(-[Cc][[:space:]]+[^[:space:]]+|--?[[:alnum:]-]+(=[^[:space:]]+)?))*[[:space:]]+push([^[:alnum:]_-]|\$)"

# O hook recebe um JSON pela entrada padrão, com o comando em `tool_input.command`.
input="$(cat)"

# Sem conseguir ler o comando, os padrões acima não servem: no JSON cru, o comando vem depois de
# aspas e com as quebras de linha escapadas. Nesse caso, a menção a cada comando conta como ele, para
# a falha do `jq` não liberá-lo.
if ! command="$(jq -r '.tool_input.command // empty' <<<"$input" 2>/dev/null)"; then
  [[ "$input" =~ $verify_unlock ]] && deny_unlock
  harness_state_in_raw "$input" && deny_state
  [[ "$input" == *verify.sh* && "$input" =~ $ci_mention ]] && deny_ci
  [[ "$input" =~ git.*push ]] || exit 0
  command="git push"
fi

[[ "$command" =~ $verify_unlock ]] && deny_unlock
harness_state_touched "$command" && deny_state
# O Claude Code põe o `agent_id` na entrada quando o comando vem de um subagente.
[[ -n "$(jq -r '.agent_id // empty' <<<"$input" 2>/dev/null)" && "$command" =~ $verify_full ]] &&
  deny_subagent_full
sets_ci "$command" && deny_ci
[[ "$command" =~ $git_push ]] || exit 0

# Apagar uma branch remota não envia código. Só vale para um comando sozinho: num comando
# composto, o `--delete` de um push não pode liberar outro push que venha junto.
if [[ "$command" != *[$';&|\n']* && "$command" =~ [[:space:]]--delete([[:space:]]|$) ]]; then
  exit 0
fi

output="$(scripts/verify.sh prepush 2>&1)" && exit 0

deny "O push foi negado: a verificação de antes do push não passou." \
  "Não contorne o bloqueio. Se o push sem verificação for mesmo necessário, quem o faz é o usuário, no terminal." \
  "" \
  "$(echo "$output" | tail -n 40)"
