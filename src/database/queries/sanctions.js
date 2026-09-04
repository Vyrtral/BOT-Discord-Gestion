'use strict';

const db = require('../index');

function add({ guildId, userId, moderatorId, type, reason, durationMs }) {
  const now = Date.now();
  const expiresAt = durationMs ? now + durationMs : null;
  const info = db
    .get()
    .prepare(
      `INSERT INTO sanctions
         (guild_id, user_id, moderator_id, type, reason, duration_ms, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(guildId, userId, moderatorId, type, reason || null, durationMs || null, expiresAt, now);
  return info.lastInsertRowid;
}

function byId(id) {
  return db.get().prepare('SELECT * FROM sanctions WHERE id = ?').get(id);
}

function history(guildId, userId, limit = 25) {
  return db
    .get()
    .prepare(
      `SELECT * FROM sanctions
       WHERE guild_id = ? AND user_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(guildId, userId, limit);
}

function countByType(guildId, userId, type) {
  return db
    .get()
    .prepare(
      'SELECT COUNT(*) AS total FROM sanctions WHERE guild_id = ? AND user_id = ? AND type = ? AND active = 1',
    )
    .get(guildId, userId, type).total;
}

function lift(id, liftedBy) {
  return db
    .get()
    .prepare('UPDATE sanctions SET active = 0, lifted_at = ?, lifted_by = ? WHERE id = ? AND active = 1')
    .run(Date.now(), liftedBy, id).changes;
}

// Utilise par /unban et /unmute : on ne connait pas l'id de la sanction,
// seulement le membre.
function liftActive(guildId, userId, type, liftedBy) {
  return db
    .get()
    .prepare(
      `UPDATE sanctions SET active = 0, lifted_at = ?, lifted_by = ?
       WHERE guild_id = ? AND user_id = ? AND type = ? AND active = 1`,
    )
    .run(Date.now(), liftedBy, guildId, userId, type).changes;
}

// Sanctions temporaires arrivees a terme, relues au demarrage et toutes les
// minutes ensuite.
function expired(now = Date.now()) {
  return db
    .get()
    .prepare('SELECT * FROM sanctions WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?')
    .all(now);
}

function purgeUser(guildId, userId) {
  return db
    .get()
    .prepare('DELETE FROM sanctions WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId).changes;
}

module.exports = { add, byId, history, countByType, lift, liftActive, expired, purgeUser };
