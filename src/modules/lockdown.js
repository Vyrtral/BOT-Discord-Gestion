'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const securityQueries = require('../database/queries/security');

// Verrouillage global : on retire l'envoi de messages a @everyone sur chaque
// salon textuel. Les salons ou la permission etait deja explicitement refusee
// sont laisses tels quels, sinon le deverrouillage les ouvrirait par erreur.
async function apply(guild, locked, reason) {
  const everyone = guild.roles.everyone;
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return { error: 'permission' };

  const channels = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement,
  );

  let changed = 0;
  for (const channel of channels.values()) {
    const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
    const alreadyDenied = overwrite?.deny.has(PermissionFlagsBits.SendMessages);

    if (locked && alreadyDenied) continue;
    if (!locked && !alreadyDenied) continue;

    try {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: locked ? false : null }, { reason });
      changed += 1;
    } catch {
      // Salon hors de portee du bot : on continue, le compte final le dira.
    }
  }

  securityQueries.update(guild.id, { lockdown: locked ? 1 : 0 });
  return { changed, total: channels.size };
}

module.exports = { apply };
