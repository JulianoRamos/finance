# Finance

Gestão financeira de uma família e das empresas dela: as finanças de cada pessoa física e jurídica ficam separadas, e o sistema oferece visões consolidadas sobre elas.

O código usa o termo em inglês dado em **Em código** em cada conceito, em `snake_case` no banco e em `camelCase` ou `PascalCase` no TypeScript. O texto que uma pessoa lê usa o termo em português.

## Quem tem as finanças

**Entidade**:
Uma pessoa física ou jurídica cujas finanças o sistema controla, com nome, contas, lançamentos, bens e obrigações próprios. Pode haver quantas pessoas físicas e jurídicas forem necessárias. Não é quem acessa o sistema.
_Avoid_: Titular (para qualquer pessoa), cliente, perfil
**Em código:** `entity`

**Usuário**:
Uma pessoa que acessa o sistema com login próprio. Um usuário pode ver ou operar várias entidades, conforme as permissões dele.
_Avoid_: Conta (de acesso), entidade
**Em código:** `user`

**Link de recuperação**:
Um link de uso único, que vale 1 hora, com que um usuário define a senha: a primeira, depois de cadastrado, ou uma nova, quando perdeu o acesso. O sistema não envia e-mail: quem gere os acessos, ou o comando no servidor, gera o link e o entrega ao usuário.
_Avoid_: Convite, token, código de recuperação (que é do segundo fator)
**Em código:** `recovery_link`

**Grupo financeiro**:
Um conjunto de entidades consultado de forma consolidada.
_Avoid_: Família (como termo técnico), carteira
**Em código:** `financial_group`

**Contexto financeiro**:
A entidade ou o grupo financeiro que o usuário escolheu ver no momento. Define de quem são os números mostrados.
_Avoid_: Perfil, modo, visão (sem qualificar)
**Em código:** `financial_context` (na API, o cabeçalho `Financial-Context`)

**Visão Familiar**:
O grupo financeiro que já vem criado, com as pessoas físicas da família que o usuário escolher. Só aceita pessoas físicas: as empresas aparecem nele pelos repasses e pela participação societária.
_Avoid_: Visão consolidada (sem dizer qual grupo)
**Em código:** `family_view` (o grupo com `is_family_view`)

## Dinheiro

**Conta**:
Um lugar onde o dinheiro de uma única entidade fica guardado: conta bancária, conta de pagamento, caixa em espécie ou cartão de crédito. Toda conta tem exatamente um dono.
_Avoid_: Carteira, conta conjunta
**Em código:** `account`

**Conta de reserva**:
Uma conta marcada como lugar de guardar dinheiro, como uma caixinha que rende. Transferir para ela conta como aplicação, e tirar dela, como resgate.
_Avoid_: Poupança (como tipo de conta), caixinha
**Em código:** `reserve_account` (a conta com `is_reserve`)

**Lançamento**:
O registro de um fato financeiro de uma entidade, como uma despesa, uma receita ou uma transferência, previsto ou realizado. Pode se desdobrar em parcelas e ser liquidado por uma ou mais movimentações.
_Avoid_: Transação, movimentação, registro
**Em código:** `entry`

**Movimentação**:
A entrada ou a saída de dinheiro que de fato aconteceu numa conta, como uma linha do extrato bancário.
_Avoid_: Lançamento, transação, operação
**Em código:** `movement`

**Conciliação**:
A ligação entre uma movimentação e o lançamento que ela liquida, confirmando que o fato previsto aconteceu na conta.
_Avoid_: Casamento, baixa (que é de estoque)
**Em código:** `reconciliation`

**Transferência**:
A passagem de dinheiro entre duas contas da mesma entidade. Não é receita nem despesa.
_Avoid_: Repasse, movimentação interna
**Em código:** `transfer`

**Repasse**:
A passagem de dinheiro de uma entidade para outra, sempre com um tipo. O tipo decide se o repasse entra no resultado de cada lado, e os tipos possíveis dependem de quem dá e de quem recebe:

- entre pessoa física e empresa: pró-labore, distribuição de lucros, aporte, reembolso ou empréstimo;
- entre duas pessoas físicas: transferência familiar, reembolso ou empréstimo;
- entre duas empresas: aporte, reembolso ou empréstimo.

Qualquer repasse pode ficar a classificar.
_Avoid_: Transferência (entre entidades), transferência PF/PJ
**Em código:** `entity_transfer`

**Transferência familiar**:
O repasse entre duas pessoas físicas sem obrigação de devolver, como o dinheiro que um cônjuge passa ao outro para as despesas da casa. Não é receita nem despesa de nenhum dos lados e, num grupo com as duas, se anula.
_Avoid_: Mesada, doação, transferência (que é na mesma entidade)
**Em código:** `family_transfer`

**Empréstimo entre entidades**:
O repasse de uma entidade a outra que precisa ser devolvido. Não é receita nem despesa de nenhum dos lados: fica em aberto, como valor a receber de quem emprestou, até a devolução.
_Avoid_: Aporte, reembolso pendente
**Em código:** `loan`

**Saldo**:
O dinheiro de uma conta numa data, calculado pelo saldo inicial mais as movimentações desde então. Uma diferença para o banco se corrige com um ajuste.
_Avoid_: Saldo informado, saldo do extrato
**Em código:** `balance`

**Importação**:
A leitura de um arquivo de extrato de uma conta, que vira movimentações. Fica registrada, com o arquivo e o que gerou.
_Avoid_: Upload, sincronização
**Em código:** `import` (o arquivo é o `imported_file`)

**Situação**:
O estado de uma parcela a pagar ou a receber: prevista, parcial, liquidada, vencida ou cancelada. Parcial é a que recebeu parte do valor e mantém o restante em aberto, com o mesmo vencimento.
_Avoid_: Status (em texto para o usuário), estado
**Em código:** `status` (`expected`, `partial`, `settled`, `overdue`, `canceled`)

**Parcela**:
Uma das frações em que um lançamento é dividido, cada uma com valor e data próprios.
_Avoid_: Prestação
**Em código:** `installment`

**Fatura**:
O conjunto das parcelas e compras de um cartão de crédito num ciclo, pago de uma vez a partir de outra conta.
_Avoid_: Extrato do cartão
**Em código:** `card_statement`

## Classificação

**Categoria**:
A classificação de uma receita ou despesa numa árvore com subcategorias. As pessoas físicas compartilham uma árvore, e cada empresa tem a sua, no formato de um demonstrativo de resultado gerencial.
_Avoid_: Plano de contas, tag, rubrica
**Em código:** `category`

**Finalidade**:
Para que serve uma despesa de pessoa física: pessoal, de um dos membros, ou familiar, da casa. As duas compõem o custo de vida.
_Avoid_: Tipo de despesa, natureza
**Em código:** `purpose` (`personal`, `household`)

**Pagador**:
A entidade de cuja conta o dinheiro saiu para pagar um lançamento. Normalmente é a dona do lançamento, mas pode ser outra.
_Avoid_: Responsável, titular do pagamento
**Em código:** `payer`

**Reembolso pendente**:
O valor que uma entidade deve a outra porque a outra pagou um lançamento dela, como a pessoa física que paga com o próprio cartão uma compra de uma empresa. Fica em aberto até ser quitado por um repasse do tipo reembolso ou convertido em aporte.
_Avoid_: Adiantamento, empréstimo entre entidades (que é outro tipo de repasse)
**Em código:** `pending_reimbursement` (o repasse do tipo reembolso é `reimbursement`)

## Empresa

**Operação**:
O conjunto de funções de um segmento de negócio, ligado em cada empresa que precisa dele. Toda empresa tem o núcleo financeiro, e cada operação ligada acrescenta as funções do segmento. Uma empresa pode ter várias operações ligadas, ou nenhuma.
_Avoid_: Segmento, módulo, tipo de empresa
**Em código:** `operation`

**Operação de clínica**:
A operação com as funções de clínica: clientes, procedimentos, atendimentos, pacotes, estoque e compras. É a única operação por enquanto.
_Avoid_: Módulo clínico, tipo de empresa
**Em código:** `clinic`

**Cliente**:
A pessoa atendida pela clínica, guardada só com dados administrativos: nome, telefone e CPF. Não tem dado de saúde. A pedido dela, o cadastro é anonimizado, e os atendimentos e valores continuam ligados a uma cliente anônima.
_Avoid_: Paciente, consumidora
**Em código:** `customer`

**Atendimento**:
A realização de um ou mais procedimentos para uma cliente da clínica numa data, com o valor cobrado, a forma de pagamento e os materiais consumidos.
_Avoid_: Consulta, venda
**Em código:** `appointment`

**Pacote**:
Um conjunto de sessões de um procedimento vendido de uma vez a uma cliente, pago na venda e realizado em atendimentos ao longo do tempo. As sessões pagas e ainda não feitas formam o saldo do pacote, contado em sessões. Pode ser cancelado, com ou sem estorno do saldo.
_Avoid_: Combo, plano, assinatura
**Em código:** `session_package`

**Sessão**:
Um atendimento que consome uma das sessões de um pacote.
_Avoid_: Consulta, visita
**Em código:** sem termo próprio: o `appointment` com `session_package_id`. A `session` do código é a sessão de login

**Nota fiscal**:
O documento fiscal emitido fora do sistema para um atendimento avulso ou para um pacote, com número, data e valor. Cada atendimento avulso e cada pacote têm no máximo uma, e as sessões de um pacote não têm nota própria.
_Avoid_: NF (em texto para o usuário), recibo, cupom
**Em código:** `invoice`

**Situação fiscal**:
O estado de um atendimento avulso ou de um pacote quanto à nota fiscal: pendente, emitida, cancelada ou não aplicável. Não depende do recebimento.
_Avoid_: Status da nota, situação (sem qualificar)
**Em código:** `invoice_status` (`pending`, `issued`, `canceled`, `not_applicable`)

**Faturamento**:
A soma do que as clientes pagaram num período, por atendimentos avulsos e por pacotes, na data em que pagaram (o Pix, o dinheiro ou o cartão passado) e antes de descontar taxas. Um pacote fatura quando é pago, e não sessão a sessão.
_Avoid_: Receita (sem qualificar), recebimento
**Em código:** `gross_revenue`

**Receita da sessão**:
A fração do valor de um pacote atribuída a cada sessão, usada só na rentabilidade dos atendimentos. Não entra de novo no faturamento.
_Avoid_: Faturamento da sessão, rateio
**Em código:** `session_revenue`

**Estorno**:
A devolução de dinheiro a uma cliente, como o saldo de um pacote cancelado. Reduz o faturamento no mês em que é feita.
_Avoid_: Reembolso (que é entre entidades), devolução (como lançamento)
**Em código:** `refund`

**Forma de pagamento**:
O meio pelo qual a cliente paga: Pix, dinheiro, cartão de débito, crédito à vista ou crédito parcelado. Cada uma tem a taxa e o prazo de recebimento dela.
_Avoid_: Meio de pagamento, modalidade
**Em código:** `payment_method`

**Taxa de recebimento**:
O valor que a adquirente desconta de um pagamento por cartão, conforme a forma de pagamento. É despesa da empresa, e não reduz o faturamento.
_Avoid_: Taxa da maquininha, MDR
**Em código:** `fee` (o percentual da condição é `fee_rate`)

**Rentabilidade do atendimento**:
A receita de um atendimento, ou a receita da sessão, menos o custo dos materiais baixados nele e a taxa de recebimento. Despesas fixas da clínica não entram.
_Avoid_: Lucro do atendimento, margem (sem qualificar)
**Em código:** `appointment_profitability`

**Recebível**:
Um valor que a empresa tem a receber numa data futura, como cada parcela que a adquirente do cartão repassa, já líquido da taxa.
_Avoid_: Conta a receber (para cartão), crédito
**Em código:** `receivable`

**Antecipação**:
O pedido à adquirente para repassar um recebível antes da data prevista. A taxa cobrada é despesa financeira, e não reduz o faturamento.
_Avoid_: Adiantamento, desconto de recebíveis
**Em código:** `early_settlement`

**Pró-labore**:
O repasse de uma empresa a um sócio pessoa física como remuneração pelo trabalho. É despesa da empresa e receita da pessoa física.
_Avoid_: Salário, retirada
**Em código:** `pro_labore`

**Distribuição de lucros**:
O repasse de uma empresa a um sócio pessoa física de parte do lucro já apurado. Não é despesa da empresa, mas é receita da pessoa física.
_Avoid_: Retirada, dividendo
**Em código:** `profit_distribution`

**Aporte**:
O repasse de uma pessoa física ou de outra empresa a uma empresa como capital. Não é receita de quem recebe nem despesa de quem dá.
_Avoid_: Investimento (na empresa), empréstimo
**Em código:** `capital_contribution`

**Participação societária**:
A fração de uma empresa que pertence a outra entidade, pessoa física ou empresa. No patrimônio de quem a tem, vale o patrimônio líquido da empresa vezes essa fração.
_Avoid_: Cotas, ações (da clínica)
**Em código:** `equity_stake`

## Estoque

**Procedimento**:
Um serviço que a clínica oferece, como limpeza de pele ou preenchimento labial, com preço e lista padrão de materiais.
_Avoid_: Serviço (sem qualificar), tratamento
**Em código:** `procedure`

**Lista de materiais**:
Os produtos e as quantidades que um procedimento consome normalmente. Serve de sugestão na baixa e pode ser ajustada em cada atendimento.
_Avoid_: Ficha técnica, receita, kit
**Em código:** `procedure_material`

**Produto**:
Um item que a clínica guarda em estoque, como um insumo usado nos procedimentos, com unidade de medida, estoque mínimo e custo médio.
_Avoid_: Material (como cadastro), item, insumo (como cadastro)
**Em código:** `product`

**Lote**:
Uma quantidade de um produto que chegou de uma vez, com número do fabricante e validade. A baixa sempre diz de qual lote saiu, para o controle de validade.
_Avoid_: Remessa, partida
**Em código:** `lot`

**Baixa**:
A saída de quantidade de um produto do estoque, por consumo num atendimento, perda ou ajuste.
_Avoid_: Conciliação, consumo (como operação)
**Em código:** `stock_issue` (a entrada de estoque é `stock_receipt`)

**Custo médio**:
O custo por unidade de um produto, recalculado a cada entrada pela média ponderada do que há em estoque. É o custo de toda baixa.
_Avoid_: Custo do lote, preço de compra
**Em código:** `average_cost`

## Compras

**Fornecedor**:
Uma empresa de quem a clínica compra produtos.
_Avoid_: Distribuidor, vendedor
**Em código:** `supplier`

**Compra**:
O pedido de produtos a um fornecedor, com preços, frete e condições de pagamento. É ela que gera as parcelas a pagar, pelo valor combinado.
_Avoid_: Pedido, nota de entrada
**Em código:** `purchase`

**Entrega**:
A chegada física de parte ou de toda uma compra. Só a entrega põe os produtos no estoque.
_Avoid_: Recebimento (que é de dinheiro), entrada
**Em código:** `delivery`

## Planejamento

**Meta**:
Um objetivo financeiro com valor-alvo, prazo e contribuições planejadas, ligado a contas e bens. O valor acumulado é o saldo das contas mais o último valor dos bens.
_Avoid_: Objetivo, sonho, caixinha
**Em código:** `goal`

**Contribuição**:
O valor que se planeja separar para uma meta a cada período, como R$ 500 por mês para a reserva de emergência.
_Avoid_: Aporte (que é repasse à empresa), depósito
**Em código:** `planned_contribution`

**Orçamento**:
O valor planejado para uma categoria, numa entidade e num período, comparado com o realizado.
_Avoid_: Limite, teto, previsão
**Em código:** `budget`

**Recorrência**:
A regra que gera lançamentos previstos repetidos, como um aluguel ou uma conta de luz. Quando o valor varia, cada previsão nasce estimada e é confirmada quando a conta chega.
_Avoid_: Assinatura, despesa fixa, lançamento recorrente
**Em código:** `recurrence`

**Valor estimado**:
O valor de um lançamento previsto que ainda não é conhecido com certeza. O fluxo de caixa projetado o mostra separado do valor confirmado.
_Avoid_: Valor provisório, previsão (como valor)
**Em código:** `estimated_amount` (a parcela estimada tem `is_estimated`)

## Patrimônio

**Bem**:
Algo de valor que pertence a uma única entidade: imóvel, veículo, investimento ou equipamento. Cada bem é marcado como investimento ou como bem de consumo, o que decide se comprá-lo é despesa.
_Avoid_: Ativo (sem qualificar), propriedade
**Em código:** `asset`

**Dívida**:
Um valor que uma entidade deve a um terceiro, como um financiamento ou um empréstimo, com o saldo devedor informado pelo credor. Pertence a uma única entidade, e cada parcela paga é despesa pelo valor inteiro.
_Avoid_: Passivo (sem qualificar), obrigação, débito
**Em código:** `debt`

**Reavaliação**:
Um novo valor de um bem, informado numa data. O histórico das reavaliações forma a evolução do patrimônio.
_Avoid_: Atualização, cotação, marcação a mercado
**Em código:** `revaluation`

**Patrimônio líquido**:
A soma dos bens menos a soma das dívidas de uma entidade ou de um grupo financeiro numa data.
_Avoid_: Patrimônio (sem qualificar), riqueza
**Em código:** `net_worth`

**Aplicação**:
A passagem de dinheiro de uma conta para um investimento ou para uma conta de reserva da mesma entidade. Não é despesa: o dinheiro só muda de forma. O caminho inverso é o resgate.
_Avoid_: Investimento (como operação), aporte (que é repasse à empresa)
**Em código:** `investment` (o caminho inverso, o resgate, é `redemption`)

**Bem de consumo**:
Um bem marcado como não sendo investimento, como um veículo ou um móvel (um imóvel pode ser de um tipo ou de outro). Comprá-lo é despesa, pelo que é pago a cada mês, embora ele também apareça no patrimônio.
_Avoid_: Bem durável, imobilizado
**Em código:** `consumption` (o valor de `asset_class`)

## Indicadores

**Custo de vida**:
A soma das despesas das pessoas físicas do contexto financeiro num mês, pessoais e familiares, pelo regime de caixa. Inclui a compra de bens de consumo e as parcelas inteiras das dívidas, e não inclui aplicações, transferências, transferências familiares, empréstimos nem aportes.
_Avoid_: Custo mensal familiar, gasto do mês
**Em código:** `cost_of_living`

**Taxa de poupança**:
As aplicações menos os resgates das pessoas físicas do contexto financeiro num mês, divididos pelas receitas delas no mesmo mês. Pode ser negativa.
_Avoid_: Sobra, economia do mês
**Em código:** `savings_rate`

## Sistema

**Alerta**:
Um aviso mostrado dentro do sistema sobre algo que pede atenção, como um vencimento, um estoque abaixo do mínimo ou um reembolso pendente. Não sai do sistema por e-mail ou mensagem.
_Avoid_: Notificação, lembrete
**Em código:** `alert`

**Documento**:
Um arquivo vinculado a um registro do sistema, como a nota fiscal de um atendimento ou o comprovante de um pagamento.
_Avoid_: Anexo, arquivo (sem qualificar)
**Em código:** `document`
