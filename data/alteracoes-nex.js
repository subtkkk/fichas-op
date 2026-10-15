/* Regra opcional "NEX & Experiência" (Novas regras opcionais): textos do livro e os efeitos que a ficha aplica sozinha.
 *
 * Texto do livro: a pedido de quem usa o site, os textos desta regra estão aqui por inteiro (como o das
 * condições). O símbolo de dado do livro (d20 num círculo) está escrito "1d20", "2d20" e "3d20".
 *
 * OP.data.regraNexNivel     → o texto da regra (para o diálogo "regras opcionais")
 * OP.data.alteracoesNex     → as alterações por NEX:
 *   gerais[]                → NEX 25%, 35% e 50% (todas as fichas)
 *   elementos[id].alteracoes → NEX 60%, 75% e 90% do elemento (só um elemento por ficha: o conectado)
 *   tabelaEnergia[]         → o 1d6 que a Energia sorteia no início de cada cena
 *
 * Campos de cada alteração: id, nex, titulo, narrativa (o trecho em itálico), texto (o que muda no jogo) e
 * efeitos, que o calc.js lê (todos opcionais):
 *   bonusPericiaTreinada   { idPericia: n }  bônus fixo, só para quem é treinado na perícia
 *   ocultismoSemTreino     true              perícia somente treinada passa a poder ser usada sem treino
 *   escolhaPenalidade      { campo, opcoes, valor, rotulo }  penalidade fixa numa perícia à escolha
 *   escolhaAtributoPE      { campo, opcoes, rotulo }         atributo escolhido soma no total de PE
 *   dadosPorPericia        { idPericia: n }  dados (bônus) — um estágio posterior substitui o valor
 *   penalidadeDadosPorPericia { idPericia: n } dados (penalidade) — idem; o Sangue pode suspender (Forma Monstruosa)
 *   condicaoPermanente     { id, efeitos?, escuridao?: { id, efeitos? } }  condição que a alteração mantém
 *   reducaoRitual          [nome]            rituais cujo custo cai 1 PE se o personagem já os conhece
 *   energia                1 | 2 | 3         intensidade dos efeitos da tabela de Energia
 *   lembretes              [texto]           o que a ficha NÃO calcula
 *
 * Só cumulativo entre os estágios: "aumenta para" troca o valor anterior da mesma perícia.
 */
window.OP = window.OP || {};
OP.data = OP.data || {};

OP.data.regraNexNivel = {
 titulo: "NEX & Experiência",
 secoes: [
  { id: "novas-regras", titulo: "Novas regras opcionais", paragrafos: [
   "Enquanto a seção anterior traz mecânicas que funcionam em conjunto com as regras do livro básico, esta seção traz mecânicas que as substituem ou transformam. São como “mods” oficiais que existem para oferecer alternativas de jogo, mais focadas nos gêneros de horror e sobrevivência. Por exemplo, a regra opcional de Evolução por Patentes permite histórias mais “realistas”, nas quais os personagens não acumulam tanto poder. É importante deixar claro que apesar dos elementos narrativos serem canônicos no universo, as regras opcionais são exatamente isso — opcionais! Use-as apenas se quiser.",
   "O Livro de Regras de Ordem Paranormal RPG continua sendo a versão padrão e oficial do jogo."
  ] },
  { id: "nex-experiencia", titulo: "NEX & Experiência", paragrafos: [
   "Em Ordem Paranormal RPG, o NEX de um personagem representa ao mesmo tempo sua experiência prática e seu conhecimento e envolvimento com o paranormal. Nesta regra opcional, o NEX continua representando sua exposição ao Outro Lado, mas sua competência geral passa a ser representada por uma nova característica: NÍVEL DE EXPERIÊNCIA.",
   "O nível de experiência representa seu conhecimento a respeito de coisas da Realidade, como técnicas de combate, saber acadêmico e outros estudos mundanos. Ele substitui o NEX em Benefícios por NEX (veja OPRPG, p. 23), como pré-requisitos de habilidades de classe (exceto poderes paranormais) e em efeitos de origens e habilidades baseados em NEX (como Dedicação, da origem Universitário). Para estas regras, considere que 1 nível equivale a 5% de NEX.",
   "EXEMPLO. A habilidade de classe de combatente Proteção Pesada tem como pré-requisito NEX 30%. Nestas regras, esse requisito se torna nível 6. A habilidade Calejado fornece +1 PV para cada 5% de NEX. Nestas regras, isso se torna +1 PV por nível.",
   "Todo personagem começa em nível 1 (equivalente a NEX 5% na regra padrão) e avança de nível conforme conclui missões para a Ordem. Assim, a cada vez que o personagem aumentaria seu NEX em 5%, em vez disso aumenta seu nível em 1.",
   "EXEMPLO. Bruna é uma especialista de nível 1. Ao concluir uma missão, sobe para nível 2. Ela agora tem os PV, os PE e Sanidade de uma especialista de nível 2 (equivalente a NEX 10% na regra padrão).",
   "Já o nível de exposição paranormal, ou NEX, passa a representar unicamente o quanto o personagem já foi exposto ao Outro Lado. Em termos de regras, ele continua sendo usado para afinidade elemental, efeitos de poderes paranormais e na imunidade do personagem à Presença Perturbadora de criaturas.",
   "TRANSCENDER. Para se conectar ao Outro Lado, é necessário contato com o paranormal. Assim, o poder Transcender deixa de ser um poder de classe de afetar a Sanidade. Em vez disso, sempre que atinge um valor de NEX em que poderia sofrer uma alteração (veja a seguir), o personagem pode realizar o ritual de conexão e receber este poder."
  ] },
  { id: "ganhando-nex", titulo: "Ganhando NEX", paragrafos: [
   "Cada personagem começa com NEX 0% e, em vez de ganhar NEX automaticamente por concluir missões, seu nível de exposição paranormal aumenta conforme os eventos descritos a seguir.",
   "EXPOSIÇÃO BRANDA. Contato indireto com o paranormal, como ler um livro sobre o Outro Lado. Sem efeito no NEX.",
   "EXPOSIÇÃO MODERADA. Contato concreto com o Outro Lado, como manusear uma origem do paranormal ou visitar um local onde a Membrana está danificada. NEX do personagem aumenta em +1%.",
   "EXPOSIÇÃO PROFUNDA. Este grau de exposição é raro, e poucos são aqueles que se mantêm inalterados após esse tipo de experiência. O principal exemplo são contatos diretos com criaturas de até VD 300 ou com manifestações equivalentes do Outro Lado. NEX +2%.",
   "EXPOSIÇÃO TOTAL. O maior grau de exposição a que um ser pode ser submetido. Exemplos incluem presenciar uma Membrana arruinada ou contato direto com criaturas acima de VD 300. NEX +5%.",
   "APRENDER UM RITUAL. Sempre que o personagem aprende um ritual, seu NEX aumenta em um valor igual ao círculo do ritual (isso inclui os rituais iniciais de um personagem).",
   "EXPOSIÇÕES REPETIDAS. Exposições ao mesmo evento ou criatura podem, a critério do mestre, fornecer NEX reduzido ou mesmo nenhum NEX. Em todos os casos, o mestre tem a palavra final sobre o grau de exposição de contato com o paranormal.",
   "LIMITE DE NEX. Existe um limite de quanto o Outro Lado consegue ocupar de uma mente apenas por meio de sua exposição. Assim, nenhum personagem pode acumular mais de 99% de NEX apenas por se expôr ao paranormal. Para ultrapassar esse limite, o personagem precisa se submeter a uma desconjuração."
  ] },
  { id: "progressao-nex", titulo: "Progressão de NEX", paragrafos: [
   "Conforme seu corpo e sua mente são tomados pelo Outro Lado, você desenvolve certas capacidades e poderes. Entretanto, isso vem com um preço, pois a exposição ao paranormal pode alterar o âmago da pessoa, muitas vezes de formas debilitantes ou que afastam a vítima da própria humanidade.",
   "À medida que seu NEX aumenta, você sofre as alterações a seguir. Exceto quando indicado o contrário, todos esses efeitos são cumulativos. Rituais recebidos por uma alteração por NEX seguem todas as regras para conjuração de rituais."
  ] }
 ],
 caixas: [
  { id: "separando", titulo: "Separando nível e NEX", paragrafos: [
   "Em Ordem Paranormal RPG, o NEX representa tanto a experiência prática quanto o contato com o paranormal de um agente. O objetivo é simplificar o jogo; presume-se que os agentes terão contato constante com o paranormal, logo sua experiência e sua exposição caminharão lado a lado.",
   "Entretanto, em jogos mais focados em horror, nem sempre o poder de um personagem e seu conhecimento sobre os mistérios do Outro Lado serão equivalentes. Mais do que isso, o mundo estará repleto de pessoas habilidosas, mas que não possuem conhecimento paranormal (um soldado das forças especiais, por exemplo, teria um nível elevado como combatente, mas pouco ou nenhum NEX) e daquelas que foram marcadas pelas Entidades, mas têm pouca ou nenhuma experiência em ação (como uma vítima sequestrada por um culto, com NEX elevado, mas baixo nível de experiência)."
  ] },
  { id: "modificando", titulo: "Modificando alterações", paragrafos: [
   "As alterações descritas aqui são apenas algumas entre as infinitas formas através das quais o Outro Lado pode modificar aqueles expostos ao paranormal. O mestre e o jogador podem usar essas alterações como exemplos para criar outras, que representem características ou elementos da história do personagem. Por exemplo, caso o jogador não queira que seu personagem se torne careca pela distorção de Sangue, seus cabelos podem desenvolver mechas vermelhas e mudarem para um estilo mais curto e agressivo. É importante, porém, que personagens muito expostos ao Outro Lado sejam de fato alterados fisicamente de acordo com a descrição de cada Entidade (OPRPG, p. 98). Para séries mais pesadas, considere fazer as desvantagens que normalmente ficam à critério do jogador (como a penalidade de −5 em uma perícia de Presença) serem decididas de forma aleatória.",
   "Ao criar estes efeitos, evite alterações que possam deixar os jogadores desconfortáveis. Os efeitos do Paranormal devem ser assustadores e desconfortáveis, mas apenas para os personagens."
  ] }
 ]
};

OP.data.alteracoesNex = {
 gerais: [
  { id: "g25", nex: 25, titulo: "NEX 25%",
   narrativa: "Arrepios na espinha que precedem momentos importantes, déjà vus cada vez mais frequentes, pesadelos cada vez mais vívidos.",
   texto: "Você pode fazer testes de Ocultismo mesmo sem ser treinado. Se for, recebe +2 em Ocultismo. Entretanto, sofre −5 em uma perícia à sua escolha entre Diplomacia, Enganação ou Intimidação. Essa penalidade representa uma alteração física ou mental que você desenvolveu devido a sua exposição.",
   efeitos: {
    ocultismoSemTreino: true,
    bonusPericiaTreinada: { ocultismo: 2 },
    escolhaPenalidade: { campo: "penalidade25", opcoes: ["diplomacia", "enganacao", "intimidacao"], valor: -5, rotulo: "Perícia com −5" }
   } },
  { id: "g35", nex: 35, titulo: "NEX 35%",
   narrativa: "Eventos terríveis e paranormais acontecem com você, como se tivesse sido escolhido pelo Outro Lado por algum motivo misterioso. Coincidências inexplicáveis não são elementos de ficção e sim fatos em sua vida.",
   texto: "Escolha um atributo (exceto Presença). Você soma o atributo escolhido em seu total de PE. Entretanto, seu corpo desenvolve resistência aos comandos do seu próprio cérebro, por vezes tremendo ou movendo-se sozinho, e em outras, até recusando-se a se mexer; você sofre −5 em uma perícia à sua escolha entre Atletismo, Fortitude ou Reflexos.",
   efeitos: {
    escolhaAtributoPE: { campo: "atributo35", opcoes: ["agi", "for", "int", "vig"], rotulo: "Atributo somado ao PE" },
    escolhaPenalidade: { campo: "penalidade35", opcoes: ["atletismo", "fortitude", "reflexos"], valor: -5, rotulo: "Perícia com −5" }
   } },
  { id: "g50", nex: 50, titulo: "NEX 50%",
   narrativa: "Existe mais do Outro Lado do que a Realidade dentro de você, agora.",
   texto: "A partir deste grau de exposição, você começa a se aproximar de um elemento. Na próxima vez em que Transcender, você desenvolve afinidade com um elemento a sua escolha entre Conhecimento, Energia, Morte e Sangue (veja OPRPG, p. 114). Conforme aumenta seu NEX, você recebe as alterações do elemento escolhido. Além disso, como consequência dessa afinidade, você sofre sutis modificações visuais. Elas podem ser um reflexo da conexão com a entidade, como os olhos roxos do Kaiser ao se conectar com Energia ou os caninos protuberantes de Arthur Cervero ao se conectar com o Sangue. Porém, essas marcas também podem alterar fisicamente um personagem através do Medo como um reflexo de seu desenvolvimento, como as mechas brancas de Arthur refletindo seu pai, Brúlio, e o Sr. Veríssimo.",
   efeitos: {} }
 ],

 elementos: {
  sangue: { nome: "Sangue", alteracoes: [
   { id: "sangue60", nex: 60, titulo: "NEX 60%",
    narrativa: "A Realidade se torna cada vez mais intensa e emocionante. Eventos que antes não lhe causariam reação agora fazem você sentir impulsos difíceis de controlar. Viver é sentir e todo sentimento é DOR. Seus dentes caninos se tornam pontiagudos, suas unhas lembram garras e seus pêlos demoram mais para crescer. Suas VEIAS ficam mais protuberantes e exercícios físicos se tornam mais fáceis, conforme seus músculos se adaptam e aumentam. Seu tempo de reação melhora. A sua FOME aumenta. Sua raiva aumenta. Seu amor aumenta. Sua dor aumenta. Tudo é mais, e você é melhor.",
    texto: "Você recebe +1d20 em Sobrevivência e se torna imune a calor e frio extremos. Entretanto, não pode mais escolher 10 em testes (veja OPRPG, p. 76).",
    efeitos: {
     dadosPorPericia: { sobrevivencia: 1 },
     lembretes: ["Imune a calor e frio extremos.", "Não pode mais escolher 10 em testes."]
    } },
   { id: "sangue75", nex: 75, titulo: "NEX 75%",
    narrativa: "FOME Sua mandíbula e seus dentes aumentam. Bom pra mastigar, bom pra devorar. MAIS FORTE. MAIS DOR. Pelos corporais caíram. Olhos vermelhos ou devorar os olhos. Roupas incomodam, corpo coça. Pele dura, músculos rígidos. Veias maiores e pulsantes. MAIS FOME, melhor. Corpo curvado, corpo maior, corpo MELHOR. Menos pensamentos, mais FOME. Consumir carne e sangue. Mais sentimento. Sentir é dor. Caçar. FOME é DOR. Amor é DOR. Mais rápido, mais forte, melhor. DEVORAR",
    texto: "Você pode conjurar o ritual Aprimorar Físico, mas apenas em si mesmo (se já conhece esse ritual, o custo para conjurá-lo tendo você como alvo é reduzido em −1 PE). Entretanto, sofre −1d20 em Ciências, Medicina e Tecnologia.",
    efeitos: {
     penalidadeDadosPorPericia: { ciencias: -1, medicina: -1, tecnologia: -1 },
     reducaoRitual: [{ nome: "Aprimorar Físico", nota: "só em si mesmo" }]
    } },
   { id: "sangue90", nex: 90, titulo: "NEX 90%",
    narrativa: "DEVORAR. OLHOS INÚTEIS. ENXERGAR PELA DOR. RAIVA. BOCA MAIOR. DENTE MELHOR. MASTIGAR. CORPO CURVADO. CORPO RÁPIDO. CORPO MELHOR. TOCAR É DOR. PELE MAIS VERMELHA. AMAR. GARRAS MELHORES. ARRANCAR. CORTAR. BRIGAR. DOR É AMOR. LÍNGUA MAIOR. SALIVANDO. CARNE. CORAÇÃO RÁPIDO. SENTIR. INCONTROLÁVEL. SOFRER É AMOR. SANGUE.",
    texto: "A penalidade em perícias que você sofre por NEX 75% aumenta para −2d20. Entretanto, você pode conjurar o ritual Forma Monstruosa (se já conhece esse ritual, seu custo é reduzido em −1 PE). Quando conjura esse ritual, você pode gastar +2 PE para eliminar, pela duração do seu efeito, as penalidades causadas por suas alterações de Sangue.",
    efeitos: {
     penalidadeDadosPorPericia: { ciencias: -2, medicina: -2, tecnologia: -2 },
     reducaoRitual: [{ nome: "Forma Monstruosa" }],
     suspensao: "sangue"
    } }
  ] },

  morte: { nome: "Morte", alteracoes: [
   { id: "morte60", nex: 60, titulo: "NEX 60%",
    narrativa: "A sua percepção do tempo na Realidade começa a se distorcer, cada segundo parece durar um pouco mais do que antes. Padrões e repetições começam a se tornar cada vez mais perceptíveis. A sua pele toma um tom mais acinzentado, seus olhos se tornam completamente negros e, suas orelhas, mais pontiagudas. Noites sem sono já não são incomuns, mas elas não parecem te afetar tanto. Na verdade, poucas coisas conseguem te afetar, pelo menos não o suficiente para você perder o seu tempo.",
    texto: "Você recebe +1d20 em Iniciativa e Reflexos, mas sofre −1d20 em Diplomacia e Intuição.",
    efeitos: {
     dadosPorPericia: { iniciativa: 1, reflexos: 1 },
     penalidadeDadosPorPericia: { diplomacia: -1, intuicao: -1 }
    } },
   { id: "morte75", nex: 75, titulo: "NEX 75%",
    narrativa: "Tudo se repete e tudo termina. Seu corpo está esmagrecido e completamente sem cor, seus ossos retorcidos, suas orelhas longas e seu rosto contém faixas pretas, mas nada disso te importuna. Poucas coisas fazem você sentir. Seus cabelos se tornaram pretos ou brancos e estão mais longos. Seus fluidos corporais se tornaram completamente pretos. Você já não sente a passagem do tempo como sentia antes. Poucas coisas fazem você sentir. Se comunicar exige mais de você, então o melhor a se fazer é pensar nas poucas palavras certas e necessárias. Você tem tempo pra isso. Dormir já não é mais necessário, e você não consegue lembrar da última vez que sentiu fome ou sede. Na verdade, poucas coisas fazem você sentir.",
    texto: "Você pode conjurar o ritual Velocidade Mortal (se já conhece esse ritual, seu custo é reduzido em −1 PE). Entretanto, a penalidade em perícias por NEX 60% aumenta para −2d20 e se aplica também a Enganação e Intimidação.",
    efeitos: {
     penalidadeDadosPorPericia: { diplomacia: -2, intuicao: -2, enganacao: -2, intimidacao: -2 },
     reducaoRitual: [{ nome: "Velocidade Mortal" }]
    } },
   { id: "morte90", nex: 90, titulo: "NEX 90%",
    narrativa: "Todas as histórias precisam de um fim, e o tempo leva todas as coisas. Cada momento agora é apenas uma lágrima derrubada em um oceano negro, e cada segundo dura o que você teria nomeado uma vez como eternidade. Gradativamente mais próximo da solitária imortalidade, aprisionado dentro de si, o tempo se distorce exponencialmente enquanto a sua percepção espiraliza cada vez mais distante do que uma vez foi. Sua aparência quase esquelética, seus olhos pretos e profundos e seus cabelos longos agora parecem estar como sempre estiveram. Talvez as coisas já tenham sentido diferentes alguma vez? É impossível dizer, nada faz você sentir.",
    texto: "Você não pode mais ser surpreendido. Além disso, em qualquer cena dividida em rodadas, você pode esperar que todos os seres com Iniciativa menor que a sua declarem suas ações e façam quaisquer testes relacionados antes de declarar e resolver suas próprias ações (essencialmente, você sabe o que os demais vão fazer antes de agir). Entretanto, na primeira vez em que interage socialmente com qualquer pessoa em uma cena, você perde 3 PE.",
    efeitos: {
     lembretes: ["Não pode mais ser surpreendido.", "Sabe o que os seres com Iniciativa menor vão fazer antes de agir.", "Primeira interação social da cena: perde 3 PE."],
     interacaoSocialPE: 3
    } }
  ] },

  conhecimento: { nome: "Conhecimento", alteracoes: [
   { id: "conhecimento60", nex: 60, titulo: "NEX 60%",
    narrativa: "A sua visão da Realidade é alterada. Nos detalhes, você enxerga os sigilos, os padrões e os códigos que formam as leis naturais de tudo. Como resultado, as distorções da Realidade causadas pelas entidades do Outro Lado ficam ainda mais claras. As pupilas dos seus olhos se tornam mais esbranquiçadas como consequência de enxergar cada vez mais através do Conhecimento, e não por seus próprios olhos.",
    texto: "Você passa a enxergar auras paranormais, como se estivesse permanentemente sob o efeito básico do ritual Terceiro Olho (se já conhece esse ritual, além desse efeito seu custo é reduzido em −1 PE). Entretanto, enxergar através do Conhecimento distorce sua percepção do que forma a Realidade; você se torna permanentemente ofuscado.",
    efeitos: {
     condicaoPermanente: { id: "ofuscado" },
     reducaoRitual: [{ nome: "Terceiro Olho" }],
     lembretes: ["Enxerga auras paranormais (efeito básico do ritual Terceiro Olho)."]
    } },
   { id: "conhecimento75", nex: 75, titulo: "NEX 75%",
    narrativa: "Seus olhos refletem a luz como detalhes gravados em ouro. Você enxerga as regras. As Correntes da Realidade. Tudo está pré-determinado e nunca esteve tão óbvio. Na verdade, é patético não conseguir enxergar isso, o quão inferior e humilhante deve ser viver como um inseto acorrentado sem entender o que te espera adiante? Espera, esses pensamentos sequer são seus?",
    texto: "Manifestações paranormais ficam cada vez mais claras, às custas de sua visão. Você passa a perceber perigos como se estivesse permanentemente sob o efeito básico do ritual Detecção de Ameaças (se já conhece esse ritual, além desse efeito seu custo é reduzido em −1 PE). Entretanto, tentar enxergar a Realidade em sua forma básica parece cada vez mais cansativo, suas penalidades pela condição ofuscado aumentam para −2d20.",
    efeitos: {
     condicaoPermanente: { id: "ofuscado", efeitos: { dadosAtaque: -2, dadosPorPericia: { percepcao: -2 } }, nomeExibido: "Ofuscado (−2d20)" },
     reducaoRitual: [{ nome: "Detecção de Ameaças" }],
     lembretes: ["Percebe perigos (efeito básico do ritual Detecção de Ameaças)."]
    } },
   { id: "conhecimento90", nex: 90, titulo: "NEX 90%",
    narrativa: "Seus olhos refulgem em dourado. Observar a Realidade já não lhe é mais significativo, ela não passa de uma memória. É ignominioso saber que você sequer considerava isso algo importante. A vida degradante dos vassalos das Correntes, sendo arrastados pelo Medo, não é algo que devia lhe interessar mais. Você não é como eles. Eles não sabem. Você se tornou cego por poder enxergar.",
    texto: "A luz da Realidade passa a agredir seus olhos. Quando não está em escuridão, em vez de ofuscado você se torna cego. Entretanto, sua percepção do Outro Lado se fortalece; você pode conjurar o ritual Vidência (se já conhece esse ritual, seu custo é reduzido em −1 PE). Você não precisa de uma superfície reflexiva para conjurar o ritual; as informações do alvo se formam em sua cabeça.",
    efeitos: {
     condicaoPermanente: { id: "cego", escuridao: { id: "ofuscado", efeitos: { dadosAtaque: -2, dadosPorPericia: { percepcao: -2 } }, nomeExibido: "Ofuscado (−2d20)" } },
     reducaoRitual: [{ nome: "Vidência" }],
     escuridaoAlternavel: true
    } }
  ] },

  energia: { nome: "Energia", alteracoes: [
   { id: "energia60", nex: 60, titulo: "NEX 60%",
    narrativa: "A Realidade começa a parecer entediante. CHATA. Uma angústia surge dentro de você: seria interessante se mais alguma coisa estivesse acontecendo. Mais de uma coisa, talvez? Um RUÍDO constante em seus ouvidos. Muitas coisas poderiam estar sendo feitas agora. Seus dedos começam a tremer e ter pequenos espasmos. A cor de seus olhos muda em momentos aleatórios e eles piscam fora de sincronia. Mais coisas poderiam estar acontecendo. Talvez planejar menos e deixar a SORTE decidir o seu destino seja uma maneira de deixar a Realidade um pouco mais interessante.",
    texto: "Você pode conjurar o ritual Coincidência Forçada (se já conhece esse ritual, seu custo é reduzido em −1 PE). No entanto, é inevitável que as coisas se tornem caóticas. No início de cada cena, role 1d6 e receba o efeito indicado até o fim da cena:",
    efeitos: { energia: 1, reducaoRitual: [{ nome: "Coincidência Forçada" }] } },
   { id: "energia75", nex: 75, titulo: "NEX 75%",
    narrativa: "Você precisa de mais estímulos. MAIS COISAS. Suas veias estão coloridas com o PLASMA que corre NELAS. Seus olhos já NÃO TEM MAIS SÓ UMA COR, por que teriam? Eles agora são um espectro de CORES BRILHANTES e eles se movem INDEPENDENTES UM DO OUTRO! Melhor assim. Seu corpo TREME constantemente, seus pelos sempre estão ARREPIADOS. É difícil se concentrar por causa do MALDITO RUÍDO, se PELO MENOS TIVESSE ALGO PRA TE DISTRAIR DISSO. MAIS COISAS? Tecnologia. Objetos tecnológicos são interessantes. Celulares, computadores. É importante LEVAR ELES COM VOCÊ, amarrar nas suas roupas pode ser uma boa ideia? COISAS NOVAS. O timbre da sua voz MUDA, como se estivesse VIBRANDO. O RUÍDO não PARA NUNCA. Melhor assim.",
    texto: "O comportamento CAÓTICO da Energia se amplifica; entretanto, sua forma física se torna cada vez mais metamórfica; você pode conjurar o ritual Tela de Ruído (se já conhece esse ritual, seu custo é reduzido em −1 PE).",
    efeitos: { energia: 2, reducaoRitual: [{ nome: "Tela de Ruído" }] } },
   { id: "energia90", nex: 90, titulo: "NEX 90%",
    narrativa: "MAIS COISAS. SEUS OLHOS BRILHAM, TREMEM E NÃO PODEM SER FECHADOS. MAIS COISAS. O RUÍDO É ENSURDECEDOR. MAIS COISAS. ESTÍMULOS. SUAS VEIAS BRILHAM E SE MOVEM. SUA PELE SE TORNA TRANSLÚCIDA. SEUS CABELOS FLUTUAM LEVEMENTE E TEM VÁRIAS CORES. MAIS COISAS? COISAS NOVAS. ALGO DIFERENTE. TÁ TUDO TREMENDO OU É VOCÊ? HAHAHAHAHA MAIS COISAS POR FAVOR. CONECTAR OS CABOS DOS SEUS OBJETOS TECNOLÓGICOS NA SUA PELE PRA MANTER ELES SEMPRE LIGADOS. TUDO SEMPRE LIGADO. MAIS COISAS. SUA VOZ MUDA COMPLETAMENTE PARA ALGO QUE SOA SINTÉTICO. NÃO QUE VOCÊ PUDESSE ESCUTAR A SUA PRÓPRIA VOZ POR CAUSA DESSE MALDITO RUÍDO ENSURDECEDOR. VOCÊ PRECISA SE DISTRAIR COM MAIS COISAS.",
    texto: "A energia se torna ainda mais caótica, mas você pode conjurar o ritual Salto Fantasma (se já conhece esse ritual, seu custo é reduzido em −1 PE). Além disso, você não precisa mais falar para conjurar rituais e, se puder digitar o ritual em um dispositivo eletrônico enquanto o conjura, a DT para resistir a ele aumenta em +2.",
    efeitos: {
     energia: 3,
     reducaoRitual: [{ nome: "Salto Fantasma" }],
     lembretes: ["Não precisa mais falar para conjurar rituais.", "Digitando o ritual num dispositivo eletrônico enquanto conjura, a DT para resistir a ele aumenta em +2."]
    } }
  ] }
 },

 // O 1d6 de Energia (NEX 60%+): no início de cada cena. "n" = intensidade (1 em NEX 60%, 2 em 75%, 3 em 90%).
 tabelaEnergia: [
  { d6: 1, texto: "O ruído nos seus ouvidos fica cada vez mais alto, como uma estática constante. Você sofre −1d20 em todos os testes de Presença e de perícias baseadas neste atributo (exceto Vontade). Essa penalidade aumenta para −2d20 em NEX 75% e −3d20 em NEX 90%." },
  { d6: 2, texto: "Uma vez por cena, quando você faz uma ação, o mestre pode disputar um par ou ímpar com você. Se ele vencer, pode trocar o alvo dessa ação para outro à escolha dele. A partir de NEX 75% o mestre pode usar esse efeito duas vezes na mesma cena (mas não na mesma ação) e, em NEX 90%, pode usá-lo três vezes." },
  { d6: 3, texto: "O mestre decide um “tique” que você (e seu personagem) consiga fazer, como estalar os dedos ou falar uma palavra específica. Você precisa executar esse “tique” sempre que descrever uma ação de seu personagem. Se esquecer, sente uma descarga de Energia no seu cérebro e perde 1 ponto de Sanidade. Em NEX 75% a perda aumenta para 2 pontos e, em NEX 90%, para 3 pontos." },
  { d6: 4, texto: "Surtos de Energia percorrem seu corpo de forma errática, tornando suas ações incontroláveis. Você fica confuso por 1 rodada (2 rodadas em NEX 75% e 3 rodadas em NEX 90%) ou até a condição se encerrar sozinha. Isto não é um efeito mental, mas resultado das convulsões de seu corpo." },
  { d6: 5, texto: "No início da cena, o mestre rola 1d20 e anota o valor rolado. Até o fim da cena, sempre que qualquer d20 em um de seus testes rolar o valor anotado, você e todas as criaturas em alcance curto sofrem 1d6 pontos de dano de Energia. Em NEX 75% o mestre rola 2d20 e anota ambos os resultados e, em NEX 90%, rola 3d20 e anota os três resultados." },
  { d6: 6, texto: "Você deu sorte, é claro! Nenhum efeito colateral... por enquanto." }
 ]
};
