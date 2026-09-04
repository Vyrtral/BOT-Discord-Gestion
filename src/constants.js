'use strict';

// Limites imposees par Discord, regroupees ici pour ne pas les recopier
// a l'aveugle dans chaque fichier.
const DISCORD = {
  bulkDeleteMax: 100,
  bulkDeleteMaxAgeMs: 14 * 24 * 60 * 60 * 1000,
  timeoutMaxMs: 28 * 24 * 60 * 60 * 1000,
  embedDescriptionMax: 4096,
  embedFieldValueMax: 1024,
  selectOptionsMax: 25,
  slowmodeMaxSeconds: 21600,
};

// Un rang par niveau de confiance. Les commandes declarent le rang minimum
// dont elles ont besoin, la valeur numerique sert a comparer.
const RANK = {
  member: 0,
  moderator: 1,
  admin: 2,
  system: 3,
};

// Categories de logs. La cle sert de nom de colonne cote base et de choix
// dans /logs, le libelle affiche vient des fichiers de langue.
const LOG_CATEGORIES = [
  'messages',
  'membres',
  'roles',
  'salons',
  'vocal',
  'sanctions',
  'securite',
];

// Ce que le bot fait quand une protection se declenche.
const AUTO_ACTIONS = ['warn', 'delete', 'mute', 'kick', 'ban'];

module.exports = { DISCORD, RANK, LOG_CATEGORIES, AUTO_ACTIONS };
