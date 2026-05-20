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

-- =============================================================================
-- 1. Base Data (Users, Sources, Concepts, Media)
-- =============================================================================

-- User: Alice
INSERT INTO users (id, username, email, display_name, role) VALUES
('u0000001-0000-0000-0000-000000000001', 'alice_student', 'alice@example.com', 'Alice Chen', 'student');

-- Source: Physics Textbook
INSERT INTO sources (id, document_name, document_type, uploaded_by) VALUES
('s0000001-0000-0000-0000-000000000001', 'Physics_Chapter_4_Forces.pdf', 'textbook', 'u0000001-0000-0000-0000-000000000001');

-- Concepts: Force, Mass, Newton's 2nd Law
INSERT INTO concepts (id, concept_type, base_form, difficulty_level, formula_latex) VALUES
('c0000001-0000-0000-0000-000000000001', 'Definition', 'Force', 'easy', 'F = ma'),
('c0000002-0000-0000-0000-000000000002', 'Law', 'Newton''s Second Law', 'medium', '\sum \vec{F} = m\vec{a}');

-- =============================================================================
-- 2. Exam & Assessment Core
-- =============================================================================

-- Exam Question: A standard Physics calculation question
INSERT INTO exam_questions (id, source_exam, year, question_stem, options, correct_answer, related_concept_ids, difficulty_level) VALUES
('eq000001-0000-0000-0000-000000000001', 
 'DSE', 
 2023, 
 'A 5kg block is pushed with a net force of 20N. What is the acceleration?', 
 '{"A": "2 m/s^2", "B": "4 m/s^2", "C": "10 m/s^2", "D": "100 m/s^2"}', 
 'B', 
 '{c0000001-0000-0000-0000-000000000001, c0000002-0000-0000-0000-000000000002}', 
 2);

-- Activity: Alice takes a practice quiz
INSERT INTO assessment_activities (id, user_id, question_id, activity_type, correctness, score, difficulty_level) VALUES
('act00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'eq000001-0000-0000-0000-000000000001', 'quiz_practice', FALSE, 0.00, 2);

-- Quiz Attempt: Alice answers incorrectly (Option C)
INSERT INTO quiz_attempts (id, activity_id, user_id, exam_question_id, chosen_option, is_correct, time_spent_seconds) VALUES
('qa000001-0000-0000-0000-000000000001', 'act00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'eq000001-0000-0000-0000-000000000001', 'C', FALSE, 45);

-- =============================================================================
-- 3. Error Tracking (Error Book)
-- =============================================================================

-- Error Book: Record the mistake
INSERT INTO error_book (id, user_id, question_id, wrong_answer, error_category, user_reflection_notes, is_mastered) VALUES
('err00001-0000-0000-0000-000000000001', 
 'u0000001-0000-0000-0000-000000000001', 
 'eq000001-0000-0000-0000-000000000001', 
 'C', 
 'calculation_error', 
 'I multiplied instead of dividing force by mass.', 
 FALSE);

-- Error Classification: AI classifies the error
INSERT INTO error_classifications (error_book_id, cause, confidence, classification_source) VALUES
('err00001-0000-0000-0000-000000000001', 'Misapplication of Formula', 0.95, 'ai');

-- =============================================================================
-- 4. Feynman Explanation Module (User explains concept to learn)
-- =============================================================================

-- User Explanation: Alice tries to explain Newton's 2nd Law verbally (recorded as text)
INSERT INTO user_explanations (id, user_id, concept_id, source_type, raw_content, status) VALUES
('exp00001-0000-0000-0000-000000000001', 
 'u0000001-0000-0000-0000-000000000001', 
 'c0000002-0000-0000-0000-000000000002', 
 'text', 
 'Newton second law basically says that if you push something, it moves. The harder you push, the faster it goes.', 
 'analyzed');

-- AI Analysis: AI critiques the explanation
INSERT INTO explanation_ai_analysis (explanation_id, ai_model, missing_terms, logic_gaps, feedback) VALUES
('exp00001-0000-0000-0000-000000000001', 
 'gpt-4o', 
 '["Mass", "Acceleration", "Net Force"]', 
 '["Fails to mention relationship with mass (inverse proportionality)", "Uses ''fast'' (velocity) instead of ''acceleration''"]', 
 'You have the general idea of force causing motion, but you missed the crucial role of Mass. Pushing a car and a toy truck with the same force yields different results.');

-- Flags: Specific issues flagged in text
INSERT INTO explanation_flags (explanation_id, flag_type, message, start_offset, end_offset) VALUES
('exp00001-0000-0000-0000-000000000001', 'ambiguity', ' "Faster" implies velocity, but force causes acceleration (change in velocity).', 65, 71);

-- Simplification: AI rewrites it for a lower grade level
INSERT INTO explanation_simplifications (explanation_id, target_grade, simplified_text) VALUES
('exp00001-0000-0000-0000-000000000001', 
 'grade6', 
 'If you push an object, it speeds up. A heavy object needs a bigger push to speed up as much as a light one.');

-- =============================================================================
-- 5. Closing the Loop (Reflection & Re-explanation)
-- =============================================================================

-- Teaching Reflection: Alice reflects on her explanation
INSERT INTO teaching_reflections (explanation_id, user_id, concept_id, reflection_text) VALUES
('exp00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'c0000002-0000-0000-0000-000000000002', 'I realized I often confuse velocity and acceleration when thinking quickly.');

-- Error Re-explanation: Alice re-explains the error from her error book
INSERT INTO error_reexplanations (error_book_id, user_id, explanation_text, is_valid) VALUES
('err00001-0000-0000-0000-000000000001', 
 'u0000001-0000-0000-0000-000000000001', 
 'To find acceleration, I need to rearrange F=ma to a=F/m. So 20N / 5kg = 4 m/s^2.', 
 TRUE);