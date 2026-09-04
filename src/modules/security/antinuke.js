'use strict';

const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { SlidingWindow } = require('../../lib/collections');
const securityQueries = require('../../database/queries/security');
const access = require('../../core/access');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const logs = require('../logs');
const logger = require('../../lib/logger');

// Evenements surveilles et entree d'audit correspondante. On ne peut pas
// savoir qui a supprime un salon autrement qu'en lisant l'audit log.
const WATCHED = {
  channelDelete: AuditLogEvent.ChannelDelete,
  channelCreate: AuditLogEvent.ChannelCreate,
  roleDelete: AuditLogEvent.RoleDelete,
  roleCreate: AuditLogEvent.RoleCreate,
  memberBan: AuditLogEvent.MemberBanAdd,
  memberKick: AuditLogEvent.MemberKick,
  webhookCreate: AuditLogEvent.WebhookCreate,
};

const windows = new Map();

function windowFor(guildId, windowMs) {
  const existing = windows.get(guildId);
  if (existing && existing.windowMs === windowMs) return existing;
  const created = new SlidingWindow(windowMs);
  windows.set(guildId, created);
  return created;
}

// L'entree d'audit met parfois une seconde a apparaitre. On accepte celles
// des dix dernieres secondes seulement, sinon on attribue a quelqu'un une
// action bien plus ancienne.
async function findExecutor(guild, type) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;

  const audit = await guild.fetchAuditLogs({ type: WATCHED[type], limit: 1 }).catch(() => null);
  const entry = audit?.entries.first();
  if (!entry) return null;
  if (Date.now() - entry.createdTimestamp > 10000) return null;

  return entry.executor || null;
}

// Appelee par les evenements de salon, de role, de ban et de webhook.
async function record(guild, type) {
  const settings = securityQueries.get(guild.id);
  if (!settings.nuke_enabled) return;

  const executor = await findExecutor(guild, type);
  if (!executor || executor.bot || executor.id === guild.client.user.id) return;
  if (executor.id === guild.ownerId) return;

  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member) return;
  // Le proprietaire du bot et les administrateurs declares restent hors de
  // portee : ce sont eux qui reorganisent le serveur.
  if (access.rankOf(member) >= 2) return;
  if (settings.exempt_roles.some((roleId) => member.roles.cache.has(roleId))) return;

  const window = windowFor(guild.id, settings.nuke_window_ms);
  const count = window.push(executor.id);
  if (count < settings.nuke_threshold) return;

  window.reset(executor.id);
  await neutralize(guild, member, settings, { type, count });
}

async function neutralize(guild, member, settings, { type, count }) {
  const reason = `Antinuke : ${count} actions en ${Math.round(settings.nuke_window_ms / 1000)}s`;
  let applied = 'none';

  try {
    if (settings.nuke_action === 'ban' && access.botCanActOn(guild, member)) {
      await guild.members.ban(member.id, { reason });
      applied = 'ban';
    } else if (settings.nuke_action === 'kick' && access.botCanActOn(guild, member)) {
      await member.kick(reason);
      applied = 'kick';
    } else if (access.botCanActOn(guild, member)) {
      // Repli : retirer les roles qui donnent les permissions dangereuses.
      const dangerous = member.roles.cache.filter((role) =>
        role.permissions.has(PermissionFlagsBits.Administrator) ||
        role.permissions.has(PermissionFlagsBits.ManageChannels) ||
        role.permissions.has(PermissionFlagsBits.ManageRoles) ||
        role.permissions.has(PermissionFlagsBits.BanMembers),
      );
      if (dangerous.size) {
        await member.roles.remove(dangerous, reason);
        applied = 'derank';
      }
    }
  } catch (error) {
    logger.error(`Antinuke : neutralisation impossible sur ${member.id}`, error);
  }

  const locale = locales.resolve(guild.id);
  const embed = render
    .failure(i18n.t(locale, 'security.nuke.triggered', { count }))
    .addFields(
      { name: i18n.t(locale, 'sanctions.field.member'), value: `<@${member.id}>\n\`${member.id}\``, inline: true },
      { name: i18n.t(locale, 'security.field.action'), value: i18n.t(locale, `security.action.${applied}`), inline: true },
      { name: i18n.t(locale, 'security.field.detail'), value: i18n.t(locale, `security.event.${type}`) },
    )
    .setTimestamp();

  await logs.send(guild, 'securite', embed);
}

function sweep() {
  for (const window of windows.values()) window.sweep();
}

module.exports = { record, sweep };
