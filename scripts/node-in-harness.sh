#!/usr/bin/env bash
#
# Roda o Node no contêiner `harness`, sobre o repositório que o serviço monta só para leitura em
# /repo, sem o .git (compose.dev.yaml). É o comando do Node deste projeto para a skill de plano (o
# AGENTS.md da raiz o declara em "Plano do ticket") e o do `node_in_harness` do scripts/verify.sh, que
# o usa para o conferidor, o renderizador e os testes do harness.
#
#   scripts/node-in-harness.sh <argumentos do node>...
#
# É chamado da raiz do repositório, e o Node roda na raiz dele no contêiner, /repo: os argumentos
# vão como estão, e os caminhos relativos à raiz valem lá como aqui. Um caminho absoluto da máquina,
# ou de fora do repositório, não existe no contêiner. A entrada padrão vai ao Node, e é por ela que
# chega o que nasce na máquina e não está no repositório. O /repo não aceita escrita: o que o Node
# grava vai para /out, por caminho absoluto.
#
# Sai com o código do Node, ou com 2 quando o contêiner não está no ar ou foi criado sem a montagem.

set -uo pipefail

if [[ $# -eq 0 ]]; then
  echo 'Uso: scripts/node-in-harness.sh <argumentos do node>...' >&2
  exit 2
fi

COMPOSE=(docker compose -f "$(dirname "$0")/../compose.dev.yaml")
"${COMPOSE[@]}" exec -T -w /repo harness node "$@"
code=$?
[[ $code -eq 0 ]] && exit 0

# Só quando falha: se o contêiner não está no ar, ou está sem a montagem do repositório (foi criado
# antes dela), diz o que fazer.
if ! "${COMPOSE[@]}" exec -T harness true >/dev/null 2>&1 </dev/null; then
  printf '\nO contêiner `harness` não está no ar, e o Node roda nele.\n' >&2
  printf 'Como corrigir: suba o ambiente com `docker compose -f compose.dev.yaml up -d --build --wait` e rode de novo.\n' >&2
  exit 2
fi
if ! "${COMPOSE[@]}" exec -T harness test -d /repo >/dev/null 2>&1 </dev/null; then
  printf '\nO contêiner `harness` está no ar sem o repositório montado em /repo, onde o Node roda.\n' >&2
  printf 'Como corrigir: recrie o serviço com `docker compose -f compose.dev.yaml up -d --wait harness` e rode de novo.\n' >&2
  exit 2
fi
exit "$code"
