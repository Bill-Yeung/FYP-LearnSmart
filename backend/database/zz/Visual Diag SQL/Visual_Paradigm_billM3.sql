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
  base_form VARCHAR(255),
  created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  is_system_generated BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  qdrant_synced_at TIMESTAMP,
  embedding_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
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
  interval_days FLOAT DEFAULT 0,
  reps INTEGER DEFAULT 0,
  ease_factor FLOAT DEFAULT 2.5, 
  stability FLOAT DEFAULT 0, 
  difficulty FLOAT DEFAULT 0,
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
  component_type VARCHAR(50),
  resolution VARCHAR(40),    
  file_format VARCHAR(20),  
  url TEXT NOT NULL,
  file_size BIGINT,
  md5_hash VARCHAR(32),
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

