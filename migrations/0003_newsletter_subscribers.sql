CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'plan-my-day',
  consent_text TEXT NOT NULL,
  preferences_json TEXT,
  saved_occurrence_ids_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  zoho_status TEXT NOT NULL DEFAULT 'pending',
  zoho_synced_at TEXT,
  zoho_error TEXT
);
