/* ==========================================================================
   js/ui-fichas.js — Central de operações, Arquivo de agentes e operações
   com fichas (OP.uiFichas)
   --------------------------------------------------------------------------
   - Barra global: nome da ficha aberta e indicador de salvamento; faixas de
     falha ao salvar e de mudança em outra aba.
   - Central: "continuar de onde parou" (a ficha aberta por último), as
     atualizadas recentemente e a situação do arquivo neste navegador.
   - Arquivo: busca, filtro por classe, ordenação e cartões com Abrir,
     Duplicar, Exportar e Excluir (com confirmação).
   - Importar (botão ou arrastar e soltar), exportar, backup e impressão.
   Tudo o que aparece vem das fichas salvas (OP.fichas) e dos cálculos
   (OP.calc): nada é inventado. Dados das fichas só entram na página por
   textContent, .value ou setAttribute — nunca por innerHTML: arquivos
   importados não são confiáveis. Confirmações usam <dialog>
   (OP.ui.confirmar), nunca window.confirm.
   ========================================================================== */
window.OP = window.OP || {};

(function (OP) {
  'use strict';

  const LIMITE_ARQUIVO = 2 * 1024 * 1024; // 2 MB
  const MAXIMO_RECENTES = 5;
  const refs = {};
  // Filtros do Arquivo: só da tela (não são salvos).
  const filtros = { busca: '', classe: 'todas', ordem: 'recentes' };

  /* ------------------------------------------------------------------------
     Utilitários
     ------------------------------------------------------------------------ */

  /** Cria um elemento com classe e texto (sempre por textContent). */
  function criar(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined && texto !== null && texto !== '') elemento.textContent = String(texto);
    return elemento;
  }

  /** Ícone do sprite do index.html (<symbol id="ic-...">). */
  function icone(nome, classe) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', classe || 'icone-ui');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const uso = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    uso.setAttribute('href', '#ic-' + nome);
    svg.appendChild(uso);
    return svg;
  }

  function substituirFilhos(pai, filhos) {
    const fragmento = document.createDocumentFragment();
    filhos.forEach(function (filho) { if (filho) fragmento.appendChild(filho); });
    pai.textContent = '';
    pai.appendChild(fragmento);
  }

  function doisDigitos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function hora(data) {
    return doisDigitos(data.getHours()) + ':' + doisDigitos(data.getMinutes());
  }

  function dataCurta(data) {
    return doisDigitos(data.getDate()) + '/' + doisDigitos(data.getMonth() + 1) + '/' + data.getFullYear();
  }

  function mesmoDia(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /** "agora há pouco", "há 12 min", "há 3 h", "ontem às 21:10", "há 4 dias", "02/03/2026". */
  function tempoRelativo(data) {
    if (!data) return '';
    const agora = new Date();
    const minutos = Math.round((agora.getTime() - data.getTime()) / 60000);
    if (minutos < 1) return 'agora há pouco';
    if (minutos < 60) return 'há ' + minutos + ' min';
    if (mesmoDia(data, agora)) return 'hoje às ' + hora(data);
    const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
    if (mesmoDia(data, ontem)) return 'ontem às ' + hora(data);
    const dias = Math.floor(minutos / 1440);
    if (dias < 7) return 'há ' + Math.max(2, dias) + ' dias';
    return 'em ' + dataCurta(data);
  }

  function dataValida(texto) {
    const data = new Date(texto);
    return Number.isFinite(data.getTime()) ? data : null;
  }

  function nomeExibido(nome) {
    const texto = String(nome || '').trim();
    return texto || 'Sem nome';
  }

  /** "Liz Webber" → "LW"; "Dante" → "DA"; vazio → "?". */
  function monograma(nome) {
    const palavras = String(nome || '').trim().split(/\s+/).filter(function (palavra) {
      return /^[\p{L}\p{N}]/u.test(palavra);
    });
    if (!palavras.length) return '?';
    if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
    return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
  }

  /** Código curto do registro, derivado do id da ficha: "3F9A-2C1E". */
  function codigoRegistro(id) {
    const limpo = String(id || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!limpo) return '—';
    return limpo.slice(0, 4) + (limpo.length > 4 ? '-' + limpo.slice(4, 8) : '');
  }

  function semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function nomeClasse(id) {
    const classe = OP.calc.classeDados(id);
    return classe ? classe.nome : 'Sem classe';
  }

  /** "Ocultista · NEX 5%" (Sobrevivente: "Sobrevivente · Estágio 2"). */
  function resumoClasseNex(classe, nex, estagio) {
    const dados = OP.calc.classeDados(classe);
    if (dados && dados.unidadeProgressao === 'estagio') return dados.nome + ' · Estágio ' + (Number(estagio) || 1);
    return nomeClasse(classe) + ' · NEX ' + (Number(nex) || 0) + '%';
  }

  function dadosTema(id) {
    return (OP.data.temasFicha || []).find(function (tema) { return tema.id === id; }) || OP.data.temasFicha[0];
  }

  /** Baixa um texto como arquivo (Blob + <a download>; funciona em file://). */
  function baixar(nomeArquivo, texto) {
    try {
      const blob = new Blob([texto], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (erro) {
      return false;
    }
  }

  function aviso(tipo, texto, opcoes) {
    if (OP.uiApp) OP.uiApp.aviso(tipo, texto, opcoes);
  }

  function irPara(vista, id, opcoes) {
    if (OP.uiApp) OP.uiApp.irPara(vista, id, opcoes);
  }

  function vistaAtual() {
    return OP.uiApp ? OP.uiApp.vistaAtual() : document.body.dataset.vista;
  }

  /* ------------------------------------------------------------------------
     Resumo de cada ficha (lido do armazenamento e calculado; nada inventado)
     ------------------------------------------------------------------------ */

  /** Vitais calculados { pv, pe, san } com atual, máximo e % (ou null sem classe). */
  function vitais(derivados, semSanidade) {
    const resultado = {};
    let definido = false;
    OP.data.recursos.forEach(function (recurso) {
      const estado = derivados.recursos[recurso.id];
      if (estado && estado.classeDefinida) definido = true;
      resultado[recurso.id] = {
        sigla: recurso.sigla,
        nome: recurso.nome,
        atual: estado ? estado.atual : null,
        max: estado ? estado.max : null,
        percentual: estado ? OP.calc.numero(estado.percentual) : 0
      };
    });
    // Sem Sanidade (regra opcional): PD no lugar do PE e sem SAN
    if (semSanidade) {
      resultado.pe.sigla = 'PD';
      resultado.pe.nome = 'Pontos de Determinação';
      delete resultado.san;
    }
    return definido ? resultado : null;
  }

  /**
   * Resumo de uma linha do índice. A ficha aberta vem da memória (mais
   * recente); as outras, do armazenamento. corrompida: não deu para ler.
   */
  function resumir(linha, posicao) {
    const aberta = linha.id === OP.fichas.idAtual();
    const ficha = aberta ? OP.state.ficha : OP.fichas.ler(linha.id);
    const base = {
      id: linha.id,
      posicao: posicao,
      aberta: aberta,
      nome: nomeExibido(linha.nome),
      nomeVazio: String(linha.nome || '').trim() === '',
      monograma: monograma(linha.nome),
      codigo: codigoRegistro(linha.id),
      classeId: linha.classe,
      classeTexto: resumoClasseNex(linha.classe, linha.nex, linha.estagio),
      nivel: Number(linha.nex) || 0,
      atualizadoEm: dataValida(linha.atualizadoEm),
      tema: dadosTema(OP.prefs.tema(linha.id)),
      jogador: '',
      origem: '',
      trilha: '',
      vitais: null,
      defesa: null,
      corrompida: !ficha
    };
    if (!ficha) return base;

    const derivados = OP.calc.calcularTudo(ficha);
    const ident = ficha.identificacao;
    const identidade = derivados.identidade;
    base.nome = nomeExibido(ident.nome);
    base.nomeVazio = String(ident.nome || '').trim() === '';
    base.monograma = monograma(ident.nome);
    base.classeId = ident.classe;
    base.classeTexto = resumoClasseNex(ident.classe, ident.nex, ident.estagio);
    base.nivel = derivados.nex.unidade === 'estagio' ? OP.calc.numero(ident.estagio) : OP.calc.numero(ident.nex);
    base.jogador = String(ident.jogador || '').trim();
    base.origem = identidade.origem ? identidade.origem.nome : (ident.origem === 'outra' ? String(ident.origemTexto || '').trim() : '');
    base.trilha = identidade.trilha ? identidade.trilha.nome : (ident.trilha === 'outra' ? String(ident.trilhaTexto || '').trim() : '');
    base.vitais = vitais(derivados, OP.calc.semSanidade(ficha));
    base.defesa = derivados.defesa ? derivados.defesa.total : null;
    return base;
  }

  /** Resumos de todas as fichas do índice, na ordem do arquivo. */
  function resumos() {
    return OP.fichas.listar().map(resumir);
  }

  /** Mais recente primeiro (sem data vai para o fim). */
  function porData(a, b) {
    const ta = a.atualizadoEm ? a.atualizadoEm.getTime() : 0;
    const tb = b.atualizadoEm ? b.atualizadoEm.getTime() : 0;
    return tb - ta || a.posicao - b.posicao;
  }

  /* ------------------------------------------------------------------------
     Peças visuais reutilizadas (Central e Arquivo)
     ------------------------------------------------------------------------ */

  function criarMonograma(resumo, classeExtra) {
    const selo = criar('span', 'monograma' + (classeExtra ? ' ' + classeExtra : ''));
    selo.setAttribute('aria-hidden', 'true');
    selo.appendChild(criar('span', 'monograma__letras', resumo.monograma));
    selo.appendChild(icone(resumo.tema.id, 'monograma__elemento'));
    return selo;
  }

  /** Barras de PV, PE e SAN (somente leitura). */
  function criarVitais(resumo, classeExtra) {
    if (!resumo.vitais) {
      return criar('p', 'mini-vitais mini-vitais--vazio' + (classeExtra ? ' ' + classeExtra : ''), 'Vitais calculados após escolher a classe.');
    }
    const lista = criar('dl', 'mini-vitais' + (classeExtra ? ' ' + classeExtra : ''));
    ['pv', 'pe', 'san'].forEach(function (id) {
      const vital = resumo.vitais[id];
      if (!vital) return;
      const zerado = vital.atual === 0 && vital.max > 0;
      const item = criar('div', 'mini-vital mini-vital--' + id + (id === 'pe' && vital.sigla === 'PD' ? ' mini-vital--pd' : '') + (zerado ? ' mini-vital--zero' : ''));
      item.title = vital.nome + ': ' + vital.atual + ' de ' + vital.max + (zerado ? ' (zerado)' : '');
      item.appendChild(criar('dt', 'mini-vital__sigla', vital.sigla));
      const valor = criar('dd', 'mini-vital__valor');
      valor.appendChild(criar('span', 'mini-vital__atual', vital.atual === null ? '—' : vital.atual));
      valor.appendChild(criar('span', 'mini-vital__max', '/' + (vital.max === null ? '—' : vital.max)));
      if (zerado) valor.appendChild(criar('span', 'mini-vital__estado', 'zerado'));
      const barra = criar('span', 'mini-vital__barra');
      barra.setAttribute('aria-hidden', 'true');
      const preenchido = criar('span', 'mini-vital__preenchido');
      preenchido.style.setProperty('--preenchimento', Math.max(0, Math.min(100, vital.percentual)) + '%');
      barra.appendChild(preenchido);
      valor.appendChild(barra);
      item.appendChild(valor);
      lista.appendChild(item);
    });
    return lista;
  }

  function criarTempo(resumo, prefixo) {
    const tempo = criar('time', 'carimbo-tempo');
    if (resumo.atualizadoEm) {
      tempo.setAttribute('datetime', resumo.atualizadoEm.toISOString());
      tempo.title = dataCurta(resumo.atualizadoEm) + ' ' + hora(resumo.atualizadoEm);
      tempo.textContent = (prefixo || 'Atualizada ') + tempoRelativo(resumo.atualizadoEm);
    } else {
      tempo.textContent = 'Sem data de atualização';
    }
    return tempo;
  }

  /** "Acadêmico · Graduado" (o que houver). */
  function textoOrigemTrilha(resumo) {
    return [resumo.origem, resumo.trilha].filter(Boolean).join(' · ');
  }

  function aplicarCorTema(elemento, resumo) {
    elemento.setAttribute('data-tema-cartao', resumo.tema.id);
    elemento.style.setProperty('--cor-tema', resumo.tema.cor);
  }

  /** Estado vazio com o selo (Central e Arquivo). */
  function criarEstadoVazio(titulo, texto) {
    const caixa = criar('div', 'estado-vazio__conteudo');
    const desenho = criar('div', 'estado-vazio__selo');
    desenho.setAttribute('aria-hidden', 'true');
    desenho.appendChild(icone('central', 'estado-vazio__icone'));
    caixa.appendChild(desenho);
    caixa.appendChild(criar('p', 'estado-vazio__titulo', titulo));
    caixa.appendChild(criar('p', 'estado-vazio__texto', texto));
    const acoes = criar('div', 'estado-vazio__acoes');
    const nova = criar('button', 'botao botao--primario');
    nova.type = 'button';
    nova.setAttribute('data-acao-app', 'nova-ficha');
    nova.appendChild(icone('mais'));
    nova.appendChild(document.createTextNode('Criar a primeira ficha'));
    acoes.appendChild(nova);
    const importar = criar('button', 'botao');
    importar.type = 'button';
    importar.setAttribute('data-acao-app', 'importar');
    importar.appendChild(icone('importar'));
    importar.appendChild(document.createTextNode('Importar .json'));
    acoes.appendChild(importar);
    caixa.appendChild(acoes);
    return caixa;
  }

  /* ------------------------------------------------------------------------
     Central de operações
     ------------------------------------------------------------------------ */

  /** Cartão grande "continuar": a ficha aberta por último. */
  function criarDestaque(resumo) {
    const cartao = criar('article', 'destaque');
    aplicarCorTema(cartao, resumo);
    cartao.setAttribute('aria-labelledby', 'destaque-nome');

    const topo = criar('div', 'destaque__topo');
    topo.appendChild(criar('span', 'destaque__codigo', 'Registro ' + resumo.codigo));
    const tema = criar('span', 'destaque__tema');
    tema.appendChild(icone(resumo.tema.id));
    tema.appendChild(document.createTextNode(resumo.tema.nome));
    topo.appendChild(tema);
    cartao.appendChild(topo);

    const identidade = criar('div', 'destaque__identidade');
    identidade.appendChild(criarMonograma(resumo, 'monograma--grande'));
    const textos = criar('div', 'destaque__textos');
    const nome = criar('h3', 'destaque__nome' + (resumo.nomeVazio ? ' destaque__nome--vazio' : ''), resumo.nome);
    nome.id = 'destaque-nome';
    textos.appendChild(nome);
    textos.appendChild(criar('p', 'destaque__classe', resumo.classeTexto));
    const origem = textoOrigemTrilha(resumo);
    if (origem) textos.appendChild(criar('p', 'destaque__origem', origem));
    if (resumo.jogador) textos.appendChild(criar('p', 'destaque__jogador', 'Jogador: ' + resumo.jogador));
    identidade.appendChild(textos);
    cartao.appendChild(identidade);

    const painel = criar('div', 'destaque__painel');
    painel.appendChild(criarVitais(resumo, 'mini-vitais--grande'));
    if (resumo.vitais && resumo.defesa !== null) {
      const defesa = criar('p', 'destaque__defesa');
      defesa.appendChild(criar('span', 'destaque__defesa-rotulo', 'Defesa'));
      defesa.appendChild(criar('span', 'destaque__defesa-valor', resumo.defesa));
      painel.appendChild(defesa);
    }
    cartao.appendChild(painel);

    const rodape = criar('div', 'destaque__rodape');
    rodape.appendChild(criarTempo(resumo));
    const abrir = criar('a', 'botao botao--primario');
    abrir.href = '#/ficha/' + encodeURIComponent(resumo.id);
    abrir.appendChild(document.createTextNode(resumo.aberta ? 'Continuar na ficha' : 'Abrir ficha'));
    abrir.appendChild(icone('seta'));
    abrir.setAttribute('aria-label', (resumo.aberta ? 'Continuar na ficha de ' : 'Abrir a ficha de ') + resumo.nome);
    rodape.appendChild(abrir);
    cartao.appendChild(rodape);
    return cartao;
  }

  function criarLinhaRecente(resumo) {
    const item = criar('li', 'recente');
    aplicarCorTema(item, resumo);
    const link = criar('a', 'recente__link');
    link.href = '#/ficha/' + encodeURIComponent(resumo.id);
    link.appendChild(criarMonograma(resumo, 'monograma--pequeno'));
    const textos = criar('span', 'recente__textos');
    textos.appendChild(criar('span', 'recente__nome' + (resumo.nomeVazio ? ' recente__nome--vazio' : ''), resumo.nome));
    textos.appendChild(criar('span', 'recente__classe', resumo.classeTexto));
    link.appendChild(textos);
    const tempo = criarTempo(resumo, ' ');
    tempo.classList.add('recente__tempo');
    tempo.textContent = resumo.atualizadoEm ? tempoRelativo(resumo.atualizadoEm) : '—';
    link.appendChild(tempo);
    link.appendChild(icone('seta', 'icone-ui recente__seta'));
    item.appendChild(link);
    return item;
  }

  function linhaStatus(rotulo, valor, tipo) {
    const linha = criar('div', 'status-arquivo__linha' + (tipo ? ' status-arquivo__linha--' + tipo : ''));
    linha.appendChild(criar('dt', '', rotulo));
    linha.appendChild(criar('dd', '', valor));
    return linha;
  }

  function desenharCentral() {
    const lista = resumos();
    const atualId = (OP.fichas.lerIndice() || {}).atualId;
    const ordenadas = lista.slice().sort(porData);
    let principal = null;
    if (!OP.fichas.ehRascunho()) principal = lista.find(function (r) { return r.id === OP.fichas.idAtual(); }) || null;
    if (!principal && atualId) principal = lista.find(function (r) { return r.id === atualId; }) || null;
    if (!principal) principal = ordenadas[0] || null;

    refs.central.dataset.vazia = lista.length ? 'nao' : 'sim';
    if (refs.tituloContinuar) {
      const rotulo = lista.length ? 'Continuar de onde parou' : 'Comece por aqui';
      if (refs.tituloContinuar.textContent !== rotulo) refs.tituloContinuar.textContent = rotulo;
    }
    if (!principal) {
      substituirFilhos(refs.continuar, [criarEstadoVazio('Nenhum agente no arquivo ainda.',
        'Registre o primeiro agente para começar, ou importe um .json exportado de outro navegador.')]);
    } else {
      substituirFilhos(refs.continuar, [criarDestaque(principal)]);
    }

    const outras = ordenadas.filter(function (r) { return !principal || r.id !== principal.id; }).slice(0, MAXIMO_RECENTES);
    refs.blocoRecentes.hidden = outras.length === 0;
    substituirFilhos(refs.recentes, outras.map(criarLinhaRecente));

    // Situação do arquivo neste navegador (dados reais)
    const memoria = OP.storage.modo() === 'memoria';
    const uso = OP.storage.uso();
    const avisoUso = uso.fracao > LIMITE_AVISO_USO;
    if (refs.avisoUso) {
      refs.avisoUso.hidden = !avisoUso;
      if (avisoUso) {
        refs.avisoUso.textContent = 'Aviso: o armazenamento deste navegador está em ' + Math.round(uso.fracao * 100) +
          '% da cota. Exporte um backup e apague fichas ou retratos que não usa mais.';
      }
    }
    const ultima = ordenadas.length && ordenadas[0].atualizadoEm ? tempoRelativo(ordenadas[0].atualizadoEm) : '—';
    const fontes = OP.prefs.fontesAtivas();
    const totalFontes = Object.keys(fontes).length;
    const ativas = Object.keys(fontes).filter(function (id) { return fontes[id]; }).length;
    substituirFilhos(refs.statusArquivo, [
      linhaStatus('Agentes registrados', String(lista.length)),
      linhaStatus('Armazenamento', memoria ? 'Temporário — some ao fechar' : 'Neste navegador', memoria ? 'alerta' : 'ok'),
      linhaStatus('Armazenamento usado', textoUso(uso), uso.fracao > LIMITE_AVISO_USO ? 'alerta' : 'ok'),
      linhaStatus('Última atualização', ultima),
      linhaStatus('Fontes ativas', ativas + ' de ' + totalFontes)
    ]);
  }

  // Aviso quando o armazenamento passa de 80% da cota aproximada
  const LIMITE_AVISO_USO = 0.8;

  /** "412 KB de ~5 MB" / "1,3 MB de ~5 MB". */
  function textoUso(uso) {
    const mb = uso.usado / (1024 * 1024);
    const usado = mb >= 1
      ? (Math.round(mb * 10) / 10).toString().replace('.', ',') + ' MB'
      : Math.max(1, Math.round(uso.usado / 1024)) + ' KB';
    return usado + ' de ~' + Math.round(uso.limite / (1024 * 1024)) + ' MB';
  }

  /* ------------------------------------------------------------------------
     Arquivo de agentes
     ------------------------------------------------------------------------ */

  const ACOES_CARTAO = [
    { id: 'duplicar', rotulo: 'Duplicar', icone: 'duplicar' },
    { id: 'exportar', rotulo: 'Exportar', icone: 'exportar' },
    { id: 'excluir', rotulo: 'Excluir', icone: 'lixeira' }
  ];

  function criarCartao(resumo) {
    const item = criar('li', 'cartao-agente' + (resumo.aberta ? ' cartao-agente--aberta' : '') +
      (resumo.corrompida ? ' cartao-agente--corrompida' : ''));
    aplicarCorTema(item, resumo);
    item.setAttribute('data-ficha', resumo.id);

    const topo = criar('div', 'cartao-agente__topo');
    topo.appendChild(criar('span', 'cartao-agente__codigo', 'Reg. ' + resumo.codigo));
    if (resumo.aberta) topo.appendChild(criar('span', 'cartao-agente__selo', 'Em uso'));
    if (resumo.corrompida) topo.appendChild(criar('span', 'cartao-agente__selo cartao-agente__selo--erro', 'Ilegível'));
    item.appendChild(topo);

    const identidade = criar('div', 'cartao-agente__identidade');
    identidade.appendChild(criarMonograma(resumo));
    const textos = criar('div', 'cartao-agente__textos');
    const titulo = criar('h3', 'cartao-agente__nome');
    const link = criar('a', 'cartao-agente__link' + (resumo.nomeVazio ? ' cartao-agente__link--vazio' : ''), resumo.nome);
    link.href = '#/ficha/' + encodeURIComponent(resumo.id);
    link.setAttribute('data-abrir-ficha', resumo.id);
    titulo.appendChild(link);
    textos.appendChild(titulo);
    textos.appendChild(criar('p', 'cartao-agente__classe', resumo.classeTexto));
    identidade.appendChild(textos);
    item.appendChild(identidade);

    const detalhes = criar('dl', 'cartao-agente__detalhes');
    [['Origem · trilha', textoOrigemTrilha(resumo) || '—'], ['Jogador', resumo.jogador || '—']].forEach(function (par) {
      const linha = criar('div', 'cartao-agente__detalhe');
      linha.appendChild(criar('dt', '', par[0]));
      linha.appendChild(criar('dd', '', par[1]));
      detalhes.appendChild(linha);
    });
    item.appendChild(detalhes);

    item.appendChild(criarVitais(resumo));

    const rodape = criar('div', 'cartao-agente__rodape');
    rodape.appendChild(criarTempo(resumo));
    const acoes = criar('div', 'cartao-agente__acoes');
    ACOES_CARTAO.forEach(function (acao) {
      const botao = criar('button', 'botao-icone' + (acao.id === 'excluir' ? ' botao-icone--perigo' : ''));
      botao.type = 'button';
      botao.setAttribute('data-ficha-acao', acao.id);
      botao.setAttribute('data-ficha-id', resumo.id);
      botao.setAttribute('aria-label', acao.rotulo + ' a ficha ' + resumo.nome);
      botao.title = acao.rotulo;
      if (acao.id !== 'excluir' && resumo.corrompida) botao.disabled = true;
      botao.appendChild(icone(acao.icone));
      acoes.appendChild(botao);
    });
    rodape.appendChild(acoes);
    item.appendChild(rodape);
    return item;
  }

  function casaFiltros(resumo, termo) {
    if (filtros.classe !== 'todas') {
      const classe = resumo.classeId || 'sem-classe';
      if (classe !== filtros.classe) return false;
    }
    if (!termo) return true;
    const alvo = semAcento([resumo.nome, resumo.jogador, resumo.origem, resumo.trilha, resumo.classeTexto, resumo.codigo].join(' '));
    return alvo.indexOf(termo) !== -1;
  }

  function ordenar(lista) {
    const copia = lista.slice();
    if (filtros.ordem === 'nome') {
      copia.sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.posicao - b.posicao; });
    } else if (filtros.ordem === 'nivel') {
      copia.sort(function (a, b) { return b.nivel - a.nivel || a.posicao - b.posicao; });
    } else if (filtros.ordem === 'ordem') {
      copia.sort(function (a, b) { return a.posicao - b.posicao; });
    } else {
      copia.sort(porData);
    }
    return copia;
  }

  /** Botões de filtro por classe (as classes que existem nos dados, mais "Sem classe"). */
  function montarFiltroClasse() {
    const opcoes = [{ id: 'todas', nome: 'Todas' }]
      .concat(OP.calc.classesLista().map(function (c) { return { id: c.id, nome: c.nome }; }))
      .concat([{ id: 'sem-classe', nome: 'Sem classe' }]);
    substituirFilhos(refs.filtroClasse, opcoes.map(function (opcao) {
      const botao = criar('button', 'segmentado__opcao', opcao.nome);
      botao.type = 'button';
      botao.setAttribute('data-filtro-classe', opcao.id);
      botao.setAttribute('aria-pressed', String(opcao.id === filtros.classe));
      return botao;
    }));
  }

  function desenharArquivo() {
    const lista = resumos();
    const termo = semAcento(filtros.busca);
    const visiveis = ordenar(lista.filter(function (r) { return casaFiltros(r, termo); }));

    refs.contagem.textContent = lista.length === 1 ? '1 agente registrado' : lista.length + ' agentes registrados';
    if (lista.length && visiveis.length !== lista.length) refs.contagem.textContent += ' · ' + visiveis.length + ' na busca';

    refs.filtroClasse.querySelectorAll('[data-filtro-classe]').forEach(function (botao) {
      botao.setAttribute('aria-pressed', String(botao.getAttribute('data-filtro-classe') === filtros.classe));
    });

    substituirFilhos(refs.lista, visiveis.map(criarCartao));
    refs.lista.hidden = visiveis.length === 0;
    if (refs.tituloLista) refs.tituloLista.hidden = refs.lista.hidden;
    refs.ferramentas.hidden = lista.length === 0;
    refs.dica.hidden = lista.length === 0;

    refs.vazio.hidden = lista.length > 0;
    if (!lista.length && !refs.vazio.firstChild) {
      refs.vazio.appendChild(criarEstadoVazio('O arquivo está vazio.',
        'Nenhuma ficha salva neste navegador. Crie uma nova ou importe um arquivo .json (de uma ficha ou de um backup).'));
    }
    refs.semResultado.hidden = !(lista.length > 0 && visiveis.length === 0);
  }

  /** Atualiza a contagem da navegação e a tela que estiver visível. */
  function atualizarListas() {
    const total = OP.fichas.listar().length;
    refs.navContagem.textContent = total ? String(total) : '';
    const vista = vistaAtual();
    if (vista === 'central') desenharCentral();
    if (vista === 'arquivo') desenharArquivo();
  }

  /** Destaca um cartão por um instante (ex.: a cópia recém-criada). */
  function destacarCartao(id) {
    const cartao = refs.lista.querySelector('[data-ficha="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!cartao) return;
    cartao.classList.add('cartao-agente--novo');
    setTimeout(function () { cartao.classList.remove('cartao-agente--novo'); }, 1600);
  }

  /* ------------------------------------------------------------------------
     Ações com fichas
     ------------------------------------------------------------------------ */

  function novaFicha() {
    const id = OP.fichas.criar();
    const resultado = OP.fichas.abrir(id);
    if (!resultado.ok) {
      aviso('erro', resultado.erro);
      atualizarListas();
      return;
    }
    atualizarListas();
    // Depois da troca de tela, o foco vai para o nome: é só começar a digitar
    irPara('ficha', id, { focar: 'campo-nome' });
    aviso('ok', 'Novo agente registrado. Comece pelo nome.');
  }

  function duplicarFicha(id) {
    const novo = OP.fichas.duplicar(id);
    if (!novo) {
      aviso('erro', 'Não foi possível duplicar esta ficha.');
      return;
    }
    // A cópia herda a aparência da original
    const tema = OP.prefs.tema(id);
    if (tema !== OP.prefs.temaPadrao()) OP.prefs.definirTema(novo, tema);
    atualizarListas();
    destacarCartao(novo);
    const copia = OP.fichas.listar().find(function (linha) { return linha.id === novo; });
    aviso('ok', 'Cópia criada: ' + nomeExibido(copia && copia.nome) + '.', {
      acao: { rotulo: 'Abrir', fazer: function () { irPara('ficha', novo); } }
    });
  }

  function exportarFicha(id) {
    const texto = OP.fichas.exportarTexto(id);
    if (texto === null) {
      aviso('erro', 'Não foi possível ler esta ficha para exportar.');
      return;
    }
    const ficha = id === OP.fichas.idAtual() ? OP.state.ficha : OP.fichas.ler(id);
    const nomeArquivo = OP.fichas.nomeArquivoFicha(ficha);
    if (baixar(nomeArquivo, texto)) aviso('ok', 'Ficha exportada: ' + nomeArquivo + '.');
    else aviso('erro', 'O navegador não deixou baixar o arquivo.');
  }

  function excluirFicha(id) {
    const linha = OP.fichas.listar().find(function (l) { return l.id === id; });
    const nome = nomeExibido(linha && linha.nome);
    OP.ui.confirmar({
      titulo: 'Excluir ficha',
      texto: 'Excluir "' + nome + '"? Logo depois, o aviso oferece Desfazer por alguns segundos. ' +
        'Para guardar uma cópia fora deste navegador, use Exportar.',
      textoConfirmar: 'Excluir',
      perigo: true,
      aoConfirmar: function () {
        const eraAberta = id === OP.fichas.idAtual();
        if (eraAberta) OP.fichas.salvarPendente();
        // Guarda o que é preciso para desfazer: a ficha, o lugar no Arquivo e o tema
        const copia = eraAberta ? OP.state.ficha : OP.fichas.ler(id);
        const guardada = copia ? JSON.parse(JSON.stringify(copia)) : null;
        const posicao = OP.fichas.posicao(id);
        const tema = OP.prefs.tema(id);

        const resultado = OP.fichas.excluir(id);
        OP.prefs.esquecerTema(id);
        atualizarListas();
        OP.uiApp.atualizarNav();
        const texto = 'Ficha "' + nome + '" excluída.' + (eraAberta && resultado.abriuId ? ' Outra ficha ficou aberta.' : '');
        aviso('ok', texto, guardada ? {
          duracao: 10000,
          acao: { rotulo: 'Desfazer', fazer: function () { restaurarFicha(guardada, posicao, tema, eraAberta); } }
        } : undefined);
      }
    });
  }

  /** "Desfazer" da exclusão: a ficha volta com o mesmo id, no mesmo lugar e com o mesmo tema. */
  function restaurarFicha(ficha, posicao, tema, abrir) {
    if (!OP.fichas.restaurar(ficha, posicao)) {
      aviso('erro', 'Não foi possível restaurar a ficha: o navegador não deixou salvar.');
      return;
    }
    if (tema) OP.prefs.definirTema(ficha.id, tema);
    atualizarListas();
    OP.uiApp.atualizarNav();
    destacarCartao(ficha.id);
    if (abrir) irPara('ficha', ficha.id);
    aviso('ok', 'Ficha "' + nomeExibido(ficha.identificacao && ficha.identificacao.nome) + '" restaurada.');
  }

  function baixarBackup() {
    if (!OP.fichas.listar().length) {
      aviso('aviso', 'Não há fichas salvas para incluir no backup.');
      return;
    }
    const texto = OP.fichas.backupTexto();
    const nomeArquivo = OP.fichas.nomeArquivoBackup(new Date());
    if (baixar(nomeArquivo, texto)) aviso('ok', 'Backup baixado: ' + nomeArquivo + '.');
    else aviso('erro', 'O navegador não deixou baixar o arquivo.');
  }

  /* ------------------------------------------------------------------------
     Importar (botão ou arrastar e soltar)
     ------------------------------------------------------------------------ */

  function resumoImportacao(ficha) {
    return nomeExibido(ficha.identificacao.nome) + ' — ' +
      resumoClasseNex(ficha.identificacao.classe, ficha.identificacao.nex, ficha.identificacao.estagio);
  }

  /**
   * Mostra o resumo e só grava depois da confirmação. Uma ficha que já existe
   * neste navegador (mesmo registro, ex.: levada do celular para o notebook e
   * de volta) pode substituir a daqui ou entrar como nova; o resto entra como nova.
   */
  function confirmarImportacao(resultado) {
    const total = resultado.fichas.length;
    const repetidas = resultado.fichas.filter(function (ficha) { return OP.fichas.existe(ficha.id); });
    const titulo = total === 1 ? 'Importar ficha' : 'Importar ' + total + ' fichas';
    const itens = resultado.fichas.map(resumoImportacao);
    if (!repetidas.length) {
      OP.ui.confirmar({
        titulo: titulo,
        texto: (total === 1 ? 'A ficha abaixo entra como nova' : 'As fichas abaixo entram como novas') +
          '; nenhuma ficha existente é alterada.',
        itens: itens,
        avisos: resultado.avisos,
        textoConfirmar: 'Importar',
        aoConfirmar: function () { gravarImportacao(resultado.fichas, false); }
      });
      return;
    }
    const nomes = repetidas.map(function (ficha) { return '"' + nomeExibido(ficha.identificacao.nome) + '"'; }).join(', ');
    const uma = repetidas.length === 1;
    OP.ui.confirmar({
      titulo: titulo,
      texto: (uma ? 'A ficha ' + nomes + ' já está neste navegador.' : 'As fichas ' + nomes + ' já estão neste navegador.') +
        ' Substituir troca a versão daqui pela do arquivo (dá para desfazer logo depois). ' +
        'Importar como ' + (uma ? 'nova' : 'novas') + ' mantém as duas versões.',
      itens: itens,
      avisos: resultado.avisos,
      textoConfirmar: 'Substituir',
      alternativa: {
        texto: uma ? 'Importar como nova' : 'Importar como novas',
        aoEscolher: function () { gravarImportacao(resultado.fichas, false); }
      },
      aoConfirmar: function () { gravarImportacao(resultado.fichas, true); }
    });
  }

  /** Grava a importação. substituir: as fichas que já existem trocam a versão daqui pela do arquivo. */
  function gravarImportacao(fichas, substituir) {
    const ids = [];
    const anteriores = []; // versões substituídas, para o Desfazer
    const novas = [];
    let ok = true;
    let substituidas = 0;
    fichas.forEach(function (ficha) {
      if (!substituir || !OP.fichas.existe(ficha.id)) {
        novas.push(ficha);
        return;
      }
      if (ficha.id === OP.fichas.idAtual()) OP.fichas.salvarPendente();
      const antes = ficha.id === OP.fichas.idAtual() ? OP.state.ficha : OP.fichas.ler(ficha.id);
      const id = OP.fichas.substituirExistente(ficha);
      if (!id) {
        ok = false;
        return;
      }
      if (antes) anteriores.push(JSON.parse(JSON.stringify(antes)));
      ids.push(id);
      substituidas++;
    });
    if (novas.length) {
      const gravacao = OP.fichas.importar(novas);
      gravacao.ids.forEach(function (id) { ids.push(id); });
      if (!gravacao.ok) ok = false;
    }

    if (vistaAtual() !== 'arquivo') irPara('arquivo');
    atualizarListas();
    OP.uiApp.atualizarNav();
    ids.forEach(destacarCartao);

    const importadas = ids.length - substituidas;
    const partes = [];
    if (substituidas) partes.push(substituidas === 1 ? '1 ficha substituída' : substituidas + ' fichas substituídas');
    if (importadas) partes.push(importadas === 1 ? '1 ficha importada' : importadas + ' fichas importadas');
    const resumo = partes.join(' e ') || 'Nada foi importado';
    if (!ok) {
      aviso('aviso', resumo + ', mas o navegador não conseguiu salvar tudo: exporte um backup antes de fechar a página.');
      return;
    }
    if (anteriores.length) {
      aviso('ok', resumo + '.', {
        duracao: 10000,
        acao: {
          rotulo: 'Desfazer',
          fazer: function () {
            anteriores.forEach(function (anterior) { OP.fichas.substituirExistente(anterior); });
            atualizarListas();
            OP.uiApp.atualizarNav();
            aviso('ok', anteriores.length === 1 ? 'A versão anterior da ficha voltou.' : 'As versões anteriores das fichas voltaram.');
          }
        }
      });
      return;
    }
    aviso('ok', resumo + '.', ids.length === 1
      ? { acao: { rotulo: 'Abrir', fazer: function () { irPara('ficha', ids[0]); } } }
      : undefined);
  }

  function importarArquivo(arquivo) {
    if (!arquivo) return;
    if (arquivo.size > LIMITE_ARQUIVO) {
      aviso('erro', 'O arquivo passa de 2 MB e não foi importado.');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = function () {
      const resultado = OP.state.lerImportacao(typeof leitor.result === 'string' ? leitor.result : '');
      if (!resultado.ok) {
        aviso('erro', 'Não foi possível importar: ' + resultado.erro);
        return;
      }
      confirmarImportacao(resultado);
    };
    leitor.onerror = function () {
      aviso('erro', 'Não foi possível ler o arquivo.');
    };
    leitor.readAsText(arquivo);
  }

  function escolherArquivo() {
    refs.arquivo.click();
  }

  function temArquivos(evento) {
    const tipos = evento.dataTransfer && evento.dataTransfer.types;
    return Boolean(tipos) && Array.prototype.indexOf.call(tipos, 'Files') !== -1;
  }

  /** Arrastar um .json para a página importa (em qualquer tela). */
  function ligarArrastar() {
    document.addEventListener('dragover', function (evento) {
      if (!temArquivos(evento)) return;
      evento.preventDefault();
      evento.dataTransfer.dropEffect = 'copy';
      document.body.classList.add('arrastando-arquivo');
    });
    document.addEventListener('dragleave', function (evento) {
      if (evento.relatedTarget === null) document.body.classList.remove('arrastando-arquivo');
    });
    document.addEventListener('drop', function (evento) {
      document.body.classList.remove('arrastando-arquivo');
      if (!temArquivos(evento)) return;
      evento.preventDefault();
      importarArquivo(evento.dataTransfer.files && evento.dataTransfer.files[0]);
    });
  }

  /* ------------------------------------------------------------------------
     Barra global: nome da ficha aberta e indicador de salvamento
     ------------------------------------------------------------------------ */

  function desenharNomeAtual(ficha) {
    const nome = nomeExibido(ficha && ficha.identificacao && ficha.identificacao.nome);
    if (refs.nome.textContent !== nome) refs.nome.textContent = nome;
  }

  /** "Salvo às HH:MM" / "Salvando…" / "Não salvo" e a faixa vermelha de falha. */
  function mostrarStatus(status) {
    let texto;
    let estado;
    if (status.estado === 'pendente') {
      texto = 'Salvando…';
      estado = 'pendente';
    } else if (status.estado === 'falha') {
      texto = 'Não salvo';
      estado = 'falha';
    } else if (status.quando) {
      texto = mesmoDia(status.quando, new Date())
        ? 'Salvo às ' + hora(status.quando)
        : 'Salvo em ' + dataCurta(status.quando);
      estado = 'ok';
    } else {
      texto = 'Salvo neste navegador';
      estado = 'ok';
    }
    if (refs.status.textContent !== texto) refs.status.textContent = texto;
    const anterior = refs.status.dataset.estado;
    refs.status.dataset.estado = estado;
    // Um brilho curto quando uma gravação termina (feedback de "salvou")
    if (anterior === 'pendente' && estado === 'ok') {
      refs.status.classList.remove('status-salvamento--pulso');
      void refs.status.offsetWidth;
      refs.status.classList.add('status-salvamento--pulso');
    }
    // A faixa fica até uma gravação dar certo (mesmo enquanto digita).
    refs.faixaFalha.hidden = !status.falhou;
    if (status.falhou) {
      // Armazenamento cheio (QuotaExceededError) tem aviso próprio: manda exportar; os dados seguem em memória
      const cota = OP.storage.falhaPorCota();
      const titulo = cota ? 'Armazenamento cheio: não foi possível salvar.' : 'Não foi possível salvar neste navegador.';
      const detalhe = cota
        ? 'Exporte a ficha agora para não perder nada: ela continua aberta e em memória, mas as mudanças se perdem ao fechar a página. Apague fichas ou retratos para liberar espaço.'
        : 'A ficha continua funcionando, mas as mudanças se perdem ao fechar a página.';
      if (refs.faixaFalhaTitulo.textContent !== titulo) refs.faixaFalhaTitulo.textContent = titulo;
      if (refs.faixaFalhaDetalhe.textContent !== detalhe) refs.faixaFalhaDetalhe.textContent = detalhe;
    }
  }

  /* ------------------------------------------------------------------------
     Outra aba e impressão
     ------------------------------------------------------------------------ */

  /** Avisa (nunca recarrega sozinho) quando a ficha aberta muda em outra aba. */
  function aoAlterarFora(tipo) {
    if (tipo === 'ficha') refs.faixaOutraAba.hidden = false;
    atualizarListas();
    OP.uiApp.atualizarNav();
  }

  function recarregar() {
    OP.fichas.recarregarAtual();
    refs.faixaOutraAba.hidden = true;
  }

  function imprimir() {
    window.print();
  }

  /* ------------------------------------------------------------------------
     Eventos
     ------------------------------------------------------------------------ */

  /** Botões com data-acao-app (Central, Arquivo, estados vazios). */
  function aoClicarDocumento(evento) {
    const acaoApp = evento.target.closest('[data-acao-app]');
    if (acaoApp) {
      const acao = acaoApp.getAttribute('data-acao-app');
      if (acao === 'nova-ficha') novaFicha();
      if (acao === 'importar') escolherArquivo();
      if (acao === 'backup') baixarBackup();
      if (acao === 'fontes' && OP.uiClasse) OP.uiClasse.abrirFontes();
    }
  }

  function aoClicarArquivo(evento) {
    const filtro = evento.target.closest('[data-filtro-classe]');
    if (filtro) {
      filtros.classe = filtro.getAttribute('data-filtro-classe');
      desenharArquivo();
      return;
    }
    const botao = evento.target.closest('[data-ficha-acao]');
    if (botao) {
      const id = botao.getAttribute('data-ficha-id');
      const acao = botao.getAttribute('data-ficha-acao');
      if (acao === 'duplicar') duplicarFicha(id);
      if (acao === 'exportar') exportarFicha(id);
      if (acao === 'excluir') excluirFicha(id);
      return;
    }
    // Abrindo: estado "abrindo…" no cartão até a troca de tela
    const abrir = evento.target.closest('[data-abrir-ficha]');
    if (abrir) {
      const cartao = abrir.closest('.cartao-agente');
      if (cartao) cartao.setAttribute('aria-busy', 'true');
    }
  }

  function limparFiltros() {
    filtros.busca = '';
    filtros.classe = 'todas';
    refs.busca.value = '';
    desenharArquivo();
    refs.busca.focus();
  }

  /* ------------------------------------------------------------------------
     Montagem
     ------------------------------------------------------------------------ */

  function montar() {
    refs.nome = document.getElementById('nome-ficha-atual');
    refs.status = document.getElementById('status-salvamento');
    refs.faixaFalha = document.getElementById('faixa-falha-salvamento');
    refs.faixaFalhaTitulo = document.getElementById('faixa-falha-titulo');
    refs.faixaFalhaDetalhe = document.getElementById('faixa-falha-detalhe');
    refs.avisoUso = document.getElementById('central-uso-aviso');
    refs.faixaOutraAba = document.getElementById('faixa-outra-aba');
    refs.navContagem = document.getElementById('nav-contagem');

    refs.central = document.getElementById('vista-central');
    refs.continuar = document.getElementById('central-continuar');
    refs.tituloContinuar = document.getElementById('central-continuar-titulo');
    refs.recentes = document.getElementById('central-recentes');
    refs.blocoRecentes = refs.recentes.closest('.central__bloco');
    refs.statusArquivo = document.getElementById('central-status');

    refs.vistaArquivo = document.getElementById('vista-arquivo');
    refs.lista = document.getElementById('lista-fichas');
    refs.tituloLista = document.getElementById('arquivo-lista-titulo');
    refs.contagem = document.getElementById('arquivo-contagem');
    refs.busca = document.getElementById('arquivo-busca');
    refs.filtroClasse = document.getElementById('arquivo-filtro-classe');
    refs.ordem = document.getElementById('arquivo-ordem');
    refs.ferramentas = refs.vistaArquivo.querySelector('.arquivo__ferramentas');
    refs.dica = refs.vistaArquivo.querySelector('.arquivo__dica');
    refs.vazio = document.getElementById('arquivo-vazio');
    refs.semResultado = document.getElementById('arquivo-sem-resultado');
    refs.arquivo = document.getElementById('importar-arquivo');

    document.getElementById('botao-imprimir').addEventListener('click', imprimir);
    document.getElementById('botao-exportar-ficha').addEventListener('click', function () {
      const id = OP.fichas.idAtual();
      if (id) exportarFicha(id);
    });
    document.getElementById('botao-backup-agora').addEventListener('click', baixarBackup);
    document.getElementById('botao-recarregar-ficha').addEventListener('click', recarregar);
    document.getElementById('arquivo-limpar-filtros').addEventListener('click', limparFiltros);
    document.addEventListener('click', aoClicarDocumento);
    refs.vistaArquivo.addEventListener('click', aoClicarArquivo);
    refs.busca.addEventListener('input', function () {
      filtros.busca = refs.busca.value;
      desenharArquivo();
    });
    refs.ordem.addEventListener('change', function () {
      filtros.ordem = refs.ordem.value;
      desenharArquivo();
    });
    refs.arquivo.addEventListener('change', function () {
      const arquivo = refs.arquivo.files && refs.arquivo.files[0];
      refs.arquivo.value = ''; // permite escolher o mesmo arquivo de novo
      importarArquivo(arquivo);
    });
    ligarArrastar();
    montarFiltroClasse();

    OP.fichas.aoMudarStatus(mostrarStatus);
    OP.fichas.aoAlterarFora(aoAlterarFora);
    OP.state.aoMudar(desenharNomeAtual);
    // A Central e o Arquivo são redesenhados ao aparecer e quando o índice muda
    OP.uiApp.aoTrocarVista(function (vista) {
      if (vista === 'central') desenharCentral();
      if (vista === 'arquivo') desenharArquivo();
    });
    OP.fichas.aoMudarStatus(function (status) {
      // Gravou: nome/classe/NEX/data no índice mudaram; atualiza a contagem
      if (status.estado !== 'pendente') {
        const total = OP.fichas.listar().length;
        refs.navContagem.textContent = total ? String(total) : '';
      }
    });
    OP.prefs.aoMudar(function (prefs, tipo) {
      if (tipo === 'fontes' && vistaAtual() === 'central') desenharCentral();
    });
    desenharNomeAtual(OP.state.ficha);
    mostrarStatus(OP.fichas.status());
    atualizarListas();
  }

  OP.uiFichas = {
    montar: montar,
    novaFicha: novaFicha,
    exportarFicha: exportarFicha,
    escolherArquivo: escolherArquivo,
    baixarBackup: baixarBackup,
    atualizarListas: atualizarListas,
    // Usados pelo dossiê da ficha (js/ui-dossie.js)
    monograma: monograma,
    codigoRegistro: codigoRegistro
  };
})(window.OP);
