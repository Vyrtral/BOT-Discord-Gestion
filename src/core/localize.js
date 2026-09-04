'use strict';

const i18n = require('./i18n');

// Discord attend ses propres codes de langue. Seuls ceux presents dans
// locales/ sont envoyes.
const DISCORD_LOCALES = {
  fr: ['fr'],
  en: ['en-US', 'en-GB'],
  es: ['es-ES'],
  de: ['de'],
  it: ['it'],
  pt: ['pt-BR'],
};

// Les descriptions affichees par Discord viennent des fichiers de langue,
// sous la cle commands.<chemin>. Le francais reste ecrit directement dans le
// builder : c'est lui qu'on lit en ouvrant le fichier de la commande.
function collect(key) {
  const result = {};
  for (const [code, discordCodes] of Object.entries(DISCORD_LOCALES)) {
    if (code === i18n.FALLBACK) continue;
    const value = i18n.raw(code, `commands.${key}`);
    if (!value) continue;
    for (const discordCode of discordCodes) result[discordCode] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function walk(node, prefix) {
  const localizations = collect(prefix);
  if (localizations) node.description_localizations = localizations;

  if (!Array.isArray(node.options)) return;
  for (const option of node.options) {
    walk(option, `${prefix}.${option.name}`);
  }
}

// Recoit le JSON d'une commande et y ajoute les traductions trouvees.
function apply(json) {
  walk(json, json.name);
  return json;
}

module.exports = { apply };
