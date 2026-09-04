'use strict';

const guildsQueries = require('../database/queries/guilds');
const i18n = require('./i18n');
const config = require('./config');

// La langue d'un serveur est lue a chaque interaction. Un cache evite un
// aller-retour SQLite par commande ; il est vide par /config langue.
const cache = new Map();

function resolve(guildId) {
  if (!guildId) return config.locale;
  if (cache.has(guildId)) return cache.get(guildId);

  const stored = guildsQueries.getLocale(guildId);
  const locale = stored && i18n.has(stored) ? stored : config.locale;
  cache.set(guildId, locale);
  return locale;
}

function set(guildId, locale) {
  guildsQueries.setLocale(guildId, locale);
  cache.set(guildId, locale);
}

function forget(guildId) {
  cache.delete(guildId);
}

module.exports = { resolve, set, forget };
