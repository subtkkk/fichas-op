/* ==========================================================================
   tools/gerar-arsenal.mjs — gera os arquivos de conteúdo protegido "itens" e "melhorias"
   a partir do JSON bruto do compêndio de itens (tools/extrair-arsenal.py).

   Uso:   node tools/gerar-arsenal.mjs <bruto.json> <pasta-de-saida> [ajustes.json]

   Saída (na pasta indicada, FORA do repositório):
   - itens.json, melhorias.json: para importar em admin.html → "Conteúdo protegido"
     ({ itens: [{ chave, titulo, texto, ordem }] });
   - compatibilidade.md: qual natureza de item aceita qual classe de melhoria (e quais itens);
   - relatorio.txt: contagens, conferências com as tabelas do livro e avisos.

   Cada "texto" tem o texto do livro e, no fim, uma linha "§AUTO§{...}" com os dados da ficha
   (formato abaixo). O site separa essa linha ao carregar (js/livro.js).

   ITEM    { t:'item', num, fonte, pag, tipo, grupo, cat, esp, catTexto?, espTexto?, elemento?, uso?,
             arma?: { prof, emp, pericia, dano, danoAlt?, danoTexto?, margem, mult, critTexto, alcance,
                      tipoDano, tiposDano, municao?, capacidade? },
             protecao?: { def, pen }, limite? }
   MELHORIA { t:'melhoria', cls, grupo, fonte, pag, elemento?, max?, aj?, so?, somente?, tambem?, exclui? }
     - cls: 'modificacao' | 'maldicao' | 'regalia' (data/melhorias.js decide quanto soma à categoria)
     - so: restringe as naturezas do grupo; somente: só estes itens (chaves); tambem: aceita também
       estes itens (chaves); exclui: chaves de melhorias que não combinam com esta;
       max: quantas vezes pode entrar no mesmo item (padrão 1);
       aj: ajustes numéricos que a ficha aplica { esp, def, ataque, dano, margem }.
   O ajustes.json (opcional, escrito à mão, também FORA do repositório) completa o que o texto do
   livro só diz em frases: { itens: { <chave>: { grupo?, tipo?, ... } }, melhorias: { <chave>: { aj?, so?, ... } } }.

   NADA do livro entra no repositório: guarde o JSON bruto e a pasta de saída fora dele.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , arquivoBruto, pastaSaida, arquivoAjustes] = process.argv;
if (!arquivoBruto || !pastaSaida) {
  console.error('Uso: node tools/gerar-arsenal.mjs <bruto.json> <pasta-de-saida> [ajustes.json]');
  process.exit(1);
}
const dentro = (p) => path.resolve(p).startsWith(raiz + path.sep);
if (dentro(pastaSaida) || dentro(arquivoBruto) || (arquivoAjustes && dentro(arquivoAjustes))) {
  console.error('O JSON bruto, o ajustes.json e a pasta de saída devem ficar FORA do repositório (o texto do livro não pode entrar nele).');
  process.exit(1);
}
fs.mkdirSync(pastaSaida, { recursive: true });

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
['data/config.js', 'data/danos.js', 'data/patentes.js', 'data/melhorias.js', 'js/dados.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx);
});
const D = ctx.OP.data;

const bruto = JSON.parse(fs.readFileSync(arquivoBruto, 'utf8'));
const ajustes = arquivoAjustes ? JSON.parse(fs.readFileSync(arquivoAjustes, 'utf8')) : {};
const ajItens = ajustes.itens || {};
const ajMelhorias = ajustes.melhorias || {};

const problemas = [];
const avisos = [];

/* ---------- utilidades ---------- */
const LIMITE_CHAVE = 80;
const semAcentos = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (t) => semAcentos(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, LIMITE_CHAVE).replace(/-$/, '');
const ROMANOS = { '0': 0, I: 1, II: 2, III: 3, IV: 4 };
const NOME_ROMANO = ['0', 'I', 'II', 'III', 'IV'];

/** Arruma espaços e um erro de digitação do PDF ("Bônus.+5"). */
function limpar(t) {
  return String(t).replace(/\s+/g, ' ').replace(/([a-zà-ú])\.([+–-]\d)/g, '$1. $2').trim();
}
/** "ARMA TÁTICA · CORPO A CORPO" → "Arma tática · Corpo a corpo". */
function paraTitulo(t) {
  return String(t).split(' · ').map(function (p) {
    const baixa = p.toLowerCase();
    return baixa.charAt(0).toUpperCase() + baixa.slice(1);
  }).join(' · ');
}
function numeroBr(t) {
  return Number(String(t).replace(',', '.'));
}
function textoEspacos(n) {
  return n === 0 ? 'sem espaço' : String(n).replace('.', ',') + (n <= 1 ? ' espaço' : ' espaços'); // "0,5 espaço", como no livro
}
const grupoItem = (id) => D.gruposItem.find((g) => g.id === id);
const grupoMelhoria = (id) => D.gruposMelhoria.find((g) => g.id === id);
const classeMelhoria = (id) => D.classesMelhoria.find((c) => c.id === id);
const nomeFonte = (f, p) => (f ? f + (p ? ' p. ' + p : '') : '');

/* ---------- itens com ficha (Nº) ---------- */
const TIPO_DANO_POR_NOME = {
  corte: 'cortante', impacto: 'impacto', perfuracao: 'perfurante', balistico: 'balistico', eletricidade: 'eletrico',
  fogo: 'fogo', frio: 'frio', energia: 'energia', sangue: 'sangue', morte: 'morte', conhecimento: 'conhecimento',
  'perf.': 'perfurante', 'imp.': 'impacto', 'bal.': 'balistico', 'conhec.': 'conhecimento'
};

function tiposDeDano(texto) {
  const ids = [];
  String(texto).split('+').forEach(function (p) {
    const chave = semAcentos(p).toLowerCase().replace(/\*/g, '').trim();
    if (chave === '—') return; // lançadores de granada: sem dano próprio
    const id = TIPO_DANO_POR_NOME[chave];
    if (id && ids.indexOf(id) === -1) ids.push(id);
    else if (chave && !id) avisos.push('Tipo de dano não reconhecido: "' + p.trim() + '"');
  });
  return ids;
}

function parseCritico(texto) {
  const t = String(texto || '').replace(/\*/g, '').trim();
  if (!t || t === '—') return null;
  const m = /^(\d+)?\s*\/?\s*(?:x(\d+))?$/.exec(t);
  if (!m) { avisos.push('Crítico não reconhecido: "' + texto + '"'); return null; }
  return { margem: m[1] ? Number(m[1]) : 20, mult: m[2] ? Number(m[2]) : 2 };
}

function parseDano(texto) {
  const t = String(texto || '').trim();
  if (!t || t === '—') return { dano: '', texto: '' };
  const partes = t.split('/').map((p) => p.replace(/\s+/g, ''));
  const valido = (f) => ctx.OP.dados.analisarFormula(f).ok;
  const principal = partes[0];
  if (!valido(principal)) return { dano: '', texto: t };
  const r = { dano: principal, texto: t };
  if (partes[1] && partes[1] !== principal && valido(partes[1])) r.alt = partes[1];
  return r;
}

function parseEspacos(texto) {
  const t = String(texto).toUpperCase();
  let m = /^([\d,]+)\s+ESPAÇOS?$/.exec(t);
  if (m) return { esp: numeroBr(m[1]) };
  if (t === 'SEM ESPAÇO') return { esp: 0, texto: 'sem espaço' };
  if (t === 'NA ARMA') return { esp: 0, texto: 'ocupa o mesmo espaço da arma' };
  if (t === 'VEÍCULO') return { esp: 0, texto: 'veículo' };
  problemas.push('Espaços não reconhecidos: "' + texto + '"');
  return { esp: 0 };
}

function parseCategoria(texto) {
  const t = String(texto).trim();
  if (t in ROMANOS) return { cat: ROMANOS[t] };
  if (t === 'VAR.') return { cat: 0, texto: 'varia (use a da granada correspondente)' };
  if (t === 'I/II') return { cat: 1, texto: 'I (curta) ou II (longa)' };
  if (t === '= CÍRC.') return { cat: 1, texto: 'igual ao círculo do ritual' };
  problemas.push('Categoria não reconhecida: "' + texto + '"');
  return { cat: 0 };
}

const ELEMENTOS = { SANGUE: 'sangue', MORTE: 'morte', CONHECIMENTO: 'conhecimento', ENERGIA: 'energia', MEDO: 'medo', VARIA: '' };
const NOME_ELEMENTO = { sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia', medo: 'Medo' };

/** Natureza (grupo), tipo da ficha e dados de arma/proteção a partir da linha de tipo da ficha. */
function classificar(f) {
  const tipo = f.tipo;
  const partes = tipo.split(' · ').map((p) => p.trim());
  const base = partes[0];
  const amaldicoado = /AMALDIÇOAD/.test(tipo);
  const r = { grupo: 'outro', tipoFicha: 'geral', arma: null, uso: '' };
  const parens = /\(([^)]+)\)/.exec(tipo);
  if (parens) r.uso = slug(parens[1]);
  if (/^ARMAS?\b/.test(base)) {
    r.tipoFicha = 'arma';
    const tem = (re) => partes.some((p) => re.test(p));
    let gp = tem(/^CORPO A CORPO$/) ? 'arma-cac' : tem(/^ARREMESSO$/) ? 'arma-arremesso' : tem(/^DISPARO$/) ? 'arma-disparo' : tem(/^FOGO$/) ? 'arma-fogo' : '';
    const alcance = (f.stats && f.stats['ALCANCE']) || '';
    if (!gp) gp = alcance && alcance !== '—' ? 'arma-fogo' : 'arma-cac'; // ex.: o fuzil alheio é "um fuzil de precisão"
    const prof = tem(/SIMPLES|SIMPLE/) ? 'simples' : tem(/TÁTIC/) ? 'tatica' : tem(/PESAD/) ? 'pesada' : '';
    const emp = tem(/^LEVE$/) ? 'leve' : tem(/^UMA MÃO$/) ? 'uma-mao' : tem(/^DUAS MÃOS$/) ? 'duas-maos' : '';
    r.grupo = amaldicoado ? 'amaldicoado' : gp;
    r.arma = { prof: prof, emp: emp, pericia: gp === 'arma-cac' ? 'luta' : 'pontaria' };
    return r;
  }
  if (amaldicoado) {
    r.grupo = 'amaldicoado';
    if (/^PROTEÇÃO/.test(base)) r.tipoFicha = 'protecao';
    return r;
  }
  if (/^PROTEÇÃO LEVE/.test(base)) { r.grupo = 'protecao-leve'; r.tipoFicha = 'protecao'; }
  else if (/^PROTEÇÃO PESADA/.test(base)) { r.grupo = 'protecao-pesada'; r.tipoFicha = 'protecao'; }
  else if (/^ESCUDO/.test(base)) { r.grupo = 'escudo'; r.tipoFicha = 'protecao'; }
  else if (/^PROTEÇÃO \(VESTIDA\)/.test(base)) { r.grupo = 'capacete'; r.tipoFicha = 'protecao'; }
  else if (/^MUNIÇÃO/.test(base)) r.grupo = 'municao';
  else if (/^GRANADA/.test(base)) r.grupo = 'granada';
  else if (/^EXPLOSIVO/.test(base)) r.grupo = 'explosivo';
  else if (/^ACESSÓRIO/.test(base)) r.grupo = 'acessorio';
  else if (/^MEDICAMENTO/.test(base)) r.grupo = 'medicamento';
  else if (/^ITEM PARANORMAL/.test(base)) r.grupo = 'paranormal';
  else if (/^ITEM OPERACIONAL/.test(base)) r.grupo = 'operacional';
  else if (/^RECURSO/.test(base)) r.grupo = 'recurso';
  else if (/^ALIADO/.test(base)) r.grupo = 'aliado';
  else if (/^EQUIPAMENTO GERAL/.test(base)) r.grupo = 'outro';
  else problemas.push('Tipo de ficha não classificado: Nº ' + f.num + ' (' + tipo + ')');
  return r;
}

const usadas = new Set();
function chaveUnica(prefixo, nome) {
  let chave = (prefixo + slug(nome)).slice(0, LIMITE_CHAVE).replace(/-$/, '');
  const base = chave;
  let n = 2;
  while (usadas.has(chave)) chave = base.slice(0, LIMITE_CHAVE - 4) + '-' + n++;
  usadas.add(chave);
  return chave;
}

const itens = []; // { chave, titulo, texto, ordem, meta, extra }
const porNum = new Map();

bruto.fichas.filter((f) => !f.tipoAliado).sort((a, b) => a.num - b.num).forEach(function (f) {
  const nome = limpar(f.nome);
  const chave = chaveUnica('item-', nome);
  const cl = classificar(f);
  const cat = parseCategoria(f.cat);
  const esp = parseEspacos(f.esp);
  const regras = (f.regras || []).map(limpar);
  const elemento = ELEMENTOS[f.elemento] !== undefined ? ELEMENTOS[f.elemento] : '';
  const meta = { t: 'item', num: f.num, fonte: f.fonte, pag: String(f.pag), tipo: cl.tipoFicha, grupo: cl.grupo, cat: cat.cat, esp: esp.esp };
  if (cat.texto) meta.catTexto = cat.texto;
  if (esp.texto) meta.espTexto = esp.texto;
  if (f.elemento) meta.elemento = elemento || 'varia';
  if (cl.uso) meta.uso = cl.uso;
  const linhas = [];
  // arma
  if (cl.arma) {
    const st = f.stats || {};
    const d = parseDano(st['DANO']);
    const c = parseCritico(st['CRÍTICO']);
    const alc = String(st['ALCANCE'] || '').replace(/\*/g, '').trim();
    const tipos = tiposDeDano(st['TIPO'] || '');
    const arma = Object.assign({}, cl.arma, { dano: d.dano });
    if (d.alt) arma.danoAlt = d.alt;
    if (d.texto && d.texto !== d.dano) arma.danoTexto = d.texto;
    if (c) { arma.margem = c.margem; arma.mult = c.mult; arma.critTexto = st['CRÍTICO']; }
    arma.alcance = alc === '—' ? '' : alc;
    arma.tipoDano = tipos[0] || '';
    if (tipos.length > 1) arma.tiposDano = tipos;
    (f.extras || []).forEach(function (e) {
      if (e.rotulo === 'MUNIÇÃO') arma.municao = e.valor;
      if (e.rotulo === 'CAPACIDADE') {
        const m = /^(\d+)/.exec(e.valor);
        if (m) arma.capacidade = Number(m[1]);
      }
    });
    meta.arma = arma;
  }
  // proteção
  if (cl.tipoFicha === 'protecao') {
    const todas = regras.join(' ');
    const def = /Defesa\s*\+(\d+)/.exec(todas);
    const pen = /impõe\s*[–-]\s*(\d+)\s+em testes de perícias com penalidade de carga/.exec(todas);
    meta.protecao = { def: def ? Number(def[1]) : 0, pen: pen ? Number(pen[1]) : 0 };
  }
  // textos
  const catRotulo = f.cat === 'VAR.' ? 'varia' : f.cat === '= CÍRC.' ? '= círculo' : f.cat;
  const cab = ['Nº ' + String(f.num).padStart(3, '0'), paraTitulo(f.tipo), 'Categoria ' + catRotulo, esp.texto || textoEspacos(esp.esp)];
  if (elemento) cab.push(NOME_ELEMENTO[elemento]);
  else if (f.elemento === 'VARIA') cab.push('Elemento varia');
  cab.push(nomeFonte(f.fonte, f.pag));
  linhas.push(cab.filter(Boolean).join(' · '));
  if (f.ambientacao) linhas.push('Ambientação: ' + limpar(f.ambientacao));
  if (meta.arma) {
    const st = f.stats || {};
    linhas.push('Estatísticas: ' + ['Dano ' + (st['DANO'] || '—'), 'Crítico ' + (st['CRÍTICO'] || '—'), 'Alcance ' + (st['ALCANCE'] || '—'), 'Tipo ' + (st['TIPO'] || '—')].join(' · '));
    const mun = (f.extras || []).find((e) => e.rotulo === 'MUNIÇÃO');
    const cap = (f.extras || []).find((e) => e.rotulo === 'CAPACIDADE');
    if (mun || cap) linhas.push('Munição: ' + [mun ? limpar(mun.valor) : '', cap ? 'capacidade ' + limpar(cap.valor) : ''].filter(Boolean).join(' · '));
  }
  regras.forEach(function (p, i) { linhas.push((i === 0 ? 'Regras: ' : '') + p); });
  if (f.nota) linhas.push('Nota de revisão: ' + limpar(f.nota));
  const entrada = { chave: chave, titulo: nome, linhas: linhas, meta: meta, num: f.num, ordem: f.num, regras: regras.join(' ') };
  itens.push(entrada);
  porNum.set(f.num, entrada);
});

/* ---------- itens sem ficha numerada ---------- */
let ordemExtra = 1000;
function adicionarItem(nome, meta, linhas) {
  const chave = chaveUnica('item-', nome);
  const entrada = { chave: chave, titulo: nome, linhas: linhas, meta: Object.assign({ t: 'item' }, meta), ordem: ordemExtra++ };
  itens.push(entrada);
  return entrada;
}
const caixa = (chave) => (bruto.caixas && bruto.caixas[chave]) || null;
const tabelaPorTitulo = (pagina, titulo) => bruto.tabelas.find((t) => t.pagina === pagina && t.titulo.replace(/\s+/g, ' ').indexOf(titulo) === 0);
const celula = (linha, i) => limpar((linha[i] && linha[i].texto) || '');

// Venenos (tabela da página 44)
(function () {
  const t = tabelaPorTitulo(44, 'VENENOS');
  if (!t) { problemas.push('Tabela de venenos não encontrada.'); return; }
  const inoc = caixa('inoculacao');
  t.linhas.forEach(function (l) {
    const nome = celula(l, 0);
    const cat = parseCategoria(celula(l, 4));
    const fonteTxt = /(OPRPG|SaH|AS#\d\d)\s*·\s*p\.\s*(\d+)/.exec(celula(l, 5));
    const meta = { fonte: fonteTxt ? fonteTxt[1] : '', pag: fonteTxt ? fonteTxt[2] : '', tipo: 'geral', grupo: 'veneno', cat: cat.cat, esp: 0, espTexto: 'não informado no livro', veneno: { via: celula(l, 1), dt: Number(celula(l, 2)) } };
    const linhas = ['Veneno · ' + celula(l, 1) + ' · DT ' + celula(l, 2) + ' · Categoria ' + celula(l, 4) + ' (pela regra opcional do AS#06) · ' + nomeFonte(meta.fonte, meta.pag),
      'Efeito: ' + celula(l, 3) + ' (entre parênteses, o efeito de quem passa no teste)'];
    if (inoc) inoc.paragrafos.forEach(function (p, i) { linhas.push((i === 0 ? 'Inoculação: ' : '') + limpar(p)); });
    adicionarItem(nome, meta, linhas);
  });
})();

// Veículos operacionais (tabela da página 67)
(function () {
  const t = tabelaPorTitulo(67, 'VEÍCULOS OPERACIONAIS');
  if (!t) { problemas.push('Tabela de veículos não encontrada.'); return; }
  const leg = caixa('veiculos-legenda');
  const textoLeg = leg ? leg.paragrafos.join(' ') : '';
  t.linhas.forEach(function (l) {
    const catTxt = celula(l, 0);
    const cat = parseCategoria(catTxt);
    const m = new RegExp(catTxt + ': ([^·.]+)').exec(textoLeg);
    const rdPv = celula(l, 3).split(' ');
    const regalias = Number(celula(l, 6));
    const meta = { fonte: 'AS#03', pag: '125', tipo: 'geral', grupo: 'veiculo', cat: cat.cat, esp: 0, espTexto: 'veículo', limite: regalias,
      veiculo: { tamanho: celula(l, 1), defesa: celula(l, 2), rd: Number(rdPv[0]), pv: Number(rdPv[1]), ocupantes: celula(l, 4), carga: celula(l, 5) } };
    const linhas = ['Veículo · Categoria ' + catTxt + ' · ' + celula(l, 1) + ' · AS#03 p. 125',
      m ? 'Descrição: ' + limpar(m[1]) : null,
      'Estatísticas: Defesa ' + celula(l, 2) + ' · RD ' + rdPv[0] + ' · PV ' + rdPv[1],
      'Ocupantes: ' + celula(l, 4), 'Carga: ' + celula(l, 5),
      'Regalias: ' + regalias + ' (veja Regalias de veículos)',
      textoLeg.indexOf('Defesa soma a Agilidade') >= 0 ? 'Observação: a Defesa soma a Agilidade do motorista.' : null].filter(Boolean);
    adicionarItem('Veículo operacional (categoria ' + catTxt + ')', meta, linhas);
  });
})();

// Catalisadores ritualísticos (caixa da página 49) e itens de origem (página 50)
(function () {
  const c = caixa('catalisadores');
  if (!c) { problemas.push('Caixa de catalisadores não encontrada.'); return; }
  const geral = limpar(c.paragrafos[0]);
  c.paragrafos.filter((p) => /^▸ /.test(p)).forEach(function (p) {
    const m = /^▸ ([^:]+): (.*)$/.exec(p);
    if (!m) return;
    adicionarItem('Catalisador ritualístico: ' + m[1], { fonte: 'SaH', pag: '44', tipo: 'geral', grupo: 'paranormal', cat: 1, esp: 0.5, uso: 'consumivel' }, [
      'Item paranormal · Catalisador ritualístico · Categoria I · 0,5 espaço · SaH p. 44', 'Efeito: ' + limpar(m[2]), 'Regras: ' + geral]);
  });
  const o = caixa('itens-de-origem');
  if (!o) { problemas.push('Caixa de itens de origem não encontrada.'); return; }
  o.paragrafos.forEach(function (p) {
    const m = /^(.+?) CAT\. (\S+) · ([\d,]+) ESP\. · SAH · P\. (\d+) Origem (.+?)\. (.*)$/.exec(p);
    if (!m) { problemas.push('Item de origem não reconhecido: ' + p.slice(0, 50)); return; }
    adicionarItem(m[1], { fonte: 'SaH', pag: m[4], tipo: 'geral', grupo: 'outro', cat: ROMANOS[m[2]], esp: numeroBr(m[3]), origem: m[5] }, [
      'Item de origem · Categoria ' + m[2] + ' · ' + textoEspacos(numeroBr(m[3])) + ' · SaH p. ' + m[4], 'Origem: ' + limpar(m[5]), 'Regras: ' + limpar(m[6])]);
  });
})();

// Drone: acrescenta o aliado drone e os tipos de aliado ao texto da ficha Nº 238
(function () {
  const drone = porNum.get(238);
  if (!drone) return;
  const aliado = caixa('aliado-drone');
  if (aliado) aliado.paragrafos.forEach(function (p, i) { drone.linhas.push((i === 0 ? 'Aliado drone: ' : '') + limpar(p)); });
  bruto.fichas.filter((f) => f.tipoAliado).forEach(function (f) {
    drone.linhas.push('Tipo de aliado, ' + limpar(f.nome) + ': ' + [limpar(f.ambientacao)].concat((f.regras || []).map(limpar)).filter(Boolean).join(' '));
  });
  const acum = caixa('acumulando-efeitos-de-drones');
  if (acum) acum.paragrafos.forEach(function (p, i) { drone.linhas.push((i === 0 ? 'Acumulando efeitos: ' : '') + limpar(p)); });
})();

// ajustes por item (grupo, tipo da ficha...)
itens.forEach(function (it) {
  const a = ajItens[it.chave];
  if (!a) return;
  if (a.grupo) { if (!grupoItem(a.grupo)) problemas.push('Ajuste: natureza inválida "' + a.grupo + '" em ' + it.chave); else it.meta.grupo = a.grupo; }
  if (a.tipo) it.meta.tipo = a.tipo;
  if (a.esp !== undefined) it.meta.esp = a.esp;
});
Object.keys(ajItens).forEach(function (k) { if (!itens.some((i) => i.chave === k)) problemas.push('Ajuste para item que não existe: ' + k); });

// "Conta como medicamento" (Aplicador de adrenalina, Cicatrizante) entra na natureza medicamento
itens.forEach(function (it) {
  if (it.meta.grupo === 'operacional' && /conta como medicamento/i.test(it.regras || '')) {
    it.meta.grupo = 'medicamento';
    avisos.push('"' + it.titulo + '" conta como medicamento (as regras do livro dizem isso): natureza medicamento.');
  }
});

/* ---------- melhorias ---------- */
const melhorias = [];
const ORDEM_MEL = { modificacao: 0, maldicao: 1000, regalia: 2000 };
const precos = {};
(function () {
  const p = caixa('preco-da-maldicao');
  if (!p) { problemas.push('Caixa "O preço da maldição" não encontrada.'); return; }
  p.paragrafos.forEach(function (par) {
    const m = /^(CONHECIMENTO|ENERGIA|MORTE|SANGUE|MEDO) (.*)$/.exec(par);
    if (m) precos[m[1].toLowerCase()] = limpar(m[2]);
  });
})();

const ELEM_CURTO = { 'CONHEC.': 'conhecimento', ENERGIA: 'energia', MORTE: 'morte', SANGUE: 'sangue', MEDO: 'medo', VARIA: '' };

function adicionarMelhoria(prefixo, nome, cls, grupo, fonteTxt, extra, linhas, nomeDaChave) {
  const classe = classeMelhoria(cls);
  const chave = chaveUnica(prefixo, nomeDaChave || nome);
  const f = /(OPRPG|SaH|AS#\d\d)\s*·\s*p\.\s*(\d+)/.exec(fonteTxt || '');
  const meta = Object.assign({ t: 'melhoria', cls: cls, grupo: grupo, fonte: f ? f[1] : '', pag: f ? f[2] : '' }, extra || {});
  const aj = ajMelhorias[chave];
  if (aj) {
    ['aj', 'so', 'somente', 'tambem', 'exclui', 'max'].forEach(function (k) { if (aj[k] !== undefined) meta[k] = aj[k]; });
  }
  melhorias.push({ chave: chave, titulo: nome, linhas: linhas, meta: meta, ordem: ORDEM_MEL[cls] + melhorias.filter((m) => m.meta.cls === cls).length, classe: classe });
}

const nomesDosAlvos = (alvos) => alvos.map((a) => grupoItem(a).nome);
function alvosEfetivos(meta) {
  const g = grupoMelhoria(meta.grupo);
  return meta.so && meta.so.length ? meta.so.filter((a) => g.alvos.indexOf(a) !== -1) : g.alvos;
}

function textoAumento(cls) {
  const c = classeMelhoria(cls);
  if (cls === 'modificacao' || cls === 'regalia') return '+1 categoria';
  if (cls === 'maldicao') return 'a 1ª maldição do item soma +2 categorias, as seguintes +1';
  return c ? 'não muda a categoria' : '';
}

// tabelas de modificações
const TABELA_MOD = [
  [25, 'ARMAS CORPO A CORPO E DE DISPARO', 'mod-corpo-disparo', 'corpo-disparo'], [25, 'ARMAS DE FOGO', 'mod-fogo', 'fogo'],
  [25, 'MUNIÇÕES', 'mod-municao', 'municao'], [25, 'GRANADAS', 'mod-granada', 'granada'],
  [26, 'PROTEÇÕES', 'mod-protecao', 'protecao'], [26, 'ACESSÓRIOS', 'mod-acessorio', 'acessorio'],
  [26, 'MEDICAMENTOS', 'mod-medicamento', 'medicamento'], [26, 'ITENS PARANORMAIS', 'mod-paranormal', 'paranormal'],
  [72, 'MODIFICAÇÕES PARA DRONES', 'mod-drone', 'drone']
];
const nomesMod = {};
TABELA_MOD.forEach(function (x) {
  const t = tabelaPorTitulo(x[0], x[1]);
  if (!t) { problemas.push('Tabela de modificações não encontrada: ' + x[1]); return; }
  t.linhas.forEach(function (l) { const n = celula(l, 0); nomesMod[slug(n)] = (nomesMod[slug(n)] || 0) + 1; });
});
TABELA_MOD.forEach(function (x) {
  const t = tabelaPorTitulo(x[0], x[1]);
  if (!t) return;
  t.linhas.forEach(function (l) {
    const nome = celula(l, 0);
    const repetido = nomesMod[slug(nome)] > 1;
    const chaveNome = repetido ? nome + ' ' + x[3] : nome;
    const g = grupoMelhoria(x[2]);
    const efeito = celula(l, 1);
    const drone = x[2] === 'mod-drone';
    const fonteTxt = drone ? 'AS#09 · p. 47' : celula(l, 2);
    const linhas = [];
    adicionarMelhoria('mod-', nome, 'modificacao', x[2], fonteTxt, {}, linhas, chaveNome);
    const m = melhorias[melhorias.length - 1];
    linhas.push(['Modificação', g.nome, textoAumento('modificacao'), nomeFonte(m.meta.fonte, m.meta.pag)].filter(Boolean).join(' · '));
    linhas.push('Efeito: ' + efeito);
    if (drone) linhas.push('Drones complexos: ' + celula(l, 2));
    linhas.push('Serve para: ' + nomesDosAlvos(alvosEfetivos(m.meta)).join(', ') + (m.meta.somente ? ' (somente itens específicos)' : ''));
  });
});

// maldições
const TABELA_MAL = [[53, 'MALDIÇÕES PARA ARMAS', 'mal-arma'], [53, 'MALDIÇÕES PARA PROTEÇÕES', 'mal-protecao'],
  [54, 'MALDIÇÕES PARA ACESSÓRIOS', 'mal-acessorio'], [54, 'MALDIÇÕES PARA MEDICAMENTOS', 'mal-medicamento']];
TABELA_MAL.forEach(function (x) {
  const t = tabelaPorTitulo(x[0], x[1]);
  if (!t) { problemas.push('Tabela de maldições não encontrada: ' + x[1]); return; }
  const g = grupoMelhoria(x[2]);
  t.linhas.forEach(function (l) {
    const nome = celula(l, 0);
    const elem = ELEM_CURTO[celula(l, 1)];
    if (elem === undefined) problemas.push('Elemento de maldição não reconhecido: ' + celula(l, 1) + ' (' + nome + ')');
    const linhas = [];
    adicionarMelhoria('mal-', nome, 'maldicao', x[2], celula(l, 3), elem ? { elemento: elem } : { elemento: 'varia' }, linhas);
    const m = melhorias[melhorias.length - 1];
    linhas.push(['Maldição', elem ? NOME_ELEMENTO[elem] : 'Elemento varia', g.nome, textoAumento('maldicao'), nomeFonte(m.meta.fonte, m.meta.pag)].filter(Boolean).join(' · '));
    linhas.push('Efeito: ' + celula(l, 2));
    if (elem && precos[elem]) linhas.push('Preço: ' + precos[elem]);
    else if (!elem) linhas.push('Preço: segue o elemento do item contra o qual protege.');
    linhas.push('Serve para: ' + nomesDosAlvos(alvosEfetivos(m.meta)).join(', '));
  });
});

// regalias de veículos
[[68, 'REGALIAS DE VEÍCULOS'], [69, '']].forEach(function (x) {
  const t = x[1] ? tabelaPorTitulo(x[0], x[1]) : bruto.tabelas.find((tb) => tb.pagina === x[0] && tb.colunas[0] === 'REGALIA');
  if (!t) { problemas.push('Tabela de regalias não encontrada: página ' + x[0]); return; }
  t.linhas.forEach(function (l) {
    const linhas = [];
    adicionarMelhoria('reg-', celula(l, 0), 'regalia', 'reg-veiculo', celula(l, 2), {}, linhas);
    const m = melhorias[melhorias.length - 1];
    linhas.push(['Regalia', 'Regalias de veículos', textoAumento('regalia'), nomeFonte(m.meta.fonte, m.meta.pag)].filter(Boolean).join(' · '));
    linhas.push('Efeito: ' + celula(l, 1));
    linhas.push('Serve para: Veículo');
  });
});
Object.keys(ajMelhorias).forEach(function (k) { if (!melhorias.some((m) => m.chave === k)) problemas.push('Ajuste para melhoria que não existe: ' + k); });

// textos de regras gerais (aparecem junto das melhorias)
function regraGeral(chave, titulo, classe, fontes) {
  const linhas = [];
  fontes.forEach(function (f) { f.forEach(function (p, i) { linhas.push((linhas.length === 0 ? 'Regras: ' : '') + limpar(p)); }); });
  if (!linhas.length) return;
  melhorias.push({ chave: chave, titulo: titulo, linhas: [titulo + ' · regras gerais'].concat(linhas), meta: { t: 'regra', cls: classe }, ordem: ORDEM_MEL[classe] - 1 });
  usadas.add(chave);
}
const abertura = (p) => (bruto.aberturas && bruto.aberturas[String(p)]) || '';
regraGeral('regras-modificacoes', 'Regras das modificações', 'modificacao', [[abertura(24)], (caixa('exemplo-acessorio-modificado') || { paragrafos: [] }).paragrafos]);
regraGeral('regras-maldicoes', 'Regras das maldições', 'maldicao', [[abertura(51)], (caixa('adquirindo-e-usando') || { paragrafos: [] }).paragrafos, (caixa('acessorios-amaldicoados') || { paragrafos: [] }).paragrafos,
  Object.keys(precos).map((k) => 'Preço, ' + NOME_ELEMENTO[k] + ': ' + precos[k])]);
regraGeral('regras-regalias', 'Regras das regalias de veículos', 'regalia', [[abertura(66)]]);

/* ---------- compatibilidade ---------- */
/** Mesma regra da ficha (js/calc.js, melhoriaCabeNoItem). */
function cabe(item, mel) {
  if (mel.meta.tambem && mel.meta.tambem.indexOf(item.chave) !== -1) return true;
  if (mel.meta.somente && mel.meta.somente.indexOf(item.chave) === -1) return false;
  return alvosEfetivos(mel.meta).indexOf(item.meta.grupo) !== -1;
}

/* ---------- conferências ---------- */
// referências de chaves nos ajustes
melhorias.forEach(function (m) {
  ['somente', 'tambem'].forEach(function (k) {
    (m.meta[k] || []).forEach(function (c) { if (!itens.some((i) => i.chave === c)) problemas.push('Melhoria ' + m.chave + ' cita item que não existe: ' + c); });
  });
  (m.meta.exclui || []).forEach(function (c) { if (!melhorias.some((x) => x.chave === c)) problemas.push('Melhoria ' + m.chave + ' cita melhoria que não existe em "exclui": ' + c); });
  (m.meta.so || []).forEach(function (a) { if (!grupoItem(a)) problemas.push('Melhoria ' + m.chave + ' cita natureza inválida em "so": ' + a); });
});
// cada melhoria precisa servir para algum item do catálogo
melhorias.filter((m) => m.meta.t === 'melhoria').forEach(function (m) {
  if (!itens.some((i) => cabe(i, m))) avisos.push('Melhoria sem nenhum item compatível no catálogo: ' + m.titulo + ' (' + m.chave + ')');
});

// confere ficha x tabelas-resumo do livro (categoria e espaços)
const todasChaves = new Map(itens.map((i) => [slug(i.titulo), i]));
let conferidas = 0;
bruto.tabelas.forEach(function (t) {
  const iCat = t.colunas.findIndex((c) => /^CAT\./.test(c));
  const iEsp = t.colunas.findIndex((c) => /^ESP\./.test(c));
  if (iCat < 0 || iEsp < 0 || /^MUNIÇÃO$/.test(t.colunas[0])) return;
  t.linhas.forEach(function (l) {
    const nome = celula(l, 0);
    if (!celula(l, iCat)) return; // linha de subtítulo
    const it = todasChaves.get(slug(nome));
    if (!it) { if (!/\(|\(elemento\)|catalisadores/i.test(nome)) avisos.push('Tabela p.' + t.pagina + ': "' + nome + '" não tem ficha com o mesmo nome.'); return; }
    const catTabela = celula(l, iCat).replace(/^1$/, 'I').replace(/^2$/, 'II');
    if (!(catTabela in ROMANOS)) return; // "I/II", "= círculo": a ficha explica
    conferidas += 1;
    const cat = parseCategoria(catTabela);
    const esp = celula(l, iEsp) === '—' ? 0 : numeroBr(celula(l, iEsp));
    if (cat.cat !== it.meta.cat && !it.meta.catTexto) avisos.push('Categoria: tabela p.' + t.pagina + ' diz ' + celula(l, iCat) + ' e a ficha ' + NOME_ROMANO[it.meta.cat] + ' (' + nome + ')');
    if (esp !== it.meta.esp && !it.meta.espTexto) avisos.push('Espaços: tabela p.' + t.pagina + ' diz ' + celula(l, iEsp) + ' e a ficha ' + it.meta.esp + ' (' + nome + ')');
  });
});

/* ---------- saída ---------- */
function montarEscopo(lista) {
  return lista.sort((a, b) => a.ordem - b.ordem).map(function (e, i) {
    const texto = e.linhas.join('\n') + '\n\n§AUTO§' + JSON.stringify(e.meta);
    return { chave: e.chave, titulo: e.titulo, texto: texto, ordem: i };
  });
}
const saidaItens = montarEscopo(itens);
const saidaMelhorias = montarEscopo(melhorias);
const pacotes = { itens: saidaItens, melhorias: saidaMelhorias };
Object.keys(pacotes).forEach(function (nome) {
  const lista = pacotes[nome];
  if (lista.length > 500) problemas.push(nome + ': ' + lista.length + ' itens (o Worker aceita até 500)');
  lista.forEach(function (it, i) {
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(it.chave)) problemas.push(nome + ' item ' + (i + 1) + ': chave inválida "' + it.chave + '"');
    if (!it.titulo || it.titulo.length > 200) problemas.push(nome + ' item ' + (i + 1) + ': título vazio ou longo demais');
    if (!it.texto || it.texto.length > 100000) problemas.push(nome + ' item ' + (i + 1) + ': texto vazio ou maior que 100 mil caracteres');
  });
  fs.writeFileSync(path.join(pastaSaida, nome + '.json'), JSON.stringify({ itens: lista }, null, 1));
});

// matriz de compatibilidade (legível)
(function () {
  const L = [];
  const ml = melhorias.filter((m) => m.meta.t === 'melhoria');
  L.push('# Compatibilidade: natureza do item × melhoria', '',
    'Gerado de `data/melhorias.js` e do compêndio. Uma melhoria aceita as naturezas do seu grupo (a tabela do livro) e, se o ajuste diz, só alguns itens (`somente`) ou também outros (`tambem`).', '');
  L.push('## Resumo por classe', '', '| Natureza do item | ' + D.classesMelhoria.map((c) => c.plural).join(' | ') + ' |', '|---|' + D.classesMelhoria.map(() => '---').join('|') + '|');
  D.gruposItem.forEach(function (g) {
    const cel = D.classesMelhoria.map(function (c) {
      const gs = D.gruposMelhoria.filter((x) => x.classe === c.id && x.alvos.indexOf(g.id) !== -1);
      const n = ml.filter((m) => m.meta.cls === c.id && itens.some((i) => i.meta.grupo === g.id && cabe(i, m))).length;
      if (gs.length) return '✔ ' + n + ' (' + gs.map((x) => x.nome).join('; ') + ')';
      return n ? '✔ ' + n + ' (só por exceção)' : '—';
    });
    L.push('| ' + g.nome + ' | ' + cel.join(' | ') + ' |');
  });
  L.push('', '## Por natureza de item', '');
  D.gruposItem.forEach(function (g) {
    const its = itens.filter((i) => i.meta.grupo === g.id);
    L.push('### ' + g.nome + ' (' + its.length + ' ' + (its.length === 1 ? 'item' : 'itens') + ')', '');
    if (its.length) L.push('Itens: ' + its.map((i) => i.titulo).join(', '), '');
    D.classesMelhoria.forEach(function (c) {
      const aceitas = ml.filter((m) => m.meta.cls === c.id && alvosEfetivos(m.meta).indexOf(g.id) !== -1);
      const extras = ml.filter((m) => m.meta.cls === c.id && alvosEfetivos(m.meta).indexOf(g.id) === -1 && itens.some((i) => i.meta.grupo === g.id && cabe(i, m)));
      if (!aceitas.length && !extras.length) return;
      L.push('- **' + c.plural + ':** ' + aceitas.map(function (m) {
        const nota = m.meta.somente ? ' [só ' + m.meta.somente.map((k) => itens.find((i) => i.chave === k).titulo).join(' e ') + ']' : '';
        return m.titulo + nota;
      }).concat(extras.map((m) => m.titulo + ' [por exceção]')).join(', '));
    });
    L.push('');
  });
  L.push('## Por melhoria', '');
  ml.forEach(function (m) {
    const ok = itens.filter((i) => cabe(i, m));
    L.push('- **' + m.titulo + '** (' + classeMelhoria(m.meta.cls).nome + ' · ' + grupoMelhoria(m.meta.grupo).nome + (m.meta.aj ? ' · ajustes ' + JSON.stringify(m.meta.aj) : '') + '): ' + nomesDosAlvos(alvosEfetivos(m.meta)).join(', ') + ' — ' + ok.length + ' ' + (ok.length === 1 ? 'item' : 'itens') + ' do catálogo');
  });
  fs.writeFileSync(path.join(pastaSaida, 'compatibilidade.md'), L.join('\n') + '\n');
})();

const contagem = (cls) => melhorias.filter((m) => m.meta.cls === cls && m.meta.t === 'melhoria').length;
const relatorio = [
  'Itens: ' + saidaItens.length + ' (' + itens.filter((i) => i.meta.num).length + ' fichas numeradas + ' + itens.filter((i) => !i.meta.num).length + ' sem Nº: venenos, veículos, catalisadores, itens de origem)',
  'Melhorias: ' + saidaMelhorias.length + ' (' + contagem('modificacao') + ' modificações, ' + contagem('maldicao') + ' maldições, ' + contagem('regalia') + ' regalias + ' + melhorias.filter((m) => m.meta.t === 'regra').length + ' textos de regras)',
  'Conferidas contra as tabelas-resumo do livro (categoria e espaços): ' + conferidas,
  'Melhorias com ajustes numéricos (aj): ' + melhorias.filter((m) => m.meta.aj).length + ' · com restrição "so/somente/tambem": ' + melhorias.filter((m) => m.meta.so || m.meta.somente || m.meta.tambem).length
];
if (avisos.length) relatorio.push('', 'Avisos (' + avisos.length + '):', ...avisos.map((a) => ' - ' + a));
if (problemas.length) relatorio.push('', 'PROBLEMAS (' + problemas.length + '):', ...problemas.map((a) => ' - ' + a));
fs.writeFileSync(path.join(pastaSaida, 'relatorio.txt'), relatorio.join('\n') + '\n');
console.log(relatorio.join('\n'));
if (problemas.length) process.exitCode = 1;
