# Módulos síncronos na mesma transação

Os módulos da `api` se chamam de forma síncrona, pela interface pública de cada um, e um comando que atravessa módulos roda numa transação só do banco. Um atendimento, por exemplo, grava a receita, os recebíveis, a baixa de estoque e a auditoria juntos, ou não grava nada. Escolhemos assim porque um estado financeiro pela metade (uma receita sem a baixa, uma compra sem as parcelas) quebraria os critérios de saldos que batem e de valores exatos, e porque um processo só, com um banco só, não precisa de consistência eventual.

## Considered Options

- **Eventos de domínio com fila ou outbox:** desacoplam os módulos e permitem processar depois, mas trazem consistência eventual, reprocessamento e mais infraestrutura, sem ganho para uma instalação com dois usuários.

## Consequences

As dependências entre módulos são explícitas e não podem ter ciclo: os módulos de operação dependem dos financeiros, e nunca o contrário. Os alertas são derivados por consulta, e não por eventos. Se um dia um módulo virar um serviço à parte, essa fronteira precisará de outro mecanismo e de um novo ADR.
