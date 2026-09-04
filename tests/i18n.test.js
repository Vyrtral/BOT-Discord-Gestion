'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const i18n = require('../src/core/i18n');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function flatten(source, prefix = '', target = []) {
  for (const [key, value] of Object.entries(source)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, full, target);
    else target.push(full);
  }
  return target;
}

test('chaque langue couvre exactement les memes cles', () => {
  const reference = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'fr.json'), 'utf8'))).sort();

  for (const file of fs.readdirSync(LOCALES_DIR)) {
    if (file === 'fr.json' || !file.endsWith('.json')) continue;

    // Les descriptions de commandes n'existent que dans les traductions :
    // le francais est ecrit directement dans les fichiers de commande.
    const other = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8')))
      .filter((key) => !key.startsWith('commands.'))
      .sort();

    assert.deepStrictEqual(other, reference, `${file} ne colle pas a fr.json`);
  }
});

test('les variables d’une traduction existent aussi en francais', () => {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
  const variables = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  const walk = (source, other, prefix = '') => {
    for (const [key, value] of Object.entries(source)) {
      const full = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object') {
        walk(value, other, full);
      } else {
        const translated = i18n.raw('en', full);
        if (translated === undefined) continue;
        assert.deepStrictEqual(variables(translated), variables(value), `variables differentes sur ${full}`);
      }
    }
  };

  i18n.load();
  walk(read('fr.json'), read('en.json'));
});

test('une cle absente retombe sur le francais puis sur elle-meme', () => {
  i18n.load();
  assert.strictEqual(i18n.t('en', 'common.none'), 'none');
  assert.strictEqual(i18n.t('xx', 'common.none'), 'aucun');
  assert.strictEqual(i18n.t('fr', 'cle.qui.nexiste.pas'), 'cle.qui.nexiste.pas');
});

test('les variables sont remplacees, les inconnues laissees telles quelles', () => {
  i18n.load();
  assert.strictEqual(i18n.t('fr', 'xp.levelUp', { member: 'Q', level: 4 }), 'Q passe niveau **4**.');
  assert.strictEqual(i18n.t('fr', 'xp.levelUp', { member: 'Q' }), 'Q passe niveau **{level}**.');
});
