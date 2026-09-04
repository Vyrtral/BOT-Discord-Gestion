'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { RANK } = require('../../constants');
const access = require('../../core/access');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const interdictions = require('../../database/queries/interdictions');

module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers],

  data: new SlashCommandBuilder()
    .setName('vocal')
    .setDescription('Modération des salons vocaux')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('deplacer')
        .setDescription('Déplace un membre dans un salon vocal')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre a déplacer').setRequired(true))
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon d’arrivee, le tien par défaut')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('deconnecter')
        .setDescription('Déconnecte un membre du vocal')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre a déconnecter').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('muet')
        .setDescription('Coupe le micro d’un membre en vocal')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('parler')
        .setDescription('Rend le micro a un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('interdire')
        .setDescription('Interdit le vocal à un membre : il est déconnecté dès qu’il rejoint')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerné').setRequired(true))
        .addStringOption((o) => o.setName('raison').setDescription('Motif').setMaxLength(400)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('autoriser')
        .setDescription('Rend l’accès au vocal à un membre')
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerné').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('interdits').setDescription('Membres interdits de vocal'))
    .addSubcommand((sub) =>
      sub
        .setName('rassembler')
        .setDescription('Amène tout un salon vocal dans le tien')
        .addChannelOption((o) =>
          o
            .setName('salon')
            .setDescription('Salon a vider')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice),
        ),
    ),

  async run(interaction, { t }) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'rassembler') return gather(interaction, t);
    if (sub === 'interdits') {
      const rows = interdictions.voiceBans(interaction.guild.id);
      const text = rows.length
        ? rows.map((row) => `• <@${row.user_id}>\n↳ ${row.reason || t('sanctions.noReason')}`).join('\n\n')
        : t('common.none');
      return respond.show(interaction, render.info(text, t('vocal.bannedTitle')), { ephemeral: true });
    }

    const user = interaction.options.getUser('membre', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return respond.fail(interaction, t('errors.memberNotFound'));

    if (!access.canActOn(interaction.member, member)) return respond.fail(interaction, t('errors.hierarchy'));

    if (sub === 'interdire') {
      interdictions.banVoice(interaction.guild.id, user.id, interaction.user.id, interaction.options.getString('raison'));
      await member.voice.disconnect('Interdiction de vocal').catch(() => null);
      return respond.ok(interaction, t('vocal.banned', { user: user.tag }));
    }
    if (sub === 'autoriser') {
      const removed = interdictions.unbanVoice(interaction.guild.id, user.id);
      if (!removed) return respond.fail(interaction, t('vocal.notBanned', { user: user.tag }));
      return respond.ok(interaction, t('vocal.unbanned', { user: user.tag }));
    }

    if (!member.voice.channel) return respond.fail(interaction, t('vocal.notConnected', { user: user.tag }));
    if (!access.botCanActOn(interaction.guild, member)) return respond.fail(interaction, t('errors.botHierarchy'));

    try {
      switch (sub) {
        case 'deplacer': {
          const target =
            interaction.options.getChannel('salon') || interaction.member.voice.channel;
          if (!target) return respond.fail(interaction, t('vocal.youAreNotConnected'));

          await member.voice.setChannel(target, interaction.user.tag);
          return respond.ok(interaction, t('vocal.moved', { user: user.tag, channel: `${target}` }));
        }
        case 'deconnecter':
          await member.voice.disconnect(interaction.user.tag);
          return respond.ok(interaction, t('vocal.disconnected', { user: user.tag }));

        case 'muet':
          await member.voice.setMute(true, interaction.user.tag);
          return respond.ok(interaction, t('vocal.muted', { user: user.tag }));

        default:
          await member.voice.setMute(false, interaction.user.tag);
          return respond.ok(interaction, t('vocal.unmuted', { user: user.tag }));
      }
    } catch (error) {
      return respond.fail(interaction, t('errors.discord', { message: error.message }));
    }
  },
};

async function gather(interaction, t) {
  const source = interaction.options.getChannel('salon', true);
  const target = interaction.member.voice.channel;
  if (!target) return respond.fail(interaction, t('vocal.youAreNotConnected'));
  if (source.id === target.id) return respond.fail(interaction, t('vocal.sameChannel'));

  await respond.defer(interaction);

  let moved = 0;
  for (const member of source.members.values()) {
    if (!access.botCanActOn(interaction.guild, member)) continue;
    const done = await member.voice.setChannel(target, interaction.user.tag).catch(() => null);
    if (done) moved += 1;
  }

  return respond.ok(interaction, t('vocal.gathered', { count: moved, channel: `${target}` }));
}
