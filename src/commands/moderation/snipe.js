'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, time, TimestampStyles } = require('discord.js');
const { RANK } = require('../../constants');
const snipes = require('../../modules/snipes');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const { truncate } = require('../../lib/format');

module.exports = {
  rank: RANK.moderator,

  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Affiche le dernier message supprime ou modifié du salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Supprime par défaut')
        .addChoices({ name: 'supprime', value: 'deleted' }, { name: 'modifie', value: 'edited' }),
    ),

  async run(interaction, { t }) {
    const kind = interaction.options.getString('type') || 'deleted';
    const entry = snipes.last(interaction.channel.id, kind);

    if (!entry) return respond.fail(interaction, t('snipe.nothing'));

    const panel = render
      .panel(t(`snipe.title.${kind}`))
      .setAuthor({ name: entry.authorTag })
      .setFooter(`${entry.authorId}`)
      .addField(t('snipe.field.at'), time(new Date(entry.at), TimestampStyles.RelativeTime));

    if (kind === 'edited') {
      panel
        .addField(t('logs.message.before'), truncate(entry.before || '—', 900))
        .addField(t('logs.message.after'), truncate(entry.after || '—', 900));
    } else {
      panel.setBody(truncate(entry.content || t('snipe.noContent'), 1500));
      if (entry.attachments.length) {
        panel.addField(t('logs.message.attachments'), entry.attachments.join('\n'));
      }
    }

    return respond.show(interaction, panel, { ephemeral: true });
  },
};
