CREATE TABLE IF NOT EXISTS usuarios (
  discord_id    TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  avatar        TEXT,
  criado_em     INTEGER NOT NULL,
  ultimo_acesso INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  criado_em  INTEGER NOT NULL,
  expira_em  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes (expira_em);

CREATE TABLE IF NOT EXISTS codigos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  hash            TEXT NOT NULL UNIQUE,
  rotulo          TEXT NOT NULL,
  escopos         TEXT NOT NULL,
  dias            INTEGER NOT NULL,
  para_discord_id TEXT,
  criado_em       INTEGER NOT NULL,
  expira_em       INTEGER NOT NULL,
  usado_por       TEXT,
  usado_em        INTEGER,
  revogado        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS acessos (
  discord_id    TEXT NOT NULL,
  escopo        TEXT NOT NULL,
  expira_em     INTEGER NOT NULL,
  origem_codigo INTEGER,
  PRIMARY KEY (discord_id, escopo)
);

CREATE TABLE IF NOT EXISTS conteudo (
  escopo        TEXT NOT NULL,
  chave         TEXT NOT NULL,
  titulo        TEXT NOT NULL,
  texto         TEXT NOT NULL,
  ordem         INTEGER NOT NULL DEFAULT 0,
  atualizado_em INTEGER NOT NULL,
  PRIMARY KEY (escopo, chave)
);

CREATE TABLE IF NOT EXISTS tentativas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  criado_em  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tentativas ON tentativas (discord_id, criado_em);
