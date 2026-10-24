# Dossiê · Fichas de Ordem Paranormal

Site para criar, evoluir e usar fichas de agentes de **Ordem Paranormal RPG**.

A ficha calcula sozinha o que as regras mandam: atributos, PV, PE, SAN, defesa, perícias, NEX e limites. Ela também rola os dados e acompanha o estado do agente durante a sessão.

Feito para os jogadores de uma mesa específica, cada um no próprio celular ou notebook.

> Ferramenta de fã, **não oficial**, para uso pessoal da mesa. Não é um serviço público e não deve ser redistribuída. Nenhum texto do livro de regras é reproduzido aqui.

## Como abrir

**Publicado:** <https://subtkkk.github.io/fichas-op/>

**No computador, a partir do código:** o site é estático, sem instalação nem build. Basta servir a pasta e abrir no navegador:

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000
```

Precisa de um navegador atual (Chrome, Edge, Safari ou Firefox recentes).

## O que dá para fazer

**Central e Arquivo**
- A Central mostra a última ficha usada, as atualizadas recentemente e a situação do arquivo neste navegador.
- O Arquivo lista todas as fichas, com busca, filtro por classe e ordenação.
- Cada ficha pode ser duplicada, exportada e excluída. A exclusão pede confirmação e ainda oferece **Desfazer**.
- **Baixar .md:** na página Agente, o botão "Baixar .md" gera um resumo legível da ficha em Markdown, pensado como guia para montar fichas físicas: identificação, atributos (só o valor total), vitais (máximo de PV, PE ou PD e SAN) com Defesa, Esquiva e Bloqueio e a conta de cada um, deslocamento, perícias (treinamento como "Treinado (+5)", "outros" e total), origem (descrição e poder), classe, trilha (só os marcos já liberados), habilidades e poderes agrupados por onde vêm (origem, trilha, progressão, outros), rituais, ataques, inventário, condições e biografia. As descrições do livro entram **só quando o texto está liberado nesta conta**; sem acesso, só nomes, números e o que você escreveu. É só para leitura (não se importa de volta; para isso use Exportar).
- Importar é por botão ou arrastando o `.json` para a página. Se a ficha já existir no navegador, dá para **Substituir** (com Desfazer) ou **Importar como nova**.
- O backup baixa todas as fichas de uma vez.

**A ficha**
- Identificação, origem, classe e trilha com progressão por NEX (ou estágio, no Sobrevivente). As fontes de origens e trilhas podem ser escolhidas por livro. Na trilha, cada habilidade é um tópico que abre a descrição do livro daquele NEX (com acesso; sem ele, abre o aviso de que o texto não está liberado). O bloco "Consultar outras trilhas" deixa ler as habilidades e as descrições por NEX de qualquer trilha de qualquer classe, sem escolhê-la (nada é salvo na ficha e nada entra na impressão).
- Atributos num mostrador com um d20 para cada um. Base, bônus e a distribuição de pontos (com "modo livre") ficam atrás de "Editar atributos". Na mesa, tocar no d20 rola o teste puro daquele atributo (com as condições que o afetam).
- Recursos (PV, PE, SAN) com o cálculo do máximo à vista e perda permanente de Sanidade.
- Defesa, reações, deslocamento e resistências a dano.
- Perícias numa linha só: ícones (somente treinada, carga, kit, concedida), nome, sigla do atributo (com uma seta para baixo quando o teste rola o menor dado), **grau** (botão com chevrons: um = Treinado, dois = Veterano, três = Expert; clique para trocar, só em "Editar perícias"; fora dela é só um indicador), **outros** bônus, **total** e rolar. A sigla do atributo é um botão discreto: clique nela para trocar o atributo da perícia (ou "Voltar ao padrão"); trocado, ela fica em destaque com um ponto. Na mesa, o grau aparece só como marcador (T, V ou E) e o campo "outros" some; grau, "outros" e Concedida mudam em "Editar perícias". Perícias que exigem kit (Crime, Enganação, Medicina, Tecnologia) sofrem −5 no bônus sem o kit delas no inventário; o kit limpa a penalidade (valor em `data/config.js`, `penalidadeSemKit`).
- Ataques, habilidades e poderes, rituais (com formas Discente e Verdadeira, DT, afinidade e custo de Medo), inventário com patente, crédito e carga, e biografia (retrato, aliados, rivais e diário).
- **Condições e estados:** faixa de Saúde (ileso, ferido, machucado, morrendo) e de Sanidade (sã, perturbada, enlouquecendo), sempre com texto e ícone; bloco de **Morrendo** com a contagem de turnos; cartões de condições com rodadas, "até o fim da cena" e nota; condição personalizada; **Passar rodada** e **Fim da cena**. As 35 condições do livro trazem o **texto do livro** e os efeitos que a ficha aplica sozinha (dados em perícias, atributos, ataques, Iniciativa, Percepção e Reflexos; Defesa, inclusive contra corpo a corpo e à distância; deslocamento; +1 PE do Alquebrado; resistência a dano do Petrificado). Segue a regra das *Clarificações de regras*: efeitos iguais não se acumulam (vale o mais severo), efeitos diferentes se somam. O que a ficha não calcula (ações, dano por rodada, testes de Vigor) aparece como lembrete no cartão. Os efeitos podem ser desligados em "Aplicar efeitos das condições" (os campos afetados ganham o selo **cond.**).
- **Descansar:** diálogo com a condição de descanso, Dormir ou Meditação e as quantias de PV, PE e SAN já sugeridas (editáveis). Nada limita o uso por interlúdio.
- **Biografia:** retrato (reduzido para 320 px e guardado no navegador), aparência, personalidade, histórico, objetivo, medos, aliados, rivais, anotações e **diário** com entradas dobráveis. Entram na exportação e na impressão (o diário só com "Incluir diário na impressão").
- **Verificações:** painel recolhível no topo da ficha com os avisos que não bloqueiam nada (atributos, pontos, graus, rituais, carga, PV acima do máximo…), com "Ir ao campo". O modo livre os esconde.
- **Visão de mesa:** perícias em uma linha, e ataques e rituais em resumo. No ritual, o resumo traz a identificação (execução, alcance, alvo…), a descrição e as formas Discente e Verdadeira, com botões que só rolam o dano ou a cura (mostram o resultado, sem mexer na ficha). "Editar" abre o formulário completo.
- **Habilidades automáticas:** a habilidade da origem entra sozinha em Habilidades e poderes ao escolher a origem (e troca se a origem mudar), e as da trilha entram ao alcançar o NEX de cada marco (a da versatilidade, a partir do NEX 50%). Elas ficam sem o botão Remover e saem sozinhas se a origem ou a trilha mudar ou o NEX cair abaixo do marco. Uma habilidade que você já tinha com a mesma fonte e nome é adotada, com o que você escreveu. Com acesso ao livro, a leitura mostra o texto dela.
- **Ajuste de vitais:** tocar em PV, PE ou SAN abre −5/−1/+1/+5, dano ou cura de uma quantia, e Desfazer. No celular, é uma gaveta.
- **Regras opcionais** (texto discreto "regras opcionais" no canto da faixa do agente; valem por ficha): a primeira é **Jogando sem Sanidade** (*Sobrevivendo ao Horror*). Ligada, os PE e a SAN viram os **Pontos de Determinação (PD)**: o máximo vem da classe (Combatente 6 + PRE e 3 + PRE por NEX; Especialista 8 e 4; Ocultista 10 e 5; Sobrevivente 4 e 2 por estágio), tudo que gasta PE gasta PD, a perda de Sanidade dos rituais de Medo tira PD, dormir recupera só PV e a SAN some da tela (os valores ficam guardados). A ficha troca "PE" por "PD" nos textos; relaxar, prato favorito, dano mental das criaturas e Insanidade & Loucura ficam por conta da mesa.
- **NEX e Experiência** (regra opcional, em "regras opcionais"): o **nível** (1 a 20; 1 nível = 5% de NEX, nível 20 = 99%) passa a mandar na progressão (PV, PE ou PD, SAN, limite de PE por turno, DT, círculos, aumentos de atributo, graus, poderes e trilha) e o **NEX** vira só a exposição ao Outro Lado (começa em 0%, campo manual de 0 a 99, e segue valendo para afinidade e alterações). Ao ligar, o NEX que a ficha tinha vira o nível equivalente e a exposição começa em 0; ao desligar, o NEX volta ao equivalente do nível. O **NEX** aparece editável (− e +) ao lado do nível na faixa do agente. As **Alterações de NEX** são um bloco de consulta, fechado, na página Agente (resumo com as que estão em vigor, a próxima e as escolhas pendentes); aberto, traz o texto do livro por inteiro e aplica sozinho os efeitos: NEX 25% (Ocultismo sem treino, +2 se treinado, −5 numa perícia à escolha), NEX 35% (atributo somado ao PE e −5 numa perícia), as alterações do elemento conectado em 60%, 75% e 90% (Sangue, Morte, Conhecimento e Energia: bônus e penalidades de d20, ofuscado e cego, Forma Monstruosa, −3 PE na interação social de Morte) e o **sorteio do 1d6 de Energia** de cada cena (penalidade em Presença, Confuso, valores anotados com aviso quando um d20 repete, tique). Os rituais dessas alterações custam −1 PE (pelo nome do ritual). Dados de alteração somam com os das condições. Ficam por conta da mesa: o NEX que cada exposição rende, o ritual de conexão (Transcender) e os efeitos que dependem do mestre.
- Remover qualquer item da ficha mostra Desfazer por alguns segundos.
- "Termos da ficha" é um glossário recolhido com NEX, DT, graus e outros termos.
- As listas de escolha abrem um painel próprio, com as opções agrupadas por livro, busca nas listas longas e, no celular, uma gaveta.

**Rolagens**
- Página com o resultado de cada teste (todos os d20 e qual valeu), dano, crítico, modificador de dados, bônus extra, DT do alvo, fórmula livre (ex.: `2d6+3`) e histórico. O **último resultado** fica numa faixa com o total grande (no alto da coluna da direita no computador; presa abaixo dos vitais no celular) até a próxima rolagem ou até fechar, com o atalho **Detalhes**. Toda rolagem toca o som de **dados chacoalhando** e o **20 natural** tem um som diferente (um arpejo brilhante). Os sons são sintetizados na hora (Web Audio, sem arquivos) e podem ser desligados em **Aparência → Som das rolagens**.

**Aparência, celular e acessibilidade**
- **Aparência** (botão no cabeçalho): tema do site (Automático, Escuro, Claro e Alto contraste), tamanho do texto (14, 16, 18 e 20 px) e animações (Automático, Sim, Não). Fica nas preferências do navegador, nunca na ficha, e vale sem piscar ao recarregar.
- **A ficha em páginas, sem rolagem contínua.** No computador (a partir de 1280 px), três zonas ficam sempre à vista: a faixa do agente (identificação), a coluna de atributos + vitais + defesa + testes e a coluna de perícias. À direita, abas trocam as outras páginas: Combate (condições, defesa e ataques), Habilidades, Rituais, Inventário, Biografia, Agente (origem, classe, recursos, tema e exportar) e Rolagens. No celular e no tablet, cada página ocupa a tela (Resumo, Perícias, Combate, Habilidades, Rituais, Inventário, Biografia, Agente e Rolagens); o rodapé tem as setas e o **botão-índice**, que abre a folha com todas as páginas, e deslizar para os lados também troca de página. A faixa de vitais fica presa no topo. No papel, tudo sai junto, na ordem de sempre.
- Os diálogos de formulário ocupam a tela no celular. Alvos de toque têm 44 px.
- Tudo funciona só com o teclado (a tecla **?** abre a ajuda), com foco sempre visível. Leitores de tela anunciam rolagens, descanso, rodadas e alertas.

**Temas por ficha e impressão**
- Seis temas elementais por ficha: Neutro, Sangue, Morte, Conhecimento, Energia e Medo. Eles mudam só a aparência e nunca as regras. A escolha fica em **Aparência** (botão no cabeçalho), junto do tema do site, e vale para a ficha aberta. Na aba Agente, o botão "Tema" mostra o tema da ficha e abre essa janela.
- Cada tema pode ter um fundo animado próprio (por enquanto Conhecimento e Morte). O de **Morte** é feito de espirais pretas que nascem de um ponto e crescem para fora em linhas sinuosas e orgânicas: umas crescem pouco, outras muito, e depois somem de dentro para fora; quando uma chega perto de outra, ela desvia e cresce para o lado livre. No escuro o preto ganha uma névoa violeta e um fio de luz para aparecer. O de **Conhecimento** é uma tela de sigilos (só as letras da fonte "Sigilos de Conhecimento") que sobem, mudam, surgem e somem: dourado com brilho no tema escuro, tinta marrom no claro. Só roda com a ficha na tela; fica parado com "Animações: Não" (ou movimento reduzido do sistema) e some no alto contraste e na impressão.
- **Imprimir / PDF** gera a ficha completa num layout próprio para papel.

## Onde ficam os dados

Tudo fica no **próprio navegador** (`localStorage`). Não há servidor nem conta.

| Chave | Conteúdo |
|---|---|
| `op_idx_v2` | Índice das fichas (ordem, ficha aberta) |
| `op_f_<id>` | Cada ficha |
| `op_prefs` | Preferências: livros ativos, tema elemental de cada ficha e aparência do site (tema, tamanho do texto, animações, diário na impressão) |
| `op_ficha_atual` | Formato antigo, migrado automaticamente |

Isso tem algumas consequências:
- **Cada aparelho tem as suas fichas.** Para levar uma ficha do celular para o notebook, exporte e importe o `.json`.
- O tema elemental e a aparência do site ficam nas preferências do navegador e **não** vão no arquivo exportado.
- O retrato fica dentro da ficha (JPEG pequeno, até 400 mil caracteres). Se o armazenamento do navegador encher, o site avisa e manda exportar a ficha, sem perder o que está na memória. A Central mostra "Armazenamento usado".
- Sem `localStorage` (por exemplo, alguns modos privados), o site funciona só na memória. Ele avisa que não conseguiu salvar e oferece exportar um backup, e a Central marca o armazenamento como temporário.
- Arquivos exportados:
  - formato `op-ficha` (`ficha-<nome>.json`) ou `op-backup` (`fichas-backup-AAAA-MM-DD.json`);
  - versão do modelo 10 (fichas antigas abrem normalmente: a antiga "Descrição" vira "Biografia");
  - até 2 MB.
- A importação aceita versões anteriores e recusa as mais novas que o site.

## Regras e conteúdo

Os dados de jogo vêm do Livro de Regras v1.3, do Sobrevivendo ao Horror v1.2 e das aventuras AS-01 a AS-09 (`data/fontes.js`).

Os arquivos trazem **só nomes e números**. As descrições de habilidades, rituais e itens são digitadas pelo jogador.

## Estrutura

```
index.html          Página única: Central, Arquivo e Ficha (rotas #/central, #/arquivo, #/ficha/<id>)
css/
  style.css         Tela: design system, temas, componentes e responsivo
  print-base.css    Impressão: layout da ficha no papel
  print.css         Impressão: ajustes e o que fica fora do papel
js/
  main.js           Inicialização e ciclo de atualização
  state.js          Estado da ficha, modelo, migração e importação
  calc.js           Fórmulas da ficha
  dados.js          Motor de dados
  rolagens.js       Liga a ficha ao motor de dados
  fichas.js         Várias fichas no navegador (salvar, abrir, excluir, exportar)
  storage.js        Acesso ao localStorage (ou memória)
  prefs.js          Preferências do navegador (livros, tema elemental por ficha e aparência do site)
  ui.js             Interface da ficha
  ui-classe.js      Origem, classe, trilha e progressão
  ui-dossie.js      Capa do dossiê, vitais, ajuste de vital e tema
  ui-paginas.js     A ficha em páginas: abas (computador), índice e setas (celular), gesto de deslizar
  exportar-md.js   Resumo da ficha em Markdown
  ui-fichas.js      Central, Arquivo e operações com fichas
  ui-app.js         Navegação entre telas e avisos
  ui-seletor.js     Painel próprio das listas de escolha (no lugar do menu nativo)
  ui-condicoes.js   Condições, estados, Morrendo e diálogo Descansar
  ui-biografia.js   Retrato, aliados, rivais e diário
  ui-verificacoes.js  Painel de verificações
  ui-aparencia.js   Temas (do site e da ficha), tamanho do texto, animações, Sobre e ajuda de teclado
  ui-auditoria.js   Auditorias de layout, contraste e acessibilidade (para os testes)
  tests.js          Verificações das fórmulas
  atmosfera.js      Controlador dos fundos animados por tema (visibilidade, movimento reduzido, pausa)
  atmosfera-conhecimento.js  Fundo de Conhecimento: sigilos subindo
  atmosfera-morte.js  Fundo de Morte: espirais pretas crescendo e se desviando
  tests-etapa10.js  Verificações da Etapa 10
  tests-atmosfera.js  Verificações da simulação dos fundos animados
data/               Dados de jogo (classes, origens, trilhas, perícias, rituais, condições…) e temas
                    (temas.js = aparência do site; temas-ficha.js = temas elementais por ficha)
fonts/              Fontes locais (Cormorant Garamond e IBM Plex, licença OFL; Sigilos de Conhecimento, fonte do projeto)
```

## Desenvolvimento

- HTML, CSS e JavaScript puro, sem dependências e sem etapa de build: edite e recarregue.
- Os scripts compartilham o objeto global `OP`. O fluxo é `OP.state.atualizar` → `OP.calc` → `OP.ui.desenhar`. As telas ligam os campos por atributos (`data-campo`, `data-saida`, `data-passo`…).
- **Testes das fórmulas:** abra o site e rode `OP.runTests()` no console do navegador. O esperado é `{ total: 587, aprovados: 587, falhas: 0 }`. Em janela estreita (até 480 px) o teste de layout também confere a rolagem horizontal. As auditorias ficam em `OP.ui.auditarLayout()`, `auditarContraste(tema)`, `auditarAcessibilidade()`, `auditarTitulos()` e `auditarAlvosToque()`.
- **Cores:** o CSS da tela não tem cor fixa fora de variáveis. As paletas (`--cor-*`, em `#rrggbb`) ficam no começo do `css/style.css`: escuro em `:root`, claro em `[data-tema="claro"]` (e no `@media (prefers-color-scheme: light)` do modo Automático) e alto contraste em `[data-tema="contraste"]`. O `css/print.css` mantém fundo branco e texto preto, qualquer que seja o tema.
- **Compatibilidade:** fichas salvas e arquivos exportados de versões anteriores precisam continuar abrindo. Mudanças no modelo passam pela migração em `js/state.js`.

## Design

- [`PRODUCT.md`](PRODUCT.md): para quem é o site, onde é usado, restrições e princípios.
- [`DESIGN.md`](DESIGN.md): o sistema visual ("O Dossiê Vivo"), com tokens, tipografia, componentes e regras. O arquivo `.impeccable/design.json` complementa com escalas de tom, sombras e componentes de referência.
- As skills do [Impeccable](https://impeccable.style) estão em `.claude/skills/impeccable` para uso com o Claude Code (`/impeccable critique`, `/impeccable polish`…).

## Créditos

Ordem Paranormal RPG pertence aos seus criadores e editora. Este projeto não tem relação oficial com eles.

As fontes Cormorant Garamond e IBM Plex são distribuídas sob a SIL Open Font License (ver `fonts/`).

## Conta e conteúdo protegido (opcional)

Além do site estático, o repositório tem um Worker do Cloudflare (`worker/`, `wrangler.jsonc`): login com o Discord, códigos de acesso de uso único e um conteúdo que só aparece para quem o administrador liberou por alguns dias. O conteúdo fica no banco D1, nunca nos arquivos do site. Sem o Worker (arquivo aberto direto, outro servidor) o botão "Conta" some e a ficha funciona igual. Passo a passo e como testar: `worker/LEIA-ME.md`.

### O livro na ficha: textos, poderes, rituais e efeitos automáticos

Com o conteúdo liberado (origens, habilidades e rituais, três conteúdos separados), a ficha ganha:

- **Origem:** o seletor abre um painel grande; cada origem é um título com uma setinha que expande a descrição, o poder e as perícias.
- **Habilidades e rituais do livro:** "Escolher do livro…" lista poderes (de classe, gerais, paranormais; filtros por classe, por uso — Combate, Utilidade ou Ambos — e por tipo, com os paranormais em blocos coloridos: Conhecimento, Sangue, Energia, Morte, Transmissão e Intenção) e rituais, com o texto e o que a ficha faz sozinha. Adicionar um ritual já preenche círculo, elemento, execução, alcance, duração, resistência, custos das formas Discente e Verdadeira, dano e cura.
- **Efeitos automáticos** (página Habilidades): a ficha soma sozinha o que é fixo (por exemplo, PV por NEX de Sangue de Ferro, Defesa, perícias, treinamento, DT, carga, RD) e dá botões para o que é opcional: **preparar** um gasto para o próximo teste (Saber é Poder: −2 PE e +5), **ativar** um efeito (cena, rodadas ou manual) e **usar** um poder (cura, dano, perda de SAN). "Passar rodada" e "Fim da cena" encerram os efeitos ativos. Rituais conjurados ligam o efeito na forma usada.
- O que não é calculado (ações extras, efeitos em outros seres, escolhas do mestre, trocas de regra) fica só no texto do livro.

**Onde isso fica.** Nada do livro está no repositório nem no site público: nem texto, nem lista de poderes e rituais, nem os efeitos (números). O Worker entrega tudo isso só depois do login e do código, e o navegador guarda só em memória. O repositório tem apenas o motor (`js/calc.js`, `js/livro.js`, `js/ui-livro.js`), o formato dos efeitos (`data/efeitos.js`) e as ferramentas abaixo. A ficha guarda só a *chave* do item (por exemplo, `sangue-de-ferro`) e as escolhas.

**Gerar os arquivos para importar** (o txt do livro e a pasta de saída ficam fora do repositório):

```
node tools/gerar-conteudo.mjs livro.txt saida/ efeitos/
node tools/validar-efeitos.mjs efeitos/ saida/bruto.json
```

Isso cria `origens.json`, `habilidades.json` e `rituais.json` (cada texto traz, no fim, uma linha `§AUTO§` com a classificação e os efeitos). Importe os três em `admin.html` → *Conteúdo protegido*, com os nomes `origens`, `habilidades` e `rituais`, e inclua esses três nomes ao gerar os códigos de acesso. Os efeitos ficam em `efeitos/*.json` (formato em `data/efeitos.js`); corrigir um efeito é editar o JSON, gerar de novo e reimportar.
