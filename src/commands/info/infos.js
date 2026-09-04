'use strict';

const { SlashCommandBuilder, ChannelType, time, TimestampStyles } = require('discord.js');
const { RANK } = require('../../constants');
const access = require('../../core/access');
const sanctionsQueries = require('../../database/queries/sanctions');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const duration = require('../../lib/duration');
const { truncate } = require('../../lib/format');

const VERIFICATION = ['aucune', 'faible', 'moyenne', 'elevee', 'maximale'];

module.exports = {
  rank: RANK.member,

  data: new SlashCommandBuilder()
    .setName('infos')
    .setDescription('Informations sur le serveur, un membre ou le bot')
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('serveur').setDescription('Informations sur le serveur'))
    .addSubcommand((sub) =>
      sub
        .setName('membre')
        .setDescription('Informations sur un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre a consulter, toi par défaut')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('avatar')
        .setDescription('Affiche l’avatar d’un membre en grand')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne, toi par défaut'))
        .addBooleanOption((o) => o.setName('serveur').setDescription('Prendre l’avatar propre au serveur s’il existe')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('banniere')
        .setDescription('Affiche la bannière d’un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne, toi par défaut')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Informations sur un rôle')
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle concerne').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('salon')
        .setDescription('Informations sur un salon')
        .addChannelOption((o) => o.setName('salon').setDescription('Le salon concerne, le salon actuel par défaut')),
    )
    .addSubcommand((sub) => sub.setName('boosters').setDescription('Membres qui boostent le serveur'))
    .addSubcommand((sub) => sub.setName('bot').setDescription('Latence et durée de fonctionnement du bot')),

  async run(interaction, { t, locale }) {
    switch (interaction.options.getSubcommand()) {
      case 'serveur':
        return guild(interaction, t);
      case 'membre':
        return member(interaction, t);
      case 'avatar':
        return avatar(interaction, t);
      case 'banniere':
        return banner(interaction, t);
      case 'role':
        return roleInfo(interaction, t);
      case 'salon':
        return channelInfo(interaction, t);
      case 'boosters':
        return boosters(interaction, t);
      default:
        return bot(interaction, t, locale);
    }
  },
};

async function guild(interaction, t) {
  const guild = interaction.guild;

  // memberCount est fiable sans cache ; le detail humains/bots demanderait un
  // fetch complet, trop couteux sur un gros serveur pour une fiche d'info.
  const channels = guild.channels.cache;
  const text = channels.filter((c) => c.type === ChannelType.GuildText).size;
  const voice = channels.filter((c) => c.type === ChannelType.GuildVoice).size;

  const owner = await guild.fetchOwner().catch(() => null);

  const embed = render
    .info('', guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: t('info.server.owner'), value: owner ? `<@${owner.id}>` : t('common.unknown'), inline: true },
      { name: t('info.server.created'), value: time(guild.createdAt, TimestampStyles.LongDate), inline: true },
      { name: t('info.server.id'), value: `\`${guild.id}\``, inline: true },
      { name: t('info.server.members'), value: String(guild.memberCount), inline: true },
      { name: t('info.server.channels'), value: `${text} · ${voice}`, inline: true },
      { name: t('info.server.roles'), value: String(guild.roles.cache.size - 1), inline: true },
      {
        name: t('info.server.boosts'),
        value: `${guild.premiumSubscriptionCount || 0} (${t('info.server.tier')} ${guild.premiumTier})`,
        inline: true,
      },
      { name: t('info.server.verification'), value: VERIFICATION[guild.verificationLevel] || '—', inline: true },
      { name: t('info.server.emojis'), value: String(guild.emojis.cache.size), inline: true },
    );

  if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));
  return respond.show(interaction, embed);
}

async function member(interaction, t) {
  const user = interaction.options.getUser('membre') || interaction.user;
  const target = await interaction.guild.members.fetch(user.id).catch(() => null);

  const embed = render
    .info('', user.tag)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: t('info.member.id'), value: `\`${user.id}\``, inline: true },
      { name: t('info.member.created'), value: time(user.createdAt, TimestampStyles.LongDate), inline: true },
    );

  if (target) {
    const roles = target.roles.cache
      .filter((role) => role.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => `${role}`);

    embed.addFields(
      { name: t('info.member.joined'), value: time(target.joinedAt, TimestampStyles.LongDate), inline: true },
      { name: t('info.member.rank'), value: t(`config.rank.${access.rankOf(target)}`), inline: true },
      {
        name: t('info.member.roles', { count: roles.length }),
        value: roles.length ? truncate(roles.join(' '), 1000) : t('common.none'),
      },
    );

    if (target.communicationDisabledUntil) {
      embed.addFields({
        name: t('info.member.mutedUntil'),
        value: time(target.communicationDisabledUntil, TimestampStyles.RelativeTime),
      });
    }
    if (target.premiumSince) {
      embed.addFields({
        name: t('info.member.boosting'),
        value: time(target.premiumSince, TimestampStyles.RelativeTime),
        inline: true,
      });
    }
  } else {
    embed.setFooter({ text: t('info.member.notInGuild') });
  }

  // Le nombre de sanctions ne s'affiche qu'au staff : ce n'est pas une
  // information publique.
  if (access.rankOf(interaction.member) >= RANK.moderator) {
    const history = sanctionsQueries.history(interaction.guild.id, user.id, 100);
    embed.addFields({ name: t('info.member.sanctions'), value: String(history.length), inline: true });
  }

  return respond.show(interaction, embed);
}

async function avatar(interaction, t) {
  const user = interaction.options.getUser('membre') || interaction.user;
  const guildAvatar = interaction.options.getBoolean('serveur');

  let url = user.displayAvatarURL({ size: 1024 });
  if (guildAvatar) {
    const target = await interaction.guild.members.fetch(user.id).catch(() => null);
    url = target?.displayAvatarURL({ size: 1024 }) || url;
  }

  return respond.show(
    interaction,
    render.panel(t('info.avatar.title', { user: user.username })).setImage(url).setFooter(user.id),
  );
}

async function banner(interaction, t) {
  const option = interaction.options.getUser('membre') || interaction.user;

  // La banniere n'arrive pas avec l'objet utilisateur d'une interaction : il
  // faut la demander explicitement a l'API.
  const user = await interaction.client.users.fetch(option.id, { force: true }).catch(() => null);
  const url = user?.bannerURL({ size: 1024 });

  if (!url) return respond.fail(interaction, t('info.banner.none', { user: option.tag }));

  return respond.show(
    interaction,
    render.panel(t('info.banner.title', { user: option.username })).setImage(url).setFooter(option.id),
  );
}

const PERMISSION_HIGHLIGHTS = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'BanMembers', 'KickMembers', 'ModerateMembers', 'MentionEveryone'];

async function roleInfo(interaction, t) {
  const role = interaction.options.getRole('role', true);
  const notable = PERMISSION_HIGHLIGHTS.filter((name) => role.permissions.has(name));

  const panel = render
    .panel(role.name)
    .setAccent(role.color || undefined)
    .addField(t('info.member.id'), `\`${role.id}\``)
    .addField(t('info.role.members'), String(role.members.size))
    .addField(t('info.role.position'), String(role.position))
    .addField(t('info.role.colour'), role.hexColor)
    .addField(t('info.role.hoisted'), t(role.hoist ? 'common.on' : 'common.off'))
    .addField(t('info.role.mentionable'), t(role.mentionable ? 'common.on' : 'common.off'))
    .addField(t('info.server.created'), time(role.createdAt, TimestampStyles.LongDate))
    .addField(t('info.role.permissions'), notable.length ? notable.join(', ') : t('common.none'));

  return respond.show(interaction, panel);
}

const CHANNEL_KINDS = {
  [ChannelType.GuildText]: 'texte',
  [ChannelType.GuildVoice]: 'vocal',
  [ChannelType.GuildCategory]: 'categorie',
  [ChannelType.GuildAnnouncement]: 'annonces',
  [ChannelType.GuildForum]: 'forum',
  [ChannelType.GuildStageVoice]: 'conference',
};

async function channelInfo(interaction, t) {
  const channel = interaction.options.getChannel('salon') || interaction.channel;

  const panel = render
    .panel(`#${channel.name}`)
    .addField(t('info.member.id'), `\`${channel.id}\``)
    .addField(t('info.channel.kind'), CHANNEL_KINDS[channel.type] || String(channel.type))
    .addField(t('info.server.created'), time(channel.createdAt, TimestampStyles.LongDate))
    .addField(t('info.channel.category'), channel.parent ? channel.parent.name : t('common.none'));

  if (channel.topic) panel.addField(t('info.channel.topic'), truncate(channel.topic, 500));
  if (channel.rateLimitPerUser) panel.addField(t('info.channel.slowmode'), `${channel.rateLimitPerUser}s`);
  if (channel.nsfw) panel.addField(t('info.channel.nsfw'), t('common.on'));

  return respond.show(interaction, panel);
}

async function boosters(interaction, t) {
  const guild = interaction.guild;
  const list = guild.members.cache
    .filter((m) => m.premiumSince)
    .sort((a, b) => a.premiumSinceTimestamp - b.premiumSinceTimestamp);

  if (!list.size) return respond.fail(interaction, t('info.boosters.none'));

  const lines = [...list.values()]
    .slice(0, 25)
    .map((m) => `• <@${m.id}>\n↳ ${time(m.premiumSince, TimestampStyles.RelativeTime)}`);

  const panel = render
    .panel(t('info.boosters.title'))
    .setBody(lines.join('\n\n'))
    .setStats([
      { label: t('info.server.boosts'), value: String(guild.premiumSubscriptionCount || 0) },
      { label: t('info.boosters.count'), value: String(list.size) },
    ]);

  return respond.show(interaction, panel);
}

async function bot(interaction, t, locale) {
  // L'aller-retour se mesure entre l'horodatage que Discord a pose sur la
  // commande et celui de notre reponse.
  await respond.defer(interaction);
  const sent = await interaction.editReply({ content: '…' });

  const embed = render
    .info('', t('info.bot.title'))
    .addFields(
      {
        name: t('info.bot.roundTrip'),
        value: `${sent.createdTimestamp - interaction.createdTimestamp} ms`,
        inline: true,
      },
      // La latence de la passerelle vaut -1 tant que le premier heartbeat
      // n'est pas revenu, juste apres le demarrage.
      {
        name: t('info.bot.gateway'),
        value: interaction.client.ws.ping >= 0 ? `${Math.round(interaction.client.ws.ping)} ms` : '—',
        inline: true,
      },
      { name: t('info.bot.uptime'), value: duration.format(interaction.client.uptime, locale), inline: true },
      { name: t('info.bot.guilds'), value: String(interaction.client.guilds.cache.size), inline: true },
    );

  return interaction.editReply({ ...render.payload(embed), content: null });
}
