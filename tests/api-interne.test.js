'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const SRC = path.join(__dirname, '..', 'src');

// Les modules internes appeles par leur nom d'import habituel dans tout le
// projet. JavaScript ne verifie rien avant l'execution : renommer une
// fonction ici casse silencieusement chaque appelant, et ca ne se voit qu'au
// moment ou un membre tape la commande. C'est arrive deux fois pendant le
// portage en Components V2 — d'ou ce test.
const MODULES = {
  respond: '../src/core/respond',
  render: '../src/ui/render',
  access: '../src/core/access',
  i18n: '../src/core/i18n',
  locales: '../src/core/locale',
  logs: '../src/modules/logs',
  tickets: '../src/modules/tickets',
  sanctions: '../src/modules/sanctions',
  xp: '../src/modules/xp',
  welcome: '../src/modules/welcome',
  counters: '../src/modules/counters',
  lockdown: '../src/modules/lockdown',
};

function sources(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sources(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

test('chaque methode appelee sur un module interne existe vraiment', () => {
  const exported = new Map(
    Object.entries(MODULES).map(([name, spec]) => [name, new Set(Object.keys(require(spec)))]),
  );

  const problems = [];
  for (const file of sources(SRC)) {
    const code = fs.readFileSync(file, 'utf8');

    for (const [name, methods] of exported) {
      // On ne verifie un module que dans les fichiers qui l'importent
      // reellement sous ce nom, sinon une variable locale homonyme ferait
      // echouer le test a tort.
      if (!new RegExp(`const ${name} = require\\(`).test(code)) continue;

      for (const [, method] of code.matchAll(new RegExp(`\\b${name}\\.(\\w+)\\s*\\(`, 'g'))) {
        if (!methods.has(method)) {
          problems.push(`${path.relative(SRC, file)} : ${name}.${method}() n'existe pas`);
        }
      }
    }
  }

  assert.deepStrictEqual(problems, []);
});

test('aucun identifiant Discord n’est ecrit en dur dans le code', () => {
  const found = [];
  for (const file of sources(SRC)) {
    const code = fs.readFileSync(file, 'utf8');
    for (const [match] of code.matchAll(/(?<![\w.])\d{17,20}(?![\w.])/g)) {
      found.push(`${path.relative(SRC, file)} : ${match}`);
    }
  }
  assert.deepStrictEqual(found, []);
});
