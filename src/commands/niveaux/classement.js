'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { RANK } = require('../../constants');
const xpQueries = require('../../database/queries/xp');
const xp = require('../../modules/xp');
const respond = require('../../core/respond');
const render = require('../../ui/render');

const PAGE_SIZE = 10;
const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  rank: RANK.member,

  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('Classement des membres par expérience')
    .setDMPermission(false)
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Page a afficher').setMinValue(1).setMaxValue(50),
    ),

  async run(interaction, { t }) {
    const settings = xpQueries.settings(interaction.guild.id);
    if (!settings.enabled) return respond.fail(interaction, t('xp.disabled'));

    const page = interaction.options.getInteger('page') ?? 1;
    const rows = xpQueries.leaderboard(interaction.guild.id, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    if (!rows.length) return respond.fail(interaction, t('xp.emptyLeaderboard'));

    const lines = rows.map((row, index) => {
      const position = (page - 1) * PAGE_SIZE + index + 1;
      const badge = position <= 3 ? MEDALS[position - 1] : `\`${String(position).padStart(2, ' ')}\``;
      return `${badge} <@${row.user_id}> — ${t('xp.card.level')} ${xp.levelFromXp(row.xp)} · ${row.xp} xp`;
    });

    const total = xpQueries.participants(interaction.guild.id);
    const embed = render
      .info(lines.join('\n'), t('xp.leaderboard.title', { guild: interaction.guild.name }))
      .setFooter({ text: t('xp.leaderboard.footer', { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) }) });

    return respond.show(interaction, embed);
  },
};
