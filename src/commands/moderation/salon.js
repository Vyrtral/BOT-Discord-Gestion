'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK, DISCORD } = require('../../constants');
const respond = require('../../core/respond');
const duration = require('../../lib/duration');
const render = require('../../ui/render');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.ManageChannels],

  data: new SlashCommandBuilder()
    .setName('salon')
    .setDescription('Verrouillage et mode lent d’un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('verrouiller')
        .setDescription('Empêche ou réautorise @everyone a écrire')
        .addBooleanOption((o) =>
          o.setName('ferme').setDescription('Vrai pour verrouiller, faux pour rouvrir').setRequired(true),
        )
        .addChannelOption((o) => o.setName('salon').setDescription('Salon visé, le salon actuel par défaut'))
        .addStringOption((o) =>
          o.setName('raison').setDescription('Motif affiche dans le journal d’audit').setMaxLength(400),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('masquer')
        .setDescription('Cache ou réaffiche le salon a @everyone')
        .addBooleanOption((o) =>
          o.setName('cache').setDescription('Vrai pour masquer, faux pour réafficher').setRequired(true),
        )
        .addChannelOption((o) => o.setName('salon').setDescription('Salon visé, le salon actuel par défaut')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('renouveler')
        .setDescription('Clone le salon et supprime l’ancien : tout l’historique disparaît')
        .addChannelOption((o) => o.setName('salon').setDescription('Salon visé, le salon actuel par défaut')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('lent')
        .setDescription('Définit le délai entre deux messages')
        .addIntegerOption((o) =>
          o
            .setName('secondes')
            .setDescription('0 pour désactiver, 21600 au maximum')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(DISCORD.slowmodeMaxSeconds),
        )
        .addChannelOption((o) => o.setName('salon').setDescription('Salon visé, le salon actuel par défaut')),
    ),

  async run(interaction, { t, locale }) {
    const channel = interaction.options.getChannel('salon') || interaction.channel;

    switch (interaction.options.getSubcommand()) {
      case 'verrouiller':
        return lock(interaction, channel, t);
      case 'masquer':
        return hide(interaction, channel, t);
      case 'renouveler':
        return renew(interaction, channel, t);
      default:
        return slowmode(interaction, channel, t, locale);
    }
  },
};

async function lock(interaction, channel, t) {
  if (!channel.permissionOverwrites) return respond.fail(interaction, t('errors.textChannelOnly'));

  const locked = interaction.options.getBoolean('ferme', true);
  const reason = interaction.options.getString('raison') || t('moderation.salon.defaultReason');

  try {
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { SendMessages: locked ? false : null },
      { reason: `${interaction.user.tag} — ${reason}` },
    );
  } catch (error) {
    return respond.fail(interaction, t('errors.discord', { message: error.message }));
  }

  return respond.ok(
    interaction,
    t(locked ? 'moderation.salon.locked' : 'moderation.salon.unlocked', { channel: `${channel}` }),
  );
}

async function hide(interaction, channel, t) {
  if (!channel.permissionOverwrites) return respond.fail(interaction, t('errors.textChannelOnly'));

  const hidden = interaction.options.getBoolean('cache', true);

  try {
    await channel.permissionOverwrites.edit(
      interaction.guild.roles.everyone,
      { ViewChannel: hidden ? false : null },
      { reason: interaction.user.tag },
    );
  } catch (error) {
    return respond.fail(interaction, t('errors.discord', { message: error.message }));
  }

  // Masquer le salon ou l'on repond rend la reponse invisible : elle part en
  // ephemere pour rester lisible par celui qui a tape la commande.
  return respond.ok(
    interaction,
    t(hidden ? 'moderation.salon.hidden' : 'moderation.salon.shown', { channel: `${channel}` }),
    { ephemeral: hidden && channel.id === interaction.channelId },
  );
}

// Le clone garde nom, permissions, position et categorie ; seul l'historique
// disparait. C'est la seule facon de vider un salon de plus de 14 jours de
// messages, que la suppression groupee refuse.
async function renew(interaction, channel, t) {
  if (typeof channel.clone !== 'function') return respond.fail(interaction, t('errors.textChannelOnly'));

  // Renouveler le salon d'ou la commande est tapee detruit le salon auquel le
  // jeton d'interaction est rattache : plus aucune reponse n'est possible
  // ensuite. Ailleurs, il faut repondre, sinon Discord reste sur
  // « l'application reflechit » indefiniment.
  const surPlace = channel.id === interaction.channelId;

  await respond.defer(interaction, { ephemeral: true });

  let clone;
  try {
    clone = await channel.clone({ reason: `${interaction.user.tag} — renouvellement` });
    await clone.setPosition(channel.position).catch(() => null);
    await channel.delete(`${interaction.user.tag} — renouvellement`);
  } catch (error) {
    return respond.fail(interaction, t('errors.discord', { message: error.message }));
  }

  // La confirmation part dans le clone : c'est le seul endroit que tout le
  // monde verra, l'ancien salon n'existant plus.
  await clone
    .send(render.payload(render.success(t('moderation.salon.renewed', { user: `<@${interaction.user.id}>` }))))
    .catch(() => null);

  if (!surPlace) {
    return respond.ok(interaction, t('moderation.salon.renewedElsewhere', { channel: `${clone}` }));
  }
}

async function slowmode(interaction, channel, t, locale) {
  if (typeof channel.setRateLimitPerUser !== 'function') {
    return respond.fail(interaction, t('errors.textChannelOnly'));
  }

  const seconds = interaction.options.getInteger('secondes', true);

  try {
    await channel.setRateLimitPerUser(seconds, interaction.user.tag);
  } catch (error) {
    return respond.fail(interaction, t('errors.discord', { message: error.message }));
  }

  if (seconds === 0) {
    return respond.ok(interaction, t('moderation.salon.slowOff', { channel: `${channel}` }));
  }
  return respond.ok(
    interaction,
    t('moderation.salon.slowOn', {
      channel: `${channel}`,
      duration: duration.format(seconds * 1000, locale),
    }),
  );
}
