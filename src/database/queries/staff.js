'use strict';

const db = require('../index');

function list(guildId) {
  return db
    .get()
    .prepare('SELECT role_id, rank FROM staff_roles WHERE guild_id = ? ORDER BY rank DESC')
    .all(guildId);
}

function setRole(guildId, roleId, rank) {
  db.get()
    .prepare(
      `INSERT INTO staff_roles (guild_id, role_id, rank) VALUES (?, ?, ?)
       ON CONFLICT (guild_id, role_id) DO UPDATE SET rank = excluded.rank`,
    )
    .run(guildId, roleId, rank);
}

function removeRole(guildId, roleId) {
  return db
    .get()
    .prepare('DELETE FROM staff_roles WHERE guild_id = ? AND role_id = ?')
    .run(guildId, roleId).changes;
}

// Le rang d'un membre est le plus eleve de ses roles configures.
function rankOf(guildId, roleIds) {
  if (!roleIds.length) return 0;
  const placeholders = roleIds.map(() => '?').join(', ');
  const row = db
    .get()
    .prepare(
      `SELECT MAX(rank) AS best FROM staff_roles
       WHERE guild_id = ? AND role_id IN (${placeholders})`,
    )
    .get(guildId, ...roleIds);
  return row && row.best ? row.best : 0;
}

module.exports = { list, setRole, removeRole, rankOf };
