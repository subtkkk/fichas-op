/* ==========================================================================
   tools/gerar-conteudo.mjs — gera, a partir do txt do livro, os arquivos de
   conteúdo protegido (tudo que vem do livro fica SÓ no servidor).

   Uso:   node tools/gerar-conteudo.mjs <arquivo.txt> <pasta-de-saida> [pasta-de-efeitos]

   Saída (na pasta indicada, FORA do repositório):
   - habilidades.json, rituais.json, origens.json: para importar em
     admin.html → "Conteúdo protegido" ({ itens: [{ chave, titulo, texto, ordem }] });
   - bruto.json: todos os campos separados (consulta; contém texto do livro).

   Cada "texto" tem o texto do livro e, no fim, uma linha "§AUTO§{...}" com os dados
   para a ficha automatizar: classificação (origem, classe, trilha, círculo, elemento…)
   e os efeitos. A pasta de efeitos (opcional) tem arquivos .json { "<chave>": { efeitos } }
   (formato em data/efeitos.js). O site separa o texto dessa linha ao carregar.

   NADA do livro entra no repositório: guarde o txt e a pasta de saída fora dele.
   As chaves (chave) são estáveis: o conteúdo e a ficha se ligam por elas.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , arquivoTxt, pastaSaida, pastaEfeitos] = process.argv;
if (!arquivoTxt || !pastaSaida) {
  console.error('Uso: node tools/gerar-conteudo.mjs <arquivo.txt> <pasta-de-saida> [pasta-de-efeitos]');
  process.exit(1);
}
if (path.resolve(pastaSaida).startsWith(raiz + path.sep) || path.resolve(arquivoTxt).startsWith(raiz + path.sep)) {
  console.error('O txt e a pasta de saída devem ficar FORA do repositório (o texto do livro não pode entrar nele).');
  process.exit(1);
}
fs.mkdirSync(pastaSaida, { recursive: true });

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
['data/config.js', 'data/origens.js', 'data/trilhas.js', 'data/classes.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx);
});
const D = ctx.OP.data;

const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PEQUENAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'ao', 'à', 'um', 'uma', 'que', 'se', 'ou']);
function titulo(nome) {
  if (nome !== nome.toUpperCase()) return nome;
  return nome.toLowerCase().split(/(\s+|-|\/)/).map(function (p, i) {
    if (/^(\s+|-|\/)$/.test(p) || !p) return p;
    if (i > 0 && PEQUENAS.has(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join('');
}

/* ---------- leitura do txt ---------- */
const linhas = fs.readFileSync(arquivoTxt, 'utf8').replace(/\r/g, '').split('\n');
const blocos = [];
let atual = null;
linhas.forEach(function (l) {
  if (/^Nome: /.test(l)) { atual = { nome: l.slice(6).trim(), linhas: [] }; blocos.push(atual); return; }
  if (atual) atual.linhas.push(l);
});

const ROTULOS = /^(Tag|Tipo|Classe|Trilha|NEX|Estágio|Categoria|Página|Descrição|Execução|Alcance|Alvo|Alvos|Área|Duração|Resistência|Pré-requisito|Afinidade|Perícias treinadas|Poder da origem|Efeito do poder|Gatilho|Efeito|Especial|Regra opcional): (.*)$/;
const usados = new Set(); // as chaves são únicas entre TODOS os conteúdos (um ritual e uma habilidade podem ter o mesmo nome)
const entradas = [];
blocos.forEach(function (bloco) {
  const campos = {};
  const outras = [];
  const todas = [];
  bloco.linhas.forEach(function (l) {
    if (l.trim() === '') return;
    const m = ROTULOS.exec(l);
    if (m) {
      campos[m[1]] = (campos[m[1]] ? campos[m[1]] + '\n' : '') + m[2].trim();
      if (!/^(Tag|Tipo|Classe|Trilha|NEX|Estágio|Categoria|Página)$/.test(m[1])) todas.push(l.trim());
      return;
    }
    outras.push(l.trim());
    todas.push(l.trim());
  });
  const tipo = campos.Tipo || '';
  const escopo = tipo === 'Origem' ? 'origens' : tipo === 'Ritual' ? 'rituais' : 'habilidades';
  const nome = titulo(bloco.nome);
  const contexto = [tipo, campos.Classe, campos.Trilha, campos.NEX || campos['Estágio']].filter(Boolean).join(' ');
  let chave = slug(nome);
  if (usados.has(chave)) chave = slug(nome + ' ' + contexto);
  let n = 2;
  const base = chave;
  while (usados.has(chave)) chave = base + '-' + n++;
  usados.add(chave);
  const cab = [tipo];
  if (campos.Classe) cab.push(campos.Classe);
  if (campos.Trilha) cab.push('Trilha ' + titulo(campos.Trilha));
  if (campos.NEX) cab.push('NEX ' + campos.NEX);
  if (campos['Estágio']) cab.push('Estágio ' + campos['Estágio']);
  if (campos.Categoria) cab.push(campos.Categoria);
  if (campos.Tag && campos.Tag !== '—') cab.push(campos.Tag);
  if (campos['Página']) cab.push('p. ' + campos['Página']);
  entradas.push({ chave: chave, escopo: escopo, nome: nome, campos: campos, outras: outras, texto: [cab.join(' · ')].concat(todas).join('\n') });
});

/* ---------- classificação (vai na linha §AUTO§, não no repositório) ---------- */
function fonteDaTag(tag) {
  const m = /^(AS-\d\d)/.exec(tag || '');
  if (m) return m[1];
  return tag === 'SaH' ? 'SaH' : 'livro';
}
const semAcento = (s) => slug(String(s).replace(/\./g, ''));
const elementosIds = ['sangue', 'morte', 'conhecimento', 'energia', 'medo'];

const catalogo = { origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [] };
const problemas = [];

entradas.filter((e) => e.campos.Tipo === 'Origem').forEach(function (e) {
  const d = D.origens.find((x) => semAcento(x.nome) === semAcento(e.nome) || x.id === e.chave) ||
    (e.chave === 'atleta' ? D.origens.find((x) => x.id === 'pe-atleta') : null);
  if (d) catalogo.origens[d.id] = e.chave;
  else problemas.push('Origem sem correspondência: ' + e.nome);
});

entradas.filter((e) => e.campos.Tipo === 'Habilidade de trilha' && (e.campos.NEX || e.campos['Estágio'])).forEach(function (e) {
  const classe = slug(e.campos.Classe);
  const nomeTrilha = slug(e.campos.Trilha);
  const t = D.trilhas.find((x) => x.classe === classe && slug(x.nome) === nomeTrilha);
  const marco = String(parseInt(e.campos.NEX || e.campos['Estágio'], 10));
  if (!t) { problemas.push('Trilha sem correspondência: ' + e.campos.Trilha); return; }
  if (slug(t.habilidades[marco] || '') !== slug(e.nome)) problemas.push('Habilidade de trilha com nome diferente: ' + t.id + ' ' + marco + ' (' + t.habilidades[marco] + ' x ' + e.nome + ')');
  (catalogo.trilhas[t.id] = catalogo.trilhas[t.id] || {})[marco] = e.chave;
});

entradas.filter((e) => e.campos.Tipo === 'Habilidade de classe').forEach(function (e) {
  const classe = slug(e.campos.Classe);
  (catalogo.classe[classe] = catalogo.classe[classe] || []).push({ chave: e.chave, nome: e.nome });
});

function categoriaPoder(cat) {
  const c = slug(cat || '');
  if (c.indexOf('combate') === 0) return 'combate';
  if (c.indexOf('utilidade') === 0) return 'utilidade';
  if (c.indexOf('ambos') === 0) return 'ambos';
  if (c.indexOf('varios') === 0) return 'varios';
  return c;
}
entradas.filter((e) => /^Poder (de classe|geral|paranormal)$/.test(e.campos.Tipo)).forEach(function (e) {
  const tipo = e.campos.Tipo === 'Poder de classe' ? 'classe' : e.campos.Tipo === 'Poder geral' ? 'geral' : 'paranormal';
  const p = { id: e.chave, nome: e.nome, tipo: tipo, categoria: categoriaPoder(e.campos.Categoria), fonte: fonteDaTag(e.campos.Tag) };
  if (tipo === 'classe') p.classe = slug(e.campos.Classe);
  catalogo.poderes.push(p);
});

/** "Vontade parcial" → { teste: 'vontade', efeito: 'parcial' } */
function resistencia(texto) {
  const t = slug(texto || '');
  const teste = /^(fortitude|reflexos|vontade)/.exec(t);
  let efeito = '';
  if (/reduz/.test(t)) efeito = 'reduz_metade';
  else if (/anula/.test(t)) efeito = 'anula';
  else if (/desacredita/.test(t)) efeito = 'desacredita';
  else if (/parcial/.test(t)) efeito = 'parcial';
  else if (/evita/.test(t)) efeito = 'evita';
  else if (/veja-texto/.test(t)) efeito = 'ver_texto';
  return { teste: teste ? teste[1] : '', efeito: efeito };
}
function execucao(texto) {
  const t = String(texto || '').toLowerCase().replace(/^ação /, '');
  return t;
}
function forma(linhas, rotulo) {
  const linha = linhas.find((l) => l.indexOf(rotulo + ' (+') === 0);
  if (!linha) return null;
  const custo = /\(\+(\d+) PE\)/.exec(linha);
  const circ = /Requer (\d)º círculo/.exec(linha);
  const f = { custoAdicional: custo ? Number(custo[1]) : 0 };
  if (circ) f.requerCirculo = Number(circ[1]);
  if (/Requer[^.]*afinidade/.test(linha)) f.requerAfinidade = true;
  return f;
}
entradas.filter((e) => e.campos.Tipo === 'Ritual').forEach(function (e) {
  const partes = String(e.campos.Categoria || '').split(' · ');
  const circ = /(\d)º Círculo/.exec(e.campos.Categoria || '');
  const elementos = partes.map((p) => slug(p)).filter((p) => elementosIds.indexOf(p) !== -1);
  const r = {
    id: e.chave, nome: e.nome, circulo: circ ? Number(circ[1]) : 1, elemento: elementos[0] || '', fonte: fonteDaTag(e.campos.Tag),
    execucao: execucao(e.campos['Execução']), alcance: String(e.campos.Alcance || '').toLowerCase(), duracao: String(e.campos['Duração'] || '').toLowerCase()
  };
  if (elementos.length > 1) r.elementos = elementos;
  const alvo = e.campos.Alvo || e.campos.Alvos;
  if (alvo) r.alvo = alvo;
  const area = e.campos['Área'] || e.campos.Efeito;
  if (area) r.area = area;
  if (e.campos['Resistência']) r.resistencia = resistencia(e.campos['Resistência']);
  const discente = forma(e.outras, 'Discente');
  const verdadeira = forma(e.outras, 'Verdadeiro');
  if (discente) r.discente = discente;
  if (verdadeira) r.verdadeira = verdadeira;
  catalogo.rituais.push(r);
});


/* ---------- efeitos (opcional) ---------- */
const efeitos = {};
if (pastaEfeitos) {
  fs.readdirSync(pastaEfeitos).filter((f) => f.endsWith('.json')).forEach(function (f) {
    Object.assign(efeitos, JSON.parse(fs.readFileSync(path.join(pastaEfeitos, f), 'utf8')));
  });
}
const chavesDeEntradas = new Set(entradas.map((e) => e.chave));
Object.keys(efeitos).forEach(function (chave) {
  if (!chavesDeEntradas.has(chave)) problemas.push('Efeito para chave que não existe: ' + chave);
});

/* ---------- dados para a ficha (linha §AUTO§ no fim do texto) ---------- */
const metas = {};
Object.keys(catalogo.origens).forEach(function (id) { metas[catalogo.origens[id]] = { t: 'origem', origem: id }; });
Object.keys(catalogo.trilhas).forEach(function (id) {
  Object.keys(catalogo.trilhas[id]).forEach(function (marco) { metas[catalogo.trilhas[id][marco]] = { t: 'trilha', trilha: id, marco: Number(marco) }; });
});
Object.keys(catalogo.classe).forEach(function (classe) {
  catalogo.classe[classe].forEach(function (h) { metas[h.chave] = { t: 'classe', classe: classe }; });
});
catalogo.poderes.forEach(function (p) {
  const m = { t: 'poder', tipo: p.tipo, categoria: p.categoria, fonte: p.fonte };
  if (p.classe) m.classe = p.classe;
  metas[p.id] = m;
});
catalogo.rituais.forEach(function (r) {
  const m = Object.assign({ t: 'ritual' }, r);
  delete m.id;
  delete m.nome;
  metas[r.id] = m;
});

/* ---------- conteúdo protegido ---------- */
const ordem = { origens: 0, habilidades: 0, rituais: 0 };
const protegido = { origens: [], habilidades: [], rituais: [] };
let comAuto = 0;
entradas.forEach(function (e) {
  let texto = e.texto;
  const meta = metas[e.chave];
  if (meta) {
    const dados = Object.assign({}, meta);
    if (efeitos[e.chave]) dados.ef = efeitos[e.chave];
    texto += '\n\n§AUTO§' + JSON.stringify(dados);
    comAuto += 1;
  }
  protegido[e.escopo].push({ chave: e.chave, titulo: e.nome, texto: texto, ordem: ordem[e.escopo]++ });
});
Object.keys(protegido).forEach(function (escopo) {
  fs.writeFileSync(path.join(pastaSaida, escopo + '.json'), JSON.stringify({ itens: protegido[escopo] }, null, 1));
});
fs.writeFileSync(path.join(pastaSaida, 'bruto.json'), JSON.stringify(entradas.map(function (e) {
  return Object.assign({ chave: e.chave, escopo: e.escopo, nome: e.nome }, e.campos, { outras: e.outras });
}), null, 1));

console.log('Entradas:', entradas.length, '· origens', protegido.origens.length, '· habilidades', protegido.habilidades.length, '· rituais', protegido.rituais.length);
console.log('Com dados de automação:', comAuto, '· com efeitos:', Object.keys(efeitos).length);
if (problemas.length) console.log('Atenção:\n - ' + problemas.join('\n - '));
