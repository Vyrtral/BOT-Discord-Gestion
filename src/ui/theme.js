'use strict';

// Barre d'accent des containers. Une seule valeur a changer pour rehabiller
// tout le bot.
const ACCENT = {
  base: 0x131416,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
};

// Discord n'a pas de convention d'icone pour les containers ; ces symboles
// passent partout, mobile compris, sans nitro.
const MARKS = {
  success: '✓',
  danger: '✗',
  warning: '!',
};

module.exports = { ACCENT, MARKS };
