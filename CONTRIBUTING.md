# Contribuer

Les issues et les pull requests sont les bienvenues.

## Avant d'ouvrir une PR

```bash
npm test
```

Les tests tournent sans token et sans base réelle, ils doivent passer en
local. Ceux qui vérifient les fichiers de langue et les définitions de
commandes échouent souvent en premier : c'est voulu, ils attrapent les oublis
avant que Discord ne rejette le déploiement.

## Ajouter une commande

Un fichier dans `src/commands/<catégorie>/`, exportant `data` (un
`SlashCommandBuilder`), `rank` et `run`. Le chargeur le repère au démarrage et
le dossier devient sa catégorie dans `/aide` : il n'y a aucune liste à mettre à
jour ailleurs.

```js
module.exports = {
  rank: RANK.moderator,
  botPermissions: [PermissionFlagsBits.ManageMessages],
  data: new SlashCommandBuilder().setName('exemple').setDescription('…'),
  async run(interaction, { t, locale }) { … },
};
```

`rank` peut être complété par `subcommandRanks` pour abaisser le rang d'une
sous-commande précise, comme le fait `/ticket fermer`.

Quatre règles qui évitent la plupart des allers-retours en relecture :

- La description française s'écrit dans le builder, la traduction anglaise sous
  `commands.<nom>` dans `locales/en.json` — options de sous-commandes
  comprises, sous `commands.<nom>.<sous-commande>.<option>`.
- Aucun texte affiché en dur : tout passe par `t('cle')`, et la clé existe dans
  `locales/fr.json`.
- Aucune embed : tout message se construit avec `src/ui/render.js` et part par
  `render.payload(...)` ou par `src/core/respond.js`.
- L'action elle-même vit dans `src/modules/`, la commande se contente de lire
  les options et de répondre.
- Un import venant de `src/database/queries/` se nomme `<domaine>Queries`.

Avant d'ajouter une commande, regarde si elle n'est pas une sous-commande
d'une commande existante. Le menu `/` de Discord est un espace partagé par
tous les bots d'un serveur : vingt entrées bien nommées valent mieux que
quarante.

## Ajouter une langue

Copie `locales/fr.json` sous le code de la langue, traduis les valeurs, garde
les variables `{entre_accolades}` telles quelles. Le test de cohérence des
langues vérifie que rien ne manque.

## Style

Pas de linter imposé. Deux espaces d'indentation, guillemets simples,
point-virgules. Les commentaires expliquent pourquoi, pas quoi — si un
commentaire répète la ligne en dessous, il saute.
