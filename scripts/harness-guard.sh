#!/usr/bin/env bash
#
# Guarda do harness. Lê, pela entrada padrão, os caminhos que um pull request altera (um por
# linha) e reprova quando algum deles é um arquivo protegido do harness.
#
# Quem chama é o workflow "Guarda do harness", que roda com a versão da `main` deste script,
# e não com a do pull request.
#
#   scripts/harness-guard.sh [arquivos que o pull request diz alterar] < lista de caminhos
#
# Sai com 0 se nenhum arquivo protegido mudou, 1 se algum mudou e 2 se não deu para conferir.

set -uo pipefail

# A API do GitHub lista no máximo este número de arquivos por pull request.
API_FILE_LIMIT=3000

# Quantos arquivos o pull request diz alterar. Vem do workflow, e é opcional na máquina.
declared="${1:-}"
if [[ -n "$declared" && "$declared" -ge "$API_FILE_LIMIT" ]]; then
  echo "::error title=Guarda do harness::O pull request altera $declared arquivos, e a API só lista $API_FILE_LIMIT. Um arquivo protegido poderia ficar fora da lista."
  echo "Como resolver: divida o pull request, ou o admin confere os arquivos protegidos à mão e faz o merge com bypass."
  exit 2
fi

# Os comandos do `pnpm` são o que o scripts/verify.sh chama: trocar um deles por um comando que
# sempre passa enfraquece a verificação. Compara a seção `scripts` da versão da `main`, que é a
# do diretório atual, com a do pull request, que o workflow baixa em $HEAD_DIR.
# Sem $HEAD_DIR, como na máquina, não há o que comparar, e o arquivo só gera aviso.
scripts_changed() {
  local file="$1"
  [[ -z "${HEAD_DIR:-}" ]] && return 1
  # Arquivo criado, apagado ou renomeado: não dá para comparar, então conta como mudança.
  [[ -f "$file" && -f "$HEAD_DIR/$file" ]] || return 0
  ! diff -q <(jq -S '.scripts // {}' "$file" 2>&1) \
    <(jq -S '.scripts // {}' "$HEAD_DIR/$file" 2>&1) >/dev/null
}

blocked=()
warned=()
frozen=()
total=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  total=$((total + 1))
  case "$file" in
    # O que decide o veredito ou o que o agente pode fazer. Só muda por override do admin. Os
    # scripts da skill de plano entram porque o conferidor do aceite importa o parser deles; o texto
    # da skill (o SKILL.md e os formatos) muda em tarefa normal.
    .github/* | .claude/settings.json | .claude/hooks/* | .claude/agents/* | scripts/* | \
      .claude/skills/plan-ticket/scripts/*)
      blocked+=("$file")
      ;;
    # Aceite congelado: um arquivo de aceite que já existe na `main` (a versão do diretório atual)
    # foi alterado, renomeado ou apagado. Criar um arquivo novo não conta, nem os outros arquivos da
    # pasta do ticket. Só avisa, porque descongelar é legítimo quando um ticket muda um
    # comportamento já entregue, e o humano que faz o merge é quem decide.
    # O `*` do `case` atravessa a `/`, então a profundidade (issue pai e ticket, dois níveis) se confere à parte.
    docs/tickets/*/aceite.md)
      [[ "$file" =~ ^docs/tickets/[^/]+/[^/]+/aceite\.md$ && -f "$file" ]] && frozen+=("$file")
      ;;
    # Mudança de dependência é tarefa normal e só avisa. Mudança nos comandos bloqueia.
    apps/*/package.json)
      if scripts_changed "$file"; then
        blocked+=("$file (seção scripts)")
      else
        warned+=("$file")
      fi
      ;;
    # O que define o que a verificação roda, mas muda em tarefas normais: só avisa.
    # Configuração de lint, de tipos e de teste e o ambiente dos contêineres. A configuração de cada
    # app entra aqui no ticket que a cria.
    apps/*/pyproject.toml | apps/*/eslint.config.* | apps/*/vitest.config.* | \
      apps/*/playwright.config.* | apps/*/tsconfig*.json | \
      compose.dev.yaml | apps/*/Dockerfile.dev)
      warned+=("$file")
      ;;
  esac
done

# Lista vazia é evidência ausente: um pull request sempre altera ao menos um arquivo.
if [[ $total -eq 0 ]]; then
  echo "::error title=Guarda do harness::A lista de arquivos alterados veio vazia. Sem ela, não dá para conferir o pull request."
  exit 2
fi

for file in "${warned[@]}"; do
  echo "::warning title=Entrada da verificação alterada::$file define o que a verificação roda ou confere. Leia essa mudança antes do merge."
done

for file in "${frozen[@]}"; do
  echo "::warning title=Aceite congelado alterado::$file já existe na main e foi alterado, renomeado ou apagado. Confira no merge que foi o humano quem o descongelou."
done

if [[ ${#blocked[@]} -gt 0 ]]; then
  for file in "${blocked[@]}"; do
    echo "::error title=Arquivo protegido do harness::$file só muda por override do admin."
  done
  echo
  echo "REPROVADO: este pull request altera ${#blocked[@]} arquivo(s) protegido(s) do harness."
  echo "Como resolver: se a mudança no harness é intencional, o admin lê o diff desses arquivos e faz o merge com bypass. Se não é, tire esses arquivos do pull request."
  exit 1
fi

echo "APROVADO: nenhum arquivo protegido do harness entre os $total alterados."
