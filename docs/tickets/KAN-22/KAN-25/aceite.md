# Aceite do KAN-25

O ticket cria o ajuste do saldo: a origem `adjustment` da movimentação, a rota `POST /v1/accounts/{id}/adjustments` e, na tela Contas, o botão "Ajustar saldo", o diálogo do ajuste e a origem "Ajuste" nas movimentações (LLD, seção 4.5 e regra 6.3; design system, seções 4.4 e 4.5).

Os CA1 e CA2 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que a rota grava e recusa: a diferença calculada, o sentido dela e o saldo que passa a bater. O ajuste fica numa data, e o saldo é lido pela rota do saldo nessa data, então os testes não dependem de "hoje". O CA3 é um teste de integração da auditoria, pelo registro gravado e pelo histórico da conta. O banco de teste guarda os registros de outros testes, então cada teste cria as próprias entidades e contas.

O CA4 roda no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o que a pessoa vê no diálogo: o saldo calculado, o do banco e a diferença, a recusa sem motivo e o ajuste na lista.

## KAN-25-CA1

**Marca:** teste HTTP

**Cenário:** Dado uma conta com o saldo inicial "100.00" em 2026-09-01 e uma saída de "30.00" em 2026-09-10, quando o usuário com `operate` ajusta o saldo em 2026-09-10 para "50.00" com o motivo "Tarifa não lançada", então a rota responde 201 com uma movimentação de origem `adjustment`, em 2026-09-10, saída de "20.00", com a descrição "Tarifa não lançada", e o saldo em 2026-09-10 passa a "50.00"; o saldo em 2026-09-09 continua "100.00". Quando ele ajusta em 2026-09-20 para "80.00", então o ajuste é uma entrada de "30.00", e o saldo em 2026-09-20 passa a "80.00". Um saldo do banco negativo, como "-10.00", também é aceito, e o ajuste é a saída da diferença.

**Teste previsto:** integração da `api`, `test/adjustments.int.test.ts`, "o ajuste grava a diferença para o saldo do banco, e o saldo passa a bater".

## KAN-25-CA2

**Marca:** teste HTTP

**Cenário:** Dado uma conta com o saldo inicial "100.00" em 2026-09-01, quando o usuário ajusta o saldo em 2026-09-10 sem o motivo, ou com um motivo só de espaços, então a rota responde 400 `INVALID_INPUT`, com o motivo em `reason`; com o saldo do banco "100.00", igual ao calculado, 422 `BALANCE_ALREADY_MATCHES`; com a data 2026-08-31, antes do saldo inicial, 422 `DATE_BEFORE_OPENING_BALANCE`. Nenhuma dessas recusas grava movimentação: a lista da conta continua vazia. Um usuário que só tem `view` na entidade recebe 403 `FORBIDDEN`, e a conta desativada, 422 `INACTIVE_ACCOUNT`.

**Teste previsto:** integração da `api`, `test/adjustments.int.test.ts`, "o ajuste sem motivo, igual ao saldo calculado ou antes do saldo inicial é recusado".

## KAN-25-CA3

**Marca:** teste de integração

**Cenário:** Dado uma conta, quando o usuário registra um ajuste com um identificador de requisição próprio, então o registro de auditoria dele tem a tabela `movement`, a entidade dona da conta, o usuário, esse identificador e, no depois, a origem `adjustment` e o motivo na descrição; e o histórico da conta traz a criação do ajuste, com o nome dele, a data, a descrição, o valor, o sentido e a origem `adjustment`, antes da criação da conta.

**Teste previsto:** integração da `api`, `test/adjustments.int.test.ts`, "o ajuste fica na auditoria, com o motivo, e no histórico da conta".

## KAN-25-CA4

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física de nome próprio do teste, como contexto financeiro, e uma conta nela com o saldo inicial de R$ 1.000,00 num dia passado, quando ele abre a conta, clica em "Ajustar saldo", escolhe a data de hoje e informa o saldo do banco de R$ 987,10, então o diálogo mostra o saldo calculado de R$ 1.000,00, o do banco de R$ 987,10 e o ajuste de saída de R$ 12,90. Quando ele registra sem o motivo, então o diálogo fica aberto com "Diga por que o saldo difere do banco." no campo. Quando ele escreve o motivo e registra, então o diálogo fecha, a seção Movimentações mostra o ajuste com a origem "Ajuste" e o motivo, e o saldo de hoje passa a R$ 987,10.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/adjustments.spec.ts`, "o usuário ajusta o saldo ao do banco e vê o ajuste na conta".
