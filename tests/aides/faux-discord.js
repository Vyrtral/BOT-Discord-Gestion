'use strict';

const { PermissionsBitField, Collection } = require('discord.js');

// Faux serveur Discord, juste assez complet pour executer une commande sans
// reseau. Tout ce que le code appelle reellement est present ; le reste est
// volontairement absent, pour que l'absence se voie.
const ROLE_STAFF = '900000000000000001';
const ROLE_BAS = '900000000000000002';
const GUILD_ID = '800000000000000000';

function fauxRole(id, name, position, guild = null) {
  const role = {
    id,
    name,
    guild,
    position,
    color: 0x5865f2,
    hexColor: '#5865f2',
    hoist: false,
    managed: false,
    mentionable: true,
    createdAt: new Date('2024-01-01'),
    permissions: new PermissionsBitField(0n),
    members: new Collection(),
    toString: () => `<@&${id}>`,
  };
  role.comparePositionTo = (other) => position - (other?.position ?? 0);
  return role;
}

function fauxSalon(id, name, type, guild) {
  return {
    id,
    name,
    type,
    guild,
    guildId: guild.id,
    parentId: null,
    parent: null,
    topic: null,
    nsfw: false,
    rateLimitPerUser: 0,
    createdAt: new Date('2024-02-01'),
    members: new Collection(),
    permissionOverwrites: { cache: new Collection(), edit: async () => {} },
    permissionsFor: () => new PermissionsBitField(PermissionsBitField.All),
    messages: { fetch: async () => new Collection() },
    send: async () => ({ id: '1', createdTimestamp: Date.now() }),
    setName: async () => {},
    setRateLimitPerUser: async () => {},
    fetchWebhooks: async () => new Collection(),
    clone: async () => fauxSalon('950000000000000009', name, type, guild),
    setPosition: async () => {},
    delete: async () => {},
    bulkDelete: async () => new Collection(),
    toString: () => `<#${id}>`,
  };
}

function fauxMembre(id, tag, { roles = [], bot = false, guild, permissions = 0n } = {}) {
  const cache = new Collection(roles.map((r) => [r.id, r]));
  const highest = roles.reduce((best, r) => (!best || r.position > best.position ? r : best), null);

  return {
    id,
    guild,
    client: { user: { id: '600000000000000000' } },
    user: {
      id,
      tag,
      bot,
      username: tag.split('#')[0],
      createdAt: new Date('2023-01-01'),
      createdTimestamp: new Date('2023-01-01').getTime(),
      displayAvatarURL: () => 'https://cdn.example.invalid/a.png',
      bannerURL: () => null,
      send: async () => {},
      toString: () => `<@${id}>`,
    },
    joinedAt: new Date('2024-03-01'),
    premiumSince: null,
    communicationDisabledUntil: null,
    permissions: new PermissionsBitField(permissions),
    roles: { cache, highest: highest || fauxRole('0', '@everyone', 0), add: async () => {}, remove: async () => {} },
    voice: { channel: null, channelId: null, setChannel: async () => {}, disconnect: async () => {}, setMute: async () => {} },
    displayAvatarURL: () => 'https://cdn.example.invalid/a.png',
    setNickname: async () => {},
    timeout: async () => {},
    kick: async () => {},
    send: async () => {},
    isCommunicationDisabled: () => false,
    toString: () => `<@${id}>`,
  };
}

function fauxServeur() {
  const guild = {
    id: GUILD_ID,
    name: 'Serveur de test',
    ownerId: '700000000000000000',
    memberCount: 128,
    premiumTier: 2,
    premiumSubscriptionCount: 7,
    verificationLevel: 1,
    createdAt: new Date('2022-05-01'),
    iconURL: () => 'https://cdn.example.invalid/i.png',
    bannerURL: () => null,
  };

  const staff = fauxRole(ROLE_STAFF, 'Staff', 50, guild);
  const bas = fauxRole(ROLE_BAS, 'Membre', 1, guild);
  const everyone = fauxRole(GUILD_ID, '@everyone', 0, guild);

  guild.roles = {
    everyone,
    cache: new Collection([
      [staff.id, staff],
      [bas.id, bas],
      [everyone.id, everyone],
    ]),
  };

  const texte = fauxSalon('910000000000000001', 'general', 0, guild);
  const vocal = fauxSalon('910000000000000002', 'vocal', 2, guild);

  guild.channels = {
    cache: new Collection([
      [texte.id, texte],
      [vocal.id, vocal],
    ]),
    fetch: async (id) => guild.channels.cache.get(id) || null,
    create: async () => fauxSalon('910000000000000003', 'nouveau', 0, guild),
  };

  const moi = fauxMembre('600000000000000000', 'Bot#0001', { roles: [staff], bot: true, guild, permissions: PermissionsBitField.All });
  const cible = fauxMembre('500000000000000000', 'Cible#0002', { roles: [bas], guild });
  const auteur = fauxMembre('400000000000000000', 'Staff#0003', { roles: [staff], guild, permissions: PermissionsBitField.All });

  guild.members = {
    me: moi,
    cache: new Collection([
      [moi.id, moi],
      [cible.id, cible],
      [auteur.id, auteur],
    ]),
    fetch: async (id) => guild.members.cache.get(typeof id === 'string' ? id : id?.user?.id) || cible,
    ban: async () => {},
    unban: async () => {},
  };

  guild.bans = { fetch: async () => null };
  guild.invites = { fetch: async () => new Collection() };
  guild.emojis = { cache: new Collection() };
  guild.fetchOwner = async () => fauxMembre(guild.ownerId, 'Owner#0004', { guild });
  guild.fetchAuditLogs = async () => ({ entries: { first: () => null, find: () => null } });
  guild.voiceStates = { cache: new Collection() };

  return { guild, texte, vocal, auteur, cible, staff, bas };
}

module.exports = { fauxServeur, fauxMembre, fauxRole, fauxSalon, GUILD_ID, ROLE_STAFF };
