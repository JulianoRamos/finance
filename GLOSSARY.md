# Finance

Gestão financeira de uma família e da empresa dela: as finanças de cada pessoa física e jurídica ficam separadas, e o sistema oferece visões consolidadas sobre elas.

## Quem tem as finanças

**Entidade**:
Uma pessoa física ou jurídica cujas finanças o sistema controla, com contas, lançamentos, bens e obrigações próprios. Não é quem acessa o sistema.
_Avoid_: Titular (para qualquer pessoa), cliente, perfil

**Usuário**:
Uma pessoa que acessa o sistema com login próprio. Um usuário pode ver ou operar várias entidades, conforme as permissões dele.
_Avoid_: Conta (de acesso), entidade

**Grupo financeiro**:
Um conjunto de entidades consultado de forma consolidada.
_Avoid_: Família (como termo técnico), carteira

**Visão Familiar**:
O grupo financeiro das pessoas físicas da família. A empresa não faz parte dele: ela só aparece pelos repasses às pessoas físicas e pela participação delas no patrimônio.
_Avoid_: Visão consolidada (sem dizer qual grupo)

## Dinheiro

**Conta**:
Um lugar onde o dinheiro de uma única entidade fica guardado: conta bancária, conta de pagamento, caixa em espécie ou cartão de crédito. Toda conta tem exatamente um dono.
_Avoid_: Carteira, conta conjunta

**Lançamento**:
O registro de um fato financeiro de uma entidade, como uma despesa, uma receita ou uma transferência, previsto ou realizado. Pode se desdobrar em parcelas e ser liquidado por uma ou mais movimentações.
_Avoid_: Transação, movimentação, registro

**Movimentação**:
A entrada ou a saída de dinheiro que de fato aconteceu numa conta, como uma linha do extrato bancário.
_Avoid_: Lançamento, transação, operação

**Conciliação**:
A ligação entre uma movimentação e o lançamento que ela liquida, confirmando que o fato previsto aconteceu na conta.
_Avoid_: Casamento, baixa (que é de estoque)

**Transferência**:
A passagem de dinheiro entre duas contas da mesma entidade. Não é receita nem despesa.
_Avoid_: Repasse, movimentação interna

**Repasse**:
A passagem de dinheiro de uma entidade para outra, sempre com um tipo: pró-labore, distribuição de lucros, aporte, reembolso ou a classificar. O tipo decide se o repasse entra no resultado de cada lado.
_Avoid_: Transferência (entre entidades), transferência PF/PJ

**Saldo**:
O dinheiro de uma conta numa data, calculado pelo saldo inicial mais as movimentações desde então. Uma diferença para o banco se corrige com um ajuste.
_Avoid_: Saldo informado, saldo do extrato

**Importação**:
A leitura de um arquivo de extrato de uma conta, que vira movimentações. Fica registrada, com o arquivo e o que gerou.
_Avoid_: Upload, sincronização

**Situação**:
O estado de uma parcela a pagar ou a receber: prevista, parcial, liquidada, vencida ou cancelada. Parcial é a que recebeu parte do valor e mantém o restante em aberto, com o mesmo vencimento.
_Avoid_: Status (em texto para o usuário), estado

**Parcela**:
Uma das frações em que um lançamento é dividido, cada uma com valor e data próprios.
_Avoid_: Prestação

**Fatura**:
O conjunto das parcelas e compras de um cartão de crédito num ciclo, pago de uma vez a partir de outra conta.
_Avoid_: Extrato do cartão

## Classificação

**Categoria**:
A classificação de uma receita ou despesa numa árvore com subcategorias. As pessoas físicas compartilham uma árvore, e a empresa tem a dela, no formato de um demonstrativo de resultado gerencial.
_Avoid_: Plano de contas, tag, rubrica

**Finalidade**:
Para que serve uma despesa de pessoa física: pessoal, de um dos membros, ou familiar, da casa. As duas compõem o custo mensal da família.
_Avoid_: Tipo de despesa, natureza

**Pagador**:
A entidade de cuja conta o dinheiro saiu para pagar um lançamento. Normalmente é a dona do lançamento, mas pode ser outra.
_Avoid_: Responsável, titular do pagamento

**Reembolso pendente**:
O valor que uma entidade deve a outra porque a outra pagou um lançamento dela, como a pessoa física que paga com o próprio cartão uma compra da empresa. Fica em aberto até ser quitado por um repasse do tipo reembolso ou convertido em aporte.
_Avoid_: Adiantamento, empréstimo entre entidades

## Empresa

**Cliente**:
A pessoa atendida pela clínica, guardada só com dados administrativos: nome, telefone e CPF. Não tem dado de saúde. A pedido dela, o cadastro é anonimizado, e os atendimentos e valores continuam ligados a uma cliente anônima.
_Avoid_: Paciente, consumidora

**Atendimento**:
A realização de um ou mais procedimentos para uma cliente da clínica numa data, com o valor cobrado, a forma de pagamento e os materiais consumidos.
_Avoid_: Consulta, venda

**Pacote**:
Um conjunto de sessões de um procedimento vendido de uma vez a uma cliente, pago na venda e realizado em atendimentos ao longo do tempo. Pode ser cancelado, com ou sem devolução do saldo.
_Avoid_: Combo, plano, assinatura

**Sessão**:
Um atendimento que consome uma das sessões de um pacote.
_Avoid_: Consulta, visita

**Nota fiscal**:
O documento fiscal emitido fora do sistema para um atendimento avulso ou para um pacote, com número, data e valor. Cada atendimento avulso e cada pacote têm no máximo uma, e as sessões de um pacote não têm nota própria.
_Avoid_: NF (em texto para o usuário), recibo, cupom

**Situação fiscal**:
O estado de um atendimento avulso ou de um pacote quanto à nota fiscal: pendente, emitida, cancelada ou não aplicável. Não depende do recebimento.
_Avoid_: Status da nota, situação (sem qualificar)

**Faturamento**:
A soma dos valores cobrados nos atendimentos de um período, na data do atendimento e antes de descontar taxas. Numa sessão de pacote, vale a fração do pacote que ela representa, e o saldo de um pacote cancelado sem devolução vira faturamento no cancelamento.
_Avoid_: Receita (sem qualificar), recebimento

**Recebível**:
Um valor que a empresa tem a receber numa data futura, como cada parcela que a adquirente do cartão repassa, já líquido da taxa.
_Avoid_: Conta a receber (para cartão), crédito

**Pró-labore**:
O repasse da empresa à sócia como remuneração pelo trabalho. É despesa da empresa e receita da pessoa física.
_Avoid_: Salário, retirada

**Distribuição de lucros**:
O repasse da empresa à sócia de parte do lucro já apurado. Não é despesa da empresa, mas é receita da pessoa física.
_Avoid_: Retirada, dividendo

**Aporte**:
O repasse de uma pessoa física à empresa como capital. Não é receita da empresa nem despesa da pessoa física.
_Avoid_: Investimento (na empresa), empréstimo

**Participação societária**:
A fração da empresa que pertence a uma pessoa física. No patrimônio dela, vale o patrimônio líquido da empresa vezes essa fração.
_Avoid_: Cotas, ações (da clínica)

## Estoque

**Procedimento**:
Um serviço que a clínica oferece, como limpeza de pele ou preenchimento labial, com preço e lista padrão de materiais.
_Avoid_: Serviço (sem qualificar), tratamento

**Lista de materiais**:
Os produtos e as quantidades que um procedimento consome normalmente. Serve de sugestão na baixa e pode ser ajustada em cada atendimento.
_Avoid_: Ficha técnica, receita, kit

**Produto**:
Um item que a clínica guarda em estoque, como um insumo usado nos procedimentos, com unidade de medida, estoque mínimo e custo médio.
_Avoid_: Material (como cadastro), item, insumo (como cadastro)

**Lote**:
Uma quantidade de um produto que chegou de uma vez, com número do fabricante e validade. A baixa sempre diz de qual lote saiu, para o controle de validade.
_Avoid_: Remessa, partida

**Baixa**:
A saída de quantidade de um produto do estoque, por consumo num atendimento, perda ou ajuste.
_Avoid_: Conciliação, consumo (como operação)

**Custo médio**:
O custo por unidade de um produto, recalculado a cada entrada pela média ponderada do que há em estoque. É o custo de toda baixa.
_Avoid_: Custo do lote, preço de compra

## Compras

**Fornecedor**:
Uma empresa de quem a clínica compra produtos.
_Avoid_: Distribuidor, vendedor

**Compra**:
O pedido de produtos a um fornecedor, com preços, frete e condições de pagamento. É ela que gera as parcelas a pagar, pelo valor combinado.
_Avoid_: Pedido, nota de entrada

**Entrega**:
A chegada física de parte ou de toda uma compra. Só a entrega põe os produtos no estoque.
_Avoid_: Recebimento (que é de dinheiro), entrada

## Planejamento

**Meta**:
Um objetivo financeiro com valor-alvo e prazo, ligado a contas e bens. O valor acumulado é o saldo das contas mais o último valor dos bens.
_Avoid_: Objetivo, sonho, caixinha

**Orçamento**:
O valor planejado para uma categoria, numa entidade e num período, comparado com o realizado.
_Avoid_: Limite, teto, previsão

**Recorrência**:
A regra que gera lançamentos previstos repetidos, como um aluguel ou uma conta de luz. Quando o valor varia, cada previsão nasce estimada e é confirmada quando a conta chega.
_Avoid_: Assinatura, despesa fixa, lançamento recorrente

**Valor estimado**:
O valor de um lançamento previsto que ainda não é conhecido com certeza. O fluxo de caixa projetado o mostra separado do valor confirmado.
_Avoid_: Valor provisório, previsão (como valor)

## Patrimônio

**Bem**:
Algo de valor que pertence a uma única entidade: imóvel, veículo, investimento ou equipamento. Cada bem é marcado como investimento ou como bem de consumo, o que decide se comprá-lo é despesa.
_Avoid_: Ativo (sem qualificar), propriedade

**Dívida**:
Um valor que uma entidade deve a um terceiro, como um financiamento ou um empréstimo, com o saldo devedor informado pelo credor. Pertence a uma única entidade, e cada parcela paga é despesa pelo valor inteiro.
_Avoid_: Passivo (sem qualificar), obrigação, débito

**Reavaliação**:
Um novo valor de um bem, informado numa data. O histórico das reavaliações forma a evolução do patrimônio.
_Avoid_: Atualização, cotação, marcação a mercado

**Patrimônio líquido**:
A soma dos bens menos a soma das dívidas de uma entidade ou de um grupo financeiro numa data.
_Avoid_: Patrimônio (sem qualificar), riqueza

**Aplicação**:
A passagem de dinheiro de uma conta para um investimento da mesma entidade. Não é despesa: o dinheiro só muda de forma. O caminho inverso é o resgate.
_Avoid_: Investimento (como operação), aporte (que é repasse à empresa)

**Bem de consumo**:
Um bem marcado como não sendo investimento, como um veículo ou um móvel (um imóvel pode ser de um tipo ou de outro). Comprá-lo é despesa, pelo que é pago a cada mês, embora ele também apareça no patrimônio.
_Avoid_: Bem durável, imobilizado
