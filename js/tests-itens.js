/* ==========================================================================
   js/tests-itens.js — verificações das melhorias dos itens (data/melhorias.js,
   OP.calc, OP.state, js/livro.js e o resumo em Markdown)
   --------------------------------------------------------------------------
   Usa um catálogo INVENTADO para o teste (nenhum dado do livro entra no
   repositório) e SEMPRE restaura OP.data.catalogo.
   Não roda sozinho: o OP.runTests() (js/tests.js) chama OP.testesItens(ajuda).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  function testesItens(ajuda) {
    const calc = OP.calc;
    const fichaDeTeste = ajuda.fichaDeTeste;

    /** Catálogo de mentira: só o formato (js/livro.js) importa. */
    const CATALOGO = {
      itemPorChave: {
        'i-faca': { id: 'i-faca', nome: 'Faca de teste', grupo: 'arma-cac', tipo: 'arma', cat: 0, esp: 1 },
        'i-fuzil': { id: 'i-fuzil', nome: 'Fuzil de teste', grupo: 'arma-fogo', tipo: 'arma', cat: 2, esp: 2 },
        'i-besta': { id: 'i-besta', nome: 'Besta de teste', grupo: 'arma-disparo', tipo: 'arma', cat: 0, esp: 2 },
        'i-colete': { id: 'i-colete', nome: 'Colete pesado de teste', grupo: 'protecao-pesada', tipo: 'protecao', cat: 2, esp: 5, protecao: { def: 10, pen: 5 } },
        'i-balas': { id: 'i-balas', nome: 'Balas de teste', grupo: 'municao', cat: 0, esp: 1 },
        'i-camera': { id: 'i-camera', nome: 'Câmera de teste', grupo: 'paranormal', cat: 2, esp: 1 },
        'i-veiculo': { id: 'i-veiculo', nome: 'Veículo de teste', grupo: 'veiculo', cat: 2, esp: 0, limite: 1 }
      },
      melhoriaPorChave: {
        'm-certeira': { id: 'm-certeira', nome: 'Certeira', cls: 'modificacao', grupo: 'mod-corpo-disparo', aj: { ataque: 2 } },
        'm-cruel': { id: 'm-cruel', nome: 'Cruel', cls: 'modificacao', grupo: 'mod-corpo-disparo', aj: { dano: 2 } },
        'm-perigosa': { id: 'm-perigosa', nome: 'Perigosa', cls: 'modificacao', grupo: 'mod-corpo-disparo', aj: { margem: 2 } },
        'm-discreta': { id: 'm-discreta', nome: 'Discreta', cls: 'modificacao', grupo: 'mod-corpo-disparo', aj: { esp: -1 } },
        'm-mira': { id: 'm-mira', nome: 'Mira de teste', cls: 'modificacao', grupo: 'mod-fogo' },
        'm-carregador': { id: 'm-carregador', nome: 'Carregador de teste', cls: 'modificacao', grupo: 'mod-fogo', tambem: ['i-besta'] },
        'm-blindada': { id: 'm-blindada', nome: 'Blindada', cls: 'modificacao', grupo: 'mod-protecao', so: ['protecao-pesada'], aj: { esp: 1 } },
        'm-reforcada': { id: 'm-reforcada', nome: 'Reforçada', cls: 'modificacao', grupo: 'mod-protecao', aj: { def: 2, esp: 1 }, exclui: ['m-discreta-prot'] },
        'm-discreta-prot': { id: 'm-discreta-prot', nome: 'Discreta (proteção)', cls: 'modificacao', grupo: 'mod-protecao', so: ['protecao-leve'], aj: { esp: -1 }, exclui: ['m-reforcada'] },
        'm-dumdum': { id: 'm-dumdum', nome: 'Dum dum', cls: 'modificacao', grupo: 'mod-municao', somente: ['i-balas'] },
        'm-lente': { id: 'm-lente', nome: 'Lente', cls: 'modificacao', grupo: 'mod-paranormal', somente: ['i-camera'] },
        'm-aprimorado': { id: 'm-aprimorado', nome: 'Aprimorado', cls: 'modificacao', grupo: 'mod-acessorio', max: 2 },
        'c-antielemento': { id: 'c-antielemento', nome: 'Antielemento', cls: 'maldicao', grupo: 'mal-arma', elemento: 'conhecimento' },
        'c-cinetica': { id: 'c-cinetica', nome: 'Cinética', cls: 'maldicao', grupo: 'mal-protecao', elemento: 'energia', aj: { def: 2 } },
        'r-lataria': { id: 'r-lataria', nome: 'Lataria reforçada', cls: 'regalia', grupo: 'reg-veiculo', max: 2 },
        'r-bancos': { id: 'r-bancos', nome: 'Bancos reclináveis', cls: 'regalia', grupo: 'reg-veiculo' }
      }
    };

    function comCatalogo(conta) {
      const original = OP.data.catalogo;
      OP.data.catalogo = Object.assign({ origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [], itens: [], melhorias: [], regrasDeMelhoria: {} }, CATALOGO);
      try {
        return conta();
      } finally {
        OP.data.catalogo = original;
      }
    }

    const mel = function (classe, chave, extra) { return OP.state.novaMelhoria(Object.assign({ classe: classe, chave: chave || '', nome: chave || 'própria' }, extra || {})); };
    const item = function (dados) { return OP.state.novoItem(dados); };
    const agente = function (itens, patente) {
      return fichaDeTeste({ classe: 'combatente', nex: 50, inventario: { patente: patente || 'agente-elite' }, itens: itens });
    };
    const codigos = function (ficha) { return calc.verificarFicha(ficha).map(function (a) { return a.codigo; }).sort().join(','); };

    return [
      /* ---- dados estruturais (data/melhorias.js) ---- */
      { nome: 'Melhorias: as naturezas, classes e grupos de data/melhorias.js são coerentes entre si', obtido: function () {
        const naturezas = OP.data.gruposItem.map(function (g) { return g.id; });
        const classes = OP.data.classesMelhoria.map(function (c) { return c.id; });
        const tipos = OP.data.tiposItem.map(function (t) { return t.id; });
        return [
          new Set(naturezas).size === naturezas.length,
          OP.data.gruposItem.every(function (g) { return tipos.indexOf(g.tipo) !== -1; }),
          OP.data.gruposMelhoria.every(function (g) { return classes.indexOf(g.classe) !== -1; }),
          OP.data.gruposMelhoria.every(function (g) { return g.alvos.length > 0 && g.alvos.every(function (a) { return naturezas.indexOf(a) !== -1; }); }),
          OP.data.classesMelhoria.every(function (c) { return c.aumento.length > 0 && c.aumento.every(Number.isInteger); })
        ].join('|');
      }, esperado: 'true|true|true|true|true' },
      { nome: 'Melhorias: regalia só para veículo; maldição para armas, proteções, acessórios e medicamentos; modificação não vale para veículo', obtido: function () {
        const aceita = function (classe, natureza) { return OP.data.gruposMelhoria.some(function (g) { return g.classe === classe && g.alvos.indexOf(natureza) !== -1; }); };
        return [aceita('regalia', 'veiculo'), aceita('regalia', 'arma-fogo'), aceita('maldicao', 'arma-fogo'), aceita('maldicao', 'escudo'), aceita('maldicao', 'acessorio'),
          aceita('maldicao', 'medicamento'), aceita('maldicao', 'municao'), aceita('modificacao', 'veiculo'), aceita('modificacao', 'drone'), aceita('modificacao', 'granada')].join('|');
      }, esperado: 'true|false|true|true|true|true|false|false|true|true' },

      /* ---- modelo, migração e importação ---- */
      { nome: 'Melhorias: o item novo tem natureza, catálogo e melhorias vazios; uma ficha antiga ganha os campos', obtido: function () {
        const n = OP.state.novoItem();
        const f = OP.state.completarPadroes({ versaoModelo: 12, inventario: { itens: [{ id: 'a1', nome: 'Faca', categoria: 1 }] } });
        const it = f.inventario.itens[0];
        return [n.grupo === '', n.catalogo === '', Array.isArray(n.melhorias) && n.melhorias.length === 0, it.nome, it.categoria, it.grupo === '', it.melhorias.length, f.versaoModelo].join('|');
      }, esperado: 'true|true|true|Faca|1|true|0|14' },
      { nome: 'Melhorias: ficha exportada com melhorias volta igual; arquivo de versão mais nova é recusado', obtido: function () {
        const f = OP.state.criarFichaVazia();
        f.inventario.itens.push(item({ nome: 'Faca', grupo: 'arma-cac', catalogo: 'i-faca', melhorias: [{ id: 'm1', classe: 'maldicao', chave: 'c-antielemento', nome: 'Antielemento', elemento: 'conhecimento', nota: 'x' }] }));
        const env = OP.state.envelopeFicha(f);
        const lido = OP.state.lerImportacao(JSON.stringify(env));
        const novo = JSON.parse(JSON.stringify(env));
        novo.versao = OP.state.VERSAO_MODELO + 1;
        const recusado = OP.state.lerImportacao(JSON.stringify(novo));
        const m = lido.fichas[0].inventario.itens[0].melhorias[0];
        return [lido.ok, m.classe, m.chave, m.elemento, m.nota, lido.fichas[0].inventario.itens[0].catalogo, recusado.ok].join('|');
      }, esperado: 'true|maldicao|c-antielemento|conhecimento|x|i-faca|false' },
      { nome: 'Melhorias: importação corta em 30 por item e descarta o que não é objeto', obtido: function () {
        const muitas = [];
        for (let k = 0; k < 35; k++) muitas.push({ id: 'm' + k, classe: 'modificacao', nome: 'M' + k });
        const cheia = { versaoModelo: 13, inventario: { itens: [{ id: 'i1', nome: 'Faca', melhorias: muitas }] } };
        const suja = { versaoModelo: 13, inventario: { itens: [{ id: 'i1', nome: 'Faca', melhorias: [{ id: 'a', nome: 'A' }, 'lixo', 7, null, ['x'], { id: 'b', nome: 'B' }] }] } };
        const ler = function (bruta) { return OP.state.lerImportacao(JSON.stringify({ formato: 'op-ficha', versao: 13, ficha: bruta })).fichas[0].inventario.itens[0].melhorias; };
        const a = ler(cheia);
        const b = ler(suja);
        return [a.length, a[29].nome, b.length, b.map(function (m) { return m.nome; }).join('')].join('|');
      }, esperado: '30|M29|2|AB' },
      { nome: 'Melhorias: nome e anotação grandes demais são cortados; classe desconhecida é corrigida; natureza desconhecida vira vazia', obtido: function () {
        const bruta = { versaoModelo: 13, inventario: { itens: [{ id: 'i1', nome: 'Faca', grupo: 'xxx', melhorias: [{ id: 'm1', classe: 'inventada', nome: 'N'.repeat(300), nota: 'T'.repeat(700) }] }] } };
        const f = OP.state.lerImportacao(JSON.stringify({ formato: 'op-ficha', versao: 13, ficha: bruta })).fichas[0];
        const m = f.inventario.itens[0].melhorias[0];
        const antes = [m.nome.length, m.nota.length, m.classe, f.inventario.itens[0].grupo];
        const caminhos = calc.correcoes(f).map(function (c) { return c.caminho + '=' + c.valor; }).join(';');
        return antes.concat([caminhos]).join('|');
      }, esperado: '120|500|inventada|xxx|inventario.itens.0.grupo=;inventario.itens.0.melhorias.0.classe=modificacao' },

      /* ---- categoria (regras de data/melhorias.js; não precisam do livro) ---- */
      { nome: 'Categoria: modificação soma +I cada; a 1ª maldição +II e as seguintes +I; regalia de veículo +I cada', obtido: function () {
        const f = agente([
          item({ nome: 'A', categoria: 1, melhorias: [mel('modificacao', '', { nome: 'x' }), mel('modificacao', '', { nome: 'y' })] }),
          item({ nome: 'B', categoria: 0, melhorias: [mel('maldicao', '', { nome: 'x' }), mel('maldicao', '', { nome: 'y' }), mel('maldicao', '', { nome: 'z' })] }),
          item({ nome: 'C', categoria: 1, melhorias: [mel('modificacao', '', { nome: 'x' }), mel('maldicao', '', { nome: 'y' })] }),
          item({ nome: 'D', categoria: 2, melhorias: [mel('regalia', '', { nome: 'x' }), mel('regalia', '', { nome: 'y' })] })
        ]);
        return f.inventario.itens.map(function (i) { return calc.categoriaEfetivaItem(i); }).join(',');
      }, esperado: '3,4,4,4' },
      { nome: 'Categoria: o limite da patente conta a categoria efetiva (item I com modificação passa a valer como II)', obtido: function () {
        const f = agente([item({ nome: 'A', categoria: 1, melhorias: [mel('modificacao', '', { nome: 'x' })] }), item({ nome: 'B', categoria: 1 })], 'operador');
        const l = calc.estadoInventario(f).limitesPorCategoria;
        return [l.I.usados, l.II.usados, l.II.limite, l.II.excedeu, calc.estadoInventario(f).itens[f.inventario.itens[0].id].categoriaEfetiva].join('|');
      }, esperado: '1|1|1|false|2' },
      { nome: 'Categoria: acima de IV aparece em acimaDeIV e nas verificações; V não entra em nenhum limite', obtido: function () {
        const f = agente([item({ nome: 'Katana', categoria: 1, melhorias: [mel('modificacao', '', { nome: 'a' }), mel('modificacao', '', { nome: 'b' }), mel('modificacao', '', { nome: 'c' }), mel('modificacao', '', { nome: 'd' })] })]);
        const inv = calc.estadoInventario(f);
        return [inv.acimaDeIV.length, inv.acimaDeIV[0].categoria, inv.limites.every(function (l) { return l.usados === 0; }), codigos(f)].join('|');
      }, esperado: '1|5|true|item-acima-iv' },
      { nome: 'Categoria: maldição com patente abaixo de Agente especial gera aviso; de Agente especial em diante não', obtido: function () {
        const itens = function () { return [item({ nome: 'Machado', categoria: 0, melhorias: [mel('maldicao', '', { nome: 'Sádica' })] })]; };
        const tem = function (patente) { return codigos(agente(itens(), patente)).indexOf('maldicao-patente') !== -1; };
        return [tem('recruta'), tem('operador'), tem('agente-especial'), tem('agente-elite')].join('|');
      }, esperado: 'true|true|false|false' },
      { nome: 'Categoria: sem melhorias nada muda (categoria, limites e espaços iguais ao de antes)', obtido: function () {
        const f = agente([item({ nome: 'A', categoria: 2, espacos: 1.5, quantidade: 2 })], 'operador');
        const inv = calc.estadoInventario(f);
        return [calc.categoriaEfetivaItem(f.inventario.itens[0]), inv.limitesPorCategoria.II.usados, inv.espacosUsados, codigos(f)].join('|');
      }, esperado: '2|2|3|limite-itens' },

      /* ---- modificadores de categoria (habilidades e poderes que sobem ou baixam a categoria) ---- */
      { nome: 'Modificar categoria: o item novo vem sem modificadores; ficha de versão 13 ganha a lista; o valor entra na categoria efetiva', obtido: function () {
        const n = OP.state.novoItem();
        const f = OP.state.completarPadroes({ versaoModelo: 13, inventario: { itens: [{ id: 'a1', nome: 'Faca', categoria: 2 }] } });
        const it = f.inventario.itens[0];
        const com = item({ nome: 'X', categoria: 2, modCategoria: [{ valor: 1, fonte: 'Poder A' }, { valor: -2, fonte: 'Poder B' }] });
        return [Array.isArray(n.modCategoria) && n.modCategoria.length === 0, Array.isArray(it.modCategoria) && it.modCategoria.length === 0,
          com.modCategoria.length, com.modCategoria[0].id !== com.modCategoria[1].id, calc.ajusteDeCategoria(com), calc.categoriaEfetivaItem(com)].join('|');
      }, esperado: 'true|true|2|true|-1|1' },
      { nome: 'Modificar categoria: soma com as melhorias, pode ficar abaixo de 0 (rótulo −1) e só 1 a 4 entram nos limites', obtido: function () {
        const f = agente([
          item({ nome: 'A', categoria: 1, melhorias: [mel('modificacao', '', { nome: 'x' })], modCategoria: [{ valor: -3, fonte: 'Habilidade' }] }),
          item({ nome: 'B', categoria: 1, modCategoria: [{ valor: 1, fonte: 'Poder' }] })
        ], 'operador');
        const inv = calc.estadoInventario(f);
        const a = inv.itens[f.inventario.itens[0].id];
        return [a.categoriaBase, a.aumento, a.ajuste, a.categoriaEfetiva, calc.rotuloCategoria(a.categoriaEfetiva), inv.limitesPorCategoria.I.usados, inv.limitesPorCategoria.II.usados].join('|');
      }, esperado: '1|1|-3|-1|−1|0|1' },
      { nome: 'Modificar categoria: valor fora de −20 a +20 é cortado na conta; modificador que traz o item de V para IV tira o aviso de acima de IV', obtido: function () {
        const soma = function (valores) { return calc.ajusteDeCategoria(item({ nome: 'G', modCategoria: valores.map(function (v) { return { valor: v }; }) })); };
        const base = [item({ nome: 'Katana', categoria: 1, melhorias: ['a', 'b', 'c', 'd'].map(function (n) { return mel('modificacao', '', { nome: n }); }) })];
        const antes = codigos(agente(base));
        const reduzido = [item({ nome: 'Katana', categoria: 1, melhorias: base[0].melhorias, modCategoria: [{ valor: -1, fonte: 'Habilidade' }] })];
        return [soma([99]), soma([-500]), soma(['abc']), antes, codigos(agente(reduzido)) === '', calc.estadoInventario(agente(reduzido)).limitesPorCategoria.IV.usados].join('|');
      }, esperado: '20|-20|0|item-acima-iv|true|1' },
      { nome: 'Modificar categoria: importação corta em 20 por item, corta a fonte em 200 caracteres e descarta o que não é objeto', obtido: function () {
        const muitos = []; for (let k = 0; k < 25; k += 1) muitos.push({ id: 'c' + k, valor: k, fonte: 'F' + k });
        const bruta = { versaoModelo: 14, inventario: { itens: [{ id: 'i1', nome: 'Faca', modCategoria: muitos.concat(['lixo', 7, null]) }] } };
        const r = OP.state.lerImportacao(JSON.stringify({ formato: 'op-ficha', versao: 14, ficha: bruta })).fichas[0].inventario.itens[0].modCategoria;
        const longa = { versaoModelo: 14, inventario: { itens: [{ id: 'i1', nome: 'Faca', modCategoria: [{ id: 'c1', valor: 1, fonte: 'T'.repeat(500) }, 'lixo'] }] } };
        const l = OP.state.lerImportacao(JSON.stringify({ formato: 'op-ficha', versao: 14, ficha: longa })).fichas[0].inventario.itens[0].modCategoria;
        return [r.length, r[19].fonte, l.length, l[0].fonte.length].join('|');
      }, esperado: '20|F19|1|200' },
      { nome: 'Modificar categoria: a ficha exportada com modificadores volta igual', obtido: function () {
        const f = OP.state.criarFichaVazia();
        f.inventario.itens.push(item({ nome: 'Faca', categoria: 1, modCategoria: [{ id: 'k1', valor: -1, fonte: 'Poder X' }] }));
        const volta = OP.state.lerImportacao(JSON.stringify(OP.state.envelopeFicha(f))).fichas[0].inventario.itens[0];
        return [volta.modCategoria.length, volta.modCategoria[0].id, volta.modCategoria[0].valor, volta.modCategoria[0].fonte, calc.categoriaEfetivaItem(volta)].join('|');
      }, esperado: '1|k1|-1|Poder X|0' },
      { nome: 'Markdown: os modificadores de categoria entram na conta da categoria e numa lista com a fonte', obtido: function () {
        const f = OP.state.criarFichaVazia();
        Object.assign(f.identificacao, { classe: 'combatente', nex: 50 });
        f.inventario.patente = 'agente-elite';
        f.inventario.itens.push(item({ nome: 'Fuzil', categoria: 2, modCategoria: [{ valor: 1, fonte: 'Poder A' }, { valor: -2, fonte: 'Habilidade B' }, { valor: 0, fonte: '' }] }));
        const md = OP.exportarMd.gerar(f);
        return [md.indexOf('- **Categoria:** I (base II − 1 de modificadores)') !== -1, md.indexOf('**Modificadores de categoria (3)**') !== -1,
          md.indexOf('- +1 — Poder A') !== -1, md.indexOf('- −2 — Habilidade B') !== -1, md.indexOf('- +0 — sem fonte') !== -1,
          md.indexOf('| Fuzil | Geral | I (base II) |') !== -1].join('|');
      }, esperado: 'true|true|true|true|true|true' },

      /* ---- ajustes numéricos (precisam do catálogo do livro) ---- */
      { nome: 'Ajustes: Discreta tira 1 espaço, Reforçada soma Defesa e espaço, nunca abaixo de 0', obtido: function () {
        return comCatalogo(function () {
          const f = agente([
            item({ nome: 'Faca', tipo: 'arma', grupo: 'arma-cac', espacos: 1, quantidade: 2, melhorias: [mel('modificacao', 'm-discreta')] }),
            item({ nome: 'Colete', tipo: 'protecao', grupo: 'protecao-pesada', espacos: 5, defesa: 10, equipada: true, melhorias: [mel('modificacao', 'm-reforcada')] }),
            item({ nome: 'Pena', espacos: 0.5, melhorias: [mel('modificacao', 'm-discreta')] })
          ]);
          const inv = calc.estadoInventario(f);
          return [calc.espacosDoItem(f.inventario.itens[0]), calc.espacosDoItem(f.inventario.itens[1]), calc.espacosDoItem(f.inventario.itens[2]), inv.espacosUsados, inv.defesaProtecoes].join('|');
        });
      }, esperado: '0|6|0|6|12' },
      { nome: 'Ajustes: a Defesa da melhoria só conta com a proteção equipada', obtido: function () {
        return comCatalogo(function () {
          const f = agente([item({ nome: 'Colete', tipo: 'protecao', defesa: 10, equipada: false, melhorias: [mel('modificacao', 'm-reforcada')] })]);
          const antes = calc.estadoInventario(f).defesaProtecoes;
          f.inventario.itens[0].equipada = true;
          return [antes, calc.estadoInventario(f).defesaProtecoes, calc.defesaDoItem(f.inventario.itens[0])].join('|');
        });
      }, esperado: '0|12|12' },
      { nome: 'Ajustes: Certeira, Cruel e Perigosa mexem no ataque ligado à arma (teste, dano e margem) e não nos outros', obtido: function () {
        return comCatalogo(function () {
          const f = agente([item({ nome: 'Faca', tipo: 'arma', grupo: 'arma-cac', melhorias: [mel('modificacao', 'm-certeira'), mel('modificacao', 'm-cruel'), mel('modificacao', 'm-perigosa')] })]);
          const ligado = OP.state.novoAtaque({ nome: 'Facada', pericia: 'luta', itemId: f.inventario.itens[0].id });
          const solto = OP.state.novoAtaque({ nome: 'Soco', pericia: 'luta' });
          f.ataques = [ligado, solto];
          const a = calc.bonusEfeitosAtaque(f, ligado);
          const b = calc.bonusEfeitosAtaque(f, solto);
          return [a.teste, a.dano, a.margem, b.teste, b.dano, b.margem, calc.ataqueTeste(f, ligado, 0).bonus - calc.ataqueTeste(f, solto, 0).bonus].join('|');
        });
      }, esperado: '2|2|2|0|0|0|2' },
      { nome: 'Ajustes: sem o catálogo do livro as melhorias contam só a categoria (nada de espaços, Defesa ou ataque)', obtido: function () {
        const f = agente([item({ nome: 'Colete', tipo: 'protecao', defesa: 10, espacos: 5, equipada: true, melhorias: [mel('modificacao', 'm-reforcada')] })]);
        const inv = calc.estadoInventario(f);
        return [inv.defesaProtecoes, inv.espacosUsados, calc.categoriaEfetivaItem(f.inventario.itens[0])].join('|');
      }, esperado: '10|5|1' },
      { nome: 'Repetidas: a melhoria repetida não soma (nem categoria nem ajustes) e gera aviso; "max" do livro permite repetir', obtido: function () {
        return comCatalogo(function () {
          const f = agente([
            item({ nome: 'Faca', tipo: 'arma', grupo: 'arma-cac', categoria: 0, melhorias: [mel('modificacao', 'm-certeira'), mel('modificacao', 'm-certeira')] }),
            item({ nome: 'Kit', grupo: 'acessorio', categoria: 0, melhorias: [mel('modificacao', 'm-aprimorado'), mel('modificacao', 'm-aprimorado'), mel('modificacao', 'm-aprimorado')] }),
            item({ nome: 'Própria', categoria: 0, melhorias: [mel('modificacao', '', { nome: 'Igual' }), mel('modificacao', '', { nome: 'igual' })] })
          ]);
          return [f.inventario.itens.map(function (i) { return calc.categoriaEfetivaItem(i); }).join(','), codigos(f)].join('|');
        });
      }, esperado: '1,2,1|melhoria-repetida,melhoria-repetida,melhoria-repetida' },

      /* ---- compatibilidade ---- */
      { nome: 'Compatibilidade: modificação de arma de fogo não serve para arma corpo a corpo; "tambem" abre a exceção', obtido: function () {
        return comCatalogo(function () {
          const faca = item({ nome: 'Faca', grupo: 'arma-cac' });
          const fuzil = item({ nome: 'Fuzil', grupo: 'arma-fogo' });
          const besta = item({ nome: 'Besta', grupo: 'arma-disparo', catalogo: 'i-besta' });
          const x = function (i, chave) { const r = calc.compatibilidadeMelhoria(i, { chave: chave }); return r.ok + (r.incerto ? '?' : ''); };
          return [x(faca, 'm-mira'), x(fuzil, 'm-mira'), x(besta, 'm-carregador'), x(faca, 'm-certeira'), x(fuzil, 'm-certeira')].join('|');
        });
      }, esperado: 'false|true|true|true|false' },
      { nome: 'Compatibilidade: "so" restringe o grupo (Blindada só proteção pesada) e "somente" limita a itens do livro', obtido: function () {
        return comCatalogo(function () {
          const leve = item({ nome: 'Leve', grupo: 'protecao-leve' });
          const pesada = item({ nome: 'Pesada', grupo: 'protecao-pesada' });
          const escudo = item({ nome: 'Escudo', grupo: 'escudo' });
          const balas = item({ nome: 'Balas', grupo: 'municao', catalogo: 'i-balas' });
          const outras = item({ nome: 'Outras', grupo: 'municao', catalogo: 'i-faca' });
          const camera = item({ nome: 'Câmera', grupo: 'paranormal', catalogo: 'i-camera' });
          const outra = item({ nome: 'Outro paranormal', grupo: 'paranormal', catalogo: 'i-veiculo' });
          const x = function (i, chave) { return calc.compatibilidadeMelhoria(i, { chave: chave }).ok; };
          return [x(leve, 'm-blindada'), x(pesada, 'm-blindada'), x(escudo, 'm-blindada'), x(leve, 'm-reforcada'), x(escudo, 'm-reforcada'), x(leve, 'm-discreta-prot'), x(pesada, 'm-discreta-prot'),
            x(balas, 'm-dumdum'), x(outras, 'm-dumdum'), x(camera, 'm-lente'), x(outra, 'm-lente')].join('|');
        });
      }, esperado: 'false|true|false|true|true|true|false|true|false|true|false' },
      { nome: 'Compatibilidade: regalia só em veículo; maldição de arma em arma; o motivo diz para que serve', obtido: function () {
        return comCatalogo(function () {
          const veiculo = item({ nome: 'Van', grupo: 'veiculo' });
          const faca = item({ nome: 'Faca', grupo: 'arma-cac' });
          const colete = item({ nome: 'Colete', grupo: 'protecao-pesada', catalogo: 'i-colete' });
          const x = function (i, chave) { return calc.compatibilidadeMelhoria(i, { chave: chave }); };
          return [x(veiculo, 'r-bancos').ok, x(faca, 'r-bancos').ok, x(faca, 'r-bancos').motivo, x(faca, 'c-antielemento').ok, x(colete, 'c-antielemento').ok, x(colete, 'c-cinetica').ok,
            x(colete, 'm-dumdum').motivo].join('|');
        });
      }, esperado: 'true|false|serve para veículo|true|false|true|serve só para Balas de teste' },
      { nome: 'Compatibilidade: sem como saber (melhoria própria, item sem natureza, sem catálogo) a ficha não reclama', obtido: function () {
        const faca = item({ nome: 'Faca', grupo: 'arma-cac' });
        const semNatureza = item({ nome: 'Coisa' });
        const propria = calc.compatibilidadeMelhoria(faca, { chave: '', classe: 'regalia' });
        const semLivro = calc.compatibilidadeMelhoria(faca, { chave: 'm-mira' });
        const semGrupo = comCatalogo(function () { return calc.compatibilidadeMelhoria(semNatureza, { chave: 'm-mira' }); });
        return [propria.ok, propria.incerto, semLivro.ok, semLivro.incerto, semGrupo.ok, semGrupo.incerto].join('|');
      }, esperado: 'true|true|true|true|true|true' },
      { nome: 'Compatibilidade: a natureza vem do item do livro quando a ficha não escolheu uma', obtido: function () {
        return comCatalogo(function () {
          const doLivro = item({ nome: 'Fuzil', catalogo: 'i-fuzil' });
          return [calc.grupoDoItem(doLivro), calc.compatibilidadeMelhoria(doLivro, { chave: 'm-mira' }).ok, calc.compatibilidadeMelhoria(doLivro, { chave: 'm-certeira' }).ok].join('|');
        });
      }, esperado: 'arma-fogo|true|false' },
      { nome: 'Verificações: incompatível, em conflito e regalias acima do limite do veículo', obtido: function () {
        return comCatalogo(function () {
          const f = agente([
            item({ nome: 'Faca', grupo: 'arma-cac', melhorias: [mel('modificacao', 'm-mira')] }),
            item({ nome: 'Colete', grupo: 'protecao-leve', tipo: 'protecao', melhorias: [mel('modificacao', 'm-reforcada'), mel('modificacao', 'm-discreta-prot')] }),
            item({ nome: 'Van', grupo: 'veiculo', catalogo: 'i-veiculo', melhorias: [mel('regalia', 'r-bancos'), mel('regalia', 'r-lataria')] })
          ]);
          return codigos(f);
        });
      }, esperado: 'melhoria-conflito,melhoria-incompativel,regalias-acima-limite' },
      { nome: 'Verificações: item compatível e dentro dos limites não gera aviso; modo livre também some com eles', obtido: function () {
        return comCatalogo(function () {
          const f = agente([item({ nome: 'Fuzil', grupo: 'arma-fogo', categoria: 1, melhorias: [mel('modificacao', 'm-mira')] })]);
          const limpo = codigos(f);
          const g = agente([item({ nome: 'Faca', grupo: 'arma-cac', melhorias: [mel('modificacao', 'm-mira')] })]);
          g.config.modoLivre = true;
          return [limpo === '', codigos(g) === ''].join('|');
        });
      }, esperado: 'true|true' },

      /* ---- catálogo (js/livro.js) ---- */
      { nome: 'Livro: itens e melhorias do servidor entram no catálogo, no índice por chave e nas regras; o texto fica separado', obtido: function () {
        const original = OP.data.catalogo;
        const efeitos = OP.data.efeitos;
        OP.data.catalogo = { origens: {}, trilhas: {}, classe: {}, poderes: [], rituais: [], itens: [], melhorias: [], itemPorChave: {}, melhoriaPorChave: {}, regrasDeMelhoria: {} };
        OP.data.efeitos = {};
        try {
          OP.livro._registrar('itens', { chave: 'tt-faca', titulo: 'Faca T', texto: 'Cabeçalho\nRegras: texto\n\n§AUTO§' + JSON.stringify({ t: 'item', grupo: 'arma-cac', tipo: 'arma', cat: 0, esp: 1 }) });
          OP.livro._registrar('melhorias', { chave: 'tt-mod', titulo: 'Mod T', texto: 'Cabeçalho\nEfeito: x\n\n§AUTO§' + JSON.stringify({ t: 'melhoria', cls: 'modificacao', grupo: 'mod-corpo-disparo', aj: { ataque: 2 } }) });
          OP.livro._registrar('melhorias', { chave: 'tt-regra', titulo: 'Regras', texto: 'Regras\n\n§AUTO§' + JSON.stringify({ t: 'regra', cls: 'maldicao' }) });
          const c = OP.data.catalogo;
          const t = OP.livro.texto('tt-faca');
          return [c.itens.length, c.itemPorChave['tt-faca'].nome, c.itemPorChave['tt-faca'].grupo, c.itemPorChave['tt-faca'].t === undefined, c.melhorias.length,
            c.melhoriaPorChave['tt-mod'].aj.ataque, c.regrasDeMelhoria.maldicao, c.melhorias.length === Object.keys(c.melhoriaPorChave).length, t.corpo.indexOf('§AUTO§') === -1,
            calc.melhoriaDoCatalogo('tt-mod').nome].join('|');
        } finally {
          OP.livro._esquecerTextos(['tt-faca', 'tt-mod', 'tt-regra']);
          OP.data.catalogo = original;
          OP.data.efeitos = efeitos;
        }
      }, esperado: '1|Faca T|arma-cac|true|1|2|tt-regra|true|true|Mod T' },

      /* ---- resumo em Markdown ---- */
      { nome: 'Markdown: o item mostra natureza, categoria base e efetiva, espaços, Defesa, descrição e melhorias com anotação', obtido: function () {
        return comCatalogo(function () {
          const f = OP.state.criarFichaVazia();
          Object.assign(f.identificacao, { classe: 'combatente', nex: 50 });
          f.inventario.patente = 'agente-elite';
          f.inventario.itens.push(item({ nome: 'Colete do Rui', tipo: 'protecao', grupo: 'protecao-pesada', categoria: 2, espacos: 5, defesa: 10, penalidade: 5, equipada: true, quantidade: 1,
            descricao: 'Comprado no mercado negro.',
            melhorias: [mel('modificacao', 'm-reforcada', { nome: 'Reforçada', nota: 'cor preta' }), mel('maldicao', 'c-cinetica', { nome: 'Cinética', elemento: 'energia' })] }));
          const md = OP.exportarMd.gerar(f);
          return [
            md.indexOf('| Item | Natureza | Cat. | Espaços | Qtd. | Equipado | Melhorias |') !== -1,
            md.indexOf('| Colete do Rui | Proteção pesada | V (base II) | 6 (base 5) | 1 | sim | Reforçada, Cinética |') !== -1,
            md.indexOf('### Detalhes dos itens') !== -1, md.indexOf('#### Colete do Rui') !== -1,
            md.indexOf('- **Natureza:** Proteção pesada') !== -1,
            md.indexOf('- **Categoria:** V (base II + 3 das melhorias)') !== -1,
            md.indexOf('- **Espaços:** 6 (base 5) por unidade') !== -1,
            md.indexOf('- **Defesa:** +14 (base +10)') !== -1,
            md.indexOf('- **Penalidade de carga:** −5') !== -1,
            md.indexOf('> Comprado no mercado negro.') !== -1,
            md.indexOf('- **Reforçada** (modificação; categoria +1)') !== -1,
            md.indexOf('- **Cinética** (maldição; Energia; categoria +2)') !== -1,
            md.indexOf('  > cor preta') !== -1,
            md.indexOf('- **Itens acima da categoria IV:** Colete do Rui (V)') !== -1
          ].join('|');
        });
      }, esperado: 'true|true|true|true|true|true|true|true|true|true|true|true|true|true' },
      { nome: 'Markdown: melhoria que não combina é marcada; repetida avisa que não conta; sem melhorias o item simples fica só na tabela', obtido: function () {
        return comCatalogo(function () {
          const f = OP.state.criarFichaVazia();
          Object.assign(f.identificacao, { classe: 'combatente', nex: 50 });
          f.inventario.itens.push(item({ nome: 'Faca', grupo: 'arma-cac', melhorias: [mel('modificacao', 'm-mira', { nome: 'Mira de teste' }), mel('modificacao', 'm-mira', { nome: 'Mira de teste' })] }));
          f.inventario.itens.push(item({ nome: 'Corda', quantidade: 3 }));
          const md = OP.exportarMd.gerar(f);
          return [md.indexOf('⚠ não combina com o item (serve para arma de fogo)') !== -1, md.indexOf('⚠ repetida, não conta') !== -1, md.indexOf('#### Corda') === -1, md.indexOf('| Corda | Geral |') !== -1].join('|');
        });
      }, esperado: 'true|true|true|true' },
      { nome: 'Markdown: sem o livro, só o que a ficha guarda e o que a pessoa escreveu; com texto do livro, as regras e o efeito entram', obtido: function () {
        const f = OP.state.criarFichaVazia();
        Object.assign(f.identificacao, { classe: 'combatente', nex: 50 });
        f.inventario.itens.push(item({ nome: 'Faca', catalogo: 'tt-faca', melhorias: [mel('modificacao', 'tt-mod', { nome: 'Mod T' })] }));
        const semLivro = OP.exportarMd.gerar(f);
        const original = OP.data.catalogo;
        OP.data.catalogo = Object.assign({}, original, { itens: [], melhorias: [], itemPorChave: {}, melhoriaPorChave: {}, regrasDeMelhoria: {} });
        try {
          OP.livro._registrar('itens', { chave: 'tt-faca', titulo: 'Faca T', texto: 'Nº 001 · Arma simples · Fonte\nAmbientação: Lâmina comum.\nRegras: Arma ágil.\n\n§AUTO§' + JSON.stringify({ t: 'item', grupo: 'arma-cac', tipo: 'arma', cat: 0, esp: 1 }) });
          OP.livro._registrar('melhorias', { chave: 'tt-mod', titulo: 'Mod T', texto: 'Modificação · Grupo\nEfeito: +2 em ataques.\nServe para: armas\n\n§AUTO§' + JSON.stringify({ t: 'melhoria', cls: 'modificacao', grupo: 'mod-corpo-disparo' }) });
          const comLivro = OP.exportarMd.gerar(f);
          return [semLivro.indexOf('Lâmina comum') === -1, semLivro.indexOf('+2 em ataques') === -1, semLivro.indexOf('- **Mod T** (modificação; categoria +1)') !== -1,
            comLivro.indexOf('**Ambientação.** Lâmina comum.') !== -1, comLivro.indexOf('**Regras.** Arma ágil.') !== -1, comLivro.indexOf('- **No livro:** Nº 001 · Arma simples · Fonte') !== -1,
            comLivro.indexOf('— +2 em ataques.') !== -1, comLivro.indexOf('Serve para') === -1].join('|');
        } finally {
          OP.livro._esquecerTextos(['tt-faca', 'tt-mod']);
          OP.data.catalogo = original;
        }
      }, esperado: 'true|true|true|true|true|true|true|true' }
    ];
  }

  OP.testesItens = testesItens;
})(window.OP);
