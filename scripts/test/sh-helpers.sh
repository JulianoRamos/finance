# Auxiliares das suítes em shell do harness (a dos hooks e a da trava do modo completo): o contador de
# casos que falharam e a saída `ok:` ou `FALHOU:` de cada um. Cada suíte os carrega com `source`.

failed=0

# Um caso que passa quando a condição sai com 0.
# check <nome> <condição...>
check() {
  local name="$1"
  shift
  if "$@"; then
    echo "ok: $name"
  else
    echo "FALHOU: $name"
    failed=$((failed + 1))
  fi
}

# Um caso de hook: roda o hook com a entrada dada e confere o código de saída e um trecho da saída de
# erro, que é o que volta para o agente.
# expect_hook <hook> <código esperado> <nome> <entrada> [trecho esperado na saída de erro]
expect_hook() {
  local hook="$1" want="$2" name="$3" input="$4" text="${5:-}" got err
  err="$("$hook" <<<"$input" 2>&1 >/dev/null)"
  got=$?
  if [[ $got -ne $want || "$err" != *"$text"* ]]; then
    echo "FALHOU: $name (saída $got, esperava $want; erro: $err)"
    failed=$((failed + 1))
  else
    echo "ok: $name"
  fi
}

# O fim da suíte: sai com 1, dizendo quantos casos falharam, se algum falhou.
# finish <o que a suíte testa>
finish() {
  [[ $failed -eq 0 ]] || {
    echo "$failed teste(s) $1 falharam."
    exit 1
  }
}
