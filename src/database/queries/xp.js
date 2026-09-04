'use strict';

const db = require('../index');

function settings(guildId) {
  const database = db.get();
  let row = database.prepare('SELECT * FROM xp_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    database.prepare('INSERT INTO xp_settings (guild_id) VALUES (?)').run(guildId);
    row = database.prepare('SELECT * FROM xp_settings WHERE guild_id = ?').get(guildId);
  }
  return { ...row, ignored_channels: JSON.parse(row.ignored_channels || '[]') };
}

const SETTING_COLUMNS = [
  'enabled',
  'message_xp',
  'voice_xp',
  'cooldown_ms',
  'announce_channel',
  'announce_mode',
  'ignored_channels',
];

function updateSettings(guildId, changes) {
  settings(guildId);
  const entries = Object.entries(changes).filter(([key]) => SETTING_COLUMNS.includes(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([key, value]) => {
    if (key === 'ignored_channels') return JSON.stringify(value ?? []);
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
  db.get().prepare(`UPDATE xp_settings SET ${assignments} WHERE guild_id = ?`).run(...values, guildId);
}

function user(guildId, userId) {
  const row = db
    .get()
    .prepare('SELECT * FROM xp_users WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);
  return row || { guild_id: guildId, user_id: userId, xp: 0, messages: 0, voice_seconds: 0, last_gain_at: 0 };
}

function addXp(guildId, userId, amount, { messages = 0, voiceSeconds = 0, touchCooldown = false } = {}) {
  db.get()
    .prepare(
      `INSERT INTO xp_users (guild_id, user_id, xp, messages, voice_seconds, last_gain_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         xp = xp + excluded.xp,
         messages = messages + excluded.messages,
         voice_seconds = voice_seconds + excluded.voice_seconds,
         last_gain_at = CASE WHEN ? THEN excluded.last_gain_at ELSE last_gain_at END`,
    )
    .run(guildId, userId, amount, messages, voiceSeconds, Date.now(), touchCooldown ? 1 : 0);
  return user(guildId, userId).xp;
}

function setXp(guildId, userId, amount) {
  db.get()
    .prepare(
      `INSERT INTO xp_users (guild_id, user_id, xp) VALUES (?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = excluded.xp`,
    )
    .run(guildId, userId, Math.max(0, amount));
}

function leaderboard(guildId, limit = 10, offset = 0) {
  return db
    .get()
    .prepare('SELECT * FROM xp_users WHERE guild_id = ? AND xp > 0 ORDER BY xp DESC LIMIT ? OFFSET ?')
    .all(guildId, limit, offset);
}

function rank(guildId, userId) {
  const row = db
    .get()
    .prepare(
      `SELECT COUNT(*) + 1 AS position FROM xp_users
       WHERE guild_id = ? AND xp > (SELECT COALESCE(xp, 0) FROM xp_users WHERE guild_id = ? AND user_id = ?)`,
    )
    .get(guildId, guildId, userId);
  return row.position;
}

function participants(guildId) {
  return db
    .get()
    .prepare('SELECT COUNT(*) AS total FROM xp_users WHERE guild_id = ? AND xp > 0')
    .get(guildId).total;
}

function reset(guildId, userId = null) {
  if (userId) {
    return db
      .get()
      .prepare('DELETE FROM xp_users WHERE guild_id = ? AND user_id = ?')
      .run(guildId, userId).changes;
  }
  return db.get().prepare('DELETE FROM xp_users WHERE guild_id = ?').run(guildId).changes;
}

function rewards(guildId) {
  return db
    .get()
    .prepare('SELECT level, role_id FROM xp_rewards WHERE guild_id = ? ORDER BY level')
    .all(guildId);
}

function setReward(guildId, level, roleId) {
  db.get()
    .prepare(
      `INSERT INTO xp_rewards (guild_id, level, role_id) VALUES (?, ?, ?)
       ON CONFLICT (guild_id, level) DO UPDATE SET role_id = excluded.role_id`,
    )
    .run(guildId, level, roleId);
}

function removeReward(guildId, level) {
  return db
    .get()
    .prepare('DELETE FROM xp_rewards WHERE guild_id = ? AND level = ?')
    .run(guildId, level).changes;
}

module.exports = {
  settings,
  updateSettings,
  user,
  addXp,
  setXp,
  leaderboard,
  rank,
  participants,
  reset,
  rewards,
  setReward,
  removeReward,
};
