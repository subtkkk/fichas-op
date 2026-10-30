#!/usr/bin/env python3
"""
tools/extrair-arsenal.py — lê o PDF "Arsenal · Compêndio de Itens" e grava um JSON "bruto"
com as fichas numeradas (Nº), as tabelas e as caixas de texto, separados por campo.

Uso:    python3 -I tools/extrair-arsenal.py <arquivo.pdf> <saida-bruto.json>
Requer: pdfplumber (pip install pdfplumber). É uma ferramenta de bancada: o site não usa.

A saída tem TEXTO DO LIVRO. Guarde FORA do repositório (o gerador recusa pastas dentro dele).
Depois: node tools/gerar-arsenal.mjs <bruto.json> <pasta-de-saida> [ajustes.json]

O PDF é gerado a partir de dados (WeasyPrint): cada elemento da ficha tem uma "assinatura"
de fonte e tamanho (Nº, nome, tipo, CAT, espaços, estatísticas, ambientação, regras, nota).
É isso que o extrator usa; se o PDF mudar de projeto gráfico, ajuste classe() e as constantes do topo.
Ao final ele confere que os Nº das fichas não têm buracos (sai com erro se tiver).
"""
import json
import re
import sys

import pdfplumber

COLUNA_DIVISAO = 290      # x que separa a coluna da esquerda da da direita nas páginas de fichas
PRIMEIRA_PAGINA_DE_FICHAS = 9
PAGINA_TIPOS_DE_ALIADO = 71
TOPO_MIN, TOPO_MAX = 47, 736   # fora disso: cabeçalho corrido e número da página
HIFEN_SUAVE = '‐'

# Capítulos pelo intervalo de páginas (do sumário)
CAPITULOS = [
    (7, 8, '00', 'Regras de Equipamento'), (9, 20, '01', 'Armas'), (21, 23, '02', 'Munições'),
    (24, 26, '03', 'Modificações'), (27, 28, '04', 'Proteções'), (29, 31, '05', 'Acessórios'),
    (32, 34, '06', 'Explosivos'), (35, 42, '07', 'Itens Operacionais'), (43, 44, '08', 'Venenos'),
    (45, 50, '09', 'Itens Paranormais'), (51, 65, '10', 'Itens Amaldiçoados'),
    (66, 69, '11', 'Veículos'), (70, 72, '12', 'Drones'),
]
ELEMENTOS = {'SANGUE', 'MORTE', 'CONHECIMENTO', 'ENERGIA', 'MEDO', 'VARIA'}


def capitulo(p):
    for a, b, cod, nome in CAPITULOS:
        if a <= p <= b:
            return cod, nome
    return '', ''


def familia(w):
    return w['fontname'].split('+')[-1]


def tamanho(w):
    return round(w['size'], 1)


def classe(w):
    """Papel tipográfico de uma palavra dentro de uma ficha."""
    f, s, t = familia(w), tamanho(w), w['text']
    if f == 'JBM-Bold' and t == 'Nº':
        return 'num'
    if f == 'Fraunces-Semi-Bold' and s >= 14:
        return 'nome'
    if f == 'JBM-Medium' and s == 5.9:
        return 'tipo'
    if f == 'BSD-Ultra-Bold' and s == 10.0:
        return 'cat'
    if f == 'JBM-Medium' and s == 5.4:
        return 'cat-rotulo'
    if f == 'JBM-Medium' and s == 6.0:
        return 'esp'
    if f == 'JBM' and s == 5.2:
        return 'stat-rotulo'
    if f == 'BSD-Ultra-Bold' and s == 12.5:
        return 'stat-valor'
    if f.startswith('JBM-Bold') and s < 7:
        return 'jbm-negrito'
    if f.startswith('JBM') and s < 7:
        return 'jbm'
    if f.startswith('Fraunces-Italic') and s == 8.5:
        return 'ambient'
    if (f.startswith('Inter') or f.startswith('DejaVu')) and s >= 7.5:
        return 'regra'
    if (f.startswith('Inter')) and s == 6.8:
        return 'nota'
    if f.startswith('BSD') and s >= 13:
        return 'titulo'
    return 'outro'


def agrupar_linhas(palavras, tol=2.6):
    """Agrupa palavras em linhas (mesma altura aproximada), cada linha ordenada por x."""
    linhas = []
    for w in sorted(palavras, key=lambda x: (x['top'], x['x0'])):
        if linhas and abs(w['top'] - linhas[-1][0]['top']) <= tol:
            linhas[-1].append(w)
        else:
            linhas.append([w])
    for ln in linhas:
        ln.sort(key=lambda x: x['x0'])
    return linhas


def texto_da_linha(ln):
    """Junta palavras da linha; palavras coladas (troca de fonte sem espaço) não ganham espaço."""
    saida = ''
    ant = None
    for w in ln:
        if ant is None:
            saida = w['text']
        elif w['x0'] - ant['x1'] < 0.9 and not (ant['text'][-1] in '.;:!?' and (w['text'][0].isalnum() or w['text'][0] in '+–(')):
            saida += w['text']
        else:
            saida += ' ' + w['text']
        ant = w
    return saida


def juntar_linhas(linhas, passo_paragrafo=None):
    """
    Texto corrido a partir de linhas: junta palavras partidas por hífen suave (U+2010) e por hífen
    de verdade no fim da linha. Se passo_paragrafo for dado, uma folga maior entre as linhas
    começa um novo parágrafo (devolve lista de parágrafos); senão devolve uma string.
    """
    paragrafos = []
    atual = ''
    colar = False
    topo_ant = None
    for ln in linhas:
        t = texto_da_linha(ln).strip()
        if not t:
            continue
        topo = ln[0]['top']
        novo = passo_paragrafo is not None and topo_ant is not None and (topo - topo_ant) > passo_paragrafo and not colar
        if novo:
            paragrafos.append(atual.strip())
            atual = ''
        topo_ant = topo
        if atual and not colar:
            atual += ' '
        atual += t
        colar = False
        if atual.endswith(HIFEN_SUAVE):
            atual = atual[:-1]
            colar = True
        elif re.search(r'[\w)]-$', atual) or atual.endswith('/') or re.search(r'\d–$', atual):
            colar = True
    paragrafos.append(atual.strip())
    paragrafos = [re.sub(r'\s+', ' ', p) for p in paragrafos if p]
    return paragrafos if passo_paragrafo is not None else ' '.join(paragrafos)


def palavras_da_pagina(pg):
    return pg.extract_words(extra_attrs=['fontname', 'size'])


def fonte_da_ficha(texto):
    """'OPRPG · P. 58' → ('OPRPG', '58')."""
    m = re.search(r'(OPRPG|SAH|SaH|AS#\d\d)\s*·\s*[Pp]\.\s*([\d–\-, ]+\d)', texto)
    if not m:
        return None
    livro = {'SAH': 'SaH'}.get(m.group(1), m.group(1))
    return livro, m.group(2).replace(' ', '')


def montar_ficha(palavras, pagina, marca=None):
    """Uma ficha a partir das palavras da região dela (a partir do Nº ou do 'TIPO DE ALIADO')."""
    por = {}
    for w in palavras:
        por.setdefault(classe(w), []).append(w)
    num = marca if marca is not None else por['num'][0]
    topo_num = num['top']
    cab = [w for w in palavras if abs(w['top'] - topo_num) < 2.5]
    numero = None
    cola = [w for w in cab if re.fullmatch(r'\d{3}', w['text']) and 0 < w['x0'] - num['x0'] < 25] if num['text'] == 'Nº' else []
    if cola:
        numero = int(min(cola, key=lambda w: w['x0'])['text'])
    resto = [w for w in cab if classe(w) != 'num' and w['text'] not in ('TIPO', 'DE', 'ALIADO') and (not cola or w is not min(cola, key=lambda x: x['x0']))]
    fonte = fonte_da_ficha(texto_da_linha(resto))
    ficha = {
        'tipoAliado': num['text'] != 'Nº',
        'num': numero,
        'pagina': pagina,
        'fonte': fonte[0] if fonte else '',
        'pag': fonte[1] if fonte else '',
    }
    ficha['nome'] = juntar_linhas(agrupar_linhas(por.get('nome', [])))
    tipo = juntar_linhas(agrupar_linhas(por.get('tipo', [])))
    ficha['tipo'] = re.sub(r'\s*·\s*', ' · ', tipo)
    ficha['cat'] = ' '.join(w['text'] for w in sorted(por.get('cat', []), key=lambda x: x['x0']))
    ficha['esp'] = ' '.join(w['text'] for w in sorted(por.get('esp', []), key=lambda x: (round(x['top']), x['x0'])))
    # etiqueta de elemento (SANGUE...) fica entre os 'jbm-negrito'; o resto são rótulos (MUNIÇÃO...)
    neg = [w for w in por.get('jbm-negrito', []) if abs(w['top'] - topo_num) > 2.5 and w is not num]
    elem = [w for w in neg if w['text'] in ELEMENTOS]
    ficha['elemento'] = elem[0]['text'] if elem else ''
    # estatísticas: valor ligado ao rótulo de x mais próximo à esquerda
    rotulos = sorted(por.get('stat-rotulo', []), key=lambda x: x['x0'])
    stats = {}
    for r in rotulos:
        stats[r['text']] = []
    for v in sorted(por.get('stat-valor', []), key=lambda x: (x['top'], x['x0'])):
        alvo = None
        for r in rotulos:
            if r['x0'] <= v['x0'] + 1.5:
                alvo = r
        if alvo is not None:
            stats[alvo['text']].append(v['text'])
    ficha['stats'] = {k: ' '.join(v) for k, v in stats.items()}
    # linhas extras (MUNIÇÃO ... · CAPACIDADE ...): rótulos em negrito + valores
    extras = []
    linha_extra = [w for w in palavras if classe(w) in ('jbm-negrito', 'jbm') and abs(w['top'] - topo_num) > 2.5 and w['text'] not in ELEMENTOS]
    atual = None
    for w in sorted(linha_extra, key=lambda x: (round(x['top']), x['x0'])):
        if classe(w) == 'jbm-negrito':
            atual = {'rotulo': w['text'], 'valor': []}
            extras.append(atual)
        elif atual is not None and w['text'] != '·':
            atual['valor'].append(w['text'])
    ficha['extras'] = [{'rotulo': e['rotulo'], 'valor': ' '.join(e['valor'])} for e in extras]
    ficha['ambientacao'] = juntar_linhas(agrupar_linhas(por.get('ambient', []), tol=3.5))
    ficha['regras'] = juntar_linhas(agrupar_linhas(por.get('regra', []), tol=3.2), passo_paragrafo=12.6)
    nota = juntar_linhas(agrupar_linhas(por.get('nota', []), tol=3.2))
    nota = re.sub(r'^Nota de revisão\.\s*', '', nota)
    ficha['nota'] = nota
    return ficha


def fichas_da_pagina(pg, n):
    todas = [w for w in palavras_da_pagina(pg) if TOPO_MIN <= w['top'] <= TOPO_MAX]
    saida = []
    for col in (0, 1):
        ws = [w for w in todas if (w['x0'] < COLUNA_DIVISAO) == (col == 0)]
        ws.sort(key=lambda w: (w['top'], w['x0']))
        marcas = [w for w in ws if classe(w) == 'num']
        if n == PAGINA_TIPOS_DE_ALIADO:   # cabeçalho "TIPO DE ALIADO" no lugar do Nº
            marcas += [w for w in ws if w['text'] == 'TIPO' and familia(w) == 'JBM-Bold']
            marcas.sort(key=lambda w: w['top'])
        titulos = [w for w in ws if classe(w) == 'titulo']
        for i, m in enumerate(marcas):
            fim = TOPO_MAX + 1
            if i + 1 < len(marcas):
                fim = marcas[i + 1]['top'] - 0.5
            for t in titulos:
                if t['top'] > m['top'] and t['top'] - 0.5 < fim:
                    fim = t['top'] - 0.5
            regiao = [w for w in ws if m['top'] - 0.5 <= w['top'] < fim]
            saida.append(montar_ficha(regiao, n, m))
    return saida


# ----------------------------------------------------------------------------- tabelas

def linhas_horizontais(pg):
    """Segmentos horizontais agrupados por y: { y: [(x0, x1, espessura)] }."""
    por_y = {}
    for l in pg.lines:
        if abs(l['top'] - l['bottom']) < 1 and (l['x1'] - l['x0']) > 15:
            por_y.setdefault(round(l['top'], 1), []).append((round(l['x0'], 1), round(l['x1'], 1), l.get('linewidth') or 0))
    for y in por_y:
        por_y[y].sort()
    return por_y


def assinatura(segs):
    """Limites das colunas de uma linha de tabela (partidas em segmentos contíguos)."""
    return tuple([segs[0][0]] + [s[1] for s in segs])


def tabelas_da_pagina(pg, n):
    por_y = linhas_horizontais(pg)
    palavras = palavras_da_pagina(pg)
    grupos = {}
    for y, segs in por_y.items():
        grupos.setdefault(assinatura(segs), []).append((y, max(s[2] for s in segs)))
    tabelas = []
    for sig, ys in grupos.items():
        ys.sort()
        grossas = [y for y, esp in ys if esp >= 0.9]
        if not grossas or len(sig) < 3:
            continue
        for gy in grossas:
            # linhas finas depois da grossa (até o próximo corte grande ou a próxima grossa)
            abaixo = [y for y, esp in ys if y > gy and esp < 0.9]
            proximas = [g for g in grossas if g > gy]
            limite = proximas[0] if proximas else 9999
            linhas_t = [gy] + [y for y in abaixo if y < limite]
            # separa blocos pela folga: uma tabela não tem salto maior que 60pt entre linhas
            bloco = [linhas_t[0]]
            for y in linhas_t[1:]:
                if y - bloco[-1] > 60:
                    break
                bloco.append(y)
            cols = list(sig)
            # cabeçalho (rótulos) e título
            cab = [w for w in palavras if gy - 15 < w['top'] < gy and cols[0] - 2 <= w['x0'] <= cols[-1] and familia(w).startswith('JBM')]
            titulo = [w for w in palavras if gy - 48 < w['bottom'] < gy - 8 and cols[0] - 2 <= w['x0'] <= cols[-1] and familia(w).startswith('BSD')]
            rotulos = []
            for c in range(len(cols) - 1):
                rotulos.append(juntar_linhas(agrupar_linhas([w for w in cab if cols[c] - 2 <= w['x0'] < cols[c + 1] - 1])))
            linhas = []
            for a, b in zip(bloco[:-1], bloco[1:]):
                cels = []
                for c in range(len(cols) - 1):
                    ws = [w for w in palavras if a < w['top'] + 0.5 and w['top'] < b - 0.5 and cols[c] - 1.5 <= w['x0'] < cols[c + 1] - 1.0]
                    lns = agrupar_linhas(ws, tol=3.0)
                    cels.append({'texto': juntar_linhas(lns), 'negrito': juntar_linhas(agrupar_linhas([w for w in ws if 'Bold' in familia(w)], tol=3.0))})
                linhas.append(cels)
            tabelas.append({
                'pagina': n, 'y': gy, 'x': [cols[0], cols[-1]],
                'titulo': juntar_linhas(agrupar_linhas(titulo)),
                'colunas': rotulos, 'linhas': linhas,
            })
    tabelas.sort(key=lambda t: (t['x'][0] > COLUNA_DIVISAO and t['x'][1] - t['x'][0] < 400, t['y']))
    return tabelas


# ----------------------------------------------------------------------------- caixas

def caixa_de_texto(pg, x0, x1, topo, base):
    """Texto (parágrafos) de uma região da página, sem títulos."""
    ws = [w for w in palavras_da_pagina(pg) if x0 <= w['x0'] <= x1 and topo <= w['top'] <= base and classe(w) != 'titulo']
    return juntar_linhas(agrupar_linhas(ws, tol=3.2), passo_paragrafo=12.6)

# ----------------------------------------------------------------------------- caixas

# (chave, página, trecho do título, coluna: 0 esquerda · 1 direita). São as caixas de regras que
# o gerador usa: texto de itens sem ficha (catalisadores, itens de origem), preço da maldição etc.
CAIXAS = [
    ('catalisadores', 49, 'CATALISADORES RITUAL', 1),
    ('itens-de-origem', 50, 'ITENS DE ORIGEM', 0),
    ('adquirindo-e-usando', 52, 'ADQUIRINDO E USANDO', 0),
    ('preco-da-maldicao', 52, 'PREÇO DA MALDIÇÃO', 1),
    ('acessorios-amaldicoados', 52, 'ACESSÓRIOS AMALDIÇOADOS', 1),
    ('aliado-drone', 71, 'ALIADO DRONE', 0),
    ('acumulando-efeitos-de-drones', 72, 'ACUMULANDO EFEITOS', 0),
    ('medicamentos-sah43', 40, 'MEDICAMENTOS (SAH 43)', 0),
    ('explosivos-autorais', 33, 'EXPLOSIVOS AUTORAIS', 0),
    ('exemplo-acessorio-modificado', 26, 'EXEMPLO DE ACESSÓRIO', 0),
    ('inoculacao', 44, 'INOCULAÇÃO', 0),
]
PAGINAS_DE_ABERTURA = [21, 24, 27, 29, 32, 35, 43, 45, 51, 66, 70]


def caixa_da_pagina(pg, trecho, coluna):
    ws = [w for w in palavras_da_pagina(pg) if TOPO_MIN <= w['top'] <= TOPO_MAX and (w['x0'] < COLUNA_DIVISAO) == (coluna == 0)]
    titulos = [w for w in ws if classe(w) == 'titulo']
    alvo = None
    for ln in agrupar_linhas(titulos, tol=3):
        if trecho in texto_da_linha(ln):
            alvo = ln
            break
    if alvo is None:
        return None
    base = max(w['bottom'] for w in alvo)
    fim = TOPO_MAX
    for w in ws:
        if w['top'] > base and (classe(w) in ('titulo', 'num') or (w['text'] == 'TIPO' and familia(w) == 'JBM-Bold')):
            fim = min(fim, w['top'] - 0.5)
    miolo = [w for w in ws if w['top'] >= base - 0.5 and w['top'] < fim and classe(w) != 'titulo']
    return {'titulo': juntar_linhas([alvo]), 'paragrafos': juntar_linhas(agrupar_linhas(miolo, tol=3.0), passo_paragrafo=12.0)}


def abertura_do_capitulo(pg):
    ws = [w for w in palavras_da_pagina(pg) if familia(w).startswith('Fraunces') and tamanho(w) == 11.0 and w['x0'] < COLUNA_DIVISAO + 60]
    return juntar_linhas(agrupar_linhas(ws, tol=3.0))


def nota_dos_veiculos(pg):
    """Legenda sob a tabela de veículos (II: ... · III: ... · IV: ...)."""
    ws = [w for w in palavras_da_pagina(pg) if w['x0'] < COLUNA_DIVISAO and 150 < w['top'] < 260 and classe(w) in ('regra', 'outro', 'nota')]
    return juntar_linhas(agrupar_linhas(ws, tol=3.0))



def principal(argv):
    if len(argv) != 3:
        print(__doc__)
        return 1
    pdf = pdfplumber.open(argv[1])
    saida = {'paginas': len(pdf.pages), 'fichas': [], 'tabelas': [], 'caixas': {}, 'aberturas': {}}
    for i, pg in enumerate(pdf.pages, 1):
        cod = capitulo(i)[0]
        if i >= PRIMEIRA_PAGINA_DE_FICHAS:   # 3–6 são o "como ler" e a galeria (miniaturas com Nº)
            for f in fichas_da_pagina(pg, i):
                f['capitulo'] = cod
                saida['fichas'].append(f)
        for t in tabelas_da_pagina(pg, i):
            t['capitulo'] = cod
            saida['tabelas'].append(t)
    for chave, pagina, trecho, coluna in CAIXAS:
        c = caixa_da_pagina(pdf.pages[pagina - 1], trecho, coluna)
        if c is None:
            print('Caixa não encontrada:', chave)
            continue
        c['pagina'] = pagina
        saida['caixas'][chave] = c
    for pagina in PAGINAS_DE_ABERTURA:
        saida['aberturas'][str(pagina)] = abertura_do_capitulo(pdf.pages[pagina - 1])
    saida['caixas']['veiculos-legenda'] = {'titulo': 'Veículos operacionais', 'pagina': 67, 'paragrafos': [nota_dos_veiculos(pdf.pages[66])]}
    with open(argv[2], 'w', encoding='utf-8') as fh:
        json.dump(saida, fh, ensure_ascii=False, indent=1)
    nums = [f['num'] for f in saida['fichas'] if not f.get('tipoAliado')]
    print('fichas:', len(nums), '· únicas:', len(set(nums)), '· tipos de aliado:', len(saida['fichas']) - len(nums), '· tabelas:', len(saida['tabelas']))
    faltam = sorted(set(range(1, (max(nums) if nums else 0) + 1)) - set(nums))
    repetidos = sorted({n for n in nums if nums.count(n) > 1})
    if faltam or repetidos:
        print('ATENÇÃO — Nº que não saíram:', faltam, '· repetidos:', repetidos)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(principal(sys.argv))
