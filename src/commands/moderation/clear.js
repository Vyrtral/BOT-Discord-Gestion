'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK, DISCORD } = require('../../constants');
const respond = require('../../core/respond');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.ManageMessages],

  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime des messages du salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option
        .setName('nombre')
        .setDescription('Nombre de messages a examiner (1 a 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(DISCORD.bulkDeleteMax),
    )
    .addUserOption((option) =>
      option.setName('membre').setDescription('Ne supprimer que les messages de ce membre'),
    ),

  async run(interaction, { t }) {
    const amount = interaction.options.getInteger('nombre', true);
    const target = interaction.options.getUser('membre');

    await respond.defer(interaction, { ephemeral: true });

    const fetched = await interaction.channel.messages.fetch({ limit: amount }).catch(() => null);
    if (!fetched) return respond.fail(interaction, t('errors.fetchMessages'));

    // Discord refuse de supprimer en masse les messages de plus de 14 jours.
    // On les ecarte ici pour ne pas se prendre une 50034 sur tout le lot.
    const cutoff = Date.now() - DISCORD.bulkDeleteMaxAgeMs;
    const deletable = fetched.filter(
      (message) =>
        message.createdTimestamp > cutoff &&
        !message.pinned &&
        (!target || message.author.id === target.id),
    );

    if (!deletable.size) return respond.fail(interaction, t('moderation.clear.nothing'));

    const deleted = await interaction.channel.bulkDelete(deletable, true).catch(() => null);
    if (!deleted) return respond.fail(interaction, t('moderation.clear.failed'));

    const skipped = fetched.size - deleted.size;
    const text = target
      ? t('moderation.clear.successUser', { count: deleted.size, user: target.tag })
      : t('moderation.clear.success', { count: deleted.size });

    return respond.ok(
      interaction,
      skipped > 0 ? `${text}\n${t('moderation.clear.skipped', { count: skipped })}` : text,
    );
  },
};
