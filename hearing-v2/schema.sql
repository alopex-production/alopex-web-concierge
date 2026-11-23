CREATE TABLE IF NOT EXISTS drafts (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL,
 company TEXT NOT NULL,
 contact TEXT NOT NULL,
 answers TEXT NOT NULL DEFAULT '{}',
 resume_hash TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 submitted_at INTEGER
);
CREATE INDEX IF NOT EXISTS drafts_expiry ON drafts(expires_at);
CREATE TABLE IF NOT EXISTS submissions (
 id TEXT PRIMARY KEY,
 draft_id TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 delivery_state TEXT NOT NULL DEFAULT 'PENDING'
);
