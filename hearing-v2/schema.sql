CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  contact TEXT NOT NULL,
  answers TEXT NOT NULL,
  resume_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  locked_at INTEGER,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS drafts_expiry ON drafts(expires_at);
CREATE TABLE IF NOT EXISTS limits (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
