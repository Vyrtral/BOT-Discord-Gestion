'use strict';

const core = require('./index');

// Compte les mentions uniques : citer trois fois la meme personne n'est pas
// du mass-ping.
function countTargets(message) {
  const users = new Set(message.mentions.users.filter((user) => !user.bot).keys());
  const roles = message.mentions.roles.size;
  const everyone = message.mentions.everyone ? 1 : 0;
  return users.size + roles + everyone;
}

async function handle(message, settings) {
  if (!settings.mentions_enabled) return false;
  if (core.isExempt(message.member, settings)) return false;

  const total = countTargets(message);
  if (total < settings.mentions_max) return false;

  await message.delete().catch(() => null);
  await core.punish(message.member, settings.mentions_action, { reason: 'Mentions en masse' });
  await core.report(message.guild, {
    titleKey: 'security.mentions.triggered',
    member: message.member,
    detail: `${total}`,
    action: settings.mentions_action,
  });

  return true;
}

module.exports = { handle };
