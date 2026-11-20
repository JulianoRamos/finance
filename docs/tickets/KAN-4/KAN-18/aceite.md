# Aceite do KAN-18

O ticket traz a pesquisa: a rota `GET /v1/search`, do módulo Pesquisa novo, que pede a cada módulo os registros dele (LLD, regra 6.22), e a paleta de pesquisa da barra superior (design-system.md, seções 4.1 e 4.5).

Os CA1 a CA3 são testes HTTP de integração da `api`, contra a app montada e o PostgreSQL real do `finance_test`, porque o que eles provam é o que a rota devolve a cada usuário: o casamento sem acento, o limite por tipo e o filtro das permissões. O banco de teste guarda os registros de outros testes, então cada teste põe um marcador próprio no nome de tudo o que cria e pesquisa por ele, e as listas da resposta só têm o que o teste criou.

Os CA4 a CA7 rodam no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que eles provam é o que a pessoa faz na paleta: abrir, digitar, andar pelo teclado e escolher. As telas e as ações não passam pela `api` (regra 6.22), então o CA5 só existe na `web`. O banco de desenvolvimento também guarda os registros de outras execuções, e os testes usam nomes próprios, como os outros testes de ponta a ponta.

## KAN-18-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário que gere acessos e um marcador próprio do teste em maiúsculas, com seis entidades criadas por ele com o nome "Ávila <marcador> <n>", de 1 a 6, um grupo "Grupo Ávila <marcador>" com duas delas e um usuário "Bruno Ávila <marcador>", quando ele pesquisa "avila <marcador>" em minúsculas e sem o acento, então a resposta traz as cinco primeiras entidades pelo nome, de 1 a 5, cada uma com o tipo e ativa, o grupo com o resumo (duas entidades, contadas por tipo) e o usuário com o e-mail. Quando ele desativa a entidade 6 e pesquisa "avila <marcador> 6", então ela volta marcada como desativada.

**Teste previsto:** integração da `api`, `test/search.int.test.ts`, "acha pelo nome sem acento nem maiúsculas, até 5 por tipo".

## KAN-18-CA2

**Marca:** teste HTTP

**Cenário:** Dado um marcador próprio do teste, uma entidade A criada por um usuário que não gere acessos, uma entidade B criada por outro usuário, em que o primeiro não tem permissão, um grupo só com A, um grupo com A e B, um grupo sem membros e um usuário, todos com o marcador no nome, quando o primeiro usuário pesquisa o marcador, então a resposta traz só a entidade A, o grupo só com A e o grupo sem membros, e a lista de usuários vem vazia. Quando um usuário que gere acessos, com permissão só em A, pesquisa o mesmo marcador, então ele recebe as mesmas entidades e os mesmos grupos, e também o usuário.

**Teste previsto:** integração da `api`, `test/search.int.test.ts`, "devolve só o que o usuário pode ver, e os usuários só a quem gere acessos".

## KAN-18-CA3

**Marca:** teste HTTP

**Cenário:** Dado um usuário com sessão, quando ele pesquisa com o termo "a", com " a " (um caractere entre espaços) ou sem o termo, então a rota responde 400 com o código `INVALID_INPUT` e o motivo no campo `term`. O mesmo vale para um termo de 121 caracteres.

**Teste previsto:** integração da `api`, `test/search.int.test.ts`, "recusa o termo com menos de 2 caracteres".

## KAN-18-CA4

**Marca:** teste no Playwright

**Cenário:** Dado um usuário no Início, com uma entidade de nome próprio do teste, quando ele clica no campo "Pesquisar…" da barra superior, então a paleta abre com o foco no campo e as sugestões nos grupos "Ir para" e "Ações"; quando aperta Esc, ela fecha e o foco volta ao campo da barra. Quando ele aperta Control+K, a paleta abre de novo; quando digita parte do nome da entidade, então ela aparece no grupo "Entidades", com o trecho digitado destacado; quando anda com a seta para baixo até ela e aperta Enter, então a paleta fecha e o cadastro da entidade abre.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/search.spec.ts`, "o usuário abre a paleta, pesquisa e abre um resultado pelo teclado".

## KAN-18-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário que não gere acessos, com a paleta aberta, quando ele digita "usu", então nem "Usuários e acessos" nem "Novo usuário" aparecem; quando digita "grupo", então "Grupos financeiros" (Ir para) e "Novo grupo financeiro" (Ações) aparecem, e "Entidades" e "Nova entidade" não. Dado um usuário que gere acessos, quando ele digita "usu", então "Usuários e acessos" e "Novo usuário" aparecem, e escolher "Novo usuário" abre o cadastro de um usuário novo.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/search.spec.ts`, "as telas e as ações seguem o termo e as permissões".

## KAN-18-CA6

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com duas entidades de nomes próprios do teste, com a primeira como contexto financeiro, quando ele pesquisa o nome da segunda e escolhe "Trocar para <nome da segunda>", então a paleta fecha e o seletor de contexto da barra lateral passa a mostrar a segunda.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/search.spec.ts`, "trocar para um resultado muda o contexto financeiro".

## KAN-18-CA7

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com a paleta aberta, quando ele digita um termo próprio do teste que nenhum registro, tela ou ação tem, então a paleta diz "Nada encontrado para “<termo>”" e "A pesquisa procura entidades, grupos financeiros, usuários e telas.", sem nenhuma opção na lista.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/search.spec.ts`, "sem resultado, a paleta diz o que a pesquisa procura".
