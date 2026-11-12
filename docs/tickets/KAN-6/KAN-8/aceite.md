# Aceite do KAN-8

Ticket de preparação: cria o módulo Auditoria, o contexto da requisição com a transação e o identificador da requisição, e o papel do banco da aplicação. Ainda não existe tabela de domínio nem rota que altere registro: elas nascem a partir do KAN-9. Por isso o CA1, o CA2 e o CA5 usam um comando de prova, só dos testes: uma tabela `audit_probe`, criada no banco `finance_test` pela preparação da suíte, com o papel dono, e um módulo de teste com um serviço que a altera e chama a Auditoria, e uma rota que chama esse serviço. É a costura mais alta que existe agora, e passa pelo mesmo caminho que os módulos seguintes vão usar: o contexto da requisição, a transação e o serviço público da Auditoria.

Os testes de integração se conectam com o papel `finance_app`, como a `api` em produção, e não com o dono das tabelas, então o CA3 prova a permissão do papel que a aplicação de fato usa. O CA4 é uma regra pura, a conversão do registro para o antes e o depois, provada em unidade.

O CA5 é provado na `api`: o cabeçalho que a `web` manda chega ao registro. A metade da `web` (gerar o identificador a cada requisição e mandá-lo em toda chamada) não tem como ser observada num teste agora, porque nenhuma tela da `web` ainda chama uma rota auditada; ela é conferida na revisão do código, e o primeiro teste de ponta a ponta com uma rota auditada a cobre.

## KAN-8-CA1

**Marca:** teste de integração

**Cenário:** Dado um registro na tabela de prova e uma requisição com um usuário no contexto, quando o comando de prova cria o registro, depois o altera e depois o exclui, então ficam três registros de auditoria, um por operação (`create`, `update`, `delete`), cada um com o usuário, o instante da transação, a tabela `audit_probe`, o id do registro, a entidade dada e o antes e o depois: nulo e o registro criado no `create`, o registro anterior e o novo no `update`, o registro excluído e nulo no `delete`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/audit.int.test.ts`, "grava a auditoria de cada operação do comando".

## KAN-8-CA2

**Marca:** teste de integração

**Cenário:** Dado um registro na tabela de prova, quando o comando de prova o altera, grava a auditoria e falha em seguida, ainda dentro da transação, então o registro continua com o valor anterior e nenhum registro de auditoria dele foi gravado. Dado o serviço da Auditoria chamado fora de uma transação, então ele recusa a gravação.

**Teste previsto:** integração da API no Vitest, `apps/api/test/audit.int.test.ts`, "uma falha no comando desfaz a mudança e a auditoria" e "recusa gravar a auditoria fora de uma transação".

## KAN-8-CA3

**Marca:** teste de integração

**Cenário:** Dado um registro de auditoria gravado e a conexão da `api` com o papel `finance_app`, quando ela tenta um `UPDATE`, um `DELETE` e um `TRUNCATE` na tabela `audit_log`, então o PostgreSQL recusa cada um com erro de permissão (`42501`), e o registro continua igual.

**Teste previsto:** integração da API no Vitest, `apps/api/test/audit.int.test.ts`, "o papel da aplicação não altera nem apaga a auditoria".

## KAN-8-CA4

**Marca:** teste de unidade

**Cenário:** Dado um registro com campos comuns e campos sensíveis (`passwordHash`, `totpSecretEncrypted`, `tokenHash`, `codeHash` e um campo com `password` no nome), quando ele é convertido para o antes e o depois da auditoria, então os campos sensíveis não aparecem, nem com o valor escondido, e os outros aparecem, com dinheiro como string decimal, instantes em ISO 8601 e datas de calendário como `"AAAA-MM-DD"`.

**Teste previsto:** unidade no Vitest, `apps/api/src/modules/audit/snapshot.test.ts`, "retira os campos sensíveis" e "converte os valores para JSON".

## KAN-8-CA5

**Marca:** teste de integração

**Cenário:** Dado a rota de prova, quando ela é chamada com o cabeçalho `X-Request-Id` com um UUID, como a `web` o manda, então o registro de auditoria do comando traz esse identificador. Quando ela é chamada sem o cabeçalho, ou com um valor que não é UUID, então o registro traz um UUID gerado pela `api`, diferente do valor recebido.

**Teste previsto:** integração da API no Vitest, `apps/api/test/audit.int.test.ts`, "grava o identificador da requisição recebido" e "gera o identificador quando ele falta ou é inválido".
