'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const config = require('../src/core/config');

const ROOT = path.join(__dirname, '..');

// Le bot a deja ete lance depuis src/ sur le VPS : la config etait alors
// cherchee dans src/, et la base serait partie dans src/data/. Tout ce qui
// suit verifie que le dossier courant n'a plus d'influence.
test('la racine ne depend pas du dossier de lancement', () => {
  assert.strictEqual(config.root, ROOT);
  assert.strictEqual(config.file, path.join(ROOT, 'config.js'));
});

// On teste la resolution, pas la valeur : le config.js de la machine qui
// lance les tests peut pointer la base n'importe ou.
test('un chemin DATA relatif est ancre sur la racine', () => {
  assert.strictEqual(config.resolvePath('./data/gestion.db'), path.join(ROOT, 'data', 'gestion.db'));
  assert.strictEqual(config.resolvePath('data/gestion.db'), path.join(ROOT, 'data', 'gestion.db'));
  assert.ok(path.isAbsolute(config.database));
});

test('un chemin DATA absolu est pris tel quel', () => {
  assert.strictEqual(config.resolvePath('/srv/gestion/base.db'), '/srv/gestion/base.db');
});

test('la resolution ne passe jamais par le dossier courant', () => {
  const previous = process.cwd();
  try {
    process.chdir(path.join(ROOT, 'src'));
    delete require.cache[require.resolve('../src/core/config')];
    const reloaded = require('../src/core/config');

    assert.strictEqual(reloaded.root, ROOT);
    assert.strictEqual(reloaded.resolvePath('./data/gestion.db'), path.join(ROOT, 'data', 'gestion.db'));
  } finally {
    process.chdir(previous);
    delete require.cache[require.resolve('../src/core/config')];
  }
});

// config.js est ignore par git : ce test ne peut porter que sur l'exemple,
// qui est le seul des deux a exister dans un depot fraichement clone.
test('config.example.js expose les six cles attendues', () => {
  const example = require(path.join(ROOT, 'config.example.js'));
  assert.deepStrictEqual(Object.keys(example).sort(), [
    'APP_ID',
    'DATA',
    'GUILD_ID',
    'LANGUE',
    'SYS_ID',
    'TOKEN',
  ]);
});

test('sans config.js, rien ne plante a l’import', () => {
  assert.strictEqual(typeof config.assertReady, 'function');
  assert.ok(path.isAbsolute(config.database));
});

test('la langue par defaut est le francais', () => {
  assert.strictEqual(config.locale, 'fr');
});
