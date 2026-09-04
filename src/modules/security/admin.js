'use strict';

const { PermissionFlagsBits } = require('discord.js');
const securityQueries = require('../../database/queries/security');
const interdictions = require('../../database/queries/interdictions');
const access = require('../../core/access');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const { ACCENT } = require('../../ui/theme');
const logs = require('../logs');

// Permissions qui donnent les cles du serveur. Un role qui en porte une ne
// devrait jamais atterrir sur quelqu'un par surprise.
const DANGEREUSES = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
];

function estDangereux(role) {
  return DANGEREUSES.some((flag) => role.permissions.has(flag));
}

// Deux protections en une, sur le meme evenement : un role dangereux donne a
// quelqu'un qui n'est pas administrateur declare (antiadmin), et un role
// nommement interdit a ce membre (blacklist de role).
async function handle(before, after) {
  const guild = after.guild;
  const settings = securityQueries.get(guild.id);

  const ajoutes = after.roles.cache.filter((role) => !before.roles.cache.has(role.id));
  if (!ajoutes.size) return false;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return false;

  const interdits = new Set(interdictions.bannedRoles(guild.id, after.id));
  const exempte = settings.exempt_roles.some((roleId) => after.roles.cache.has(roleId));

  const aRetirer = ajoutes.filter((role) => {
    if (interdits.has(role.id)) return true;
    if (!settings.admin_enabled) return false;
    if (exempte) return false;
    if (access.rankOf(after) >= 2) return false;
    if (after.id === guild.ownerId) return false;
    return estDangereux(role) && me.roles.highest.comparePositionTo(role) > 0;
  });

  if (!aRetirer.size) return false;

  await after.roles.remove(aRetirer, 'Role non autorise').catch(() => null);

  const locale = locales.resolve(guild.id);
  const panel = render
    .base(ACCENT.danger)
    .setTitle(i18n.t(locale, 'security.admin.triggered'))
    .addField(i18n.t(locale, 'sanctions.field.member'), `<@${after.id}>\n\`${after.id}\``)
    .addField(i18n.t(locale, 'security.field.detail'), aRetirer.map((role) => role.name).join(', '))
    .setDated();

  await logs.send(guild, 'securite', panel);
  return true;
}

module.exports = { handle, estDangereux };
