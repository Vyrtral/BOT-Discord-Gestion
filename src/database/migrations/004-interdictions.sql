ALTER TABLE security ADD COLUMN admin_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security ADD COLUMN vanity_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security ADD COLUMN vanity_code TEXT;

-- Membres interdits de vocal : deconnectes des qu'ils rejoignent un salon.
CREATE TABLE voice_bans (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  banned_by  TEXT NOT NULL,
  reason     TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Roles interdits a un membre : reretires des qu'on les lui donne.
CREATE TABLE role_bans (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role_id    TEXT NOT NULL,
  banned_by  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, role_id)
);
