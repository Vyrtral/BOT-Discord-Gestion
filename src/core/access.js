'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { RANK } = require('../constants');
const staffQueries = require('../database/queries/staff');
const config = require('./config');

// Permissions Discord acceptees comme equivalent d'un rang, pour qu'un
// serveur fraichement invite soit utilisable avant d'avoir configure le
// moindre role staff.
const NATIVE_ADMIN = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild];
const NATIVE_MODERATOR = [
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageMessages,
];

function isOwner(userId) {
  return Boolean(config.sysId) && userId === config.sysId;
}

// Le rang effectif d'un membre : le meilleur de ce que lui donnent config.js,
// la propriete du serveur, ses roles staff et ses permissions Discord.
function rankOf(member) {
  if (isOwner(member.id)) return RANK.system;
  if (member.guild.ownerId === member.id) return RANK.admin;

  let best = staffQueries.rankOf(member.guild.id, [...member.roles.cache.keys()]);

  if (best < RANK.admin && NATIVE_ADMIN.some((flag) => member.permissions.has(flag))) {
    best = RANK.admin;
  }
  if (best < RANK.moderator && NATIVE_MODERATOR.some((flag) => member.permissions.has(flag))) {
    best = RANK.moderator;
  }
  return best;
}

// Empeche un moderateur de sanctionner quelqu'un d'au moins aussi gradue que
// lui. Le proprietaire du serveur reste intouchable dans tous les cas.
function canActOn(actor, target) {
  if (target.id === target.guild.ownerId) return false;
  if (actor.id === actor.guild.ownerId) return true;
  if (isOwner(actor.id)) return true;
  if (actor.id === target.id) return false;

  if (rankOf(target) >= rankOf(actor)) return false;
  return actor.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

// Le bot ne peut agir que sur un membre situe sous son propre role le plus
// haut. Sans ce controle, Discord renvoie une 50013 peu parlante.
function botCanActOn(guild, target) {
  const me = guild.members.me;
  if (!me) return false;
  if (target.id === guild.ownerId) return false;
  return me.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

// Une commande annonce un rang, et peut en abaisser certains pour une
// sous-commande precise : /ticket est reserve aux administrateurs, mais
// /ticket fermer doit rester ouvert a celui qui a ouvert le ticket.
function requiredRank(command, interaction) {
  const base = command.rank ?? RANK.member;
  if (!command.subcommandRanks) return base;

  const subcommand = interaction.options.getSubcommand(false);
  return subcommand && subcommand in command.subcommandRanks
    ? command.subcommandRanks[subcommand]
    : base;
}

// Le rang le plus bas qu'une commande accepte, quelle que soit la
// sous-commande. C'est ce qui decide si elle apparait dans /aide.
function lowestRank(command) {
  return Math.min(command.rank ?? RANK.member, ...Object.values(command.subcommandRanks || {}));
}

module.exports = { rankOf, canActOn, botCanActOn, requiredRank, lowestRank };
