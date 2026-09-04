'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK, DISCORD } = require('../../constants');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');
const duration = require('../../lib/duration');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.ModerateMembers],

  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rend un membre muet pendant une durée donnée')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre a rendre muet').setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('duree')
        .setDescription('Par exemple 10m, 1h30, 2j. Maximum 28 jours')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Motif inscrit dans l’historique').setMaxLength(400),
    ),

  async run(interaction, { t, locale }) {
    const user = interaction.options.getUser('membre', true);
    const rawDuration = interaction.options.getString('duree', true);

    const durationMs = duration.parse(rawDuration);
    if (!durationMs) return respond.fail(interaction, t('errors.badDuration', { input: rawDuration }));

    // Le timeout Discord plafonne a 28 jours, ce n'est pas negociable cote API.
    if (durationMs > DISCORD.timeoutMaxMs) {
      return respond.fail(interaction, t('moderation.mute.tooLong'));
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return respond.fail(interaction, t('errors.memberNotFound'));

    const refusal = sanctions.check(interaction.member, member);
    if (refusal) return respond.fail(interaction, t(`errors.${refusal}`));

    await respond.defer(interaction);

    try {
      const result = await sanctions.mute({
        guild: interaction.guild,
        target: member,
        moderator: interaction.user,
        reason: interaction.options.getString('raison'),
        durationMs,
        locale,
      });
      const suffix = result.dmSent === false ? `\n${t('sanctions.dmClosed')}` : '';
      const text = t('moderation.mute.success', {
        user: user.tag,
        duration: duration.format(durationMs, locale),
      });
      return respond.ok(interaction, `${text}${suffix}`);
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};
