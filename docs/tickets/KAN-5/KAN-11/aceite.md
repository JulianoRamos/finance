# Aceite do KAN-11

Primeiro ticket do módulo Entidades: o cadastro de pessoas físicas e jurídicas, com o documento opcional, a edição com o bloqueio otimista, a desativação e a reativação, e a operação de clínica ligada e desligada numa empresa, com a tela Entidades, que entra no menu das configurações.

O CA1, o CA2, o CA3, o CA4 e o CA7 são provados pelas rotas, nos testes de integração da `api` contra o PostgreSQL real, com a app inteira montada como no KAN-9 e um usuário com sessão aberta pelo login em cada teste. O que eles provam (a entidade criada, a recusa, a lista das operações, a entidade que some das escolhas) se vê todo pelas respostas da API, sem olhar o banco. Cada teste usa nomes e documentos próprios, com CPF e CNPJ gerados com os dígitos verificadores certos, porque o documento é único no banco inteiro e os testes dividem o `finance_test`.

O CA6 é provado no mesmo nível, com a leitura da tabela de auditoria filtrada pelo id do registro, como o `audit.int.test.ts` já faz: a auditoria não tem rota até o KAN-16.

O CA5 roda no Playwright contra a `web` e a `api` de desenvolvimento, porque o que ele prova é o caminho do usuário pela tela, do botão "Nova entidade" à entidade marcada como desativada na lista. O usuário nasce pela preparação de `e2e/support/users.ts`, do KAN-9, e a entidade tem um nome próprio do teste, porque o banco de desenvolvimento guarda as entidades de outras execuções.

Até o KAN-13, que cria as permissões por entidade, as rotas de entidades pedem só a sessão: todo usuário vê e altera todas as entidades. Elas não leem o cabeçalho `Financial-Context`, porque cadastram as próprias entidades de que o contexto é feito.

## KAN-11-CA1

**Marca:** teste HTTP

**Cenário:** Dado um usuário com sessão, quando ele cadastra uma pessoa física com nome e sem documento e uma pessoa jurídica com nome e CNPJ (escrito com a pontuação), então as duas respostas são 201, com o tipo, o nome, o documento só com os caracteres (`null` na pessoa física), `active` verdadeiro, `operations` vazia e `version` 1, e as duas aparecem na lista das entidades. Quando ele cadastra uma terceira entidade com o mesmo CNPJ da segunda, sem pontuação, então a resposta é 422 `DUPLICATE_TAX_ID`, e a lista não ganha a terceira. Quando ele cadastra uma pessoa física com um CPF de dígitos verificadores errados, então a resposta é 400 `INVALID_INPUT`, com o motivo em `fields.taxId`.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "cadastra pessoas físicas e jurídicas, com o documento opcional" e "recusa um documento repetido ou inválido".

## KAN-11-CA2

**Marca:** teste HTTP

**Cenário:** Dada uma pessoa jurídica sem operações, quando o usuário liga a operação de clínica nela, então a resposta é 200 e a entidade traz `"operations": ["clinic"]`; ligar de novo responde igual, sem duplicar. Quando ele a desliga, então a resposta é 200 com `operations` vazia, e a entidade continua ativa, com o mesmo nome e o mesmo documento; ao religar, a lista volta a trazer `clinic`. Dada uma pessoa física, quando ele liga a operação de clínica nela, ou a cadastra já com a operação, então a resposta é 422 `OPERATION_REQUIRES_COMPANY`, e a entidade continua sem operações.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "liga e desliga a operação de clínica numa empresa" e "recusa a operação numa pessoa física".

## KAN-11-CA3

**Marca:** teste HTTP

**Cenário:** Dada uma pessoa jurídica com a operação de clínica ligada, o único registro ligado a uma entidade que já existe nesta fase, quando o usuário a desativa com a versão atual, então a resposta é 200, com `active` falso e a operação ainda ligada. A entidade continua sendo lida pelo id e aparece na lista completa, marcada como desativada, e não aparece na lista das escolhas (`active=true`). O contrato não tem rota de exclusão de entidade. Quando ele a reativa, então ela volta à lista das escolhas.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "a entidade desativada some das escolhas e continua cadastrada".

## KAN-11-CA4

**Marca:** teste HTTP

**Cenário:** Dada uma entidade na versão 1, quando o usuário a edita com a versão 1, então a resposta é 200, com o nome novo e a versão 2. Quando ele manda outra edição com a versão 1, então a resposta é 409 `VERSION_CONFLICT`, e a entidade continua com o nome da primeira edição e a versão 2. A desativação com a versão 1 também responde 409 `VERSION_CONFLICT`, e a entidade continua ativa.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "recusa a edição com a versão desatualizada".

## KAN-11-CA5

**Marca:** teste no Playwright

**Cenário:** Dado um usuário de teste com a sessão no cookie, quando ele abre Entidades pelo menu das configurações, escolhe "Nova entidade", marca Pessoa jurídica, informa um nome próprio do teste e um CNPJ válido, liga a operação Clínica e escolhe "Criar entidade", então o detalhe da entidade mostra o nome, "Pessoa jurídica" com o CNPJ formatado e a chave Clínica ligada, e a lista a traz com o selo PJ e "Operação: Clínica". Quando ele escolhe "Editar dados", troca o nome e escolhe "Salvar alterações", então o detalhe e a lista mostram o nome novo. Quando ele escolhe "Desativar entidade", então o detalhe mostra que ela está desativada, com o botão "Reativar entidade", e a lista a traz com o selo "Desativada".

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/entities.spec.ts`, "o usuário cadastra, edita e desativa uma entidade".

## KAN-11-CA6

**Marca:** teste de integração

**Cenário:** Dado um usuário com sessão, quando ele cadastra uma pessoa jurídica com a operação de clínica, edita o nome dela e a desativa, então a auditoria do registro da entidade traz, na ordem, um `create` com o nome e o documento no `after`, um `update` com o nome antigo no `before` e o novo no `after`, e um `update` com `active` verdadeiro no `before` e falso no `after`, todos com o id do usuário, o identificador da requisição e a própria entidade em `entityId`. A operação ligada na criação traz um `create` na tabela `entity_operation`, e desligá-la, um `delete`, com a entidade em `entityId`. Uma edição recusada por conflito de versão não grava nada na auditoria.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "a criação, a edição, a desativação e as operações ficam na auditoria".

## KAN-11-CA7

**Marca:** teste HTTP

**Cenário:** Dada uma pessoa física, quando o usuário a edita com a versão atual e o tipo de pessoa jurídica, então a resposta é 422 `ENTITY_TYPE_IMMUTABLE`, e a entidade continua pessoa física, com o nome e a versão de antes.

**Teste previsto:** integração da API no Vitest, `apps/api/test/entities.int.test.ts`, "recusa a edição que muda o tipo".
