'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ActivityType, AttachmentBuilder } = require('discord.js');
const { RANK } = require('../../constants');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const duration = require('../../lib/duration');
const logger = require('../../lib/logger');

const ACTIVITES = {
  joue: ActivityType.Playing,
  regarde: ActivityType.Watching,
  ecoute: ActivityType.Listening,
  competition: ActivityType.Competing,
};

module.exports = {
  // Reserve au compte inscrit dans SYS_ID. Vide, personne n'y touche.
  rank: RANK.system,

  data: new SlashCommandBuilder()
    .setName('systeme')
    .setDescription('Administration du bot lui-même')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('nom')
        .setDescription('Change le nom du bot')
        .addStringOption((o) =>
          o.setName('nom').setDescription('Nouveau nom').setRequired(true).setMinLength(2).setMaxLength(32),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('avatar')
        .setDescription('Change l’avatar du bot')
        .addStringOption((o) => o.setName('lien').setDescription('Lien https vers une image').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('statut')
        .setDescription('Change l’activité affichée')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Verbe affiché devant le texte')
            .setRequired(true)
            .addChoices(
              { name: 'joue à', value: 'joue' },
              { name: 'regarde', value: 'regarde' },
              { name: 'écoute', value: 'ecoute' },
              { name: 'en compétition sur', value: 'competition' },
            ),
        )
        .addStringOption((o) => o.setName('texte').setDescription('Texte affiché').setRequired(true).setMaxLength(128)),
    )
    .addSubcommand((sub) =>
      sub.setName('sauvegarde').setDescription('Exporte la structure du serveur en JSON'),
    )
    .addSubcommand((sub) => sub.setName('etat').setDescription('Latence, mémoire et durée de fonctionnement'))
    .addSubcommand((sub) =>
      sub.setName('redemarrer').setDescription('Arrête le bot. Il ne repart que si un superviseur le relance'),
    ),

  async run(interaction, { t, locale }) {
    switch (interaction.options.getSubcommand()) {
      case 'nom':
        return renommer(interaction, t);
      case 'avatar':
        return avatar(interaction, t);
      case 'statut':
        return statut(interaction, t);
      case 'sauvegarde':
        return sauvegarde(interaction, t);
      case 'etat':
        return etat(interaction, t, locale);
      default:
        return redemarrer(interaction, t);
    }
  },
};

async function renommer(interaction, t) {
  const nom = interaction.options.getString('nom', true);
  await respond.defer(interaction, { ephemeral: true });

  try {
    // Discord limite a deux changements de nom par heure et repond 429.
    await interaction.client.user.setUsername(nom);
  } catch (error) {
    return respond.fail(interaction, t('systeme.renameFailed', { message: error.message }));
  }
  return respond.ok(interaction, t('systeme.renamed', { name: nom }));
}

async function avatar(interaction, t) {
  const lien = interaction.options.getString('lien', true);
  if (!/^https:\/\/\S+$/i.test(lien)) return respond.fail(interaction, t('systeme.badImage'));

  await respond.defer(interaction, { ephemeral: true });

  try {
    await interaction.client.user.setAvatar(lien);
  } catch (error) {
    return respond.fail(interaction, t('errors.discord', { message: error.message }));
  }
  return respond.ok(interaction, t('systeme.avatarChanged'));
}

async function statut(interaction, t) {
  const type = interaction.options.getString('type', true);
  const texte = interaction.options.getString('texte', true);

  interaction.client.user.setPresence({
    activities: [{ name: texte, type: ACTIVITES[type] }],
    status: 'online',
  });

  // La presence n'est pas persistee : elle repart sur /aide au redemarrage.
  return respond.ok(interaction, t('systeme.statusChanged'), { ephemeral: true });
}

async function sauvegarde(interaction, t) {
  await respond.defer(interaction, { ephemeral: true });

  const guild = interaction.guild;
  const structure = {
    exporte_le: new Date().toISOString(),
    serveur: { id: guild.id, nom: guild.name, membres: guild.memberCount },
    roles: guild.roles.cache
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        nom: role.name,
        position: role.position,
        couleur: role.hexColor,
        permissions: role.permissions.bitfield.toString(),
        affiche: role.hoist,
        mentionnable: role.mentionable,
      })),
    salons: guild.channels.cache.map((channel) => ({
      id: channel.id,
      nom: channel.name,
      type: channel.type,
      parent: channel.parentId,
      position: channel.rawPosition,
    })),
  };

  // Un export sert a reconstruire, pas a restaurer automatiquement : le bot
  // ne recreera jamais un serveur tout seul, c'est trop destructeur.
  const fichier = new AttachmentBuilder(Buffer.from(JSON.stringify(structure, null, 2), 'utf8'), {
    name: `structure-${guild.id}.json`,
  });

  return interaction.editReply({
    ...render.payload(render.success(t('systeme.backupDone', { roles: structure.roles.length, salons: structure.salons.length }))),
    files: [fichier],
  });
}

async function etat(interaction, t, locale) {
  const memoire = process.memoryUsage().heapUsed / 1024 / 1024;

  const panel = render
    .panel(t('systeme.title'))
    .setStats([
      { label: t('info.bot.uptime'), value: duration.format(interaction.client.uptime, locale) },
      { label: t('info.bot.gateway'), value: `${Math.max(0, Math.round(interaction.client.ws.ping))} ms` },
      { label: t('systeme.memory'), value: `${memoire.toFixed(0)} Mo` },
      { label: t('info.bot.guilds'), value: String(interaction.client.guilds.cache.size) },
    ])
    .setFooter(`Node ${process.version}`);

  return respond.show(interaction, panel, { ephemeral: true });
}

async function redemarrer(interaction, t) {
  await respond.ok(interaction, t('systeme.restarting'), { ephemeral: true });

  // Sans superviseur (PM2, systemd), le bot ne se rallume pas tout seul :
  // le message le dit avant de couper.
  logger.info(`Arret demande par ${interaction.user.tag}.`);
  setTimeout(() => process.exit(0), 1000);
}
