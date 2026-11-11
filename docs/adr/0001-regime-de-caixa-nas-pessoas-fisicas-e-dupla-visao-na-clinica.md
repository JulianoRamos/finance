# Regime de caixa nas pessoas físicas e dupla visão na clínica

Nas pessoas físicas, o resultado, o custo mensal da família e o orçamento usam o regime de caixa: uma despesa entra no mês em que o dinheiro sai, e uma compra parcelada no cartão entra parcela a parcela, no mês em que cada fatura é paga. Na clínica, o sistema mostra lado a lado o resultado por competência (receita na data do atendimento, despesa na data do fato e insumo como custo quando consumido) e o fluxo de caixa. Escolhemos caixa nas pessoas físicas porque é como a família enxerga o dinheiro e o orçamento do mês. Na clínica, a competência é necessária para a rentabilidade dos atendimentos fazer sentido, já que a receita e o custo do insumo aconteceriam em meses diferentes se o regime fosse de caixa.

## Consequences

Todo lançamento precisa guardar a data do fato e a data em que é pago, e cada parcela de cartão precisa saber em qual fatura cai. A Visão Familiar só soma pessoas físicas (ver `GLOSSARY.md`, "Visão Familiar"), então nunca mistura os dois regimes.
