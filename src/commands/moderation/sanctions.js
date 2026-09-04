'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, time, TimestampStyles } = require('discord.js');
const { RANK } = require('../../constants');
const sanctionsQueries = require('../../database/queries/sanctions');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const duration = require('../../lib/duration');
const { truncate } = require('../../lib/format');

const ICONS = { warn: '!', mute: '⏳', kick: '↩', ban: '⛔' };

module.exports = {
  rank: RANK.moderator,

  data: new SlashCommandBuilder()
    .setName('sanctions')
    .setDescription('Historique des sanctions d’un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('voir')
        .setDescription('Affiche l’historique d’un membre')
        .addUserOption((option) =>
          option.setName('membre').setDescription('Le membre concerne').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('retirer')
        .setDescription('Retire une sanction de l’historique')
        .addIntegerOption((option) =>
          option
            .setName('numero')
            .setDescription('Numéro affiche dans l’historique')
            .setRequired(true)
            .setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('vider')
        .setDescription('Efface tout l’historique d’un membre')
        .addUserOption((option) =>
          option.setName('membre').setDescription('Le membre concerne').setRequired(true),
        ),
    ),

  async run(interaction, { t, locale }) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'voir') return show(interaction, t, locale);
    if (sub === 'retirer') return remove(interaction, t);
    return clear(interaction, t);
  },
};

async function show(interaction, t, locale) {
  const user = interaction.options.getUser('membre', true);
  const rows = sanctionsQueries.history(interaction.guild.id, user.id, 20);

  if (!rows.length) return respond.fail(interaction, t('moderation.sanctions.empty', { user: user.tag }));

  const lines = rows.map((row) => {
    const stamp = time(new Date(row.created_at), TimestampStyles.ShortDate);
    const length = row.duration_ms ? ` · ${duration.format(row.duration_ms, locale)}` : '';
    const lifted = row.active ? '' : ` · ${t('moderation.sanctions.lifted')}`;
    const reason = truncate(row.reason || t('sanctions.noReason'), 90);
    return `\`#${row.id}\` ${ICONS[row.type] || '•'} **${t(`sanctions.type.${row.type}`)}** ${stamp}${length}${lifted}\n${reason} — <@${row.moderator_id}>`;
  });

  const embed = render
    .info(lines.join('\n\n'), t('moderation.sanctions.title', { user: user.tag }))
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: t('moderation.sanctions.footer', { count: rows.length }) });

  return respond.show(interaction, embed, { ephemeral: true });
}

async function remove(interaction, t) {
  const id = interaction.options.getInteger('numero', true);
  const sanction = sanctionsQueries.byId(id);

  if (!sanction || sanction.guild_id !== interaction.guild.id) {
    return respond.fail(interaction, t('moderation.sanctions.notFound', { id }));
  }

  sanctionsQueries.lift(id, interaction.user.id);
  return respond.ok(interaction, t('moderation.sanctions.removed', { id }), { ephemeral: true });
}

async function clear(interaction, t) {
  const user = interaction.options.getUser('membre', true);
  const removed = sanctionsQueries.purgeUser(interaction.guild.id, user.id);

  if (!removed) return respond.fail(interaction, t('moderation.sanctions.empty', { user: user.tag }));
  return respond.ok(interaction, t('moderation.sanctions.cleared', { user: user.tag, count: removed }));
}
