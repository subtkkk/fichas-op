# Conta, fichas na conta, links e conteúdo protegido

O site continua estático e funciona sozinho (até abrindo o arquivo direto). Este Worker acrescenta, **opcionalmente**, uma conta com login do Discord e conteúdos que só aparecem para quem o administrador liberou por um código.

## Como funciona

- **Login:** "Entrar com o Discord" (OAuth, só lê o nome público). O token do Discord não é guardado; a sessão é um cookie `HttpOnly` e o banco guarda só o hash dele.
- **Código de acesso:** o administrador gera na página `admin.html`, para uma pessoa, valendo por algumas horas (padrão 24) e **uso único**. Ao resgatar, a conta passa a ler os conteúdos escolhidos por X dias (padrão 30). Renovar = gerar outro código (os dias que sobram são somados).
- **Conteúdo protegido:** fica na tabela `conteudo` do D1, **nunca no repositório nem nos arquivos do site**. O servidor só entrega a quem tem acesso válido; o navegador não guarda o texto (só em memória da página).
- **Segurança:** o código só existe em texto no momento em que é gerado (o banco guarda um HMAC dele); 8 tentativas de resgate por hora por conta; pedidos que mudam algo só valem se vierem do próprio endereço do site.
- **Limite honesto:** o servidor decide quem recebe o texto, mas quem recebeu consegue copiar o que está na tela. Isto reduz e controla o acesso; não é proteção contra cópia.

## Fichas na conta e links de compartilhamento

- **Fichas na conta:** com o login, o site guarda uma cópia de cada ficha no D1 (tabela `fichas_nuvem`) e sincroniza sozinho (`js/nuvem.js`). Limites: 50 fichas por conta e 1,5 MB por ficha (o retrato pesa bastante). Cada gravação leva a versão (`rev`) em que se baseou e o servidor **recusa com 409** se a ficha mudou desde então: ninguém sobrescreve o trabalho de outro aparelho ou de quem editou por link sem saber.
- **Links:** `links_ficha` guarda um token aleatório de 192 bits por ficha, com o modo `ver` ou `editar`. O endereço é `<site>/#/compartilhada/<token>`: o token fica depois do `#`, que o navegador não envia ao servidor nem a outros sites.
  - `GET /api/link/<token>`: qualquer pessoa (sem login) lê a ficha. Devolve só o nome de exibição do dono, nunca o ID dele.
  - `PUT /api/link/<token>`: só com login e só se o link for `editar`; grava na ficha do dono (a mesma regra de versão).
  - O dono liga, troca o modo, gera um token novo (o antigo morre) ou desliga em `/api/fichas/<id>/link`; excluir a ficha na conta apaga o link.
- **O que o servidor não faz:** ele não conhece o formato da ficha (só guarda o JSON e confere o tamanho). Por isso o navegador passa tudo o que vem da conta ou de um link por `OP.state.sanitizar` antes de usar.
- **Ativar num banco que já existe:** as tabelas novas estão no fim de `schema.sql`. Abra o D1 → **Console**, cole o arquivo inteiro de novo e clique em *Execute* (todas as tabelas usam `IF NOT EXISTS`: o que já existe não é mexido). Enquanto isso não for feito, o site funciona igual e a Conta avisa que as fichas na conta não foram ativadas (`/api/eu` devolve `nuvem: false`).

## Preparar (uma vez, tudo no plano gratuito)

1. **Discord:** em <https://discord.com/developers/applications> → *New Application* → aba **OAuth2**:
   - copie o **Client ID**;
   - *Reset Secret* e copie o **Client Secret** (guarde só no Cloudflare, passo 4);
   - em **Redirects**, adicione exatamente `https://SEU-WORKER.workers.dev/api/auth/discord/retorno` (o endereço do seu Worker).
   - Seu **ID de usuário**: no Discord, *Configurações → Avançado → Modo desenvolvedor*; depois clique com o botão direito no seu nome e *Copiar ID do usuário*.
2. **Banco D1:** Cloudflare → *Storage & Databases → D1 → Create database* com o nome `fichas-op`. Copie o **Database ID**. Abra o banco → aba **Console** → cole o conteúdo de `worker/schema.sql` e clique em *Execute*. O arquivo não tem comentários de propósito: o Console junta tudo numa linha só ao colar, e um comentário `--` apagaria o resto (erro "No SQL statements detected"). Se ainda reclamar, rode uma tabela por vez.
3. **`wrangler.jsonc`:** preencha `database_id`, `DISCORD_CLIENT_ID` e `ADMIN_DISCORD_ID` (nenhum dos três é segredo). Faça isso **antes** de mesclar, senão a publicação falha.
4. **Segredos** (Cloudflare → Workers & Pages → `fichas-op` → *Settings → Variables and Secrets → Add*, tipo **Secret**):
   - `DISCORD_CLIENT_SECRET`: o Client Secret do passo 1;
   - `SEGREDO`: uma frase aleatória longa (40+ caracteres) que só você conhece. Se trocar depois, os códigos pendentes deixam de valer.
5. Mescle o PR. O Cloudflare publica sozinho. Abra `/admin.html`, entre com o Discord e teste.

## Publicar conteúdo

Em `admin.html` → *Conteúdo protegido*, envie um `.json`:

```json
{ "itens": [ { "chave": "id-unico", "titulo": "Nome", "texto": "Texto integral", "ordem": 0 } ] }
```

Até 500 itens de 100 mil caracteres (chave de até 80 caracteres). Enviar de novo para o mesmo nome **substitui tudo**. Dá para escolher **vários arquivos de uma vez**: o nome de cada conteúdo vem do nome do arquivo (`rituais.json` → `rituais`). Cada linha da tabela de conteúdos tem **Apagar** (dois toques) para remover um conteúdo; os acessos já concedidos continuam e voltam a valer quando o nome for publicado de novo. Esse arquivo fica só no seu computador: não o coloque no repositório.

## Origens, habilidades e rituais do livro

Os nomes de conteúdo usados pela ficha são `origens`, `habilidades` e `rituais` (um código pode liberar os três). Cada item do arquivo é o texto do livro mais, no fim, uma linha `§AUTO§{...}` que o site separa ao carregar (ela leva a classificação e os efeitos automáticos). Para gerar os arquivos a partir do txt, veja o README (`tools/gerar-conteudo.mjs`). Limites do Worker: até 500 itens por nome e 100 mil caracteres por item; `habilidades` tem 461.

## Usar no site

`OP.conta.conteudo("nome")` devolve uma promessa com a lista de itens (ou rejeita com a mensagem do servidor). Quem usa os três conteúdos do livro é `js/livro.js` (`OP.livro`), que monta o catálogo e os efeitos na memória da página; sem acesso, tudo fica vazio e a ficha funciona manualmente.

## Testar

```
node --disable-warning=ExperimentalWarning --test worker/tests/worker.test.mjs
```

Os testes rodam o Worker de verdade sobre um banco SQLite em memória (sem internet e sem conta no Cloudflare). O login real com o Discord só se confirma depois de publicado.
