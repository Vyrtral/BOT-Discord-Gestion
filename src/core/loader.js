'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

function walkJs(directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkJs(full));
    else if (entry.name.endsWith('.js')) found.push(full);
  }
  return found;
}

function loadCommands(directory) {
  const commands = new Collection();
  const problems = [];

  for (const file of walkJs(directory)) {
    const command = require(file);
    const relative = path.relative(directory, file);

    if (!command.data || typeof command.run !== 'function') {
      problems.push(`${relative} : il manque "data" ou "run".`);
      continue;
    }
    if (commands.has(command.data.name)) {
      problems.push(`${relative} : la commande /${command.data.name} existe deja.`);
      continue;
    }

    // La categorie sert a regrouper les commandes dans /aide. Elle vient du
    // nom du dossier, pas d'un champ a remplir a la main.
    command.category = path.dirname(relative).split(path.sep)[0];
    commands.set(command.data.name, command);
  }

  return { commands, problems };
}

// Un fichier d'evenements exporte soit un handler, soit un tableau : les
// evenements qui partagent la meme configuration tiennent ainsi ensemble.
function loadEvents(client, directory) {
  let count = 0;
  for (const file of walkJs(directory)) {
    const exported = require(file);
    const handlers = Array.isArray(exported) ? exported : [exported];

    for (const handler of handlers) {
      if (!handler?.name || typeof handler.run !== 'function') continue;

      if (handler.once) client.once(handler.name, (...args) => handler.run(client, ...args));
      else client.on(handler.name, (...args) => handler.run(client, ...args));
      count += 1;
    }
  }
  return count;
}

module.exports = { loadCommands, loadEvents };
