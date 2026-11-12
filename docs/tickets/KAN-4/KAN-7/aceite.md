# Aceite do KAN-7

Ticket de preparação: cria a `api` e a `web` no monorepo, com o banco no ambiente de desenvolvimento, e as registra na verificação. O CA1 é provado por teste HTTP contra a `api` com o PostgreSQL real e com um banco que não responde. O CA2, por teste no Playwright, com a `web` chamando a `api` pela rede interna, como o ADR 0004 pede. O CA3 e o CA5 são conferidos pelo revisor humano: o CA3 é uma propriedade da verificação, e não da aplicação, e prová-lo por teste exigiria um teste do harness que quebrasse a cópia da especificação de propósito; o CA5 é visual e não tem tela de produto ainda. O CA4 é conferido pela leitura dos documentos.

## KAN-7-CA1

**Marca:** teste HTTP

**Cenário:** Dado a `api` no ar com o PostgreSQL de teste, quando se chama a rota de saúde, então ela responde 200 com o banco marcado como conectado. Dado a `api` montada com uma conexão para um banco que não responde, quando se chama a mesma rota, então ela responde 503 com o banco marcado como fora do ar, sem expor a mensagem do driver.

**Teste previsto:** integração da API no Vitest, `apps/api/test/saude.int.test.ts`, "responde 200 com o banco conectado" e "responde 503 sem o banco".

## KAN-7-CA2

**Marca:** teste no Playwright

**Cenário:** Dado a `web` e a `api` no ar, quando o navegador abre a página inicial, então ela mostra que a API está no ar, com o estado vindo da rota de saúde pelo cliente gerado da especificação, renderizado no servidor da `web`.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/inicio.spec.ts`, "a página inicial mostra o estado da API".

## KAN-7-CA3

**Marca:** revisão humana

**Cenário:** Dado a branch do ticket, quando o revisor muda a resposta da rota de saúde num decorator sem gerar de novo a cópia da especificação e roda a verificação completa, então ela reprova no passo da `api` que compara a especificação gerada com a cópia, dizendo como gerá-la. Depois de gerar a cópia, a verificação passa.

## KAN-7-CA4

**Marca:** documento

**Cenário:** Dado o `AGENTS.md` de cada app, quando se lê, então ele traz os comandos (instalar, rodar, testar um arquivo, testar tudo, lint, tipos, gerar a especificação e o cliente), as camadas e as regras de import da app. Dado o `AGENTS.md` da raiz, quando se lê "Valores da skill de plano", então o comando do contrato é `scripts/verify.sh contract` e os arquivos do contrato são a cópia da especificação e o schema do Prisma, e a tabela de "Execução no Docker" lista o `db`, a `api` e a `web`.

## KAN-7-CA5

**Marca:** revisão humana

**Cenário:** Dado a `web` no ar, quando o revisor abre a página inicial com o sistema no tema claro e depois no escuro, então as cores, a tipografia (Geist Sans, números tabulares), o espaço e o raio vêm dos tokens da seção 2 do `design-system.md`, com os valores de cada tema, e nenhum valor fora dos tokens aparece no CSS da `web`.
