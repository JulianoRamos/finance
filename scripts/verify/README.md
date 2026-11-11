# Grupos de verificação das apps

Cada app de `apps/` tem aqui o próprio grupo, `scripts/verify/<app>.sh`, que o `scripts/verify.sh` carrega quando a app está registrada na lista `APPS` dele. O nome é o da pasta em `apps/` e o do serviço no `compose.dev.yaml`.

O grupo define:

- `<app>_fast`: os tipos e o lint, que o hook de fim de turno roda.
- `<app>_full`: o `<app>_fast` e todas as suítes de teste da app, cada uma com o relatório conferido pelo `check_report`.
- `<app>_reports`: os relatórios que o aceite confere, como `<formato>:<relatório, relativo à pasta da app>`. Os formatos que o conferidor lê estão no `scripts/check-acceptance.cjs`.
- `<app>_contract_drift`, opcional: o aviso de que o contrato mudou depois do commit de plano.
- `<app>_contract_view`, só na app dona do contrato: a visão legível do contrato e do schema entre dois pontos do Git, no formato da skill de plano. Essa app acrescenta os arquivos do contrato a `CONTRACT_FILES`.

Os auxiliares que o grupo usa (`step`, `in_container`, `require_container`, `check_report`, `node_in_harness`, `plain_diff`, `responds`, `wait_for`, `abort`, `fail`) são do `scripts/verify.sh`.
