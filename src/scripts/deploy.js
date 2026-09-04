'use strict';

// Enregistre les commandes sans demarrer le bot. Utile pour effacer les
// commandes d'un serveur de test, ou pour repousser un lot apres une
// modification sans redemarrer le process en production.
const path = require('node:path');
const config = require('../core/config');
const i18n = require('../core/i18n');
const { loadCommands } = require('../core/loader');
const { deploy } = require('../core/deploy');
const logger = require('../lib/logger');

async function main() {
  config.assertReady();
  i18n.load();

  const { commands, problems } = loadCommands(path.join(__dirname, '..', 'commands'));
  for (const problem of problems) logger.warn(problem);

  const result = await deploy({
    token: config.token,
    clientId: config.appId,
    guildId: config.guildId,
    commands: [...commands.values()],
  });

  logger.info(`${result.count} commandes enregistrees (portee ${result.scope}).`);
}

main().catch((error) => {
  logger.error('Enregistrement impossible', error);
  process.exit(1);
});
