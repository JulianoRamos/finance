# AGENTS.md

## Documentos

Os documentos que definem o produto, a arquitetura e os detalhes de implementação ficam em `docs/`. O vocabulário do domínio fica no `GLOSSARY.md`, na raiz, e as decisões de arquitetura difíceis de reverter, em `docs/adr/`.

- `docs/documento-de-contexto.md`: entendimento inicial do produto, validado na descoberta. É a entrada do planejamento, e não a fonte final: as decisões tomadas depois vão para o documento dono delas, e as pendências listadas nele não são requisitos aprovados.

Os documentos abaixo nascem no planejamento e, a partir daí, são os donos do que descrevem:

1. `docs/product-brief.md`: o quê e para quem. Escopo do MVP, o que fica fora, planos e métricas.
2. `docs/hld.md`: high-level design. As decisões de arquitetura, os fluxos principais e a visão geral do sistema.
3. `docs/lld.md`: low-level design. A estrutura de pastas, as bibliotecas, os esquemas de banco, os contratos de API, as regras de negócio, as tarefas agendadas e as variáveis de ambiente.
4. `docs/design-system.md`: linguagem visual da interface. Os tokens, os componentes, os estados de interação, o comportamento responsivo e o fluxo de trabalho com o Claude Design (os designs e o design system do projeto, feitos no Claude).

Cada projeto em `apps/` tem o próprio `AGENTS.md`, com os comandos, as particularidades da stack e as práticas de código dele.

**Onde cada informação mora**

- **O que o sistema faz** fica em `docs/`: escopo, arquitetura, esquema, contrato, regras de negócio e configuração.
- **Como o código é escrito** fica no `AGENTS.md` do projeto: camadas, regras de import, tratamento de erros, nomes de arquivos, níveis de teste e comandos.
- **Nunca nos dois.** Uma informação tem um dono só, e o outro arquivo aponta para ele pelo nome do documento e da seção, sem repetir o conteúdo.
- **Este arquivo** só traz o que vale para todos os projetos.

**Arquivos que não devem ser lidos**

- `docs/sessoes/`: transcrições de sessões anteriores, para quem lê o repositório. São longas e registram decisões que podem ter mudado depois: a decisão vigente está no documento dono dela. **Nunca as leia nem as edite**, nem para buscar contexto de uma tarefa. O `.claude/settings.json` nega a leitura e a escrita nelas.

## Execução no Docker

Tudo roda dentro dos contêineres do Docker Compose: instalação de dependências, servidor de desenvolvimento, testes, lint, checagem de tipos e qualquer outro comando do projeto. **Nunca rode `node`, `npx` ou `pnpm` direto na máquina.** Na máquina rodam só o `docker`, o `git`, o `gh`, o `jq` e os scripts de `scripts/`, que chamam os contêineres.

O ambiente de desenvolvimento usa o `compose.dev.yaml`, na raiz:

| Serviço | O que é | Endereço na máquina | Endereço entre contêineres |
| --- | --- | --- | --- |
| `harness` | O Node do harness: o conferidor do aceite, a página do plano e os testes do harness | Não é publicado | Não recebe conexões |
| `deps` | Instala as dependências do workspace e o Chromium do Playwright, e termina | Não é publicado | Não recebe conexões |
| `db` | O PostgreSQL 18, com o banco de desenvolvimento (`finance`), o dos testes de integração da `api` (`finance_test`) e o papel da `api` (`finance_app`) | Não é publicado | `db:5432` |
| `api` | A `api` (NestJS) em modo de observação | Não é publicada (ADR 0004) | `http://api:3001` |
| `web` | A `web` (Next.js) em modo de desenvolvimento, e o Playwright dos testes de ponta a ponta | `http://localhost:3000`, ou a porta de `WEB_PORT` | `http://web:3000` |

O `harness` monta o repositório em `/repo`, só para leitura e sem o `.git`, e grava num volume próprio, em `/out`. Ele fica parado, e os comandos rodam nele pelo `scripts/node-in-harness.sh`.

As apps montam o repositório inteiro em `/repo`, porque o workspace do pnpm fica na raiz, e trabalham na pasta delas. Antes delas, o serviço `deps` instala as dependências do workspace inteiro e o Chromium do Playwright, e termina; ele roda de novo a cada `up`. Ao subir, a `api` gera o cliente do Prisma e aplica as migrações no banco de desenvolvimento. As dependências da raiz do workspace (com o store do pnpm) e o Chromium ficam em volumes, o pnpm vem pelo corepack, na versão do `packageManager` do `package.json` da raiz, e os contêineres rodam com o usuário 1000. O banco `finance_test` e o papel `finance_app`, com que a `api` se conecta (as migrações rodam com o papel dono, `finance`), são criados quando o volume do banco nasce; num volume antigo, recrie-o com `down -v`. Se a porta 3000 da máquina já estiver em uso, defina outra em `WEB_PORT`, num `.env` na raiz, fora do Git.

Cada app entra no `compose.dev.yaml` e nesta tabela no ticket que a cria, junto com o `AGENTS.md` dela e o grupo dela em `scripts/verify/` (ver o `README.md` dessa pasta).

**Subir e derrubar**

```bash
docker compose -f compose.dev.yaml up -d --build --wait
docker compose -f compose.dev.yaml down
```

O `--wait` segura o comando até os serviços ficarem prontos. O `down -v` apaga também os volumes.

**Rede entre serviços**

Na conexão entre serviços (banco, e-mail, worker, provedores simulados), seja em variável de ambiente, arquivo de configuração ou código, **o host é sempre o nome do serviço do Compose**, e nunca `localhost` nem `127.0.0.1`: dentro de um contêiner, `localhost` é o próprio contêiner.

**Exceção:** quando o processo fala com algo que roda no mesmo contêiner, o endereço é `127.0.0.1`. É o caso do healthcheck de um serviço, que confere o próprio contêiner, e de um teste que abre um servidor temporário no contêiner onde roda.

## Princípios de trabalho

- **Responsabilidade única:** cada módulo e cada função tem uma responsabilidade clara. Reavalie isso a cada passo. Quando um módulo começa a criar ou alterar entidades de outro domínio, extraia a lógica para o módulo certo na hora, em vez de deixar para uma tarefa futura.
- **Idioma:** o código é em inglês: nomes de arquivos e pastas, identificadores, rotas, parâmetros, cabeçalhos, campos do JSON, códigos de erro, valores de enumeração, tabelas, colunas e variáveis de ambiente. O termo de cada conceito do domínio é o da linha **Em código** dele no `GLOSSARY.md`. Em português fica o texto que uma pessoa lê: a interface, a mensagem de erro para o usuário, os comentários, os títulos dos testes, os logs, as mensagens dos scripts, os documentos, os commits e o Jira.
- **Tipagem:** tipagem estrita em todas as camadas, com a checagem de tipos de cada projeto.
- **Testes:** pirâmide de testes em todos os níveis (unitários, de integração e de ponta a ponta).
- **Qualidade de código:** lint e formatação automáticos, com as ferramentas de cada projeto.
- **Documentação:** cada informação fica no documento dono dela, como descrito em [Documentos](#documentos).

## Definição de pronto

Uma mudança no código está pronta quando:

1. O `scripts/verify.sh full` aprova. Ele é a definição de "passou": tipos, lint e todas as suítes de cada app registrada, os testes do harness, o aceite e os segredos. O que cada passo confere está no cabeçalho e nos grupos de `scripts/verify.sh`.
2. Em mudança de interface, a validação visual descrita em `docs/design-system.md` foi feita. É a única exigência que o script não confere.

Rode o script da raiz do repositório, na máquina (ele mesmo chama os contêineres), com o ambiente no ar:

```bash
scripts/verify.sh full
```

- **Durante o desenvolvimento, só os testes do que mudou.** Rode os testes ligados aos arquivos alterados, com os comandos de um arquivo ou de um teste do `AGENTS.md` do projeto. O hook de fim de turno já confere os tipos e o lint, com o `scripts/verify.sh fast`. O `scripts/verify.sh full <app>` continua no script, mas não é o feedback do dia a dia.
- **O `full` roda uma vez, no fim da tarefa,** antes do commit que a fecha, e quem o roda é quem faz esse commit. No fluxo de ticket, é a sessão principal, depois da `/simplify`, da `/code-review` e da revisão de conformidade (ver "Revisão de conformidade").
- **Subagente não roda o `full`.** Se você recebeu a tarefa de outro agente (implementar, corrigir achados, revisar), termine com os testes do que mudou e devolva o resultado, dizendo o que rodou: o `full` é de quem o chamou, mesmo que a tarefa pareça terminada.
- **Falha se corrige na causa, na mesma tarefa.** Erro de tipo, de lint ou de teste nunca fica como dívida para uma tarefa futura. Depois de uma reprovação, rode o `full` de novo só depois de corrigir a causa.
- **Na terceira reprovação seguida nos mesmos passos, o `full` trava.** Pare e peça ao usuário que examine a falha e rode `! scripts/verify.sh unlock`; só ele destrava. Não rode o `verify.sh` com `CI=` nem `GITHUB_ACTIONS=`, que desligariam a trava.
- **O veredito é o da CI.** Ela roda esse mesmo comando em todo pull request. Passar na máquina é condição para abrir o PR, e não prova de que a mudança está pronta.
- **Não contorne uma verificação.** Não pule teste, não apague teste que falha e não altere o script nem o workflow para fazer a mudança passar. A CI reprova teste pulado e suíte vazia.
- **Depois de duas reprovações da CI no mesmo PR, pare** e avise o usuário, em vez de tentar a terceira correção.

**Antes do push**

Um hook confere todo `git push` que você faz e o nega em dois casos: quando os commits da branch trazem um segredo, e quando o modo completo não aprovou o conteúdo do último commit. Para o push passar:

1. Faça o commit de tudo que alterou. A aprovação vale para o que foi verificado, e o push envia o que está em commit.
2. Em branch que altera código em `apps/`, salve o corpo do pull request num arquivo, com a seção `## Aceite`.
3. Rode `ACCEPTANCE_BODY_FILE=<arquivo> scripts/verify.sh full`. Em branch que não altera `apps/`, a variável é dispensável.
4. Faça o push.

- **O que invalida a aprovação:** qualquer mudança em `apps/`, no `compose.dev.yaml`, em `scripts/`, nos scripts da skill de plano (`.claude/skills/plan-ticket/scripts/`) ou num arquivo de aceite (`docs/tickets/<issue>/<ticket>/aceite.md`). Mudança só em documento fora desses caminhos não invalida, e uma branch que só altera esse tipo de documento não precisa de aprovação. O `AGENTS.md` de um projeto fica em `apps/`, então alterá-lo invalida.
- **Não contorne o bloqueio.** Se um push sem verificação for mesmo necessário, como o de um trabalho pela metade, peça ao usuário, que o faz no terminal.

**Aceite no pull request**

Todo pull request que altera código em `apps/` traz, no corpo, a seção `## Aceite`, que diz qual arquivo de aceite o PR cumpre:

```markdown
## Aceite

docs/tickets/<issue>/<ticket>/aceite.md
```

- **Com ticket:** o caminho do arquivo de aceite do ticket, criado pelo commit de plano. Os critérios e os testes não se repetem no PR.
- **Sem aceite novo:** escreva `nenhum` seguido do motivo, como "nenhum: refatoração sem mudança de comportamento". Vale para refatoração, mudança no harness e documento.
- **O que a CI confere,** em todos os arquivos de aceite de `docs/tickets/` e não só no do ticket: todo critério com marca de teste tem ao menos um teste com o ID numa tag que rodou e passou; o teste que ainda traz o ID no título e não tem tag reprova; nenhum teste cita um ID que não está num arquivo de aceite; nenhum teste com ID foi pulado; o arquivo citado existe. Critério com marca de revisão humana ou de documento não exige teste.
- **Critério sem teste:** escreva o teste, com o ID numa tag (formato em `.claude/skills/plan-ticket/formatos/aceite.md`, seção "Teste de aceite"). Não cite um teste que não tenha relação com o critério: a CI só prova que ele existe e passou, e quem julga se ele prova o critério é o revisor.

**Revisão de conformidade**

Quem escreveu o código não é quem o confere. Toda mudança que altera código em `apps/` passa pelo subagente `revisor-conformidade`, que não viu a implementação e confere se ela entrega o que foi planejado: o aceite, os testes contra os cenários, o contrato e o schema contra o commit de plano e os documentos donos. O que ele confere está no `REVIEW.md` da raiz, que o Copilot e o Claude Code Review também leem no PR. Os defeitos gerais de código ficam com a `/code-review`, e uma revisão feita na mesma sessão que escreveu o código não substitui esta.

No fluxo do ticket, ela vem depois da `/code-review` e antes do `full`, para as correções entrarem na única verificação completa: implementação, `/simplify`, `/code-review`, revisão de conformidade, correções, `full` e commit. A revisão não bloqueia: todo achado, corrigido ou não, vai para um comentário no PR, e a decisão sobre o que ficou sem corrigir é do usuário no merge. Como preparar a revisão, chamar o subagente, tratar os achados e publicar o comentário está na skill `revisao-conformidade`.

Os comandos de teste, de lint e de formatação de cada projeto estão no `AGENTS.md` dele, e rodam dentro do contêiner do projeto, como descrito em [Execução no Docker](#execução-no-docker).

## Issues e tickets no Jira

O Jira é o gerenciador de issues do projeto, acessado pelo servidor MCP `atlassian` (o Rovo MCP da Atlassian). Specs e tickets vivem lá, e não em arquivos do repositório.

- **Site:** `finance12.atlassian.net`.
- **Projeto:** `KAN`. As issues têm a chave `KAN-<n>`.
- **Tipos de issue:** `Epic` para a spec; `História` para uma funcionalidade, `Erro` para um defeito e `Tarefa` para uma melhoria ou um ticket de preparação. São os tipos nativos do projeto, com os nomes em português que ele mostra (na API, `Story`, `Task` e `Erro`), e não labels. O `Subtask` não é usado.
- **Status:** `Tarefas pendentes`, `Em andamento`, `Em análise` e `Concluído`.
- **Label de triagem:** `ready-for-agent`, para a issue já especificada, que um agente pode pegar sem triagem adicional.

**Da funcionalidade ao ticket**

1. **Planejamento:** as decisões são fechadas com o usuário e registradas no documento dono delas: as de produto em `docs/` (LLD e, se houver termo novo, `GLOSSARY.md`), e as de prática de código no `AGENTS.md` do projeto.
2. **Spec:** um `Epic` por funcionalidade, com o problema, a solução, as histórias de usuário, as decisões de implementação e de teste e o que fica fora de escopo.
3. **Tickets:** issues filhas do `Epic` da spec (`História`, `Erro` ou `Tarefa`), e não subtasks. Cada ticket é uma fatia vertical, que atravessa banco, API, interface e testes e pode ser verificada sozinha. Tickets de preparação (ambiente, base de componentes) são a exceção e vêm primeiro.
4. **Bloqueios:** as dependências entre tickets são o link nativo `Blocks` do Jira ("is blocked by"), criado com a issue bloqueada apontando para a que a bloqueia, e não texto na descrição.

**Regras de escrita**

- Specs e tickets são escritos em português, com o vocabulário do `GLOSSARY.md`.
- Não cite caminhos de arquivo nem trechos de código: eles envelhecem rápido. Cite documentos e módulos pelo nome. A exceção são as telas da [referência visual](#referência-visual), que vão pelo nome e num commit fixo.
- Todo ticket traz critérios de aceite verificáveis. Cada critério leva um ID `CA<n>` e uma marca de conferência, como descrito em [Plano do ticket](#plano-do-ticket).
- A spec e os tickets levam a label `ready-for-agent` e o tipo de issue certo.

**Ao trabalhar em um ticket**

- Pegue só tickets cujos bloqueios já foram concluídos.
- Leia o ticket e a spec pai antes de começar. O contrato e as regras completas estão no LLD.
- Planeje o ticket com a `/plan-ticket` e só implemente depois do commit de plano, como descrito em [Plano do ticket](#plano-do-ticket).
- Use o identificador da issue no nome da branch.
- Mova a issue para `Em andamento` ao começar, para `Em análise` ao abrir o pull request, e para `Concluído` só ao concluí-la. Ela só é concluída quando todos os critérios de aceite e a [definição de pronto](#definição-de-pronto) passam.
- Não feche nem edite a spec pai ao concluir um ticket.
- Se a implementação mudar uma decisão, atualize o documento dono dela (o LLD ou o `AGENTS.md` do projeto) e o ticket na mesma tarefa.

### Referência visual

Os protótipos do produto ficam no repositório `JulianoRamos/finance-prototipo`, que nasce no Claude Design e é publicado para validação. Cada tela é um arquivo `<Tela>.dc.html` na raiz dele, e é citada pelo nome sem a extensão, como `Lancamentos`. O protótipo anda à frente do código e traz o que ainda vai entrar, então ele nunca é o escopo: o escopo é o recorte que a spec e o ticket fazem dele. O repositório é público, então um protótipo só traz dados fictícios: nenhum nome, valor, conta ou documento real da família, da clínica ou das clientes.

- **Na spec e no ticket de interface:** a seção "Referência visual" traz o repositório, o commit (um hash, e não uma branch nem uma tag, que mudam) e, por tela, o que entra e o que fica fora. O ticket estreita o recorte da spec à fatia dele. O que está na tela e o ticket não cita fica fora do escopo.
- **No plano:** a `/plan-ticket` baixa só as telas citadas, naquele commit, para a pasta `referencia/` do ticket, com o comando da referência visual (ver "Valores da skill de plano"), e registra o recorte no bloco `Visual reference:` da mensagem do commit de plano. A pasta fica fora do Git, como tudo na pasta do ticket, salvo o aceite.
- **Na implementação e na revisão:** as duas leem a cópia da pasta `referencia/`, e não o protótipo atual. Uma mudança no protótipo depois do plano não muda o ticket; ela entra num ticket novo ou num plano refeito.

O fluxo de design inteiro, com o papel do protótipo e do Claude Design, é do `docs/design-system.md`.

### Plano do ticket

Cada ticket é planejado no início dele, e não na criação dos tickets, e só então implementado.

1. **Planejar:** rode a `/plan-ticket` com o identificador do ticket. Ela escreve o plano e para, sem commit.
2. **Aprovar pela página:** a `/plan-ticket` para com a mensagem proposta do commit de plano e a página de revisão do plano, que traz também a visão legível do contrato e do schema, sem versionar nenhuma das duas; o usuário lê a página e responde no chat, e só depois da aprovação vem o commit de plano, com essa mensagem. O passo a passo e as abas da página estão na skill.
3. **Implementar:** numa sessão nova, a partir do commit de plano e do arquivo de aceite, com a skill `tdd`. Os seams e a lista de testes já vêm do plano. Num ticket sem critério de teste, como o de design, não há `tdd`: cada critério é entregue como o cenário dele descreve, e a definição de pronto só vale se o ticket alterar código.

**Os formatos são da skill.** A skill de plano, em `.claude/skills/plan-ticket/`, é a dona dos formatos do plano: o ID e a marca do critério, o arquivo de aceite e a tag do ID no teste (`formatos/aceite.md`), a mensagem do commit de plano (`formatos/mensagem.md`) e o contrato de rota e de tabela, com a saída do comando do contrato (`formatos/contrato.md`). Siga-os; aqui fica só o que é deste projeto.

**Valores da skill de plano**

- **Pasta dos tickets:** `docs/tickets`. O Git versiona nela só o arquivo de aceite de cada pasta de ticket.
- **Pasta dos documentos:** `docs`.
- **Comando do Node:** `scripts/node-in-harness.sh`, que roda o Node no contêiner `harness`, sobre o repositório montado em `/repo`, porque a máquina não roda `node`.
- **Comando do contrato:** `scripts/verify.sh contract`, a visão legível do contrato e do schema, que o grupo da `api` em `scripts/verify/` declara.
- **Comando da referência visual:** `scripts/referencia-visual.sh <pai> <ticket> <commit> <tela>...`, que baixa as telas com o `gh`, na máquina, de `JulianoRamos/finance-prototipo` (ou de `PROTOTYPE_REPO`), para `docs/tickets/<pai>/<ticket>/referencia/`, com a origem em `origem.txt`.
- **Arquivos do contrato:** `apps/api/openapi.json`, a cópia da especificação, para as rotas, e `apps/api/prisma/schema/`, para as tabelas. O formato de uma rota e de uma tabela está no `docs/lld.md`, seção 5.

O atalho `scripts/verify.sh plan <issue> <ticket> [<commit de plano>]` chama o script da página da skill com esses valores (a `<issue>` é a issue pai do ticket, que vai no `--pai` do script); use-o nos passos de parada e de commit da skill.

**Neste projeto**

- **Congelamento:** o agente não altera um arquivo de aceite já em commit. Um hook nega a edição pelo agente, e a guarda do harness avisa no PR quando um aceite existente muda.
- **Cobertura:** a CI confere o ID na tag do teste, como descrito em "Aceite no pull request". O ID vai na tag, e não no título, porque os relatórios JSON das suítes trazem as tags de cada teste. Os formatos de relatório que o conferidor lê estão no `scripts/check-acceptance.cjs`; uma suíte de outro formato entra junto com um leitor dele, no ticket que a cria.

## Convenções de Git

- **Branch principal:** `main`. Nunca faça commit direto nela.
- **Branches de trabalho:** `feature/*`, `bugfix/*`, `hotfix/*` e `docs/*`, criadas a partir da `main` e integradas por pull request.
- **Commits:** mensagens curtas e descritivas, focadas no porquê da mudança.
- **Merge:** quem faz o merge é o usuário, nunca o agente, nem a pedido. O `.claude/settings.json` nega o `gh pr merge`, e não use outro caminho para fazê-lo.
- **Arquivos do harness:** `.github/`, `.claude/settings.json`, `.claude/hooks/`, `.claude/agents/`, `scripts/` e os scripts da skill de plano (`.claude/skills/plan-ticket/scripts/`) só mudam quando a tarefa é sobre o harness. Um pull request que os altera é reprovado pelo check `Guarda do harness` e só entra por override do usuário. Avise isso ao abrir o PR.

## Consulta à documentação de bibliotecas

Quando precisar consultar a documentação de uma biblioteca, use o context7 para buscar informações atualizadas e precisas.

## Uso das skills

Quando estiver trabalhando em uma tarefa, primeiro decomponha a solicitação em suas subtarefas e preocupações subjacentes, depois identifique quais skills disponíveis correspondem a alguma delas e ative essas skills.

Quando uma skill diverge deste arquivo, do `AGENTS.md` do projeto ou dos documentos de `docs/`, valem estes.
