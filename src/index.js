'use strict';

const path = require('node:path');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const config = require('./core/config');
const db = require('./database');
const i18n = require('./core/i18n');
const { loadCommands, loadEvents } = require('./core/loader');
const { deploy } = require('./core/deploy');
const logger = require('./lib/logger');

// MessageContent et GuildMembers sont des intents privilegies : ils se
// cochent dans le portail developpeur, onglet Bot. Sans le premier,
// l'antispam et le filtre de mots ne voient que des messages vides ; sans le
// second, les arrivees ne declenchent rien.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.MessageContent,
  ],
  // Sans ces partials, un message supprime qui n'etait pas en cache
  // n'atteint jamais le journal.
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Discord renvoie ses refus d'authentification sans texte : brut, ca donne
// « DiscordAPIError[undefined]: No Description » et une pile d'appels qui
// n'apprend rien. Les deux causes possibles au demarrage meritent chacune
// leur message.
function reportBadToken() {
  logger.error(`Token refuse par Discord. Verifie TOKEN dans ${config.file}`);
  logger.error("Reinitialiser le token sur le portail developpeur invalide l'ancien immediatement.");
}

// 403 sur l'enregistrement des commandes d'un serveur veut presque toujours
// dire que le bot n'y est pas, ou qu'il a ete invite sans le scope
// applications.commands.
function reportDeployFailure(error) {
  if (error?.status === 401) return reportBadToken();

  if (error?.status === 403 && config.guildId) {
    logger.error(`Commandes refusees sur le serveur ${config.guildId}.`);
    logger.error("Le bot n'y est pas, ou il a ete invite sans le scope applications.commands.");
    logger.error('Reinvite-le avec le lien du README, ou vide GUILD_ID pour un deploiement global.');
    return;
  }

  logger.error('Enregistrement des commandes impossible, le bot demarre quand meme', error);
}

async function main() {
  config.assertReady();

  const languages = i18n.load();
  logger.info(`Langues chargees : ${languages.join(', ')}.`);

  const { applied } = db.open(config.database);
  if (applied) logger.info(`${applied} migration(s) appliquee(s).`);

  const { commands, problems } = loadCommands(path.join(__dirname, 'commands'));
  for (const problem of problems) logger.warn(problem);

  client.commands = commands;
  const listeners = loadEvents(client, path.join(__dirname, 'events'));
  logger.info(`${commands.size} commandes et ${listeners} evenements charges.`);

  // Le deploiement au demarrage evite d'avoir a lancer un script a part
  // apres chaque modification de commande.
  try {
    const result = await deploy({
      token: config.token,
      clientId: config.appId,
      guildId: config.guildId,
      commands: [...commands.values()],
    });
    logger.info(`${result.count} commandes enregistrees (portee ${result.scope}).`);
  } catch (error) {
    reportDeployFailure(error);
    if (error?.status === 401) process.exit(1);
  }

  await client.login(config.token);
}

// Une promesse rejetee sans catch tuerait le process sous Node 18+ ; on
// prefere une ligne dans les logs et un bot qui continue de tourner.
process.on('unhandledRejection', (reason) => logger.error('Promesse rejetee', reason));
process.on('uncaughtException', (error) => logger.error('Exception non rattrapee', error));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info(`${signal} recu, arret en cours.`);
    client.destroy();
    db.close();
    process.exit(0);
  });
}

main().catch((error) => {
  if (error?.status === 401 || error?.code === 'TokenInvalid') reportBadToken();
  else logger.error('Demarrage impossible', error);
  process.exit(1);
});

module.exports = { client };
