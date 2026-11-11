# Consolidador de Patrimônio Global e Multiativos com IA

**Documento de Contexto do Projeto**

Versão 1.0 • 16 de outubro de 2026 • Contexto consolidado e validado

Documento de referência para orientar a definição de requisitos, a arquitetura detalhada e o planejamento de implementação do produto. As decisões confirmadas são distinguidas das propostas e pendências.

| **Campo**       | **Definição**                                                                                                 |
|-----------------|---------------------------------------------------------------------------------------------------------------|
| Natureza        | Plataforma web de gestão e inteligência patrimonial, com potencial de comercialização futura                  |
| Público inicial | Idealizador e sua estrutura patrimonial; expansão possível para investidores e famílias de média e alta renda |
| Estado atual    | Planejamento e definição do MVP; implementação ainda não descrita como iniciada                               |
| Base            | Sete etapas de contexto validadas e transcrição da reunião de descoberta                                      |

# 1. Contexto e visão geral

## 1.1 Cenário

Investidores com patrimônio distribuído entre países, moedas e tipos de ativos frequentemente utilizam diversas soluções para acompanhar investimentos financeiros, bens e participações empresariais. Os consolidadores disponíveis tendem a privilegiar ações, renda fixa e criptomoedas, enquanto outros componentes patrimoniais permanecem dispersos em registros manuais, planilhas ou serviços de consultoria.

No caso que originou o projeto, o acompanhamento envolve investimentos na bolsa americana, ativos mantidos em diferentes países, imóveis, participações societárias e carteiras familiares. Hoje, esse panorama depende da combinação de planilhas, ferramentas de mercado e consultorias.

## 1.2 Visão do produto

Criar uma plataforma web única para cadastrar, organizar, acompanhar e analisar o patrimônio global, com múltiplas carteiras, titulares, países e moedas. A solução deve oferecer uma visão consolidada e visões detalhadas por carteira, proprietário, classe de ativo ou localização.

A camada inteligente deverá apoiar o acompanhamento de indicadores e notícias e apresentar análises e alertas contextuais ao perfil do investidor, sem realizar operações financeiras de forma automática.

## 1.3 Público e posicionamento

- Primeira validação: utilização prática pelo idealizador, reproduzindo os controles hoje mantidos em planilhas e soluções externas.

- Público comercial potencial: investidores de média e alta renda, famílias com patrimônio diversificado e estruturas semelhantes a family offices.

- Visão internacional: operação com diversos países e moedas; recursos multilíngues; atenção inicial especial à bolsa americana.

# 2. O problema

## 2.1 Formulação central

A ausência de uma solução integrada, global e inteligente de gestão patrimonial obriga investidores com ativos diversificados a recorrer a múltiplas ferramentas e serviços, dificultando a consolidação das informações, o acompanhamento dos ativos e a identificação oportuna de riscos e oportunidades.

## 2.2 Dores principais

- Fragmentação: dados espalhados entre instituições, países, aplicações, planilhas e diferentes proprietários.

- Trabalho manual: atualização periódica de valores, fórmulas, posições e consultas a indicadores de mercado.

- Visão familiar insuficiente: dificuldade para visualizar patrimônio individual, compartilhado e pertencente a pessoas jurídicas.

- Monitoramento contínuo: acompanhar preço-alvo, mínima de 52 semanas, alocação, notícias e indicadores requer esforço regular.

- Dependência de serviços externos: consultorias são utilizadas para fornecer análises e informações que apoiam decisões.

## 2.3 Consequências

Maior tempo de acompanhamento, custos recorrentes, risco de inconsistências na consolidação e menor agilidade para reconhecer situações relevantes do mercado. A experiência fragmentada também dificulta a leitura do patrimônio total em uma moeda de referência.

# 3. Objetivos e resultados esperados

## 3.1 Objetivo geral

Desenvolver uma plataforma inteligente de gestão patrimonial global que centralize diferentes classes de ativos, carteiras, moedas e proprietários e forneça informações confiáveis para acompanhamento e apoio à decisão.

## 3.2 Objetivos específicos

- Centralizar ações, renda fixa, criptomoedas, imóveis, participações societárias, veículos e outros bens.

- Permitir carteiras individuais e familiares e visões consolidadas por proprietário, país e classe de ativo.

- Exibir valores nas moedas originais e convertê-los para a moeda de visualização selecionada.

- Reduzir a necessidade de planilhas, sobretudo no acompanhamento da bolsa americana.

- Evoluir para alertas e análises informativas de mercado, observando limites regulatórios.

- Validar a utilidade do MVP com o caso real antes de definir uma estratégia comercial.

## 3.3 Resultados esperados

| **Resultado**            | **Evidência de valor**                                                              |
|--------------------------|-------------------------------------------------------------------------------------|
| Visão unificada          | Consultar patrimônio total e detalhado sem alternar entre ferramentas               |
| Acompanhamento acionário | Visualizar posições, preços, metas e variações relevantes                           |
| Menor esforço manual     | Substituir controles recorrentes hoje realizados em planilhas                       |
| Gestão familiar          | Visualizar ativos individuais e compartilhados conforme permissões                  |
| Base extensível          | Adicionar indicadores, alertas e funcionalidades futuras sem reconstruir o cadastro |

## 3.4 Critérios de sucesso para validação

Os critérios a seguir são qualitativos e deverão ser transformados em metas quantitativas durante o planejamento do MVP; prazos e percentuais de desempenho não foram aprovados.

- Cadastrar e consultar cada classe de ativo incluída no MVP.

- Conferir somatórios patrimoniais contra uma base de referência, evitando dupla contagem.

- Validar conversões BRL/USD com taxa e data de referência identificáveis.

- Consultar carteiras separadas e consolidadas respeitando titularidade e acesso.

- Reproduzir os controles essenciais da planilha de ações atual.

- Realizar fluxos essenciais de cadastro e consulta com autonomia do usuário.

# 4. Escopo e principais funcionalidades

## 4.1 Núcleo do MVP 1

| **Módulo**           | **Capacidade prevista**                                                                                           |
|----------------------|-------------------------------------------------------------------------------------------------------------------|
| Usuários e perfis    | Cadastro, autenticação, onboarding e informações sobre objetivo, horizonte, liquidez e tolerância a risco         |
| Família e permissões | Convites, participação de membros e níveis de acesso; detalhamento final das permissões é requisito a especificar |
| Carteiras            | Criar, editar e agrupar carteiras por tipo, país ou finalidade; visões individuais e consolidadas                 |
| Cadastro de ativos   | Registro manual de ações, renda fixa, criptoativos, imóveis, sociedades, veículos e outros bens                   |
| Bolsa americana      | Operações, quantidade, custo médio, preço-alvo, intenção de compra/manutenção/venda e alocação desejada           |
| Painéis              | Patrimônio total; distribuição por classe, país, titular e carteira                                               |
| Multimoeda           | Moeda original, moeda padrão e troca rápida de moeda de visualização                                              |
| Preferências         | Idioma, fuso horário, visualização e privacidade dos valores exibidos                                             |

## 4.2 Informações específicas por classe

- Ações: identificador do papel, quantidade, compras/vendas, preço médio, preço de mercado, preço-alvo, intenção e percentuais da carteira.

- Imóveis: identificação, endereço/localização, metragem, titular, valor de mercado, moeda, gastos recorrentes e renda de aluguel, se houver.

- Participações societárias: empresa, país, atividade, titular, percentual de participação, valuation, critério/data de avaliação e informações essenciais.

- Veículos e outros bens: identificação, localização, titular, valor de mercado, moeda e custos periódicos estimados.

- Renda fixa: emissor/tipo, principal, moeda, remuneração e prazos aplicáveis.

- Criptoativos: ativo, quantidade, moeda de referência e valor atualizado quando disponível.

## 4.3 Funcionalidades inteligentes com prioridade ainda aberta

A inclusão exata dos recursos abaixo no MVP permanece pendente de priorização e viabilidade. A reunião sugeriu iniciar com poucos indicadores (aproximadamente 3 a 5) e ampliar depois.

- Monitoramento de indicadores de sentimento e mercado, com painel de sinais.

- Alertas de proximidade de preço-alvo e de mínima de 52 semanas.

- Notificações via WhatsApp, Telegram ou e-mail, após avaliação de custo e confiabilidade.

- Análises informativas por perfil, sem caracterização automática como recomendação de investimento.

## 4.4 Fora do MVP inicial

- Árvore patrimonial com múltiplos níveis societários e vínculos complexos de controle.

- Simulações sofisticadas de cenários e realocação patrimonial.

- Mentores virtuais configuráveis com estilos de análise distintos.

- Integração completa com corretoras ou sincronização automática de operações.

- Assistente conversacional avançado com voz e múltiplos canais.

- Execução automática de ordens de compra ou venda.

## 4.5 Regras transversais

O desenho do cadastro deverá ser internacional, evitando dependência obrigatória de identificadores exclusivos do Brasil. Ativos sem preço de mercado automatizado poderão receber valor informado manualmente, acompanhado de data de referência. O modelo de dados deverá ser preparado para titularidade por pessoas físicas e jurídicas, sem impor ao MVP a montagem de estruturas societárias completas.

A consolidação não poderá contar duas vezes o mesmo valor econômico quando existirem participações e ativos subjacentes; as regras específicas de eliminação de duplicidades devem ser detalhadas no PRD.

# 5. Arquitetura e abordagem

## 5.1 Decisões confirmadas

| **Componente**       | **Decisão**                         | **Status** |
|----------------------|-------------------------------------|------------|
| Frontend             | Next.js + React                     | Confirmado |
| Backend              | Python + FastAPI                    | Confirmado |
| Persistência         | PostgreSQL                          | Confirmado |
| Organização          | Monolito modular                    | Confirmado |
| Hospedagem           | Fornecedor/ambiente a definir       | Pendente   |
| APIs externas        | Fornecedores e limites a definir    | Pendente   |
| Agentes/notificações | Tecnologias e integrações a definir | Pendente   |

TypeScript foi mencionado como recomendação para o frontend, mas não consta como decisão explicitamente confirmada.

## 5.2 Organização lógica proposta

- Interface web: onboarding, cadastro, consulta de ativos, carteiras, painéis e preferências.

- API central: usuários, famílias, carteiras, ativos, movimentações, consolidação, moedas e acesso.

- Banco PostgreSQL: dados cadastrais, históricos, movimentações, avaliações e referências de preço/câmbio.

- Camada de integrações: abstração para provedores de preços, câmbio e indicadores, sem dependência de uma API específica.

- Camada de inteligência e notificações: processamento agendado, sinais e canais externos, adicionados conforme escopo.

## 5.3 Premissas arquiteturais

- Separar responsabilidades por módulos dentro do monolito, facilitando manutenção e possíveis extrações futuras.

- Rastrear origem, horário e moeda de cada dado externo utilizado em cálculos e visualizações.

- Proteger dados patrimoniais por autenticação, autorização, criptografia, backups e registros de auditoria.

- Manter cálculos financeiros reprodutíveis e histórico de movimentações/avaliações.

- Evitar acoplamento entre canais de notificação e as regras centrais do patrimônio.

## 5.4 Estratégia de implementação

Validar requisitos e fluxos antes da programação; estruturar modelo de dados; implementar cadastro, carteiras e consolidação; integrar preços/câmbio; adicionar indicadores e alertas aprovados. O detalhamento técnico deverá respeitar a priorização final do MVP.

# 6. Dependências, restrições e riscos

## 6.1 Dependências

- Recebimento da planilha de referência com dados fictícios e fórmulas utilizadas na rotina atual.

- Revisão do protótipo para confirmar telas, fluxos e campos mínimos por tipo de ativo.

- Seleção de provedores de cotação, câmbio e eventualmente criptomoedas.

- Seleção dos primeiros 3 a 5 indicadores e definição de regras de cálculo/alerta.

- Definição da infraestrutura, custos, equipe, orçamento e calendário.

- Especificação de titularidade, valuation e regras de consolidação patrimonial.

## 6.2 Restrições

- MVP concentrado em cadastros, carteira e consolidação; recursos avançados dependem de validação de prioridade.

- Cadastro inicial predominantemente manual, sem integração mandatória às corretoras.

- Sem execução de operações financeiras pela plataforma.

- Abordagem multigeográfica: não tornar os cadastros dependentes das regras de um único país.

- Custos e limitações de APIs e mensageria deverão orientar a implementação dos recursos automatizados.

## 6.3 Matriz inicial de riscos

| **Risco**                        | **Impacto estimado** | **Mitigação proposta**                                                     |
|----------------------------------|----------------------|----------------------------------------------------------------------------|
| APIs indisponíveis/limitadas     | Alto                 | Adaptadores de integração, monitoramento e alternativas de fornecedor      |
| Erros na consolidação            | Alto                 | Testes de cálculos, referência à planilha e regras contra duplicidade      |
| Vazamento de dados               | Alto                 | Controles de acesso, criptografia, auditoria e backups                     |
| Cadastro excessivamente complexo | Alto                 | Campos mínimos, fluxos progressivos e testes de usabilidade                |
| Análises de IA equivocadas       | Alto                 | Rastreabilidade, fontes, datas e limites claros entre dado e interpretação |
| Custos de notificações           | Médio                | Análise de fornecedores, quotas e preferências de frequência               |
| Internacionalização difícil      | Médio                | Modelo independente de país e moeda, testes com múltiplas jurisdições      |

## 6.4 Cuidados legais e de conformidade

Antes da comercialização, avaliar requisitos aplicáveis de privacidade e proteção de dados (incluindo LGPD), regras de mercado e limites entre análise informativa e recomendação personalizada de investimento, licenças de dados de fornecedores e exposição de informações patrimoniais em canais externos. Uma avaliação especializada será necessária para delimitar obrigações regulatórias conforme o serviço efetivamente oferecido.

# 7. Observações finais e próximos passos

## 7.1 Situação consolidada

As etapas de visão, problema, objetivos, escopo, arquitetura e riscos foram validadas. A arquitetura de referência possui quatro definições técnicas confirmadas: Next.js + React, Python + FastAPI, PostgreSQL e monolito modular. O produto segue em planejamento; pendências de integração, infraestrutura e orçamento permanecem abertas.

## 7.2 Plano de continuidade

1.  Produzir o PRD do MVP: requisitos funcionais e não funcionais, regras, atores, permissões e critérios de aceite.

2.  Analisar a planilha fictícia de investimentos e mapear fórmulas, métricas e alertas prioritários.

3.  Definir o modelo de dados de ativos, proprietários, carteiras, avaliações e movimentações.

4.  Escolher fornecedores de cotação e câmbio e validar limites, contratos e custos.

5.  Refinar o protótipo com foco nos cadastros simples e nas consultas consolidadas.

6.  Definir infraestrutura, ambiente de desenvolvimento, repositório, testes e plano de entregas.

7.  Implementar o núcleo do MVP, testar com dados reais ou representativos e revisar resultados para orientar as próximas fases.

## 7.3 Registro de pendências

| **Tema**       | **Definição pendente**                                                        |
|----------------|-------------------------------------------------------------------------------|
| Hospedagem     | Provedor, ambientes e forma de implantação                                    |
| Dados externos | APIs de ações, moedas, criptoativos e indicadores; SLA, custo e atualização   |
| Notificações   | Canal inicial e política de envio                                             |
| Inteligência   | Indicadores e alertas efetivamente incluídos no MVP                           |
| Gestão         | Cronograma, orçamento, equipe e responsabilidades                             |
| Detalhamento   | Critérios quantitativos de sucesso, permissões e regras financeiras completas |

## 7.4 Critério de encerramento do contexto

Este documento registra o entendimento de alto nível aprovado nas sete etapas e servirá de entrada para a elaboração do PRD e das especificações técnicas. As pendências são deliberadas: não devem ser interpretadas como requisitos já aprovados. Mudanças relevantes deverão ser registradas na próxima versão do documento.
