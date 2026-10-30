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
- **Baixar .md:** na página Agente, o botão "Baixar .md" gera um resumo legível da ficha em Markdown, pensado como guia para montar fichas físicas: identificação, atributos (um por linha), vitais (máximo de PV, PE ou PD e SAN, limite de PE ou PD por turno) com Defesa, Esquiva e Bloqueio e a conta de cada um, deslocamento, perícias (treinamento como "Treinado (+5)", "outros" e total, com símbolos para só treinada, penalidade de carga e kit), origem (descrição e poder), classe, trilha (só os marcos já liberados), habilidades e poderes agrupados por onde vêm (origem, trilha, progressão, outros), rituais e inventário. No inventário, cada item mostra tipo, **natureza**, **categoria** (base e efetiva, com as melhorias), **espaços**, quantidade, Defesa e penalidade das proteções, perícia do kit, a **descrição** que você escreveu e as **melhorias** (classe, elemento, quanto soma à categoria, avisos de incompatibilidade e a anotação de cada uma). Ataques, condições e biografia ficam de fora. As descrições do livro (regras do item e efeito das melhorias) entram **só quando o texto está liberado nesta conta**; sem acesso, só nomes, números e o que você escreveu. É só para leitura (não se importa de volta; para isso use Exportar).
- Importar é por botão ou arrastando o `.json` para a página. Se a ficha já existir no navegador, dá para **Substituir** (com Desfazer) ou **Importar como nova**.
- O backup baixa todas as fichas de uma vez.

**A ficha**
- Identificação, origem, classe e trilha com progressão por NEX (ou estágio, no Sobrevivente). As fontes de origens e trilhas podem ser escolhidas por livro. Na trilha, cada habilidade é um tópico que abre a descrição do livro daquele NEX (com acesso; sem ele, abre o aviso de que o texto não está liberado). Ao escolher a trilha, o seletor grande mostra, para cada trilha, as habilidades por NEX com a descrição (seta ao lado do nome, como na origem).
- Atributos num mostrador com um d20 para cada um. Base, bônus e a distribuição de pontos (com "modo livre") ficam numa janela que abre pelo **lápis** do título (um número no lápis avisa de pontos a distribuir ou a mais). Na mesa, tocar no d20 rola o teste puro daquele atributo (com as condições que o afetam).
- Recursos (PV, PE, SAN) com o cálculo do máximo à vista e perda permanente de Sanidade. Em "Bônus e cálculo" de cada recurso, **Atributo do cálculo** troca o atributo somado ao máximo, para as habilidades que calculam com outro (padrão: PV com VIG, PE ou PD com PRE, SAN sem atributo). Com "Jogando sem Sanidade" ligado, a SAN some e ficam PV e PD. A escolha vale por ficha e entra na exportação. O mesmo vale para a **DT de rituais**: o painel de DT (página Rituais) tem **Atributo da DT**, com PRE como padrão. A DT dos rituais e a de cada resistência aparecem no resumo em Markdown (Baixar .md).
- Defesa, reações, deslocamento e **RD** (redução de dano). Defesa, Esquiva e Bloqueio (nos vitais e no Resumo do celular) são botões: tocar abre a **explicação do cálculo** de cada um, parte por parte. Na Defesa, antes do resultado, o campo **Outros** soma à mão os bônus de habilidades que a ficha não calcula (é o mesmo "Outros" do painel de Defesa; vazio vale 0). O botão **RD** abre a lista de RD: "+ Adicionar RD", valor, de onde vem (opcional) e **Tipos de dano**, uma lista para marcar os tipos que aquela RD cobre (Ácido, Balístico, Conhecimento, Corte, Eletricidade, Energia, Fogo, Frio, Impacto, Medo, Mental, Morte, Perfuração, Químico e Sangue), com "Marcar todos" e "Limpar". As RD que cobrem o mesmo tipo se somam (o total por tipo aparece embaixo), a remoção tem Desfazer, e a lista entra no papel, na exportação e no resumo em Markdown. As fichas antigas, que tinham um número por tipo de dano, são convertidas sozinhas (tipos com o mesmo valor entram numa RD só).
- Perícias numa linha só: ícones (somente treinada, carga, kit, concedida), nome, sigla do atributo (com uma seta para baixo quando o teste rola o menor dado), **grau** (botão com chevrons: um = Treinado, dois = Veterano, três = Expert; clique para trocar, na janela do lápis; na tabela é só um indicador), **outros** bônus, **total** e rolar. A sigla do atributo é um botão discreto: clique nela para trocar o atributo da perícia (ou "Voltar ao padrão"); trocado, ela fica em destaque com um ponto. Na mesa, o grau aparece só como marcador (T, V ou E) e o campo "outros" some; grau, "outros" e Concedida mudam na janela do lápis ("Editar perícias"), que também tem os pontos de treinamento, os graus, o bônus de pontos e o modo livre (o número no lápis avisa de pontos a gastar ou a mais). Perícias que exigem kit (Crime, Enganação, Medicina, Tecnologia) sofrem −5 no bônus sem o kit delas no inventário; o kit limpa a penalidade (valor em `data/config.js`, `penalidadeSemKit`).
- Ataques, habilidades e poderes, rituais (com formas Discente e Verdadeira, DT, afinidade e custo de Medo), inventário com patente, crédito e carga, e biografia (retrato, aliados, rivais e diário).
- **Melhorias nos itens** (no formulário do item, ao tocar em "Editar"): cada item tem uma **natureza** (arma corpo a corpo, de arremesso, de disparo ou de fogo, munição, granada, proteção leve ou pesada, escudo, capacete, acessório, medicamento, item paranormal, veículo, drone…) e uma lista de **melhorias**: **modificações**, **maldições** e **regalias** (de veículo), do livro ou próprias. A categoria que conta para a patente é a **efetiva**: a base mais o que as melhorias somam (modificação +I cada; a 1ª maldição +II e as seguintes +I; regalia de veículo +I cada) e mais os **modificadores de categoria** do item (veja abaixo). A natureza decide o que o item aceita: modificação de arma de fogo não entra em arma corpo a corpo, regalia só em veículo, maldição só em arma, proteção, acessório ou medicamento (a tabela completa, gerada do compêndio, fica em `compatibilidade.md`). O que não combina, está repetido, em conflito (Reforçada × Discreta), com categoria acima de IV, maldição antes de Agente especial ou regalias demais para o veículo vira **aviso** em "Verificações" e no `.md`, sem bloquear nada. Com o conteúdo do livro liberado, a ficha também soma sozinha o que é fixo: espaços (Discreta −1, Blindada +1), Defesa da proteção equipada (Reforçada +2) e, nas armas ligadas a um ataque, o bônus de ataque, dano e margem de ameaça (Certeira, Cruel, Perigosa). Sem o livro, a conta de categoria continua valendo e o resto é manual.
- **Inventário em cartões.** Cada item é um cartão recolhido (nome e natureza, mais a categoria atual, os espaços e a quantidade); aberto, é só leitura: a conta da categoria, o texto do livro, a descrição, as melhorias (com o efeito) e os modificadores de categoria, e dois atalhos de jogo (quantidade e equipar a proteção). "Editar" abre o formulário (campos, natureza, melhorias e "Modificar categoria") e "Concluir" volta à leitura; item novo, sem nome, já abre em edição. **Modificar categoria** guarda poderes e habilidades que sobem ou baixam a categoria: cada linha tem um valor com sinal (−20 a +20) e a fonte (texto livre), quantas forem precisas. A categoria efetiva soma tudo e pode ficar abaixo de 0 (só 1 a 4 contam nos limites da patente; acima de IV gera aviso). A **faixa presa no topo** do Inventário mostra a patente à esquerda (texto que abre a janela com patente, Pontos de Prestígio e crédito) e, embaixo, um traço por categoria com um quadradinho por item permitido (cheio = usado; vermelho = passou do limite); à direita, a carga com uma barra fina (a janela tem a conta e o bônus de capacidade). No papel, o formulário sai completo, os modificadores viram uma linha de texto e a patente e a carga voltam a ser painéis.
- **Condições e estados:** faixa de Saúde (ileso, ferido, machucado, morrendo) e de Sanidade (sã, perturbada, enlouquecendo), sempre com texto e ícone; bloco de **Morrendo** com a contagem de turnos; cartões de condições com rodadas, "até o fim da cena" e nota; condição personalizada; **Passar rodada** e **Fim da cena**. As 35 condições do livro trazem o **texto do livro** e os efeitos que a ficha aplica sozinha (dados em perícias, atributos, ataques, Iniciativa, Percepção e Reflexos; Defesa, inclusive contra corpo a corpo e à distância; deslocamento; +1 PE do Alquebrado; resistência a dano do Petrificado). Segue a regra das *Clarificações de regras*: efeitos iguais não se acumulam (vale o mais severo), efeitos diferentes se somam. O que a ficha não calcula (ações, dano por rodada, testes de Vigor) aparece como lembrete no cartão. Os efeitos podem ser desligados em "Aplicar efeitos das condições" (os campos afetados ganham o selo **cond.**).
- **Descansar:** diálogo com a condição de descanso, Dormir ou Meditação e as quantias de PV, PE e SAN já sugeridas (editáveis). Nada limita o uso por interlúdio.
- **Biografia:** retrato (reduzido para 320 px e guardado no navegador), aparência, personalidade, histórico, objetivo, medos, aliados, rivais, anotações e **diário** com entradas dobráveis. Entram na exportação e na impressão (o diário só com "Incluir diário na impressão").
- **Verificações:** painel recolhível no topo da ficha com os avisos que não bloqueiam nada (atributos, pontos, graus, rituais, carga, PV acima do máximo…), com "Ir ao campo". O modo livre os esconde.
- **Visão de mesa:** perícias em uma linha, e ataques e rituais em resumo. No ritual, o resumo traz a identificação (execução, alcance, alvo…), a descrição e as formas Discente e Verdadeira, com botões que só rolam o dano ou a cura (mostram o resultado, sem mexer na ficha). "Editar" abre o formulário completo.
- **Habilidades automáticas:** a habilidade da origem entra sozinha em Habilidades e poderes ao escolher a origem (e troca se a origem mudar), as da classe entram ao alcançar o NEX de cada marco da progressão (Ataque especial, Eclético, Perito, Engenhosidade, Escolhido pelo Outro Lado, Empenho, Cicatrizado), e as da trilha entram ao alcançar o NEX de cada marco (a da versatilidade, a partir do NEX 50%). Elas ficam sem o botão Remover e saem sozinhas se a origem, a classe ou a trilha mudar ou o NEX cair abaixo do marco. Uma habilidade que você já tinha com a mesma fonte e nome é adotada, com o que você escreveu. Com acesso ao livro, a leitura mostra o texto dela.
- **Ajuste de vitais:** tocar em PV, PE ou SAN abre −5/−1/+1/+5, dano ou cura de uma quantia, e Desfazer. No celular, é uma gaveta.
- **Regras opcionais** (texto discreto "regras opcionais" no canto da faixa do agente; valem por ficha): a primeira é **Jogando sem Sanidade** (*Sobrevivendo ao Horror*). Ligada, os PE e a SAN viram os **Pontos de Determinação (PD)**: o máximo vem da classe (Combatente 6 + PRE e 3 + PRE por NEX; Especialista 8 e 4; Ocultista 10 e 5; Sobrevivente 4 e 2 por estágio), tudo que gasta PE gasta PD, a perda de Sanidade dos rituais de Medo tira PD, dormir recupera só PV e a SAN some da tela (os valores ficam guardados). A ficha troca "PE" por "PD" nos textos; relaxar, prato favorito, dano mental das criaturas e Insanidade & Loucura ficam por conta da mesa.
- **NEX e Experiência** (regra opcional, em "regras opcionais"): o **nível** (1 a 20; 1 nível = 5% de NEX, nível 20 = 99%) passa a mandar na progressão (PV, PE ou PD, SAN, limite de PE por turno, DT, círculos, aumentos de atributo, graus, poderes e trilha) e o **NEX** vira só a exposição ao Outro Lado (começa em 0%, campo manual de 0 a 99, e segue valendo para afinidade e alterações). Ao ligar, o NEX que a ficha tinha vira o nível equivalente e a exposição começa em 0; ao desligar, o NEX volta ao equivalente do nível. O **NEX** aparece editável (− e +) ao lado do nível na faixa do agente. As **Alterações de NEX** são um bloco de consulta, fechado, na página Agente (resumo com as que estão em vigor, a próxima e as escolhas pendentes); aberto, traz o texto do livro por inteiro e aplica sozinho os efeitos: NEX 25% (Ocultismo sem treino, +2 se treinado, −5 numa perícia à escolha), NEX 35% (atributo somado ao PE e −5 numa perícia), as alterações do elemento conectado em 60%, 75% e 90% (Sangue, Morte, Conhecimento e Energia: bônus e penalidades de d20, ofuscado e cego, Forma Monstruosa, −3 PE na interação social de Morte) e o **sorteio do 1d6 de Energia** de cada cena (penalidade em Presença, Confuso, valores anotados com aviso quando um d20 repete, tique). Os rituais dessas alterações custam −1 PE (pelo nome do ritual). Dados de alteração somam com os das condições. Ficam por conta da mesa: o NEX que cada exposição rende, o ritual de conexão (Transcender) e os efeitos que dependem do mestre.
- Remover qualquer item da ficha mostra Desfazer por alguns segundos.
- "Termos da ficha" é um glossário recolhido com NEX, DT, graus e outros termos.
- As listas de escolha abrem um painel próprio, com as opções agrupadas por livro, busca nas listas longas e, no celular, uma gaveta.

**Fichas na conta e compartilhar por link** (precisa do Worker e do login com o Discord; ver `worker/LEIA-ME.md`)
- **Salvar na conta:** com a conta conectada, cada ficha também fica guardada na conta (até 50, 1,5 MB cada). O navegador continua sendo a cópia de trabalho: tudo funciona sem rede e sem conta, e a sincronia acontece sozinha (2 s depois de mexer, ao voltar para a aba e a cada 15 s com a aba aberta, então a edição de um amigo por link chega em até 15 s). Em **Conta → Fichas na conta** dá para desligar e para sincronizar na hora. Na primeira vez, e se mudar de conta no mesmo navegador, a ficha pergunta antes de enviar as fichas daqui.
- **Nada se perde:** se a mesma ficha mudou aqui e na conta ao mesmo tempo, a versão da conta vira uma cópia "(da nuvem)" e a daqui segue como a ficha. Excluir uma ficha aqui apaga na conta (e vice-versa), desde que ela não tenha sido mexida do outro lado.
- **Compartilhar** (botão na página Agente): liga um link por ficha. **Só visualizar** (qualquer pessoa abre, sem conta, e nada muda) ou **Visualizar e editar** (quem abrir precisa entrar com o Discord; as mudanças vão para a ficha do dono). Dá para trocar o modo, copiar o link, **gerar um link novo** (o anterior para de funcionar) e desligar. Quem abre vê a ficha só na memória: nada é gravado no navegador dela, e a tela confere a cada 15 s se mudou algo. A faixa no alto tem "Salvar uma cópia" (vira uma ficha da própria pessoa) e "Sair".
- **Cuidado:** o link dá acesso à ficha inteira (biografia e diário também). O texto do livro continua só para quem tem o código de acesso, mesmo em ficha compartilhada.

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

Tudo fica no **próprio navegador** (`localStorage`). Servidor e conta são opcionais: com o Worker e o login com o Discord (ver abaixo), as fichas também são guardadas na conta e podem ser compartilhadas por link.

| Chave | Conteúdo |
|---|---|
| `op_idx_v2` | Índice das fichas (ordem, ficha aberta) |
| `op_f_<id>` | Cada ficha |
| `op_prefs` | Preferências: livros ativos, tema elemental de cada ficha e aparência do site (tema, tamanho do texto, animações, diário na impressão) |
| `op_nuvem` | Sincronia com a conta: o último estado em comum de cada ficha (versão e impressão digital), a chave "Salvar na conta" e de qual conta é |
| `op_ficha_atual` | Formato antigo, migrado automaticamente |

Isso tem algumas consequências:
- **Cada aparelho tem as suas fichas.** Sem conta, para levar uma ficha do celular para o notebook, exporte e importe o `.json`. Com a conta conectada e "Salvar minhas fichas na conta" ligado, elas aparecem sozinhas nos dois.
- O tema elemental e a aparência do site ficam nas preferências do navegador e **não** vão no arquivo exportado.
- O retrato fica dentro da ficha (JPEG pequeno, até 400 mil caracteres). Se o armazenamento do navegador encher, o site avisa e manda exportar a ficha, sem perder o que está na memória. A Central mostra "Armazenamento usado".
- Sem `localStorage` (por exemplo, alguns modos privados), o site funciona só na memória. Ele avisa que não conseguiu salvar e oferece exportar um backup, e a Central marca o armazenamento como temporário.
- Arquivos exportados:
  - formato `op-ficha` (`ficha-<nome>.json`) ou `op-backup` (`fichas-backup-AAAA-MM-DD.json`);
  - versão do modelo 12 (fichas antigas abrem normalmente: a antiga "Descrição" vira "Biografia");
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
  exportar-md.js   Resumo da ficha em Markdown (inclui o inventário com natureza, categoria, espaços e melhorias)
  ui-fichas.js      Central, Arquivo e operações com fichas
  ui-app.js         Navegação entre telas e avisos
  ui-seletor.js     Painel próprio das listas de escolha (no lugar do menu nativo)
  ui-condicoes.js   Condições, estados, Morrendo e diálogo Descansar
  ui-biografia.js   Retrato, aliados, rivais e diário
  ui-defesa.js      Defesa, Esquiva e Bloqueio (cálculo à vista) e a lista de RD por tipo de dano
  nuvem.js          Fichas na conta (sincronia) e link de compartilhamento (sem tela)
  ui-nuvem.js       Telas da nuvem: Compartilhar, Conta e a faixa da ficha de link
  ui-itens.js       Cartões dos itens do inventário (cabeçalho que abre e fecha, leitura e edição, melhorias e "Modificar categoria")
  ui-verificacoes.js  Painel de verificações
  ui-aparencia.js   Temas (do site e da ficha), tamanho do texto, animações, Sobre e ajuda de teclado
  ui-auditoria.js   Auditorias de layout, contraste e acessibilidade (para os testes)
  tests.js          Verificações das fórmulas
  atmosfera.js      Controlador dos fundos animados por tema (visibilidade, movimento reduzido, pausa)
  atmosfera-conhecimento.js  Fundo de Conhecimento: sigilos subindo
  atmosfera-morte.js  Fundo de Morte: espirais pretas crescendo e se desviando
  tests-etapa10.js  Verificações da Etapa 10
  tests-itens.js    Verificações das melhorias dos itens (categoria e modificadores de categoria, compatibilidade, avisos, Markdown)
  tests-atmosfera.js  Verificações da simulação dos fundos animados
data/               Dados de jogo (classes, origens, trilhas, perícias, rituais, condições, naturezas e classes de melhoria…) e temas
                    (temas.js = aparência do site; temas-ficha.js = temas elementais por ficha)
fonts/              Fontes locais (Cormorant Garamond e IBM Plex, licença OFL; Sigilos de Conhecimento, fonte do projeto)
```

## Desenvolvimento

- HTML, CSS e JavaScript puro, sem dependências e sem etapa de build: edite e recarregue.
- Os scripts compartilham o objeto global `OP`. O fluxo é `OP.state.atualizar` → `OP.calc` → `OP.ui.desenhar`. As telas ligam os campos por atributos (`data-campo`, `data-saida`, `data-passo`…).
- **Testes das fórmulas:** abra o site e rode `OP.runTests()` no console do navegador. O esperado é `{ total: 637, aprovados: 637, falhas: 0 }`. Em janela estreita (até 480 px) o teste de layout também confere a rolagem horizontal. As auditorias ficam em `OP.ui.auditarLayout()`, `auditarContraste(tema)`, `auditarAcessibilidade()`, `auditarTitulos()` e `auditarAlvosToque()`.
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

Além do site estático, o repositório tem um Worker do Cloudflare (`worker/`, `wrangler.jsonc`): login com o Discord, as fichas na conta e o compartilhamento por link, códigos de acesso de uso único e um conteúdo que só aparece para quem o administrador liberou por alguns dias. O conteúdo fica no banco D1, nunca nos arquivos do site. Sem o Worker (arquivo aberto direto, outro servidor) o botão "Conta" some e a ficha funciona igual. Passo a passo e como testar: `worker/LEIA-ME.md`.

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

### Itens e melhorias do compêndio (conteúdos `itens` e `melhorias`)

O **Compêndio de Itens** (PDF "Arsenal") vira dois conteúdos protegidos, como os de cima: `itens` (as 238 fichas numeradas, mais venenos, veículos operacionais, catalisadores e itens de origem) e `melhorias` (as modificações, as maldições e as regalias, mais as regras gerais de cada classe). Com o conteúdo liberado, o inventário ganha **"Escolher do livro…"** (abas por natureza, busca em todas as abas e filtro de categoria). **Adicionar** já preenche nome, natureza, categoria, espaços e, nas proteções, Defesa e penalidade; **Com ataque** (armas) cria também o ataque ligado, com dano, crítico, alcance e tipo. No painel de melhorias do item, "Escolher do livro…" lista só as que servem para aquele item (dá para desligar o filtro; o que não combina entra como aviso). O texto do livro aparece na tela, na descrição do item e no `.md`, mas não é copiado para a ficha: a ficha guarda só a chave (`item-katana`, `mod-certeira`).

```
python3 -I tools/extrair-arsenal.py compendio.pdf saida/bruto-arsenal.json
node tools/gerar-arsenal.mjs saida/bruto-arsenal.json saida/ ajustes-arsenal.json
```

O extrator precisa de `pdfplumber` (`pip install pdfplumber`) e confere que os Nº das fichas não têm buracos. O gerador cria `itens.json` e `melhorias.json` (importe em `admin.html` com os nomes `itens` e `melhorias` e inclua os dois ao gerar os códigos de acesso), `compatibilidade.md` (qual natureza de item aceita qual classe de melhoria, item a item) e `relatorio.txt` (contagens e a conferência de categoria e espaços de cada ficha contra as tabelas-resumo do livro). O `ajustes-arsenal.json` é escrito à mão e fica **fora do repositório**, como o `efeitos/`: diz o que o livro só diz em frases (`so` restringe as naturezas do grupo, `somente` limita a itens do livro, `tambem` aceita outros, `exclui` marca conflitos, `max` permite repetir, `aj` traz os números que a ficha aplica: espaços, Defesa, ataque, dano e margem). As naturezas, as classes de melhoria e a matriz de compatibilidade por grupo ficam em `data/melhorias.js`; o formato de cada item e de cada melhoria está no cabeçalho de `tools/gerar-arsenal.mjs`. O PDF, o JSON bruto e a pasta de saída **não entram no repositório** (o gerador recusa pastas dentro dele).
