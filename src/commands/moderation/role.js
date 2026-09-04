'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const access = require('../../core/access');
const respond = require('../../core/respond');
const interdictions = require('../../database/queries/interdictions');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.ManageRoles],

  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Rôles et surnom d’un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('ajouter')
        .setDescription('Donne un rôle a un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle a donner').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('retirer')
        .setDescription('Retire un rôle a un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle a retirer').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('interdire')
        .setDescription('Interdit un rôle à un membre : il lui est retiré dès qu’on le lui donne')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerné').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle interdit').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autoriser')
        .setDescription('Lève l’interdiction d’un rôle')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerné').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle concerné').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('surnom')
        .setDescription('Change le surnom d’un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true))
        .addStringOption((o) =>
          o.setName('surnom').setDescription('Nouveau surnom. Vide = retire le surnom').setMaxLength(32),
        ),
    ),

  async run(interaction, { t }) {
    const user = interaction.options.getUser('membre', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return respond.fail(interaction, t('errors.memberNotFound'));

    if (!access.canActOn(interaction.member, member)) return respond.fail(interaction, t('errors.hierarchy'));
    if (!access.botCanActOn(interaction.guild, member)) return respond.fail(interaction, t('errors.botHierarchy'));

    const sub = interaction.options.getSubcommand();

    if (sub === 'surnom') {
      const nickname = interaction.options.getString('surnom');
      try {
        await member.setNickname(nickname || null, interaction.user.tag);
      } catch (error) {
        return respond.fail(interaction, t('errors.discord', { message: error.message }));
      }
      return respond.ok(
        interaction,
        nickname
          ? t('role.nicknameSet', { user: user.tag, nickname })
          : t('role.nicknameCleared', { user: user.tag }),
      );
    }

    const role = interaction.options.getRole('role', true);

    if (sub === 'interdire') {
      interdictions.banRole(interaction.guild.id, user.id, role.id, interaction.user.id);
      if (member.roles.cache.has(role.id)) await member.roles.remove(role, 'Rôle interdit').catch(() => null);
      return respond.ok(interaction, t('role.forbidden', { role: role.name, user: user.tag }));
    }
    if (sub === 'autoriser') {
      const removed = interdictions.unbanRole(interaction.guild.id, user.id, role.id);
      if (!removed) return respond.fail(interaction, t('role.notForbidden', { role: role.name, user: user.tag }));
      return respond.ok(interaction, t('role.allowed', { role: role.name, user: user.tag }));
    }

    const me = interaction.guild.members.me;

    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return respond.fail(interaction, t('errors.roleTooHigh', { role: role.name }));
    }
    // Un moderateur ne doit pas pouvoir distribuer un role place au-dessus du
    // sien : ce serait une escalade de privileges deguisee.
    if (interaction.member.roles.highest.comparePositionTo(role) <= 0 && access.rankOf(interaction.member) < RANK.system) {
      return respond.fail(interaction, t('role.aboveYou', { role: role.name }));
    }

    try {
      if (sub === 'ajouter') {
        if (member.roles.cache.has(role.id)) return respond.fail(interaction, t('role.alreadyHas', { user: user.tag, role: role.name }));
        await member.roles.add(role, interaction.user.tag);
        return respond.ok(interaction, t('role.added', { role: role.name, user: user.tag }));
      }

      if (!member.roles.cache.has(role.id)) return respond.fail(interaction, t('role.doesNotHave', { user: user.tag, role: role.name }));
      await member.roles.remove(role, interaction.user.tag);
      return respond.ok(interaction, t('role.removed', { role: role.name, user: user.tag }));
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};
