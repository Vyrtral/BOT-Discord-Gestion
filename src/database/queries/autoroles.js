'use strict';

const db = require('../index');

function list(guildId) {
  return db
    .get()
    .prepare('SELECT role_id FROM auto_roles WHERE guild_id = ?')
    .all(guildId)
    .map((row) => row.role_id);
}

function add(guildId, roleId) {
  return db
    .get()
    .prepare('INSERT OR IGNORE INTO auto_roles (guild_id, role_id) VALUES (?, ?)')
    .run(guildId, roleId).changes;
}

function remove(guildId, roleId) {
  return db
    .get()
    .prepare('DELETE FROM auto_roles WHERE guild_id = ? AND role_id = ?')
    .run(guildId, roleId).changes;
}

module.exports = { list, add, remove };
