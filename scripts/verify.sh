#!/usr/bin/env bash
#
# Verificação do projeto. É a única definição de "passou": a CI chama o modo completo,
# e os hooks chamam o modo rápido e o de antes do push.
#
#   scripts/verify.sh fast [app...]                tipos e lint das apps citadas (todas, se nenhuma)
#   scripts/verify.sh full [--start-apps]          o grupo completo de todas as apps, os testes do
#                                                  harness, o aceite e a varredura de segredos; é o
#                                                  veredito, e só ele libera o push. Roda uma vez, no
#                                                  fim da tarefa; trava na terceira reprovação igual
#                                                  seguida, fora da CI
#   scripts/verify.sh full <app>... [--start-apps] só o grupo completo das apps citadas; não libera
#                                                  o push
#   scripts/verify.sh unlock                       tira a trava do modo completo; é do usuário, e um
#                                                  hook nega o comando ao agente
#   scripts/verify.sh prepush                      a varredura de segredos, e a conferência de que o
#                                                  modo completo aprovou o que está no último commit
#   scripts/verify.sh apps                         as apps registradas, uma por linha
#   scripts/verify.sh contract [<de> [<para>]]     a visão legível do contrato e do schema entre dois
#                                                  pontos do Git (commits, ou a árvore do índice), em
#                                                  Markdown; sem <para>, até a pasta de trabalho, e
#                                                  sem nenhum, do HEAD até ela. É o comando do
#                                                  contrato da skill de plano
#   scripts/verify.sh plan <pai> <ticket> [<commit>]
#                                                  atalho para o plan-page.sh da skill de plano, com
#                                                  os valores deste projeto; <pai> é a issue pai do
#                                                  ticket, a pasta dele em docs/tickets
#   scripts/verify.sh review <pai> <ticket>
#   scripts/verify.sh review sem-ticket <nome>
#                                                  os insumos do revisor de conformidade na pasta do
#                                                  ticket: o diff da branch, com os arquivos novos, e,
#                                                  com ticket, a mensagem do commit de plano e o desvio
#                                                  do contrato. É da skill revisao-conformidade
#
# Roda tudo nos contêineres do compose.dev.yaml, que já têm de estar no ar: o `harness`, onde roda o
# Node do harness, e o de cada app registrada. Na suíte no navegador, as apps também têm de estar
# respondendo; o `--start-apps` as sobe, e é para a CI.
#
# Com ACCEPTANCE_BODY_FILE apontando para um arquivo com o corpo do pull request, o modo
# completo confere também o aceite: a seção "Aceite" do PR e a cobertura dos critérios por testes.
# E, sem bloquear, avisa quando o contrato ou o schema mudou depois do commit de plano.
#
# Sai com 0 se tudo passou, 1 se alguma verificação falhou e 2 se não deu para verificar.

set -uo pipefail
cd "$(dirname "$0")/.."

# As apps verificadas. O nome é o da pasta em apps/ e o do serviço no Compose. O grupo de cada
# uma fica em scripts/verify/<app>.sh, que define <app>_fast, <app>_full e <app>_reports, e, se a
# app tem contrato planejado, <app>_contract_drift. A app dona do contrato (a API) declara também
# <app>_contract_view, a visão legível do contrato, e acrescenta os arquivos dele a CONTRACT_FILES.
# Uma app entra aqui junto com o grupo dela, no ticket que a cria.
APPS=(api web)

# Os arquivos do contrato (as rotas e as tabelas), que a skill de plano trata à parte. Vazio enquanto
# nenhuma app declara contrato: o plano usa então o contrato `nenhum`.
CONTRACT_FILES=()

COMPOSE=(docker compose -f compose.dev.yaml)
# O mesmo comando, como texto, para as mensagens de como corrigir.
EXEC="${COMPOSE[*]} exec"
# Se a suíte no navegador pode subir a web e a API. O `--start-apps` liga.
START_APPS=no
# Versão fixa, para o mesmo diff dar sempre o mesmo resultado.
GITLEAKS_IMAGE=ghcr.io/gitleaks/gitleaks:v8.30.1
# A varredura de segredos olha os commits que a branch tem a mais do que esta referência.
BASE_REF="${HARNESS_BASE_REF:-origin/main}"
# O fim da branch, para o desvio do plano. Na CI de um pull request, a pasta de trabalho é o merge da
# branch na main, e a main traria as próprias mudanças como desvio: a CI aponta o commit da branch.
# Vazio, o desvio compara com a pasta de trabalho.
HEAD_REF="${HARNESS_HEAD_REF:-}"
# Os scripts da skill de plano: o parser do aceite, que o conferidor importa, e a página do plano. No
# contêiner `harness`, ficam no mesmo caminho, dentro do repositório montado em /repo.
PLAN_SKILL_SCRIPTS=.claude/skills/plan-ticket/scripts
# O que a verificação lê. Só uma mudança nestes caminhos invalida a aprovação do modo completo.
VERIFIED_PATHS=(apps compose.dev.yaml scripts "$PLAN_SKILL_SCRIPTS" docs/tickets)
# O estado interno da verificação (as aprovações e a trava) fica na pasta de estado do harness, que
# o scripts/harness-dir.sh define. Ela pode ficar vazia (a raiz não se alcança): só os modos que gravam
# estado a exigem, com o `require_state`.
# shellcheck source=harness-dir.sh
source scripts/harness-dir.sh
# Onde o modo completo registra o que aprovou.
APPROVAL_FILE="$HARNESS_DIR/full-ok"
# A trava das reprovações repetidas do modo completo, com as funções do scripts/full-lock.sh.
FULL_LOCK_FILE="$HARNESS_DIR/full-lock"
# shellcheck source=full-lock.sh
source scripts/full-lock.sh
# A pasta dos tickets.
TICKETS_DIR=docs/tickets

failures=()

usage() {
  # O cabeçalho deste arquivo, até a primeira linha em branco.
  sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

for app in ${APPS[@]+"${APPS[@]}"}; do
  # shellcheck source=/dev/null
  source "scripts/verify/$app.sh"
done

# Sai com o uso se algum nome não é de uma app registrada.
check_apps() {
  local app
  for app in "$@"; do
    [[ " ${APPS[*]} " == *" $app "* ]] || usage
  done
}

# Não deu para verificar: falha fechada, com o que fazer.
abort() {
  printf '\nNÃO VERIFICADO: %s\n' "$1" >&2
  printf 'Como resolver: %s\n' "$2" >&2
  exit 2
}

# Aborta se a pasta de estado do harness não pôde ser definida. Só os modos que gravam estado a pedem
# (o `full` sem apps, o `prepush` e o `unlock`); os outros não dependem dela.
require_state() {
  [[ -n "$HARNESS_DIR" ]] ||
    abort "não foi possível definir a pasta de estado do harness: a raiz do checkout não é uma pasta que se alcança." \
      "rode o scripts/verify.sh de um checkout do repositório e, se o CLAUDE_PROJECT_DIR está definido, confira que ele aponta para a raiz dele."
}

# Um comando que não verifica falhou: o erro e o que fazer, e devolve 1.
# fail <erro> <como corrigir>
fail() {
  printf '\n%s\n' "$1" >&2
  printf 'Como corrigir: %s\n' "$2" >&2
  return 1
}

# step <nome> <como corrigir> <comando...>
step() {
  local name="$1" hint="$2"
  shift 2
  printf '\n=== %s\n' "$name"
  if "$@"; then
    return 0
  fi
  failures+=("$name"$'\n'"    Como corrigir: $hint")
  return 1
}

in_container() {
  local service="$1"
  shift
  "${COMPOSE[@]}" exec -T "$service" "$@"
}

require_container() {
  in_container "$1" true >/dev/null 2>&1 ||
    abort "o contêiner \`$1\` não está no ar." \
      "suba o ambiente com \`${COMPOSE[*]} up -d --build --wait\` e rode de novo."
}

# Confere o relatório JSON de uma suíte dentro do contêiner, onde está o Node.
check_report() {
  local service="$1" kind="$2" file="$3"
  in_container "$service" node - "$kind" "$file" <scripts/check-report.cjs
}

responds() {
  in_container "$1" node -e \
    "fetch('$2').then(() => process.exit(0), () => process.exit(1))" >/dev/null 2>&1
}

# Espera o endereço responder, por até três minutos, num só Node dentro do contêiner, que tenta de
# novo a cada segundo. Com o arquivo de PID do servidor, desiste na hora em que o processo dele para,
# em vez de esperar o prazo: o PID gravado deixou de existir ou virou zumbi. Enquanto o arquivo não
# tem um PID, o servidor ainda está subindo.
# wait_for <serviço> <endereço> [arquivo de PID, no contêiner]
wait_for() {
  in_container "$1" node -e "
    const fs = require('node:fs');
    const deadline = Date.now() + 180000;
    const pidFile = '${3:-}';
    const read = (file) => {
      try {
        return fs.readFileSync(file, 'utf8');
      } catch {
        return null;
      }
    };
    const stopped = () => {
      const pid = pidFile && read(pidFile)?.trim();
      if (!pid || !/^[0-9]+$/.test(pid)) return false;
      const stat = read('/proc/' + pid + '/stat');
      return stat === null || stat.slice(stat.lastIndexOf(') ') + 2, stat.lastIndexOf(') ') + 3) === 'Z';
    };
    const attempt = () =>
      fetch('$2', { signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) }).then(
        () => process.exit(0),
        () => (Date.now() < deadline && !stopped() ? setTimeout(attempt, 1000) : process.exit(1)),
      );
    attempt();" >/dev/null 2>&1
}

# O Node no contêiner `harness`: o scripts/node-in-harness.sh, cujo cabeçalho diz como ele roda.
node_in_harness() {
  scripts/node-in-harness.sh "$@"
}

# O relatório dos testes do harness, no contêiner `harness`: o Node o grava em /out, o volume que
# aceita escrita, e o `check_report` e o conferidor o leem de lá, como o de uma suíte.
HARNESS_REPORT=/out/node-tests.json

# Roda os testes do harness: os do conferidor, do renderizador do contrato e os da skill de plano (o
# parser e a página do plano) no contêiner `harness`, e os dos hooks de congelamento e de antes do
# comando, os da trava do modo completo e o da referência visual, que usa o `gh`, na máquina.
harness_tests() {
  # Relatório antigo não vale como evidência desta execução.
  in_container harness rm -f "$HARNESS_REPORT" &&
    # O repórter próprio grava o relatório no formato do Vitest, para o `check_report` e o conferidor
    # lerem; o repórter `spec` segue na saída, para quem lê o log. Os testes são os mesmos caminhos
    # relativos aqui e no /repo, então a lista sai daqui.
    node_in_harness --test --test-reporter=spec --test-reporter-destination=stdout \
      --test-reporter=./scripts/test/node-test-report.cjs --test-reporter-destination="$HARNESS_REPORT" \
      scripts/test/*.test.cjs "$PLAN_SKILL_SCRIPTS"/test/*.test.cjs &&
    check_report harness vitest "$HARNESS_REPORT" &&
    # Os hooks (o do congelamento, o do push, o que anota os arquivos da sessão e o de fim de turno)
    # usam o `git` e o `jq`, que o contêiner não tem, e a trava é do verify.sh, que roda na máquina:
    # os testes deles rodam aqui.
    scripts/test/freeze-acceptance.test.sh &&
    scripts/test/plan-page.test.sh &&
    scripts/test/verify-plan.test.sh &&
    scripts/test/verify-review.test.sh &&
    scripts/test/referencia-visual.test.sh &&
    scripts/test/harness-guard.test.sh &&
    scripts/test/push-verify.test.sh &&
    scripts/test/full-lock.test.sh &&
    scripts/test/record-touched.test.sh &&
    scripts/test/stop-verify.test.sh
}

# Falha, dizendo por quê, quando o ACCEPTANCE_BODY_FILE aponta para um arquivo que não existe. Sem
# a variável, não há corpo, e passa.
require_body() {
  [[ -z "${ACCEPTANCE_BODY_FILE:-}" || -f "$ACCEPTANCE_BODY_FILE" ]] ||
    fail "O corpo do pull request não foi encontrado em $ACCEPTANCE_BODY_FILE, o arquivo de ACCEPTANCE_BODY_FILE." \
      "salve o corpo do PR nesse arquivo, ou aponte a variável para o arquivo certo, e rode de novo."
}

# O arquivo de aceite citado na seção "Aceite" do corpo do pull request, lido pelo mesmo conferidor,
# com o corpo na entrada padrão. Não imprime nada quando não há corpo e quando a seção diz "nenhum".
cited_acceptance() {
  require_body && node_in_harness scripts/check-acceptance.cjs --cited - "$TICKETS_DIR" <"${ACCEPTANCE_BODY_FILE:-/dev/null}"
}

# O `git diff` que a visão do contrato lê: sem cor nem diff externo, com os prefixos `a/` e `b/` fixos
# e os caminhos com acento sem aspas, seja qual for a configuração do Git de quem roda
# (`diff.noprefix`, `diff.mnemonicPrefix`, `core.quotePath`), como o da página do plano.
# plain_diff <argumentos do git diff...>
plain_diff() {
  git -c core.quotePath=false --no-pager diff --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/ "$@"
}

# O commit mais recente de <commits> (um intervalo ou um ponto, como no `git log`) que criou o
# <arquivo>. O `--follow` segue o arquivo pelas renomeações: o commit que só o moveu (como o que levou
# os arquivos de aceite de docs/aceite/ para a pasta de cada ticket) não conta como o que o criou. Não
# imprime nada quando nenhum o criou, e falha quando o `git log` não lê o histórico.
# added_by <commits> <arquivo>
added_by() {
  local commits
  commits="$(git log --follow --diff-filter=A --format=%H "$1" -- "$2")" || return 1
  printf '%s' "${commits%%$'\n'*}"
}

# O commit de plano: o mais recente da branch que criou o arquivo de aceite, que é o plano em
# vigor. Não imprime nada quando nenhum commit da branch o criou (um ticket antigo, ou o plano ainda
# sem commit). Falha quando o `git log` não lê o histórico da branch.
# plan_commit <arquivo de aceite>
plan_commit() {
  added_by "$BASE_REF..${HEAD_REF:-HEAD}" "$1"
}

# O desvio do plano, comparado pelo grupo de cada app que declara <app>_contract_drift. Cada uma
# acrescenta a própria visão ao contract-drift.txt da pasta do ticket, que o `run_full` apaga no
# começo. Só avisa: nunca falha.
contract_drift() {
  local file plan app drift
  if [[ -n "$HEAD_REF" ]] && ! git rev-parse --verify --quiet "$HEAD_REF^{commit}" >/dev/null; then
    echo "HARNESS_HEAD_REF aponta \`$HEAD_REF\`, que não é um commit deste clone, e o desvio não foi conferido. Aponte o commit da branch, ou deixe a variável vazia para comparar com a pasta de trabalho."
  elif ! file="$(cited_acceptance)"; then
    echo "Não deu para ler a seção \"Aceite\" do corpo do PR, pelo motivo acima, e o desvio não foi conferido."
  elif [[ -z "$file" ]]; then
    echo "Não há commit de plano para comparar: o corpo do PR não cita, na seção \"Aceite\", um arquivo de aceite."
  elif ! plan="$(plan_commit "$file")"; then
    echo "Não deu para ler o histórico da branch ($BASE_REF..${HEAD_REF:-HEAD}) com o \`git log\`, e o desvio não foi conferido. Confira se a base existe (\`git fetch origin\`, ou outra base em HARNESS_BASE_REF) e se o clone tem o histórico inteiro (\`git fetch --unshallow\`; na CI, \`fetch-depth: 0\` no checkout)."
  elif [[ -z "$plan" ]]; then
    echo "Não há commit de plano para comparar: nenhum commit desta branch criou o $file, citado na seção \"Aceite\" do corpo do PR."
  else
    # A pasta do ticket (docs/tickets/<issue>/<ticket>/) é a do arquivo de aceite citado.
    drift="$(dirname "$file")/contract-drift.txt"
    for app in ${APPS[@]+"${APPS[@]}"}; do
      if declare -F "${app}_contract_drift" >/dev/null; then
        "${app}_contract_drift" "$plan" "$HEAD_REF" "$drift"
      fi
    done
  fi
  return 0
}

# Confere o aceite contra os relatórios que as apps declaram em <app>_reports: a seção "Aceite" do
# pull request e a cobertura dos critérios de todos os tickets. A seção só é exigida quando a
# branch altera código em apps/.
acceptance() {
  local mode=--optional app ref spec report body="${ACCEPTANCE_BODY_FILE:-}" specs=()
  # Conta também o que ainda não foi commitado: na máquina, o modo completo costuma rodar antes
  # do commit, e a tabela não pode passar como "não exigida" só por isso.
  if [[ -n "$body" ]] && [[ -n "$(git diff --name-only "$(git merge-base "$BASE_REF" HEAD)" -- apps/)" ||
    -n "$(git ls-files --others --exclude-standard -- apps/)" ]]; then
    mode=--required
  fi

  require_body || return

  # O conferidor roda no contêiner `harness` (`node_in_harness`), na raiz do /repo, e lê de lá os
  # arquivos de aceite, pela pasta dos tickets relativa a ela, e os relatórios, que as suítes gravam na
  # pasta de cada app, e o dos testes do harness, no /out. O corpo do PR, que não está no repositório,
  # vai pela entrada padrão. O relatório que falta o conferidor reprova, dizendo qual; aqui sai também
  # o que fazer.
  specs+=("vitest:$HARNESS_REPORT")
  for app in ${APPS[@]+"${APPS[@]}"}; do
    ref="${app}_reports[@]"
    for spec in "${!ref}"; do
      report="apps/$app/${spec#*:}"
      if [[ ! -f "$report" ]]; then
        printf '\nO relatório %s não existe.\n' "$report" >&2
        printf 'Como corrigir: a suíte que o grava não rodou ou parou antes: veja o passo dela acima e rode `scripts/verify.sh full` de novo.\n' >&2
      fi
      specs+=("${spec%%:*}:/repo/$report")
    done
  done

  node_in_harness scripts/check-acceptance.cjs "$mode" - "$TICKETS_DIR" "${specs[@]}" <"${body:-/dev/null}"
}

require_base() {
  git rev-parse --verify --quiet "$BASE_REF" >/dev/null ||
    abort "a referência \`$BASE_REF\` não existe neste clone." \
      "rode \`git fetch origin\`, ou aponte outra base com a variável HARNESS_BASE_REF."
}

secret_scan() {
  require_base
  docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/repo" "$GITLEAKS_IMAGE" \
    git /repo --no-banner --redact --log-opts="$BASE_REF..HEAD"
}

# Resumo do conteúdo dos caminhos que a verificação lê, numa árvore do Git.
tree_state() {
  local path
  for path in "${VERIFIED_PATHS[@]}"; do
    git rev-parse --verify --quiet "$1:$path" || echo ausente
  done | sha256sum | cut -d' ' -f1
}

# O id da árvore do HEAD com os <caminhos> como estão na pasta de trabalho, inclusive o que ainda não
# foi commitado. Usa um índice temporário, para não mexer no índice de quem trabalha. Só os caminhos
# que existem na pasta ou no HEAD entram no `git add`, que falha com um caminho que não está em nenhum
# dos dois (como o apps/ antes da primeira app). Falha sem imprimir nada quando não monta a árvore.
# worktree_tree <caminhos...>
worktree_tree() {
  local dir tree path paths=()
  for path in "$@"; do
    [[ -e "$path" ]] || git rev-parse --verify --quiet "HEAD:$path" >/dev/null && paths+=("$path")
  done
  dir="$(mktemp -d)" || return 1
  tree="$(
    export GIT_INDEX_FILE="$dir/index"
    git read-tree HEAD && { [[ ${#paths[@]} -eq 0 ]] || git add -A -- "${paths[@]}"; } && git write-tree
  )"
  rm -rf "$dir"
  [[ -n "$tree" ]] && printf '%s\n' "$tree"
}

# O mesmo resumo do `tree_state`, para a pasta de trabalho: é ela que o modo completo verifica. O que
# falta na pasta e no HEAD o `tree_state` resume como ausente.
worktree_state() {
  local tree
  tree="$(worktree_tree "${VERIFIED_PATHS[@]}")" && tree_state "$tree"
}

# Confere que o modo completo aprovou exatamente o que está no último commit.
approval() {
  if git diff --quiet "$BASE_REF...HEAD" -- "${VERIFIED_PATHS[@]}"; then
    echo "A branch não altera nada do que a verificação lê. Não precisa de aprovação."
    return 0
  fi

  local approved acceptance
  approved="$(sed -n 's/^state=//p' "$APPROVAL_FILE" 2>/dev/null)"
  acceptance="$(sed -n 's/^acceptance=//p' "$APPROVAL_FILE" 2>/dev/null)"

  if [[ -z "$approved" || "$approved" != "$(tree_state HEAD)" ]]; then
    echo "O modo completo não aprovou o conteúdo do último commit."
    return 1
  fi
  if [[ "$acceptance" != checked ]] && ! git diff --quiet "$BASE_REF...HEAD" -- apps/; then
    echo "O modo completo aprovou este conteúdo, mas sem conferir o aceite, e a branch altera código em apps/."
    return 1
  fi
  echo "O modo completo aprovou o conteúdo do último commit."
}

run_prepush() {
  require_base
  step "Segredos nos commits da branch" \
    "tire o segredo do código e reescreva o commit que o trouxe. Ele ainda não saiu da máquina." \
    secret_scan
  step "Aprovação do modo completo" \
    "faça o commit de tudo, salve o corpo do pull request num arquivo e rode \`ACCEPTANCE_BODY_FILE=<arquivo> scripts/verify.sh full\`. Se mudar algo em ${VERIFIED_PATHS[*]} depois, rode de novo." \
    approval
}

# O veredito: o grupo completo de todas as apps, mais o que atravessa as apps.
run_full() {
  local app
  require_base
  # O estado é resumido antes de tudo, para a aprovação valer para o que foi verificado, e não
  # para o que estiver na pasta quando a verificação terminar.
  verified_state="$(worktree_state)" || abort "não deu para resumir o estado da pasta de trabalho." \
    "confira se o repositório do Git está íntegro, com \`git status\`."
  # A visão do desvio também é desta execução: uma interrompida não deixa uma antiga para trás.
  rm -f "$APPROVAL_FILE" "$TICKETS_DIR"/*/*/contract-drift.txt

  for app in ${APPS[@]+"${APPS[@]}"}; do
    "${app}_full"
  done

  step "Testes do harness" \
    "corrija o script ou o teste que falhou, em scripts/ ou em $PLAN_SKILL_SCRIPTS/ (os testes da skill ficam em $PLAN_SKILL_SCRIPTS/test/), e rode \`scripts/verify.sh full\` de novo." \
    harness_tests

  # A cobertura dos critérios roda sempre. A seção "Aceite" só é conferida quando há um corpo de
  # pull request: na CI, ou na máquina, com o corpo num arquivo apontado por ACCEPTANCE_BODY_FILE.
  step "Aceite" \
    "acerte a seção \"Aceite\" do corpo do pull request, no formato do AGENTS.md da raiz, ou escreva o teste do critério que falta, com o ID numa tag." \
    acceptance

  # Depois do "Aceite", que confere a seção que ele lê. Só avisa: nunca entra nas falhas.
  step "Contrato e schema contra o commit de plano" \
    "o passo só avisa e não falha." \
    contract_drift

  step "Segredos nos commits da branch" \
    "tire o segredo do código, troque-o na origem (ele já vazou para o histórico) e reescreva o commit que o trouxe." \
    secret_scan
}

# Valida um ponto da visão do contrato: um commit, ou o id de uma árvore da raiz, como o da árvore do
# índice que o `git write-tree` imprime. Uma subárvore (`<commit>:<caminho>`) não vale: os caminhos
# do snapshot e do schema são lidos a partir da raiz.
require_point() {
  git rev-parse --verify --quiet "$1^{commit}" >/dev/null 2>&1 && return 0
  [[ "$1" =~ ^[0-9a-f]{4,64}$ && "$(git cat-file -t "$1" 2>/dev/null)" == tree ]] ||
    abort "\`$1\` não é um commit nem o id da árvore da raiz deste repositório." \
      "passe um commit, uma branch ou uma tag existente, como \`HEAD\` ou \`origin/main\`, ou o id que o \`git write-tree\` imprime."
}

# O atalho do modo `plan`: o plan-page.sh da skill de plano, com os valores deste projeto. O dono dos
# valores é o AGENTS.md da raiz ("Plano do ticket", "Valores da skill de plano"); o atalho só os passa.
# A lógica e as mensagens são do script.
# run_plan <pai> <ticket> [<commit>]
run_plan() {
  local args=(--pai "$1" --ticket "$2" --tickets "$TICKETS_DIR" --documentos docs --node scripts/node-in-harness.sh)
  # Sem app que declare contrato, o plano não tem rotas nem tabelas a desenhar.
  if [[ ${#CONTRACT_FILES[@]} -gt 0 ]]; then
    args+=(--contrato "scripts/verify.sh contract" --contrato-arquivos "${CONTRACT_FILES[*]}")
  else
    args+=(--contrato nenhum)
  fi
  [[ -n "${3:-}" ]] && args+=(--commit "$3")
  "$PLAN_SKILL_SCRIPTS/plan-page.sh" "${args[@]}"
}

# O diff que o revisor lê: tudo o que a branch mudou desde que saiu da base, até a pasta de trabalho,
# com os arquivos novos que o Git não ignora. Compara com o ponto em que a branch saiu da base, e não
# com a ponta dela, para uma base que andou não trazer as mudanças alheias como se fossem da branch.
# Usa um índice temporário, como o `worktree_state`, para contar os arquivos novos sem mexer no índice
# de quem trabalha. Grava também a lista dos arquivos que o diff acrescenta, em commit ou não.
# review_diff <arquivo do diff> <arquivo da lista dos acrescentados>
review_diff() {
  local base dir code=0
  base="$(git merge-base "$BASE_REF" HEAD)" || return 1
  dir="$(mktemp -d)" || return 1
  (
    export GIT_INDEX_FILE="$dir/index"
    git read-tree HEAD && git add -A &&
      plain_diff --cached "$base" >"$1" &&
      git -c core.quotePath=false diff --cached --name-only --diff-filter=A "$base" >"$2"
  ) || code=1
  rm -rf "$dir"
  return $code
}

# O desvio do contrato desde o commit de plano, pelo grupo de cada app que declara
# <app>_contract_drift, o mesmo do aviso do modo completo. O grupo só grava o arquivo quando há
# desvio; o revisor recebe o arquivo sempre, então, sem desvio, ele leva o que o grupo disse. O grupo
# que falha deixa no arquivo que o desvio dele não foi conferido, para o revisor não ler um vazio.
# review_drift <commit de plano> <arquivo>
review_drift() {
  local plan="$1" drift="$2" app out said=() failed=()
  rm -f "$drift"
  for app in ${APPS[@]+"${APPS[@]}"}; do
    declare -F "${app}_contract_drift" >/dev/null || continue
    if out="$("${app}_contract_drift" "$plan" "" "$drift" 2>&1)"; then
      [[ -n "$out" ]] && said+=("$out")
    else
      failed+=("O desvio do contrato da app $app não pôde ser conferido. O que o grupo dela disse:"$'\n\n'"$out")
    fi
  done
  if [[ ${#failed[@]} -gt 0 ]]; then
    printf '%s\n\n' "${failed[@]}" >>"$drift"
  elif [[ ! -s "$drift" && ${#said[@]} -gt 0 ]]; then
    printf '%s\n' "${said[@]}" >"$drift"
  elif [[ ! -s "$drift" ]]; then
    echo "Nenhuma app declara contrato planejado: não há desvio a conferir." >"$drift"
  fi
}

# O modo `review`: os insumos do revisor de conformidade, na pasta do ticket, e os caminhos que a
# skill revisao-conformidade passa a ele. Com ticket, exige o commit de plano: um ticket sem ele não
# foi planejado, e não chega à revisão. Sem ticket, exige os critérios escritos antes, em
# criterios.md, para a revisão ter contra o que conferir.
# run_review <pai> <ticket>, ou run_review sem-ticket <nome>
run_review() {
  local dir="$TICKETS_DIR/$1/$2" acceptance plan="" file added
  require_base
  if [[ "$1" == sem-ticket ]]; then
    [[ -f "$dir/criterios.md" ]] ||
      abort "não há critérios para a revisão: $dir/criterios.md não existe." \
        "escreva nele os critérios de aceite da mudança, antes de revisar, e rode \`scripts/verify.sh review sem-ticket $2\` de novo."
  else
    acceptance="$dir/aceite.md"
    [[ -f "$acceptance" ]] ||
      abort "o arquivo de aceite $acceptance não existe." \
        "confira a issue pai e o ticket; se o ticket não foi planejado, rode a /plan-ticket antes."
    plan="$(plan_commit "$acceptance")" ||
      abort "não deu para ler o histórico da branch ($BASE_REF..HEAD) com o \`git log\`." \
        "confira se a base existe (\`git fetch origin\`, ou outra base em HARNESS_BASE_REF) e se o clone tem o histórico inteiro."
    [[ -n "$plan" ]] ||
      abort "nenhum commit desta branch criou o $acceptance: o ticket não tem commit de plano." \
        "planeje o ticket com a /plan-ticket e faça o commit de plano antes da revisão."
    # O desvio do contrato roda o Node do harness.
    require_container harness
  fi

  # Os insumos não podem ir para um commit: o .gitignore ignora tudo na pasta do ticket, salvo o aceite.
  # Confere antes de gravar, pelo padrão, para um abort não deixar arquivos prontos para um `git add`.
  for file in review.diff plano.txt contract-drift.txt criterios.md; do
    git check-ignore -q --no-index "$dir/$file" ||
      abort "o $dir/$file não seria ignorado pelo Git, e iria para um commit." \
        "confira as regras de $TICKETS_DIR no .gitignore: ele ignora tudo na pasta do ticket, salvo o aceite.md."
  done

  added="$(mktemp)" || abort "não deu para criar um arquivo temporário." "confira o espaço e as permissões da pasta temporária."
  review_diff "$dir/review.diff" "$added" || {
    rm -f "$added"
    abort "não deu para montar o diff da branch contra $BASE_REF." \
      "confira se o repositório do Git está íntegro, com \`git status\`, e se a base existe."
  }
  if [[ -n "$plan" ]]; then
    git show -s --format=%B "$plan" >"$dir/plano.txt" || {
      rm -f "$added"
      abort "não deu para ler a mensagem do commit de plano $plan." "confira o repositório do Git com \`git status\` e rode de novo."
    }
    review_drift "$plan" "$dir/contract-drift.txt"
  fi

  printf 'Insumos do revisor de conformidade em %s:\n' "$dir"
  printf -- '- diff: %s\n' "$dir/review.diff"
  if [[ -n "$plan" ]]; then
    printf -- '- ticket: %s\n' "$2"
    printf -- '- mensagem do commit de plano %s: %s\n' "$(git rev-parse --short "$plan")" "$dir/plano.txt"
    printf -- '- desvio do contrato: %s\n' "$dir/contract-drift.txt"
    if [[ -f "$dir/referencia/origem.txt" ]]; then
      printf -- '- referência visual: %s\n' "$dir/referencia"
    else
      printf -- '- sem referência visual: o ticket não cita telas do protótipo, ou o plano não as baixou\n'
    fi
  else
    printf -- '- critérios: %s\n' "$dir/criterios.md"
    printf -- '- sem commit de plano: não há mensagem do plano nem desvio do contrato\n'
  fi
  if [[ -s "$added" ]]; then
    printf '\nArquivos que o diff acrescenta:\n'
    sed 's/^/- /' "$added"
  fi
  rm -f "$added"
}

mode="${1:-}"
[[ $# -gt 0 ]] && shift

# As apps citadas no `full`. Sem nenhuma, ele é o veredito.
apps=()
# Se esta execução conta na trava das reprovações repetidas: só o `full` sem apps, fora da CI.
lock=no

case "$mode" in
  fast)
    apps=("$@")
    [[ ${#apps[@]} -eq 0 ]] && apps=(${APPS[@]+"${APPS[@]}"})
    check_apps "${apps[@]}"
    for app in "${apps[@]}"; do
      "${app}_fast"
    done
    apps=()
    ;;
  full)
    for arg in "$@"; do
      case "$arg" in
        --start-apps) START_APPS=yes ;;
        -*) usage ;;
        *) apps+=("$arg") ;;
      esac
    done
    if [[ ${#apps[@]} -eq 0 ]]; then
      # A trava vale só aqui, e fora da CI. Travado, recusa antes de tudo: rodar de novo não traz
      # informação nova.
      require_state
      full_lock_enabled && lock=yes
      [[ $lock == yes ]] && full_lock_active &&
        abort "o modo completo está travado: reprovou $FULL_LOCK_LIMIT vezes seguidas nos mesmos passos." "$FULL_LOCK_ASK"
      run_full
    else
      check_apps "${apps[@]}"
      for app in "${apps[@]}"; do
        "${app}_full"
      done
    fi
    ;;
  prepush)
    [[ $# -eq 0 ]] || usage
    require_state
    run_prepush
    ;;
  unlock)
    # Do usuário, pelo `!` do prompt, que não passa pelos hooks: o hook do agente nega este modo.
    [[ $# -eq 0 ]] || usage
    require_state
    full_lock_reset
    printf 'Trava do modo completo tirada, e a contagem zerada.\n'
    exit 0
    ;;
  apps)
    [[ $# -eq 0 ]] || usage
    # Sem apps, não imprime nada: uma linha vazia seria lida como uma app sem nome.
    [[ ${#APPS[@]} -eq 0 ]] || printf '%s\n' "${APPS[@]}"
    exit 0
    ;;
  contract)
    # A visão não é verificação: não aprova nada. Ela é a do contrato que o plano escreve, e por isso
    # chama o grupo da app que o declara (<app>_contract_view), e não percorre o registro.
    [[ $# -le 2 ]] || usage
    from="${1:-HEAD}"
    to="${2:-}"
    require_point "$from"
    [[ -z "$to" ]] || require_point "$to"
    owner=""
    for app in ${APPS[@]+"${APPS[@]}"}; do
      declare -F "${app}_contract_view" >/dev/null && owner="$app" && break
    done
    [[ -n "$owner" ]] ||
      abort "nenhuma app registrada declara contrato (<app>_contract_view)." \
        "enquanto não houver, o plano usa o contrato \`nenhum\`, e o \`scripts/verify.sh plan\` já o passa."
    require_container harness
    "${owner}_contract_view" "$from" "$to" ||
      fail "A visão do contrato não pôde ser montada: o erro está acima." \
        "corrija o que ele aponta (num snapshot ilegível, o arquivo do contrato em ${CONTRACT_FILES[*]}) e rode \`scripts/verify.sh contract\` de novo."
    exit $?
    ;;
  plan)
    # A página não é verificação: não aprova nada.
    plan_example='scripts/verify.sh plan PROJ-1 PROJ-123 [<commit>]'
    [[ $# -ge 1 && $# -le 3 ]] || usage
    [[ $# -ge 2 ]] ||
      abort "falta o <pai> no \`plan\`: o comando é \`plan <pai> <ticket> [<commit>]\`, e só um argumento foi passado." \
        "passe a issue pai e o ticket, como em \`$plan_example\`."
    # A ordem de antes do <pai> (`plan <ticket> [<commit>]`) cai aqui: o primeiro não é issue, ou o segundo não é ticket.
    [[ "$1" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ && "$2" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]] ||
      abort "os argumentos de \`plan\` não são <pai> e <ticket>: o comando agora é \`plan <pai> <ticket> [<commit>]\`, com a issue pai antes do ticket." \
        "passe a issue pai e o ticket, os dois no formato PREFIXO-N, como em \`$plan_example\`."
    run_plan "$@"
    exit $?
    ;;
  review)
    # Os insumos não são verificação: não aprovam nada.
    review_example='scripts/verify.sh review PROJ-1 PROJ-123` ou `scripts/verify.sh review sem-ticket <nome>'
    [[ $# -eq 2 ]] ||
      abort "o \`review\` recebe dois argumentos: \`review <pai> <ticket>\`, ou \`review sem-ticket <nome>\`." \
        "passe a issue pai e o ticket, ou \`sem-ticket\` e um nome curto, como em \`$review_example\`."
    if [[ "$1" == sem-ticket ]]; then
      [[ "$2" =~ ^[a-z0-9][a-z0-9-]*$ ]] ||
        abort "o nome \`$2\` não vale para uma mudança sem ticket." \
          "use só letras minúsculas, algarismos e hífens, começando por letra ou algarismo, como em \`scripts/verify.sh review sem-ticket skill-de-revisao\`."
    else
      [[ "$1" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ && "$2" =~ ^[A-Z][A-Z0-9]*-[0-9]+$ ]] ||
        abort "os argumentos de \`review\` não são <pai> e <ticket>." \
          "passe a issue pai e o ticket, os dois no formato PREFIXO-N, como em \`$review_example\`."
    fi
    run_review "$@"
    exit $?
    ;;
  *) usage ;;
esac

if [[ ${#failures[@]} -gt 0 ]]; then
  printf '\nREPROVADO: %d verificação(ões) falharam.\n' "${#failures[@]}" >&2
  for failure in "${failures[@]}"; do
    printf -- '- %s\n' "$failure" >&2
  done
  # A trava conta a reprovação pelos nomes dos passos que falharam.
  if [[ $lock == yes ]]; then
    names=()
    for failure in "${failures[@]}"; do
      names+=("${failure%%$'\n'*}")
    done
    count="$(full_lock_record_failure "${names[@]}")"
    if [[ "$count" -ge $FULL_LOCK_LIMIT ]]; then
      printf '\nTRAVADO: é a %dª reprovação seguida nos mesmos passos, e o modo completo travou. Até destravar, o `full` recusa rodar.\n' "$count" >&2
      printf 'Como resolver: %s\n' "$FULL_LOCK_ASK" >&2
    elif [[ "$count" -gt 1 ]]; then
      printf '\nÉ a %dª reprovação seguida nos mesmos passos. Na %dª, o modo completo trava: rode de novo só depois de corrigir a causa.\n' \
        "$count" "$FULL_LOCK_LIMIT" >&2
    fi
  fi
  exit 1
fi

if [[ ${#apps[@]} -gt 0 ]]; then
  printf '\nAPROVADO (%s %s).\n' "$mode" "${apps[*]}"
  printf 'Isto não libera o push: rode `scripts/verify.sh full`, sem apps, antes de enviar.\n'
  exit 0
fi

# Registra o que o modo completo aprovou, para o hook de antes do push conferir.
if [[ "$mode" == full ]]; then
  mkdir -p "$(dirname "$APPROVAL_FILE")"
  printf 'state=%s\nacceptance=%s\n' "$verified_state" \
    "$([[ -n "${ACCEPTANCE_BODY_FILE:-}" ]] && echo checked || echo skipped)" >"$APPROVAL_FILE"
  [[ $lock == yes ]] && full_lock_reset
fi

printf '\nAPROVADO (%s).\n' "$mode"
