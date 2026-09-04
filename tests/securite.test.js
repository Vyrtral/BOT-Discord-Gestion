'use strict';

const test = require('node:test');
const assert = require('node:assert');
const words = require('../src/modules/security/words');
const links = require('../src/modules/security/links');
const { SlidingWindow } = require('../src/lib/collections');

test('le filtre de mots ignore les accents', () => {
  assert.strictEqual(words.findMatch('espece de cönnard', ['connard']), 'connard');
});

test('les lettres espacees sont recollees avant comparaison', () => {
  assert.strictEqual(words.findMatch('c.o.n.n.a.r.d', ['connard']), 'connard');
  assert.strictEqual(words.findMatch('c o n n a r d', ['connard']), null);
});

test('un mot seul ne matche pas au milieu d’un autre mot', () => {
  assert.strictEqual(words.findMatch('reconnaissance', ['connard']), null);
  assert.strictEqual(words.findMatch('un concert ce soir', ['con']), null);
});

test('le pluriel est reconnu', () => {
  assert.strictEqual(words.findMatch('salut les cons', ['con']), 'con');
  assert.strictEqual(words.findMatch('des choux', ['chou']), 'chou');
});

test('la ponctuation ne cache pas un mot interdit', () => {
  assert.strictEqual(words.findMatch('salut,connard', ['connard']), 'connard');
});

test('une expression avec espaces est cherchee telle quelle', () => {
  assert.strictEqual(words.findMatch('va te faire voir ailleurs', ['va te faire']), 'va te faire');
});

test('les domaines sont extraits sans le www ni le chemin', () => {
  assert.deepStrictEqual(links.domainsIn('regarde https://www.GitHub.com/quentin/projet'), ['github.com']);
});

test('un domaine autorise couvre ses sous-domaines mais pas ses homonymes', () => {
  assert.ok(links.isAllowed('gist.github.com', ['github.com']));
  assert.ok(links.isAllowed('github.com', ['github.com']));
  assert.ok(!links.isAllowed('githubusercontent.com', ['github.com']));
  assert.ok(!links.isAllowed('notgithub.com', ['github.com']));
});

test('la fenetre glissante oublie ce qui sort de la fenetre', () => {
  const window = new SlidingWindow(1000);
  const start = 1_000_000;

  assert.strictEqual(window.push('a', start), 1);
  assert.strictEqual(window.push('a', start + 500), 2);
  assert.strictEqual(window.push('a', start + 1200), 2);
  assert.strictEqual(window.count('a', start + 3000), 0);
});
