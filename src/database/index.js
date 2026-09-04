'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db = null;

// Les fichiers sont nommes 001-initial.sql, 002-…, et le numero de tete
// donne a la fois l'ordre et le numero de version. PRAGMA user_version retient la derniere
// appliquee, donc relancer le bot ne rejoue rien.
function listMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      version: Number.parseInt(name.slice(0, 3), 10),
      name,
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'),
    }));
}

function migrate(connection) {
  const current = connection.pragma('user_version', { simple: true });
  const pending = listMigrations().filter((m) => m.version > current);
  if (!pending.length) return 0;

  for (const migration of pending) {
    connection.exec('BEGIN');
    try {
      connection.exec(migration.sql);
      connection.pragma(`user_version = ${migration.version}`);
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw new Error(`Migration ${migration.name} echouee : ${error.message}`);
    }
  }
  return pending.length;
}

function open(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const connection = new Database(filePath);
  // WAL : les lectures ne bloquent plus l'ecriture. Sur un bot qui ecrit a
  // chaque message, la difference est nette.
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  // NORMAL au lieu de FULL : on accepte de perdre la toute derniere
  // transaction en cas de coupure brutale, ca vaut le gain d'ecriture.
  connection.pragma('synchronous = NORMAL');

  const applied = migrate(connection);
  db = connection;
  return { connection, applied };
}

function get() {
  if (!db) throw new Error('Base non ouverte : appelle open() avant.');
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { open, get, close };
