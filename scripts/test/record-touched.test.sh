#!/usr/bin/env bash
#
# Testes do hook .claude/hooks/record-touched.sh, que anota por sessão os arquivos de apps/ que o
# agente editou, pela entrada que o Claude Code entrega a ele (um JSON pela entrada padrão). O hook
# nunca bloqueia, então todo caso confere a saída 0. Rodam na máquina, como o hook, porque ele usa o
# `git` e o `jq`, que o contêiner `harness` não tem. Quem chama é o scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK="$ROOT/.claude/hooks/record-touched.sh"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

for tool in git jq; do
  command -v "$tool" >/dev/null || { echo "Falta o \`$tool\` na máquina: o hook e o teste dele precisam dele."; exit 2; }
done

project="$(mktemp -d)"
trap 'rm -rf "$project"' EXIT
git -C "$project" init -q
export CLAUDE_PROJECT_DIR="$project"
state_dir="$(git -C "$project" rev-parse --show-toplevel)/.harness"

# touched <sessão>: o que a sessão anotou, ou nada.
touched() {
  cat "$state_dir/touched-$1" 2>/dev/null
}

# expect_touched <nome> <sessão> <anotado esperado, uma linha por arquivo>
expect_touched() {
  local got
  got="$(touched "$2")"
  if [[ "$got" == "$3" ]]; then
    echo "ok: $1"
  else
    echo "FALHOU: $1 (anotado: ${got:-nada}; esperava: ${3:-nada})"
    failed=$((failed + 1))
  fi
}

# run <JSON>: roda o hook e confere a saída 0.
run() {
  local code
  "$HOOK" <<<"$1" >/dev/null 2>&1
  code=$?
  [[ $code -eq 0 ]] || { echo "FALHOU: o hook saiu com $code para $1"; failed=$((failed + 1)); }
}

run "{\"session_id\":\"s1\",\"tool_input\":{\"file_path\":\"$project/apps/api/src/a.ts\"}}"
expect_touched "anota o arquivo de apps/ pelo caminho relativo à raiz" s1 "apps/api/src/a.ts"

run "{\"session_id\":\"s1\",\"tool_input\":{\"file_path\":\"$project/apps/api/src/a.ts\"}}"
run "{\"session_id\":\"s1\",\"tool_input\":{\"file_path\":\"apps/web/src/b.tsx\"}}"
expect_touched "não repete o arquivo e aceita o caminho relativo" s1 "apps/api/src/a.ts"$'\n'"apps/web/src/b.tsx"

run "{\"session_id\":\"s1\",\"tool_input\":{\"file_path\":\"$project/docs/lld.md\"}}"
run "{\"session_id\":\"s1\",\"tool_input\":{\"file_path\":\"/fora/do/projeto/apps/x.ts\"}}"
expect_touched "ignora o arquivo fora de apps/" s1 "apps/api/src/a.ts"$'\n'"apps/web/src/b.tsx"

run "{\"session_id\":\"s1\",\"tool_input\":{\"edits\":[{\"file_path\":\"$project/apps/api/src/c.ts\"},{\"file_path\":\"$project/apps/api/src/d.ts\"}]}}"
expect_touched "anota os arquivos das edições de um MultiEdit" s1 \
  "apps/api/src/a.ts"$'\n'"apps/web/src/b.tsx"$'\n'"apps/api/src/c.ts"$'\n'"apps/api/src/d.ts"

run "{\"session_id\":\"s1\",\"agent_id\":\"a1b2\",\"tool_input\":{\"file_path\":\"$project/apps/api/src/e.ts\"}}"
expect_touched "a chamada de um subagente vai para o arquivo da sessão que o chamou" s1 \
  "apps/api/src/a.ts"$'\n'"apps/web/src/b.tsx"$'\n'"apps/api/src/c.ts"$'\n'"apps/api/src/d.ts"$'\n'"apps/api/src/e.ts"

run "{\"session_id\":\"s2\",\"tool_input\":{\"file_path\":\"$project/apps/web/src/f.ts\"}}"
expect_touched "cada sessão tem o seu arquivo" s2 "apps/web/src/f.ts"

run "isto não é json"
run "{\"session_id\":\"s3\"}"
run "{\"tool_input\":{\"file_path\":\"$project/apps/api/src/g.ts\"}}"
expect_touched "sem sessão, ou com entrada ilegível, não anota e não falha" s3 ""

# --- Nome de arquivo e normalização do caminho ---
run "{\"session_id\":\"n1\",\"tool_input\":{\"file_path\":\"$project/apps/api/src/foo..bar.ts\"}}"
run "{\"session_id\":\"n1\",\"tool_input\":{\"file_path\":\"apps/./api/src/x.ts\"}}"
run "{\"session_id\":\"n1\",\"tool_input\":{\"file_path\":\"./apps/web/src/y.ts\"}}"
run "{\"session_id\":\"n1\",\"tool_input\":{\"file_path\":\"$project/apps/./web//src/z.ts\"}}"
expect_touched "aceita \`..\` dentro do nome e normaliza \`./\`, \`/./\` e o prefixo absoluto" n1 \
  "apps/api/src/foo..bar.ts"$'\n'"apps/api/src/x.ts"$'\n'"apps/web/src/y.ts"$'\n'"apps/web/src/z.ts"

run "{\"session_id\":\"n2\",\"tool_input\":{\"file_path\":\"apps/api/../../etc/x.ts\"}}"
run "{\"session_id\":\"n2\",\"tool_input\":{\"file_path\":\"apps/api/src/..\"}}"
expect_touched "rejeita o segmento \`..\` (travessia)" n2 ""

# --- O \`session_id\` vira nome de arquivo: só letras, dígitos, \`_\` e \`-\` ---
run "{\"session_id\":\"../x\",\"tool_input\":{\"file_path\":\"apps/api/src/a.ts\"}}"
run "{\"session_id\":\"a/b\",\"tool_input\":{\"file_path\":\"apps/api/src/a.ts\"}}"
run "{\"session_id\":\"a\\nb\",\"tool_input\":{\"file_path\":\"apps/api/src/a.ts\"}}"
run "{\"session_id\":\"a\\n\",\"tool_input\":{\"file_path\":\"apps/api/src/a.ts\"}}"
run "{\"session_id\":7,\"tool_input\":{\"file_path\":\"apps/api/src/a.ts\"}}"
check "o \`session_id\` inválido não grava arquivo nenhum, nem fora da pasta de estado" \
  test "$(ls "$state_dir" | tr '\n' ' ')" = "touched-n1 touched-s1 touched-s2 " -a ! -e "$state_dir/../x"
run "{\"session_id\":\"Ab_c-9\",\"tool_input\":{\"file_path\":\"apps/api/src/a.ts\"}}"
expect_touched "aceita letras, dígitos, \`_\` e \`-\`" Ab_c-9 "apps/api/src/a.ts"

# --- Sem a pasta de estado: não anota, e nunca falha a ferramenta ---
run_in() {
  local code
  CLAUDE_PROJECT_DIR="$1" "$HOOK" <<<"$2" >/dev/null 2>&1
  code=$?
  [[ $code -eq 0 ]] || { echo "FALHOU: o hook saiu com $code sem a pasta de estado"; failed=$((failed + 1)); }
}
run_in "$project/nao-existe" "{\"session_id\":\"x1\",\"tool_input\":{\"file_path\":\"$project/apps/api/src/a.ts\"}}"
expect_touched "sem a raiz do projeto, o hook não anota e sai com 0" x1 ""

# --- A pasta atual do hook não define a pasta de estado ---
(cd / && run_in "$project" "{\"session_id\":\"cwd1\",\"tool_input\":{\"file_path\":\"$project/apps/api/src/a.ts\"}}")
expect_touched "com a pasta atual fora do repositório, anota na pasta do projeto" cwd1 "apps/api/src/a.ts"

finish "do hook que anota os arquivos da sessão"
echo "Todos os testes do hook que anota os arquivos da sessão passaram."
