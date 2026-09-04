'use strict';

const test = require('node:test');
const assert = require('node:assert');
const xp = require('../src/modules/xp');

test('les paliers suivent la formule annoncee', () => {
  assert.strictEqual(xp.totalXpFor(1), 100);
  assert.strictEqual(xp.totalXpFor(2), 300);
  assert.strictEqual(xp.totalXpFor(3), 600);
});

test('le niveau derive de l’xp est coherent avec les paliers', () => {
  for (let level = 0; level <= 60; level += 1) {
    assert.strictEqual(xp.levelFromXp(xp.totalXpFor(level)), level);
    assert.strictEqual(xp.levelFromXp(xp.totalXpFor(level + 1) - 1), level);
  }
});

test('une xp nulle ou negative reste au niveau 0', () => {
  assert.strictEqual(xp.levelFromXp(0), 0);
  assert.strictEqual(xp.levelFromXp(-50), 0);
});

test('la progression reste entre 0 et 1', () => {
  for (const value of [0, 99, 100, 4321, 100_000]) {
    const state = xp.progress(value);
    assert.ok(state.ratio >= 0 && state.ratio < 1, `ratio hors bornes pour ${value}`);
    assert.ok(state.current < state.needed);
  }
});

test('la barre de progression garde une largeur fixe', () => {
  for (const ratio of [-1, 0, 0.5, 1, 2]) {
    assert.strictEqual([...xp.progressBar(ratio, 12)].length, 12);
  }
});
