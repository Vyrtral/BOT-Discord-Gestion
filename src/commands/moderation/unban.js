'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.BanMembers],

  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Lève le bannissement d’un compte')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addStringOption((option) =>
      option.setName('identifiant').setDescription('Identifiant Discord du compte banni').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Motif de la levée').setMaxLength(400),
    ),

  async run(interaction, { t, locale }) {
    const id = interaction.options.getString('identifiant', true).trim();
    const reason = interaction.options.getString('raison');

    if (!/^\d{17,20}$/.test(id)) return respond.fail(interaction, t('errors.badUserId'));

    const ban = await interaction.guild.bans.fetch(id).catch(() => null);
    if (!ban) return respond.fail(interaction, t('moderation.unban.notBanned'));

    await respond.defer(interaction);

    try {
      await sanctions.unban({
        guild: interaction.guild,
        user: ban.user,
        moderator: interaction.user,
        reason,
        locale,
      });
      return respond.ok(interaction, t('moderation.unban.success', { user: ban.user.tag }));
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};
