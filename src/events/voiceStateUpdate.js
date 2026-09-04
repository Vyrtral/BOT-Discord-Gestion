'use strict';

const { Events } = require('discord.js');
const logs = require('../modules/logs');
const counters = require('../modules/counters');
const tempVoice = require('../modules/tempvoice');
const voiceQueries = require('../database/queries/voice');
const interdictions = require('../database/queries/interdictions');
const access = require('../core/access');
const locales = require('../core/locale');
const i18n = require('../core/i18n');
const render = require('../ui/render');
const { ACCENT } = require('../ui/theme');

module.exports = {
  name: Events.VoiceStateUpdate,

  async run(client, before, after) {
    const member = after.member || before.member;
    if (!member || member.user.bot) return;

    const guild = after.guild || before.guild;
    const locale = locales.resolve(guild.id);

    // Interdiction de vocal : le membre est deconnecte des qu'il rejoint,
    // quel que soit le salon.
    if (after.channelId && interdictions.isVoiceBanned(guild.id, member.id)) {
      await member.voice.disconnect('Interdiction de vocal').catch(() => null);
      return;
    }

    // Anti-join : le salon est verrouille, on renvoie l'arrivant d'ou il
    // vient. Le staff et les membres autorises passent.
    if (after.channelId && after.channelId !== before.channelId) {
      if (
        voiceQueries.isLocked(guild.id, after.channelId) &&
        !voiceQueries.isAllowed(guild.id, member.id) &&
        access.rankOf(member) < 1
      ) {
        await member.voice.setChannel(before.channel || null, 'Anti-join').catch(() => null);
        return;
      }
    }

    // Salons vocaux temporaires : entree dans le hub, puis nettoyage du
    // salon quitte s'il etait temporaire et se retrouve vide.
    if (after.channel) await tempVoice.onJoin(member, after.channel);
    if (before.channel && before.channelId !== after.channelId) {
      await tempVoice.onLeave(guild, before.channel);
    }

    let key = null;
    let color = ACCENT.base;
    const vars = { member: `<@${member.id}>` };

    if (!before.channelId && after.channelId) {
      key = 'logs.voice.joined';
      color = ACCENT.success;
      vars.channel = `${after.channel}`;
    } else if (before.channelId && !after.channelId) {
      key = 'logs.voice.left';
      color = ACCENT.danger;
      vars.channel = `${before.channel}`;
    } else if (before.channelId !== after.channelId) {
      key = 'logs.voice.moved';
      vars.from = `${before.channel}`;
      vars.to = `${after.channel}`;
    }

    // Les changements de micro et de casque ne sont pas journalises : ils
    // representent l'essentiel du trafic vocal et noient le reste.
    if (!key) return;

    const embed = render
      .base(color)
      .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
      .setDescription(i18n.t(locale, key, vars))
      .setFooter({ text: `${member.id}` })
      .setTimestamp();

    await logs.send(guild, 'vocal', embed);

    if (before.channelId !== after.channelId) {
      await counters.refresh(guild);
    }
  },
};
