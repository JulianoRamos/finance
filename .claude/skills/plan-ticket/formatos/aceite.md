# Formato do critério e do arquivo de aceite

A skill de plano é a dona deste formato. A página do plano lê o arquivo de aceite com o parser da skill (`scripts/plan.cjs`), e o conferidor do aceite de um projeto pode importar o mesmo parser. O projeto declara a pasta dos tickets no `AGENTS.md`, na lista da skill de plano.

## Critério do ticket

- **ID:** `CA<n>` no ticket, e `<ticket>-CA<n>` fora do gerenciador de issues, como `PROJ-123-CA3`. O identificador do ticket tem a forma `PREFIXO-N`: letras maiúsculas e algarismos, começando por uma letra, um hífen e um número, como `PROJ-123`; o parser e o script da página só reconhecem essa forma. O número nunca muda: critério novo pega o próximo, e critério removido deixa o número vago.
- **Marca de conferência:** teste HTTP, teste no Playwright, teste de unidade, teste de integração, revisão humana ou documento. Só as quatro primeiras são provadas por teste. A definição de pronto do projeto não é critério de ticket.
- **Formato no ticket:** `- [ ] **CA3** · Texto do critério (teste HTTP).`

## Arquivo de aceite

- **Onde:** `<pasta dos tickets>/<pai>/<ticket>/aceite.md`, um por ticket, permanente. A pasta do ticket fica dentro da pasta da issue pai dele no gerenciador de issues (`<pai>`, com a forma do identificador do ticket, como `PROJ-1`), que é a mesma da spec que o passo 1 da skill lê e que vai no argumento `--pai` do script da página. É o único arquivo versionado da pasta do ticket: o projeto ignora o resto dela (a página do plano, a mensagem proposta e o que mais ele puser ali), e o script da página confere isso, na profundidade `<pasta dos tickets>/<pai>/<ticket>/`. O texto do critério fica só no ticket.
- **Introdução:** o texto antes do primeiro critério, sem os títulos: o que prova cada marca neste ticket e o porquê das decisões que os cenários supõem. A página mostra a introdução antes dos critérios.
- **O que traz, por ID:** um título `## <ticket>-CA<n>` e, abaixo dele, as linhas `**Marca:**` (uma das seis), `**Cenário:**` (Dado, Quando, Então) e, nos critérios de teste, `**Teste previsto:**` (camada, arquivo e nome do teste). O texto de cada linha rotulada vai até a próxima linha rotulada ou o próximo título, e pode ter mais de um parágrafo. Um subtítulo dentro do critério não o encerra: só o título do próximo critério encerra.
- **Sem o texto do critério:** o cenário diz como o critério é provado, e não repete o texto dele.

```markdown
# Aceite do PROJ-123

Ticket de exemplo. O CA1 é provado por teste HTTP, e o CA2, pela leitura do diff.

## PROJ-123-CA1

**Marca:** teste HTTP

**Cenário:** Dado um Usuário com um item, quando ele o copia, então a cópia é criada com o nome dado.

**Teste previsto:** testes de ponta a ponta da API, `items.e2e-spec.ts`, "copia o item".

## PROJ-123-CA2

**Marca:** documento

**Cenário:** Dado o documento de arquitetura, quando se lê a seção da cópia, então ela descreve a cota.
```

## Congelado depois do commit de plano

O arquivo de aceite não muda depois do commit de plano. Descongelar é do usuário, no editor ou no terminal. O que se congela é o ID e o cenário: o teste previsto é só uma previsão, e não se corrige o arquivo quando o teste muda de nome ou de lugar, porque a ligação é o ID. Como o projeto impõe isso, se impõe, está no `AGENTS.md` dele.

## Teste de aceite

Cada teste de aceite leva o ID do critério numa tag, `@<ticket>-CA<n>`, com o `@`, como `@PROJ-123-CA3`, e não no título. O nome e o arquivo do teste podem mudar durante a implementação, porque a ligação com o critério é o ID. Um teste que prova mais de um critério leva uma tag por critério. O token no título não vale como ID.

No Vitest, a tag vai nas opções do teste:

```ts
it('copia o item', { tags: ['@PROJ-123-CA1'] }, async () => {});
```

No Playwright, vai na opção `tag`, e várias tags formam uma lista:

```ts
test('o Usuário copia o item', { tag: '@PROJ-123-CA1' }, async ({ page }) => {});
test('o Usuário copia e move o item', { tag: ['@PROJ-123-CA1', '@PROJ-123-CA2'] }, async ({ page }) => {});
```
