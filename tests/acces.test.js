'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { PermissionFlagsBits } = require('discord.js');

const DB_FILE = `/tmp/gestion-acces-${process.pid}.db`;
const SYS_ID = '111111111111111111';

const db = require('../src/database');
const config = require('../src/core/config');
const staff = require('../src/database/queries/staff');
const access = require('../src/core/access');
const { RANK } = require('../src/constants');

// SYS_ID vient de config.js ; on l'impose ici plutot que de dependre du
// fichier de config du poste qui lance les tests.
config.sysId = SYS_ID;
db.open(DB_FILE);

const GUILD = '900000000000000000';

// Faux membre : juste ce que access.js consulte reellement.
function member({ id, roles = [], permissions = [], position = 1, ownerId = '999999999999999999' }) {
  return {
    id,
    permissions: { has: (flag) => permissions.includes(flag) },
    roles: {
      cache: new Map(roles.map((roleId) => [roleId, {}])),
      highest: { comparePositionTo: (other) => position - other.position, position },
    },
    guild: { id: GUILD, ownerId },
  };
}

test('le compte SYS_ID passe devant tout le monde', () => {
  assert.strictEqual(access.rankOf(member({ id: SYS_ID })), RANK.system);
});

test('le proprietaire du serveur est administrateur', () => {
  const owner = member({ id: '222222222222222222', ownerId: '222222222222222222' });
  assert.strictEqual(access.rankOf(owner), RANK.admin);
});

test('un role staff configure donne son rang', () => {
  staff.setRole(GUILD, 'role-mod', RANK.moderator);
  assert.strictEqual(access.rankOf(member({ id: '333', roles: ['role-mod'] })), RANK.moderator);
});

test('les permissions Discord servent de repli sans role configure', () => {
  const withBan = member({ id: '444', permissions: [PermissionFlagsBits.BanMembers] });
  assert.strictEqual(access.rankOf(withBan), RANK.moderator);

  const withManage = member({ id: '555', permissions: [PermissionFlagsBits.ManageGuild] });
  assert.strictEqual(access.rankOf(withManage), RANK.admin);
});

test('un simple membre n’a aucun rang', () => {
  assert.strictEqual(access.rankOf(member({ id: '666' })), RANK.member);
});

test('on ne peut pas agir sur quelqu’un de rang egal ou superieur', () => {
  const actor = member({ id: '777', roles: ['role-mod'], position: 5 });
  const peer = member({ id: '888', roles: ['role-mod'], position: 4 });
  assert.strictEqual(access.canActOn(actor, peer), false);
});

test('un moderateur agit sur un membre situe plus bas', () => {
  const actor = member({ id: '777', roles: ['role-mod'], position: 5 });
  const target = member({ id: '888', position: 1 });
  assert.strictEqual(access.canActOn(actor, target), true);
});

test('personne ne touche au proprietaire du serveur', () => {
  const actor = member({ id: SYS_ID, position: 99 });
  const owner = member({ id: '999999999999999999', position: 1 });
  assert.strictEqual(access.canActOn(actor, owner), false);
});

test('on ne se sanctionne pas soi-meme', () => {
  const self = member({ id: '777', roles: ['role-mod'], position: 5 });
  assert.strictEqual(access.canActOn(self, self), false);
});

test.after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    require('node:fs').rmSync(`${DB_FILE}${suffix}`, { force: true });
  }
});
