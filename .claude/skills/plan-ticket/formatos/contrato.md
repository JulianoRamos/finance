# Formato do contrato de rota e de tabela

A skill de plano é a dona deste formato. O plano escreve o desenho de cada rota e de cada tabela que muda direto no dono dele (os arquivos do contrato que o projeto declara no `AGENTS.md`, como um snapshot da OpenAPI ou o schema do banco), e não num documento à parte. O projeto diz, no documento que o `AGENTS.md` aponta, como cada item se escreve no dono dele.

## Rota

Toda rota planejada ou alterada traz, no dono do contrato, os itens abaixo que ela usa. Um item que a rota usa e o dono não traz é um contrato incompleto.

| Item | O que descreve |
| --- | --- |
| Método e caminho | Com o prefixo de versão do projeto, se houver |
| Autenticação | Rota protegida, e por qual esquema, ou pública |
| Parâmetros de caminho e de consulta | Nome, tipo, se é obrigatório e os limites |
| Corpo da requisição | Os campos, os tipos e quais são obrigatórios |
| Cabeçalhos de entrada | Os que a rota lê além do de autenticação |
| Resposta de sucesso | O status e o corpo |
| Cabeçalhos de resposta | Os que a rota devolve e o cliente lê |
| Erros | Cada status com os códigos estáveis que a rota pode devolver, inclusive o de entrada inválida, quando ela valida entrada, e o de não autenticado, quando ela é protegida |

Fica fora do formato o que o dono do contrato não descreve: as regras de negócio, as transições de estado e as validades. Elas ficam nos documentos do projeto e são provadas pelos critérios de aceite do ticket.

## Tabela

Toda tabela planejada ou alterada traz, no dono do schema:

- as colunas, com o tipo, se aceita nulo e o padrão, e a observação de cada coluna;
- a chave primária, as únicas e as chaves estrangeiras, com a regra de exclusão;
- os índices, inclusive os parciais;
- toda restrição que a ferramenta do schema não expressa, como um `CHECK`, numa nota no próprio schema, na coluna ou na tabela, dizendo que ela é escrita à mão na migração. A conferência do schema não enxerga essas restrições, então a nota é o que as liga ao schema.

## Saída do comando do contrato

O comando do contrato do projeto é chamado como `<comando> <de> <até>`, da raiz do repositório, com dois pontos do Git: dois commits (o pai do commit de plano e ele), ou o `HEAD` e a árvore do índice (a saída do `git write-tree`). Ele imprime, na saída padrão, um Markdown com as rotas e as tabelas que mudam entre os dois pontos, e sai com código diferente de zero, dizendo o que corrigir, quando não consegue montá-lo.

- **Seções:** `# Contrato`, com as rotas, e `# Schema`, com as tabelas. Cada uma vira a aba de mesmo nome da página do plano, sem o título. O que vem antes da primeira seção fica fora da página, então o comando pode começar por uma linha que diz os dois pontos.
- **Seção que falta:** a aba diz que o contrato, ou o schema, não muda.
- **Dentro de cada seção:** títulos (`##` a `####`), parágrafos, tabelas, listas e blocos de código. Uma célula de tabela é uma linha só, com a barra vertical escrita `\|`, e pode ficar vazia. Uma lista aninha com dois espaços por nível. Um bloco de código abre numa cerca, com ou sem a linguagem, e fecha só numa cerca sem nada, e um ` ```diff ` sai com as linhas acrescentadas e removidas marcadas. Um parágrafo que é um só trecho em itálico, com um asterisco de cada lado e nenhum dentro (`*O contrato não muda.*`), é uma nota de vazio e sai em cinza. Um título perde a sequência de `#` do fim só quando ela tem um espaço antes, e uma lista acaba numa linha em branco, num título, numa cerca ou numa linha de tabela.
- **Uma seção por rota:** um título com o método, o caminho, se ela é nova, alterada ou removida e a autenticação, e os itens do formato de rota abaixo dele, em tabelas e listas.
- **Tudo é escapado:** a página mostra o Markdown como texto, sem HTML de dentro dele.

## Projeto sem contrato

Quando o projeto não tem rotas nem tabelas para planejar, ele declara o comando do contrato como `nenhum`. A página então diz, nas abas Contrato e Schema, que o projeto não declara contrato. Como definir um contrato quando o `AGENTS.md` não declara nenhum está no `SKILL.md`, passo 0.
