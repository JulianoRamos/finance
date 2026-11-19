# Aceite do KAN-16

O ticket traz o histórico de alterações de uma entidade. A `api` ganha a rota do histórico na entidade, que lê a auditoria pela Auditoria, com o nome de quem fez pela porta que a Identidade implementa (LLD, seções 3 e 4.4). A `web` ganha o "Histórico" no cabeçalho do detalhe da entidade, que abre o painel lateral com as alterações, de 10 em 10.

O CA1 e o CA2 rodam na `api`, no Vitest, contra o PostgreSQL real do `finance_test`, com a app inteira montada. O usuário nasce pelo comando `create-user`, que o deixa gerir acessos, e cadastra as entidades pela rota, e por isso tem `operate` nelas; o usuário só com `view` nasce pela rota de usuários, com a permissão dada por quem gere acessos. Cada teste cria as próprias entidades, e o histórico de uma entidade só traz as alterações dela, então os registros de outras execuções não interferem. Os testes leem o histórico só pela rota, sem ler a auditoria direto no banco.

O CA3 roda no Playwright contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o caminho pela tela. O teste cria o próprio usuário e a entidade dele pela `api`, e a renomeia pela tela.

## KAN-16-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário que cadastra uma empresa, a renomeia, a desativa, a reativa, liga a operação de clínica, registra nela a participação de uma pessoa física e põe a empresa num grupo, quando ele lê o histórico da empresa com o `pageSize` 3, então a rota responde 200 com o total 6 (a entrada no grupo e a permissão dada a quem cadastrou não entram), a página 1 com as 3 mais recentes, da participação para trás, e a página 2 com as 3 seguintes, terminando na criação. Cada alteração traz o nome dele em `user`, o `occurredAt`, a operação, a tabela e o registro: a renomeação traz só o campo `name`, com o nome antigo e o novo, sem a versão nem o instante da alteração; a desativação, só o `active`, de `true` para `false`; a criação, os campos preenchidos, com o antes nulo; a operação ligada, o campo `operation`, de nulo para `clinic`; e a participação, a fração, o início e o fim, com o nome da pessoa física em `subject`. Uma página depois da última vem com `items` vazio e o total 6, e o `pageSize` 0 responde 400 `INVALID_INPUT`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entity-history.int.test.ts`, "o histórico da entidade traz as alterações dela, da mais recente para a mais antiga, campo a campo".

## KAN-16-CA2

**Marca:** teste HTTP

**Cenário:** Dada uma empresa cadastrada pelo usuário A, quando o usuário B, sem permissão nela, lê o histórico dela, então a rota responde 403 `FORBIDDEN`, e o mesmo vale para o id de uma entidade que não existe. Quando A dá a B só `view` na empresa e B lê o histórico de novo, então a rota responde 200 com as alterações, com o nome de A em `user`. Sem sessão, a rota responde 401 `UNAUTHENTICATED`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entity-history.int.test.ts`, "o histórico respeita a permissão na entidade".

## KAN-16-CA3

**Marca:** teste no Playwright

**Cenário:** Dado um usuário com uma empresa, quando ele abre o detalhe dela, muda o nome pela edição e, de volta ao detalhe, clica em "Histórico", então o painel "Histórico de alterações" abre com a alteração dele no topo, com "<nome dele> alterou" e "Nome: <nome antigo> → <nome novo>", e a criação da empresa por último. Quando ele fecha o painel pelo botão de fechar, ou com Esc, então o painel some e o foco volta para o "Histórico".

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/entity-history.spec.ts`, "na tela da entidade, o usuário abre o histórico e vê a alteração que acabou de fazer".
