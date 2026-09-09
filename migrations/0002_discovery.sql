CREATE TABLE IF NOT EXISTS discovery_sources (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK(content_type IN ('event','casting')),
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL UNIQUE,
  source_platform TEXT,
  source_handle TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  last_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS source_checks (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id),
  last_http_status INTEGER,
  last_fingerprint TEXT,
  last_signals_json TEXT,
  last_checked_at TEXT NOT NULL,
  last_changed_at TEXT
);
CREATE TABLE IF NOT EXISTS verification_alerts (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id),
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS discovery_sources_enabled ON discovery_sources(enabled, content_type);
CREATE INDEX IF NOT EXISTS verification_alerts_open ON verification_alerts(resolved_at, created_at DESC);
