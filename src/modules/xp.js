'use strict';

const { PermissionFlagsBits } = require('discord.js');
const xpQueries = require('../database/queries/xp');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const logger = require('../lib/logger');

// Palier cumule : 100 xp pour le niveau 1, 300 pour le 2, 600 pour le 3.
// L'ecart entre deux niveaux grandit de 100 a chaque fois.
function totalXpFor(level) {
  return 50 * level * (level + 1);
}

function levelFromXp(xp) {
  if (xp <= 0) return 0;
  return Math.floor((-1 + Math.sqrt(1 + 0.08 * xp)) / 2);
}

// Position dans le niveau en cours, pour la barre de progression.
function progress(xp) {
  const level = levelFromXp(xp);
  const floor = totalXpFor(level);
  const ceiling = totalXpFor(level + 1);
  return {
    level,
    current: xp - floor,
    needed: ceiling - floor,
    ratio: (xp - floor) / (ceiling - floor),
  };
}

function progressBar(ratio, width = 12) {
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * width);
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

// Les recompenses sont cumulatives : monter de niveau ajoute le nouveau role
// sans retirer les precedents.
async function syncRewards(member, level) {
  const rewards = xpQueries.rewards(member.guild.id).filter((reward) => reward.level <= level);
  if (!rewards.length) return [];

  const me = member.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return [];

  const missing = rewards
    .map((reward) => member.guild.roles.cache.get(reward.role_id))
    .filter((role) => role && !member.roles.cache.has(role.id) && me.roles.highest.comparePositionTo(role) > 0);

  if (!missing.length) return [];

  try {
    await member.roles.add(missing, 'Recompense de niveau');
    return missing;
  } catch (error) {
    logger.error(`Roles de niveau non attribues a ${member.id}`, error);
    return [];
  }
}

async function announce(member, level, settings) {
  const locale = locales.resolve(member.guild.id);
  const text = i18n.t(locale, 'xp.levelUp', { member: `<@${member.id}>`, level });

  if (settings.announce_mode === 'dm') {
    await member.send(render.payload(render.success(text))).catch(() => null);
    return;
  }

  const channelId = settings.announce_channel;
  if (!channelId) return;

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const me = member.guild.members.me;
  if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return;

  await channel.send(render.payload(render.success(text))).catch(() => null);
}

// Appelee a chaque message. Le cooldown evite qu'un salon de spam fasse
// grimper quelqu'un en quelques minutes.
async function onMessage(message) {
  const settings = xpQueries.settings(message.guild.id);
  if (!settings.enabled) return;
  if (settings.ignored_channels.includes(message.channel.id)) return;

  const record = xpQueries.user(message.guild.id, message.author.id);
  const onCooldown = Date.now() - record.last_gain_at < settings.cooldown_ms;

  const gain = onCooldown ? 0 : settings.message_xp;
  const before = levelFromXp(record.xp);
  const after = xpQueries.addXp(message.guild.id, message.author.id, gain, {
    messages: 1,
    touchCooldown: !onCooldown,
  });

  if (!gain) return;

  const level = levelFromXp(after);
  if (level > before) {
    await syncRewards(message.member, level);
    await announce(message.member, level, settings);
  }
}

// Appelee par le minuteur vocal, une fois par minute passee en vocal.
async function addVoiceMinute(member) {
  const settings = xpQueries.settings(member.guild.id);
  if (!settings.enabled) return;

  const before = levelFromXp(xpQueries.user(member.guild.id, member.id).xp);
  const after = xpQueries.addXp(member.guild.id, member.id, settings.voice_xp, { voiceSeconds: 60 });

  const level = levelFromXp(after);
  if (level > before) {
    await syncRewards(member, level);
    await announce(member, level, settings);
  }
}

module.exports = { totalXpFor, levelFromXp, progress, progressBar, onMessage, addVoiceMinute };
