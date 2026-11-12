# Aceite do KAN-9

Primeiro ticket do módulo Identidade: o usuário, a sessão, o link de recuperação e o registro das tentativas de login, as rotas de login, de sessão corrente e de uso do link, os comandos `create-user` e `recover-access` e as telas Login, DefinirSenha e RecuperarAcesso.

Os testes de integração e HTTP montam a app inteira com o relógio da `api` trocado por um relógio de teste (`overrideProvider`), que o teste avança. É assim que os prazos (1 hora do link, 7 e 30 dias da sessão, 15 minutos do bloqueio) são provados sem esperar e sem escrever no banco por fora da interface. Cada teste usa e-mails próprios e um `X-Forwarded-For` próprio, para o limite de tentativas por origem de um teste não bloquear outro.

Os comandos `create-user` e `recover-access` são provados chamando, no processo do teste, a mesma função que o executável do comando chama, com a app de teste: a saída que o operador lê (o link) é o que o teste usa nas rotas. O CA1 e o CA8 são de integração porque olham o que o comando gravou (a permissão de gerir acessos, pela sessão corrente; a auditoria, pela tabela dela, que ainda não tem rota de leitura). O CA7 é HTTP porque o que ele prova (as sessões encerradas) se vê pelas rotas.

O CA3 roda no Playwright contra a `web` e a `api` de desenvolvimento. O usuário do teste nasce por uma preparação do próprio teste, que grava o usuário e um link de recuperação no banco de desenvolvimento e define a senha pela rota de uso do link: não há rota pública que crie usuário, e o comando roda no contêiner da `api`, fora do alcance do Playwright.

## KAN-9-CA1

**Marca:** teste de integração

**Cenário:** Dado o relógio da `api` num instante T, quando o comando `create-user "Ana Teste" <e-mail>` roda, então ele termina com sucesso e imprime um link `<PUBLIC_URL>/set-password/<token>`. Até T + 59 minutos, a consulta do link devolve o e-mail do usuário; depois de usado para definir a senha, o login com ela abre uma sessão cuja sessão corrente traz o usuário com `managesAccess: true`. Com o relógio em T + 61 minutos, outro link criado em T pelo mesmo comando não vale mais (404). Quando o e-mail já é de um usuário, o comando termina com erro e não cria outro.

**Teste previsto:** integração da API no Vitest, `apps/api/test/identity-commands.int.test.ts`, "create-user cria o usuário que gere acessos e devolve o link de 1 hora" e "create-user recusa um e-mail que já existe".

## KAN-9-CA2

**Marca:** teste HTTP

**Cenário:** Dado um link de recuperação válido, quando a rota de uso dele recebe uma senha de 12 caracteres repetida na confirmação, então ela responde 201 com uma sessão, e o login com essa senha passa a funcionar. Quando o mesmo link é usado de novo, a consulta e o uso respondem 404 `NOT_FOUND`, e a senha continua a definida na primeira vez. Dado outro link, com o relógio uma hora e um segundo depois da criação dele, a consulta e o uso respondem 404, e a senha não muda.

**Teste previsto:** integração da API no Vitest, `apps/api/test/recovery-links.int.test.ts`, "define a senha pelo link", "o link não vale uma segunda vez" e "o link não vale depois de vencido".

## KAN-9-CA3

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com senha definida, quando ele preenche a tela de login com o e-mail e a senha certos e clica em Entrar, então ele chega à página inicial, que mostra o nome dele. Quando a tela recebe a senha errada para esse e-mail, e depois um e-mail que não existe, então as duas tentativas mostram o mesmo aviso, "E-mail ou senha incorretos. Confira os dois e tente de novo.", e a tela continua no login.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/login.spec.ts`, "o usuário entra com e-mail e senha" e "dados errados mostram o mesmo aviso, exista ou não o e-mail".

## KAN-9-CA4

**Marca:** teste HTTP

**Cenário:** Dado um login no instante T, quando a sessão corrente é pedida em T + 6 dias, e de novo em T + 12 dias, então as duas respondem 200, porque o uso renova o prazo de inatividade. Quando o relógio passa 7 dias e um segundo sem uso, então a sessão corrente responde 401 `UNAUTHENTICATED`. Dado outro login em T, usado a cada 6 dias, quando o relógio chega a T + 30 dias e um segundo, então a sessão corrente responde 401, mesmo em uso.

**Teste previsto:** integração da API no Vitest, `apps/api/test/sessions.int.test.ts`, "recusa a sessão depois de 7 dias sem uso" e "recusa a sessão 30 dias depois do login, mesmo em uso".

## KAN-9-CA5

**Marca:** teste HTTP

**Cenário:** Dado um usuário com senha, quando o login recebe cinco senhas erradas para o e-mail dele em menos de 15 minutos, então a sexta tentativa, mesmo com a senha certa, responde 429 `TOO_MANY_ATTEMPTS`, com o mesmo corpo da resposta a um e-mail que não existe e também foi bloqueado. Com o relógio 15 minutos depois da quinta falha, a senha certa entra (201). Dada uma origem (`X-Forwarded-For`) com vinte falhas em e-mails diferentes em menos de 15 minutos, quando ela tenta o login de outro usuário com a senha certa, então recebe 429, e o mesmo login vindo de outra origem entra.

**Teste previsto:** integração da API no Vitest, `apps/api/test/login-attempts.int.test.ts`, "bloqueia o e-mail depois de cinco falhas em 15 minutos" e "bloqueia a origem depois de vinte falhas".

## KAN-9-CA7

**Marca:** teste HTTP

**Cenário:** Dado um usuário com senha e duas sessões abertas, quando o comando `recover-access <e-mail>` roda, então ele imprime um link, e o uso desse link com uma senha nova responde 201 com uma sessão nova. Depois disso, as duas sessões antigas respondem 401 na sessão corrente, a nova responde 200, e o login com a senha antiga é recusado (401 `INVALID_CREDENTIALS`). Quando o e-mail não é de nenhum usuário, o comando termina com erro e não imprime link.

**Teste previsto:** integração da API no Vitest, `apps/api/test/identity-commands.int.test.ts`, "recover-access gera o link, e usá-lo encerra as sessões" e "recover-access recusa um e-mail sem usuário".

## KAN-9-CA8

**Marca:** teste de integração

**Cenário:** Dado o comando `create-user` e o uso do link dele com a senha "senha-de-teste-123", quando se leem os registros de auditoria da tabela `user` desse usuário, então há um `create`, com o nome, o e-mail e a permissão de gerir acessos no `after`, e um `update` da definição da senha, os dois sem o campo `passwordHash` no `before` nem no `after`. Nenhum registro de auditoria do usuário, nem dos links dele, traz a senha, o hash dela ou o token do link em nenhum campo.

**Teste previsto:** integração da API no Vitest, `apps/api/test/identity-commands.int.test.ts`, "grava a criação do usuário e a definição da senha na auditoria, sem a senha".
