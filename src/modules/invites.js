'use strict';

const { PermissionFlagsBits } = require('discord.js');
const invitesQueries = require('../database/queries/invites');
const logger = require('../lib/logger');

// Discord ne dit jamais quelle invitation a servi. La seule methode fiable :
// garder le compteur d'utilisations de chaque code, et regarder lequel a
// augmente a l'arrivee suivante.
async function fetchCodes(guild) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) return null;

  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return null;

  return [...invites.values()].map((invite) => ({
    code: invite.code,
    inviterId: invite.inviter?.id || null,
    uses: invite.uses || 0,
  }));
}

async function refresh(guild) {
  const codes = await fetchCodes(guild);
  if (!codes) return false;
  invitesQueries.snapshot(guild.id, codes);
  return true;
}

async function refreshAll(client) {
  for (const guild of client.guilds.cache.values()) {
    await refresh(guild).catch((error) => logger.error(`Invitations non lues sur ${guild.id}`, error));
  }
}

// Appelee a chaque arrivee : compare l'etat courant a l'etat memorise.
async function resolveInviter(member) {
  const guild = member.guild;
  const known = invitesQueries.knownUses(guild.id);
  const codes = await fetchCodes(guild);

  if (!codes) {
    invitesQueries.recordJoin(guild.id, member.id, null, null);
    return null;
  }

  const used = codes.find((code) => code.uses > (known.get(code.code)?.uses ?? 0));
  invitesQueries.snapshot(guild.id, codes);

  // Un code supprime juste apres usage, ou une invitation de type vanity, ne
  // laisse aucune trace exploitable : on enregistre l'arrivee sans inviteur.
  invitesQueries.recordJoin(guild.id, member.id, used?.inviterId || null, used?.code || null);
  return used?.inviterId || null;
}

function onLeave(guild, userId) {
  return invitesQueries.recordLeave(guild.id, userId);
}

module.exports = { refresh, refreshAll, resolveInviter, onLeave };
