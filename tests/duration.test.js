'use strict';

const test = require('node:test');
const assert = require('node:assert');
const duration = require('../src/lib/duration');

test('parse les unites simples', () => {
  assert.strictEqual(duration.parse('45s'), 45_000);
  assert.strictEqual(duration.parse('10m'), 600_000);
  assert.strictEqual(duration.parse('2h'), 7_200_000);
  assert.strictEqual(duration.parse('3j'), 259_200_000);
  assert.strictEqual(duration.parse('1w'), 604_800_000);
});

test('accepte j et d pour les jours', () => {
  assert.strictEqual(duration.parse('2j'), duration.parse('2d'));
});

test('combine plusieurs unites', () => {
  assert.strictEqual(duration.parse('1j 12h'), 129_600_000);
  assert.strictEqual(duration.parse('2h30m'), 9_000_000);
});

test('lit 1h30 comme une heure et demie', () => {
  assert.strictEqual(duration.parse('1h30'), 5_400_000);
});

test('refuse ce qui n’est pas une duree', () => {
  for (const input of ['', null, undefined, 'demain', 'abc', '0s']) {
    assert.strictEqual(duration.parse(input), null, `"${input}" aurait du etre refuse`);
  }
});

test('formate au maximum deux unites', () => {
  assert.strictEqual(duration.format(90_061_000), '1j 1h');
  assert.strictEqual(duration.format(600_000), '10min');
  assert.strictEqual(duration.format(600_000, 'en'), '10m');
});
