'use strict';

const { Events } = require('discord.js');
const webhooks = require('../modules/security/webhooks');
const logger = require('../lib/logger');

module.exports = {
  name: Events.WebhooksUpdate,

  async run(client, channel) {
    try {
      await webhooks.handle(channel);
    } catch (error) {
      logger.error(`Anti-webhook sur ${channel.id}`, error);
    }
  },
};
