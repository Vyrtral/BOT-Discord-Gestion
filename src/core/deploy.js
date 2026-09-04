'use strict';

const { REST, Routes } = require('discord.js');
const localize = require('./localize');

// Deux portees possibles. Un serveur de developpement met a jour les
// commandes tout de suite ; le global peut mettre jusqu'a une heure a se
// propager, donc on ne l'utilise qu'en production.
async function deploy({ token, clientId, guildId, commands }) {
  const body = commands.map((command) => localize.apply(command.data.toJSON()));
  const rest = new REST({ version: '10' }).setToken(token);

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  const result = await rest.put(route, { body });
  return { count: result.length, scope: guildId ? 'serveur' : 'global' };
}

module.exports = { deploy };
