'use strict';

const db = require('../index');

function add(guildId, userId, moderatorId, reason) {
  db.get()
    .prepare(
      `INSERT INTO blacklist (guild_id, user_id, moderator_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         moderator_id = excluded.moderator_id,
         reason = excluded.reason,
         created_at = excluded.created_at`,
    )
    .run(guildId, userId, moderatorId, reason || null, Date.now());
}

function remove(guildId, userId) {
  return db
    .get()
    .prepare('DELETE FROM blacklist WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId).changes;
}

function has(guildId, userId) {
  return Boolean(
    db.get().prepare('SELECT 1 FROM blacklist WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
  );
}

function list(guildId, limit = 50) {
  return db
    .get()
    .prepare('SELECT * FROM blacklist WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(guildId, limit);
}

function count(guildId) {
  return db.get().prepare('SELECT COUNT(*) AS total FROM blacklist WHERE guild_id = ?').get(guildId).total;
}

function clear(guildId) {
  return db.get().prepare('DELETE FROM blacklist WHERE guild_id = ?').run(guildId).changes;
}

module.exports = { add, remove, has, list, count, clear };
