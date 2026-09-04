'use strict';

const { MessageFlags } = require('discord.js');
const render = require('../ui/render');

// Toutes les reponses du bot passent par ici : ca evite d'oublier le drapeau
// Components V2, le drapeau ephemere sur un message d'erreur, ou de planter
// quand l'interaction a deja recu une reponse.
function send(interaction, panels, { ephemeral = false, rows = [] } = {}) {
  // Le drapeau ephemere se pose a la premiere reponse ou au defer, il ne se
  // rejoue pas sur un editReply.
  if (interaction.deferred) return interaction.editReply(render.payload(panels, rows));

  const body = render.payload(panels, rows, { ephemeral });
  if (interaction.replied) return interaction.followUp(body);
  return interaction.reply(body);
}

const ok = (interaction, text, options) => send(interaction, render.success(text), options);

const fail = (interaction, text) =>
  send(interaction, render.failure(text), { ephemeral: true });

const warn = (interaction, text) =>
  send(interaction, render.caution(text), { ephemeral: true });

const show = (interaction, panel, options) => send(interaction, panel, options);

// A appeler des qu'une commande depasse les trois secondes accordees par
// Discord pour repondre.
const defer = (interaction, { ephemeral = false } = {}) =>
  interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});

module.exports = { send, ok, fail, warn, show, defer };
