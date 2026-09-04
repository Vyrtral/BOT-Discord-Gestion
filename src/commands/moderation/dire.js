'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const { ACCENT } = require('../../ui/theme');
const { stripMassMentions } = require('../../lib/format');

module.exports = {
  rank: RANK.admin,

  data: new SlashCommandBuilder()
    .setName('dire')
    .setDescription('Publie un message sous l’identite du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('texte')
        .setDescription('Un message simple, sans mise en forme')
        .addStringOption((o) => o.setName('message').setDescription('Le texte a publier').setRequired(true).setMaxLength(2000))
        .addChannelOption((o) =>
          o.setName('salon').setDescription('Salon de publication, le salon actuel par défaut').addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('panneau')
        .setDescription('Un message encadré, au style du bot')
        .addStringOption((o) => o.setName('contenu').setDescription('Le corps du message').setRequired(true).setMaxLength(2000))
        .addStringOption((o) => o.setName('titre').setDescription('Titre affiche en gros').setMaxLength(200))
        .addStringOption((o) => o.setName('pied').setDescription('Petite ligne en bas').setMaxLength(200))
        .addStringOption((o) => o.setName('image').setDescription('Lien d’une image a afficher'))
        .addChannelOption((o) =>
          o.setName('salon').setDescription('Salon de publication, le salon actuel par défaut').addChannelTypes(ChannelType.GuildText),
        ),
    ),

  async run(interaction, { t }) {
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const me = interaction.guild.members.me;

    if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
      return respond.fail(interaction, t('errors.cannotSendThere', { channel: `${channel}` }));
    }

    if (interaction.options.getSubcommand() === 'texte') {
      // Le texte part tel quel, mais @everyone et @here sont neutralises :
      // une commande de publication ne doit pas devenir un pont vers une
      // mention de masse pour qui n'a pas la permission.
      const message = stripMassMentions(interaction.options.getString('message', true));
      const sent = await channel.send({ content: message, allowedMentions: { parse: ['users', 'roles'] } }).catch(() => null);
      if (!sent) return respond.fail(interaction, t('dire.failed'));
      return respond.ok(interaction, t('dire.sent', { channel: `${channel}` }), { ephemeral: true });
    }

    const image = interaction.options.getString('image');
    if (image && !/^https:\/\/\S+$/i.test(image)) {
      return respond.fail(interaction, t('dire.badImage'));
    }

    const panel = render
      .panel(interaction.options.getString('titre'))
      .setAccent(ACCENT.base)
      .setBody(stripMassMentions(interaction.options.getString('contenu', true)))
      .setFooter(interaction.options.getString('pied'))
      .setImage(image);

    const sent = await channel.send(render.payload(panel, [], { allowedMentions: { parse: ['users', 'roles'] } })).catch(() => null);
    if (!sent) return respond.fail(interaction, t('dire.failed'));
    return respond.ok(interaction, t('dire.sent', { channel: `${channel}` }), { ephemeral: true });
  },
};
