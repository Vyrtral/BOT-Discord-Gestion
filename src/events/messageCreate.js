'use strict';

const { Events } = require('discord.js');
const securityQueries = require('../database/queries/security');
const antispam = require('../modules/security/antispam');
const links = require('../modules/security/links');
const words = require('../modules/security/words');
const mentions = require('../modules/security/mentions');
const pings = require('../modules/security/pings');
const xp = require('../modules/xp');
const logger = require('../lib/logger');

module.exports = {
  name: Events.MessageCreate,

  async run(client, message) {
    if (!message.inGuild() || message.author.bot || message.system) return;

    try {
      const settings = securityQueries.get(message.guild.id);

      // Les protections s'arretent au premier declenchement : le message a
      // deja ete supprime, inutile de le traiter deux fois.
      if (await antispam.handle(message, settings)) return;
      if (await words.handle(message, settings)) return;
      if (await mentions.handle(message, settings)) return;
      if (await pings.handle(message, settings)) return;
      if (await links.handle(message, settings)) return;

      await xp.onMessage(message);
    } catch (error) {
      logger.error(`Traitement du message ${message.id}`, error);
    }
  },
};
