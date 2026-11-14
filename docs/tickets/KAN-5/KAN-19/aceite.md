# Aceite do KAN-19

As listas das entidades e dos grupos financeiros deixam de vir inteiras e passam a seguir a regra de listas do LLD (seção 5): a página e o total na resposta, e a busca e os filtros aplicados pela `api` antes de paginar. As telas Entidades e Grupos financeiros pedem cada busca e cada página à `api`, com a Paginação do design system no rodapé, e os botões passam a 36px.

O CA1, o CA2 e o CA3 são provados pelas rotas, nos testes de integração da `api` contra o PostgreSQL real, com a app inteira montada e um usuário com sessão aberta pelo login. Como o `finance_test` guarda as entidades e os grupos das execuções anteriores, cada teste cria os próprios registros com um prefixo único e busca por ele, para o total e a ordem dependerem só do que ele criou. A busca sem acento é provada com um nome acentuado buscado sem o acento, e a do documento, com o CNPJ escrito com a pontuação.

O CA4 e o CA5 rodam no Playwright contra a `web` e a `api` de desenvolvimento, porque o que eles provam é o caminho do usuário pela tela: a busca e a troca de página chegam à `api`, e não a um filtro do que já foi lido. As entidades e os grupos têm um prefixo único do teste, e o teste dos grupos apaga, no fim, os grupos que criou.

O CA6 é a medida da altura dos botões nas duas telas, na validação visual.

## KAN-19-CA1

**Marca:** teste HTTP

**Cenário:** Dado um prefixo único e 12 entidades com ele no nome, uma delas "Ágata <prefixo>", outra desativada e uma empresa com CNPJ, quando o usuário pede a lista com a busca pelo prefixo, a página 2 e o tamanho 5, então a resposta traz 5 itens, o total 12, a página 2 e o tamanho 5, na ordem das ativas primeiro e de cada grupo pelo nome. Quando ele busca "agata <prefixo>", então a lista traz só a Ágata. Quando ele busca o CNPJ com a pontuação, então a lista traz só a empresa. Quando ele busca pelo prefixo com o filtro das ativas, então o total é 11 e a desativada não vem.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "pagina as entidades e busca pelo nome e pelo documento".

## KAN-19-CA2

**Marca:** teste HTTP

**Cenário:** Dado um prefixo único e 12 grupos com ele no nome, um deles "Ônibus <prefixo>", quando o usuário pede a lista com a busca pelo prefixo, a página 3 e o tamanho 5, então a resposta traz os 2 últimos grupos pelo nome, o total 12, a página 3 e o tamanho 5. Quando ele busca "onibus <prefixo>", então a lista traz só o Ônibus. Quando ele pede a primeira página sem a busca, então o primeiro item é a Visão Familiar. Quando ele busca "visao familiar", então a lista traz a Visão Familiar.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-groups.int.test.ts`, "pagina os grupos e busca pelo nome".

## KAN-19-CA3

**Marca:** teste HTTP

**Cenário:** Dadas as listas das entidades e dos grupos, quando o usuário pede a página 0, ou o tamanho 0 ou 101, então cada uma responde 400 `INVALID_INPUT`, com o campo recusado em `fields`. Quando ele pede, com a busca por um prefixo de 3 entidades, a página 2 com o tamanho 10, então a resposta traz os itens vazios e o total 3.

**Teste previsto:** integração da API no Vitest, `apps/api/test/list-pages.int.test.ts`, "recusa a página e o tamanho fora dos limites e devolve vazia a página depois da última".

## KAN-19-CA4

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie e 12 entidades com um prefixo único do teste, quando ele abre Entidades e busca pelo prefixo, então a lista mostra 10 entidades e "1–10 de 12", com o botão de página anterior desabilitado. Quando ele escolhe a próxima página, então a lista mostra as 2 restantes e "11–12 de 12", com o botão de próxima página desabilitado. Quando ele troca a busca pelo nome da décima segunda, então a lista volta à primeira página e mostra só ela, com "1–1 de 1". Quando ele abre essa entidade e limpa a busca, então ela continua aberta no detalhe, e a lista mostra a primeira página sem marcá-la quando ela não está nessa página.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/entities.spec.ts`, "a busca pede à api e a lista pagina de 10 em 10".

## KAN-19-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie, 12 grupos e 12 pessoas físicas com um prefixo único do teste, quando ele abre Grupos financeiros e busca os grupos pelo prefixo, então a lista mostra 10 grupos e "1–10 de 12", e a próxima página mostra os 2 restantes. Quando ele escolhe "Novo grupo", busca os membros pelo prefixo, marca a primeira pessoa, vai à próxima página, marca a décima segunda, troca a busca e volta, então as duas continuam marcadas. Quando ele dá o nome e escolhe "Criar grupo", então o grupo aparece na lista com as duas pessoas na segunda linha.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/financial-groups.spec.ts`, "a lista dos grupos e a escolha dos membros paginam e buscam pela api".

## KAN-19-CA6

**Marca:** revisão humana

**Cenário:** Dadas as telas Entidades e Grupos financeiros no desktop, quando se mede, na validação visual, a altura dos botões do cabeçalho, do rodapé do formulário e da Paginação, então todos têm 36px, a mesma altura do campo, e os botões do rodapé ficam a 8px um do outro.
