# Aceite do KAN-27

O ticket cria o módulo Lançamentos (`entries`) só com a árvore de categorias das pessoas físicas: a tabela `category`, com as categorias de primeiro nível semeadas pela migração, as rotas `GET` e `POST /v1/categories`, `PUT /v1/categories/{id}` e `PUT /v1/categories/{id}/active`, as categorias na pesquisa e a tela Categorias (LLD, seção 4.6 e regras 6.20 e 6.22; design system, seções 4.5 e 4.6).

O CA1, o CA2 e o CA4 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que as rotas gravam e recusam. O CA3 é um teste de integração da auditoria e da escolha, pelo registro gravado e pela lista das ativas. A árvore das pessoas físicas é uma só, compartilhada por todos os usuários e pelos testes, e o banco de teste guarda as categorias de outros testes: cada teste cria as próprias categorias, com nomes únicos, e as acha pela busca, sem contar com a árvore só com a semente nem com a posição de uma categoria na página.

O CA5 roda no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o que a pessoa faz na árvore: criar uma subcategoria pela linha, renomear no lugar, buscar e ver o achado com o pai, e desativar pela confirmação. Ele também acha as próprias categorias pela busca.

## KAN-27-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `operate` numa pessoa física, quando ele lista a árvore de despesa e a de receita, então elas trazem as categorias de primeiro nível do LLD (Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Vestuário, Serviços e assinaturas, Impostos e taxas, Despesas financeiras e Outras; e Salário, Pró-labore, Distribuição de lucros, Rendimentos e Outras), ativas. Quando ele cria uma categoria de despesa de primeiro nível e, nela, uma subcategoria sem informar a natureza, então a rota responde 201 nas duas, a subcategoria nasce com a natureza `expense` e o pai dado, e a lista da árvore de despesa, buscada pelo nome da categoria, a traz com a subcategoria em `children`. A categoria de primeiro nível sem a natureza é recusada com 400 `INVALID_INPUT`, com a natureza em `fields`.

**Teste previsto:** integração da `api`, `test/categories.int.test.ts`, "a árvore nasce com o primeiro nível do LLD e recebe categoria e subcategoria".

## KAN-27-CA2

**Marca:** teste HTTP

**Cenário:** Dado uma categoria de despesa de primeiro nível A, com uma subcategoria S, outra de despesa B e uma de receita R, quando o usuário renomeia S e a muda para dentro de B, com a versão lida, então a rota responde 200 com o novo nome, o novo pai e a versão seguinte. Quando ele manda a natureza `revenue` na edição de S, a rota responde 422 `CATEGORY_NATURE_IMMUTABLE`; com o pai R, 422 `PARENT_NATURE_MISMATCH`; com o pai S (uma subcategoria) para outra categoria, 422 `CATEGORY_TOO_DEEP`; e com a versão antiga, 409 `VERSION_CONFLICT`. Um usuário que só tem `view` nas pessoas físicas recebe 403 `FORBIDDEN` ao editar.

**Teste previsto:** integração da `api`, `test/categories.int.test.ts`, "renomeia e muda o pai na mesma natureza, e recusa a natureza nova e o pai de outra natureza".

## KAN-27-CA3

**Marca:** teste de integração

**Cenário:** Dado uma categoria de primeiro nível com uma subcategoria, quando o usuário a desativa com um identificador de requisição próprio, então as duas ficam desativadas e somem da lista das ativas (`active=true`), e continuam na lista sem o filtro; reativar a subcategoria enquanto o pai está desativado responde 422 `INACTIVE_PARENT`. Quando ele reativa o pai, então só o pai volta às ativas. Os registros de auditoria da criação, da desativação do pai e da subcategoria e da reativação têm a tabela `category`, o usuário, esse identificador e entidade nula.

**Teste previsto:** integração da `api`, `test/categories.int.test.ts`, "a categoria desativada some das escolhas e volta ao ser reativada, e as alterações ficam na auditoria".

## KAN-27-CA4

**Marca:** teste HTTP

**Cenário:** Dado uma categoria de primeiro nível e uma subcategoria dela com um nome único do teste, quando um usuário com `view` numa pessoa física pesquisa por esse nome, então a pesquisa traz as duas em `categories`, a subcategoria com o nome do pai em `parentName` e a de primeiro nível com `parentName` nulo. Quando um usuário que só tem permissão numa empresa pesquisa pelo mesmo termo, então `categories` vem vazia, e a lista da árvore responde 403 `FORBIDDEN`.

**Teste previsto:** integração da `api`, `test/categories.int.test.ts`, "a pesquisa traz as categorias com o caminho do pai para quem tem permissão numa pessoa física".

## KAN-27-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física de nome próprio do teste, quando ele abre Categorias, cria uma categoria de despesa de nome próprio do teste pelo "Nova categoria", cria nela uma subcategoria pelo "+" da linha e a renomeia na própria linha, então a árvore mostra a subcategoria com o novo nome dentro da categoria. Quando ele busca pelo nome da subcategoria, então a árvore mostra a subcategoria com o trecho marcado e a categoria acima dela como "categoria pai". Quando ele desativa a categoria pela confirmação, então ela e a subcategoria aparecem com o selo "Desativada".

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/categories.spec.ts`, "o usuário cria, renomeia, busca e desativa categorias na árvore".
