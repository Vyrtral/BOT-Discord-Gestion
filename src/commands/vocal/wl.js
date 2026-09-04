'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const voiceQueries = require('../../database/queries/voice');
const respond = require('../../core/respond');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.moderator,

  data: new SlashCommandBuilder()
    .setName('wl')
    .setDescription('Membres qui traversent l’anti-join')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('ajouter')
        .setDescription('Autorise un membre a rejoindre un salon verrouillé')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre a autoriser').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('retirer')
        .setDescription('Retire un membre de la liste')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('liste').setDescription('Membres autorisés'))
    .addSubcommand((sub) => sub.setName('vider').setDescription('Vide entièrement la liste')),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;

    switch (interaction.options.getSubcommand()) {
      case 'ajouter': {
        const user = interaction.options.getUser('membre', true);
        const added = voiceQueries.allow(guildId, user.id);
        if (!added) return respond.fail(interaction, t('wl.already', { user: user.tag }));
        return respond.ok(interaction, t('wl.added', { user: user.tag }));
      }
      case 'retirer': {
        const user = interaction.options.getUser('membre', true);
        const removed = voiceQueries.disallow(guildId, user.id);
        if (!removed) return respond.fail(interaction, t('wl.notThere', { user: user.tag }));
        return respond.ok(interaction, t('wl.removed', { user: user.tag }));
      }
      case 'vider': {
        const removed = voiceQueries.clearAllowed(guildId);
        return respond.ok(interaction, t('wl.cleared', { count: removed }));
      }
      default: {
        const list = voiceQueries.allowed(guildId);
        const text = list.length ? list.map((id) => `<@${id}>`).join(' ') : t('common.none');
        return respond.show(interaction, render.info(text, t('wl.title')), { ephemeral: true });
      }
    }
  },
};
