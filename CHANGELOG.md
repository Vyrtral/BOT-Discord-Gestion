# Journal des versions

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et la
numérotation [SemVer](https://semver.org/lang/fr/).

## [1.0.0]

Première version publique.

### Ajouté

- **Configuration dans `config.js` à la racine** : `TOKEN`, `APP_ID`,
  `SYS_ID`, `DATA`, `GUILD_ID`, `LANGUE`. Pas de `.env`, pas de `dotenv` dans
  les dépendances. Le fichier est ignoré par git, `config.example.js` part sur
  le dépôt à sa place.
- **Interface entièrement en Components V2** : aucune embed classique. Chaque
  message est un container à barre d'accent, titre en `##`, contenu en lignes
  `• **Libellé**` / `↳ valeur`, séparateur et pied de page en petit texte. En
  V2 une mention dans un bloc de texte notifie réellement, contrairement à la
  description d'une embed : aucune ne sonne par défaut, seuls l'accueil et
  l'ouverture d'un ticket autorisent la notification.

- Modération : `/ban` (permanent ou temporaire), `/unban`, `/kick`, `/mute`,
  `/unmute`, `/warn`, `/clear`, et `/salon` pour le verrouillage et le mode
  lent.
- Historique numéroté des sanctions, consultable et levable par `/sanctions`.
  Une sanction levée reste dans l'historique.
- Levée automatique des bans temporaires arrivés à terme, y compris ceux
  expirés pendant que le bot était éteint.
- Protections : antispam, filtre de liens et d'invitations avec liste blanche
  de domaines, mots interdits résistants aux accents et aux lettres espacées,
  anti mass-mention, antiraid sur les vagues d'arrivées et l'âge des comptes,
  antinuke sur les suppressions en rafale.
- `/securite lockdown` pour fermer ou rouvrir tous les salons textuels d'un
  coup.
- Tickets : panneau à sujets, salons privés, prise en charge, transcript
  déposé dans un salon dédié à la fermeture. `/ticket fermer` reste accessible
  à l'auteur du ticket alors que le reste de `/ticket` est réservé aux
  administrateurs.
- Journalisation par catégorie : messages, membres, rôles, salons, vocal,
  sanctions, sécurité.
- Niveaux : xp par message et par minute de vocal, rôles de niveau
  cumulatifs, classement paginé, salons ignorés.
- Accueil : message d'arrivée et de départ avec variables, message privé,
  rôle automatique.
- Compteurs : salons vocaux affichant membres, humains, bots, boosts ou
  personnes en vocal.
- Rangs staff configurables par rôle, avec repli sur les permissions Discord
  natives tant que rien n'est déclaré. Aucun identifiant Discord en dur :
  `OWNER_ID` vit dans le `.env` et nulle part ailleurs.
- 20 commandes réparties en six catégories, le dossier d'une commande faisant
  sa catégorie dans `/aide`.
- Interface en français et en anglais, réglable par serveur, extensible en
  déposant un fichier dans `locales/`.
- Vocal : `/vocal` (déplacer, déconnecter, muet, parler, rassembler),
  `/antijoin` et `/wl` avec application en direct sur `voiceStateUpdate`.
- `/blacklist` : un déban manuel depuis Discord rebannit immédiatement.
- `/role` (ajouter, retirer, surnom), `/dire` (texte ou panneau), `/snipe`,
  `/autorole`, `/invitations`, `/vocalperso`.
- `/salon` gagne masquer et renouveler ; `/infos` gagne avatar, bannière,
  rôle, salon et boosters.
- Protections supplémentaires : anti-bot avec liste de bots autorisés,
  anti-webhook, anti-ping avec liste de membres protégés.
- `/aide` devient un panneau à sélecteur de catégorie, calculé pour celui qui
  clique et non pour celui qui a tapé la commande.
- `npm run commandes` génère le tableau des commandes du README depuis le
  code, pour qu'il ne puisse pas se désynchroniser.
- Protections complétées : anti-admin (retire un rôle à permissions sensibles
  donné à un non-administrateur) et anti-vanity (remet l'URL personnalisée du
  serveur si elle change).
- Interdictions : `/vocal interdire` déconnecte le membre dès qu'il rejoint un
  salon, `/role interdire` retire un rôle dès qu'on le lui donne.
- `/unmute` sans membre libère tout le serveur, `/config staff vider` remet la
  configuration staff à plat, `/invitations reinitialiser` remet les compteurs
  à zéro sans effacer l'historique des arrivées.
- `/systeme` : nom, avatar, statut, état, export JSON de la structure du
  serveur, arrêt. Réservé au compte inscrit dans `SYS_ID`.
- 68 tests, dont deux bancs d'essai qui exécutent les 110 actions et
  déclenchent les 21 événements contre un faux serveur Discord.

### Corrigé

- **`better-sqlite3` passe en `^12`.** La série 11 n'a pas de binaire
  précompilé pour Node 24 et échouait sur `Could not locate the bindings
  file`. La 12 couvre Node 20 à 24. `engines.node` passe à `>=20`, l'API
  utilisée est identique.

- **Le `.env` et la base ne dépendent plus du dossier de lancement.**
  `dotenv` cherchait le fichier dans `process.cwd()` : `node src/index.js`
  lancé depuis `src/` annonçait un `DISCORD_TOKEN` absent alors qu'il était
  bien là, et aurait créé la base dans `src/data/`. Les deux chemins sont
  maintenant ancrés sur la racine du projet, déduite de l'emplacement de
  `src/env.js`.
- Messages de démarrage : un `.env` introuvable, une variable vide, un token
  refusé et des commandes refusées faute d'être sur le serveur ne renvoient
  plus le même texte. Chacun nomme le chemin ou l'identifiant en cause.
