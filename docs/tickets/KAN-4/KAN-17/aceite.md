# Aceite do KAN-17

O ticket traz a escolha do tema: o botão "Tema" da barra superior abre o menu com claro, escuro e sistema, a escolha fica no cookie `theme`, e o layout raiz o lê no servidor e põe o `data-theme` no `<html>`, que o `globals.css` já usa (design-system.md, seção 2.1). Nada muda na `api`.

Os quatro critérios rodam no Playwright, contra a `web` e a `api` de desenvolvimento, porque o que eles provam é o que o navegador mostra. A preferência do sistema é simulada com o `emulateMedia({ colorScheme })`. "A página está escura" é conferido pela cor de fundo do `body`, lida no navegador: escura quando a luminância dela está abaixo da metade, e clara acima, sem comparar com o valor exato de um token. O CA3 confere o HTML que o servidor devolve, antes de qualquer script rodar: é isso que garante que a página não mostra o outro tema antes.

O CA4 não pede um teste novo: o `accessibility.spec.ts` já roda o axe em cada tela nos dois temas. As rodadas do tema escuro passam a escolher o escuro pelo cookie, como a escolha do usuário, com o sistema simulado no claro, para provar que a escolha vence a preferência do sistema; as do tema claro continuam com o sistema simulado no claro, sem cookie.

## KAN-17-CA1

**Marca:** teste no Playwright

**Cenário:** Dado um usuário sem o cookie do tema, quando ele abre o Início com o sistema no escuro, então a página está escura e o `<html>` não traz o `data-theme`; e, com o sistema no claro, a mesma página está clara.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/theme.spec.ts`, "sem escolha, a página segue a preferência do sistema".

## KAN-17-CA2

**Marca:** teste no Playwright

**Cenário:** Dado um usuário no Início, com o sistema no claro e sem escolha feita, quando ele abre o menu do botão "Tema", então as opções Claro, Escuro e Sistema aparecem, com Sistema marcada. Quando ele escolhe Escuro, então a página fica escura sem recarregar e Escuro fica marcada; quando escolhe Claro, a página fica clara; e quando escolhe Sistema com o sistema simulado no escuro, a página volta a seguir o sistema e fica escura.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/theme.spec.ts`, "o usuário escolhe o tema pelo botão da barra superior, e a página muda na hora".

## KAN-17-CA3

**Marca:** teste no Playwright

**Cenário:** Dado um usuário que escolheu Escuro pelo botão, com o sistema no claro, quando ele recarrega a página, então o cookie `theme` vale `dark`, o HTML que o servidor devolve já traz `data-theme="dark"` no `<html>` e a página está escura. O mesmo vale para a tela de entrar, fora da estrutura do app, aberta com o mesmo cookie depois de sair.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/theme.spec.ts`, "a escolha fica no cookie e a página já chega no tema escolhido".

## KAN-17-CA4

**Marca:** teste no Playwright

**Cenário:** Dada cada tela que o `accessibility.spec.ts` já confere, quando ela é aberta com o tema escuro escolhido no cookie e o sistema no claro, então o axe não acha nenhuma violação séria nem crítica das regras da WCAG 2.2 AA.

**Teste previsto:** ponta a ponta no Playwright, `apps/web/e2e/accessibility.spec.ts`, as rodadas "<tela> não tem violação séria de acessibilidade no tema escuro", com a tag do critério.
