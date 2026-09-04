'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const voiceQueries = require('../../database/queries/voice');
const respond = require('../../core/respond');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.MoveMembers],

  data: new SlashCommandBuilder()
    .setName('antijoin')
    .setDescription('Verrouille un salon vocal contre les entrées')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('verrouiller')
        .setDescription('Personne ne peut plus rejoindre ce salon')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon visé, le tien par défaut')
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('deverrouiller')
        .setDescription('Rouvre un salon vocal')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon visé, le tien par défaut')
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    )
    .addSubcommand((sub) => sub.setName('liste').setDescription('Salons vocaux verrouillés'))
    .addSubcommand((sub) => sub.setName('vider').setDescription('Déverrouille tous les salons vocaux')),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'liste') {
      const rows = voiceQueries.locked(guildId);
      const text = rows.length
        ? rows.map((row) => `<#${row.channel_id}> — <@${row.locked_by}>`).join('\n')
        : t('common.none');
      return respond.show(interaction, render.info(text, t('antijoin.title')), { ephemeral: true });
    }

    if (sub === 'vider') {
      const removed = voiceQueries.unlockAll(guildId);
      return respond.ok(interaction, t('antijoin.cleared', { count: removed }));
    }

    const channel = interaction.options.getChannel('salon') || interaction.member.voice.channel;
    if (!channel) return respond.fail(interaction, t('vocal.youAreNotConnected'));

    if (sub === 'verrouiller') {
      voiceQueries.lock(guildId, channel.id, interaction.user.id);
      return respond.ok(interaction, t('antijoin.locked', { channel: `${channel}` }));
    }

    const removed = voiceQueries.unlock(guildId, channel.id);
    if (!removed) return respond.fail(interaction, t('antijoin.notLocked', { channel: `${channel}` }));
    return respond.ok(interaction, t('antijoin.unlocked', { channel: `${channel}` }));
  },
};
