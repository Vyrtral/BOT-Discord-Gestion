'use strict';

// Compteur glissant reutilise par l'antispam, l'antiraid et l'antinuke :
// on garde les horodatages d'une cle sur une fenetre de temps, et on demande
// combien il en reste.
class SlidingWindow {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  push(key, timestamp = Date.now()) {
    const kept = (this.entries.get(key) || []).filter((t) => timestamp - t < this.windowMs);
    kept.push(timestamp);
    this.entries.set(key, kept);
    return kept.length;
  }

  count(key, timestamp = Date.now()) {
    const kept = (this.entries.get(key) || []).filter((t) => timestamp - t < this.windowMs);
    if (kept.length) this.entries.set(key, kept);
    else this.entries.delete(key);
    return kept.length;
  }

  reset(key) {
    this.entries.delete(key);
  }

  // Sans ce nettoyage, une Map grossit indefiniment sur un gros serveur :
  // chaque membre qui poste une fois y laisse une entree.
  sweep(now = Date.now()) {
    for (const [key, timestamps] of this.entries) {
      const kept = timestamps.filter((t) => now - t < this.windowMs);
      if (kept.length) this.entries.set(key, kept);
      else this.entries.delete(key);
    }
  }
}

module.exports = { SlidingWindow };
