# Aceite do KAN-15

O ticket traz a participação societária. A `api` ganha a tabela `equity_stake` e três rotas na empresa: a lista das participações, o registro e o encerramento. O registro confere a fração, o período, a soma vigente e o ciclo (LLD, regra 6.2). A `web` ganha a seção "Participações societárias" no detalhe da empresa, com a tabela, o formulário de registrar e o de encerrar.

O CA1, o CA2, o CA3, o CA4, o CA6 e o CA7 rodam na `api`, no Vitest, contra o PostgreSQL real do `finance_test`, com a app inteira montada. O usuário nasce pelo comando `create-user` e cadastra as entidades pela rota, e por isso tem `operate` nelas. Cada teste cria as próprias entidades, e as participações de uma empresa só dependem dela, então os registros de outras execuções não interferem. O CA6 lê a auditoria direto no banco, como os testes de auditoria do KAN-11 e do KAN-12, porque ainda não há rota que a leia.

O CA5 roda no Playwright contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o caminho pela tela. O teste cria o próprio usuário e as entidades dele pela `api`.

## KAN-15-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com uma empresa e uma pessoa física, quando ele registra a participação da pessoa física na empresa com a fração "0.25", o início 01/03/2022 e sem fim, então a rota responde 201 com o sócio (id, tipo, nome e `active`), a fração "0.25000000", o início "2022-03-01", o fim nulo e a versão 1. Quando ele registra outra, de uma segunda empresa como sócia, com a fração "0.125", o início 01/01/2023 e o fim 31/12/2024, então ela volta com o fim "2024-12-31". Quando ele lista as participações da empresa, então a lista traz as duas, com o total 2, a sem fim primeiro. Quando ele manda a fração "0", "1.5" ou "0.123456789", o início "01/03/2022", ou o fim antes do início, então a rota responde 400 `INVALID_INPUT`, com o campo em `fields`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/equity-stakes.int.test.ts`, "o usuário registra a participação de uma entidade numa empresa, com a fração e o período".

## KAN-15-CA2

**Marca:** teste HTTP

**Cenário:** Dada uma empresa com a participação de uma pessoa física de 0.6, sem fim, desde 01/01/2024, quando o usuário registra a de outra pessoa física de 0.4 desde 01/06/2024, então ela é aceita, e a soma vigente chega a 1. Quando ele registra a de uma terceira de 0.01 desde 01/01/2025, ou uma de 0.5 de 01/01/2020 a 31/01/2024, que se sobrepõe à de 0.6 em janeiro de 2024 e a passaria de 1 nesse mês, então a rota responde 422 `EQUITY_STAKE_OVER_LIMIT`, e a lista continua com as duas.

**Teste previsto:** integração da API no Vitest, `apps/api/test/equity-stakes.int.test.ts`, "uma soma vigente acima de 100% é recusada".

## KAN-15-CA3

**Marca:** teste HTTP

**Cenário:** Dadas três empresas A, B e C, com A sócia de B e B sócia de C, quando o usuário registra C como sócia de A, então a rota responde 422 `EQUITY_STAKE_CYCLE`. Quando a participação de B em C é encerrada e ele tenta de novo, então a rota também responde 422 `EQUITY_STAKE_CYCLE`, porque o ciclo conta as encerradas. Quando ele registra C como sócia de uma quarta empresa D, fora da cadeia, então ela é aceita.

**Teste previsto:** integração da API no Vitest, `apps/api/test/equity-stakes.int.test.ts`, "uma participação que fecharia um ciclo é recusada".

## KAN-15-CA4

**Marca:** teste HTTP

**Cenário:** Dados uma empresa e duas pessoas físicas, quando o usuário registra a participação de uma pessoa física noutra pessoa física, então a rota responde 422 `EQUITY_STAKE_REQUIRES_COMPANY`. Quando ele registra a empresa como sócia dela mesma, então a rota responde 422 `EQUITY_STAKE_SELF`. Quando o sócio é um UUID que não é de nenhuma entidade, então a rota responde 422 `ENTITY_NOT_FOUND`, e quando é uma pessoa física desativada, 422 `INACTIVE_ENTITY`. Nenhum desses registros entra na lista da empresa.

**Teste previsto:** integração da API no Vitest, `apps/api/test/equity-stakes.int.test.ts`, "só pessoa jurídica recebe participação, e nenhuma empresa participa de si mesma".

## KAN-15-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma empresa e uma pessoa física, quando ele abre o detalhe da empresa, então vê a seção "Participações societárias" sem nenhuma participação. Quando ele clica em "Registrar participação", busca e escolhe a pessoa física como sócio, informa a fração "60", o início 01/03/2022 e registra, então a tabela mostra o sócio, "60,0%" e "desde 01/03/2022". Quando ele encerra essa participação com o último dia 30/11/2026, então a linha mostra o período "01/03/2022 a 30/11/2026" e não oferece mais o "Encerrar". O detalhe de uma pessoa física não mostra a seção.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/equity-stakes.spec.ts`, "na tela da empresa, o usuário vê, registra e encerra as participações dela".

## KAN-15-CA6

**Marca:** teste de integração

**Cenário:** Dada uma empresa, quando o usuário registra a participação de uma pessoa física nela e depois a encerra, então a auditoria da empresa traz, na tabela `equity_stake` e com o id da participação, a criação, com o antes nulo e o depois com a fração e o início, e a alteração, com o antes sem fim e o depois com o último dia e a versão 2. Um registro recusado pela soma não deixa nada na auditoria.

**Teste previsto:** integração da API no Vitest, `apps/api/test/equity-stakes.int.test.ts`, "as participações ficam na auditoria".

## KAN-15-CA7

**Marca:** teste HTTP

**Cenário:** Dada uma empresa com a participação de uma pessoa física de 1, sem fim, desde 01/01/2024, quando o usuário a encerra com o último dia 30/06/2024 e a versão lida, então a rota responde 200 com o fim "2024-06-30" e a versão 2. Quando ele registra a de outra pessoa física de 1 desde 01/07/2024, então ela é aceita, e uma desde 30/06/2024 responde 422 `EQUITY_STAKE_OVER_LIMIT`. Quando ele encerra de novo a mesma participação, então a rota responde 422 `EQUITY_STAKE_ENDED`; com uma versão antiga, numa participação sem fim, 409 `VERSION_CONFLICT`; com o último dia antes do início, 400 `INVALID_INPUT`; e com o id de uma participação de outra empresa, 404 `NOT_FOUND`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/equity-stakes.int.test.ts`, "uma participação encerrada deixa de contar na soma vigente depois do último dia".
