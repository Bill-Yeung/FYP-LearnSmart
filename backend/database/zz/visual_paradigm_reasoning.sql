CREATE TABLE socratic_misconception_observation (
  observation_id VARCHAR(36) PRIMARY KEY,
  socratic_session_id VARCHAR(36) NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  misconception_id VARCHAR(36) NOT NULL REFERENCES misconception(misconception_id) ON DELETE CASCADE,
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0,
  observed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evidence TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE socratic_session (
  socratic_session_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed_question_id VARCHAR(36) REFERENCES comprehension_question(question_id) ON DELETE SET NULL,
  language_code TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL DEFAULT 1,
  goal TEXT, -- e.g. "derive explanation", "correct misconception", "solve problem"
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE misconception (
  misconception_id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE, -- NULL => shared library
  language_code TEXT NOT NULL,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comprehension_question (
  question_id        VARCHAR(36) PRIMARY KEY,
  run_id             VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  target_concept_id  VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  question_type      TEXT NOT NULL,      -- 'why' | 'how'
  difficulty_level   INTEGER NOT NULL,   -- define your scale (e.g. 1..5)
  reasoning_focus    TEXT,               -- e.g. 'cause', 'mechanism', 'link_between_ideas'
  question_text      TEXT NOT NULL,
  rubric             TEXT NOT NULL DEFAULT '{}', -- expected points/criteria
  teacher_notes      TEXT,                               -- optional: guidance for reviewers
  metadata           TEXT NOT NULL DEFAULT '{}',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_generation_run (
  run_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_type           TEXT NOT NULL,
  -- e.g. 'question_generation', 'rewrite', 'analogy_generation', 'brainstorm_prompting', 'socratic_turn'
  model_name         TEXT NOT NULL,
  model_version      TEXT,
  status             TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at        TIMESTAMP,
  inputs_summary     TEXT NOT NULL DEFAULT '{}',
  outputs_summary    TEXT NOT NULL DEFAULT '{}',
  error_detail       TEXT
);

CREATE TABLE concepts (
  id VARCHAR(36) PRIMARY KEY,
  concept_type VARCHAR(50) NOT NULL,
  difficulty_level VARCHAR(20),
  estimated_study_time_minutes INTEGER,
  formula_latex TEXT,
  base_form VARCHAR(255), -- For same words with different meanings in different contexts
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  is_system_generated BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  qdrant_synced_at TIMESTAMP,
  embedding_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

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

CREATE TABLE brainstorming_prompt (
  prompt_id VARCHAR(36) PRIMARY KEY,
  brainstorm_session_id VARCHAR(36) NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,  -- 'who' | 'what' | 'why' | 'how'
  ordinal INTEGER NOT NULL DEFAULT 0,
  prompt_text TEXT NOT NULL,
  run_id VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI-generated prompts
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brainstorming_artifact (
  artifact_id VARCHAR(36) PRIMARY KEY,
  brainstorm_session_id VARCHAR(36) NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL DEFAULT 'outline', -- 'outline', 'mindmap', 'summary'
  content TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE brainstorming_session (
  brainstorm_session_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  language_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE brainstorming_response (
  response_id VARCHAR(36) PRIMARY KEY,
  prompt_id VARCHAR(36) NOT NULL REFERENCES brainstorming_prompt(prompt_id) ON DELETE CASCADE,
  brainstorm_session_id VARCHAR(36) NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  response_text TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE socratic_state_snapshot (
  snapshot_id VARCHAR(36) PRIMARY KEY,
  socratic_session_id VARCHAR(36) NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  as_of TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  state TEXT NOT NULL DEFAULT '{}',
  UNIQUE (socratic_session_id, as_of)
);

CREATE TABLE socratic_turn (
  turn_id VARCHAR(36) PRIMARY KEY,
  socratic_session_id VARCHAR(36) NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  turn_kind TEXT NOT NULL, -- 'question', 'answer', 'hint', 'feedback', 'probe'
  content TEXT NOT NULL,
  run_id VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI produced this turn
  tags TEXT NOT NULL DEFAULT '{}', -- e.g. { "misconception": "...", "strategy": "scaffold" }
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (socratic_session_id, ordinal)
);

CREATE TABLE generated_analogy (
  analogy_id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  template_id VARCHAR(36) REFERENCES metaphor_template(template_id) ON DELETE SET NULL,
  analogy_text TEXT NOT NULL,
  explanation_text TEXT, -- clarifies mapping back to the concept
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metaphor_template (
  template_id VARCHAR(36) PRIMARY KEY,
  owner_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE, -- NULL => shared library
  language_code TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_text TEXT NOT NULL, -- supports placeholders; interpretation handled in app logic
  tags TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE passage_rewrite (
  rewrite_id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_language TEXT NOT NULL, -- 'en' | 'zh'
  target_language TEXT NOT NULL, -- 'en' | 'zh' (can be same language)
  simplification_level INTEGER NOT NULL DEFAULT 1, -- define scale (e.g. 1..3)
  source_text TEXT NOT NULL,
  simplified_text TEXT NOT NULL,
  -- Optional alignment for side-by-side UI (sentence mapping, offsets, etc.)
  alignment_map TEXT NOT NULL DEFAULT '{}',
  readability_metrics TEXT NOT NULL DEFAULT '{}', -- e.g. length, vocab stats
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_question_assignment (
  assignment_id VARCHAR(36) PRIMARY KEY,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id VARCHAR(36) NOT NULL REFERENCES comprehension_question(question_id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'answered', 'skipped'
  metadata TEXT NOT NULL DEFAULT '{}',
  UNIQUE (id, question_id)
);

CREATE TABLE user_question_response (
  response_id VARCHAR(36) PRIMARY KEY,
  assignment_id VARCHAR(36) NOT NULL REFERENCES user_question_assignment(assignment_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id VARCHAR(36) NOT NULL REFERENCES comprehension_question(question_id) ON DELETE CASCADE,
  responded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  response_text TEXT NOT NULL,
  score NUMERIC(6,3), -- optional
  feedback_text TEXT, -- optional
  feedback_rubric TEXT NOT NULL DEFAULT '{}',
  feedback_run_id VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL
);

CREATE TABLE comprehension_question (
  question_id        VARCHAR(36) PRIMARY KEY,
  run_id             VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  target_concept_id  VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  question_type      TEXT NOT NULL,      -- 'why' | 'how'
  difficulty_level   INTEGER NOT NULL,   -- define your scale (e.g. 1..5)
  reasoning_focus    TEXT,               -- e.g. 'cause', 'mechanism', 'link_between_ideas'
  question_text      TEXT NOT NULL,
  rubric             TEXT NOT NULL DEFAULT '{}', -- expected points/criteria
  teacher_notes      TEXT,                               -- optional: guidance for reviewers
  metadata           TEXT NOT NULL DEFAULT '{}',
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE concept_relationships (
  id SERIAL PRIMARY KEY,
  relationship_id VARCHAR(36) REFERENCES relationships(id) ON DELETE CASCADE,
  source_concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE,
  neo4j_synced_at TIMESTAMP,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(relationship_id, source_concept_id, target_concept_id)
);

CREATE TABLE relationships (
  id VARCHAR(36) PRIMARY KEY,
  relationship_type VARCHAR(50) NOT NULL,
  suggested_relationship_type VARCHAR(100),
  direction VARCHAR(20) NOT NULL,
  strength NUMERIC(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE TABLE concepts (
  id VARCHAR(36) PRIMARY KEY,
  concept_type VARCHAR(50) NOT NULL,
  difficulty_level VARCHAR(20),
  estimated_study_time_minutes INTEGER,
  formula_latex TEXT,
  base_form VARCHAR(255), -- For same words with different meanings in different contexts
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  is_system_generated BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  qdrant_synced_at TIMESTAMP,
  embedding_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);