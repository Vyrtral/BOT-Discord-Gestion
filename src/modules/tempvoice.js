'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const tempVoiceQueries = require('../database/queries/tempvoice');
const logger = require('../lib/logger');

// Entrer dans le salon "hub" cree un salon prive dont le membre est
// proprietaire, et l'y deplace. Le salon disparait des qu'il se vide.
async function onJoin(member, channel) {
  const hub = tempVoiceQueries.hub(member.guild.id);
  if (!hub || channel.id !== hub.hub_id) return false;

  const me = member.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return false;

  const name = hub.template.replace('{pseudo}', member.user.username).slice(0, 100);

  try {
    const room = await member.guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: hub.category_id || channel.parentId,
      userLimit: hub.user_limit || undefined,
      permissionOverwrites: [
        // Le proprietaire gere son salon : renommer, limiter, expulser.
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.Connect,
          ],
        },
        { id: me.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect] },
      ],
    });

    tempVoiceQueries.openRoom(room.id, member.guild.id, member.id);
    await member.voice.setChannel(room).catch(() => null);
    return true;
  } catch (error) {
    logger.error(`Salon vocal temporaire non cree pour ${member.id}`, error);
    return false;
  }
}

// Un salon temporaire vide n'a plus de raison d'exister. On verifie qu'il
// est bien connu comme temporaire avant de supprimer quoi que ce soit.
async function onLeave(guild, channel) {
  if (!channel) return false;

  const room = tempVoiceQueries.room(channel.id);
  if (!room) return false;
  if (channel.members.size > 0) return false;

  tempVoiceQueries.closeRoom(channel.id);
  await channel.delete('Salon vocal temporaire vide').catch(() => null);
  return true;
}

// Au demarrage, les salons temporaires restes vides pendant l'arret du bot
// sont nettoyes.
async function sweep(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const room of tempVoiceQueries.rooms(guild.id)) {
      const channel = guild.channels.cache.get(room.channel_id);
      if (!channel) {
        tempVoiceQueries.closeRoom(room.channel_id);
        continue;
      }
      if (channel.members.size === 0) await onLeave(guild, channel);
    }
  }
}

module.exports = { onJoin, onLeave, sweep };
