/* Condições (nomes + efeitos NUMÉRICOS sugeridos). Sem descrições do livro: o usuário digita a nota que quiser.
 * - Os NOMES foram conferidos no Guia de Consulta v2 (lista do ritual de cura e demais citações).
 * - Os "efeitos" são SUGESTÕES a conferir no Livro de Regras (Apêndice de Condições), por isso conferir = true.
 *   O Guia não traz esse apêndice. Corrija os números aqui, em um único lugar, quando conferir.
 * Campos de efeitos (todos opcionais):
 *   dadosPericias   → soma (negativa) de dados d20 em TODOS os testes de perícia
 *   dadosAtributos  → { agi, for, int, pre, vig } soma de dados nos testes desses atributos e das perícias baseadas neles
 *   defesa          → soma na Defesa
 *   deslocamentoMult→ multiplicador do deslocamento (0.5 = metade, 0 = não se move)
 * familia: condições da mesma família NÃO se acumulam (vale a pior). Sem família, os efeitos se somam.
 * implica: ids de outras condições que esta inclui (cada id conta uma vez só).
 */
window.OP = window.OP || {};
OP.data = OP.data || {};

OP.data.categoriasCondicao = {
 "medo": "Medo",
 "mental": "Mentais",
 "fisica": "Físicas",
 "paralisia": "Paralisia e ações",
 "sensorial": "Sentidos",
 "defesa": "Defesa e posição",
 "movimento": "Movimento"
};

OP.data.condicoes = [
 { "id": "abalado", "nome": "Abalado", "categoria": "medo", "familia": "medo", "efeitos": { "dadosPericias": -1 }, "conferir": true },
 { "id": "apavorado", "nome": "Apavorado", "categoria": "medo", "familia": "medo", "efeitos": { "dadosPericias": -2 }, "conferir": true },

 { "id": "alquebrado", "nome": "Alquebrado", "categoria": "mental", "efeitos": null, "conferir": false },
 { "id": "confuso", "nome": "Confuso", "categoria": "mental", "efeitos": null, "conferir": false },
 { "id": "esmorecido", "nome": "Esmorecido", "categoria": "mental", "familia": "mental-dados", "efeitos": { "dadosAtributos": { "int": -2, "pre": -2 } }, "conferir": true },
 { "id": "fascinado", "nome": "Fascinado", "categoria": "mental", "efeitos": null, "conferir": false },
 { "id": "frustrado", "nome": "Frustrado", "categoria": "mental", "familia": "mental-dados", "efeitos": { "dadosAtributos": { "int": -1, "pre": -1 } }, "conferir": true },
 { "id": "perturbado", "nome": "Perturbado", "categoria": "mental", "efeitos": null, "conferir": false },

 { "id": "debilitado", "nome": "Debilitado", "categoria": "fisica", "familia": "fisico-dados", "efeitos": { "dadosAtributos": { "agi": -2, "for": -2, "vig": -2 } }, "conferir": true },
 { "id": "enjoado", "nome": "Enjoado", "categoria": "fisica", "efeitos": null, "conferir": false },
 { "id": "envenenado", "nome": "Envenenado", "categoria": "fisica", "efeitos": null, "conferir": false },
 { "id": "exausto", "nome": "Exausto", "categoria": "fisica", "implica": ["debilitado", "lento", "vulneravel"], "efeitos": null, "conferir": true },
 { "id": "fatigado", "nome": "Fatigado", "categoria": "fisica", "implica": ["fraco", "vulneravel"], "efeitos": null, "conferir": true },
 { "id": "fraco", "nome": "Fraco", "categoria": "fisica", "familia": "fisico-dados", "efeitos": { "dadosAtributos": { "agi": -1, "for": -1, "vig": -1 } }, "conferir": true },
 { "id": "sangrando", "nome": "Sangrando", "categoria": "fisica", "efeitos": null, "conferir": false },

 { "id": "agarrado", "nome": "Agarrado", "categoria": "paralisia", "efeitos": null, "conferir": false },
 { "id": "atordoado", "nome": "Atordoado", "categoria": "paralisia", "efeitos": null, "conferir": false },
 { "id": "enredado", "nome": "Enredado", "categoria": "paralisia", "efeitos": null, "conferir": false },
 { "id": "imovel", "nome": "Imóvel", "categoria": "paralisia", "efeitos": { "deslocamentoMult": 0 }, "conferir": true },
 { "id": "inconsciente", "nome": "Inconsciente", "categoria": "paralisia", "efeitos": null, "conferir": false },
 { "id": "paralisado", "nome": "Paralisado", "categoria": "paralisia", "efeitos": { "deslocamentoMult": 0 }, "conferir": true },
 { "id": "pasmo", "nome": "Pasmo", "categoria": "paralisia", "efeitos": null, "conferir": false },

 { "id": "cego", "nome": "Cego", "categoria": "sensorial", "efeitos": null, "conferir": false },
 { "id": "ofuscado", "nome": "Ofuscado", "categoria": "sensorial", "efeitos": null, "conferir": false },
 { "id": "surdo", "nome": "Surdo", "categoria": "sensorial", "efeitos": null, "conferir": false },

 { "id": "caido", "nome": "Caído", "categoria": "defesa", "efeitos": null, "conferir": false },
 { "id": "desprevenido", "nome": "Desprevenido", "categoria": "defesa", "efeitos": { "defesa": -5 }, "conferir": true },
 { "id": "indefeso", "nome": "Indefeso", "categoria": "defesa", "efeitos": null, "conferir": false },
 { "id": "surpreendido", "nome": "Surpreendido", "categoria": "defesa", "efeitos": null, "conferir": false },
 { "id": "vulneravel", "nome": "Vulnerável", "categoria": "defesa", "efeitos": { "defesa": -2 }, "conferir": true },

 { "id": "lento", "nome": "Lento", "categoria": "movimento", "efeitos": { "deslocamentoMult": 0.5 }, "conferir": true }
];
