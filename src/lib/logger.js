'use strict';

// Sortie console volontairement minimale : PM2 horodate deja chaque ligne
// avec l'option time, et un log applicatif trop bavard rend les vraies
// erreurs invisibles.
const LEVELS = { info: 'INFO', warn: 'WARN', error: 'ERR ' };

function write(level, message, extra) {
  const line = `[${LEVELS[level]}] ${message}`;
  if (level === 'error') console.error(line, extra !== undefined ? extra : '');
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = {
  info: (message) => write('info', message),
  warn: (message) => write('warn', message),
  error: (message, error) => write('error', message, error && error.stack ? error.stack : error),
};
