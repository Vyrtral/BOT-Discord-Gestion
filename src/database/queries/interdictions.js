'use strict';

const db = require('../index');

// --- Interdiction de vocal -------------------------------------------------

function banVoice(guildId, userId, bannedBy, reason) {
  db.get()
    .prepare(
      `INSERT INTO voice_bans (guild_id, user_id, banned_by, reason, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET banned_by = excluded.banned_by, reason = excluded.reason`,
    )
    .run(guildId, userId, bannedBy, reason || null, Date.now());
}

function unbanVoice(guildId, userId) {
  return db.get().prepare('DELETE FROM voice_bans WHERE guild_id = ? AND user_id = ?').run(guildId, userId).changes;
}

function isVoiceBanned(guildId, userId) {
  return Boolean(db.get().prepare('SELECT 1 FROM voice_bans WHERE guild_id = ? AND user_id = ?').get(guildId, userId));
}

function voiceBans(guildId) {
  return db.get().prepare('SELECT * FROM voice_bans WHERE guild_id = ?').all(guildId);
}

// --- Roles interdits a un membre -------------------------------------------

function banRole(guildId, userId, roleId, bannedBy) {
  db.get()
    .prepare(
      `INSERT OR REPLACE INTO role_bans (guild_id, user_id, role_id, banned_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(guildId, userId, roleId, bannedBy, Date.now());
}

function unbanRole(guildId, userId, roleId) {
  return db
    .get()
    .prepare('DELETE FROM role_bans WHERE guild_id = ? AND user_id = ? AND role_id = ?')
    .run(guildId, userId, roleId).changes;
}

function bannedRoles(guildId, userId) {
  return db
    .get()
    .prepare('SELECT role_id FROM role_bans WHERE guild_id = ? AND user_id = ?')
    .all(guildId, userId)
    .map((row) => row.role_id);
}

function allRoleBans(guildId) {
  return db.get().prepare('SELECT * FROM role_bans WHERE guild_id = ?').all(guildId);
}

module.exports = {
  banVoice,
  unbanVoice,
  isVoiceBanned,
  voiceBans,
  banRole,
  unbanRole,
  bannedRoles,
  allRoleBans,
};
