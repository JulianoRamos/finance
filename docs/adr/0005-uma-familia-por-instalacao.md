# Uma família por instalação

Cada instalação atende uma família só: um banco com todas as entidades, todos os usuários e todos os grupos financeiros dela. O sistema não tem o conceito de inquilino, e outra família exige outra instalação. É o que o documento de contexto descreve (uma instalação ativa, na nuvem ou num servidor local, trocada por backup e restauração), e evita filtrar por inquilino em toda consulta e em todo teste.

## Consequences

O isolamento dentro da instalação é por entidade, com o contexto financeiro e as permissões. Transformar o sistema num serviço para várias famílias exigiria acrescentar o inquilino a todas as tabelas e consultas, e um novo ADR.
