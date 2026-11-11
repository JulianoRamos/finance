# Formato da mensagem do commit de plano

A skill de plano é a dona deste formato. A página do plano lê da mensagem as abas "Arquivos e interfaces" e "Decisões", com o parser da skill (`scripts/plan.cjs`), então ela segue estes blocos. A lista de arquivos e interfaces, que é o que mais envelhece, fica só aqui, e a mudança de dados (seed, backfill) também: ela não cabe no contrato.

```text
docs: plan <o que o ticket entrega> (<ticket>)

Acceptance file <pasta dos tickets>/<pai>/<ticket>/aceite.md (CA1-CA<n>). <O que muda no contrato e no schema, ou que nada muda.>

Decision: <uma decisão do plano e o motivo>. Um bloco por decisão.

Files and interfaces the implementation will touch:
- <arquivo>: <interface que muda ou nasce>.

Existing tests whose behavior changes: <os testes, ou none>.

Data changes: <seed ou backfill, ou none>.

Visual reference: <repositório>@<commit curto>, só no ticket que cita telas de um protótipo.
- <tela>: <o que entra dela>. Fora do escopo: <o que está na tela e fica para outro ticket>.

<linhas de atribuição, se o projeto as usa>
```

- **Blocos:** cada bloco começa numa linha que abre com o rótulo dele (`Decision:`, `Files and interfaces the implementation will touch:`, `Existing tests whose behavior changes:` ou `Data changes:`) e vai até a próxima linha que abre com um rótulo, ou até as linhas de atribuição do fim. Então um bloco pode ter mais de um parágrafo, e a lista pode vir depois de uma linha em branco. O texto antes do primeiro rótulo, depois do assunto, não é de nenhum bloco.
- **Linhas de atribuição:** o último parágrafo, quando todas as linhas dele têm a forma `Palavra-Sem-Espaço: valor`, como `Co-Authored-By: ...`. Elas ficam fora dos blocos.
- **Bloco que falta:** aparece na aba como ausente, e não quebra a página. O `Visual reference:` é a exceção: ele é opcional, e a aba diz que o plano não cita telas de protótipo.
- **Referência visual:** o repositório e o commit das telas que o ticket cita, e, por tela, o recorte do que entra e do que fica fora. O commit é um hash, e não uma branch nem uma tag, para a referência aprovada não mudar depois. A cópia das telas, que o comando da referência visual do projeto baixa para a pasta do ticket, segue este bloco.
- **A mensagem é a do commit:** ela é escrita em `<pasta dos tickets>/<pai>/<ticket>/plano.msg` e vira a mensagem do commit de plano com `git commit -F`, sem cópia. Antes de montar a página, o script a regrava com a limpeza que o `git commit` faria (`git stripspace`), para a página mostrar, byte a byte, o que entra no commit.
