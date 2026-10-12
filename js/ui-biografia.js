/* ==========================================================================
   js/ui-biografia.js — biografia, retrato, aliados, rivais e diário
   (OP.uiBiografia)
   --------------------------------------------------------------------------
   Entra no ciclo de desenho do js/ui.js (OP.ui.registrarExtensao).
   - Os textos fixos da biografia usam data-campo (ligados pelo js/ui.js);
   - retrato: arquivo → FileReader → <canvas> (máximo 320 px no maior lado) →
     JPEG 0,85 em data URL. Só vai para src depois de OP.calc.retratoValido;
   - aliados e rivais: nome + nota; diário: da entrada mais recente para a
     mais antiga, cada uma dobrável (<details>); remover pede confirmação
     e depois oferece Desfazer;
   - textareas crescem com o conteúdo (field-sizing, ou scrollHeight);
   - impressão: retrato e biografia entram; o diário só com a preferência
     "Incluir diário na impressão" (OP.prefs).
   Textos da ficha entram só por textContent, .value ou setAttribute.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const refs = {};
  const linhas = { aliados: Object.create(null), rivais: Object.create(null), diario: Object.create(null) };
  const abertas = Object.create(null); // entradas do diário abertas (só da tela)

  const LADO_MAXIMO = 320;      // px, no maior lado do retrato
  const QUALIDADES = [0.85, 0.7, 0.55];
  const ARQUIVO_MAXIMO = 15 * 1024 * 1024; // bytes, antes de reduzir

  function definirTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function criar(tag, classe, texto) {
    return OP.ui.criarElemento(tag, classe, texto);
  }

  function ficha() {
    return OP.state.ficha;
  }

  function mensagemRetrato(texto) {
    definirTexto(refs.retratoMsg, texto);
  }

  /* ------------------------------------------------------------------------
     Retrato
     ------------------------------------------------------------------------ */

  function nomeDaFicha() {
    const nome = String((ficha().identificacao && ficha().identificacao.nome) || '').trim();
    return nome;
  }

  function desenharRetrato() {
    const retrato = ficha().biografia.retrato;
    const valido = retrato !== '' && OP.calc.retratoValido(retrato);
    refs.imagem.hidden = !valido;
    refs.semImagem.hidden = valido;
    refs.removerRetrato.hidden = !valido;
    refs.moldura.setAttribute('data-tem-retrato', String(valido));
    const nome = nomeDaFicha();
    const alt = valido ? (nome ? 'Retrato de ' + nome : 'Retrato do agente') : '';
    if (refs.imagem.getAttribute('alt') !== alt) refs.imagem.setAttribute('alt', alt);
    if (valido) {
      if (refs.imagem.getAttribute('src') !== retrato) refs.imagem.setAttribute('src', retrato);
    } else if (refs.imagem.hasAttribute('src')) {
      refs.imagem.removeAttribute('src');
    }
  }

  /** Reduz a imagem para no máximo 320 px e devolve um JPEG (data URL) dentro do limite, ou '' se não couber. */
  function reduzir(imagem) {
    const largura = imagem.naturalWidth || imagem.width;
    const altura = imagem.naturalHeight || imagem.height;
    if (!largura || !altura) return '';
    const escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(largura * escala));
    canvas.height = Math.max(1, Math.round(altura * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) return '';
    contexto.fillStyle = '#ffffff'; // PNG transparente vira fundo branco no JPEG
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    for (let i = 0; i < QUALIDADES.length; i++) {
      const texto = canvas.toDataURL('image/jpeg', QUALIDADES[i]);
      if (OP.calc.retratoValido(texto)) return texto;
    }
    return '';
  }

  function aoEscolherArquivo() {
    const arquivo = refs.arquivo.files && refs.arquivo.files[0];
    refs.arquivo.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    if (['image/png', 'image/jpeg', 'image/webp'].indexOf(arquivo.type) === -1) {
      mensagemRetrato('Aviso: use uma imagem PNG, JPEG ou WEBP.');
      return;
    }
    if (arquivo.size > ARQUIVO_MAXIMO) {
      mensagemRetrato('Aviso: a imagem passa de 15 MB. Escolha uma menor.');
      return;
    }
    mensagemRetrato('Lendo a imagem…');
    const leitor = new FileReader();
    leitor.onerror = function () { mensagemRetrato('Aviso: não foi possível ler a imagem.'); };
    leitor.onload = function () {
      const origem = String(leitor.result || '');
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(origem)) {
        mensagemRetrato('Aviso: o arquivo não é uma imagem PNG, JPEG ou WEBP.');
        return;
      }
      const imagem = new Image();
      imagem.onerror = function () { mensagemRetrato('Aviso: a imagem está danificada ou não pôde ser aberta.'); };
      imagem.onload = function () {
        const texto = reduzir(imagem);
        if (!texto) {
          mensagemRetrato('Aviso: não foi possível reduzir a imagem o bastante. Tente outra.');
          return;
        }
        OP.state.atualizar('biografia.retrato', texto);
        mensagemRetrato('Retrato atualizado.');
        if (OP.uiApp) OP.uiApp.anunciar('Retrato atualizado.');
      };
      imagem.src = origem;
    };
    leitor.readAsDataURL(arquivo);
  }

  function aoRemoverRetrato() {
    OP.state.atualizar('biografia.retrato', '');
    mensagemRetrato('Retrato removido.');
    if (OP.uiApp) OP.uiApp.anunciar('Retrato removido.');
    refs.arquivo.focus();
  }

  /* ------------------------------------------------------------------------
     Aliados e rivais
     ------------------------------------------------------------------------ */

  const PESSOAS = {
    aliados: { caminho: 'biografia.aliados', singular: 'aliado', artigo: 'o' },
    rivais: { caminho: 'biografia.rivais', singular: 'rival', artigo: 'o' }
  };

  function criarPessoa(tipo, item) {
    const cfg = PESSOAS[tipo];
    const id = item.id;
    const raiz = criar('li', 'bio__pessoa');
    raiz.setAttribute('data-pessoa-id', id);

    const nome = criar('input', 'controle');
    nome.type = 'text';
    nome.setAttribute('maxlength', '200');
    nome.setAttribute('autocomplete', 'off');
    nome.setAttribute('placeholder', 'Nome');
    nome.setAttribute('data-pessoa-nome', id);

    const nota = criar('input', 'controle');
    nota.type = 'text';
    nota.setAttribute('maxlength', '5000');
    nota.setAttribute('autocomplete', 'off');
    nota.setAttribute('placeholder', 'Nota');
    nota.setAttribute('data-pessoa-nota', id);

    const remover = criar('button', 'botao-icone botao-icone--perigo');
    remover.type = 'button';
    remover.setAttribute('data-pessoa-remover', id);
    remover.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

    raiz.appendChild(nome);
    raiz.appendChild(nota);
    raiz.appendChild(remover);
    linhas[tipo][id] = { raiz: raiz, nome: nome, nota: nota, remover: remover };
    return linhas[tipo][id];
  }

  function escrever(campo, texto) {
    if (campo.value === texto) return;
    campo.value = texto;
  }

  function desenharPessoas(tipo) {
    const cfg = PESSOAS[tipo];
    const itens = ficha().biografia[tipo];
    const vistos = Object.create(null);
    const ordem = itens.map(function (item) {
      vistos[item.id] = true;
      const elementos = linhas[tipo][item.id] || criarPessoa(tipo, item);
      const nomeAviso = String(item.nome || '').trim();
      const quem = nomeAviso || cfg.singular + ' sem nome';
      const ariaNome = 'Nome d' + cfg.artigo + ' ' + cfg.singular;
      if (elementos.nome.getAttribute('aria-label') !== ariaNome) elementos.nome.setAttribute('aria-label', ariaNome);
      const ariaNota = 'Nota sobre ' + cfg.artigo + ' ' + cfg.singular + (nomeAviso ? ' ' + nomeAviso : '');
      if (elementos.nota.getAttribute('aria-label') !== ariaNota) elementos.nota.setAttribute('aria-label', ariaNota);
      const ariaRemover = 'Remover ' + cfg.singular + ' ' + quem;
      if (elementos.remover.getAttribute('aria-label') !== ariaRemover) {
        elementos.remover.setAttribute('aria-label', ariaRemover);
        elementos.remover.setAttribute('title', ariaRemover);
      }
      if (elementos.nome !== document.activeElement) escrever(elementos.nome, String(item.nome || ''));
      if (elementos.nota !== document.activeElement) escrever(elementos.nota, String(item.nota || ''));
      return elementos.raiz;
    });
    Object.keys(linhas[tipo]).forEach(function (id) {
      if (!vistos[id]) delete linhas[tipo][id];
    });
    const lista = refs[tipo];
    const atuais = Array.prototype.slice.call(lista.children);
    if (atuais.length !== ordem.length || !atuais.every(function (el, i) { return el === ordem[i]; })) {
      OP.ui.substituirFilhos(lista, ordem);
    }
    refs[tipo + 'Vazio'].hidden = itens.length > 0;
  }

  function indiceDe(tipo, id) {
    return ficha().biografia[tipo].findIndex(function (item) { return item.id === id; });
  }

  function adicionarPessoa(tipo) {
    const cfg = PESSOAS[tipo];
    const itens = ficha().biografia[tipo];
    if (itens.length >= OP.state.LIMITES.pessoas) {
      OP.uiApp.aviso('aviso', 'Aviso: limite de ' + OP.state.LIMITES.pessoas + ' ' + (tipo === 'aliados' ? 'aliados' : 'rivais') + ' atingido.');
      return;
    }
    const nova = OP.state.novaPessoa();
    OP.state.atualizar(cfg.caminho, itens.concat([nova]));
    const elementos = linhas[tipo][nova.id];
    if (elementos) elementos.nome.focus();
  }

  function aoEditarPessoa(tipo, evento) {
    const alvo = evento.target;
    const idNome = alvo.getAttribute && alvo.getAttribute('data-pessoa-nome');
    const idNota = alvo.getAttribute && alvo.getAttribute('data-pessoa-nota');
    const id = idNome || idNota;
    if (!id) return;
    const indice = indiceDe(tipo, id);
    if (indice === -1) return;
    const campo = idNome ? 'nome' : 'nota';
    if (ficha().biografia[tipo][indice][campo] !== alvo.value) {
      OP.state.atualizar(PESSOAS[tipo].caminho + '.' + indice + '.' + campo, alvo.value);
    }
  }

  function aoClicarPessoa(tipo, evento) {
    const botao = evento.target.closest('[data-pessoa-remover]');
    if (!botao) return;
    OP.ui.removerDeLista(PESSOAS[tipo].caminho, botao.getAttribute('data-pessoa-remover'));
    refs[tipo + 'Adicionar'].focus();
  }

  /* ------------------------------------------------------------------------
     Diário
     ------------------------------------------------------------------------ */

  /** Data de hoje no fuso local, "AAAA-MM-DD". */
  function hoje() {
    const d = new Date();
    const dois = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
  }

  /** "2026-03-09" → "09/03/2026"; qualquer outro texto fica como está. */
  function dataBonita(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || ''));
    return m ? m[3] + '/' + m[2] + '/' + m[1] : String(texto || '');
  }

  /** Entradas da mais recente para a mais antiga (datas inválidas por último; empate: a mais nova no array primeiro). */
  function ordenarDiario(itens) {
    return itens.map(function (item, indice) { return { item: item, indice: indice }; })
      .sort(function (a, b) {
        const da = /^\d{4}-\d{2}-\d{2}$/.test(a.item.data) ? a.item.data : '';
        const db = /^\d{4}-\d{2}-\d{2}$/.test(b.item.data) ? b.item.data : '';
        if (da !== db) return da < db ? 1 : -1;
        return b.indice - a.indice;
      })
      .map(function (par) { return par.item; });
  }

  function criarEntrada(item) {
    const id = item.id;
    const raiz = criar('li', 'bio__entrada');
    raiz.setAttribute('data-dia-id', id);
    const detalhes = criar('details', 'bio__detalhes');
    detalhes.setAttribute('data-dia-detalhes', id);
    const resumo = criar('summary', 'bio__resumo');
    const resumoData = criar('span', 'bio__resumo-data');
    const resumoTitulo = criar('span', 'bio__resumo-titulo');
    resumo.appendChild(resumoData);
    resumo.appendChild(resumoTitulo);
    detalhes.appendChild(resumo);

    const corpo = criar('div', 'bio__entrada-corpo');

    const campoData = criar('div', 'campo-texto');
    const rotuloData = criar('label', '', 'Data');
    const idData = 'dia-data-' + id;
    rotuloData.setAttribute('for', idData);
    const data = criar('input', 'controle');
    data.type = 'date';
    data.id = idData;
    data.setAttribute('data-dia-data', id);
    campoData.appendChild(rotuloData);
    campoData.appendChild(data);

    const campoTitulo = criar('div', 'campo-texto campo-texto--largo');
    const rotuloTitulo = criar('label', '', 'Título');
    const idTitulo = 'dia-titulo-' + id;
    rotuloTitulo.setAttribute('for', idTitulo);
    const titulo = criar('input', 'controle');
    titulo.type = 'text';
    titulo.id = idTitulo;
    titulo.setAttribute('maxlength', '200');
    titulo.setAttribute('autocomplete', 'off');
    titulo.setAttribute('placeholder', 'Sobre o que foi o dia');
    titulo.setAttribute('data-dia-titulo', id);
    campoTitulo.appendChild(rotuloTitulo);
    campoTitulo.appendChild(titulo);

    const campoTexto = criar('div', 'campo-texto campo-texto--cheio');
    const rotuloTexto = criar('label', '', 'Texto');
    const idTexto = 'dia-texto-' + id;
    rotuloTexto.setAttribute('for', idTexto);
    const texto = criar('textarea', 'controle');
    texto.id = idTexto;
    texto.rows = 5;
    texto.setAttribute('maxlength', String(OP.state.LIMITES.textoDiario));
    texto.setAttribute('data-dia-texto', id);
    campoTexto.appendChild(rotuloTexto);
    campoTexto.appendChild(texto);

    const remover = criar('button', 'botao botao--pequeno botao--perigo', 'Remover entrada');
    remover.type = 'button';
    remover.setAttribute('data-dia-remover', id);

    const campos = criar('div', 'bio__entrada-campos');
    campos.appendChild(campoData);
    campos.appendChild(campoTitulo);
    corpo.appendChild(campos);
    corpo.appendChild(campoTexto);
    corpo.appendChild(remover);
    detalhes.appendChild(corpo);
    raiz.appendChild(detalhes);

    detalhes.addEventListener('toggle', function () { abertas[id] = detalhes.open; });
    linhas.diario[id] = { raiz: raiz, detalhes: detalhes, resumoData: resumoData, resumoTitulo: resumoTitulo,
      data: data, titulo: titulo, texto: texto, remover: remover };
    return linhas.diario[id];
  }

  function desenharDiario() {
    const itens = ficha().biografia.diario;
    const vistos = Object.create(null);
    const ordenadas = ordenarDiario(itens);
    const ordem = ordenadas.map(function (item) {
      vistos[item.id] = true;
      const elementos = linhas.diario[item.id] || criarEntrada(item);
      definirTexto(elementos.resumoData, item.data ? dataBonita(item.data) : 'Sem data');
      const tituloTexto = String(item.titulo || '').trim();
      definirTexto(elementos.resumoTitulo, tituloTexto || 'Sem título');
      if (elementos.detalhes.open !== (abertas[item.id] === true)) elementos.detalhes.open = abertas[item.id] === true;
      if (elementos.data !== document.activeElement) {
        const valor = /^\d{4}-\d{2}-\d{2}$/.test(item.data) ? item.data : '';
        escrever(elementos.data, valor);
      }
      if (elementos.titulo !== document.activeElement) escrever(elementos.titulo, String(item.titulo || ''));
      if (elementos.texto !== document.activeElement) escrever(elementos.texto, String(item.texto || ''));
      const rotulo = 'Remover entrada do diário' + (tituloTexto ? ': ' + tituloTexto : '');
      if (elementos.remover.getAttribute('aria-label') !== rotulo) elementos.remover.setAttribute('aria-label', rotulo);
      return elementos.raiz;
    });
    Object.keys(linhas.diario).forEach(function (id) {
      if (!vistos[id]) {
        delete linhas.diario[id];
        delete abertas[id];
      }
    });
    const atuais = Array.prototype.slice.call(refs.diario.children);
    if (atuais.length !== ordem.length || !atuais.every(function (el, i) { return el === ordem[i]; })) {
      const focado = document.activeElement;
      OP.ui.substituirFilhos(refs.diario, ordem);
      if (focado && focado !== document.body && document.activeElement !== focado && refs.diario.contains(focado)) focado.focus();
    }
    refs.diarioVazio.hidden = itens.length > 0;
  }

  function novaEntrada() {
    const itens = ficha().biografia.diario;
    if (itens.length >= OP.state.LIMITES.diario) {
      OP.uiApp.aviso('aviso', 'Aviso: limite de ' + OP.state.LIMITES.diario + ' entradas do diário atingido.');
      return;
    }
    const nova = OP.state.novaEntradaDiario({ data: hoje() });
    abertas[nova.id] = true;
    OP.state.atualizar('biografia.diario', itens.concat([nova]));
    const elementos = linhas.diario[nova.id];
    if (elementos) {
      elementos.detalhes.open = true;
      elementos.titulo.focus();
    }
  }

  function aoEditarDiario(evento) {
    const alvo = evento.target;
    if (!alvo.getAttribute) return;
    const mapa = [['data-dia-data', 'data'], ['data-dia-titulo', 'titulo'], ['data-dia-texto', 'texto']];
    for (let i = 0; i < mapa.length; i++) {
      const id = alvo.getAttribute(mapa[i][0]);
      if (!id) continue;
      const indice = indiceDe('diario', id);
      if (indice === -1) return;
      if (ficha().biografia.diario[indice][mapa[i][1]] !== alvo.value) {
        OP.state.atualizar('biografia.diario.' + indice + '.' + mapa[i][1], alvo.value);
      }
      return;
    }
  }

  function aoClicarDiario(evento) {
    const botao = evento.target.closest('[data-dia-remover]');
    if (!botao) return;
    const id = botao.getAttribute('data-dia-remover');
    const indice = indiceDe('diario', id);
    if (indice === -1) return;
    const item = ficha().biografia.diario[indice];
    const nome = String(item.titulo || '').trim() || 'entrada sem título';
    const aberto = OP.ui.confirmar({
      titulo: 'Remover entrada do diário?',
      texto: 'A entrada "' + nome + '" (' + (item.data ? dataBonita(item.data) : 'sem data') + ') será removida. Logo depois, o aviso oferece Desfazer por alguns segundos.',
      textoConfirmar: 'Remover',
      perigo: true,
      aoConfirmar: function () {
        OP.ui.removerDeLista('biografia.diario', id);
        refs.diarioNovo.focus();
      }
    });
    if (aberto === false) OP.uiApp.aviso('aviso', 'Aviso: feche a janela aberta antes de remover a entrada.');
  }

  /* ------------------------------------------------------------------------
     Textareas que crescem com o conteúdo
     ------------------------------------------------------------------------ */

  const nativo = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('field-sizing', 'content');

  /** Altura = conteúdo, sem mexer no cursor (o valor não é regravado). Com field-sizing o CSS já faz isso. */
  function ajustarAltura(area) {
    if (nativo || !area || area.offsetParent === null) return;
    const rolagem = window.scrollY;
    area.style.height = 'auto';
    const extra = area.offsetHeight - area.clientHeight;
    area.style.height = (area.scrollHeight + extra) + 'px';
    if (window.scrollY !== rolagem) window.scrollTo(window.scrollX, rolagem);
    area.dataset.alturaTam = String(area.value.length);
  }

  function ajustarTodas() {
    if (nativo) return;
    document.querySelectorAll('#ficha textarea').forEach(function (area) {
      if (area.dataset.alturaTam !== String(area.value.length)) ajustarAltura(area);
    });
  }

  /* ------------------------------------------------------------------------
     Impressão: o diário só vai se a preferência estiver ligada
     ------------------------------------------------------------------------ */

  function antesDeImprimir() {
    const incluir = OP.prefs.aparencia().incluirDiarioNaImpressao;
    document.documentElement.setAttribute('data-diario-impressao', incluir ? 'sim' : 'nao');
    // O diário impresso mostra todas as entradas abertas (o ui.js abre os <details> e depois os restaura)
  }

  function depoisDeImprimir() {
    document.documentElement.removeAttribute('data-diario-impressao');
  }

  /* ------------------------------------------------------------------------
     Montagem e desenho
     ------------------------------------------------------------------------ */

  function pegar(id) {
    return document.getElementById(id);
  }

  function desenhar() {
    if (!refs.secao) return;
    desenharRetrato();
    desenharPessoas('aliados');
    desenharPessoas('rivais');
    desenharDiario();
    const incluir = OP.prefs.aparencia().incluirDiarioNaImpressao;
    if (refs.diarioImprimir.checked !== incluir) refs.diarioImprimir.checked = incluir;
    ajustarTodas();
  }

  function montar() {
    refs.secao = pegar('secao-biografia');
    if (!refs.secao) return;
    refs.moldura = pegar('bio-moldura');
    refs.imagem = pegar('bio-imagem');
    refs.semImagem = pegar('bio-sem-imagem');
    refs.arquivo = pegar('bio-arquivo');
    refs.removerRetrato = pegar('bio-remover-retrato');
    refs.retratoMsg = pegar('bio-retrato-msg');
    refs.aliados = pegar('bio-aliados');
    refs.rivais = pegar('bio-rivais');
    refs.aliadosVazio = pegar('bio-aliados-vazio');
    refs.rivaisVazio = pegar('bio-rivais-vazio');
    refs.aliadosAdicionar = pegar('bio-aliados-adicionar');
    refs.rivaisAdicionar = pegar('bio-rivais-adicionar');
    refs.diario = pegar('bio-diario');
    refs.diarioVazio = pegar('bio-diario-vazio');
    refs.diarioNovo = pegar('bio-diario-novo');
    refs.diarioImprimir = pegar('bio-diario-imprimir');

    refs.arquivo.addEventListener('change', aoEscolherArquivo);
    refs.removerRetrato.addEventListener('click', aoRemoverRetrato);
    ['aliados', 'rivais'].forEach(function (tipo) {
      refs[tipo + 'Adicionar'].addEventListener('click', function () { adicionarPessoa(tipo); });
      refs[tipo].addEventListener('input', function (evento) { aoEditarPessoa(tipo, evento); });
      refs[tipo].addEventListener('click', function (evento) { aoClicarPessoa(tipo, evento); });
    });

    refs.diarioNovo.addEventListener('click', novaEntrada);
    refs.diario.addEventListener('input', aoEditarDiario);
    refs.diario.addEventListener('change', aoEditarDiario);
    refs.diario.addEventListener('click', aoClicarDiario);
    refs.diarioImprimir.addEventListener('change', function () {
      OP.prefs.definirAparencia({ incluirDiarioNaImpressao: refs.diarioImprimir.checked });
    });

    // Textareas: crescem ao digitar e ao abrir um <details> (o evento toggle não borbulha: captura)
    const raiz = pegar('ficha');
    raiz.addEventListener('input', function (evento) {
      if (evento.target && evento.target.tagName === 'TEXTAREA') ajustarAltura(evento.target);
    });
    raiz.addEventListener('toggle', function () { ajustarTodas(); }, true);
    window.addEventListener('resize', function () {
      document.querySelectorAll('#ficha textarea').forEach(function (area) { delete area.dataset.alturaTam; });
      ajustarTodas();
    });

    window.addEventListener('beforeprint', antesDeImprimir);
    window.addEventListener('afterprint', depoisDeImprimir);

    OP.ui.registrarExtensao({ desenhar: desenhar });
  }

  OP.uiBiografia = {
    montar: montar,
    ajustarAltura: ajustarAltura,
    hoje: hoje,
    dataBonita: dataBonita,
    ordenarDiario: ordenarDiario
  };
})(window.OP);
