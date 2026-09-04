'use strict';

const { Events } = require('discord.js');
const guildsQueries = require('../database/queries/guilds');
const config = require('../core/config');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildCreate,

  async run(client, guild) {
    guildsQueries.ensure(guild.id, config.locale);
    logger.info(`Ajoute sur ${guild.name} (${guild.id}), ${guild.memberCount} membres.`);
  },
};
