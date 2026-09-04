'use strict';

// Dernier message supprime et dernier message modifie, par salon. Volontaire-
// ment en memoire : ces messages ont ete effacees par quelqu'un, les garder
// sur disque irait contre l'intention de la personne. Un redemarrage vide
// tout, et c'est tres bien.
const CHANNEL_LIMIT = 500;
const KEEP_MS = 2 * 60 * 60 * 1000;

const store = new Map();

function keyOf(channelId, kind) {
  return `${channelId}:${kind}`;
}

function remember(channelId, kind, entry) {
  // Au-dela de la limite, on oublie l'entree la plus ancienne : une Map garde
  // son ordre d'insertion, la premiere cle est donc la plus vieille.
  if (store.size >= CHANNEL_LIMIT * 2) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(keyOf(channelId, kind), { ...entry, at: Date.now() });
}

function last(channelId, kind) {
  const entry = store.get(keyOf(channelId, kind));
  if (!entry) return null;

  if (Date.now() - entry.at > KEEP_MS) {
    store.delete(keyOf(channelId, kind));
    return null;
  }
  return entry;
}

function sweep(now = Date.now()) {
  for (const [key, entry] of store) {
    if (now - entry.at > KEEP_MS) store.delete(key);
  }
}

module.exports = { remember, last, sweep, KEEP_MS };
