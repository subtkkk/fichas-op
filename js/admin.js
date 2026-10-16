/* ==========================================================================
   js/admin.js — página admin.html: gerar códigos, ver acessos e publicar conteúdo.
   Só funciona para o administrador (o servidor confere; aqui é só a tela).
   Tudo que vem do servidor entra por textContent.
   ========================================================================== */
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  let ultimoCodigo = '';

  async function api(caminho, metodo, corpo) {
    const opcoes = { method: metodo || 'GET', credentials: 'same-origin', headers: { accept: 'application/json' } };
    if (corpo !== undefined) {
      opcoes.headers['content-type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }
    const resposta = await fetch(caminho, opcoes);
    const dados = await resposta.json().catch(function () { return {}; });
    if (!resposta.ok) throw new Error(dados.erro || 'Erro ' + resposta.status);
    return dados;
  }

  function data(segundos) {
    return new Date(segundos * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function celula(texto) {
    const td = document.createElement('td');
    td.textContent = texto;
    return td;
  }

  function linhaVazia(corpo, colunas, texto) {
    const tr = document.createElement('tr');
    const td = celula(texto);
    td.colSpan = colunas;
    td.className = 'admin__vazio';
    tr.appendChild(td);
    corpo.appendChild(tr);
  }

  /** Botão de dois toques: o primeiro pede confirmação, o segundo executa (sem janelas do navegador). */
  function botaoRevogar(rotulo, acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao';
    botao.textContent = rotulo;
    let pronto = false;
    let timer = null;
    botao.addEventListener('click', async function () {
      if (!pronto) {
        pronto = true;
        botao.textContent = 'Confirmar';
        timer = setTimeout(function () { pronto = false; botao.textContent = rotulo; }, 4000);
        return;
      }
      clearTimeout(timer);
      botao.disabled = true;
      try { await acao(); } catch (erro) { $('admin-estado').hidden = false; $('admin-estado').textContent = erro.message; }
    });
    const td = document.createElement('td');
    td.appendChild(botao);
    return td;
  }

  function situacao(c, agora) {
    if (c.revogado) return 'Revogado';
    if (c.usado_em) return 'Usado por ' + (c.usado_por_nome || 'alguém') + ' em ' + data(c.usado_em);
    if (c.expira_em <= agora) return 'Venceu em ' + data(c.expira_em);
    return 'Aguardando (vale até ' + data(c.expira_em) + ')';
  }

  async function carregarCodigos() {
    const dados = await api('/api/admin/codigos');
    const corpo = $('admin-codigos').tBodies[0];
    corpo.textContent = '';
    const agora = Math.floor(Date.now() / 1000);
    if (!dados.codigos.length) linhaVazia(corpo, 5, 'Nenhum código gerado ainda.');
    dados.codigos.forEach(function (c) {
      const tr = document.createElement('tr');
      tr.append(celula(c.rotulo), celula(c.escopos.join(', ')), celula(String(c.dias)), celula(situacao(c, agora)));
      if (!c.revogado && !c.usado_em && c.expira_em > agora) {
        tr.appendChild(botaoRevogar('Revogar', async function () { await api('/api/admin/codigos/' + c.id + '/revogar', 'POST', {}); await carregarTudo(); }));
      } else {
        tr.appendChild(celula(''));
      }
      corpo.appendChild(tr);
    });
  }

  async function carregarAcessos() {
    const dados = await api('/api/admin/acessos');
    const corpo = $('admin-acessos').tBodies[0];
    corpo.textContent = '';
    if (!dados.acessos.length) linhaVazia(corpo, 4, 'Ninguém com acesso no momento.');
    dados.acessos.forEach(function (a) {
      const tr = document.createElement('tr');
      tr.append(celula(a.nome || a.discord_id), celula(a.escopo), celula(data(a.expira_em)));
      tr.appendChild(botaoRevogar('Tirar acesso', async function () { await api('/api/admin/acessos/revogar', 'POST', { discordId: a.discord_id, escopo: a.escopo }); await carregarTudo(); }));
      corpo.appendChild(tr);
    });
  }

  async function carregarConteudos() {
    const dados = await api('/api/admin/conteudo');
    const corpo = $('admin-conteudos').tBodies[0];
    corpo.textContent = '';
    if (!dados.escopos.length) linhaVazia(corpo, 3, 'Nenhum conteúdo publicado ainda.');
    dados.escopos.forEach(function (e) {
      const tr = document.createElement('tr');
      tr.append(celula(e.escopo), celula(String(e.itens)), celula(data(e.atualizado_em)));
      corpo.appendChild(tr);
    });
  }

  function carregarTudo() {
    return Promise.all([carregarCodigos(), carregarAcessos(), carregarConteudos()]);
  }

  async function gerarCodigo(evento) {
    evento.preventDefault();
    const escopos = $('ac-escopos').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    const corpo = { rotulo: $('ac-rotulo').value, escopos: escopos, dias: Number($('ac-dias').value), validadeHoras: Number($('ac-horas').value) };
    if ($('ac-discord').value.trim()) corpo.paraDiscordId = $('ac-discord').value.trim();
    try {
      const r = await api('/api/admin/codigos', 'POST', corpo);
      ultimoCodigo = r.codigo;
      $('admin-novo').hidden = false;
      $('admin-novo-para').textContent = corpo.rotulo;
      $('admin-novo-codigo').textContent = r.codigo;
      $('admin-novo-detalhe').textContent = 'Libera ' + r.escopos.join(', ') + ' por ' + r.dias + ' dias a partir do resgate. O código vale até ' + data(r.expira_em) + '.';
      $('admin-form-codigo').reset();
      $('ac-escopos').value = 'habilidades';
      $('ac-dias').value = '30';
      $('ac-horas').value = '24';
      await carregarCodigos();
    } catch (erro) {
      $('admin-estado').hidden = false;
      $('admin-estado').textContent = erro.message;
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(ultimoCodigo);
      $('admin-copiar').textContent = 'Copiado';
    } catch (erro) {
      const selecao = window.getSelection();
      const faixa = document.createRange();
      faixa.selectNodeContents($('admin-novo-codigo'));
      selecao.removeAllRanges();
      selecao.addRange(faixa);
      $('admin-copiar').textContent = 'Selecionado: use Ctrl+C';
    }
  }

  async function publicar(evento) {
    evento.preventDefault();
    const aviso = $('admin-conteudo-aviso');
    aviso.hidden = false;
    aviso.classList.remove('aviso-neutro--erro');
    try {
      const arquivo = $('ct-arquivo').files[0];
      if (!arquivo) throw new Error('Escolha o arquivo .json.');
      let json;
      try { json = JSON.parse(await arquivo.text()); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
      const r = await api('/api/admin/conteudo/' + encodeURIComponent($('ct-escopo').value.trim()), 'PUT', json);
      aviso.textContent = 'Publicado: ' + r.itens + ' itens.';
      $('admin-form-conteudo').reset();
      $('ct-escopo').value = 'habilidades';
      await carregarConteudos();
    } catch (erro) {
      aviso.classList.add('aviso-neutro--erro');
      aviso.textContent = erro.message;
    }
  }

  async function iniciar() {
    const estado = $('admin-estado');
    try {
      const eu = await api('/api/eu');
      if (!eu.conectado) {
        estado.textContent = '';
        const link = document.createElement('a');
        link.href = '/api/auth/discord';
        link.textContent = 'Entrar com o Discord';
        estado.append('Você não está conectado. ', link, '.');
        return;
      }
      if (!eu.admin) {
        estado.textContent = 'Esta conta não é de administrador.';
        return;
      }
      estado.hidden = true;
      $('admin-painel').hidden = false;
      $('admin-form-codigo').addEventListener('submit', gerarCodigo);
      $('admin-copiar').addEventListener('click', copiar);
      $('admin-form-conteudo').addEventListener('submit', publicar);
      await carregarTudo();
    } catch (erro) {
      estado.textContent = 'Não foi possível falar com o servidor (' + erro.message + '). Esta página só funciona no endereço publicado.';
    }
  }

  iniciar();
})();
