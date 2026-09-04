'use strict';

const db = require('../index');

const JSON_COLUMNS = ['links_allowlist', 'exempt_roles'];

function hydrate(row) {
  if (!row) return null;
  const settings = { ...row };
  for (const column of JSON_COLUMNS) {
    try {
      settings[column] = JSON.parse(row[column]);
    } catch {
      settings[column] = [];
    }
  }
  return settings;
}

function get(guildId) {
  const database = db.get();
  let row = database.prepare('SELECT * FROM security WHERE guild_id = ?').get(guildId);
  if (!row) {
    database.prepare('INSERT INTO security (guild_id) VALUES (?)').run(guildId);
    row = database.prepare('SELECT * FROM security WHERE guild_id = ?').get(guildId);
  }
  return hydrate(row);
}

// better-sqlite3 refuse les booleens, et les colonnes JSON attendent du texte.
function serialize(column, value) {
  if (JSON_COLUMNS.includes(column)) return JSON.stringify(value ?? []);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

// Les cles sont des noms de colonnes, jamais du texte venant de Discord :
// elles sont confrontees a la liste reelle des colonnes avant d'entrer dans
// la requete, sinon on aurait une injection par le nom de champ.
function update(guildId, changes) {
  get(guildId);
  const database = db.get();
  const columns = database.prepare('PRAGMA table_info(security)').all().map((c) => c.name);

  const entries = Object.entries(changes).filter(
    ([key]) => columns.includes(key) && key !== 'guild_id',
  );
  if (!entries.length) return;

  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([key, value]) => serialize(key, value));

  database.prepare(`UPDATE security SET ${assignments} WHERE guild_id = ?`).run(...values, guildId);
}

function words(guildId) {
  return db
    .get()
    .prepare('SELECT word FROM banned_words WHERE guild_id = ?')
    .all(guildId)
    .map((row) => row.word);
}

function addWord(guildId, word) {
  return db
    .get()
    .prepare('INSERT OR IGNORE INTO banned_words (guild_id, word) VALUES (?, ?)')
    .run(guildId, word.toLowerCase()).changes;
}

function removeWord(guildId, word) {
  return db
    .get()
    .prepare('DELETE FROM banned_words WHERE guild_id = ? AND word = ?')
    .run(guildId, word.toLowerCase()).changes;
}

module.exports = { get, update, words, addWord, removeWord };
