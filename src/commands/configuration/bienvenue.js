'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const welcomeQueries = require('../../database/queries/welcome');
const welcome = require('../../modules/welcome');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const { applyTemplate } = require('../../lib/format');

module.exports = {
  rank: RANK.admin,

  data: new SlashCommandBuilder()
    .setName('bienvenue')
    .setDescription('Message d’arrivee et de départ')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('arrivee')
        .setDescription('Configure l’accueil des nouveaux membres')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe l’accueil'))
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon ou publier le message')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((o) =>
          o.setName('message').setDescription('Texte affiche, variables autorisées').setMaxLength(1000),
        )
        .addStringOption((o) =>
          o.setName('prive').setDescription('Message envoyé en privé au nouveau membre').setMaxLength(1000),
        )
        .addRoleOption((o) => o.setName('role').setDescription('Rôle donne automatiquement a l’arrivee')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('depart')
        .setDescription('Configure le message de départ')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe le message'))
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon ou publier le message')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((o) =>
          o.setName('message').setDescription('Texte affiche, variables autorisées').setMaxLength(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('apercu').setDescription('Affiche le rendu du message avec tes propres informations'),
    )
    .addSubcommand((sub) => sub.setName('variables').setDescription('Liste les variables utilisables')),

  async run(interaction, { t }) {
    switch (interaction.options.getSubcommand()) {
      case 'arrivee':
        return join(interaction, t);
      case 'depart':
        return leave(interaction, t);
      case 'apercu':
        return preview(interaction, t);
      default:
        return variables(interaction, t);
    }
  },
};

async function join(interaction, t) {
  const changes = {};
  const enabled = interaction.options.getBoolean('actif');
  const channel = interaction.options.getChannel('salon');
  const message = interaction.options.getString('message');
  const dm = interaction.options.getString('prive');
  const role = interaction.options.getRole('role');

  if (enabled !== null) changes.enabled = enabled;
  if (channel) changes.channel_id = channel.id;
  if (message) changes.message = message;
  if (dm) changes.dm_message = dm;

  if (role) {
    const me = interaction.guild.members.me;
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return respond.fail(interaction, t('errors.roleTooHigh', { role: role.name }));
    }
    changes.auto_role_id = role.id;
  }

  if (!Object.keys(changes).length) return show(interaction, t);

  welcomeQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('welcome.saved'), { ephemeral: true });
}

async function leave(interaction, t) {
  const changes = {};
  const enabled = interaction.options.getBoolean('actif');
  const channel = interaction.options.getChannel('salon');
  const message = interaction.options.getString('message');

  if (enabled !== null) changes.goodbye_enabled = enabled;
  if (channel) changes.goodbye_channel = channel.id;
  if (message) changes.goodbye_message = message;

  if (!Object.keys(changes).length) return show(interaction, t);

  welcomeQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('welcome.saved'), { ephemeral: true });
}

async function show(interaction, t) {
  const settings = welcomeQueries.get(interaction.guild.id);
  const embed = render.info('', t('welcome.title')).addFields(
    {
      name: t('welcome.field.join'),
      value: `${t(settings.enabled ? 'common.on' : 'common.off')} · ${settings.channel_id ? `<#${settings.channel_id}>` : t('common.none')}`,
      inline: true,
    },
    {
      name: t('welcome.field.leave'),
      value: `${t(settings.goodbye_enabled ? 'common.on' : 'common.off')} · ${settings.goodbye_channel ? `<#${settings.goodbye_channel}>` : t('common.none')}`,
      inline: true,
    },
    {
      name: t('welcome.field.autoRole'),
      value: settings.auto_role_id ? `<@&${settings.auto_role_id}>` : t('common.none'),
      inline: true,
    },
    { name: t('welcome.field.message'), value: settings.message || welcome.DEFAULT_MESSAGE },
  );
  return respond.show(interaction, embed, { ephemeral: true });
}

async function preview(interaction, t) {
  const settings = welcomeQueries.get(interaction.guild.id);
  const text = applyTemplate(settings.message || welcome.DEFAULT_MESSAGE, {
    member: interaction.member,
    guild: interaction.guild,
  });
  return respond.show(interaction, render.info(text, t('welcome.preview')), { ephemeral: true });
}

async function variables(interaction, t) {
  const lines = [
    '`{membre}` — ' + t('welcome.var.mention'),
    '`{pseudo}` — ' + t('welcome.var.username'),
    '`{tag}` — ' + t('welcome.var.tag'),
    '`{id}` — ' + t('welcome.var.id'),
    '`{serveur}` — ' + t('welcome.var.guild'),
    '`{membres}` — ' + t('welcome.var.memberCount'),
  ];
  return respond.show(interaction, render.info(lines.join('\n'), t('welcome.variables')), { ephemeral: true });
}
