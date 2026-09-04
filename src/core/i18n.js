'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LOCALES_DIR = path.join(__dirname, '..', '..', 'locales');
const FALLBACK = 'fr';

const bundles = new Map();

// Les fichiers de langue sont imbriques pour rester lisibles ; on les aplatit
// une fois au chargement pour que la recherche d'une cle soit un simple acces
// de Map.
function flatten(source, prefix = '', target = new Map()) {
  for (const [key, value] of Object.entries(source)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, target);
    } else {
      target.set(full, value);
    }
  }
  return target;
}

function load() {
  bundles.clear();
  for (const file of fs.readdirSync(LOCALES_DIR)) {
    if (!file.endsWith('.json')) continue;
    const code = path.basename(file, '.json');
    const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
    bundles.set(code, flatten(raw));
  }
  if (!bundles.has(FALLBACK)) {
    throw new Error(`locales/${FALLBACK}.json est obligatoire, c'est la langue de repli.`);
  }
  return [...bundles.keys()];
}

function available() {
  return [...bundles.keys()];
}

function has(locale) {
  return bundles.has(locale);
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

// Une cle absente de la langue demandee retombe sur le francais. Absente
// partout, elle est renvoyee telle quelle : ca saute aux yeux en test sans
// faire planter la commande en production.
function t(locale, key, vars) {
  const bundle = bundles.get(locale) || bundles.get(FALLBACK);
  const value = bundle.has(key) ? bundle.get(key) : bundles.get(FALLBACK).get(key);
  if (value === undefined) return key;
  return interpolate(value, vars);
}

function raw(locale, key) {
  const bundle = bundles.get(locale);
  return bundle ? bundle.get(key) : undefined;
}

module.exports = { load, available, has, t, raw, FALLBACK };
