/* ==========================================================================
   js/prefs.js — preferências do navegador (OP.prefs)
   --------------------------------------------------------------------------
   Ficam fora da ficha (não vão para exportar/importar), na chave
   "op_prefs" do OP.storage:
   { fontes: { livro: true, SaH: false, ... }, temas: { idFicha: "sangue", ... } }
   - Fontes desligadas escondem origens e trilhas daquela fonte nos selects
     (a escolhida nunca some). Padrão: todas ligadas.
   - Temas: aparência escolhida para cada ficha (data/temas.js). Só visual:
     não muda nenhuma regra. Padrão: o primeiro tema (neutro).
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const CHAVE = 'op_prefs';
  const PADRAO_ID = /^[A-Za-z0-9_-]{1,64}$/; // mesmo formato dos ids de ficha
  const LIMITE_TEMAS = 500;
  const ouvintes = [];

  function ehObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  function temPropria(objeto, chave) {
    return Object.prototype.hasOwnProperty.call(objeto, chave);
  }

  /** Ids dos temas conhecidos (data/temas.js). */
  function idsTemas() {
    return (OP.data.temas || []).map(function (tema) { return tema.id; });
  }

  function temaPadrao() {
    const ids = idsTemas();
    return ids.length ? ids[0] : 'neutro';
  }

  /** Preferências salvas, completas e validadas (só fontes e temas conhecidos). */
  function ler() {
    let salvo = null;
    try {
      salvo = JSON.parse(OP.storage.ler(CHAVE) || 'null');
    } catch (erro) {
      salvo = null;
    }
    const fontesSalvas = ehObjeto(salvo) && ehObjeto(salvo.fontes) ? salvo.fontes : {};
    const fontes = {};
    Object.keys(OP.data.fontes).forEach(function (id) {
      fontes[id] = temPropria(fontesSalvas, id) ? fontesSalvas[id] !== false : true;
    });

    const temasSalvos = ehObjeto(salvo) && ehObjeto(salvo.temas) ? salvo.temas : {};
    const validos = idsTemas();
    const temas = {};
    Object.keys(temasSalvos).slice(0, LIMITE_TEMAS).forEach(function (idFicha) {
      const tema = temasSalvos[idFicha];
      if (PADRAO_ID.test(idFicha) && validos.indexOf(tema) !== -1) temas[idFicha] = tema;
    });
    return { fontes: fontes, temas: temas };
  }

  function gravar(prefs) {
    return OP.storage.gravar(CHAVE, JSON.stringify(prefs));
  }

  function avisar(prefs, tipo) {
    ouvintes.forEach(function (funcao) { funcao(prefs, tipo); });
  }

  /** { idFonte: true/false } para todas as fontes de OP.data.fontes. */
  function fontesAtivas() {
    return ler().fontes;
  }

  /** A fonte está ligada? Fonte desconhecida conta como ligada. */
  function fonteAtiva(id) {
    const fontes = fontesAtivas();
    return temPropria(fontes, id) ? fontes[id] : true;
  }

  /** Liga ou desliga uma fonte e avisa quem estiver ouvindo. */
  function definirFonte(id, ligada) {
    if (!temPropria(OP.data.fontes, id)) return false;
    const prefs = ler();
    prefs.fontes[id] = ligada === true;
    const ok = gravar(prefs);
    avisar(prefs, 'fontes');
    return ok;
  }

  /** Tema visual de uma ficha (o padrão se não houver escolha). */
  function tema(idFicha) {
    const temas = ler().temas;
    return typeof idFicha === 'string' && temPropria(temas, idFicha) ? temas[idFicha] : temaPadrao();
  }

  /** Guarda o tema de uma ficha (o padrão apaga a entrada). Devolve true se gravou. */
  function definirTema(idFicha, idTema) {
    if (typeof idFicha !== 'string' || !PADRAO_ID.test(idFicha)) return false;
    if (idsTemas().indexOf(idTema) === -1) return false;
    const prefs = ler();
    if (idTema === temaPadrao()) delete prefs.temas[idFicha];
    else prefs.temas[idFicha] = idTema;
    const ok = gravar(prefs);
    avisar(prefs, 'temas');
    return ok;
  }

  /** Esquece o tema de uma ficha (ex.: ficha excluída). */
  function esquecerTema(idFicha) {
    const prefs = ler();
    if (!temPropria(prefs.temas, idFicha)) return true;
    delete prefs.temas[idFicha];
    return gravar(prefs);
  }

  /** fn(prefs, tipo) a cada mudança nas preferências (tipo: 'fontes' ou 'temas'). */
  function aoMudar(funcao) {
    ouvintes.push(funcao);
  }

  OP.prefs = {
    CHAVE: CHAVE,
    ler: ler,
    fontesAtivas: fontesAtivas,
    fonteAtiva: fonteAtiva,
    definirFonte: definirFonte,
    tema: tema,
    temaPadrao: temaPadrao,
    definirTema: definirTema,
    esquecerTema: esquecerTema,
    aoMudar: aoMudar
  };
})(window.OP);
