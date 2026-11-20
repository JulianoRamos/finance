# Aceite do KAN-24

O ticket cria a movimentação manual e o saldo da conta: a tabela `movement`, as rotas `POST` e `GET /v1/accounts/{id}/movements` e `GET /v1/accounts/{id}/balance`, o saldo de hoje em cada conta e, na tela Contas, os saldos, a seção Movimentações e o diálogo de nova movimentação (LLD, seções 4.4 e 4.5 e regra 6.3; design system, seções 4.4 e 4.5).

Os CA1 a CA3 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que as rotas devolvem e recusam: a permissão na entidade dona, a conta desativada, o valor positivo, a soma do saldo e a ordem da lista. O saldo depende de "hoje", então os testes fixam o relógio da app (`TestClock`) num instante conhecido e conferem o dia dele no fuso da `api`. O CA4 é um teste de integração da auditoria, pela rota do histórico da conta e pelo registro gravado. O banco de teste guarda os registros de outros testes, então cada teste cria as próprias entidades e contas.

O CA5 roda no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o que a pessoa vê na tela: registrar e ver os três saldos mudarem.

## KAN-24-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `operate` numa pessoa física, com uma conta ativa nela, e só `view` noutra, com outra conta, quando ele registra na primeira uma saída de "182.45" em 2026-11-19 com a descrição "Mercado Bom Preço", então a rota responde 201 com a movimentação, os campos como foram enviados e a origem `manual`. Com o valor "0", "-10" ou "1.234", a rota responde 400 `INVALID_INPUT`, com o motivo em `amount`; sem a descrição ou com o sentido "sideways", 400 com o motivo no campo. Na conta da entidade em que ele só tem `view`, a rota responde 403 `FORBIDDEN`; numa conta que não existe, 404 `NOT_FOUND`; depois de desativar a primeira conta, 422 `INACTIVE_ACCOUNT`; e numa conta ativa de uma entidade desativada, 422 `INACTIVE_ENTITY`.

**Teste previsto:** integração da `api`, `test/movements.int.test.ts`, "registra a movimentação manual e recusa o valor que não é positivo e a conta desativada".

## KAN-24-CA2

**Marca:** teste HTTP

**Cenário:** Dado uma conta com o saldo inicial "100.00" em 2026-09-01 e as movimentações: entrada de "1000.00" em 2026-08-31, entrada de "50.00" em 2026-09-01, saída de "30.25" em 2026-09-10 e entrada de "10.00" em 2026-09-20, quando o usuário lê o saldo em 2026-09-01, 2026-09-10, 2026-09-19 e 2026-09-20, então a rota responde "150.00", "119.75", "119.75" e "129.75", cada um com a data pedida: a entrada de antes do saldo inicial não entra, e a do próprio dia entra. Sem a data, com o relógio da app em 2026-09-15, a rota responde o saldo desse dia, "119.75". Com a data 2026-08-31, antes do saldo inicial, a rota responde 422 `DATE_BEFORE_OPENING_BALANCE`; com a data "31/08/2026", 400 `INVALID_INPUT`.

**Teste previsto:** integração da `api`, `test/movements.int.test.ts`, "o saldo numa data soma as movimentações desde o saldo inicial, inclusive".

## KAN-24-CA3

**Marca:** teste HTTP

**Cenário:** Dado uma conta com cinco movimentações em três datas, duas delas no mesmo dia, registradas uma depois da outra, quando o usuário lista as movimentações com `pageSize` 2, então a página 1 traz as duas mais recentes, com a data, a descrição, o valor, o sentido e a origem, a última registrada primeiro no mesmo dia, e o total 5; a página 3 traz a mais antiga. Quando ele lista as contas do contexto da entidade, com o relógio da app num dia depois de todas, então cada conta traz o saldo de hoje em `balance`, e a leitura da conta pelo id traz o mesmo saldo. Uma conta sem movimentações traz o saldo inicial.

**Teste previsto:** integração da `api`, `test/movements.int.test.ts`, "lista as movimentações da mais recente para a mais antiga e a conta traz o saldo de hoje".

## KAN-24-CA4

**Marca:** teste de integração

**Cenário:** Dado uma conta, quando o usuário registra uma entrada com um identificador de requisição próprio, então o registro de auditoria da movimentação tem a tabela `movement`, a entidade dona da conta, o usuário e esse identificador, e o histórico da conta traz a alteração, da mais recente para a mais antiga, com o nome dele, a criação da movimentação e os campos preenchidos (a data, a descrição, o valor, o sentido e a origem), depois da criação da conta. Um usuário sem permissão na entidade recebe 403 `FORBIDDEN` no histórico.

**Teste previsto:** integração da `api`, `test/movements.int.test.ts`, "o registro da movimentação fica na auditoria e no histórico da conta".

## KAN-24-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física de nome próprio do teste, como contexto financeiro, e uma conta nela com o saldo inicial de R$ 1.000,00 num dia passado, quando ele abre a conta, clica em "Nova movimentação" e registra uma saída de R$ 200,00 com a data de hoje, então o diálogo fecha, a seção Movimentações mostra a saída e o saldo de hoje, no detalhe e na lista, passa a R$ 800,00. Quando ele registra uma entrada de R$ 50,00 num dia anterior a hoje e escolhe esse dia no "Saldo em", então o saldo de hoje passa a R$ 850,00 e o saldo nesse dia mostra R$ 1.050,00.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/movements.spec.ts`, "o usuário registra uma saída e uma entrada e vê os saldos mudarem".
