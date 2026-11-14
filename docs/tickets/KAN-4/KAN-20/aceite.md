# Aceite do KAN-20

A lista das sessões ativas deixa de vir inteira e passa a seguir a regra de listas do LLD (seção 5): a página e o total na resposta, com o filtro das sessões que valem e a ordem aplicados pela `api` antes de paginar. A tela Minha conta mostra a tabela das sessões de 10 em 10, com a Paginação no rodapé, encerrar uma sessão passa para o menu de ações da linha, e a troca de senha vai para o lado da tabela.

O CA1 e o CA2 são provados pela rota, nos testes de integração da `api` contra o PostgreSQL real, com a app inteira montada e o relógio de teste. O CA1 monta, para um usuário, sessões em todas as situações que a lista precisa separar (encerrada, vencida por inatividade, ativas com últimos usos diferentes) e um segundo usuário com sessões, porque o total só prova o filtro quando há o que excluir. Como cada usuário do teste é novo, o total depende só do que o teste criou.

O CA3 roda no Playwright contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o caminho do usuário pela tela: a troca de página e o encerramento chegam à `api`, e a página mostrada continua a mesma depois de encerrar. As sessões além da primeira são abertas pela rota de login da `api`, cada uma com uma origem própria do teste.

## KAN-20-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com uma sessão aberta antes de o relógio avançar 8 dias (vencida por inatividade), cinco logins depois disso, um minuto entre cada um, com o segundo encerrado, e um outro usuário com sessões abertas, quando o usuário pede a lista com o token do terceiro login, a página 1 e o tamanho 2, então a resposta traz o total 4, a página 1 e o tamanho 2, e os itens são a sessão corrente, marcada como corrente, e o quinto login. Quando ele pede a página 2, então os itens são o quarto e o primeiro login, nenhum marcado como corrente. Quando ele pede a lista sem os parâmetros, então a resposta traz as 4 sessões, a página 1 e o tamanho 10, sem nenhuma sessão do outro usuário, nem a encerrada, nem a vencida.

**Teste previsto:** integração da API no Vitest, `apps/api/test/sessions.int.test.ts`, "pagina as sessões ativas do usuário, a corrente primeiro".

## KAN-20-CA2

**Marca:** teste HTTP

**Cenário:** Dada a lista das sessões, quando o usuário pede a página 0, então ela responde 400 `INVALID_INPUT`, com o `page` em `fields`. Quando ele pede o tamanho 101, então ela responde 400 `INVALID_INPUT`, com o `pageSize` em `fields`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/sessions.int.test.ts`, "recusa a página e o tamanho das sessões fora dos limites".

## KAN-20-CA3

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie e mais 13 sessões abertas pelo login, quando ele abre Minha conta, então a tabela das sessões mostra 10 linhas, a primeira com o selo "Esta sessão" e sem o botão de ações, e o rodapé mostra "1–10 de 14", com o botão de página anterior desabilitado. Quando ele escolhe a próxima página, então a tabela mostra 4 linhas e "11–14 de 14", com o botão de próxima página desabilitado. Quando ele abre o menu "Ações da sessão" da primeira linha e escolhe "Encerrar sessão", então a tabela continua na segunda página, com 3 linhas e "11–13 de 13".

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/sessions.spec.ts`, "a tabela das sessões pagina de 10 em 10 e encerra pelo menu da linha sem mudar de página".
