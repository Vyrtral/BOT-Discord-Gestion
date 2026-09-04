'use strict';

const UNITS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  j: 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  mo: 30 * 24 * 60 * 60 * 1000,
};

// Accepte "10m", "1h30", "2j 4h", "45s". Renvoie des millisecondes, ou null
// si rien d'exploitable n'a ete trouve.
function parse(input) {
  if (!input) return null;
  const text = String(input).toLowerCase().replace(/\s+/g, '');

  const matches = [...text.matchAll(/(\d+)(mo|[smhjdw])?/g)];
  if (!matches.length) return null;

  let total = 0;
  let previousUnit = null;

  for (const [, amount, unit] of matches) {
    const value = Number.parseInt(amount, 10);
    if (Number.isNaN(value)) return null;

    if (unit) {
      total += value * UNITS[unit];
      previousUnit = unit;
    } else if (previousUnit === 'h') {
      // "1h30" : le nombre sans unite qui suit des heures, ce sont des minutes.
      total += value * UNITS.m;
      previousUnit = 'm';
    } else if (previousUnit === 'm') {
      total += value * UNITS.s;
      previousUnit = 's';
    } else {
      return null;
    }
  }

  return total > 0 ? total : null;
}

const LABELS = {
  fr: { d: 'j', h: 'h', m: 'min', s: 's' },
  en: { d: 'd', h: 'h', m: 'm', s: 's' },
};

// Format court, les deux plus grosses unites suffisent : "2j 4h" plutot que
// "2j 4h 13min 7s".
function format(ms, locale = 'fr') {
  if (!ms || ms < 1000) return locale === 'en' ? 'less than a second' : 'moins d’une seconde';
  const labels = LABELS[locale] || LABELS.fr;

  const days = Math.floor(ms / UNITS.d);
  const hours = Math.floor((ms % UNITS.d) / UNITS.h);
  const minutes = Math.floor((ms % UNITS.h) / UNITS.m);
  const seconds = Math.floor((ms % UNITS.m) / 1000);

  const parts = [];
  if (days) parts.push(`${days}${labels.d}`);
  if (hours) parts.push(`${hours}${labels.h}`);
  if (minutes) parts.push(`${minutes}${labels.m}`);
  if (seconds) parts.push(`${seconds}${labels.s}`);

  return parts.slice(0, 2).join(' ');
}

module.exports = { parse, format };
