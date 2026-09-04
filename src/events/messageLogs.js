'use strict';

const { Events } = require('discord.js');
const logs = require('../modules/logs');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const { ACCENT } = require('../ui/theme');
const { truncate } = require('../lib/format');
const ticketsQueries = require('../database/queries/tickets');
const snipes = require('../modules/snipes');

// Les trois evenements de messages partagent le meme salon de logs et les
// memes filtres : ils tiennent dans un seul fichier.
module.exports = [
  {
    name: Events.MessageDelete,
    async run(client, message) {
      if (!eligible(message)) return;

      snipes.remember(message.channel.id, 'deleted', {
        authorTag: message.author.tag,
        authorId: message.author.id,
        content: message.content,
        attachments: message.attachments.map((a) => a.url),
      });

      const locale = locales.resolve(message.guild.id);
      const embed = render
        .base(ACCENT.danger)
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(
          i18n.t(locale, 'logs.message.deleted', { channel: `${message.channel}` }),
        )
        .setFooter({ text: `${message.author.id}` })
        .setTimestamp();

      if (message.content) {
        embed.addFields({ name: i18n.t(locale, 'logs.message.content'), value: truncate(message.content, 1000) });
      }
      if (message.attachments.size) {
        embed.addFields({
          name: i18n.t(locale, 'logs.message.attachments'),
          value: message.attachments.map((a) => a.name).join(', '),
        });
      }

      await logs.send(message.guild, 'messages', embed);
    },
  },
  {
    name: Events.MessageUpdate,
    async run(client, before, after) {
      if (!eligible(after)) return;
      if (before.content === after.content) return;

      snipes.remember(after.channel.id, 'edited', {
        authorTag: after.author.tag,
        authorId: after.author.id,
        before: before.content,
        after: after.content,
      });

      const locale = locales.resolve(after.guild.id);
      const embed = render
        .base(ACCENT.warning)
        .setAuthor({ name: after.author.tag, iconURL: after.author.displayAvatarURL() })
        .setDescription(
          i18n.t(locale, 'logs.message.edited', { channel: `${after.channel}`, url: after.url }),
        )
        .addFields(
          { name: i18n.t(locale, 'logs.message.before'), value: truncate(before.content || '—', 1000) },
          { name: i18n.t(locale, 'logs.message.after'), value: truncate(after.content || '—', 1000) },
        )
        .setFooter({ text: `${after.author.id}` })
        .setTimestamp();

      await logs.send(after.guild, 'messages', embed);
    },
  },
  {
    name: Events.MessageBulkDelete,
    async run(client, messages) {
      const first = messages.first();
      if (!first?.guild) return;

      const locale = locales.resolve(first.guild.id);
      const embed = render
        .base(ACCENT.danger)
        .setDescription(
          i18n.t(locale, 'logs.message.bulkDeleted', {
            count: messages.size,
            channel: `${first.channel}`,
          }),
        )
        .setTimestamp();

      await logs.send(first.guild, 'messages', embed);
    },
  },
];

// Un message non mis en cache arrive sans auteur ni contenu : il n'y a rien
// a journaliser. Les tickets sont ignores, leur contenu part deja dans le
// transcript.
function eligible(message) {
  if (!message?.guild || message.partial) return false;
  if (!message.author || message.author.bot) return false;
  return !ticketsQueries.byChannel(message.channel.id);
}
