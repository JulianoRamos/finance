# Aceite do KAN-28

O ticket cria o lançamento de receita e de despesa das pessoas físicas, à vista ou parcelado, com as parcelas: as tabelas `entry` e `installment`, as rotas `GET` e `POST /v1/entries`, `GET /v1/entries/{id}` e `GET /v1/entries/{id}/installments`, o total do mês na árvore de categorias e a tela Lançamentos (LLD, seção 4.6, e regras 6.6, 6.8 e 6.21; design system, seções 4.1, 4.3, 4.4 e 4.5).

O CA1, o CA2, o CA3 e o CA6 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que as rotas gravam, recusam, listam e somam. O CA3 põe o relógio do teste num dia fixo, para a situação prevista ou vencida não depender de quando o teste roda. O CA4 é um teste de integração da auditoria, pelos registros gravados. Cada teste cria a própria pessoa física, a conta e as categorias, com nomes únicos, e lista pelo contexto dessa pessoa, sem contar com o resto do banco de teste.

A divisão do total em centavos e a situação da parcela também têm testes de unidade das funções puras do módulo, como a spec pede; eles não levam tag de critério.

O CA5 roda no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o que a pessoa faz na tela: preencher o parcelado, ver a prévia, registrar e achar o lançamento na lista do mês e as parcelas no detalhe.

## KAN-28-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `operate` numa pessoa física com uma conta ativa e as categorias de despesa e de receita, quando ele registra uma despesa de R$ 100,00 em 3 parcelas, com o primeiro vencimento em 31/01 e a finalidade familiar, então a rota responde 201 com o lançamento na versão 1, e as parcelas dele são 1 de R$ 33,34 em 31/01, 2 de R$ 33,33 em 28/02 e 3 de R$ 33,33 em 31/03, na conta dada, somando o total. Quando ele registra uma receita à vista de R$ 1.200,00, sem finalidade, então ela tem uma parcela só, de R$ 1.200,00, no recebimento dado.

**Teste previsto:** integração da `api`, `test/entries.int.test.ts`, "registra a despesa parcelada e a receita à vista, com as parcelas mensais e os centavos na primeira".

## KAN-28-CA2

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `operate` numa pessoa física com uma conta, quando ele registra uma despesa sem a finalidade ou uma receita com a finalidade, então a rota responde 400 `INVALID_INPUT` com a finalidade em `fields`. Quando a categoria é de outra natureza, responde 422 `CATEGORY_NATURE_MISMATCH`; quando ela está desativada, 422 `INACTIVE_CATEGORY`. Quando a entidade é uma pessoa física em que ele só tem `view`, responde 403 `FORBIDDEN`. Nenhum lançamento é gravado nas recusas.

**Teste previsto:** integração da `api`, `test/entries.int.test.ts`, "recusa a finalidade fora da regra, a categoria de outra natureza ou desativada e a entidade sem operate".

## KAN-28-CA3

**Marca:** teste HTTP

**Cenário:** Dado o relógio do teste em 15/11/2026 e uma pessoa física com 11 despesas que vencem em novembro, uma delas parcelada desde outubro, uma receita de novembro e uma despesa de dezembro, e outra pessoa física fora do contexto com uma despesa de novembro, quando o usuário lista novembro com o contexto da primeira, então a lista traz as 12 parcelas de novembro, 10 na primeira página, pelo vencimento, da mais recente para a mais antiga, e a parcelada aparece como a parcela 2 dela; a que venceu antes de 15/11 é vencida (`overdue`), e a que vence a partir dele, prevista (`expected`). Com o tipo `revenue`, traz só a receita; com a busca por um trecho da descrição sem acento, só o lançamento que o tem; e a despesa de dezembro e a da outra pessoa física não aparecem.

**Teste previsto:** integração da `api`, `test/entries.int.test.ts`, "lista as parcelas do mês do contexto, com o tipo, a busca, a página e a situação".

## KAN-28-CA4

**Marca:** teste de integração

**Cenário:** Dado um usuário com `operate` numa pessoa física, quando ele registra uma despesa em 2 parcelas com um identificador de requisição próprio, então a auditoria tem o registro da criação do lançamento, na tabela `entry`, e o de cada parcela, na tabela `installment`, todos com o usuário, esse identificador e a pessoa física como entidade.

**Teste previsto:** integração da `api`, `test/entries.int.test.ts`, "a criação do lançamento e das parcelas fica na auditoria".

## KAN-28-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física de nome próprio do teste e uma conta dela, no contexto dessa pessoa, quando ele abre Lançamentos, vai a "Novo lançamento", escolhe a despesa, preenche a descrição de nome próprio do teste, o total de R$ 1.000,00, a categoria, a finalidade e o parcelado em 3 vezes com o primeiro vencimento no mês corrente, então a prévia mostra a 1ª parcela de R$ 333,34 e as outras de R$ 333,33. Quando ele registra, então a lista do mês corrente traz o lançamento como a parcela 1 de 3, e o detalhe mostra as 3 parcelas com o vencimento e a situação.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/entries.spec.ts`, "o usuário registra uma despesa parcelada, vê a prévia e acha as parcelas".

## KAN-28-CA6

**Marca:** teste HTTP

**Cenário:** Dado uma categoria de despesa de primeiro nível com uma subcategoria, ambas com nomes únicos do teste, uma pessoa física em que o usuário tem `operate`, com uma despesa de novembro de R$ 100,00 na categoria e uma de R$ 50,25 na subcategoria, uma despesa de dezembro na subcategoria, e outra pessoa física em que ele não tem permissão, com uma despesa de novembro na subcategoria, quando ele lista a árvore de despesa com o mês `2026-11` e a busca pelo nome da categoria, então a subcategoria tem o total de R$ 50,25 e a categoria de primeiro nível, o de R$ 150,25. Com o mês `2026-12`, a subcategoria e a de primeiro nível têm o total da despesa de dezembro.

**Teste previsto:** integração da `api`, `test/entries.int.test.ts`, "a árvore traz o total do mês de cada categoria, com o pai somando as subcategorias".
