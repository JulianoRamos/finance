# Low-level design

Este documento detalha a implementação do finance: a estrutura de pastas, as bibliotecas, o esquema do banco, o formato dos contratos de API, as regras de negócio, as tarefas agendadas e as variáveis de ambiente. Ele segue as decisões do `hld.md` e usa o vocabulário do `GLOSSARY.md`. Como o código é escrito (camadas, imports, nomes de arquivo, tratamento de erro, comandos) fica no `AGENTS.md` de cada app.

O esquema da seção 4 é o modelo de cada módulo: as tabelas, as colunas que carregam regra e as restrições. As colunas completas, os tipos exatos e os índices de cada tabela são escritos no schema do Prisma pelo plano do ticket que cria a tabela, no formato da seção 5.

## 1. Estrutura do monorepo

```
apps/
  api/                    NestJS: os módulos de domínio
    src/
      modulos/<módulo>/   um módulo do HLD por pasta, com a interface pública num index.ts
      comum/              dinheiro, datas, transação, contexto financeiro, erros
      cli/                os comandos de operação (restauração, primeiro usuário, link de recuperação)
    prisma/
      schema/             o schema do Prisma, um arquivo por módulo
      migrations/
    openapi.json          a cópia da especificação gerada, que é o contrato
    test/                 os testes de integração
  web/                    Next.js: a interface e a porta de entrada
    src/
      app/                as rotas do App Router
      api/                o cliente gerado do openapi.json da api
    e2e/                  os testes de ponta a ponta
infra/
  compose.prod.yaml       o Compose de produção
  Caddyfile               o proxy reverso
```

- **pnpm workspaces,** sem orquestrador de monorepo. Cada app tem o próprio `package.json`, e não há pacote compartilhado no começo: o que a `web` precisa da `api` vem do cliente gerado. Um pacote em `packages/` só nasce quando dois apps precisarem do mesmo código, e não por previsão.
- **Node 24 LTS** nos dois apps, a mesma linha do contêiner `harness`.
- Cada app entra no `compose.dev.yaml`, ganha o próprio `AGENTS.md` e o grupo dele em `scripts/verify/` no ticket que a cria, como o `AGENTS.md` da raiz descreve.

## 2. Bibliotecas

As versões exatas são fixadas no ticket que cria cada app, na versão estável mais recente, conferida na documentação atual. As linhas abaixo são as vigentes em novembro de 2026.

| Uso | Biblioteca | Observação |
| --- | --- | --- |
| API | NestJS 12, sobre Express | Módulos, injeção de dependências, guards |
| ORM | Prisma 7, com `@prisma/adapter-pg` | Cliente gerado no próprio app, configurado em `prisma.config.ts`. Migrações pelo `prisma migrate` |
| Banco | PostgreSQL 18 | `uuidv7()` nativo para as chaves |
| Validação na API | `class-validator` e `class-transformer` | Os mesmos DTOs geram a OpenAPI |
| OpenAPI | `@nestjs/swagger` | Gera a especificação a partir dos controladores e DTOs |
| Decimal | `decimal.js` (o `Prisma.Decimal`) | Toda conta com dinheiro, custo e fração |
| Datas | `date-fns` e `@date-fns/tz` | Datas de calendário e o fuso America/Sao_Paulo |
| Senha | `@node-rs/argon2` | argon2id |
| Segundo fator | `otplib` | TOTP, RFC 6238 |
| Limite de tentativas por origem | `@nestjs/throttler` | O limite por conta fica no banco (seção 6.1) |
| Agendador | `@nestjs/schedule` | Tarefas da seção 7 |
| Logs | `nestjs-pino` | JSON na saída padrão |
| CSV | `csv-parse` | Leitura dos extratos |
| XLSX | `exceljs` | Leitura dos extratos e geração dos relatórios |
| OFX | Leitor próprio | O OFX 1.x dos bancos brasileiros é SGML com variações; o leitor é pequeno e testado com as amostras |
| PDF | `pdfmake` | Relatórios, no servidor, sem navegador |
| Backup | `pg_dump`, `pg_restore`, `tar` e `age` | No contêiner da `api`; a cópia externa usa `@aws-sdk/client-s3` |
| Interface | Next.js 16 (App Router), React 19, Tailwind CSS 4 | Os componentes são do `design-system.md` |
| Cliente da API | `openapi-typescript` e `openapi-fetch` | Tipos gerados do `openapi.json` |
| Testes | Vitest e Playwright | Os dois formatos de relatório que o conferidor do aceite lê. A `api` roda no Vitest com o SWC, pelos decorators |
| Lint e formatação | ESLint com `typescript-eslint`, `eslint-plugin-boundaries` e Prettier | O `boundaries` impõe as regras entre módulos (seção 3) |
| Proxy | Caddy | HTTPS automático ou com certificado local |

## 3. Fronteiras entre os módulos

- Cada módulo é uma pasta em `apps/api/src/modulos/` e expõe só o `index.ts` dela: o módulo do Nest e os serviços públicos. Outro módulo importa só esse arquivo, e o lint reprova o import de qualquer outro caminho do módulo.
- Cada tabela é de um módulo só, declarada no arquivo do schema dele. Uma consulta do módulo A não lê nem grava tabela do módulo B, nem por `join`. Os módulos só leitores (Indicadores, Relatórios, Alertas) leem pelas consultas que os donos expõem.
- As dependências permitidas, de quem chama para quem é chamado:

| Módulo | Pode chamar |
| --- | --- |
| Identidade | Entidades, Auditoria |
| Entidades | Auditoria |
| Contas | Entidades, Auditoria |
| Lançamentos | Contas, Entidades, Auditoria |
| Importação | Contas, Conciliação, Documentos, Entidades, Auditoria |
| Conciliação | Contas, Lançamentos, Recebimentos, Auditoria |
| Repasses | Lançamentos, Entidades, Auditoria |
| Recebimentos | Lançamentos, Contas, Auditoria |
| Estoque | Entidades, Auditoria |
| Compras | Estoque, Lançamentos, Auditoria |
| Clínica | Lançamentos, Recebimentos, Estoque, Entidades, Auditoria |
| Patrimônio | Lançamentos, Contas, Entidades, Auditoria |
| Planejamento | Lançamentos, Contas, Patrimônio, Entidades, Auditoria |
| Documentos | Entidades, Auditoria |
| Indicadores, Relatórios, Alertas | Todos, só pelas consultas |
| Backup | Auditoria |

- **Transação:** a transação do Prisma corre pelo contexto da requisição (`AsyncLocalStorage`), e o serviço público de cada módulo a usa quando ela existe. O comando que atravessa módulos abre a transação uma vez, no serviço do módulo que recebeu a requisição.

## 4. Esquema do banco

### 4.1 Convenções

- **Nomes:** os termos do domínio em português, sem acento. Tabelas e colunas em `snake_case` no banco (`@@map` e `@map`), e `camelCase` no Prisma e no TypeScript. A tabela vai no singular: `lancamento`, `movimentacao`.
- **Chave primária:** `id uuid`, com `uuidv7()`. A exceção é o registro de auditoria, com `bigint` sequencial.
- **Colunas comuns** de toda tabela de domínio: `criado_em` e `atualizado_em` (`timestamptz`), e `versao` (`integer`) nas que o usuário edita, para o bloqueio otimista (seção 6.20).
- **Dinheiro:** `numeric(15,2)`, sempre positivo, com o sentido dado pelo tipo do registro. **Custo unitário e custo médio:** `numeric(18,6)`. **Quantidade de estoque:** `numeric(15,4)`. **Fração de participação:** `numeric(9,8)`. **Taxa percentual:** `numeric(7,4)`.
- **Datas de calendário** (data do fato, vencimento, data da movimentação) em `date`; instantes em `timestamptz`.
- **Enumerações** como `enum` do PostgreSQL, declaradas no Prisma.
- **Exclusão:** a chave estrangeira é `RESTRICT` por padrão. `CASCADE` só em tabela filha que não existe sem a mãe e não é registro financeiro, como os itens de uma lista de materiais.
- **Restrições que o Prisma não expressa** (`CHECK`, índice único parcial, permissão do papel do banco) são escritas à mão na migração e anotadas no schema, como a seção 5 pede.

### 4.2 Identidade

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `usuario` | `nome`, `email`, `senha_hash`, `totp_segredo_cifrado`, `totp_ativo`, `gere_acessos`, `ativo` | `email` único, comparado em minúsculas |
| `sessao` | `usuario_id`, `token_hash`, `ultimo_uso_em`, `expira_em`, `encerrada_em`, `agente`, `origem` | `token_hash` único |
| `codigo_recuperacao_2fa` | `usuario_id`, `codigo_hash`, `usado_em` | |
| `link_recuperacao` | `usuario_id`, `token_hash`, `gerado_por_id`, `expira_em`, `usado_em` | `token_hash` único. `gerado_por_id` nulo quando veio do comando no servidor |
| `tentativa_acesso` | `email`, `origem`, `etapa` (senha, segundo fator, recuperação), `sucesso`, `em` | Índice por `email` e `em` |
| `permissao` | `usuario_id`, `entidade_id`, `nivel` (ver, operar) | Chave `(usuario_id, entidade_id)` |

O segredo do TOTP é cifrado com AES-256-GCM e a chave `TOTP_CHAVE`, porque precisa ser lido de volta. Senhas, tokens de sessão, links e códigos de recuperação são só hash: argon2id para a senha e os códigos de recuperação, SHA-256 para os tokens aleatórios de 256 bits.

### 4.3 Entidades

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `entidade` | `tipo` (pf, pj), `nome`, `documento`, `ativa` | `documento` único quando preenchido. O `tipo` não muda depois da criação (regra 6.2) |
| `entidade_operacao` | `entidade_id`, `operacao` (clinica) | Chave `(entidade_id, operacao)`. Só pessoa jurídica (regra 6.2) |
| `grupo_financeiro` | `nome`, `visao_familiar` | Índice único parcial: só um grupo com `visao_familiar` |
| `grupo_membro` | `grupo_id`, `entidade_id` | Chave `(grupo_id, entidade_id)`. Só pessoa física na Visão Familiar (regra 6.2) |
| `participacao_societaria` | `detentora_id` (pessoa física ou empresa), `empresa_id` (pessoa jurídica), `fracao`, `inicio`, `fim` | `0 < fracao <= 1`. A soma vigente por empresa não passa de 1, e não há ciclo (regra 6.17) |

### 4.4 Auditoria

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `registro_auditoria` | `id bigint`, `usuario_id`, `em`, `operacao` (criar, alterar, excluir), `tabela`, `registro_id`, `entidade_id`, `antes jsonb`, `depois jsonb`, `requisicao_id` | O papel do banco da aplicação não tem `UPDATE` nem `DELETE` nesta tabela, salvo a anonimização (regra 6.19), que roda por uma função com permissão própria |

### 4.5 Contas

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `conta` | `entidade_id`, `nome`, `tipo` (corrente, pagamento, especie, cartao), `instituicao` (nubank, caixa, mercado_pago, bradesco, itau, banco_do_brasil, outra), `reserva`, `saldo_inicial`, `data_saldo_inicial`, `ativa`. No cartão: `dia_fechamento`, `dia_vencimento`, `conta_pagadora_id` | `CHECK` dos dias só no cartão. `CHECK (tipo <> 'cartao' OR NOT reserva)` |
| `fatura` | `conta_id`, `competencia` (o primeiro dia do mês), `data_fechamento`, `data_vencimento`, `saldo_anterior` | Única por `(conta_id, competencia)` |
| `movimentacao` | `conta_id`, `data`, `valor`, `sentido` (entrada, saida), `descricao`, `origem` (importada, manual, ajuste), `arquivo_importado_id`, `chave_externa`, `chave_duplicidade`, `fatura_id`, `motivo_ajuste` | Única `(conta_id, chave_duplicidade)` quando `origem = 'importada'`. `CHECK` de `motivo_ajuste` obrigatório no ajuste |

### 4.6 Lançamentos

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `categoria` | `arvore` (pf, pj), `entidade_id`, `pai_id`, `nome`, `natureza` (receita, despesa), `ativa` | `CHECK ((arvore = 'pf') = (entidade_id IS NULL))`: a árvore das pessoas físicas é uma só, e cada empresa tem a dela |
| `lancamento` | `entidade_id`, `tipo` (receita, despesa, transferencia, aplicacao, resgate, repasse, estorno, compra_estoque), `efeito` (receita, deducao_receita, despesa, neutro), `descricao`, `categoria_id`, `finalidade` (pessoal, familiar), `data_fato`, `valor_total`, `pagador_id`, `recorrencia_id`, `origem_modulo`, `origem_id`, `cancelado_em` | `finalidade` só em despesa de pessoa física. `origem_modulo` diz o módulo dono, que é o único que altera o lançamento |
| `parcela` | `lancamento_id`, `numero`, `valor`, `vencimento`, `conta_id`, `sentido`, `fatura_id`, `cancelada_em`, `estimada` | Única `(lancamento_id, numero, sentido)` |
| `recorrencia` | `entidade_id`, o modelo do lançamento (descrição, categoria, finalidade, conta, `valor_estimado`), `frequencia` (semanal, mensal, anual), `dia`, `inicio`, `fim`, `ativa` | |

A transferência, a aplicação e o resgate são lançamentos com duas parcelas, uma de saída e uma de entrada, cada uma na sua conta. O repasse cria um lançamento em cada entidade (regra 6.9).

### 4.7 Importação

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `arquivo_importado` | `conta_id`, `nome`, `hash_sha256`, `formato` (ofx, csv, xlsx), `leitor`, `periodo_inicio`, `periodo_fim`, `documento_id`, `situacao` (previa, confirmado, descartado), `importado_por_id` | Único `(conta_id, hash_sha256)` quando confirmado |

As linhas da prévia não são gravadas: a prévia é recalculada do arquivo guardado até a confirmação.

### 4.8 Conciliação

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `conciliacao` | `movimentacao_id`, `parcela_id`, `recebivel_id`, `valor`, `automatica`, `criada_por_id` | `CHECK` de exatamente um entre `parcela_id` e `recebivel_id`. A soma por movimentação não passa do valor dela (regra 6.5) |

### 4.9 Repasses

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `repasse` | `origem_id`, `destino_id` (entidades), `tipo` (pro_labore, distribuicao_lucros, aporte, reembolso, emprestimo, transferencia_familiar, a_classificar), `valor`, `data`, `lancamento_origem_id`, `lancamento_destino_id`, `emprestimo_id`, `papel_emprestimo` (concessao, devolucao) | `CHECK (origem_id <> destino_id)`. `emprestimo_id` só no tipo empréstimo |
| `reembolso_pendente` | `devedora_id`, `credora_id`, `lancamento_id` (a despesa paga pela outra), `valor`, `convertido_em_aporte_id` | |
| `reembolso_quitacao` | `reembolso_pendente_id`, `repasse_id`, `valor` | |
| `emprestimo` | `credora_id`, `devedora_id`, `valor`, `data` | |

O saldo em aberto do reembolso e do empréstimo é calculado: o valor menos as quitações ou as devoluções.

### 4.10 Recebimentos

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `forma_pagamento` | `entidade_id`, `nome`, `meio` (pix, dinheiro, debito, credito), `adquirente`, `conta_destino_id`, `ativa` | |
| `forma_pagamento_condicao` | `forma_pagamento_id`, `parcelas`, `taxa_percentual`, `prazo_dias` | Única `(forma_pagamento_id, parcelas)` |
| `recebivel` | `entidade_id`, `parcela_id` (a da receita), `forma_pagamento_id`, `numero`, `valor_bruto`, `taxa`, `valor_liquido`, `data_prevista`, `antecipacao_id`, `estornado_em` | `CHECK (valor_liquido = valor_bruto - taxa)` |
| `antecipacao` | `entidade_id`, `data`, `taxa`, `lancamento_taxa_id` | |

### 4.11 Clínica

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `cliente` | `entidade_id`, `nome`, `telefone`, `cpf`, `anonimizada_em` | `cpf` único por entidade quando preenchido |
| `procedimento` | `entidade_id`, `nome`, `preco`, `ativo` | |
| `procedimento_material` | `procedimento_id`, `produto_id`, `quantidade` | `CASCADE` com o procedimento |
| `pacote` | `entidade_id`, `cliente_id`, `procedimento_id`, `sessoes`, `valor`, `lancamento_receita_id`, `situacao_fiscal`, `cancelado_em`, `lancamento_estorno_id` | `sessoes > 0` |
| `atendimento` | `entidade_id`, `cliente_id`, `data`, `pacote_id`, `valor`, `receita_sessao`, `lancamento_receita_id`, `situacao_fiscal`, `cancelado_em` | Avulso: `valor` e `situacao_fiscal` preenchidos e `pacote_id` nulo. Sessão: o contrário, com `receita_sessao` |
| `atendimento_procedimento` | `atendimento_id`, `procedimento_id`, `valor` | |
| `nota_fiscal` | `entidade_id`, `atendimento_id`, `pacote_id`, `numero`, `data`, `valor`, `documento_id` | Exatamente um entre `atendimento_id` e `pacote_id`, e no máximo uma nota não cancelada por registro |

A clínica só aceita escrita em entidade com a operação `clinica` ligada; o serviço confere isso antes de qualquer comando.

### 4.12 Estoque

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `produto` | `entidade_id`, `nome`, `unidade`, `estoque_minimo`, `controla_lote`, `quantidade`, `custo_medio` | `quantidade >= 0` |
| `lote` | `produto_id`, `codigo`, `validade`, `quantidade` | Único `(produto_id, codigo)`. `quantidade >= 0` |
| `entrada_estoque` | `produto_id`, `lote_id`, `data`, `quantidade`, `custo_unitario`, `entrega_item_id` | |
| `baixa_estoque` | `produto_id`, `lote_id`, `data`, `quantidade`, `custo_unitario`, `motivo` (consumo, perda, ajuste), `atendimento_id` | `custo_unitario` é o custo médio no momento da baixa |

`quantidade` e `custo_medio` do produto são guardados, e não calculados na consulta, porque o custo médio depende da ordem das entradas e baixas (regra 6.14).

### 4.13 Compras

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `fornecedor` | `entidade_id`, `nome`, `documento`, `contato` | |
| `compra` | `entidade_id`, `fornecedor_id`, `data`, `frete`, `lancamento_id` | |
| `compra_item` | `compra_id`, `produto_id`, `quantidade`, `preco_unitario`, `frete_rateado` | |
| `entrega` | `compra_id`, `data` | |
| `entrega_item` | `entrega_id`, `compra_item_id`, `quantidade`, `lote_codigo`, `validade` | A soma entregue por item não passa do comprado |

### 4.14 Patrimônio

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `bem` | `entidade_id`, `nome`, `tipo` (imovel, veiculo, investimento, equipamento, outro), `classe` (investimento, consumo), `data_aquisicao`, `valor_aquisicao`, `baixado_em` | |
| `reavaliacao` | `bem_id`, `data`, `valor` | Única `(bem_id, data)` |
| `divida` | `entidade_id`, `credor`, `descricao`, `valor_original`, `data` | |
| `saldo_divida` | `divida_id`, `data`, `saldo` | Única `(divida_id, data)` |

### 4.15 Planejamento

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `meta` | `entidade_id` ou `grupo_id`, `nome`, `valor_alvo`, `data_alvo` | Exatamente um dos dois donos |
| `meta_vinculo` | `meta_id`, `conta_id` ou `bem_id` | Exatamente um dos dois |
| `contribuicao_planejada` | `meta_id`, `valor`, `frequencia`, `inicio` | |
| `orcamento` | `entidade_id`, `competencia`, `categoria_id`, `valor` | Único `(entidade_id, competencia, categoria_id)` |

### 4.16 Alertas, Documentos e Backup

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `alerta_lido` | `usuario_id`, `chave`, `lido_em` | Chave `(usuario_id, chave)`. A `chave` identifica a ocorrência (regra 6.18) |
| `documento` | `entidade_id`, `nome_original`, `tipo_mime`, `tamanho`, `hash_sha256`, `caminho`, `enviado_por_id` | `caminho` é relativo ao volume de documentos e nunca vem do usuário |
| `documento_vinculo` | `documento_id`, `tipo_registro`, `registro_id` | |
| `backup` | `tipo` (automatico, manual), `iniciado_em`, `terminado_em`, `situacao` (em_andamento, sucesso, falha), `arquivo`, `tamanho`, `hash_sha256`, `copia_externa` (nao_configurada, sucesso, falha), `erro` | |

## 5. Contratos

**Arquivos do contrato:** o `apps/api/openapi.json`, para as rotas, e o `apps/api/prisma/schema/`, para as tabelas. Eles entram em "Valores da skill de plano", no `AGENTS.md` da raiz, no ticket que cria a `api`, junto com o comando do contrato.

**Rota.** Cada rota traz, no `openapi.json` gerado pelos decorators, os itens do formato de rota da skill de plano:

- **Prefixo:** `/v1`.
- **Autenticação:** esquema `sessao`, um `Authorization: Bearer <token>` que a `web` monta com o cookie. As rotas públicas (login, uso de link de recuperação, saúde) são marcadas como tal.
- **Contexto financeiro:** o cabeçalho `Contexto-Financeiro`, com `entidade:<id>` ou `grupo:<id>`, obrigatório nas rotas de dados.
- **Dinheiro e quantidades** trafegam como string decimal (`"1234.56"`), e nunca como número JSON. **Datas de calendário** como `"AAAA-MM-DD"`, e instantes em ISO 8601 com fuso.
- **Edição:** o corpo traz a `versao` lida, e a rota devolve `409 CONFLITO_VERSAO` quando ela mudou.
- **Listas:** paginadas por `cursor` e `limite` (padrão 50, máximo 200).
- **Erro:** o corpo é `{ "codigo": "<CODIGO_ESTAVEL>", "mensagem": "<texto para o usuário>", "campos": { "<campo>": "<motivo>" } }`, com `campos` só na entrada inválida. Os códigos comuns:

| Status | Código | Quando |
| --- | --- | --- |
| 400 | `ENTRADA_INVALIDA` | O corpo, o caminho ou a consulta não passam na validação |
| 401 | `NAO_AUTENTICADO` | Sem sessão válida |
| 403 | `SEM_PERMISSAO` | O usuário não tem o nível pedido numa entidade do contexto |
| 404 | `NAO_ENCONTRADO` | O registro não existe ou está fora do contexto |
| 409 | `CONFLITO_VERSAO` | A `versao` enviada não é a atual |
| 422 | Código da regra | Uma regra de negócio recusou o comando, com um código próprio, como `ESTOQUE_INSUFICIENTE` |
| 429 | `LIMITE_TENTATIVAS` | Tentativas demais (regra 6.1) |

**Exceção:** a rota de saúde (`GET /v1/saude`) não usa o corpo de erro. Ela responde 200 ou 503 com o mesmo corpo de estado, `{ "banco": "conectado" }` ou `{ "banco": "fora_do_ar" }`, porque quem a lê (o healthcheck e a `web`) quer o estado, e não um erro.

**Tabela.** Cada tabela traz, no schema do Prisma, os itens do formato de tabela da skill de plano, com um comentário `///` em cada coluna e, na tabela, a nota de toda restrição escrita à mão na migração.

## 6. Regras de negócio

### 6.1 Acesso

- **Sessão:** expira depois de 7 dias sem uso e, de qualquer forma, 30 dias depois da criação. O `ultimo_uso_em` é atualizado no máximo uma vez por minuto. A troca de senha encerra as outras sessões do usuário.
- **Limite de tentativas:** 5 falhas por e-mail em 15 minutos bloqueiam aquela etapa por 15 minutos; 20 falhas por origem em 15 minutos bloqueiam a origem. A resposta do bloqueio não diz se o e-mail existe.
- **Link de recuperação:** vale 1 hora e uma vez só. É gerado por um usuário com `gere_acessos` ou pelo comando `recuperar-acesso <email>` no servidor. Usá-lo define a nova senha e encerra todas as sessões.
- **Senha:** pelo menos 12 caracteres, sem outra regra de composição. A definição e a troca pedem a senha duas vezes.
- **Primeiro usuário:** o comando `criar-usuario <nome> <email>` no servidor cria um usuário com `gere_acessos` e devolve um link de recuperação, com a mesma validade, para ele definir a senha. Os outros usuários são cadastrados pela interface, por quem tem `gere_acessos`, e recebem o link da mesma forma.
- **Segundo fator:** a ativação confirma um código antes de valer e gera 10 códigos de recuperação, mostrados uma vez. Desativar pede a senha e um código.
- **Permissão:** `ver` lê, `operar` lê e escreve. Gerir usuários e permissões exige `gere_acessos`. No uso inicial, os dois usuários têm `operar` em todas as entidades e `gere_acessos`.
- **Troca de e-mail:** o e-mail é o login e é trocado por quem tem `gere_acessos`. A troca encerra as sessões do usuário.
- **Usuário desativado:** não entra, e as sessões dele são encerradas na hora. O histórico e as permissões ficam guardados, e ele pode ser reativado.

### 6.2 Entidades e grupos

- A Visão Familiar já vem criada na primeira subida e só aceita pessoa física. As outras pessoas físicas cadastradas não entram nela sozinhas.
- A Visão Familiar não é renomeada nem excluída.
- O tipo de uma entidade (pessoa física ou jurídica) não muda depois da criação.
- Uma entidade com registros não é excluída: é desativada, e some das escolhas sem sumir dos números do passado.
- **Exclusão de grupo:** um grupo sem metas é excluído, e quem estava nesse contexto volta para a Visão Familiar. Um grupo com metas é recusado, com `422 GRUPO_COM_METAS`, até as metas serem excluídas ou passadas para outro dono.
- **Operações:** só se ligam em pessoa jurídica, e uma empresa pode ter várias ligadas. Na API, a entidade traz a lista das ligadas (`"operacoes": ["clinica"]`). Desligar uma operação esconde as funções dela e recusa novas escritas, e não apaga nada: ao religar, tudo volta como estava. Os lançamentos que a operação criou continuam nos números, mas só mudam com ela ligada (regra 6.20).
- **Participação societária:** é encerrada informando o último dia (`fim`). Depois dele, a fração deixa de contar como vigente, e o registro continua no histórico.

### 6.3 Saldo e ajuste

- O saldo de uma conta numa data é o saldo inicial mais as entradas menos as saídas das movimentações entre a data do saldo inicial e essa data, inclusive.
- Quando o saldo calculado difere do banco, o usuário registra um ajuste: uma movimentação de origem `ajuste`, com o valor da diferença e um motivo obrigatório. O ajuste não é receita nem despesa e não entra em nenhum indicador de resultado; ele aparece num relatório próprio de ajustes, para que um ajuste grande seja investigado.

### 6.4 Importação e duplicidade

- O leitor é escolhido pela `instituicao` da conta e pelo formato do arquivo. Um arquivo que nenhum leitor reconhece falha antes da prévia, com a mensagem de qual banco e formato eram esperados, e nada é gravado.
- **Arquivo repetido:** um arquivo com o mesmo SHA-256 já confirmado na mesma conta é recusado inteiro.
- **Linha repetida:** a `chave_duplicidade` de cada linha é o identificador do banco (o `FITID` do OFX), quando existe. Sem ele, é o hash da conta, da data, do valor, do sentido, da descrição normalizada (sem espaços repetidos, em minúsculas) e do número de ordem da linha entre as idênticas do mesmo arquivo. Uma linha com chave já gravada fica de fora, e a prévia a mostra como duplicada. O número de ordem preserva duas compras iguais no mesmo dia.
- **Movimentação manual:** uma linha importada com a mesma conta, o mesmo valor e sentido e data até 3 dias antes ou depois de uma movimentação manual ainda não substituída, e só essa, substitui a manual: a manual some, e as conciliações dela passam para a importada.
- A confirmação grava tudo numa transação; o arquivo original fica guardado como documento da conta.

### 6.5 Conciliação

- **Automática:** a movimentação é conciliada sozinha com uma parcela quando as duas são da mesma conta, o valor em aberto da parcela é igual ao da movimentação, com o mesmo sentido, a data fica até 3 dias antes ou depois do vencimento, e essa parcela é o único candidato. Com dois candidatos ou mais, como duas previsões iguais em datas próximas, nada é conciliado sozinho: a movimentação vai para a revisão com os candidatos como sugestões.
- **Sugestões na revisão:** as parcelas em aberto da mesma conta e sentido com vencimento até 10 dias de distância, primeiro as de valor igual e depois as de data mais próxima.
- **Parcial:** uma movimentação pode liquidar várias parcelas, e uma parcela pode ser liquidada por várias movimentações. A soma conciliada nunca passa do valor da movimentação nem do valor da parcela.
- **Valor estimado:** conciliar uma parcela estimada (de recorrência) atualiza o valor dela para o da movimentação.
- **Recebível:** a movimentação do repasse da adquirente concilia com recebíveis, pela mesma regra, com o valor líquido.

### 6.6 Situação da parcela

Calculada, salvo o cancelamento: `cancelada` se `cancelada_em` está preenchido; `liquidada` se a soma conciliada é igual ao valor; `parcial` se é maior que zero e menor que o valor; `vencida` se não foi liquidada e o vencimento é anterior a hoje; e `prevista` nos outros casos. A parcial vencida aparece como vencida, com o valor em aberto.

### 6.7 Cartão e fatura

- Uma compra feita até o dia de fechamento entra na fatura do ciclo que fecha naquele mês; depois dele, na seguinte. A parcela N de uma compra parcelada entra na fatura N−1 ciclos depois da primeira.
- As datas de fechamento e de vencimento de cada fatura vêm do cadastro do cartão e podem ser corrigidas fatura a fatura, porque os bancos as movem. A fatura importada confirma as linhas dela.
- **Pagamento da fatura:** é uma transferência da conta pagadora para o cartão, na data do pagamento. Pelo regime de caixa (ADR 0001), cada parcela da fatura conta como despesa na data em que a fatura é paga, e não na data da compra.
- **Pagamento parcial (exceção):** o restante vira o `saldo_anterior` da fatura seguinte, os juros e encargos entram como despesa financeira na fatura em que são cobrados, e todas as despesas da fatura contam no mês do primeiro pagamento.
- O cartão de uma pessoa física pagando uma despesa de empresa segue a regra 6.10.

### 6.8 Efeito dos lançamentos

O `efeito` decide em qual indicador o lançamento entra, e é fixado pelo `tipo`:

| Tipo | Efeito |
| --- | --- |
| receita | receita |
| estorno | dedução de receita |
| despesa | despesa |
| transferencia, aplicacao, resgate, compra_estoque | neutro |
| repasse | o da tabela da regra 6.9, de cada lado |

- **Data no resultado:** nas pessoas físicas, a data de pagamento da parcela (ADR 0001). Na empresa, no resultado gerencial, a data do fato; no fluxo de caixa, a data das movimentações.
- **Compra de estoque:** a compra da clínica é neutra no resultado gerencial. O custo entra quando o insumo é consumido, pela baixa (regra 6.14); no fluxo de caixa, entra o pagamento.
- **Bem de consumo:** a compra é despesa. A compra de bem de investimento é aplicação.
- **Dívida:** cada parcela paga é despesa pelo valor inteiro, e o saldo devedor é o informado pelo credor.

### 6.9 Repasses

Os tipos permitidos por par de entidades e o efeito em cada lado:

| Tipo | Par permitido | Quem dá | Quem recebe |
| --- | --- | --- | --- |
| Pró-labore | Empresa → pessoa física | despesa | receita |
| Distribuição de lucros | Empresa → pessoa física | neutro | receita |
| Aporte | Pessoa física ou empresa → empresa | neutro | neutro |
| Reembolso | Qualquer par | neutro | neutro |
| Empréstimo (concessão ou devolução) | Qualquer par | neutro | neutro |
| Transferência familiar | Pessoa física → pessoa física | neutro | neutro |
| A classificar | Qualquer par | neutro | neutro |

- O pró-labore e a distribuição de lucros exigem que a pessoa física tenha participação societária vigente na empresa.
- Um repasse a classificar gera alerta enquanto não tem tipo.
- **Visão Familiar e outros grupos:** num grupo, o repasse entre duas entidades do grupo some dos totais, porque é interno; o repasse com uma entidade de fora conta pelo efeito do lado de dentro. O saldo do grupo é a soma dos saldos das contas dos membros.

### 6.10 Reembolso pendente

- Uma despesa com `pagador_id` diferente da dona abre um reembolso pendente da dona para o pagador, pelo valor da despesa. A parcela fica na conta do pagador, e para o pagador o valor é neutro: é um valor a receber, e não despesa.
- O reembolso é quitado por repasses do tipo reembolso, inteiros ou em partes, ou convertido em aporte, quando a dona é empresa e o pagador tem participação nela. A conversão cria o repasse de aporte sem movimentação.
- Gera alerta enquanto houver saldo em aberto.

### 6.11 Empréstimo entre entidades

- A concessão é um repasse de empréstimo que cria o `emprestimo`; as devoluções são repasses de empréstimo no sentido contrário, ligados a ele. O saldo em aberto é o valor menos as devoluções, e não pode ficar negativo.
- No patrimônio, o saldo em aberto é um bem de quem emprestou e uma dívida de quem recebeu, e os dois se anulam num grupo que tem as duas.

### 6.12 Pagamento na clínica

- **Pix e dinheiro:** a receita é liquidada pela movimentação da conta de destino da forma de pagamento.
- **Cartão:** no pagamento, a parcela da receita é dada como liquidada, e o sistema gera um recebível por parcela da adquirente, com o bruto, a taxa (bruto × taxa percentual da condição, arredondada ao centavo) e o líquido, na data prevista (a data do pagamento mais o prazo da condição, e mais 30 dias a cada parcela). A soma das taxas vira uma despesa financeira na data do pagamento. O dinheiro entra no fluxo de caixa quando cada recebível é conciliado.
- **Antecipação:** os recebíveis escolhidos ganham a nova data prevista, e a taxa da antecipação vira despesa financeira na data dela.
- **Estorno:** lançamento de estorno na data em que é feito, que reduz o faturamento desse mês (glossário, "Estorno"). No cartão, os recebíveis ainda não pagos são marcados como estornados.

### 6.13 Atendimento e pacote

- **Avulso:** cria a receita pelo valor, na data do pagamento, e começa com a situação fiscal `pendente`, que o usuário pode mudar para `nao_aplicavel`.
- **Pacote:** a receita é do valor inteiro, no pagamento. A receita da sessão é o valor dividido pelo número de sessões, com o resto dos centavos na última. O saldo é o número de sessões menos as sessões realizadas não canceladas; uma sessão não é registrada com o saldo zerado.
- **Cancelamento do pacote:** o usuário informa o valor do estorno, que o sistema sugere como o saldo em sessões vezes a receita da sessão, e que pode ser zero.
- **Situação fiscal:** a nota fiscal registrada leva a situação a `emitida`; cancelar a nota a leva de volta a `pendente`. Gera alerta enquanto estiver `pendente` depois da data do pagamento.
- **Materiais:** o atendimento sugere a baixa da lista de materiais de cada procedimento, e o usuário ajusta as quantidades e os lotes antes de confirmar.

### 6.14 Estoque e custo médio

- **Entrada:** custo médio novo = (quantidade × custo médio atual + quantidade entrada × custo unitário da entrada) ÷ (quantidade + quantidade entrada), com 6 casas. O custo unitário da entrada é o preço do item mais o frete rateado do item dividido pela quantidade comprada.
- **Baixa:** usa o custo médio do momento e não o muda. Uma baixa maior que a quantidade disponível é recusada com `ESTOQUE_INSUFICIENTE`: a entrada precisa ser registrada antes.
- **Lote:** em produto com `controla_lote`, a baixa sugere o lote de validade mais próxima com quantidade.
- **Correção do passado:** alterar ou cancelar uma entrada ou baixa com data anterior a outras recalcula a quantidade e o custo médio do produto em ordem cronológica a partir dela, e o custo das baixas seguintes.
- **Alertas:** quantidade abaixo do estoque mínimo, e lote com quantidade que vence em até 30 dias.

### 6.15 Compra e entrega

- A compra cria o lançamento `compra_estoque` com as parcelas a pagar, pelo valor dos itens mais o frete.
- O frete é rateado entre os itens na proporção do valor de cada um (quantidade × preço), com o resto dos centavos no último item, e fica gravado no item.
- Só a entrega cria as entradas de estoque, pela quantidade entregue de cada item.

### 6.16 Recorrência

- A tarefa diária gera as parcelas previstas de cada recorrência ativa até 90 dias à frente, marcadas como `estimada`, sem repetir as já geradas.
- Mudar a recorrência muda só as previsões futuras ainda não conciliadas.

### 6.17 Patrimônio

- **Valor de um bem numa data:** a última reavaliação até ela, ou o valor de aquisição, se não houver. Bem baixado sai a partir da data da baixa.
- **Patrimônio líquido de uma entidade:** os saldos positivos das contas, os bens, os empréstimos concedidos em aberto, os reembolsos a receber e as participações societárias, menos as dívidas (o último saldo informado), os saldos devedores dos cartões, os empréstimos recebidos em aberto e os reembolsos a pagar.
- **Participação:** vale o patrimônio líquido da empresa vezes a fração. As participações não formam ciclo, e o cálculo vai das empresas que não têm participação em outras para cima.
- **Num grupo:** a soma dos membros, sem o que é interno: os empréstimos e reembolsos entre membros, e a participação de um membro numa empresa que também está no grupo, que é trocada pelos bens dela.

### 6.18 Planejamento, indicadores e alertas

- **Custo de vida:** a soma das despesas das pessoas físicas do contexto, pela data de pagamento, incluindo bens de consumo e parcelas de dívidas, sem os lançamentos neutros.
- **Taxa de poupança:** (aplicações − resgates) ÷ receitas das pessoas físicas do contexto no mês. As aplicações são os lançamentos `aplicacao` e as transferências para conta de reserva; os resgates, o contrário. Sem receita no mês, a taxa não é calculada.
- **Meta:** o acumulado é a soma dos saldos das contas e dos valores dos bens ligados a ela. Uma conta ou bem pode estar em mais de uma meta, e o acumulado não é dividido entre elas.
- **Orçamento:** compara o planejado com o realizado por categoria, entidade e mês, pela data da regra 6.8. Gera alerta quando o realizado passa do planejado.
- **Projeção de caixa:** o saldo atual das contas do contexto, mais as parcelas em aberto e os recebíveis com data até 30, 60 e 90 dias, separando as parcelas estimadas das confirmadas.
- **Alertas:** cada módulo expõe as condições dele, cada uma com uma `chave` que identifica a ocorrência (por exemplo, `parcela-vencida:<id>` ou `backup-falha:<id>`). Uma ocorrência lida não volta; uma ocorrência nova volta, mesmo que seja do mesmo registro.

### 6.19 Anonimização e retenção

- A anonimização de uma cliente troca o nome por "Cliente anonimizada" e o início do id, apaga o telefone e o CPF e grava `anonimizada_em`. Os atendimentos, os pacotes, os valores e as notas fiscais continuam ligados a ela.
- Na mesma transação, os campos pessoais dela são apagados do `antes` e do `depois` dos registros de auditoria da tabela `cliente`. É a única alteração permitida na auditoria.
- Nada é apagado por prazo no MVP: as notas fiscais e os atendimentos ficam pelo prazo legal. Os backups somem pela retenção configurada, e com eles as cópias de antes da anonimização.
- **Restauração de um backup anterior a uma anonimização:** o procedimento de restauração lista as anonimizações feitas depois da data do backup, que precisam ser refeitas antes de liberar o uso.

### 6.20 Edição e exclusão

- Qualquer mês pode ser editado, sem fechamento, e toda alteração vai para a auditoria (seção 4.4). A edição concorrente é barrada pelo bloqueio otimista (`versao`).
- Um lançamento com conciliação não é excluído: primeiro se desfaz a conciliação. Um lançamento criado por outro módulo (`origem_modulo`) só é alterado por esse módulo, como a receita de um atendimento, que muda pelo atendimento.
- Cadastros com registros ligados (conta, categoria, produto, cliente, procedimento) são desativados, e não excluídos.

### 6.21 Arredondamento

Toda divisão de dinheiro é feita em centavos, e a diferença dos centavos fica numa parcela só, para que a soma das partes seja exatamente o total: a primeira parcela num parcelamento, a última sessão num pacote, o último item no rateio do frete. Cada taxa é arredondada meio para cima, ao centavo.

### 6.22 Pesquisa

- **Rota:** `GET /v1/pesquisa?termo=<texto>`, sem o cabeçalho `Contexto-Financeiro`, porque procura em todos os contextos do usuário. O termo tem ao menos 2 caracteres e é comparado sem acento e sem diferença de maiúsculas, em qualquer posição do nome.
- **Onde procura:** nas entidades em que o usuário tem `ver` ou `operar`, nos grupos em que ele tem permissão em todos os membros (a mesma regra do contexto financeiro) e, só para quem tem `gere_acessos`, nos usuários. Uma entidade desativada aparece marcada como tal.
- **Resposta:** até 5 resultados por tipo, cada um com o tipo, o id, o nome e um complemento (o tipo da entidade, o resumo do grupo, o e-mail do usuário).
- **Cada módulo** responde pelos próprios registros, por uma função pública que o módulo Pesquisa chama. Um módulo novo entra na pesquisa no ticket que o cria.
- **Telas e ações** não passam pela API: a `web` as filtra pelo termo e pelas permissões do usuário, como "Novo usuário" só para quem tem `gere_acessos`.
- **Abrir um resultado:** uma entidade, um grupo ou um usuário abre o cadastro dele; "Trocar para", o contexto financeiro dele.

## 7. Tarefas agendadas

| Tarefa | Horário padrão | Regra |
| --- | --- | --- |
| Gerar as previsões das recorrências | 00:30 | 6.16 |
| Backup automático | `BACKUP_HORARIO` (03:00) | Seção 8 |
| Aplicar a retenção dos backups | Depois de cada backup | Seção 8 |
| Limpar sessões, links e tentativas expirados | 04:00 | 6.1 |

Os horários estão em America/Sao_Paulo. Uma tarefa que falha registra o erro no log, e a falha do backup também vira alerta.

## 8. Backup e restauração

- **Arquivo:** um `.tar` com o `pg_dump` em formato custom e a pasta de documentos, cifrado com `age` para a chave pública `BACKUP_CHAVE_PUBLICA`, com o nome `finance-<data e hora>-<tipo>.tar.age` e o SHA-256 no histórico.
- **Chave privada fora do servidor:** o servidor só tem a chave pública, então quem invade o servidor não lê os backups antigos. A chave privada só é usada na restauração e fica guardada fora da instalação.
- **Retenção:** os `BACKUP_RETENCAO_DIARIOS` mais recentes e o primeiro de cada mês dos `BACKUP_RETENCAO_MENSAIS` últimos meses. Os outros são apagados do volume e do armazenamento externo.
- **Verificação:** depois de gravar, o backup relê o arquivo e confere o SHA-256. A falha de qualquer passo grava `falha` no histórico, com o erro.
- **Restauração:** o comando `restaurar <arquivo> <chave privada>`, rodado num contêiner da `api` com a aplicação parada, confere o SHA-256, decifra, restaura o banco num banco vazio e os documentos num volume vazio, aplica as migrações pendentes e lista as anonimizações a refazer (regra 6.19). O teste de restauração do critério 5 do brief usa esse mesmo comando.

## 9. Variáveis de ambiente

| Variável | App | Para quê | Padrão |
| --- | --- | --- | --- |
| `DATABASE_URL` | api | Conexão com o banco | |
| `DATABASE_URL_TESTE` | api | Conexão com o banco dos testes de integração, só no desenvolvimento e na CI | |
| `PORTA` | api, web | Porta HTTP do contêiner | 3001 (api), 3000 (web) |
| `TZ` | api, web | Fuso do processo | `America/Sao_Paulo` |
| `LOG_NIVEL` | api, web | Nível do log | `info` |
| `TOTP_CHAVE` | api | Chave AES-256 do segredo do TOTP, em base64 | |
| `SESSAO_INATIVIDADE_DIAS` | api | Regra 6.1 | 7 |
| `SESSAO_MAXIMA_DIAS` | api | Regra 6.1 | 30 |
| `DOCUMENTOS_DIR` | api | Pasta do volume de documentos | `/dados/documentos` |
| `DOCUMENTO_TAMANHO_MAX_MB` | api | Limite de um arquivo enviado | 20 |
| `BACKUP_DIR` | api | Pasta do volume de backups | `/dados/backups` |
| `BACKUP_CHAVE_PUBLICA` | api | Destinatário `age` dos backups | |
| `BACKUP_HORARIO` | api | Horário do backup automático | `03:00` |
| `BACKUP_RETENCAO_DIARIOS` | api | Seção 8 | 30 |
| `BACKUP_RETENCAO_MENSAIS` | api | Seção 8 | 12 |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGIAO`, `BACKUP_S3_CHAVE`, `BACKUP_S3_SEGREDO` | api | Cópia externa, opcional: sem o endpoint, ela fica `nao_configurada` | |
| `API_URL` | web | Endereço da `api` na rede interna | `http://api:3001` |
| `COOKIE_SEGURO` | web | Cookie com `Secure`; desligado só no desenvolvimento | `true` |
| `DOMINIO` | proxy | Domínio público do Caddy | |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | db | Banco e papel da aplicação | |

O proxy repassa o host público em `X-Forwarded-Host` e a origem em `X-Forwarded-For`, para a conferência de origem das ações do Next e para o limite de tentativas por origem. A `web` repassa a origem à `api` no mesmo cabeçalho, e a `api` só confia nele quando vem da `web`.
