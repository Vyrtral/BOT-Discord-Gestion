'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');


const i18n = require('../src/core/i18n');
const localize = require('../src/core/localize');
const { loadCommands } = require('../src/core/loader');
const { RANK } = require('../src/constants');

i18n.load();
const { commands, problems } = loadCommands(path.join(__dirname, '..', 'src', 'commands'));

// Contraintes de l'API Discord sur les noms de commandes.
const NAME_PATTERN = /^[-_\p{L}\p{N}]{1,32}$/u;

test('toutes les commandes se chargent sans conflit', () => {
  assert.deepStrictEqual(problems, []);
  assert.ok(commands.size > 0);
});

test('les definitions respectent les limites de Discord', () => {
  for (const command of commands.values()) {
    const json = command.data.toJSON();

    assert.ok(NAME_PATTERN.test(json.name), `nom invalide : ${json.name}`);
    assert.strictEqual(json.name, json.name.toLowerCase(), `${json.name} doit etre en minuscules`);
    assert.ok(json.description.length <= 100, `${json.name} : description trop longue`);
    assert.ok((json.options || []).length <= 25, `${json.name} : trop d'options`);

    for (const option of json.options || []) {
      assert.ok(NAME_PATTERN.test(option.name), `${json.name}.${option.name} : nom invalide`);
      assert.ok(option.description.length <= 100, `${json.name}.${option.name} : description trop longue`);

      for (const nested of option.options || []) {
        assert.ok(nested.description.length <= 100, `${json.name} ${option.name} ${nested.name} : trop long`);
      }
    }
  }
});

test('les options obligatoires precedent les facultatives', () => {
  const check = (options, where) => {
    let seenOptional = false;
    for (const option of options || []) {
      if (option.type === 1 || option.type === 2) {
        check(option.options, `${where} ${option.name}`);
        continue;
      }
      if (!option.required) seenOptional = true;
      else assert.ok(!seenOptional, `${where} : "${option.name}" obligatoire apres une facultative`);
    }
  };

  for (const command of commands.values()) check(command.data.toJSON().options, `/${command.data.name}`);
});

test('chaque commande declare un rang connu', () => {
  const known = Object.values(RANK);
  for (const command of commands.values()) {
    assert.ok(known.includes(command.rank ?? RANK.member), `/${command.data.name} : rang inconnu`);
  }
});

// Une option de sous-commande oubliee ne casse rien au demarrage : elle
// s'affiche simplement en francais a un anglophone. Ce test est le seul
// filet.
test('tout est traduit en anglais, options imbriquees comprises', () => {
  const walk = (node, where) => {
    assert.ok(node.description_localizations, `${where} : non traduit`);
    for (const option of node.options || []) walk(option, `${where} ${option.name}`);
  };

  for (const command of commands.values()) {
    walk(localize.apply(command.data.toJSON()), `/${command.data.name}`);
  }
});

test('les rangs par sous-commande portent sur des sous-commandes reelles', () => {
  for (const command of commands.values()) {
    if (!command.subcommandRanks) continue;

    const names = (command.data.toJSON().options || [])
      .filter((option) => option.type === 1)
      .map((option) => option.name);

    for (const name of Object.keys(command.subcommandRanks)) {
      assert.ok(names.includes(name), `/${command.data.name} : pas de sous-commande "${name}"`);
    }
  }
});
