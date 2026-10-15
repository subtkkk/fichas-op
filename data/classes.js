/* Classes: recursos, perícias, proficiências e tabela de progressão por NEX (ou estágio). Sobrevivente: os valores "por NEX" valem por ESTÁGIO. Gerado a partir do Guia de Consulta (Livro de Regras v1.3, Sobrevivendo ao Horror v1.2 e aventuras AS). Contém só nomes e números (pdInicial/pdPorNex: Pontos de Determinação da regra opcional "Jogando sem Sanidade"); as descrições devem ser digitadas pelo usuário. */
window.OP = window.OP || {};
OP.data = OP.data || {};
OP.data.classes = {
 "combatente": {
  "id": "combatente",
  "nome": "Combatente",
  "fonte": "livro",
  "unidadeProgressao": "nex",
  "pvInicial": 20,
  "pvPorNex": 4,
  "peInicial": 2,
  "pePorNex": 2,
  "sanInicial": 12,
  "sanPorNex": 3,
  "pdInicial": 6,
  "pdPorNex": 3,
  "pontosTreinamento": 1,
  "pericias": {
   "fixas": [],
   "escolhas": [
    [
     "luta",
     "pontaria"
    ],
    [
     "fortitude",
     "reflexos"
    ]
   ]
  },
  "grauTreinamentoBase": 2,
  "proficiencias": [
   "armas simples",
   "armas táticas",
   "proteções leves"
  ],
  "aumentoAtributoMax": 5,
  "progressao": [
   {
    "nex": 5,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Ataque especial (2 PE, +5)"
     }
    ]
   },
   {
    "nex": 10,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 15,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de combatente"
     }
    ]
   },
   {
    "nex": 20,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 25,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Ataque especial (3 PE, +10)"
     }
    ]
   },
   {
    "nex": 30,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de combatente"
     }
    ]
   },
   {
    "nex": 35,
    "itens": [
     {
      "tipo": "grau_treinamento",
      "rotulo": "Grau de treinamento"
     }
    ]
   },
   {
    "nex": 40,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 45,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de combatente"
     }
    ]
   },
   {
    "nex": 50,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     },
     {
      "tipo": "versatilidade",
      "rotulo": "Versatilidade"
     }
    ]
   },
   {
    "nex": 55,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Ataque especial (4 PE, +15)"
     }
    ]
   },
   {
    "nex": 60,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de combatente"
     }
    ]
   },
   {
    "nex": 65,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 70,
    "itens": [
     {
      "tipo": "grau_treinamento",
      "rotulo": "Grau de treinamento"
     }
    ]
   },
   {
    "nex": 75,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de combatente"
     }
    ]
   },
   {
    "nex": 80,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 85,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Ataque especial (5 PE, +20)"
     }
    ]
   },
   {
    "nex": 90,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de combatente"
     }
    ]
   },
   {
    "nex": 95,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 99,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   }
  ]
 },
 "especialista": {
  "id": "especialista",
  "nome": "Especialista",
  "fonte": "livro",
  "unidadeProgressao": "nex",
  "pvInicial": 16,
  "pvPorNex": 3,
  "peInicial": 3,
  "pePorNex": 3,
  "sanInicial": 16,
  "sanPorNex": 4,
  "pdInicial": 8,
  "pdPorNex": 4,
  "pontosTreinamento": 7,
  "pericias": {
   "fixas": [],
   "escolhas": []
  },
  "grauTreinamentoBase": 5,
  "proficiencias": [
   "armas simples",
   "proteções leves"
  ],
  "aumentoAtributoMax": 5,
  "progressao": [
   {
    "nex": 5,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Eclético"
     },
     {
      "tipo": "marco",
      "rotulo": "Perito (2 PE, +1d6)"
     }
    ]
   },
   {
    "nex": 10,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 15,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de especialista"
     }
    ]
   },
   {
    "nex": 20,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 25,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Perito (3 PE, +1d8)"
     }
    ]
   },
   {
    "nex": 30,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de especialista"
     }
    ]
   },
   {
    "nex": 35,
    "itens": [
     {
      "tipo": "grau_treinamento",
      "rotulo": "Grau de treinamento"
     }
    ]
   },
   {
    "nex": 40,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Engenhosidade (veterano)"
     },
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 45,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de especialista"
     }
    ]
   },
   {
    "nex": 50,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     },
     {
      "tipo": "versatilidade",
      "rotulo": "Versatilidade"
     }
    ]
   },
   {
    "nex": 55,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Perito (4 PE, +1d10)"
     }
    ]
   },
   {
    "nex": 60,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de especialista"
     }
    ]
   },
   {
    "nex": 65,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 70,
    "itens": [
     {
      "tipo": "grau_treinamento",
      "rotulo": "Grau de treinamento"
     }
    ]
   },
   {
    "nex": 75,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Engenhosidade (expert)"
     },
     {
      "tipo": "poder",
      "rotulo": "Poder de especialista"
     }
    ]
   },
   {
    "nex": 80,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 85,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Perito (5 PE, +1d12)"
     }
    ]
   },
   {
    "nex": 90,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de especialista"
     }
    ]
   },
   {
    "nex": 95,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 99,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   }
  ]
 },
 "ocultista": {
  "id": "ocultista",
  "nome": "Ocultista",
  "fonte": "livro",
  "unidadeProgressao": "nex",
  "pvInicial": 12,
  "pvPorNex": 2,
  "peInicial": 4,
  "pePorNex": 4,
  "sanInicial": 20,
  "sanPorNex": 5,
  "pdInicial": 10,
  "pdPorNex": 5,
  "pontosTreinamento": 3,
  "pericias": {
   "fixas": [
    "ocultismo",
    "vontade"
   ],
   "escolhas": []
  },
  "grauTreinamentoBase": 3,
  "proficiencias": [
   "armas simples"
  ],
  "aumentoAtributoMax": 5,
  "rituaisIniciais": 3,
  "progressao": [
   {
    "nex": 5,
    "itens": [
     {
      "tipo": "circulo",
      "rotulo": "Escolhido pelo Outro Lado (1º círculo)",
      "valor": 1
     }
    ]
   },
   {
    "nex": 10,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 15,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de ocultista"
     }
    ]
   },
   {
    "nex": 20,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 25,
    "itens": [
     {
      "tipo": "circulo",
      "rotulo": "Escolhido pelo Outro Lado (2º círculo)",
      "valor": 2
     }
    ]
   },
   {
    "nex": 30,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de ocultista"
     }
    ]
   },
   {
    "nex": 35,
    "itens": [
     {
      "tipo": "grau_treinamento",
      "rotulo": "Grau de treinamento"
     }
    ]
   },
   {
    "nex": 40,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 45,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de ocultista"
     }
    ]
   },
   {
    "nex": 50,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     },
     {
      "tipo": "versatilidade",
      "rotulo": "Versatilidade"
     }
    ]
   },
   {
    "nex": 55,
    "itens": [
     {
      "tipo": "circulo",
      "rotulo": "Escolhido pelo Outro Lado (3º círculo)",
      "valor": 3
     }
    ]
   },
   {
    "nex": 60,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de ocultista"
     }
    ]
   },
   {
    "nex": 65,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   },
   {
    "nex": 70,
    "itens": [
     {
      "tipo": "grau_treinamento",
      "rotulo": "Grau de treinamento"
     }
    ]
   },
   {
    "nex": 75,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de ocultista"
     }
    ]
   },
   {
    "nex": 80,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 85,
    "itens": [
     {
      "tipo": "circulo",
      "rotulo": "Escolhido pelo Outro Lado (4º círculo)",
      "valor": 4
     }
    ]
   },
   {
    "nex": 90,
    "itens": [
     {
      "tipo": "poder",
      "rotulo": "Poder de ocultista"
     }
    ]
   },
   {
    "nex": 95,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "nex": 99,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Habilidade de trilha"
     }
    ]
   }
  ]
 },
 "sobrevivente": {
  "id": "sobrevivente",
  "nome": "Sobrevivente",
  "fonte": "SaH",
  "unidadeProgressao": "estagio",
  "estagioMax": 5,
  "pvInicial": 8,
  "pvPorNex": 2,
  "peInicial": 2,
  "pePorNex": 1,
  "sanInicial": 8,
  "sanPorNex": 2,
  "pdInicial": 4,
  "pdPorNex": 2,
  "pontosTreinamento": 1,
  "pericias": {
   "fixas": [],
   "escolhas": []
  },
  "grauTreinamentoBase": null,
  "proficiencias": [
   "armas simples"
  ],
  "limitePEFixo": 1,
  "aumentoAtributoMax": 3,
  "progressao": [
   {
    "estagio": 1,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Empenho"
     }
    ]
   },
   {
    "estagio": 2,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Trilha (1ª habilidade)"
     }
    ]
   },
   {
    "estagio": 3,
    "itens": [
     {
      "tipo": "aumento_atributo",
      "rotulo": "Aumento de atributo"
     }
    ]
   },
   {
    "estagio": 4,
    "itens": [
     {
      "tipo": "trilha",
      "rotulo": "Trilha (2ª habilidade)"
     }
    ]
   },
   {
    "estagio": 5,
    "itens": [
     {
      "tipo": "marco",
      "rotulo": "Cicatrizado"
     }
    ]
   }
  ]
 }
};
