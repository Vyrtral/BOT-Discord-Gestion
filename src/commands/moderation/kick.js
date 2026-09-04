'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.KickMembers],

  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre a expulser').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Motif inscrit dans l’historique').setMaxLength(400),
    ),

  async run(interaction, { t, locale }) {
    const user = interaction.options.getUser('membre', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return respond.fail(interaction, t('errors.memberNotFound'));

    const refusal = sanctions.check(interaction.member, member);
    if (refusal) return respond.fail(interaction, t(`errors.${refusal}`));

    await respond.defer(interaction);

    try {
      const result = await sanctions.kick({
        guild: interaction.guild,
        target: member,
        moderator: interaction.user,
        reason: interaction.options.getString('raison'),
        locale,
      });
      const suffix = result.dmSent === false ? `\n${t('sanctions.dmClosed')}` : '';
      return respond.ok(interaction, `${t('moderation.kick.success', { user: user.tag })}${suffix}`);
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};
