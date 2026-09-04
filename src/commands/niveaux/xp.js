'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const xpQueries = require('../../database/queries/xp');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const duration = require('../../lib/duration');

module.exports = {
  rank: RANK.admin,

  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Réglages du système de niveaux')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('reglages')
        .setDescription('Active le système et règle les gains')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe les niveaux'))
        .addIntegerOption((o) =>
          o.setName('message').setDescription('Xp gagnée par message').setMinValue(0).setMaxValue(100),
        )
        .addIntegerOption((o) =>
          o.setName('vocal').setDescription('Xp gagnée par minute en vocal').setMinValue(0).setMaxValue(100),
        )
        .addIntegerOption((o) =>
          o.setName('delai').setDescription('Délai entre deux gains, en secondes').setMinValue(0).setMaxValue(600),
        )
        .addStringOption((o) =>
          o
            .setName('annonce')
            .setDescription('Ou annoncer les montées de niveau')
            .addChoices(
              { name: 'salon dedie', value: 'channel' },
              { name: 'message prive', value: 'dm' },
              { name: 'nulle part', value: 'off' },
            ),
        )
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon des annonces de niveau')
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('recompense')
        .setDescription('Associe un rôle a un niveau')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'definir', value: 'set' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addIntegerOption((o) =>
          o.setName('niveau').setDescription('Niveau a atteindre').setMinValue(1).setMaxValue(500),
        )
        .addRoleOption((o) => o.setName('role').setDescription('Rôle a donner')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('ignorer')
        .setDescription('Salons ou aucune xp n’est gagnée')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'ajouter', value: 'add' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addChannelOption((o) => o.setName('salon').setDescription('Le salon concerne')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Fixe l’expérience d’un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('valeur').setDescription('Nouvelle valeur d’xp').setRequired(true).setMinValue(0),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reinitialiser')
        .setDescription('Remet l’expérience a zero')
        .addUserOption((o) =>
          o.setName('membre').setDescription('Un membre précis. Vide = tout le serveur'),
        ),
    ),

  async run(interaction, { t, locale }) {
    switch (interaction.options.getSubcommand()) {
      case 'reglages':
        return settings(interaction, t, locale);
      case 'recompense':
        return rewards(interaction, t);
      case 'ignorer':
        return ignored(interaction, t);
      case 'definir':
        return setValue(interaction, t);
      default:
        return reset(interaction, t);
    }
  },
};

async function settings(interaction, t, locale) {
  const guildId = interaction.guild.id;
  const changes = {};

  const enabled = interaction.options.getBoolean('actif');
  const message = interaction.options.getInteger('message');
  const voice = interaction.options.getInteger('vocal');
  const delay = interaction.options.getInteger('delai');
  const announce = interaction.options.getString('annonce');
  const channel = interaction.options.getChannel('salon');

  if (enabled !== null) changes.enabled = enabled;
  if (message !== null) changes.message_xp = message;
  if (voice !== null) changes.voice_xp = voice;
  if (delay !== null) changes.cooldown_ms = delay * 1000;
  if (announce) changes.announce_mode = announce;
  if (channel) changes.announce_channel = channel.id;

  if (!Object.keys(changes).length) {
    const current = xpQueries.settings(guildId);
    const embed = render.info('', t('xp.settings.title')).addFields(
      { name: t('common.state'), value: t(current.enabled ? 'common.on' : 'common.off'), inline: true },
      { name: t('xp.settings.perMessage'), value: String(current.message_xp), inline: true },
      { name: t('xp.settings.perVoiceMinute'), value: String(current.voice_xp), inline: true },
      { name: t('xp.settings.cooldown'), value: duration.format(current.cooldown_ms, locale), inline: true },
      { name: t('xp.settings.announce'), value: current.announce_mode, inline: true },
      {
        name: t('xp.settings.channel'),
        value: current.announce_channel ? `<#${current.announce_channel}>` : t('common.none'),
        inline: true,
      },
    );
    return respond.show(interaction, embed, { ephemeral: true });
  }

  xpQueries.updateSettings(guildId, changes);
  return respond.ok(interaction, t('xp.settings.saved'), { ephemeral: true });
}

async function rewards(interaction, t) {
  const guildId = interaction.guild.id;
  const operation = interaction.options.getString('operation', true);

  if (operation === 'list') {
    const list = xpQueries.rewards(guildId);
    const text = list.length
      ? list.map((row) => `${t('xp.card.level')} **${row.level}** ${'→'} <@&${row.role_id}>`).join('\n')
      : t('common.none');
    return respond.show(interaction, render.info(text, t('xp.rewards.title')), { ephemeral: true });
  }

  const level = interaction.options.getInteger('niveau');
  if (!level) return respond.fail(interaction, t('xp.rewards.missingLevel'));

  if (operation === 'remove') {
    const removed = xpQueries.removeReward(guildId, level);
    if (!removed) return respond.fail(interaction, t('xp.rewards.notFound', { level }));
    return respond.ok(interaction, t('xp.rewards.removed', { level }), { ephemeral: true });
  }

  const role = interaction.options.getRole('role');
  if (!role) return respond.fail(interaction, t('xp.rewards.missingRole'));

  // Un role au-dessus de celui du bot ne pourra jamais etre attribue :
  // autant le dire tout de suite plutot qu'a la premiere montee de niveau.
  const me = interaction.guild.members.me;
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return respond.fail(interaction, t('errors.roleTooHigh', { role: role.name }));
  }

  xpQueries.setReward(guildId, level, role.id);
  return respond.ok(interaction, t('xp.rewards.set', { level, role: role.name }), { ephemeral: true });
}

async function ignored(interaction, t) {
  const guildId = interaction.guild.id;
  const operation = interaction.options.getString('operation', true);
  const current = xpQueries.settings(guildId).ignored_channels;

  if (operation === 'list') {
    const text = current.length ? current.map((id) => `<#${id}>`).join(' ') : t('common.none');
    return respond.show(interaction, render.info(text, t('xp.ignored.title')), { ephemeral: true });
  }

  const channel = interaction.options.getChannel('salon');
  if (!channel) return respond.fail(interaction, t('xp.ignored.missingChannel'));

  const list = new Set(current);
  if (operation === 'add') list.add(channel.id);
  else list.delete(channel.id);

  xpQueries.updateSettings(guildId, { ignored_channels: [...list] });
  return respond.ok(interaction, t('xp.settings.saved'), { ephemeral: true });
}

async function setValue(interaction, t) {
  const user = interaction.options.getUser('membre', true);
  const value = interaction.options.getInteger('valeur', true);

  if (user.bot) return respond.fail(interaction, t('xp.botsExcluded'));

  xpQueries.setXp(interaction.guild.id, user.id, value);
  return respond.ok(interaction, t('xp.setDone', { user: user.tag, value }), { ephemeral: true });
}

async function reset(interaction, t) {
  const user = interaction.options.getUser('membre');

  if (user) {
    const removed = xpQueries.reset(interaction.guild.id, user.id);
    if (!removed) return respond.fail(interaction, t('xp.noData', { user: user.tag }));
    return respond.ok(interaction, t('xp.resetUser', { user: user.tag }), { ephemeral: true });
  }

  const removed = xpQueries.reset(interaction.guild.id);
  return respond.ok(interaction, t('xp.resetAll', { count: removed }), { ephemeral: true });
}
