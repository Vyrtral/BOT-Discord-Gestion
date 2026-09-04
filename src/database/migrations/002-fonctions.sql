-- Blacklist : un ban double d'une inscription, pour qu'un debannissement
-- manuel sur Discord ne suffise pas a revenir.
CREATE TABLE blacklist (
  guild_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason       TEXT,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Anti-join : salons vocaux verrouilles contre les entrees.
CREATE TABLE voice_locks (
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  locked_by  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, channel_id)
);

-- Whitelist vocale : membres qui traversent l'anti-join.
CREATE TABLE voice_allowlist (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Suivi des invitations. invite_codes retient l'etat connu de chaque code
-- pour deduire lequel a servi a l'arrivee suivante.
CREATE TABLE invite_codes (
  guild_id   TEXT NOT NULL,
  code       TEXT NOT NULL,
  inviter_id TEXT,
  uses       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, code)
);

CREATE TABLE invite_counts (
  guild_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  joined   INTEGER NOT NULL DEFAULT 0,
  left     INTEGER NOT NULL DEFAULT 0,
  bonus    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- Qui a invite qui, pour decrementer au depart du membre.
CREATE TABLE invite_joins (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  inviter_id TEXT,
  code       TEXT,
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Roles donnes automatiquement a l'arrivee. Plusieurs par serveur, la
-- colonne auto_role_id de welcome ne portait qu'un seul role.
CREATE TABLE auto_roles (
  guild_id TEXT NOT NULL,
  role_id  TEXT NOT NULL,
  PRIMARY KEY (guild_id, role_id)
);

-- Salons vocaux temporaires : un salon "hub" ou entrer cree un salon prive.
CREATE TABLE temp_voice_hubs (
  guild_id    TEXT PRIMARY KEY,
  hub_id      TEXT NOT NULL,
  category_id TEXT,
  template    TEXT NOT NULL DEFAULT 'Vocal de {pseudo}',
  user_limit  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE temp_voice_rooms (
  channel_id TEXT PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  owner_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
