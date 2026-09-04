'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const tempVoiceQueries = require('../../database/queries/tempvoice');
const respond = require('../../core/respond');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.admin,
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],

  data: new SlashCommandBuilder()
    .setName('vocalperso')
    .setDescription('Salons vocaux temporaires : entrer dans un salon en créé un privé')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('activer')
        .setDescription('Désigne le salon d’entree')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon vocal ou entrer déclenche la création')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice),
        )
        .addChannelOption((o) =>
          o
            .setName('categorie')
            .setDescription('Catégorie ou créer les salons, celle du salon d’entree par défaut')
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addStringOption((o) =>
          o.setName('modele').setDescription('Nom du salon créé, {pseudo} sera remplace').setMaxLength(90),
        )
        .addIntegerOption((o) =>
          o.setName('places').setDescription('Nombre de places, 0 pour illimité').setMinValue(0).setMaxValue(99),
        ),
    )
    .addSubcommand((sub) => sub.setName('desactiver').setDescription('Arrête le système'))
    .addSubcommand((sub) => sub.setName('etat').setDescription('Configuration actuelle')),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;

    switch (interaction.options.getSubcommand()) {
      case 'activer': {
        const hub = interaction.options.getChannel('salon', true);
        const template = interaction.options.getString('modele') || 'Vocal de {pseudo}';

        if (!template.includes('{pseudo}')) {
          return respond.fail(interaction, t('vocalperso.templateNeedsName'));
        }

        tempVoiceQueries.setHub(guildId, {
          hubId: hub.id,
          categoryId: interaction.options.getChannel('categorie')?.id || hub.parentId,
          template,
          userLimit: interaction.options.getInteger('places') ?? 0,
        });

        return respond.ok(interaction, t('vocalperso.enabled', { channel: `${hub}` }));
      }

      case 'desactiver': {
        const removed = tempVoiceQueries.removeHub(guildId);
        if (!removed) return respond.fail(interaction, t('vocalperso.notConfigured'));
        return respond.ok(interaction, t('vocalperso.disabled'));
      }

      default: {
        const hub = tempVoiceQueries.hub(guildId);
        if (!hub) return respond.fail(interaction, t('vocalperso.notConfigured'));

        const panel = render
          .panel(t('vocalperso.title'))
          .addField(t('vocalperso.field.hub'), `<#${hub.hub_id}>`)
          .addField(t('vocalperso.field.category'), hub.category_id ? `<#${hub.category_id}>` : t('common.none'))
          .addField(t('vocalperso.field.template'), `\`${hub.template}\``)
          .addField(t('vocalperso.field.limit'), hub.user_limit ? String(hub.user_limit) : t('vocalperso.unlimited'))
          .setFooter(t('vocalperso.open', { count: tempVoiceQueries.rooms(guildId).length }));

        return respond.show(interaction, panel, { ephemeral: true });
      }
    }
  },
};
