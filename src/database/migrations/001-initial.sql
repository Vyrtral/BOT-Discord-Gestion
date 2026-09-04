-- Reglages generaux d'un serveur. Une ligne est creee a l'arrivee du bot,
-- toutes les autres tables s'appuient dessus.
CREATE TABLE guilds (
  id          TEXT PRIMARY KEY,
  locale      TEXT NOT NULL DEFAULT 'fr',
  joined_at   INTEGER NOT NULL
);

-- Un role staff = un rang. Le rang le plus haut d'un membre l'emporte.
-- 1 = moderateur, 2 = administrateur (voir RANK dans src/constants.js).
CREATE TABLE staff_roles (
  guild_id  TEXT NOT NULL,
  role_id   TEXT NOT NULL,
  rank      INTEGER NOT NULL,
  PRIMARY KEY (guild_id, role_id)
);

-- Historique complet. Rien n'est efface : une sanction levee passe
-- simplement active a 0, pour garder la trace dans /sanctions.
CREATE TABLE sanctions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  moderator_id  TEXT NOT NULL,
  type          TEXT NOT NULL,
  reason        TEXT,
  duration_ms   INTEGER,
  expires_at    INTEGER,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL,
  lifted_at     INTEGER,
  lifted_by     TEXT
);

CREATE INDEX idx_sanctions_user ON sanctions (guild_id, user_id, created_at DESC);
CREATE INDEX idx_sanctions_expiry ON sanctions (active, expires_at);

CREATE TABLE log_channels (
  guild_id    TEXT NOT NULL,
  category    TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, category)
);

-- Un seul enregistrement par serveur : toutes les protections tiennent
-- dans une ligne, ce qui evite une jointure a chaque message recu.
CREATE TABLE security (
  guild_id            TEXT PRIMARY KEY,
  spam_enabled        INTEGER NOT NULL DEFAULT 0,
  spam_messages       INTEGER NOT NULL DEFAULT 5,
  spam_window_ms      INTEGER NOT NULL DEFAULT 5000,
  spam_action         TEXT    NOT NULL DEFAULT 'mute',
  spam_mute_ms        INTEGER NOT NULL DEFAULT 300000,
  links_enabled       INTEGER NOT NULL DEFAULT 0,
  links_action        TEXT    NOT NULL DEFAULT 'delete',
  links_allowlist     TEXT    NOT NULL DEFAULT '[]',
  words_enabled       INTEGER NOT NULL DEFAULT 0,
  words_action        TEXT    NOT NULL DEFAULT 'delete',
  mentions_enabled    INTEGER NOT NULL DEFAULT 0,
  mentions_max        INTEGER NOT NULL DEFAULT 5,
  mentions_action     TEXT    NOT NULL DEFAULT 'mute',
  raid_enabled        INTEGER NOT NULL DEFAULT 0,
  raid_joins          INTEGER NOT NULL DEFAULT 8,
  raid_window_ms      INTEGER NOT NULL DEFAULT 10000,
  raid_account_age_ms INTEGER NOT NULL DEFAULT 0,
  nuke_enabled        INTEGER NOT NULL DEFAULT 0,
  nuke_threshold      INTEGER NOT NULL DEFAULT 4,
  nuke_window_ms      INTEGER NOT NULL DEFAULT 20000,
  nuke_action         TEXT    NOT NULL DEFAULT 'ban',
  lockdown            INTEGER NOT NULL DEFAULT 0,
  exempt_roles        TEXT    NOT NULL DEFAULT '[]'
);

CREATE TABLE banned_words (
  guild_id  TEXT NOT NULL,
  word      TEXT NOT NULL,
  PRIMARY KEY (guild_id, word)
);

CREATE TABLE ticket_settings (
  guild_id            TEXT PRIMARY KEY,
  category_id         TEXT,
  transcript_channel  TEXT,
  staff_role_id       TEXT,
  panel_channel_id    TEXT,
  panel_message_id    TEXT,
  counter             INTEGER NOT NULL DEFAULT 0,
  per_user_limit      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE ticket_topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  emoji       TEXT,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  channel_id  TEXT NOT NULL UNIQUE,
  user_id     TEXT NOT NULL,
  topic_id    INTEGER,
  number      INTEGER NOT NULL,
  claimed_by  TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  opened_at   INTEGER NOT NULL,
  closed_at   INTEGER
);

CREATE INDEX idx_tickets_owner ON tickets (guild_id, user_id, status);

CREATE TABLE xp_settings (
  guild_id          TEXT PRIMARY KEY,
  enabled           INTEGER NOT NULL DEFAULT 0,
  message_xp        INTEGER NOT NULL DEFAULT 15,
  voice_xp          INTEGER NOT NULL DEFAULT 5,
  cooldown_ms       INTEGER NOT NULL DEFAULT 60000,
  announce_channel  TEXT,
  announce_mode     TEXT NOT NULL DEFAULT 'channel',
  ignored_channels  TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE xp_users (
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  xp            INTEGER NOT NULL DEFAULT 0,
  messages      INTEGER NOT NULL DEFAULT 0,
  voice_seconds INTEGER NOT NULL DEFAULT 0,
  last_gain_at  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX idx_xp_leaderboard ON xp_users (guild_id, xp DESC);

-- Role donne a partir d'un niveau. Un seul role par niveau.
CREATE TABLE xp_rewards (
  guild_id  TEXT NOT NULL,
  level     INTEGER NOT NULL,
  role_id   TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);

CREATE TABLE welcome (
  guild_id        TEXT PRIMARY KEY,
  enabled         INTEGER NOT NULL DEFAULT 0,
  channel_id      TEXT,
  message         TEXT,
  dm_message      TEXT,
  auto_role_id    TEXT,
  goodbye_enabled INTEGER NOT NULL DEFAULT 0,
  goodbye_channel TEXT,
  goodbye_message TEXT
);

-- Salons vocaux dont le nom affiche un compteur. Le modele contient
-- {valeur}, remplace au moment de la mise a jour.
CREATE TABLE counters (
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  kind       TEXT NOT NULL,
  template   TEXT NOT NULL,
  PRIMARY KEY (guild_id, channel_id)
);
