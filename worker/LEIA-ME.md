# Conta, códigos de acesso e conteúdo protegido

O site continua estático e funciona sozinho (até abrindo o arquivo direto). Este Worker acrescenta, **opcionalmente**, uma conta com login do Discord e conteúdos que só aparecem para quem o administrador liberou por um código.

## Como funciona

- **Login:** "Entrar com o Discord" (OAuth, só lê o nome público). O token do Discord não é guardado; a sessão é um cookie `HttpOnly` e o banco guarda só o hash dele.
- **Código de acesso:** o administrador gera na página `admin.html`, para uma pessoa, valendo por algumas horas (padrão 24) e **uso único**. Ao resgatar, a conta passa a ler os conteúdos escolhidos por X dias (padrão 30). Renovar = gerar outro código (os dias que sobram são somados).
- **Conteúdo protegido:** fica na tabela `conteudo` do D1, **nunca no repositório nem nos arquivos do site**. O servidor só entrega a quem tem acesso válido; o navegador não guarda o texto (só em memória da página).
- **Segurança:** o código só existe em texto no momento em que é gerado (o banco guarda um HMAC dele); 8 tentativas de resgate por hora por conta; pedidos que mudam algo só valem se vierem do próprio endereço do site.
- **Limite honesto:** o servidor decide quem recebe o texto, mas quem recebeu consegue copiar o que está na tela. Isto reduz e controla o acesso; não é proteção contra cópia.

## Preparar (uma vez, tudo no plano gratuito)

1. **Discord:** em <https://discord.com/developers/applications> → *New Application* → aba **OAuth2**:
   - copie o **Client ID**;
   - *Reset Secret* e copie o **Client Secret** (guarde só no Cloudflare, passo 4);
   - em **Redirects**, adicione exatamente `https://SEU-WORKER.workers.dev/api/auth/discord/retorno` (o endereço do seu Worker).
   - Seu **ID de usuário**: no Discord, *Configurações → Avançado → Modo desenvolvedor*; depois clique com o botão direito no seu nome e *Copiar ID do usuário*.
2. **Banco D1:** Cloudflare → *Storage & Databases → D1 → Create database* com o nome `fichas-op`. Copie o **Database ID**. Abra o banco → aba **Console** → cole o conteúdo de `worker/schema.sql` e execute (se reclamar de várias instruções, rode uma tabela por vez).
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

Até 500 itens de 100 mil caracteres. Enviar de novo para o mesmo nome **substitui tudo**. Esse arquivo fica só no seu computador: não o coloque no repositório.

## Usar no site

`OP.conta.conteudo("nome")` devolve uma promessa com a lista de itens (ou rejeita com a mensagem do servidor). A tela que mostra cada conteúdo ainda não existe: ela depende de quais textos serão liberados.

## Testar

```
node --disable-warning=ExperimentalWarning --test worker/tests/worker.test.mjs
```

Os testes rodam o Worker de verdade sobre um banco SQLite em memória (sem internet e sem conta no Cloudflare). O login real com o Discord só se confirma depois de publicado.
