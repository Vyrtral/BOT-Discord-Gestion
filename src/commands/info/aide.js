'use strict';

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { RANK, DISCORD } = require('../../constants');
const access = require('../../core/access');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const i18n = require('../../core/i18n');

const SELECT_ID = 'aide:categorie';

// Marge sous les 4000 caracteres d'un message V2, titre et pied compris.
const BODY_MAX = 3500;

// Ordre d'affichage. Le nom correspond au dossier de la commande, ce qui
// evite d'entretenir une liste en double.
const CATEGORIES = ['moderation', 'vocal', 'securite', 'tickets', 'niveaux', 'configuration', 'info'];

// Les categories auxquelles le rang du membre lui donne acces, chacune avec
// ses commandes. Une categorie vide n'apparait pas dans le selecteur.
function accessibleCategories(client, rank) {
  return CATEGORIES.map((name) => ({
    name,
    commands: [...client.commands.values()].filter(
      (command) => command.category === name && access.lowestRank(command) <= rank,
    ),
  })).filter((category) => category.commands.length > 0);
}

// Une commande a sous-commandes se detaille sous-commande par sous-commande :
// "/securite antispam" est plus parlant que "/securite" seul.
function entriesOf(command) {
  const json = command.data.toJSON();
  const subcommands = (json.options || []).filter((option) => option.type === 1);

  if (!subcommands.length) return [{ usage: `/${json.name}`, description: json.description }];
  return subcommands.map((sub) => ({
    usage: `/${json.name} ${sub.name}`,
    description: sub.description,
  }));
}

function buildMenu(categories, locale) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(SELECT_ID)
      .setPlaceholder(i18n.t(locale, 'help.placeholder'))
      .addOptions(
        categories.slice(0, DISCORD.selectOptionsMax).map((category) => ({
          label: i18n.t(locale, `help.category.${category.name}`),
          value: category.name,
          description: i18n.t(locale, `help.describe.${category.name}`),
        })),
      ),
  );
}

// Panneau d'une categorie, renvoye quand on choisit dans le selecteur.
function categoryPanel(client, rank, name, locale) {
  const category = accessibleCategories(client, rank).find((entry) => entry.name === name);
  if (!category) return null;

  const entries = category.commands.flatMap(entriesOf);

  // Un message Components V2 plafonne a 4000 caracteres toutes zones
  // confondues. On coupe la liste plutot que de laisser l'envoi echouer, et
  // le pied de page dit combien de commandes ne sont pas affichees.
  const shown = [];
  let size = 0;
  for (const entry of entries) {
    const block = `• **${entry.usage}**\n↳ ${entry.description}`;
    if (size + block.length + 2 > BODY_MAX) break;
    size += block.length + 2;
    shown.push(entry);
  }

  const hidden = entries.length - shown.length;
  const footer = hidden
    ? i18n.t(locale, 'help.countTruncated', { count: shown.length, hidden })
    : i18n.t(locale, 'help.count', { count: entries.length });

  return render
    .panel(i18n.t(locale, `help.category.${name}`))
    .setBody(render.blocks(shown.map((entry) => ({ label: entry.usage, value: entry.description }))))
    .setFooter(footer)
    .setDated();
}

module.exports = {
  rank: RANK.member,
  SELECT_ID,
  categoryPanel,

  data: new SlashCommandBuilder()
    .setName('aide')
    .setDescription('Liste les commandes accessibles')
    .setDMPermission(false),

  async run(interaction, { t, locale }) {
    const rank = access.rankOf(interaction.member);
    const categories = accessibleCategories(interaction.client, rank);

    if (!categories.length) return respond.fail(interaction, t('errors.rank'));

    const total = categories.reduce((sum, category) => sum + category.commands.flatMap(entriesOf).length, 0);

    const panel = render
      .panel(t('help.title'))
      .setBody(render.line(t('help.centre'), t('help.intro')))
      .setStats([
        { label: t('help.stat.categories'), value: String(categories.length) },
        { label: t('help.stat.commands'), value: String(total) },
      ])
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
      .setFooter(t('help.footer', { rank: t(`config.rank.${rank}`) }));

    return respond.send(interaction, panel, { rows: [buildMenu(categories, locale)], ephemeral: true });
  },
};
