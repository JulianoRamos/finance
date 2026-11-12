# Design system

Este documento é o dono da linguagem visual do finance: os tokens, os componentes, os estados de interação, o comportamento responsivo, a acessibilidade, o formato dos textos e números, o fluxo de trabalho com o Claude Design e a validação visual que a definição de pronto do `AGENTS.md` da raiz pede. Como cada componente é escrito em código fica no `AGENTS.md` da `web`.

## 1. Princípios

A linguagem parte do sistema Geist, com tinta quase preta sobre fundo quase branco e pouca coisa disputando atenção, adaptada a um aplicativo financeiro de uso diário.

- **Os números são o protagonista.** A interface é uma folha neutra, e a cor fica para o que significa algo: um valor que entra, uma parcela vencida, um alerta.
- **Uma tinta só.** Títulos, texto, o botão principal e as bordas saem da mesma escala de cinzas. A cor de destaque aparece só em links, foco e seleção.
- **Borda antes de sombra.** Cartões, campos e tabelas se separam por uma linha de 1px. A sombra é reservada ao que flutua: menus, diálogos e avisos.
- **Densidade com respiro.** Tabelas compactas e alinhadas, dentro de páginas com margens generosas.
- **Cor nunca sozinha.** Todo significado que a cor carrega também vem num sinal, num texto ou num ícone.
- **Sem decoração.** Não há gradiente, ilustração nem fotografia. A identidade vem da tipografia, do alinhamento e do silêncio.

## 2. Tokens

Os tokens viram variáveis CSS no `@theme` do Tailwind da `web`, com os mesmos nomes. Nenhum componente usa um valor de cor, tamanho, espaço, raio ou sombra fora desta seção.

### 2.1 Cores

Cada token tem um valor no tema claro e outro no escuro. O tema segue a preferência do sistema, e o usuário pode escolher claro, escuro ou sistema; a escolha fica num cookie, para a página já chegar no tema certo.

**Superfícies e texto**

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `canvas` | `#fafafa` | `#0a0a0a` | Fundo da página |
| `surface` | `#ffffff` | `#111111` | Cartões, campos, tabelas, menus, diálogos |
| `surface-subtle` | `#f2f2f2` | `#1a1a1a` | Linha em foco na tabela, área recuada, cabeçalho de tabela |
| `hairline` | `#ebebeb` | `#2e2e2e` | Toda borda e divisória |
| `hairline-strong` | `#d4d4d4` | `#454545` | Borda de cartão e de linha ao passar o ponteiro |
| `field-border` | `#8a8a8a` | `#6e6e6e` | Borda de campo, caixa de seleção, rádio e chave, com contraste de 3:1 |
| `ink` | `#171717` | `#ededed` | Títulos, valores, texto de destaque |
| `body` | `#4d4d4d` | `#a1a1a1` | Texto corrido, rótulos, navegação |
| `mute` | `#6b6b6b` | `#8f8f8f` | Legendas, metadados, texto auxiliar |
| `faint` | `#a1a1a1` | `#5c5c5c` | Placeholder e desabilitado. Nunca para texto que precisa ser lido |

**Ação e destaque**

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `primary` | `#171717` | `#ededed` | Fundo do botão principal |
| `on-primary` | `#ffffff` | `#0a0a0a` | Texto sobre `primary` |
| `primary-hover` | `#383838` | `#cccccc` | Botão principal ao passar o ponteiro |
| `accent` | `#0070f3` | `#3291ff` | Anel de foco, seleção, indicador da aba ativa |
| `link` | `#0761d1` | `#52a8ff` | Texto de link |
| `accent-soft` | `#d3e5ff` | `#0f2747` | Fundo de item selecionado, selo informativo |

**Significado**

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `positive` | `#107d32` | `#62c073` | Valor que entra, situação liquidada, emitida |
| `positive-soft` | `#e6f4ea` | `#0f2e1a` | Fundo de selo positivo |
| `negative` | `#c50000` | `#ff6166` | Saldo negativo, vencida, erro, ação destrutiva |
| `negative-strong` | `#ee0000` | `#d81f26` | Ícone e borda de erro, fundo do botão destrutivo |
| `negative-soft` | `#ffe8e8` | `#3a1214` | Fundo de selo e de aviso de erro |
| `warning` | `#ab570a` | `#ffb224` | Texto de atenção: parcial, pendente, a classificar |
| `warning-strong` | `#f5a623` | `#f5a623` | Ícone e borda de atenção |
| `warning-soft` | `#ffefcf` | `#3a2a0a` | Fundo de selo e de aviso de atenção |

Os tokens de texto (`ink`, `body`, `mute`, `link`, `positive`, `negative`, `warning`) têm contraste de ao menos 4,5:1 sobre `canvas`, `surface` e `surface-subtle`, e sobre o fundo `-soft` do mesmo significado, no tema deles. O branco sobre `negative-strong` também passa de 4,5:1. Os outros tokens `-strong` não são usados em texto. Quem muda uma cor confere de novo esses pares.

**Gráficos**

| Token | Claro | Escuro |
| --- | --- | --- |
| `chart-1` | `#0070f3` | `#3291ff` |
| `chart-2` | `#7928ca` | `#a970ff` |
| `chart-3` | `#0e9f8e` | `#3fcfb8` |
| `chart-4` | `#e5800b` | `#ffa94d` |
| `chart-5` | `#eb367f` | `#ff6aa6` |
| `chart-outros` | `#a1a1a1` | `#5c5c5c` |

Um gráfico tem no máximo cinco séries com cor, e o resto vira "Outros". Receitas contra despesas usam `positive` e `ink`, e não as cores categóricas.

### 2.2 Tipografia

**Geist Sans** em tudo, e **Geist Mono** só em códigos e identificadores (como a chave de um lançamento importado) e nos rótulos de seção em maiúsculas. As duas vêm do pacote `geist`, pelo `next/font`, com Arial e `ui-monospace` como substitutas.

| Token | Tamanho / altura | Peso | Espaçamento | Uso |
| --- | --- | --- | --- | --- |
| `kpi` | 32 / 40px | 600 | −1,28px | O número principal de um cartão de indicador |
| `heading-lg` | 24 / 32px | 600 | −0,96px | Título da página |
| `heading-md` | 20 / 28px | 600 | −0,4px | Título de seção e de diálogo |
| `heading-sm` | 16 / 24px | 600 | −0,32px | Título de cartão |
| `label` | 14 / 20px | 500 | −0,28px | Rótulos, botões, abas, cabeçalho de tabela |
| `body-lg` | 16 / 24px | 400 | 0 | Texto corrido e campos no celular |
| `body-md` | 14 / 20px | 400 | 0 | O texto padrão, células de tabela |
| `body-sm` | 12 / 16px | 400 | 0 | Legendas, metadados, mensagens de campo |
| `eyebrow` | 12 / 16px | 500 | 0,4px | Rótulo de seção, Geist Mono em maiúsculas |
| `mono` | 14 / 20px | 400 | 0 | Códigos e identificadores |

- **Números tabulares:** todo valor, quantidade, data e percentual usa `font-variant-numeric: tabular-nums`, para as colunas alinharem.
- **Pesos:** 400, 500 e 600, e nada mais. Sem itálico.
- **Campos no celular** usam `body-lg`, porque um campo com menos de 16px faz o navegador do iPhone dar zoom.

### 2.3 Espaço

Base de 4px.

| Token | Valor | Uso típico |
| --- | --- | --- |
| `space-1` | 4px | Ícone e texto, selo |
| `space-2` | 8px | Entre controles próximos, célula compacta |
| `space-3` | 12px | Campo, célula de tabela |
| `space-4` | 16px | Interior de cartão no celular, entre campos |
| `space-6` | 24px | Interior de cartão, entre grupos |
| `space-8` | 32px | Entre seções |
| `space-10` | 40px | Margem da página no desktop |
| `space-16` | 64px | Estado vazio |

### 2.4 Raio, borda e elevação

| Token | Valor | Uso |
| --- | --- | --- |
| `radius-sm` | 6px | Botões, campos, menus, selos quadrados |
| `radius-md` | 12px | Cartões, tabelas, avisos |
| `radius-lg` | 16px | Diálogos e a folha que sobe no celular |
| `radius-full` | 9999px | Selos de situação, avatar, botão de ícone redondo |

| Nível | Tratamento | Uso |
| --- | --- | --- |
| 0, plano | Borda de 1px `hairline`, sem sombra | Cartões, tabelas, campos |
| 1, sussurro | Borda e `0 1px 1px rgba(0,0,0,0.04)` | Cartão de indicador |
| 2, flutuante | Borda e `0 2px 2px rgba(0,0,0,0.04), 0 8px 16px -4px rgba(0,0,0,0.08)` | Menus, diálogos, avisos temporários |

No tema escuro, a sombra quase não aparece, então a borda faz o trabalho, e o nível 2 usa `surface-subtle` como fundo.

### 2.5 Movimento

- 150ms, `ease-out`, para cor, borda e fundo (passar o ponteiro, foco).
- 200ms, `ease-out`, para abrir menus, diálogos e a folha do celular; 150ms para fechar.
- Com `prefers-reduced-motion`, as transições de posição viram só opacidade.

## 3. Formato de textos e números

- **Idioma:** português do Brasil, com o vocabulário do `GLOSSARY.md`. Rótulos e títulos só com a primeira letra maiúscula.
- **Dinheiro:** `R$ 1.234,56`, sempre com centavos. Valor negativo com o sinal de menos tipográfico: `−R$ 1.234,56`. A formatação é a do `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **Cor de valor:** o que entra aparece em `positive`, com `+`; o que sai, em `ink`, com `−`. Só um saldo negativo fica em `negative`. Uma despesa não é vermelha: vermelho significa problema.
- **Datas:** `11/11/2026` em tabela e campo, `11 de nov.` quando o ano é óbvio, e `nov. de 2026` para mês. Instantes em `11/11/2026 14:32`.
- **Percentual:** `12,5%`, com uma casa decimal quando é taxa.
- **Quantidade de estoque:** até 4 casas decimais, sem zeros sobrando, com a unidade: `2,5 ml`.
- **Botões dizem a ação:** "Importar extrato", "Conciliar", "Registrar atendimento", e não "OK" nem "Enviar".
- **Mensagens de erro dizem o que fazer:** "O valor precisa ser maior que zero", e não "Valor inválido". Sem ponto de exclamação.
- **CPF e telefone** aparecem mascarados nas listas (`***.456.789-**`) e completos só no cadastro da cliente.

## 4. Componentes

A base é o shadcn/ui, sobre os primitivos do Radix, com o código no próprio repositório e os estilos trocados pelos tokens da seção 2. Os ícones são do Lucide, com 16px e traço de 1,5px, e 20px na navegação. Um componente novo, ou uma variante nova, entra primeiro neste documento.

### 4.1 Estrutura do app

- **Barra lateral** (desktop): 240px, fundo `canvas`, borda direita `hairline`, com os módulos agrupados (Visão geral, Dinheiro, Clínica, Patrimônio e planejamento, Configurações). Os itens da clínica só aparecem num contexto com uma empresa com a operação de clínica ligada. Pode recolher para só os ícones, com 64px.
- **Barra superior:** 56px, com o seletor de contexto financeiro à esquerda e, à direita, os alertas, o tema e o menu do usuário.
- **Seletor de contexto financeiro:** sempre visível. Mostra o nome da entidade ou do grupo e o tipo (PF, PJ, Grupo) num selo. Abre uma lista com busca, agrupada em Grupos, Pessoas físicas e Empresas. Trocar o contexto recarrega os dados da página atual, e nenhuma tela mostra dados sem dizer de quem são.
- **Navegação inferior** (celular): até quatro destinos e "Mais", com ícone e rótulo, e 64px mais a área segura.
- **Página:** título em `heading-lg`, ações da página à direita do título e, abaixo, os filtros. A largura máxima do conteúdo é de 1280px, salvo nas tabelas grandes, que ocupam a largura toda.

### 4.2 Botões

| Variante | Aparência | Uso |
| --- | --- | --- |
| Principal | Fundo `primary`, texto `on-primary` | A ação principal da tela. Uma por área |
| Secundário | Fundo `surface`, borda `hairline-strong`, texto `ink` | As outras ações |
| Fantasma | Sem fundo nem borda, texto `body` | Ações de linha e de barra de ferramentas |
| Destrutivo | Fundo `negative-strong`, texto branco | Excluir, cancelar um registro. Sempre com confirmação |
| Ícone | Quadrado do tamanho do botão, ícone centralizado | Ações compactas, sempre com `aria-label` e dica |

- Tamanhos: 32px (padrão no desktop), 40px (formulário e celular) e 28px (dentro de tabela). No celular, a área de toque tem ao menos 44px.
- Raio `radius-sm`, texto `label`, espaço horizontal `space-3`.
- **Carregando:** o rótulo vira um indicador girando, a largura não muda, e o botão não aceita outro clique.

### 4.3 Campos de formulário

- **Campo de texto:** fundo `surface`, borda `field-border`, raio `radius-sm`, altura 36px (40px no celular), rótulo acima em `label`, ajuda e erro abaixo em `body-sm`.
- **Campo de valor:** prefixo `R$`, alinhado à direita, números tabulares e teclado numérico no celular. Aceita "1234,56" e "1.234,56", e formata ao sair do campo. Nunca guarda o valor como número de ponto flutuante: entrega a string decimal do contrato.
- **Campo de data:** digitação em `dd/mm/aaaa` com calendário ao lado. Atalhos "Hoje" e "Ontem" nos lançamentos.
- **Seleção e busca:** lista simples até 10 opções; acima disso, com busca. A categoria mostra a árvore, com o caminho do pai ("Casa › Energia").
- **Caixa de seleção, rádio e chave:** 16px, com rótulo clicável. A chave liga algo na hora, como a operação de clínica; a caixa vale ao salvar.
- **Envio de arquivo:** área tracejada com "Arraste o arquivo ou escolha", os formatos aceitos e o tamanho máximo, e a lista dos arquivos com o progresso.
- **Formulário:** uma coluna no celular e até duas no desktop. As ações ficam no fim, com a principal à direita no desktop, e fixas no rodapé no celular.

### 4.4 Exibição de dados

- **Valor:** o componente que aplica a seção 3 (sinal, cor, centavos, números tabulares). Nenhuma tela formata dinheiro por conta própria.
- **Tabela:** fundo `surface`, borda `hairline` e raio `radius-md` no contorno; cabeçalho em `label` `mute` sobre `surface-subtle`, fixo ao rolar; linhas de 40px (32px na versão compacta) com divisória `hairline`; números e valores alinhados à direita; a linha muda para `surface-subtle` ao passar o ponteiro; seleção com caixa na primeira coluna. Totais numa linha final em `label`. As listas paginam por "Carregar mais", seguindo o cursor do contrato.
- **Tabela no celular:** vira uma lista de itens, cada um com a descrição e o valor na primeira linha e os metadados (data, conta, categoria) na segunda.
- **Cartão:** fundo `surface`, borda `hairline`, raio `radius-md`, interior `space-6` (`space-4` no celular).
- **Cartão de indicador:** o rótulo em `label` `mute`, o número em `kpi` e, abaixo, a comparação com o período anterior em `body-sm`.
- **Selo de situação:** raio `radius-full`, texto `body-sm` com peso 500, fundo `-soft` e texto do significado:

| Situação | Selo |
| --- | --- |
| Prevista, cancelada fiscal, não aplicável | Neutro: `surface-subtle` e `body` |
| Parcial, pendente, a classificar | Atenção: `warning-soft` e `warning` |
| Liquidada, emitida, conciliada | Positivo: `positive-soft` e `positive` |
| Vencida, falha | Negativo: `negative-soft` e `negative` |
| Cancelada | Neutro, com o texto riscado |

- **Gráfico:** linhas de 2px, barras com raio de 2px no topo, grade em `hairline`, eixos em `body-sm` `mute`, e uma dica ao passar o ponteiro com o valor formatado. Todo gráfico tem a tabela dos dados acessível ao lado ou por um botão.

### 4.5 Retorno e sobreposições

- **Aviso na página:** faixa com borda e fundo `-soft` do significado, ícone, texto e, se houver, uma ação. Usado para alertas que pedem atenção na própria tela.
- **Aviso temporário:** no canto inferior direito (topo no celular), some em 5 segundos, e o de erro só ao fechar. Anunciado por `aria-live`.
- **Diálogo:** fundo `surface`, raio `radius-lg`, nível 2, largura máxima de 560px, fundo da página escurecido a 40%. Fecha com Esc e com o botão de fechar, e devolve o foco a quem o abriu. No celular, vira uma folha que sobe do rodapé.
- **Confirmação destrutiva:** diz o que vai acontecer e o que não volta, e o botão repete a ação ("Cancelar pacote"), em vez de "Sim".
- **Menu:** nível 2, raio `radius-sm`, itens de 32px, e o destrutivo por último, em `negative`.
- **Estado vazio:** ícone, uma frase do que falta e a ação que resolve ("Nenhuma conta ainda. Cadastrar conta").
- **Carregando:** blocos cinza (`surface-subtle`) no formato do conteúdo, e não um indicador girando no meio da página.
- **Erro de carregamento:** a área mostra o que falhou e um botão "Tentar de novo"; o resto da página continua funcionando.

### 4.6 Componentes do domínio

- **Seletor de período:** mês com setas de anterior e próximo e uma lista de meses; nas telas que pedem, um intervalo livre.
- **Prévia da importação:** a tabela das linhas do arquivo com um selo por linha (nova, duplicada, conciliada automaticamente, para revisar) e os totais por selo no topo.
- **Revisão da conciliação:** à esquerda a movimentação, à direita os candidatos, cada um com a diferença de data e de valor, e a ação de conciliar, criar um lançamento ou ignorar.
- **Árvore de categorias:** lista recuada, com recolher, arrastar para mudar o pai, e o total do mês por categoria quando há.

## 5. Estados de interação

Todo componente interativo define estes estados, e o protótipo os mostra quando são relevantes para a tela:

| Estado | Tratamento |
| --- | --- |
| Padrão | Como descrito no componente |
| Ponteiro em cima | Borda `hairline-strong` (no campo, `body`), ou fundo `surface-subtle` no fantasma e na linha de tabela, ou `primary-hover` no principal |
| Foco pelo teclado | Anel de 2px `accent` com 2px de afastamento, só com `:focus-visible` |
| Pressionado | Fundo um passo mais escuro que o do ponteiro |
| Selecionado | Fundo `accent-soft` e, nas abas e na navegação, indicador de 2px `accent` |
| Desabilitado | Texto `faint`, sem ponteiro, sem mudar no ponteiro em cima. Uma dica diz o porquê quando ele não é óbvio |
| Carregando | Seção 4.2 e 4.5 |
| Inválido | Borda `negative-strong`, mensagem em `negative` abaixo, `aria-invalid` e o foco no primeiro campo inválido ao enviar |
| Somente leitura | Sem borda de campo, texto `ink`, como um dado. Usado no lançamento criado por outro módulo |

## 6. Responsivo

| Faixa | Largura | O que muda |
| --- | --- | --- |
| Celular | até 767px | Navegação inferior, uma coluna, tabelas viram lista, diálogos viram folha, ação principal fixa no rodapé, margem `space-4` |
| Tablet | 768 a 1023px | Barra lateral recolhida em ícones, formulários de uma coluna, tabelas com as colunas secundárias escondidas |
| Desktop | 1024px em diante | Barra lateral inteira, formulários de até duas colunas, tabelas completas, margem `space-10` |

- **Prioridade por tarefa:** registrar um atendimento, um lançamento ou uma despesa e ver saldos e alertas são pensados primeiro para o celular. Importar, conciliar, rever categorias e ver relatórios são pensados primeiro para o desktop, e no celular funcionam, mas sem pressa de caber tudo.
- **O que some primeiro numa tabela estreita:** as colunas de metadado (categoria, conta, origem), nunca a descrição, a data e o valor.
- **Áreas seguras:** a navegação inferior e as ações fixas respeitam `env(safe-area-inset-bottom)`.

## 7. Acessibilidade

- WCAG 2.2, nível AA, nos dois temas.
- Contraste de 4,5:1 para texto e 3:1 para bordas de campo, ícones com significado e o anel de foco.
- Tudo funciona pelo teclado, na ordem visual, com o foco sempre visível. Os atalhos de teclado são extras, nunca o único caminho.
- Todo campo tem rótulo, e todo botão de ícone tem nome acessível.
- Significado nunca só pela cor: o sinal no valor, o texto no selo, o ícone no aviso.
- Tabelas usam cabeçalhos de tabela de verdade, e os gráficos têm a tabela dos dados.
- Avisos temporários e mudanças de contexto são anunciados por `aria-live`.

## 8. Fluxo com o Claude Design

Este documento é o dono dos tokens e dos componentes. O que está no Claude é uma cópia para desenhar, e o código é a implementação.

1. **Design system no Claude:** um artefato do tipo Design System, com os tokens e os componentes deste documento em visualizações navegáveis. Ele é refeito a partir deste documento sempre que um PR muda as seções 2 a 7, e não é editado direto.
2. **Protótipo:** cada tela é desenhada no Claude Design sobre esse design system, em pt-BR e com o vocabulário do glossário, nos dois temas e nas larguras de celular e desktop quando a tela muda entre elas, com os estados vazio, carregando e de erro quando a tela os tem.
3. **Publicação:** a tela é salva no repositório `JulianoRamos/finance-prototipo` como `<Tela>.dc.html`, na raiz, com o nome em PascalCase, sem acento (`Lancamentos`, `Conciliacao`, `AtendimentoNovo`), num commit que diz o que mudou.
4. **Uso nos tickets:** a spec e o ticket citam o repositório, o commit e o recorte de cada tela, como a "Referência visual" do `AGENTS.md` da raiz descreve.
5. **Mudança de linguagem:** se um protótipo precisa de um token, um componente ou uma variante que este documento não tem, ele entra aqui primeiro, num PR do finance; depois no design system do Claude; e só então no protótipo. O protótipo nunca é a fonte de um token.

## 9. Validação visual

Exigida pela definição de pronto em toda mudança de interface, e feita por quem fecha o ticket, antes do `full`:

1. **Subir e abrir:** com o ambiente no ar, abrir no navegador, pelo Playwright, cada tela que o ticket muda, com dados que exercitem a tela (incluindo um valor longo, como `R$ 1.234.567,89`, e uma descrição longa).
2. **Larguras e temas:** conferir em 390×844, 768×1024 e 1440×900, no tema claro e no escuro, e salvar as capturas na pasta do ticket, fora do Git.
3. **Contra a referência:** comparar com a cópia em `referencia/`, dentro do recorte do ticket: estrutura, hierarquia, textos, tokens e componentes. Uma diferença é corrigida ou justificada no corpo do PR.
4. **Estados:** conferir os estados da seção 5 que a tela tem, mais o vazio, o carregando, o erro de carregamento e os erros de validação.
5. **Teclado:** percorrer a tela pelo teclado, conferindo a ordem, o foco visível, o Esc nos diálogos e a volta do foco.
6. **Acessibilidade automática:** rodar o axe na tela, sem nenhuma violação séria ou crítica.
7. **Registro:** o corpo do PR traz uma seção "Validação visual" com as telas, as larguras e os temas conferidos, e as diferenças justificadas.
