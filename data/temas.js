/* Temas, tamanhos de texto e pares de cores que o teste de contraste (WCAG) verifica.
 * Os nomes das variáveis CSS abaixo são o padrão da Etapa 10: o css/style.css precisa defini-las
 * em :root (tema escuro), [data-tema="claro"] e [data-tema="contraste"], sempre em hexadecimal #rrggbb.
 * minimo = contraste mínimo nos temas escuro e claro; minimoAlto = mínimo no tema de alto contraste.
 */
window.OP = window.OP || {};
OP.data = OP.data || {};

OP.data.temas = [
 { "id": "auto", "nome": "Automático (segue o sistema)" },
 { "id": "escuro", "nome": "Escuro" },
 { "id": "claro", "nome": "Claro" },
 { "id": "contraste", "nome": "Alto contraste" }
];

OP.data.tamanhosFonte = [
 { "id": "p", "nome": "Pequeno", "px": 14 },
 { "id": "m", "nome": "Normal", "px": 16 },
 { "id": "g", "nome": "Grande", "px": 18 },
 { "id": "gg", "nome": "Muito grande", "px": 20 }
];

OP.data.paresContraste = [
 { "a": "--cor-texto", "b": "--cor-fundo", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-texto", "b": "--cor-superficie", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-texto-suave", "b": "--cor-superficie", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-destaque-texto", "b": "--cor-destaque", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-destaque", "b": "--cor-superficie", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-perigo", "b": "--cor-superficie", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-aviso", "b": "--cor-superficie", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-sucesso", "b": "--cor-superficie", "minimo": 4.5, "minimoAlto": 7 },
 { "a": "--cor-foco", "b": "--cor-fundo", "minimo": 3, "minimoAlto": 4.5 },
 { "a": "--cor-foco", "b": "--cor-superficie", "minimo": 3, "minimoAlto": 4.5 }
];
