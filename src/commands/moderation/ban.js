'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');
const duration = require('../../lib/duration');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.BanMembers],

  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre a bannir').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Motif inscrit dans l’historique').setMaxLength(400),
    )
    .addStringOption((option) =>
      option
        .setName('duree')
        .setDescription('Ban temporaire, par exemple 7j ou 12h. Vide = définitif'),
    )
    .addIntegerOption((option) =>
      option
        .setName('purge')
        .setDescription('Supprime les messages des N derniers jours')
        .setMinValue(0)
        .setMaxValue(7),
    ),

  async run(interaction, { t, locale }) {
    const user = interaction.options.getUser('membre', true);
    const reason = interaction.options.getString('raison');
    const rawDuration = interaction.options.getString('duree');
    const purge = interaction.options.getInteger('purge') ?? 0;

    let durationMs = null;
    if (rawDuration) {
      durationMs = duration.parse(rawDuration);
      if (!durationMs) return respond.fail(interaction, t('errors.badDuration', { input: rawDuration }));
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    // Bannir un id absent du serveur est parfaitement legitime : on saute les
    // controles de hierarchie, ils n'ont pas de sens sans membre.
    if (member) {
      const refusal = sanctions.check(interaction.member, member);
      if (refusal) return respond.fail(interaction, t(`errors.${refusal}`));
    } else {
      const existing = await interaction.guild.bans.fetch(user.id).catch(() => null);
      if (existing) return respond.fail(interaction, t('moderation.ban.already'));
    }

    await respond.defer(interaction);

    try {
      const result = await sanctions.ban({
        guild: interaction.guild,
        target: member,
        user,
        moderator: interaction.user,
        reason,
        durationMs,
        deleteDays: purge,
        locale,
      });

      const text = durationMs
        ? t('moderation.ban.successTemporary', {
            user: user.tag,
            duration: duration.format(durationMs, locale),
          })
        : t('moderation.ban.success', { user: user.tag });

      return respond.ok(interaction, `${text}${result.dmSent === false ? `\n${t('sanctions.dmClosed')}` : ''}`);
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};
