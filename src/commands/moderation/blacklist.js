'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const blacklistQueries = require('../../database/queries/blacklist');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const { truncate } = require('../../lib/format');

module.exports = {
  rank: RANK.admin,
  botPermissions: [PermissionFlagsBits.BanMembers],

  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Bannissement définitif, réappliqué même après un déban manuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('ajouter')
        .setDescription('Bannit et inscrit le compte sur la liste')
        .addUserOption((o) => o.setName('membre').setDescription('Le compte concerne').setRequired(true))
        .addStringOption((o) => o.setName('raison').setDescription('Motif').setMaxLength(400)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('retirer')
        .setDescription('Retire de la liste et débannit')
        .addStringOption((o) =>
          o.setName('identifiant').setDescription('Identifiant Discord du compte').setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('liste').setDescription('Comptes inscrits'))
    .addSubcommand((sub) => sub.setName('vider').setDescription('Vide la liste, sans débannir')),

  async run(interaction, { t, locale }) {
    const guildId = interaction.guild.id;

    switch (interaction.options.getSubcommand()) {
      case 'ajouter':
        return add(interaction, t, locale);
      case 'retirer':
        return remove(interaction, t, locale);
      case 'vider': {
        const removed = blacklistQueries.clear(guildId);
        return respond.ok(interaction, t('blacklist.cleared', { count: removed }));
      }
      default: {
        const rows = blacklistQueries.list(guildId);
        if (!rows.length) return respond.show(interaction, render.info(t('common.none'), t('blacklist.title')), { ephemeral: true });

        const text = rows
          .map((row) => `• <@${row.user_id}> \`${row.user_id}\`\n↳ ${truncate(row.reason || t('sanctions.noReason'), 80)}`)
          .join('\n\n');

        return respond.show(
          interaction,
          render.info(text, t('blacklist.title')).setFooter(t('blacklist.footer', { count: blacklistQueries.count(guildId) })),
          { ephemeral: true },
        );
      }
    }
  },
};

async function add(interaction, t, locale) {
  const user = interaction.options.getUser('membre', true);
  const reason = interaction.options.getString('raison');
  const guildId = interaction.guild.id;

  if (blacklistQueries.has(guildId, user.id)) {
    return respond.fail(interaction, t('blacklist.already', { user: user.tag }));
  }

  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (member) {
    const refusal = sanctions.check(interaction.member, member);
    if (refusal) return respond.fail(interaction, t(`errors.${refusal}`));
  }

  await respond.defer(interaction);

  try {
    await sanctions.ban({
      guild: interaction.guild,
      target: member,
      user,
      moderator: interaction.user,
      reason: reason || t('blacklist.defaultReason'),
      locale,
    });
  } catch (error) {
    return respond.fail(interaction, t('errors.discord', { message: error.message }));
  }

  blacklistQueries.add(guildId, user.id, interaction.user.id, reason);
  return respond.ok(interaction, t('blacklist.added', { user: user.tag }));
}

async function remove(interaction, t, locale) {
  const id = interaction.options.getString('identifiant', true).trim();
  if (!/^\d{17,20}$/.test(id)) return respond.fail(interaction, t('errors.badUserId'));

  const guildId = interaction.guild.id;
  const removed = blacklistQueries.remove(guildId, id);
  if (!removed) return respond.fail(interaction, t('blacklist.notThere'));

  await respond.defer(interaction);

  const ban = await interaction.guild.bans.fetch(id).catch(() => null);
  if (ban) {
    await sanctions
      .unban({ guild: interaction.guild, user: ban.user, moderator: interaction.user, locale })
      .catch(() => null);
  }

  return respond.ok(interaction, t('blacklist.removed', { user: ban ? ban.user.tag : id }));
}
