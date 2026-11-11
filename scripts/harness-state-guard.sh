# A definição única do que conta como "mexer na pasta de estado do harness" num comando de shell: os
# padrões e a leitura das aspas e dos heredocs. Quem carrega este arquivo com `source` é o hook
# .claude/hooks/push-verify.sh (o comando do shell). A regra é a do hook, e o que ela deixa passar de propósito
# está nos testes dele.

# A pasta de estado como componente de caminho (`.harness`, `.harness/x`, `/.harness`, `./.harness`),
# mas não `.harness-x`, `x.harness` nem `\.harness` (o ponto escapado de um padrão de busca).
HARNESS_STATE_PATH='(^|[^[:alnum:]_.\\-])\.harness([^[:alnum:]_.-]|$)'
# Os arquivos de estado da pasta antiga, dentro do Git, e os da atual.
HARNESS_STATE_FILES='\.git/harness/full-|\.harness/full-'
# Uma expansão (`$(...)`, `${...}`, crases) seguida da pasta de estado, como o
# `"$(git rev-parse --show-toplevel)/.harness/full-lock"`: entre aspas, tem espaços e não parece um
# caminho, mas o shell o monta como um.
HARNESS_STATE_EXPANDED='[)}`]/\.harness([/]|$)'
# O começo de um heredoc (`<<PALAVRA`, `<<-PALAVRA`, `<< 'PALAVRA'`), mas não o de um `<<<`; a palavra é o
# segundo grupo.
HARNESS_HEREDOC='(^|[^<])[<][<]-?[[:space:]]*["'"'"'\\]?([A-Za-z_][A-Za-z0-9_]*)'
# Um interpretador que roda o texto de um argumento como comando (`bash -c '...'`, `eval '...'`).
HARNESS_RUNNER='(^|[[:space:];&|(])(eval|bash|sh|zsh|dash)([[:space:]]|$)'

# Separa o comando no texto fora das aspas, em `unquoted`, e no conteúdo de cada trecho entre aspas
# simples ou duplas, em `quoted`. Cada trecho entre aspas vira um espaço no texto de fora.
# split_quotes <comando>
split_quotes() {
  local text="$1" char quote="" segment="" i
  unquoted=""
  quoted=()
  for ((i = 0; i < ${#text}; i++)); do
    char="${text:i:1}"
    if [[ -z "$quote" ]]; then
      case "$char" in
        "'" | '"') quote="$char" segment="" unquoted+=" " ;;
        '\') unquoted+="$char${text:i+1:1}" i=$((i + 1)) ;;
        *) unquoted+="$char" ;;
      esac
    elif [[ "$char" == "$quote" ]]; then
      quoted+=("$segment")
      quote=""
    elif [[ "$quote" == '"' && "$char" == '\' ]]; then
      segment+="$char${text:i+1:1}"
      i=$((i + 1))
    else
      segment+="$char"
    fi
  done
  [[ -z "$quote" ]] || quoted+=("$segment")
}

# O comando sem o corpo dos heredocs: cada linha de `<<PALAVRA` (ou `<<-`, com a palavra entre aspas
# ou não) fica, e as seguintes saem até a linha que é só a palavra. O corpo é texto, como a mensagem
# de um commit, e não comando. Não confunde `<<<`.
# strip_heredocs <comando>
strip_heredocs() {
  local line word="" out=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -n "$word" ]]; then
      line="${line#"${line%%[!$'\t']*}"}"
      [[ "$line" == "$word" ]] && word=""
      continue
    fi
    out+="$line"$'\n'
    [[ "$line" =~ $HARNESS_HEREDOC ]] && word="${BASH_REMATCH[2]}"
  done <<<"$1"
  printf '%s' "$out"
}

# Se o texto traz a pasta de estado, como caminho ou como um dos arquivos dela.
# state_path_in <texto>
state_path_in() {
  [[ "$1" =~ $HARNESS_STATE_PATH || "$1" =~ $HARNESS_STATE_FILES ]]
}

# Se o comando de shell mexe na pasta de estado do harness. Vale a pasta citada fora das aspas, e entre
# aspas só quando o trecho é ele mesmo um caminho até ela (sem espaços, ou com uma expansão que a monta).
# A mensagem de um commit ou de um PR, o padrão de um `grep` e o corpo de um heredoc, que só a citam
# como texto, passam. O texto de um `bash -c` ou `eval` é um comando, e é conferido por inteiro.
# harness_state_touched <comando>
harness_state_touched() {
  local command segment
  # As variáveis do split_quotes são de quem chama: o comando de dentro de um `bash -c` as reescreve,
  # então cada nível guarda os seus trechos antes da recursão.
  local -a segments
  command="$(strip_heredocs "$1")"
  split_quotes "$command"
  state_path_in "$unquoted" && return 0
  segments=("${quoted[@]}")
  local runs=no
  [[ "$unquoted" =~ $HARNESS_RUNNER ]] && runs=yes
  for segment in "${segments[@]}"; do
    [[ "$segment" =~ $HARNESS_STATE_EXPANDED ]] && return 0
    if [[ "$segment" != *[[:space:]]* ]]; then
      state_path_in "$segment" && return 0
    elif [[ $runs == yes ]]; then
      harness_state_touched "$segment" && return 0
    fi
  done
  return 1
}

# Se uma entrada que não se leu como JSON cita a pasta de estado em qualquer ponto: sem poder separar o
# comando do resto, qualquer citação conta, para a falha do `jq` não liberar o comando.
# harness_state_in_raw <texto>
harness_state_in_raw() {
  state_path_in "$1"
}
