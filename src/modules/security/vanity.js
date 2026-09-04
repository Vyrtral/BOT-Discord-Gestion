'use strict';

const { PermissionFlagsBits } = require('discord.js');
const securityQueries = require('../../database/queries/security');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const { ACCENT } = require('../../ui/theme');
const logs = require('../logs');

// L'URL personnalisee d'un serveur est ce qu'un attaquant change en premier :
// c'est irreversible si quelqu'un s'empare du code libere. On memorise le
// code attendu et on le remet en place s'il change.
async function remember(guild) {
  const settings = securityQueries.get(guild.id);
  if (!settings.vanity_enabled) return;
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return;

  const current = guild.vanityURLCode || null;
  if (current && current !== settings.vanity_code) {
    securityQueries.update(guild.id, { vanity_code: current });
  }
}

async function handle(before, after) {
  const settings = securityQueries.get(after.id);
  if (!settings.vanity_enabled) return false;

  const attendu = settings.vanity_code;
  if (!attendu) return false;
  if (after.vanityURLCode === attendu) return false;

  const me = after.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) return false;

  const remis = await after.setVanityCode?.(attendu, 'Anti-vanity').catch(() => null);

  const locale = locales.resolve(after.id);
  const panel = render
    .base(ACCENT.danger)
    .setTitle(i18n.t(locale, 'security.vanity.triggered'))
    .addField(i18n.t(locale, 'security.vanity.expected'), `\`${attendu}\``)
    .addField(i18n.t(locale, 'security.vanity.found'), after.vanityURLCode ? `\`${after.vanityURLCode}\`` : '—')
    .addField(
      i18n.t(locale, 'security.field.action'),
      i18n.t(locale, remis ? 'security.vanity.restored' : 'security.vanity.failed'),
    )
    .setDated();

  await logs.send(after, 'securite', panel);
  return true;
}

module.exports = { handle, remember };
