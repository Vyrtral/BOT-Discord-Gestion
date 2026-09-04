'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const countersQueries = require('../database/queries/counters');
const logger = require('../lib/logger');

const KINDS = ['membres', 'humains', 'bots', 'boosts', 'vocal'];

function valueFor(guild, kind) {
  switch (kind) {
    case 'membres':
      return guild.memberCount;
    case 'humains':
      return guild.members.cache.filter((m) => !m.user.bot).size;
    case 'bots':
      return guild.members.cache.filter((m) => m.user.bot).size;
    case 'boosts':
      return guild.premiumSubscriptionCount || 0;
    case 'vocal':
      return guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildVoice)
        .reduce((total, channel) => total + channel.members.size, 0);
    default:
      return 0;
  }
}

// Discord limite le renommage d'un salon a deux fois par dix minutes, et la
// requete refusee reste bloquee tres longtemps. On retient donc la date du
// dernier renommage de chaque salon et on n'y retouche pas avant le delai.
const RENAME_COOLDOWN_MS = 10 * 60 * 1000;
const lastRenamed = new Map();

async function refresh(guild) {
  const rows = countersQueries.list(guild.id);
  if (!rows.length) return 0;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return 0;

  let updated = 0;
  for (const row of rows) {
    const channel = guild.channels.cache.get(row.channel_id);
    if (!channel) {
      countersQueries.remove(guild.id, row.channel_id);
      continue;
    }

    const name = row.template.replace('{valeur}', valueFor(guild, row.kind));
    if (channel.name === name) continue;
    if (Date.now() - (lastRenamed.get(channel.id) || 0) < RENAME_COOLDOWN_MS) continue;

    try {
      await channel.setName(name, 'Mise a jour du compteur');
      lastRenamed.set(channel.id, Date.now());
      updated += 1;
    } catch (error) {
      logger.error(`Compteur ${row.channel_id} non renomme`, error);
    }
  }
  return updated;
}

module.exports = { KINDS, valueFor, refresh };
