'use strict';

const core = require('./index');

const URL_PATTERN = /https?:\/\/([^\s/$.?#]+\.[^\s]*)/gi;
const INVITE_PATTERN = /(discord\.(gg|io|me|li)|discord(?:app)?\.com\/invite)\/[\w-]+/i;

function domainsIn(content) {
  const found = new Set();
  for (const match of content.matchAll(URL_PATTERN)) {
    const host = match[1].toLowerCase().replace(/^www\./, '').split('/')[0];
    found.add(host);
  }
  return [...found];
}

// Un domaine autorise couvre ses sous-domaines : "github.com" laisse passer
// "gist.github.com". Attention, "githubusercontent.com" est un autre domaine,
// il faut l'ajouter separement.
function isAllowed(host, allowlist) {
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

async function handle(message, settings) {
  if (!settings.links_enabled) return false;
  if (core.isExempt(message.member, settings)) return false;

  const content = message.content || '';
  const invite = INVITE_PATTERN.test(content);
  const blocked = domainsIn(content).filter((host) => !isAllowed(host, settings.links_allowlist));

  if (!invite && !blocked.length) return false;

  await message.delete().catch(() => null);

  if (settings.links_action !== 'delete') {
    await core.punish(message.member, settings.links_action, {
      reason: invite ? 'Invitation externe' : 'Lien non autorise',
    });
  }

  await core.report(message.guild, {
    titleKey: invite ? 'security.links.invite' : 'security.links.blocked',
    member: message.member,
    detail: blocked.length ? blocked.join(', ') : null,
    action: settings.links_action,
  });

  return true;
}

module.exports = { handle, domainsIn, isAllowed };
