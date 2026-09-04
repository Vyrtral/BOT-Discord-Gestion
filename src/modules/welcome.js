'use strict';

const { PermissionFlagsBits } = require('discord.js');
const welcomeQueries = require('../database/queries/welcome');
const autoRolesQueries = require('../database/queries/autoroles');
const render = require('../ui/render');
const { applyTemplate, stripMassMentions } = require('../lib/format');
const logger = require('../lib/logger');

const DEFAULT_MESSAGE = 'Bienvenue {membre} sur **{serveur}**, tu es le {membres}e membre.';
const DEFAULT_GOODBYE = '{pseudo} a quitte le serveur.';

async function greet(member) {
  const settings = welcomeQueries.get(member.guild.id);
  if (!settings.enabled) return;

  await giveAutoRoles(member, settings.auto_role_id);

  if (settings.dm_message) {
    const text = applyTemplate(settings.dm_message, { member, guild: member.guild });
    await member.send(render.payload(render.info(text))).catch(() => null);
  }

  if (!settings.channel_id) return;
  const channel = member.guild.channels.cache.get(settings.channel_id);
  if (!channel) return;

  const me = member.guild.members.me;
  if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return;

  const text = applyTemplate(settings.message || DEFAULT_MESSAGE, { member, guild: member.guild });

  // La mention part dans le contenu pour que le membre recoive une
  // notification ; l'embed seul ne ping pas.
  // Le nouveau membre doit recevoir sa notification : mention autorisee ici,
  // et seulement pour lui.
  await channel
    .send(render.payload(render.info(stripMassMentions(text)), [], { allowedMentions: { users: [member.id] } }))
    .catch(() => null);
}

async function farewell(member) {
  const settings = welcomeQueries.get(member.guild.id);
  if (!settings.goodbye_enabled || !settings.goodbye_channel) return;

  const channel = member.guild.channels.cache.get(settings.goodbye_channel);
  if (!channel) return;

  const me = member.guild.members.me;
  if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return;

  const text = applyTemplate(settings.goodbye_message || DEFAULT_GOODBYE, { member, guild: member.guild });
  await channel.send(render.payload(render.info(stripMassMentions(text)))).catch(() => null);
}

// Les roles viennent de /autorole, plus l'eventuel role unique herite de
// /bienvenue. Ceux que le bot ne peut pas donner sont ignores en silence :
// une arrivee ne doit pas echouer pour un role mal place.
async function giveAutoRoles(member, legacyRoleId) {
  const me = member.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return;

  const ids = new Set(autoRolesQueries.list(member.guild.id));
  if (legacyRoleId) ids.add(legacyRoleId);
  if (!ids.size) return;

  const roles = [...ids]
    .map((id) => member.guild.roles.cache.get(id))
    .filter((role) => role && !role.managed && me.roles.highest.comparePositionTo(role) > 0);

  if (!roles.length) return;

  try {
    await member.roles.add(roles, 'Roles automatiques a l’arrivee');
  } catch (error) {
    logger.error(`Roles automatiques non attribues a ${member.id}`, error);
  }
}

module.exports = { greet, farewell, DEFAULT_MESSAGE };
