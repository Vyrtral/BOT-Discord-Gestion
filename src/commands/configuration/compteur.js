'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const countersQueries = require('../../database/queries/counters');
const counters = require('../../modules/counters');
const respond = require('../../core/respond');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.admin,
  botPermissions: [PermissionFlagsBits.ManageChannels],

  data: new SlashCommandBuilder()
    .setName('compteur')
    .setDescription('Salons dont le nom affiche une statistique du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('creer')
        .setDescription('Crée un salon vocal servant de compteur')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Ce qui est compte')
            .setRequired(true)
            .addChoices(...counters.KINDS.map((value) => ({ name: value, value }))),
        )
        .addStringOption((o) =>
          o
            .setName('modele')
            .setDescription('Nom du salon, {valeur} sera remplace')
            .setMaxLength(90),
        )
        .addChannelOption((o) =>
          o
            .setName('categorie')
            .setDescription('Catégorie ou placer le salon')
            .addChannelTypes(ChannelType.GuildCategory),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('lier')
        .setDescription('Transforme un salon existant en compteur')
        .addChannelOption((o) => o.setName('salon').setDescription('Le salon a utiliser').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Ce qui est compte')
            .setRequired(true)
            .addChoices(...counters.KINDS.map((value) => ({ name: value, value }))),
        )
        .addStringOption((o) =>
          o.setName('modele').setDescription('Nom du salon, {valeur} sera remplace').setMaxLength(90),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('retirer')
        .setDescription('Le salon cesse d’etre un compteur, il n’est pas supprime')
        .addChannelOption((o) => o.setName('salon').setDescription('Le salon concerne').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('liste').setDescription('Compteurs configures')),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'liste') {
      const rows = countersQueries.list(guildId);
      const text = rows.length
        ? rows.map((row) => `<#${row.channel_id}> — \`${row.kind}\` · \`${row.template}\``).join('\n')
        : t('common.none');
      return respond.show(interaction, render.info(text, t('counters.title')), { ephemeral: true });
    }

    if (sub === 'retirer') {
      const channel = interaction.options.getChannel('salon', true);
      const removed = countersQueries.remove(guildId, channel.id);
      if (!removed) return respond.fail(interaction, t('counters.notACounter'));
      return respond.ok(interaction, t('counters.removed', { channel: `${channel}` }), { ephemeral: true });
    }

    const kind = interaction.options.getString('type', true);
    const template = interaction.options.getString('modele') || defaultTemplate(kind, t);

    if (!template.includes('{valeur}')) {
      return respond.fail(interaction, t('counters.templateNeedsValue'));
    }

    if (sub === 'lier') {
      const channel = interaction.options.getChannel('salon', true);
      countersQueries.set(guildId, channel.id, kind, template);
      await counters.refresh(interaction.guild);
      return respond.ok(interaction, t('counters.linked', { channel: `${channel}` }), { ephemeral: true });
    }

    await respond.defer(interaction, { ephemeral: true });

    // Le salon est cree verrouille : un compteur n'a pas vocation a etre
    // rejoint, seulement lu dans la liste des salons.
    const created = await interaction.guild.channels
      .create({
        name: template.replace('{valeur}', counters.valueFor(interaction.guild, kind)),
        type: ChannelType.GuildVoice,
        parent: interaction.options.getChannel('categorie')?.id || null,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] },
        ],
      })
      .catch(() => null);

    if (!created) return respond.fail(interaction, t('counters.createFailed'));

    countersQueries.set(guildId, created.id, kind, template);
    return respond.ok(interaction, t('counters.created', { channel: `${created}` }));
  },
};

function defaultTemplate(kind, t) {
  return `${t(`counters.kind.${kind}`)} : {valeur}`;
}
