---
name: Dossiê
description: Fichas de Ordem Paranormal como um dossiê vivo, sóbrio e preciso, sobre tinta escura.
colors:
  ouro-de-arquivo: "#c9a45c"
  ouro-de-arquivo-claro: "#e3c58a"
  tinta-sobre-ouro: "#17120a"
  vermelho-de-carimbo: "#c94a40"
  tinta-0: "#050607"
  tinta-1: "#0a0b0d"
  tinta-2: "#0f1114"
  tinta-3: "#14171b"
  tinta-4: "#1b1e23"
  tinta-5: "#23272d"
  fundo-de-campo: "#0b0d10"
  papel: "#ece6da"
  papel-2: "#bab3a6"
  papel-3: "#938d82"
  papel-4: "#88827a"
  linha-1: "rgba(236, 230, 218, 0.07)"
  linha-2: "rgba(236, 230, 218, 0.12)"
  linha-3: "rgba(236, 230, 218, 0.22)"
  ok: "#82b38c"
  aviso: "#e2b354"
  erro: "#e86a5e"
  perigo-fundo: "#b8362d"
  pv: "#e65a50"
  pe: "#eb9b48"
  san: "#8d9ef2"
  el-sangue: "#e0473c"
  el-morte: "#a594c8"
  el-conhecimento: "#d9b35a"
  el-energia: "#b06bff"
  el-medo: "#e9e6df"
  tema-sangue: "#e5476f"
  tema-morte: "#ab9bd3"
  tema-conhecimento: "#e3c04e"
  tema-energia: "#b571ff"
  tema-energia-ciano: "#2fe0ff"
  tema-medo: "#ebe8e1"
typography:
  display:
    fontFamily: "Cormorant Garamond, Cormorant, Georgia, Times New Roman, serif"
    fontSize: "clamp(52px, 6.6vw, 98px)"
    fontWeight: 500
    lineHeight: 0.9
  headline:
    fontFamily: "Cormorant Garamond, Cormorant, Georgia, Times New Roman, serif"
    fontSize: "clamp(40px, 4.8vw, 66px)"
    fontWeight: 500
    lineHeight: 0.95
  title:
    fontFamily: "Cormorant Garamond, Cormorant, Georgia, Times New Roman, serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0.005em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "\"kern\", \"liga\""
  control:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.2em"
  numeral:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
rounded:
  raio-1: "3px"
  raio-2: "6px"
  raio-3: "10px"
  raio-4: "16px"
  pilula: "999px"
spacing:
  e1: "4px"
  e2: "8px"
  e3: "12px"
  e4: "16px"
  e5: "20px"
  e6: "24px"
  e8: "32px"
  e10: "40px"
  e12: "48px"
  e16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ouro-de-arquivo}"
    textColor: "{colors.tinta-sobre-ouro}"
    typography: "{typography.control}"
    rounded: "{rounded.raio-2}"
    height: "36px"
    padding: "0 14px"
  button-secondary:
    textColor: "{colors.papel}"
    typography: "{typography.control}"
    rounded: "{rounded.raio-2}"
    height: "36px"
    padding: "0 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.papel-2}"
    typography: "{typography.control}"
    rounded: "{rounded.raio-2}"
    height: "36px"
    padding: "0 14px"
  button-danger:
    backgroundColor: "{colors.perigo-fundo}"
    textColor: "#fff3f1"
    typography: "{typography.control}"
    rounded: "{rounded.raio-2}"
    height: "36px"
    padding: "0 14px"
  button-roll-damage:
    backgroundColor: "{colors.pv}"
    textColor: "#fff4f2"
    rounded: "{rounded.raio-2}"
    height: "36px"
    padding: "0 14px"
  input:
    backgroundColor: "{colors.fundo-de-campo}"
    textColor: "{colors.papel}"
    rounded: "{rounded.raio-1}"
    height: "34px"
    padding: "0 10px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.papel-3}"
    rounded: "{rounded.raio-2}"
    height: "38px"
    padding: "0 13px"
  nav-item-active:
    backgroundColor: "rgba(255, 255, 255, 0.055)"
    textColor: "{colors.papel}"
    rounded: "{rounded.raio-2}"
    height: "38px"
    padding: "0 13px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.papel-3}"
    rounded: "4px"
    height: "30px"
    padding: "0 12px"
  tab-active:
    backgroundColor: "{colors.ouro-de-arquivo}"
    textColor: "{colors.tinta-sobre-ouro}"
    rounded: "4px"
    height: "30px"
    padding: "0 12px"
  card-agent:
    backgroundColor: "{colors.tinta-2}"
    textColor: "{colors.papel}"
    rounded: "{rounded.raio-3}"
    padding: "18px 18px 14px"
  panel:
    backgroundColor: "{colors.tinta-3}"
    textColor: "{colors.papel}"
    rounded: "{rounded.raio-3}"
    padding: "16px 18px"
  chip-seal:
    backgroundColor: "transparent"
    rounded: "{rounded.raio-1}"
    padding: "2px 7px"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.vermelho-de-carimbo}"
    rounded: "3px"
    padding: "5px 9px 4px"
---

# Design System: Dossiê

## Overview

**Creative North Star: "O Dossiê Vivo"**

O site é o arquivo de papel da Ordem que ganhou tecnologia. A linguagem de documento (rótulos datilografados em caixa alta, códigos de registro, carimbos, etiquetas de pasta numeradas, monogramas) fica sobre telas de tinta escura, com controles precisos e números fáceis de ler. O papel dá a identidade; a tecnologia dá a precisão. Nenhum dos dois grita.

O clima é sóbrio e preciso. A atmosfera existe, mas como pano de fundo: luz ambiente parada, grão quase invisível (4,5% de opacidade) e escuridão profunda servem à leitura, nunca disputam com ela. A densidade é a de um instrumento: muita informação por tela, organizada por hierarquia tipográfica e por superfícies em camadas, não por cor. A cor aparece onde há ação ou estado.

A identidade tem dois registros. Fora da ficha (barra global, Central e Arquivo), vale a voz institucional: grafite e Ouro de Arquivo. Dentro da ficha, o jogador escolhe um dos cinco temas elementais (Sangue, Morte, Conhecimento, Energia, Medo) ou o neutro, e o tema troca só cor, luz e textura, mantendo a mesma estrutura. O neutro se chama "Neutro" (não "Arquivo", que é a biblioteca). No tema claro o papel não fica creme para todos: a variável `--claro` (0 no escuro e no alto contraste, 1 no claro) faz o elemento tingir o papel (`--papel-tom` e `--papel-forca` de cada tema), a luz e o fio da barra global. Só o Conhecimento segue amarelado, de propósito: Morte fica cinza-violeta, Energia violeta com ciano, Medo cinza frio e Sangue vermelho (matiz de vermelho, não de rosa; o rosado de antes era do carmesim com azul).

**Key Characteristics:**
- Tinta escura em camadas (`tinta-0` a `tinta-5`) com texto em tom de papel, nunca branco puro.
- Três vozes tipográficas: serifa editorial para nomes e títulos, sans para leitura e controles, mono para rótulos, códigos e números.
- Um único acento por contexto: Ouro de Arquivo na casca do app, a cor do tema dentro da ficha.
- Vidro fumê só nas superfícies estruturais; o conteúdo fica sobre tinta sólida.
- Cantos pequenos, de papel e metal.
- Controles de instrumento de campo: 36px no mouse, 44px no toque.

## Colors

Uma paleta de tinta e papel quase monocromática, com um acento metálico e cores funcionais que pertencem à regra do jogo.

### Primary
- **Ouro de Arquivo** (`ouro-de-arquivo`): a cor da identidade institucional. Marca o selo da barra global, o item ativo, o ponto do sobretítulo, a borda da ficha aberta no Arquivo e o anel de foco fora da ficha. Em botões principais, aparece em gradiente com o **Ouro de Arquivo Claro** (`ouro-de-arquivo-claro`), com texto em **Tinta sobre Ouro** (`tinta-sobre-ouro`). Dentro da ficha, o mesmo papel é ocupado pelo acento do tema (`--acento`); no tema neutro, o acento é o próprio Ouro de Arquivo.

### Secondary
- **Vermelho de Carimbo** (`vermelho-de-carimbo`): o carimbo do dossiê, levemente girado, e o acento secundário do tema neutro. É marca de documento, não cor de erro.

### Tertiary
Os acentos dos temas elementais, aplicados só dentro de `[data-tema]` (ficha, painel de rolagens e atmosfera):
- **Carmesim** (`tema-sangue`): luz avermelhada e orgânica. Puxado para o rosado de propósito, para não se confundir com o vermelho-alaranjado de PV.
- **Violeta Fechado** (`tema-morte`): violetas e cinzas frios, névoa.
- **Dourado Envelhecido** (`tema-conhecimento`): amarelo controlado sobre grafite, diagramas.
- **Violeta Elétrico** (`tema-energia`), com **Ciano** (`tema-energia-ciano`) como segundo acento.
- **Branco Pálido** (`tema-medo`): preto profundo e cinzas neutros, quase silêncio.

### Neutral
- **Tintas** (`tinta-0` a `tinta-5`): fundos e superfícies, do mais fundo ao mais alto. `tinta-1` é o fundo da página, `tinta-2` o dos cartões de agente, `tinta-3` o das superfícies da ficha.
- **Fundo de Campo** (`fundo-de-campo`): o interior de campos e passos numéricos, um tom abaixo da superfície em volta.
- **Papéis** (`papel` a `papel-4`): texto. `papel` para conteúdo e valores, `papel-2` para texto secundário, `papel-3` para rótulos e metadados, `papel-4` para o que é mais apagado (separadores, códigos, a conta dos máximos). Até `papel-4` lê em 4,5:1 sobre as superfícies. Os placeholders usam `#8a857c`.
- **Linhas** (`linha-1` a `linha-3`): bordas e divisórias translúcidas em tom de papel. `linha-1` separa, `linha-2` contorna controles, `linha-3` marca hover e caixas de seleção.
- **Estados** (`ok`, `aviso`, `erro`): validação e avisos, sempre acompanhados de texto ou ícone, com fundos translúcidos de 8% a 10%.

### Funcionais (iguais em todos os temas)
- **Recursos do agente**: PV (`pv`), PE (`pe`) e SAN (`san`) marcam barras, siglas e o filete lateral dos painéis de recurso.
- **Elementos** (`el-sangue`, `el-morte`, `el-conhecimento`, `el-energia`, `el-medo`): marcas dos rituais e do selo dos elementos na Central.

### Named Rules
**A Regra do Acento Único.** Cada contexto tem um acento só: Ouro de Arquivo na casca do app, a cor do tema dentro da ficha. Um segundo acento (`--acento-2`) aparece apenas em detalhes de textura e luz.

**A Regra dos Sinais Fixos.** PV, PE, SAN e as cores dos elementos são regra do jogo e não mudam com o tema. O jogador reconhece o recurso pela cor em qualquer tema.

**A Regra do Tema Só Visual.** Um tema troca tokens de cor, luz e textura dentro de `[data-tema]` e nada mais. Barra global, Central e Arquivo nunca mudam com ele.

### Temas do site (Etapa 10)

Os tokens acima descrevem o tema **Escuro**, que continua sendo o padrão de identidade. O site também tem **Claro**, **Alto contraste** e **Automático** (segue o sistema), escolhidos em "Aparência" e guardados no navegador. Tudo isso vive em variáveis `--cor-*` em `#rrggbb`, no começo do `css/style.css`: o CSS dos componentes não tem cor fixa, só `var(--…)` e `color-mix()` sobre elas. Os tokens desta página (tintas, papel, acento) são derivados dessas variáveis. Os temas elementais por ficha (`data-elemento`) mudam só o acento e a luz, e também têm uma versão por tema do site. O alto contraste usa fundos sólidos, bordas de 2 px e foco de 4 px. Nenhuma informação depende só de cor: estados têm texto e ícone, e avisos começam com "Aviso:".

## Typography

**Display Font:** Cormorant Garamond (com Georgia e serifas do sistema)
**Body Font:** IBM Plex Sans (com system-ui)
**Label/Mono Font:** IBM Plex Mono (com ui-monospace)

**Character:** uma serifa editorial de alto contraste para o que tem nome (agentes, seções, títulos), contra uma sans técnica e uma mono de máquina de escrever para o que é dado. O par lê como um dossiê datilografado com capa impressa.

### Hierarchy
- **Display** (500, `clamp(52px, 6.6vw, 98px)`, 0.9): o título da Central. Uma ocorrência por tela; o itálico da mesma família destaca uma palavra.
- **Headline** (500, `clamp(40px, 4.8vw, 66px)`, 0.95): o título do Arquivo. O nome do agente na capa do dossiê usa a mesma voz em 600, `clamp(38px, 4.4vw, 62px)`.
- **Title** (600, 31px, 1.05): títulos de seção da ficha, sempre precedidos pela etiqueta numerada da seção. Siglas de atributo e de recurso usam a mesma família em 26 a 27px.
- **Body** (400, 14.5px, 1.55): textos, descrições e campos (14px nos controles).
- **Control** (600, 13.5px): rótulos de botões e da navegação.
- **Label** (600, 11px, tracking 0.2em, caixa alta): rótulos de bloco, sobretítulos, códigos de registro, carimbos e selos. 11px é o piso de todo texto funcional; o tracking vai de 0.06em a 0.26em conforme o espaço.
- **Numeral** (mono 600, 14px): valores numéricos editáveis e leituras de instrumento.

### Named Rules
**A Regra das Três Vozes.** Serifa para o que tem nome, sans para ler e agir, mono para rotular e contar. Não trocar de voz dentro de um mesmo papel.

**A Regra do Rótulo de Arquivo.** Rótulo é sempre mono, caixa alta e espaçado, em `papel-3`, e nunca menor que 11px. Se precisa de destaque, ganha cor de acento, não tamanho.

**A Regra da Divisória.** Cada seção da ficha abre com a etiqueta de pasta numerada (o mesmo número do índice) e o título na voz da capa, de 30 a 42px conforme a largura da ficha. Há mais ar acima do título do que abaixo.

## Layout

A casca do app tem largura máxima de 1440px, com margem lateral de 32px (24px abaixo de 1200px e 16px no celular). O espaçamento segue a base 4 (`e1` a `e16`).

**Ficha no computador (≥ 1280px):** a ficha ocupa a tela inteira abaixo da barra global, sem rolagem da página; cada zona rola por dentro quando precisa. Grade de três colunas (`0,9fr · 1fr · 1,35fr`, no mínimo 300 · 330 · 400px) e duas linhas: a faixa do agente (identificação) cobre as duas primeiras colunas; embaixo, a coluna de **atributos + vitais + defesa/deslocamento/PE por turno + testes** e a coluna de **perícias**; a coluna da direita é um cartão com a barra de abas no alto e a página escolhida embaixo (Combate, Habilidades, Rituais, Inventário, Biografia, Agente, Rolagens). Os cartões das zonas usam o mesmo vidro e a borda `linha-2`; o título de seção cai para 21px e some a etiqueta numerada (o papel é que guarda o editorial). Na mesa, o mostrador dos atributos encolhe (290px; 256px em telas com menos de 840px de altura) para os vitais caberem logo abaixo.

**Até 1279px (tablet e celular):** uma página por vez. O rodapé (`dock`) tem as setas anterior/próxima e o botão-índice (nome da página + contador `n/9`); a folha do índice sobe de baixo com um cartão por página (número, nome, uma linha de descrição e o número de condições ativas em Combate). Deslizar mais de 90px para os lados, com o gesto claramente horizontal, troca de página; campos, diálogos e listas que rolam para o lado não disparam o gesto. A faixa de vitais fica presa no topo em todas as páginas (`--topo-fixo` soma a barra e a faixa). Avisos curtos (resultado de rolagem) ficam acima do rodapé.

**Até 719px (celular):** a barra global tem 56px e, na ficha, rola junto com a página; quem fica preso é a faixa de vitais, e cada vital da faixa é um botão que abre a gaveta de ajuste. Cada perícia é uma linha de 50px (nome com a sigla do atributo embaixo, grau, outros, total, rolar); em edição a caixa Concedida entra na linha da sigla. Até 380px, os ícones da navegação somem e o título da Central cai para 44px.

### Navigation
- **Barra global:** vidro fumê preso no topo (60px; 56px no celular), com o selo e o nome "Dossiê". Itens em sans 600 de 13.5px, `papel-3` em repouso. O item ativo ganha `papel`, fundo branco de 5,5% e borda `linha-1`. O contador do Arquivo é uma pílula.
- **Páginas da ficha:** no computador, abas no alto do cartão da direita (a marcada ganha fundo de acento e sublinhado; se não couberem, rolam e a marcada é trazida para a vista; setas, Home e End trocam de aba). No celular, o rodapé com setas e botão-índice, e a folha do índice.
- **Abas:** segmentos de 30px; a ativa ganha fundo de acento e texto em tinta.

### Trilho de vitais (signature)
O painel de instrumentos da ficha: vidro fumê com um halo do acento no canto. Mostra PV, SAN e PE com barra de medida, valor e botões de ±1 e os derivados. Cada vital indica o nível (ok, baixo, crítico, zero ou indefinido); zerado, a palavra "zerado" substitui a barra. No celular, vira a faixa presa no topo.

### Mostrador de atributos (signature)
Na mesa, os atributos são só números: um d20 facetado (SVG, facetas em cinco tons do acento) com o valor em Numeral e, embaixo, a sigla numa plaqueta de acento e o nome num rótulo escuro. Ficam nas pontas de um pentagrama sobre um mostrador de instrumento (anel, marcas de grau, trilho e o centro com "TESTE · ATR d20"). Base, bônus, pontos e avisos ficam atrás de "Editar atributos"; uma ficha nova, com pontos a distribuir, já abre na edição.

### Ajuste de vital (signature)
Tocar na sigla e no valor de um vital abre o ajuste: no desktop, uma janela; no celular, uma gaveta presa embaixo. Valor em mono de 56px na cor do vital, botões −5, −1, +1 e +5 de 48px, "Quantia" com Dano e Cura (Gastar e Recuperar em PE; Perder e Recuperar em SAN), a linha do último ajuste com Desfazer e, no rodapé, Defesa, Deslocamento e PE por turno.

### Cartões em resumo
Ataques e rituais na mesa: o nome lê como título (o campo continua editável), uma linha de resumo em mono (dano, crítico, tipo, alcance, munição; ou elemento, execução, alcance) e os botões de rolar ou conjurar. O botão "Editar" (contorno de 1px, `raio-2`) vira "Recolher" com borda de acento. Remover só aparece na edição.

### Regras opcionais
Um texto mono de 11px, apagado (`papel-3`, 70% de opacidade), no canto superior direito da faixa do agente: "regras opcionais" (com "· 1 ligada" em acento quando há regra ligada). Abre um diálogo `dialogo--regras` com uma linha por regra (caixa de seleção, nome e fonte), a tabela dos números e duas listas curtas: o que a ficha faz e o que fica por conta da mesa. A regra "Jogando sem Sanidade" esconde a SAN (`body[data-sem-sanidade="sim"]`) e troca PE por PD nos textos.

### Alterações de NEX
Seção da página Agente (antes dos recursos), só com a regra "NEX e Experiência" ligada, desenhada como o bloco "Progressão da classe": um `<details>` fechado, de consulta ("remissivo"), cujo resumo diz quantas alterações estão em vigor, a próxima (NEX e elemento) e as escolhas pendentes (em `aviso`). Aberto, de cima para baixo: o resumo de nível e NEX; as escolhas (elemento, perícias com −5, atributo do PE), cada uma só quando a alteração foi alcançada; o bloco da Energia (sorteio do 1d6, efeito e ações); e os cartões das alterações, cada um um `<details>` com o texto do livro por inteiro (narrativa em itálico, regra em texto normal) e uma caixa "O que a ficha aplica". Cartão ativo: borda de acento e "ativa"; cartão ainda não alcançado: esmaecido e fechado. Perícias e testes afetados ganham o selo "alt." (mesmo desenho do selo "cond."). O NEX (exposição) não mora no bloco: com a regra ligada, a faixa do agente mostra o nível e, ao lado dele, o NEX com os botões − e + (célula `campo--nex`; no cartão estreito do celular os dois dividem uma linha própria).

### Termos da ficha
Glossário recolhido logo depois da capa: o título em rótulo mono com uma seta desenhada em CSS, e a lista em duas colunas com o termo em acento e a explicação em `papel-2`.

### Capa do dossiê (signature)
A identificação do agente: faixa com carimbo, código de registro, indicador do tema da ficha (botão que abre a Aparência, onde o tema é escolhido), exportar e imprimir. Depois, o monograma no selo e o nome em serifa grande. É a única tela onde o carimbo aparece.

## Do's and Don'ts

### Do:
- **Do** usar `--acento` dentro da ficha e Ouro de Arquivo fora dela, nunca os dois disputando a mesma tela.
- **Do** manter PV, PE, SAN e as cores dos elementos idênticas em todos os temas.
- **Do** escrever rótulos em mono, caixa alta e espaçados, em `papel-3`.
- **Do** dar 44px aos controles quando o ponteiro é de toque (`pointer: coarse`).
- **Do** esmaecer pela cor (`papel-3`, `papel-4`), não por opacidade, todo texto que ainda precisa ser lido, para manter o contraste AA. Opacidade (45%) fica só para controles desabilitados.
- **Do** oferecer saída para cada preferência do sistema: movimento reduzido sem animações, transparência reduzida sem vidro e mais contraste com papéis e linhas mais fortes.

### Don't:
- **Don't** pôr `backdrop-filter` em cartões de conteúdo; vidro é só estrutura.
- **Don't** animar a atmosfera continuamente; luz e grão são estáticos. A única exceção são os fundos animados dos temas elementais (hoje Conhecimento, com sigilos subindo, e Morte, com espirais pretas crescendo, ambos em canvas): só com a ficha na tela, parado com movimento reduzido e escondido no alto contraste.
- **Don't** deixar o tema elemental alcançar a barra global, a Central ou o Arquivo.
- **Don't** usar raio maior que 10px em cartões nem a pílula fora de medidores, contadores e interruptores.
- **Don't** usar branco puro para texto; o tom mais claro é `papel`.
- **Don't** fazer um controle brilhar em repouso; o brilho parado é só de leitura de instrumento e identidade.
- **Don't** usar um rótulo menor que 11px.
