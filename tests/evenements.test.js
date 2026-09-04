'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const { Events, Collection } = require('discord.js');

const db = require('../src/database');
const i18n = require('../src/core/i18n');
const securityQueries = require('../src/database/queries/security');
const protectionsQueries = require('../src/database/queries/protections');
const voiceQueries = require('../src/database/queries/voice');
const { fauxServeur, fauxMembre } = require('./aides/faux-discord');

const DB_FILE = `/tmp/gestion-evenements-${process.pid}.db`;

i18n.load();
db.open(DB_FILE);

// Chargement direct : le loader attache les handlers a un client, ici on veut
// les fonctions elles-memes pour les appeler avec nos propres arguments.
function handlers() {
  const dir = path.join(__dirname, '..', 'src', 'events');
  const found = new Map();

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js')) continue;
    const exported = require(path.join(dir, file));
    for (const handler of Array.isArray(exported) ? exported : [exported]) {
      if (!handler?.name || typeof handler.run !== 'function') continue;
      if (!found.has(handler.name)) found.set(handler.name, []);
      found.get(handler.name).push({ file, run: handler.run });
    }
  }
  return found;
}

const EVENTS = handlers();

function fauxClient(monde) {
  return {
    user: monde.guild.members.me.user,
    guilds: { cache: new Collection([[monde.guild.id, monde.guild]]), fetch: async () => monde.guild },
    users: { fetch: async () => monde.cible.user },
  };
}

function fauxMessage(monde, { content = 'bonjour', author = monde.cible } = {}) {
  return {
    id: '950000000000000001',
    content,
    guild: monde.guild,
    guildId: monde.guild.id,
    channel: monde.texte,
    channelId: monde.texte.id,
    author: author.user,
    member: author,
    system: false,
    partial: false,
    inGuild: () => true,
    pinned: false,
    createdTimestamp: Date.now(),
    url: 'https://discord.com/x',
    attachments: new Collection(),
    mentions: { users: new Collection(), roles: new Collection(), everyone: false, repliedUser: null },
    reference: null,
    delete: async () => {},
  };
}

async function lancer(nom, ...args) {
  const liste = EVENTS.get(nom) || [];
  assert.ok(liste.length, `aucun handler pour ${nom}`);
  for (const { file, run } of liste) {
    await run(...args).catch((error) => {
      throw new Error(`${file} sur ${nom} : ${error.message}`);
    });
  }
}

test('tous les evenements attendus sont branches', () => {
  const attendus = [
    Events.ClientReady, Events.InteractionCreate, Events.MessageCreate,
    Events.GuildMemberAdd, Events.GuildMemberRemove, Events.GuildCreate,
    Events.MessageDelete, Events.MessageUpdate, Events.MessageBulkDelete,
    Events.ChannelCreate, Events.ChannelDelete, Events.GuildRoleCreate,
    Events.GuildRoleDelete, Events.GuildBanAdd, Events.GuildBanRemove,
    Events.GuildMemberUpdate, Events.VoiceStateUpdate, Events.WebhooksUpdate,
    Events.InviteCreate, Events.InviteDelete,
  ];
  const manquants = attendus.filter((nom) => !EVENTS.has(nom));
  assert.deepStrictEqual(manquants, []);
});

test('un message ordinaire traverse toutes les protections sans planter', async () => {
  const monde = fauxServeur();
  await lancer(Events.MessageCreate, fauxClient(monde), fauxMessage(monde));
});

test('toutes protections actives, un message declencheur ne fait pas planter', async () => {
  const monde = fauxServeur();

  securityQueries.update(monde.guild.id, {
    spam_enabled: true, links_enabled: true, words_enabled: true,
    mentions_enabled: true, mentions_max: 1, pings_enabled: true,
  });
  securityQueries.addWord(monde.guild.id, 'interdit');
  protectionsQueries.protect(monde.guild.id, monde.auteur.id, monde.auteur.id);

  const message = fauxMessage(monde, { content: 'mot interdit https://exemple.invalid @tout' });
  message.mentions.users.set(monde.auteur.id, monde.auteur.user);

  // Plusieurs messages d'affilee pour franchir le seuil de l'antispam.
  for (let i = 0; i < 8; i += 1) {
    await lancer(Events.MessageCreate, fauxClient(monde), fauxMessage(monde, { content: 'spam' }));
  }
  await lancer(Events.MessageCreate, fauxClient(monde), message);
});

test('une arrivee de membre passe accueil, antiraid et invitations', async () => {
  const monde = fauxServeur();
  securityQueries.update(monde.guild.id, { raid_enabled: true, raid_account_age_ms: 0 });
  await lancer(Events.GuildMemberAdd, fauxClient(monde), monde.cible);
});

test('une arrivee de bot passe par l’anti-bot', async () => {
  const monde = fauxServeur();
  securityQueries.update(monde.guild.id, { bots_enabled: true });

  const bot = fauxMembre('550000000000000000', 'Intrus#0000', { bot: true, guild: monde.guild });
  await lancer(Events.GuildMemberAdd, fauxClient(monde), bot);
});

test('un depart de membre decompte l’invitation sans planter', async () => {
  const monde = fauxServeur();
  await lancer(Events.GuildMemberRemove, fauxClient(monde), monde.cible);
});

test('l’anti-join renvoie un arrivant sur un salon verrouille', async () => {
  const monde = fauxServeur();
  voiceQueries.lock(monde.guild.id, monde.vocal.id, monde.auteur.id);

  let renvoye = false;
  const membre = monde.cible;
  membre.voice.setChannel = async () => {
    renvoye = true;
  };

  const avant = { channelId: null, channel: null, guild: monde.guild, member: membre };
  const apres = { channelId: monde.vocal.id, channel: monde.vocal, guild: monde.guild, member: membre };

  await lancer(Events.VoiceStateUpdate, fauxClient(monde), avant, apres);
  assert.ok(renvoye, 'le membre aurait du etre renvoye hors du salon verrouille');
});

test('un membre whiteliste traverse l’anti-join', async () => {
  const monde = fauxServeur();
  voiceQueries.lock(monde.guild.id, monde.vocal.id, monde.auteur.id);
  voiceQueries.allow(monde.guild.id, monde.cible.id);

  let renvoye = false;
  monde.cible.voice.setChannel = async () => {
    renvoye = true;
  };

  const avant = { channelId: null, channel: null, guild: monde.guild, member: monde.cible };
  const apres = { channelId: monde.vocal.id, channel: monde.vocal, guild: monde.guild, member: monde.cible };

  await lancer(Events.VoiceStateUpdate, fauxClient(monde), avant, apres);
  assert.strictEqual(renvoye, false);
});

test('les evenements de journalisation ne plantent pas sans salon configure', async () => {
  const monde = fauxServeur();
  const client = fauxClient(monde);
  const message = fauxMessage(monde);

  await lancer(Events.MessageDelete, client, message);
  await lancer(Events.MessageUpdate, client, message, fauxMessage(monde, { content: 'autre' }));
  await lancer(Events.MessageBulkDelete, client, new Collection([[message.id, message]]));
  await lancer(Events.ChannelCreate, client, monde.texte);
  await lancer(Events.ChannelDelete, client, monde.texte);
  await lancer(Events.GuildRoleCreate, client, monde.bas);
  await lancer(Events.GuildRoleDelete, client, monde.bas);
  await lancer(Events.GuildMemberUpdate, client, monde.cible, monde.cible);
  await lancer(Events.GuildBanAdd, client, { guild: monde.guild, user: monde.cible.user });
  await lancer(Events.GuildBanRemove, client, { guild: monde.guild, user: monde.cible.user });
  await lancer(Events.WebhooksUpdate, client, monde.texte);
  await lancer(Events.GuildCreate, client, monde.guild);
});

test.after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_FILE}${suffix}`, { force: true });
});
