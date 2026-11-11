# Documento de Contexto do Projeto
## Sistema de Gestão Financeira Familiar e Empresarial

**Versão:** 1.0  
**Status:** Contexto inicial consolidado  
**Nome comercial:** A definir  
**Repositório:** https://github.com/JulianoRamos/finance  
**Desenvolvimento:** Individual, com assistência de IA

---

## 1. Contexto e Visão Geral

O projeto consiste no desenvolvimento de uma aplicação web para gestão financeira pessoal, familiar e empresarial.

Inicialmente, o sistema atenderá três entidades financeiras:

- Pessoa Física — Titular
- Pessoa Física — Esposa
- Pessoa Jurídica — Clínica de Biomedicina Estética

A aplicação deverá centralizar o acompanhamento das finanças, preservando a separação dos recursos e das obrigações de cada entidade.

O sistema permitirá visualizar a situação financeira individual de cada entidade e disponibilizará uma visão consolidada familiar, respeitando a distinção entre recursos pessoais e empresariais.

A aplicação também deverá apoiar a administração financeira e operacional da clínica, incluindo atendimentos, procedimentos, estoque, compras, fornecedores, receitas, despesas e resultados.

O projeto será desenvolvido integralmente antes de entrar em produção.

### 1.1 Visão do Produto

Construir uma plataforma centralizada, confiável e intuitiva que permita compreender a saúde financeira da família e da empresa, organizar operações financeiras e apoiar decisões de curto, médio e longo prazo.

### 1.2 Público Inicial

O sistema será utilizado inicialmente pelo titular do projeto e por sua esposa.

A arquitetura deverá permitir o cadastro de novas pessoas físicas e jurídicas, novos usuários e novos grupos financeiros futuramente.

### 1.3 Princípios do Produto

- Clareza e confiabilidade das informações.
- Separação entre finanças pessoais e empresariais.
- Centralização dos controles financeiros.
- Rastreabilidade das movimentações.
- Facilidade de utilização no dia a dia.
- Automação de tarefas repetitivas.
- Segurança e privacidade dos dados.
- Flexibilidade para expansão futura.

## 2. O Problema

Atualmente, não existe um controle financeiro estruturado para a família ou para a empresa.

O titular assume as despesas familiares, mas não possui ferramentas para acompanhar adequadamente os gastos, identificar padrões e avaliar a capacidade de poupança.

A esposa realiza movimentações financeiras entre suas contas pessoais e empresariais, dificultando a separação de recursos e a compreensão do resultado real da empresa.

Na clínica, faltam controles estruturados de receitas, despesas, estoque, custos dos procedimentos, compras, fornecedores e lucratividade.

Também não existe acompanhamento consolidado do patrimônio, das dívidas, dos investimentos ou das metas financeiras.

### 2.1 Principais Problemas Identificados

1. Ausência de controle estruturado das receitas e despesas.
2. Falta de visibilidade do custo de vida familiar.
3. Movimentações entre PF e PJ sem classificação adequada.
4. Falta de controle de faturamento, custos e resultados empresariais.
5. Ausência de controle integrado de estoque e procedimentos.
6. Falta de gestão patrimonial.
7. Inexistência de orçamento e metas financeiras.
8. Dificuldade de projetar necessidades futuras de caixa.
9. Ausência de indicadores consolidados para apoiar decisões.

### 2.2 Impactos

Essas dificuldades prejudicam a previsibilidade financeira, a avaliação da lucratividade empresarial, a organização patrimonial e o planejamento de longo prazo.

## 3. Objetivos e Resultados Esperados

### 3.1 Objetivo Principal

Proporcionar clareza sobre a saúde financeira da família e da empresa por meio de um sistema centralizado de gestão, acompanhamento e planejamento financeiro.

### 3.2 Objetivos Específicos

- Conhecer receitas, despesas e saldos de cada entidade.
- Identificar o custo mensal da família.
- Separar e classificar movimentações entre PF e PJ.
- Acompanhar faturamento, custos e resultados da clínica.
- Controlar materiais e insumos utilizados nos procedimentos.
- Identificar a rentabilidade dos atendimentos.
- Acompanhar contas a pagar e receber.
- Controlar patrimônio, investimentos e dívidas.
- Estabelecer orçamentos e metas financeiras.
- Projetar o fluxo de caixa.
- Disponibilizar relatórios e indicadores confiáveis.
- Reduzir o trabalho manual por meio de importação de extratos bancários.

### 3.3 Critério Principal de Sucesso

O usuário deverá conseguir acessar o sistema e compreender claramente a situação financeira da família e da empresa, individualmente e de forma consolidada.

### 3.4 Indicadores de Sucesso

Os indicadores iniciais incluirão:

- Receitas e despesas por período.
- Resultado financeiro mensal.
- Saldos bancários e de caixa.
- Custo mensal familiar.
- Taxa de poupança.
- Evolução do patrimônio líquido.
- Faturamento e resultado empresarial.
- Custos e rentabilidade dos procedimentos.
- Valores a pagar e a receber.
- Cumprimento dos orçamentos e metas.

Os parâmetros quantitativos e critérios detalhados de aceitação serão definidos no PRD.

## 4. Escopo e Principais Funcionalidades

### 4.1 Gestão de Entidades Financeiras

O sistema deverá permitir cadastrar e administrar múltiplas pessoas físicas e jurídicas.

Cada entidade terá suas próprias contas, cartões, movimentações, obrigações, ativos e indicadores.

Também será possível criar grupos financeiros para consulta de informações consolidadas.

Usuários e entidades serão conceitos separados: usuários acessam o sistema, enquanto entidades representam as pessoas e empresas cujas finanças são controladas.

### 4.2 Gestão de Contas Bancárias e Cartões

O sistema deverá permitir cadastrar múltiplas contas e cartões vinculados às entidades financeiras.

Instituições utilizadas inicialmente:

- Nubank
- Caixa Econômica Federal
- Mercado Pago
- Bradesco
- Itaú
- Banco do Brasil

Deverá existir controle de saldos, movimentações, faturas, compras parceladas, vencimentos e pagamentos.

### 4.3 Importação e Conciliação Bancária

O sistema deverá importar extratos bancários por arquivos OFX, CSV e XLSX, conforme disponibilidade e compatibilidade com cada instituição.

A importação deverá oferecer:

- Identificação da conta de origem.
- Pré-visualização dos registros.
- Identificação de possíveis duplicidades.
- Sugestões de classificação.
- Identificação de transferências.
- Conciliação com lançamentos existentes.
- Revisão antes da confirmação.
- Histórico e rastreabilidade das importações.

Também deverá ser possível importar períodos anteriores para construir o histórico financeiro.

Os saldos iniciais e as datas das movimentações deverão ser considerados para preservar a consistência financeira.

### 4.4 Gestão de Receitas e Despesas

O sistema deverá controlar receitas e despesas de cada entidade, com categorias e subcategorias configuráveis.

As despesas poderão ser classificadas como pessoais, familiares ou empresariais.

O responsável pelo pagamento deverá ser identificado separadamente da finalidade da despesa.

Será possível trabalhar com lançamentos únicos, parcelados e recorrentes.

### 4.5 Transferências entre PF e PJ

O sistema deverá identificar e classificar transferências entre contas e entidades.

As movimentações entre PF e PJ poderão representar:

- Pró-labore.
- Distribuição de lucros.
- Aportes.
- Reembolsos.
- Transferências pendentes de classificação.

As operações deverão preservar origem, destino, finalidade e histórico.

Transferências não deverão ser contabilizadas automaticamente como novas receitas ou despesas operacionais.

A classificação contábil e tributária deverá seguir as orientações aplicáveis à empresa.

### 4.6 Gestão Empresarial da Clínica

O sistema deverá atender inicialmente uma clínica de Biomedicina Estética.

Os serviços oferecidos incluem:

- Limpeza de pele.
- Aplicação de botox.
- Microagulhamento.
- Preenchimento labial.
- Otomodelação.
- Extensão de cílios.
- PEIM.

A gestão empresarial deverá acompanhar faturamento, despesas, custos, fluxo de caixa, contas a receber, compras, estoque e resultado financeiro.

### 4.7 Controle de Atendimentos

Cada atendimento poderá conter:

- Identificação administrativa do cliente.
- Procedimento realizado.
- Data do atendimento.
- Valor cobrado.
- Descontos.
- Forma de pagamento.
- Parcelamento.
- Produtos utilizados.
- Quantidades consumidas.
- Custos relacionados.
- Resultado financeiro estimado.
- Situação da nota fiscal.

O módulo será voltado à gestão administrativa e financeira.

Prontuários clínicos, fotografias de pacientes e informações médicas sensíveis não fazem parte do escopo inicial.

### 4.8 Gestão de Estoque

O estoque deverá controlar:

- Cadastro de produtos e insumos.
- Fabricantes e fornecedores.
- Unidades de medida.
- Quantidades disponíveis.
- Custos de aquisição.
- Lotes e validade.
- Estoque mínimo.
- Entradas, saídas, perdas e ajustes.
- Valor financeiro do estoque.

A conclusão de um atendimento deverá permitir a baixa automática dos materiais efetivamente consumidos.

Os procedimentos poderão possuir listas padrão de materiais, com possibilidade de ajuste das quantidades utilizadas.

### 4.9 Compras e Fornecedores

O sistema deverá registrar compras, fornecedores, produtos, preços, descontos, fretes, recebimento de mercadorias e condições de pagamento.

A entrada dos produtos no estoque deverá ser associada ao recebimento físico.

As obrigações financeiras deverão ser geradas conforme as condições de pagamento estabelecidas.

Compras parceladas deverão manter a separação entre aquisição, obrigação financeira e pagamento efetivo.

### 4.10 Contas a Pagar e Receber

O sistema deverá controlar pagamentos e recebimentos previstos, pendentes, parciais, liquidados, vencidos e cancelados.

Serão consideradas inicialmente as seguintes formas de recebimento:

- Pix.
- Dinheiro.
- Cartão de débito.
- Cartão de crédito à vista.
- Cartão de crédito parcelado.

O sistema deverá permitir registrar taxas e prazos de recebimento.

Faturamento, contas a receber e dinheiro efetivamente recebido deverão permanecer claramente diferenciados.

### 4.11 Controle de Notas Fiscais

O sistema não emitirá notas fiscais.

Sua responsabilidade será acompanhar a situação fiscal dos atendimentos e permitir registrar informações sobre notas emitidas externamente.

Os estados previstos incluem:

- Pendente.
- Emitida.
- Cancelada.
- Não aplicável.

O controle fiscal deverá ser independente do recebimento financeiro.

Será possível registrar número, data, valor e documentos vinculados à nota fiscal.

As regras sobre obrigatoriedade e momento da emissão deverão ser validadas com o contador.

### 4.12 Gestão de Documentos

O sistema deverá permitir vincular documentos a receitas, despesas, compras, pagamentos, atendimentos e outras operações.

Entre os documentos previstos estão notas fiscais, recibos, comprovantes e arquivos administrativos.

O armazenamento deverá respeitar controles de acesso, segurança e privacidade.

### 4.13 Gestão Patrimonial

O sistema deverá controlar:

- Imóveis.
- Veículos.
- Investimentos.
- Saldos financeiros.
- Equipamentos e bens empresariais.
- Financiamentos.
- Empréstimos.
- Dívidas e obrigações.

Será possível acompanhar a evolução patrimonial por entidade e no contexto familiar.

O patrimônio líquido será calculado pela diferença entre ativos e passivos, respeitando os critérios de avaliação definidos.

A consolidação deverá evitar a duplicação de ativos e obrigações entre entidades.

### 4.14 Metas Financeiras

O sistema deverá permitir cadastrar objetivos financeiros pessoais, familiares e empresariais.

Cada meta poderá possuir valor-alvo, prazo, valor acumulado, aportes planejados e indicador de progresso.

Exemplos incluem reserva de emergência, investimentos, aquisição de bens, viagens e reserva de caixa da empresa.

### 4.15 Orçamento Financeiro

O sistema deverá permitir criar orçamentos por período, categoria e entidade.

Será possível comparar valores planejados e realizados, identificar excessos e acompanhar os limites disponíveis.

### 4.16 Projeção de Fluxo de Caixa

O sistema deverá apresentar projeções para 30, 60 e 90 dias.

As projeções considerarão saldos, receitas previstas, despesas recorrentes, parcelamentos e compromissos futuros.

Valores confirmados e estimados deverão ser diferenciados.

### 4.17 Dashboards

A aplicação terá uma interface única com seletor de contexto financeiro.

Os contextos iniciais serão:

- Visão Familiar.
- Titular PF.
- Esposa PF.
- Clínica PJ.

O dashboard deverá apresentar indicadores, gráficos, comparações e alertas conforme o contexto selecionado.

### 4.18 Relatórios

O sistema deverá disponibilizar relatórios de receitas, despesas, fluxo de caixa, patrimônio, metas, orçamento, estoque, procedimentos, contas a pagar e receber e resultados empresariais.

Deverá permitir exportação em PDF e Excel (XLSX).

Os demonstrativos empresariais terão finalidade gerencial e não substituirão documentos fiscais ou contábeis oficiais.

### 4.19 Notificações Internas

Os alertas serão apresentados exclusivamente dentro da aplicação.

Entre os eventos monitorados estarão vencimentos, atrasos, estoque mínimo, validade de produtos, notas fiscais pendentes, desvios orçamentários, metas e falhas de backup.

Não haverá envio de notificações por e-mail, SMS ou WhatsApp no escopo inicial.

### 4.20 Usuários, Segurança e Auditoria

O sistema deverá oferecer:

- Login individual por e-mail e senha.
- Suporte a autenticação em dois fatores.
- Recuperação de acesso.
- Gerenciamento de sessões.
- Controle de permissões.
- Registro de operações importantes.
- Auditoria de alterações financeiras.
- Histórico de importações e movimentações de estoque.

A auditoria deverá identificar o responsável, a operação, o momento, os registros afetados e os valores anteriores e posteriores quando aplicável.

### 4.21 Privacidade e Proteção de Dados

A aplicação deverá considerar os requisitos aplicáveis da LGPD.

Deverá permitir arquivamento de cadastros, anonimização quando apropriada, controle de acesso, rastreabilidade e políticas de retenção.

Informações necessárias para cumprimento de obrigações legais deverão ser preservadas conforme os requisitos aplicáveis.

## 5. Arquitetura e Abordagem Técnica

### 5.1 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS |
| Backend | NestJS |
| ORM | Prisma |
| Banco de dados | PostgreSQL |
| Comunicação | API REST |
| Infraestrutura | Docker e Docker Compose |
| Arquitetura | Monólito modular |
| Organização | Monorepo |

### 5.2 Princípios Arquiteturais

- Separação entre frontend, backend e persistência.
- Organização modular por domínio de negócio.
- Regras financeiras centralizadas e testáveis.
- Validação de dados e permissões no backend.
- Migrações versionadas do banco de dados.
- Precisão decimal para valores monetários.
- Rastreabilidade das operações financeiras.
- Independência de provedores de nuvem.
- Configuração por variáveis de ambiente.

### 5.3 Implantação

O sistema será desenvolvido para funcionar na nuvem ou em servidor local.

Apenas um ambiente estará ativo para utilização em cada momento.

Não haverá sincronização automática entre instalações.

A migração entre ambientes será realizada por meio de procedimentos controlados de backup, transferência e restauração.

A infraestrutura definitiva será escolhida após a conclusão do desenvolvimento.

### 5.4 Interface e Navegação

O sistema será uma aplicação web responsiva, acessível por computador, tablet ou smartphone.

A navegação será organizada por módulos, com um seletor de contexto financeiro.

As funcionalidades disponíveis e as informações apresentadas dependerão do contexto selecionado e das permissões do usuário.

### 5.5 Internacionalização

A configuração inicial será:

- Idioma: português do Brasil.
- Moeda: BRL.
- Formatação regional: pt-BR.
- Fuso horário padrão: America/Sao_Paulo.

A arquitetura deverá permitir expansão futura para outros idiomas e moedas.

A conversão cambial automática não faz parte do escopo inicial.

## 6. Dependências, Restrições e Riscos

### 6.1 Desenvolvimento

O projeto será desenvolvido por uma única pessoa, com assistência de ferramentas de IA.

A implementação utilizará o repositório existente:

https://github.com/JulianoRamos/finance

A estrutura de documentação e os processos de desenvolvimento do repositório serão aproveitados.

As referências específicas ao projeto anterior, iGlob.ai, deverão ser substituídas pelo novo contexto financeiro.

### 6.2 Estratégia de Entrega

O objetivo é desenvolver todas as funcionalidades definidas antes de colocar a aplicação em produção.

O trabalho deverá ocorrer de forma modular, com integração e testes contínuos.

O desenvolvimento completo não elimina a necessidade de validações intermediárias.

### 6.3 Backup e Recuperação

O sistema deverá oferecer:

- Backups automáticos diários.
- Backups manuais.
- Criptografia dos arquivos.
- Retenção configurável.
- Possibilidade de armazenamento externo.
- Restauração dos dados.
- Verificação de integridade.
- Histórico e alertas de falha.

Os procedimentos de restauração deverão ser testados antes da entrada em produção.

### 6.4 Dependências Externas

O projeto poderá depender de:

- Arquivos disponibilizados pelas instituições financeiras.
- Orientações contábeis e fiscais aplicáveis à empresa.
- Definição posterior da infraestrutura definitiva.
- Ferramentas de desenvolvimento e execução.
- Validação das regras de negócio com dados reais.

### 6.5 Principais Riscos

**Complexidade do escopo:** o sistema reúne diversos domínios financeiros e empresariais, exigindo boa organização modular.

**Integridade financeira:** erros de cálculo, duplicação ou classificação podem comprometer saldos, resultados e relatórios.

**Conciliação bancária:** arquivos de diferentes instituições podem possuir estruturas e comportamentos distintos.

**Separação entre PF e PJ:** classificações incorretas podem distorcer o resultado empresarial e a visão familiar.

**Estoque:** erros de baixa, lote ou custo podem prejudicar os indicadores de rentabilidade.

**Segurança e privacidade:** informações financeiras e dados pessoais exigem controles adequados.

**Desenvolvimento individual:** a amplitude do projeto exige documentação, testes automatizados e controle de mudanças.

### 6.6 Mitigação dos Riscos

- Desenvolvimento modular.
- Regras de negócio documentadas.
- Testes automatizados.
- Validação das operações financeiras.
- Revisão das alterações assistidas por IA.
- Auditoria e rastreabilidade.
- Backups e testes de restauração.
- Homologação antes da produção.

## 7. Fora do Escopo Inicial

Não fazem parte do escopo inicial:

- Emissão ou transmissão de notas fiscais.
- Sistema completo de prontuários clínicos.
- Armazenamento de fotografias clínicas e dados médicos sensíveis.
- Aplicativos nativos para Android ou iOS.
- Sincronização entre instalações locais e em nuvem.
- Integrações bancárias automáticas em tempo real.
- Envio de notificações por canais externos.
- Conversão cambial automática.
- Operação efetiva com múltiplas moedas.
- Substituição de serviços contábeis e fiscais oficiais.

## 8. Observações Finais e Próximos Passos

### 8.1 Estado Atual

O projeto encontra-se na fase de definição e consolidação do contexto.

Foram identificados os problemas, objetivos, principais funcionalidades, tecnologias, estratégia de implantação e restrições operacionais.

O nome comercial permanece em aberto.

### 8.2 Documentação Complementar

O Documento de Contexto servirá como referência para a elaboração de:

1. PRD — Documento de Requisitos do Produto.
2. Regras de negócio detalhadas.
3. Modelo conceitual e lógico de dados.
4. ADRs — Registros de Decisões Arquiteturais.
5. Especificações técnicas dos módulos.
6. Critérios de aceitação e estratégia de testes.
7. Plano de implementação.
8. Orientações para desenvolvimento assistido por IA.

### 8.3 Próximas Ações

- Adaptar a documentação existente no repositório ao novo projeto.
- Substituir as referências ao iGlob.ai.
- Elaborar o PRD com base neste documento.
- Formalizar as decisões de arquitetura.
- Detalhar regras financeiras e empresariais.
- Definir o modelo de dados.
- Especificar os módulos e suas dependências.
- Estabelecer a sequência de implementação.
- Implementar, integrar, testar e homologar o sistema completo.
- Definir a infraestrutura de produção.
- Realizar a implantação definitiva.

### 8.4 Diretriz Final

O sistema deverá priorizar a confiabilidade dos dados e a clareza dos indicadores.

A principal finalidade não será apenas registrar movimentações financeiras, mas transformar essas informações em uma visão compreensível da saúde financeira familiar e empresarial, apoiando a organização, o planejamento e a tomada de decisões.

---

**Fim do Documento de Contexto — Versão 1.0**
