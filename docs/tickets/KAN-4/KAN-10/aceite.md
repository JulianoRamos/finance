# Aceite do KAN-10

Segundo ticket do módulo Identidade na interface: a lista das sessões ativas, o encerramento de uma sessão, a troca de senha e a saída, com a tela Minha conta e a estrutura do app (barra lateral, barra superior, cabeçalho da página e corpo), que nasce nesta tela e passa a envolver também a página inicial.

O CA2, o CA3 e o CA4 são provados pelas rotas, nos testes de integração da `api` contra o PostgreSQL real, com a app inteira montada como no KAN-9 (relógio de teste, e-mails e `X-Forwarded-For` próprios em cada teste). O que eles provam (uma sessão que deixa de valer, a sessão de outro usuário que não aparece nem se encerra, a senha que muda) se vê todo pela sessão corrente, pela lista e pelo login, sem olhar o banco.

O CA1 e o CA5 rodam no Playwright contra a `web` e a `api` de desenvolvimento, porque o que eles provam está na tela: a marca da sessão atual, o aparelho lido do `User-Agent`, e o menu da conta que leva ao login. Os usuários nascem pela preparação de `e2e/support/users.ts`, do KAN-9. Cada login de um teste usa um contexto do navegador com `User-Agent` e `X-Forwarded-For` próprios, e é assim que o aparelho e a origem de cada sessão são conhecidos de antemão.

## KAN-10-CA1

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste que entrou pela tela de login num contexto com o `User-Agent` de um Firefox no Windows e a origem `203.0.113.7`, quando ele entra de novo num segundo contexto, com o `User-Agent` de um Chrome no macOS e a origem `192.0.2.10`, e abre Minha conta pelo menu da conta, então a tabela "Sessões ativas" mostra uma linha "Chrome no macOS" com a marca "Esta sessão", a origem `192.0.2.10`, o último uso "agora" e nenhum botão "Encerrar", e uma linha "Firefox no Windows" com a origem `203.0.113.7`, o último uso no formato `dd/mm/aaaa hh:mm` e o botão "Encerrar". A sessão aberta pela preparação do usuário também aparece, e nenhuma linha de outro usuário.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/sessions.spec.ts`, "o usuário vê as próprias sessões, com a atual marcada".

## KAN-10-CA2

**Marca:** teste HTTP

**Cenário:** Dado um usuário com duas sessões abertas pelo login, A e B, quando a sessão A encerra a B pela rota de encerrar, então a resposta é 204; em seguida, a sessão corrente com o token de B responde 401 `UNAUTHENTICATED`, a lista vista por A não traz mais a B, e encerrar a B de novo responde 404 `NOT_FOUND`. A sessão A continua valendo.

**Teste previsto:** integração da API no Vitest, `apps/api/test/sessions.int.test.ts`, "encerrar uma sessão a invalida na hora".

## KAN-10-CA3

**Marca:** teste HTTP

**Cenário:** Dados dois usuários, cada um com uma sessão aberta pelo login, quando o primeiro lista as sessões, então a lista traz só a dele, sem a do segundo. Quando o primeiro tenta encerrar a sessão do segundo pelo id dela, então a resposta é 404 `NOT_FOUND`, igual à de um id que não existe, e a sessão do segundo continua valendo, na sessão corrente e na lista dele.

**Teste previsto:** integração da API no Vitest, `apps/api/test/sessions.int.test.ts`, "um usuário não vê nem encerra as sessões de outro".

## KAN-10-CA4

**Marca:** teste HTTP

**Cenário:** Dado um usuário com duas sessões abertas pelo login, A e B, quando A pede a troca da senha com a senha atual errada, então a resposta é 422 `INVALID_CURRENT_PASSWORD`, B continua valendo e o login com a senha antiga continua funcionando. Quando A pede a troca com a senha atual certa e a nova repetida na confirmação, então a resposta é 204; a sessão corrente com o token de A responde 200, a com o token de B responde 401 `UNAUTHENTICATED`, o login com a senha nova abre uma sessão e o login com a antiga responde 401 `INVALID_CREDENTIALS`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/password-change.int.test.ts`, "a troca de senha recusa a senha atual errada" e "a troca de senha encerra as outras sessões e mantém a atual".

## KAN-10-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie, na página inicial, quando ele abre o menu da conta, na barra lateral, e escolhe Sair, então a página vai para `/login`, e abrir a página inicial de novo leva ao login. Quando o teste põe de volta no navegador o cookie com o token da sessão de antes e abre a página inicial, então ela continua levando ao login: a sessão foi encerrada na `api`, e não só apagada do navegador.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/logout.spec.ts`, "sair pelo menu da conta encerra a sessão".
