'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { SlidingWindow } = require('../../lib/collections');
const core = require('./index');

// Une fenetre par serveur, reconstruite quand le reglage change : la duree de
// la fenetre fait partie de l'objet.
const windows = new Map();

function windowFor(guildId, windowMs) {
  const existing = windows.get(guildId);
  if (existing && existing.windowMs === windowMs) return existing;

  const created = new SlidingWindow(windowMs);
  windows.set(guildId, created);
  return created;
}

async function handle(message, settings) {
  if (!settings.spam_enabled) return false;
  if (core.isExempt(message.member, settings)) return false;

  const window = windowFor(message.guild.id, settings.spam_window_ms);
  const count = window.push(message.author.id);
  if (count < settings.spam_messages) return false;

  window.reset(message.author.id);

  // Les messages de la fenetre sont deja partis : on nettoie ce qui reste
  // visible avant d'appliquer la sanction.
  const me = message.guild.members.me;
  if (me && message.channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
    const recent = await message.channel.messages
      .fetch({ limit: Math.min(settings.spam_messages * 2, 50) })
      .catch(() => null);
    if (recent) {
      const mine = recent.filter((m) => m.author.id === message.author.id);
      await message.channel.bulkDelete(mine, true).catch(() => null);
    }
  }

  const reason = 'Antispam';
  await core.punish(message.member, settings.spam_action, { reason, muteMs: settings.spam_mute_ms });
  await core.report(message.guild, {
    titleKey: 'security.spam.triggered',
    member: message.member,
    detail: `${count} messages`,
    action: settings.spam_action,
  });

  return true;
}

function sweep() {
  for (const window of windows.values()) window.sweep();
}

module.exports = { handle, sweep };
