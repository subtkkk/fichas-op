/* ==========================================================================
   tools/validar-efeitos.mjs — confere arquivos de efeitos (.json) antes de publicar.

   Uso:   node tools/validar-efeitos.mjs <pasta-ou-arquivo> [bruto.json]

   Cada arquivo é { "<chave>": { passivos, gastos, ativavel, usos, escolhas, formas } }
   (formato em data/efeitos.js). Confere o formato (OP.calc.validarEfeitos) e,
   se o bruto.json (gerado por tools/gerar-conteudo.mjs) for informado, se a
   chave existe. Sai com erro se houver qualquer problema.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , alvo, arquivoBruto] = process.argv;
if (!alvo) {
  console.error('Uso: node tools/validar-efeitos.mjs <pasta-ou-arquivo> [bruto.json]');
  process.exit(1);
}
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
['data/config.js', 'data/regras.js', 'data/classes.js', 'data/origens.js', 'data/trilhas.js', 'data/pericias.js', 'data/danos.js', 'data/defesa.js',
  'data/patentes.js', 'data/elementos.js', 'data/habilidades.js', 'data/resistencias.js', 'data/rituais-campos.js', 'data/condicoes.js',
  'data/alteracoes-nex.js', 'data/efeitos.js', 'js/storage.js', 'js/prefs.js', 'js/state.js', 'js/dados.js', 'js/calc.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f });
});
const OP = ctx.OP;

const arquivos = fs.statSync(alvo).isDirectory()
  ? fs.readdirSync(alvo).filter((f) => f.endsWith('.json')).map((f) => path.join(alvo, f))
  : [alvo];
const chavesBruto = arquivoBruto ? new Set(JSON.parse(fs.readFileSync(arquivoBruto, 'utf8')).map((e) => e.chave)) : null;

let total = 0;
let erros = 0;
const vistas = new Set();
arquivos.forEach(function (arquivo) {
  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch (erro) {
    console.log('✗ ' + path.basename(arquivo) + ': JSON inválido (' + erro.message + ')');
    erros += 1;
    return;
  }
  Object.keys(dados).forEach(function (chave) {
    total += 1;
    if (vistas.has(chave)) { console.log('✗ ' + chave + ': repetida em mais de um arquivo'); erros += 1; }
    vistas.add(chave);
    if (chavesBruto && !chavesBruto.has(chave)) { console.log('✗ ' + chave + ': chave que não existe no livro'); erros += 1; }
    OP.calc.validarEfeitos(chave, dados[chave]).forEach(function (p) { console.log('✗ ' + p); erros += 1; });
  });
});
console.log(total + ' fontes conferidas, ' + erros + ' problema(s).');
process.exit(erros ? 1 : 0);
