# Finance

Aplicação web de gestão financeira familiar e empresarial. Ela centraliza as finanças de quantas pessoas físicas e jurídicas forem necessárias (inicialmente, o titular, a esposa e uma clínica de biomedicina estética), mantém os recursos de cada entidade separados e oferece uma visão consolidada da família. Também apoia a gestão da clínica: atendimentos, procedimentos, estoque, compras, fornecedores e resultados.

O produto é construído com agentes de código, num processo que vai da ideia à especificação, da especificação aos tickets e dos tickets ao pull request. Os documentos, as regras para os agentes, as skills e o harness que confere cada entrega estão todos neste repositório.

## Estado atual

Em planejamento. O ponto de partida é o [documento de contexto](./docs/documento-de-contexto.md). As próximas etapas são o modelo de domínio e o PRD. O código ainda não começou.

A stack prevista no documento de contexto é Next.js, NestJS, Prisma e PostgreSQL, em TypeScript, num monólito modular organizado em monorepo.

## O que tem no repositório

| Caminho | O que é |
|---|---|
| [`docs/`](./docs) | Os documentos que definem o produto: contexto e, conforme o planejamento avança, brief, arquitetura de alto e de baixo nível e design system. |
| [`docs/sessoes/`](./docs/sessoes/README.md) | As conversas com o agente de código, na íntegra. |
| [`AGENTS.md`](./AGENTS.md) | As regras que os agentes seguem em todo o projeto. |
| [`REVIEW.md`](./REVIEW.md) | O que toda revisão confere além dos defeitos de código. |
| [`.claude/skills`](./.claude/skills) | As skills usadas para modelar o domínio, especificar, quebrar em tickets, planejar, implementar e revisar. |
| [`scripts/`](./scripts) | O harness: a verificação (`verify.sh`), o conferidor do aceite e a guarda do harness. |
| [`.github/`](./.github) | A CI, que roda a verificação completa em todo pull request, e a proteção da `main`. |

## Fluxo de trabalho

1. **Domínio:** `/grill-with-docs` fecha os termos e as decisões, registrados no `GLOSSARY.md` e em `docs/adr/`.
2. **Produto e arquitetura:** a skill `prd` escreve o brief; o HLD e o LLD vêm em seguida.
3. **Spec e tickets:** `/to-spec` publica a spec no Jira, como um Epic, e `/to-tickets` a quebra em fatias verticais, com os bloqueios entre elas.
4. **Plano do ticket:** `/plan-ticket` escreve o arquivo de aceite e o desenho do contrato e para numa página de revisão; só depois da aprovação vem o commit de plano.
5. **Implementação:** a skill `tdd`, a partir do commit de plano, seguida da `/simplify`, da `/code-review` e da revisão de conformidade.
6. **Verificação:** `scripts/verify.sh full` é a definição de pronto, e a CI a repete em todo pull request.

O detalhe de cada passo está no [`AGENTS.md`](./AGENTS.md).

## Como rodar

O único pré-requisito é o **Docker**, além do `git`, do `gh` e do `jq` na máquina.

```bash
docker compose -f compose.dev.yaml up -d --build --wait
scripts/verify.sh full
```
