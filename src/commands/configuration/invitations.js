'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, time, TimestampStyles } = require('discord.js');
const { RANK } = require('../../constants');
const invitesQueries = require('../../database/queries/invites');
const respond = require('../../core/respond');
const render = require('../../ui/render');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  rank: RANK.member,
  subcommandRanks: { bonus: RANK.admin, reinitialiser: RANK.admin },

  data: new SlashCommandBuilder()
    .setName('invitations')
    .setDescription('Suivi des invitations du serveur')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('voir')
        .setDescription('Invitations d’un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre a consulter, toi par défaut')),
    )
    .addSubcommand((sub) => sub.setName('classement').setDescription('Les dix meilleurs inviteurs'))
    .addSubcommand((sub) =>
      sub
        .setName('origine')
        .setDescription('Qui a invite un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reinitialiser')
        .setDescription('Remet les compteurs d’invitations à zéro')
        .addUserOption((o) => o.setName('membre').setDescription('Un membre précis. Vide : tout le serveur')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('bonus')
        .setDescription('Ajoute ou retire des invitations a un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('nombre').setDescription('Positif pour ajouter, négatif pour retirer').setRequired(true),
        ),
    ),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;

    switch (interaction.options.getSubcommand()) {
      case 'voir': {
        const user = interaction.options.getUser('membre') || interaction.user;
        const stats = invitesQueries.stats(guildId, user.id);

        const panel = render
          .panel(t('invites.card.title', { user: user.username }))
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .setStats([
            { label: t('invites.card.total'), value: String(stats.total) },
            { label: t('invites.card.joined'), value: String(stats.joined) },
            { label: t('invites.card.left'), value: String(stats.left) },
            { label: t('invites.card.bonus'), value: String(stats.bonus) },
          ]);

        return respond.show(interaction, panel);
      }

      case 'classement': {
        const rows = invitesQueries.leaderboard(guildId, 10);
        if (!rows.length) return respond.fail(interaction, t('invites.empty'));

        const lines = rows.map((row, index) => {
          const badge = index < 3 ? MEDALS[index] : `\`${String(index + 1).padStart(2, ' ')}\``;
          return `${badge} <@${row.user_id}> — **${row.total}** ${t('invites.unit')}`;
        });

        return respond.show(interaction, render.info(lines.join('\n'), t('invites.leaderboard')));
      }

      case 'origine': {
        const user = interaction.options.getUser('membre', true);
        const origin = invitesQueries.inviterOf(guildId, user.id);

        if (!origin?.inviter_id) return respond.fail(interaction, t('invites.unknownOrigin', { user: user.tag }));

        const panel = render
          .panel(t('invites.origin.title', { user: user.username }))
          .addField(t('invites.origin.by'), `<@${origin.inviter_id}>`)
          .addField(t('invites.origin.code'), origin.code ? `\`${origin.code}\`` : t('common.unknown'))
          .addField(t('invites.origin.when'), time(new Date(origin.joined_at), TimestampStyles.LongDateTime));

        return respond.show(interaction, panel, { ephemeral: true });
      }

      case 'reinitialiser': {
        const user = interaction.options.getUser('membre');
        const removed = invitesQueries.reset(guildId, user?.id);
        return respond.ok(
          interaction,
          user ? t('invites.resetUser', { user: user.tag }) : t('invites.resetAll', { count: removed }),
        );
      }

      default: {
        const user = interaction.options.getUser('membre', true);
        const amount = interaction.options.getInteger('nombre', true);

        invitesQueries.addBonus(guildId, user.id, amount);
        const stats = invitesQueries.stats(guildId, user.id);
        return respond.ok(interaction, t('invites.bonusDone', { user: user.tag, total: stats.total }));
      }
    }
  },
};
