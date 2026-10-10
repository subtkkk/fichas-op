/* ==========================================================================
   js/storage.js — armazenamento no navegador (OP.storage)
   --------------------------------------------------------------------------
   - ler, gravar e remover nunca lançam exceção (tudo em try/catch).
   - Se o localStorage não existir ou estiver bloqueado, tudo fica num
     armazenamento em memória (modo "memoria": some ao recarregar).
   - Se uma gravação falhar no meio do uso (armazenamento cheio ou
     bloqueado), o valor fica guardado em memória por cima do localStorage,
     a página continua coerente e gravar() devolve false.
   - OP.storage.usar(falso) troca o armazenamento (usado pelos testes) e
     devolve o anterior; usar(anterior) restaura exatamente o que havia.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  // Marca dos estados criados aqui (para usar() reconhecer um estado salvo).
  const MARCA = {};

  /** Armazenamento em memória com a mesma interface do localStorage. */
  function criarMemoria() {
    let dados = Object.create(null);
    return {
      getItem: function (chave) {
        const k = String(chave);
        return k in dados ? dados[k] : null;
      },
      setItem: function (chave, valor) {
        dados[String(chave)] = String(valor);
      },
      removeItem: function (chave) {
        delete dados[String(chave)];
      },
      clear: function () {
        dados = Object.create(null);
      },
      key: function (indice) {
        const chaves = Object.keys(dados);
        return indice >= 0 && indice < chaves.length ? chaves[indice] : null;
      },
      get length() {
        return Object.keys(dados).length;
      }
    };
  }

  /** O localStorage, se der para gravar e apagar nele; senão null. */
  function detectarLocal() {
    try {
      const local = window.localStorage;
      if (!local) return null;
      const chaveTeste = '__op_teste__';
      local.setItem(chaveTeste, '1');
      local.removeItem(chaveTeste);
      return local;
    } catch (erro) {
      return null;
    }
  }

  /**
   * Estado do armazenamento em uso.
   * modo: 'local' (localStorage), 'memoria' (sem localStorage) ou 'teste' (falso).
   * sobreposicao: valores que não couberam no armazenamento (falha ao gravar).
   */
  function novoEstado(armazenamento, modo) {
    return { marca: MARCA, armazenamento: armazenamento, modo: modo, sobreposicao: Object.create(null) };
  }

  function estadoPadrao() {
    const local = detectarLocal();
    return local ? novoEstado(local, 'local') : novoEstado(criarMemoria(), 'memoria');
  }

  let estado = estadoPadrao();

  /** Valor guardado na chave (texto) ou null se não existir / não der para ler. */
  function ler(chave) {
    const k = String(chave);
    if (k in estado.sobreposicao) return estado.sobreposicao[k];
    try {
      const valor = estado.armazenamento.getItem(k);
      return typeof valor === 'string' ? valor : null;
    } catch (erro) {
      return null;
    }
  }

  /**
   * Grava um texto. Devolve true se o armazenamento aceitou.
   * Se falhar, o valor fica na memória (por cima) e devolve false.
   */
  function gravar(chave, valor) {
    const k = String(chave);
    const texto = String(valor);
    try {
      estado.armazenamento.setItem(k, texto);
      delete estado.sobreposicao[k];
      return true;
    } catch (erro) {
      estado.sobreposicao[k] = texto;
      return false;
    }
  }

  /** Apaga a chave (da memória e do armazenamento). Devolve true se deu certo. */
  function remover(chave) {
    const k = String(chave);
    delete estado.sobreposicao[k];
    try {
      estado.armazenamento.removeItem(k);
      return true;
    } catch (erro) {
      return false;
    }
  }

  /** Todas as chaves conhecidas (armazenamento + memória), sem repetir. */
  function chaves() {
    const vistas = Object.create(null);
    const lista = [];
    function anotar(chave) {
      if (typeof chave === 'string' && !vistas[chave]) {
        vistas[chave] = true;
        lista.push(chave);
      }
    }
    try {
      const total = Number(estado.armazenamento.length) || 0;
      for (let i = 0; i < total; i++) anotar(estado.armazenamento.key(i));
    } catch (erro) {
      // Armazenamento sem listagem: fica só com a memória.
    }
    Object.keys(estado.sobreposicao).forEach(anotar);
    return lista;
  }

  /** 'local', 'memoria' (não persiste ao recarregar) ou 'teste'. */
  function modo() {
    return estado.modo;
  }

  /**
   * Troca o armazenamento e devolve o estado anterior.
   * - usar(objetoComGetItemSetItem): passa a usar esse armazenamento (testes);
   * - usar(estadoDevolvidoAntes): restaura exatamente o anterior;
   * - usar(null): volta a detectar o localStorage.
   */
  function usar(alvo) {
    const anterior = estado;
    if (alvo && alvo.marca === MARCA) estado = alvo;
    else if (alvo && typeof alvo.getItem === 'function' && typeof alvo.setItem === 'function') estado = novoEstado(alvo, 'teste');
    else estado = estadoPadrao();
    return anterior;
  }

  OP.storage = {
    ler: ler,
    gravar: gravar,
    remover: remover,
    chaves: chaves,
    modo: modo,
    usar: usar,
    criarMemoria: criarMemoria
  };
})(window.OP);
