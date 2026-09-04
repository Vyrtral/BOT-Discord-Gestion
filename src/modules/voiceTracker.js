'use strict';

const { ChannelType } = require('discord.js');
const xp = require('./xp');

// L'xp vocale est distribuee par un minuteur plutot qu'a la deconnexion :
// un membre qui reste connecte des heures gagne son xp au fil du temps, et un
// redemarrage du bot ne fait pas tout perdre.
function isEligible(member) {
  if (member.user.bot) return false;

  const state = member.voice;
  if (!state.channel || state.channel.type !== ChannelType.GuildVoice) return false;
  if (state.channel.id === member.guild.afkChannelId) return false;
  if (state.selfDeaf || state.deaf) return false;

  // Seul dans un salon, on ne parle a personne.
  const humans = state.channel.members.filter((m) => !m.user.bot && !m.voice.selfDeaf);
  return humans.size >= 2;
}

async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      const member = state.member;
      if (!member || !isEligible(member)) continue;
      await xp.addVoiceMinute(member);
    }
  }
}

module.exports = { tick };
