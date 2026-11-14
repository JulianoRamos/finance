# Aceite do KAN-12

Segundo ticket do módulo Entidades: os grupos financeiros, criados, editados e excluídos pelo usuário, e a Visão Familiar, que nasce com a migração dos grupos, só aceita pessoas físicas e não é renomeada nem excluída, com a tela Grupos financeiros, que entra no menu das configurações.

O CA1 é provado pela migração, e não por uma rota: a Visão Familiar nasce no `prisma migrate deploy` que a `api` roda a cada subida. Como o `finance_test` guarda os grupos das execuções anteriores, e a Visão Familiar dele ganha os membros dos outros testes, o teste cria um banco próprio, temporário, com o papel dono, aplica nele as migrações duas vezes e o apaga no fim.

O CA2, o CA3 e o CA6 são provados pelas rotas, nos testes de integração da `api` contra o PostgreSQL real, com a app inteira montada como no KAN-11 e um usuário com sessão aberta pelo login. Cada teste cria as próprias entidades, com nomes próprios. A Visão Familiar do `finance_test` é uma só para a suíte inteira, então o teste que a altera lê antes a versão e os membros atuais e manda a lista inteira com os dele acrescentados; só o arquivo dos grupos a altera.

O CA5 é provado no mesmo nível, com a leitura da tabela de auditoria filtrada pelo id do registro, como o `entities.int.test.ts` já faz: a auditoria não tem rota até o KAN-16.

O CA4 e o CA7 rodam no Playwright contra a `web` e a `api` de desenvolvimento, porque o que eles provam é o caminho do usuário pela tela. O usuário nasce pela preparação de `e2e/support/users.ts`, e as entidades e o grupo têm nomes próprios do teste, porque o banco de desenvolvimento guarda os de outras execuções. O CA4 tira da Visão Familiar, no fim, a pessoa que pôs, para ela não acumular as pessoas dos testes.

Até o KAN-13, que cria as permissões por entidade, as rotas de grupos pedem só a sessão, como as de entidades. Elas não leem o cabeçalho `Financial-Context`, porque os grupos são parte do que o contexto escolhe. A recusa de excluir um grupo com metas fica para o ticket das metas.

## KAN-12-CA1

**Marca:** teste de integração

**Cenário:** Dado um banco novo, vazio, quando as migrações são aplicadas nele, então há um grupo financeiro só com `is_family_view` verdadeiro, com o nome "Visão Familiar" e nenhum membro. Quando as migrações são aplicadas de novo no mesmo banco, então continua havendo um só, com o mesmo id. Quando se grava, com o papel dono, um segundo grupo com `is_family_view` verdadeiro, então o banco o recusa pelo índice único parcial.

**Teste previsto:** integração da API no Vitest, `apps/api/test/family-view.int.test.ts`, "a Visão Familiar nasce vazia na primeira migração e não é criada de novo".

## KAN-12-CA2

**Marca:** teste HTTP

**Cenário:** Dada a Visão Familiar, lida na lista dos grupos (a primeira, com `isFamilyView` verdadeiro), e uma pessoa física e uma pessoa jurídica ativas, quando o usuário a edita com a versão atual, o nome atual e os membros atuais mais a pessoa jurídica, então a resposta é 422 `FAMILY_VIEW_INDIVIDUALS_ONLY`, e a Visão Familiar continua com os membros e a versão de antes. Quando ele a edita com os membros atuais mais a pessoa física, então a resposta é 200, com a pessoa física entre os membros e a versão seguinte.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-groups.int.test.ts`, "a Visão Familiar aceita pessoa física e recusa pessoa jurídica".

## KAN-12-CA3

**Marca:** teste HTTP

**Cenário:** Dadas duas pessoas físicas e uma pessoa jurídica ativas, quando o usuário cria um grupo com um nome com espaços nas pontas e a primeira pessoa física e a jurídica, então a resposta é 201, com o nome sem os espaços, `isFamilyView` falso, os dois membros (id, tipo, nome e `active`) em ordem alfabética e `version` 1, e o grupo aparece na lista dos grupos, depois da Visão Familiar. Quando ele o edita com a versão 1, um nome novo e a segunda pessoa física no lugar da jurídica, então a resposta é 200, com o nome novo, os membros novos e `version` 2, e a leitura do grupo pelo id traz o mesmo. Quando ele manda outra edição com a versão 1, então a resposta é 409 `VERSION_CONFLICT`, e o grupo não muda. Dada uma entidade desativada, quando ele cria um grupo com ela ou a acrescenta ao grupo com a versão atual, então a resposta é 422 `INACTIVE_ENTITY`, e nada é criado nem muda. Quando um membro do grupo é desativado depois de entrar, então ele continua no grupo, com `active` falso, e a edição que o mantém e muda só o nome responde 200.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-groups.int.test.ts`, "cria, renomeia e muda os membros de um grupo", "recusa a edição com a versão desatualizada" e "uma entidade desativada não entra num grupo e continua no que já estava".

## KAN-12-CA4

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie e uma pessoa física e uma empresa ativas, com nomes próprios do teste, quando ele abre Grupos financeiros pelo menu das configurações, então a tela abre na Visão Familiar, com o texto de que ela só aceita pessoas físicas, e a empresa aparece entre os membros com a caixa desabilitada e "Empresa: não entra na Visão Familiar". Quando ele marca a pessoa física e escolhe "Salvar membros", então, ao recarregar a página, a pessoa física continua marcada, e a lista dos grupos conta uma pessoa física a mais na Visão Familiar. Quando ele a desmarca e salva, então, ao recarregar, ela aparece desmarcada.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/financial-groups.spec.ts`, "o usuário escolhe os membros da Visão Familiar".

## KAN-12-CA5

**Marca:** teste de integração

**Cenário:** Dado um usuário com sessão e três entidades ativas, quando ele cria um grupo com as duas primeiras, edita o nome dele e troca a segunda pela terceira, e depois o exclui, então a auditoria do registro do grupo traz, na ordem, um `create` com o nome no `after`, um `update` com o nome antigo e a versão 1 no `before` e o nome novo e a versão 2 no `after`, e um `delete` com o grupo no `before`, todos na tabela `financial_group`, com `entityId` nulo, o id do usuário e o identificador da requisição. Os membros trazem, na tabela `financial_group_member`, um `create` para cada entidade que entrou e um `delete` para cada uma que saiu, na edição e na exclusão, com a entidade do membro em `entityId` e o grupo e a entidade no `after` ou no `before`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-groups.int.test.ts`, "a criação, a edição, a exclusão e os membros dos grupos ficam na auditoria".

## KAN-12-CA6

**Marca:** teste HTTP

**Cenário:** Dado um grupo criado pelo usuário com uma entidade, quando ele o exclui, então a resposta é 204, a leitura do grupo pelo id responde 404 `NOT_FOUND`, a lista dos grupos não o traz, e a entidade continua ativa, lida pelo id. Excluir o mesmo grupo de novo responde 404 `NOT_FOUND`. Dada a Visão Familiar, quando ele a edita com a versão atual, os membros atuais e outro nome, então a resposta é 422 `FAMILY_VIEW_PROTECTED`, e ela continua com o nome "Visão Familiar" e a versão de antes; quando ele a exclui, então a resposta é 422 `FAMILY_VIEW_PROTECTED`, e ela continua na lista.

**Teste previsto:** integração da API no Vitest, `apps/api/test/financial-groups.int.test.ts`, "exclui um grupo, e a Visão Familiar recusa a mudança de nome e a exclusão".

## KAN-12-CA7

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie e uma pessoa física e uma empresa ativas, com nomes próprios do teste, quando ele abre Grupos financeiros, escolhe "Novo grupo", informa um nome próprio do teste, marca a pessoa física e a empresa e escolhe "Criar grupo", então o grupo aparece selecionado na lista, com os nomes das duas entidades na segunda linha, e o formulário dele mostra o nome e as duas entidades marcadas. Quando ele troca o nome, desmarca a empresa e escolhe "Salvar alterações", então a lista mostra o nome novo, só com a pessoa física. Quando ele escolhe "Excluir grupo", então a confirmação pergunta "Excluir o grupo <nome>?"; quando ele confirma com "Excluir grupo", então o grupo some da lista, e a tela volta para a Visão Familiar.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/financial-groups.spec.ts`, "o usuário cria, edita e exclui um grupo".
