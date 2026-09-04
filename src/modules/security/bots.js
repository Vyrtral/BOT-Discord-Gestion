'use strict';

const { PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const protectionsQueries = require('../../database/queries/protections');
const securityQueries = require('../../database/queries/security');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const { ACCENT } = require('../../ui/theme');
const logs = require('../logs');

// Un bot ajoute sans passer par la liste blanche est expulse. Celui qui l'a
// invite est nomme dans le journal : c'est l'information utile, le bot en
// lui-meme n'est que le symptome.
async function inviterOf(guild, botId) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

  const audit = await guild
    .fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 })
    .catch(() => null);

  const entry = audit?.entries.find((log) => log.target?.id === botId);
  return entry?.executor || null;
}

async function handle(member) {
  if (!member.user.bot) return false;

  const guild = member.guild;
  const settings = securityQueries.get(guild.id);
  if (!settings.bots_enabled) return false;

  if (protectionsQueries.isBotAllowed(guild.id, member.id)) return false;

  const me = guild.members.me;
  const canKick = me?.permissions.has(PermissionFlagsBits.KickMembers);
  const canBan = me?.permissions.has(PermissionFlagsBits.BanMembers);

  let applied = 'none';
  if (settings.bots_action === 'ban' && canBan) {
    await guild.members.ban(member.id, { reason: 'Anti-bot' }).catch(() => null);
    applied = 'ban';
  } else if (canKick) {
    await member.kick('Anti-bot').catch(() => null);
    applied = 'kick';
  }

  const inviter = await inviterOf(guild, member.id);
  const locale = locales.resolve(guild.id);

  const panel = render
    .base(ACCENT.danger)
    .setTitle(i18n.t(locale, 'security.bots.triggered'))
    .addField(i18n.t(locale, 'security.bots.bot'), `${member.user.tag}\n\`${member.id}\``)
    .addField(i18n.t(locale, 'security.field.action'), i18n.t(locale, `security.action.${applied}`))
    .setDated();

  if (inviter) {
    panel.addField(i18n.t(locale, 'security.bots.addedBy'), `<@${inviter.id}>\n\`${inviter.id}\``);
  }

  await logs.send(guild, 'securite', panel);
  return true;
}

module.exports = { handle };
