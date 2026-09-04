'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { RANK } = require('../../constants');
const xpQueries = require('../../database/queries/xp');
const xp = require('../../modules/xp');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const duration = require('../../lib/duration');

module.exports = {
  rank: RANK.member,

  data: new SlashCommandBuilder()
    .setName('niveau')
    .setDescription('Affiche le niveau et l’expérience d’un membre')
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre a consulter, toi par défaut'),
    ),

  async run(interaction, { t, locale }) {
    const settings = xpQueries.settings(interaction.guild.id);
    if (!settings.enabled) return respond.fail(interaction, t('xp.disabled'));

    const user = interaction.options.getUser('membre') || interaction.user;
    if (user.bot) return respond.fail(interaction, t('xp.botsExcluded'));

    const record = xpQueries.user(interaction.guild.id, user.id);
    if (!record.xp) return respond.fail(interaction, t('xp.noData', { user: user.tag }));

    const state = xp.progress(record.xp);
    const position = xpQueries.rank(interaction.guild.id, user.id);
    const total = xpQueries.participants(interaction.guild.id);

    const embed = render
      .info(
        `${xp.progressBar(state.ratio)}  ${state.current} / ${state.needed}`,
        t('xp.card.title', { user: user.username }),
      )
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: t('xp.card.level'), value: String(state.level), inline: true },
        { name: t('xp.card.total'), value: String(record.xp), inline: true },
        { name: t('xp.card.rank'), value: `${position} / ${total}`, inline: true },
        { name: t('xp.card.messages'), value: String(record.messages), inline: true },
        {
          name: t('xp.card.voice'),
          value: record.voice_seconds ? duration.format(record.voice_seconds * 1000, locale) : '—',
          inline: true,
        },
      );

    return respond.show(interaction, embed);
  },
};
