'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../../constants');
const sanctions = require('../../modules/sanctions');
const respond = require('../../core/respond');
const access = require('../../core/access');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.ModerateMembers],

  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Rend la parole a un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre a liberer').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Motif de la levée').setMaxLength(400),
    ),

  async run(interaction, { t, locale }) {
    const user = interaction.options.getUser('membre');
    if (!user) return unmuteAll(interaction, t, locale);

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return respond.fail(interaction, t('errors.memberNotFound'));

    if (!member.isCommunicationDisabled()) {
      return respond.fail(interaction, t('moderation.unmute.notMuted'));
    }
    if (!access.botCanActOn(interaction.guild, member)) {
      return respond.fail(interaction, t('errors.botHierarchy'));
    }

    await respond.defer(interaction);

    try {
      await sanctions.unmute({
        guild: interaction.guild,
        target: member,
        moderator: interaction.user,
        reason: interaction.options.getString('raison'),
        locale,
      });
      return respond.ok(interaction, t('moderation.unmute.success', { user: user.tag }));
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};

// Sans membre indiqué, on libère tout le serveur. Le cache suffit : un membre
// absent du cache n'est de toute façon pas en train d'être mute.
async function unmuteAll(interaction, t, locale) {
  await respond.defer(interaction);

  const mutes = interaction.guild.members.cache.filter((member) => member.communicationDisabledUntil);
  let liberes = 0;

  for (const member of mutes.values()) {
    if (!access.botCanActOn(interaction.guild, member)) continue;
    const done = await sanctions
      .unmute({ guild: interaction.guild, target: member, moderator: interaction.user, locale })
      .then(() => true)
      .catch(() => false);
    if (done) liberes += 1;
  }

  return respond.ok(interaction, t('moderation.unmute.allDone', { count: liberes }));
}
