CREATE TABLE exam_questions (
  id VARCHAR(36) PRIMARY KEY,
  source_exam VARCHAR(50) NOT NULL,  -- e.g., 'DSE', 'ALevel'
  year INTEGER NOT NULL,
  paper VARCHAR(20),
  question_no VARCHAR(20),
  question_stem TEXT NOT NULL,
  options TEXT,
  correct_answer VARCHAR(50) NOT NULL,
  answer_explanation TEXT,
  related_concept_ids VARCHAR(36)[] DEFAULT '{}',
  difficulty_level INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessment_activities (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  concept_id VARCHAR(36),
  question_id VARCHAR(36) REFERENCES exam_questions(id),
  activity_type VARCHAR(50) NOT NULL,
  original_answer TEXT,
  ai_analysis_result TEXT,
  correctness BOOLEAN,
  score NUMERIC(5,2),
  difficulty_level INTEGER,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feynman_explanations (
  id VARCHAR(36) PRIMARY KEY,
  activity_id VARCHAR(36) REFERENCES assessment_activities(id),
  user_id VARCHAR(36) NOT NULL,
  concept_id VARCHAR(36) NOT NULL,
  mode feynman_mode_type DEFAULT 'initial_explain',
  user_explanation TEXT NOT NULL,
  ai_feedback TEXT,
  misconceptions_detected BOOLEAN DEFAULT FALSE,
  rewritten_version TEXT,
  peer_teaching_reflection TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE error_book (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) REFERENCES exam_questions(id),
  concept_id VARCHAR(36),
  wrong_answer TEXT NOT NULL,
  correct_answer_snapshot TEXT,
  system_explanation TEXT,
  error_category error_category_type DEFAULT 'unknown',
  user_reflection_notes TEXT,
  first_wrong_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_review_time TIMESTAMP WITH TIME ZONE,
  next_review_time TIMESTAMP WITH TIME ZONE,
  review_count INTEGER DEFAULT 0,
  is_mastered BOOLEAN DEFAULT FALSE,
  error_pattern_tags TEXT DEFAULT '{}'
);

CREATE TABLE quiz_attempts (
  id VARCHAR(36) PRIMARY KEY,
  activity_id VARCHAR(36) REFERENCES assessment_activities(id),
  user_id VARCHAR(36) NOT NULL,
  exam_question_id VARCHAR(36) REFERENCES exam_questions(id),
  chosen_option VARCHAR(50),
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Module: Explanations (UC-401/402/403/404/411)
CREATE TABLE user_explanations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  source_type VARCHAR(30) DEFAULT 'text', -- text, voice
  language VARCHAR(20) DEFAULT 'en',
  raw_content TEXT NOT NULL,             -- original user explanation
  transcript TEXT,                       -- voice transcription if applicable
  media_id VARCHAR(36) REFERENCES extracted_media(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'submitted', -- submitted, analyzed, flagged, simplified
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE explanation_ai_analysis (
  id SERIAL PRIMARY KEY,
  explanation_id VARCHAR(36) NOT NULL REFERENCES user_explanations(id) ON DELETE CASCADE,
  ai_model VARCHAR(50),
  missing_terms TEXT,            -- JSON list of missing terminology
  logic_gaps TEXT,               -- JSON list of gaps/unclear reasoning
  feedback TEXT,                 -- general feedback
  processing_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE explanation_flags (
  id SERIAL PRIMARY KEY,
  explanation_id VARCHAR(36) NOT NULL REFERENCES user_explanations(id) ON DELETE CASCADE,
  flag_type VARCHAR(30) NOT NULL,      -- logic_gap, missing_term, ambiguity, correctness
  start_offset INTEGER,                -- character offsets in raw_content
  end_offset INTEGER,
  message TEXT NOT NULL,
  confidence NUMERIC(4,3),
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL, -- null/ai for system
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE explanation_simplifications (
  id SERIAL PRIMARY KEY,
  explanation_id VARCHAR(36) NOT NULL REFERENCES user_explanations(id) ON DELETE CASCADE,
  target_grade VARCHAR(20) DEFAULT 'grade9',
  simplified_text TEXT NOT NULL,
  rationale TEXT,
  quality VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teaching_reflections (
  id SERIAL PRIMARY KEY,
  explanation_id VARCHAR(36) REFERENCES user_explanations(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  reflection_text TEXT NOT NULL,
  modality VARCHAR(20) DEFAULT 'text', -- text or voice
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE explanation_rechecks (
  id SERIAL PRIMARY KEY,
  explanation_id VARCHAR(36) NOT NULL REFERENCES user_explanations(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_alignment_result TEXT,           -- AI validation of correctness
  is_aligned BOOLEAN,                 -- aligns with correct answer/definition
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Module: Error categorization & re-explanation (UC-406/407/411)
CREATE TABLE error_classifications (
  id SERIAL PRIMARY KEY,
  error_book_id VARCHAR(36) NOT NULL REFERENCES error_book(id) ON DELETE CASCADE,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  activity_id VARCHAR(36) REFERENCES assessment_activities(id) ON DELETE SET NULL,
  quiz_attempt_id VARCHAR(36) REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  classification_source VARCHAR(20) DEFAULT 'ai', -- ai/user
  subject VARCHAR(100),
  question_type VARCHAR(100),
  cause VARCHAR(100),                   -- e.g., conceptual, calculation, reading
  confidence NUMERIC(4,3),
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE error_reexplanations (
  id SERIAL PRIMARY KEY,
  error_book_id VARCHAR(36) NOT NULL REFERENCES error_book(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  activity_id VARCHAR(36) REFERENCES assessment_activities(id) ON DELETE SET NULL,
  exam_question_id VARCHAR(36) REFERENCES exam_questions(id) ON DELETE SET NULL,
  explanation_id VARCHAR(36) REFERENCES user_explanations(id) ON DELETE SET NULL,
  explanation_text TEXT NOT NULL,
  ai_validation_result TEXT,
  is_valid BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE extracted_media (
  id VARCHAR(36) PRIMARY KEY,
  source_id VARCHAR(36) REFERENCES sources(id) ON DELETE SET NULL,
  media_type VARCHAR(50),
  storage_method VARCHAR(20) DEFAULT 'local_path',
  content TEXT,
  subject_hints TEXT,
  language VARCHAR(20),
  file_url TEXT NOT NULL,
  checksum VARCHAR(64),
  pages INTEGER[],
  extraction_location TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sources (
  id VARCHAR(36) PRIMARY KEY,
  document_name VARCHAR(500) NOT NULL,
  document_path TEXT,
  document_type VARCHAR(50),
  language VARCHAR(40),
  author VARCHAR(255),
  publication_year INTEGER,
  uploaded_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  checksum VARCHAR(64),
  processing_status VARCHAR(30) DEFAULT 'pending',
  processing_error TEXT,
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  concepts_extracted INTEGER DEFAULT 0,
  relationships_extracted INTEGER DEFAULT 0,
  ai_summary TEXT,
  ai_summary_generated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);