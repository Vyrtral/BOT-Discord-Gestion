'use strict';

const { Events, MessageFlags } = require('discord.js');
const access = require('../core/access');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const tickets = require('../modules/tickets');
const aide = require('../commands/info/aide');
const ticketsQueries = require('../database/queries/tickets');
const logger = require('../lib/logger');

module.exports = {
  name: Events.InteractionCreate,

  async run(client, interaction) {
    if (!interaction.inGuild()) return;

    const locale = locales.resolve(interaction.guildId);
    const t = (key, vars) => i18n.t(locale, key, vars);

    try {
      if (interaction.isAutocomplete()) return await autocomplete(client, interaction);
      if (interaction.isChatInputCommand()) return await command(client, interaction, { t, locale });
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        return await component(interaction, { t, locale });
      }
    } catch (error) {
      logger.error(`Interaction ${interaction.id} en echec`, error);
      await replyError(interaction, t('errors.unexpected'));
    }
  },
};

async function autocomplete(client, interaction) {
  const command = client.commands.get(interaction.commandName);
  if (!command?.autocomplete) return;
  await command.autocomplete(interaction).catch(() => null);
}

async function command(client, interaction, context) {
  const entry = client.commands.get(interaction.commandName);
  if (!entry) return;

  if (access.rankOf(interaction.member) < access.requiredRank(entry, interaction)) {
    return replyError(interaction, context.t('errors.rank'));
  }

  // Les permissions du bot sont verifiees avant d'executer : mieux vaut un
  // message clair qu'une erreur 50013 au milieu du traitement.
  const missing = (entry.botPermissions || []).filter(
    (permission) => !interaction.guild.members.me.permissions.has(permission),
  );
  if (missing.length) return replyError(interaction, context.t('errors.botMissingPermission'));

  await entry.run(interaction, { ...context, client });
}

async function component(interaction, { t, locale }) {
  const id = interaction.customId;

  // Selecteur de categorie du panneau d'aide. La reponse est calculee pour
  // celui qui clique, pas pour celui qui a tape la commande : le panneau
  // peut donc rester affiche sans exposer des commandes a quelqu'un qui n'y
  // a pas droit.
  if (id === aide.SELECT_ID) {
    const rank = access.rankOf(interaction.member);
    const panel = aide.categoryPanel(interaction.client, rank, interaction.values[0], locale);
    if (!panel) return replyError(interaction, t('errors.rank'));
    return interaction.reply(render.payload(panel, [], { ephemeral: true }));
  }

  if (!id.startsWith('ticket:')) return;

  if (id === tickets.ID.pick || id.startsWith(`${tickets.ID.pick}:`)) {
    const topicId = interaction.isStringSelectMenu()
      ? Number.parseInt(interaction.values[0], 10)
      : Number.parseInt(id.split(':')[2], 10) || null;
    return openTicket(interaction, topicId, t);
  }

  if (id === tickets.ID.open) return openTicket(interaction, null, t);
  if (id === tickets.ID.claim) return claimTicket(interaction, t);
  if (id === tickets.ID.close) return closeTicket(interaction, t);
}

async function openTicket(interaction, topicId, t) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const result = await tickets.create(interaction.guild, interaction.member, topicId);
  if (result.error) return interaction.editReply(render.payload(render.failure(t(`tickets.error.${result.error}`))));

  return interaction.editReply(render.payload(render.success(t('tickets.created', { channel: `${result.channel}` }))));
}

async function claimTicket(interaction, t) {
  const ticket = ticketsQueries.byChannel(interaction.channel.id);
  if (!ticket) return replyError(interaction, t('tickets.close.notATicket'));

  if (!tickets.isStaff(interaction.member)) return replyError(interaction, t('tickets.claim.notAllowed'));
  if (ticket.claimed_by) {
    return replyError(interaction, t('tickets.claim.already', { user: `<@${ticket.claimed_by}>` }));
  }

  ticketsQueries.claim(interaction.channel.id, interaction.user.id);
  return interaction.reply(render.payload(render.success(t('tickets.claim.done', { user: `<@${interaction.user.id}>` }))));
}

async function closeTicket(interaction, t) {
  const ticket = ticketsQueries.byChannel(interaction.channel.id);
  if (!ticket || ticket.status !== 'open') return replyError(interaction, t('tickets.close.notATicket'));

  if (!tickets.canClose(interaction.member, ticket)) {
    return replyError(interaction, t('tickets.close.notAllowed'));
  }

  await interaction.deferReply();
  await tickets.close(interaction.channel, interaction.user);
  await interaction.editReply(render.payload(render.success(t('tickets.close.done'))));

  // Cinq secondes laissent le temps de lire la confirmation avant que le
  // salon disparaisse.
  setTimeout(() => {
    interaction.channel.delete('Ticket ferme').catch(() => null);
  }, 5000);
}

function replyError(interaction, message) {
  const payload = render.payload(render.failure(message), [], { ephemeral: true });
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload).catch(() => null);
  }
  return interaction.reply(payload).catch(() => null);
}
