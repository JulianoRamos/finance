# Low-level design

Este documento detalha a implementação do finance: a estrutura de pastas, as bibliotecas, o esquema do banco, o formato dos contratos de API, as regras de negócio, as tarefas agendadas e as variáveis de ambiente. Ele segue as decisões do `hld.md` e usa o vocabulário do `GLOSSARY.md`. Como o código é escrito (camadas, imports, nomes de arquivo, tratamento de erro, comandos) fica no `AGENTS.md` de cada app.

O esquema da seção 4 é o modelo de cada módulo: as tabelas, as colunas que carregam regra e as restrições. As colunas completas, os tipos exatos e os índices de cada tabela são escritos no schema do Prisma pelo plano do ticket que cria a tabela, no formato da seção 5.

## 1. Estrutura do monorepo

```
apps/
  api/                    NestJS: os módulos de domínio
    src/
      modules/<module>/   um módulo do HLD por pasta (nome da seção 3), com a interface pública num index.ts
      common/             dinheiro, datas, transação, contexto financeiro, erros
      cli/                os comandos de operação (restauração, primeiro usuário, link de recuperação)
      generated/          o cliente gerado do Prisma, fora do Git
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

- Cada módulo é uma pasta em `apps/api/src/modules/`, com o nome da coluna "Pasta", e expõe só o `index.ts` dela: o módulo do Nest e os serviços públicos. Outro módulo importa só esse arquivo, e o lint reprova o import de qualquer outro caminho do módulo.
- Cada tabela é de um módulo só, declarada no arquivo do schema dele. Uma consulta do módulo A não lê nem grava tabela do módulo B, nem por `join`. Os módulos só leitores (Indicadores, Relatórios, Alertas) leem pelas consultas que os donos expõem.
- As dependências permitidas, de quem chama para quem é chamado:

| Módulo | Pasta | Pode chamar |
| --- | --- | --- |
| Identidade | `identity` | Entidades, Auditoria |
| Entidades | `entities` | Auditoria |
| Auditoria | `audit` | |
| Pesquisa | `search` | Todos, só pela função de pesquisa de cada um (regra 6.22) |
| Contas | `accounts` | Entidades, Auditoria |
| Lançamentos | `entries` | Contas, Entidades, Auditoria |
| Importação | `imports` | Contas, Conciliação, Documentos, Entidades, Auditoria |
| Conciliação | `reconciliation` | Contas, Lançamentos, Recebimentos, Auditoria |
| Repasses | `entity-transfers` | Lançamentos, Entidades, Auditoria |
| Recebimentos | `receivables` | Lançamentos, Contas, Auditoria |
| Estoque | `inventory` | Entidades, Auditoria |
| Compras | `purchases` | Estoque, Lançamentos, Auditoria |
| Clínica | `clinic` | Lançamentos, Recebimentos, Estoque, Entidades, Auditoria |
| Patrimônio | `net-worth` | Lançamentos, Contas, Entidades, Auditoria |
| Planejamento | `planning` | Lançamentos, Contas, Patrimônio, Entidades, Auditoria |
| Documentos | `documents` | Entidades, Auditoria |
| Indicadores, Relatórios, Alertas | `indicators`, `reports`, `alerts` | Todos, só pelas consultas |
| Backup | `backup` | Auditoria |

A pasta usa o termo do módulo em inglês, em `kebab-case`. A rota de saúde fica no módulo `health`, que não é de domínio e não chama nenhum outro.

- **Transação:** a transação do Prisma corre pelo contexto da requisição (`AsyncLocalStorage`), e o serviço público de cada módulo a usa quando ela existe. O comando que atravessa módulos abre a transação uma vez, no serviço do módulo que recebeu a requisição.
- **Contexto da requisição:** fica no `common`, e traz o identificador da requisição (seção 5), o usuário (nulo até a autenticação o definir, e num comando no servidor) e a transação aberta. Um comando no servidor roda num contexto próprio, com um identificador gerado para a execução.

## 4. Esquema do banco

### 4.1 Convenções

- **Nomes:** em inglês, com o termo de cada conceito do domínio dado no `GLOSSARY.md` ("Em código"). Tabelas, colunas e valores de enumeração em `snake_case` no banco (`@@map` e `@map`), e `camelCase` no Prisma e no TypeScript (`PascalCase` no modelo). A tabela vai no singular: `entry`, `movement`. As chaves estrangeiras terminam em `_id`, os instantes em `_at` e os hashes em `_hash`; os booleanos são adjetivos (`active`) ou levam `is_` quando o nome sozinho seria ambíguo (`is_reserve`). Só o texto que uma pessoa lê fica em português.
- **Chave primária:** `id uuid`, com `uuidv7()`. A exceção é o registro de auditoria, com `bigint` sequencial.
- **Colunas comuns** de toda tabela de domínio: `created_at` e `updated_at` (`timestamptz`), e `version` (`integer`) nas que o usuário edita, para o bloqueio otimista (seção 6.20).
- **Dinheiro:** `numeric(15,2)`, sempre positivo, com o sentido dado pelo tipo do registro. **Custo unitário e custo médio:** `numeric(18,6)`. **Quantidade de estoque:** `numeric(15,4)`. **Fração de participação:** `numeric(9,8)`. **Taxa percentual:** `numeric(7,4)`.
- **Datas de calendário** (data do fato, vencimento, data da movimentação) em `date`; instantes em `timestamptz`.
- **Enumerações** como `enum` do PostgreSQL, declaradas no Prisma.
- **Exclusão:** a chave estrangeira é `RESTRICT` por padrão. `CASCADE` só em tabela filha que não existe sem a mãe e não é registro financeiro, como os itens de uma lista de materiais.
- **Restrições que o Prisma não expressa** (`CHECK`, índice único parcial, permissão do papel do banco) são escritas à mão na migração e anotadas no schema, como a seção 5 pede.

### 4.2 Identidade

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `user` | `name`, `email`, `password_hash`, `totp_secret_encrypted`, `totp_enabled`, `manages_access`, `active` | `email` único, comparado em minúsculas |
| `session` | `user_id`, `token_hash`, `last_used_at`, `expires_at`, `ended_at`, `user_agent`, `origin` | `token_hash` único |
| `recovery_code` | `user_id`, `code_hash`, `used_at` | |
| `recovery_link` | `user_id`, `token_hash`, `created_by_id`, `expires_at`, `used_at` | `token_hash` único. `created_by_id` nulo quando veio do comando no servidor |
| `login_attempt` | `email`, `origin`, `step` (`password`, `second_factor`, `recovery`), `succeeded`, `attempted_at` | Índice por `email` e `attempted_at` |
| `permission` | `user_id`, `entity_id`, `level` (`view`, `operate`) | Chave `(user_id, entity_id)` |

O `recovery_code` é o código de recuperação do segundo fator; o `recovery_link`, o link de recuperação do acesso. `user` é palavra reservada do PostgreSQL: o Prisma a escreve entre aspas, e o SQL escrito à mão na migração também precisa delas. O segredo do TOTP é cifrado com AES-256-GCM e a chave `TOTP_KEY`, porque precisa ser lido de volta. Senhas, tokens de sessão, links e códigos de recuperação são só hash: argon2id para a senha e os códigos de recuperação, SHA-256 para os tokens aleatórios de 256 bits.

### 4.3 Entidades

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `entity` | `type` (`individual`, `company`), `name`, `tax_id` (CPF ou CNPJ), `active` | `tax_id` único quando preenchido. O `type` não muda depois da criação (regra 6.2) |
| `entity_operation` | `entity_id`, `operation` (`clinic`) | Chave `(entity_id, operation)`. Só pessoa jurídica (regra 6.2) |
| `financial_group` | `name`, `is_family_view` | Índice único parcial: só um grupo com `is_family_view` |
| `financial_group_member` | `financial_group_id`, `entity_id` | Chave `(financial_group_id, entity_id)`. Só pessoa física na Visão Familiar (regra 6.2) |
| `equity_stake` | `holder_id` (pessoa física ou empresa), `company_id` (pessoa jurídica), `fraction`, `start_date`, `end_date` | `0 < fraction <= 1`. A soma vigente por empresa não passa de 1, e não há ciclo (regra 6.17) |

### 4.4 Auditoria

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `audit_log` | `id bigint`, `user_id`, `occurred_at`, `action` (`create`, `update`, `delete`), `table_name`, `record_id`, `entity_id`, `before jsonb`, `after jsonb`, `request_id` | O papel do banco da aplicação não tem `UPDATE`, `DELETE` nem `TRUNCATE` nesta tabela, salvo a anonimização (regra 6.19), que roda por uma função com permissão própria. Sem chaves estrangeiras: o registro auditado e o usuário podem deixar de existir, e a auditoria fica |

- **Na mesma transação:** o serviço público da Auditoria grava o registro só dentro da transação do comando (seção 3, "Transação"), e recusa a chamada feita fora dela. O módulo que altera um registro chama a Auditoria com a operação, a tabela, o registro, a entidade e os valores de antes e de depois; o usuário e o identificador da requisição vêm do contexto da requisição. O `occurred_at` tem o padrão `transaction_timestamp()`, do banco, e não o `now()` do Prisma, que o cliente calcula fora da transação.
- **O antes e o depois** são os campos do registro com os nomes do modelo (`camelCase`), com os valores convertidos para JSON: dinheiro e quantidades como string decimal, instantes em ISO 8601 e datas de calendário como `"AAAA-MM-DD"`. O nome do campo separa o instante da data de calendário, que o Prisma lê com o mesmo tipo: o instante termina em `At` (`_at`, no nome da coluna, num registro lido em SQL), pela convenção da seção 4.1. O `before` é nulo no `create`, e o `after`, no `delete`.
- **Campos sensíveis:** um campo cujo nome contém `password`, `secret` ou `token`, ou termina em `Hash`, sem distinguir maiúsculas, não entra no `before` nem no `after`, nem com o valor escondido: ele é retirado. Assim a senha, o segredo do TOTP, os tokens e os códigos de recuperação nunca chegam à auditoria, e um campo sensível novo, nomeado pela convenção da seção 4.1, fica de fora sem lista para manter.
- **Papéis do banco:** as migrações rodam com o papel dono das tabelas (`POSTGRES_USER`), e a `api` se conecta com o papel `finance_app`, que não é dono de nada. Ele recebe o uso do esquema e, por privilégio padrão do esquema, `SELECT`, `INSERT`, `UPDATE` e `DELETE` em toda tabela nova e o uso das sequências, na primeira migração; a migração da auditoria retira dele o que a tabela acima nega. O papel é criado na inicialização do banco, com a senha de `POSTGRES_APP_PASSWORD`.

### 4.5 Contas

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `account` | `entity_id`, `name`, `type` (`checking`, `payment`, `cash`, `credit_card`), `institution` (`nubank`, `caixa`, `mercado_pago`, `bradesco`, `itau`, `banco_do_brasil`, `other`), `is_reserve`, `opening_balance`, `opening_balance_date`, `active`. No cartão: `closing_day`, `due_day`, `paying_account_id` | `CHECK` dos dias só no cartão. `CHECK (type <> 'credit_card' OR NOT is_reserve)` |
| `card_statement` | `account_id`, `reference_month` (o primeiro dia do mês), `closing_date`, `due_date`, `previous_balance` | Única por `(account_id, reference_month)` |
| `movement` | `account_id`, `date`, `amount`, `direction` (`inflow`, `outflow`), `description`, `source` (`imported`, `manual`, `adjustment`), `imported_file_id`, `external_id`, `dedup_key`, `card_statement_id`, `adjustment_reason` | Única `(account_id, dedup_key)` quando `source = 'imported'`. `CHECK` de `adjustment_reason` obrigatório no ajuste |

Os valores de `institution` são os nomes dos bancos, e por isso não são traduzidos.

### 4.6 Lançamentos

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `category` | `tree` (`individual`, `company`), `entity_id`, `parent_id`, `name`, `nature` (`revenue`, `expense`), `active` | `CHECK ((tree = 'individual') = (entity_id IS NULL))`: a árvore das pessoas físicas é uma só, e cada empresa tem a dela |
| `entry` | `entity_id`, `type` (`revenue`, `expense`, `transfer`, `investment`, `redemption`, `entity_transfer`, `refund`, `stock_purchase`), `effect` (`revenue`, `revenue_deduction`, `expense`, `neutral`), `description`, `category_id`, `purpose` (`personal`, `household`), `occurred_on`, `total_amount`, `payer_id`, `recurrence_id`, `source_module`, `source_id`, `canceled_at` | `purpose` só em despesa de pessoa física. `source_module` diz o módulo dono, que é o único que altera o lançamento |
| `installment` | `entry_id`, `number`, `amount`, `due_date`, `account_id`, `direction`, `card_statement_id`, `canceled_at`, `is_estimated` | Única `(entry_id, number, direction)` |
| `recurrence` | `entity_id`, o modelo do lançamento (descrição, categoria, finalidade, conta, `estimated_amount`), `frequency` (`weekly`, `monthly`, `yearly`), `day`, `start_date`, `end_date`, `active` | |

A transferência, a aplicação e o resgate são lançamentos com duas parcelas, uma de saída e uma de entrada, cada uma na sua conta. O repasse cria um lançamento em cada entidade (regra 6.9).

### 4.7 Importação

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `imported_file` | `account_id`, `file_name`, `sha256_hash`, `format` (`ofx`, `csv`, `xlsx`), `parser`, `period_start`, `period_end`, `document_id`, `status` (`preview`, `confirmed`, `discarded`), `imported_by_id` | Único `(account_id, sha256_hash)` quando confirmado |

As linhas da prévia não são gravadas: a prévia é recalculada do arquivo guardado até a confirmação.

### 4.8 Conciliação

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `reconciliation` | `movement_id`, `installment_id`, `receivable_id`, `amount`, `is_automatic`, `created_by_id` | `CHECK` de exatamente um entre `installment_id` e `receivable_id`. A soma por movimentação não passa do valor dela (regra 6.5) |

### 4.9 Repasses

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `entity_transfer` | `from_entity_id`, `to_entity_id`, `type` (`pro_labore`, `profit_distribution`, `capital_contribution`, `reimbursement`, `loan`, `family_transfer`, `unclassified`), `amount`, `date`, `from_entry_id`, `to_entry_id`, `loan_id`, `loan_role` (`disbursement`, `repayment`) | `CHECK (from_entity_id <> to_entity_id)`. `loan_id` só no tipo `loan` |
| `pending_reimbursement` | `debtor_id`, `creditor_id`, `entry_id` (a despesa paga pela outra), `amount`, `capital_contribution_id` (o repasse de aporte em que foi convertido) | |
| `reimbursement_settlement` | `pending_reimbursement_id`, `entity_transfer_id`, `amount` | |
| `loan` | `creditor_id`, `debtor_id`, `amount`, `date` | |

O saldo em aberto do reembolso e do empréstimo é calculado: o valor menos as quitações ou as devoluções.

### 4.10 Recebimentos

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `payment_method` | `entity_id`, `name`, `type` (`pix`, `cash`, `debit`, `credit`), `acquirer`, `destination_account_id`, `active` | |
| `payment_method_term` | `payment_method_id`, `installments`, `fee_rate`, `settlement_days` | Única `(payment_method_id, installments)` |
| `receivable` | `entity_id`, `installment_id` (a da receita), `payment_method_id`, `number`, `gross_amount`, `fee`, `net_amount`, `expected_date`, `early_settlement_id`, `refunded_at` | `CHECK (net_amount = gross_amount - fee)` |
| `early_settlement` | `entity_id`, `date`, `fee`, `fee_entry_id` | |

### 4.11 Clínica

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `customer` | `entity_id`, `name`, `phone`, `cpf`, `anonymized_at` | `cpf` único por entidade quando preenchido |
| `procedure` | `entity_id`, `name`, `price`, `active` | |
| `procedure_material` | `procedure_id`, `product_id`, `quantity` | `CASCADE` com o procedimento |
| `session_package` | `entity_id`, `customer_id`, `procedure_id`, `session_count`, `amount`, `revenue_entry_id`, `invoice_status`, `canceled_at`, `refund_entry_id` | `session_count > 0` |
| `appointment` | `entity_id`, `customer_id`, `date`, `session_package_id`, `amount`, `session_revenue`, `revenue_entry_id`, `invoice_status`, `canceled_at` | Avulso: `amount` e `invoice_status` preenchidos e `session_package_id` nulo. Sessão: o contrário, com `session_revenue` |
| `appointment_procedure` | `appointment_id`, `procedure_id`, `amount` | |
| `invoice` | `entity_id`, `appointment_id`, `session_package_id`, `number`, `date`, `amount`, `document_id` | Exatamente um entre `appointment_id` e `session_package_id`, e no máximo uma nota não cancelada por registro |

O `invoice_status` vale `pending`, `issued`, `canceled` ou `not_applicable` (regra 6.13). A clínica só aceita escrita em entidade com a operação `clinic` ligada; o serviço confere isso antes de qualquer comando.

### 4.12 Estoque

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `product` | `entity_id`, `name`, `unit`, `minimum_stock`, `tracks_lots`, `quantity`, `average_cost` | `quantity >= 0` |
| `lot` | `product_id`, `code`, `expiration_date`, `quantity` | Único `(product_id, code)`. `quantity >= 0` |
| `stock_receipt` | `product_id`, `lot_id`, `date`, `quantity`, `unit_cost`, `delivery_item_id` | |
| `stock_issue` | `product_id`, `lot_id`, `date`, `quantity`, `unit_cost`, `reason` (`consumption`, `loss`, `adjustment`), `appointment_id` | `unit_cost` é o custo médio no momento da baixa |

O `stock_receipt` é a entrada de estoque, e o `stock_issue`, a baixa. `quantity` e `average_cost` do produto são guardados, e não calculados na consulta, porque o custo médio depende da ordem das entradas e baixas (regra 6.14).

### 4.13 Compras

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `supplier` | `entity_id`, `name`, `tax_id`, `contact` | |
| `purchase` | `entity_id`, `supplier_id`, `date`, `freight`, `entry_id` | |
| `purchase_item` | `purchase_id`, `product_id`, `quantity`, `unit_price`, `allocated_freight` | |
| `delivery` | `purchase_id`, `date` | |
| `delivery_item` | `delivery_id`, `purchase_item_id`, `quantity`, `lot_code`, `expiration_date` | A soma entregue por item não passa do comprado |

### 4.14 Patrimônio

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `asset` | `entity_id`, `name`, `type` (`real_estate`, `vehicle`, `investment`, `equipment`, `other`), `asset_class` (`investment`, `consumption`), `acquisition_date`, `acquisition_amount`, `disposed_at` | |
| `revaluation` | `asset_id`, `date`, `amount` | Única `(asset_id, date)` |
| `debt` | `entity_id`, `creditor`, `description`, `original_amount`, `date` | |
| `debt_balance` | `debt_id`, `date`, `balance` | Única `(debt_id, date)` |

### 4.15 Planejamento

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `goal` | `entity_id` ou `financial_group_id`, `name`, `target_amount`, `target_date` | Exatamente um dos dois donos |
| `goal_link` | `goal_id`, `account_id` ou `asset_id` | Exatamente um dos dois |
| `planned_contribution` | `goal_id`, `amount`, `frequency`, `start_date` | |
| `budget` | `entity_id`, `reference_month`, `category_id`, `amount` | Único `(entity_id, reference_month, category_id)` |

### 4.16 Alertas, Documentos e Backup

| Tabela | Colunas que carregam regra | Restrições |
| --- | --- | --- |
| `alert_read` | `user_id`, `key`, `read_at` | Chave `(user_id, key)`. A `key` identifica a ocorrência (regra 6.18) |
| `document` | `entity_id`, `original_name`, `mime_type`, `size`, `sha256_hash`, `path`, `uploaded_by_id` | `path` é relativo ao volume de documentos e nunca vem do usuário |
| `document_link` | `document_id`, `record_type`, `record_id` | |
| `backup` | `type` (`automatic`, `manual`), `started_at`, `finished_at`, `status` (`in_progress`, `success`, `failure`), `file_name`, `size`, `sha256_hash`, `external_copy` (`not_configured`, `success`, `failure`), `error` | |

## 5. Contratos

**Arquivos do contrato:** o `apps/api/openapi.json`, para as rotas, e o `apps/api/prisma/schema/`, para as tabelas. Eles entram em "Valores da skill de plano", no `AGENTS.md` da raiz, no ticket que cria a `api`, junto com o comando do contrato.

**Rota.** Cada rota traz, no `openapi.json` gerado pelos decorators, os itens do formato de rota da skill de plano:

- **Prefixo:** `/v1`.
- **Nomes:** caminhos, parâmetros, cabeçalhos, campos JSON, códigos de erro e valores de enumeração em inglês, como a seção 4.1. Os caminhos de um recurso usam o plural do termo em `kebab-case` (`/v1/entity-transfers`), e os campos JSON, `camelCase`. Só a `message` do erro é texto para o usuário, em português.
- **Autenticação:** esquema `session`, um `Authorization: Bearer <token>` que a `web` monta com o cookie. As rotas públicas (login, uso de link de recuperação, saúde) são marcadas como tal.
- **Contexto financeiro:** o cabeçalho `Financial-Context`, com `entity:<id>` ou `group:<id>`, obrigatório nas rotas de dados.
- **Identificador da requisição:** o cabeçalho `X-Request-Id`, um UUID, opcional em toda rota. A `web` gera um a cada requisição do navegador e o manda em toda chamada à `api` feita nela. A `api` usa o recebido quando ele é um UUID e gera outro quando falta ou não é; o identificador vai para o registro de auditoria (seção 4.4). Como vale para todas as rotas, ele fica nesta convenção, e não em cada rota do `openapi.json`.
- **Dinheiro e quantidades** trafegam como string decimal (`"1234.56"`), e nunca como número JSON. **Datas de calendário** como `"AAAA-MM-DD"`, e instantes em ISO 8601 com fuso.
- **Edição:** o corpo traz a `version` lida, e a rota devolve `409 VERSION_CONFLICT` quando ela mudou.
- **Listas:** paginadas por `cursor` e `limit` (padrão 50, máximo 200).
- **Erro:** o corpo é `{ "code": "<STABLE_CODE>", "message": "<texto para o usuário>", "fields": { "<field>": "<reason>" } }`, com `fields` só na entrada inválida. O `code` é estável, em inglês e em `UPPER_SNAKE_CASE`, e é o que o cliente confere; a `message` pode mudar. Os códigos comuns:

| Status | Código | Quando |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | O corpo, o caminho ou a consulta não passam na validação |
| 401 | `UNAUTHENTICATED` | Sem sessão válida |
| 403 | `FORBIDDEN` | O usuário não tem o nível pedido numa entidade do contexto |
| 404 | `NOT_FOUND` | O registro não existe ou está fora do contexto |
| 409 | `VERSION_CONFLICT` | A `version` enviada não é a atual |
| 422 | Código da regra | Uma regra de negócio recusou o comando, com um código próprio, como `INSUFFICIENT_STOCK` |
| 429 | `TOO_MANY_ATTEMPTS` | Tentativas demais (regra 6.1) |

**Exceção:** a rota de saúde (`GET /v1/health`) não usa o corpo de erro. Ela responde 200 ou 503 com o mesmo corpo de estado, `{ "database": "connected" }` ou `{ "database": "down" }`, porque quem a lê (o healthcheck e a `web`) quer o estado, e não um erro.

**Tabela.** Cada tabela traz, no schema do Prisma, os itens do formato de tabela da skill de plano, com um comentário `///` em cada coluna e, na tabela, a nota de toda restrição escrita à mão na migração.

## 6. Regras de negócio

### 6.1 Acesso

- **Sessão:** expira depois de 7 dias sem uso e, de qualquer forma, 30 dias depois da criação. O `last_used_at` é atualizado no máximo uma vez por minuto. A troca de senha encerra as outras sessões do usuário.
- **Limite de tentativas:** 5 falhas por e-mail em 15 minutos bloqueiam aquela etapa por 15 minutos; 20 falhas por origem em 15 minutos bloqueiam a origem. A resposta do bloqueio não diz se o e-mail existe.
- **Link de recuperação:** vale 1 hora e uma vez só. É gerado por um usuário com `manages_access` ou pelo comando `recover-access <email>` no servidor. Usá-lo define a nova senha e encerra todas as sessões.
- **Senha:** pelo menos 12 caracteres, sem outra regra de composição. A definição e a troca pedem a senha duas vezes.
- **Primeiro usuário:** o comando `create-user <nome> <email>` no servidor cria um usuário com `manages_access` e devolve um link de recuperação, com a mesma validade, para ele definir a senha. Os outros usuários são cadastrados pela interface, por quem tem `manages_access`, e recebem o link da mesma forma.
- **Segundo fator:** a ativação confirma um código antes de valer e gera 10 códigos de recuperação, mostrados uma vez. Desativar pede a senha e um código.
- **Permissão:** `view` lê, `operate` lê e escreve. Gerir usuários e permissões exige `manages_access`. No uso inicial, os dois usuários têm `operate` em todas as entidades e `manages_access`.
- **Troca de e-mail:** o e-mail é o login e é trocado por quem tem `manages_access`. A troca encerra as sessões do usuário.
- **Usuário desativado:** não entra, e as sessões dele são encerradas na hora. O histórico e as permissões ficam guardados, e ele pode ser reativado.

### 6.2 Entidades e grupos

- A Visão Familiar já vem criada na primeira subida e só aceita pessoa física. As outras pessoas físicas cadastradas não entram nela sozinhas.
- A Visão Familiar não é renomeada nem excluída.
- O tipo de uma entidade (pessoa física ou jurídica) não muda depois da criação.
- Uma entidade com registros não é excluída: é desativada, e some das escolhas sem sumir dos números do passado.
- **Exclusão de grupo:** um grupo sem metas é excluído, e quem estava nesse contexto volta para a Visão Familiar. Um grupo com metas é recusado, com `422 GROUP_HAS_GOALS`, até as metas serem excluídas ou passadas para outro dono.
- **Operações:** só se ligam em pessoa jurídica, e uma empresa pode ter várias ligadas. Na API, a entidade traz a lista das ligadas (`"operations": ["clinic"]`). Desligar uma operação esconde as funções dela e recusa novas escritas, e não apaga nada: ao religar, tudo volta como estava. Os lançamentos que a operação criou continuam nos números, mas só mudam com ela ligada (regra 6.20).
- **Participação societária:** é encerrada informando o último dia (`end_date`). Depois dele, a fração deixa de contar como vigente, e o registro continua no histórico.

### 6.3 Saldo e ajuste

- O saldo de uma conta numa data é o saldo inicial mais as entradas menos as saídas das movimentações entre a data do saldo inicial e essa data, inclusive.
- Quando o saldo calculado difere do banco, o usuário registra um ajuste: uma movimentação de origem `adjustment`, com o valor da diferença e um motivo obrigatório. O ajuste não é receita nem despesa e não entra em nenhum indicador de resultado; ele aparece num relatório próprio de ajustes, para que um ajuste grande seja investigado.

### 6.4 Importação e duplicidade

- O leitor é escolhido pela `institution` da conta e pelo formato do arquivo. Um arquivo que nenhum leitor reconhece falha antes da prévia, com a mensagem de qual banco e formato eram esperados, e nada é gravado.
- **Arquivo repetido:** um arquivo com o mesmo SHA-256 já confirmado na mesma conta é recusado inteiro.
- **Linha repetida:** a `dedup_key` de cada linha é o identificador do banco (o `FITID` do OFX), quando existe. Sem ele, é o hash da conta, da data, do valor, do sentido, da descrição normalizada (sem espaços repetidos, em minúsculas) e do número de ordem da linha entre as idênticas do mesmo arquivo. Uma linha com chave já gravada fica de fora, e a prévia a mostra como duplicada. O número de ordem preserva duas compras iguais no mesmo dia.
- **Movimentação manual:** uma linha importada com a mesma conta, o mesmo valor e sentido e data até 3 dias antes ou depois de uma movimentação manual ainda não substituída, e só essa, substitui a manual: a manual some, e as conciliações dela passam para a importada.
- A confirmação grava tudo numa transação; o arquivo original fica guardado como documento da conta.

### 6.5 Conciliação

- **Automática:** a movimentação é conciliada sozinha com uma parcela quando as duas são da mesma conta, o valor em aberto da parcela é igual ao da movimentação, com o mesmo sentido, a data fica até 3 dias antes ou depois do vencimento, e essa parcela é o único candidato. Com dois candidatos ou mais, como duas previsões iguais em datas próximas, nada é conciliado sozinho: a movimentação vai para a revisão com os candidatos como sugestões.
- **Sugestões na revisão:** as parcelas em aberto da mesma conta e sentido com vencimento até 10 dias de distância, primeiro as de valor igual e depois as de data mais próxima.
- **Parcial:** uma movimentação pode liquidar várias parcelas, e uma parcela pode ser liquidada por várias movimentações. A soma conciliada nunca passa do valor da movimentação nem do valor da parcela.
- **Valor estimado:** conciliar uma parcela estimada (de recorrência) atualiza o valor dela para o da movimentação.
- **Recebível:** a movimentação do repasse da adquirente concilia com recebíveis, pela mesma regra, com o valor líquido.

### 6.6 Situação da parcela

Calculada, salvo o cancelamento: `canceled` se `canceled_at` está preenchido; `settled` se a soma conciliada é igual ao valor; `partial` se é maior que zero e menor que o valor; `overdue` se não foi liquidada e o vencimento é anterior a hoje; e `expected` nos outros casos. A parcial vencida aparece como vencida, com o valor em aberto.

### 6.7 Cartão e fatura

- Uma compra feita até o dia de fechamento entra na fatura do ciclo que fecha naquele mês; depois dele, na seguinte. A parcela N de uma compra parcelada entra na fatura N−1 ciclos depois da primeira.
- As datas de fechamento e de vencimento de cada fatura vêm do cadastro do cartão e podem ser corrigidas fatura a fatura, porque os bancos as movem. A fatura importada confirma as linhas dela.
- **Pagamento da fatura:** é uma transferência da conta pagadora para o cartão, na data do pagamento. Pelo regime de caixa (ADR 0001), cada parcela da fatura conta como despesa na data em que a fatura é paga, e não na data da compra.
- **Pagamento parcial (exceção):** o restante vira o `previous_balance` da fatura seguinte, os juros e encargos entram como despesa financeira na fatura em que são cobrados, e todas as despesas da fatura contam no mês do primeiro pagamento.
- O cartão de uma pessoa física pagando uma despesa de empresa segue a regra 6.10.

### 6.8 Efeito dos lançamentos

O `effect` decide em qual indicador o lançamento entra, e é fixado pelo `type`:

| Tipo | Efeito |
| --- | --- |
| `revenue` | `revenue` |
| `refund` | `revenue_deduction` |
| `expense` | `expense` |
| `transfer`, `investment`, `redemption`, `stock_purchase` | `neutral` |
| `entity_transfer` | o da tabela da regra 6.9, de cada lado |

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

- Uma despesa com `payer_id` diferente da dona abre um reembolso pendente da dona para o pagador, pelo valor da despesa. A parcela fica na conta do pagador, e para o pagador o valor é neutro: é um valor a receber, e não despesa.
- O reembolso é quitado por repasses do tipo reembolso, inteiros ou em partes, ou convertido em aporte, quando a dona é empresa e o pagador tem participação nela. A conversão cria o repasse de aporte sem movimentação.
- Gera alerta enquanto houver saldo em aberto.

### 6.11 Empréstimo entre entidades

- A concessão é um repasse de empréstimo que cria o `loan`; as devoluções são repasses de empréstimo no sentido contrário, ligados a ele. O saldo em aberto é o valor menos as devoluções, e não pode ficar negativo.
- No patrimônio, o saldo em aberto é um bem de quem emprestou e uma dívida de quem recebeu, e os dois se anulam num grupo que tem as duas.

### 6.12 Pagamento na clínica

- **Pix e dinheiro:** a receita é liquidada pela movimentação da conta de destino da forma de pagamento.
- **Cartão:** no pagamento, a parcela da receita é dada como liquidada, e o sistema gera um recebível por parcela da adquirente, com o bruto, a taxa (bruto × taxa percentual da condição, arredondada ao centavo) e o líquido, na data prevista (a data do pagamento mais o prazo da condição, e mais 30 dias a cada parcela). A soma das taxas vira uma despesa financeira na data do pagamento. O dinheiro entra no fluxo de caixa quando cada recebível é conciliado.
- **Antecipação:** os recebíveis escolhidos ganham a nova data prevista, e a taxa da antecipação vira despesa financeira na data dela.
- **Estorno:** lançamento de estorno na data em que é feito, que reduz o faturamento desse mês (glossário, "Estorno"). No cartão, os recebíveis ainda não pagos são marcados como estornados.

### 6.13 Atendimento e pacote

- **Avulso:** cria a receita pelo valor, na data do pagamento, e começa com a situação fiscal `pending`, que o usuário pode mudar para `not_applicable`.
- **Pacote:** a receita é do valor inteiro, no pagamento. A receita da sessão é o valor dividido pelo número de sessões, com o resto dos centavos na última. O saldo é o número de sessões menos as sessões realizadas não canceladas; uma sessão não é registrada com o saldo zerado.
- **Cancelamento do pacote:** o usuário informa o valor do estorno, que o sistema sugere como o saldo em sessões vezes a receita da sessão, e que pode ser zero.
- **Situação fiscal:** a nota fiscal registrada leva a situação a `issued`; cancelar a nota a leva de volta a `pending`. Gera alerta enquanto estiver `pending` depois da data do pagamento.
- **Materiais:** o atendimento sugere a baixa da lista de materiais de cada procedimento, e o usuário ajusta as quantidades e os lotes antes de confirmar.

### 6.14 Estoque e custo médio

- **Entrada:** custo médio novo = (quantidade × custo médio atual + quantidade entrada × custo unitário da entrada) ÷ (quantidade + quantidade entrada), com 6 casas. O custo unitário da entrada é o preço do item mais o frete rateado do item dividido pela quantidade comprada.
- **Baixa:** usa o custo médio do momento e não o muda. Uma baixa maior que a quantidade disponível é recusada com `INSUFFICIENT_STOCK`: a entrada precisa ser registrada antes.
- **Lote:** em produto com `tracks_lots`, a baixa sugere o lote de validade mais próxima com quantidade.
- **Correção do passado:** alterar ou cancelar uma entrada ou baixa com data anterior a outras recalcula a quantidade e o custo médio do produto em ordem cronológica a partir dela, e o custo das baixas seguintes.
- **Alertas:** quantidade abaixo do estoque mínimo, e lote com quantidade que vence em até 30 dias.

### 6.15 Compra e entrega

- A compra cria o lançamento `stock_purchase` com as parcelas a pagar, pelo valor dos itens mais o frete.
- O frete é rateado entre os itens na proporção do valor de cada um (quantidade × preço), com o resto dos centavos no último item, e fica gravado no item.
- Só a entrega cria as entradas de estoque, pela quantidade entregue de cada item.

### 6.16 Recorrência

- A tarefa diária gera as parcelas previstas de cada recorrência ativa até 90 dias à frente, marcadas como `is_estimated`, sem repetir as já geradas.
- Mudar a recorrência muda só as previsões futuras ainda não conciliadas.

### 6.17 Patrimônio

- **Valor de um bem numa data:** a última reavaliação até ela, ou o valor de aquisição, se não houver. Bem baixado sai a partir da data da baixa.
- **Patrimônio líquido de uma entidade:** os saldos positivos das contas, os bens, os empréstimos concedidos em aberto, os reembolsos a receber e as participações societárias, menos as dívidas (o último saldo informado), os saldos devedores dos cartões, os empréstimos recebidos em aberto e os reembolsos a pagar.
- **Participação:** vale o patrimônio líquido da empresa vezes a fração. As participações não formam ciclo, e o cálculo vai das empresas que não têm participação em outras para cima.
- **Num grupo:** a soma dos membros, sem o que é interno: os empréstimos e reembolsos entre membros, e a participação de um membro numa empresa que também está no grupo, que é trocada pelos bens dela.

### 6.18 Planejamento, indicadores e alertas

- **Custo de vida:** a soma das despesas das pessoas físicas do contexto, pela data de pagamento, incluindo bens de consumo e parcelas de dívidas, sem os lançamentos neutros.
- **Taxa de poupança:** (aplicações − resgates) ÷ receitas das pessoas físicas do contexto no mês. As aplicações são os lançamentos `investment` e as transferências para conta de reserva; os resgates, o contrário. Sem receita no mês, a taxa não é calculada.
- **Meta:** o acumulado é a soma dos saldos das contas e dos valores dos bens ligados a ela. Uma conta ou bem pode estar em mais de uma meta, e o acumulado não é dividido entre elas.
- **Orçamento:** compara o planejado com o realizado por categoria, entidade e mês, pela data da regra 6.8. Gera alerta quando o realizado passa do planejado.
- **Projeção de caixa:** o saldo atual das contas do contexto, mais as parcelas em aberto e os recebíveis com data até 30, 60 e 90 dias, separando as parcelas estimadas das confirmadas.
- **Alertas:** cada módulo expõe as condições dele, cada uma com uma `key` que identifica a ocorrência (por exemplo, `installment-overdue:<id>` ou `backup-failed:<id>`). Uma ocorrência lida não volta; uma ocorrência nova volta, mesmo que seja do mesmo registro.

### 6.19 Anonimização e retenção

- A anonimização de uma cliente troca o nome por "Cliente anonimizada" e o início do id, apaga o telefone e o CPF e grava `anonymized_at`. Os atendimentos, os pacotes, os valores e as notas fiscais continuam ligados a ela.
- Na mesma transação, os campos pessoais dela são apagados do `before` e do `after` dos registros de auditoria da tabela `customer`. É a única alteração permitida na auditoria.
- Nada é apagado por prazo no MVP: as notas fiscais e os atendimentos ficam pelo prazo legal. Os backups somem pela retenção configurada, e com eles as cópias de antes da anonimização.
- **Restauração de um backup anterior a uma anonimização:** o procedimento de restauração lista as anonimizações feitas depois da data do backup, que precisam ser refeitas antes de liberar o uso.

### 6.20 Edição e exclusão

- Qualquer mês pode ser editado, sem fechamento, e toda alteração vai para a auditoria (seção 4.4). A edição concorrente é barrada pelo bloqueio otimista (`version`).
- Um lançamento com conciliação não é excluído: primeiro se desfaz a conciliação. Um lançamento criado por outro módulo (`source_module`) só é alterado por esse módulo, como a receita de um atendimento, que muda pelo atendimento.
- Cadastros com registros ligados (conta, categoria, produto, cliente, procedimento) são desativados, e não excluídos.

### 6.21 Arredondamento

Toda divisão de dinheiro é feita em centavos, e a diferença dos centavos fica numa parcela só, para que a soma das partes seja exatamente o total: a primeira parcela num parcelamento, a última sessão num pacote, o último item no rateio do frete. Cada taxa é arredondada meio para cima, ao centavo.

### 6.22 Pesquisa

- **Rota:** `GET /v1/search?term=<texto>`, sem o cabeçalho `Financial-Context`, porque procura em todos os contextos do usuário. O termo tem ao menos 2 caracteres e é comparado sem acento e sem diferença de maiúsculas, em qualquer posição do nome.
- **Onde procura:** nas entidades em que o usuário tem `view` ou `operate`, nos grupos em que ele tem permissão em todos os membros (a mesma regra do contexto financeiro) e, só para quem tem `manages_access`, nos usuários. Uma entidade desativada aparece marcada como tal.
- **Resposta:** até 5 resultados por tipo, cada um com o tipo, o id, o nome e um complemento (o tipo da entidade, o resumo do grupo, o e-mail do usuário).
- **Cada módulo** responde pelos próprios registros, por uma função pública que o módulo Pesquisa (`search`) chama. Um módulo novo entra na pesquisa no ticket que o cria.
- **Telas e ações** não passam pela API: a `web` as filtra pelo termo e pelas permissões do usuário, como "Novo usuário" só para quem tem `manages_access`.
- **Abrir um resultado:** uma entidade, um grupo ou um usuário abre o cadastro dele; "Trocar para", o contexto financeiro dele.

## 7. Tarefas agendadas

| Tarefa | Horário padrão | Regra |
| --- | --- | --- |
| Gerar as previsões das recorrências | 00:30 | 6.16 |
| Backup automático | `BACKUP_TIME` (03:00) | Seção 8 |
| Aplicar a retenção dos backups | Depois de cada backup | Seção 8 |
| Limpar sessões, links e tentativas expirados | 04:00 | 6.1 |

Os horários estão em America/Sao_Paulo. Uma tarefa que falha registra o erro no log, e a falha do backup também vira alerta.

## 8. Backup e restauração

- **Arquivo:** um `.tar` com o `pg_dump` em formato custom e a pasta de documentos, cifrado com `age` para a chave pública `BACKUP_PUBLIC_KEY`, com o nome `finance-<data e hora>-<type>.tar.age` (`automatic` ou `manual`) e o SHA-256 no histórico.
- **Chave privada fora do servidor:** o servidor só tem a chave pública, então quem invade o servidor não lê os backups antigos. A chave privada só é usada na restauração e fica guardada fora da instalação.
- **Retenção:** os `BACKUP_RETENTION_DAILY` mais recentes e o primeiro de cada mês dos `BACKUP_RETENTION_MONTHLY` últimos meses. Os outros são apagados do volume e do armazenamento externo.
- **Verificação:** depois de gravar, o backup relê o arquivo e confere o SHA-256. A falha de qualquer passo grava `failure` no histórico, com o erro.
- **Restauração:** o comando `restore <arquivo> <chave privada>`, rodado num contêiner da `api` com a aplicação parada, confere o SHA-256, decifra, restaura o banco num banco vazio e os documentos num volume vazio, aplica as migrações pendentes e lista as anonimizações a refazer (regra 6.19). O teste de restauração do critério 5 do brief usa esse mesmo comando.

## 9. Variáveis de ambiente

| Variável | App | Para quê | Padrão |
| --- | --- | --- | --- |
| `DATABASE_URL` | api | Conexão com o banco, com o papel `finance_app` (seção 4.4) | |
| `DATABASE_URL_TEST` | api | Conexão com o banco dos testes de integração, com o papel `finance_app`, só no desenvolvimento e na CI | |
| `DATABASE_OWNER_URL` | api | Conexão com o papel dono das tabelas, só para aplicar as migrações | |
| `DATABASE_OWNER_URL_TEST` | api | O mesmo, no banco dos testes de integração, só no desenvolvimento e na CI | |
| `PORT` | api, web | Porta HTTP do contêiner | 3001 (api), 3000 (web) |
| `TZ` | api, web | Fuso do processo | `America/Sao_Paulo` |
| `LOG_LEVEL` | api, web | Nível do log | `info` |
| `TOTP_KEY` | api | Chave AES-256 do segredo do TOTP, em base64 | |
| `SESSION_IDLE_DAYS` | api | Regra 6.1 | 7 |
| `SESSION_MAX_DAYS` | api | Regra 6.1 | 30 |
| `DOCUMENTS_DIR` | api | Pasta do volume de documentos | `/data/documents` |
| `DOCUMENT_MAX_SIZE_MB` | api | Limite de um arquivo enviado | 20 |
| `BACKUP_DIR` | api | Pasta do volume de backups | `/data/backups` |
| `BACKUP_PUBLIC_KEY` | api | Destinatário `age` dos backups | |
| `BACKUP_TIME` | api | Horário do backup automático | `03:00` |
| `BACKUP_RETENTION_DAILY` | api | Seção 8 | 30 |
| `BACKUP_RETENTION_MONTHLY` | api | Seção 8 | 12 |
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY` | api | Cópia externa, opcional: sem o endpoint, ela fica `not_configured` | |
| `API_URL` | web | Endereço da `api` na rede interna | `http://api:3001` |
| `COOKIE_SECURE` | web | Cookie com `Secure`; desligado só no desenvolvimento | `true` |
| `DOMAIN` | proxy | Domínio público do Caddy | |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | db | Banco e papel dono das tabelas, que aplica as migrações | |
| `POSTGRES_APP_PASSWORD` | db | Senha do papel `finance_app`, com que a `api` se conecta (seção 4.4) | |

O proxy repassa o host público em `X-Forwarded-Host` e a origem em `X-Forwarded-For`, para a conferência de origem das ações do Next e para o limite de tentativas por origem. A `web` repassa a origem à `api` no mesmo cabeçalho, e a `api` só confia nele quando vem da `web`.
