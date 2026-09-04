# Gestion

Bot de gestion pour serveurs Discord : modération, protections automatiques,
tickets, journalisation, niveaux, invitations et salons vocaux temporaires.

Commandes slash uniquement, base SQLite, interface en français avec bascule en
anglais serveur par serveur, et **tout l'affichage en Components V2** — aucune
embed classique dans le projet.

![Node](https://img.shields.io/badge/node-%3E%3D20-informational)
![discord.js](https://img.shields.io/badge/discord.js-v14-blue)
![Licence](https://img.shields.io/badge/licence-MIT-green)

---

## Sommaire

- [Ce que le bot sait faire](#ce-que-le-bot-sait-faire)
- [Installation](#installation)
- [Configuration](#configuration)
- [Toutes les commandes](#toutes-les-commandes)
- [Rangs et permissions](#rangs-et-permissions)
- [Comment le bot fonctionne](#comment-le-bot-fonctionne)
- [Langue](#langue)
- [Données et sauvegarde](#données-et-sauvegarde)
- [Tests](#tests)
- [Limites connues](#limites-connues)
- [Feuille de route](#feuille-de-route)
- [Licence](#licence)

---

## Ce que le bot sait faire

| Domaine | Détail |
|---|---|
| **Modération** | ban permanent ou temporaire, kick, mute, warn, purge de messages, verrouillage, masquage, renouvellement de salon, mode lent, gestion des rôles et surnoms |
| **Historique** | chaque sanction est numérotée et consultable ; une sanction levée reste dans l'historique au lieu de disparaître |
| **Blacklist** | bannissement définitif : un déban manuel depuis Discord rebannit immédiatement |
| **Sécurité** | antispam, filtre de liens et d'invitations, mots interdits, anti mass-mention, anti-ping, anti-bot, anti-webhook, anti-admin, anti-vanity, antiraid, antinuke, verrouillage général |
| **Vocal** | déplacement, déconnexion, mute vocal, rassemblement d'un salon dans le sien, anti-join avec whitelist, interdiction de vocal |
| **Vocaux temporaires** | un salon d'entrée qui crée un salon privé dont le membre est propriétaire, supprimé dès qu'il se vide |
| **Tickets** | panneau à sujets, salons privés, prise en charge, transcript déposé à la fermeture |
| **Journalisation** | messages, membres, rôles, salons, vocal, sanctions, sécurité — un salon par catégorie |
| **Niveaux** | xp par message et par minute de vocal, rôles de niveau cumulatifs, classement paginé |
| **Invitations** | qui a invité qui, classement, bonus manuel, décompte au départ du membre |
| **Accueil** | message d'arrivée et de départ avec variables, message privé, rôles automatiques |
| **Compteurs** | salons vocaux dont le nom affiche membres, humains, bots, boosts ou personnes en vocal |
| **Snipe** | dernier message supprimé ou modifié d'un salon, gardé deux heures en mémoire |
| **Interdictions** | un rôle interdit à un membre lui est retiré dès qu'on le lui donne |
| **Administration** | `/systeme` : nom, avatar, statut, export de la structure du serveur, redémarrage |

**31 commandes, 110 actions.** `/aide` ouvre un panneau à sélecteur : on choisit
une catégorie et le bot liste ce que le rang de **celui qui clique** lui donne
le droit d'utiliser.

---

## Installation

### Prérequis

- Node.js 20 ou plus récent (testé jusqu'à Node 24)
- Un compte sur le [portail développeur Discord](https://discord.com/developers/applications)

### 1. Récupérer le code

```bash
git clone https://github.com/<ton-compte>/gestion.git
cd gestion
npm install
```

`better-sqlite3` télécharge un binaire précompilé pour ta version de Node. S'il
n'en trouve pas, il compile depuis les sources et réclame alors
`build-essential` et `python3` (Debian/Ubuntu) ou les Xcode Command Line Tools
(macOS).

> **Avec pnpm**, l'installation s'arrête sur `ERR_PNPM_IGNORED_BUILDS` : pnpm 10
> bloque les scripts d'installation par défaut. Lance `pnpm approve-builds`,
> puis **espace** pour cocher `better-sqlite3`, entrée, `y`. Enchaîner sans
> cocher inscrit le paquet en `false`, le binaire n'est jamais construit, et le
> bot démarre pour échouer sur `Could not locate the bindings file`. En cas de
> doute, `npm install` n'a pas ce garde-fou.

### 2. Créer l'application Discord

Sur le portail développeur : **New Application**, puis onglet **Bot**.

Deux cases à cocher dans **Privileged Gateway Intents** :

| Intent | Sans lui |
|---|---|
| **Server Members** | ni accueil, ni logs d'arrivée, ni antiraid, ni anti-bot |
| **Message Content** | l'antispam et le filtre de mots ne voient que des messages vides |
| Presence | rien — le bot ne s'en sert pas, laisse-le décoché |

Copie le token avec **Reset Token**. Il ne s'affiche qu'une fois.

### 3. Inviter le bot

```
https://discord.com/api/oauth2/authorize?client_id=TON_APP_ID&permissions=1375351205046&scope=bot%20applications.commands
```

Le second scope, `applications.commands`, est obligatoire : sans lui aucune
commande n'apparaît, et l'enregistrement échoue sur un 403 muet.

> **Place le rôle du bot au-dessus des rôles qu'il devra gérer.** Discord ne
> laisse jamais un bot agir sur quelqu'un situé plus haut que lui, quelles que
> soient ses permissions.

### 4. Lancer

```bash
cp config.example.js config.js
nano config.js
npm start
```

Les commandes sont enregistrées automatiquement à chaque démarrage. En
production, avec PM2 :

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

Au démarrage, tu dois lire :

```
[INFO] Langues chargees : en, fr.
[INFO] 4 migration(s) appliquee(s).
[INFO] 31 commandes et 21 evenements charges.
[INFO] 31 commandes enregistrees (portee serveur).
[INFO] Connecte en tant que MonBot#0000 sur 1 serveur(s).
```

Les cinq lignes, dans cet ordre. La quatrième absente : le bot n'est pas sur le
serveur `GUILD_ID`, ou le scope `applications.commands` manque. La cinquième
absente : le token est refusé.

---

## Configuration

Tout tient dans `config.js`, à la racine. **Il n'y a pas de `.env`.**

```js
module.exports = {
  TOKEN: '',                     // Bot > Reset Token
  APP_ID: '',                    // General Information > Application ID
  SYS_ID: '',                    // ton identifiant Discord
  DATA: './data/gestion.db',     // fichier de base
  GUILD_ID: '',                  // serveur de déploiement des commandes
  LANGUE: 'fr',
};
```

| Clé | Rôle |
|---|---|
| `TOKEN` | le token du bot. **Le seul secret du projet** |
| `APP_ID` | l'identifiant de l'application, pour enregistrer les commandes |
| `SYS_ID` | ton identifiant Discord. Donne le rang le plus haut. **Vide, personne ne l'a — y compris toi** |
| `DATA` | chemin de la base. Relatif à la racine, ou absolu |
| `GUILD_ID` | serveur où déployer. Vide = déploiement global |
| `LANGUE` | langue par défaut des serveurs qui n'ont pas choisi la leur |

Pour récupérer un identifiant : Paramètres Discord → Avancés → **Mode
développeur**, puis clic droit → « Copier l'identifiant ».

`GUILD_ID` rempli, les commandes n'existent que sur ce serveur et apparaissent
**immédiatement**. Vide, elles partent en global et Discord met jusqu'à une
heure à les propager. Attention : le déploiement remplace le lot **dans une
seule portée** — passer de serveur à global laisse les anciennes en place et
tu les vois en double.

En production, range la base hors du dossier de code :

```js
DATA: '/root/gestion-data/gestion.db',
```

Réextraire le bot n'effacera alors jamais tes données.

> `config.js` contient le token, il est ignoré par git. C'est
> `config.example.js` qui part sur le dépôt.

### Mise en route d'un serveur

Le minimum utile, dans l'ordre :

```
/logs tout salon:#journal
/config staff definir role:@Staff rang:moderateur
/securite antispam actif:true
/securite antiraid actif:true anciennete:7j
/securite antibot actif:true
/bienvenue arrivee actif:true salon:#bienvenue
```

Tickets :

```
/ticket reglages categorie:Support staff:@Staff transcripts:#archives
/ticket sujet operation:ajouter libelle:"Problème technique" emoji:🔧
/ticket panneau salon:#aide
```

Niveaux :

```
/xp reglages actif:true message:15 vocal:5 annonce:"salon dedie" salon:#niveaux
/xp recompense operation:definir niveau:5 role:@Habitué
```

---

## Toutes les commandes

Ce tableau est **généré depuis le code** (`npm run commandes`), il ne peut pas
se désynchroniser des commandes réellement présentes.

### Modération

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/ban` | Modérateur | Bannit un membre du serveur |
| `/blacklist ajouter` | Admin | Bannit et inscrit le compte sur la liste |
| `/blacklist liste` | Admin | Comptes inscrits |
| `/blacklist retirer` | Admin | Retire de la liste et débannit |
| `/blacklist vider` | Admin | Vide la liste, sans débannir |
| `/clear` | Modérateur | Supprime des messages du salon |
| `/dire panneau` | Admin | Un message encadré, au style du bot |
| `/dire texte` | Admin | Un message simple, sans mise en forme |
| `/kick` | Modérateur | Expulse un membre du serveur |
| `/mute` | Modérateur | Rend un membre muet pendant une durée donnée |
| `/role ajouter` | Modérateur | Donne un rôle a un membre |
| `/role autoriser` | Modérateur | Lève l’interdiction d’un rôle |
| `/role interdire` | Modérateur | Interdit un rôle à un membre : il lui est retiré dès qu’on le lui donne |
| `/role retirer` | Modérateur | Retire un rôle a un membre |
| `/role surnom` | Modérateur | Change le surnom d’un membre |
| `/salon lent` | Modérateur | Définit le délai entre deux messages |
| `/salon masquer` | Modérateur | Cache ou réaffiche le salon a @everyone |
| `/salon renouveler` | Modérateur | Clone le salon et supprime l’ancien : tout l’historique disparaît |
| `/salon verrouiller` | Modérateur | Empêche ou réautorise @everyone a écrire |
| `/sanctions retirer` | Modérateur | Retire une sanction de l’historique |
| `/sanctions vider` | Modérateur | Efface tout l’historique d’un membre |
| `/sanctions voir` | Modérateur | Affiche l’historique d’un membre |
| `/snipe` | Modérateur | Affiche le dernier message supprime ou modifié du salon |
| `/systeme avatar` | Système | Change l’avatar du bot |
| `/systeme etat` | Système | Latence, mémoire et durée de fonctionnement |
| `/systeme nom` | Système | Change le nom du bot |
| `/systeme redemarrer` | Système | Arrête le bot. Il ne repart que si un superviseur le relance |
| `/systeme sauvegarde` | Système | Exporte la structure du serveur en JSON |
| `/systeme statut` | Système | Change l’activité affichée |
| `/unban` | Modérateur | Lève le bannissement d’un compte |
| `/unmute` | Modérateur | Rend la parole a un membre |
| `/warn` | Modérateur | Avertit un membre et enregistre l’avertissement |

### Vocal

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/antijoin deverrouiller` | Modérateur | Rouvre un salon vocal |
| `/antijoin liste` | Modérateur | Salons vocaux verrouillés |
| `/antijoin verrouiller` | Modérateur | Personne ne peut plus rejoindre ce salon |
| `/antijoin vider` | Modérateur | Déverrouille tous les salons vocaux |
| `/vocal autoriser` | Modérateur | Rend l’accès au vocal à un membre |
| `/vocal deconnecter` | Modérateur | Déconnecte un membre du vocal |
| `/vocal deplacer` | Modérateur | Déplace un membre dans un salon vocal |
| `/vocal interdire` | Modérateur | Interdit le vocal à un membre : il est déconnecté dès qu’il rejoint |
| `/vocal interdits` | Modérateur | Membres interdits de vocal |
| `/vocal muet` | Modérateur | Coupe le micro d’un membre en vocal |
| `/vocal parler` | Modérateur | Rend le micro a un membre |
| `/vocal rassembler` | Modérateur | Amène tout un salon vocal dans le tien |
| `/wl ajouter` | Modérateur | Autorise un membre a rejoindre un salon verrouillé |
| `/wl liste` | Modérateur | Membres autorisés |
| `/wl retirer` | Modérateur | Retire un membre de la liste |
| `/wl vider` | Modérateur | Vide entièrement la liste |

### Sécurité

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/securite antiadmin` | Admin | Retire les rôles à permissions sensibles donnés à un non-administrateur |
| `/securite antibot` | Admin | Expulse les bots ajoutés sans autorisation |
| `/securite antinuke` | Admin | Neutralise un membre qui enchaîne les suppressions |
| `/securite antiping` | Admin | Interdit de mentionner certains membres |
| `/securite antiraid` | Admin | Surveille les arrivées massives et les comptes trop récents |
| `/securite antispam` | Admin | Limite le nombre de messages sur une courte période |
| `/securite antivanity` | Admin | Remet en place l’URL personnalisée du serveur si elle change |
| `/securite antiwebhook` | Admin | Supprime les webhooks créés par un non-administrateur |
| `/securite botautorise` | Admin | Bots qui échappent a l’anti-bot |
| `/securite domaine` | Admin | Gère la liste des domaines autorisés |
| `/securite etat` | Admin | Résumé de toutes les protections |
| `/securite exemption` | Admin | Rôles ignorés par toutes les protections |
| `/securite liens` | Admin | Bloque les liens et les invitations vers d’autres serveurs |
| `/securite lockdown` | Admin | Verrouille ou rouvre tous les salons textuels d’un coup |
| `/securite mentions` | Admin | Bloque les messages qui mentionnent trop de monde |
| `/securite mots` | Admin | Gère la liste des mots interdits |
| `/securite protege` | Admin | Membres qu’on ne peut pas mentionner |

### Tickets

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/ticket fermer` | Membre | Ferme le ticket dans lequel la commande est tapée |
| `/ticket panneau` | Admin | Publie le panneau d’ouverture de ticket |
| `/ticket reglages` | Admin | Catégorie, rôle staff et salon des transcripts |
| `/ticket sujet` | Admin | Gère les sujets proposés dans le panneau |

### Niveaux

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/classement` | Membre | Classement des membres par expérience |
| `/niveau` | Membre | Affiche le niveau et l’expérience d’un membre |
| `/xp definir` | Admin | Fixe l’expérience d’un membre |
| `/xp ignorer` | Admin | Salons ou aucune xp n’est gagnée |
| `/xp recompense` | Admin | Associe un rôle a un niveau |
| `/xp reglages` | Admin | Active le système et règle les gains |
| `/xp reinitialiser` | Admin | Remet l’expérience a zero |

### Configuration

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/autorole ajouter` | Admin | Ajoute un rôle a donner a l’arrivee |
| `/autorole liste` | Admin | Rôles configures |
| `/autorole retirer` | Admin | Retire un rôle de la liste |
| `/bienvenue apercu` | Admin | Affiche le rendu du message avec tes propres informations |
| `/bienvenue arrivee` | Admin | Configure l’accueil des nouveaux membres |
| `/bienvenue depart` | Admin | Configure le message de départ |
| `/bienvenue variables` | Admin | Liste les variables utilisables |
| `/compteur creer` | Admin | Crée un salon vocal servant de compteur |
| `/compteur lier` | Admin | Transforme un salon existant en compteur |
| `/compteur liste` | Admin | Compteurs configures |
| `/compteur retirer` | Admin | Le salon cesse d’etre un compteur, il n’est pas supprime |
| `/config langue` | Admin | Change la langue des reponses du bot |
| `/config staff` | Admin | Rôles autorisés a utiliser les commandes du bot |
| `/invitations bonus` | Admin | Ajoute ou retire des invitations a un membre |
| `/invitations classement` | Membre | Les dix meilleurs inviteurs |
| `/invitations origine` | Membre | Qui a invite un membre |
| `/invitations reinitialiser` | Admin | Remet les compteurs d’invitations à zéro |
| `/invitations voir` | Membre | Invitations d’un membre |
| `/logs couper` | Admin | Arrête une catégorie de logs |
| `/logs definir` | Admin | Envoie une catégorie de logs dans un salon |
| `/logs etat` | Admin | Récapitulatif de la configuration |
| `/logs tout` | Admin | Envoie toutes les catégories dans le même salon |
| `/vocalperso activer` | Admin | Désigne le salon d’entree |
| `/vocalperso desactiver` | Admin | Arrête le système |
| `/vocalperso etat` | Admin | Configuration actuelle |

### Informations

| Commande | Rang | Ce qu’elle fait |
|---|---|---|
| `/aide` | Membre | Liste les commandes accessibles |
| `/infos avatar` | Membre | Affiche l’avatar d’un membre en grand |
| `/infos banniere` | Membre | Affiche la bannière d’un membre |
| `/infos boosters` | Membre | Membres qui boostent le serveur |
| `/infos bot` | Membre | Latence et durée de fonctionnement du bot |
| `/infos membre` | Membre | Informations sur un membre |
| `/infos role` | Membre | Informations sur un rôle |
| `/infos salon` | Membre | Informations sur un salon |
| `/infos serveur` | Membre | Informations sur le serveur |

---

## Rangs et permissions

Quatre rangs, du plus faible au plus fort :

| Rang | Comment on l'obtient |
|---|---|
| **Membre** | tout le monde |
| **Modérateur** | un rôle déclaré via `/config staff`, ou une permission Discord de modération |
| **Administrateur** | un rôle déclaré via `/config staff`, la permission Gérer le serveur, ou être propriétaire du serveur |
| **Système** | l'identifiant placé dans `SYS_ID` |

Tant qu'aucun rôle n'est déclaré, les permissions Discord natives servent de
repli : le bot est utilisable dès l'invitation. Déclarer des rôles staff permet
ensuite de donner accès aux commandes **sans** donner les permissions Discord
correspondantes — un modérateur peut bannir avec le bot sans avoir le droit de
bannir à la main.

```
/config staff definir role:@Modérateur rang:moderateur
/config staff definir role:@Admin rang:administrateur
/config staff lister
```

Une sous-commande peut descendre plus bas que sa commande : `/ticket` est
réservé aux administrateurs, mais `/ticket fermer` reste ouvert à celui qui a
ouvert le ticket.

**Trois garde-fous que rien ne contourne :**

1. Personne n'agit sur un membre de rang égal ou supérieur au sien.
2. Le propriétaire du serveur est intouchable.
3. Le bot refuse d'agir sur quelqu'un placé au-dessus de son propre rôle, et le
   dit clairement au lieu de renvoyer une erreur Discord.

---

## Comment le bot fonctionne

```
src/
├── index.js              démarrage : base, langues, commandes, connexion
├── constants.js          limites de l'API Discord, rangs, catégories
├── core/                 config.js, chargeur, déploiement slash, rangs, traduction, réponses
├── database/
│   ├── migrations/       schéma SQL, un fichier numéroté par évolution
│   └── queries/          un fichier de requêtes par domaine
├── modules/              la logique métier, sans dépendance aux commandes
├── commands/             une commande par fichier, le dossier fait la catégorie
├── events/               les écouteurs Discord
├── ui/                   rendu Components V2 et palette
├── lib/                  durées, formatage, fenêtres glissantes, logs
└── scripts/              déploiement des commandes, génération du tableau ci-dessus
```

Trois règles suffisent à s'y retrouver.

**Une commande ne contient que la lecture de ses options et sa réponse.** Tout
ce qui agit sur Discord ou sur la base vit dans `src/modules/`. C'est ce qui
permet à l'antispam de bannir exactement comme `/ban`, sans dupliquer une
ligne.

**Le dossier d'une commande est sa catégorie dans `/aide`.** Déposer un fichier
dans `src/commands/moderation/` suffit ; il n'existe aucune liste de commandes
à tenir à jour ailleurs.

**Aucun identifiant Discord n'est écrit en dur.** `SYS_ID` vit dans `config.js`
et nulle part ailleurs — un test le vérifie à chaque exécution.

### Où trouver quoi

| Je veux changer… | Fichier |
|---|---|
| qui est propriétaire du bot | `config.js`, clé `SYS_ID` |
| qui a le droit de faire quoi | `src/core/access.js` |
| les couleurs des messages | `src/ui/theme.js` |
| la mise en page des messages | `src/ui/render.js` |
| un texte affiché par le bot | `locales/fr.json` |
| la description d'une commande | le fichier de la commande |
| une limite de l'API Discord | `src/constants.js` |
| ce que fait une protection | `src/modules/security/` |
| la formule des niveaux | `src/modules/xp.js` |
| une table de la base | un nouveau fichier dans `src/database/migrations/` |

### L'affichage

Tous les messages sont des **containers Components V2**, jamais des embeds :

```
-# quentin#0000

## Bannissement

• **Membre**
↳ @Quentin
  1235584337370681404

• **Raison**
↳ Publicité non autorisée

────────────────
-# #42 — 2 septembre 2026 17:29
```

Un détail qui compte : en Components V2, un `<@id>` écrit dans un bloc de texte
**notifie réellement**, contrairement à la description d'une embed. Sans
précaution, chaque ligne d'un log de sanction pinguerait le sanctionné. Aucune
mention ne sonne par défaut ; seuls l'accueil et l'ouverture d'un ticket
autorisent la notification, ciblée sur la bonne personne.

---

## Langue

Le français est la langue par défaut. Chaque serveur peut basculer :

```
/config langue code:en
```

Pour ajouter une langue, copie `locales/fr.json` sous le code voulu et traduis
les valeurs. Le fichier est repéré au démarrage et apparaît dans
l'autocomplétion de `/config langue` — il n'y a rien d'autre à modifier. Une
clé absente d'une traduction retombe sur le français : un fichier incomplet ne
casse rien.

Les descriptions affichées par Discord dans le menu `/` sont un cas à part : le
français est écrit directement dans les fichiers de `src/commands/`, les autres
langues vivent sous la clé `commands` de leur fichier de langue. `npm test`
vérifie que rien ne manque, options de sous-commandes comprises.

---

## Données et sauvegarde

Tout est dans un fichier SQLite. Pour le sauvegarder à chaud :

```bash
sqlite3 data/gestion.db ".backup sauvegarde.db"
```

Copier le fichier à la main pendant que le bot tourne donne une sauvegarde
incomplète : le mode WAL laisse une partie des écritures dans
`gestion.db-wal`. La commande ci-dessus, elle, fonctionne en marche.

Le schéma vit dans `src/database/migrations/`. Chaque fichier est numéroté et
n'est appliqué qu'une fois, la version courante étant retenue par
`PRAGMA user_version`. Pour faire évoluer une table, on ajoute un fichier — on
ne modifie jamais un existant.

---

## Tests

```bash
npm test
```

68 tests, **sans token ni base réelle** : un contributeur clone et lance, il n'a
rien à configurer.

| Fichier | Ce qu'il vérifie |
|---|---|
| `execution.test.js` | **exécute les 110 actions** contre un faux serveur Discord et vérifie que chacune répond en Components V2 |
| `evenements.test.js` | déclenche les 21 événements : protections sur message, arrivée de membre, anti-bot, anti-join et sa whitelist, journalisation |
| `api-interne.test.js` | chaque méthode appelée sur un module interne existe vraiment, et aucun identifiant Discord n'est écrit en dur |
| `commandes.test.js` | toutes les définitions slash respectent les contraintes de l'API, options obligatoires en premier, traduction complète |
| `render.test.js` | rendu Components V2, drapeaux, mentions inoffensives par défaut, troncature |
| `securite.test.js` | filtre de mots et ses contournements, liste blanche de domaines, fenêtres glissantes |
| `acces.test.js` | calcul des rangs et hiérarchie |
| `config.test.js` | résolution de `config.js` et de `DATA` |
| `i18n.test.js` | parité des fichiers de langue, variables identiques |
| `duration.test.js`, `xp.test.js` | lecture des durées, formule des niveaux |

Trois d'entre eux attrapent des bugs que ni la syntaxe ni le chargement des
modules ne voient. `api-interne.test.js` vérifie que `respond.info` existe
avant qu'un membre ne tape la commande — JavaScript ne le résout qu'à
l'exécution. `execution.test.js` a trouvé une commande qui laissait Discord sur
« l'application réfléchit » indéfiniment.

**Ce que ces tests ne prouvent pas :** ils remplacent Discord par un faux. Ils
garantissent qu'aucune commande ne plante et que la sortie est valide, pas
qu'un `/ban` bannit réellement. Seul un vrai serveur peut le dire.

---

## Limites connues

- Le mute s'appuie sur le timeout natif de Discord, plafonné à **28 jours**.
  Au-delà, il faut passer par un ban temporaire.
- `/clear` ne supprime pas les messages de plus de 14 jours : Discord refuse la
  suppression groupée au-delà. Le bot les écarte et le dit. Pour vider un salon
  entier, `/salon renouveler`.
- Les transcripts de tickets sont des fichiers texte et s'arrêtent à
  1000 messages.
- L'antinuke, l'anti-bot et l'anti-webhook ont besoin de « Voir les logs
  d'audit » pour savoir qui a fait quoi. Sans elle, ils ne déclenchent jamais.
- Un salon compteur n'est renommé qu'une fois toutes les dix minutes au plus :
  Discord bloque durablement au-delà de deux renommages par dix minutes.
- Le suivi des invitations demande « Gérer le serveur ». Un code supprimé juste
  après usage, ou une URL personnalisée, ne laisse aucune trace exploitable :
  l'arrivée est enregistrée sans inviteur.
- **Une seule instance à la fois.** Deux processus sur le même token répondent
  en double à chaque commande.

---

## Feuille de route

Ce qui existait sur la version précédente et n'a pas encore été repris :

**Côté gestion, il ne manque plus rien** : toutes les commandes de modération,
de sécurité, de permissions et d'administration de l'ancienne version ont leur
équivalent. Ce qui reste relève du divertissement et de l'affichage :

| Domaine | Reste à faire |
|---|---|
| Giveaways | création, tirage, relance, liste |
| Cartes de stats | fiches membre et classements générés en image |
| Boosters | rôle et salon vocal personnels, avec liste d'accès |
| Divertissement | la carte `love`, la calculatrice, le codex |
| Communauté | suggestions, vouch |
| Panneau de configuration | un `/setup` interactif à menus, en remplacement des commandes une par une |

Volontairement **non** repris, et qui ne reviendra pas :

- `eval` — exécution de code arbitraire dans le process du bot. Sur un VPS où
  le bot tourne en root, c'est un accès root complet, pas une commande de
  modération.
- `setprefix` — sans objet en slash.
- `owner` / `unowner` / `ownerlist` — remplacés par `SYS_ID`, une seule valeur,
  dans un fichier, modifiable sans commande.

---

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). En résumé : `npm test` doit passer, une
commande n'est qu'un fichier dans `src/commands/<catégorie>/`, aucun texte
affiché en dur, et tout message se construit avec `src/ui/render.js`.

---

## Licence

MIT — voir [LICENSE](LICENSE). Copyright (c) 2026 **Vyrtral & Sei**.

En clair : n'importe qui peut utiliser, modifier, héberger et même vendre ce
code, à une seule condition — garder la mention de copyright et le texte de la
licence. Aucune garantie n'est fournie.
