'use strict';

const { SlidingWindow } = require('../../lib/collections');
const locales = require('../../core/locale');
const i18n = require('../../core/i18n');
const render = require('../../ui/render');
const logs = require('../logs');

const windows = new Map();
// Une alerte suffit : sans ce verrou, chaque nouvelle arrivee pendant la
// vague relance le message.
const alerted = new Set();

function windowFor(guildId, windowMs) {
  const existing = windows.get(guildId);
  if (existing && existing.windowMs === windowMs) return existing;
  const created = new SlidingWindow(windowMs);
  windows.set(guildId, created);
  return created;
}

// Deux declencheurs independants : un compte trop jeune est expulse tout de
// suite, une vague d'arrivees declenche l'alerte.
async function handle(member, settings) {
  if (!settings.raid_enabled) return false;

  if (settings.raid_account_age_ms > 0) {
    const age = Date.now() - member.user.createdTimestamp;
    if (age < settings.raid_account_age_ms) {
      await member.kick('Compte trop recent (antiraid)').catch(() => null);
      await report(member.guild, 'security.raid.youngAccount', { member });
      return true;
    }
  }

  const window = windowFor(member.guild.id, settings.raid_window_ms);
  const joins = window.push(member.guild.id);

  if (joins >= settings.raid_joins && !alerted.has(member.guild.id)) {
    alerted.add(member.guild.id);
    setTimeout(() => alerted.delete(member.guild.id), settings.raid_window_ms * 3).unref();
    await report(member.guild, 'security.raid.burst', { member, count: joins });
    return true;
  }

  return false;
}

async function report(guild, key, { member, count }) {
  const locale = locales.resolve(guild.id);
  const embed = render
    .caution(i18n.t(locale, key, { count: count || 0 }))
    .addFields({ name: i18n.t(locale, 'sanctions.field.member'), value: `<@${member.id}>\n\`${member.id}\`` })
    .setTimestamp();
  await logs.send(guild, 'securite', embed);
}

function sweep() {
  for (const window of windows.values()) window.sweep();
}

module.exports = { handle, sweep };
