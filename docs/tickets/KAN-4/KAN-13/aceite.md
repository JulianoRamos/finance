# Aceite do KAN-13

O ticket cria a tela Usuários e acessos e as rotas de usuários do módulo Identidade, e liga a permissão por entidade às rotas de entidades, como o plano do KAN-11 deixou previsto: até aqui, todo usuário via e alterava todas as entidades.

Os critérios de teste HTTP e o de integração rodam na `api`, no Vitest, contra o PostgreSQL real do `finance_test`, com a app inteira montada e o relógio de teste. Quem gere acessos nasce pelo comando `create-user`, como o operador o cria; o usuário cadastrado pela rota define a senha pelo link que ela devolve, como faria pela tela. O `finance_test` guarda os usuários e as entidades das execuções anteriores, então cada teste cria os próprios registros, com nomes e e-mails únicos, e a lista é conferida com uma busca pelo prefixo do teste.

O contexto financeiro (o cabeçalho `Financial-Context` e o grupo resolvido nas entidades membros) é do KAN-14, e nenhuma rota de dados existe ainda. Então o "contexto com uma entidade" do CA3 e a escrita do CA4 são provados nas rotas da própria entidade (`/v1/entities/{id}` e as de baixo dele), que passam a exigir `view` para ler e `operate` para alterar, com a mesma conferência que o KAN-14 vai aplicar ao cabeçalho. A recusa é 403 `FORBIDDEN`, o código do LLD (seção 5) para o nível que falta numa entidade.

O CA6 e a parte de tela do CA5 rodam no Playwright contra a `web` e a `api` de desenvolvimento, porque o que eles provam é o caminho pela tela. O usuário de teste que gere acessos é gravado no banco de desenvolvimento pela preparação dos testes de ponta a ponta, com `manages_access`.

## KAN-13-CA1

**Marca:** teste HTTP

**Cenário:** Dado quem gere acessos e uma entidade em que ele opera, quando ele cadastra um usuário com o nome, o e-mail em maiúsculas, sem gerir acessos e com `view` na entidade, então a rota responde 201 com o usuário (o e-mail em minúsculas, `managesAccess` falso, `active` verdadeiro, `passwordSet` falso, a versão 1) e o link de recuperação, com o endereço de `PUBLIC_URL` seguido de `/set-password/` e do token, e o prazo de 1 hora no relógio de teste. Quando o link é consultado, então ele responde com o e-mail do usuário; quando é usado com uma senha, então abre uma sessão, e o usuário lido de novo vem com `passwordSet` verdadeiro. Quando quem gere acessos cadastra outro usuário com o mesmo e-mail, então a rota responde 422 `DUPLICATE_EMAIL`; quando cadastra um com uma entidade que não existe, então responde 422 `ENTITY_NOT_FOUND`, e nenhum dos dois usuários é criado.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "cadastra um usuário, que recebe o link para definir a senha".

## KAN-13-CA2

**Marca:** teste HTTP

**Cenário:** Dado um usuário com a senha definida e duas sessões abertas, quando quem gere acessos o desativa com a versão lida, então a rota responde 200 com `active` falso e a versão seguinte, as duas sessões respondem 401 `UNAUTHENTICATED` e o login dele responde 401 `INVALID_CREDENTIALS`. Quando quem gere acessos tenta desativar a si mesmo, então a rota responde 422 `SELF_ACCESS_CHANGE`, e a sessão dele continua valendo.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "desativar um usuário encerra as sessões dele".

## KAN-13-CA3

**Marca:** teste HTTP

**Cenário:** Dadas duas entidades cadastradas por quem gere acessos e um usuário cadastrado com `view` na primeira e sem permissão na segunda, quando o usuário lê a primeira, então ela responde 200; quando lê a segunda, então responde 403 `FORBIDDEN`; e a lista das entidades, buscada pelo prefixo do teste, traz só a primeira, com o total 1. Quando quem gere acessos lê as permissões do usuário, buscadas pelo mesmo prefixo, então a página traz as duas entidades, com `view` e `none`. Quando ele salva `operate` na segunda e `none` na primeira, com a versão lida, então a rota responde 200 com a versão seguinte, o usuário lê a segunda e a primeira responde 403 `FORBIDDEN`. Quando quem gere acessos cadastra uma entidade, então ele recebe `operate` nela e a lê sem outra permissão.

**Teste previsto:** integração da API no Vitest, `apps/api/test/permissions.int.test.ts`, "define ver ou operar por entidade, e a entidade sem permissão é recusada".

## KAN-13-CA4

**Marca:** teste HTTP

**Cenário:** Dado um usuário com `view` numa empresa, quando ele edita o nome, desativa a empresa, liga a operação de clínica e a desliga, então as quatro rotas respondem 403 `FORBIDDEN`, e a empresa lida de novo continua com o nome, a situação, as operações e a versão de antes. Quando quem gere acessos lhe dá `operate` na empresa, então a mesma edição responde 200.

**Teste previsto:** integração da API no Vitest, `apps/api/test/permissions.int.test.ts`, "quem só vê tem a escrita na entidade recusada".

## KAN-13-CA5

**Marca:** teste HTTP

**Cenário:** Dado um usuário sem `manages_access`, quando ele pede a lista dos usuários, um usuário, as permissões dele, o cadastro, a edição, a desativação, a gravação dos acessos e a geração de um link de recuperação, então todas as rotas respondem 403 `FORBIDDEN`, e nada muda. Na tela, dado o mesmo usuário com a sessão no cookie, quando ele abre o menu das configurações, então "Usuários e acessos" não aparece, e quando ele abre `/users` pelo endereço, então a página não encontrada aparece no lugar da tela.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "quem não gere acessos tem as rotas de usuários recusadas"; e ponta a ponta no Playwright, `apps/web/e2e/users.spec.ts`, "quem não gere acessos não vê a tela de usuários".

## KAN-13-CA6

**Marca:** teste no Playwright

**Cenário:** Dado quem gere acessos com a sessão no cookie e outro usuário com a senha definida, quando ele abre esse usuário na tela Usuários e acessos e escolhe "Gerar link de recuperação", então aparece "Link de recuperação gerado", com o prazo e o campo "Link de recuperação" com um endereço de `/set-password/`, e o botão "Copiar link". Quando esse endereço é aberto noutro navegador, sem sessão, então a tela de definir a senha aparece com o e-mail do usuário.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/users.spec.ts`, "quem gere acessos gera um link de recuperação para outro usuário".

## KAN-13-CA7

**Marca:** teste de integração

**Cenário:** Dado quem gere acessos, quando ele cadastra um usuário com `view` numa entidade, edita o nome dele, salva os acessos com `operate` nessa entidade, `view` noutra e o gerir acessos ligado, salva de novo com `none` na segunda, gera um link de recuperação, desativa e reativa o usuário, cada pedido com um `X-Request-Id` próprio, então a auditoria traz, com o usuário de quem gere acessos e o identificador de cada pedido: o `create` do `user` e da primeira `permission`, com a entidade dela em `entityId`; o `update` do `user` na edição, nos acessos, na desativação e na reativação, com o antes e o depois; o `update` da primeira `permission` (de `view` para `operate`), o `create` e o `delete` da segunda; e o `create` dos dois `recovery_link` (o do cadastro e o gerado). Nenhum registro traz o hash da senha nem o do token.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "as mudanças de usuários e permissões ficam na auditoria".

## KAN-13-CA8

**Marca:** teste HTTP

**Cenário:** Dado um usuário com a senha definida e uma sessão aberta, quando quem gere acessos edita só o nome dele, com a versão lida, então a rota responde 200 com o nome novo e a versão seguinte, e a sessão continua valendo. Quando ele troca o e-mail, com a versão nova, então a sessão responde 401 `UNAUTHENTICATED`, o login com o e-mail antigo responde 401 `INVALID_CREDENTIALS` e o login com o novo abre uma sessão. Quando ele edita de novo com a versão antiga, então a rota responde 409 `VERSION_CONFLICT`; quando usa o e-mail de outro usuário, então responde 422 `DUPLICATE_EMAIL`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "edita o nome e o e-mail, e a troca de e-mail encerra as sessões".

## KAN-13-CA9

**Marca:** teste HTTP

**Cenário:** Dado um usuário com a senha definida e `view` numa entidade, desativado por quem gere acessos, quando ele é reativado com a versão lida, então a rota responde 200 com `active` verdadeiro e a versão seguinte, o login dele abre uma sessão, ele lê a entidade e as permissões dele continuam com `view` nela. Quando ele tenta gerar, desativado, um link de recuperação, então a rota responde 422 `INACTIVE_USER`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "reativa o usuário com as permissões que tinha".

## KAN-13-CA10

**Marca:** teste HTTP

**Cenário:** Dados doze usuários com o prefixo do teste no nome, um deles desativado e um com acento no nome, e mais um com o prefixo só no e-mail, quando quem gere acessos pede a lista buscada pelo prefixo, com o tamanho 5, então a resposta traz o total 13, a página 1 e o tamanho 5, com os ativos primeiro, pelo nome, e o desativado por último, na página 3. Quando a busca é o nome com acento escrito sem ele e em maiúsculas, então a lista traz só esse usuário; quando é o trecho do e-mail, só o do e-mail. Quando a página é 0 ou o tamanho é 101, então a rota responde 400 `INVALID_INPUT`, com o campo em `fields`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/users.int.test.ts`, "pagina os usuários e busca pelo nome e pelo e-mail".
