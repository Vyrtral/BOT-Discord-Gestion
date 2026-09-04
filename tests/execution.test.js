'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const { MessageFlags } = require('discord.js');

const db = require('../src/database');
const i18n = require('../src/core/i18n');
const { loadCommands } = require('../src/core/loader');
const { fauxServeur } = require('./aides/faux-discord');

const DB_FILE = `/tmp/gestion-execution-${process.pid}.db`;

i18n.load();
db.open(DB_FILE);

const { commands } = loadCommands(path.join(__dirname, '..', 'src', 'commands'));

// Types d'options de l'API Discord.
const TYPE = { SUB: 1, GROUP: 2, STRING: 3, INTEGER: 4, BOOLEAN: 5, USER: 6, CHANNEL: 7, ROLE: 8, NUMBER: 10 };

// Fabrique une valeur plausible pour n'importe quelle option, a partir de sa
// seule declaration : pas de table a tenir a jour quand une commande change.
function valeurPour(option, monde) {
  if (option.choices?.length) return option.choices[0].value;

  switch (option.type) {
    case TYPE.STRING:
      if (/duree|anciennete/i.test(option.name)) return '10m';
      if (/identifiant/i.test(option.name)) return '500000000000000000';
      if (/domaine/i.test(option.name)) return 'github.com';
      if (/modele/i.test(option.name)) return option.name === 'modele' ? 'Salon {valeur}' : 'test';
      if (/image/i.test(option.name)) return 'https://cdn.example.invalid/i.png';
      if (/code/i.test(option.name)) return 'fr';
      return 'test';
    case TYPE.INTEGER:
    case TYPE.NUMBER:
      return option.min_value ?? 1;
    case TYPE.BOOLEAN:
      return true;
    case TYPE.USER:
      return monde.cible.user;
    case TYPE.CHANNEL:
      return monde.texte;
    case TYPE.ROLE:
      return monde.bas;
    default:
      return null;
  }
}

function fausseInteraction(monde, commandName, subcommand, options) {
  const valeurs = new Map(options.map((o) => [o.name, valeurPour(o, monde)]));
  const envoyes = [];

  const lire = (name, required) => {
    const value = valeurs.has(name) ? valeurs.get(name) : null;
    if (required && value === null) throw new Error(`option obligatoire absente : ${name}`);
    return value;
  };

  const interaction = {
    id: '1',
    commandName,
    guild: monde.guild,
    guildId: monde.guild.id,
    channel: monde.texte,
    channelId: monde.texte.id,
    member: monde.auteur,
    user: monde.auteur.user,
    createdTimestamp: Date.now(),
    replied: false,
    deferred: false,
    inGuild: () => true,
    options: {
      getSubcommand: (required = true) => {
        if (!subcommand && required) throw new Error('aucune sous-commande');
        return subcommand;
      },
      getString: lire,
      getInteger: lire,
      getNumber: lire,
      getBoolean: (name) => (valeurs.has(name) ? valeurs.get(name) : null),
      getUser: lire,
      getChannel: lire,
      getRole: lire,
      getFocused: () => '',
    },
    async reply(payload) {
      this.replied = true;
      envoyes.push(payload);
      return { id: '2', createdTimestamp: Date.now() };
    },
    async deferReply() {
      this.deferred = true;
      return { id: '2', createdTimestamp: Date.now() };
    },
    async editReply(payload) {
      envoyes.push(payload);
      return { id: '2', createdTimestamp: Date.now() };
    },
    async followUp(payload) {
      envoyes.push(payload);
      return { id: '3', createdTimestamp: Date.now() };
    },
    async respond() {},
  };

  interaction.client = {
    user: {
      ...monde.guild.members.me.user,
      setUsername: async () => {},
      setAvatar: async () => {},
      setPresence: () => {},
    },
    commands,
    uptime: 123456,
    ws: { ping: 42 },
    guilds: { cache: new Map([[monde.guild.id, monde.guild]]) },
    users: { fetch: async () => monde.cible.user },
  };

  return { interaction, envoyes };
}

// Chaque commande, chaque sous-commande.
function cas() {
  const liste = [];
  for (const command of commands.values()) {
    const json = command.data.toJSON();
    const subs = (json.options || []).filter((o) => o.type === TYPE.SUB);

    if (!subs.length) liste.push({ command, name: `/${json.name}`, sub: null, options: json.options || [] });
    else for (const sub of subs) {
      liste.push({ command, name: `/${json.name} ${sub.name}`, sub: sub.name, options: sub.options || [] });
    }
  }
  return liste;
}

// Seul cas legitime ou une commande ne repond pas : elle vient de supprimer
// le salon auquel le jeton d'interaction etait rattache.
const SANS_REPONSE = new Set(['/salon renouveler']);

test('chaque commande s’execute et produit un message valide', async () => {
  const echecs = [];
  let executees = 0;

  for (const { command, name, sub, options } of cas()) {
    const monde = fauxServeur();
    const { interaction, envoyes } = fausseInteraction(monde, command.data.name, sub, options);

    try {
      await command.run(interaction, {
        t: (key, vars) => i18n.t('fr', key, vars),
        locale: 'fr',
        client: interaction.client,
      });
    } catch (error) {
      echecs.push(`${name} : ${error.message}`);
      continue;
    }

    executees += 1;

    if (!envoyes.length && !SANS_REPONSE.has(name)) {
      echecs.push(`${name} : aucune reponse envoyee`);
      continue;
    }

    // Tout ce qui sort doit etre du Components V2, jamais une embed.
    for (const payload of envoyes) {
      if (payload.embeds) echecs.push(`${name} : envoie une embed classique`);
      if (payload.components && !(payload.flags & MessageFlags.IsComponentsV2)) {
        echecs.push(`${name} : drapeau Components V2 absent`);
      }
    }
  }

  assert.deepStrictEqual(echecs, []);
  assert.ok(executees > 90, `seulement ${executees} actions executees`);
});

test.after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_FILE}${suffix}`, { force: true });
});
