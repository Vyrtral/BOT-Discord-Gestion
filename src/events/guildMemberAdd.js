'use strict';

const { Events, time, TimestampStyles } = require('discord.js');
const securityQueries = require('../database/queries/security');
const antiraid = require('../modules/security/antiraid');
const antibot = require('../modules/security/bots');
const welcome = require('../modules/welcome');
const counters = require('../modules/counters');
const logs = require('../modules/logs');
const invites = require('../modules/invites');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const { ACCENT } = require('../ui/theme');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildMemberAdd,

  async run(client, member) {
    try {
      // Un bot n'a ni accueil, ni role automatique, ni suivi d'invitation :
      // le traitement s'arrete la.
      if (member.user.bot) {
        await antibot.handle(member);
        return;
      }

      const settings = securityQueries.get(member.guild.id);

      // Si l'antiraid expulse le membre, ni l'accueil ni le role automatique
      // n'ont de raison de partir.
      const handled = await antiraid.handle(member, settings);
      if (handled) return;

      // L'inviteur se deduit avant l'accueil : le message peut le citer.
      const inviterId = await invites.resolveInviter(member).catch(() => null);

      await welcome.greet(member);
      await announce(member, inviterId);
      await counters.refresh(member.guild);
    } catch (error) {
      logger.error(`Arrivee de ${member.id}`, error);
    }
  },
};

async function announce(member, inviterId) {
  const locale = locales.resolve(member.guild.id);
  const embed = render
    .base(ACCENT.success)
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setDescription(i18n.t(locale, 'logs.member.joined', { member: `<@${member.id}>` }))
    .addFields({
      name: i18n.t(locale, 'logs.member.accountAge'),
      value: time(member.user.createdAt, TimestampStyles.RelativeTime),
    })
    .setFooter({ text: `${member.id}` })
    .setTimestamp();

  if (inviterId) {
    embed.addFields({ name: i18n.t(locale, 'logs.member.invitedBy'), value: `<@${inviterId}>` });
  }

  await logs.send(member.guild, 'membres', embed);
}
