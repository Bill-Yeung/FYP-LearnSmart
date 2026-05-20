CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) DEFAULT 'student',
  display_name VARCHAR(100),
  preferred_language VARCHAR(40) DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  oauth_provider VARCHAR(20),
  oauth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE user_consent (
  consent_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- e.g. 'telemetry', 'group_analytics_share', 'external_import'
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  metadata TEXT NOT NULL DEFAULT '{}',
  UNIQUE (id, consent_type)
);

CREATE TABLE device (
  device_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- e.g. 'visionos', 'ios', 'android', 'web'
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  timezone TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP
);

CREATE TABLE user_source_connection (
  connection_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id VARCHAR(36) NOT NULL REFERENCES external_data_source(source_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'error'
  external_user_ref TEXT, -- opaque id from provider
  scopes TEXT NOT NULL DEFAULT '',
  token_ref TEXT, -- pointer to secrets vault / KMS record
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, source_id)
);

CREATE TABLE external_data_source (
  source_id VARCHAR(36) PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE, -- stable identifier (e.g. 'google_drive')
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE data_sync_run (
  sync_run_id VARCHAR(36) PRIMARY KEY,
  connection_id VARCHAR(36) NOT NULL REFERENCES user_source_connection(connection_id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'partial', 'failed'
  records_in INTEGER NOT NULL DEFAULT 0,
  records_out INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_detail TEXT
);

CREATE TABLE imported_record (
  imported_record_id VARCHAR(36) PRIMARY KEY,
  sync_run_id VARCHAR(36) NOT NULL REFERENCES data_sync_run(sync_run_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- e.g. 'material', 'attempt', 'review'
  external_record_id TEXT,
  occurred_at TIMESTAMP,
  payload TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE curriculum_benchmark (
  benchmark_id VARCHAR(36) PRIMARY KEY,
  benchmark_key TEXT NOT NULL UNIQUE, -- stable (e.g. 'cs101.week3.big_o')
  title TEXT NOT NULL,
  description TEXT,
  difficulty_level INTEGER, -- optional coarse level
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dashboard_config (
  dashboard_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  layout TEXT NOT NULL DEFAULT '{}', -- grid layout, ordering, sizes
  UNIQUE (id, name)
);

CREATE TABLE dashboard_widget (
  widget_id VARCHAR(36) PRIMARY KEY,
  dashboard_id VARCHAR(36) NOT NULL REFERENCES dashboard_config(dashboard_id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- 'forgetting_curve', 'heatmap', 'interleaving', 'gaps', etc.
  title TEXT,
  config TEXT NOT NULL DEFAULT '{}', -- chart settings, filters
  ordinal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE dashboard_panel_cache (
  cache_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  cache_key TEXT NOT NULL, -- e.g. "forgetting_curve:last_30_days"
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  data TEXT NOT NULL DEFAULT '{}',
  UNIQUE (id, widget_type, cache_key)
);

CREATE TABLE learning_path_prediction (
  prediction_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_name TEXT NOT NULL,
  model_version TEXT,
  inputs_summary TEXT NOT NULL DEFAULT '{}',
  outputs_summary TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  error_detail TEXT
);

CREATE TABLE user_benchmark_mastery (
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id VARCHAR(36) NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  mastery_score NUMERIC(6,5) NOT NULL DEFAULT 0, -- 0..1
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0, -- 0..1
  last_evaluated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evidence TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, benchmark_id)
);

CREATE TABLE gap_analysis_run (
  gap_run_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  model_name TEXT NOT NULL,
  model_version TEXT,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  notes TEXT,
  inputs_summary TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE identified_gap (
  gap_id VARCHAR(36) PRIMARY KEY,
  gap_run_id VARCHAR(36) NOT NULL REFERENCES gap_analysis_run(gap_run_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id VARCHAR(36) NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  severity INTEGER NOT NULL DEFAULT 1, -- 1..5
  reason TEXT,
  supporting_signals TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lesson_recommendation (
  recommendation_id  VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gap_id VARCHAR(36) REFERENCES identified_gap(gap_id) ON DELETE SET NULL,
  benchmark_id VARCHAR(36) REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL DEFAULT 'lesson', -- 'lesson', 'practice', 'review'
  priority INTEGER NOT NULL DEFAULT 1, -- 1..5
  rationale TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'open' -- 'open', 'accepted', 'dismissed'
);

CREATE TABLE learning_group (
  group_id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visibility TEXT NOT NULL DEFAULT 'private', -- 'private', 'invite', 'public'
  analytics_sharing TEXT NOT NULL DEFAULT 'anonymized_only', -- enforce policy at query layer
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE learning_group_member (
  group_id VARCHAR(36) NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, id)
);

CREATE TABLE group_member_alias (
  group_id VARCHAR(36) NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias_key TEXT NOT NULL, -- e.g. 'member_07' (generated server-side)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, id),
  UNIQUE (group_id, alias_key)
);

CREATE TABLE group_goal (
  goal_id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- e.g. 'study_minutes', 'reviews', 'mastery_gain'
  target_value NUMERIC(14,4) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE group_analytics_snapshot (
  snapshot_id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_kind TEXT NOT NULL, -- 'week', 'month'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  member_count INTEGER NOT NULL DEFAULT 0,
  avg_study_minutes  NUMERIC(14,4) NOT NULL DEFAULT 0,
  avg_predicted_recall NUMERIC(6,5) NOT NULL DEFAULT 0,
  avg_interleaving_index NUMERIC(10,6) NOT NULL DEFAULT 0,
  avg_mastery_score  NUMERIC(6,5) NOT NULL DEFAULT 0,
  distribution TEXT NOT NULL DEFAULT '{}'
  -- e.g. histograms/percentiles: { "study_minutes_p50":..., "p90":..., "bins":[...] }
);

CREATE TABLE group_member_metric_bucket (
  bucket_id VARCHAR(36) PRIMARY KEY,
  group_id VARCHAR(36) NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_kind TEXT NOT NULL,
  alias_key TEXT NOT NULL, -- references group_member_alias.alias_key (no id)
  metric_type TEXT NOT NULL,
  metric_value NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_event (
  event_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(36) REFERENCES device(device_id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL,
  -- e.g. 'material_open', 'practice_start', 'practice_end',
  -- 'question_answered', 'quiz_submitted', 'srs_review'
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  context TEXT NOT NULL DEFAULT '{}'
  -- examples:
  -- { "session_id": "...", "topic": "...", "difficulty": 3, "correct": true,
  -- "question_id": "...", "attempt_no": 2, "interleaving_block": 5 }
);

CREATE TABLE learning_session (
  session_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(36) REFERENCES device(device_id) ON DELETE SET NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  session_type TEXT NOT NULL DEFAULT 'study', -- 'study', 'practice', 'quiz'
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE memory_item (
  memory_item_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id VARCHAR(36) REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' -- 'active', 'archived'
);

CREATE TABLE memory_review (
  review_id VARCHAR(36) PRIMARY KEY,
  memory_item_id VARCHAR(36) NOT NULL REFERENCES memory_item(memory_item_id) ON DELETE CASCADE,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  grade INTEGER NOT NULL, -- e.g. 0..5 or 0..3 depending on your model
  correct BOOLEAN,
  response_time_ms INTEGER,
  interval_days NUMERIC(10,3), -- interval used after this review
  ease_factor NUMERIC(10,6), -- model parameter after this review (if using SM-2-like)
  model_state TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE user_forgetting_model (
  id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL DEFAULT 'default',
  parameters TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memory_retention_snapshot (
  snapshot_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_item_id VARCHAR(36) NOT NULL REFERENCES memory_item(memory_item_id) ON DELETE CASCADE,
  predicted_recall NUMERIC(6,5) NOT NULL, -- 0..1
  as_of TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_review_at TIMESTAMP,
  UNIQUE (id, memory_item_id, as_of)
);

CREATE TABLE user_activity_heatmap (
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,  -- e.g. Monday of the week, or first day of month
  period_kind TEXT NOT NULL,  -- 'week', 'month'
  day_of_week SMALLINT NOT NULL,
  hour_of_day SMALLINT NOT NULL,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, period_start, period_kind, day_of_week, hour_of_day)
);

CREATE TABLE practice_block (
  block_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(36) REFERENCES learning_session(session_id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  intended_goal TEXT,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE practice_item_attempt (
  attempt_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id VARCHAR(36) REFERENCES practice_block(block_id) ON DELETE CASCADE,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  benchmark_id VARCHAR(36) REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  difficulty_level INTEGER,
  correct BOOLEAN,
  response_time_ms INTEGER,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE user_interleaving_stats (
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_kind TEXT NOT NULL, -- 'week', 'month'
  total_attempts INTEGER NOT NULL DEFAULT 0,
  topic_switches INTEGER NOT NULL DEFAULT 0,
  unique_benchmarks INTEGER NOT NULL DEFAULT 0,
  interleaving_index NUMERIC(10,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, period_start, period_kind)
);