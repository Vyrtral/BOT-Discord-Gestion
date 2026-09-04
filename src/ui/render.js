'use strict';

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');
const { ACCENT } = require('./theme');

// ---------------------------------------------------------------------------
// Rendu de tous les messages du bot, en Components V2.
//
// Il n'y a aucune embed classique dans ce projet. Chaque message est un
// Container : barre d'accent, titre en "## ", contenu en lignes
// "• **Label**" / "↳ valeur", separateur, pied de page en petit texte.
//
// La classe garde une API a chainage proche de EmbedBuilder — setTitle,
// setDescription, addField... — pour que le code appelant reste lisible sans
// manipuler les composants a la main.
// ---------------------------------------------------------------------------

const FIELD_VALUE_MAX = 1000;

// Une ligne de contenu au format maison.
function line(label, value) {
  if (value === undefined || value === null || value === '') return `• **${label}**`;
  const text = String(value).slice(0, FIELD_VALUE_MAX);
  return `• **${label}**\n↳ ${text}`;
}

// Plusieurs lignes, separees par une ligne vide.
function blocks(entries) {
  return entries
    .map((entry) => (typeof entry === 'string' ? entry : line(entry.label, entry.value)))
    .join('\n\n');
}

class Panel {
  constructor(title) {
    this.accent = ACCENT.base;
    this.title = title || null;
    this.above = null;
    this.body = null;
    this.fields = [];
    this.stats = null;
    this.thumbnail = null;
    this.image = null;
    this.footer = null;
    this.dated = false;
  }

  setAccent(color) {
    this.accent = color;
    return this;
  }

  setTitle(title) {
    this.title = title;
    return this;
  }

  // Petite ligne au-dessus du titre, l'equivalent de l'auteur d'une embed.
  setAbove(text) {
    this.above = text || null;
    return this;
  }

  setBody(text) {
    this.body = text || null;
    return this;
  }

  // --- Alias de l'API EmbedBuilder ---------------------------------------
  // Les containers V2 n'ont ni description, ni auteur, ni champs, ni
  // horodatage. Ces alias evitent d'avoir a tordre chaque appelant : le code
  // des commandes reste lisible, la conversion se fait ici.

  setDescription(text) {
    return this.setBody(text);
  }

  setColor(color) {
    return this.setAccent(color);
  }

  setAuthor(author) {
    return this.setAbove(typeof author === 'string' ? author : author?.name);
  }

  setTimestamp() {
    return this.setDated();
  }

  addField(label, value) {
    this.fields.push({ label, value });
    return this;
  }

  // Remplace la liste au lieu de l'allonger, comme setFields sur une embed.
  setFields(...entries) {
    this.fields = [];
    return this.addFields(...entries);
  }

  // Accepte aussi bien addFields({...}, {...}) que addFields([{...}]), et les
  // champs au format embed ({ name, value }) que maison ({ label, value }).
  // Le drapeau "inline" est ignore : un container n'a pas de colonnes.
  addFields(...entries) {
    for (const entry of entries.flat()) {
      if (!entry) continue;
      this.fields.push({ label: entry.label ?? entry.name, value: entry.value });
    }
    return this;
  }

  // Bandeau de gros chiffres facon tableau de bord : chaque entree devient
  // "### valeur" surmontant son libelle en petit texte.
  setStats(entries) {
    this.stats = entries && entries.length ? entries : null;
    return this;
  }

  setThumbnail(url) {
    this.thumbnail = url || null;
    return this;
  }

  setImage(url) {
    this.image = url || null;
    return this;
  }

  setFooter(footer) {
    this.footer = (typeof footer === 'string' ? footer : footer?.text) || null;
    return this;
  }

  setDated() {
    this.dated = true;
    return this;
  }

  toContainer() {
    const container = new ContainerBuilder().setAccentColor(this.accent);

    const head = [];
    if (this.above) head.push(`-# ${this.above}`);
    if (this.title) head.push(`## ${this.title}`);
    if (this.body) head.push(this.body);
    if (this.fields.length) head.push(blocks(this.fields));

    if (head.length) {
      const text = new TextDisplayBuilder().setContent(head.join('\n\n'));

      // Une Section accepte un seul accessoire : la vignette. Sans vignette,
      // le texte part directement dans le container.
      if (this.thumbnail) {
        container.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(text)
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(this.thumbnail)),
        );
      } else {
        container.addTextDisplayComponents(text);
      }
    }

    if (this.stats) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      );
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          this.stats.map((s) => `### ${s.value}\n-# ${s.label}`).join('\n\n'),
        ),
      );
    }

    if (this.image) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(this.image)),
      );
    }

    if (this.footer || this.dated) {
      const parts = [];
      if (this.footer) parts.push(this.footer);
      if (this.dated) parts.push(`<t:${Math.floor(Date.now() / 1000)}:f>`);

      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
      );
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parts.join(' — ')}`));
    }

    return container;
  }
}

function panel(title) {
  return new Panel(title);
}

// Transforme un Panel (ou plusieurs) en payload prêt à envoyer. Les boutons
// et menus passes en 2e argument entrent DANS le container, pas en dessous.
//
// allowedMentions est vide par defaut : en Components V2 un "<@id>" ecrit
// dans un TextDisplay notifie reellement, contrairement a la description
// d'une embed. Un log de sanction pingueait donc le sanctionne a chaque
// ligne. La mention reste affichee et cliquable, sans notification. Un
// appelant qui veut vraiment notifier passe son propre allowedMentions.
function payload(panels, rows = [], { ephemeral = false, extraFlags = 0, allowedMentions = { parse: [] } } = {}) {
  const list = Array.isArray(panels) ? panels : [panels];
  const containers = list.map((p) => p.toContainer());

  if (rows.length && containers.length) {
    containers[containers.length - 1].addActionRowComponents(...rows);
  }

  let flags = MessageFlags.IsComponentsV2 | extraFlags;
  if (ephemeral) flags |= MessageFlags.Ephemeral;

  return { components: containers, flags, allowedMentions };
}

// Raccourcis pour les trois reponses les plus frequentes.
const { MARKS } = require('./theme');

const success = (text, title) => panel(title).setAccent(ACCENT.success).setBody(`${MARKS.success} ${text}`);
const failure = (text, title) => panel(title).setAccent(ACCENT.danger).setBody(`${MARKS.danger} ${text}`);
const caution = (text, title) => panel(title).setAccent(ACCENT.warning).setBody(`${MARKS.warning} ${text}`);

// Panneau neutre : un corps de texte et, en option, un titre.
const info = (body, title) => panel(title).setBody(body);
const neutral = (title) => panel(title);
const base = (accent) => panel().setAccent(accent);

module.exports = {
  Panel,
  panel,
  payload,
  line,
  blocks,
  info,
  neutral,
  base,
  success,
  failure,
  caution,
  FIELD_VALUE_MAX,
};
