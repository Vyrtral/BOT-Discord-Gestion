ALTER TABLE security ADD COLUMN bots_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security ADD COLUMN bots_action TEXT NOT NULL DEFAULT 'kick';
ALTER TABLE security ADD COLUMN webhooks_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security ADD COLUMN pings_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE security ADD COLUMN pings_action TEXT NOT NULL DEFAULT 'warn';

-- Membres qu'on ne doit pas mentionner. Le staff et les exemptions passent.
CREATE TABLE protected_members (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  added_by   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Bots autorises a rejoindre malgre l'anti-bot.
CREATE TABLE allowed_bots (
  guild_id TEXT NOT NULL,
  bot_id   TEXT NOT NULL,
  PRIMARY KEY (guild_id, bot_id)
);
