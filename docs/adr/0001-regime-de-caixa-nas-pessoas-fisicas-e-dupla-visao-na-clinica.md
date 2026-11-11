# Regime de caixa nas pessoas físicas e dupla visão na clínica

Nas pessoas físicas, o resultado, o custo mensal da família e o orçamento usam o regime de caixa: uma despesa entra no mês em que o dinheiro sai, e uma compra parcelada no cartão entra parcela a parcela, no mês em que cada fatura é paga. Na clínica, o sistema mostra lado a lado o resultado gerencial e o fluxo de caixa. No resultado, a receita entra quando a cliente paga, a despesa na data do fato e o insumo vira custo quando é consumido. Escolhemos caixa nas pessoas físicas porque é como a família enxerga o dinheiro e o orçamento do mês. Na clínica, o resultado gerencial é necessário para a rentabilidade dos atendimentos fazer sentido, já que a receita e o custo do insumo cairiam em meses diferentes se o regime fosse de caixa.

## Receita da clínica no pagamento, e não no atendimento nem no repasse

A receita da clínica entra quando a cliente paga, seja por Pix, em dinheiro ou passando o cartão, tanto no atendimento avulso quanto no pacote. Não entra na data do atendimento nem quando a adquirente repassa o dinheiro. Um pacote pago na venda fatura inteiro na venda, mesmo com as sessões feitas ao longo de meses, porque é aí que a cliente cumpre a obrigação e que sai a nota fiscal. No cartão, o que a adquirente ainda vai repassar é um recebível. A taxa dela e a de antecipação são despesas financeiras, para que a decisão de antecipar não mude o faturamento. A rentabilidade de cada sessão usa a receita da sessão, a fração do pacote atribuída a ela.

## Consequences

Todo lançamento precisa guardar a data do fato e a data em que é pago, e cada parcela de cartão precisa saber em qual fatura cai. A Visão Familiar só soma pessoas físicas (ver `GLOSSARY.md`, "Visão Familiar"), então nunca mistura os dois regimes. Um atendimento feito num mês e pago no seguinte fatura no mês seguinte.
