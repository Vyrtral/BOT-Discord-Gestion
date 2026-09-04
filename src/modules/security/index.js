'use strict';

const { PermissionFlagsBits } = require('discord.js');
const sanctionsQueries = require('../../database/queries/sanctions');
const access = require('../../core/access');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const logs = require('../logs');
const logger = require('../../lib/logger');

// Les protections ne visent pas le staff. Un membre est exempte s'il a au
// moins le rang moderateur ou l'un des roles listes dans la configuration.
function isExempt(member, settings) {
  if (!member || member.user.bot) return true;
  if (access.rankOf(member) >= 1) return true;
  return settings.exempt_roles.some((roleId) => member.roles.cache.has(roleId));
}

// Applique la reponse configuree pour une protection. Chaque action est
// tentee separement : si le bot n'a pas le droit de bannir, la suppression du
// message a quand meme eu lieu.
async function punish(member, action, { reason, muteMs = 300000 }) {
  const guild = member.guild;
  const me = guild.members.me;

  if (!access.botCanActOn(guild, member)) return false;

  try {
    switch (action) {
      case 'mute':
        if (!me.permissions.has(PermissionFlagsBits.ModerateMembers)) return false;
        await member.timeout(muteMs, reason);
        sanctionsQueries.add({
          guildId: guild.id,
          userId: member.id,
          moderatorId: guild.client.user.id,
          type: 'mute',
          reason,
          durationMs: muteMs,
        });
        return true;

      case 'kick':
        if (!me.permissions.has(PermissionFlagsBits.KickMembers)) return false;
        await member.kick(reason);
        sanctionsQueries.add({
          guildId: guild.id,
          userId: member.id,
          moderatorId: guild.client.user.id,
          type: 'kick',
          reason,
        });
        return true;

      case 'ban':
        if (!me.permissions.has(PermissionFlagsBits.BanMembers)) return false;
        await guild.members.ban(member.id, { reason });
        sanctionsQueries.add({
          guildId: guild.id,
          userId: member.id,
          moderatorId: guild.client.user.id,
          type: 'ban',
          reason,
        });
        return true;

      case 'warn':
        sanctionsQueries.add({
          guildId: guild.id,
          userId: member.id,
          moderatorId: guild.client.user.id,
          type: 'warn',
          reason,
        });
        return true;

      default:
        return false;
    }
  } catch (error) {
    logger.error(`Action automatique "${action}" impossible sur ${member.id}`, error);
    return false;
  }
}

async function report(guild, { titleKey, member, detail, action }) {
  const locale = locales.resolve(guild.id);
  const embed = render
    .caution(i18n.t(locale, titleKey))
    .setFields(
      { name: i18n.t(locale, 'sanctions.field.member'), value: `<@${member.id}>\n\`${member.id}\``, inline: true },
      { name: i18n.t(locale, 'security.field.action'), value: i18n.t(locale, `security.action.${action}`), inline: true },
    )
    .setTimestamp();

  if (detail) embed.addFields({ name: i18n.t(locale, 'security.field.detail'), value: detail });
  await logs.send(guild, 'securite', embed);
}

module.exports = { isExempt, punish, report };
