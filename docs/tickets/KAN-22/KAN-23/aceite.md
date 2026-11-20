# Aceite do KAN-23

O ticket cria o módulo Contas: a tabela `account`, as rotas de `/v1/accounts` e a tela Contas, no grupo "Dinheiro" da barra lateral (LLD, seções 4.5 e 6.20; design system, seções 4.1, 4.4 e 4.5).

Os CA1 a CA4 e o CA6 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que as rotas devolvem e recusam: a permissão na entidade dona, o filtro do contexto financeiro, a dona que não muda, a desativação e o conflito de versão. O CA5 é um teste de integração da auditoria pela rota do histórico da conta, que lê o que a auditoria gravou. O banco de teste guarda os registros de outros testes, então cada teste cria as próprias entidades e contas, com um marcador próprio no nome, e busca por ele.

O CA7 roda no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o que a pessoa faz na tela: cadastrar, editar e desativar. O CA8 é a revisão humana das telas contra a referência visual, que nenhum teste automático compara.

## KAN-23-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `operate` numa pessoa física e só `view` numa empresa, quando ele cadastra uma conta corrente do Nubank na pessoa física, como conta de reserva, com o saldo inicial "-150.25" em 2026-09-01, então a rota responde 201 com a conta ativa, na versão 1, com a entidade dona e o nome dela e os campos como foram enviados. Quando ele cadastra uma conta na empresa, então a rota responde 403 `FORBIDDEN`; numa entidade que não existe, 403 `FORBIDDEN`; e numa entidade desativada em que ele tem `operate`, 422 `INACTIVE_ENTITY`. Sem o nome, com o tipo `credit_card` ou com o saldo inicial "12.345", a rota responde 400 `INVALID_INPUT`, com o motivo no campo.

**Teste previsto:** integração da `api`, `test/accounts.int.test.ts`, "cadastra a conta na entidade em que o usuário opera e recusa nas outras".

## KAN-23-CA2

**Marca:** teste HTTP

**Cenário:** Dado um marcador próprio do teste e duas pessoas físicas, A e B, num grupo, com três contas em A (uma delas desativada) e duas em B, e uma terceira entidade C, fora do grupo, com uma conta, todas com o marcador no nome, quando o usuário lista as contas com o contexto do grupo e a busca pelo marcador, sem acento e em minúsculas, então a resposta traz as cinco contas de A e B, as ativas primeiro e cada grupo pelo nome, com o total 5, e não a de C. Com `pageSize` 2, a página 3 traz uma conta, e a página 4 vem vazia, com o total 5. Com `active=true`, a desativada não vem. Com o contexto da entidade C, só a conta de C vem. Sem o cabeçalho `Financial-Context`, a rota responde 400 `INVALID_INPUT`.

**Teste previsto:** integração da `api`, `test/accounts.int.test.ts`, "lista as contas do contexto, paginadas e com a busca".

## KAN-23-CA3

**Marca:** teste HTTP

**Cenário:** Dado uma conta corrente do Itaú numa pessoa física em que o usuário tem `operate`, quando ele a edita, com a versão lida, para conta de pagamento do Mercado Pago, com outro nome, como conta de reserva e com outro saldo inicial e outra data, então a rota responde 200 com os campos novos, na versão 2, e a leitura pelo id devolve o mesmo. Quando ele edita mandando outra entidade, em que também tem `operate`, então a rota responde 422 `ACCOUNT_OWNER_IMMUTABLE` e a conta não muda. Um usuário com só `view` na entidade lê a conta e, ao editá-la, recebe 403 `FORBIDDEN`; e uma conta que não existe responde 404 `NOT_FOUND`.

**Teste previsto:** integração da `api`, `test/accounts.int.test.ts`, "edita a conta e recusa a troca da entidade dona".

## KAN-23-CA4

**Marca:** teste HTTP

**Cenário:** Dado uma conta ativa, quando o usuário a desativa com a versão lida, então ela volta desativada, na versão seguinte, sai da lista com `active=true` e continua na lista sem o filtro e na leitura pelo id. Quando ele pede a desativação de novo, com a versão antiga, então a rota responde 200 sem mudar a versão. Quando ele a reativa, então ela volta à lista com `active=true`. Quando ele edita a conta mandando uma versão que não é a atual, então a rota responde 409 `VERSION_CONFLICT`. Não há rota de exclusão.

**Teste previsto:** integração da `api`, `test/accounts.int.test.ts`, "desativa e reativa a conta, sem excluir, e recusa a versão antiga".

## KAN-23-CA5

**Marca:** teste de integração

**Cenário:** Dado uma conta que o usuário cadastrou, editou (o nome e o saldo inicial), desativou e reativou, quando ele lê o histórico da conta, então a página traz as quatro alterações, da mais recente para a mais antiga, com o nome dele e o identificador da requisição de cada uma na auditoria: a reativação e a desativação, com o `active`; a edição, só com o nome e o saldo inicial, antes e depois; e a criação, com os campos preenchidos. O registro de auditoria de cada uma tem a entidade dona da conta. Um usuário sem permissão na entidade recebe 403 `FORBIDDEN` no histórico.

**Teste previsto:** integração da `api`, `test/accounts.int.test.ts`, "a criação, a edição e a desativação da conta ficam na auditoria e no histórico".

## KAN-23-CA6

**Marca:** teste HTTP

**Cenário:** Dado um marcador próprio do teste, uma conta "Ávila <marcador>" numa entidade em que o usuário tem `view`, uma conta de reserva e uma desativada com o mesmo começo de nome na mesma entidade, e uma conta "Ávila <marcador>" numa entidade em que ele não tem permissão, quando ele pesquisa "avila <marcador>", então a lista `accounts` da resposta traz as três contas da entidade que ele vê, as ativas primeiro e cada grupo pelo nome, cada uma com o nome da entidade dona, o banco, se é de reserva e se está ativa, e não a outra. A leitura da conta pelo id, que o resultado abre, responde 200.

**Teste previsto:** integração da `api`, `test/search.int.test.ts`, "acha as contas das entidades que o usuário vê".

## KAN-23-CA7

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física de nome próprio do teste, como contexto financeiro, quando ele abre "Contas" na barra lateral, clica em "Nova conta" e cadastra a conta com o nome próprio do teste, a entidade, o tipo, o banco, a conta de reserva marcada e o saldo inicial, então o detalhe da conta abre e a lista a mostra com o selo "Reserva". Quando ele clica em "Editar dados", troca o nome e salva, então o detalhe e a lista mostram o nome novo. Quando ele clica em "Desativar conta" e confirma, então o detalhe diz que a conta está desativada, a lista a mostra com o selo "Desativada", e o foco volta ao botão que abriu a confirmação.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/accounts.spec.ts`, "o usuário cadastra, edita e desativa uma conta".

## KAN-23-CA8

**Marca:** revisão humana

**Cenário:** Dado as telas Contas e ContasCelular da referência visual, no recorte do ticket, quando o revisor abre a tela Contas em 1440×900 e em 390×844, nos temas claro e escuro, na lista com detalhe, na lista vazia, no erro de carregamento, na nova conta, na edição e na confirmação de desativar, então a estrutura, os textos, os tokens e os componentes batem com a referência, e cada diferença está corrigida ou justificada no corpo do PR.
