#!/usr/bin/env bash
#
# Testes do hook .claude/hooks/stop-verify.sh, pela entrada que o Claude Code entrega a ele (um JSON
# pela entrada padrão) e pela decisão que ele devolve (0 deixa encerrar, 2 bloqueia). O hook roda
# num repositório temporário, com o `scripts/verify.sh` trocado por um falso (variável
# HARNESS_VERIFY), que registra o que rodou e imprime a saída combinada pelo teste: nenhum contêiner
# nem o estado deste clone entra no caso. Rodam na máquina, como o hook, porque ele usa o `git` e o
# `jq`, que o contêiner `harness` não tem. Quem chama é o scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/.claude/hooks/stop-verify.sh"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

for tool in git jq; do
  command -v "$tool" >/dev/null || { echo "Falta o \`$tool\` na máquina: o hook e o teste dele precisam dele."; exit 2; }
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
project="$work/repo"
mkdir -p "$project/apps/api/src" "$project/apps/web/src"
git -C "$project" init -q
state_dir="$(git -C "$project" rev-parse --show-toplevel)/.harness"

# O verify.sh falso: `apps` lista as duas apps, e `fast` anota a chamada e imprime o conteúdo do
# arquivo FAKE_OUTPUT, saindo com 1 se ele tem algo.
fake="$work/verify.sh"
cat >"$fake" <<'FAKE'
#!/usr/bin/env bash
case "$1" in
  apps) printf 'api\nweb\n' ;;
  fast)
    echo "$*" >>"$FAKE_LOG"
    if [[ -s "$FAKE_OUTPUT" ]]; then cat "$FAKE_OUTPUT"; exit 1; fi
    ;;
esac
FAKE
chmod +x "$fake"
# O HARNESS_VERIFY só vale com o HARNESS_TEST=1: é um ponto de troca dos testes.
export CLAUDE_PROJECT_DIR="$project" HARNESS_TEST=1 HARNESS_VERIFY="$fake" FAKE_LOG="$work/log" FAKE_OUTPUT="$work/output"

echo "export const a = 1;" >"$project/apps/api/src/a.ts"
echo "export const b = 1;" >"$project/apps/api/src/b.ts"
echo "export const w = 1;" >"$project/apps/web/src/w.tsx"

# touch_file <sessão> <arquivo>: o que o hook que anota os arquivos grava.
touch_file() {
  mkdir -p "$state_dir"
  echo "$2" >>"$state_dir/touched-$1"
}

# set_output <texto>: a saída que o `fast` falso imprime. Sem texto, ele passa.
set_output() {
  printf '%s' "${1:-}" >"$FAKE_OUTPUT"
}

# Duas falhas no formato do verify.sh: o passo, a linha do erro e o resumo no fim.
tsc_failure() {
  printf '\n=== API: tipos\n%s\n\nREPROVADO: 1 verificação(ões) falharam.\n- API: tipos\n    Como corrigir: corrija.\n' "$1"
}

# stop_raw <JSON>: roda o hook com essa entrada e guarda o código, a saída padrão e a de erro.
stop_raw() {
  : >"$FAKE_LOG"
  code=0
  out="$work/stdout"
  err="$work/stderr"
  "$HOOK" <<<"$1" >"$out" 2>"$err" || code=$?
  out="$(cat "$out")"
  err="$(cat "$err")"
}

# stop <sessão>
stop() {
  stop_raw "{\"session_id\":\"$1\"}"
}

# expect_stop <nome> <código esperado> <"roda"|"não roda"> [trecho esperado na saída de erro ou padrão]
expect_stop() {
  local name="$1" want="$2" ran="$3" text="${4:-}" got_ran="não roda"
  [[ -s "$FAKE_LOG" ]] && got_ran="roda"
  if [[ $code -ne $want || "$got_ran" != "$ran" || "$err$out" != *"$text"* ]]; then
    echo "FALHOU: $name (saída $code, esperava $want; $got_ran, esperava $ran; erro: $err; saída: $out)"
    failed=$((failed + 1))
  else
    echo "ok: $name"
  fi
}

# --- Sessão B não registrou arquivo, e a A deixou um erro ---
touch_file A apps/api/src/a.ts
set_output "$(tsc_failure 'src/a.ts(1,14): error TS2322: tipo errado.')"

stop B
expect_stop "a sessão sem arquivo registrado sai na hora, sem rodar a verificação" 0 "não roda"

# --- A sessão B registrou outro arquivo da mesma app ---
touch_file B apps/api/src/b.ts
stop B
expect_stop "o erro só em arquivo de outra sessão não bloqueia e avisa" 0 "roda" "systemMessage"
check "o aviso diz que o modo completo confere os arquivos que a sessão não tocou" \
  grep -q "não tocou" <<<"$out"
check "o aviso não grava a aprovação" test ! -e "$state_dir/fast-ok-B-api"

# --- A sessão A, dona do erro ---
stop A
expect_stop "o erro em arquivo registrado pela sessão bloqueia, no formato de sempre" 2 "roda" \
  "O turno não pode encerrar: a verificação rápida de api não passou (tentativa 1 de 3)."
rm -f "$state_dir"/stop-blocks-*

# --- Formatos das ferramentas: oxlint, eslint e a falha sem caminho ---
oxlint_failure() {
  printf '\n=== API: lint\n  x typescript(no-floating-promises): promessa solta\n   ,-[%s:3:5]\n\nREPROVADO: 1 verificação(ões) falharam.\n- API: lint\n    Como corrigir: corrija.\n' "$1"
}
eslint_failure() {
  printf '\n=== Web: lint\n%s\n  3:5  error  variável sem uso  @typescript-eslint/no-unused-vars\n\nREPROVADO: 1 verificação(ões) falharam.\n- Web: lint\n    Como corrigir: corrija.\n' "$1"
}

set_output "$(oxlint_failure src/a.ts)"
stop A
expect_stop "reconhece o caminho do erro do oxlint" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*

stop B
expect_stop "o erro do oxlint em arquivo de outra sessão não bloqueia" 0 "roda" "systemMessage"

touch_file C apps/web/src/w.tsx
set_output "$(eslint_failure /app/src/w.tsx)"
stop C
expect_stop "reconhece o caminho do erro do eslint, que vem absoluto no contêiner" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*

set_output "$(printf '\n=== Web: tipos de rota\nnext: erro sem caminho\n\nREPROVADO: 1 verificação(ões) falharam.\n- Web: tipos de rota\n    Como corrigir: veja.\n')"
stop C
expect_stop "a falha sem caminho bloqueia, e o hook diz que não deu para atribuí-la a um arquivo" 2 "roda" \
  "não deu para atribuir"
rm -f "$state_dir"/stop-blocks-*

set_output "algo falhou sem o resumo do verify.sh"
stop C
expect_stop "a saída sem o resumo das falhas também bloqueia" 2 "roda" "não deu para atribuir"
rm -f "$state_dir"/stop-blocks-*

# --- A aprovação por sessão e por conteúdo ---
set_output ""
stop A
expect_stop "a verificação que passa deixa o turno encerrar" 0 "roda"
check "a aprovação é da sessão e da app" test -s "$state_dir/fast-ok-A-api"

stop A
expect_stop "o conteúdo igual ao da última aprovação não roda de novo" 0 "não roda"

echo "export const a = 2;" >"$project/apps/api/src/a.ts"
stop A
expect_stop "o conteúdo do arquivo registrado que mudou roda de novo" 0 "roda"

echo "export const b = 2;" >"$project/apps/api/src/b.ts"
stop A
expect_stop "a mudança num arquivo que a sessão não registrou não roda de novo" 0 "não roda"

rm -f "$project/apps/api/src/a.ts"
stop A
expect_stop "o arquivo registrado que deixou de existir sai da conta e não roda" 0 "não roda"

# --- A limpeza dos estados com mais de sete dias ---
# A data antiga vai no formato do `touch -t`, que o GNU e o macOS aceitam.
touch_file D apps/api/src/b.ts
echo x >"$state_dir/fast-ok-velho-api"
echo 2 >"$state_dir/stop-blocks-velho"
touch -t 200001010000 "$state_dir/touched-velho" "$state_dir/fast-ok-velho-api" "$state_dir/stop-blocks-velho"
echo x >"$state_dir/touched-novo"
echo x >"$state_dir/full-ok"
touch -t 200001010000 "$state_dir/full-ok"
touch -t 200001010000 "$state_dir/touched-D"
stop D
check "apaga o registro, a aprovação e o contador de bloqueios com mais de sete dias" \
  bash -c '[[ ! -e "$1/touched-velho" && ! -e "$1/fast-ok-velho-api" && ! -e "$1/stop-blocks-velho" ]]' _ "$state_dir"
check "guarda o registro recente e o que não é do hook" \
  bash -c '[[ -e "$1/touched-novo" && -e "$1/full-ok" ]]' _ "$state_dir"
check "o registro da sessão que está em uso sobrevive, e a data dele é a do último uso" \
  bash -c '[[ -n "$(find "$1/touched-D" -mmin -5)" ]]' _ "$state_dir"

# --- Caminho com parênteses (grupos de rota do Next.js) e diagnóstico global do tsc ---
mkdir -p "$project/apps/web/app/(auth)/entrar"
echo "export default 1;" >"$project/apps/web/app/(auth)/entrar/page.tsx"
web_tsc_failure() {
  printf '\n=== Web: tipos\n%s\n\nREPROVADO: 1 verificação(ões) falharam.\n- Web: tipos\n    Como corrigir: corrija.\n' "$1"
}
touch_file G "apps/web/app/(auth)/entrar/page.tsx"
touch_file H apps/web/src/w.tsx
route_error='app/(auth)/entrar/page.tsx(2,3): error TS2322: tipo errado.'
set_output "$(web_tsc_failure "$route_error")"
stop G
expect_stop "o erro em caminho com grupo de rota (parênteses) bloqueia a sessão que o editou" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*
stop H
expect_stop "o erro em caminho com grupo de rota avisa a sessão que não o editou" 0 "roda" "systemMessage"
set_output "$(web_tsc_failure "$route_error
src/w.tsx(1,1): error TS2322: tipo errado.")"
stop G
expect_stop "o erro do grupo de rota bloqueia mesmo com erro reconhecido em outro arquivo" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*

set_output "$(web_tsc_failure 'error TS2688: Cannot find type definition file for vitest.')"
stop H
expect_stop "o diagnóstico global do tsc, sem caminho, bloqueia" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*
set_output "$(web_tsc_failure 'error TS2688: Cannot find type definition file for vitest.
src/other.ts(1,1): error TS2322: tipo errado.')"
stop H
expect_stop "o diagnóstico global junto com erro em arquivo de outra sessão ainda bloqueia" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*

# --- Cada passo que falhou vale só para a app dele ---
echo "export const x = 1;" >"$project/apps/api/src/x.ts"
echo "export const x = 1;" >"$project/apps/web/src/x.ts"
touch_file E apps/web/src/x.ts
touch_file E apps/api/src/b.ts
set_output "$(tsc_failure 'src/x.ts(1,14): error TS2322: tipo errado.')"
stop E
expect_stop "o erro da API em src/x.ts não é atribuído ao src/x.ts da web" 0 "roda" "systemMessage"
check "as duas apps foram verificadas" grep -q "fast api web" "$FAKE_LOG"

touch_file E apps/api/src/x.ts
stop E
expect_stop "o erro da API no arquivo da API que a sessão editou bloqueia" 2 "roda" "tentativa 1 de 3"
rm -f "$state_dir"/stop-blocks-*

# --- Só erro conta, aviso não ---
echo "export const a = 4;" >"$project/apps/api/src/a.ts"
touch_file F apps/api/src/a.ts
set_output "$(printf '\n=== API: lint\n  ! eslint(no-unused-vars): variável sem uso\n   ,-[src/a.ts:1:7]\n 1 | const unused = 1;\n   `----\n\n  x typescript(no-floating-promises): promessa solta\n   ,-[src/b.ts:2:28]\n   `----\n\nFound 1 warning and 1 error.\n\nREPROVADO: 1 verificação(ões) falharam.\n- API: lint\n    Como corrigir: corrija.\n')"
stop F
expect_stop "o aviso do oxlint no arquivo da sessão não bloqueia quando o erro é em outro arquivo" 0 "roda" "systemMessage"

touch_file G apps/web/src/w.tsx
set_output "$(printf '\n=== Web: lint\n/app/src/w.tsx\n  1:7   warning  variável sem uso  @typescript-eslint/no-unused-vars\n\n/app/src/x.ts\n  2:17  error    any  @typescript-eslint/no-explicit-any\n\nREPROVADO: 1 verificação(ões) falharam.\n- Web: lint\n    Como corrigir: corrija.\n')"
stop G
expect_stop "o aviso do eslint no arquivo da sessão não bloqueia quando o erro é em outro arquivo" 0 "roda" "systemMessage"

# --- Só os passos de formato conhecido dão caminho ---
set_output "$(printf '\n=== API: suíte de unidade\nsrc/a.ts\n FAIL  src/a.spec.ts\n\nREPROVADO: 1 verificação(ões) falharam.\n- API: suíte de unidade\n    Como corrigir: veja.\n')"
touch_file J apps/api/src/a.ts
stop J
expect_stop "uma linha solta de arquivo na saída de teste não vira caminho de erro: sem atribuição, bloqueia" 2 "roda" "não deu para atribuir"
rm -f "$state_dir"/stop-blocks-*

# --- O prefixo da app é busca ancorada ---
mkdir -p "$project/apps/web/apps/api"
echo "export const q = 1;" >"$project/apps/web/apps/api/x.ts"
touch_file H apps/web/apps/api/x.ts
set_output ""
stop H
expect_stop "um caminho com apps/api/ no meio não conta como arquivo da API" 0 "roda"
check "só a web foi verificada" grep -qx "fast web" "$FAKE_LOG"

# --- Sessão que o hook não consegue atribuir: falha visível, sem bloquear ---
for raw in '{}' '{"session_id":""}' '{"session_id":"../x"}' '{"session_id":"a/b"}' '{"session_id":"a\nb"}' 'não é json'; do
  stop_raw "$raw"
  expect_stop "a sessão ausente ou inválida avisa que nada foi verificado ($raw)" 0 "não roda" "não foi possível atribuir a sessão"
  check "o aviso é um systemMessage em JSON ($raw)" jq -e '.systemMessage' >/dev/null <<<"$out"
done
check "a sessão inválida não grava estado fora da pasta" test ! -e "$state_dir/stop-blocks-../x" -a ! -e "$state_dir/../x"

# Sem o jq no PATH, o aviso sai igual.
nojq="$work/nojq"
mkdir -p "$nojq"
ln -s "$(command -v bash)" "$nojq/bash"
: >"$FAKE_LOG"
code=0
PATH="$nojq" "$HOOK" <<<'{"session_id":"A"}' >"$work/stdout" 2>"$work/stderr" || code=$?
out="$(cat "$work/stdout")"
err="$(cat "$work/stderr")"
expect_stop "sem o jq, o hook avisa que não conseguiu atribuir a sessão e não bloqueia" 0 "não roda" "não foi possível atribuir a sessão"

# --- Sem a pasta de estado, a falha é visível e não bloqueia ---
: >"$FAKE_LOG"
code=0
CLAUDE_PROJECT_DIR="$work/nao-existe" "$HOOK" <<<'{"session_id":"A"}' >"$work/stdout" 2>"$work/stderr" || code=$?
out="$(cat "$work/stdout")"
err="$(cat "$work/stderr")"
expect_stop "sem a pasta de estado, o hook avisa que não conseguiu verificar e não bloqueia" 0 "não roda" "pasta de estado do harness"
check "o aviso da pasta de estado é um systemMessage em JSON" jq -e '.systemMessage' >/dev/null <<<"$out"

# --- HARNESS_VERIFY só vale com HARNESS_TEST=1 ---
set_output ""
echo "export const a = 3;" >"$project/apps/api/src/a.ts"
touch_file I apps/api/src/a.ts
: >"$FAKE_LOG"
code=0
env -u HARNESS_TEST "$HOOK" <<<'{"session_id":"I"}' >"$work/stdout" 2>"$work/stderr" || code=$?
out="$(cat "$work/stdout")"
err="$(cat "$work/stderr")"
expect_stop "sem HARNESS_TEST, o HARNESS_VERIFY é ignorado e o hook usa o scripts/verify.sh" 2 "não roda" "lista de apps"

finish "do hook de fim de turno"
echo "Todos os testes do hook de fim de turno passaram."
