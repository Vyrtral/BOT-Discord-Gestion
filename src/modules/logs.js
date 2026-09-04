'use strict';

const { PermissionFlagsBits, ChannelType } = require('discord.js');
const logsQueries = require('../database/queries/logs');
const render = require('../ui/render');
const logger = require('../lib/logger');

// Un salon de logs mal configure ne doit jamais interrompre l'action en
// cours : tout ce qui rate ici est avale, au pire on perd une ligne de log.
async function send(guild, category, embed) {
  try {
    const channelId = logsQueries.channelFor(guild.id, category);
    if (!channelId) return false;

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      // Le salon a ete supprime : on nettoie plutot que de reessayer a chaque
      // evenement.
      logsQueries.unset(guild.id, category);
      return false;
    }

    const me = guild.members.me;
    if (!me || !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return false;

    await channel.send(render.payload(embed));
    return true;
  } catch (error) {
    logger.error(`Log ${category} impossible sur ${guild.id}`, error);
    return false;
  }
}

module.exports = { send };
