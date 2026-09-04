'use strict';

const db = require('../index');

// --- Membres proteges contre la mention -----------------------------------

function protect(guildId, userId, addedBy) {
  return db
    .get()
    .prepare('INSERT OR IGNORE INTO protected_members (guild_id, user_id, added_by, created_at) VALUES (?, ?, ?, ?)')
    .run(guildId, userId, addedBy, Date.now()).changes;
}

function unprotect(guildId, userId) {
  return db
    .get()
    .prepare('DELETE FROM protected_members WHERE guild_id = ? AND user_id = ?')
    .run(guildId, userId).changes;
}

function protectedMembers(guildId) {
  return db
    .get()
    .prepare('SELECT user_id FROM protected_members WHERE guild_id = ?')
    .all(guildId)
    .map((row) => row.user_id);
}

function isProtected(guildId, userId) {
  return Boolean(
    db.get().prepare('SELECT 1 FROM protected_members WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
  );
}

function clearProtected(guildId) {
  return db.get().prepare('DELETE FROM protected_members WHERE guild_id = ?').run(guildId).changes;
}

// --- Bots autorises --------------------------------------------------------

function allowBot(guildId, botId) {
  return db
    .get()
    .prepare('INSERT OR IGNORE INTO allowed_bots (guild_id, bot_id) VALUES (?, ?)')
    .run(guildId, botId).changes;
}

function disallowBot(guildId, botId) {
  return db.get().prepare('DELETE FROM allowed_bots WHERE guild_id = ? AND bot_id = ?').run(guildId, botId).changes;
}

function isBotAllowed(guildId, botId) {
  return Boolean(
    db.get().prepare('SELECT 1 FROM allowed_bots WHERE guild_id = ? AND bot_id = ?').get(guildId, botId),
  );
}

function allowedBots(guildId) {
  return db
    .get()
    .prepare('SELECT bot_id FROM allowed_bots WHERE guild_id = ?')
    .all(guildId)
    .map((row) => row.bot_id);
}

module.exports = {
  protect,
  unprotect,
  protectedMembers,
  isProtected,
  clearProtected,
  allowBot,
  disallowBot,
  isBotAllowed,
  allowedBots,
};
