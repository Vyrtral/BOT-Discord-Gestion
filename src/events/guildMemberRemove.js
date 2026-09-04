'use strict';

const { Events, time, TimestampStyles } = require('discord.js');
const welcome = require('../modules/welcome');
const counters = require('../modules/counters');
const logs = require('../modules/logs');
const invites = require('../modules/invites');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const { ACCENT } = require('../ui/theme');
const { truncate } = require('../lib/format');
const logger = require('../lib/logger');

module.exports = {
  name: Events.GuildMemberRemove,

  async run(client, member) {
    try {
      invites.onLeave(member.guild, member.id);
      await welcome.farewell(member);
      await counters.refresh(member.guild);

      const locale = locales.resolve(member.guild.id);
      const embed = render
        .base(ACCENT.danger)
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setDescription(i18n.t(locale, 'logs.member.left', { member: `<@${member.id}>` }))
        .setFooter({ text: `${member.id}` })
        .setTimestamp();

      if (member.joinedAt) {
        embed.addFields({
          name: i18n.t(locale, 'logs.member.wasHere'),
          value: time(member.joinedAt, TimestampStyles.RelativeTime),
          inline: true,
        });
      }

      // Le cache des roles peut etre vide si le membre n'avait jamais ete vu.
      const roles = member.roles?.cache
        .filter((role) => role.id !== member.guild.id)
        .map((role) => role.name);

      if (roles?.length) {
        embed.addFields({ name: i18n.t(locale, 'logs.member.roles'), value: truncate(roles.join(', '), 1000) });
      }

      await logs.send(member.guild, 'membres', embed);
    } catch (error) {
      logger.error(`Depart de ${member.id}`, error);
    }
  },
};
