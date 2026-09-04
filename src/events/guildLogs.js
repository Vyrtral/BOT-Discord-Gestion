'use strict';

const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const logs = require('../modules/logs');
const antinuke = require('../modules/security/antinuke');
const antiadmin = require('../modules/security/admin');
const antivanity = require('../modules/security/vanity');
const blacklistQueries = require('../database/queries/blacklist');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const { ACCENT } = require('../ui/theme');

const CHANNEL_KINDS = {
  [ChannelType.GuildText]: 'texte',
  [ChannelType.GuildVoice]: 'vocal',
  [ChannelType.GuildCategory]: 'categorie',
  [ChannelType.GuildAnnouncement]: 'annonces',
  [ChannelType.GuildStageVoice]: 'conference',
  [ChannelType.GuildForum]: 'forum',
};

module.exports = [
  {
    name: Events.ChannelCreate,
    async run(client, channel) {
      if (!channel.guild) return;
      await antinuke.record(channel.guild, 'channelCreate');
      await report(channel.guild, ACCENT.success, 'logs.channel.created', {
        name: channel.name,
        kind: CHANNEL_KINDS[channel.type] || '—',
      });
    },
  },
  {
    name: Events.ChannelDelete,
    async run(client, channel) {
      if (!channel.guild) return;
      await antinuke.record(channel.guild, 'channelDelete');
      await report(channel.guild, ACCENT.danger, 'logs.channel.deleted', {
        name: channel.name,
        kind: CHANNEL_KINDS[channel.type] || '—',
      });
    },
  },
  {
    name: Events.GuildUpdate,
    async run(client, before, after) {
      await antivanity.handle(before, after);
    },
  },
  {
    name: Events.GuildRoleCreate,
    async run(client, role) {
      await antinuke.record(role.guild, 'roleCreate');
      await report(role.guild, ACCENT.success, 'logs.role.created', { name: role.name }, 'roles');
    },
  },
  {
    name: Events.GuildRoleDelete,
    async run(client, role) {
      await antinuke.record(role.guild, 'roleDelete');
      await report(role.guild, ACCENT.danger, 'logs.role.deleted', { name: role.name }, 'roles');
    },
  },
  {
    name: Events.GuildBanAdd,
    async run(client, ban) {
      await antinuke.record(ban.guild, 'memberBan');
    },
  },
  {
    // Un compte en blacklist qui est debanni a la main est immediatement
    // rebanni : c'est tout l'interet d'une liste separee du ban Discord.
    name: Events.GuildBanRemove,
    async run(client, ban) {
      if (!blacklistQueries.has(ban.guild.id, ban.user.id)) return;

      const me = ban.guild.members.me;
      if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) return;

      await ban.guild.members.ban(ban.user.id, { reason: 'Compte en blacklist' }).catch(() => null);
      await report(ban.guild, ACCENT.danger, 'logs.blacklistReban', { user: ban.user.tag }, 'sanctions');
    },
  },
  {
    name: Events.GuildMemberUpdate,
    async run(client, before, after) {
      // Le retrait d'un rôle non autorisé passe avant le journal : ce qui est
      // consigné doit être l'état après correction.
      await antiadmin.handle(before, after);

      const added = after.roles.cache.filter((role) => !before.roles.cache.has(role.id));
      const removed = before.roles.cache.filter((role) => !after.roles.cache.has(role.id));

      if (added.size || removed.size) {
        const locale = locales.resolve(after.guild.id);
        const embed = render
          .base(ACCENT.base)
          .setAuthor({ name: after.user.tag, iconURL: after.user.displayAvatarURL() })
          .setDescription(i18n.t(locale, 'logs.member.rolesChanged', { member: `<@${after.id}>` }))
          .setFooter({ text: `${after.id}` })
          .setTimestamp();

        if (added.size) {
          embed.addFields({
            name: i18n.t(locale, 'logs.member.rolesAdded'),
            value: added.map((role) => `${role}`).join(' '),
          });
        }
        if (removed.size) {
          embed.addFields({
            name: i18n.t(locale, 'logs.member.rolesRemoved'),
            value: removed.map((role) => `${role}`).join(' '),
          });
        }

        await logs.send(after.guild, 'roles', embed);
      }

      if (before.nickname !== after.nickname) {
        const locale = locales.resolve(after.guild.id);
        const embed = render
          .base(ACCENT.base)
          .setAuthor({ name: after.user.tag, iconURL: after.user.displayAvatarURL() })
          .setDescription(i18n.t(locale, 'logs.member.nickname'))
          .addFields(
            { name: i18n.t(locale, 'logs.message.before'), value: before.nickname || '—', inline: true },
            { name: i18n.t(locale, 'logs.message.after'), value: after.nickname || '—', inline: true },
          )
          .setFooter({ text: `${after.id}` })
          .setTimestamp();

        await logs.send(after.guild, 'membres', embed);
      }
    },
  },
];

async function report(guild, color, key, vars, category = 'salons') {
  const locale = locales.resolve(guild.id);
  const embed = render.base(color).setDescription(i18n.t(locale, key, vars)).setTimestamp();
  await logs.send(guild, category, embed);
}
