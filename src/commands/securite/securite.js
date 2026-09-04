'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANK, AUTO_ACTIONS } = require('../../constants');
const securityQueries = require('../../database/queries/security');
const words = require('../../modules/security/words');
const lockdown = require('../../modules/lockdown');
const protectionsQueries = require('../../database/queries/protections');
const respond = require('../../core/respond');
const render = require('../../ui/render');
const duration = require('../../lib/duration');

const ACTION_CHOICES = AUTO_ACTIONS.map((value) => ({ name: value, value }));

module.exports = {
  rank: RANK.admin,

  data: new SlashCommandBuilder()
    .setName('securite')
    .setDescription('Protections automatiques du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('etat').setDescription('Résumé de toutes les protections'))
    .addSubcommand((sub) =>
      sub
        .setName('antispam')
        .setDescription('Limite le nombre de messages sur une courte période')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('messages').setDescription('Messages tolérés dans la fenêtre').setMinValue(3).setMaxValue(30),
        )
        .addIntegerOption((o) =>
          o.setName('fenetre').setDescription('Durée de la fenêtre en secondes').setMinValue(2).setMaxValue(60),
        )
        .addStringOption((o) =>
          o.setName('action').setDescription('Réponse appliquée').addChoices(...ACTION_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('liens')
        .setDescription('Bloque les liens et les invitations vers d’autres serveurs')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addStringOption((o) =>
          o.setName('action').setDescription('Réponse appliquée').addChoices(...ACTION_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('domaine')
        .setDescription('Gère la liste des domaines autorisés')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'ajouter', value: 'add' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addStringOption((o) => o.setName('domaine').setDescription('Par exemple github.com')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('mots')
        .setDescription('Gère la liste des mots interdits')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'activer', value: 'on' },
              { name: 'desactiver', value: 'off' },
              { name: 'ajouter', value: 'add' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addStringOption((o) => o.setName('mot').setDescription('Mot ou expression').setMaxLength(60))
        .addStringOption((o) =>
          o.setName('action').setDescription('Réponse appliquée').addChoices(...ACTION_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('mentions')
        .setDescription('Bloque les messages qui mentionnent trop de monde')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('maximum').setDescription('Mentions tolérées par message').setMinValue(2).setMaxValue(20),
        )
        .addStringOption((o) =>
          o.setName('action').setDescription('Réponse appliquée').addChoices(...ACTION_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antiraid')
        .setDescription('Surveille les arrivées massives et les comptes trop récents')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('arrivees').setDescription('Arrivées avant alerte').setMinValue(3).setMaxValue(50),
        )
        .addIntegerOption((o) =>
          o.setName('fenetre').setDescription('Durée de la fenêtre en secondes').setMinValue(5).setMaxValue(300),
        )
        .addStringOption((o) =>
          o.setName('anciennete').setDescription('Âge minimum du compte, par exemple 7j. 0 pour ne pas filtrer'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antinuke')
        .setDescription('Neutralise un membre qui enchaîne les suppressions')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('seuil').setDescription('Actions avant déclenchement').setMinValue(2).setMaxValue(20),
        )
        .addIntegerOption((o) =>
          o.setName('fenetre').setDescription('Durée de la fenêtre en secondes').setMinValue(5).setMaxValue(300),
        )
        .addStringOption((o) =>
          o
            .setName('action')
            .setDescription('Réponse appliquée')
            .addChoices({ name: 'ban', value: 'ban' }, { name: 'kick', value: 'kick' }, { name: 'derank', value: 'derank' }),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antibot')
        .setDescription('Expulse les bots ajoutés sans autorisation')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('action')
            .setDescription('Réponse appliquée')
            .addChoices({ name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' }),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('botautorise')
        .setDescription('Bots qui échappent a l’anti-bot')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'ajouter', value: 'add' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addUserOption((o) => o.setName('bot').setDescription('Le bot concerne')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antiwebhook')
        .setDescription('Supprime les webhooks créés par un non-administrateur')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antiping')
        .setDescription('Interdit de mentionner certains membres')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true))
        .addStringOption((o) =>
          o.setName('action').setDescription('Réponse appliquée').addChoices(...ACTION_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('protege')
        .setDescription('Membres qu’on ne peut pas mentionner')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'ajouter', value: 'add' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addUserOption((o) => o.setName('membre').setDescription('Le membre concerne')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antiadmin')
        .setDescription('Retire les rôles à permissions sensibles donnés à un non-administrateur')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('antivanity')
        .setDescription('Remet en place l’URL personnalisée du serveur si elle change')
        .addBooleanOption((o) => o.setName('actif').setDescription('Active ou coupe la protection').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('lockdown')
        .setDescription('Verrouille ou rouvre tous les salons textuels d’un coup')
        .addBooleanOption((o) =>
          o.setName('ferme').setDescription('Vrai pour tout fermer, faux pour tout rouvrir').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('raison').setDescription('Motif affiche dans le journal d’audit').setMaxLength(400),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('exemption')
        .setDescription('Rôles ignorés par toutes les protections')
        .addStringOption((o) =>
          o
            .setName('operation')
            .setDescription('Ce qu’il faut faire')
            .setRequired(true)
            .addChoices(
              { name: 'ajouter', value: 'add' },
              { name: 'retirer', value: 'remove' },
              { name: 'lister', value: 'list' },
            ),
        )
        .addRoleOption((o) => o.setName('role').setDescription('Le rôle concerne')),
    ),

  async run(interaction, { t, locale }) {
    const guildId = interaction.guild.id;
    const settings = securityQueries.get(guildId);

    switch (interaction.options.getSubcommand()) {
      case 'etat':
        return status(interaction, settings, t, locale);
      case 'antispam':
        return antispam(interaction, t);
      case 'liens':
        return links(interaction, t);
      case 'domaine':
        return domains(interaction, settings, t);
      case 'mots':
        return badWords(interaction, t);
      case 'mentions':
        return mentions(interaction, t);
      case 'antiraid':
        return antiraid(interaction, t);
      case 'antinuke':
        return antinuke(interaction, t);
      case 'antibot':
        return antibot(interaction, t);
      case 'botautorise':
        return allowedBots(interaction, t);
      case 'antiwebhook':
        return antiwebhook(interaction, t);
      case 'antiping':
        return antiping(interaction, t);
      case 'protege':
        return protectedMembers(interaction, t);
      case 'antiadmin':
        return simpleToggle(interaction, t, 'admin_enabled');
      case 'antivanity':
        return antivanity(interaction, t);
      case 'lockdown':
        return serverLockdown(interaction, t);
      default:
        return exemptions(interaction, settings, t);
    }
  },
};

function onOff(value, t) {
  return t(value ? 'common.on' : 'common.off');
}

async function status(interaction, settings, t, locale) {
  const wordList = securityQueries.words(interaction.guild.id);

  const embed = render
    .info('', t('security.status.title'))
    .addFields(
      {
        name: t('security.spam.name'),
        value: `${onOff(settings.spam_enabled, t)} · ${settings.spam_messages} / ${Math.round(settings.spam_window_ms / 1000)}s · ${settings.spam_action}`,
      },
      {
        name: t('security.links.name'),
        value: `${onOff(settings.links_enabled, t)} · ${settings.links_action} · ${settings.links_allowlist.length} ${t('security.status.allowed')}`,
      },
      {
        name: t('security.words.name'),
        value: `${onOff(settings.words_enabled, t)} · ${settings.words_action} · ${wordList.length} ${t('security.status.entries')}`,
      },
      {
        name: t('security.mentions.name'),
        value: `${onOff(settings.mentions_enabled, t)} · ${settings.mentions_max} max · ${settings.mentions_action}`,
      },
      {
        name: t('security.raid.name'),
        value: `${onOff(settings.raid_enabled, t)} · ${settings.raid_joins} / ${Math.round(settings.raid_window_ms / 1000)}s · ${settings.raid_account_age_ms ? duration.format(settings.raid_account_age_ms, locale) : t('security.status.noAgeFilter')}`,
      },
      {
        name: t('security.nuke.name'),
        value: `${onOff(settings.nuke_enabled, t)} · ${settings.nuke_threshold} / ${Math.round(settings.nuke_window_ms / 1000)}s · ${settings.nuke_action}`,
      },
      {
        name: t('security.bots.name'),
        value: `${onOff(settings.bots_enabled, t)} · ${settings.bots_action} · ${protectionsQueries.allowedBots(interaction.guild.id).length} ${t('security.bots.allowedCount')}`,
      },
      {
        name: t('security.webhooks.name'),
        value: onOff(settings.webhooks_enabled, t),
      },
      {
        name: t('security.pings.name'),
        value: `${onOff(settings.pings_enabled, t)} · ${settings.pings_action} · ${protectionsQueries.protectedMembers(interaction.guild.id).length} ${t('security.pings.protectedCount')}`,
      },
      {
        name: t('security.admin.name'),
        value: onOff(settings.admin_enabled, t),
      },
      {
        name: t('security.vanity.name'),
        value: `${onOff(settings.vanity_enabled, t)}${settings.vanity_code ? ` · \`${settings.vanity_code}\`` : ''}`,
      },
      {
        name: t('security.status.exempt'),
        value: settings.exempt_roles.length
          ? settings.exempt_roles.map((id) => `<@&${id}>`).join(' ')
          : t('common.none'),
      },
    );

  return respond.show(interaction, embed, { ephemeral: true });
}

async function antispam(interaction, t) {
  const changes = { spam_enabled: interaction.options.getBoolean('actif', true) };

  const messages = interaction.options.getInteger('messages');
  const window = interaction.options.getInteger('fenetre');
  const action = interaction.options.getString('action');

  if (messages) changes.spam_messages = messages;
  if (window) changes.spam_window_ms = window * 1000;
  if (action) changes.spam_action = action;

  securityQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function links(interaction, t) {
  const changes = { links_enabled: interaction.options.getBoolean('actif', true) };
  const action = interaction.options.getString('action');
  if (action) changes.links_action = action;

  securityQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function domains(interaction, settings, t) {
  const operation = interaction.options.getString('operation', true);
  const raw = interaction.options.getString('domaine');

  if (operation === 'list') {
    const list = settings.links_allowlist;
    return respond.show(
      interaction,
      render.info(list.length ? list.map((d) => `\`${d}\``).join(', ') : t('common.none'), t('security.links.allowlist')),
      { ephemeral: true },
    );
  }

  if (!raw) return respond.fail(interaction, t('security.links.missingDomain'));

  // On accepte une URL complete et on n'en garde que l'hote.
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    return respond.fail(interaction, t('security.links.badDomain', { input: raw }));
  }

  const list = new Set(settings.links_allowlist);
  if (operation === 'add') list.add(host);
  else list.delete(host);

  securityQueries.update(interaction.guild.id, { links_allowlist: [...list] });
  return respond.ok(
    interaction,
    t(operation === 'add' ? 'security.links.added' : 'security.links.removed', { domain: host }),
    { ephemeral: true },
  );
}

async function badWords(interaction, t) {
  const guildId = interaction.guild.id;
  const operation = interaction.options.getString('operation', true);
  const word = interaction.options.getString('mot');
  const action = interaction.options.getString('action');

  if (operation === 'on' || operation === 'off') {
    const changes = { words_enabled: operation === 'on' };
    if (action) changes.words_action = action;
    securityQueries.update(guildId, changes);
    return respond.ok(interaction, t('security.saved'), { ephemeral: true });
  }

  if (operation === 'list') {
    const list = securityQueries.words(guildId);
    return respond.show(
      interaction,
      render.info(list.length ? `||${list.join(', ')}||` : t('common.none'), t('security.words.name')),
      { ephemeral: true },
    );
  }

  if (!word) return respond.fail(interaction, t('security.words.missingWord'));

  const changed =
    operation === 'add' ? securityQueries.addWord(guildId, word) : securityQueries.removeWord(guildId, word);
  words.forget(guildId);

  if (!changed) {
    return respond.fail(
      interaction,
      t(operation === 'add' ? 'security.words.alreadyThere' : 'security.words.notThere'),
    );
  }
  return respond.ok(
    interaction,
    t(operation === 'add' ? 'security.words.added' : 'security.words.removed'),
    { ephemeral: true },
  );
}

async function mentions(interaction, t) {
  const changes = { mentions_enabled: interaction.options.getBoolean('actif', true) };
  const max = interaction.options.getInteger('maximum');
  const action = interaction.options.getString('action');

  if (max) changes.mentions_max = max;
  if (action) changes.mentions_action = action;

  securityQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function antiraid(interaction, t) {
  const changes = { raid_enabled: interaction.options.getBoolean('actif', true) };

  const joins = interaction.options.getInteger('arrivees');
  const window = interaction.options.getInteger('fenetre');
  const age = interaction.options.getString('anciennete');

  if (joins) changes.raid_joins = joins;
  if (window) changes.raid_window_ms = window * 1000;

  if (age !== null) {
    if (age === '0') {
      changes.raid_account_age_ms = 0;
    } else {
      const parsed = duration.parse(age);
      if (!parsed) return respond.fail(interaction, t('errors.badDuration', { input: age }));
      changes.raid_account_age_ms = parsed;
    }
  }

  securityQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function antinuke(interaction, t) {
  const changes = { nuke_enabled: interaction.options.getBoolean('actif', true) };

  const threshold = interaction.options.getInteger('seuil');
  const window = interaction.options.getInteger('fenetre');
  const action = interaction.options.getString('action');

  if (threshold) changes.nuke_threshold = threshold;
  if (window) changes.nuke_window_ms = window * 1000;
  if (action) changes.nuke_action = action;

  securityQueries.update(interaction.guild.id, changes);

  const notice = changes.nuke_enabled && !interaction.guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)
    ? `\n${t('security.nuke.needsAuditLog')}`
    : '';

  return respond.ok(interaction, `${t('security.saved')}${notice}`, { ephemeral: true });
}

async function antibot(interaction, t) {
  const changes = { bots_enabled: interaction.options.getBoolean('actif', true) };
  const action = interaction.options.getString('action');
  if (action) changes.bots_action = action;

  securityQueries.update(interaction.guild.id, changes);

  const notice = changes.bots_enabled && !interaction.guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)
    ? `\n${t('security.bots.needsAuditLog')}`
    : '';
  return respond.ok(interaction, `${t('security.saved')}${notice}`, { ephemeral: true });
}

async function allowedBots(interaction, t) {
  const guildId = interaction.guild.id;
  const operation = interaction.options.getString('operation', true);

  if (operation === 'list') {
    const list = protectionsQueries.allowedBots(guildId);
    const text = list.length ? list.map((id) => `<@${id}>`).join(' ') : t('common.none');
    return respond.show(interaction, render.info(text, t('security.bots.allowed')), { ephemeral: true });
  }

  const bot = interaction.options.getUser('bot');
  if (!bot) return respond.fail(interaction, t('security.bots.missingBot'));
  if (!bot.bot) return respond.fail(interaction, t('security.bots.notABot', { user: bot.tag }));

  if (operation === 'add') protectionsQueries.allowBot(guildId, bot.id);
  else protectionsQueries.disallowBot(guildId, bot.id);

  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function antiwebhook(interaction, t) {
  securityQueries.update(interaction.guild.id, {
    webhooks_enabled: interaction.options.getBoolean('actif', true),
  });

  const me = interaction.guild.members.me;
  const missing = !me.permissions.has(PermissionFlagsBits.ManageWebhooks) || !me.permissions.has(PermissionFlagsBits.ViewAuditLog);
  const notice = missing ? `\n${t('security.webhooks.needsPermissions')}` : '';

  return respond.ok(interaction, `${t('security.saved')}${notice}`, { ephemeral: true });
}

async function antiping(interaction, t) {
  const changes = { pings_enabled: interaction.options.getBoolean('actif', true) };
  const action = interaction.options.getString('action');
  if (action) changes.pings_action = action;

  securityQueries.update(interaction.guild.id, changes);
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function protectedMembers(interaction, t) {
  const guildId = interaction.guild.id;
  const operation = interaction.options.getString('operation', true);

  if (operation === 'list') {
    const list = protectionsQueries.protectedMembers(guildId);
    const text = list.length ? list.map((id) => `<@${id}>`).join(' ') : t('common.none');
    return respond.show(interaction, render.info(text, t('security.pings.protected')), { ephemeral: true });
  }

  const user = interaction.options.getUser('membre');
  if (!user) return respond.fail(interaction, t('security.pings.missingMember'));

  if (operation === 'add') protectionsQueries.protect(guildId, user.id, interaction.user.id);
  else protectionsQueries.unprotect(guildId, user.id);

  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

// Bascule sans réglage annexe : la sous-commande n'a qu'une option "actif".
async function simpleToggle(interaction, t, column) {
  securityQueries.update(interaction.guild.id, { [column]: interaction.options.getBoolean('actif', true) });
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function antivanity(interaction, t) {
  const actif = interaction.options.getBoolean('actif', true);
  const changes = { vanity_enabled: actif };

  // On mémorise le code en place au moment où la protection est activée :
  // c'est lui qui sera remis si quelqu'un le change.
  if (actif) changes.vanity_code = interaction.guild.vanityURLCode || null;

  securityQueries.update(interaction.guild.id, changes);

  if (actif && !interaction.guild.vanityURLCode) {
    return respond.ok(interaction, `${t('security.saved')}\n${t('security.vanity.noneYet')}`, { ephemeral: true });
  }
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}

async function serverLockdown(interaction, t) {
  const locked = interaction.options.getBoolean('ferme', true);
  const reason = interaction.options.getString('raison') || t('security.lockdown.defaultReason');

  // Un serveur d'une cinquantaine de salons depasse largement les trois
  // secondes accordees : chaque salon est une requete a part.
  await respond.defer(interaction);

  const result = await lockdown.apply(interaction.guild, locked, `${interaction.user.tag} — ${reason}`);
  if (result.error) return respond.fail(interaction, t('errors.botMissingPermission'));

  return respond.ok(
    interaction,
    t(locked ? 'security.lockdown.locked' : 'security.lockdown.unlocked', {
      changed: result.changed,
      total: result.total,
    }),
  );
}

async function exemptions(interaction, settings, t) {
  const operation = interaction.options.getString('operation', true);
  const role = interaction.options.getRole('role');

  if (operation === 'list') {
    return respond.show(
      interaction,
      render.info(
        settings.exempt_roles.length ? settings.exempt_roles.map((id) => `<@&${id}>`).join(' ') : t('common.none'),
        t('security.status.exempt'),
      ),
      { ephemeral: true },
    );
  }

  if (!role) return respond.fail(interaction, t('security.missingRole'));

  const list = new Set(settings.exempt_roles);
  if (operation === 'add') list.add(role.id);
  else list.delete(role.id);

  securityQueries.update(interaction.guild.id, { exempt_roles: [...list] });
  return respond.ok(interaction, t('security.saved'), { ephemeral: true });
}
