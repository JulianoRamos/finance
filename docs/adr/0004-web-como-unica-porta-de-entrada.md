# A web como única porta de entrada

O navegador fala só com a `web` (Next.js). As páginas e as ações do servidor do Next chamam a `api` (NestJS) pela rede interna, repassando o cookie de sessão, com um cliente tipado gerado da OpenAPI da `api`. A `api` não fica exposta na internet. Escolhemos assim para ter uma origem só: não há CORS, o cookie de sessão é do domínio da `web`, e a superfície pública fica menor.

## Considered Options

- **Navegador direto na API:** é mais simples de depurar e não passa pelo servidor do Next, mas expõe a `api`, exige CORS e proteção contra CSRF entre origens, e põe o token de sessão em jogo nas duas origens.

## Consequences

Upload de extrato, upload e download de documento e exportação de relatório passam por rotas da `web` que repassam o arquivo à `api`, sem guardá-lo. A `web` não tem regra de negócio nem acesso ao banco: ela é só a interface e o repasse. Uma mudança de rota na `api` muda o cliente gerado e quebra a checagem de tipos da `web` no mesmo PR.
