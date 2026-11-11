#!/usr/bin/env bash
#
# Monta a página de revisão do plano de um ticket e a grava em <tickets>/<pai>/<ticket>/plano.html. Faz
# parte da skill de plano (SKILL.md, passos 5 e 6), e os valores de cada argumento são do projeto,
# que os declara no AGENTS.md, na lista da skill de plano. O <pai> é a issue pai do ticket no
# gerenciador de issues, e vem da tarefa, como o ticket.
#
#   plan-page.sh --pai <issue pai> --ticket <ticket> --tickets <pasta dos tickets>
#                --node <comando do Node> --contrato <comando do contrato, ou nenhum>
#                [--contrato-arquivos "<arquivo>..."] [--documentos <pasta dos documentos>]
#                [--commit <commit de plano>]
#
# Onde fica o arquivo de aceite do ticket, e o que o Git ignora na pasta dele, está no
# formatos/aceite.md, "Onde". O script confere as regras do .gitignore antes de montar a página e, se
# elas não batem, para dizendo o que acrescentar.
#
# Sem --commit, as fontes vão do HEAD até o que está preparado no índice, que é o que o commit de
# plano vai levar, e a mensagem é a proposta, em <tickets>/<pai>/<ticket>/plano.msg. Com ele, vão do pai do
# commit de plano até ele, e a mensagem é a dele. Os dois modos montam a mesma página, salvo a linha
# que diz de onde ela foi montada.
#
# Sem --commit, o que está só na pasta de trabalho fica de fora da página e do commit de plano, que
# leem só o índice. O script avisa, no terminal e no topo da página, sem falhar, do que parece ser do
# plano e ficou fora do índice: um arquivo preparado que tem também mudanças não preparadas; um
# arquivo de aceite novo, fora do versionamento, na pasta dos tickets; uma mudança não preparada nos
# arquivos do contrato; e, com --documentos, uma mudança não preparada ou um arquivo novo na pasta dos
# documentos do projeto. O resto da pasta de trabalho (um arquivo solto na raiz, o trabalho em
# andamento fora desses caminhos) não entra no aviso.
#
# O comando do Node é chamado como `<comando> <script> -`, da raiz do repositório, com o caminho do
# script relativo a ela (absoluto quando a skill está fora do repositório), e recebe as fontes da
# página pela entrada padrão, no formato do cabeçalho do page.cjs; imprime o HTML na saída padrão.
# Nenhuma fonte é gravada em arquivo, então o comando do Node só precisa enxergar o script. O comando
# do contrato é chamado como `<comando> <de> <até>`, com dois pontos do Git (um commit, ou a árvore
# do índice), e imprime o Markdown do contrato (formatos/contrato.md). Os arquivos do contrato são os
# donos dele (as rotas e as tabelas), que têm aba própria e ficam fora da aba Documentos.
#
# Precisa só do `git` e do `bash`. Sai com 0 quando grava a página, 1 quando uma fonte falta ou um
# comando do projeto falha e 2 quando um argumento falta ou não vale.

set -uo pipefail

# Não montou: o erro e o que fazer.
# stop <código> <erro> <como corrigir>
stop() {
  printf '\n%s\n' "$2" >&2
  printf 'Como corrigir: %s\n' "$3" >&2
  exit "$1"
}

# O que cada argumento é, para a mensagem de quando ele falta. Sem vetor associativo, para rodar
# também no bash 3 (o do macOS).
describe() {
  case "$1" in
    pai) echo 'o identificador da issue pai do ticket, como PROJ-1, que é a pasta do ticket dentro da pasta dos tickets' ;;
    ticket) echo 'o identificador do ticket, como PROJ-123' ;;
    tickets) echo 'a pasta dos tickets, com o arquivo de aceite de cada ticket, onde a página é gravada' ;;
    node) echo 'o comando do Node, chamado como `<comando> <script> -`, com as fontes na entrada padrão' ;;
    contrato) echo 'o comando do contrato, chamado como `<comando> <de> <até>`, ou `nenhum`' ;;
    contrato-arquivos) echo 'os arquivos do contrato (os donos das rotas e das tabelas), separados por espaço' ;;
    documentos) echo 'a pasta dos documentos do projeto, cujas mudanças fora do índice entram no aviso' ;;
  esac
}

pai='' ticket='' tickets='' node='' contrato='' contrato_arquivos='' documentos='' commit=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pai | --ticket | --tickets | --node | --contrato | --contrato-arquivos | --documentos | --commit) ;;
    *)
      stop 2 "O argumento \`$1\` não existe." \
        "use só os argumentos do cabeçalho deste script (--pai, --ticket, --tickets, --node, --contrato, --contrato-arquivos, --documentos e --commit)."
      ;;
  esac
  [[ $# -ge 2 && -n "$2" ]] ||
    stop 2 "O argumento \`$1\` veio sem valor." "passe o valor depois dele, como \`$1 <valor>\`."
  name="${1#--}"
  printf -v "${name//-/_}" '%s' "$2"
  shift 2
done

# Os argumentos que faltam, todos de uma vez. O --pai e o --ticket vêm da tarefa; os outros, do projeto.
missing=()
[[ -n "$pai" ]] || missing+=(pai)
[[ -n "$ticket" ]] || missing+=(ticket)
for name in tickets node contrato; do
  [[ -n "${!name}" ]] || missing+=("$name")
done
[[ -n "$contrato" && "$contrato" != nenhum && -z "$contrato_arquivos" ]] && missing+=(contrato-arquivos)
if [[ ${#missing[@]} -gt 0 ]]; then
  for name in "${missing[@]}"; do
    printf '\nFalta o argumento --%s: %s.\n' "$name" "$(describe "$name")" >&2
  done
  if [[ "${missing[*]}" == pai || "${missing[*]}" == ticket || "${missing[*]}" == "pai ticket" ]]; then
    printf 'Como corrigir: passe a issue pai e o ticket do plano com --pai e --ticket. A issue pai é a do ticket no gerenciador de issues, a mesma da spec que o passo 1 da skill lê.\n' >&2
  else
    printf 'Como corrigir: o projeto declara cada valor no AGENTS.md, na lista da skill de plano ("Plano do ticket"); passe-o com o argumento de mesmo nome. Se o AGENTS.md não o declara, pergunte ao usuário e ajude a defini-lo, como o SKILL.md da skill manda.\n' >&2
  fi
  exit 2
fi

[[ "$pai" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]] ||
  stop 2 "\`$pai\` não é o identificador de uma issue pai." "passe o identificador da issue pai do ticket no gerenciador de issues, como \`PROJ-1\`."
[[ "$ticket" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]] ||
  stop 2 "\`$ticket\` não é o identificador de um ticket." "passe o identificador do gerenciador de issues, como \`PROJ-123\`."

root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  stop 2 "O diretório atual não está num repositório do Git." "rode o script de dentro do repositório do projeto."
cd "$root" || stop 2 "Não deu para entrar na raiz do repositório, $root." "confira as permissões da pasta."

# A pasta dos scripts da skill, pelo caminho real (sem links), relativa à raiz quando está dentro do
# repositório, para o comando do Node do projeto receber caminhos relativos a ela. O `git` também dá
# a raiz pelo caminho real. Fora do repositório (uma skill instalada em outro lugar), vai absoluta.
skill="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
[[ "$skill" == "$root"/* ]] && skill="${skill#"$root"/}"

tickets="${tickets%/}"
documentos="${documentos%/}"
contract_files=()
[[ -n "$contrato_arquivos" ]] && read -r -a contract_files <<<"$contrato_arquivos"
dir="$tickets/$pai/$ticket"
msg="$dir/plano.msg"
acceptance="$dir/aceite.md"

# As regras do .gitignore para a pasta do ticket (formatos/aceite.md, "Onde"), numa chamada só, sem
# olhar o que já está em commit: os caminhos ignorados, um por linha, entre quebras de linha.
ignored=$'\n'"$(git -c core.quotePath=false check-ignore --no-index -- "$dir/plano.html" "$msg" "$acceptance")"$'\n'
for file in "$dir/plano.html" "$msg"; do
  [[ "$ignored" == *$'\n'"$file"$'\n'* ]] ||
    stop 2 "A pasta dos tickets, $tickets, não ignora o $file, e só o aceite.md de cada ticket é versionado." \
      "acrescente ao .gitignore as linhas \`$tickets/*/*/*\` e \`!$tickets/*/*/aceite.md\`, e rode o script de novo."
done
[[ "$ignored" == *$'\n'"$acceptance"$'\n'* ]] &&
  stop 2 "A pasta dos tickets, $tickets, ignora o $acceptance, e o arquivo de aceite entra no commit de plano." \
    "no .gitignore, troque a regra que ignora a própria pasta (como \`$tickets/\` ou \`$tickets/*/*\`) pelas linhas \`$tickets/*/*/*\` e \`!$tickets/*/*/aceite.md\`, e rode o script de novo: o Git não reinclui um arquivo dentro de uma pasta ignorada."

# Roda um comando do projeto, que pode ter argumentos próprios, com os argumentos dados.
# project <comando> <argumentos...>
project() {
  local command="$1"
  shift
  bash -c "$command"' "$@"' "$command" "$@"
}

# O `git diff` que a página lê: sem cor nem diff externo, com os prefixos `a/` e `b/` fixos e os
# caminhos com acento sem aspas, seja qual for a configuração do Git de quem roda, para o page.cjs
# achar o arquivo de cada trecho.
plain_diff() {
  git -c core.quotePath=false --no-pager diff --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/ "$@"
}

# A mensagem de um commit, byte a byte: o que vem depois do cabeçalho do objeto.
# commit_message <commit>
commit_message() {
  git cat-file commit "$1" | sed '1,/^$/d'
}

# O `git status` curto, sem aspas nos caminhos com acento, de todos os arquivos, nos caminhos dados.
# status <caminhos...>
status() {
  git -c core.quotePath=false status --porcelain=v1 --untracked-files=all -- "$@"
}

# As mudanças fora do índice que parecem ser do plano, como o cabeçalho as descreve, uma por linha:
# preparadas e com mudança não preparada (X e Y preenchidos, salvo o `??`); novas na pasta dos
# tickets; não preparadas ou novas (Y preenchido) nos arquivos do contrato e na pasta dos documentos.
pending_changes() {
  local all wanted
  all="$(status .)"
  wanted="$(
    grep '^[^ ?][^ ]' <<<"$all"
    status "$tickets" | grep '^??'
    [[ -n "$contrato_arquivos" ]] && status ${contract_files[@]+"${contract_files[@]}"} | grep '^.[^ ]'
    [[ -n "$documentos" ]] && status "$documentos" | grep '^.[^ ]'
  )"
  [[ -n "$wanted" ]] || return 0
  grep -Fx -f <(printf '%s\n' "$wanted") <<<"$all"
}

# A saída de um comando, byte a byte, numa variável: a substituição de comando tiraria as quebras de
# linha do fim, e o ponto impresso depois do comando as protege. Falha quando o comando falha.
# capture <variável> <comando...>
capture() {
  local name="$1" out
  shift
  out="$("$@" && printf .)" || return 1
  printf -v "$name" '%s' "${out%.}"
}

# A página é escrita num arquivo temporário na pasta do ticket, que o Git ignora como a página, e só no
# fim movida para o lugar dela, para uma montagem que falha não deixar uma página pela metade. O
# `mktemp` cria o arquivo só para o dono; a página ganha as permissões de um arquivo novo.
mkdir -p "$dir" || stop 2 "Não deu para criar a pasta do ticket, $dir." "confira as permissões da pasta $tickets."
draft="$(mktemp "$dir/.plano.html.XXXXXX")" ||
  stop 2 "Não deu para criar o arquivo temporário da página em $dir." "confira as permissões da pasta $dir."
# shellcheck disable=SC2064 # o caminho é fixado agora, e não quando o trap roda.
trap "rm -f '$draft'" EXIT
chmod "$(printf '%o' $((0666 & ~$(umask))))" "$draft" ||
  stop 2 "Não deu para ajustar as permissões do arquivo temporário da página, $draft." "confira as permissões da pasta $dir."

pending=''
if [[ -z "$commit" ]]; then
  [[ -f "$msg" ]] ||
    stop 1 "Falta a mensagem proposta do commit de plano, em $msg." \
      "escreva a mensagem nesse caminho, no formato da skill de plano (formatos/mensagem.md), e rode o script da página de novo."
  # O `git commit -F` limpa a mensagem como o `git stripspace`: ela é regravada já limpa, para a
  # página mostrar o que vai entrar no commit.
  capture message git stripspace <"$msg" && printf '%s' "$message" >"$msg" ||
    stop 2 "Não deu para limpar a mensagem proposta em $msg." "confira se o arquivo pode ser lido e escrito."
  from=HEAD
  to="$(git write-tree)" ||
    stop 2 "Não deu para ler o que está preparado no índice." "termine o merge ou o rebase em andamento e confira o índice com \`git status\`."
  origin="Montada do índice, sobre o HEAD $(git rev-parse --short HEAD), com a mensagem proposta em $msg."
  # A página e o commit de plano leem só o índice. O aviso, do cabeçalho, sai na ordem e no formato
  # do `git status` da pasta de trabalho inteira, filtrado pelas quatro regras.
  pending="$(pending_changes)"
  if [[ -n "$pending" ]]; then
    printf '\nAVISO: há mudanças fora do índice nos caminhos do plano, e a página e o commit de plano leem só o índice:\n%s\n' "$pending" >&2
    printf 'Prepare-as com `git add`, ou desfaça-as, e rode o script da página de novo.\n\n' >&2
  fi
else
  git rev-parse --verify --quiet "$commit^{commit}" >/dev/null ||
    stop 2 "\`$commit\` não é um commit deste repositório." "passe o commit de plano do ticket, como o \`git log\` o mostra."
  git rev-parse --verify --quiet "$commit^" >/dev/null ||
    stop 2 "O commit \`$commit\` não tem pai, e a página compara o commit de plano com o anterior a ele." "passe o commit de plano do ticket."
  # O commit de plano é o mais recente que criou o arquivo de aceite do ticket, a partir do HEAD. O
  # `git log --follow` segue o arquivo pelas renomeações, então o commit que só o moveu não conta, e
  # imprime o commit, uma linha em branco e o caminho que o arquivo tinha nele, que é o que a página lê.
  { read -r found; read -r _; read -r created; } <<<"$(git -c core.quotePath=false log --follow --diff-filter=A --format=%H --name-only HEAD -- "$acceptance" 2>/dev/null)"
  [[ -n "$found" ]] ||
    stop 2 "O commit \`$commit\` não é o commit de plano do $ticket: ele não cria o $acceptance, e nenhum commit do HEAD o cria." \
      "passe o commit de plano do ticket, que cria o arquivo de aceite; antes do commit de plano, rode o script sem o --commit."
  [[ "$found" == "$(git rev-parse "$commit^{commit}")" ]] ||
    stop 2 "O commit \`$commit\` não é o commit de plano do $ticket: ele não cria o $acceptance." \
      "passe o commit que o criou: \`--commit $(git rev-parse --short "$found")\`."
  acceptance="$created"
  from="$(git rev-parse --short "$commit^")"
  to="$(git rev-parse --short "$commit")"
  origin="Montada do commit de plano $to."
  capture message commit_message "$commit" ||
    stop 2 "Não deu para ler a mensagem do commit \`$commit\`." "confira o repositório com \`git status\`."
fi

# As fontes do construtor da página, em pares nome e valor (o formato está no page.cjs). Só vão as
# que existem: a que falta conta como ausente.
sources=(ticket "$ticket" origin "$origin" acceptancePath "$acceptance")
capture accepted git show "$to:$acceptance" 2>/dev/null && sources+=(acceptance "$accepted")

# O contrato: o Markdown do comando do projeto, ou nada, quando o projeto declara `nenhum`.
if [[ "$contrato" != nenhum ]]; then
  capture contract project "$contrato" "$from" "$to" ||
    stop 1 "O comando do contrato (\`$contrato $from $to\`) falhou: o erro dele está acima." \
      "corrija o que ele aponta e rode o script da página de novo. Se o comando não é esse, acerte o valor no AGENTS.md, na lista da skill de plano."
  sources+=(contract "$contract")
fi

# Os documentos: tudo o que o plano muda fora do próprio aceite e dos arquivos do contrato, que têm
# aba própria. O aceite de outro ticket aparece aqui.
excludes=(":(exclude)$acceptance")
for file in ${contract_files[@]+"${contract_files[@]}"}; do
  excludes+=(":(exclude)$file")
done
capture docs plain_diff "$from" "$to" -- . "${excludes[@]}" ||
  stop 2 "O \`git diff\` dos documentos de $from para $to falhou: o erro está acima." "confira o repositório com \`git status\`."
sources+=(docsDiff "$docs" message "$message")
[[ -n "$pending" ]] && sources+=(pending "$pending")

printf '%s\0' "${sources[@]}" | project "$node" "$skill/page.cjs" - >"$draft" ||
  stop 1 "A página do plano não pôde ser montada pelo comando do Node (\`$node\`): o erro está acima." \
    "corrija a fonte que ele aponta e rode o script da página de novo. Se o erro é do próprio comando, acerte o valor no AGENTS.md, na lista da skill de plano."
mv "$draft" "$dir/plano.html" || stop 2 "Não deu para gravar a página em $dir/plano.html." "confira as permissões da pasta $dir."
printf 'Página do plano do %s gravada em %s.\n%s\n' "$ticket" "$dir/plano.html" "$origin"
