-- Tables
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

CREATE TABLE user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
  user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  avatar_url TEXT,
  organization VARCHAR(255),
  department VARCHAR(100),
  level VARCHAR(50),
  personal_interests TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  notification_preferences TEXT DEFAULT '{"email": true, "in_app": true}',
  privacy_settings TEXT DEFAULT '{"profile_public": false, "show_activity": false}',
  domain_level VARCHAR(20) DEFAULT 'beginner',
  difficulty_preference VARCHAR(10) DEFAULT 'medium',
  ai_assistance_level VARCHAR(10) DEFAULT 'moderate',
  total_play_time_minutes INT DEFAULT 0,
  scripts_completed INT DEFAULT 0,
  study_preferences TEXT DEFAULT '{}',
  -- Example structure:
  -- {
  --   "spaced_repetition_algorithm": "sm2",     -- Module 3: SM-2, Leitner, etc.
  --   "daily_study_goal_minutes": 30,           -- Module 5, 7: Progress tracking
  --   "preferred_study_times": ["morning"],     -- Module 7: Planning
  --   "notification_frequency": "daily",        -- Module 5: Reminders
  --   "difficulty_preference": "adaptive",      -- Module 4: Assessment
  --   "language": "en"                          -- All modules
  -- }
  learning_style TEXT DEFAULT '{}',
  -- Example structure:
  -- {
  --   "visual": 0.7,      -- Preference for diagrams, videos
  --   "auditory": 0.3,    -- Preference for audio, discussions
  --   "reading": 0.8,     -- Preference for text
  --   "kinesthetic": 0.5  -- Preference for interactive, hands-on
  -- }
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_activity_log (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE concept_translations (
  id SERIAL PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL, -- With inline citations [src:uuid:page]
  keywords TEXT,
  formula_plain_text TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(concept_id, language)
);

CREATE TABLE taxonomy_nodes (
  id VARCHAR(36) PRIMARY KEY,
  lcc_code VARCHAR(20) NOT NULL UNIQUE,
  lcc_label VARCHAR(255) NOT NULL,
  lcc_hierarchy_level INTEGER NOT NULL,
  parent_lcc_code VARCHAR(20) REFERENCES taxonomy_nodes(lcc_code),
  scope_note TEXT,
  last_verified_date TIMESTAMP
);

CREATE TABLE concept_taxonomy (
  id SERIAL PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE,
  taxonomy_node_id VARCHAR(36) REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  user_knowledge_level INTEGER, -- Dynamic level in user's knowledge graph
  lcc_hierarchy_mismatch BOOLEAN DEFAULT false, -- True if user learned advanced before basics
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(concept_id, taxonomy_node_id)
);

CREATE TABLE procedure_details (
  id VARCHAR(36) PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  expected_duration_minutes INTEGER,
  stored_in_neo4j BOOLEAN DEFAULT false -- True if steps stored in Neo4j (complex procedures with branching/recursion)
);

CREATE TABLE procedure_translations (
  id SERIAL PRIMARY KEY,
  procedure_id VARCHAR(36) REFERENCES procedure_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  purpose TEXT,
  preconditions TEXT, -- [{item, description}]
  failure_modes TEXT, -- [{mode, symptoms, fix}]
  verification_checks TEXT, -- [{check, expected_result}]
  steps TEXT, -- Format: [{index, action, detail, expected_result, references_concepts: [uuid], uses_assets: [uuid]}]
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(procedure_id, language)
);

CREATE TABLE example_details (
  id VARCHAR(36) PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  media_refs VARCHAR(36)[] -- References to assets
);

CREATE TABLE example_translations (
  id SERIAL PRIMARY KEY,
  example_id VARCHAR(36) REFERENCES example_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  context TEXT,
  inputs TEXT,
  outcome TEXT,
  lessons_learned TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(example_id, language)
);

CREATE TABLE assessment_details (
  id VARCHAR(36) PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  question_type VARCHAR(50),
  estimated_time_minutes INTEGER
);

CREATE TABLE assessment_translations (
  id SERIAL PRIMARY KEY,
  assessment_id VARCHAR(36) REFERENCES assessment_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  answer_explanations TEXT, -- For multiple choice: [{answer, explanation}]. For others: explanation of correct answer
  assessment_criteria TEXT,
  comments TEXT, -- General feedback/hints shown after answering
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assessment_id, language)
);

CREATE TABLE learning_object_details (
  id VARCHAR(36) PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  format VARCHAR(50),
  duration_minutes INTEGER,
  media_refs VARCHAR(36)[], -- References to assets
  xapi_metadata TEXT,
  target_concept_ids VARCHAR(36)[],
  assessment_ids VARCHAR(36)[],
  success_criteria TEXT
);

CREATE TABLE learning_object_translations (
  id SERIAL PRIMARY KEY,
  learning_object_id VARCHAR(36) REFERENCES learning_object_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  learning_objectives TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learning_object_id, language)
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

CREATE TABLE relationship_translations (
  id SERIAL PRIMARY KEY,
  relationship_id VARCHAR(36) REFERENCES relationships(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT, -- With inline citations [src:uuid:page]
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(relationship_id, language)
);

CREATE TABLE discovered_relationships (
  id VARCHAR(36) PRIMARY KEY,
  suggested_relationship VARCHAR(100) NOT NULL UNIQUE,
  mapped_to VARCHAR(50), -- If mapped to existing type by administrator
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  example_contexts TEXT DEFAULT '[]', -- [{source, target, text_snippet, document_id}]
  status VARCHAR(20) DEFAULT 'pending_review',
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  admin_notes TEXT
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

CREATE TABLE learning_paths (
  id VARCHAR(36) PRIMARY KEY,
  target_concept_id VARCHAR(36) REFERENCES concepts(id),
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,  -- For personalized AI paths
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'manual',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_path_translations (
  id SERIAL PRIMARY KEY,
  learning_path_id VARCHAR(36) REFERENCES learning_paths(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learning_path_id, language)
);

CREATE TABLE curriculum_benchmark (
  benchmark_id VARCHAR(36) PRIMARY KEY,
  benchmark_key TEXT NOT NULL UNIQUE, -- stable (e.g. 'cs101.week3.big_o')
  title TEXT NOT NULL,
  description TEXT,
  difficulty_level INTEGER, -- optional coarse level
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_path_steps (
  id SERIAL PRIMARY KEY,
  path_id VARCHAR(36) REFERENCES learning_paths(id) ON DELETE CASCADE,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE,
  benchmark_id VARCHAR(36) REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  estimated_time_minutes INTEGER,
  target_difficulty INTEGER,
  scheduled_for TIMESTAMP,
  rationale TEXT,
  UNIQUE(path_id, step_order),
  UNIQUE(path_id, concept_id)
);

CREATE TABLE learning_path_step_translations (
  id SERIAL PRIMARY KEY,
  step_id INTEGER REFERENCES learning_path_steps(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  notes TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(step_id, language)
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

CREATE TABLE concept_sources (
  id SERIAL PRIMARY KEY,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE CASCADE,
  source_id VARCHAR(36) REFERENCES sources(id) ON DELETE CASCADE,
  pages INTEGER[],
  location TEXT, -- Section, paragraph, timestamp (e.g., 'Section 3.2', '12:35')
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE relationship_sources (
  id SERIAL PRIMARY KEY,
  relationship_id VARCHAR(36) REFERENCES relationships(id) ON DELETE CASCADE,
  source_id VARCHAR(36) REFERENCES sources(id) ON DELETE CASCADE,
  pages INTEGER[],
  location TEXT,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flashcards (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  taxonomy_node_id VARCHAR(36) REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  front_content TEXT NOT NULL,  
  back_content TEXT NOT NULL,   
  card_type VARCHAR(20) DEFAULT 'standard',
  tips TEXT DEFAULT '[]',
  content_metadata TEXT DEFAULT '{}', 
  source_type VARCHAR(50),
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE feynman_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  concept_id VARCHAR(36) REFERENCES concepts(id) ON DELETE SET NULL,
  concept_title VARCHAR(255),
  explanation TEXT NOT NULL,
  target_level VARCHAR(40) DEFAULT 'beginner',
  language VARCHAR(10) DEFAULT 'en',
  analysis TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE likes (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entity_type, entity_id)
);

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

CREATE TABLE flashcard_media (
  id VARCHAR(36) PRIMARY KEY,
  flashcard_id VARCHAR(36) REFERENCES flashcards(id) ON DELETE CASCADE,
  media_id VARCHAR(36) REFERENCES extracted_media(id) ON DELETE CASCADE,
  media_position VARCHAR(20) NOT NULL,
  display_order INTEGER DEFAULT 1,
  caption TEXT,
  display_settings TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(flashcard_id, media_id, media_position)
);

CREATE TABLE flashcard_review_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  flashcard_id VARCHAR(36) REFERENCES flashcards(id) ON DELETE CASCADE,
  review_mode VARCHAR(20) DEFAULT 'standard',
  rating INTEGER,
  duration_ms INTEGER, 
  scheduled_interval FLOAT,
  actual_interval FLOAT,
  review_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flashcard_schedules (
  flashcard_id VARCHAR(36) REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  algorithm VARCHAR(20) DEFAULT 'simple',
  state VARCHAR(20) DEFAULT 'new',
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

CREATE TABLE flashcard_mnemonics (
  id VARCHAR(36) PRIMARY KEY,
  flashcard_id VARCHAR(36) REFERENCES flashcards(id) ON DELETE CASCADE,
  mnemonic_type VARCHAR(50),
  content TEXT NOT NULL,
  ai_generated_reasoning TEXT, 
  is_user_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_ar_environments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100), 
  ar_pin_data BYTEA, 
  ar_system VARCHAR(20) DEFAULT 'ARKit',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);
  
CREATE TABLE label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE asset_library (
  id VARCHAR(36) PRIMARY KEY,
  external_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  source VARCHAR(50) DEFAULT 'polyhaven',
  asset_type VARCHAR(20),
  raw_api_data TEXT, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, external_id)
);

CREATE TABLE asset_categories (
    asset_id VARCHAR(36) REFERENCES asset_library(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, category_id)
);

CREATE TABLE asset_label (
    asset_id VARCHAR(36) REFERENCES asset_library(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES label(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag_id)
);

CREATE TABLE asset_downloads (
  id VARCHAR(36) PRIMARY KEY,
  asset_id VARCHAR(36) REFERENCES asset_library(id) ON DELETE CASCADE,
  -- Corresponds to JSON structure levels
  component_type VARCHAR(50), -- e.g. "Diffuse", "gltf", "blend"
  resolution VARCHAR(40),     -- e.g. "1k", "2k", "4k"
  file_format VARCHAR(20),    -- e.g. "jpg", "exr", "gltf", "usd"
  -- File entity information
  url TEXT NOT NULL,
  file_size BIGINT,
  md5_hash VARCHAR(32),
  -- If this download includes sub-files (e.g., texture paths), store them here
  include_map TEXT, 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vr_scenarios (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  scene_asset_path VARCHAR(255),
  difficulty_level VARCHAR(20),
  estimated_duration_minutes INTEGER,
  required_concepts VARCHAR(36)[],
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_vr_progress (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  scenario_id VARCHAR(36) REFERENCES vr_scenarios(id),
  game_state_data TEXT DEFAULT '{}',
  started_at TIMESTAMP,
  last_played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  completion_percentage FLOAT DEFAULT 0,
  total_play_time_minutes INTEGER DEFAULT 0,
  UNIQUE(user_id, scenario_id)
);

CREATE TABLE vr_learning_triggers (
  id VARCHAR(36) PRIMARY KEY,
  scenario_id VARCHAR(36) REFERENCES vr_scenarios(id),
  required_flashcard_id VARCHAR(36) REFERENCES flashcards(id),
  trigger_context VARCHAR(100),
  on_success_action VARCHAR(100),
  on_failure_action VARCHAR(100),
  failure_feedback_message TEXT
);

CREATE TABLE tags (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
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

CREATE TABLE tag_applications (
  id SERIAL PRIMARY KEY,
  tag_id VARCHAR(36) REFERENCES tags(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  applied_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tag_id, entity_type, entity_id)
);

CREATE TABLE diagrams (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  source_table VARCHAR(50),
  source_id VARCHAR(36),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  diagram_type VARCHAR(50) NOT NULL,
  diagram_data TEXT NOT NULL,      -- {nodes: [{id, label, x, y, ...}], edges: [{source, target, ...}]}
  view_state TEXT,                 -- {zoom, panX, panY, ...}
  is_edited BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url_id VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  community_type VARCHAR(50) NOT NULL,
  max_members INTEGER,
  avatar_url TEXT,
  banner_url TEXT,
  color_theme VARCHAR(20),
  features_enabled TEXT DEFAULT '{
    "discussions": true,
    "shared_resources": true,
    "leaderboard": true,
    "challenges": true,
    "peer_review": true
  }',
  member_count INTEGER DEFAULT 0,
  resource_count INTEGER DEFAULT 0,
  activity_score INTEGER DEFAULT 0,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_members (
  id SERIAL PRIMARY KEY,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  contribution_points INTEGER DEFAULT 0,
  resources_shared INTEGER DEFAULT 0,
  feedback_given INTEGER DEFAULT 0,
  notification_settings TEXT DEFAULT '{"all": true}',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, user_id)
);

CREATE TABLE community_invitations (
  id VARCHAR(36) PRIMARY KEY,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  invited_email VARCHAR(255),
  invited_user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  invited_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  invitation_code VARCHAR(50) UNIQUE,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'pending',
  message TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE TABLE point_types (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(20),
  is_global BOOLEAN DEFAULT TRUE,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE point_rules (
  id VARCHAR(36) PRIMARY KEY,
  point_type_id VARCHAR(36) REFERENCES point_types(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  points_awarded INTEGER NOT NULL,
  daily_limit INTEGER,
  total_limit INTEGER,
  conditions TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_points (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  point_type_id VARCHAR(36) REFERENCES point_types(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  action_id VARCHAR(36), -- The entity that triggered this
  rule_id VARCHAR(36) REFERENCES point_rules(id) ON DELETE SET NULL,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE badges (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  color VARCHAR(20),
  rarity VARCHAR(30),
  badge_type VARCHAR(50) NOT NULL,
  criteria TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  point_type_id VARCHAR(36) REFERENCES point_types(id) ON DELETE SET NULL,
  is_global BOOLEAN DEFAULT TRUE,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  is_secret BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_badges (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  badge_id VARCHAR(36) REFERENCES badges(id) ON DELETE CASCADE,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE SET NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  show_on_profile BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, badge_id, community_id)
);

CREATE TABLE leaderboard_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  point_type_id VARCHAR(36) REFERENCES point_types(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  rankings TEXT NOT NULL, -- [{user_id, rank, points, username, avatar_url}]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_streaks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  streak_type VARCHAR(50) NOT NULL DEFAULT 'daily_study',
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  streak_started_at DATE,
  current_multiplier NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, streak_type)
);

CREATE TABLE mentorships (
  id VARCHAR(36) PRIMARY KEY,
  mentor_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  mentee_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'pending',
  subject VARCHAR(255),
  topic_focus TEXT,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE SET NULL,
  sessions_count INTEGER DEFAULT 0,
  mentor_notes TEXT,
  mentee_progress_notes TEXT,
  mentor_points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  UNIQUE(mentor_id, mentee_id)
);

CREATE TABLE mentorship_resources (
  id VARCHAR(36) PRIMARY KEY,
  mentorship_id VARCHAR(36) REFERENCES mentorships(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  title VARCHAR(500),
  note TEXT,
  is_required BOOLEAN DEFAULT FALSE,
  is_viewed BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMP,
  is_completed BOOLEAN DEFAULT FALSE, 
  completed_at TIMESTAMP,
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_challenges (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL,
  team_a_id VARCHAR(36),
  team_b_id VARCHAR(36),
  team_a_name VARCHAR(100),
  team_b_name VARCHAR(100),
  criteria TEXT NOT NULL,
  team_a_score INTEGER DEFAULT 0,
  team_b_score INTEGER DEFAULT 0,
  winner_points INTEGER DEFAULT 0,
  winner_badge_id VARCHAR(36) REFERENCES badges(id) ON DELETE SET NULL,
  participant_points INTEGER DEFAULT 0,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(30) DEFAULT 'upcoming',
  winner VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_challenge_members (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(36) REFERENCES group_challenges(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  team VARCHAR(10) NOT NULL,
  contribution_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE user_currency (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE shop_items (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  item_value TEXT NOT NULL, -- xp_boost: {"multiplier": 2, "duration_hours": 24}
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

CREATE TABLE user_inventory (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id VARCHAR(36) REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, shop_item_id)
);

CREATE TABLE streak_milestones (
  id SERIAL PRIMARY KEY,
  streak_type VARCHAR(50) NOT NULL,
  period_required INTEGER NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  coins_awarded INTEGER DEFAULT 0,
  badge_id VARCHAR(36) REFERENCES badges(id) ON DELETE SET NULL,
  shop_item_id VARCHAR(36) REFERENCES shop_items(id) ON DELETE SET NULL, 
  item_quantity INTEGER DEFAULT 0,
  multiplier_boost NUMERIC(3,2) DEFAULT 0,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  UNIQUE(streak_type, period_required)
);

CREATE TABLE user_purchases (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id VARCHAR(36) REFERENCES shop_items(id) ON DELETE SET NULL,
  item_snapshot TEXT NOT NULL,
  price_paid INTEGER NOT NULL,
  is_gift BOOLEAN DEFAULT FALSE,
  gifted_to VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  gift_message TEXT,
  status VARCHAR(30) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE TABLE events (
  id VARCHAR(36) PRIMARY KEY,
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
  participation_item_id VARCHAR(36) REFERENCES shop_items(id) ON DELETE SET NULL,
  participation_item_qty INTEGER DEFAULT 0,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_challenges (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL,
  criteria TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  coins_awarded INTEGER DEFAULT 0,
  badge_id VARCHAR(36) REFERENCES badges(id) ON DELETE SET NULL,
  shop_item_id VARCHAR(36) REFERENCES shop_items(id) ON DELETE SET NULL,
  item_quantity INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_event_progress (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  event_id VARCHAR(36) REFERENCES events(id) ON DELETE CASCADE,
  challenge_id VARCHAR(36) REFERENCES event_challenges(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, challenge_id)
);

CREATE TABLE active_boosts (
  id VARCHAR(36) PRIMARY KEY,
  activated_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  scope VARCHAR(20) NOT NULL,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  boost_type VARCHAR(50) NOT NULL,
  boost_value TEXT NOT NULL,
  source_id VARCHAR(36),
  coins_spent INTEGER DEFAULT 0,
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  beneficiaries_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_requests (
  id VARCHAR(36) PRIMARY KEY,
  request_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  total_votes INTEGER DEFAULT 0,
  total_coins INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'open',
  admin_response TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_request_votes (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(36) REFERENCES content_requests(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  coins_contributed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, user_id)
);

CREATE TABLE appreciations (
  id VARCHAR(36) PRIMARY KEY,
  from_user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  to_user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  appreciation_type VARCHAR(50) NOT NULL,
  coins_given INTEGER DEFAULT 0,
  message TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shared_content (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  visibility VARCHAR(30) NOT NULL DEFAULT 'public',
  community_ids VARCHAR(36)[],
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  average_rating NUMERIC(3,2),
  rating_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  tags TEXT,
  status VARCHAR(30) DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

CREATE TABLE content_downloads (
  id SERIAL PRIMARY KEY,
  shared_content_id VARCHAR(36) REFERENCES shared_content(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(30) NOT NULL,
  forked_entity_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shared_content_id, user_id, action_type)
);

CREATE TABLE content_ratings (
  id SERIAL PRIMARY KEY,
  shared_content_id VARCHAR(36) REFERENCES shared_content(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  review_text TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shared_content_id, user_id)
);

CREATE TABLE feedback_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  specific_questions TEXT,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'open',
  max_responses INTEGER DEFAULT 5,
  current_responses INTEGER DEFAULT 0,
  points_offered INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE peer_feedback (
  id VARCHAR(36) PRIMARY KEY,
  feedback_request_id VARCHAR(36) REFERENCES feedback_requests(id) ON DELETE SET NULL,
  reviewer_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  recipient_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  rating INTEGER,
  is_helpful BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reputation_scores (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  teaching_score INTEGER DEFAULT 0,
  content_score INTEGER DEFAULT 0,
  feedback_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  reliability_score INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  reputation_level VARCHAR(30),
  last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, community_id)
);

CREATE TABLE reputation_events (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  dimension VARCHAR(50) NOT NULL,
  points_change INTEGER NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(36),
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reputation_levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  url_id VARCHAR(30) NOT NULL UNIQUE,
  min_score INTEGER NOT NULL,
  max_score INTEGER,
  icon VARCHAR(50),
  color VARCHAR(20),
  badge_id VARCHAR(36) REFERENCES badges(id) ON DELETE SET NULL,
  privileges TEXT,
  is_global BOOLEAN DEFAULT TRUE,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discussion_threads (
  id VARCHAR(36) PRIMARY KEY,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  thread_type VARCHAR(50) DEFAULT 'discussion',
  status VARCHAR(30) DEFAULT 'open',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  is_answered BOOLEAN DEFAULT FALSE,
  accepted_reply_id VARCHAR(36),
  tags TEXT,
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discussion_replies (
  id VARCHAR(36) PRIMARY KEY,
  thread_id VARCHAR(36) REFERENCES discussion_threads(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  parent_reply_id VARCHAR(36) REFERENCES discussion_replies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_accepted BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  like_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE challenges (
  id VARCHAR(36) PRIMARY KEY,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  instructions TEXT,
  challenge_type VARCHAR(50) NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(30) DEFAULT 'draft',
  max_participants INTEGER,
  participant_count INTEGER DEFAULT 0,
  submission_count INTEGER DEFAULT 0,
  rewards TEXT,
  judging_criteria TEXT,
  judge_user_ids VARCHAR(36)[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE challenge_participants (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(36) REFERENCES challenges(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'registered',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE challenge_submissions (
  id VARCHAR(36) PRIMARY KEY,
  challenge_id VARCHAR(36) REFERENCES challenges(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  shared_content_id VARCHAR(36) REFERENCES shared_content(id) ON DELETE SET NULL,
  title VARCHAR(500),
  description TEXT,
  attachments TEXT,
  scores TEXT,
  final_score NUMERIC(5,2),
  rank INTEGER,
  status VARCHAR(30) DEFAULT 'pending',
  judge_feedback TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  judged_at TIMESTAMP
);

CREATE TABLE user_presence (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'online',
  current_entity_type VARCHAR(50),
  current_entity_id VARCHAR(36),
  current_community_id VARCHAR(36) REFERENCES communities(id) ON DELETE SET NULL,
  socket_id VARCHAR(100),
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE edit_locks (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  locked_by VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 minutes'),
  UNIQUE(entity_type, entity_id)
);

CREATE TABLE entity_viewers (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, user_id)
);

CREATE TABLE chat_rooms (
  id VARCHAR(36) PRIMARY KEY,
  room_code VARCHAR(20) UNIQUE,
  name VARCHAR(255),
  description TEXT,
  avatar_url TEXT,
  room_type VARCHAR(30) DEFAULT 'group',
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT TRUE,
  max_participants INTEGER DEFAULT 50,
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
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

CREATE TABLE chat_room_members (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(36) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) DEFAULT 'member',
  is_active BOOLEAN DEFAULT TRUE,
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMP,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  invited_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(room_id, user_id)
);

CREATE TABLE chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  chat_room_id VARCHAR(36) NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(30) DEFAULT 'text',
  content TEXT NOT NULL, -- Encrypted by backend, stored as base64
  is_encrypted BOOLEAN DEFAULT TRUE, -- FALSE only for system messages
  reply_to_id VARCHAR(36) REFERENCES chat_messages(id) ON DELETE SET NULL,
  attachments TEXT, -- [{type, url, name, size}]
  mentions VARCHAR(36)[],
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  reactions TEXT DEFAULT '{}',
  read_by TEXT DEFAULT '{}', -- {"user_id": "timestamp", ...}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP
);

CREATE TABLE friendships (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  friend_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE(user_id, friend_id)
);

CREATE TABLE notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),
  actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  group_key VARCHAR(100),
  group_count INTEGER DEFAULT 1,
  is_read BOOLEAN DEFAULT FALSE,
  is_seen BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  action_data TEXT,
  sent_push BOOLEAN DEFAULT FALSE,
  sent_email BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE TABLE notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  in_app BOOLEAN DEFAULT TRUE,
  push BOOLEAN DEFAULT TRUE,
  email BOOLEAN DEFAULT FALSE,
  email_frequency VARCHAR(30) DEFAULT 'instant',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, notification_type)
);

CREATE TABLE activity_feed (
  id VARCHAR(36) PRIMARY KEY,
  actor_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  entity_preview TEXT,
  community_id VARCHAR(36) REFERENCES communities(id) ON DELETE CASCADE,
  visibility VARCHAR(30) DEFAULT 'public',
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_comments (
  id VARCHAR(36) PRIMARY KEY,
  activity_id VARCHAR(36) REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id VARCHAR(36) REFERENCES activity_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_follows (
  id SERIAL PRIMARY KEY,
  follower_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  following_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

CREATE TABLE script_templates (
    template_id VARCHAR(36) PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    description TEXT,
    template_type VARCHAR(30) NOT NULL DEFAULT 'historical_detective',
    structure_template TEXT NOT NULL,
    content_domain VARCHAR(50) NOT NULL,
    content_context TEXT,
    learning_objectives TEXT NOT NULL,
    difficulty_level VARCHAR(10) DEFAULT 'medium',
    ai_prompt_template TEXT, 
    generation_constraints TEXT,
    version VARCHAR(10) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE template_parameters (
    param_id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL REFERENCES script_templates(template_id) ON DELETE CASCADE,
    param_key VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    param_type VARCHAR(20) NOT NULL,
    default_value TEXT,
    options TEXT,
    constraints TEXT,
    category VARCHAR(30) DEFAULT 'general',
    display_order INT DEFAULT 0,
    is_required BOOLEAN DEFAULT true
);

CREATE TABLE generated_scripts (
    script_id VARCHAR(36) PRIMARY KEY,
    template_id VARCHAR(36) NOT NULL REFERENCES script_templates(template_id),
    generation_parameters TEXT NOT NULL,
    script_title VARCHAR(200) NOT NULL,
    script_content TEXT NOT NULL,
    script_summary TEXT,
    generation_method VARCHAR(20) NOT NULL DEFAULT 'ai_assisted',
    ai_model_used VARCHAR(50),
    generation_prompt TEXT,
    learning_points TEXT,
    estimated_duration INT,
    validation_status VARCHAR(20) DEFAULT 'pending',
    validation_score DECIMAL(5,2),
    validation_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    play_count INT DEFAULT 0,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played_at TIMESTAMP
);

CREATE TABLE validation_results (
    validation_id VARCHAR(36) PRIMARY KEY,
    script_id VARCHAR(36) NOT NULL REFERENCES generated_scripts(script_id),
    validation_type VARCHAR(30) NOT NULL,
    passed BOOLEAN NOT NULL,
    score DECIMAL(5,2),
    details TEXT NOT NULL,
    issues_found TEXT,
    suggestions TEXT,
    validator_version VARCHAR(20),
    validation_duration_ms INT,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_sessions (
    session_id VARCHAR(36) PRIMARY KEY,
    id VARCHAR(36) NOT NULL REFERENCES users(id),
    script_id VARCHAR(36) NOT NULL REFERENCES generated_scripts(script_id),
    session_type VARCHAR(20) DEFAULT 'solo',
    current_scene VARCHAR(50),
    game_progress TEXT DEFAULT '{}',
    collected_evidence TEXT DEFAULT '[]',
    decisions_made TEXT DEFAULT '[]',
    progress_percentage INT DEFAULT 0,
    time_spent_minutes INT DEFAULT 0,
    achieved_ending VARCHAR(100),
    ending_score DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE game_actions (
    action_id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES game_sessions(session_id),
    id VARCHAR(36) NOT NULL REFERENCES users(id),
    action_type VARCHAR(30) NOT NULL,
    action_details TEXT NOT NULL,
    action_result VARCHAR(50),
    ai_involved BOOLEAN DEFAULT false,
    ai_response TEXT,
    knowledge_point VARCHAR(100),
    learning_outcome VARCHAR(50),
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_analytics (
    analytics_id VARCHAR(36) PRIMARY KEY,
    id VARCHAR(36) REFERENCES users(id),
    session_id VARCHAR(36) REFERENCES game_sessions(session_id),
    script_id VARCHAR(36) REFERENCES generated_scripts(script_id),
    knowledge_points_covered TEXT,
    knowledge_mastery_score DECIMAL(5,2),
    reasoning_accuracy DECIMAL(5,2),
    puzzle_success_rate DECIMAL(5,2),
    evidence_collection_rate DECIMAL(5,2),
    decision_quality_score DECIMAL(5,2),
    hints_requested INT DEFAULT 0,
    time_spent_on_knowledge INT DEFAULT 0,
    overall_score DECIMAL(5,2),
    learning_efficiency DECIMAL(5,2),
    improvement_suggestions TEXT,
    recommended_next_scripts TEXT,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_nodes (
    node_id VARCHAR(36) PRIMARY KEY,
    script_id VARCHAR(36) NOT NULL REFERENCES generated_scripts(script_id),
    node_type VARCHAR(30) NOT NULL,
    node_title VARCHAR(200) NOT NULL,
    node_content TEXT NOT NULL,
    knowledge_points TEXT,
    difficulty_level VARCHAR(10) DEFAULT 'medium',
    expected_time_seconds INT,
    course VARCHAR(50),
    prerequisites TEXT,
    unlock_condition TEXT,
    interaction_type VARCHAR(20) DEFAULT 'single_choice',
    correct_answer TEXT,
    evaluation_logic TEXT,
    scoring_rules TEXT,
    scene_location VARCHAR(50),
    display_order INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_responses (
    response_id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES game_sessions(session_id),
    id VARCHAR(36) NOT NULL REFERENCES users(id),
    node_id VARCHAR(36) NOT NULL REFERENCES learning_nodes(node_id),
    user_input TEXT NOT NULL,
    input_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_correct BOOLEAN,
    correctness_score DECIMAL(5,2),
    evaluation_details TEXT,
    system_feedback TEXT,
    feedback_type VARCHAR(20),
    time_spent_seconds INT,
    attempts_count INT DEFAULT 1,
    hint_used BOOLEAN DEFAULT false,
    triggered_actions TEXT
);

CREATE TABLE clue_triggers (
    trigger_id VARCHAR(36) PRIMARY KEY,
    script_id VARCHAR(36) NOT NULL REFERENCES generated_scripts(script_id),
    target_clue_id VARCHAR(36),
    trigger_type VARCHAR(30) NOT NULL,
    condition_logic TEXT NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    action_data TEXT NOT NULL,
    priority_level INT DEFAULT 5,
    is_exclusive BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback_rules (
    rule_id VARCHAR(36) PRIMARY KEY,
    script_id VARCHAR(36) REFERENCES generated_scripts(script_id),
    node_id VARCHAR(36) REFERENCES learning_nodes(node_id),
    condition_type VARCHAR(30) NOT NULL,
    condition_details TEXT,
    feedback_template TEXT NOT NULL,
    feedback_type VARCHAR(20) NOT NULL,
    difficulty_level VARCHAR(10),
    user_level VARCHAR(20),
    allow_ai_adaptation BOOLEAN DEFAULT true,
    base_prompt TEXT,
    show_immediately BOOLEAN DEFAULT true,
    cooldown_seconds INT DEFAULT 0,
    priority INT DEFAULT 5,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE ai_context_sessions (
    context_id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES game_sessions(session_id),
    character_id VARCHAR(36) REFERENCES learning_nodes(node_id),
    context_type VARCHAR(30) NOT NULL,
    system_prompt TEXT NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INT DEFAULT 2000,
    is_active BOOLEAN DEFAULT true,
    token_count INT DEFAULT 0,
    message_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_context_messages (
    message_id VARCHAR(36) PRIMARY KEY,
    context_id VARCHAR(36) NOT NULL REFERENCES ai_context_sessions(context_id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    ai_model VARCHAR(50),
    tokens_used INT,
    finish_reason VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE context_vectors (
    vector_id VARCHAR(36) PRIMARY KEY,
    message_id VARCHAR(36) REFERENCES ai_context_messages(message_id),
    context_id VARCHAR(36) REFERENCES ai_context_sessions(context_id),
    qdrant_point_id VARCHAR(36),
    collection_name VARCHAR(100) DEFAULT 'dialogue_vectors',
    embedding_model VARCHAR(50) DEFAULT 'BAAI/bge-small-zh-v1.5',
    embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_schedule (
    schedule_id VARCHAR(36) PRIMARY KEY,
    id VARCHAR(36) NOT NULL REFERENCES users(id),
    node_id VARCHAR(36) REFERENCES learning_nodes(node_id),
    planned_time TIMESTAMP,
    actual_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    priority_level INT DEFAULT 5,
    energy_slot VARCHAR(20),
    reschedule_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE external_data_source (
  source_id VARCHAR(36) PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE, -- stable identifier (e.g. 'google_drive')
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE brainstorming_prompt (
  prompt_id VARCHAR(36) PRIMARY KEY,
  brainstorm_session_id VARCHAR(36) NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,  -- 'who' | 'what' | 'why' | 'how'
  ordinal INTEGER NOT NULL DEFAULT 0,
  prompt_text TEXT NOT NULL,
  run_id VARCHAR(36) REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI-generated prompts
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE brainstorming_artifact (
  artifact_id VARCHAR(36) PRIMARY KEY,
  brainstorm_session_id VARCHAR(36) NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL DEFAULT 'outline', -- 'outline', 'mindmap', 'summary'
  content TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE socratic_state_snapshot (
  snapshot_id VARCHAR(36) PRIMARY KEY,
  socratic_session_id VARCHAR(36) NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  as_of TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  state TEXT NOT NULL DEFAULT '{}',
  UNIQUE (socratic_session_id, as_of)
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

CREATE TABLE socratic_misconception_observation (
  observation_id VARCHAR(36) PRIMARY KEY,
  socratic_session_id VARCHAR(36) NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  misconception_id VARCHAR(36) NOT NULL REFERENCES misconception(misconception_id) ON DELETE CASCADE,
  confidence NUMERIC(6,5) NOT NULL DEFAULT 0,
  observed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  evidence TEXT NOT NULL DEFAULT '{}'
);
