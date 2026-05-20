-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Types
CREATE TYPE error_category_type AS ENUM (
    'conceptual_misunderstanding',
    'calculation_error',
    'memory_slip',
    'misinterpretation',
    'procedural_error',
    'unknown'
);

CREATE TYPE feynman_mode_type AS ENUM (
    'initial_explain',
    'correction_explain',
    'self_reflection'
);

-- Tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
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

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url TEXT,
  organization VARCHAR(255),
  department VARCHAR(100),
  level VARCHAR(50),
  personal_interests TEXT[],
  timezone VARCHAR(50) DEFAULT 'UTC',
  notification_preferences JSONB DEFAULT '{"email": true, "in_app": true}'::jsonb,
  privacy_settings JSONB DEFAULT '{"profile_public": false, "show_activity": false}'::jsonb,
  domain_level VARCHAR(20) DEFAULT 'beginner'
    CHECK (domain_level IN ('beginner', 'intermediate', 'advanced')),
  difficulty_preference VARCHAR(10) DEFAULT 'medium'
    CHECK (difficulty_preference IN ('easy', 'medium', 'hard', 'adaptive')),
  ai_assistance_level VARCHAR(10) DEFAULT 'moderate'
    CHECK (ai_assistance_level IN ('minimal', 'moderate', 'full')),
  total_play_time_minutes INT DEFAULT 0,
  scripts_completed INT DEFAULT 0,
  study_preferences JSONB DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "spaced_repetition_algorithm": "sm2",     -- Module 3: SM-2, Leitner, etc.
  --   "daily_study_goal_minutes": 30,           -- Module 5, 7: Progress tracking
  --   "preferred_study_times": ["morning"],     -- Module 7: Planning
  --   "notification_frequency": "daily",        -- Module 5: Reminders
  --   "difficulty_preference": "adaptive",      -- Module 4: Assessment
  --   "language": "en"                          -- All modules
  -- }
  learning_style JSONB DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "visual": 0.7,      -- Preference for diagrams, videos
  --   "auditory": 0.3,    -- Preference for audio, discussions
  --   "reading": 0.8,     -- Preference for text
  --   "kinesthetic": 0.5  -- Preference for interactive, hands-on
  -- }
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS concepts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_type VARCHAR(50) NOT NULL CHECK (
    concept_type IN ('definition', 'procedure', 'example', 'assessment', 'learning_object', 'entity', 'formula')
  ),
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  estimated_study_time_minutes INTEGER,
  formula_latex TEXT,
  base_form VARCHAR(255), -- For same words with different meanings in different contexts
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_system_generated BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  qdrant_synced_at TIMESTAMP,
  embedding_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS concept_translations (
  id SERIAL PRIMARY KEY,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL, -- With inline citations [src:uuid:page]
  keywords TEXT[],
  formula_plain_text TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(concept_id, language)
);

CREATE TABLE IF NOT EXISTS taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lcc_code VARCHAR(20) NOT NULL UNIQUE,
  lcc_label VARCHAR(255) NOT NULL,
  lcc_hierarchy_level INTEGER NOT NULL,
  parent_lcc_code VARCHAR(20) REFERENCES taxonomy_nodes(lcc_code),
  scope_note TEXT,
  last_verified_date TIMESTAMP
);

CREATE TABLE IF NOT EXISTS concept_taxonomy (
  id SERIAL PRIMARY KEY,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  taxonomy_node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  user_knowledge_level INTEGER, -- Dynamic level in user's knowledge graph
  lcc_hierarchy_mismatch BOOLEAN DEFAULT false, -- True if user learned advanced before basics
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(concept_id, taxonomy_node_id)
);

CREATE TABLE IF NOT EXISTS procedure_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  expected_duration_minutes INTEGER,
  stored_in_neo4j BOOLEAN DEFAULT false -- True if steps stored in Neo4j (complex procedures with branching/recursion)
);

CREATE TABLE IF NOT EXISTS procedure_translations (
  id SERIAL PRIMARY KEY,
  procedure_id UUID REFERENCES procedure_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  purpose TEXT,
  preconditions JSONB, -- [{item, description}]
  failure_modes JSONB, -- [{mode, symptoms, fix}]
  verification_checks JSONB, -- [{check, expected_result}]
  steps JSONB, -- Format: [{index, action, detail, expected_result, references_concepts: [uuid], uses_assets: [uuid]}]
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(procedure_id, language)
);

CREATE TABLE IF NOT EXISTS example_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  media_refs UUID[] -- References to assets
);

CREATE TABLE IF NOT EXISTS example_translations (
  id SERIAL PRIMARY KEY,
  example_id UUID REFERENCES example_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  context TEXT,
  inputs JSONB,
  outcome TEXT,
  lessons_learned TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(example_id, language)
);

CREATE TABLE IF NOT EXISTS assessment_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  question_type VARCHAR(50) CHECK (question_type IN ('multiple_choice', 'short_answer', 'code', 'essay')),
  estimated_time_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS assessment_translations (
  id SERIAL PRIMARY KEY,
  assessment_id UUID REFERENCES assessment_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  answer_explanations JSONB, -- For multiple choice: [{answer, explanation}]. For others: explanation of correct answer
  assessment_criteria JSONB,
  comments TEXT, -- General feedback/hints shown after answering
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assessment_id, language)
);

CREATE TABLE IF NOT EXISTS learning_object_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  format VARCHAR(50) CHECK (format IN ('video', 'interactive', 'slide', 'quiz', 'simulation')),
  duration_minutes INTEGER,
  media_refs UUID[], -- References to assets
  xapi_metadata JSONB,
  target_concept_ids UUID[],
  assessment_ids UUID[],
  success_criteria JSONB
);

CREATE TABLE IF NOT EXISTS learning_object_translations (
  id SERIAL PRIMARY KEY,
  learning_object_id UUID REFERENCES learning_object_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  learning_objectives TEXT[],
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learning_object_id, language)
);

CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_type VARCHAR(50) NOT NULL CHECK (
    relationship_type IN (
      'part_of', 'has_part', 'characteristic_of', 'has_characteristic',
      'member_of', 'has_member', 'has_subsequence', 'is_subsequence_of', 'participates_in',
      'prerequisite_of', 'has_prerequisite',
      'applies_to', 'applied_in', 'builds_on', 'exemplifies', 'derives_from',
      'author', 'introduced_by',
      'simultaneous_with', 'happens_during', 'before_or_simultaneous_with',
      'starts_before', 'ends_after', 'derives_into',
      'located_in', 'location_of', 'overlaps',
      'adjacent_to', 'surrounded_by', 'connected_to',
      'causally_related_to', 'regulates', 'regulated_by', 'enables',
      'contributes_to', 'results_in_assembly_of', 'results_in_breakdown_of',
      'capable_of', 'interacts_with', 'has_participant',
      'implies', 'contradicts', 'similar_to',
      'owns', 'is_owned_by', 'produces', 'produced_by', 'determined_by', 'determines',
      'correlated_with',
      'implements', 'implemented_by',
      'proves', 'proven_by', 'generalizes', 'specialized_by', 'approximates', 'approximated_by',
      'replaces', 'replaced_by',
      'custom' -- Fallback for LLM-discovered types not yet approved
    )
  ),
  suggested_relationship_type VARCHAR(100),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('unidirectional', 'bidirectional')),
  strength NUMERIC(3,2) CHECK (strength >= 0 AND strength <= 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS relationship_translations (
  id SERIAL PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT, -- With inline citations [src:uuid:page]
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(relationship_id, language)
);

CREATE TABLE IF NOT EXISTS discovered_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggested_relationship VARCHAR(100) NOT NULL UNIQUE,
  mapped_to VARCHAR(50), -- If mapped to existing type by administrator
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  example_contexts JSONB DEFAULT '[]'::jsonb, -- [{source, target, text_snippet, document_id}]
  status VARCHAR(20) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'mapped')),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  admin_notes TEXT
);

CREATE TABLE IF NOT EXISTS concept_relationships (
  id SERIAL PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  source_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  neo4j_synced_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(relationship_id, source_concept_id, target_concept_id)
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_concept_id UUID REFERENCES concepts(id),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- For personalized AI paths
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual', 'imported')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_path_translations (
  id SERIAL PRIMARY KEY,
  learning_path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learning_path_id, language)
);

CREATE TABLE IF NOT EXISTS curriculum_benchmark (
  benchmark_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_key TEXT NOT NULL UNIQUE, -- stable (e.g. 'cs101.week3.big_o')
  title TEXT NOT NULL,
  description TEXT,
  difficulty_level INTEGER, -- optional coarse level
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_path_steps (
  id SERIAL PRIMARY KEY,
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  benchmark_id UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  estimated_time_minutes INTEGER,
  target_difficulty INTEGER,
  scheduled_for TIMESTAMPTZ,
  rationale TEXT,
  UNIQUE(path_id, step_order),
  UNIQUE(path_id, concept_id)
);

CREATE TABLE IF NOT EXISTS learning_path_step_translations (
  id SERIAL PRIMARY KEY,
  step_id INTEGER REFERENCES learning_path_steps(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  notes TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(step_id, language)
);

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_name VARCHAR(500) NOT NULL,
  document_path TEXT,
  document_type VARCHAR(50) CHECK (document_type IN (
    'pdf', 'word', 'excel', 'powerpoint', 'image', 'video', 'audio', 'text')),
  language VARCHAR(40),
  author VARCHAR(255),
  publication_year INTEGER,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  checksum VARCHAR(64),
  processing_status VARCHAR(30) DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
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

CREATE TABLE IF NOT EXISTS concept_sources (
  id SERIAL PRIMARY KEY,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  pages INTEGER[],
  location TEXT, -- Section, paragraph, timestamp (e.g., 'Section 3.2', '12:35')
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS relationship_sources (
  id SERIAL PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  pages INTEGER[],
  location TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  taxonomy_node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  front_content TEXT NOT NULL,  
  back_content TEXT NOT NULL,   
  card_type VARCHAR(20) DEFAULT 'standard' CHECK (card_type IN ('standard', 'mcq')),
  tips JSONB DEFAULT '[]'::jsonb,
  content_metadata JSONB DEFAULT '{}'::jsonb, 
  source_type VARCHAR(50) CHECK (source_type IN ('manual', 'csv_import', 'note_generated', 'mindmap_generated')),
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS extracted_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  media_type VARCHAR(50) CHECK (media_type IN (
    'pdf', 'word', 'excel', 'powerpoint', 'image', 'video', 'audio', 'text')),
  storage_method VARCHAR(20) DEFAULT 'local_path' 
    CHECK (storage_method IN ('local_path', 'external_url')),
  content TEXT,
  subject_hints TEXT[],
  language VARCHAR(20),
  file_url TEXT NOT NULL,
  checksum VARCHAR(64),
  pages INTEGER[],
  extraction_location TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feynman_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  concept_title VARCHAR(255),
  explanation TEXT NOT NULL,
  target_level VARCHAR(40) DEFAULT 'beginner',
  language VARCHAR(10) DEFAULT 'en',
  analysis JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
    'discussion_thread', 'discussion_reply',
    'activity', 'comment',
    'shared_content'
  )),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_exam VARCHAR(50) NOT NULL,  -- e.g., 'DSE', 'ALevel'
  year INTEGER NOT NULL,
  paper VARCHAR(20),
  question_no VARCHAR(20),
  question_stem TEXT NOT NULL,
  options JSONB,
  correct_answer VARCHAR(50) NOT NULL,
  answer_explanation TEXT,
  related_concept_ids UUID[] DEFAULT '{}',
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessment_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  concept_id UUID,
  question_id UUID REFERENCES exam_questions(id),
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('feynman', 'quiz', 'error_review', 'active_recall')),
  original_answer TEXT,
  ai_analysis_result JSONB,
  correctness BOOLEAN,
  score NUMERIC(5,2),
  difficulty_level INTEGER,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feynman_explanations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES assessment_activities(id),
  user_id UUID NOT NULL,
  concept_id UUID NOT NULL,
  mode feynman_mode_type DEFAULT 'initial_explain',
  user_explanation TEXT NOT NULL,
  ai_feedback JSONB,
  misconceptions_detected BOOLEAN DEFAULT FALSE,
  rewritten_version TEXT,
  peer_teaching_reflection TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE error_book (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  question_id UUID REFERENCES exam_questions(id),
  concept_id UUID,
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
  error_pattern_tags TEXT[] DEFAULT '{}'
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES assessment_activities(id),
  user_id UUID NOT NULL,
  exam_question_id UUID REFERENCES exam_questions(id),
  chosen_option VARCHAR(50),
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flashcard_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  media_id UUID REFERENCES extracted_media(id) ON DELETE CASCADE,
  media_position VARCHAR(20) NOT NULL 
      CHECK (media_position IN ('front', 'back', 'hint', 'mnemonic')),
  display_order INTEGER DEFAULT 1,
  caption TEXT,
  display_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(flashcard_id, media_id, media_position)
);

CREATE TABLE IF NOT EXISTS flashcard_review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  review_mode VARCHAR(20) DEFAULT 'standard' CHECK (review_mode IN ('standard', 'mcq')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 4),
  duration_ms INTEGER, 
  scheduled_interval FLOAT,
  actual_interval FLOAT,
  review_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flashcard_schedules (
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  algorithm VARCHAR(20) DEFAULT 'simple' CHECK (algorithm IN ('simple', 'sm2', 'fsrs')),
  state VARCHAR(20) DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  due_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_review_date TIMESTAMP,
  -- Algorithm parameter sharing explanation:
  -- 1. Simple Mode: Use 'reps' to represent current level, 'interval_days' stores fixed interval
  -- 2. SM-2: Uses 'reps', 'interval_days', 'ease_factor'
  -- 3. FSRS: Uses 'reps', 'interval_days', 'stability', 'difficulty'
  interval_days FLOAT DEFAULT 0,
  reps INTEGER DEFAULT 0, -- Total review count (used as Level in Simple Mode)
  ease_factor FLOAT DEFAULT 2.5, -- (SM-2 only) Ease factor
  stability FLOAT DEFAULT 0, -- (FSRS only) Stability
  difficulty FLOAT DEFAULT 0, -- (FSRS only) Difficulty
  topic_cached VARCHAR(100), 
  PRIMARY KEY (flashcard_id, user_id)
);

CREATE TABLE IF NOT EXISTS flashcard_mnemonics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  mnemonic_type VARCHAR(50) CHECK (mnemonic_type IN ('abbreviation', 'acrostic', 'rhyme', 'storytelling', 'visual_association')),
  content TEXT NOT NULL,
  ai_generated_reasoning TEXT, 
  is_user_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_ar_environments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100), 
  ar_pin_data BYTEA, 
  ar_system VARCHAR(20) DEFAULT 'ARKit' CHECK (ar_system IN ('ARKit', 'ARCore', 'OpenXR')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);
  
CREATE TABLE IF NOT EXISTS label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  source VARCHAR(50) DEFAULT 'polyhaven',
  asset_type VARCHAR(20) CHECK (asset_type IN ('model', 'hdri', 'texture')),
  raw_api_data JSONB, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, external_id)
);

CREATE TABLE IF NOT EXISTS asset_categories (
    asset_id UUID REFERENCES asset_library(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, category_id)
);

CREATE TABLE IF NOT EXISTS asset_label (
    asset_id UUID REFERENCES asset_library(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES label(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE IF NOT EXISTS asset_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES asset_library(id) ON DELETE CASCADE,
  -- Corresponds to JSON structure levels
  component_type VARCHAR(50), -- e.g. "Diffuse", "gltf", "blend"
  resolution VARCHAR(40),     -- e.g. "1k", "2k", "4k"
  file_format VARCHAR(20),    -- e.g. "jpg", "exr", "gltf", "usd"
  -- File entity information
  url TEXT NOT NULL,
  file_size BIGINT,
  md5_hash VARCHAR(32),
  -- If this download includes sub-files (e.g., texture paths), store them here
  include_map JSONB, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vr_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  scene_asset_path VARCHAR(255),
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration_minutes INTEGER,
  required_concepts UUID[],
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_vr_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES vr_scenarios(id),
  game_state_data JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP,
  last_played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  completion_percentage FLOAT DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  total_play_time_minutes INTEGER DEFAULT 0,
  UNIQUE(user_id, scenario_id)
);

CREATE TABLE IF NOT EXISTS vr_learning_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID REFERENCES vr_scenarios(id),
  required_flashcard_id UUID REFERENCES flashcards(id),
  trigger_context VARCHAR(100),
  on_success_action VARCHAR(100),
  on_failure_action VARCHAR(100),
  failure_feedback_message TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20),
  icon VARCHAR(50),
  is_system BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, url_id)
);

CREATE TABLE IF NOT EXISTS tag_applications (
  id SERIAL PRIMARY KEY,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'source', 'concept', 'diagram', 'flashcard', 'learning_path', 'shared_content',
    'vr_scenario', 'generated_script'
  )),
  entity_id UUID NOT NULL,
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tag_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_table VARCHAR(50) CHECK (source_table IN (
    'procedure_details', 'concepts', 'learning_paths', 'taxonomy_nodes',
    'assessment_details', 'flashcards', 'vr_scenarios')),
  source_id UUID,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  diagram_type VARCHAR(50) NOT NULL CHECK (diagram_type IN (
    'flowchart', 'sequence', 'mindmap', 'graph', 'timeline', 'tree')),
  diagram_data JSONB NOT NULL,      -- {nodes: [{id, label, x, y, ...}], edges: [{source, target, ...}]}
  view_state JSONB,                 -- {zoom, panX, panY, ...}
  is_edited BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  url_id VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  community_type VARCHAR(50) NOT NULL CHECK (community_type IN (
    'public', 'private', 'invite_only', 'course_based'
  )),
  max_members INTEGER,
  avatar_url TEXT,
  banner_url TEXT,
  color_theme VARCHAR(20),
  features_enabled JSONB DEFAULT '{
    "discussions": true,
    "shared_resources": true,
    "leaderboard": true,
    "challenges": true,
    "peer_review": true
  }'::jsonb,
  member_count INTEGER DEFAULT 0,
  resource_count INTEGER DEFAULT 0,
  activity_score INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS community_members (
  id SERIAL PRIMARY KEY,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member' CHECK (role IN (
    'owner', 'admin', 'moderator', 'member', 'pending')),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'banned', 'left')),
  contribution_points INTEGER DEFAULT 0,
  resources_shared INTEGER DEFAULT 0,
  feedback_given INTEGER DEFAULT 0,
  notification_settings JSONB DEFAULT '{"all": true}'::jsonb,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  invited_email VARCHAR(255),
  invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invitation_code VARCHAR(50) UNIQUE,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'declined', 'expired', 'revoked'
  )),
  message TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_global BOOLEAN DEFAULT TRUE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  point_type_id UUID REFERENCES point_types(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL CHECK (action_type IN (
    'share_content', 'content_liked',
    'give_feedback', 'feedback_helpful',
    'discussion_post', 'discussion_reply', 'answer_accepted',
    'challenge_complete', 'challenge_win',
    'daily_study', 'weekly_share',
    'mentor_session')),
  points_awarded INTEGER NOT NULL,
  daily_limit INTEGER,
  total_limit INTEGER,
  conditions JSONB,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  point_type_id UUID REFERENCES point_types(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  action_type VARCHAR(100) NOT NULL CHECK (action_type IN (
    'share_content', 'content_liked',
    'give_feedback', 'feedback_helpful',
    'discussion_post', 'discussion_reply', 'answer_accepted',
    'challenge_complete', 'challenge_win',
    'daily_study', 'weekly_share',
    'mentor_session')),
  action_id UUID, -- The entity that triggered this
  rule_id UUID REFERENCES point_rules(id) ON DELETE SET NULL,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  color VARCHAR(20),
  rarity VARCHAR(30) CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  badge_type VARCHAR(50) NOT NULL CHECK (badge_type IN (
    'achievement', 'milestone', 'skill', 'community', 'special')),
  criteria JSONB NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  point_type_id UUID REFERENCES point_types(id) ON DELETE SET NULL,
  is_global BOOLEAN DEFAULT TRUE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  is_secret BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  show_on_profile BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, badge_id, community_id)
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  point_type_id UUID REFERENCES point_types(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rankings JSONB NOT NULL, -- [{user_id, rank, points, username, avatar_url}]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  streak_type VARCHAR(50) NOT NULL DEFAULT 'daily_study'
    CHECK (streak_type IN ('daily_study', 'weekly_share')),
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  streak_started_at DATE,
  current_multiplier NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, streak_type)
);

CREATE TABLE IF NOT EXISTS mentorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mentee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'declined', 'cancelled')),
  subject VARCHAR(255),
  topic_focus TEXT,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  sessions_count INTEGER DEFAULT 0,
  mentor_notes TEXT,
  mentee_progress_notes TEXT,
  mentor_points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  UNIQUE(mentor_id, mentee_id),
  CHECK (mentor_id != mentee_id)
);

CREATE TABLE IF NOT EXISTS mentorship_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentorship_id UUID REFERENCES mentorships(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram', 'shared_content',
    'flashcard', 'vr_scenario')),
  entity_id UUID NOT NULL,
  title VARCHAR(500),
  note TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  is_viewed BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMP,
  is_completed BOOLEAN DEFAULT FALSE, 
  completed_at TIMESTAMP,
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'community_vs_community', 'team_battle', 'collaborative')),
  team_a_id UUID,
  team_b_id UUID,
  team_a_name VARCHAR(100),
  team_b_name VARCHAR(100),
  criteria JSONB NOT NULL,
  team_a_score INTEGER DEFAULT 0,
  team_b_score INTEGER DEFAULT 0,
  winner_points INTEGER DEFAULT 0,
  winner_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  participant_points INTEGER DEFAULT 0,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(30) DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'active', 'completed', 'cancelled')),
  winner VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_challenge_members (
  id SERIAL PRIMARY KEY,
  challenge_id UUID REFERENCES group_challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team VARCHAR(10) NOT NULL CHECK (team IN ('team_a', 'team_b')),
  contribution_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_currency (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'fun', 'tools', 'prosocial', 'premium')),
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN (
    'profile_border', 'name_color', 'avatar', 'emoji_pack',
    'streak_freeze', 'xp_boost',
    'hint_pack', 'quiz_retry', 'ai_summary', 'pdf_export',
    'community_boost', 'content_vote', 'appreciation', 'challenge_sponsor',
    'advanced_analytics', 'quiz_creator', 'palace_pro')),
  item_value JSONB NOT NULL, -- xp_boost: {"multiplier": 2, "duration_hours": 24}
  is_giftable BOOLEAN DEFAULT FALSE,
  is_limited BOOLEAN DEFAULT FALSE,
  stock_count INTEGER,
  available_from TIMESTAMP,
  available_until TIMESTAMP,
  icon VARCHAR(50),
  preview_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_inventory (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, shop_item_id)
);

CREATE TABLE IF NOT EXISTS streak_milestones (
  id SERIAL PRIMARY KEY,
  streak_type VARCHAR(50) NOT NULL CHECK (streak_type IN ('daily_study', 'weekly_share')),
  period_required INTEGER NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  coins_awarded INTEGER DEFAULT 0,
  badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL, 
  item_quantity INTEGER DEFAULT 0,
  multiplier_boost NUMERIC(3,2) DEFAULT 0,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  UNIQUE(streak_type, period_required)
);

CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  item_snapshot JSONB NOT NULL,
  price_paid INTEGER NOT NULL,
  is_gift BOOLEAN DEFAULT FALSE,
  gifted_to UUID REFERENCES users(id) ON DELETE SET NULL,
  gift_message TEXT,
  status VARCHAR(30) DEFAULT 'completed' CHECK (status IN (
    'completed', 'used', 'refunded', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  theme VARCHAR(50),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  banner_url TEXT,
  color VARCHAR(20),
  participation_points INTEGER DEFAULT 0,
  participation_coins INTEGER DEFAULT 0,
  participation_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  participation_item_qty INTEGER DEFAULT 0,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'individual', 'community', 'classroom')),
  criteria JSONB NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  coins_awarded INTEGER DEFAULT 0,
  badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  item_quantity INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_event_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES event_challenges(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS active_boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('user', 'community')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  boost_type VARCHAR(50) NOT NULL CHECK (boost_type IN (
    'xp_multiplier', 'coin_multiplier', 'streak_protection')),
  boost_value JSONB NOT NULL,
  source_id UUID,
  coins_spent INTEGER DEFAULT 0,
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  beneficiaries_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (scope = 'user' AND user_id IS NOT NULL AND community_id IS NULL) OR
    (scope = 'community' AND community_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS content_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
    'topic', 'feature', 'content', 'improvement')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  total_votes INTEGER DEFAULT 0,
  total_coins INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'completed', 'declined')),
  admin_response TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_request_votes (
  id SERIAL PRIMARY KEY,
  request_id UUID REFERENCES content_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coins_contributed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, user_id)
);

CREATE TABLE IF NOT EXISTS appreciations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  appreciation_type VARCHAR(50) NOT NULL CHECK (appreciation_type IN (
    'mentoring', 'feedback', 'content', 'answer', 'general')),
  coins_given INTEGER DEFAULT 0,
  message TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'flashcard', 'vr_scenario')),
  entity_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  visibility VARCHAR(30) NOT NULL DEFAULT 'public' CHECK (visibility IN (
    'public', 'community', 'private', 'unlisted')),
  community_ids UUID[],
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  average_rating NUMERIC(3,2),
  rating_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  status VARCHAR(30) DEFAULT 'published' CHECK (status IN (
    'draft', 'published', 'archived', 'removed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_downloads (
  id SERIAL PRIMARY KEY,
  shared_content_id UUID REFERENCES shared_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL CHECK (action_type IN (
    'view', 'download', 'save', 'fork')),
  forked_entity_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shared_content_id, user_id, action_type)
);

CREATE TABLE IF NOT EXISTS content_ratings (
  id SERIAL PRIMARY KEY,
  shared_content_id UUID REFERENCES shared_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shared_content_id, user_id)
);

CREATE TABLE IF NOT EXISTS feedback_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram', 'shared_content',
    'flashcard')),
  entity_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  specific_questions TEXT[],
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'completed', 'closed', 'expired')),
  max_responses INTEGER DEFAULT 5,
  current_responses INTEGER DEFAULT 0,
  points_offered INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_request_id UUID REFERENCES feedback_requests(id) ON DELETE SET NULL,
  reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_helpful BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reputation_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  teaching_score INTEGER DEFAULT 0,
  content_score INTEGER DEFAULT 0,
  feedback_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  reliability_score INTEGER DEFAULT 0,
  total_score INTEGER GENERATED ALWAYS AS (
    teaching_score + content_score + feedback_score + engagement_score + reliability_score) STORED,
  reputation_level VARCHAR(30) CHECK (reputation_level IN (
    'newcomer', 'contributor', 'helper', 'expert', 'master')),
  last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, community_id)
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
    'content_shared', 'content_liked', 'content_rated',
    'feedback_given', 'feedback_marked_helpful',
    'badge_earned', 'streak_milestone',
    'mentoring_completed', 'mentee_helped',
    'challenge_won', 'challenge_completed',
    'discussion_created', 'reply_liked')),
  dimension VARCHAR(50) NOT NULL CHECK (dimension IN (
    'teaching', 'content', 'feedback', 'engagement', 'reliability')),
  points_change INTEGER NOT NULL,
  reference_type VARCHAR(50) CHECK (reference_type IS NULL OR reference_type IN (
    'shared_content', 'peer_feedback', 'feedback_request',
    'badge', 'mentorship', 'group_challenge', 'challenge',
    'discussion_thread', 'discussion_reply', 'appreciation')),
  reference_id UUID,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reputation_levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  url_id VARCHAR(30) NOT NULL UNIQUE,
  min_score INTEGER NOT NULL,
  max_score INTEGER,
  icon VARCHAR(50),
  color VARCHAR(20),
  badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
  privileges JSONB,
  is_global BOOLEAN DEFAULT TRUE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussion_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  thread_type VARCHAR(50) DEFAULT 'discussion' CHECK (thread_type IN (
    'discussion', 'question', 'announcement', 'poll', 'resource', 'challenge')),
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN (
    'open', 'closed', 'pinned', 'archived', 'removed')),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  is_answered BOOLEAN DEFAULT FALSE,
  accepted_reply_id UUID,
  tags TEXT[],
  related_entity_type VARCHAR(50) CHECK (related_entity_type IS NULL OR related_entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'challenge', 'event',
    'flashcard', 'vr_scenario')),
  related_entity_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discussion_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES discussion_threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES discussion_replies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_accepted BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  instructions TEXT,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'mnemonic', 'memory_palace', 'flashcard', 'quiz', 'teaching', 'creative')),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN (
    'draft', 'upcoming', 'active', 'judging', 'completed', 'cancelled')),
  max_participants INTEGER,
  participant_count INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  rewards JSONB,
  judging_criteria JSONB,
  judge_user_ids UUID[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id SERIAL PRIMARY KEY,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'registered' CHECK (status IN (
    'registered', 'submitted', 'disqualified', 'withdrawn')),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shared_content_id UUID REFERENCES shared_content(id) ON DELETE SET NULL,
  title VARCHAR(500),
  description TEXT,
  attachments JSONB,
  scores JSONB,
  final_score NUMERIC(5,2),
  rank INTEGER,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'winner')),
  judge_feedback TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  judged_at TIMESTAMP,
  CHECK (shared_content_id IS NOT NULL OR title IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS user_presence (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'online' CHECK (status IN (
    'online', 'away', 'busy', 'offline')),
  current_entity_type VARCHAR(50) CHECK (current_entity_type IS NULL OR current_entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'chat_room',
    'vr_scenario', 'game_session', 'flashcard')),
  current_entity_id UUID,
  current_community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  socket_id VARCHAR(100),
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS edit_locks (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram', 'flashcard')),
  entity_id UUID NOT NULL,
  locked_by UUID REFERENCES users(id) ON DELETE CASCADE,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS entity_viewers (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'chat_room',
    'vr_scenario', 'game_session', 'flashcard')),
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(20) UNIQUE,
  name VARCHAR(255),
  description TEXT,
  avatar_url TEXT,
  room_type VARCHAR(30) DEFAULT 'group' CHECK (room_type IN (
    'direct', 'group', 'community', 'channel')),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT TRUE,
  max_participants INTEGER DEFAULT 50,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_permanent BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  retention_days INTEGER DEFAULT NULL,
  member_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  last_message_at TIMESTAMP,
  last_message_preview TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) DEFAULT 'member' CHECK (role IN (
    'owner', 'admin', 'member')),
  is_active BOOLEAN DEFAULT TRUE,
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMP,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(30) DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'file', 'system')),
  content TEXT NOT NULL, -- Encrypted by backend, stored as base64
  is_encrypted BOOLEAN DEFAULT TRUE, -- FALSE only for system messages
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  attachments JSONB, -- [{type, url, name, size}]
  mentions UUID[],
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  reactions JSONB DEFAULT '{}'::jsonb,
  read_by JSONB DEFAULT '{}'::jsonb, -- {"user_id": "timestamp", ...}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'blocked')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE(user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'mention', 'reply', 'like', 'comment',
    'badge_earned', 'milestone_reached', 'streak_reminder',
    'invite', 'follow', 'friend_request',
    'challenge_invite', 'challenge_result',
    'feedback_received', 'feedback_request',
    'content_shared', 'content_featured',
    'mentorship', 'system')),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  entity_type VARCHAR(50) CHECK (entity_type IS NULL OR entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'discussion_reply',
    'badge', 'challenge', 'community', 'user', 'chat_room',
    'peer_feedback', 'activity', 'mentorship', 'appreciation',
    'flashcard', 'vr_scenario', 'game_session')),
  entity_id UUID,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  group_key VARCHAR(100),
  group_count INTEGER DEFAULT 1,
  is_read BOOLEAN DEFAULT FALSE,
  is_seen BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  action_data JSONB,
  sent_push BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'mention', 'reply', 'like', 'comment',
    'badge_earned', 'milestone_reached', 'streak_reminder',
    'invite', 'follow', 'friend_request',
    'challenge_invite', 'challenge_result',
    'feedback_received', 'feedback_request',
    'content_shared', 'content_featured',
    'mentorship', 'system')),
  in_app BOOLEAN DEFAULT TRUE,
  push BOOLEAN DEFAULT TRUE,
  email BOOLEAN DEFAULT FALSE,
  email_frequency VARCHAR(30) DEFAULT 'instant' CHECK (email_frequency IN (
    'instant', 'daily', 'weekly', 'never')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, notification_type)
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'shared', 'commented', 'liked',
    'achieved', 'milestone_reached',
    'joined_community', 'created_content',
    'completed_challenge', 'started_mentoring',
    'followed', 'streak_milestone')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'discussion_reply',
    'badge', 'challenge', 'community', 'user', 'mentorship', 'appreciation',
    'chat_room', 'peer_feedback', 'activity',
    'flashcard', 'vr_scenario', 'game_session')),
  entity_id UUID NOT NULL,
  entity_preview JSONB,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  visibility VARCHAR(30) DEFAULT 'public' CHECK (visibility IN (
    'public', 'community', 'followers', 'private')),
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES activity_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);


CREATE TABLE IF NOT EXISTS user_consent (
  consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- e.g. 'telemetry', 'group_analytics_share', 'external_import'
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, consent_type)
);

CREATE TABLE IF NOT EXISTS device (
  device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- e.g. 'visionos', 'ios', 'android', 'web'
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS external_data_source (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE, -- stable identifier (e.g. 'google_drive')
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_source_connection (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES external_data_source(source_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'error'
  external_user_ref TEXT, -- opaque id from provider
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  token_ref TEXT, -- pointer to secrets vault / KMS record
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, source_id)
);

CREATE TABLE IF NOT EXISTS data_sync_run (
  sync_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES user_source_connection(connection_id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'partial', 'failed'
  records_in INTEGER NOT NULL DEFAULT 0,
  records_out INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_detail TEXT
);

CREATE TABLE IF NOT EXISTS imported_record (
  imported_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID NOT NULL REFERENCES data_sync_run(sync_run_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- e.g. 'material', 'attempt', 'review'
  external_record_id TEXT,
  occurred_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS learning_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES device(device_id) ON DELETE SET NULL,
  event_type         TEXT NOT NULL,
  -- e.g. 'material_open', 'practice_start', 'practice_end',
  -- 'question_answered', 'quiz_submitted', 'srs_review'
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
  -- examples:
  -- { "session_id": "...", "topic": "...", "difficulty": 3, "correct": true,
  -- "question_id": "...", "attempt_no": 2, "interleaving_block": 5 }
);

CREATE TABLE IF NOT EXISTS learning_session (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES device(device_id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  session_type TEXT NOT NULL DEFAULT 'study', -- 'study', 'practice', 'quiz'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS memory_item (
  memory_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' -- 'active', 'archived'
);

CREATE TABLE IF NOT EXISTS memory_review (
  review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_item_id UUID NOT NULL REFERENCES memory_item(memory_item_id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade INTEGER NOT NULL, -- e.g. 0..5 or 0..3 depending on your model
  correct BOOLEAN,
  response_time_ms INTEGER,
  interval_days NUMERIC(10,3), -- interval used after this review
  ease_factor NUMERIC(10,6), -- model parameter after this review (if using SM-2-like)
  model_state JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS user_forgetting_model (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL DEFAULT 'default',
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memory_retention_snapshot (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_item_id UUID NOT NULL REFERENCES memory_item(memory_item_id) ON DELETE CASCADE,
  predicted_recall NUMERIC(6,5) NOT NULL, -- 0..1
  as_of TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at TIMESTAMPTZ,
  UNIQUE (id, memory_item_id, as_of)
);

CREATE TABLE IF NOT EXISTS user_activity_heatmap (
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,  -- e.g. Monday of the week, or first day of month
  period_kind TEXT NOT NULL,  -- 'week', 'month'
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  active_minutes INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, period_start, period_kind, day_of_week, hour_of_day)
);

CREATE TABLE IF NOT EXISTS practice_block (
  block_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES learning_session(session_id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  intended_goal TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS practice_item_attempt (
  attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id UUID REFERENCES practice_block(block_id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  benchmark_id UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  difficulty_level INTEGER,
  correct BOOLEAN,
  response_time_ms INTEGER,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS user_interleaving_stats (
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_kind TEXT NOT NULL, -- 'week', 'month'
  total_attempts INTEGER NOT NULL DEFAULT 0,
  topic_switches INTEGER NOT NULL DEFAULT 0,
  unique_benchmarks INTEGER NOT NULL DEFAULT 0,
  interleaving_index NUMERIC(10,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, period_start, period_kind)
);

CREATE TABLE IF NOT EXISTS learning_path_prediction (
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_name TEXT NOT NULL,
  model_version TEXT,
  inputs_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  error_detail TEXT
);

CREATE TABLE IF NOT EXISTS user_benchmark_mastery (
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id UUID NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  mastery_score NUMERIC(6,5) NOT NULL DEFAULT 0, -- 0..1
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0, -- 0..1
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, benchmark_id)
);

CREATE TABLE IF NOT EXISTS gap_analysis_run (
  gap_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_name TEXT NOT NULL,
  model_version TEXT,
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  notes TEXT,
  inputs_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS identified_gap (
  gap_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_run_id UUID NOT NULL REFERENCES gap_analysis_run(gap_run_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id UUID NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  severity INTEGER NOT NULL DEFAULT 1, -- 1..5
  reason TEXT,
  supporting_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_recommendation (
  recommendation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gap_id UUID REFERENCES identified_gap(gap_id) ON DELETE SET NULL,
  benchmark_id UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL DEFAULT 'lesson', -- 'lesson', 'practice', 'review'
  priority INTEGER NOT NULL DEFAULT 1, -- 1..5
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' -- 'open', 'accepted', 'dismissed'
);

CREATE TABLE IF NOT EXISTS learning_group (
  group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  visibility TEXT NOT NULL DEFAULT 'private', -- 'private', 'invite', 'public'
  analytics_sharing TEXT NOT NULL DEFAULT 'anonymized_only', -- enforce policy at query layer
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS learning_group_member (
  group_id UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, id)
);

CREATE TABLE IF NOT EXISTS group_member_alias (
  group_id UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias_key TEXT NOT NULL, -- e.g. 'member_07' (generated server-side)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, id),
  UNIQUE (group_id, alias_key)
);

CREATE TABLE IF NOT EXISTS group_goal (
  goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- e.g. 'study_minutes', 'reviews', 'mastery_gain'
  target_value NUMERIC(14,4) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS group_analytics_snapshot (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_kind TEXT NOT NULL, -- 'week', 'month'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  member_count INTEGER NOT NULL DEFAULT 0,
  avg_study_minutes  NUMERIC(14,4) NOT NULL DEFAULT 0,
  avg_predicted_recall NUMERIC(6,5) NOT NULL DEFAULT 0,
  avg_interleaving_index NUMERIC(10,6) NOT NULL DEFAULT 0,
  avg_mastery_score  NUMERIC(6,5) NOT NULL DEFAULT 0,
  distribution JSONB NOT NULL DEFAULT '{}'::jsonb
  -- e.g. histograms/percentiles: { "study_minutes_p50":..., "p90":..., "bins":[...] }
);

CREATE TABLE IF NOT EXISTS group_member_metric_bucket (
  bucket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_kind TEXT NOT NULL,
  alias_key TEXT NOT NULL, -- references group_member_alias.alias_key (no id)
  metric_type TEXT NOT NULL,
  metric_value NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_config (
  dashboard_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  layout JSONB NOT NULL DEFAULT '{}'::jsonb, -- grid layout, ordering, sizes
  UNIQUE (id, name)
);

CREATE TABLE IF NOT EXISTS dashboard_widget (
  widget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboard_config(dashboard_id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- 'forgetting_curve', 'heatmap', 'interleaving', 'gaps', etc.
  title TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- chart settings, filters
  ordinal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dashboard_panel_cache (
  cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  cache_key TEXT NOT NULL, -- e.g. "forgetting_curve:last_30_days"
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, widget_type, cache_key)
);

CREATE TABLE IF NOT EXISTS ai_generation_run (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_type           TEXT NOT NULL,
  -- e.g. 'question_generation', 'rewrite', 'analogy_generation', 'brainstorm_prompting', 'socratic_turn'
  model_name         TEXT NOT NULL,
  model_version      TEXT,
  status             TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at        TIMESTAMPTZ,
  inputs_summary     JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_detail       TEXT
);

CREATE TABLE IF NOT EXISTS comprehension_question (
  question_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  target_concept_id  UUID REFERENCES concepts(id) ON DELETE SET NULL,
  question_type      TEXT NOT NULL,      -- 'why' | 'how'
  difficulty_level   INTEGER NOT NULL,   -- define your scale (e.g. 1..5)
  reasoning_focus    TEXT,               -- e.g. 'cause', 'mechanism', 'link_between_ideas'
  question_text      TEXT NOT NULL,
  rubric             JSONB NOT NULL DEFAULT '{}'::jsonb, -- expected points/criteria
  teacher_notes      TEXT,                               -- optional: guidance for reviewers
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_question_assignment (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES comprehension_question(question_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'answered', 'skipped'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, question_id)
);

CREATE TABLE IF NOT EXISTS user_question_response (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES user_question_assignment(assignment_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES comprehension_question(question_id) ON DELETE CASCADE,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_text TEXT NOT NULL,
  score NUMERIC(6,3), -- optional
  feedback_text TEXT, -- optional
  feedback_rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback_run_id UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS passage_rewrite (
  rewrite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_language TEXT NOT NULL, -- 'en' | 'zh'
  target_language TEXT NOT NULL, -- 'en' | 'zh' (can be same language)
  simplification_level INTEGER NOT NULL DEFAULT 1, -- define scale (e.g. 1..3)
  source_text TEXT NOT NULL,
  simplified_text TEXT NOT NULL,
  -- Optional alignment for side-by-side UI (sentence mapping, offsets, etc.)
  alignment_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  readability_metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. length, vocab stats
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metaphor_template (
  template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL => shared library
  language_code TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_text TEXT NOT NULL, -- supports placeholders; interpretation handled in app logic
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS generated_analogy (
  analogy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  template_id UUID REFERENCES metaphor_template(template_id) ON DELETE SET NULL,
  analogy_text TEXT NOT NULL,
  explanation_text TEXT, -- clarifies mapping back to the concept
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brainstorming_session (
  brainstorm_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  language_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS brainstorming_prompt (
  prompt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brainstorm_session_id UUID NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,  -- 'who' | 'what' | 'why' | 'how'
  ordinal INTEGER NOT NULL DEFAULT 0,
  prompt_text TEXT NOT NULL,
  run_id UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI-generated prompts
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brainstorming_response (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES brainstorming_prompt(prompt_id) ON DELETE CASCADE,
  brainstorm_session_id UUID NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS brainstorming_artifact (
  artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brainstorm_session_id UUID NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL DEFAULT 'outline', -- 'outline', 'mindmap', 'summary'
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS socratic_session (
  socratic_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed_question_id UUID REFERENCES comprehension_question(question_id) ON DELETE SET NULL,
  language_code TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL DEFAULT 1,
  goal TEXT, -- e.g. "derive explanation", "correct misconception", "solve problem"
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS socratic_turn (
  turn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socratic_session_id UUID NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  turn_kind TEXT NOT NULL, -- 'question', 'answer', 'hint', 'feedback', 'probe'
  content TEXT NOT NULL,
  run_id UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI produced this turn
  tags JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "misconception": "...", "strategy": "scaffold" }
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (socratic_session_id, ordinal)
);

CREATE TABLE IF NOT EXISTS socratic_state_snapshot (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socratic_session_id UUID NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  as_of TIMESTAMPTZ NOT NULL DEFAULT now(),
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (socratic_session_id, as_of)
);

CREATE TABLE IF NOT EXISTS misconception (
  misconception_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL => shared library
  language_code TEXT NOT NULL,
  concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS socratic_misconception_observation (
  observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socratic_session_id UUID NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  misconception_id UUID NOT NULL REFERENCES misconception(misconception_id) ON DELETE CASCADE,
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================================
-- Ivy2 schema tables (without indexes), ordered by foreign key dependencies
-- ============================================================================

-- Root table (no FKs)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, subjects
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES users(id),
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on subjects
CREATE TABLE IF NOT EXISTS knowledge_points (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  subject_id UUID REFERENCES subjects(id),
  module_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT DEFAULT '{"concept","structure","apply"}',
  canonical_quote TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on courses, users
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  course_id UUID REFERENCES courses(id),
  teacher_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on classes, users
CREATE TABLE IF NOT EXISTS class_enrollments (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, courses, subjects
CREATE TABLE IF NOT EXISTS content_items (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  owner_user_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  subject_id UUID REFERENCES subjects(id),
  source_type TEXT NOT NULL CHECK(source_type IN (
    'upload_pdf','upload_text','kb_article','teacher_notes'
  )),
  title TEXT,
  original_filename TEXT,
  storage_uri TEXT,
  raw_text TEXT,
  language TEXT DEFAULT 'zh',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on content_items
CREATE TABLE IF NOT EXISTS content_parses (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  parse_version INT DEFAULT 1 NOT NULL,
  parser_name TEXT DEFAULT 'pipeline_v1' NOT NULL,
  status TEXT DEFAULT 'succeeded' NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
  detected_subject_code TEXT,
  detected_modules JSONB NOT NULL,
  total_points INT DEFAULT 0 NOT NULL,
  quality_score NUMERIC(4, 3) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on content_parses
CREATE TABLE IF NOT EXISTS content_parse_chunks (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  content_parse_id UUID NOT NULL REFERENCES content_parses(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  chunk_text TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on content_parses, knowledge_points
CREATE TABLE IF NOT EXISTS content_kp_links (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  content_parse_id UUID NOT NULL REFERENCES content_parses(id) ON DELETE CASCADE,
  kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  part_key TEXT,
  point_index INT,
  evidence JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on courses, subjects, users
CREATE TABLE IF NOT EXISTS script_templates (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  course_id UUID REFERENCES courses(id),
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  template_version INT DEFAULT 1 NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL CHECK(status IN ('draft','ready','published','archived')),
  match_rules JSONB NOT NULL,
  difficulty_rules JSONB NOT NULL,
  story_config JSONB NOT NULL,
  hasQuiz BOOLEAN DEFAULT FALSE NOT NULL,
  target_level TEXT DEFAULT 'standard' NOT NULL CHECK(target_level IN ('beginner','standard','advanced','all')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  quizSource TEXT DEFAULT 'doc_only' NOT NULL CHECK(quizSource IN ('doc_only','doc_ai','ai_only')),
  questionSet JSONB,
  PRIMARY KEY (id)
);

-- Depends on script_templates
CREATE TABLE IF NOT EXISTS template_reviews (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  template_id UUID NOT NULL REFERENCES script_templates(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES users(id),
  decision TEXT NOT NULL CHECK(decision IN ('approve','request_changes','reject')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on subjects, knowledge_points, users
CREATE TABLE IF NOT EXISTS question_bank (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  subject_id UUID REFERENCES subjects(id),
  module_key TEXT,
  kp_id UUID REFERENCES knowledge_points(id),
  question_type TEXT NOT NULL CHECK(question_type IN ('mcq','multi','tf','fill','sort','match','short')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB NOT NULL,
  skill_dim TEXT NOT NULL CHECK(skill_dim IN ('concept','structure','apply')),
  difficulty INT DEFAULT 1 NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
  score_max NUMERIC(6, 2) DEFAULT 1.0 NOT NULL,
  doc_quote TEXT,
  code_snippet TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, courses, subjects, content_items, content_parses, script_templates
CREATE TABLE IF NOT EXISTS scripts (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  subject_id UUID REFERENCES subjects(id),
  content_item_id UUID REFERENCES content_items(id),
  content_parse_id UUID REFERENCES content_parses(id),
  template_id UUID REFERENCES script_templates(id),
  title TEXT,
  status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('draft','active','completed','abandoned')),
  difficulty_level TEXT DEFAULT 'easy' NOT NULL CHECK(difficulty_level IN ('easy','medium','hard')),
  outline_json JSONB DEFAULT '{}'::JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  PRIMARY KEY (id)
);

-- Depends on scripts, knowledge_points
CREATE TABLE IF NOT EXISTS script_clues (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  clue_index INT NOT NULL,
  module_key TEXT NOT NULL,
  kp_id UUID NOT NULL REFERENCES knowledge_points(id),
  npc_name TEXT,
  scene_title TEXT,
  doc_quote TEXT,
  code_snippet TEXT,
  question_type TEXT NOT NULL CHECK(question_type IN ('mcq','multi','tf','fill','sort','match','short')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB NOT NULL,
  skill_dim TEXT NOT NULL CHECK(skill_dim IN ('concept','structure','apply')),
  difficulty INT DEFAULT 1 NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
  score_max NUMERIC(6, 2) DEFAULT 1.0 NOT NULL,
  hint_after_wrong INT DEFAULT 2 NOT NULL,
  hint_text TEXT,
  branch_key TEXT DEFAULT 'main',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, scripts
CREATE TABLE IF NOT EXISTS script_sessions (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  current_clue_index INT DEFAULT 1 NOT NULL,
  current_wrong_count INT DEFAULT 0 NOT NULL,
  hint_shown BOOLEAN DEFAULT FALSE NOT NULL,
  branch_key TEXT,
  state_json JSONB DEFAULT '{}'::JSONB NOT NULL,
  last_active_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, courses, subjects
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  subject_id UUID REFERENCES subjects(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('doc_only','doc_ai','ai_only')),
  status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('draft','active','submitted','graded')),
  generated_from JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  submitted_at TIMESTAMP,
  PRIMARY KEY (id)
);

-- Depends on quizzes, question_bank, knowledge_points
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES question_bank(id),
  kp_id UUID REFERENCES knowledge_points(id),
  question_type TEXT NOT NULL CHECK(question_type IN ('mcq','multi','tf','fill','sort','match','short')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer JSONB NOT NULL,
  skill_dim TEXT NOT NULL CHECK(skill_dim IN ('concept','structure','apply')),
  difficulty INT DEFAULT 1 NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
  score_max NUMERIC(6, 2) DEFAULT 1.0 NOT NULL,
  doc_quote TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, scripts, script_clues
CREATE TABLE IF NOT EXISTS clue_attempts (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  clue_id UUID NOT NULL REFERENCES script_clues(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL,
  answer JSONB NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE NOT NULL,
  used_hint BOOLEAN DEFAULT FALSE NOT NULL,
  time_spent_ms INT,
  score_earned NUMERIC(6, 2) DEFAULT 0.0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on quizzes, quiz_questions, users
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer JSONB NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE NOT NULL,
  score_earned NUMERIC(6, 2) DEFAULT 0.0 NOT NULL,
  time_spent_ms INT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, knowledge_points
CREATE TABLE IF NOT EXISTS kp_mastery_snapshots (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  mastery NUMERIC(5, 4) NOT NULL,
  total_score_max NUMERIC(10, 2) DEFAULT 0 NOT NULL,
  total_score_earned NUMERIC(10, 2) DEFAULT 0 NOT NULL,
  last_attempt_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, scripts
CREATE TABLE IF NOT EXISTS module_progress (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  mastery NUMERIC(5, 4) DEFAULT 0.0 NOT NULL,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, courses, subjects
CREATE TABLE IF NOT EXISTS study_plans (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  subject_id UUID REFERENCES subjects(id),
  plan_type TEXT NOT NULL CHECK(plan_type IN ('auto','teacher_assigned')),
  status TEXT DEFAULT 'active' NOT NULL CHECK(status IN ('active','completed','archived')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on study_plans, knowledge_points
CREATE TABLE IF NOT EXISTS study_plan_items (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  kp_id UUID NOT NULL REFERENCES knowledge_points(id),
  recommended_action TEXT NOT NULL CHECK(recommended_action IN (
    'replay_clue','quiz','read_quote','extra_practice'
  )),
  priority INT DEFAULT 3 NOT NULL CHECK(priority BETWEEN 1 AND 5),
  due_at TIMESTAMP,
  reason_json JSONB DEFAULT '{}'::JSONB NOT NULL,
  status TEXT DEFAULT 'open' NOT NULL CHECK(status IN ('open','done','skipped')),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on classes, users, content_items, script_templates
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  assignment_type TEXT NOT NULL CHECK(assignment_type IN ('script','quiz','mixed')),
  target_content_item_id UUID REFERENCES content_items(id),
  template_id UUID REFERENCES script_templates(id),
  due_at TIMESTAMP,
  pass_mastery NUMERIC(5, 4),
  pass_quiz_score NUMERIC(5, 4),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on assignments, users, scripts, quizzes
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_id UUID REFERENCES scripts(id),
  quiz_id UUID REFERENCES quizzes(id),
  status TEXT DEFAULT 'submitted' NOT NULL CHECK(status IN ('not_started','in_progress','submitted','graded')),
  mastery NUMERIC(5, 4),
  quiz_score NUMERIC(5, 4),
  submitted_at TIMESTAMP,
  graded_at TIMESTAMP,
  PRIMARY KEY (id)
);

-- Depends on scripts, script_templates
CREATE TABLE IF NOT EXISTS generation_runs (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  script_id UUID REFERENCES scripts(id),
  template_id UUID REFERENCES script_templates(id),
  run_type TEXT NOT NULL CHECK(run_type IN ('parse','script','quiz')),
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
  model_name TEXT,
  prompt_hash TEXT,
  input_meta JSONB,
  output_meta JSONB,
  error_message TEXT,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Depends on users, courses
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  meta JSONB DEFAULT '{}'::JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);
