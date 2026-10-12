/* Condições: nomes, efeitos numéricos que a ficha aplica sozinha e o texto do livro.
 * Fonte: Livro de Regras (descrições das condições e "Clarificações de regras").
 *
 * Campos de cada condição:
 *   id, nome, categoria
 *   efeitos    → null (nada numérico) ou um objeto com campos opcionais:
 *     dadosPericias          soma de dados d20 em TODOS os testes de perícia
 *     dadosAtributos         { agi, for, int, pre, vig }: dados nos testes do atributo e das perícias baseadas nele
 *     dadosPorPericia        { idDaPericia: n }: dados só nessa perícia (ex.: percepcao, iniciativa, reflexos)
 *     dadosAtaque            dados em todos os testes de ataque
 *     dadosAtaqueCorpoACorpo dados só nos ataques corpo a corpo (perícia Luta)
 *     defesa                 soma na Defesa (contra qualquer ataque)
 *     defesaCorpoACorpo      soma na Defesa contra ataques corpo a corpo
 *     defesaDistancia        soma na Defesa contra ataques à distância
 *     deslocamentoMult       multiplicador do deslocamento (0,5 = metade; 0 = não se move)
 *     deslocamentoMax        deslocamento máximo, em metros
 *     custoPE                acréscimo no custo em PE de habilidades e rituais
 *     resistenciaDano        resistência a dano (todos os tipos)
 *   implica    → ids de outras condições que esta inclui (cada id conta uma vez só)
 *   lembretes  → frases curtas do que a ficha NÃO calcula (ações, dano por rodada, testes)
 *   descricao  → texto do livro
 *   conferir   → true se o efeito ainda precisa ser conferido no livro
 *
 * Regra de acúmulo (Clarificações de regras): condições com os mesmos efeitos não
 * se acumulam; vale só o mais severo. Efeitos diferentes se acumulam.
 */
window.OP = window.OP || {};
OP.data = OP.data || {};

OP.data.categoriasCondicao = {
 "medo": "Medo",
 "mental": "Mentais",
 "fisica": "Físicas",
 "fadiga": "Fadiga",
 "paralisia": "Paralisia",
 "sensorial": "Sentidos",
 "defesa": "Defesa e posição"
};

OP.data.condicoes = [
 { "id": "abalado", "nome": "Abalado", "categoria": "medo",
   "efeitos": { "dadosPericias": -1 }, "lembretes": ["Se ficar abalado novamente, fica apavorado."], "conferir": false,
   "descricao": "O personagem sofre −1d20 em testes. Se ficar abalado novamente, em vez disso fica apavorado. Condição de medo." },
 { "id": "apavorado", "nome": "Apavorado", "categoria": "medo",
   "efeitos": { "dadosPericias": -2 }, "lembretes": ["Deve fugir da fonte do medo da maneira mais eficiente possível."], "conferir": false,
   "descricao": "O personagem sofre −2d20 em testes de perícia e deve fugir da fonte do medo da maneira mais eficiente possível (mas pode parar de fazê-lo assim que a perder de vista ou se afastar mais do que alcance médio). Se não puder, poderá agir, mas não poderá se aproximar voluntariamente da fonte do medo. Condição de medo." },

 { "id": "alquebrado", "nome": "Alquebrado", "categoria": "mental",
   "efeitos": { "custoPE": 1 }, "conferir": false,
   "descricao": "O custo em pontos de esforço das habilidades e dos rituais do personagem aumenta em +1. Condição mental." },
 { "id": "atordoado", "nome": "Atordoado", "categoria": "mental",
   "implica": ["desprevenido"], "efeitos": null, "lembretes": ["Não pode fazer ações."], "conferir": false,
   "descricao": "O personagem fica desprevenido e não pode fazer ações. Condição mental." },
 { "id": "confuso", "nome": "Confuso", "categoria": "mental",
   "efeitos": null, "lembretes": ["Role 1d6 no início de cada turno: 1) move-se em direção aleatória (1d8); 2-3) não pode fazer ações; 4-5) ataca o ser mais próximo; 6) a condição termina."], "conferir": false,
   "descricao": "O personagem comporta-se de modo aleatório. Role 1d6 no início de seus turnos: 1) Movimenta-se em uma direção escolhida por uma rolagem de 1d8; 2-3) Não pode fazer ações e fica balbuciando de forma incoerente; 4-5) Usa a arma que estiver empunhando para atacar o ser mais próximo, ou a si mesmo se estiver sozinho (nesse caso, apenas role o dano); 6) A condição termina e pode agir normalmente. Condição mental." },
 { "id": "esmorecido", "nome": "Esmorecido", "categoria": "mental",
   "efeitos": { "dadosAtributos": { "int": -2, "pre": -2 } }, "conferir": false,
   "descricao": "O personagem sofre −2d20 em testes de Intelecto e Presença. Condição mental." },
 { "id": "fascinado", "nome": "Fascinado", "categoria": "mental",
   "efeitos": { "dadosPorPericia": { "percepcao": -2 } }, "lembretes": ["Não pode fazer ações, exceto observar aquilo que o fascinou.", "Qualquer ação hostil contra ele anula a condição."], "conferir": false,
   "descricao": "Com a atenção presa em alguma coisa. O personagem sofre −2d20 em Percepção e não pode fazer ações, exceto observar aquilo que o fascinou. Qualquer ação hostil contra o personagem anula esta condição. Balançar um ser fascinado para tirá-lo desse estado gasta uma ação padrão. Condição mental." },
 { "id": "frustrado", "nome": "Frustrado", "categoria": "mental",
   "efeitos": { "dadosAtributos": { "int": -1, "pre": -1 } }, "lembretes": ["Se ficar frustrado novamente, fica esmorecido."], "conferir": false,
   "descricao": "O personagem sofre −1d20 em testes de Intelecto e Presença. Se ficar frustrado novamente, em vez disso fica esmorecido. Condição mental." },
 { "id": "pasmo", "nome": "Pasmo", "categoria": "mental",
   "efeitos": null, "lembretes": ["Não pode fazer ações."], "conferir": false,
   "descricao": "O personagem não pode fazer ações. Condição mental." },
 { "id": "perturbado", "nome": "Perturbado", "categoria": "mental",
   "efeitos": null, "lembretes": ["Na primeira vez numa cena, recebe um efeito de insanidade."], "conferir": false,
   "descricao": "Na primeira vez que isso acontece em uma cena, você recebe um efeito de insanidade (veja a p. 111)." },

 { "id": "asfixiado", "nome": "Asfixiado", "categoria": "fisica",
   "efeitos": null, "lembretes": ["Pode prender a respiração por rodadas iguais ao Vigor; depois, teste de Fortitude por rodada (DT 5 + 5 por teste anterior).", "Se falhar, cai inconsciente e perde 1d6 PV por rodada."], "conferir": false,
   "descricao": "O personagem não pode respirar. Um personagem asfixiado pode prender a respiração por um número de rodadas igual ao seu Vigor. Depois disso, deve fazer um teste de Fortitude por rodada (DT 5 + 5 por teste anterior). Se falhar, cai inconsciente e perde 1d6 PV por rodada até respirar novamente ou morrer." },
 { "id": "debilitado", "nome": "Debilitado", "categoria": "fisica",
   "efeitos": { "dadosAtributos": { "agi": -2, "for": -2, "vig": -2 } }, "lembretes": ["Se ficar debilitado novamente, fica inconsciente."], "conferir": false,
   "descricao": "O personagem sofre −2d20 em testes de Agilidade, Força e Vigor. Se o personagem ficar debilitado novamente, em vez disso fica inconsciente." },
 { "id": "doente", "nome": "Doente", "categoria": "fisica",
   "efeitos": null, "conferir": false,
   "descricao": "Sob efeito de uma doença." },
 { "id": "emchamas", "nome": "Em Chamas", "categoria": "fisica",
   "efeitos": null, "lembretes": ["No início de cada turno, sofre 1d6 de dano de fogo.", "Uma ação padrão com as mãos, ou imersão em água, apaga o fogo."], "conferir": false,
   "descricao": "O personagem está pegando fogo. No início de seus turnos, sofre 1d6 pontos de dano de fogo. O personagem pode gastar uma ação padrão para apagar o fogo com as mãos. Imersão em água também apaga as chamas." },
 { "id": "enjoado", "nome": "Enjoado", "categoria": "fisica",
   "efeitos": null, "lembretes": ["Só pode realizar uma ação padrão ou de movimento por rodada."], "conferir": false,
   "descricao": "O personagem só pode realizar uma ação padrão ou de movimento (não ambas) por rodada." },
 { "id": "envenenado", "nome": "Envenenado", "categoria": "fisica",
   "efeitos": null, "lembretes": ["Efeito e duração dependem do veneno; dano recorrente de condições envenenado sempre se acumula."], "conferir": false,
   "descricao": "Varia de acordo com o veneno. Pode ser outra condição (por exemplo, fraco ou enjoado) ou dano recorrente (por exemplo, 1d12 pontos de dano de veneno por rodada). A descrição do veneno determina a duração dele (caso nada seja dito, a condição dura pela cena). Dano recorrente de condições envenenado sempre se acumula (mesmo se as condições ou fontes que as causam forem iguais)." },
 { "id": "fraco", "nome": "Fraco", "categoria": "fisica",
   "efeitos": { "dadosAtributos": { "agi": -1, "for": -1, "vig": -1 } }, "lembretes": ["Se ficar fraco novamente, fica debilitado."], "conferir": false,
   "descricao": "O personagem sofre −1d20 em testes de Agilidade, Força e Vigor. Se ficar fraco novamente, em vez disso fica debilitado." },
 { "id": "sangrando", "nome": "Sangrando", "categoria": "fisica",
   "efeitos": null, "lembretes": ["No início de cada turno, teste de Vigor (DT 20): se passar, estabiliza; se falhar, perde 1d6 PV.", "Estabilizar outro: ação completa e teste de Medicina (DT 20)."], "conferir": false,
   "descricao": "Com um ferimento aberto. No início de seus turnos, o personagem deve fazer um teste de Vigor (DT 20). Se passar, estabiliza e remove essa condição. Se falhar, perde 1d6 pontos de vida e continua sangrando. Também é possível estabilizar alguém com uma ação completa e um teste de Medicina (DT 20)." },

 { "id": "exausto", "nome": "Exausto", "categoria": "fadiga",
   "implica": ["debilitado", "lento", "vulneravel"], "efeitos": null, "lembretes": ["Se ficar exausto novamente, fica inconsciente."], "conferir": false,
   "descricao": "O personagem fica debilitado, lento e vulnerável. Se ficar exausto novamente, em vez disso fica inconsciente. Condição de fadiga." },
 { "id": "fatigado", "nome": "Fatigado", "categoria": "fadiga",
   "implica": ["fraco", "vulneravel"], "efeitos": null, "lembretes": ["Se ficar fatigado novamente, fica exausto."], "conferir": false,
   "descricao": "O personagem fica fraco e vulnerável. Se o personagem ficar fatigado novamente, em vez disso fica exausto. Condição de fadiga." },

 { "id": "agarrado", "nome": "Agarrado", "categoria": "paralisia",
   "implica": ["desprevenido", "imovel"], "efeitos": { "dadosAtaque": -1 }, "lembretes": ["Só pode atacar com armas leves.", "Ataque à distância contra alvo envolvido na manobra agarrar: 50% de chance de acertar o alvo errado."], "conferir": false,
   "descricao": "O personagem fica desprevenido e imóvel, sofre −1d20 em testes de ataque e só pode atacar com armas leves. Um personagem fazendo um ataque à distância contra um alvo envolvido na manobra agarrar tem 50% de chance de acertar o alvo errado. Condição de paralisia." },
 { "id": "enredado", "nome": "Enredado", "categoria": "paralisia",
   "implica": ["lento", "vulneravel"], "efeitos": { "dadosAtaque": -1 }, "conferir": false,
   "descricao": "O personagem fica lento, vulnerável e sofre −1d20 em testes de ataque. Condição de paralisia." },
 { "id": "imovel", "nome": "Imóvel", "categoria": "paralisia",
   "efeitos": { "deslocamentoMult": 0 }, "conferir": false,
   "descricao": "Todas as formas de deslocamento do personagem são reduzidas a 0m. Condição de paralisia." },
 { "id": "lento", "nome": "Lento", "categoria": "paralisia",
   "efeitos": { "deslocamentoMult": 0.5 }, "lembretes": ["Não pode correr nem fazer investidas."], "conferir": false,
   "descricao": "Todas as formas de deslocamento do personagem são reduzidas à metade (arredonde para baixo para o primeiro incremento de 1,5m) e ele não pode correr ou fazer investidas. Condição de paralisia." },
 { "id": "paralisado", "nome": "Paralisado", "categoria": "paralisia",
   "implica": ["imovel", "indefeso"], "efeitos": null, "lembretes": ["Só pode realizar ações puramente mentais."], "conferir": false,
   "descricao": "O personagem fica imóvel e indefeso e só pode realizar ações puramente mentais. Condição de paralisia." },

 { "id": "cego", "nome": "Cego", "categoria": "sensorial",
   "implica": ["desprevenido", "lento"], "efeitos": { "dadosAtributos": { "agi": -2, "for": -2 } }, "lembretes": ["Não pode fazer testes de Percepção para observar.", "Todos os alvos de seus ataques recebem camuflagem total.", "É considerado cego em área de escuridão total, a menos que algo lhe permita perceber no escuro."], "conferir": false,
   "descricao": "O personagem fica desprevenido e lento, não pode fazer testes de Percepção para observar e sofre −2d20 em testes de perícias baseadas em Agilidade ou Força. Todos os alvos de seus ataques recebem camuflagem total. Você é considerado cego enquanto estiver em uma área de escuridão total, a menos que algo lhe permita perceber no escuro. Condição de sentidos." },
 { "id": "ofuscado", "nome": "Ofuscado", "categoria": "sensorial",
   "efeitos": { "dadosAtaque": -1, "dadosPorPericia": { "percepcao": -1 } }, "conferir": false,
   "descricao": "O personagem sofre −1d20 em testes de ataque e de Percepção. Condição de sentidos." },
 { "id": "surdo", "nome": "Surdo", "categoria": "sensorial",
   "efeitos": { "dadosPorPericia": { "iniciativa": -1 } }, "lembretes": ["Não pode fazer testes de Percepção para ouvir.", "Está em condição ruim para lançar rituais."], "conferir": false,
   "descricao": "O personagem não pode fazer testes de Percepção para ouvir e sofre −1d20 em testes de Iniciativa. Além disso, é considerado em condição ruim para lançar rituais. Condição de sentidos." },

 { "id": "caido", "nome": "Caído", "categoria": "defesa",
   "efeitos": { "dadosAtaqueCorpoACorpo": -2, "deslocamentoMax": 1.5, "defesaCorpoACorpo": -5, "defesaDistancia": 5 }, "conferir": false,
   "descricao": "Deitado no chão. O personagem sofre −2d20 em ataques corpo a corpo e seu deslocamento é reduzido a 1,5m. Além disso, sofre −5 na Defesa contra ataques corpo a corpo, mas recebe +5 na Defesa contra ataques à distância." },
 { "id": "desprevenido", "nome": "Desprevenido", "categoria": "defesa",
   "efeitos": { "defesa": -5, "dadosPorPericia": { "reflexos": -1 } }, "lembretes": ["Fica desprevenido contra inimigos que não possa perceber."], "conferir": false,
   "descricao": "Despreparado para reagir. O personagem sofre −5 na Defesa e −1d20 em Reflexos. Você fica desprevenido contra inimigos que não possa perceber." },
 { "id": "indefeso", "nome": "Indefeso", "categoria": "defesa",
   "implica": ["desprevenido"], "efeitos": { "defesa": -10 }, "lembretes": ["Falha automaticamente em testes de Reflexos.", "Pode sofrer golpes de misericórdia."], "conferir": false,
   "descricao": "O personagem é considerado desprevenido, mas sofre −10 na Defesa, falha automaticamente em testes de Reflexos e pode sofrer golpes de misericórdia." },
 { "id": "inconsciente", "nome": "Inconsciente", "categoria": "defesa",
   "implica": ["indefeso"], "efeitos": null, "lembretes": ["Não pode fazer ações, incluindo reações.", "Balançar um ser para acordá-lo gasta uma ação padrão."], "conferir": false,
   "descricao": "O personagem fica indefeso e não pode fazer ações, incluindo reações. Balançar um ser para acordá-lo gasta uma ação padrão." },
 { "id": "petrificado", "nome": "Petrificado", "categoria": "defesa",
   "implica": ["inconsciente"], "efeitos": { "resistenciaDano": 10 }, "conferir": false,
   "descricao": "O personagem fica inconsciente e recebe resistência a dano 10." },
 { "id": "surpreendido", "nome": "Surpreendido", "categoria": "defesa",
   "implica": ["desprevenido"], "efeitos": null, "lembretes": ["Não pode fazer ações."], "conferir": false,
   "descricao": "Não ciente de seus inimigos. O personagem fica desprevenido e não pode fazer ações." },
 { "id": "vulneravel", "nome": "Vulnerável", "categoria": "defesa",
   "efeitos": { "defesa": -2 }, "conferir": false,
   "descricao": "O personagem sofre −2 na Defesa." }
];
