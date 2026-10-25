/* ==========================================================================
   js/conta.js — conta (OP.conta)
   --------------------------------------------------------------------------
   Login com o Discord e códigos de acesso. Tudo é opcional: se a API não
   existir (arquivo aberto direto, GitHub Pages, sem rede) o botão "Conta"
   fica escondido e a ficha funciona como sempre. O servidor (worker/) é quem
   decide o que cada pessoa pode ler; aqui só se mostra o resultado.
   O conteúdo protegido NÃO é guardado no navegador (nem localStorage):
   OP.conta.conteudo() busca na hora e fica só na memória da página.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const estado = { disponivel: false, conectado: false, usuario: null, admin: false, acessos: [], nuvem: false };
  const memoria = {};

  function podeUsarApi() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  async function pedir(caminho, opcoes) {
    const o = Object.assign({ credentials: 'same-origin', headers: { accept: 'application/json' } }, opcoes || {});
    const resposta = await fetch(caminho, o);
    const tipo = resposta.headers.get('content-type') || '';
    if (tipo.indexOf('application/json') === -1) throw new Error('sem-api');
    const dados = await resposta.json();
    return { ok: resposta.ok, status: resposta.status, dados: dados };
  }

  function formatarData(segundos) {
    return new Date(segundos * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function nomeDoEscopo(escopo) {
    const limpo = String(escopo).replace(/-/g, ' ');
    return limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }

  function mostrarAviso(texto, tipo) {
    refs.aviso.hidden = !texto;
    refs.aviso.textContent = texto || '';
    refs.aviso.classList.toggle('aviso-neutro--erro', tipo === 'erro');
  }

  function desenhar() {
    refs.botao.hidden = !estado.disponivel;
    refs.desconectado.hidden = estado.conectado;
    refs.conectado.hidden = !estado.conectado;
    if (!estado.conectado) return;
    refs.nome.textContent = estado.usuario ? estado.usuario.nome : '';
    refs.admin.hidden = !estado.admin;
    desenharLivro();
    refs.lista.textContent = '';
    if (!estado.acessos.length) {
      const vazio = document.createElement('li');
      vazio.className = 'conta__vazio';
      vazio.textContent = 'Nenhum conteúdo liberado ainda. Resgate um código para começar.';
      refs.lista.appendChild(vazio);
    }
    estado.acessos.forEach(function (acesso) {
      const item = document.createElement('li');
      const nome = document.createElement('strong');
      nome.textContent = nomeDoEscopo(acesso.escopo);
      const ate = document.createElement('span');
      ate.textContent = ' até ' + formatarData(acesso.expira_em);
      item.append(nome, ate);
      refs.lista.appendChild(item);
    });
  }

  /** Diz o que chegou do conteúdo do livro (ou por que nada apareceu). */
  function desenharLivro() {
    if (!refs.livro) return;
    const texto = OP.livro && OP.livro.resumo ? OP.livro.resumo() : '';
    refs.livro.hidden = !texto;
    refs.livro.textContent = texto;
  }

  async function carregar() {
    if (!podeUsarApi()) return;
    try {
      const r = await pedir('/api/eu');
      if (!r.ok || r.dados.configurado === false) return;
      estado.disponivel = true;
      estado.conectado = !!r.dados.conectado;
      estado.usuario = r.dados.usuario || null;
      estado.admin = !!r.dados.admin;
      estado.acessos = r.dados.acessos || [];
      estado.nuvem = r.dados.nuvem === true; // as fichas na conta dependem das tabelas novas do banco
    } catch (erro) {
      estado.disponivel = false; // sem API: a ficha segue normal
    }
    desenhar();
    recarregarLivro();
    if (OP.nuvem) OP.nuvem.atualizar(); // liga ou desliga a sincronia das fichas
  }

  /** O conteúdo do livro depende dos acessos: recarrega (ou esvazia) quando eles mudam. */
  function recarregarLivro() {
    if (OP.livro) OP.livro.carregar();
  }

  async function resgatar(evento) {
    evento.preventDefault();
    const codigo = refs.codigo.value.trim();
    if (!codigo) {
      mostrarAviso('Digite o código que o administrador enviou.', 'erro');
      return;
    }
    refs.resgatar.disabled = true;
    mostrarAviso('Conferindo o código…');
    try {
      const r = await pedir('/api/resgatar', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ codigo: codigo })
      });
      if (r.ok) {
        estado.acessos = r.dados.acessos || [];
        refs.codigo.value = '';
        mostrarAviso('Código aceito. Conteúdo liberado.');
        Object.keys(memoria).forEach(function (k) { delete memoria[k]; });
        desenhar();
        recarregarLivro();
      } else {
        mostrarAviso(r.dados.erro || 'Não foi possível resgatar o código.', 'erro');
      }
    } catch (erro) {
      mostrarAviso('Sem conexão com o servidor. Tente de novo.', 'erro');
    }
    refs.resgatar.disabled = false;
  }

  async function sair() {
    try {
      await pedir('/api/sair', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: '{}' });
    } catch (erro) { /* sem rede: o cookie vence sozinho */ }
    estado.conectado = false;
    estado.usuario = null;
    estado.admin = false;
    estado.acessos = [];
    estado.nuvem = false;
    Object.keys(memoria).forEach(function (k) { delete memoria[k]; });
    mostrarAviso('');
    desenhar();
    recarregarLivro();
    if (OP.nuvem) OP.nuvem.atualizar();
  }

  /** Conteúdo protegido de um escopo; só em memória. Resolve com a lista de itens, ou rejeita com a mensagem do servidor. */
  async function conteudo(escopo) {
    if (memoria[escopo]) return memoria[escopo];
    const r = await pedir('/api/conteudo/' + encodeURIComponent(escopo));
    if (!r.ok) throw new Error(r.dados.erro || 'Sem acesso.');
    memoria[escopo] = r.dados.itens;
    return r.dados.itens;
  }

  const CHAVE_VOLTA = 'op_voltar';

  function lembrarOndeEstava() {
    try {
      if (/^#\/compartilhada\/[0-9a-f]{48}$/.test(location.hash)) sessionStorage.setItem(CHAVE_VOLTA, location.hash);
    } catch (erro) { /* sem sessionStorage: volta para a Central */ }
  }

  function recuperarOndeEstava() {
    try {
      const volta = sessionStorage.getItem(CHAVE_VOLTA);
      sessionStorage.removeItem(CHAVE_VOLTA);
      return /^#\/compartilhada\/[0-9a-f]{48}$/.test(volta || '') ? volta : '';
    } catch (erro) {
      return '';
    }
  }

  function abrir() {
    mostrarAviso('');
    if (OP.ui && OP.ui.abrirDialogo) OP.ui.abrirDialogo(refs.dialogo, refs.botao);
    else refs.dialogo.showModal();
  }

  function montar() {
    refs.dialogo = document.getElementById('dialogo-conta');
    refs.botao = document.getElementById('botao-conta');
    if (!refs.dialogo || !refs.botao) return;
    refs.desconectado = document.getElementById('conta-desconectado');
    refs.conectado = document.getElementById('conta-conectado');
    refs.nome = document.getElementById('conta-nome');
    refs.lista = document.getElementById('conta-acessos');
    refs.form = document.getElementById('conta-form');
    refs.codigo = document.getElementById('conta-codigo');
    refs.resgatar = document.getElementById('conta-resgatar');
    refs.aviso = document.getElementById('conta-aviso');
    refs.admin = document.getElementById('conta-admin');
    refs.livro = document.getElementById('conta-livro');
    if (OP.livro && OP.livro.aoMudar) OP.livro.aoMudar(desenharLivro);

    refs.botao.addEventListener('click', abrir);
    refs.form.addEventListener('submit', resgatar);
    document.getElementById('conta-sair').addEventListener('click', sair);
    refs.dialogo.addEventListener('click', function (evento) {
      if (evento.target.closest('[data-fechar-dialogo]')) refs.dialogo.close();
    });

    // O login sai do site e volta para a raiz: lembra onde a pessoa estava (ex.: o link de uma ficha) para voltar
    refs.entrar = document.getElementById('conta-entrar');
    if (refs.entrar) refs.entrar.addEventListener('click', lembrarOndeEstava);

    const voltouDoLogin = /[?&]conta=ok\b/.test(location.search);
    carregar().then(function () {
      if (voltouDoLogin && estado.disponivel) {
        history.replaceState(null, '', location.pathname + location.hash);
        const volta = recuperarOndeEstava();
        if (volta) location.hash = volta;
        else abrir();
      }
    });
  }

  OP.conta = { montar: montar, estado: estado, conteudo: conteudo, recarregar: carregar, pedir: pedir, abrir: abrir };
})(window.OP);
