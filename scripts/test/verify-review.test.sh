#!/usr/bin/env bash
#
# Testes do modo `review` do scripts/verify.sh: os argumentos, o diff da branch com os arquivos novos
# sem mexer no índice, a base pelo ponto em que a branch saiu dela, o commit de plano exigido e a
# mensagem dele, o desvio do contrato gravado sempre e a mudança sem ticket, que exige os critérios.
# O verify.sh roda copiado num repositório temporário, com o desvio do contrato trocado por um falso
# (a comparação real tem os próprios testes) e um `docker` falso, para o contêiner `harness` contar como no
# ar. Rodam na máquina, como o verify.sh. Quem chama é o scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"

not() {
  ! "$@"
}

contains() {
  [[ "$1" == *"$2"* ]]
}

# O `docker` falso: toda chamada passa, como a do `require_container`.
mkdir -p "$tmp/bin"
printf '#!/usr/bin/env bash\nexit 0\n' >"$tmp/bin/docker"
chmod +x "$tmp/bin/docker"

# O repositório: os scripts do verify.sh e as regras de docs/tickets do .gitignore, na main.
mkdir -p "$repo/scripts" "$repo/apps/api" "$repo/docs/tickets/PROJ-1/PROJ-3"
cp -R "$ROOT/scripts/verify.sh" "$ROOT/scripts/verify" "$ROOT/scripts/harness-dir.sh" "$ROOT/scripts/full-lock.sh" "$repo/scripts/"
grep '^!\{0,1\}docs/tickets/' "$ROOT/.gitignore" >"$repo/.gitignore"
# A app `api` do repositório falso entra no registro, para o grupo falso dela ser carregado.
sed 's/^APPS=()$/APPS=(api)/' "$ROOT/scripts/verify.sh" >"$repo/scripts/verify.sh"
# O desvio falso: com FAKE_DRIFT, há desvio, e ele faz como o grupo da API (acrescenta a visão ao
# arquivo e avisa); sem ela, diz que o contrato está igual, sem gravar nada.
cat >>"$repo/scripts/verify/api.sh" <<'EOF'

api_contract_drift() {
  if [[ -n "${FAKE_DRIFT_FAIL:-}" ]]; then
    echo "o oasdiff não rodou"
    return 1
  elif [[ -n "${FAKE_DRIFT:-}" ]]; then
    printf '%s\n' "$FAKE_DRIFT" | tee -a "$3"
    echo "::warning title=Contrato diferente do planejado::aviso"
  else
    echo "O contrato e o schema estão iguais ao planejado no commit de plano $(git rev-parse --short "$1")."
  fi
}
EOF
git -C "$repo" init -q -b main
git -C "$repo" config user.email teste@exemplo.com
git -C "$repo" config user.name Teste
printf 'export const a = 1;\n' >"$repo/apps/api/existente.ts"
printf 'export const velho = 1;\n' >"$repo/apps/api/apagado.ts"
# Um aceite que já estava na main: nenhum commit da branch o criou.
printf '# Aceite do PROJ-3\n' >"$repo/docs/tickets/PROJ-1/PROJ-3/aceite.md"
git -C "$repo" add -A && git -C "$repo" commit -q -m base

# A branch: o commit de plano do PROJ-2, uma mudança num arquivo versionado e um arquivo novo.
git -C "$repo" switch -q -c trabalho
mkdir -p "$repo/docs/tickets/PROJ-1/PROJ-2"
printf '# Aceite do PROJ-2\n' >"$repo/docs/tickets/PROJ-1/PROJ-2/aceite.md"
git -C "$repo" add -A && git -C "$repo" commit -q -m 'plano do PROJ-2' -m 'Decisão: a cota vale por usuário.'

# A main anda depois que a branch saiu dela: a mudança dela não é da branch.
git -C "$repo" switch -q main
printf 'export const alheio = 1;\n' >"$repo/apps/api/alheio.ts"
git -C "$repo" add -A && git -C "$repo" commit -q -m 'mudança de outra branch'
git -C "$repo" switch -q trabalho

# Um commit comum depois do plano, com um arquivo novo: o commit de plano deixa de ser o HEAD.
printf 'export const feito = true;\n' >"$repo/apps/api/commitado.ts"
git -C "$repo" add -A && git -C "$repo" commit -q -m 'implementa o PROJ-2'

printf 'export const a = 2;\n' >"$repo/apps/api/existente.ts"
printf 'export const novo = true;\n' >"$repo/apps/api/novo.ts"
printf 'export const espaco = true;\n' >"$repo/apps/api/com espaço.ts"
rm "$repo/apps/api/apagado.ts"

# review <argumentos...>: roda `verify.sh review` no repositório temporário, contra a main dele, e
# deixa a saída em $out, a saída de erro em $err e o código em $code.
review() {
  local errfile="$tmp/err"
  out="$(cd "$repo" && env -u CLAUDE_PROJECT_DIR -u HARNESS_HEAD_REF PATH="$tmp/bin:$PATH" HARNESS_BASE_REF=main \
    scripts/verify.sh review "$@" 2>"$errfile")"
  code=$?
  err="$(cat "$errfile")"
}

# --- argumentos

review PROJ-1
check "recusa um argumento só, com código 2" test $code -eq 2
check "a mensagem mostra as duas formas do comando" contains "$err" "review sem-ticket <nome>"

review pai PROJ-2
check "recusa um <pai> que não tem a forma PREFIXO-N" test $code -eq 2

review PROJ-1 ticket
check "recusa um <ticket> que não tem a forma PREFIXO-N" test $code -eq 2
check "a mensagem do <ticket> inválido mostra as duas formas do comando" contains "$err" "review sem-ticket <nome>"

review PROJ-1 PROJ-2 extra
check "recusa três argumentos" test $code -eq 2
check "a mensagem de três argumentos mostra as duas formas do comando" contains "$err" "review sem-ticket <nome>"

review sem-ticket 'Nome Ruim'
check "recusa um nome sem ticket com maiúscula e espaço" test $code -eq 2

review sem-ticket ../fora
check "recusa um nome sem ticket que sai da pasta" test $code -eq 2

# --- ticket sem plano

review PROJ-1 PROJ-9
check "recusa um ticket sem arquivo de aceite" test $code -eq 2
check "diz que o arquivo de aceite não existe" contains "$err" "não existe"

review PROJ-1 PROJ-3
check "recusa um ticket cujo aceite nenhum commit da branch criou" test $code -eq 2
check "diz que falta o commit de plano" contains "$err" "não tem commit de plano"

# --- ticket planejado

dir="$repo/docs/tickets/PROJ-1/PROJ-2"
plan="$(git -C "$repo" log --format=%H -1 --diff-filter=A -- docs/tickets/PROJ-1/PROJ-2/aceite.md)"
index_before="$(git -C "$repo" ls-files --stage | sha256sum)"
review PROJ-1 PROJ-2
check "com o commit de plano, passa" test $code -eq 0
diff_text="$(cat "$dir/review.diff" 2>/dev/null)"
check "o diff traz o arquivo novo" contains "$diff_text" "b/apps/api/novo.ts"
check "o diff traz a mudança no arquivo versionado" contains "$diff_text" "+export const a = 2;"
check "o diff traz o aceite criado pelo commit de plano" contains "$diff_text" "b/docs/tickets/PROJ-1/PROJ-2/aceite.md"
check "o diff não traz a mudança que a main ganhou depois" not contains "$diff_text" "alheio"
check "o diff traz o arquivo novo já em commit" contains "$diff_text" "b/apps/api/commitado.ts"
check "o diff traz o arquivo apagado" contains "$diff_text" "deleted file mode"
check "o diff traz o arquivo novo com espaço no nome" contains "$diff_text" "b/apps/api/com espaço.ts"
check "o índice de quem trabalha fica igual" test "$(git -C "$repo" ls-files --stage | sha256sum)" = "$index_before"
check "o arquivo novo continua fora do índice" not git -C "$repo" ls-files --error-unmatch --quiet apps/api/novo.ts 2>/dev/null
check "a mensagem do plano é a do commit de plano, e não a do HEAD" test "$(cat "$dir/plano.txt" 2>/dev/null)" = "$(git -C "$repo" log -1 --format=%B "$plan")"
check "sem desvio, o arquivo do desvio diz que o contrato está igual" contains "$(cat "$dir/contract-drift.txt" 2>/dev/null)" "iguais ao planejado"
check "o desvio é comparado com o commit de plano" contains "$(cat "$dir/contract-drift.txt" 2>/dev/null)" "$(git -C "$repo" rev-parse --short "$plan")"
check "a saída lista o arquivo novo fora do Git" contains "$out" "- apps/api/novo.ts"
check "a saída lista o arquivo novo já em commit" contains "$out" "- apps/api/commitado.ts"
check "a saída lista o arquivo novo com espaço no nome" contains "$out" "- apps/api/com espaço.ts"
check "a saída traz o caminho da mensagem do plano" contains "$out" "docs/tickets/PROJ-1/PROJ-2/plano.txt"
check "os insumos ficam fora do git status" not contains "$(git -C "$repo" status --porcelain)" "review.diff"

FAKE_DRIFT="visão do desvio" review PROJ-1 PROJ-2
drift_text="$(cat "$dir/contract-drift.txt" 2>/dev/null)"
check "com desvio, passa" test $code -eq 0
check "com desvio, o arquivo traz a visão" contains "$drift_text" "visão do desvio"
check "com desvio, o arquivo não traz o aviso da CI" not contains "$drift_text" "::warning"

FAKE_DRIFT_FAIL=1 review PROJ-1 PROJ-2
check "com o desvio que falha, a revisão continua" test $code -eq 0
check "com o desvio que falha, o arquivo diz que ele não foi conferido" contains "$(cat "$dir/contract-drift.txt" 2>/dev/null)" "não pôde ser conferido"

review PROJ-1 PROJ-2
check "uma revisão sem desvio não deixa a visão da anterior" not contains "$(cat "$dir/contract-drift.txt" 2>/dev/null)" "visão do desvio"
check "sem a referência baixada, a saída diz que não há referência visual" contains "$out" "sem referência visual"

mkdir -p "$dir/referencia"
printf 'Commit: abc\n' >"$dir/referencia/origem.txt"
review PROJ-1 PROJ-2
check "com a referência baixada, a saída traz o caminho dela" contains "$out" "- referência visual: docs/tickets/PROJ-1/PROJ-2/referencia"
rm -rf "$dir/referencia"

# --- insumos que iriam para um commit

cp "$repo/.gitignore" "$tmp/gitignore"
: >"$repo/.gitignore"
rm -f "$dir/review.diff"
review PROJ-1 PROJ-2
check "sem a regra do .gitignore, recusa a revisão" test $code -eq 2
check "sem a regra do .gitignore, diz que o insumo iria para um commit" contains "$err" "iria para um commit"
check "sem a regra do .gitignore, não grava o diff" test ! -e "$dir/review.diff"
cp "$tmp/gitignore" "$repo/.gitignore"

# --- sem ticket

review sem-ticket skill-de-revisao
check "sem ticket, recusa a revisão sem os critérios" test $code -eq 2
check "sem ticket, diz que falta o criterios.md" contains "$err" "criterios.md"

mkdir -p "$repo/docs/tickets/sem-ticket/skill-de-revisao"
printf '1. Um critério.\n' >"$repo/docs/tickets/sem-ticket/skill-de-revisao/criterios.md"
review sem-ticket skill-de-revisao
check "sem ticket, com os critérios, passa" test $code -eq 0
check "sem ticket, grava o diff" test -s "$repo/docs/tickets/sem-ticket/skill-de-revisao/review.diff"
check "sem ticket, não grava mensagem de plano" test ! -e "$repo/docs/tickets/sem-ticket/skill-de-revisao/plano.txt"
check "sem ticket, a saída traz o caminho dos critérios" contains "$out" "sem-ticket/skill-de-revisao/criterios.md"
check "sem ticket, a saída avisa que não há plano nem desvio" contains "$out" "sem commit de plano"

finish "do modo review do verify.sh"
