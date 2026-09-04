'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK, LOG_CATEGORIES } = require('../../constants');
const logsQueries = require('../../database/queries/logs');
const respond = require('../../core/respond');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.admin,

  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Salons de journalisation')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Envoie une catégorie de logs dans un salon')
        .addStringOption((o) =>
          o
            .setName('categorie')
            .setDescription('Type d’evenements')
            .setRequired(true)
            .addChoices(...LOG_CATEGORIES.map((value) => ({ name: value, value }))),
        )
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon de destination')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('couper')
        .setDescription('Arrête une catégorie de logs')
        .addStringOption((o) =>
          o
            .setName('categorie')
            .setDescription('Type d’evenements')
            .setRequired(true)
            .addChoices(...LOG_CATEGORIES.map((value) => ({ name: value, value }))),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('tout')
        .setDescription('Envoie toutes les catégories dans le même salon')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon de destination')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) => sub.setName('etat').setDescription('Récapitulatif de la configuration')),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'etat') {
      const configured = new Map(logsQueries.all(guildId).map((row) => [row.category, row.channel_id]));
      const lines = LOG_CATEGORIES.map((category) => {
        const channelId = configured.get(category);
        return `**${category}** — ${channelId ? `<#${channelId}>` : t('common.off')}`;
      });
      return respond.show(interaction, render.info(lines.join('\n'), t('logs.title')), { ephemeral: true });
    }

    if (sub === 'couper') {
      const category = interaction.options.getString('categorie', true);
      const removed = logsQueries.unset(guildId, category);
      if (!removed) return respond.fail(interaction, t('logs.notConfigured', { category }));
      return respond.ok(interaction, t('logs.disabled', { category }), { ephemeral: true });
    }

    const channel = interaction.options.getChannel('salon', true);
    const me = interaction.guild.members.me;

    if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
      return respond.fail(interaction, t('errors.cannotSendThere', { channel: `${channel}` }));
    }

    if (sub === 'tout') {
      for (const category of LOG_CATEGORIES) logsQueries.set(guildId, category, channel.id);
      return respond.ok(interaction, t('logs.allSet', { channel: `${channel}` }), { ephemeral: true });
    }

    const category = interaction.options.getString('categorie', true);
    logsQueries.set(guildId, category, channel.id);
    return respond.ok(interaction, t('logs.set', { category, channel: `${channel}` }), { ephemeral: true });
  },
};
