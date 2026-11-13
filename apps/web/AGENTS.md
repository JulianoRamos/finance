# AGENTS.md da web

A `web` é o Next.js (App Router) que serve a interface e é a única porta de entrada do navegador: ela chama a `api` pela rede interna, só no servidor (ADR 0004). O que ela mostra e como está no `docs/design-system.md` e nos tickets; aqui fica como o código dela é escrito. O que vale para todo o repositório está no `AGENTS.md` da raiz.

## Comandos

Tudo roda no contêiner `web`, da raiz do repositório, com o ambiente no ar (`AGENTS.md` da raiz, "Execução no Docker"). Abreviado abaixo como `web <comando>`, que é `docker compose -f compose.dev.yaml exec web <comando>`.

| Para quê | Comando |
| --- | --- |
| Instalar as dependências | o serviço `deps` instala as do workspace inteiro a cada `docker compose -f compose.dev.yaml up -d --wait` |
| Rodar | sobe com o ambiente, em modo de desenvolvimento (`pnpm dev`), em `http://localhost:3000` (ou na porta de `WEB_PORT`) |
| Testar um arquivo | `web pnpm test:e2e e2e/home.spec.ts` |
| Testar um teste | `web pnpm test:e2e -g "estado da API"` |
| Testar tudo | `web pnpm test:e2e` |
| Lint e formatação | `web pnpm lint`; para corrigir, `web pnpm format` |
| Tipos | `web pnpm typecheck` (gera antes o cliente da api e os tipos das rotas) |
| Gerar o cliente da api | `web pnpm api:generate`, a partir de `apps/api/openapi.json` |

## Particularidades da stack

- **Cliente da api gerado.** Os tipos ficam em `src/api/schema.d.ts`, fora do Git, gerados pelo `openapi-typescript` a partir da cópia da especificação da `api`. Eles são gerados de novo antes do `dev`, do `build` e da checagem de tipos, então uma rota que muda na `api` quebra a checagem da `web` no mesmo PR. Nunca edite esse arquivo.
- **Só no servidor.** Todo arquivo de `src/api/` importa o `server-only`: o endereço da `api` e o cookie de sessão nunca vão para o navegador. O endereço vem de `API_URL`.
- **Sessão.** O token da sessão fica no cookie `session` (`httpOnly`, gravado e apagado por `src/api/session-cookie.ts`), e o cliente da api o manda em `Authorization: Bearer`, junto com o `X-Forwarded-For` e o `User-Agent` do navegador. As páginas que exigem sessão ficam no grupo de rotas `src/app/(app)/`, cujo layout pede a sessão com o `currentSession()` e monta a estrutura do app: sem uma válida (`unauthenticated`), vai para `/login`; quando a api não responde (`unavailable`), mostra a página sem a estrutura, que precisa do nome e do e-mail do usuário. O `currentSession()` é memorizado por requisição (`cache`, do React), então a página que também precisa do usuário o chama de novo sem outra ida à api. Uma busca da página que responde `unauthenticated` também vai para `/login`.
- **Estrutura do app.** Os componentes da barra lateral, da barra superior, do cabeçalho da página e do corpo ficam em `src/app/_shell/`, como os das telas de acesso ficam em `src/app/_access/`. Os menus e as dicas usam o Radix (pacote `radix-ui`), com os menus em `modal={false}`, para não esconderem o resto da página dos leitores de tela; os ícones são do `lucide-react`. A barra lateral aberta ou recolhida fica no cookie `sidebar` (`expanded` ou `collapsed`), que o layout lê no servidor, para a página não piscar ao carregar; abaixo de 1024px ela fica sempre recolhida. Um destino novo da navegação, das configurações ou do caminho da barra superior entra em `src/app/_shell/pages.ts`.
- **Ações do servidor.** O formulário chama uma ação do servidor com o `useActionState`. Um valor da página que a ação precisa, como o token do link, vai num campo oculto, e não preso à ação com `bind`, que deixava a resposta aberta no Next 16. Um controle que não é um formulário, como um botão ou uma chave, chama a ação com um objeto tipado pelo `useConfirmedCommand`, de `src/app/_shell/confirm-dialog.tsx`, que também abre a confirmação quando ela é pedida.
- **Dados de cada requisição.** Uma página que mostra o estado de agora chama `await connection()`, do `next/server`, antes de buscar, e a busca leva `cache: 'no-store'` e um prazo (`AbortSignal.timeout`).
- **Tokens.** O `src/app/globals.css` tem os tokens da seção 2 do `design-system.md` no `@theme` do Tailwind 4, e só eles: o tema começa vazio (`--*: initial`), então um valor fora dos tokens não tem classe. Nunca use valor arbitrário (`p-[13px]`, `text-[#333]`) nem `style` com cor, tamanho, espaço, raio ou sombra. Um token novo entra primeiro no `design-system.md`.
- **Tema.** Cada cor traz os dois temas no `light-dark()`, que segue o `color-scheme` da raiz: a preferência do sistema, ou o atributo `data-theme` (`light` ou `dark`) no `<html>`.
- **Versões presas.** O TypeScript fica na linha 6 e o ESLint na 9, as mesmas da `api`, porque o `typescript-eslint` e os plugins do Next ainda não aceitam as linhas seguintes. O Chromium do Playwright é baixado pelo serviço `deps`, na versão do `@playwright/test` do lockfile; a imagem só traz as bibliotecas do sistema dele.

## Camadas e imports

```
src/
  app/      as rotas do App Router: páginas, layouts e rotas de repasse
  api/      o acesso à api: o cliente gerado e as funções que o usam
  proxy.ts  o proxy do Next, que roda antes de cada requisição
e2e/      os testes de ponta a ponta
```

- **`app` e o `proxy.ts` usam `api`,** e `api` não conhece nenhum dos dois. Nenhuma página chama `fetch` para a `api` direto: ela passa por uma função de `src/api/`.
- **Sem regra de negócio:** a `web` formata e mostra o que a `api` devolve. Validação de formulário é só para a experiência; a que vale é a da `api`.
- Imports de dentro de `src/` usam o alias `@/` entre camadas e caminho relativo dentro da mesma camada.

O `eslint-plugin-boundaries` confere essas regras no lint (`eslint.config.mjs`).

## Componentes

- Componente de servidor por padrão. `'use client'` só no componente que precisa de estado ou de evento do navegador, o menor possível.
- Significado nunca só pela cor (`design-system.md`, seção 7): o texto diz o estado, e o sinal de cor é `aria-hidden`.

## Testes

- **Ponta a ponta:** `e2e/<flow>.spec.ts`, com o nome do fluxo em inglês, no Playwright do contêiner `web`, contra a `web` em `http://127.0.0.1:3000`, que chama a `api` de verdade. Localize pelos papéis e textos acessíveis (`getByRole`), e não por classe ou estrutura.
- **Dados de um teste:** o usuário de teste nasce pela preparação de `e2e/support/users.ts`, que o grava no banco de desenvolvimento com o papel da api (`E2E_DATABASE_URL`) e define a senha pela rota de uso do link. Cada teste cria o próprio usuário e usa uma origem (`X-Forwarded-For`) própria, para as falhas de login de um não bloquearem outro. Um teste que só precisa estar dentro põe a sessão no cookie com o `signIn`.
- **Hidratação nos testes:** o Playwright abre a web em `127.0.0.1`, e o modo de desenvolvimento do Next só aceita o HMR dessa origem porque o `next.config.ts` a libera (`allowedDevOrigins`); sem isso, as páginas não hidratam e nenhum componente de cliente responde. Depois da hidratação, o Next põe na página o anunciador de rota, um segundo `alert`: procure o aviso da tela com o `screenAlert`, de `e2e/support/screen.ts`, que o procura dentro do `main`.
- **Acessibilidade:** o `e2e/accessibility.spec.ts` roda o axe (`@axe-core/playwright`) em cada tela, nos dois temas, e reprova em violação séria ou crítica da WCAG 2.2 AA (`design-system.md`, seções 7 e 9). Uma tela nova entra nele no ticket que a cria.
- **Unitários:** ainda não há suíte do Vitest na `web`. Ela nasce no primeiro ticket com um teste de unidade da `web`, junto com o relatório dela no grupo `scripts/verify/web.sh`.
- **Teste de aceite:** o ID do critério vai na opção `tag` (`{ tag: '@KAN-7-CA2' }`), no formato da skill de plano.
- **O relatório** que a verificação completa confere é o `reports/playwright.json`, gravado pelo repórter JSON do `playwright.config.ts`.
