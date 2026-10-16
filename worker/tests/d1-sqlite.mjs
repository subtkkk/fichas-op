/* Imita a API do D1 (prepare/bind/first/all/run/batch) sobre o node:sqlite, só para os testes. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function criarBanco() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  function preparar(sql) {
    const instrucao = db.prepare(sql);
    const fabrica = function (params) {
      return {
        async first() { return instrucao.get(...params) || null; },
        async all() { return { results: instrucao.all(...params) }; },
        async run() {
          const r = instrucao.run(...params);
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
        _executar() { return instrucao.run(...params); }
      };
    };
    const base = fabrica([]);
    base.bind = function (...params) { return fabrica(params); };
    return base;
  }
  return {
    bruto: db,
    prepare: preparar,
    async batch(lista) {
      db.exec('BEGIN');
      try { lista.forEach(function (c) { c._executar(); }); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return [];
    }
  };
}
