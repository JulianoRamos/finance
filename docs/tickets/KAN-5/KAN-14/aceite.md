# Aceite do KAN-14

O ticket traz o contexto financeiro. A `api` ganha a primeira rota de dados, a leitura do contexto escolhido, que resolve o cabeçalho `Financial-Context` nas entidades dele e confere a permissão em cada uma. A `web` ganha o seletor de contexto na barra lateral, guarda a escolha num cookie e mostra o contexto na página inicial. Os grupos passam a respeitar a permissão em todos os membros, na lista e na leitura.

O CA3 e o CA4 rodam na `api`, no Vitest, contra o PostgreSQL real do `finance_test`, com a app inteira montada. Quem gere acessos nasce pelo comando `create-user`, cadastra as entidades e os grupos e dá ou tira a permissão do outro usuário pela rota dos acessos, como faria pela tela. O `finance_test` guarda os registros das execuções anteriores, então cada teste cria os próprios, com nomes de um prefixo único, e confere a lista dos grupos com uma busca por esse prefixo.

O CA1, o CA2 e o CA5 rodam no Playwright contra a `web` e a `api` de desenvolvimento, porque o que eles provam é o caminho pela tela. Cada teste cria o próprio usuário, e as entidades e os grupos dele pela `api`, com um prefixo único. O usuário de teste não tem permissão nas entidades de outras execuções, então a Visão Familiar do banco de desenvolvimento, que acumula membros, pode não aparecer para ele: os cenários não dependem dela.

## KAN-14-CA1

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física, uma empresa e um grupo com as duas, todos com um prefixo próprio do teste, e outro usuário com uma empresa e um grupo com ela, com o mesmo prefixo, quando o primeiro abre o seletor de contexto e busca o prefixo, então o seletor mostra o grupo dele sob Grupos, a pessoa física sob Pessoas físicas e a empresa dele sob Empresas, e não mostra a empresa nem o grupo do outro usuário. Dadas seis pessoas físicas dele com um segundo prefixo, quando ele busca esse prefixo, então o seletor mostra cinco delas sob Pessoas físicas e diz que mais uma ficou de fora.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/financial-context.spec.ts`, "o seletor lista, pela busca na api, os contextos em que o usuário tem permissão".

## KAN-14-CA2

**Marca:** teste no Playwright

**Cenário:** Dado um usuário no Início, com uma empresa dele, quando ele escolhe a empresa no seletor, então o seletor e o Início passam a mostrar a empresa. Quando ele sai e entra de novo, no mesmo navegador, então o seletor e o Início ainda mostram a empresa.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/financial-context.spec.ts`, "a escolha do contexto vale quando o usuário volta ao sistema".

## KAN-14-CA3

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `view` numa empresa e sem permissão em outra, quando ele lê o contexto financeiro sem o cabeçalho `Financial-Context`, então a rota responde 400 `INVALID_INPUT`, com o cabeçalho em `fields`; com `entity:` seguido de um texto que não é UUID, ou com outro prefixo que não `entity` nem `group`, ela também responde 400 `INVALID_INPUT`. Quando ele lê com a empresa em que tem `view`, então a rota responde 200 com o tipo `entity`, o id, o nome, `isFamilyView` falso e a própria empresa nas entidades. Quando ele lê com a outra empresa, com um UUID que não é de nenhuma entidade ou com um grupo que não existe, então a rota responde 403 `FORBIDDEN`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-context.int.test.ts`, "o contexto sem o cabeçalho, ou com uma entidade sem permissão, é recusado".

## KAN-14-CA4

**Marca:** teste de integração

**Cenário:** Dado um usuário a quem quem gere acessos deu `view` numa pessoa física e numa empresa, e um grupo com as duas, quando o usuário lê o contexto do grupo, então a rota responde 200 com o tipo `group`, o nome do grupo e as duas entidades, pelo nome. A lista dos grupos, buscada pelo prefixo do teste, traz o grupo, e a leitura dele pelo id responde 200. Quando quem gere acessos tira a permissão do usuário na empresa, então o contexto do grupo responde 403 `FORBIDDEN`, a lista dos grupos não o traz nem o conta no total, e a leitura dele pelo id responde 403 `FORBIDDEN`. Dado um grupo sem membros, quando o usuário lê o contexto dele, então a rota responde 200 com as entidades vazias.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-context.int.test.ts`, "um grupo resolve nas entidades membros e é recusado sem a permissão em todas".

## KAN-14-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma pessoa física, uma empresa e um grupo com as duas, quando ele escolhe o grupo no seletor, então o Início mostra o nome do grupo, o tipo "Grupo", a frase "Este contexto reúne 1 pessoa física e 1 empresa." e as duas entidades, com os selos PF e PJ. Quando ele escolhe a pessoa física, então o Início mostra o nome dela, o tipo "Pessoa física" e só ela entre as entidades.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/financial-context.spec.ts`, "o Início mostra o contexto escolhido e as entidades que ele reúne".
