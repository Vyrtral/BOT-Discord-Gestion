'use strict';

const db = require('../index');

function hub(guildId) {
  return db.get().prepare('SELECT * FROM temp_voice_hubs WHERE guild_id = ?').get(guildId) || null;
}

function setHub(guildId, { hubId, categoryId, template, userLimit }) {
  db.get()
    .prepare(
      `INSERT INTO temp_voice_hubs (guild_id, hub_id, category_id, template, user_limit)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (guild_id) DO UPDATE SET
         hub_id = excluded.hub_id,
         category_id = excluded.category_id,
         template = excluded.template,
         user_limit = excluded.user_limit`,
    )
    .run(guildId, hubId, categoryId || null, template || 'Vocal de {pseudo}', userLimit || 0);
}

function removeHub(guildId) {
  return db.get().prepare('DELETE FROM temp_voice_hubs WHERE guild_id = ?').run(guildId).changes;
}

function openRoom(channelId, guildId, ownerId) {
  db.get()
    .prepare('INSERT OR REPLACE INTO temp_voice_rooms (channel_id, guild_id, owner_id, created_at) VALUES (?, ?, ?, ?)')
    .run(channelId, guildId, ownerId, Date.now());
}

function room(channelId) {
  return db.get().prepare('SELECT * FROM temp_voice_rooms WHERE channel_id = ?').get(channelId) || null;
}

function closeRoom(channelId) {
  return db.get().prepare('DELETE FROM temp_voice_rooms WHERE channel_id = ?').run(channelId).changes;
}

function rooms(guildId) {
  return db.get().prepare('SELECT * FROM temp_voice_rooms WHERE guild_id = ?').all(guildId);
}

module.exports = { hub, setHub, removeHub, openRoom, room, closeRoom, rooms };
