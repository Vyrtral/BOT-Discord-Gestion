'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');

module.exports = {
  rank: RANK.moderator,

  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertit un membre et enregistre l’avertissement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre a avertir').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Motif de l’avertissement').setMaxLength(400),
    ),

  async run(interaction, { t, locale }) {
    const user = interaction.options.getUser('membre', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return respond.fail(interaction, t('errors.memberNotFound'));

    const refusal = sanctions.check(interaction.member, member);
    if (refusal) return respond.fail(interaction, t(`errors.${refusal}`));

    await respond.defer(interaction);

    const result = await sanctions.warn({
      guild: interaction.guild,
      target: member,
      moderator: interaction.user,
      reason: interaction.options.getString('raison'),
      locale,
    });

    const suffix = result.dmSent === false ? `\n${t('sanctions.dmClosed')}` : '';
    return respond.ok(
      interaction,
      `${t('moderation.warn.success', { user: user.tag, total: result.total })}${suffix}`,
    );
  },
};
