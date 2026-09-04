'use strict';

const { Events } = require('discord.js');
const invites = require('../modules/invites');
const invitesQueries = require('../database/queries/invites');

// L'instantane des codes doit suivre les creations et suppressions, sinon un
// code cree puis utilise passerait pour un code inconnu a l'arrivee suivante.
module.exports = [
  {
    name: Events.InviteCreate,
    async run(client, invite) {
      if (invite.guild) await invites.refresh(invite.guild);
    },
  },
  {
    name: Events.InviteDelete,
    async run(client, invite) {
      if (invite.guild) invitesQueries.forgetCode(invite.guild.id, invite.code);
    },
  },
];
