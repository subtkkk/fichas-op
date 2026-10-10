# Dossiê · Fichas de Ordem Paranormal

Site para criar, evoluir e usar fichas de agentes de **Ordem Paranormal RPG**.

A ficha calcula sozinha o que as regras mandam: atributos, PV, PE, SAN, defesa, perícias, NEX e limites. Ela também rola os dados e acompanha o estado do agente durante a sessão.

Feito para os jogadores de uma mesa específica, cada um no próprio celular ou notebook.

> Ferramenta de fã, **não oficial**, para uso pessoal da mesa. Não é um serviço público e não deve ser redistribuída. Nenhum texto do livro de regras é reproduzido aqui.

## Como abrir

**Publicado:** <https://subtkkk.github.io/fichas-op/>

**No computador, a partir do código:** o site é estático, sem instalação nem build. Basta servir a pasta e abrir no navegador:

```bash
python3 -m http.server 8000
# depois abra http://localhost:8000
```

Precisa de um navegador atual (Chrome, Edge, Safari ou Firefox recentes).

## O que dá para fazer

**Central e Arquivo**
- A Central mostra a última ficha usada, as atualizadas recentemente e a situação do arquivo neste navegador.
- O Arquivo lista todas as fichas, com busca, filtro por classe e ordenação.
- Cada ficha pode ser duplicada, exportada e excluída. A exclusão pede confirmação e ainda oferece **Desfazer**.
- Importar é por botão ou arrastando o `.json` para a página. Se a ficha já existir no navegador, dá para **Substituir** (com Desfazer) ou **Importar como nova**.
- O backup baixa todas as fichas de uma vez.

**A ficha**
- Identificação, origem, classe e trilha com progressão por NEX (ou estágio, no Sobrevivente). As fontes de origens e trilhas podem ser escolhidas por livro.
- Atributos dispostos em pentagrama, com distribuição de pontos e "modo livre".
- Recursos (PV, PE, SAN) com o cálculo do máximo à vista e perda permanente de Sanidade.
- Defesa, reações, deslocamento e resistências a dano.
- Perícias com graus de treinamento, pontos, perícias concedidas e penalidade de carga.
- Ataques, habilidades e poderes, rituais (com formas Discente e Verdadeira, DT, afinidade e custo de Medo), inventário com patente, crédito e carga, e descrição.
- **Visão de mesa:** perícias em uma linha, e ataques e rituais em resumo com os botões de rolar e conjurar. "Editar" abre o formulário completo.
- **Ajuste de vitais:** tocar em PV, PE ou SAN abre −5/−1/+1/+5, dano ou cura de uma quantia, e Desfazer. No celular, é uma gaveta.
- Remover qualquer item da ficha mostra Desfazer por alguns segundos.
- "Termos da ficha" é um glossário recolhido com NEX, DT, graus e outros termos.

**Rolagens**
- Painel com o resultado de cada teste (todos os d20 e qual valeu), dano, crítico, modificador de dados, bônus extra, DT do alvo, fórmula livre (ex.: `2d6+3`) e histórico.

**Temas e impressão**
- Seis temas visuais por ficha: Neutro, Sangue, Morte, Conhecimento, Energia e Medo. Eles mudam só a aparência e nunca as regras.
- **Imprimir / PDF** gera a ficha completa num layout próprio para papel.

## Onde ficam os dados

Tudo fica no **próprio navegador** (`localStorage`). Não há servidor nem conta.

| Chave | Conteúdo |
|---|---|
| `op_idx_v2` | Índice das fichas (ordem, ficha aberta) |
| `op_f_<id>` | Cada ficha |
| `op_prefs` | Preferências: livros ativos e tema de cada ficha |
| `op_ficha_atual` | Formato antigo, migrado automaticamente |

Isso tem algumas consequências:
- **Cada aparelho tem as suas fichas.** Para levar uma ficha do celular para o notebook, exporte e importe o `.json`.
- O tema escolhido fica nas preferências do navegador e **não** vai no arquivo exportado.
- Sem `localStorage` (por exemplo, alguns modos privados), o site funciona só na memória. Ele avisa que não conseguiu salvar e oferece exportar um backup, e a Central marca o armazenamento como temporário.
- Arquivos exportados:
  - formato `op-ficha` (`ficha-<nome>.json`) ou `op-backup` (`fichas-backup-AAAA-MM-DD.json`);
  - versão do modelo 9;
  - até 2 MB.
- A importação aceita versões anteriores e recusa as mais novas que o site.

## Regras e conteúdo

Os dados de jogo vêm do Livro de Regras v1.3, do Sobrevivendo ao Horror v1.2 e das aventuras AS-01 a AS-09 (`data/fontes.js`).

Os arquivos trazem **só nomes e números**. As descrições de habilidades, rituais e itens são digitadas pelo jogador.

## Estrutura

```
index.html          Página única: Central, Arquivo e Ficha (rotas #/central, #/arquivo, #/ficha/<id>)
css/
  style.css         Tela: design system, temas, componentes e responsivo
  print-base.css    Impressão: layout da ficha no papel
  print.css         Impressão: ajustes e o que fica fora do papel
js/
  main.js           Inicialização e ciclo de atualização
  state.js          Estado da ficha, modelo, migração e importação
  calc.js           Fórmulas da ficha
  dados.js          Motor de dados
  rolagens.js       Liga a ficha ao motor de dados
  fichas.js         Várias fichas no navegador (salvar, abrir, excluir, exportar)
  storage.js        Acesso ao localStorage (ou memória)
  prefs.js          Preferências do navegador
  ui.js             Interface da ficha
  ui-classe.js      Origem, classe, trilha e progressão
  ui-dossie.js      Capa do dossiê, vitais, ajuste de vital, índice e tema
  ui-fichas.js      Central, Arquivo e operações com fichas
  ui-app.js         Navegação entre telas e avisos
  tests.js          Verificações das fórmulas
data/               Dados de jogo (classes, origens, trilhas, perícias, rituais, temas…)
fonts/              Fontes locais (Cormorant Garamond e IBM Plex, licença OFL)
```

## Desenvolvimento

- HTML, CSS e JavaScript puro, sem dependências e sem etapa de build: edite e recarregue.
- Os scripts compartilham o objeto global `OP`. O fluxo é `OP.state.atualizar` → `OP.calc` → `OP.ui.desenhar`. As telas ligam os campos por atributos (`data-campo`, `data-saida`, `data-passo`…).
- **Testes das fórmulas:** abra o site e rode `OP.runTests()` no console do navegador. O esperado é `{ total: 322, aprovados: 322, falhas: 0 }`.
- **Compatibilidade:** fichas salvas e arquivos exportados de versões anteriores precisam continuar abrindo. Mudanças no modelo passam pela migração em `js/state.js`.

## Design

- [`PRODUCT.md`](PRODUCT.md): para quem é o site, onde é usado, restrições e princípios.
- [`DESIGN.md`](DESIGN.md): o sistema visual ("O Dossiê Vivo"), com tokens, tipografia, componentes e regras. O arquivo `.impeccable/design.json` complementa com escalas de tom, sombras e componentes de referência.
- As skills do [Impeccable](https://impeccable.style) estão em `.claude/skills/impeccable` para uso com o Claude Code (`/impeccable critique`, `/impeccable polish`…).

## Créditos

Ordem Paranormal RPG pertence aos seus criadores e editora. Este projeto não tem relação oficial com eles.

As fontes Cormorant Garamond e IBM Plex são distribuídas sob a SIL Open Font License (ver `fonts/`).
