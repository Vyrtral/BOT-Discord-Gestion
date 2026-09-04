'use strict';

const db = require('../index');

function channelFor(guildId, category) {
  const row = db
    .get()
    .prepare('SELECT channel_id FROM log_channels WHERE guild_id = ? AND category = ?')
    .get(guildId, category);
  return row ? row.channel_id : null;
}

function all(guildId) {
  return db
    .get()
    .prepare('SELECT category, channel_id FROM log_channels WHERE guild_id = ?')
    .all(guildId);
}

function set(guildId, category, channelId) {
  db.get()
    .prepare(
      `INSERT INTO log_channels (guild_id, category, channel_id) VALUES (?, ?, ?)
       ON CONFLICT (guild_id, category) DO UPDATE SET channel_id = excluded.channel_id`,
    )
    .run(guildId, category, channelId);
}

function unset(guildId, category) {
  return db
    .get()
    .prepare('DELETE FROM log_channels WHERE guild_id = ? AND category = ?')
    .run(guildId, category).changes;
}

module.exports = { channelFor, all, set, unset };
