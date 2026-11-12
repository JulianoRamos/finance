#!/usr/bin/env bash
#
# Testes do scripts/referencia-visual.sh: os argumentos recusados, o download das telas no commit
# completo, o origem.txt, a pasta refeita a cada chamada e a tela ou o commit que faltam, sem deixar
# a pasta pela metade. O script roda copiado num repositório temporário, com um `gh` falso que serve
# um commit e duas telas. Rodam na máquina, como o script. Quem chama é o scripts/verify.sh.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=sh-helpers.sh
source "$ROOT/scripts/test/sh-helpers.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
SHA=a1b2c3d4e5f60718293a4b5c6d7e8f9012345678

contains() {
  [[ "$1" == *"$2"* ]]
}

not() {
  ! "$@"
}

# O `gh` falso: entrega o commit SHA (pelo hash curto ou completo) e as telas Inicio e Nav nele, e
# registra cada chamada em calls.log.
mkdir -p "$tmp/bin"
cat >"$tmp/bin/gh" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >>"$tmp/calls.log"
path=''
for arg in "\$@"; do [[ "\$arg" == repos/* ]] && path="\$arg"; done
case "\$path" in
  repos/JulianoRamos/finance-prototipo/commits/a1b2c3d | repos/JulianoRamos/finance-prototipo/commits/$SHA) echo $SHA ;;
  "repos/JulianoRamos/finance-prototipo/contents/Inicio.dc.html?ref=$SHA") echo '<html>inicio</html>' ;;
  "repos/JulianoRamos/finance-prototipo/contents/Nav.dc.html?ref=$SHA") echo '<html>nav</html>' ;;
  *) echo 'gh: Not Found (HTTP 404)' >&2; exit 1 ;;
esac
EOF
chmod +x "$tmp/bin/gh"

mkdir -p "$repo/scripts"
cp "$ROOT/scripts/referencia-visual.sh" "$repo/scripts/"
grep '^!\{0,1\}docs/tickets/' "$ROOT/.gitignore" >"$repo/.gitignore"
git -C "$repo" init -q

# ref <argumentos...>: roda o script e deixa a saída em $out, o erro em $err e o código em $code.
ref() {
  local errfile="$tmp/err"
  out="$(cd "$repo" && PATH="$tmp/bin:$PATH" scripts/referencia-visual.sh "$@" 2>"$errfile")"
  code=$?
  err="$(cat "$errfile")"
}
dir="$repo/docs/tickets/KAN-1/KAN-12/referencia"

ref KAN-1 KAN-12 a1b2c3d
check "recusa sem tela, com código 2" test $code -eq 2
check "mostra o comando completo" contains "$err" "<pai> <ticket> <commit> <tela>..."

ref pai KAN-12 a1b2c3d Inicio
check "recusa um <pai> sem a forma PREFIXO-N" test $code -eq 2

ref KAN-1 KAN-12 main Inicio
check "recusa uma branch no lugar do commit" test $code -eq 2
check "diz que branch e tag mudam" contains "$err" "não uma branch nem uma tag"

ref KAN-1 KAN-12 a1b2c3d ../segredo
check "recusa uma tela com caminho" test $code -eq 2
check "não chama o GitHub quando um argumento não vale" test ! -e "$tmp/calls.log"

ref KAN-1 KAN-12 a1b2c3d Inicio Nav
check "baixa as telas e sai com 0" test $code -eq 0
check "grava a tela Inicio do commit" test "$(cat "$dir/Inicio.dc.html" 2>/dev/null)" = '<html>inicio</html>'
check "grava a tela Nav do commit" test "$(cat "$dir/Nav.dc.html" 2>/dev/null)" = '<html>nav</html>'
check "o origem.txt traz o commit completo" grep -qx "Commit: $SHA" "$dir/origem.txt"
check "o origem.txt traz o repositório" grep -qx 'Repositório: JulianoRamos/finance-prototipo' "$dir/origem.txt"
check "o origem.txt lista as telas" grep -qx -- '- Nav' "$dir/origem.txt"
check "baixa pelo commit completo, e não pelo curto" grep -q "contents/Inicio.dc.html?ref=$SHA" "$tmp/calls.log"
check "a cópia fica fora do Git" test -z "$(git -C "$repo" status --porcelain --untracked-files=all -- docs)"
check "diz onde gravou e de qual commit" contains "$out" "JulianoRamos/finance-prototipo@a1b2c3d"

ref KAN-1 KAN-12 a1b2c3d Inicio
check "refaz a pasta só com as telas da chamada" test ! -e "$dir/Nav.dc.html"
check "mantém a tela pedida de novo" test -f "$dir/Inicio.dc.html"

ref KAN-1 KAN-12 a1b2c3d Inicio Inexistente
check "uma tela que falta sai com 1" test $code -eq 1
check "diz qual tela falta" contains "$err" "A tela Inexistente não existe"
check "não troca a referência anterior quando uma tela falta" test -f "$dir/Inicio.dc.html"
check "não deixa a pasta pela metade" not test -e "$dir/Inexistente.dc.html"

ref KAN-1 KAN-13 fffffff Inicio
check "um commit que o GitHub não entrega sai com 1" test $code -eq 1
check "não cria a pasta do ticket sem o commit" test ! -e "$repo/docs/tickets/KAN-1/KAN-13/referencia"

finish "do referencia-visual.sh"
