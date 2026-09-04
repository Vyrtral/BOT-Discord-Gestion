'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { MessageFlags } = require('discord.js');
const render = require('../src/ui/render');
const { ACCENT } = require('../src/ui/theme');

// Types de composants Components V2, tels que Discord les numerote.
const CONTAINER = 17;
const TEXT = 10;
const SEPARATOR = 14;

function contents(panel) {
  return panel
    .toContainer()
    .toJSON()
    .components.filter((c) => c.type === TEXT)
    .map((c) => c.content);
}

test('un panneau produit un container, jamais une embed', () => {
  const json = render.info('corps', 'Titre').toContainer().toJSON();
  assert.strictEqual(json.type, CONTAINER);
  assert.strictEqual(json.accent_color, ACCENT.base);
});

test('le payload porte le drapeau Components V2', () => {
  const out = render.payload(render.info('x'));
  assert.ok(out.flags & MessageFlags.IsComponentsV2);
  assert.strictEqual(out.embeds, undefined);
});

test('le drapeau ephemere s’ajoute sans effacer celui de V2', () => {
  const out = render.payload(render.info('x'), [], { ephemeral: true });
  assert.ok(out.flags & MessageFlags.IsComponentsV2);
  assert.ok(out.flags & MessageFlags.Ephemeral);
});

test('titre, sur-titre et champs suivent la charte', () => {
  const panel = render
    .info('corps', 'Titre')
    .setAuthor({ name: 'Quentin' })
    .addFields({ name: 'Membre', value: '<@1>' }, { name: 'Raison', value: 'test' });

  assert.strictEqual(
    contents(panel)[0],
    '-# Quentin\n\n## Titre\n\ncorps\n\n• **Membre**\n↳ <@1>\n\n• **Raison**\n↳ test',
  );
});

test('les alias de l’ancienne API sont acceptes', () => {
  const panel = render
    .neutral('T')
    .setDescription('corps')
    .setColor(ACCENT.danger)
    .setFooter({ text: '#7' })
    .setTimestamp();

  assert.strictEqual(panel.accent, ACCENT.danger);
  assert.match(contents(panel).at(-1), /^-# #7 — <t:\d+:f>$/);
});

// En Components V2 un "<@id>" dans un TextDisplay notifie vraiment, alors
// qu'une description d'embed ne le faisait pas. Sans ce defaut, chaque log de
// sanction pinguerait le sanctionne.
test('aucune mention ne notifie par defaut', () => {
  assert.deepStrictEqual(render.payload(render.info('<@1> <@&2>')).allowedMentions, { parse: [] });
});

test('un appelant peut autoriser une notification precise', () => {
  const out = render.payload(render.info('x'), [], { allowedMentions: { users: ['42'] } });
  assert.deepStrictEqual(out.allowedMentions, { users: ['42'] });
});

test('un separateur precede le pied de page', () => {
  const types = render.info('x').setFooter('pied').toContainer().toJSON().components.map((c) => c.type);
  assert.deepStrictEqual(types, [TEXT, SEPARATOR, TEXT]);
});

test('une valeur de champ trop longue est coupee', () => {
  const panel = render.neutral('T').addField('Long', 'a'.repeat(render.FIELD_VALUE_MAX + 200));
  assert.ok(contents(panel)[0].length < render.FIELD_VALUE_MAX + 60);
});

// Le portage depuis les embeds a casse 23 appels chaines sur plusieurs
// lignes sans que la syntaxe s'en plaigne. Ce test exerce toute l'API de
// compatibilite d'un coup : une methode qui disparait se voit ici.
test('toute l’API de compatibilite reste appelable', () => {
  const panel = render
    .base(ACCENT.warning)
    .setTitle('Titre')
    .setAuthor({ name: 'Auteur', iconURL: 'https://example.invalid/a.png' })
    .setDescription('corps')
    .setFields({ name: 'A', value: '1' })
    .addFields([{ name: 'B', value: '2' }])
    .addField('C', '3')
    .setStats([{ label: 'Membres', value: '128' }])
    .setThumbnail('https://example.invalid/t.png')
    .setImage('https://example.invalid/i.png')
    .setFooter({ text: 'pied' })
    .setTimestamp();

  const json = panel.toContainer().toJSON();
  assert.strictEqual(json.type, CONTAINER);
  assert.strictEqual(json.accent_color, ACCENT.warning);

  // setFields remplace, addFields et addField ajoutent : A, B et C.
  const head = json.components[0];
  assert.match(JSON.stringify(head), /• \*\*A\*\*.*• \*\*B\*\*.*• \*\*C\*\*/);

  // Vignette presente : le texte part dans une Section, pas en TextDisplay nu.
  assert.strictEqual(head.type, 9);
});
