# Aceite do KAN-21

O ticket faz o diálogo de confirmação da estrutura do app devolver o foco a quem o abriu, como o `docs/design-system.md` (seção 4.5) já pede. Os dois critérios rodam no Playwright contra a `web` de desenvolvimento, porque o que eles provam é o foco no navegador, depois de o diálogo fechar.

O diálogo é um só, compartilhado por todas as telas, então os dois critérios provam o mesmo mecanismo por duas portas: o Esc numa tela que já existia (Entidades) e o "Cancelar" na que veio no KAN-13 (Usuários e acessos). A confirmação é aberta pelo teclado, com o botão focado e o Enter, que é o caminho de quem depende da volta do foco.

## KAN-21-CA1

**Marca:** teste no Playwright

**Cenário:** Dado um usuário no detalhe de uma empresa dele, com o botão "Desativar entidade" focado, quando ele abre a confirmação com o Enter e a fecha com o Esc, então a confirmação some e o foco está no botão "Desativar entidade".

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/confirm-dialog.spec.ts`, "fechar a confirmação com o Esc devolve o foco ao botão que a abriu".

## KAN-21-CA2

**Marca:** teste no Playwright

**Cenário:** Dado quem gere acessos no detalhe de outro usuário, com o botão "Desativar usuário" focado, quando ele abre a confirmação com o Enter e escolhe "Cancelar", então a confirmação some, o usuário continua ativo e o foco está no botão "Desativar usuário".

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/confirm-dialog.spec.ts`, "cancelar a confirmação devolve o foco ao botão que a abriu".
