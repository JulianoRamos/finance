# Product brief

Este documento diz o que o finance é, para quem é, o que entra no escopo, o que fica fora, em que ordem é construído e como se mede o sucesso. Ele parte do `documento-de-contexto.md` e usa o vocabulário do `GLOSSARY.md`. As decisões de arquitetura ficam no `hld.md`, e as regras de negócio, o esquema e os contratos, no `lld.md`.

## 1. Resumo

**Problema.** A família e a clínica não têm controle financeiro estruturado. Não se sabe o custo de vida, o dinheiro passa entre a pessoa física da esposa e a clínica sem classificação, e a clínica não conhece o próprio resultado, o custo dos procedimentos nem o estoque.

**Solução.** Uma aplicação web que mantém separadas as finanças de cada entidade, pessoa física ou jurídica, em quantas houver, importa os extratos bancários, classifica os repasses entre pessoa física e empresa e mostra, em cada contexto financeiro, a situação da entidade ou da Visão Familiar. Toda empresa tem resultado gerencial, e cada uma liga as operações do segmento dela. A primeira é a operação de clínica, que traz atendimentos, pacotes, estoque e compras.

**Critérios de sucesso.** Medidos depois da entrada em produção, mês a mês, com os dados reais de todas as entidades cadastradas:

1. **Mês fechado em até 1 hora.** Importar os extratos e as faturas de todas as contas das entidades e revisar o que a conciliação não resolveu sozinha leva, no total, até 60 minutos por mês.
2. **Saldos que batem.** No último dia de cada mês, o saldo de 100% das contas é igual ao do banco, ou a diferença está explicada por um ajuste registrado.
3. **Nada esquecido sem classificação.** Nenhuma movimentação, lançamento ou repasse fica "a classificar" por mais de 7 dias.
4. **Valores exatos.** Nenhuma diferença de centavo entre a soma dos lançamentos de um período e os totais dos relatórios e dashboards desse período.
5. **Restauração provada.** Antes da entrada em produção, um backup completo é restaurado num ambiente limpo, e os saldos, os resultados e o patrimônio líquido restaurados são idênticos aos de origem.

## 2. Usuários e funcionalidades

### Usuários

- **O titular:** controla as próprias finanças e as despesas da casa, e quer ver o custo de vida, a taxa de poupança e o patrimônio da família.
- **A esposa, sócia da clínica:** controla a própria pessoa física e opera a clínica no dia a dia: atendimentos, pacotes, estoque, compras e o que a clínica tem a pagar e a receber.

Os dois usuários veem e operam todas as entidades. A separação por permissões é um requisito da arquitetura, para usuários futuros, mas não muda o uso inicial.

### Histórias e critérios de aceite

As histórias estão agrupadas pela fase de construção (ver "Fases"). Os critérios descrevem o resultado esperado; a regra detalhada de cada um fica no LLD.

**Fundação**

- Como usuário, quero entrar com e-mail e senha, recuperar o acesso e encerrar sessões abertas, para manter os dados da família protegidos.
  - O login exige e-mail e senha, e a recuperação de acesso funciona por um link de uso único com validade.
  - O usuário vê as próprias sessões ativas e encerra qualquer uma.
- Como usuário, quero cadastrar entidades e grupos financeiros e escolher o contexto financeiro, para ver só os números de quem me interessa.
  - O usuário cadastra quantas pessoas físicas e jurídicas precisar, com o nome que quiser. No uso inicial são três: as pessoas físicas do titular e da esposa e a clínica.
  - A Visão Familiar já vem criada, e o usuário escolhe quais pessoas físicas fazem parte dela. Ela não aceita empresas.
  - Cada empresa tem as próprias operações ligadas, hoje só a de clínica, e a própria árvore de categorias.
  - Toda tela de dados mostra o contexto financeiro escolhido, e nenhum número de outra entidade aparece nela.
- Como usuário, quero pesquisar pelo nome, de qualquer tela, para achar um cadastro, uma tela ou uma ação sem saber onde estão.
  - A pesquisa procura em todas as entidades em que o usuário tem permissão, e não só no contexto escolhido.
  - Cada módulo acrescenta os próprios registros à pesquisa quando nasce.
- Como usuário, quero que toda alteração financeira fique registrada, para saber quem mudou o quê.
  - Cada criação, alteração ou exclusão de um registro financeiro guarda quem fez, quando, o registro e os valores anteriores e novos.

**Finanças das pessoas físicas**

- Como titular, quero cadastrar as contas e os cartões de cada entidade, com o saldo inicial, para que o saldo seja calculado a partir daí.
  - Cada conta pertence a uma única entidade, e o saldo dela numa data é o saldo inicial mais as movimentações até essa data.
  - Uma conta pode ser marcada como conta de reserva.
- Como titular, quero importar extratos OFX, CSV e XLSX dos seis bancos, para não digitar movimentações.
  - A importação aceita os arquivos de extrato e de fatura do Nubank, da Caixa, do Mercado Pago, do Bradesco, do Itaú e do Banco do Brasil, nos formatos que cada um oferece.
  - Antes de confirmar, o usuário vê as movimentações, as possíveis duplicidades e as conciliações sugeridas.
  - Uma movimentação que bate com um lançamento previsto em valor e conta, com data próxima, é conciliada sem revisão. As demais esperam a revisão.
  - Importar o mesmo arquivo duas vezes não duplica nenhuma movimentação.
- Como titular, quero registrar despesas e receitas únicas, parceladas e recorrentes, com categoria e finalidade, para conhecer o custo de vida.
  - Uma compra parcelada no cartão gera uma parcela em cada fatura, e cada parcela entra como despesa no mês em que a fatura é paga.
  - Uma recorrência de valor variável gera previsões com valor estimado, que são confirmadas quando a conta chega.
- Como titular, quero que as transferências entre minhas contas e as aplicações em investimentos não contem como despesa, para que o custo de vida seja real.
  - Transferências e aplicações não entram no custo de vida nem no orçamento de despesas.
- Como titular, quero registrar o dinheiro que passo para outra pessoa física da família como transferência familiar ou empréstimo, para que ele não vire receita nem despesa.
  - Uma transferência familiar se anula na Visão Familiar, e um empréstimo fica em aberto até ser devolvido.
- Como titular, quero ver na Visão Familiar o saldo, as receitas, as despesas, o custo de vida e a taxa de poupança do mês, para entender a situação da família.

**Núcleo financeiro da clínica**

- Como sócia, quero registrar o pró-labore, a distribuição de lucros, os aportes e os reembolsos entre a minha pessoa física e a clínica, para que o resultado da clínica e o meu fiquem corretos.
  - Todo repasse entre entidades tem um tipo, e o tipo decide se ele entra no resultado de cada lado. Os tipos possíveis dependem de o repasse ser entre pessoa física e empresa, entre duas pessoas físicas ou entre duas empresas.
  - Um repasse sem tipo fica "a classificar" e gera um alerta.
- Como sócia, quando eu pagar algo da clínica com o meu cartão pessoal, quero que o sistema registre o reembolso pendente, para não esquecer de acertar.
  - A despesa fica na clínica, e o reembolso pendente aparece como alerta até ser quitado por um repasse ou convertido em aporte.
- Como sócia, quero controlar o que a clínica tem a pagar e a receber, com as situações e as formas de pagamento, para saber o caixa dos próximos dias.
  - Cada parcela tem uma das situações: prevista, parcial, liquidada, vencida ou cancelada.
  - Um pagamento no cartão gera os recebíveis da adquirente, líquidos da taxa de recebimento, nas datas previstas. Uma antecipação registra a taxa como despesa financeira.

**Operação da clínica**

- Como sócia, quero registrar atendimentos avulsos e vender pacotes, para saber o faturamento e o saldo de sessões de cada cliente.
  - O faturamento entra quando a cliente paga, pelo valor antes das taxas. O pacote fatura inteiro no pagamento.
  - O saldo de cada pacote mostra as sessões pagas e ainda não feitas. Um pacote cancelado registra o estorno, se houver.
- Como sócia, quero que o atendimento dê baixa nos materiais, a partir da lista de materiais do procedimento, para que o estoque e o custo fiquem certos.
  - A baixa sugere as quantidades da lista de materiais e o lote que vence antes, e as duas coisas podem ser ajustadas.
  - O custo da baixa é o custo médio do produto.
- Como sócia, quero ver a rentabilidade de cada atendimento e de cada procedimento, para saber o que dá lucro.
  - A rentabilidade é a receita do atendimento, ou a receita da sessão, menos o custo dos materiais e a taxa de recebimento.
- Como sócia, quero registrar compras, fornecedores e entregas, para que o estoque e as contas a pagar nasçam certos.
  - A compra gera as parcelas a pagar, e só a entrega põe os produtos no estoque.
- Como sócia, quero acompanhar a situação fiscal de cada atendimento avulso e de cada pacote, para não esquecer nenhuma nota fiscal.
  - A situação fiscal é independente do recebimento, e a nota fiscal pendente gera um alerta.
- Como sócia, quero ver o resultado gerencial e o fluxo de caixa da clínica lado a lado, para entender lucro e dinheiro em caixa.

**Patrimônio e planejamento**

- Como titular, quero cadastrar bens e dívidas com reavaliações, para acompanhar o patrimônio líquido de cada entidade e da família.
  - A participação societária de uma entidade numa empresa vale o patrimônio líquido da empresa vezes a fração dela, como a da esposa na clínica.
  - Nenhum bem ou dívida é contado duas vezes num grupo financeiro.
- Como titular, quero criar metas com contribuições planejadas e orçamentos por categoria, para planejar o futuro.
  - O valor acumulado de uma meta é o saldo das contas e o último valor dos bens ligados a ela.
  - O orçamento compara o planejado com o realizado por categoria, entidade e mês.
- Como titular, quero a projeção do caixa de 30, 60 e 90 dias, para me antecipar.
  - A projeção separa os valores confirmados dos estimados.

**Relatórios, segurança e operação**

- Como usuário, quero relatórios exportáveis em PDF e XLSX, para analisar e guardar os números.
- Como usuário, quero alertas dentro do sistema sobre vencimentos, atrasos, estoque mínimo, validade, notas pendentes, desvios do orçamento, metas e falhas de backup.
- Como usuário, quero vincular documentos (notas, recibos, comprovantes) aos registros.
- Como usuário, quero ativar a autenticação em dois fatores.
- Como usuário, quero backups diários automáticos e manuais, criptografados, e poder restaurá-los.
  - Uma falha de backup gera um alerta.
- Como sócia, quero anonimizar o cadastro de uma cliente a pedido dela, mantendo os atendimentos e as notas fiscais pelo prazo legal.

### Fora do escopo

Além do que o documento de contexto já exclui (emissão de nota fiscal, prontuário, fotos e dados clínicos, apps nativos, sincronização entre instalações, integração bancária em tempo real, notificações por e-mail, SMS ou WhatsApp, câmbio e múltiplas moedas, substituição da contabilidade oficial), ficam fora:

- **Rastreabilidade clínica de lotes:** a consulta de quais clientes receberam um lote (ver ADR 0002).
- **Fechamento de mês:** um erro num mês antigo se corrige editando, com auditoria.
- **Investimentos detalhados:** cotação automática, preço médio e rentabilidade por ativo. Investimentos são bens com reavaliação.
- **Rateio de despesas fixas** na rentabilidade dos atendimentos.
- **Permissões por entidade** no uso inicial: a arquitetura as prevê, mas os dois usuários veem tudo.
- **Contas, bens e dívidas com mais de um dono.**
- **Importação obrigatória do histórico:** importar meses anteriores é possível, mas não é condição para a entrada em produção.

## 3. Requisitos de IA

Não se aplica: o produto não usa modelos de IA. A IA é usada no desenvolvimento, e não no sistema.

## 4. Visão técnica

A stack, a arquitetura e as decisões técnicas são do `hld.md`, e o esquema e os contratos, do `lld.md`. Os requisitos que este brief impõe a eles:

- **Stack prevista:** Next.js, NestJS, Prisma e PostgreSQL, em TypeScript, num monólito modular em monorepo, rodando em Docker.
- **Integrações:** nenhuma integração online com bancos ou adquirentes. Tudo entra por arquivo importado ou digitado.
- **Valores:** precisão decimal em todo valor monetário, em BRL, com formatação pt-BR e fuso America/Sao_Paulo.
- **Segurança e privacidade:** login individual, segundo fator opcional, sessões controladas, auditoria das alterações financeiras, documentos com acesso restrito, nenhum dado de saúde de clientes e anonimização a pedido, pela LGPD.
- **Implantação:** uma instalação ativa de cada vez, na nuvem ou num servidor local, com custo baixo e sem prazo. A troca de ambiente é feita por backup e restauração.

## 5. Fases e riscos

### Fases

O sistema só entra em produção completo. As fases dão a ordem de construção, e cada uma termina com uma validação com dados reais.

1. **Fundação:** ambiente, autenticação, entidades, grupos financeiros, contexto financeiro e auditoria.
2. **Finanças das pessoas físicas:** contas, cartões e faturas, lançamentos, categorias, recorrências, importação e conciliação, transferências e a Visão Familiar. Validação: um mês real das pessoas físicas da família, com os saldos batendo.
3. **Núcleo financeiro da clínica:** repasses, reembolso pendente, contas a pagar e a receber, formas de pagamento, recebíveis e antecipação. Validação: um mês real da clínica, com os repasses classificados.
4. **Operação da clínica:** a operação de clínica ligada por empresa, com clientes, procedimentos, atendimentos, pacotes, situação fiscal, estoque, compras, fornecedores, entregas, rentabilidade e resultado gerencial.
5. **Patrimônio e planejamento:** bens, dívidas, reavaliações, participação societária, metas, orçamento e projeção de caixa.
6. **Relatórios e operação:** relatórios com exportação, alertas, documentos, segundo fator, backup e restauração, anonimização e a homologação final.

### Riscos

- **Formatos dos bancos:** cada banco tem um formato, e ele pode mudar sem aviso. Mitigação: os arquivos reais dos seis bancos viram amostras de teste da importação, e um formato desconhecido falha com mensagem clara, sem importar pela metade.
- **Integridade financeira:** um erro de cálculo, de duplicidade ou de classificação compromete saldos e relatórios. Mitigação: regras financeiras centralizadas e testadas, os critérios 2 a 4 como verificação contínua e a auditoria.
- **Separação entre PF e PJ:** um repasse mal classificado distorce o resultado da clínica e o custo de vida. Mitigação: repasse sem tipo sempre fica "a classificar", com alerta.
- **Regras fiscais:** o momento da nota fiscal do pacote e o tratamento fiscal da distribuição de lucros dependem do contador. Mitigação: o sistema registra o tratamento gerencial, e os dois pontos são validados com o contador antes da fase 4.
- **Escopo amplo, desenvolvedor único:** seis fases com muitos domínios. Mitigação: fatias verticais pequenas, harness de verificação e validação com dados reais ao fim de cada fase.
- **Perda de dados:** dados financeiros sem cópia. Mitigação: backup criptografado e o teste de restauração do critério 5.
