'use strict';

const { PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const securityQueries = require('../../database/queries/security');
const access = require('../../core/access');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const { ACCENT } = require('../../ui/theme');
const logs = require('../logs');

// Un webhook est le moyen le plus discret de poster a la place du serveur :
// il survit au retrait des permissions de celui qui l'a cree. On supprime
// ceux crees par quelqu'un qui n'est pas administrateur.
async function handle(channel) {
  const guild = channel.guild;
  if (!guild) return false;

  const settings = securityQueries.get(guild.id);
  if (!settings.webhooks_enabled) return false;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageWebhooks)) return false;
  if (!me.permissions.has(PermissionFlagsBits.ViewAuditLog)) return false;

  const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.WebhookCreate, limit: 1 }).catch(() => null);
  const entry = audit?.entries.first();

  // Une entree d'audit plus vieille que dix secondes ne correspond pas a
  // l'evenement qu'on vient de recevoir.
  if (!entry || Date.now() - entry.createdTimestamp > 10000) return false;

  const executor = entry.executor;
  if (!executor || executor.bot) return false;
  if (executor.id === guild.ownerId) return false;

  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (member && access.rankOf(member) >= 2) return false;
  if (member && settings.exempt_roles.some((roleId) => member.roles.cache.has(roleId))) return false;

  const webhooks = await channel.fetchWebhooks().catch(() => null);
  if (!webhooks) return false;

  let removed = 0;
  for (const webhook of webhooks.values()) {
    if (webhook.owner?.id !== executor.id) continue;
    const done = await webhook.delete('Anti-webhook').catch(() => null);
    if (done !== null) removed += 1;
  }

  if (!removed) return false;

  const locale = locales.resolve(guild.id);
  const panel = render
    .base(ACCENT.danger)
    .setTitle(i18n.t(locale, 'security.webhooks.triggered'))
    .addField(i18n.t(locale, 'sanctions.field.member'), `<@${executor.id}>\n\`${executor.id}\``)
    .addField(i18n.t(locale, 'security.field.detail'), `${channel} — ${removed}`)
    .setDated();

  await logs.send(guild, 'securite', panel);
  return true;
}

module.exports = { handle };
