'use strict';

const db = require('../index');

function ensure(guildId, defaultLocale = 'fr') {
  db.get()
    .prepare('INSERT OR IGNORE INTO guilds (id, locale, joined_at) VALUES (?, ?, ?)')
    .run(guildId, defaultLocale, Date.now());
}

function getLocale(guildId) {
  const row = db.get().prepare('SELECT locale FROM guilds WHERE id = ?').get(guildId);
  return row ? row.locale : null;
}

function setLocale(guildId, locale) {
  ensure(guildId, locale);
  db.get().prepare('UPDATE guilds SET locale = ? WHERE id = ?').run(locale, guildId);
}

function count() {
  return db.get().prepare('SELECT COUNT(*) AS total FROM guilds').get().total;
}

module.exports = { ensure, getLocale, setLocale, count };
