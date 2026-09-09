CREATE TABLE submissions (
  id TEXT PRIMARY KEY, content_type TEXT NOT NULL CHECK(content_type IN ('event','casting')),
  source_url TEXT NOT NULL, normalized_source_url TEXT NOT NULL UNIQUE,
  event_name TEXT, date_time_text TEXT, location_text TEXT, notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','under_review','approved','rejected','published')),
  admin_notes TEXT, review_draft_json TEXT, duplicate_submission_id TEXT, duplicate_event_id TEXT,
  published_event_id TEXT, published_occurrence_ids_json TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, reviewed_at TEXT, published_at TEXT
);
CREATE TABLE submission_evidence (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), evidence_type TEXT NOT NULL,
  source_url TEXT, source_platform TEXT, source_handle TEXT, created_at TEXT NOT NULL
);
CREATE INDEX submissions_status_created ON submissions(status, created_at DESC);
CREATE INDEX submission_evidence_submission ON submission_evidence(submission_id);
