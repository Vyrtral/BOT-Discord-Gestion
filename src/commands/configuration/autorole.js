'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK, DISCORD } = require('../../constants');
const autoRolesQueries = require('../../database/queries/autoroles');
const respond = require('../../core/respond');
const render = require('../../ui/render');

const MAX_ROLES = 10;

module.exports = {
  rank: RANK.admin,
  botPermissions: [PermissionFlagsBits.ManageRoles],

  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Rôles donnés automatiquement a l’arrivee')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('ajouter')
        .setDescription('Ajoute un rôle a donner a l’arrivee')
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle a donner').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('retirer')
        .setDescription('Retire un rôle de la liste')
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle concerne').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('liste').setDescription('Rôles configures')),

  async run(interaction, { t }) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'liste') {
      const list = autoRolesQueries.list(guildId);
      const text = list.length ? list.map((id) => `<@&${id}>`).join(' ') : t('common.none');
      return respond.show(interaction, render.info(text, t('autorole.title')), { ephemeral: true });
    }

    const role = interaction.options.getRole('role', true);

    if (sub === 'retirer') {
      const removed = autoRolesQueries.remove(guildId, role.id);
      if (!removed) return respond.fail(interaction, t('autorole.notThere', { role: role.name }));
      return respond.ok(interaction, t('autorole.removed', { role: role.name }), { ephemeral: true });
    }

    if (autoRolesQueries.list(guildId).length >= MAX_ROLES) {
      return respond.fail(interaction, t('autorole.tooMany', { max: MAX_ROLES }));
    }
    if (role.managed) return respond.fail(interaction, t('autorole.managed', { role: role.name }));

    const me = interaction.guild.members.me;
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return respond.fail(interaction, t('errors.roleTooHigh', { role: role.name }));
    }

    const added = autoRolesQueries.add(guildId, role.id);
    if (!added) return respond.fail(interaction, t('autorole.already', { role: role.name }));
    return respond.ok(interaction, t('autorole.added', { role: role.name }), { ephemeral: true });
  },
};
