'use strict';

const db = require('../index');

function settings(guildId) {
  const database = db.get();
  let row = database.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
  if (!row) {
    database.prepare('INSERT INTO ticket_settings (guild_id) VALUES (?)').run(guildId);
    row = database.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId);
  }
  return row;
}

const SETTING_COLUMNS = [
  'category_id',
  'transcript_channel',
  'staff_role_id',
  'panel_channel_id',
  'panel_message_id',
  'per_user_limit',
];

function updateSettings(guildId, changes) {
  settings(guildId);
  const entries = Object.entries(changes).filter(([key]) => SETTING_COLUMNS.includes(key));
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  db.get()
    .prepare(`UPDATE ticket_settings SET ${assignments} WHERE guild_id = ?`)
    .run(...entries.map(([, value]) => value), guildId);
}

function topics(guildId) {
  return db
    .get()
    .prepare('SELECT * FROM ticket_topics WHERE guild_id = ? ORDER BY position, id')
    .all(guildId);
}

function topicById(id) {
  return db.get().prepare('SELECT * FROM ticket_topics WHERE id = ?').get(id);
}

function addTopic(guildId, { label, description, emoji }) {
  const next = db
    .get()
    .prepare('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM ticket_topics WHERE guild_id = ?')
    .get(guildId).pos;
  return db
    .get()
    .prepare(
      'INSERT INTO ticket_topics (guild_id, label, description, emoji, position) VALUES (?, ?, ?, ?, ?)',
    )
    .run(guildId, label, description || null, emoji || null, next).lastInsertRowid;
}

function removeTopic(guildId, id) {
  return db
    .get()
    .prepare('DELETE FROM ticket_topics WHERE guild_id = ? AND id = ?')
    .run(guildId, id).changes;
}

// Le numero affiche dans le nom du salon. Incremente meme si le ticket est
// supprime ensuite, pour ne jamais reutiliser un numero deja vu.
function nextNumber(guildId) {
  settings(guildId);
  const database = db.get();
  database.prepare('UPDATE ticket_settings SET counter = counter + 1 WHERE guild_id = ?').run(guildId);
  return database.prepare('SELECT counter FROM ticket_settings WHERE guild_id = ?').get(guildId).counter;
}

function open({ guildId, channelId, userId, topicId, number }) {
  return db
    .get()
    .prepare(
      `INSERT INTO tickets (guild_id, channel_id, user_id, topic_id, number, opened_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(guildId, channelId, userId, topicId || null, number, Date.now()).lastInsertRowid;
}

function byChannel(channelId) {
  return db.get().prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

function openCount(guildId, userId) {
  return db
    .get()
    .prepare("SELECT COUNT(*) AS total FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'")
    .get(guildId, userId).total;
}

function claim(channelId, staffId) {
  return db
    .get()
    .prepare("UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = 'open'")
    .run(staffId, channelId).changes;
}

function close(channelId) {
  return db
    .get()
    .prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?")
    .run(Date.now(), channelId).changes;
}

module.exports = {
  settings,
  updateSettings,
  topics,
  topicById,
  addTopic,
  removeTopic,
  nextNumber,
  open,
  byChannel,
  openCount,
  claim,
  close,
};
