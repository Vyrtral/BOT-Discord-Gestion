'use strict';

const protectionsQueries = require('../../database/queries/protections');
const core = require('./index');

// Certains membres — le proprietaire, un staff harcele — ne doivent pas etre
// mentionnes. Repondre a leur message ne compte pas : c'est une mention
// technique, pas une interpellation.
function targets(message, guildId) {
  const list = protectionsQueries.protectedMembers(guildId);
  if (!list.length) return [];

  const repliedTo = message.reference?.messageId
    ? message.mentions.repliedUser?.id
    : null;

  return [...message.mentions.users.keys()].filter(
    (id) => id !== message.author.id && id !== repliedTo && list.includes(id),
  );
}

async function handle(message, settings) {
  if (!settings.pings_enabled) return false;
  if (core.isExempt(message.member, settings)) return false;

  const hit = targets(message, message.guild.id);
  if (!hit.length) return false;

  await message.delete().catch(() => null);

  if (settings.pings_action !== 'delete') {
    await core.punish(message.member, settings.pings_action, { reason: 'Mention d’un membre protege' });
  }

  await core.report(message.guild, {
    titleKey: 'security.pings.triggered',
    member: message.member,
    detail: hit.map((id) => `<@${id}>`).join(' '),
    action: settings.pings_action,
  });

  return true;
}

module.exports = { handle, targets };
