'use strict';

const { Events, ActivityType } = require('discord.js');
const guildsQueries = require('../database/queries/guilds');
const sanctions = require('../modules/sanctions');
const counters = require('../modules/counters');
const invites = require('../modules/invites');
const tempVoice = require('../modules/tempvoice');
const snipes = require('../modules/snipes');
const antivanity = require('../modules/security/vanity');
const antispam = require('../modules/security/antispam');
const antiraid = require('../modules/security/antiraid');
const antinuke = require('../modules/security/antinuke');
const voice = require('../modules/voiceTracker');
const config = require('../core/config');
const logger = require('../lib/logger');

const MINUTE = 60 * 1000;

module.exports = {
  name: Events.ClientReady,
  once: true,

  async run(client) {
    logger.info(`Connecte en tant que ${client.user.tag} sur ${client.guilds.cache.size} serveur(s).`);

    client.user.setPresence({
      activities: [{ name: '/aide', type: ActivityType.Listening }],
      status: 'online',
    });

    for (const guild of client.guilds.cache.values()) {
      guildsQueries.ensure(guild.id, config.locale);
    }

    // Un ban temporaire arrive a terme pendant que le bot etait eteint doit
    // etre leve des le retour, pas a la prochaine minute ronde.
    await sanctions.releaseExpired(client);

    // L'etat des invitations doit etre connu avant la premiere arrivee,
    // sinon on ne peut pas deduire quel code a servi.
    await invites.refreshAll(client);
    await tempVoice.sweep(client);

    for (const guild of client.guilds.cache.values()) {
      await antivanity.remember(guild).catch(() => null);
    }

    setInterval(() => sanctions.releaseExpired(client).catch((e) => logger.error('Levee automatique', e)), MINUTE);
    setInterval(() => voice.tick(client).catch((e) => logger.error('Minuteur vocal', e)), MINUTE);

    // Discord limite le renommage d'un salon a deux fois par dix minutes.
    setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        counters.refresh(guild).catch((e) => logger.error('Compteurs', e));
      }
    }, 10 * MINUTE);

    // Purge des fenetres glissantes : sans ca, chaque membre ayant poste une
    // fois laisse une entree en memoire jusqu'au redemarrage.
    setInterval(() => {
      antispam.sweep();
      antiraid.sweep();
      antinuke.sweep();
      snipes.sweep();
    }, 5 * MINUTE);
  },
};
