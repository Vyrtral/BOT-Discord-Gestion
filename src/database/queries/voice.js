'use strict';

const db = require('../index');

// --- Anti-join : salons vocaux verrouilles ---------------------------------

function lock(guildId, channelId, lockedBy) {
  db.get()
    .prepare(
      'INSERT OR REPLACE INTO voice_locks (guild_id, channel_id, locked_by, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(guildId, channelId, lockedBy, Date.now());
}

function unlock(guildId, channelId) {
  return db
    .get()
    .prepare('DELETE FROM voice_locks WHERE guild_id = ? AND channel_id = ?')
    .run(guildId, channelId).changes;
}

function isLocked(guildId, channelId) {
  return Boolean(
    db.get().prepare('SELECT 1 FROM voice_locks WHERE guild_id = ? AND channel_id = ?').get(guildId, channelId),
  );
}

function locked(guildId) {
  return db
    .get()
    .prepare('SELECT channel_id, locked_by FROM voice_locks WHERE guild_id = ?')
    .all(guildId);
}

function unlockAll(guildId) {
  return db.get().prepare('DELETE FROM voice_locks WHERE guild_id = ?').run(guildId).changes;
}

// --- Whitelist : membres qui traversent l'anti-join ------------------------

function allow(guildId, userId) {
  return db
    .get()
    .prepare('INSERT OR IGNORE INTO voice_allowlist (guild_id, user_id, created_at) VALUES (?, ?, ?)')
    .run(guildId, userId, Date.now()).changes;
}

function disallow(guildId, userId) {
  return db
    .get()
    .prepare('DELETE FROM voice_allowlist WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId).changes;
}

function isAllowed(guildId, userId) {
  return Boolean(
    db.get().prepare('SELECT 1 FROM voice_allowlist WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
  );
}

function allowed(guildId) {
  return db
    .get()
    .prepare('SELECT user_id FROM voice_allowlist WHERE guild_id = ?')
    .all(guildId)
    .map((row) => row.user_id);
}

function clearAllowed(guildId) {
  return db.get().prepare('DELETE FROM voice_allowlist WHERE guild_id = ?').run(guildId).changes;
}

module.exports = {
  lock,
  unlock,
  isLocked,
  locked,
  unlockAll,
  allow,
  disallow,
  isAllowed,
  allowed,
  clearAllowed,
};
