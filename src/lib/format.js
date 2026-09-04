'use strict';

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Variables acceptees dans les messages de bienvenue et d'au revoir.
function applyTemplate(template, { member, guild }) {
  const values = {
    membre: member ? `<@${member.id}>` : '',
    pseudo: member ? member.user.username : '',
    tag: member ? member.user.tag : '',
    id: member ? member.id : '',
    serveur: guild ? guild.name : '',
    membres: guild ? String(guild.memberCount) : '0',
  };

  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
}

// Discord tolere les mentions dans un embed mais les traite comme du texte ;
// dans un contenu classique il faut couper @everyone soi-meme.
function stripMassMentions(text) {
  return text.replace(/@(everyone|here)/g, '@​$1');
}

module.exports = { truncate, applyTemplate, stripMassMentions };
