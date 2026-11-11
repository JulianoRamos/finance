# A trava do modo completo contra a mesma reprovação repetida. Quem carrega estas funções é o
# scripts/verify.sh, que define FULL_LOCK_FILE, o arquivo do estado, na pasta do harness, e o hook
# .claude/hooks/push-verify.sh, que usa só a instrução de destravar.
#
# A mesma falha é o mesmo conjunto de passos reprovados, seja qual for o teste que falhou dentro
# deles. A contagem atravessa as sessões e só zera com uma aprovação ou com o `unlock`, que é do
# usuário. Quem chama confere o `full_lock_enabled` antes de contar ou recusar: na CI, a trava não
# vale.
#
# O estado é um arquivo de texto: na primeira linha, quantas reprovações iguais seguidas houve, e nas
# outras, os passos dessa reprovação, um por linha, em ordem.

# Na terceira reprovação igual seguida, o modo completo trava.
FULL_LOCK_LIMIT=3

# O que fazer com o modo completo travado, para as mensagens do verify.sh e do hook.
FULL_LOCK_ASK='pare e peça ao usuário que examine a falha e rode `! scripts/verify.sh unlock` no prompt. Só ele destrava: não destrave nem contorne a trava.'

# Se a trava vale: fora da CI (a variável CI vazia). Na CI, o veredito é a CI.
full_lock_enabled() {
  [[ -z "${CI:-}" ]]
}

# Quantas reprovações iguais seguidas o estado registra; 0 sem estado ou com um estado ilegível.
full_lock_count() {
  local count
  count="$(sed -n 1p "$FULL_LOCK_FILE" 2>/dev/null)"
  [[ "$count" =~ ^[0-9]+$ ]] || count=0
  printf '%s' "$count"
}

# Se o modo completo está travado e tem de recusar.
full_lock_active() {
  [[ "$(full_lock_count)" -ge $FULL_LOCK_LIMIT ]]
}

# Registra uma reprovação com os passos dados e imprime quantas reprovações iguais seguidas há,
# contando esta.
# full_lock_record_failure <passo...>
full_lock_record_failure() {
  local steps previous count=1
  steps="$(printf '%s\n' "$@" | LC_ALL=C sort -u)"
  previous="$(sed 1d "$FULL_LOCK_FILE" 2>/dev/null)"
  if [[ -f "$FULL_LOCK_FILE" && "$previous" == "$steps" ]]; then
    count=$(($(full_lock_count) + 1))
  fi
  mkdir -p "$(dirname "$FULL_LOCK_FILE")" &&
    printf '%s\n%s\n' "$count" "$steps" >"$FULL_LOCK_FILE"
  printf '%s' "$count"
}

# Zera a contagem e tira a trava: numa aprovação e no `unlock` do usuário.
full_lock_reset() {
  rm -f "$FULL_LOCK_FILE"
}
