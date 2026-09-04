'use strict';

const db = require('../index');

function get(guildId) {
  const database = db.get();
  let row = database.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guildId);
  if (!row) {
    database.prepare('INSERT INTO welcome (guild_id) VALUES (?)').run(guildId);
    row = database.prepare('SELECT * FROM welcome WHERE guild_id = ?').get(guildId);
  }
  return row;
}

const COLUMNS = [
  'enabled',
  'channel_id',
  'message',
  'dm_message',
  'auto_role_id',
  'goodbye_enabled',
  'goodbye_channel',
  'goodbye_message',
];

function update(guildId, changes) {
  get(guildId);
  const entries = Object.entries(changes).filter(([key]) => COLUMNS.includes(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => (typeof value === 'boolean' ? (value ? 1 : 0) : value));
  db.get().prepare(`UPDATE welcome SET ${assignments} WHERE guild_id = ?`).run(...values, guildId);
}

module.exports = { get, update };
