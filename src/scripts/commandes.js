'use strict';

// Imprime le tableau des commandes au format Markdown, tel qu'il figure dans
// le README. A relancer apres avoir ajoute ou renomme une commande :
//   npm run commandes > /tmp/commandes.md
// Ecrire ce tableau a la main garantit qu'il finit par mentir.
const path = require('node:path');
const i18n = require('../core/i18n');
const { loadCommands } = require('../core/loader');
const access = require('../core/access');
const { RANK } = require('../constants');

const ORDER = ['moderation', 'vocal', 'securite', 'tickets', 'niveaux', 'configuration', 'info'];
const RANK_LABEL = { 0: 'Membre', 1: 'Modérateur', 2: 'Admin', 3: 'Système' };

function entries(command) {
  const json = command.data.toJSON();
  const subcommands = (json.options || []).filter((option) => option.type === 1);
  const baseRank = command.rank ?? RANK.member;

  if (!subcommands.length) {
    return [{ usage: `/${json.name}`, description: json.description, rank: baseRank }];
  }
  return subcommands.map((sub) => ({
    usage: `/${json.name} ${sub.name}`,
    description: sub.description,
    rank: command.subcommandRanks?.[sub.name] ?? baseRank,
  }));
}

function main() {
  i18n.load();
  const { commands } = loadCommands(path.join(__dirname, '..', 'commands'));

  let total = 0;
  for (const category of ORDER) {
    const list = [...commands.values()].filter((command) => command.category === category);
    if (!list.length) continue;

    const rows = list.flatMap(entries).sort((a, b) => a.usage.localeCompare(b.usage));
    total += rows.length;

    console.log(`### ${i18n.t('fr', `help.category.${category}`)}\n`);
    console.log('| Commande | Rang | Ce qu’elle fait |');
    console.log('|---|---|---|');
    for (const row of rows) {
      console.log(`| \`${row.usage}\` | ${RANK_LABEL[row.rank]} | ${row.description} |`);
    }
    console.log('');
  }

  console.error(`${commands.size} commandes, ${total} actions.`);
}

main();
