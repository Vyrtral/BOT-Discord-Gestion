'use strict';

const { time, TimestampStyles } = require('discord.js');
const { DISCORD } = require('../constants');
const sanctionsQueries = require('../database/queries/sanctions');
const access = require('../core/access');
const render = require('../ui/render');
const { ACCENT } = require('../ui/theme');
const duration = require('../lib/duration');
const logs = require('./logs');
const i18n = require('../core/i18n');
const locales = require('../core/locale');
const logger = require('../lib/logger');

const TYPE_COLORS = {
  warn: ACCENT.warning,
  mute: ACCENT.warning,
  kick: ACCENT.danger,
  ban: ACCENT.danger,
  unmute: ACCENT.success,
  unban: ACCENT.success,
};

// Motifs d'echec renvoyes aux commandes, qui les traduisent elles-memes.
const REFUSAL = {
  self: 'self',
  bot: 'bot',
  hierarchy: 'hierarchy',
  botHierarchy: 'botHierarchy',
  missingPermission: 'missingPermission',
};

function check(actor, target) {
  if (actor.id === target.id) return REFUSAL.self;
  if (target.id === actor.client.user.id) return REFUSAL.bot;
  if (!access.canActOn(actor, target)) return REFUSAL.hierarchy;
  if (!access.botCanActOn(actor.guild, target)) return REFUSAL.botHierarchy;
  return null;
}

// Le MP part avant l'action : une fois banni, le membre n'a plus de serveur
// en commun avec le bot et Discord refuse le message.
async function notify(target, { locale, type, guildName, reason, durationMs, sanctionId }) {
  const embed = render
    .base(TYPE_COLORS[type] || ACCENT.base)
    .setTitle(i18n.t(locale, `sanctions.dm.${type}`, { guild: guildName }))
    .addFields({ name: i18n.t(locale, 'sanctions.field.reason'), value: reason || i18n.t(locale, 'sanctions.noReason') });

  if (durationMs) {
    embed.addFields({
      name: i18n.t(locale, 'sanctions.field.duration'),
      value: duration.format(durationMs, locale),
      inline: true,
    });
  }
  if (sanctionId) embed.setFooter({ text: `#${sanctionId}` });

  try {
    await target.send(render.payload(embed));
    return true;
  } catch {
    // MP fermes : cas banal, ce n'est pas une erreur.
    return false;
  }
}

async function record(guild, { type, target, moderator, reason, durationMs, locale, sanctionId, dmSent }) {
  const embed = render
    .base(TYPE_COLORS[type] || ACCENT.base)
    .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
    .setTitle(i18n.t(locale, `sanctions.log.${type}`))
    .addFields(
      { name: i18n.t(locale, 'sanctions.field.member'), value: `<@${target.id}>\n\`${target.id}\``, inline: true },
      { name: i18n.t(locale, 'sanctions.field.moderator'), value: `<@${moderator.id}>`, inline: true },
      { name: i18n.t(locale, 'sanctions.field.reason'), value: reason || i18n.t(locale, 'sanctions.noReason') },
    )
    .setTimestamp();

  if (durationMs) {
    embed.addFields(
      { name: i18n.t(locale, 'sanctions.field.duration'), value: duration.format(durationMs, locale), inline: true },
      {
        name: i18n.t(locale, 'sanctions.field.until'),
        value: time(new Date(Date.now() + durationMs), TimestampStyles.LongDateTime),
        inline: true,
      },
    );
  }
  if (dmSent === false) {
    embed.addFields({ name: '​', value: i18n.t(locale, 'sanctions.dmClosed') });
  }
  if (sanctionId) embed.setFooter({ text: `#${sanctionId}` });

  await logs.send(guild, 'sanctions', embed);
}

async function warn({ guild, target, moderator, reason, locale }) {
  const id = sanctionsQueries.add({
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    type: 'warn',
    reason,
  });
  const dmSent = await notify(target.user, { locale, type: 'warn', guildName: guild.name, reason, sanctionId: id });
  await record(guild, { type: 'warn', target: target.user, moderator, reason, locale, sanctionId: id, dmSent });

  return { id, total: sanctionsQueries.countByType(guild.id, target.id, 'warn'), dmSent };
}

async function mute({ guild, target, moderator, reason, durationMs, locale }) {
  if (durationMs > DISCORD.timeoutMaxMs) durationMs = DISCORD.timeoutMaxMs;

  const id = sanctionsQueries.add({
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    type: 'mute',
    reason,
    durationMs,
  });

  const dmSent = await notify(target.user, {
    locale,
    type: 'mute',
    guildName: guild.name,
    reason,
    durationMs,
    sanctionId: id,
  });

  await target.timeout(durationMs, reason || undefined);
  await record(guild, { type: 'mute', target: target.user, moderator, reason, durationMs, locale, sanctionId: id, dmSent });

  return { id, dmSent };
}

async function unmute({ guild, target, moderator, reason, locale }) {
  await target.timeout(null, reason || undefined);
  sanctionsQueries.liftActive(guild.id, target.id, 'mute', moderator.id);
  await record(guild, { type: 'unmute', target: target.user, moderator, reason, locale });
}

async function kick({ guild, target, moderator, reason, locale }) {
  const id = sanctionsQueries.add({
    guildId: guild.id,
    userId: target.id,
    moderatorId: moderator.id,
    type: 'kick',
    reason,
  });
  const dmSent = await notify(target.user, { locale, type: 'kick', guildName: guild.name, reason, sanctionId: id });

  await target.kick(reason || undefined);
  await record(guild, { type: 'kick', target: target.user, moderator, reason, locale, sanctionId: id, dmSent });

  return { id, dmSent };
}

async function ban({ guild, target, user, moderator, reason, durationMs, deleteDays = 0, locale }) {
  const banned = target ? target.user : user;

  const id = sanctionsQueries.add({
    guildId: guild.id,
    userId: banned.id,
    moderatorId: moderator.id,
    type: 'ban',
    reason,
    durationMs,
  });

  const dmSent = target
    ? await notify(banned, { locale, type: 'ban', guildName: guild.name, reason, durationMs, sanctionId: id })
    : null;

  await guild.members.ban(banned.id, {
    reason: reason || undefined,
    deleteMessageSeconds: Math.min(deleteDays, 7) * 24 * 60 * 60,
  });

  await record(guild, { type: 'ban', target: banned, moderator, reason, durationMs, locale, sanctionId: id, dmSent });
  return { id, dmSent };
}

async function unban({ guild, user, moderator, reason, locale }) {
  await guild.members.unban(user.id, reason || undefined);
  sanctionsQueries.liftActive(guild.id, user.id, 'ban', moderator.id);
  await record(guild, { type: 'unban', target: user, moderator, reason, locale });
}

// Repasse toutes les minutes sur les sanctions temporaires arrivees a terme.
// Le mute Discord expire tout seul, seul le ban demande une action.
async function releaseExpired(client) {
  for (const sanction of sanctionsQueries.expired()) {
    try {
      if (sanction.type === 'ban') {
        const guild = await client.guilds.fetch(sanction.guild_id).catch(() => null);
        if (guild) {
          await guild.members.unban(sanction.user_id, 'Fin de sanction temporaire').catch(() => null);
          const user = await client.users.fetch(sanction.user_id).catch(() => null);
          if (user) {
            const locale = locales.resolve(guild.id);
            await record(guild, {
              type: 'unban',
              target: user,
              moderator: client.user,
              reason: i18n.t(locale, 'sanctions.autoExpiry'),
              locale,
            });
          }
        }
      }
      sanctionsQueries.lift(sanction.id, client.user.id);
    } catch (error) {
      logger.error(`Levee automatique de la sanction #${sanction.id} impossible`, error);
    }
  }
}

module.exports = { check, warn, mute, unmute, kick, ban, unban, releaseExpired };
