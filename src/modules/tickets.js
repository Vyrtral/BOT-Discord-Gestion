'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');
const ticketsQueries = require('../database/queries/tickets');
const access = require('../core/access');
const i18n = require('../core/i18n');
const locales = require('../core/locale');
const render = require('../ui/render');
const { DISCORD, RANK } = require('../constants');
const logger = require('../lib/logger');

const ID = {
  open: 'ticket:open',
  pick: 'ticket:pick',
  claim: 'ticket:claim',
  close: 'ticket:close',
  confirm: 'ticket:confirm',
};

// Le panneau prend la forme d'un bouton quand il n'y a qu'un sujet, et d'un
// menu deroulant des qu'il y en a plusieurs.
function buildPanel(guild, locale) {
  const topics = ticketsQueries.topics(guild.id);

  const embed = render
    .info(i18n.t(locale, 'tickets.panel.description'), i18n.t(locale, 'tickets.panel.title'))
    .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined });

  if (topics.length <= 1) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(topics.length ? `${ID.pick}:${topics[0].id}` : ID.open)
        .setLabel(topics.length ? topics[0].label : i18n.t(locale, 'tickets.panel.button'))
        .setEmoji(topics.length && topics[0].emoji ? topics[0].emoji : '📩')
        .setStyle(ButtonStyle.Primary),
    );
    return render.payload(embed, [row]);
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ID.pick)
    .setPlaceholder(i18n.t(locale, 'tickets.panel.placeholder'))
    .addOptions(
      topics.slice(0, DISCORD.selectOptionsMax).map((topic) => ({
        label: topic.label,
        value: String(topic.id),
        description: topic.description || undefined,
        emoji: topic.emoji || undefined,
      })),
    );

  return render.payload(embed, [new ActionRowBuilder().addComponents(menu)]);
}

function controlRow(locale) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ID.claim)
      .setLabel(i18n.t(locale, 'tickets.button.claim'))
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(ID.close)
      .setLabel(i18n.t(locale, 'tickets.button.close'))
      .setStyle(ButtonStyle.Danger),
  );
}

// Renvoie un code d'erreur plutot qu'un message : la commande appelante sait
// dans quelle langue repondre.
async function create(guild, member, topicId) {
  const settings = ticketsQueries.settings(guild.id);
  const locale = locales.resolve(guild.id);

  if (ticketsQueries.openCount(guild.id, member.id) >= settings.per_user_limit) {
    return { error: 'limit' };
  }

  const me = guild.members.me;
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) return { error: 'permission' };

  const topic = topicId ? ticketsQueries.topicById(topicId) : null;
  const number = ticketsQueries.nextNumber(guild.id);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (settings.staff_role_id && guild.roles.cache.has(settings.staff_role_id)) {
    overwrites.push({
      id: settings.staff_role_id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  let channel;
  try {
    channel = await guild.channels.create({
      name: `ticket-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: settings.category_id || null,
      permissionOverwrites: overwrites,
      topic: `${member.user.tag} · ${topic ? topic.label : i18n.t(locale, 'tickets.noTopic')}`,
    });
  } catch (error) {
    logger.error(`Creation du ticket impossible sur ${guild.id}`, error);
    return { error: 'creation' };
  }

  ticketsQueries.open({ guildId: guild.id, channelId: channel.id, userId: member.id, topicId, number });

  const intro = render
    .info(
      i18n.t(locale, 'tickets.opened.description', { member: `<@${member.id}>` }),
      i18n.t(locale, 'tickets.opened.title', { number }),
    )
    .addFields({
      name: i18n.t(locale, 'tickets.field.topic'),
      value: topic ? topic.label : i18n.t(locale, 'tickets.noTopic'),
    });

  const mention = settings.staff_role_id ? `<@&${settings.staff_role_id}>` : '';
  // Le membre et le staff doivent etre notifies : c'est le seul endroit ou
  // l'on autorise volontairement les mentions a sonner.
  await channel
    .send(
      render.payload(intro, [controlRow(locale)], {
        allowedMentions: { users: [member.id], roles: settings.staff_role_id ? [settings.staff_role_id] : [] },
      }),
    )
    .catch(() => null);

  return { channel, number };
}

// Le transcript est un fichier texte : lisible partout, sans dependance, et
// il tient dans la limite de 8 Mo meme sur un ticket tres long.
async function transcript(channel) {
  const collected = [];
  let before;

  for (let page = 0; page < 10; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || !batch.size) break;
    collected.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  const lines = collected
    .reverse()
    .map((message) => {
      const stamp = new Date(message.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19);
      const attachments = message.attachments.map((a) => a.url).join(' ');
      const content = [message.content, attachments].filter(Boolean).join(' ');
      return `[${stamp}] ${message.author.tag}: ${content}`;
    });

  const header = `Transcript de #${channel.name}\nGenere le ${new Date().toISOString()}\n${'-'.repeat(60)}\n`;
  return new AttachmentBuilder(Buffer.from(header + lines.join('\n'), 'utf8'), {
    name: `${channel.name}.txt`,
  });
}

async function close(channel, closedBy) {
  const ticket = ticketsQueries.byChannel(channel.id);
  if (!ticket) return { error: 'notATicket' };

  const settings = ticketsQueries.settings(channel.guild.id);
  const locale = locales.resolve(channel.guild.id);

  if (settings.transcript_channel) {
    const target = channel.guild.channels.cache.get(settings.transcript_channel);
    if (target) {
      const file = await transcript(channel);
      const summary = render
        .neutral(i18n.t(locale, 'tickets.transcript.title', { number: ticket.number }))
        .addFields(
          { name: i18n.t(locale, 'tickets.field.author'), value: `<@${ticket.user_id}>`, inline: true },
          { name: i18n.t(locale, 'tickets.field.closedBy'), value: `<@${closedBy.id}>`, inline: true },
        )
        .setTimestamp();
      await target.send({ ...render.payload(summary), files: [file] }).catch(() => null);
    }
  }

  ticketsQueries.close(channel.id);
  return { ticket };
}

// Le staff d'un ticket, c'est le role configure ou n'importe quel moderateur.
function isStaff(member) {
  const settings = ticketsQueries.settings(member.guild.id);
  if (settings.staff_role_id && member.roles.cache.has(settings.staff_role_id)) return true;
  return access.rankOf(member) >= RANK.moderator;
}

// Prendre un ticket en charge est reserve au staff ; le fermer est aussi
// permis a celui qui l'a ouvert.
function canClose(member, ticket) {
  return isStaff(member) || ticket.user_id === member.id;
}

module.exports = { ID, buildPanel, create, close, isStaff, canClose };
