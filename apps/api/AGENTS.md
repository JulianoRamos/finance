# AGENTS.md da api

A `api` é o NestJS com os módulos de domínio, sobre o PostgreSQL pelo Prisma. O que ela faz (módulos, esquema, contrato, regras, variáveis de ambiente) está no `docs/lld.md`; aqui fica como o código dela é escrito. O que vale para todo o repositório está no `AGENTS.md` da raiz.

## Comandos

Tudo roda no contêiner `api`, da raiz do repositório, com o ambiente no ar (`AGENTS.md` da raiz, "Execução no Docker"). Abreviado abaixo como `api <comando>`, que é `docker compose -f compose.dev.yaml exec api <comando>`.

| Para quê | Comando |
| --- | --- |
| Instalar as dependências (do workspace inteiro) | o serviço `deps` instala a cada `docker compose -f compose.dev.yaml up -d --wait` |
| Rodar | sobe com o ambiente, em modo de observação (`pnpm dev`); o log sai em `docker compose -f compose.dev.yaml logs -f api` |
| Testar um arquivo | `api pnpm test test/health.int.test.ts` |
| Testar um teste | `api pnpm test test/health.int.test.ts -t "responde 503"` |
| Testar tudo | `api pnpm test` |
| Lint e formatação | `api pnpm lint`; para corrigir, `api pnpm format` |
| Tipos | `api pnpm typecheck` |
| Gerar a cópia da especificação | `api pnpm openapi:generate`, que grava o `openapi.json` |
| Conferir a cópia da especificação | `api pnpm openapi:check` |
| Gerar o cliente do Prisma | `api pnpm prisma generate` (o contêiner gera ao subir; gere de novo depois de mudar o schema) |
| Criar uma migração | `api pnpm prisma migrate dev --name <nome>` |
| Aplicar as migrações | `api pnpm prisma migrate deploy` (o contêiner já aplica ao subir) |
| Rodar um comando do servidor | `api pnpm cli create-user "<nome>" <email>` ou `api pnpm cli recover-access <email>` (sobre o `dist/`, que o modo de observação compila) |

Depois de mudar um controlador ou um DTO, gere a cópia da especificação e faça o commit dela junto: a verificação completa reprova quando a cópia difere da gerada, e a `web` gera os tipos do cliente a partir dela.

## Particularidades da stack

- **ESM.** O pacote é `"type": "module"`, porque o Nest 12 só é distribuído como ESM, e o TypeScript usa `module: nodenext`. Todo import relativo leva a extensão `.js`, mesmo apontando para um `.ts`.
- **SWC.** O build (`nest build`) e o Vitest compilam com o SWC, que emite os metadados dos decorators que a injeção de dependências lê (`.swcrc`). Um parâmetro injetado no construtor é importado como valor, e nunca com `import type`, senão o metadado some.
- **Versões presas.** O TypeScript fica na linha 6, porque o `typescript-eslint` e o `@nestjs/swagger` ainda não aceitam o 7, e o ESLint na linha 9, a mesma da `web`, cujos plugins do Next ainda não aceitam o 10.
- **Prisma.** O cliente é gerado em `src/generated/prisma/`, fora do Git, a partir do schema em `prisma/schema/` (um arquivo por módulo). A configuração da linha de comando é o `prisma.config.ts`. A aplicação recebe a conexão da configuração em `src/common/`, e não lê o `prisma.config.ts`.
- **Configuração.** As variáveis de ambiente são lidas e validadas uma vez, em `src/common/config.ts`, e chegam aos serviços pelo token `CONFIG`. Nenhum outro arquivo lê `process.env`.
- **Montagem.** O `configureApp`, em `src/app.ts`, é o que vale em todo lugar onde a app é montada (o servidor, os testes e o comando da especificação): o prefixo `/v1`, o contexto da requisição e o `ValidationPipe` global, que responde à entrada inválida com 400 `INVALID_INPUT`.
- **Rotas protegidas por padrão.** O guard global do módulo Identidade exige a sessão em toda rota. A rota pública é marcada com o `@Public()`, do `common`, no método ou no controlador; o guard só lê a marca.
- **Relógio.** Todo instante que um módulo grava ou confere vem do `Clock` (token `CLOCK`, do `common`), e nunca de `new Date()` direto. A exceção é o instante da auditoria, que é o da transação, do banco.
- **Comandos do servidor.** O `src/cli/main.ts` monta o contexto da app e chama o `runCommand`, de `src/cli/commands.ts`, que recebe a app, os argumentos e onde escrever, e devolve o código de saída. Cada execução abre o próprio contexto da requisição, sem usuário.

## Camadas e imports

```
src/
  main.ts, app.ts, app.module.ts   a montagem da app
  modules/<module>/                um módulo do HLD; a interface pública é o index.ts
  common/                          a configuração, o cliente do banco e o que todos os módulos usam
  generated/                       o cliente gerado do Prisma (fora do Git)
  cli/                             os comandos de linha de comando
test/                              os testes de integração
```

- **Um módulo só é importado pelo `index.ts` dele.** Dentro do módulo, os arquivos se importam livremente.
- **O `common` não conhece os módulos,** e é o único que importa o cliente gerado do Prisma. Os módulos o usam pelo `index.ts` dele.
- **A montagem, os comandos e os testes** importam os módulos e o `common` pelo `index.ts`, e a montagem pela raiz de `src/`.
- **Quem pode chamar quem** entre os módulos está no `docs/lld.md`, seção 3. O lint confere essa tabela, com os módulos que já existem: um módulo novo entra nela, no `eslint.config.mjs`, no ticket que o cria.

O `eslint-plugin-boundaries` confere essas regras no lint (`eslint.config.mjs`).

## Arquivos de um módulo

- `<module>.module.ts`, `<module>.controller.ts`, `<module>.service.ts` e `<module>.dto.ts`, com o nome do módulo em inglês, o termo do `GLOSSARY.md`.
- **DTOs.** As classes de entrada e de saída das rotas, com os decorators do `@nestjs/swagger` (`@ApiProperty`) e, na entrada, os do `class-validator`. O nome da classe é o nome do schema no `openapi.json`, então ele é do domínio (`Health`, e não `HealthDto`).
- **Cada resposta e cada erro da rota** é declarado no controlador (`@ApiOkResponse`, `@ApiServiceUnavailableResponse` e os outros), porque o contrato é o que os decorators geram.

## Transação e auditoria

O mecanismo (o contexto da requisição, a transação, o antes e o depois, os papéis do banco) está no `docs/lld.md`, seções 3 e 4.4. No código:

- **O comando abre a transação** com o `TransactionService.run`, do `common`, no serviço do módulo que recebeu a requisição. Dentro dela, toda consulta usa o `TransactionService.client`, e nunca o `PrismaService` direto, senão ela fica fora da transação. Um `run` dentro de outro roda na transação já aberta.
- **Toda alteração de registro grava a auditoria** com o `AuditService.record`, do módulo Auditoria, dentro da transação do comando: a operação, a tabela (o nome no banco), o id, a entidade (ou nulo) e o registro de antes e o de depois, como o Prisma os lê. O usuário e o identificador da requisição vêm do contexto, e o serviço converte os valores e retira os campos sensíveis. Fora de uma transação, o `record` recusa a gravação.
- **O contexto da requisição** é aberto pelo middleware que o `configureApp` registra. A autenticação define o usuário com o `setCurrentUser`, antes de o comando abrir a transação, e um comando fora de uma requisição abre o próprio contexto com o `runInRequestContext`.
- **Nos testes de integração,** a app se conecta com o papel `finance_app`, como em produção, e a preparação da suíte (`test/setup-database.ts`) usa o papel dono, que esvazia a auditoria antes da suíte. Dentro dela, o papel da app não apaga a auditoria, então um teste filtra os registros dela pelo id do registro que criou, e não conta com a tabela vazia.

## Erros

- Um erro que a rota devolve sai como `HttpException` com o status e o corpo do contrato (`docs/lld.md`, seção 5, que registra também a exceção da rota de saúde), montado pelo `apiError(status, code, message)`, do `common`. A resposta de erro é declarada no controlador com o tipo `ApiError`.
- Um pedido recusado fora de uma rota, como num comando, sai como uma classe de erro do módulo (`IdentityError`), cuja mensagem é para quem pediu.
- Uma recusa de um serviço que a rota e o comando dividem, como o e-mail repetido no cadastro, sai como a classe de erro do módulo com o código do contrato (`new IdentityError(mensagem, 'DUPLICATE_EMAIL')`). O filtro global do módulo (`IdentityErrorFilter`) a responde na rota como 422 com esse código, e o comando mostra só a mensagem. A recusa sem código, que é só do comando, chega à rota como erro interno. O corpo nunca traz a mensagem de uma exceção do driver, da biblioteca ou do sistema: ela vai só para o log, pelo `Logger` do Nest.
- Uma espera por recurso externo (o banco, um arquivo) tem prazo, e o estouro do prazo é tratado como a falha do recurso. Os prazos do banco valem para toda consulta e ficam no driver, em `src/common/prisma.service.ts`, e não em cada serviço.

## Testes

- **Unitários:** `src/**/<arquivo>.test.ts`, ao lado do código, para as regras de domínio como funções puras, sem banco.
- **Integração:** `test/<subject>.int.test.ts`, contra a app inteira montada com o `Test.createTestingModule` e o `configureApp`, chamada pelo `supertest`, e contra o PostgreSQL real do banco `finance_test` (`DATABASE_URL_TEST`). As migrações rodam nele antes da suíte (`test/setup-database.ts`). Um teste nunca usa o banco de desenvolvimento.
- **Dependência trocada no teste:** pelo `overrideProvider` do módulo de teste, como a configuração com outra conexão, e nunca com mock de um colaborador interno.
- **Prazos no teste:** a app de teste do `test/support/app.ts` troca o relógio pelo `TestClock`, que o teste avança. Um prazo é provado avançando o relógio, nunca esperando nem escrevendo no banco por fora.
- **Dados de um teste:** cada teste cria os próprios usuários, com e-mail e origem (`X-Forwarded-For`) únicos (`uniqueEmail`, `uniqueOrigin`), para o limite de tentativas de um não bloquear outro. O usuário nasce pelo comando, com o `runCommandIn`, como o operador o cria.
- **Teste de aceite:** o ID do critério vai na tag (`{ tags: ['@KAN-7-CA1'] }`), no formato da skill de plano. O `strictTags` fica desligado no `vitest.config.ts`, porque as tags são os IDs, conferidos pelo conferidor do aceite.
- **O relatório** que a verificação completa confere é o `reports/vitest.json`, gravado pelo `pnpm test:report`.
