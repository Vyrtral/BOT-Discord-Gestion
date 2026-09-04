'use strict';

const db = require('../index');

// Instantane des codes d'invitation. On compare l'etat memorise a l'etat
// courant pour deduire quel code a servi a la derniere arrivee.
function snapshot(guildId, entries) {
  const database = db.get();
  const insert = database.prepare(
    `INSERT INTO invite_codes (guild_id, code, inviter_id, uses) VALUES (?, ?, ?, ?)
     ON CONFLICT (guild_id, code) DO UPDATE SET uses = excluded.uses, inviter_id = excluded.inviter_id`,
  );
  const write = database.transaction((rows) => {
    for (const row of rows) insert.run(guildId, row.code, row.inviterId || null, row.uses);
  });
  write(entries);
}

function knownUses(guildId) {
  const rows = db.get().prepare('SELECT code, inviter_id, uses FROM invite_codes WHERE guild_id = ?').all(guildId);
  return new Map(rows.map((row) => [row.code, row]));
}

function forgetCode(guildId, code) {
  db.get().prepare('DELETE FROM invite_codes WHERE guild_id = ? AND code = ?').run(guildId, code);
}

function recordJoin(guildId, userId, inviterId, code) {
  const database = db.get();
  database
    .prepare(
      `INSERT INTO invite_joins (guild_id, user_id, inviter_id, code, joined_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         inviter_id = excluded.inviter_id, code = excluded.code, joined_at = excluded.joined_at`,
    )
    .run(guildId, userId, inviterId || null, code || null, Date.now());

  if (!inviterId) return;
  database
    .prepare(
      `INSERT INTO invite_counts (guild_id, user_id, joined) VALUES (?, ?, 1)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET joined = joined + 1`,
    )
    .run(guildId, inviterId);
}

// Au depart d'un membre, on incremente le compteur de partis de celui qui
// l'avait invite : le total affiche reste honnete.
function recordLeave(guildId, userId) {
  const database = db.get();
  const row = database
    .prepare('SELECT inviter_id FROM invite_joins WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);
  if (!row?.inviter_id) return null;

  database
    .prepare(
      `INSERT INTO invite_counts (guild_id, user_id, left) VALUES (?, ?, 1)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET left = left + 1`,
    )
    .run(guildId, row.inviter_id);
  return row.inviter_id;
}

function stats(guildId, userId) {
  const row = db
    .get()
    .prepare('SELECT joined, left, bonus FROM invite_counts WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);
  const base = row || { joined: 0, left: 0, bonus: 0 };
  return { ...base, total: base.joined - base.left + base.bonus };
}

function addBonus(guildId, userId, amount) {
  db.get()
    .prepare(
      `INSERT INTO invite_counts (guild_id, user_id, bonus) VALUES (?, ?, ?)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET bonus = bonus + excluded.bonus`,
    )
    .run(guildId, userId, amount);
}

function leaderboard(guildId, limit = 10) {
  return db
    .get()
    .prepare(
      `SELECT user_id, joined, left, bonus, (joined - left + bonus) AS total
       FROM invite_counts WHERE guild_id = ? AND (joined - left + bonus) > 0
       ORDER BY total DESC LIMIT ?`,
    )
    .all(guildId, limit);
}

function inviterOf(guildId, userId) {
  const row = db
    .get()
    .prepare('SELECT inviter_id, code, joined_at FROM invite_joins WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);
  return row || null;
}

// Remet les compteurs a zero. L'historique des arrivees (invite_joins) est
// conserve : c'est lui qui dit qui a invite qui, et il n'a pas a disparaitre
// parce qu'on remet un classement a plat.
function reset(guildId, userId = null) {
  if (userId) {
    return db
      .get()
      .prepare('DELETE FROM invite_counts WHERE guild_id = ? AND user_id = ?')
      .run(guildId, userId).changes;
  }
  return db.get().prepare('DELETE FROM invite_counts WHERE guild_id = ?').run(guildId).changes;
}

module.exports = {
  reset,
  snapshot,
  knownUses,
  forgetCode,
  recordJoin,
  recordLeave,
  stats,
  addBonus,
  leaderboard,
  inviterOf,
};
