'use strict';

const db = require('../index');

function list(guildId) {
  return db.get().prepare('SELECT * FROM counters WHERE guild_id = ?').all(guildId);
}

function set(guildId, channelId, kind, template) {
  db.get()
    .prepare(
      `INSERT INTO counters (guild_id, channel_id, kind, template) VALUES (?, ?, ?, ?)
       ON CONFLICT (guild_id, channel_id) DO UPDATE SET kind = excluded.kind, template = excluded.template`,
    )
    .run(guildId, channelId, kind, template);
}

function remove(guildId, channelId) {
  return db
    .get()
    .prepare('DELETE FROM counters WHERE guild_id = ? AND channel_id = ?')
    .run(guildId, channelId).changes;
}

module.exports = { list, set, remove };
