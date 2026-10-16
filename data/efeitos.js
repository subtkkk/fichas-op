/* ==========================================================================
   data/efeitos.js — efeitos automáticos de origens, habilidades, poderes e rituais
   --------------------------------------------------------------------------
   Só nomes e números (nenhum texto do livro). A ficha calcula sozinha o que está
   aqui; o texto de cada habilidade vem do conteúdo protegido (servidor).
   As listas ficam em data/efeitos-*.js, que acrescentam chaves a OP.data.efeitos.

   A chave de cada fonte é a "chave" do catálogo (data/catalogo.js), a mesma do
   conteúdo protegido. Fontes que valem para a ficha:
   - origem: a origem escolhida;      - classe: todas as habilidades da classe;
   - trilha: habilidades já liberadas pelo NEX (ou estágio);
   - poder: poderes de classe, gerais e paranormais adicionados na lista de habilidades;
   - ritual: rituais adicionados na lista de rituais (só ativavel, usos e formas).

   Cada fonte pode ter:
   {
     passivos: [ Efeito, ... ],   // valem sempre
     gastos:   [ Gasto, ... ],    // opcionais num teste (a pessoa "prepara" e rola)
     ativavel: Ativavel,          // botão Ativar: gasta PE e liga efeitos por um tempo
     usos:     [ Uso, ... ],      // botões que rolam e aplicam (cura, perda de SAN, dano)
     escolhas: [ Escolha, ... ],  // escolhas da pessoa que os efeitos usam
     formas:   { padrao|discente|verdadeira: { dano: '4d6' } }   // só rituais
   }

   --------------------------------------------------------------------------
   Valor (V) — um número ou um destes objetos:
     { nivel: n }            n × nível (NEX ÷ 5; no Sobrevivente, estágio), arredondado para baixo.
                             Poderes paranormais usam o NEX de exposição, o resto o da progressão.
     { atr: 'vig', x: 1 }    x × total do atributo (x padrão 1, arredondado para baixo)
     { tabela: [[nex, v]…] } valor do maior "nex" já alcançado (em ordem crescente)
     { soma: [V, V…] }       soma de valores
     { metade: V }           metade (para baixo)

   Condição (se) — objeto; todas as chaves precisam valer:
     { nex: 50 }             NEX (da fonte) pelo menos 50
     { afinidade: 'sangue' } tem afinidade desenvolvida com o elemento ('qualquer' = com algum)
     { semAfinidade: 'sangue' } o contrário: NÃO tem afinidade com o elemento
     { treinado: 'luta' }    treinado na perícia (não vale em efeitos "treino")
     { classe: 'ocultista' } é desta classe
     { forma: 'discente' }   só no efeito ativo de um ritual conjurado nessa forma (ou lista de formas;
                             'padrao' | 'discente' | 'verdadeira'). Vale só dentro de "ativavel.passivos".

   --------------------------------------------------------------------------
   Efeito passivo (k) — todos aceitam "se":
     { k: 'pv' | 'pe' | 'san', v }          soma ao máximo do recurso
     { k: 'def', v }                         Defesa
     { k: 'desl', v }                        deslocamento, em metros
     { k: 'per', id, v }                     bônus fixo numa perícia. id: 'fortitude' | ['a','b'] | 'todas'
                                             | { atr: 'int' } (todas as perícias desse atributo)
                                             | { escolha: 'idDaEscolha' }
     { k: 'treino', id }                     recebe treinamento na perícia; se já é treinada, +2 nela.
                                             Em vez de id: { escolha: 'idDaEscolha' }
     { k: 'rd', tipo, v }                    resistência a dano: id de OP.data.tiposDano, 'todos' ou 'fisico'
     { k: 'dt', v }                          DT dos rituais
     { k: 'limitePE', v }                    limite de PE por turno
     { k: 'carga', v }                       capacidade de carga (espaços)
     { k: 'dados', alvo, id?, v }            d20 a mais (+) ou a menos (−). alvo: 'pericia' (id da perícia
                                             ou 'todas'), 'atributo' (id), 'ataque' (tipo: 'corpo'|'distancia'|'todos')
     { k: 'ataque', v, tipo? }               bônus fixo no teste de ataque ('corpo' | 'distancia'; sem tipo = todos)
     { k: 'dano', v, tipo? }                 bônus fixo no dano dos ataques
     { k: 'margem', v, tipo? }               aumenta a margem de ameaça (v positivo)
     { k: 'cura', v }                        soma ao total de PV curados pelos "usos" desta pessoa
     { k: 'danoRitual', v }                  soma ao dano que os rituais dela causam (cada rolagem de dano)
     { k: 'curaRitual', v }                  soma aos PV que os rituais dela curam (cada rolagem de cura)
     { k: 'custoRitual', v, circulo?, elemento? }  soma (negativo = reduz) ao custo em PE dos rituais

   Gasto (opcional num teste):
     { id, nome, custo, custoExtra?, unidades?, quando, bonus?, dados?, dano? , se? }
       custo      PE gastos com 1 unidade (0 = grátis)
       unidades   V: quantas unidades a pessoa pode comprar (padrão 1)
       custoExtra PE de cada unidade além da primeira (padrão = custo)
       bonus      V por unidade somado ao teste; dados: d20 por unidade; dano: V por unidade somado ao dano
       quando     onde vale (todas as chaves precisam valer):
                    { pericia: ['ciencias'] | 'todas' }
                    { atr: ['int'] }               perícias baseadas nesses atributos
                    { exceto: ['luta','pontaria'] } perícias que NÃO valem
                    { ataque: 'corpo'|'distancia'|'todos' }   no teste de ataque
                    { dano: 'corpo'|'distancia'|'todos' }     na rolagem de dano
                    { resistencia: true }          só Fortitude, Reflexos e Vontade

   Ativavel (liga efeitos por um tempo):
     { custo, duracao: 'cena' | 'rodadas' | 'manual', rodadas?: n, passivos: [Efeito…], se? }
       'cena': até "Fim da cena"; 'rodadas': conta com "Passar rodada"; 'manual': até desligar.

   Uso (botão):
     { id, nome, custo, rolar: '2d8+2', tipo: 'cura' | 'dano' | 'rolagem',
       recupera?: 'pv' | 'pe' | 'san', perde?: { pv?: '1d4', san?: '1d4', pe?: '1d4' }, elemento?: 'sangue' }

   Escolha:
     { id, rotulo, tipo: 'pericia' | 'atributo', opcoes: ['diplomacia','enganacao'] }
   ========================================================================== */
window.OP = window.OP || {};
window.OP.data = window.OP.data || {};
window.OP.data.efeitos = window.OP.data.efeitos || {};
