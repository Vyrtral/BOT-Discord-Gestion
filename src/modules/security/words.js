'use strict';

const securityQueries = require('../../database/queries/security');
const core = require('./index');

// La liste change rarement mais est lue a chaque message : on la garde en
// memoire, invalidee par /securite mots.
const cache = new Map();

function listFor(guildId) {
  if (!cache.has(guildId)) cache.set(guildId, securityQueries.words(guildId));
  return cache.get(guildId);
}

function forget(guildId) {
  cache.delete(guildId);
}

// Les accents sont retires avant comparaison, sinon "cönnard" passe a
// travers la liste.
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Contournement classique : ecrire "c.o.n.n.a.r.d". On recolle les suites de
// lettres isolees, sans toucher aux mots entiers — "concert" reste intact.
function joinIsolatedLetters(text) {
  return text.replace(/\b(?:[a-z0-9][^a-z0-9\s]+){2,}[a-z0-9]\b/g, (run) =>
    run.replace(/[^a-z0-9]+/g, ''),
  );
}

function tokenize(text) {
  return new Set(
    joinIsolatedLetters(normalize(text))
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean),
  );
}

function findMatch(content, words) {
  const flat = joinIsolatedLetters(normalize(content)).replace(/[^a-z0-9]+/g, ' ');
  const tokens = tokenize(content);

  for (const word of words) {
    const target = normalize(word).replace(/\s+/g, ' ').trim();
    if (!target) continue;

    // Une expression avec des espaces est cherchee telle quelle ; un mot seul
    // doit correspondre a un mot entier, au pluriel pres.
    if (target.includes(' ')) {
      if (flat.includes(target)) return word;
    } else if (tokens.has(target) || tokens.has(`${target}s`) || tokens.has(`${target}x`)) {
      return word;
    }
  }
  return null;
}

async function handle(message, settings) {
  if (!settings.words_enabled) return false;
  if (core.isExempt(message.member, settings)) return false;

  const words = listFor(message.guild.id);
  if (!words.length) return false;

  const match = findMatch(message.content || '', words);
  if (!match) return false;

  await message.delete().catch(() => null);

  if (settings.words_action !== 'delete') {
    await core.punish(message.member, settings.words_action, { reason: 'Mot interdit' });
  }

  await core.report(message.guild, {
    titleKey: 'security.words.triggered',
    member: message.member,
    detail: `||${match}||`,
    action: settings.words_action,
  });

  return true;
}

module.exports = { handle, findMatch, forget };
