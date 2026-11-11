# Autenticação própria na API

A autenticação (senha, sessões, segundo fator e recuperação de acesso) é implementada na própria `api`, sem biblioteca de autenticação pronta e sem provedor de identidade. Ela usa só primitivas consolidadas: o hash argon2id e a geração e conferência de códigos TOTP. Preferimos controlar o fluxo inteiro, que é pequeno para dois usuários e uma instalação, a depender do modelo de dados e da evolução de uma biblioteca de terceiros. Um provedor externo fere a independência de provedor do documento de contexto, e um servidor de identidade num contêiner a mais pesa demais para o tamanho do sistema.

## Considered Options

- **Biblioteca de autenticação na API**, como a Better Auth: traz recuperação, sessões e TOTP já testados, mas impõe as tabelas e o fluxo dela.
- **Provedor de identidade**, como o Keycloak num contêiner ou um serviço externo: é robusto, mas é mais um serviço para operar, ou uma dependência fora da instalação.

## Consequences

O código de autenticação é código de segurança mantido aqui. Ele não inventa criptografia: usa primitivas de bibliotecas consolidadas, guarda só o hash de tokens e senhas, limita tentativas, e cada regra tem teste de integração. Os tempos, os limites e o esquema ficam no LLD.
