# Aceite do KAN-29

O ticket cria o pagamento de uma parcela, pelas rotas do módulo Conciliação: o lançamento já pago (`POST /v1/paid-entries`), o pagamento de uma parcela em aberto e o desfazer dele (`POST` e `DELETE /v1/installment-payments`), e a lista dos pagamentos de um lançamento (`GET /v1/installment-payments`), com a tabela `reconciliation` e a soma conciliada na parcela (LLD, seções 4.6 e 4.8, e regras 6.5 e 6.6). Na tela Lançamentos, o "Já pago" do formulário e o menu de ações da parcela, com o "Marcar como paga", o "Ver o pagamento" e o "Desfazer pagamento".

O CA1, o CA2 e o CA3 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que as rotas gravam e recusam: a situação das parcelas, pela lista das parcelas do lançamento, a movimentação, pela lista das movimentações da conta, e o saldo, pela rota do saldo. O relógio do teste fica num dia fixo, para a situação prevista ou vencida não depender de quando o teste roda. O CA4 é um teste de integração da auditoria, pelos registros gravados. Cada teste cria a própria pessoa física, as contas e as categorias, com nomes únicos.

A situação liquidada também tem teste de unidade da função pura da situação, que passa a receber a soma conciliada; ele não leva tag de critério.

A recusa de pagar uma parcela cancelada saiu deste ticket para o KAN-30 (CA6), porque o cancelamento nasce lá (decisão do usuário no plano).

O CA5 roda no Playwright, contra a `web` e a `api` de desenvolvimento, numa tela larga, porque o menu de ações da parcela fica na tabela das parcelas, que no Conteúdo estreito vira a lista sem ações (o menu no celular é de outro ticket).

## KAN-29-CA1

**Marca:** teste HTTP

**Cenário:** Dado o relógio do teste em 15/11/2026 e um usuário com `operate` numa pessoa física com duas contas ativas, de saldo inicial zero em 01/11/2026, e as categorias de receita e de despesa, quando ele registra pelo já pago uma receita à vista de R$ 1.200,00 com o recebimento na segunda conta em 10/11/2026, então a rota responde 201 com o lançamento, a parcela única está liquidada (`settled`), a lista dos pagamentos traz um, de R$ 1.200,00, nessa conta e nessa data, a segunda conta tem a movimentação manual de entrada de R$ 1.200,00 nesse dia e o saldo dela em 15/11 é R$ 1.200,00. Quando ele registra pelo já pago uma despesa de R$ 100,00 em 3 parcelas, com o pagamento na primeira conta em 12/11, então só a parcela 1, de R$ 33,34, está liquidada, as outras duas estão previstas, e o saldo da primeira conta em 15/11 é −R$ 33,34.

**Teste previsto:** integração da `api`, `test/installment-payments.int.test.ts`, "o já pago cria o lançamento com a primeira parcela paga, a movimentação e a conciliação".

## KAN-29-CA2

**Marca:** teste HTTP

**Cenário:** Dado o relógio do teste em 15/11/2026 e uma despesa de R$ 300,00 em 3 parcelas com o primeiro vencimento em 05/11/2026, numa conta de saldo inicial zero, quando o usuário paga a parcela 1, vencida, com a conta e a data de 14/11, então a rota responde 201 com o pagamento de R$ 100,00, a parcela 1 fica liquidada e o saldo da conta em 15/11 é −R$ 100,00. Quando ele desfaz esse pagamento, então a rota responde 204, a lista dos pagamentos do lançamento fica vazia, a movimentação some da lista das movimentações da conta, a parcela 1 volta a vencida (`overdue`) e o saldo em 15/11 volta a R$ 0,00.

**Teste previsto:** integração da `api`, `test/installment-payments.int.test.ts`, "paga uma parcela em aberto e desfaz o pagamento, com o saldo de antes".

## KAN-29-CA3

**Marca:** teste HTTP

**Cenário:** Dado uma despesa em 2 parcelas, com a parcela 1 paga, e uma conta desativada da mesma pessoa física, quando o usuário paga de novo a parcela 1, então a rota responde 422 `INSTALLMENT_ALREADY_SETTLED`. Quando ele paga a parcela 2 na conta desativada, então responde 422 `INACTIVE_ACCOUNT`, e pelo já pago, com a conta do pagamento desativada, 422 `INACTIVE_PAYMENT_ACCOUNT`. Nenhum pagamento nem movimentação é gravado nas recusas.

**Teste previsto:** integração da `api`, `test/installment-payments.int.test.ts`, "recusa pagar a parcela já paga e pagar numa conta desativada".

## KAN-29-CA4

**Marca:** teste de integração

**Cenário:** Dado um usuário com `operate` numa pessoa física e uma despesa à vista em aberto, quando ele paga a parcela e desfaz o pagamento, cada pedido com um identificador de requisição próprio, então a auditoria tem, no pagamento, a criação da movimentação (`movement`), a da conciliação (`reconciliation`) e a alteração da parcela (`installment`, com a soma conciliada de zero ao valor) e, no desfazer, a exclusão da conciliação e da movimentação e a alteração da parcela de volta a zero, todos com o usuário, o identificador do pedido e a pessoa física como entidade.

**Teste previsto:** integração da `api`, `test/installment-payments.int.test.ts`, "o pagamento e o desfazer ficam na auditoria".

## KAN-29-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física de nome próprio do teste, uma conta dela de saldo inicial R$ 1.000,00 e uma despesa dela em 2 parcelas com a primeira vencida, no contexto dessa pessoa, numa tela larga, quando ele abre "Novo lançamento", escolhe a receita, preenche-a à vista com R$ 250,00, marca o "Já pago" com a conta e a data de hoje e registra, então o detalhe mostra a parcela liquidada, e o detalhe da conta mostra o saldo de hoje de R$ 1.250,00. Quando ele abre o detalhe da despesa e, no menu da parcela 1, vencida, escolhe "Marcar como paga" e confirma no diálogo, então a parcela fica liquidada, com a data do pagamento. Quando, no menu dela, ele escolhe "Desfazer pagamento" e confirma, então ela volta a vencida.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/installment-payments.spec.ts`, "o usuário registra uma receita já paga, paga uma parcela vencida e desfaz o pagamento".
