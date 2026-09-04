'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const ticketsQueries = require('../../database/queries/tickets');
const tickets = require('../../modules/tickets');
const respond = require('../../core/respond');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.admin,
  // Fermer un ticket doit rester a la portee de celui qui l'a ouvert ; le
  // controle fin (staff ou auteur) se fait ensuite dans la sous-commande.
  subcommandRanks: { fermer: RANK.member },
  botPermissions: [PermissionFlagsBits.ManageChannels],

  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Configuration du système de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('reglages')
        .setDescription('Catégorie, rôle staff et salon des transcripts')
        .addChannelOption((o) =>
          o
            .setName('categorie')
            .setDescription('Catégorie ou créer les tickets')
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addRoleOption((o) => o.setName('staff').setDescription('Rôle qui voit et gere les tickets'))
        .addChannelOption((o) =>
          o
            .setName('transcripts')
            .setDescription('Salon ou déposer les transcripts a la fermeture')
            .addChannelTypes(ChannelType.GuildText),
        )
        .addIntegerOption((o) =>
          o
            .setName('limite')
            .setDescription('Tickets ouverts simultanément par membre')
            .setMinValue(1)
            .setMaxValue(5),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('sujet')
        .setDescription('Gère les sujets proposés dans le panneau')
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
        .addStringOption((o) => o.setName('libelle').setDescription('Titre du sujet').setMaxLength(80))
        .addStringOption((o) => o.setName('description').setDescription('Ligne d’explication').setMaxLength(100))
        .addStringOption((o) => o.setName('emoji').setDescription('Emoji affiche a côté du sujet'))
        .addIntegerOption((o) => o.setName('numero').setDescription('Numéro du sujet a retirer')),
    )
    .addSubcommand((sub) =>
      sub.setName('fermer').setDescription('Ferme le ticket dans lequel la commande est tapée'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('panneau')
        .setDescription('Publie le panneau d’ouverture de ticket')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon ou publier, le salon actuel par défaut')
            .addChannelTypes(ChannelType.GuildText),
        ),
    ),

  async run(interaction, { t, locale }) {
    switch (interaction.options.getSubcommand()) {
      case 'reglages':
        return settings(interaction, t);
      case 'sujet':
        return topics(interaction, t);
      case 'fermer':
        return close(interaction, t);
      default:
        return panel(interaction, t, locale);
    }
  },
};

async function settings(interaction, t) {
  const changes = {};
  const category = interaction.options.getChannel('categorie');
  const staff = interaction.options.getRole('staff');
  const transcripts = interaction.options.getChannel('transcripts');
  const limit = interaction.options.getInteger('limite');

  if (category) changes.category_id = category.id;
  if (staff) changes.staff_role_id = staff.id;
  if (transcripts) changes.transcript_channel = transcripts.id;
  if (limit) changes.per_user_limit = limit;

  if (!Object.keys(changes).length) {
    const current = ticketsQueries.settings(interaction.guild.id);
    const embed = render.info('', t('tickets.settings.title')).addFields(
      {
        name: t('tickets.field.category'),
        value: current.category_id ? `<#${current.category_id}>` : t('common.none'),
        inline: true,
      },
      {
        name: t('tickets.field.staff'),
        value: current.staff_role_id ? `<@&${current.staff_role_id}>` : t('common.none'),
        inline: true,
      },
      {
        name: t('tickets.field.transcripts'),
        value: current.transcript_channel ? `<#${current.transcript_channel}>` : t('common.none'),
        inline: true,
      },
      { name: t('tickets.field.limit'), value: String(current.per_user_limit), inline: true },
    );
    return respond.show(interaction, embed, { ephemeral: true });
  }

  ticketsQueries.updateSettings(interaction.guild.id, changes);
  return respond.ok(interaction, t('tickets.settings.saved'), { ephemeral: true });
}

async function topics(interaction, t) {
  const guildId = interaction.guild.id;
  const operation = interaction.options.getString('operation', true);

  if (operation === 'list') {
    const list = ticketsQueries.topics(guildId);
    const text = list.length
      ? list.map((topic) => `\`#${topic.id}\` ${topic.emoji || ''} **${topic.label}**`).join('\n')
      : t('common.none');
    return respond.show(interaction, render.info(text, t('tickets.topics.title')), { ephemeral: true });
  }

  if (operation === 'add') {
    const label = interaction.options.getString('libelle');
    if (!label) return respond.fail(interaction, t('tickets.topics.missingLabel'));

    const id = ticketsQueries.addTopic(guildId, {
      label,
      description: interaction.options.getString('description'),
      emoji: interaction.options.getString('emoji'),
    });
    return respond.ok(interaction, t('tickets.topics.added', { label, id }), { ephemeral: true });
  }

  const number = interaction.options.getInteger('numero');
  if (!number) return respond.fail(interaction, t('tickets.topics.missingNumber'));

  const removed = ticketsQueries.removeTopic(guildId, number);
  if (!removed) return respond.fail(interaction, t('tickets.topics.notFound', { id: number }));
  return respond.ok(interaction, t('tickets.topics.removed', { id: number }), { ephemeral: true });
}

async function close(interaction, t) {
  const ticket = ticketsQueries.byChannel(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') return respond.fail(interaction, t('tickets.close.notATicket'));

  if (!tickets.canClose(interaction.member, ticket)) {
    return respond.fail(interaction, t('tickets.close.notAllowed'));
  }

  // Le transcript relit tout l'historique du salon : bien au-dela des trois
  // secondes sur un ticket un peu long.
  await respond.defer(interaction);
  await tickets.close(interaction.channel, interaction.user);
  await respond.ok(interaction, t('tickets.close.done'));

  setTimeout(() => {
    interaction.channel.delete('Ticket ferme').catch(() => null);
  }, 5000);
}

async function panel(interaction, t, locale) {
  const channel = interaction.options.getChannel('salon') || interaction.channel;
  const me = interaction.guild.members.me;

  if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
    return respond.fail(interaction, t('errors.cannotSendThere', { channel: `${channel}` }));
  }

  const payload = tickets.buildPanel(interaction.guild, locale);
  const message = await channel.send(payload).catch(() => null);
  if (!message) return respond.fail(interaction, t('tickets.panel.failed'));

  ticketsQueries.updateSettings(interaction.guild.id, {
    panel_channel_id: channel.id,
    panel_message_id: message.id,
  });

  return respond.ok(interaction, t('tickets.panel.published', { channel: `${channel}` }), { ephemeral: true });
}
