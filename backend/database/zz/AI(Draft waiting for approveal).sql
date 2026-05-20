CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
-- Table 1: Script templates
CREATE UNIQUE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;
  -- Primary key
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Basic info
  token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  -- Template definition
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
  -- Structure template (JSON format with variable placeholders)
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
  -- Content constraints
  content_domain VARCHAR(50) NOT NULL,  -- Applicable content domain
  content_context TEXT,                  -- Content background description
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Learning design
  learning_objectives JSONB NOT NULL,      -- List of learning objectives
  organization VARCHAR(255),
  department VARCHAR(100),
  level VARCHAR(50),
  -- AI generation config
  ai_prompt_template TEXT,                 -- AI prompt template
  generation_constraints JSONB,            -- Generation constraints
  privacy_settings JSONB DEFAULT '{"profile_public": false, "show_activity": false}'::jsonb,
  -- Status
    CHECK (domain_level IN ('beginner', 'intermediate', 'advanced')),
  difficulty_preference VARCHAR(10) DEFAULT 'medium'
    CHECK (difficulty_preference IN ('easy', 'medium', 'hard', 'adaptive')),
  -- Metadata
    CHECK (ai_assistance_level IN ('minimal', 'moderate', 'full')),
  total_play_time_minutes INT DEFAULT 0,
  scripts_completed INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- Table 2: Template parameters

  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Associations
  resource_type VARCHAR(50),
  resource_id UUID,
  -- Parameter definition
  param_key VARCHAR(50) NOT NULL,          -- Parameter key, e.g., "content_domain"
  display_name VARCHAR(100) NOT NULL,      -- Display name
  description TEXT,                        -- Parameter description

  -- Parameter type
CREATE INDEX idx_activity_type ON user_activity_log(action_type);
CREATE INDEX idx_activity_resource ON user_activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_created ON user_activity_log(created_at);
  -- Configuration
  default_value TEXT,                      -- Default value
  options JSONB,                           -- Enumeration options [{value: "", label: ""}]
  constraints JSONB,                       -- Constraint conditions {required, min, max, regex}
CREATE TABLE IF NOT EXISTS concepts (
  -- Category
  category VARCHAR(30) DEFAULT 'general'   -- Category: historical/gameplay/learning
    concept_type IN ('definition', 'procedure', 'example', 'assessment', 'learning_object', 'entity', 'formula')
  ),
  -- Display
  estimated_study_time_minutes INTEGER,
  formula_latex TEXT,
  base_form VARCHAR(255), -- For same words with different meanings in different contexts
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_system_generated BOOLEAN DEFAULT TRUE,
Table 3: Users
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Primary key
  version INTEGER DEFAULT 1
);
  -- Basic info
CREATE INDEX idx_concepts_type ON concepts(concept_type);
CREATE INDEX idx_concepts_difficulty ON concepts(difficulty_level);
CREATE INDEX idx_concepts_base_form ON concepts(base_form) WHERE base_form IS NOT NULL;
  -- Learning profile (simplified)
CREATE INDEX idx_concepts_system ON concepts(is_system_generated);
CREATE INDEX idx_concepts_public ON concepts(is_public);

  -- Preferences
  id SERIAL PRIMARY KEY,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL, -- With inline citations [src:uuid:page]
  -- Stats (for display)
  formula_plain_text TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Status
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(concept_id, language)
  -- Metadata

CREATE INDEX idx_concept_trans_concept ON concept_translations(concept_id);
CREATE INDEX idx_concept_trans_language ON concept_translations(language);
CREATE INDEX idx_concept_trans_primary ON concept_translations(concept_id, is_primary) WHERE is_primary = TRUE;
-- Table 4: Generated scripts
CREATE INDEX idx_concept_trans_title ON concept_translations(title);
  -- Primary key
CREATE INDEX idx_concept_trans_keywords ON concept_translations USING GIN(keywords);
CREATE INDEX idx_concept_trans_created_by ON concept_translations(created_by);
  -- Linked template
CREATE TABLE IF NOT EXISTS taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Generation parameters (user input)
  lcc_label VARCHAR(255) NOT NULL,
  lcc_hierarchy_level INTEGER NOT NULL,
  -- Generated content
  scope_note TEXT,
  script_content JSONB NOT NULL,           -- Full script content
  script_summary TEXT,                     -- Script summary

  -- Generation info
CREATE INDEX idx_taxonomy_parent ON taxonomy_nodes(parent_lcc_code);
CREATE INDEX idx_taxonomy_level ON taxonomy_nodes(lcc_hierarchy_level);
  ai_model_used VARCHAR(50),               -- AI model used
  generation_prompt TEXT,                  -- Prompt used
  id SERIAL PRIMARY KEY,
  -- Learning info
  learning_points JSONB,                   -- Specific learning points
  estimated_duration INT,                  -- Estimated duration (minutes)
  user_knowledge_level INTEGER, -- Dynamic level in user's knowledge graph
  -- Validation status
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(concept_id, taxonomy_node_id)
  validation_score DECIMAL(5,2),           -- Validation score
  validation_notes TEXT,                   -- Validation notes
CREATE INDEX idx_concept_tax_concept ON concept_taxonomy(concept_id);
  -- Status
CREATE INDEX idx_concept_tax_created_by ON concept_taxonomy(created_by);
  play_count INT DEFAULT 0,                -- Times played

  -- Metadata
-- TYPE-SPECIFIC EXTENSION TABLES

CREATE TABLE IF NOT EXISTS procedure_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
-- Table 5: Validation results
  expected_duration_minutes INTEGER,
  -- Primary key
);

  -- Relationship
CREATE INDEX idx_procedure_neo4j_flag ON procedure_details(stored_in_neo4j);

  -- Validation info
  id SERIAL PRIMARY KEY,
  procedure_id UUID REFERENCES procedure_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  -- Validation results
  preconditions JSONB, -- [{item, description}]
  score DECIMAL(5,2),                      -- Score 0-100
  details JSONB NOT NULL,                  -- Detailed results
  steps JSONB, -- Format: [{index, action, detail, expected_result, references_concepts: [uuid], uses_assets: [uuid]}]
  -- Issue log
  issues_found JSONB,                      -- Issues found
  suggestions JSONB,                       -- Improvement suggestions
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Validator info
);
  validation_duration_ms INT,              -- Validation duration
CREATE INDEX idx_procedure_trans_procedure ON procedure_translations(procedure_id);
  -- Metadata
CREATE INDEX idx_procedure_trans_primary ON procedure_translations(procedure_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_procedure_trans_steps ON procedure_translations USING GIN(steps);
CREATE INDEX idx_procedure_trans_created_by ON procedure_translations(created_by);
-- Table 6: Game sessions
CREATE TABLE IF NOT EXISTS example_details (
  -- Primary key
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  media_refs UUID[] -- References to assets
  -- Relationship

CREATE INDEX idx_example_concept ON example_details(concept_id);

  -- Session info
  id SERIAL PRIMARY KEY,
  example_id UUID REFERENCES example_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  -- Game state
  current_scene VARCHAR(50),               -- Current scene
  game_progress JSONB DEFAULT '{}',        -- Game progress state
  collected_evidence JSONB DEFAULT '[]',   -- Collected evidence
  decisions_made JSONB DEFAULT '[]',       -- Decisions made
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Progress metrics
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(example_id, language)
);

  -- Ending
  achieved_ending VARCHAR(100),            -- Achieved ending
  ending_score DECIMAL(5,2),               -- Ending score
CREATE INDEX idx_example_trans_created_by ON example_translations(created_by);
  -- Status
CREATE TABLE IF NOT EXISTS assessment_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  -- Timestamps
  estimated_time_minutes INTEGER
);

CREATE INDEX idx_assessment_concept ON assessment_details(concept_id);
CREATE INDEX idx_assessment_type ON assessment_details(question_type);
-- Table 7: Game actions
CREATE TABLE IF NOT EXISTS assessment_translations (
  -- Primary key
  assessment_id UUID REFERENCES assessment_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  -- Relationship
  correct_answer TEXT NOT NULL,
  answer_explanations JSONB, -- For multiple choice: [{answer, explanation}]. For others: explanation of correct answer
  assessment_criteria JSONB,
  -- Action info
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assessment_id, language)
);
  -- Content
  action_details JSONB NOT NULL,           -- Detailed action data
  action_result VARCHAR(50),               -- Result description
CREATE INDEX idx_assessment_trans_primary ON assessment_translations(assessment_id, is_primary) WHERE is_primary = TRUE;
  -- AI interaction

  ai_response TEXT,                        -- AI response content
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Learning
  knowledge_point VARCHAR(100),            -- Related knowledge points
  learning_outcome VARCHAR(50),            -- Learning outcome
  media_refs UUID[], -- References to assets
  -- Timestamp
  target_concept_ids UUID[],
  assessment_ids UUID[],
  success_criteria JSONB
-- Table 8: Learning analytics

  -- Primary key
CREATE INDEX idx_learning_object_format ON learning_object_details(format);

  -- Relationship
  id SERIAL PRIMARY KEY,
  learning_object_id UUID REFERENCES learning_object_details(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  learning_objectives TEXT[],
  -- Learning metrics
  knowledge_points_covered JSONB,          -- Knowledge points covered
  knowledge_mastery_score DECIMAL(5,2),    -- Knowledge mastery 0-100
  reasoning_accuracy DECIMAL(5,2),         -- Reasoning accuracy
  UNIQUE(learning_object_id, language)
  -- Game performance
  puzzle_success_rate DECIMAL(5,2),        -- Puzzle success rate
  evidence_collection_rate DECIMAL(5,2),   -- Evidence collection rate
  decision_quality_score DECIMAL(5,2),     -- Decision quality
CREATE INDEX idx_learning_object_trans_primary ON learning_object_translations(learning_object_id, is_primary) WHERE is_primary = TRUE;
  -- Learning behaviors
  hints_requested INT DEFAULT 0,           -- Number of hints requested
  time_spent_on_knowledge INT DEFAULT 0,   -- Time spent on knowledge (seconds)
-- RELATIONSHIPS
  -- Overall evaluation
  overall_score DECIMAL(5,2),              -- Overall score
  learning_efficiency DECIMAL(5,2),        -- Learning efficiency
  relationship_type VARCHAR(50) NOT NULL CHECK (
  -- Suggestions
  improvement_suggestions JSONB,           -- Improvement suggestions
  recommended_next_scripts JSONB,          -- Recommended next scripts
      'prerequisite_of', 'has_prerequisite',
  -- Generated time
      'author', 'introduced_by',
      'simultaneous_with', 'happens_during', 'before_or_simultaneous_with',
      'starts_before', 'ends_after', 'derives_into',
-- Table 9: Learning nodes
      'adjacent_to', 'surrounded_by', 'connected_to',
  -- Primary key
      'contributes_to', 'results_in_assembly_of', 'results_in_breakdown_of',
      'capable_of', 'interacts_with', 'has_participant',
  -- Relationship
      'owns', 'is_owned_by', 'produces', 'produced_by', 'determined_by', 'determines',
      'correlated_with',
  -- Node definition
      'proves', 'proven_by', 'generalizes', 'specialized_by', 'approximates', 'approximated_by',
      'replaces', 'replaced_by',
      'custom' -- Fallback for LLM-discovered types not yet approved
    )
  node_content JSONB NOT NULL,  -- Node content (varies by type)
  suggested_relationship_type VARCHAR(100),
  -- Learning
  knowledge_points JSONB,       -- Related knowledge points
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expected_time_seconds INT,    -- Expected completion time
  course VARCHAR(50),           -- Subject category, e.g., math, english, science

  -- Prerequisites
  prerequisites JSONB,          -- Unlock conditions [{type: "node", id: "...", status: "completed"}]
  unlock_condition JSONB,       -- Unlock logic (JSONLogic format)
CREATE TABLE IF NOT EXISTS relationship_translations (
  -- Interaction design
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  language VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  -- Answers/assessment
  correct_answer JSONB,         -- Correct answer
  evaluation_logic JSONB,       -- Evaluation logic (e.g., partial credit)
  scoring_rules JSONB,          -- Scoring rules
  translation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Position/order
  scene_location VARCHAR(50),   -- Associated scene

CREATE INDEX idx_relationship_trans_relationship ON relationship_translations(relationship_id);
  -- Status
CREATE INDEX idx_relationship_trans_primary ON relationship_translations(relationship_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_relationship_trans_name ON relationship_translations(name);
  -- Metadata

CREATE TABLE IF NOT EXISTS discovered_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  suggested_relationship VARCHAR(100) NOT NULL UNIQUE,
-- Table 10: User responses
  occurrence_count INTEGER DEFAULT 1,
  -- Primary key
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  example_contexts JSONB DEFAULT '[]'::jsonb, -- [{source, target, text_snippet, document_id}]
  -- Relationship
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  admin_notes TEXT
);
  -- User input
  user_input JSONB NOT NULL,        -- User's answer/choice
CREATE INDEX idx_discovered_status ON discovered_relationships(status);
CREATE INDEX idx_discovered_count ON discovered_relationships(occurrence_count DESC);
  -- System evaluation
  is_correct BOOLEAN,               -- Whether correct
  correctness_score DECIMAL(5,2),   -- Correctness score (0-100)
  evaluation_details JSONB,         -- Detailed evaluation
  source_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  -- System feedback
  system_feedback TEXT,             -- Feedback provided to the user
  feedback_type VARCHAR(20)         -- Feedback type: correct/incorrect/partial/hint

  UNIQUE(relationship_id, source_concept_id, target_concept_id)
  -- Learning analytics
  time_spent_seconds INT,           -- Time spent
  attempts_count INT DEFAULT 1,     -- Attempt count
  hint_used BOOLEAN DEFAULT false,  -- Whether a hint was used
CREATE INDEX idx_concept_rel_target ON concept_relationships(target_concept_id);
  -- Triggered results
  triggered_actions JSONB        -- Triggered actions [{"type": "unlock_clue", "id": "..."}]

-- =============================================================================
-- Table 11: Clue triggers

  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_concept_id UUID REFERENCES concepts(id),
  -- Relationship
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  target_clue_id UUID,       -- Clue to unlock (references learning_nodes)
);
  -- Trigger conditions
CREATE INDEX idx_learning_paths_target ON learning_paths(target_concept_id);
CREATE INDEX idx_learning_paths_created_by ON learning_paths(created_by);

CREATE TABLE IF NOT EXISTS learning_path_translations (
  id SERIAL PRIMARY KEY,
  condition_logic JSONB NOT NULL,   -- Condition logic (JSONLogic)
  language VARCHAR(40) NOT NULL,
  -- Trigger actions
  description TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  translation_quality VARCHAR(20) CHECK (translation_quality IN ('source', 'llm', 'user_verified')),
  action_data JSONB NOT NULL,       -- Action data
  UNIQUE(learning_path_id, language)
  -- Priority
  priority_level INT DEFAULT 5,     -- 1-10; lower numbers are higher priority
  is_exclusive BOOLEAN DEFAULT false, -- Whether this trigger is exclusive
CREATE INDEX idx_learning_path_trans_language ON learning_path_translations(language);
  -- Status
CREATE INDEX idx_learning_path_trans_created_by ON learning_path_translations(created_by);

  -- Metadata
  id SERIAL PRIMARY KEY,
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  estimated_time_minutes INTEGER,
  UNIQUE(path_id, step_order),
  UNIQUE(path_id, concept_id)
);

CREATE INDEX idx_learning_path_steps_path ON learning_path_steps(path_id);
CREATE INDEX idx_learning_path_steps_concept ON learning_path_steps(concept_id);
CREATE INDEX idx_learning_path_steps_order ON learning_path_steps(path_id, step_order);

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

CREATE INDEX idx_step_trans_step ON learning_path_step_translations(step_id);
CREATE INDEX idx_step_trans_language ON learning_path_step_translations(language);
CREATE INDEX idx_step_trans_primary ON learning_path_step_translations(step_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_step_trans_created_by ON learning_path_step_translations(created_by);

-- =============================================================================
-- SOURCE

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_name VARCHAR(500) NOT NULL,
  document_path TEXT,
  document_type VARCHAR(50) CHECK (document_type IN (
    'pdf', 'word', 'excel', 'powerpoint',
    'video', 'audio', 'image',
    'webpage', 'markdown', 'text',
    'zip'
  )),
  language VARCHAR(40),
  author VARCHAR(255),
  publication_year INTEGER,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sources_name ON sources(document_name);
CREATE INDEX idx_sources_type ON sources(document_type);
CREATE INDEX idx_sources_author ON sources(author);
CREATE INDEX idx_sources_language ON sources(language);
CREATE INDEX idx_sources_uploaded_by ON sources(uploaded_by);
CREATE INDEX idx_sources_public ON sources(is_public);

CREATE TABLE IF NOT EXISTS concept_sources (
  id SERIAL PRIMARY KEY,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  pages INTEGER[],
  location TEXT, -- Section, paragraph, timestamp (e.g., 'Section 3.2', '12:35')
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_concept_sources_concept ON concept_sources(concept_id);
CREATE INDEX idx_concept_sources_source ON concept_sources(source_id);
CREATE INDEX idx_concept_sources_created_by ON concept_sources(created_by);

CREATE TABLE IF NOT EXISTS relationship_sources (
  id SERIAL PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  pages INTEGER[],
  location TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relationship_sources_relationship ON relationship_sources(relationship_id);
CREATE INDEX idx_relationship_sources_source ON relationship_sources(source_id);
CREATE INDEX idx_relationship_sources_created_by ON relationship_sources(created_by);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Link to knowledge graph and taxonomy
  concept_id UUID REFERENCES concepts(id) ON DELETE SET NULL,
  taxonomy_node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  
  -- [Core Content] 
  front_content TEXT NOT NULL,  
  back_content TEXT NOT NULL,   

  -- [Important] Card type marker
  -- Although JSONB can determine this, having this field makes queries much faster
  card_type VARCHAR(20) DEFAULT 'standard' CHECK (card_type IN ('standard', 'mcq')),
  
  -- [New Feature] Tips
  -- Store multi-stage hints, e.g.: ["Hint 1", "Hint 2"]
  tips JSONB DEFAULT '[]'::jsonb,

  -- [Advanced Structure] MCQ options stored here
  -- Example: {"options": ["A", "B", "C", "D"]}
  content_metadata JSONB DEFAULT '{}'::jsonb, 
  
  -- Source tracking
  source_type VARCHAR(50) CHECK (source_type IN ('manual', 'csv_import', 'note_generated', 'mindmap_generated')),
  
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for JSONB to accelerate advanced searches
CREATE INDEX idx_flashcards_metadata ON flashcards USING GIN (content_metadata);
CREATE INDEX idx_flashcards_type ON flashcards(card_type);
CREATE INDEX idx_flashcards_user ON flashcards(user_id);
CREATE INDEX idx_flashcards_concept ON flashcards(concept_id);
CREATE INDEX idx_flashcards_taxonomy ON flashcards(taxonomy_node_id);
CREATE INDEX idx_flashcards_source ON flashcards(source_type);
CREATE INDEX idx_flashcards_archived ON flashcards(is_archived);
CREATE INDEX idx_flashcards_user_archived ON flashcards(user_id, is_archived); -- Composite index


CREATE TABLE IF NOT EXISTS extracted_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  media_type VARCHAR(50) CHECK (media_type IN (
    'code', 'image', 'video', 'diagram', 'audio', 'file', 'website')),
  storage_method VARCHAR(20) DEFAULT 'local_path' 
    CHECK (storage_method IN ('local_path', 'external_url')),
  programming_language VARCHAR(50),
  language VARCHAR(20),
  file_url TEXT NOT NULL,
  checksum VARCHAR(64),
  pages INTEGER[],
  extraction_location TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extracted_media_source ON extracted_media(source_id);
CREATE INDEX idx_extracted_media_type ON extracted_media(media_type);
CREATE INDEX idx_extracted_media_storage ON extracted_media(storage_method);
CREATE INDEX idx_extracted_media_programming_language ON extracted_media(programming_language);
CREATE INDEX idx_extracted_media_language ON extracted_media(language);

-- =============================================================================
-- FEYNMAN TEACH-BACK SESSIONS

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

CREATE INDEX IF NOT EXISTS idx_feynman_user ON feynman_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feynman_concept ON feynman_sessions(concept_id);

-- =============================================================================
-- FUNCTIONS

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_concepts_updated_at
  BEFORE UPDATE ON concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION extract_source_citations(text_with_citations TEXT)
RETURNS TABLE(source_id TEXT, page_or_location TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (regexp_matches(text_with_citations, '\[src:([a-f0-9\-]+):([^\]]+)\]', 'g'))[1]::TEXT as source_id,
    (regexp_matches(text_with_citations, '\[src:([a-f0-9\-]+):([^\]]+)\]', 'g'))[2]::TEXT as page_or_location;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SEED DATA: Demo Users

INSERT INTO users (id, username, email, password_hash, role, display_name, is_active, email_verified) VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'admin',
    'admin@learningplatform.com',
    crypt('password123', gen_salt('bf', 10)),
    'admin',
    'System Administrator',
    TRUE,
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'teacher_demo',
    'teacher@hkive.com',
    crypt('password123', gen_salt('bf', 10)),
    'teacher',
    'Demo Teacher',
    TRUE,
    TRUE
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'student_demo',
    'student@hkive.com',
    crypt('password123', gen_salt('bf', 10)),
    'student',
    'Demo Student',
    TRUE,
    TRUE
  )
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_profiles (
  user_id,
  bio,
  organization,
  department,
  level,
  domain_level,
  difficulty_preference,
  ai_assistance_level,
  total_play_time_minutes,
  scripts_completed
) VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'System administrator account for managing the learning platform',
    'Learning Platform',
    'IT Department',
    'Staff',
    'advanced',
    'medium',
    'moderate',
    0,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Demo teacher account for testing educational features',
    'Demo University',
    'Computer Science',
    'Faculty',
    'advanced',
    'medium',
    'moderate',
    0,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'Demo student account for testing learning features',
    'Demo University',
    'Computer Science',
    'Undergraduate',
    'beginner',
    'medium',
    'moderate',
    0,
    0
  )
ON CONFLICT (user_id) DO NOTHING;

  -- =============================================================================
  -- SEED DATA: Demo Likes (Unified likes table)
-- Unified likes table (discussions, activity feed, shared content)
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

CREATE INDEX idx_likes_entity ON likes(entity_type, entity_id);
CREATE INDEX idx_likes_user ON likes(user_id);
CREATE INDEX idx_likes_shared_content ON likes(entity_id) WHERE entity_type = 'shared_content';

  INSERT INTO likes (user_id, entity_type, entity_id, created_at) VALUES
    -- Teacher likes a discussion thread
    ('00000000-0000-0000-0000-000000000002'::uuid, 'discussion_thread',
     '20000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '2 days'),
    -- Student likes a discussion reply
    ('00000000-0000-0000-0000-000000000003'::uuid, 'discussion_reply',
     '30000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    -- Student likes an activity item
    ('00000000-0000-0000-0000-000000000003'::uuid, 'activity',
     '40000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '12 hours'),
    -- Teacher likes an activity comment
    ('00000000-0000-0000-0000-000000000002'::uuid, 'comment',
     '50000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '6 hours')
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- SEED DATA: Standard Relationship Types

INSERT INTO relationships (id, relationship_type, direction) VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'part_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'has_part', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'characteristic_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'has_characteristic', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'member_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000006'::uuid, 'has_member', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000007'::uuid, 'has_subsequence', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000008'::uuid, 'is_subsequence_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000009'::uuid, 'participates_in', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000010'::uuid, 'prerequisite_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000011'::uuid, 'has_prerequisite', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000012'::uuid, 'applies_to', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000013'::uuid, 'applied_in', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000014'::uuid, 'builds_on', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000015'::uuid, 'exemplifies', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000016'::uuid, 'derives_from', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000017'::uuid, 'author', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000018'::uuid, 'introduced_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000019'::uuid, 'simultaneous_with', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000020'::uuid, 'happens_during', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000021'::uuid, 'before_or_simultaneous_with', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000022'::uuid, 'starts_before', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000023'::uuid, 'ends_after', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000024'::uuid, 'derives_into', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000025'::uuid, 'located_in', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000026'::uuid, 'location_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000027'::uuid, 'overlaps', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000028'::uuid, 'adjacent_to', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000029'::uuid, 'surrounded_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000030'::uuid, 'connected_to', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000031'::uuid, 'causally_related_to', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000032'::uuid, 'regulates', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000033'::uuid, 'regulated_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000034'::uuid, 'enables', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000035'::uuid, 'contributes_to', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000036'::uuid, 'results_in_assembly_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000037'::uuid, 'results_in_breakdown_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000038'::uuid, 'capable_of', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000039'::uuid, 'interacts_with', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000040'::uuid, 'has_participant', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000041'::uuid, 'implies', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000042'::uuid, 'contradicts', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000043'::uuid, 'similar_to', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000044'::uuid, 'owns', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000045'::uuid, 'is_owned_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000046'::uuid, 'produces', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000047'::uuid, 'produced_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000048'::uuid, 'determined_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000049'::uuid, 'determines', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000050'::uuid, 'correlated_with', 'bidirectional'),
  ('10000000-0000-0000-0000-000000000051'::uuid, 'implements', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000052'::uuid, 'implemented_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000053'::uuid, 'proves', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000054'::uuid, 'proven_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000055'::uuid, 'generalizes', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000056'::uuid, 'specialized_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000057'::uuid, 'approximates', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000058'::uuid, 'approximated_by', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000059'::uuid, 'replaces', 'unidirectional'),
  ('10000000-0000-0000-0000-000000000060'::uuid, 'replaced_by', 'unidirectional')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Library of Congress Classification (LCC) Taxonomy

-- =============================================================================
-- A - GENERAL WORKS

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES

  ('A', 'General Works', 1, NULL, 'General works'),
  ('AC', 'Collections', 2, 'A', 'Collected works including monographs, essays, inaugural and program dissertations, pamphlet collections, scrapbooks'),
  ('AE', 'Encyclopedias', 2, 'A', 'Modern encyclopedias'),
  ('AG', 'Dictionaries', 2, 'A', 'Dictionaries and other general reference works'),
  ('AI', 'Indexes', 2, 'A', 'Indexes'),
  ('AM', 'Museums', 2, 'A', 'Museums, its studies, collectors and collections'),
  ('AP', 'Periodicals', 2, 'A', 'Periodicals including humorous, juvenile, women, African Americans'),
  ('AS', 'Academies and Learned Societies', 2, 'A', 'Academic and learned societies'),
  ('AY', 'Yearbooks and Almanacs', 2, 'A', 'Yearbooks and Almanacs'),
  ('AZ', 'History of Scholarship and Learning', 2, 'A', 'History of scholarship and learning')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- B - PHILOSOPHY, PSYCHOLOGY, RELIGION

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('B', 'Philosophy, Psychology, Religion', 1, NULL, 'Philosophy, psychology, religion'),
  -- B-BJ: Philosophy, Psychology 
  ('B1', 'Philosophy', 2, 'B', 'General philosophy, including general works, ancient, medieval, renaissance, modern'),
  ('BC', 'Logic', 3, 'B1', 'Logic, including history, general works, special topics'),
  ('BD', 'Speculative Philosophy', 3, 'B1', 'Speculative philosophy, including general works, metaphysics, epistemology, methodology, ontology, cosmology'),
  ('BF', 'Psychology', 3, 'B1', 'Psychology, including psychoanalysis, experimental psychology, gestalt psychology, psychotropic drugs, sensation, consciousness and cognition,
    motivation, affection, feeling and emotion, will, volition, choice and control, comparative psychology, sex psychology, genetic psychology, physiognomy, phrenology,
    graphology, plamistry and chiromancy, parapsychology, occult sciences'),
  ('BH', 'Aesthetics', 3, 'B1', 'Aesthetics'),
  ('BJ', 'Ethics', 3, 'B1', 'Ethics, including history, socialist ethics, totalitarian ethics, feminist ethics, professional ethics, social usage and etiquette'),
  -- BL-BX: Religion
  ('B2', 'Religions', 2, 'B', 'Religions, including philosophy of religion, pscyhology of religion, biography, natural theology, 
    religious doctrines, history and principles of religions'),
  ('BM', 'Judaism', 3, 'B2', 'Judaism'),
  ('BP', 'Islam', 3, 'B2', 'Islam'),
  ('BQ', 'Buddhism', 3, 'B2', 'Buddhism'),
  ('BR', 'Christianity', 3, 'B2', 'Christianity'),
  ('BS', 'Bible', 3, 'B2', 'Bible'),
  ('BT', 'Doctrinal Theology', 3, 'B2', 'Doctrinal theology'),
  ('BV', 'Practical Theology', 3, 'B2', 'Practical theology'),
  ('BX', 'Christian Denominations', 3, 'B2', 'Christian denominations')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- C - AUXILIARY SCIENCES OF HISTORY

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('C', 'Auxiliary Sciences of History', 1, NULL, 'Auxiliary sciences of history'),
  ('CB', 'History of Civilization', 2, 'C', 'History of civilization, including interplanetary voyages, forecasts, special topics'),
  ('CC', 'Archaeology', 2, 'C', 'Archaeology'),
  ('CD', 'Diplomatics', 2, 'C', 'Diplomatics, including archives, seals'),
  ('CE', 'Technical chronology', 2, 'C', 'Technical chronology'),
  ('CJ', 'Numismatics', 2, 'C', 'Numismatics, including coins, tokens, medals and medallions'),
  ('CN', 'Inscriptions', 2, 'C', 'Inscriptions'),
  ('CR', 'Heraldry', 2, 'C', 'Heraldry'),
  ('CS', 'Genealogy', 2, 'C', 'Genealogy, including genealogical lists, family history, personal and family names'),
  ('CT', 'Biography', 2, 'C', 'Biography')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- D - HISTORY (GENERAL) & E - HISTORY (AMERICA)

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('D', 'History', 1, NULL, 'History, including military and naval history, political and diplomatic history, ancient history'),
  ('DA', 'History of Great Britain', 2, 'D', 'History of Great Britain'),
  ('DAW', 'History of Central Europe', 2, 'D', 'History of Central Europe'),
  ('DB', 'History of Austria, Liechtenstein, Hungary, Czechoslovakia, Austro-Hungarian Empire', 2, 'D', 'History of Austria, Liechtenstein, Hungary, Czechoslovakia, Austro-Hungarian Empire'),
  ('DC', 'History of France', 2, 'D', 'History of France'),
  ('DD', 'History of Germany', 2, 'D', 'History of Germany'),
  ('DE', 'History of the Greco-Roman world', 2, 'D', 'History of the Greco-Roman world'),
  ('DF', 'History of Greece', 2, 'D', 'History of Greece'),
  ('DG', 'History of Italy', 2, 'D', 'History of Italy'),
  ('DH', 'History of Low Countries, Benelux Countries', 2, 'D', 'History of Low Countries, Benelux Countries'),
  ('DJ', 'History of Netherlands', 2, 'D', 'History of Netherlands'),
  ('DJK', 'History of Eastern Europe (General)', 2, 'D', 'General history of Eastern Europe'),
  ('DK', 'History of Russia, Soviet Union, Former Soviet Republics', 2, 'D', 'History of Russia, Soviet Union, former Soviet Republics'),
  ('DL', 'History of Northern Europe, Scandinavia', 2, 'D', 'History of Northern Europe, Scandinavia'),
  ('DP', 'History of Spain', 2, 'D', 'History of Spain'),
  ('DQ', 'History of Switzerland', 2, 'D', 'History of Switzerland'),
  ('DR', 'History of Balkan Peninsula', 2, 'D', 'History of Balkan Peninsula'),
  ('DS', 'History of Asia', 2, 'D', 'History of Asia'),
  ('DT', 'History of Africa', 2, 'D', 'History of Africa'),
  ('DU', 'History of Oceania (South Seas)', 2, 'D', 'History of Oceania (South Seas)'),
  ('DX', 'History of Romanies', 2, 'D', 'History of Romanies')
ON CONFLICT (lcc_code) DO NOTHING;

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('E', 'History of America', 2, 'D', 'History of America'),
  ('E1', 'History of United States', 3, 'E', 'History of United States'),
  ('E2', 'History of British America', 3, 'E', 'History of British America'),
  ('E3', 'History of Dutch America', 3, 'E', 'History of Dutch America'),
  ('E4', 'History of French America', 3, 'E', 'History of French America'),
  ('E5', 'History of Latin America, Spanish America', 3, 'E', 'History of Latin America, Spanish America')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- G - GEOGRAPHY, MAPS, ANTHROPOLOGY, RECREATION

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('G', 'Geography, Maps, Anthropology, Recreation', 1, NULL, 'Geography, Maps, Anthropology, Recreation'),
  ('G1', 'Geography', 2, 'G', 'General geography'),
  ('G2', 'Atlases', 2, 'G', 'Atlases'),
  ('G3', 'Globes', 2, 'G', 'Globes'),
  ('G4', 'Maps', 2, 'G', 'Maps'),
  ('GA', 'Mathematical Geography, Cartography', 2, 'G', 'Mathematical geography, cartography'),
  ('GB', 'Physical Geography', 2, 'G', 'Physical geography'),
  ('GC', 'Oceanography', 2, 'G', 'Oceanography'),
  ('GE', 'Environmental Sciences', 2, 'G', 'Environmental sciences'),
  ('GF', 'Human Ecology', 2, 'G', 'Human ecology'),
  ('GN', 'Anthropology', 2, 'G', 'Anthropology, including physical anthropology, Ethnology, social and cultural anthropology, prehistoric archaaeology'),
  ('GR', 'Folklore', 2, 'G', 'Folklore'),
  ('GT', 'Manners and Customs', 2, 'G', 'Manners and customs'),
  ('GV', 'Recreation and Leisure', 2, 'G', 'Recreation and leisure')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- H - SOCIAL SCIENCES

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('H', 'Social Sciences', 1, NULL, 'Social Sciences'),
  ('HA', 'Statistics of Social Sciences', 2, 'H', 'Statistics of social sciences'),
  ('HB', 'Economic Theory and Demography', 2, 'H', 'Economic theory and demography'),
  ('HC', 'Economic History and Conditions', 2, 'H', 'Economic history and conditions'),
  ('HD', 'Industries, Land Use and Labor', 2, 'H', 'Industries, land use and labor'),
  ('HE', 'Transportation and Communications', 2, 'H', 'Transportation and communications'),
  ('HF', 'Commerce', 2, 'H', 'Commerce'),
  ('HG', 'Finance', 2, 'H', 'Finance'),
  ('HJ', 'Public Finance', 2, 'H', 'Public finance'),
  ('HM', 'Sociology', 2, 'H', 'Sociology'),
  ('HN', 'Social History, Conditions and Social Problems', 2, 'H', 'Social history, conditions and social problems'),
  ('HQ', 'Family, Marriage, Women', 2, 'H', 'Family, marriage, women'),
  ('HS', 'Societies', 2, 'H', 'Societies'),
  ('HT', 'Communities, Classes, Races', 2, 'H', 'Communities, classes, races'),
  ('HV', 'Social Pathology, Social and Public welfare, Criminology', 2, 'H', 'Social pathology, social and public welfare, and criminology'),
  ('HX', 'Socialism, Communism, Anarchism', 2, 'H', 'Socialism, communism, anarchism')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- J - POLITICAL SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('J', 'Political Science', 1, NULL, 'Political Science'),
  ('J1', 'General Legislative and Executive Papers', 2, 'J', 'General legislative and executive papers'),
  ('JC', 'Political Theory, The State, Theories of the State', 2, 'J', 'Political theory, the State, theories of the State'),
  ('JF', 'Political Institutions and Public Administration (General)', 2, 'J', 'General political institutions and public administration'),
  ('JJ', 'Political Institutions and Public Administration (North America)', 3, 'JF', 'Political institutions and public administration (North America)'),
  ('JK', 'Political Institutions and Public Administration (United States)', 3, 'JF', 'Political institutions and public administration (United States)'),
  ('JL', 'Political Institutions and Public Administration (Canada and Latin America)', 3, 'JF', 'Political institutions and public administration (Canada and Latin America)'),
  ('JN', 'Political Institutions and Public Administration (Europe)', 3, 'JF', 'Political institutions and public administration (Europe)'),
  ('JQ', 'Political Institutions and Public Administration (Asia, Africa, Australia, Pacific Area)', 3, 'JF', 'Political institutions and public administration (Asia, Africa, Australia, Pacific Area)'),
  ('JS', 'Political Institutions and Public Administration (United States Local and Municipal)', 3, 'JF', 'Political institutions and public administration (United States Local and Municipal)'),
  ('JV', 'Colonies and Colonization, Emigration and Immigration, International Migration', 2, 'J', 'Colonies and colonization, emigration and immigration, international migration'),
  ('JX', 'International Law', 2, 'J', 'International law'),
  ('JZ', 'International Relations', 2, 'J', 'International relations')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- K - LAW

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('K', 'Law', 1, NULL, 'Law'),
  ('KB', 'Religious Law', 2, 'K', 'Religious law'),
  ('KD', 'Law of the United Kingdom and Ireland', 2, 'K', 'Law of the United Kingdom and Ireland'),
  ('KE', 'Law of Canada', 2, 'K', 'Law of Canada'),
  ('KF', 'Law of the United States', 2, 'K', 'Law of the United States'),
  ('KI', 'Law of the Law of Indigenous Peoples', 2, 'K', 'Law of the Law of Indigenous Peoples'),
  ('KJ', 'Law of Europe', 2, 'K', 'Law of Europe'),
  ('KL', 'Law of Asia and Eurasia, Africa, Pacific Area, and Antarctica', 2, 'K', 'Law of Asia and Eurasia, Africa, Pacific Area, and Antarctica'),
  ('KZ', 'Law of Nations', 2, 'K', 'Law of Nations')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- L - EDUCATION

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('L', 'Education', 1, NULL, 'Education'),
  ('LA', 'History of Education', 2, 'L', 'History of education'),
  ('LB', 'Theory and Practice of Education', 2, 'L', 'Theory and practice of education'),
  ('LC', 'Special Aspects of Education', 2, 'L', 'Special aspects of education'),
  ('LD', 'Individual Institutions', 2, 'L', 'Individual institutions'),
  ('LT', 'Textbooks', 2, 'L', 'Textbooks')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- M - Music and Books on Music 

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('M', 'Music', 1, NULL, 'Music and musical performance'),
  ('ML', 'Literature on Music', 2, 'M', 'Literature on music'),
  ('MT', 'Music Instruction and Study', 2, 'M', 'Music instruction and study')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- N - FINE ARTS

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('N', 'Fine Arts', 1, NULL, 'Fine arts'),
  ('N1', 'Visual Arts', 2, 'N', 'Visual arts'),
  ('NA', 'Architecture', 2, 'N', 'Architecture'),
  ('NB', 'Sculpture', 2, 'N', 'Sculpture'),
  ('NC', 'Drawing, Design, Illustration', 2, 'N', 'Drawing, design, illustration'),
  ('ND', 'Painting', 2, 'N', 'Painting'),
  ('NE', 'Print Media', 2, 'N', 'Print media'),
  ('NK', 'Decorative Arts', 2, 'N', 'Decorative arts'),
  ('NX', 'Arts in General', 2, 'N', 'Arts in general')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- P - LANGUAGE AND LITERATURE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('P', 'Language and Literature', 1, NULL, 'Language and Literature'),
  ('P1', 'Philology and Linguistics', 2, 'P', 'Philology and linguistics'),
  ('PA', 'Greek and Latin Languages and Literatures', 2, 'P', 'Greek and Latin languages and literatures'),
  ('PB', 'Modern European Languages', 2, 'P', 'Modern European languages'),
  ('PJ', 'Oriental and Indo-Iranian Philology and Literatures', 2, 'P', 'Oriental and Indo-Iranian philology and literatures'),
  ('PL', 'Languages of Eastern Asia, Africa, Oceania, Hyperborean, Indian, and Artificial Languages', 2, 'P', 'Languages of Eastern Asia, Africa, Oceania. Hyperborean, Indian, and artificial languages'),
  ('PQ', 'French, Italian, Spanish, and Portuguese Literatures', 2, 'P', 'French, Italian, Spanish, and Portuguese literatures'),
  ('PR', 'English and American Literature, Juvenile Belles Lettres', 2, 'P', 'English and American literature, Juvenile Belles lettres'),
  ('PT', 'German, Dutch, and Scandinavian Literatures', 2, 'P', 'German, Dutch, and Scandinavian literatures')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- Q - SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('Q', 'Science', 1, NULL, 'Science'),
  ('QA', 'Mathematics', 2, 'Q', 'Mathematics'),
  ('QB', 'Astronomy', 2, 'Q', 'Astronomy'),
  ('QC', 'Physics', 2, 'Q', 'Physics'),
  ('QD', 'Chemistry', 2, 'Q', 'Chemistry'),
  ('QE', 'Geology', 2, 'Q', 'Geology'),
  ('QH', 'Biology', 2, 'Q', 'Biology'),
  ('QK', 'Botany', 2, 'Q', 'Botany'),
  ('QL', 'Zoology', 2, 'Q', 'Zoology'),
  ('QM', 'Human Anatomy', 2, 'Q', 'Human anatomy'),
  ('QP', 'Physiology', 2, 'Q', 'Physiology'),
  ('QR', 'Microbiology', 2, 'Q', 'Microbiology')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- R - MEDICINE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('R', 'Medicine', 1, NULL, 'Medicine'),
  ('RA', 'Public Aspects of Medicine', 2, 'R', 'Public aspects of medicine'),
  ('RB', 'Pathology', 2, 'R', 'Pathology'),
  ('RC', 'Internal Medicine', 2, 'R', 'Internal medicine'),
  ('RD', 'Surgery', 2, 'R', 'Surgery'),
  ('RE', 'Ophthalmology', 2, 'R', 'Ophthalmology'),
  ('RF', 'Otorhinolaryngology', 2, 'R', 'Otorhinolaryngology'),
  ('RG', 'Gynecology and Obstetrics', 2, 'R', 'Gynecology and obstetrics'),
  ('RJ', 'Pediatrics', 2, 'R', 'Pediatrics'),
  ('RK', 'Dentistry', 2, 'R', 'Dentistry'),
  ('RL', 'Dermatology', 2, 'R', 'Dermatology'),
  ('RM', 'Therapeutics, Pharmacology', 2, 'R', 'Therapeutics, pharmacology'),
  ('RS', 'Pharmacy and Materia Medica', 2, 'R', 'Pharmacy and materia medica'),
  ('RT', 'Nursing', 2, 'R', 'Nursing'),
  ('RV', 'Botanic, Thomsonian, and Eclectic Medicine', 2, 'R', 'Botanic, Thomsonian, and eclectic medicine'),
  ('RX', 'Homeopathy', 2, 'R', 'Homeopathy'),
  ('RZ', 'Other Systems of Medicine', 2, 'R', 'Other systems of medicine')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- S - AGRICULTURE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('S', 'Agriculture', 1, NULL, 'Agriculture'),
  ('SB', 'Plant Culture', 2, 'S', 'Plant culture'),
  ('SD', 'Forestry', 2, 'S', 'Forestry'),
  ('SF', 'Animal Culture', 2, 'S', 'Animal culture'),
  ('SH', 'Aquaculturem, Fisheries, Angling', 2, 'S', 'Aquaculture, fisheries, angling'),
  ('SK', 'Hunting Sports', 2, 'S', 'Hunting sports')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- T - TECHNOLOGY

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('T', 'Technology', 1, NULL, 'Technology'),
  ('TA', 'General Engineering, Civil Engineering', 2, 'T', 'General engineering, civil engineering'),
  ('TC', 'Hydraulic and Ocean Engineering', 2, 'T', 'Hydraulic and ocean engineering'),
  ('TD', 'Environmental Technology, Sanitary Engineering', 2, 'T', 'Environmental technology, sanitary engineering'),
  ('TE', 'Highway Engineering, Roads and Pavements', 2, 'T', 'Highway engineering, roads and pavements'),
  ('TF', 'Railroad Engineering and Operation', 2, 'T', 'Railway engineering and operation'),
  ('TG', 'Bridge Engineering', 2, 'T', 'Bridge engineering'),
  ('TH', 'Building Construction', 2, 'T', 'Building construction'),
  ('TJ', 'Mechanical Engineering and Machinery', 2, 'T', 'Mechanical engineering and machinery'),
  ('TK', 'Electrical Engineering, Electronics, Nuclear Engineering', 2, 'T', 'Electrical engineering, electronics, nuclear engineering'),
  ('TL', 'Motor Vehicles, Aeronautics, Astronautics', 2, 'T', 'Motor vehicles, aeronautics, astronautics'),
  ('TN', 'Mining Engineering, Metallurgy', 2, 'T', 'Mining engineering, metallurgy'),
  ('TP', 'Chemical Technology', 2, 'T', 'Chemical technology'),
  ('TR', 'Photography', 2, 'T', 'Photography'),
  ('TS', 'Manufactures', 2, 'T', 'Manufactures'),
  ('TT', 'Handicrafts, Arts and Crafts', 2, 'T', 'Handicrafts, arts and crafts'),
  ('TX', 'Home Economics', 2, 'T', 'Home economics')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- U - MILITARY SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('U', 'Military Science', 1, NULL, 'Military science'),
  ('UA', 'Armies', 2, 'U', 'Armies'),
  ('UB', 'Military Administration', 2, 'U', 'Military administration'),
  ('UC', 'Maintenance and Transportation', 2, 'U', 'Maintenance and transportation'),
  ('UD', 'Infantry', 2, 'U', 'Infantry'),
  ('UE', 'Cavalry, Armor', 2, 'U', 'Cavalry, armor'),
  ('UF', 'Artillery', 2, 'U', 'Artillery'),
  ('UG', 'Military Engineering', 2, 'U', 'Military engineering'),
  ('UH', 'Other Services', 2, 'U', 'Other services')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- V - NAVAL SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('V', 'Naval Science', 1, NULL, 'Naval Science'),
  ('VA', 'Navies', 2, 'V', 'Navies'),
  ('VB', 'Naval Administration', 2, 'V', 'Naval administration'),
  ('VC', 'Naval Maintenance', 2, 'V', 'Naval maintenance'),
  ('VD', 'Naval Personnel', 2, 'V', 'Naval personnel'),
  ('VE', 'Marines', 2, 'V', 'Marines'),
  ('VF', 'Naval Ordnance', 2, 'V', 'Naval ordnance'),
  ('VG', 'Minor Services of Navies', 2, 'V', 'Minor services of navies'),
  ('VK', 'Navigation, Merchant Marine', 2, 'V', 'Navigation, merchant marine'),
  ('VM', 'Naval architecture, Shipbuilding, Marine Engineering', 2, 'V', 'Naval architecture, shipbuilding, marine engineering')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- Z - BIBLIOGRAPHY AND LIBRARY SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('Z', 'Bibliography, Library Science, Information Resources', 1, NULL, 'Bibliography, library science, information resources'),
  ('Z1', 'Books, Writing, Paleography', 2, 'Z', 'Books, writing, paleography'),
  ('ZA', 'Information Resources', 2, 'Z', 'Information resources')
ON CONFLICT (lcc_code) DO NOTHING;

-- Define error category ENUM (corresponds to FR 4.7)
CREATE TYPE error_category_type AS ENUM (
    'conceptual_misunderstanding', -- Conceptual misunderstanding
    'calculation_error',           -- Calculation error
    'memory_slip',                 -- Memory slip/forgetting
    'misinterpretation',           -- Question misinterpretation
    'procedural_error',            -- Procedural error
    'unknown'
);

-- Define Feynman mode ENUM
CREATE TYPE feynman_mode_type AS ENUM (
    'initial_explain',    -- User's first explanation (FR 4.1)
    'correction_explain', -- Re-explanation after viewing answer (FR 4.11)
    'self_reflection'     -- Self-reflection after exam
);

-- 1. Public exam questions table (exam_questions) - corresponds to FR 4.5
CREATE TABLE exam_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_exam VARCHAR(50) NOT NULL,  -- e.g., 'DSE', 'ALevel'
    year INTEGER NOT NULL,
    paper VARCHAR(20),
    question_no VARCHAR(20),
    question_stem TEXT NOT NULL,
    options JSONB,                     -- e.g., ["A: ...", "B: ..."]
    correct_answer VARCHAR(50) NOT NULL,
    answer_explanation TEXT,
    related_concept_ids UUID[] DEFAULT '{}', -- Related to concepts table
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Learning activity record table (assessment_activities) - corresponds to Data Description
CREATE TABLE assessment_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,             -- Assumes users table exists
    concept_id UUID,                   -- Assumes concepts table exists
    question_id UUID REFERENCES exam_questions(id),
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('feynman', 'quiz', 'error_review', 'active_recall')),
    
    -- Record detailed data
    original_answer TEXT,
    ai_analysis_result JSONB,
    correctness BOOLEAN,
    score NUMERIC(5,2),
    difficulty_level INTEGER,
    points_earned INTEGER DEFAULT 0,   -- ✅ Added: Gamification (FR4 leaderboard)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Feynman explanations table (feynman_explanations) - corresponds to FR 4.1, 4.2, 4.3, 4.11
CREATE TABLE feynman_explanations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES assessment_activities(id), -- Link back to main table
    user_id UUID NOT NULL,
    concept_id UUID NOT NULL,
    
    mode feynman_mode_type DEFAULT 'initial_explain',
    
    user_explanation TEXT NOT NULL,
    
    ai_feedback JSONB,
    misconceptions_detected BOOLEAN DEFAULT FALSE,
    
    -- Rewrite and reflection (FR 4.2, 4.3)
    rewritten_version TEXT,            -- Elaboration Engine (FR 4.2)
    peer_teaching_reflection TEXT,     -- "How would you teach classmates?" (FR 4.3)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Error book table (error_book) - corresponds to FR 4.6 - 4.10
CREATE TABLE error_book (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    question_id UUID REFERENCES exam_questions(id),
    concept_id UUID,                   -- Corresponds to FR 4.10 Error Mind Map
    
    wrong_answer TEXT NOT NULL,
    correct_answer_snapshot TEXT,      -- Record correct answer at the time to prevent question changes
    system_explanation TEXT,
    
    -- Error classification (FR 4.7)
    error_category error_category_type DEFAULT 'unknown',
    
    -- Deep reflection (FR 4.8)
    user_reflection_notes TEXT,        -- "Why wrong? How to avoid next time?" (FR 4.8)
    
    -- Spaced Repetition (FR 4.9)
    first_wrong_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_review_time TIMESTAMP WITH TIME ZONE,
    next_review_time TIMESTAMP WITH TIME ZONE,
    review_count INTEGER DEFAULT 0,
    is_mastered BOOLEAN DEFAULT FALSE,
    
    error_pattern_tags TEXT[] DEFAULT '{}'  -- ✅ Added: FR4.10 Error Pattern (for mind map use)
);

-- 5. Quiz attempt records (quiz_attempts)
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

-- Indexes optimization (Performance)
CREATE INDEX idx_assessment_user_concept ON assessment_activities(user_id, concept_id);
CREATE INDEX idx_error_book_next_review ON error_book(user_id, next_review_time) WHERE is_mastered = FALSE;
CREATE INDEX idx_feynman_concept_user ON feynman_explanations(user_id, concept_id);
CREATE INDEX idx_exam_questions_concept ON exam_questions USING GIN (related_concept_ids);
CREATE INDEX idx_error_pattern ON error_book USING GIN (error_pattern_tags); 

-- =========================
-- Sample seed data (rerunnable)
-- =========================
-- Known UUIDs used below (for deterministic references)
-- Users: alice 11111111-1111-1111-1111-111111111111, bob 22222222-2222-2222-2222-222222222222, chloe 33333333-3333-3333-3333-333333333333, dan 44444444-4444-4444-4444-444444444444
-- Concepts: geometry aaaaaaaa-0000-0000-0000-000000000001, algebra aaaaaaaa-0000-0000-0000-000000000002, probability aaaaaaaa-0000-0000-0000-000000000003, calculus aaaaaaaa-0000-0000-0000-000000000004, trigonometry aaaaaaaa-0000-0000-0000-000000000005, statistics aaaaaaaa-0000-0000-0000-000000000006

INSERT INTO exam_questions (id, source_exam, year, paper, question_no, question_stem, options, correct_answer, answer_explanation, related_concept_ids, difficulty_level)
VALUES
    ('70000000-0000-0000-0000-000000000001', 'DSE', 2023, 'P1', 'Q1', 'Given vectors a = (3, -4) and b = (-1, 2), find |a + b|.', '["A. 2", "B. sqrt(5)", "C. sqrt(13)", "D. 5"]'::jsonb, 'C', 'Sum vectors then apply Pythagoras to magnitude sqrt(13).', '{"aaaaaaaa-0000-0000-0000-000000000001","aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000002', 'ALevel', 2022, 'P2', 'Q5', 'Differentiate y = (3x^2 + 4x - 5)e^x.', NULL, 'N/A', 'Product rule: y'' = (3x^2 + 4x - 5)e^x + (6x + 4)e^x.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 3),
    ('70000000-0000-0000-0000-000000000003', 'DSE', 2021, 'P1', 'Q7', 'A biased coin shows heads with probability 0.6. After 5 tosses, what is P(exactly 3 heads)?', '["A. 0.1536", "B. 0.3456", "C. 0.5000", "D. 0.6000"]'::jsonb, 'B', 'Use binomial: C(5,3)*(0.6^3)*(0.4^2)=0.3456.', '{"aaaaaaaa-0000-0000-0000-000000000003"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000004', 'Mock', 2024, 'P1', 'Q3', 'Find the area of a triangle with vertices (0,0), (4,0), (4,5).', '["A. 8", "B. 10", "C. 12", "D. 20"]'::jsonb, 'B', 'Right triangle: area = 1/2 * 4 * 5 = 10.', '{"aaaaaaaa-0000-0000-0000-000000000001"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000005', 'DSE', 2020, 'P2', 'Q9', 'Solve for x: 2sin(x)cos(x) = 1/2 on 0 <= x < 2π.', NULL, 'N/A', '2sin(x)cos(x)=sin(2x)=1/2 -> 2x = π/6,5π/6 -> x = π/12,5π/12,13π/12,17π/12.', '{"aaaaaaaa-0000-0000-0000-000000000005"}'::uuid[], 3),
    ('70000000-0000-0000-0000-000000000006', 'ALevel', 2023, 'P1', 'Q12', 'The lifetime (hours) of a bulb ~ N(800, 20^2). Find P(X > 830).', NULL, 'N/A', 'Standardize: z = (830-800)/20 = 1.5 -> P = 0.0668.', '{"aaaaaaaa-0000-0000-0000-000000000006"}'::uuid[], 4),
    ('70000000-0000-0000-0000-000000000007', 'Mock', 2024, 'P1', 'Q10', 'Given sequence a_n = 3n^2 - n, find a_8.', NULL, 'N/A', 'Substitute n=8 -> 3*64 - 8 = 184.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000008', 'DSE', 2023, 'P2', 'Q11', 'A particle moves with displacement s = 4t^3 - 6t^2 + 2 (m). Find acceleration at t=2.', NULL, 'N/A', 'v = ds/dt = 12t^2 - 12t, a = dv/dt = 24t - 12 -> a(2)=36 m/s^2.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 3),
    ('70000000-0000-0000-0000-000000000009', 'ALevel', 2021, 'P1', 'Q14', 'Solve for x: log_3(x-1) + log_3(x+2) = 2.', NULL, 'N/A', 'Combine: log_3((x-1)(x+2))=2 -> (x-1)(x+2)=9 -> x^2+x-11=0 -> x = (-1±sqrt(45))/2; valid positive root ≈ 2.854.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 2),
    ('70000000-0000-0000-0000-00000000000a', 'Mock', 2025, 'P2', 'Q2', 'Find the modulus of complex number z = -3 + 4i.', '["A. 1", "B. 4", "C. 5", "D. 7"]'::jsonb, 'C', 'Use |z| = sqrt((-3)^2 + 4^2) = 5.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-00000000000b', 'DSE', 2022, 'P1', 'Q6', 'Solve 3x^2 - 12x + 9 = 0.', '["A. 1,3", "B. 1,3/2", "C. 1/2,3", "D. 1,3"]'::jsonb, 'A', 'Factor 3(x^2 - 4x + 3)=0 -> x=1 or 3.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-00000000000c', 'Mock', 2024, 'P2', 'Q8', 'Integrate ∫ (2x + 5)/x dx.', NULL, 'N/A', 'Split: ∫2 + ∫5/x = 2x + 5 ln|x| + C.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 2),
    ('70000000-0000-0000-0000-00000000000d', 'ALevel', 2020, 'P1', 'Q4', 'Find the mean of data: 2, 4, 6, 8, 10.', NULL, 'N/A', 'Mean = 30/5 = 6.', '{"aaaaaaaa-0000-0000-0000-000000000006"}'::uuid[], 1),
    ('70000000-0000-0000-0000-00000000000e', 'DSE', 2021, 'P2', 'Q12', 'Find derivative of y = ln(3x^2 + 1).', NULL, 'N/A', 'Use chain rule: y'' = (6x)/(3x^2+1).', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 2),
    ('70000000-0000-0000-0000-00000000000f', 'Mock', 2025, 'P1', 'Q9', 'Evaluate limit lim_{x→0} (sin 2x)/(x).', NULL, 'N/A', 'Use sin kx ~ kx -> limit = 2.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000010', 'ALevel', 2022, 'P1', 'Q16', 'A fair die rolled 4 times. P(exactly one six)?', '["A. 0.4823", "B. 0.3955", "C. 0.4444", "D. 0.2637"]'::jsonb, 'B', 'C(4,1)*(1/6)*(5/6)^3 ≈ 0.3955.', '{"aaaaaaaa-0000-0000-0000-000000000003"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000011', 'DSE', 2020, 'P1', 'Q2', 'Simplify (1/√3) + (√3/3).', NULL, 'N/A', '(1/√3) + (√3/3) = (1+1)/√3 = 2/√3 = 2√3/3.', '{"aaaaaaaa-0000-0000-0000-000000000005"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000012', 'Mock', 2024, 'P3', 'Q6', 'Find area under y = x^2 from 0 to 2.', NULL, 'N/A', '∫0^2 x^2 dx = [x^3/3]_0^2 = 8/3.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000013', 'ALevel', 2023, 'P2', 'Q7', 'Compute determinant of [[2,3],[1,4]].', NULL, 'N/A', '2*4 - 3*1 = 5.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000014', 'DSE', 2022, 'P2', 'Q14', 'Solve for x in 2^(x+1) = 16.', NULL, 'N/A', '16 = 2^4 -> x+1=4 -> x=3.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000015', 'Mock', 2024, 'P1', 'Q15', 'Find the median of 3, 7, 9, 12, 14.', NULL, 'N/A', 'Sorted list median = 9.', '{"aaaaaaaa-0000-0000-0000-000000000006"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000016', 'ALevel', 2022, 'P3', 'Q9', 'If P(A)=0.4, P(B)=0.5, P(A∩B)=0.2, find P(A∪B).', NULL, 'N/A', 'P(A∪B)=0.4+0.5-0.2=0.7.', '{"aaaaaaaa-0000-0000-0000-000000000003"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000017', 'DSE', 2023, 'P1', 'Q18', 'Solve for x: e^x = 5.', NULL, 'N/A', 'x = ln 5.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 2),
    ('70000000-0000-0000-0000-000000000018', 'Mock', 2025, 'P1', 'Q12', 'Find the slope of the line through (2,3) and (5,11).', NULL, 'N/A', 'Slope = (11-3)/(5-2) = 8/3.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-000000000019', 'ALevel', 2024, 'P2', 'Q4', 'Integrate ∫ 4x^3 dx.', NULL, 'N/A', 'x^4 + C.', '{"aaaaaaaa-0000-0000-0000-000000000004"}'::uuid[], 1),
    ('70000000-0000-0000-0000-00000000001a', 'DSE', 2022, 'P1', 'Q8', 'Simplify (x^3 y^2)/(x y).', NULL, 'N/A', 'x^2 y.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-00000000001b', 'Mock', 2024, 'P2', 'Q10', 'If f(x)=x^2 and g(x)=3x-1, find (f∘g)(2).', NULL, 'N/A', 'g(2)=5 -> f(5)=25.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 1),
    ('70000000-0000-0000-0000-00000000001c', 'ALevel', 2021, 'P2', 'Q11', 'A triangle has angles 30°, 60°, 90°. Opposite the 30° angle is 5. Find hypotenuse.', NULL, 'N/A', 'In 30-60-90 triangle, hypotenuse = 2 * 5 = 10.', '{"aaaaaaaa-0000-0000-0000-000000000001"}'::uuid[], 2),
    ('70000000-0000-0000-0000-00000000001d', 'DSE', 2020, 'P1', 'Q16', 'Find variance of data 4, 4, 10, 10.', NULL, 'N/A', 'Mean=7; variance=[(9+9+9+9)/4]=9.', '{"aaaaaaaa-0000-0000-0000-000000000006"}'::uuid[], 2),
    ('70000000-0000-0000-0000-00000000001e', 'Mock', 2025, 'P3', 'Q5', 'Solve for x: 5^(2x) = 125.', NULL, 'N/A', '125=5^3 so 2x=3 => x=1.5.', '{"aaaaaaaa-0000-0000-0000-000000000002"}'::uuid[], 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_activities (id, user_id, concept_id, question_id, activity_type, original_answer, ai_analysis_result, correctness, score, difficulty_level, points_earned)
VALUES
    ('80000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'feynman', 'I added magnitudes instead of vectors.', '{"clarity":0.52,"missing_terms":["vector addition"],"confidence":0.41}'::jsonb, FALSE, 45.00, 2, 8),
    ('80000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', 'quiz', 'Derived only inner derivative.', '{"gaps":["product rule"],"confidence":0.36}'::jsonb, FALSE, 30.00, 3, 6),
    ('80000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'quiz', 'Computed 0.5.', '{"checklist":["used p=0.6","binomial formula"],"confidence":0.77}'::jsonb, FALSE, 60.00, 2, 10),
    ('80000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004', 'active_recall', 'Guessed 8.', '{"notes":"forgot base height formula"}'::jsonb, FALSE, 40.00, 1, 5),
    ('80000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000005', 'feynman', 'Mixed up radians and degrees.', '{"missing_terms":["solution set in 0-2pi"],"clarity":0.63}'::jsonb, FALSE, 55.00, 3, 9),
    ('80000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000006', 'quiz', 'I looked up z-score 1.6.', '{"mistake":"used 1.6 instead of 1.5"}'::jsonb, FALSE, 65.00, 4, 12),
    ('80000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000007', 'quiz', 'Calculated 190.', '{"comment":"substitution arithmetic slip"}'::jsonb, FALSE, 70.00, 1, 7),
    ('80000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000008', 'error_review', 'Differentiate once only.', '{"hint":"take second derivative"}'::jsonb, FALSE, 35.00, 3, 6),
    ('80000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000009', 'feynman', 'Solved quadratic but kept both roots.', '{"feedback":"domain restriction on log"}'::jsonb, FALSE, 55.00, 2, 8),
    ('80000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000000a', 'quiz', 'Modulus is 4.', '{"reminder":"use sqrt(a^2+b^2)"}'::jsonb, FALSE, 50.00, 1, 6),
    ('80000000-0000-0000-0000-00000000000b', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'error_review', 'Calculated 0.25.', '{"analysis":"used p=0.5 instead of 0.6"}'::jsonb, FALSE, 45.00, 2, 6),
    ('80000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000006', 'active_recall', 'Remembered 0.07.', '{"note":"approx ok"}'::jsonb, TRUE, 80.00, 4, 14),
    ('80000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000000b', 'quiz', 'x=1 only.', '{"note":"missed second root"}'::jsonb, FALSE, 55.00, 1, 8),
    ('80000000-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000c', 'quiz', '2x + 5ln x + C.', '{"issue":"domain abs and constant"}'::jsonb, TRUE, 82.00, 2, 11),
    ('80000000-0000-0000-0000-00000000000f', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000000d', 'quiz', 'Mean 5.', '{"gap":"forgot count"}'::jsonb, FALSE, 40.00, 1, 6),
    ('80000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000e', 'feynman', 'Derivative 6x only.', '{"prompt":"chain rule denominator"}'::jsonb, FALSE, 50.00, 2, 8),
    ('80000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000f', 'quiz', 'Limit 1.', '{"correction":"sin kx ~ kx"}'::jsonb, FALSE, 60.00, 2, 9),
    ('80000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000010', 'quiz', '0.3', '{"hint":"C(4,1)*(1/6)*(5/6)^3"}'::jsonb, FALSE, 45.00, 2, 7),
    ('80000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000011', 'active_recall', '2/√3.', '{"note":"rationalize"}'::jsonb, TRUE, 85.00, 1, 10),
    ('80000000-0000-0000-0000-000000000014', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000012', 'quiz', '9/4.', '{"fix":"integrate x^2 correctly"}'::jsonb, FALSE, 55.00, 2, 7),
    ('80000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000013', 'quiz', 'Determinant 6.', '{"hint":"ad-bc"}'::jsonb, FALSE, 52.00, 1, 7),
    ('80000000-0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000014', 'quiz', 'x=4.', '{"correction":"solve exponent"}'::jsonb, FALSE, 58.00, 1, 8),
    ('80000000-0000-0000-0000-000000000017', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000015', 'quiz', 'Median 8.', '{"note":"count ordered values"}'::jsonb, FALSE, 60.00, 1, 6),
    ('80000000-0000-0000-0000-000000000018', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000016', 'quiz', '0.6', '{"correction":"use inclusion-exclusion"}'::jsonb, FALSE, 62.00, 2, 8),
    ('80000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000017', 'feynman', 'x=5.', '{"prompt":"solve with ln"}'::jsonb, FALSE, 55.00, 2, 7),
    ('80000000-0000-0000-0000-00000000001a', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000018', 'quiz', 'Slope 2.', '{"hint":"rise over run"}'::jsonb, FALSE, 50.00, 1, 6),
    ('80000000-0000-0000-0000-00000000001b', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000019', 'active_recall', 'Integral 4x^3 -> 4x^4/4.', '{"note":"simplify to x^4"}'::jsonb, TRUE, 90.00, 1, 10),
    ('80000000-0000-0000-0000-00000000001c', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000001a', 'quiz', 'x^3 y.', '{"feedback":"subtract exponents"}'::jsonb, FALSE, 48.00, 1, 6),
    ('80000000-0000-0000-0000-00000000001d', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000001b', 'quiz', '20.', '{"fix":"compose functions"}'::jsonb, FALSE, 52.00, 1, 6),
    ('80000000-0000-0000-0000-00000000001e', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', '70000000-0000-0000-0000-00000000001c', 'quiz', '12.', '{"hint":"30-60-90 ratio"}'::jsonb, FALSE, 60.00, 2, 8),
    ('80000000-0000-0000-0000-00000000001f', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000001d', 'quiz', 'Variance 7.', '{"correction":"compute mean then squared diff"}'::jsonb, FALSE, 58.00, 2, 7),
    ('80000000-0000-0000-0000-000000000020', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000001e', 'feynman', 'x=3.', '{"note":"rewrite as power of five"}'::jsonb, FALSE, 65.00, 2, 9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feynman_explanations (id, activity_id, user_id, concept_id, mode, user_explanation, ai_feedback, misconceptions_detected, rewritten_version, peer_teaching_reflection)
VALUES
    ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'initial_explain', 'I thought magnitude add works like scalars.', '{"prompt":"demonstrate head-to-tail"}'::jsonb, TRUE, 'When adding vectors, add components then find magnitude.', 'I will draw arrows to explain vector addition.'),
    ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000005', 'initial_explain', 'Solved 2x=0.5 giving x=0.25.', '{"correction":"remember sin(2x)"}'::jsonb, TRUE, 'Use sin(2x)=1/2 to get four solutions in 0-2π.', 'Explain using unit circle positions.'),
    ('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000002', 'correction_explain', 'Both roots kept but negative breaks domain.', '{"focus":"argument of log must be positive"}'::jsonb, TRUE, 'Keep only root where x-1>0 and x+2>0.', 'Highlight domain check step.'),
    ('90000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000004', 'self_reflection', 'Forgot product rule under time pressure.', '{"action_item":"write formula at top"}'::jsonb, FALSE, 'Write y'' = u''v + uv'' before substituting.', 'Remind peers to mark u and v first.'),
    ('90000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000003', 'initial_explain', 'Used 0.5 for probability.', '{"suggest":"state p and q"}'::jsonb, TRUE, 'Use p=0.6, q=0.4 with C(5,3).', 'Will rehearse binomial template aloud.'),
    ('90000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000006', 'initial_explain', 'Looked z=1.6 because rounded mean.', '{"tip":"compute z carefully"}'::jsonb, TRUE, 'z = 1.5 then lookup 0.0668.', 'Remind students to write z formula before table lookup.'),
    ('90000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'Substitution error: 3*64 - 8 = 190.', '{"hint":"re-evaluate arithmetic"}'::jsonb, TRUE, '3*64=192; 192-8=184.', 'Suggest double-checking arithmetic with calculator.'),
    ('90000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000006', 'self_reflection', 'Recalled tail probability from memory.', '{"note":"close to table value"}'::jsonb, FALSE, 'Computed z=1.5 and matched 0.0668.', 'Explain to peers how to interpolate if needed.'),
    ('90000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'Forgot quadratic has two roots.', '{"reminder":"check discriminant"}'::jsonb, TRUE, 'Equation factors to (x-1)(x-3)=0 giving x=1,3.', 'Tell peers to factor then list all roots.'),
    ('90000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000004', 'initial_explain', 'Treated ln term as constant.', '{"cue":"differentiate inside log"}'::jsonb, TRUE, 'd/dx ln(3x^2+1) = (6x)/(3x^2+1).', 'Highlight chain rule arrows.'),
    ('90000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'correction_explain', 'Thought limit equals 1.', '{"note":"scale by coefficient"}'::jsonb, TRUE, 'Use sin 2x ≈ 2x so ratio -> 2.', 'Will remind to pull out coefficient.'),
    ('90000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000003', 'initial_explain', 'Used p=1/3.', '{"fix":"1/6 for six"}'::jsonb, TRUE, 'Use binomial with p=1/6 giving 0.3955.', 'Show binomial template first.'),
    ('90000000-0000-0000-0000-00000000000d', '80000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000005', 'self_reflection', 'Forgot to rationalize.', '{"prompt":"multiply by sqrt3"}'::jsonb, FALSE, '2/√3 -> 2√3/3.', 'Tell classmates to check denominators.'),
    ('90000000-0000-0000-0000-00000000000e', '80000000-0000-0000-0000-000000000014', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000004', 'initial_explain', 'Integrated to 9/4.', '{"hint":"power rule bounds"}'::jsonb, TRUE, 'Integral of x^2 from 0 to 2 is 8/3.', 'Re-evaluate bounds after antiderivative.'),
    ('90000000-0000-0000-0000-00000000000f', '80000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'ad-bc mistaken as 2*3.', '{"cue":"compute 2*4 - 3*1"}'::jsonb, TRUE, 'Determinant is 5.', 'Show formula on 2x2 first.'),
    ('90000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'Set 2^(x+1)=8.', '{"reminder":"16 is 2^4"}'::jsonb, TRUE, 'x+1=4 so x=3.', 'Double-check power-of-two mapping.'),
    ('90000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000017', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000006', 'initial_explain', 'Took average of all five numbers.', '{"reminder":"median is middle value"}'::jsonb, TRUE, 'Order values and pick the middle to get 9.', 'Show peers to draw a quick dot plot.'),
    ('90000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000018', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000003', 'initial_explain', 'Added probabilities instead of inclusion-exclusion.', '{"cue":"subtract intersection"}'::jsonb, TRUE, 'P(A∪B)=0.7.', 'Remind to draw a Venn diagram.'),
    ('90000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'initial_explain', 'Assumed e^x linear.', '{"note":"take natural log"}'::jsonb, TRUE, 'Use ln to solve e^x=5 -> x=ln5.', 'Teach by isolating exponential first.'),
    ('90000000-0000-0000-0000-000000000014', '80000000-0000-0000-0000-00000000001a', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'Used y2-y1 only.', '{"hint":"divide by x2-x1"}'::jsonb, TRUE, 'Slope = 8/3.', 'Show formula m=(y2-y1)/(x2-x1).'),
    ('90000000-0000-0000-0000-000000000015', '80000000-0000-0000-0000-00000000001c', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'Kept exponents unchanged.', '{"prompt":"subtract powers when dividing"}'::jsonb, TRUE, 'x^3 y^2 / (x y) = x^2 y.', 'Walk peers through exponent laws.'),
    ('90000000-0000-0000-0000-000000000016', '80000000-0000-0000-0000-00000000001e', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'initial_explain', 'Guessed 12 for hypotenuse.', '{"cue":"30-60-90 ratio"}'::jsonb, TRUE, 'Hypotenuse is double the short leg: 10.', 'Sketch triangle with ratios 1:√3:2.'),
    ('90000000-0000-0000-0000-000000000017', '80000000-0000-0000-0000-000000000020', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-0000-0000-0000-000000000002', 'initial_explain', 'Solved 2x=3 giving x=1.5 but unsure why.', '{"note":"log base 5"}'::jsonb, FALSE, 'Rewrite 125 as 5^3 to get 2x=3.', 'Explain pattern of matching bases.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO error_book (id, user_id, question_id, concept_id, wrong_answer, correct_answer_snapshot, system_explanation, error_category, user_reflection_notes, first_wrong_time, last_review_time, next_review_time, review_count, is_mastered, error_pattern_tags)
VALUES
    ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Added magnitudes to get 5.', 'Vector sum magnitude is sqrt(13).', 'Add components then magnitude; cannot add magnitudes directly.', 'conceptual_misunderstanding', 'Need to visualize vectors.', NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days', NOW() + INTERVAL '1 day', 2, FALSE, '{"vector_addition","magnitude"}'),
    ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000004', 'Derived 6x e^x only.', 'Full derivative (3x^2 + 4x - 5)e^x + (6x + 4)e^x.', 'Product rule missing second term.', 'procedural_error', 'Write u and v first.', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', 2, FALSE, '{"product_rule","differentiation"}'),
    ('a0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'Used p=0.5 instead of 0.6.', '0.3456', 'Probability parameters misread.', 'misinterpretation', 'Highlight given probabilities.', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 3, FALSE, '{"reading_error"}'),
    ('a0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000005', 'Returned single angle solution.', 'x = π/12, 5π/12, 13π/12, 17π/12', 'Forgot periodic solutions.', 'memory_slip', 'List all quadrants explicitly.', NOW() - INTERVAL '12 days', NOW() - INTERVAL '6 days', NOW() + INTERVAL '3 days', 2, FALSE, '{"trig","periodicity"}'),
    ('a0000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000006', 'Used z=1.6 giving 0.0548.', 'Correct tail 0.0668.', 'Rounded mean incorrectly before z.', 'calculation_error', 'Compute z then read table.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"z_score","rounding"}'),
    ('a0000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000002', 'Got 190.', 'Correct 184.', 'Arithmetic slip in substitution.', 'calculation_error', 'Double-check final arithmetic.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"arithmetic","substitution"}'),
    ('a0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000002', 'Kept only one root.', 'x=1 or 3.', 'Quadratic with two solutions.', 'conceptual_misunderstanding', 'Always check for two roots.', NOW() - INTERVAL '9 days', NOW() - INTERVAL '4 days', NOW() + INTERVAL '2 days', 2, FALSE, '{"quadratic","roots"}'),
    ('a0000000-0000-0000-0000-000000000008', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000004', 'Forgot |x| in ln.', '2x + 5 ln|x| + C.', 'Log domain mishandled.', 'procedural_error', 'Remember absolute inside log.', NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"integration","log"}'),
    ('a0000000-0000-0000-0000-000000000009', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-000000000006', 'Averaged to 5.', 'Mean is 6.', 'Summation missed one term.', 'calculation_error', 'Count data points carefully.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"statistics","mean"}'),
    ('a0000000-0000-0000-0000-00000000000a', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-000000000004', 'Derivative 6x.', '6x/(3x^2+1).', 'Forgot denominator from chain rule.', 'procedural_error', 'Write u and u".', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 2, FALSE, '{"chain_rule"}'),
    ('a0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-00000000000f', 'aaaaaaaa-0000-0000-0000-000000000004', 'Limit 1.', 'Limit 2.', 'Scaled sine limit by coefficient.', 'conceptual_misunderstanding', 'Remember sin kx / x -> k.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '2 days', 1, FALSE, '{"limits","sine"}'),
    ('a0000000-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000003', 'Used p=1/3.', 'p=1/6, probability 0.3955.', 'Wrong binomial parameter.', 'misinterpretation', 'Check event probability carefully.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"binomial","parameter"}'),
    ('a0000000-0000-0000-0000-00000000000d', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000005', 'Left as 2/√3.', 'Rationalized 2√3/3.', 'Did not rationalize denominator.', 'procedural_error', 'Multiply by √3/√3.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"simplification"}'),
    ('a0000000-0000-0000-0000-00000000000e', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000004', 'Area 9/4.', 'Area 8/3.', 'Integrated bounds misapplied.', 'calculation_error', 'Plug bounds carefully.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"definite_integral"}'),
    ('a0000000-0000-0000-0000-00000000000f', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000002', 'Determinant 6.', 'Determinant 5.', 'Mixed formula.', 'calculation_error', 'Compute ad-bc.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '6 days', 1, FALSE, '{"determinant"}'),
    ('a0000000-0000-0000-0000-000000000010', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000002', 'Solved x=4.', 'x=3.', 'Mis-solved exponent equation.', 'calculation_error', 'Rewrite 16 as 2^4.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '2 days', 1, FALSE, '{"exponent"}'),
    ('a0000000-0000-0000-0000-000000000011', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000006', 'Used mean instead of median.', 'Median is 9.', 'Confused central tendency measures.', 'misinterpretation', 'Identify median position.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"median"}'),
    ('a0000000-0000-0000-0000-000000000012', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000003', 'Answered 0.9.', 'Correct is 0.7.', 'Ignored intersection in union formula.', 'misinterpretation', 'Draw Venn before computing.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"probability","union"}'),
    ('a0000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000004', 'x=5.', 'x=ln 5.', 'Forgot logarithm inversion.', 'conceptual_misunderstanding', 'Take ln both sides.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"logarithm"}'),
    ('a0000000-0000-0000-0000-000000000014', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000018', 'aaaaaaaa-0000-0000-0000-000000000002', 'Slope 2.', 'Slope 8/3.', 'Skipped denominator.', 'calculation_error', 'Use (y2-y1)/(x2-x1).', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"slope"}'),
    ('a0000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000019', 'aaaaaaaa-0000-0000-0000-000000000004', 'Integral 4x^3 -> 4x^4.', 'Integral simplifies to x^4 + C.', 'Forgot constant simplification.', 'procedural_error', 'Simplify coefficients.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"integration"}'),
    ('a0000000-0000-0000-0000-000000000016', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-00000000001a', 'aaaaaaaa-0000-0000-0000-000000000002', 'Left exponents unchanged.', 'x^2 y.', 'Forgot exponent division rule.', 'procedural_error', 'Subtract exponents when dividing.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '6 days', 1, FALSE, '{"exponent_rule"}'),
    ('a0000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-00000000001b', 'aaaaaaaa-0000-0000-0000-000000000002', 'Computed 20.', 'Correct 25.', 'Skipped composition order.', 'procedural_error', 'Evaluate inner then outer.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"function_composition"}'),
    ('a0000000-0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-00000000001c', 'aaaaaaaa-0000-0000-0000-000000000001', 'Hypotenuse 12.', 'Hypotenuse 10.', 'Misapplied triangle ratios.', 'conceptual_misunderstanding', 'Recall 1:√3:2 ratio.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"triangle_ratio"}'),
    ('a0000000-0000-0000-0000-000000000019', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-00000000001d', 'aaaaaaaa-0000-0000-0000-000000000006', 'Variance 7.', 'Variance 9.', 'Arithmetic error on squared deviations.', 'calculation_error', 'Recompute squares carefully.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"variance"}'),
    ('a0000000-0000-0000-0000-00000000001a', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-00000000001e', 'aaaaaaaa-0000-0000-0000-000000000002', 'Answered x=3.', 'x=1.5.', 'Forgot to divide exponent by 2.', 'procedural_error', 'Equate exponents after matching bases.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"exponent"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_attempts (id, activity_id, user_id, exam_question_id, chosen_option, is_correct, time_spent_seconds, attempt_time)
VALUES
    ('b0000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000002', NULL, FALSE, 95, NOW() - INTERVAL '6 days'),
    ('b0000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000003', 'A', FALSE, 70, NOW() - INTERVAL '5 days'),
    ('b0000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000003', 'B', TRUE, 64, NOW() - INTERVAL '4 days'),
    ('b0000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000007', 'C', FALSE, 52, NOW() - INTERVAL '3 days'),
    ('b0000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000006', NULL, FALSE, 81, NOW() - INTERVAL '3 days'),
    ('b0000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000002', NULL, FALSE, 60, NOW() - INTERVAL '2 days'),
    ('b0000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-00000000000a', 'B', FALSE, 41, NOW() - INTERVAL '2 days'),
    ('b0000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000005', 'D', TRUE, 110, NOW() - INTERVAL '1 days'),
    ('b0000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000009', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000009', NULL, FALSE, 75, NOW() - INTERVAL '1 days'),
    ('b0000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000006', NULL, TRUE, 48, NOW()),
    ('b0000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-00000000000d', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-00000000000b', 'A', TRUE, 33, NOW() - INTERVAL '2 days'),
    ('b0000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-00000000000c', NULL, TRUE, 58, NOW() - INTERVAL '1 days'),
    ('b0000000-0000-0000-0000-00000000000d', '80000000-0000-0000-0000-00000000000f', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-00000000000d', NULL, FALSE, 42, NOW() - INTERVAL '1 days'),
    ('b0000000-0000-0000-0000-00000000000e', '80000000-0000-0000-0000-000000000010', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-00000000000e', NULL, FALSE, 47, NOW()),
    ('b0000000-0000-0000-0000-00000000000f', '80000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-00000000000f', NULL, FALSE, 39, NOW()),
    ('b0000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000010', NULL, FALSE, 61, NOW()),
    ('b0000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000013', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000011', NULL, TRUE, 27, NOW()),
    ('b0000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000014', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000012', NULL, FALSE, 55, NOW()),
    ('b0000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000015', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000013', NULL, FALSE, 46, NOW()),
    ('b0000000-0000-0000-0000-000000000014', '80000000-0000-0000-0000-000000000016', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000014', NULL, FALSE, 44, NOW()),
    ('b0000000-0000-0000-0000-000000000015', '80000000-0000-0000-0000-000000000017', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000015', NULL, FALSE, 38, NOW()),
    ('b0000000-0000-0000-0000-000000000016', '80000000-0000-0000-0000-000000000018', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-000000000016', NULL, FALSE, 57, NOW()),
    ('b0000000-0000-0000-0000-000000000017', '80000000-0000-0000-0000-000000000019', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000017', NULL, TRUE, 29, NOW()),
    ('b0000000-0000-0000-0000-000000000018', '80000000-0000-0000-0000-00000000001a', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-000000000018', NULL, FALSE, 41, NOW()),
    ('b0000000-0000-0000-0000-000000000019', '80000000-0000-0000-0000-00000000001b', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-000000000019', NULL, TRUE, 36, NOW()),
    ('b0000000-0000-0000-0000-00000000001a', '80000000-0000-0000-0000-00000000001c', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-00000000001a', NULL, FALSE, 49, NOW()),
    ('b0000000-0000-0000-0000-00000000001b', '80000000-0000-0000-0000-00000000001d', '11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-00000000001b', NULL, TRUE, 33, NOW()),
    ('b0000000-0000-0000-0000-00000000001c', '80000000-0000-0000-0000-00000000001e', '22222222-2222-2222-2222-222222222222', '70000000-0000-0000-0000-00000000001c', NULL, FALSE, 54, NOW()),
    ('b0000000-0000-0000-0000-00000000001d', '80000000-0000-0000-0000-00000000001f', '33333333-3333-3333-3333-333333333333', '70000000-0000-0000-0000-00000000001d', NULL, FALSE, 46, NOW()),
    ('b0000000-0000-0000-0000-00000000001e', '80000000-0000-0000-0000-000000000020', '44444444-4444-4444-4444-444444444444', '70000000-0000-0000-0000-00000000001e', NULL, TRUE, 35, NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- FR 3.2 Flashcard Engine
-- =============================================================================
CREATE TABLE IF NOT EXISTS flashcard_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to flashcard
    flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
    
    -- Link to media
    media_id UUID REFERENCES extracted_media(id) ON DELETE CASCADE,
    
    -- [Important] Media position
    media_position VARCHAR(20) NOT NULL 
        CHECK (media_position IN ('front', 'back', 'hint', 'mnemonic')),
    
    -- [Important] Display order (multiple media items may exist at same position)
    display_order INTEGER DEFAULT 1,
    
    -- [Optional] Media caption text
    caption TEXT,
    
    -- [Optional] Display settings (e.g., image size, audio autoplay)
    display_settings JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure same media doesn't repeat in same position on same flashcard
    UNIQUE(flashcard_id, media_id, media_position)
);

-- Indexes
CREATE INDEX idx_flashcard_media_flashcard ON flashcard_media(flashcard_id);
CREATE INDEX idx_flashcard_media_media ON flashcard_media(media_id);
CREATE INDEX idx_flashcard_media_position ON flashcard_media(media_position);
CREATE INDEX idx_flashcard_media_order ON flashcard_media(flashcard_id, media_position, display_order);

-- Create review history table (if not already created)
CREATE TABLE IF NOT EXISTS flashcard_review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  
  -- [Key] Record which review mode was used
  review_mode VARCHAR(20) DEFAULT 'standard' CHECK (review_mode IN ('standard', 'mcq')),
  
  -- Rating result (MCQ mode correct answers typically auto-rated as 3 or 4)
  rating INTEGER CHECK (rating BETWEEN 1 AND 4), -- 1:Again, 2:Hard, 3:Good, 4:Easy
  
  -- Answer time (milliseconds), MCQ mode can use this to determine "Easy"
  duration_ms INTEGER, 
  
  -- Scheduling state at that time (for analyzing algorithm accuracy)
  scheduled_interval FLOAT, -- System's originally planned interval
  actual_interval FLOAT,    -- Actual elapsed interval
  
  review_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes to speed up queries
CREATE INDEX idx_review_history_user ON flashcard_review_history(user_id);
CREATE INDEX idx_review_history_card ON flashcard_review_history(flashcard_id);
CREATE INDEX idx_review_history_mode ON flashcard_review_history(review_mode);

-- =============================================================================
-- FR 3.5 Multisensory Encoding
-- =============================================================================
-- =============================================================================
-- FR 3.1 Spaced Repetition Scheduler
-- =============================================================================
CREATE TABLE IF NOT EXISTS flashcard_schedules (
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Support multiple algorithm switching
  algorithm VARCHAR(20) DEFAULT 'simple' CHECK (algorithm IN ('simple', 'sm2', 'fsrs')),
  state VARCHAR(20) DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  
  -- Scheduling core data
  due_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Next review time
  last_review_date TIMESTAMP,
  
  -- Algorithm parameter sharing explanation:
  -- 1. Simple Mode: Use 'reps' to represent current level, 'interval_days' stores fixed interval
  -- 2. SM-2: Uses 'reps', 'interval_days', 'ease_factor'
  -- 3. FSRS: Uses 'reps', 'interval_days', 'stability', 'difficulty'
  
  interval_days FLOAT DEFAULT 0,    -- Interval in days
  reps INTEGER DEFAULT 0,           -- Total review count (used as Level in Simple Mode)
  ease_factor FLOAT DEFAULT 2.5,    -- (SM-2 only) Ease factor
  stability FLOAT DEFAULT 0,        -- (FSRS only) Stability
  difficulty FLOAT DEFAULT 0,       -- (FSRS only) Difficulty
  
  -- [FR 3.3] Cache topic names to speed up interleaved practice queries
  topic_cached VARCHAR(100), 
  PRIMARY KEY (flashcard_id, user_id)
);

CREATE INDEX idx_schedule_due ON flashcard_schedules(user_id, due_date);
CREATE INDEX idx_schedule_algorithm ON flashcard_schedules(algorithm);
CREATE INDEX idx_schedule_user ON flashcard_schedules(user_id);

-- =============================================================================
-- FR 3.4 Mnemonic Generator
-- =============================================================================
CREATE TABLE IF NOT EXISTS flashcard_mnemonics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  
  mnemonic_type VARCHAR(50) CHECK (mnemonic_type IN ('abbreviation', 'acrostic', 'rhyme', 'storytelling', 'visual_association')),
  
  content TEXT NOT NULL,          -- e.g., "Dora: Discover, Offer..."
  ai_generated_reasoning TEXT,    -- AI explanation for why this mnemonic works

  is_user_selected BOOLEAN DEFAULT FALSE, -- User selected this mnemonic
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mnemonics_flashcard ON flashcard_mnemonics(flashcard_id);

-- =============================================================================
-- FR 3.6 AR Memory Palace
-- =============================================================================
-- Store user's real-world environment anchors (e.g., bedroom, classroom)
-- [FR 3.6] User AR Environment Anchors (AR Memory Palace - Environment)
CREATE TABLE IF NOT EXISTS user_ar_environments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100), 
  
  -- Unreal ARPin serialized data (SaveGame Object)
  -- Recommended to store as Base64 string or Binary
  ar_pin_data BYTEA, 
  
  -- Record which AR system this anchor is based on (ARKit/ARCore), as UE5 handles cross-platform slightly differently
  ar_system VARCHAR(20) DEFAULT 'ARKit' CHECK (ar_system IN ('ARKit', 'ARCore', 'OpenXR')),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 1. Shared Lookup Tables
-- =====================================================
-- Category table (Furniture, Seating...)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- label table (Gothic, Vintage...)      
CREATE TABLE IF NOT EXISTS label (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- =====================================================
-- 2. Assets Core Table
-- =====================================================
CREATE TABLE IF NOT EXISTS asset_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) NOT NULL, -- e.g. "ArmChair_01"
    name VARCHAR(255) NOT NULL,        -- e.g. "Arm Chair 01"
    source VARCHAR(50) DEFAULT 'polyhaven',
    asset_type VARCHAR(20) CHECK (asset_type IN ('model', 'hdri', 'texture')), -- 'model', 'hdri', 'texture'
    
    -- We still keep the original JSON as backup, just in case
    raw_api_data JSONB, 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, external_id)
);

-- =====================================================
-- 3. Junction Tables - Handle many-to-many relationships
-- =====================================================
CREATE TABLE IF NOT EXISTS asset_categories (
    asset_id UUID REFERENCES asset_library(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, category_id)
);

CREATE INDEX idx_asset_categories_cat_id ON asset_categories(category_id);
CREATE INDEX idx_asset_categories_asset_id ON asset_categories(asset_id);

CREATE TABLE IF NOT EXISTS asset_label (
    asset_id UUID REFERENCES asset_library(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES label(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag_id)
);

-- =====================================================
-- 4. File Downloads Detail Table - Most complex part
-- =====================================================
-- Here we flatten the JSON structure: files -> gltf -> 2k -> gltf -> url
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

-- Create indexes to support efficient queries
CREATE INDEX idx_downloads_asset ON asset_downloads(asset_id);
CREATE INDEX idx_downloads_filter ON asset_downloads(resolution, file_format);

-- =============================================================================
-- FR 3.7 VR Murder Mystery Game
-- =============================================================================
-- Game scenario definitions
CREATE TABLE IF NOT EXISTS vr_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(100) NOT NULL,
    description TEXT,  -- [新增]
    scene_asset_path VARCHAR(255),
    
    -- [New] Game design fields
    difficulty_level VARCHAR(20) CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_minutes INTEGER,
    required_concepts UUID[],
    
    -- [New] Management fields
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vr_scenarios_difficulty ON vr_scenarios(difficulty_level);
CREATE INDEX idx_vr_scenarios_active ON vr_scenarios(is_active);
CREATE INDEX idx_vr_scenarios_created_by ON vr_scenarios(created_by);

-- User game progress
CREATE TABLE IF NOT EXISTS user_vr_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scenario_id UUID REFERENCES vr_scenarios(id),
    
    game_state_data JSONB DEFAULT '{}'::jsonb,
    
    -- [New] Time tracking
    started_at TIMESTAMP,
    last_played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- [New] Progress tracking
    completion_percentage FLOAT DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    total_play_time_minutes INTEGER DEFAULT 0,
    
    UNIQUE(user_id, scenario_id)
);

CREATE INDEX idx_vr_progress_user ON user_vr_progress(user_id);
CREATE INDEX idx_vr_progress_scenario ON user_vr_progress(scenario_id);
CREATE INDEX idx_vr_progress_completion ON user_vr_progress(completion_percentage);

-- Learning triggers
CREATE TABLE IF NOT EXISTS vr_learning_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scenario_id UUID REFERENCES vr_scenarios(id),
    required_flashcard_id UUID REFERENCES flashcards(id),
    trigger_context VARCHAR(100),
    
    -- Actions (keep flexible, no CHECK constraints)
    on_success_action VARCHAR(100),
    on_failure_action VARCHAR(100),
    
    failure_feedback_message TEXT
);

CREATE INDEX idx_vr_triggers_scenario ON vr_learning_triggers(scenario_id);
CREATE INDEX idx_vr_triggers_flashcard ON vr_learning_triggers(required_flashcard_id);

-- =============================================================================
-- Sample Data for FR 3.1-3.7 (Flashcard System, AR/VR Features)
-- Excluding Asset Tables (categories, label, asset_library, asset_categories, asset_label, asset_downloads)
-- =============================================================================
-- Prerequisites: Run init_postgresql.sql and init_lcc_taxonomy.sql first
-- =============================================================================

-- =============================================================================
-- FR 3.2 Flashcard Engine - Sample Flashcards
-- =============================================================================

-- Standard flashcards for networking concepts
INSERT INTO flashcards (id, user_id, concept_id, taxonomy_node_id, front_content, back_content, card_type, tips, content_metadata, source_type, is_archived)
VALUES
    -- Demo student's flashcards (user_id from init_postgresql.sql)
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'), 
     'What is DHCP?', 
     'Dynamic Host Configuration Protocol - A network management protocol that automatically assigns IP addresses and other network configuration parameters to devices on a network.',
     'standard', 
     '["Think: How does your device get an IP address automatically?", "D = Dynamic, H = Host, C = Configuration, P = Protocol"]'::jsonb,
     '{}'::jsonb,
     'manual', 
     false),
    
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'),
     'Name the 7 layers of the OSI Model',
     'From bottom to top: 1) Physical, 2) Data Link, 3) Network, 4) Transport, 5) Session, 6) Presentation, 7) Application',
     'standard',
     '["Each layer has a specific function", "Use the mnemonic: Please Do Not Throw Sausage Pizza Away"]'::jsonb,
     '{}'::jsonb,
     'manual',
     false),
    
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
     'What does REST stand for in web development?',
     'Representational State Transfer - An architectural style for designing networked applications using stateless communication and standard HTTP methods.',
     'standard',
     '["Think about how modern web APIs work", "REST uses HTTP methods like GET, POST, PUT, DELETE"]'::jsonb,
     '{}'::jsonb,
     'note_generated',
     false),

    -- MCQ flashcards
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'),
     'Which HTTP method is used to CREATE a new resource?',
     'POST',
     'mcq',
     '["Think about CRUD operations", "C = Create, R = Read, U = Update, D = Delete"]'::jsonb,
     '{"options": ["GET", "POST", "PUT", "DELETE"], "correct_answer": "POST", "explanations": {"GET": "Used to retrieve/read data", "POST": "Correct! Used to create new resources", "PUT": "Used to update existing resources", "DELETE": "Used to remove resources"}}'::jsonb,
     'manual',
     false),
     
    ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'),
     'What is the default port for HTTPS?',
     '443',
     'mcq',
     '["HTTP uses port 80", "HTTPS adds security with TLS/SSL"]'::jsonb,
     '{"options": ["80", "8080", "443", "8443"], "correct_answer": "443", "explanations": {"80": "This is HTTP port", "8080": "This is an alternative HTTP port", "443": "Correct! Standard HTTPS port", "8443": "Alternative HTTPS port"}}'::jsonb,
     'csv_import',
     false),
     
    -- Teacher's flashcard
    ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
     'Explain polymorphism in Object-Oriented Programming',
     'Polymorphism is the ability of objects of different classes to be treated as objects of a common superclass. It allows objects to take many forms through method overriding and interfaces.',
     'standard',
     '["Poly = many, morph = forms", "Think: same method name, different behaviors", "Examples: Animal → Dog.bark(), Cat.meow()"]'::jsonb,
     '{}'::jsonb,
     'manual',
     false),

    -- More programming flashcards
    ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
     'What is Big O notation?',
     'Big O notation describes the upper bound of the time complexity of an algorithm, expressing how runtime grows relative to input size.',
     'standard',
     '["O(1) = constant, O(n) = linear, O(n²) = quadratic", "Helps compare algorithm efficiency"]'::jsonb,
     '{}'::jsonb,
     'manual',
     false),

    ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
     'What is a hash table?',
     'A data structure that maps keys to values using a hash function for fast lookup, insertion, and deletion (average O(1) time complexity).',
     'mcq',
     '["Think about dictionaries in Python or objects in JavaScript", "Key → Hash Function → Index → Value"]'::jsonb,
     '{"options": ["A sorted array", "A linked list with hashing", "A key-value mapping using hash functions", "A binary search tree"], "correct_answer": "A key-value mapping using hash functions"}'::jsonb,
     'mindmap_generated',
     false);

-- =============================================================================
-- FR 3.5 Multisensory Encoding - Sample Media
-- =============================================================================

-- Insert media files into extracted_media table
INSERT INTO extracted_media (
  id, source_id, media_type, storage_method, programming_language, language,
  file_url, checksum, pages, extraction_location, metadata
)
VALUES
  -- Images
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'image', 'external_url', NULL, 'en',
   'https://upload.wikimedia.org/wikipedia/commons/8/8d/OSI_Model_v1.svg', 
   'a1b2c3d4e5f6789abcdef0123456789a', 
   NULL, NULL,
   '{"caption": "OSI 7-Layer Model Diagram", "width": 1200, "height": 800, "source": "Wikipedia Commons"}'::jsonb),
     
  -- Code samples
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'code', 'local_path', 'python', 'en',
   '/media/code_samples/rest_api_example.py',
   'b2c3d4e5f6789abcdef0123456789ab2',
   NULL, NULL,
   '{"lines": 45, "framework": "FastAPI", "description": "Simple REST API example with CRUD operations"}'::jsonb),
     
  -- Videos
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 'video', 'external_url', NULL, 'en',
   'https://www.youtube.com/watch?v=e6-TyZ84fl0',
   'c3d4e5f6789abcdef0123456789ab2c3',
   NULL, NULL,
   '{"duration_seconds": 720, "title": "DHCP Explained - Dynamic Host Configuration Protocol", "platform": "YouTube"}'::jsonb),
     
  -- Diagrams
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', NULL, 'diagram', 'local_path', NULL, 'en',
   '/media/diagrams/http_methods_crud.svg',
   'd4e5f6789abcdef0123456789ab2c3d4',
   NULL, NULL,
   '{"format": "svg", "interactive": false, "shows": "HTTP methods mapped to CRUD operations"}'::jsonb),
     
  -- Website references
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL, 'website', 'external_url', NULL, 'en',
   'https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods',
   'e5f6789abcdef0123456789ab2c3d4e5',
   NULL, NULL,
   '{"site": "MDN Web Docs", "topic": "HTTP Request Methods", "updated": "2025-12-15"}'::jsonb),

  -- Audio explanation
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', NULL, 'audio', 'local_path', NULL, 'en',
   '/media/audio/osi_model_explained.mp3',
   'f6789abcdef0123456789ab2c3d4e5f6',
   NULL, NULL,
   '{"duration_seconds": 480, "format": "mp3", "narrator": "AI voice", "speed": "1x"}'::jsonb),

  -- Code snippet for hash tables
  ('99999999-9999-9999-9999-999999999999', NULL, 'code', 'local_path', 'python', 'en',
   '/media/code_samples/hash_table_implementation.py',
   '9876543210abcdef0123456789abcdef',
   NULL, NULL,
   '{"lines": 68, "description": "Simple hash table implementation with collision handling"}'::jsonb),

  -- Additional media for DHCP flashcard
  ('aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'diagram', 'external_url', NULL, 'en',
   'https://example.com/diagrams/dhcp_process.png',
   'a1b2c3d4e5f6789abcdef0123456789b',
   NULL, NULL,
   '{"title": "DHCP Process Flow", "shows": "4-step DHCP process: Discover, Offer, Request, Acknowledge"}'::jsonb),

  -- Image for REST flashcard
  ('bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'image', 'external_url', NULL, 'en',
   'https://example.com/images/rest_architecture.png',
   'b2c3d4e5f6789abcdef0123456789bc',
   NULL, NULL,
   '{"title": "REST Architecture", "description": "Visual representation of RESTful API design principles"}'::jsonb),

  -- Video for polymorphism
  ('cccccccd-cccc-cccc-cccc-cccccccccccc', NULL, 'video', 'external_url', NULL, 'en',
   'https://www.youtube.com/watch?v=example-polymorphism',
   'c3d4e5f6789abcdef0123456789ab2cd',
   NULL, NULL,
   '{"duration_seconds": 600, "title": "Understanding Polymorphism in OOP", "platform": "YouTube"}'::jsonb),

  -- Code example for Big O
  ('99999998-9999-9999-9999-999999999999', NULL, 'code', 'local_path', 'python', 'en',
   '/media/code_samples/big_o_examples.py',
   '9876543210abcdef0123456789abcdee',
   NULL, NULL,
   '{"lines": 120, "description": "Code examples demonstrating different time complexities: O(1), O(n), O(log n), O(n²)"}'::jsonb);

-- Link media to flashcards via flashcard_media junction table
INSERT INTO flashcard_media (
  id, flashcard_id, media_id, media_position, display_order, caption, display_settings
)
VALUES
  -- DHCP flashcard (11111111...) - has video hint and diagram
  ('fa000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 
   'cccccccc-cccc-cccc-cccc-cccccccccccc', 'hint', 1,
   'Watch this 12-minute explanation if you need more detail',
   '{"autoplay": false, "controls": true, "start_time": 0}'::jsonb),

  ('fa000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'back', 1,
   'DHCP 4-step process visualization',
   '{"width": "90%", "align": "center"}'::jsonb),

  -- OSI Model flashcard (22222222...) - has image on back and audio hint
  ('fa000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'back', 1,
   'Visual representation of the 7 layers',
   '{"width": "100%", "align": "center", "show_border": true}'::jsonb),

  ('fa000004-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'ffffffff-ffff-ffff-ffff-ffffffffffff', 'hint', 1,
   'Listen to detailed explanation',
   '{"autoplay": false, "controls": true, "playback_rate": 1.0}'::jsonb),

  -- REST flashcard (33333333...) - has code example and image
  ('fa000005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'back', 1,
   'Example FastAPI implementation showing RESTful design',
   '{"syntax_highlight": true, "theme": "monokai", "show_line_numbers": true}'::jsonb),

  ('fa000006-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333',
   'bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'back', 2,
   'REST architecture principles',
   '{"width": "80%", "align": "center"}'::jsonb),

  -- HTTP Methods MCQ (44444444...) - has diagram on front and website reference
  ('fa000007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444',
   'dddddddd-dddd-dddd-dddd-dddddddddddd', 'front', 1,
   'HTTP Methods → CRUD Operations mapping',
   '{"scale": 0.8, "position": "above_question"}'::jsonb),

  ('fa000008-0000-0000-0000-000000000008', '44444444-4444-4444-4444-444444444444',
   'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'hint', 1,
   'Official documentation for deeper understanding',
   '{"open_in_new_tab": true, "show_preview": false}'::jsonb),

  -- Polymorphism flashcard (66666666...) - has video hint
  ('fa000009-0000-0000-0000-000000000009', '66666666-6666-6666-6666-666666666666',
   'cccccccd-cccc-cccc-cccc-cccccccccccc', 'hint', 1,
   'Video explanation of polymorphism concepts',
   '{"autoplay": false, "controls": true}'::jsonb),

  -- Big O notation flashcard (77777777...) - has code examples
  ('fa000010-0000-0000-0000-000000000010', '77777777-7777-7777-7777-777777777777',
   '99999998-9999-9999-9999-999999999999', 'back', 1,
   'Code examples showing different time complexities',
   '{"syntax_highlight": true, "theme": "dracula", "show_line_numbers": true}'::jsonb),

  -- Hash table flashcard (88888888...) - has implementation code
  ('fa000011-0000-0000-0000-000000000011', '88888888-8888-8888-8888-888888888888',
   '99999999-9999-9999-9999-999999999999', 'back', 1,
   'Python implementation demonstrating hash table concepts',
   '{"syntax_highlight": true, "theme": "monokai", "show_line_numbers": true, "highlight_lines": [15, 28, 42]}'::jsonb);

-- =============================================================================
-- FR 3.2 Review History
-- =============================================================================

INSERT INTO flashcard_review_history (id, user_id, flashcard_id, review_mode, rating, duration_ms, scheduled_interval, actual_interval, review_at)
VALUES
    -- Demo student's review sessions
    ('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'standard', 3, 8500, 1.0, 1.2, '2026-01-09 10:30:00'),
     
    ('c1111112-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     'standard', 4, 5200, 2.5, 2.8, '2026-01-11 14:15:00'),
     
    ('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
     'standard', 2, 15000, 1.0, 1.0, '2026-01-08 09:00:00'),

    ('c2222223-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
     'standard', 3, 11200, 1.0, 1.5, '2026-01-10 15:30:00'),
     
    ('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
     'standard', 4, 4800, 1.0, 1.0, '2026-01-10 11:20:00'),
     
    -- MCQ reviews (typically faster)
    ('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444',
     'mcq', 4, 3200, 1.0, 1.1, '2026-01-10 16:20:00'),
     
    ('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555',
     'mcq', 3, 6800, 1.0, 1.0, '2026-01-10 16:25:00'),

    ('c5555556-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555',
     'mcq', 4, 4200, 2.0, 2.1, '2026-01-11 10:15:00'),
     
    -- Teacher's flashcard review
    ('c6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666',
     'standard', 3, 12000, 1.0, 1.5, '2026-01-09 11:00:00'),

    -- Big O notation reviews
    ('c7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
     'standard', 2, 18500, 1.0, 1.0, '2026-01-08 14:00:00'),

    ('c7777778-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
     'standard', 3, 13200, 1.0, 2.0, '2026-01-10 16:45:00'),

    -- Hash table MCQ
    ('c8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888',
     'mcq', 4, 5100, 1.0, 1.0, '2026-01-11 09:30:00');

-- =============================================================================
-- FR 3.1 Spaced Repetition Scheduler
-- =============================================================================

INSERT INTO flashcard_schedules (flashcard_id, user_id, algorithm, state, due_date, last_review_date, interval_days, reps, ease_factor, stability, difficulty, topic_cached)
VALUES
    -- DHCP card - reviewed twice, using SM-2
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 
     'sm2', 'review', '2026-01-15 10:00:00', '2026-01-11 14:15:00', 4.0, 2, 2.6, 0, 0, 'Networking'),
     
    -- OSI Model - struggling (relearning state)
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001',
     'sm2', 'learning', '2026-01-12 09:00:00', '2026-01-10 15:30:00', 1.5, 2, 2.4, 0, 0, 'Networking'),
     
    -- REST API - new card just reviewed once
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001',
     'simple', 'learning', '2026-01-12 11:00:00', '2026-01-10 11:20:00', 1.0, 1, 2.5, 0, 0, 'Web Development'),
     
    -- HTTP Methods MCQ - using FSRS algorithm
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001',
     'fsrs', 'review', '2026-01-14 16:00:00', '2026-01-10 16:20:00', 3.2, 1, 2.5, 15.5, 0.45, 'Web Development'),
     
    -- HTTPS Port MCQ - mastered with FSRS
    ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001',
     'fsrs', 'review', '2026-01-16 10:00:00', '2026-01-11 10:15:00', 4.5, 2, 2.5, 18.3, 0.38, 'Networking'),
     
    -- Teacher's polymorphism card
    ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001',
     'sm2', 'learning', '2026-01-12 11:00:00', '2026-01-09 11:00:00', 1.5, 1, 2.5, 0, 0, 'Programming'),

    -- Big O notation - relearning
    ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001',
     'sm2', 'relearning', '2026-01-13 16:00:00', '2026-01-10 16:45:00', 2.0, 2, 2.3, 0, 0, 'Computer Science'),

    -- Hash table - doing well
    ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000001',
     'fsrs', 'review', '2026-01-14 09:00:00', '2026-01-11 09:30:00', 2.8, 1, 2.5, 12.7, 0.48, 'Data Structures');

-- =============================================================================
-- FR 3.4 Mnemonic Generator
-- =============================================================================

INSERT INTO flashcard_mnemonics (id, flashcard_id, mnemonic_type, content, ai_generated_reasoning, is_user_selected)
VALUES
    -- DHCP mnemonics
    ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
     'abbreviation', 
     'DHCP = Dude, Here''s a Computer Protocol (that hands out IP addresses automatically!)',
     'This playful abbreviation creates a memorable association between what DHCP does (provides addresses) and its name, making it stick in memory through humor and relevance.',
     true),

    ('f1111112-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
     'visual_association',
     'Imagine a friendly robot librarian automatically giving out numbered library cards (IP addresses) to everyone who walks in.',
     'Visual metaphors leverage our strong spatial and visual memory. The librarian robot represents the DHCP server, and library cards represent IP addresses.',
     false),
     
    -- OSI Model mnemonics
    ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
     'acrostic',
     'Please Do Not Throw Sausage Pizza Away - Physical, Data Link, Network, Transport, Session, Presentation, Application',
     'This classic mnemonic uses a memorable, slightly absurd phrase where each word''s first letter corresponds to an OSI layer in order. The unusual imagery makes it stick.',
     true),
     
    ('f2222223-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
     'visual_association',
     'Imagine a 7-layer cake: the plate is Physical, each layer adds functionality, and the Application frosting is what users see and taste.',
     'The layer cake metaphor maps perfectly to the OSI model''s layered architecture, making the abstract concept concrete and memorable.',
     false),

    ('f2222224-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
     'storytelling',
     'A package travels from your computer (Physical layer - the road) through your router (Network layer - the GPS), gets sorted by protocol (Transport), establishes a conversation (Session), translates the language (Presentation), and finally delivers the message to the app (Application).',
     'Stories create narrative structure that our brains remember better than isolated facts. Following a data packet''s journey makes each layer''s role clear.',
     false),
     
    -- REST API mnemonic
    ('f3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
     'abbreviation',
     'REST = Really Easy State Transfer (using HTTP to move data around)',
     'Simplifying the acronym makes it less intimidating and emphasizes the key concept of stateless communication.',
     true),
     
    -- HTTP Methods mnemonic
    ('f4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
     'storytelling',
     'POST is like POSTing a letter - you''re creating and sending something new to the mail system. The post office (server) receives and stores your letter (new resource).',
     'Connecting HTTP POST to the familiar act of posting mail creates a strong associative link through shared terminology.',
     true),

    ('f4444445-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
     'abbreviation',
     'HTTP CRUD: Create=POST, Read=GET, Update=PUT, Delete=DELETE',
     'Mapping HTTP methods to CRUD operations provides a clear framework that programmers already understand.',
     false),
     
    -- HTTPS Port mnemonic
    ('f5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555',
     'rhyme',
     'HTTPS secure, port four-four-three, keeps your data safe as can be!',
     'Rhymes activate different memory pathways and are notoriously difficult to forget once learned. The rhythm makes recall automatic.',
     true),

    ('f5555556-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555',
     'visual_association',
     'HTTP is 80 (8 letters), add S for Secure and you get 443 (looks like 4 = for, 4 = for, 3 = secure/S/3rd letter)',
     'Creating mathematical or visual patterns between related concepts (80 vs 443) helps cement the relationship.',
     false),
     
    -- Polymorphism mnemonic
    ('f6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666',
     'abbreviation',
     'Polymorphism = Poly (many) + Morph (forms) = Many Forms, One Interface',
     'Breaking down Greek/Latin roots helps understand the concept intuitively. If you know what the word parts mean, you understand the concept.',
     true),

    ('f6666667-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666',
     'visual_association',
     'Think of a shape-shifter in movies - same character (interface), many forms (dog, cat, human). Same method name, different implementations.',
     'Pop culture references (shape-shifters, transformers) leverage existing strong memories to encode new information.',
     false),

    -- Big O notation mnemonic
    ('f7777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777',
     'visual_association',
     'O(1) = elevator direct to floor, O(n) = climbing stairs one by one, O(n²) = checking every room on every floor',
     'Real-world scenarios make abstract concepts concrete. Building navigation maps directly to algorithm efficiency.',
     true),

    ('f7777778-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777',
     'abbreviation',
     'Big O = Order of growth - how much slower as input gets Bigger',
     'Emphasizing the "Big" and "Order" connects to what we''re actually measuring.',
     false),

    -- Hash table mnemonic
    ('f8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888',
     'visual_association',
     'Imagine a library with books organized by a special code - you calculate the code from the book title (hash function) and go straight to that shelf (index).',
     'Libraries are familiar organizational systems. The hash function is like the Dewey Decimal System - turns names into locations.',
     true),

    ('f8888889-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888',
     'storytelling',
     'Hash tables are like a magical filing cabinet: whisper a name, the cabinet calculates which drawer, and the drawer pops open instantly with your file.',
     'Magic/fantasy elements make technical concepts feel more accessible and memorable through wonder rather than intimidation.',
     false);

-- =============================================================================
-- FR 3.6 AR Memory Palace
-- =============================================================================

INSERT INTO user_ar_environments (id, user_id, name, ar_pin_data, ar_system, created_at)
VALUES
    -- Demo student's AR environments
    ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
     'My Bedroom Study Desk',
     decode('QVJQaW5TdHVkeURlc2tFbnYwMDAxMjM0NTY3ODkwYWJjZGVm', 'base64'),
     'ARKit',
     '2026-01-05 08:30:00'),
     
    ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001',
     'Living Room Coffee Table',
     decode('QVJQaW5MaXZpbmdSb29tRW52OTg3NjU0MzIxMGZlZGNiYQ==', 'base64'),
     'ARCore',
     '2026-01-06 15:20:00'),
     
    ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001',
     'Kitchen Counter',
     decode('QVJQaW5LaXRjaGVuQ291bnRlcjExMjIzMzQ0NTU2Njc3ODg=', 'base64'),
     'ARKit',
     '2026-01-07 18:45:00'),

    ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001',
     'Office Workspace',
     decode('QVJQaW5PZmZpY2VXb3Jrc3BhY2U2Njc3ODg5OTAwMTEyMjMz', 'base64'),
     'OpenXR',
     '2026-01-08 09:15:00'),
     
    -- Teacher's AR environment
    ('e5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001',
     'Classroom Whiteboard Area',
     decode('QVJQaW5DbGFzc3Jvb21Cb2FyZDQ0NTU2Njc3ODg5OTAwMTE=', 'base64'),
     'ARCore',
     '2026-01-04 10:00:00');

-- =============================================================================
-- FR 3.7 VR Murder Mystery Game - Scenarios
-- =============================================================================

INSERT INTO vr_scenarios (id, title, description, scene_asset_path, difficulty_level, estimated_duration_minutes, required_concepts, is_active, created_by, created_at)
VALUES
    -- Beginner scenario - Networking focus
    ('a1111111-1111-1111-1111-111111111111',
     'The Network Administrator Mystery',
     'A network administrator was found unconscious in the server room. The network logs show unusual activity. Use your knowledge of networking protocols (DHCP, OSI Model, ports) to uncover what happened and who sabotaged the system.',
     '/Game/VR/Scenes/ServerRoom_Mystery.umap',
     'beginner',
     30,
     NULL, -- Could link to concept IDs if they exist
     true,
     '00000000-0000-0000-0000-000000000001',
     '2026-01-01 10:00:00'),
     
    -- Intermediate scenario - Web Development focus
    ('a2222222-2222-2222-2222-222222222222',
     'The API Developer Conspiracy',
     'A REST API developer discovered a critical security flaw and disappeared. Navigate through the tech office, examine API logs, and use your understanding of HTTP methods and web protocols to uncover the conspiracy.',
     '/Game/VR/Scenes/TechOffice_Mystery.umap',
     'intermediate',
     45,
     NULL,
     true,
     '00000000-0000-0000-0000-000000000001',
     '2026-01-02 14:00:00'),
     
    -- Advanced scenario - Computer Science fundamentals
    ('a3333333-3333-3333-3333-333333333333',
     'The Algorithm Apocalypse',
     'In a futuristic programming lab, an AI has gone rogue. Debug the system by applying your knowledge of Big O notation, data structures, and algorithms. Every wrong answer makes the situation worse!',
     '/Game/VR/Scenes/FutureLab_Mystery.umap',
     'advanced',
     60,
     NULL,
     true,
     '00000000-0000-0000-0000-000000000001',
     '2026-01-03 09:00:00'),

    -- Beginner scenario - Programming basics
    ('a4444444-4444-4444-4444-444444444444',
     'The Object-Oriented Crime',
     'A software company''s codebase has been corrupted. Objects are behaving strangely. Use your OOP knowledge (polymorphism, inheritance) to restore order and identify the insider threat.',
     '/Game/VR/Scenes/SoftwareCompany_Mystery.umap',
     'beginner',
     35,
     NULL,
     true,
     '00000000-0000-0000-0000-000000000001',
     '2026-01-05 11:30:00');

-- =============================================================================
-- User VR Progress
-- =============================================================================

INSERT INTO user_vr_progress (id, user_id, scenario_id, game_state_data, started_at, last_played_at, completed_at, completion_percentage, total_play_time_minutes)
VALUES
    -- Demo student completed first scenario
    ('b1111111-1111-1111-1111-111111111111', 
     '00000000-0000-0000-0000-000000000001', 
     'a1111111-1111-1111-1111-111111111111',
     '{"current_room": "server_room", "clues_found": ["dhcp_log", "router_config", "port_scan_results", "admin_notes"], "npcs_alive": ["tech_support", "janitor", "security_guard"], "npcs_questioned": ["tech_support", "janitor"], "inventory": ["access_card", "network_diagram"], "mystery_solved": true, "culprit_identified": "janitor"}'::jsonb,
     '2026-01-08 14:00:00',
     '2026-01-08 14:35:00',
     '2026-01-08 14:35:00',
     100.0,
     35),
     
    -- Demo student in progress on second scenario
    ('b2222222-2222-2222-2222-222222222222',
     '00000000-0000-0000-0000-000000000001',
     'a2222222-2222-2222-2222-222222222222',
     '{"current_room": "developer_office", "clues_found": ["api_documentation", "git_commit_logs", "authentication_bypass"], "npcs_alive": ["cto", "security_guard", "hr_manager"], "npcs_questioned": ["security_guard", "hr_manager"], "inventory": ["laptop", "usb_drive"], "mystery_solved": false, "questions_answered_correctly": 5, "questions_answered_incorrectly": 1}'::jsonb,
     '2026-01-09 16:00:00',
     '2026-01-11 11:45:00',
     NULL,
     60.0,
     45),
     
    -- Demo student started third scenario
    ('b3333333-3333-3333-3333-333333333333',
     '00000000-0000-0000-0000-000000000001',
     'a3333333-3333-3333-3333-333333333333',
     '{"current_room": "main_lab", "clues_found": ["algorithm_logs", "complexity_analysis"], "npcs_alive": ["ai_assistant", "lead_researcher", "security_team"], "npcs_questioned": ["ai_assistant"], "inventory": ["security_badge", "debug_tools"], "mystery_solved": false, "ai_threat_level": 5, "algorithms_debugged": 2}'::jsonb,
     '2026-01-10 09:00:00',
     '2026-01-11 10:15:00',
     NULL,
     42.0,
     38),

    -- Demo student completed OOP scenario
    ('b4444444-4444-4444-4444-444444444444',
     '00000000-0000-0000-0000-000000000001',
     'a4444444-4444-4444-4444-444444444444',
     '{"current_room": "ceo_office", "clues_found": ["code_review", "class_diagrams", "inheritance_tree", "bug_reports", "backup_logs"], "npcs_alive": ["ceo", "lead_developer"], "npcs_questioned": ["ceo", "lead_developer", "system_admin"], "inventory": ["master_key", "source_code", "audit_report"], "mystery_solved": true, "corruption_source_found": true, "saboteur_identified": "lead_developer"}'::jsonb,
     '2026-01-09 13:00:00',
     '2026-01-09 13:52:00',
     '2026-01-09 13:52:00',
     100.0,
     52);

-- =============================================================================
-- VR Learning Triggers
-- =============================================================================

INSERT INTO vr_learning_triggers (id, scenario_id, required_flashcard_id, trigger_context, on_success_action, on_failure_action, failure_feedback_message)
VALUES
    -- Scenario 1: Network Administrator Mystery
    ('d1111111-1111-1111-1111-111111111111',
     'a1111111-1111-1111-1111-111111111111',
     '11111111-1111-1111-1111-111111111111', -- DHCP card
     'examine_dhcp_logs',
     'unlock_clue_network_configuration',
     'trigger_network_lockdown',
     '❌ You failed to explain DHCP correctly. The network system initiated an emergency lockdown, preventing you from accessing critical evidence!'),
     
    ('d1111112-1111-1111-1111-111111111111',
     'a1111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222', -- OSI Model card
     'analyze_network_packet',
     'unlock_clue_packet_analysis',
     'misinterpret_network_data',
     '❌ Without understanding the OSI Model layers, you misinterpreted the network traffic data. A crucial piece of evidence was overlooked!'),

    ('d1111113-1111-1111-1111-111111111111',
     'a1111111-1111-1111-1111-111111111111',
     '55555555-5555-5555-5555-555555555555', -- HTTPS port card
     'configure_secure_connection',
     'access_encrypted_files',
     'connection_blocked',
     '❌ Incorrect port configuration! The encrypted files remain inaccessible. The culprit''s digital trail goes cold.'),
     
    -- Scenario 2: API Developer Conspiracy
    ('d2222221-2222-2222-2222-222222222222',
     'a2222222-2222-2222-2222-222222222222',
     '33333333-3333-3333-3333-333333333333', -- REST API card
     'review_api_architecture',
     'discover_security_flaw',
     'miss_vulnerability',
     '❌ Your lack of REST principles knowledge prevented you from identifying the API vulnerability. The security flaw remains hidden!'),
     
    ('d2222222-2222-2222-2222-222222222222',
     'a2222222-2222-2222-2222-222222222222',
     '44444444-4444-4444-4444-444444444444', -- HTTP Methods card
     'examine_api_endpoints',
     'unlock_endpoint_evidence',
     'corrupt_api_logs',
     '❌ Incorrect HTTP method knowledge caused you to send the wrong request type, corrupting the API access logs. Evidence destroyed!'),

    ('d2222223-2222-2222-2222-222222222222',
     'a2222222-2222-2222-2222-222222222222',
     '55555555-5555-5555-5555-555555555555', -- HTTPS port card
     'intercept_secure_transmission',
     'decrypt_communication',
     'lose_encrypted_clue',
     '❌ Failed to intercept the HTTPS transmission on the correct port. The encrypted communication containing vital clues was lost!'),
     
    -- Scenario 3: Algorithm Apocalypse
    ('d3333331-3333-3333-3333-333333333333',
     'a3333333-3333-3333-3333-333333333333',
     '77777777-7777-7777-7777-777777777777', -- Big O notation card
     'optimize_critical_algorithm',
     'stabilize_ai_system',
     'system_performance_degrades',
     '❌ Without understanding Big O complexity, you chose an inefficient algorithm. System performance degraded by 60%! The AI grows more unstable.'),

    ('d3333332-3333-3333-3333-333333333333',
     'a3333333-3333-3333-3333-333333333333',
     '88888888-8888-8888-8888-888888888888', -- Hash table card
     'repair_lookup_system',
     'restore_database_access',
     'data_retrieval_fails',
     '❌ Failed to implement proper hash table logic. The database lookup system remains broken, blocking access to critical shutdown codes!'),

    ('d3333333-3333-3333-3333-333333333333',
     'a3333333-3333-3333-3333-333333333333',
     '66666666-6666-6666-6666-666666666666', -- Polymorphism card
     'debug_object_behavior',
     'fix_polymorphic_bug',
     'objects_malfunction',
     '❌ Misunderstanding polymorphism caused you to incorrectly override methods. Objects throughout the system now behave unpredictably!'),

    -- Scenario 4: Object-Oriented Crime
    ('d4444441-4444-4444-4444-444444444444',
     'a4444444-4444-4444-4444-444444444444',
     '66666666-6666-6666-6666-666666666666', -- Polymorphism card
     'restore_object_inheritance',
     'fix_codebase_corruption',
     'inheritance_chain_breaks',
     '❌ Your misunderstanding of polymorphism caused the inheritance chain to break further. Multiple systems failed!'),

    ('d4444442-4444-4444-4444-444444444444',
     'a4444444-4444-4444-4444-444444444444',
     '77777777-7777-7777-7777-777777777777', -- Big O notation card  
     'analyze_code_performance',
     'identify_performance_sabotage',
     'overlook_inefficiency',
     '❌ Without Big O knowledge, you failed to spot the deliberately inefficient code. The saboteur''s tracks remain hidden!');

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- ✅ Flashcards: 8 (6 standard, 2 MCQ) covering networking, web dev, CS fundamentals
-- ✅ Extracted Media: 7 (images, code, videos, diagrams, websites, audio)
-- ✅ Flashcard Media Links: 7 connecting media to flashcards
-- ✅ Review History: 12 records showing realistic study patterns
-- ✅ Schedules: 8 records using different algorithms (simple, SM-2, FSRS)
-- ✅ Mnemonics: 15 mnemonics across all 5 types
-- ✅ AR Environments: 5 environments (4 for demo student, 1 for teacher)
-- ✅ VR Scenarios: 4 scenarios (beginner to advanced)
-- ✅ User VR Progress: 4 progress records (2 completed, 2 in-progress)
-- ✅ VR Learning Triggers: 12 triggers connecting flashcards to game events
-- =============================================================================

-- =============================================================================
-- ENCRYPTION NOTES
-- =============================================================================
-- In-transit: TLS/SSL (HTTPS, WSS)
-- At-rest: Backend-level encryption
--
-- Architecture:
--   Client → TLS → Backend (encrypt/decrypt here) → PostgreSQL (stores encrypted)
--
-- What gets encrypted (in backend before INSERT):
--   - chat_messages.content
--   - direct_chats messages
--
-- What stays plain (for querying):
--   - Message metadata (timestamps, user_id, room_id)
--   - Message type, reactions

-- =============================================================================
-- MODULE 1: LOADING & STRUCTURING DATA
-- =============================================================================
--
-- NOTE: Hierarchical structure is handled by existing tables:
--   - taxonomy_nodes (LCC-based hierarchy)
--   - concept_relationships (graph relationships)
--   - Neo4j for graph traversal
--
-- NOTE: Raw document chunks are NOT stored permanently.
-- Following the below design pattern:
--   1. Documents uploaded → sources table (init_postgresql.sql)
--   2. Chunking happens in memory during processing
--   3. LLM extracts concepts with inline citations [src:uuid:page]
--   4. Concepts stored with source linkage (concept_sources table)
--   5. Original files preserved for verification
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTEND SOURCES TABLE
-- -----------------------------------------------------------------------------

ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_status VARCHAR(30)
  DEFAULT 'pending' CHECK (processing_status IN (
    'pending', 'processing', 'extracting', 'completed', 'failed'
  ));
ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS concepts_extracted INTEGER DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS relationships_extracted INTEGER DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sources_processing_status ON sources(processing_status);
CREATE INDEX IF NOT EXISTS idx_sources_ai_summary_trgm ON sources USING GIN(ai_summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sources_deleted_at ON sources(deleted_at) WHERE deleted_at IS NOT NULL;

ALTER TABLE concepts ADD COLUMN IF NOT EXISTS qdrant_synced_at TIMESTAMP; 
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50); 

CREATE INDEX IF NOT EXISTS idx_concepts_qdrant_sync ON concepts(qdrant_synced_at) WHERE qdrant_synced_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_concepts_needs_sync ON concepts(id) WHERE qdrant_synced_at IS NULL;

ALTER TABLE concept_relationships ADD COLUMN IF NOT EXISTS neo4j_synced_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_concept_rel_neo4j_sync ON concept_relationships(neo4j_synced_at) WHERE neo4j_synced_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_concept_rel_needs_sync ON concept_relationships(id) WHERE neo4j_synced_at IS NULL;

ALTER TABLE extracted_media ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE extracted_media ADD COLUMN IF NOT EXISTS subject_hints TEXT[];

CREATE INDEX IF NOT EXISTS idx_extracted_media_subject_hints ON extracted_media USING GIN(subject_hints);

-- -----------------------------------------------------------------------------
-- EXTEND USER_PROFILES
-- -----------------------------------------------------------------------------

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS study_preferences JSONB DEFAULT '{}'::jsonb;
-- Example structure:
-- {
--   "spaced_repetition_algorithm": "sm2",     -- Module 3: SM-2, Leitner, etc.
--   "daily_study_goal_minutes": 30,           -- Module 5, 7: Progress tracking
--   "preferred_study_times": ["morning"],     -- Module 7: Planning
--   "notification_frequency": "daily",        -- Module 5: Reminders
--   "difficulty_preference": "adaptive",      -- Module 4: Assessment
--   "language": "en"                          -- All modules
-- }

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS learning_style JSONB DEFAULT '{}'::jsonb;
-- Example structure:
-- {
--   "visual": 0.7,      -- Preference for diagrams, videos
--   "auditory": 0.3,    -- Preference for audio, discussions
--   "reading": 0.8,     -- Preference for text
--   "kinesthetic": 0.5  -- Preference for interactive, hands-on
-- }

-- -----------------------------------------------------------------------------
-- TAGS & CLASSIFICATION SYSTEM
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_url_id ON tags(url_id);
CREATE INDEX idx_tags_system ON tags(is_system);
CREATE INDEX idx_tags_usage ON tags(usage_count DESC);
CREATE INDEX idx_tags_name_trgm ON tags USING GIN(name gin_trgm_ops);

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

CREATE INDEX idx_tag_apps_tag ON tag_applications(tag_id);
CREATE INDEX idx_tag_apps_entity ON tag_applications(entity_type, entity_id);
CREATE INDEX idx_tag_apps_applied_by ON tag_applications(applied_by);

-- -----------------------------------------------------------------------------
-- SAVED DIAGRAMS (user-edited snapshots of generated diagrams)
-- -----------------------------------------------------------------------------
-- Diagrams are generated on-the-fly from structured data:
--   - procedure_details → flowchart, sequence diagram
--   - concepts (via concept_relationships query) → mindmap, graph
--   - learning_paths → timeline
--   - taxonomy_nodes → tree (hierarchy)
--   - assessment_details → flowchart (quiz decision tree)
--
-- This table stores user-edited/saved versions of those diagrams.
-- Rendering: D3.js for all diagram types (consistent library, full control)
--   - flowchart: dagre-d3 layout
--   - sequence: custom D3 implementation
--   - mindmap: d3-hierarchy radial layout
--   - graph: d3-force simulation
--   - timeline: custom D3 horizontal/vertical layout
--   - tree: d3-hierarchy tree layout

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

CREATE INDEX idx_diagrams_user ON diagrams(user_id);
CREATE INDEX idx_diagrams_source ON diagrams(source_table, source_id);
CREATE INDEX idx_diagrams_type ON diagrams(diagram_type);
CREATE INDEX idx_diagrams_public ON diagrams(is_public);

-- =============================================================================
-- MODULE 6: LEARNING COMMUNITY
-- =============================================================================
-- This module handles:
-- - Collaboration platform (shared mind maps, projects)
-- - Gamification (points, badges, leaderboards)
-- - Content sharing (VR memory palaces, mnemonics, flashcards)
-- - Peer feedback tools
-- - Reputation system
-- =============================================================================

-- -----------------------------------------------------------------------------
-- COMMUNITIES & GROUPS
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_communities_url_id ON communities(url_id);
CREATE INDEX idx_communities_type ON communities(community_type);
CREATE INDEX idx_communities_created_by ON communities(created_by);
CREATE INDEX idx_communities_name_trgm ON communities USING GIN(name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS community_members (
  id SERIAL PRIMARY KEY,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member' CHECK (role IN (
    'owner', 'admin', 'moderator', 'member', 'pending'
  )),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'inactive', 'banned', 'left'
  )),
  contribution_points INTEGER DEFAULT 0,
  resources_shared INTEGER DEFAULT 0,
  feedback_given INTEGER DEFAULT 0,
  notification_settings JSONB DEFAULT '{"all": true}'::jsonb,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(community_id, user_id)
);

CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_community_members_role ON community_members(role);
CREATE INDEX idx_community_members_status ON community_members(status);

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

CREATE INDEX idx_community_invites_community ON community_invitations(community_id);
CREATE INDEX idx_community_invites_email ON community_invitations(invited_email);
CREATE INDEX idx_community_invites_user ON community_invitations(invited_user_id);
CREATE INDEX idx_community_invites_code ON community_invitations(invitation_code);
CREATE INDEX idx_community_invites_status ON community_invitations(status);

-- -----------------------------------------------------------------------------
-- GAMIFICATION SYSTEM
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_point_types_url_id ON point_types(url_id);
CREATE INDEX idx_point_types_community ON point_types(community_id);

CREATE TABLE IF NOT EXISTS point_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  point_type_id UUID REFERENCES point_types(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL CHECK (action_type IN (
    'share_content', 'content_liked',
    'give_feedback', 'feedback_helpful',
    'discussion_post', 'discussion_reply', 'answer_accepted',
    'challenge_complete', 'challenge_win',
    'daily_study', 'weekly_share',
    'mentor_session'
  )),
  points_awarded INTEGER NOT NULL,
  daily_limit INTEGER,
  total_limit INTEGER,
  conditions JSONB,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_point_rules_type ON point_rules(point_type_id);
CREATE INDEX idx_point_rules_action ON point_rules(action_type);
CREATE INDEX idx_point_rules_active ON point_rules(is_active);

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
    'mentor_session'
  )),
  action_id UUID,                             -- The entity that triggered this
  rule_id UUID REFERENCES point_rules(id) ON DELETE SET NULL,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_points_user ON user_points(user_id);
CREATE INDEX idx_user_points_type ON user_points(point_type_id);
CREATE INDEX idx_user_points_community ON user_points(community_id);
CREATE INDEX idx_user_points_created ON user_points(created_at);
CREATE INDEX idx_user_points_action ON user_points(action_type);
CREATE INDEX idx_user_points_leaderboard ON user_points(point_type_id, user_id, points);

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  url_id VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  color VARCHAR(20),
  rarity VARCHAR(30) CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  badge_type VARCHAR(50) NOT NULL CHECK (badge_type IN (
    'achievement', 'milestone', 'skill', 'community', 'special'
)),
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

CREATE INDEX idx_badges_url_id ON badges(url_id);
CREATE INDEX idx_badges_type ON badges(badge_type);
CREATE INDEX idx_badges_rarity ON badges(rarity);
CREATE INDEX idx_badges_community ON badges(community_id);
CREATE INDEX idx_badges_active ON badges(is_active);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  show_on_profile BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, badge_id, community_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_user_badges_community ON user_badges(community_id);
CREATE INDEX idx_user_badges_profile ON user_badges(user_id, show_on_profile) WHERE show_on_profile = TRUE;

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

CREATE INDEX idx_leaderboard_community ON leaderboard_snapshots(community_id);
CREATE INDEX idx_leaderboard_period ON leaderboard_snapshots(period_type, period_start);
CREATE INDEX idx_leaderboard_point_type ON leaderboard_snapshots(point_type_id);

-- -----------------------------------------------------------------------------
-- STREAKS
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_type ON user_streaks(streak_type);
CREATE INDEX idx_user_streaks_current ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_longest ON user_streaks(longest_streak DESC);

-- -----------------------------------------------------------------------------
-- SOCIAL FEATURES
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_status ON mentorships(status);
CREATE INDEX idx_mentorships_community ON mentorships(community_id);

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

CREATE INDEX idx_mentorship_resources_mentorship ON mentorship_resources(mentorship_id);
CREATE INDEX idx_mentorship_resources_entity ON mentorship_resources(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS group_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'community_vs_community', 'team_battle', 'collaborative'
  )),
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
    'upcoming', 'active', 'completed', 'cancelled'
  )),
  winner VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_group_challenges_status ON group_challenges(status);
CREATE INDEX idx_group_challenges_dates ON group_challenges(starts_at, ends_at);

CREATE TABLE IF NOT EXISTS group_challenge_members (
  id SERIAL PRIMARY KEY,
  challenge_id UUID REFERENCES group_challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team VARCHAR(10) NOT NULL CHECK (team IN ('team_a', 'team_b')),
  contribution_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, user_id)
);

CREATE INDEX idx_group_challenge_members_challenge ON group_challenge_members(challenge_id);
CREATE INDEX idx_group_challenge_members_user ON group_challenge_members(user_id);

-- -----------------------------------------------------------------------------
-- ECONOMY SYSTEM
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_currency (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX idx_user_currency_user ON user_currency(user_id);

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

CREATE INDEX idx_shop_items_url_id ON shop_items(url_id);
CREATE INDEX idx_shop_items_category ON shop_items(category);
CREATE INDEX idx_shop_items_type ON shop_items(item_type);
CREATE INDEX idx_shop_items_active ON shop_items(is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS user_inventory (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, shop_item_id)
);

CREATE INDEX idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_user_inventory_item ON user_inventory(shop_item_id);

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

CREATE INDEX idx_streak_milestones_type ON streak_milestones(streak_type);

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
    'completed', 'used', 'refunded', 'expired'
  )),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

CREATE INDEX idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_gifted ON user_purchases(gifted_to);
CREATE INDEX idx_user_purchases_status ON user_purchases(status);
CREATE INDEX idx_user_purchases_created ON user_purchases(created_at);

-- -----------------------------------------------------------------------------
-- EVENTS
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_events_url_id ON events(url_id);
CREATE INDEX idx_events_active ON events(starts_at, ends_at) WHERE is_active = TRUE;
CREATE INDEX idx_events_community ON events(community_id);

CREATE TABLE IF NOT EXISTS event_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'individual', 'community', 'classroom'
  )),
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

CREATE INDEX idx_event_challenges_event ON event_challenges(event_id);
CREATE INDEX idx_event_challenges_type ON event_challenges(challenge_type);

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

CREATE INDEX idx_user_event_progress_user ON user_event_progress(user_id);
CREATE INDEX idx_user_event_progress_event ON user_event_progress(event_id);
CREATE INDEX idx_user_event_progress_completed ON user_event_progress(is_completed);

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

CREATE INDEX idx_active_boosts_user ON active_boosts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_active_boosts_community ON active_boosts(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_active_boosts_active ON active_boosts(expires_at, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_active_boosts_activated_by ON active_boosts(activated_by);

-- -----------------------------------------------------------------------------
-- PROSOCIAL FEATURES
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_content_requests_type ON content_requests(request_type);
CREATE INDEX idx_content_requests_status ON content_requests(status);
CREATE INDEX idx_content_requests_votes ON content_requests(total_coins DESC);

CREATE TABLE IF NOT EXISTS content_request_votes (
  id SERIAL PRIMARY KEY,
  request_id UUID REFERENCES content_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coins_contributed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, user_id)
);

CREATE INDEX idx_content_request_votes_request ON content_request_votes(request_id);
CREATE INDEX idx_content_request_votes_user ON content_request_votes(user_id);

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

CREATE INDEX idx_appreciations_from ON appreciations(from_user_id);
CREATE INDEX idx_appreciations_to ON appreciations(to_user_id);
CREATE INDEX idx_appreciations_type ON appreciations(appreciation_type);

-- -----------------------------------------------------------------------------
-- CONTENT SHARING
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_shared_content_user ON shared_content(user_id);
CREATE INDEX idx_shared_content_entity ON shared_content(entity_type, entity_id);
CREATE INDEX idx_shared_content_visibility ON shared_content(visibility);
CREATE INDEX idx_shared_content_status ON shared_content(status);
CREATE INDEX idx_shared_content_featured ON shared_content(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_shared_content_rating ON shared_content(average_rating DESC NULLS LAST);
CREATE INDEX idx_shared_content_tags ON shared_content USING GIN(tags);
CREATE INDEX idx_shared_content_communities ON shared_content USING GIN(community_ids);
CREATE INDEX idx_shared_content_title_trgm ON shared_content USING GIN(title gin_trgm_ops);

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

CREATE INDEX idx_content_downloads_content ON content_downloads(shared_content_id);
CREATE INDEX idx_content_downloads_user ON content_downloads(user_id);
CREATE INDEX idx_content_downloads_action ON content_downloads(action_type);

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

CREATE INDEX idx_content_ratings_content ON content_ratings(shared_content_id);
CREATE INDEX idx_content_ratings_user ON content_ratings(user_id);
CREATE INDEX idx_content_ratings_rating ON content_ratings(rating);

-- -----------------------------------------------------------------------------
-- PEER FEEDBACK SYSTEM
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feedback_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram', 'shared_content',
    'flashcard'
  )),
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

CREATE INDEX idx_feedback_requests_user ON feedback_requests(user_id);
CREATE INDEX idx_feedback_requests_entity ON feedback_requests(entity_type, entity_id);
CREATE INDEX idx_feedback_requests_community ON feedback_requests(community_id);
CREATE INDEX idx_feedback_requests_status ON feedback_requests(status);

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

CREATE INDEX idx_peer_feedback_request ON peer_feedback(feedback_request_id);
CREATE INDEX idx_peer_feedback_reviewer ON peer_feedback(reviewer_id);
CREATE INDEX idx_peer_feedback_recipient ON peer_feedback(recipient_id);

-- -----------------------------------------------------------------------------
-- REPUTATION SYSTEM
-- -----------------------------------------------------------------------------

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

CREATE INDEX idx_reputation_user ON reputation_scores(user_id);
CREATE INDEX idx_reputation_community ON reputation_scores(community_id);
CREATE INDEX idx_reputation_total ON reputation_scores(total_score DESC);
CREATE INDEX idx_reputation_level ON reputation_scores(reputation_level);

CREATE TABLE IF NOT EXISTS reputation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
    'content_shared', 'content_liked', 'content_rated',
    'feedback_given', 'feedback_marked_helpful',
    'badge_earned', 'streak_milestone',
    'mentoring_completed', 'mentee_helped',
    'challenge_won', 'challenge_completed',
    'discussion_created', 'reply_liked'
  )),
  dimension VARCHAR(50) NOT NULL CHECK (dimension IN (
    'teaching', 'content', 'feedback', 'engagement', 'reliability'
  )),
  points_change INTEGER NOT NULL,
  reference_type VARCHAR(50) CHECK (reference_type IS NULL OR reference_type IN (
    'shared_content', 'peer_feedback', 'feedback_request',
    'badge', 'mentorship', 'group_challenge', 'challenge',
    'discussion_thread', 'discussion_reply', 'appreciation'
  )),
  reference_id UUID,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reputation_events_user ON reputation_events(user_id);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);
CREATE INDEX idx_reputation_events_dimension ON reputation_events(dimension);
CREATE INDEX idx_reputation_events_community ON reputation_events(community_id);
CREATE INDEX idx_reputation_events_created ON reputation_events(created_at);

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

CREATE INDEX idx_reputation_levels_url_id ON reputation_levels(url_id);
CREATE INDEX idx_reputation_levels_score ON reputation_levels(min_score);
CREATE INDEX idx_reputation_levels_community ON reputation_levels(community_id);

-- -----------------------------------------------------------------------------
-- COMMUNITY DISCUSSIONS
-- -----------------------------------------------------------------------------

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
    'flashcard', 'vr_scenario'
  )),
  related_entity_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discussions_community ON discussion_threads(community_id);
CREATE INDEX idx_discussions_user ON discussion_threads(user_id);
CREATE INDEX idx_discussions_type ON discussion_threads(thread_type);
CREATE INDEX idx_discussions_status ON discussion_threads(status);
CREATE INDEX idx_discussions_pinned ON discussion_threads(community_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_discussions_activity ON discussion_threads(last_activity_at DESC);
CREATE INDEX idx_discussions_tags ON discussion_threads USING GIN(tags);
CREATE INDEX idx_discussions_title_trgm ON discussion_threads USING GIN(title gin_trgm_ops);

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

CREATE INDEX idx_replies_thread ON discussion_replies(thread_id);
CREATE INDEX idx_replies_user ON discussion_replies(user_id);
CREATE INDEX idx_replies_parent ON discussion_replies(parent_reply_id);
CREATE INDEX idx_replies_accepted ON discussion_replies(thread_id, is_accepted) WHERE is_accepted = TRUE;

ALTER TABLE discussion_threads
ADD CONSTRAINT fk_accepted_reply
FOREIGN KEY (accepted_reply_id) REFERENCES discussion_replies(id) ON DELETE SET NULL;



-- -----------------------------------------------------------------------------
-- COMMUNITY CHALLENGES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  instructions TEXT,
  challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN (
    'mnemonic', 'memory_palace', 'flashcard', 'quiz', 'teaching', 'creative'
  )),
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

CREATE INDEX idx_challenges_community ON challenges(community_id);
CREATE INDEX idx_challenges_creator ON challenges(created_by);
CREATE INDEX idx_challenges_type ON challenges(challenge_type);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_dates ON challenges(starts_at, ends_at);

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

CREATE INDEX idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX idx_challenge_participants_status ON challenge_participants(status);

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

CREATE INDEX idx_challenge_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX idx_challenge_submissions_user ON challenge_submissions(user_id);
CREATE INDEX idx_challenge_submissions_status ON challenge_submissions(status);
CREATE INDEX idx_challenge_submissions_rank ON challenge_submissions(challenge_id, rank);

-- -----------------------------------------------------------------------------
-- REAL-TIME PRESENCE & EDITING LOCKS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_presence (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'online' CHECK (status IN (
    'online', 'away', 'busy', 'offline')),
  current_entity_type VARCHAR(50) CHECK (current_entity_type IS NULL OR current_entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'chat_room',
    'vr_scenario', 'game_session', 'flashcard'
  )),
  current_entity_id UUID,
  current_community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  socket_id VARCHAR(100),
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_presence_user ON user_presence(user_id);
CREATE INDEX idx_presence_status ON user_presence(status);
CREATE INDEX idx_presence_entity ON user_presence(current_entity_type, current_entity_id);
CREATE INDEX idx_presence_heartbeat ON user_presence(last_heartbeat);

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

CREATE INDEX idx_edit_locks_entity ON edit_locks(entity_type, entity_id);
CREATE INDEX idx_edit_locks_user ON edit_locks(locked_by);
CREATE INDEX idx_edit_locks_expires ON edit_locks(expires_at);

CREATE TABLE IF NOT EXISTS entity_viewers (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'chat_room',
    'vr_scenario', 'game_session', 'flashcard'
  )),
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, user_id)
);

CREATE INDEX idx_entity_viewers_entity ON entity_viewers(entity_type, entity_id);
CREATE INDEX idx_entity_viewers_user ON entity_viewers(user_id);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(20) UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  room_type VARCHAR(30) DEFAULT 'group' CHECK (room_type IN (
    'live_session', 'group', 'channel')),
  entity_type VARCHAR(50) CHECK (entity_type IS NULL OR entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram', 'shared_content',
    'vr_scenario', 'game_session')),
  entity_id UUID,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT TRUE,
  max_participants INTEGER DEFAULT 50,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_permanent BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  retention_days INTEGER DEFAULT NULL,
  member_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_rooms_code ON chat_rooms(room_code);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(room_type);
CREATE INDEX idx_chat_rooms_entity ON chat_rooms(entity_type, entity_id);
CREATE INDEX idx_chat_rooms_community ON chat_rooms(community_id);
CREATE INDEX idx_chat_rooms_expires ON chat_rooms(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_chat_rooms_permanent ON chat_rooms(is_permanent);

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

CREATE INDEX idx_chat_room_members_room ON chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user ON chat_room_members(user_id);
CREATE INDEX idx_chat_room_members_active ON chat_room_members(room_id, is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  direct_chat_id UUID,
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(30) DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'file', 'system', 'reaction', 'reply')),
  content TEXT NOT NULL, -- Encrypted by backend, stored as base64
  is_encrypted BOOLEAN DEFAULT TRUE, -- FALSE only for system messages
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  attachments JSONB, -- [{type, url, name, size}]
  mentions UUID[],
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  reactions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  edited_at TIMESTAMP
);

CREATE INDEX idx_chat_community ON chat_messages(community_id, created_at);
CREATE INDEX idx_chat_direct ON chat_messages(direct_chat_id, created_at);
CREATE INDEX idx_chat_room ON chat_messages(chat_room_id, created_at);
CREATE INDEX idx_chat_user ON chat_messages(user_id);
CREATE INDEX idx_chat_reply ON chat_messages(reply_to_id);
CREATE INDEX idx_chat_mentions ON chat_messages USING GIN(mentions);

CREATE TABLE IF NOT EXISTS direct_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_ids UUID[] NOT NULL,
  is_group BOOLEAN DEFAULT FALSE,
  group_name VARCHAR(255),
  group_avatar_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  last_message_preview TEXT,
  retention_days INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_direct_chats_participants ON direct_chats USING GIN(participant_ids);
CREATE INDEX idx_direct_chats_last_message ON direct_chats(last_message_at DESC);

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

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_friendships_pending ON friendships(friend_id, status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS chat_read_status (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  direct_chat_id UUID REFERENCES direct_chats(id) ON DELETE CASCADE,
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unread_count INTEGER DEFAULT 0,
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMP,
  UNIQUE(user_id, community_id),
  UNIQUE(user_id, direct_chat_id),
  UNIQUE(user_id, chat_room_id)
);

CREATE INDEX idx_chat_read_user ON chat_read_status(user_id);
CREATE INDEX idx_chat_read_unread ON chat_read_status(user_id, unread_count) WHERE unread_count > 0;

CREATE TABLE IF NOT EXISTS chat_reactions (
  id SERIAL PRIMARY KEY,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX idx_chat_reactions_user ON chat_reactions(user_id);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS SYSTEM
-- -----------------------------------------------------------------------------

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
    'mentorship', 'system'
  )),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  entity_type VARCHAR(50) CHECK (entity_type IS NULL OR entity_type IN (
    'concept', 'concept_relationship', 'learning_path',
    'source', 'extracted_media', 'diagram',
    'shared_content', 'discussion_thread', 'discussion_reply',
    'badge', 'challenge', 'community', 'user', 'chat_room',
    'peer_feedback', 'activity', 'mentorship', 'appreciation',
    'flashcard', 'vr_scenario', 'game_session'
  )),
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

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_group ON notifications(group_key);

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
    'mentorship', 'system'
  )),
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

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- -----------------------------------------------------------------------------
-- ACTIVITY FEED
-- -----------------------------------------------------------------------------

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
    'flashcard', 'vr_scenario', 'game_session'
  )),
  entity_id UUID NOT NULL,
  entity_preview JSONB,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  visibility VARCHAR(30) DEFAULT 'public' CHECK (visibility IN (
    'public', 'community', 'followers', 'private')),
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_actor ON activity_feed(actor_id);
CREATE INDEX idx_activity_types ON activity_feed(activity_type);
CREATE INDEX idx_activity_entity ON activity_feed(entity_type, entity_id);
CREATE INDEX idx_activity_community ON activity_feed(community_id, created_at DESC);
CREATE INDEX idx_activity_createds ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_visibility ON activity_feed(visibility);

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

CREATE INDEX idx_activity_comments_activity ON activity_comments(activity_id);
CREATE INDEX idx_activity_comments_user ON activity_comments(user_id);
CREATE INDEX idx_activity_comments_parent ON activity_comments(parent_comment_id);

-- Removed in favor of unified likes table above

CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);

-- -----------------------------------------------------------------------------
-- TYPING INDICATORS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS typing_indicators (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  context_type VARCHAR(50) NOT NULL CHECK (context_type IN (
    'chat_room', 'direct_chat', 'discussion_thread', 'collaboration')),
  context_id UUID NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 seconds'),
  UNIQUE(user_id, context_type, context_id)
);

CREATE INDEX idx_typing_context ON typing_indicators(context_type, context_id);
CREATE INDEX idx_typing_expires ON typing_indicators(expires_at);

CREATE OR REPLACE FUNCTION cleanup_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- TRIGGERS FOR REAL-TIME TABLES
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_direct_chat_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.direct_chat_id IS NOT NULL THEN
    UPDATE direct_chats
    SET
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.direct_chat_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_direct_chat_stats
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_direct_chat_stats();

CREATE OR REPLACE FUNCTION update_activity_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE activity_feed SET comment_count = comment_count + 1 WHERE id = NEW.activity_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE activity_feed SET comment_count = comment_count - 1 WHERE id = OLD.activity_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activity_comment_count
AFTER INSERT OR DELETE ON activity_comments
FOR EACH ROW EXECUTE FUNCTION update_activity_comment_count();

CREATE OR REPLACE FUNCTION update_chat_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
  current_reactions JSONB;
  current_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT reactions INTO current_reactions FROM chat_messages WHERE id = NEW.message_id;
    IF current_reactions IS NULL THEN
      current_reactions := '{}'::jsonb;
    END IF;
    IF current_reactions->NEW.reaction IS NULL THEN
      current_count := 0;
    ELSE
      current_count := (current_reactions->NEW.reaction)::int;
    END IF;
    UPDATE chat_messages
    SET reactions = jsonb_set(current_reactions, ARRAY[NEW.reaction], (current_count + 1)::text::jsonb)
    WHERE id = NEW.message_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT reactions INTO current_reactions FROM chat_messages WHERE id = OLD.message_id;
    IF current_reactions->OLD.reaction IS NULL THEN
      current_count := 1;
    ELSE
      current_count := (current_reactions->OLD.reaction)::int;
    END IF;
    UPDATE chat_messages
    SET reactions = jsonb_set(current_reactions, ARRAY[OLD.reaction], GREATEST(current_count - 1, 0)::text::jsonb)
    WHERE id = OLD.message_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_chat_reaction_counts
AFTER INSERT OR DELETE ON chat_reactions
FOR EACH ROW EXECUTE FUNCTION update_chat_reaction_counts();

CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE communities SET member_count = member_count - 1 WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_community_member_count
AFTER INSERT OR DELETE ON community_members
FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

CREATE OR REPLACE FUNCTION update_like_count_shared_content()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.entity_type = 'shared_content' THEN
    UPDATE shared_content
    SET like_count = like_count + 1
    WHERE id = NEW.entity_id;

  ELSIF TG_OP = 'DELETE' AND OLD.entity_type = 'shared_content' THEN
    UPDATE shared_content
    SET like_count = like_count - 1
    WHERE id = OLD.entity_id;
  END IF;

  RETURN NULL; -- AFTER trigger does not need to return a row
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_like_count_shared_content
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION update_like_count_shared_content();

CREATE OR REPLACE FUNCTION update_thread_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussion_threads
    SET reply_count = reply_count + 1, last_activity_at = CURRENT_TIMESTAMP
    WHERE id = NEW.thread_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussion_threads SET reply_count = reply_count - 1 WHERE id = OLD.thread_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_thread_reply_count
AFTER INSERT OR DELETE ON discussion_replies
FOR EACH ROW EXECUTE FUNCTION update_thread_reply_count();

CREATE OR REPLACE FUNCTION update_content_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.shared_content_id;
  ELSE
    target_id := NEW.shared_content_id;
  END IF;

  UPDATE shared_content
  SET
    average_rating = (
      SELECT AVG(rating)::NUMERIC(3,2) FROM content_ratings WHERE shared_content_id = target_id
    ),
    rating_count = (
      SELECT COUNT(*) FROM content_ratings WHERE shared_content_id = target_id
    )
  WHERE id = target_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_rating
AFTER INSERT OR UPDATE OR DELETE ON content_ratings
FOR EACH ROW EXECUTE FUNCTION update_content_rating();

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO point_types (id, name, url_id, description, icon, color, is_global) VALUES
  ('20000000-0000-0000-0000-000000000001'::uuid, 'Learning Points', 'learning', 'Points earned through learning activities', 'book', '#4CAF50', TRUE),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Teaching Points', 'teaching', 'Points earned by helping others learn', 'school', '#2196F3', TRUE),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'Contribution Points', 'contribution', 'Points earned by sharing content', 'share', '#FF9800', TRUE),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'Community Points', 'community', 'Points earned through community engagement', 'group', '#9C27B0', TRUE)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO badges (id, name, url_id, description, badge_type, rarity, criteria, points_awarded) VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, 'First Share', 'first-share', 'Shared your first piece of content', 'achievement', 'common', '{"action": "share_content", "count": 1}'::jsonb, 10),
  ('30000000-0000-0000-0000-000000000002'::uuid, 'Helpful Peer', 'helpful-peer', 'Gave feedback that was marked helpful 5 times', 'achievement', 'uncommon', '{"action": "helpful_feedback", "count": 5}'::jsonb, 25),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'Community Builder', 'community-builder', 'Invited 10 members who joined', 'community', 'rare', '{"action": "successful_invite", "count": 10}'::jsonb, 50),
  ('30000000-0000-0000-0000-000000000004'::uuid, 'Memory Master', 'memory-master', 'Created a memory palace with 100+ items', 'skill', 'epic', '{"action": "memory_palace_items", "count": 100}'::jsonb, 100),
  ('30000000-0000-0000-0000-000000000005'::uuid, 'Top Contributor', 'top-contributor', 'Reached #1 on weekly leaderboard', 'milestone', 'legendary', '{"action": "leaderboard_first", "count": 1}'::jsonb, 200),
  ('30000000-0000-0000-0000-000000000010'::uuid, 'Week Warrior', 'streak-7', 'Maintained a 7-day study streak', 'milestone', 'common', '{"action": "daily_study", "streak": 7}'::jsonb, 50),
  ('30000000-0000-0000-0000-000000000011'::uuid, 'Fortnight Focus', 'streak-14', 'Maintained a 14-day study streak', 'milestone', 'uncommon', '{"action": "daily_study", "streak": 14}'::jsonb, 100),
  ('30000000-0000-0000-0000-000000000012'::uuid, 'Monthly Master', 'streak-30', 'Maintained a 30-day study streak', 'milestone', 'rare', '{"action": "daily_study", "streak": 30}'::jsonb, 250),
  ('30000000-0000-0000-0000-000000000013'::uuid, 'Century Scholar', 'streak-100', 'Maintained a 100-day study streak', 'milestone', 'epic', '{"action": "daily_study", "streak": 100}'::jsonb, 1000),
  ('30000000-0000-0000-0000-000000000014'::uuid, 'Year of Knowledge', 'streak-365', 'Maintained a 365-day study streak', 'milestone', 'legendary', '{"action": "daily_study", "streak": 365}'::jsonb, 5000),
  ('30000000-0000-0000-0000-000000000020'::uuid, 'First Mentor', 'first-mentor', 'Completed your first mentoring session', 'achievement', 'common', '{"action": "mentor_session", "count": 1}'::jsonb, 20),
  ('30000000-0000-0000-0000-000000000021'::uuid, 'Dedicated Mentor', 'mentor-10', 'Completed 10 mentoring sessions', 'achievement', 'rare', '{"action": "mentor_session", "count": 10}'::jsonb, 100)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO reputation_levels (name, url_id, min_score, max_score, icon, color, is_global) VALUES
  ('Newcomer', 'newcomer', 0, 99, 'seedling', '#9E9E9E', TRUE),
  ('Learner', 'learner', 100, 499, 'sprout', '#8BC34A', TRUE),
  ('Contributor', 'contributor', 500, 1499, 'leaf', '#4CAF50', TRUE),
  ('Guide', 'guide', 1500, 4999, 'tree', '#2196F3', TRUE),
  ('Expert', 'expert', 5000, 14999, 'star', '#FF9800', TRUE),
  ('Master', 'master', 15000, 49999, 'crown', '#9C27B0', TRUE),
  ('Legend', 'legend', 50000, NULL, 'trophy', '#FFD700', TRUE)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO point_rules (point_type_id, action_type, points_awarded, daily_limit, description, is_active) VALUES
  ('20000000-0000-0000-0000-000000000003'::uuid, 'share_content', 10, 5, 'Share learning content with the community', TRUE),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'content_liked', 2, 50, 'Your shared content was liked', TRUE),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'give_feedback', 5, 10, 'Provide feedback to a peer', TRUE),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'feedback_helpful', 10, 20, 'Your feedback was marked as helpful', TRUE),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'mentor_session', 25, 5, 'Complete a mentoring session', TRUE),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'discussion_post', 3, 10, 'Create a discussion thread', TRUE),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'discussion_reply', 2, 20, 'Reply to a discussion', TRUE),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'answer_accepted', 15, 10, 'Your answer was accepted', TRUE),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'challenge_complete', 20, NULL, 'Complete a community challenge', TRUE),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'challenge_win', 50, NULL, 'Win a community challenge', TRUE),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'daily_study', 5, 1, 'Complete daily study session', TRUE),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'weekly_share', 15, 1, 'Share content this week (weekly bonus)', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (id, name, url_id, description, price, category, item_type, item_value, is_giftable, icon, display_order) VALUES
  ('51000000-0000-0000-0000-000000000001'::uuid, 'Streak Freeze', 'streak-freeze',
    'Protect your streak for one day', 200, 'fun', 'streak_freeze',
    '{"days": 1}'::jsonb, TRUE, 'snowflake', 1),
  ('51000000-0000-0000-0000-000000000002'::uuid, '2x XP Boost (24h)', 'xp-boost-24',
    'Double your points for 24 hours', 500, 'fun', 'xp_boost',
    '{"multiplier": 2, "duration_hours": 24}'::jsonb, FALSE, 'bolt', 2),
  ('51000000-0000-0000-0000-000000000003'::uuid, 'Gold Profile Border', 'gold-border',
    'Show off with a golden profile border', 300, 'fun', 'profile_border',
    '{"asset": "gold_border"}'::jsonb, FALSE, 'circle', 3),
  ('51000000-0000-0000-0000-000000000004'::uuid, 'Diamond Profile Border', 'diamond-border',
    'The ultimate status symbol', 800, 'fun', 'profile_border',
    '{"asset": "diamond_border"}'::jsonb, FALSE, 'gem', 4),
  ('51000000-0000-0000-0000-000000000005'::uuid, 'Fire Name Color', 'fire-name',
    'Your name appears in fiery orange', 400, 'fun', 'name_color',
    '{"color": "#FF5722"}'::jsonb, FALSE, 'fire', 5),
  ('51000000-0000-0000-0000-000000000006'::uuid, 'Exclusive Emoji Pack', 'emoji-pack',
    'Unlock 10 exclusive chat emojis', 150, 'fun', 'emoji_pack',
    '{"pack": "exclusive_v1"}'::jsonb, FALSE, 'smile', 6),
  ('51000000-0000-0000-0000-000000000010'::uuid, 'Hint Pack (5 hints)', 'hint-pack-5',
    'Get 5 hints for quizzes without score penalty', 250, 'tools', 'hint_pack',
    '{"hints": 5}'::jsonb, FALSE, 'lightbulb', 10),
  ('51000000-0000-0000-0000-000000000011'::uuid, 'Quiz Retry', 'quiz-retry',
    'Retake a failed assessment once', 400, 'tools', 'quiz_retry',
    '{"retries": 1}'::jsonb, FALSE, 'redo', 11),
  ('51000000-0000-0000-0000-000000000012'::uuid, 'AI Summary Token', 'ai-summary',
    'Generate AI summary of any topic', 300, 'tools', 'ai_summary',
    '{"uses": 1}'::jsonb, FALSE, 'robot', 12),
  ('51000000-0000-0000-0000-000000000013'::uuid, 'Export to PDF', 'export-pdf',
    'Download your flashcards as PDF', 200, 'tools', 'pdf_export',
    '{"uses": 1}'::jsonb, FALSE, 'file-pdf', 13),
  ('51000000-0000-0000-0000-000000000020'::uuid, 'Gift Streak Freeze', 'gift-freeze',
    'Send a streak freeze to a struggling friend', 250, 'prosocial', 'streak_freeze',
    '{"days": 1}'::jsonb, TRUE, 'gift', 20),
  ('51000000-0000-0000-0000-000000000021'::uuid, 'Community Boost (24h)', 'community-boost',
    'Everyone in your community gets 1.5x XP for 24 hours!', 800, 'prosocial', 'community_boost',
    '{"multiplier": 1.5, "duration_hours": 24}'::jsonb, FALSE, 'users', 21),
  ('51000000-0000-0000-0000-000000000022'::uuid, 'Content Vote', 'content-vote',
    'Vote to prioritize new content or features', 100, 'prosocial', 'content_vote',
    '{"votes": 1}'::jsonb, FALSE, 'vote-yea', 22),
  ('51000000-0000-0000-0000-000000000023'::uuid, 'Send Appreciation', 'appreciation',
    'Show appreciation with coins to anyone who helped you', 100, 'prosocial', 'appreciation',
    '{"coins_to_recipient": 50}'::jsonb, FALSE, 'heart', 23),
  ('51000000-0000-0000-0000-000000000024'::uuid, 'Sponsor a Challenge', 'sponsor-challenge',
    'Create a community challenge with your name on it', 1000, 'prosocial', 'challenge_sponsor',
    '{"creates": "community_challenge", "attribution": true}'::jsonb, FALSE, 'trophy', 24),
  ('51000000-0000-0000-0000-000000000030'::uuid, 'Advanced Analytics', 'advanced-analytics',
    'Detailed insights into your learning patterns', 2000, 'premium', 'advanced_analytics',
    '{"permanent": true}'::jsonb, FALSE, 'chart-line', 30),
  ('51000000-0000-0000-0000-000000000031'::uuid, 'Quiz Creator Pro', 'quiz-creator',
    'Create and share quizzes with the community', 1500, 'premium', 'quiz_creator',
    '{"permanent": true}'::jsonb, FALSE, 'clipboard-list', 31),
  ('51000000-0000-0000-0000-000000000032'::uuid, 'Memory Palace Builder Pro', 'palace-pro',
    'Access advanced 3D room templates', 2500, 'premium', 'palace_pro',
    '{"permanent": true}'::jsonb, FALSE, 'building', 32),
  ('51000000-0000-0000-0000-000000000033'::uuid, 'Verified Contributor', 'verified-badge',
    'Permanent verified badge on all your shared content', 5000, 'premium', 'avatar',
    '{"badge": "verified_contributor", "permanent": true}'::jsonb, FALSE, 'check-circle', 33)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO streak_milestones (streak_type, period_required, points_awarded, coins_awarded, badge_id, shop_item_id, item_quantity, multiplier_boost, name, description, icon) VALUES
  ('daily_study', 3, 15, 50, NULL, NULL, 0, 0.1, '3-Day Streak', 'Study 3 days in a row', 'fire'),
  ('daily_study', 7, 50, 100, '30000000-0000-0000-0000-000000000010'::uuid, '51000000-0000-0000-0000-000000000001'::uuid, 1, 0.2, 'Week Warrior', 'Complete a full week of studying', 'fire-alt'),
  ('daily_study', 14, 100, 200, '30000000-0000-0000-0000-000000000011'::uuid, '51000000-0000-0000-0000-000000000001'::uuid, 1, 0.3, 'Fortnight Focus', 'Two weeks of consistent learning', 'flame'),
  ('daily_study', 30, 250, 500, '30000000-0000-0000-0000-000000000012'::uuid, '51000000-0000-0000-0000-000000000001'::uuid, 2, 0.5, 'Monthly Master', 'A full month of dedication', 'crown'),
  ('daily_study', 100, 1000, 2000, '30000000-0000-0000-0000-000000000013'::uuid, '51000000-0000-0000-0000-000000000001'::uuid, 5, 1.0, 'Century Scholar', '100 days of learning', 'trophy'),
  ('daily_study', 365, 5000, 10000, '30000000-0000-0000-0000-000000000014'::uuid, '51000000-0000-0000-0000-000000000001'::uuid, 10, 2.0, 'Year of Knowledge', 'Study every day for a year', 'gem'),
  ('weekly_share', 2, 20, 50, NULL, NULL, 0, 0.1, '2-Week Sharer', 'Share content 2 weeks in a row', 'share'),
  ('weekly_share', 4, 75, 150, NULL, '51000000-0000-0000-0000-000000000001'::uuid, 1, 0.2, 'Monthly Contributor', 'Share content every week for a month', 'share-alt'),
  ('weekly_share', 12, 200, 400, NULL, '51000000-0000-0000-0000-000000000001'::uuid, 2, 0.3, 'Quarterly Creator', '3 months of consistent sharing', 'bullhorn'),
  ('weekly_share', 26, 500, 1000, NULL, '51000000-0000-0000-0000-000000000001'::uuid, 3, 0.5, 'Half-Year Helper', '6 months of sharing with the community', 'hands-helping'),
  ('weekly_share', 52, 2000, 5000, NULL, '51000000-0000-0000-0000-000000000001'::uuid, 5, 1.0, 'Community Champion', 'Shared every week for a full year', 'award')
ON CONFLICT (streak_type, period_required) DO NOTHING;

-- 表1：剧本模板表
CREATE TABLE IF NOT EXISTS script_templates (
    -- 主键
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基础信息
    template_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- 模板定义
    template_type VARCHAR(30) NOT NULL DEFAULT 'historical_detective'
        CHECK (template_type IN ('historical_detective', 'political_intrigue', 'cultural_mystery')),
    
    -- 结构模板（JSON格式，包含变量占位符）
    structure_template JSONB NOT NULL,

    -- 内容约束
    content_domain VARCHAR(50) NOT NULL,  -- 适用内容领域
    content_context TEXT,                  -- 内容背景说明
    
    -- 学习设计
    learning_objectives JSONB NOT NULL,      -- 学习目标列表
    difficulty_level VARCHAR(10) DEFAULT 'medium'
        CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    
    -- AI生成配置
    ai_prompt_template TEXT,                 -- AI提示词模板
    generation_constraints JSONB,            -- 生成约束
    
    -- 状态
    version VARCHAR(10) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表2：模板参数表
CREATE TABLE IF NOT EXISTS template_parameters (
    -- 主键
    param_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    template_id UUID NOT NULL REFERENCES script_templates(template_id) ON DELETE CASCADE,
    
    -- 参数定义
    param_key VARCHAR(50) NOT NULL,          -- 参数键名，如 "content_domain"
    display_name VARCHAR(100) NOT NULL,      -- 显示名称
    description TEXT,                        -- 参数说明
    
    -- 参数类型
    param_type VARCHAR(20) NOT NULL
        CHECK (param_type IN ('string', 'number', 'boolean', 'enum', 'array')),
    
    -- 配置
    default_value TEXT,                      -- 默认值
    options JSONB,                           -- 枚举选项 [{value: "", label: ""}]
    constraints JSONB,                       -- 约束条件 {required, min, max, regex}
    
    -- 分类
    category VARCHAR(30) DEFAULT 'general'   -- 分类：historical/gameplay/learning
        CHECK (category IN ('content', 'gameplay', 'learning', 'general')),
    
    -- 显示
    display_order INT DEFAULT 0,
    is_required BOOLEAN DEFAULT true
);

/* Alreadly combine with init_postgresql.sql users table 
表3：用户表
CREATE TABLE IF NOT EXISTS users (
    -- 主键
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基础信息
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    
    -- 学习画像（简化）
    domain_level VARCHAR(20) DEFAULT 'beginner'
        CHECK (domain_level IN ('beginner', 'intermediate', 'advanced')),
    
    -- 偏好设置
    difficulty_preference VARCHAR(10) DEFAULT 'medium'
        CHECK (difficulty_preference IN ('easy', 'medium', 'hard', 'adaptive')),
    ai_assistance_level VARCHAR(10) DEFAULT 'moderate'
        CHECK (ai_assistance_level IN ('minimal', 'moderate', 'full')),
    
    -- 统计（用于展示）
    total_play_time_minutes INT DEFAULT 0,
    scripts_completed INT DEFAULT 0,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);
*/
-- 表4：生成的剧本表
CREATE TABLE IF NOT EXISTS generated_scripts (
    -- 主键
    script_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联模板
    template_id UUID NOT NULL REFERENCES script_templates(template_id),
    
    -- 生成参数（用户输入）
    generation_parameters JSONB NOT NULL,
    
    -- 生成内容
    script_title VARCHAR(200) NOT NULL,
    script_content JSONB NOT NULL,           -- 完整的剧本内容
    script_summary TEXT,                     -- 剧本摘要
    
    -- 生成信息
    generation_method VARCHAR(20) NOT NULL DEFAULT 'ai_assisted'
        CHECK (generation_method IN ('manual', 'ai_assisted', 'ai_generated')),
    ai_model_used VARCHAR(50),               -- 使用的AI模型
    generation_prompt TEXT,                  -- 使用的提示词
    
    -- 学习信息
    learning_points JSONB,                   -- 具体学习点
    estimated_duration INT,                  -- 估计时长（分钟）
    
    -- 验证状态
    validation_status VARCHAR(20) DEFAULT 'pending'
        CHECK (validation_status IN ('pending', 'validating', 'passed', 'failed')),
    validation_score DECIMAL(5,2),           -- 验证得分
    validation_notes TEXT,                   -- 验证说明
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    play_count INT DEFAULT 0,                -- 被玩次数
    
    -- 元数据
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_played_at TIMESTAMP
);

-- 表5：验证结果表
CREATE TABLE IF NOT EXISTS validation_results (
    -- 主键
    validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    script_id UUID NOT NULL REFERENCES generated_scripts(script_id),
    
    -- 验证信息
    validation_type VARCHAR(30) NOT NULL
        CHECK (validation_type IN ('logic', 'history', 'learning', 'gameplay', 'comprehensive')),
    
    -- 验证结果
    passed BOOLEAN NOT NULL,
    score DECIMAL(5,2),                      -- 得分 0-100
    details JSONB NOT NULL,                  -- 详细结果
    
    -- 问题记录
    issues_found JSONB,                      -- 发现的问题
    suggestions JSONB,                       -- 改进建议
    
    -- 验证器信息
    validator_version VARCHAR(20),
    validation_duration_ms INT,              -- 验证耗时
    
    -- 元数据
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表6：游戏会话表
CREATE TABLE IF NOT EXISTS game_sessions (
    -- 主键
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    id UUID NOT NULL REFERENCES users(id),
    script_id UUID NOT NULL REFERENCES generated_scripts(script_id),
    
    -- 会话信息
    session_type VARCHAR(20) DEFAULT 'solo'
        CHECK (session_type IN ('solo', 'demo', 'test')),
    
    -- 游戏状态
    current_scene VARCHAR(50),               -- 当前场景
    game_progress JSONB DEFAULT '{}',        -- 游戏进度状态
    collected_evidence JSONB DEFAULT '[]',   -- 收集的证据
    decisions_made JSONB DEFAULT '[]',       -- 做出的决策
    
    -- 进度指标
    progress_percentage INT DEFAULT 0
        CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    time_spent_minutes INT DEFAULT 0,
    
    -- 结局
    achieved_ending VARCHAR(100),            -- 达成的结局
    ending_score DECIMAL(5,2),               -- 结局评分
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
    
    -- 时间戳
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- 表7：游戏行为表
CREATE TABLE IF NOT EXISTS game_actions (
    -- 主键
    action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    session_id UUID NOT NULL REFERENCES game_sessions(session_id),
    id UUID NOT NULL REFERENCES users(id),
    
    -- 行为信息
    action_type VARCHAR(30) NOT NULL
        CHECK (action_type IN (
            'collect_evidence', 'talk_to_character', 'make_decision',
            'request_hint', 'solve_puzzle', 'review_knowledge'
        )),
    
    -- 内容
    action_details JSONB NOT NULL,           -- 详细行为数据
    action_result VARCHAR(50),               -- 结果描述
    
    -- AI交互相关
    ai_involved BOOLEAN DEFAULT false,
    ai_response TEXT,                        -- AI回应内容
    
    -- 学习相关
    knowledge_point VARCHAR(100),            -- 关联知识点
    learning_outcome VARCHAR(50),            -- 学习结果
    
    -- 时间戳
    action_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表8：学习分析表
CREATE TABLE IF NOT EXISTS learning_analytics (
    -- 主键
    analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    id UUID REFERENCES users(id),
    session_id UUID REFERENCES game_sessions(session_id),
    script_id UUID REFERENCES generated_scripts(script_id),
    
    -- 学习指标
    knowledge_points_covered JSONB,          -- 覆盖的知识点
    knowledge_mastery_score DECIMAL(5,2),    -- 知识掌握度 0-100
    reasoning_accuracy DECIMAL(5,2),         -- 推理准确率
    
    -- 游戏表现
    puzzle_success_rate DECIMAL(5,2),        -- 谜题成功率
    evidence_collection_rate DECIMAL(5,2),   -- 证据收集率
    decision_quality_score DECIMAL(5,2),     -- 决策质量
    
    -- 学习行为
    hints_requested INT DEFAULT 0,           -- 请求提示次数
    time_spent_on_knowledge INT DEFAULT 0,   -- 知识点学习时间（秒）
    
    -- 综合评价
    overall_score DECIMAL(5,2),              -- 综合得分
    learning_efficiency DECIMAL(5,2),        -- 学习效率
    
    -- 建议
    improvement_suggestions JSONB,           -- 改进建议
    recommended_next_scripts JSONB,          -- 推荐的下一个剧本
    
    -- 生成时间
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表9：学习节点表
CREATE TABLE IF NOT EXISTS learning_nodes (
    -- 主键
    node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    script_id UUID NOT NULL REFERENCES generated_scripts(script_id),
    
    -- 节点定义
    node_type VARCHAR(30) NOT NULL
        CHECK (node_type IN ('question', 'clue', 'dialogue', 'puzzle', 'explanation')),
    
    node_title VARCHAR(200) NOT NULL,
    node_content JSONB NOT NULL,  -- 节点内容（根据类型不同）
    
    -- 学习相关
    knowledge_points JSONB,       -- 关联的知识点
    difficulty_level VARCHAR(10) DEFAULT 'medium',
    expected_time_seconds INT,    -- 预计完成时间
    course VARCHAR(50),           -- 科目分类，如 math, english, science
    
    -- 前置条件
    prerequisites JSONB,          -- 解锁条件 [{type: "node", id: "...", status: "completed"}]
    unlock_condition JSONB,       -- 解锁条件逻辑（JSONLogic格式）
    
    -- 交互设计
    interaction_type VARCHAR(20) DEFAULT 'single_choice'
        CHECK (interaction_type IN ('single_choice', 'multiple_choice', 'text_input', 'drag_drop', 'sequence')),
    
    -- 答案/判断
    correct_answer JSONB,         -- 正确答案
    evaluation_logic JSONB,       -- 评价逻辑（如部分正确的情况）
    scoring_rules JSONB,          -- 评分规则
    
    -- 位置/顺序
    scene_location VARCHAR(50),   -- 所属场景
    display_order INT,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表10：用户回答表
CREATE TABLE IF NOT EXISTS user_responses (
    -- 主键
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    session_id UUID NOT NULL REFERENCES game_sessions(session_id),
    id UUID NOT NULL REFERENCES users(id),
    node_id UUID NOT NULL REFERENCES learning_nodes(node_id),
    
    -- 用户输入
    user_input JSONB NOT NULL,        -- 用户的回答/选择
    input_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 系统判断
    is_correct BOOLEAN,               -- 是否正确
    correctness_score DECIMAL(5,2),   -- 正确度评分（0-100）
    evaluation_details JSONB,         -- 详细评价
    
    -- 系统反馈
    system_feedback TEXT,             -- 给予用户的反馈
    feedback_type VARCHAR(20)         -- 反馈类型：correct/incorrect/partial/hint
        CHECK (feedback_type IN ('correct', 'incorrect', 'partial', 'hint', 'explanation')),
    
    -- 学习分析
    time_spent_seconds INT,           -- 花费时间
    attempts_count INT DEFAULT 1,     -- 尝试次数
    hint_used BOOLEAN DEFAULT false,  -- 是否使用了提示
    
    -- 触发结果
    triggered_actions JSONB        -- 触发的动作 [{"type": "unlock_clue", "id": "..."}]
);

-- 表11：线索触发表
CREATE TABLE IF NOT EXISTS clue_triggers (
    -- 主键
    trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    script_id UUID NOT NULL REFERENCES generated_scripts(script_id),
    target_clue_id UUID,       -- 要解锁的线索ID（引用learning_nodes）
    
    -- 触发条件
    trigger_type VARCHAR(30) NOT NULL
        CHECK (trigger_type IN ('response_correct', 'response_attempt', 
                               'clue_collected', 'dialogue_completed', 
                               'time_spent', 'combination', 'task_missed')),
    
    condition_logic JSONB NOT NULL,   -- 条件逻辑（JSONLogic）
    
    -- 触发动作
    action_type VARCHAR(30) NOT NULL
        CHECK (action_type IN ('unlock_clue', 'reveal_info', 'change_dialogue', 
                              'advance_scene', 'add_hint', 'adjust_difficulty')),
    
    action_data JSONB NOT NULL,       -- 动作数据
    
    -- 优先级
    priority_level INT DEFAULT 5,     -- 1-10，数字越小优先级越高
    is_exclusive BOOLEAN DEFAULT false, -- 是否独占触发
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表12：反馈规则表
CREATE TABLE IF NOT EXISTS feedback_rules (
    -- 主键
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联
    script_id UUID REFERENCES generated_scripts(script_id),
    node_id UUID REFERENCES learning_nodes(node_id),
    
    -- 规则条件
    condition_type VARCHAR(30) NOT NULL
        CHECK (condition_type IN ('response_correct', 'response_incorrect', 
                                 'multiple_incorrect', 'timeout', 'hint_requested')),
    
    condition_details JSONB,          -- 条件详情
    
    -- 反馈内容
    feedback_template TEXT NOT NULL,  -- 反馈模板，可包含变量
    feedback_type VARCHAR(20) NOT NULL
        CHECK (feedback_type IN ('encouragement', 'correction', 'explanation', 
                                'hint', 'redirect', 'summary')),
    
    -- 个性化
    difficulty_level VARCHAR(10),     -- 适用的难度级别
    user_level VARCHAR(20)              -- 适用的用户级别
        CHECK (user_level IN ('beginner', 'intermediate', 'advanced')),
    -- AI生成选项
    allow_ai_adaptation BOOLEAN DEFAULT true,  -- 是否允许AI调整反馈
    base_prompt TEXT,                 -- AI生成的基础提示词
    
    -- 执行选项
    show_immediately BOOLEAN DEFAULT true,     -- 是否立即显示
    cooldown_seconds INT DEFAULT 0,   -- 冷却时间
    
    -- 优先级
    priority INT DEFAULT 5,
    
    -- 状态
    is_active BOOLEAN DEFAULT true
);

-- ==================== AI上下文管理表 ====================

-- 表13：AI上下文会话表
CREATE TABLE IF NOT EXISTS ai_context_sessions (
    context_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(session_id),
    character_id UUID REFERENCES learning_nodes(node_id), -- 对话的角色
    context_type VARCHAR(30) NOT NULL
        CHECK (context_type IN ('dialogue', 'hint', 'explanation', 'generation')),
    
    -- 上下文配置
    system_prompt TEXT NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INT DEFAULT 2000,
    
    -- 状态
    is_active BOOLEAN DEFAULT true,
    token_count INT DEFAULT 0,
    message_count INT DEFAULT 0,
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表14：AI上下文消息表
CREATE TABLE IF NOT EXISTS ai_context_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES ai_context_sessions(context_id),
    
    -- 消息内容
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('system', 'user', 'assistant', 'function')),
    content TEXT NOT NULL,
    
    -- AI生成信息
    ai_model VARCHAR(50),
    tokens_used INT,
    finish_reason VARCHAR(30),
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表15：上下文向量存储表（连接Qdrant）
CREATE TABLE IF NOT EXISTS context_vectors (
    vector_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES ai_context_messages(message_id),
    context_id UUID REFERENCES ai_context_sessions(context_id),
    
    -- 向量信息
    qdrant_point_id UUID,  -- Qdrant中的point ID
    collection_name VARCHAR(100) DEFAULT 'dialogue_vectors',
    embedding_model VARCHAR(50) DEFAULT 'BAAI/bge-small-zh-v1.5',
    
    -- 元数据
    embedded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表16：学习计划表
CREATE TABLE IF NOT EXISTS learning_schedule (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id UUID NOT NULL REFERENCES users(id),
    node_id UUID REFERENCES learning_nodes(node_id), -- 对应学习节点
    planned_time TIMESTAMP,        -- 计划时间
    actual_time TIMESTAMP,         -- 实际完成时间
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'missed', 'rescheduled')),
    priority_level INT DEFAULT 5,  -- 优先级
    energy_slot VARCHAR(20),       -- 能量高峰时段 (morning/afternoon/evening)
    reschedule_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 创建索引 ====================

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_domain ON user_profiles (domain_level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_difficulty ON user_profiles (difficulty_preference);
CREATE INDEX IF NOT EXISTS idx_user_profiles_assistance ON user_profiles (ai_assistance_level);

-- user_ar_environments
CREATE INDEX IF NOT EXISTS idx_ar_env_user ON user_ar_environments (user_id);
CREATE INDEX IF NOT EXISTS idx_ar_env_system ON user_ar_environments (ar_system);

-- label
CREATE UNIQUE INDEX IF NOT EXISTS uq_label_name ON label (name);

-- asset_library
CREATE INDEX IF NOT EXISTS idx_asset_library_type ON asset_library (asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_library_source ON asset_library (source);

-- asset_label
CREATE INDEX IF NOT EXISTS idx_asset_label_tag ON asset_label (tag_id);

-- script_templates
CREATE INDEX IF NOT EXISTS idx_template_type ON script_templates (template_type);
CREATE INDEX IF NOT EXISTS idx_template_period ON script_templates (content_domain);

-- template_parameters
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_param ON template_parameters (template_id, param_key);
CREATE INDEX IF NOT EXISTS idx_param_template ON template_parameters (template_id);
CREATE INDEX IF NOT EXISTS idx_param_category ON template_parameters (category);

-- users
CREATE INDEX IF NOT EXISTS idx_user_level ON user_profiles(domain_level);

-- generated_scripts
CREATE INDEX IF NOT EXISTS idx_script_template ON generated_scripts (template_id);
CREATE INDEX IF NOT EXISTS idx_generation_method ON generated_scripts (generation_method);
CREATE INDEX IF NOT EXISTS idx_validation_status ON generated_scripts (validation_status);

-- validation_results
CREATE INDEX IF NOT EXISTS idx_validation_script ON validation_results (script_id);
CREATE INDEX IF NOT EXISTS idx_validation_type ON validation_results (validation_type);
CREATE INDEX IF NOT EXISTS idx_validation_result ON validation_results (passed, validated_at DESC);

-- game_sessions
-- partial unique index: ensure a user has at most one active/paused session per script
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_script_active ON game_sessions (id, script_id) WHERE status IN ('active', 'paused');
CREATE INDEX IF NOT EXISTS idx_session_user ON game_sessions (id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_status ON game_sessions (status);
CREATE INDEX IF NOT EXISTS idx_session_script ON game_sessions (script_id);

-- game_actions
CREATE INDEX IF NOT EXISTS idx_action_session ON game_actions (session_id, action_timestamp);
CREATE INDEX IF NOT EXISTS idx_action_type ON game_actions (action_type);
CREATE INDEX IF NOT EXISTS idx_action_user ON game_actions (id, action_type);

-- learning_analytics
CREATE INDEX IF NOT EXISTS idx_analytics_user ON learning_analytics (id, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_script ON learning_analytics (script_id);
CREATE INDEX IF NOT EXISTS idx_analytics_score ON learning_analytics (overall_score DESC);

-- learning_nodes
CREATE INDEX IF NOT EXISTS idx_node_script ON learning_nodes (script_id);
CREATE INDEX IF NOT EXISTS idx_node_type ON learning_nodes (node_type);
CREATE INDEX IF NOT EXISTS idx_node_scene ON learning_nodes (script_id, scene_location);
CREATE INDEX IF NOT EXISTS idx_node_course ON learning_nodes (course);

-- user_responses
CREATE INDEX IF NOT EXISTS idx_response_session ON user_responses (session_id, node_id);
CREATE INDEX IF NOT EXISTS idx_response_user ON user_responses (id, input_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_response_correctness ON user_responses (is_correct);

-- clue_triggers
CREATE INDEX IF NOT EXISTS idx_trigger_script ON clue_triggers (script_id);
CREATE INDEX IF NOT EXISTS idx_trigger_target ON clue_triggers (target_clue_id);
CREATE INDEX IF NOT EXISTS idx_trigger_type ON clue_triggers (trigger_type);

-- feedback_rules
CREATE INDEX IF NOT EXISTS idx_feedback_script ON feedback_rules (script_id, node_id);
CREATE INDEX IF NOT EXISTS idx_feedback_condition ON feedback_rules (condition_type);

-- ai_context_sessions
CREATE INDEX IF NOT EXISTS idx_ai_context_session ON ai_context_sessions (session_id, context_type);
CREATE INDEX IF NOT EXISTS idx_ai_context_active ON ai_context_sessions (is_active, last_used_at DESC);

-- ai_context_messages
CREATE INDEX IF NOT EXISTS idx_ai_messages_context ON ai_context_messages (context_id, created_at);

-- context_vectors
CREATE INDEX IF NOT EXISTS idx_context_vectors_message ON context_vectors (message_id);
CREATE INDEX IF NOT EXISTS idx_context_vectors_qdrant ON context_vectors (qdrant_point_id);

-- learning_schedule
CREATE INDEX IF NOT EXISTS idx_schedule_users ON learning_schedule (id, planned_time);
CREATE INDEX IF NOT EXISTS idx_schedule_status ON learning_schedule (status);
CREATE INDEX IF NOT EXISTS idx_schedule_priority ON learning_schedule (priority_level);

-- 添加注释以说明表之间的关系
COMMENT ON TABLE script_templates IS '剧本模板表，存储不同历史时期的剧本模板';
COMMENT ON TABLE template_parameters IS '模板参数表，定义剧本生成时可调整的参数';
COMMENT ON TABLE users IS '用户表，存储用户信息和学习画像';
COMMENT ON TABLE generated_scripts IS '生成的剧本表，存储AI或手动生成的剧本实例';
COMMENT ON TABLE validation_results IS '验证结果表，存储剧本的验证结果';
COMMENT ON TABLE game_sessions IS '游戏会话表，记录用户的游戏进度和状态';
COMMENT ON TABLE game_actions IS '游戏行为表，记录用户在游戏中的具体行为';
COMMENT ON TABLE learning_analytics IS '学习分析表，记录用户的学习表现和统计数据';
COMMENT ON TABLE learning_nodes IS '学习节点表，包含问题、线索、对话等游戏内容';
COMMENT ON TABLE user_responses IS '用户回答表，记录用户对学习节点的回答';
COMMENT ON TABLE clue_triggers IS '线索触发表，定义游戏中的触发条件和动作';
COMMENT ON TABLE feedback_rules IS '反馈规则表，定义系统反馈的规则';
COMMENT ON TABLE ai_context_sessions IS 'AI上下文会话表，管理AI对话的上下文';
COMMENT ON TABLE ai_context_messages IS 'AI上下文消息表，存储AI对话的消息历史';
COMMENT ON TABLE context_vectors IS '上下文向量表，存储对话的向量表示，用于检索';
COMMENT ON TABLE learning_schedule IS '学习计划表，管理用户的学习计划和进度';

-- 添加更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要更新时间戳的表添加触发器
CREATE TRIGGER update_script_templates_updated_at 
    BEFORE UPDATE ON script_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_nodes_updated_at 
    BEFORE UPDATE ON learning_nodes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加游戏会话状态更新触发器
CREATE OR REPLACE FUNCTION update_game_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = CURRENT_TIMESTAMP;
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_session_updated_at 
    BEFORE UPDATE ON game_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_game_session_timestamp();

-- 添加用户登录时间更新触发器
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_login = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_last_login 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_user_last_login();
    
-- ============================================================
-- Tracking & Analytics Module (Requirements 5.1–5.6)
-- PostgreSQL-flavoured DDL (adapt as needed)
-- ============================================================

-- Optional (Postgres): UUID generation
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------
-- Core identity / tenancy
-- -------------------------

-- Telemetry/sharing consent (minimal + explicit)
CREATE TABLE IF NOT EXISTS user_consent (
  consent_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type       TEXT NOT NULL, -- e.g. 'telemetry', 'group_analytics_share', 'external_import'
  granted            BOOLEAN NOT NULL,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, consent_type)
);

-- -------------------------
-- Cross-platform integration (5.6)
-- -------------------------
CREATE TABLE IF NOT EXISTS device (
  device_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform           TEXT NOT NULL,  -- e.g. 'visionos', 'ios', 'android', 'web'
  device_model       TEXT,
  os_version         TEXT,
  app_version        TEXT,
  timezone           TEXT,           -- e.g. 'Asia/Singapore'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at       TIMESTAMPTZ
);

-- External source registry (e.g. “Notion”, “Google Drive”, “LMS”, “Anki”)
CREATE TABLE IF NOT EXISTS external_data_source (
  source_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key         TEXT NOT NULL UNIQUE, -- stable identifier (e.g. 'google_drive')
  display_name       TEXT NOT NULL,
  category           TEXT NOT NULL,        -- e.g. 'storage', 'lms', 'flashcards'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user connection to an external source (tokens stored by your chosen secret strategy)
CREATE TABLE IF NOT EXISTS user_source_connection (
  connection_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id          UUID NOT NULL REFERENCES external_data_source(source_id) ON DELETE RESTRICT,
  status             TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'error'
  external_user_ref  TEXT,                           -- opaque id from provider
  scopes             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  token_ref          TEXT,                           -- pointer to secrets vault / KMS record
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, source_id)
);

-- Sync job bookkeeping (pull/push)
CREATE TABLE IF NOT EXISTS data_sync_run (
  sync_run_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id      UUID NOT NULL REFERENCES user_source_connection(connection_id) ON DELETE CASCADE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at        TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'partial', 'failed'
  records_in         INTEGER NOT NULL DEFAULT 0,
  records_out        INTEGER NOT NULL DEFAULT 0,
  error_code         TEXT,
  error_detail       TEXT
);

-- Optional: store raw imported events/material references (keep minimal; consider retention policy)
CREATE TABLE IF NOT EXISTS imported_record (
  imported_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id        UUID NOT NULL REFERENCES data_sync_run(sync_run_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_type        TEXT NOT NULL, -- e.g. 'material', 'attempt', 'review'
  external_record_id TEXT,
  occurred_at        TIMESTAMPTZ,
  payload            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_imported_record_user_time
  ON imported_record (id, occurred_at DESC);

-- -------------------------
-- Learning content & curriculum mapping (supports 5.5)
-- -------------------------
CREATE TABLE IF NOT EXISTS learning_material (
  material_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  material_type      TEXT NOT NULL, -- e.g. 'note', 'flashcard', 'video', 'pdf', 'mindmap'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Curriculum / benchmarks (generic: can represent a syllabus, textbook chapters, standards)
CREATE TABLE IF NOT EXISTS curriculum_benchmark (
  benchmark_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_key      TEXT NOT NULL UNIQUE, -- stable (e.g. 'cs101.week3.big_o')
  title              TEXT NOT NULL,
  description        TEXT,
  difficulty_level   INTEGER,              -- optional coarse level
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many mapping: which materials/assessments align to which benchmark(s)
CREATE TABLE IF NOT EXISTS material_benchmark_map (
  material_id        UUID NOT NULL REFERENCES learning_material(material_id) ON DELETE CASCADE,
  benchmark_id       UUID NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  weight             NUMERIC(6,3) NOT NULL DEFAULT 1.000, -- relevance weight
  PRIMARY KEY (material_id, benchmark_id)
);

CREATE INDEX IF NOT EXISTS idx_material_benchmark_benchmark
  ON material_benchmark_map (benchmark_id);

-- -------------------------
-- Atomic learning event stream (basis for 5.1, 5.4, 5.6)
-- -------------------------
-- This event log supports “beyond charts” analytics by enabling multiple derived views:
-- forgetting curve inputs, heatmaps, interleaving metrics, gap analysis, etc.
CREATE TABLE IF NOT EXISTS learning_event (
  event_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id          UUID REFERENCES device(device_id) ON DELETE SET NULL,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,

  event_type         TEXT NOT NULL,
  -- e.g. 'material_open', 'practice_start', 'practice_end',
  --      'question_answered', 'quiz_submitted', 'srs_review'

  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms        INTEGER,        -- optional: time spent
  context            JSONB NOT NULL DEFAULT '{}'::jsonb
  -- examples:
  -- { "session_id": "...", "topic": "...", "difficulty": 3, "correct": true,
  --   "question_id": "...", "attempt_no": 2, "interleaving_block": 5 }
);

CREATE INDEX IF NOT EXISTS idx_learning_event_user_time
  ON learning_event (id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_event_type_time
  ON learning_event (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_event_material_time
  ON learning_event (material_id, occurred_at DESC);

-- Optional: explicit session table (useful for interleaving computation & UI drill-down)
CREATE TABLE IF NOT EXISTS learning_session (
  session_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id          UUID REFERENCES device(device_id) ON DELETE SET NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  session_type       TEXT NOT NULL DEFAULT 'study', -- 'study', 'practice', 'quiz'
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_learning_session_user_time
  ON learning_session (id, started_at DESC);

-- -------------------------
-- Forgetting curve + spaced repetition tracking (5.1)
-- -------------------------
-- A “memory item” is a unit you track retention for (flashcard, concept, benchmark, etc.)
CREATE TABLE IF NOT EXISTS memory_item (
  memory_item_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  benchmark_id       UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived'
  UNIQUE (id, material_id, benchmark_id)
);

-- Review log drives the forgetting curve model and next review scheduling
CREATE TABLE IF NOT EXISTS memory_review (
  review_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_item_id     UUID NOT NULL REFERENCES memory_item(memory_item_id) ON DELETE CASCADE,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  grade              INTEGER NOT NULL,    -- e.g. 0..5 or 0..3 depending on your model
  correct            BOOLEAN,
  response_time_ms   INTEGER,
  interval_days      NUMERIC(10,3),       -- interval used after this review
  ease_factor        NUMERIC(10,6),       -- model parameter after this review (if using SM-2-like)
  model_state        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_memory_review_item_time
  ON memory_review (memory_item_id, occurred_at DESC);

-- Optional per-user model parameters (if you personalise the forgetting curve)
CREATE TABLE IF NOT EXISTS user_forgetting_model (
  id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  model_name         TEXT NOT NULL DEFAULT 'default',
  parameters         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional per-item retention prediction snapshot (for fast dashboards)
CREATE TABLE IF NOT EXISTS memory_retention_snapshot (
  snapshot_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_item_id     UUID NOT NULL REFERENCES memory_item(memory_item_id) ON DELETE CASCADE,
  predicted_recall   NUMERIC(6,5) NOT NULL, -- 0..1
  as_of              TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_review_at     TIMESTAMPTZ,
  UNIQUE (id, memory_item_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_retention_snapshot_user_time
  ON memory_retention_snapshot (id, as_of DESC);

-- -------------------------
-- Heatmaps (5.1)
-- -------------------------
-- Aggregated activity grid (e.g. day_of_week x hour_of_day), derived from learning_event/session
CREATE TABLE IF NOT EXISTS user_activity_heatmap (
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start       DATE NOT NULL,  -- e.g. Monday of the week, or first day of month
  period_kind        TEXT NOT NULL,  -- 'week', 'month'
  day_of_week        SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day        SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  active_minutes     INTEGER NOT NULL DEFAULT 0,
  events_count       INTEGER NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, period_start, period_kind, day_of_week, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_heatmap_user_period
  ON user_activity_heatmap (id, period_kind, period_start DESC);

-- -------------------------
-- Interleaved practice statistics (5.1)
-- -------------------------
-- Track practice blocks and topic switches to compute interleaving indicators.
CREATE TABLE IF NOT EXISTS practice_block (
  block_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id         UUID REFERENCES learning_session(session_id) ON DELETE CASCADE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at           TIMESTAMPTZ,
  intended_goal      TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Each item attempted within a block; topic/benchmark enables interleaving metrics.
CREATE TABLE IF NOT EXISTS practice_item_attempt (
  attempt_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id           UUID REFERENCES practice_block(block_id) ON DELETE CASCADE,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  benchmark_id       UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  difficulty_level   INTEGER,
  correct            BOOLEAN,
  response_time_ms   INTEGER,
  attempt_no         INTEGER NOT NULL DEFAULT 1,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_practice_attempt_user_time
  ON practice_item_attempt (id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_attempt_block_time
  ON practice_item_attempt (block_id, occurred_at);

-- Aggregated interleaving stats per user (for dashboard quick rendering)
CREATE TABLE IF NOT EXISTS user_interleaving_stats (
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start       DATE NOT NULL,
  period_kind        TEXT NOT NULL, -- 'week', 'month'
  total_attempts     INTEGER NOT NULL DEFAULT 0,
  topic_switches     INTEGER NOT NULL DEFAULT 0,
  unique_benchmarks  INTEGER NOT NULL DEFAULT 0,
  -- Example: higher = more interleaving; define formula in analytics layer
  interleaving_index NUMERIC(10,6) NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, period_start, period_kind)
);

-- -------------------------
-- Predictive learning pathways (5.3)
-- -------------------------
-- A learning path is a sequenced plan; AI predictions can generate/refresh it.
CREATE TABLE IF NOT EXISTS learning_path (
  path_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active', -- 'active', 'archived'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  source             TEXT NOT NULL DEFAULT 'ai',     -- 'ai', 'manual', 'imported'
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS learning_path_item (
  path_item_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id            UUID NOT NULL REFERENCES learning_path(path_id) ON DELETE CASCADE,
  ordinal            INTEGER NOT NULL,
  benchmark_id       UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  target_difficulty  INTEGER,
  scheduled_for      TIMESTAMPTZ,
  rationale          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (path_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_path_item_path_ord
  ON learning_path_item (path_id, ordinal);

-- Store the AI “prediction run” (versioning and audit)
CREATE TABLE IF NOT EXISTS learning_path_prediction (
  prediction_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_name         TEXT NOT NULL,
  model_version      TEXT,
  inputs_summary     JSONB NOT NULL DEFAULT '{}'::jsonb,
  outputs_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  error_detail       TEXT
);

CREATE INDEX IF NOT EXISTS idx_path_prediction_user_time
  ON learning_path_prediction (id, created_at DESC);

-- -------------------------
-- AI-driven content gap analysis + recommendations (5.5)
-- -------------------------
-- Per-user mastery state per benchmark (derived from attempts/reviews)
CREATE TABLE IF NOT EXISTS user_benchmark_mastery (
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id       UUID NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  mastery_score      NUMERIC(6,5) NOT NULL DEFAULT 0, -- 0..1
  confidence         NUMERIC(6,5) NOT NULL DEFAULT 0, -- 0..1
  last_evaluated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, benchmark_id)
);

-- Gap analysis run record (audit + explainability)
CREATE TABLE IF NOT EXISTS gap_analysis_run (
  gap_run_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_name         TEXT NOT NULL,
  model_version      TEXT,
  status             TEXT NOT NULL DEFAULT 'success', -- 'success', 'failed'
  notes              TEXT,
  inputs_summary     JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Individual gaps identified by a run
CREATE TABLE IF NOT EXISTS identified_gap (
  gap_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_run_id         UUID NOT NULL REFERENCES gap_analysis_run(gap_run_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  benchmark_id       UUID NOT NULL REFERENCES curriculum_benchmark(benchmark_id) ON DELETE CASCADE,
  severity           INTEGER NOT NULL DEFAULT 1, -- 1..5
  reason             TEXT,
  supporting_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identified_gap_user_time
  ON identified_gap (id, created_at DESC);

-- Targeted lesson/material recommendations produced from gaps
CREATE TABLE IF NOT EXISTS lesson_recommendation (
  recommendation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gap_id             UUID REFERENCES identified_gap(gap_id) ON DELETE SET NULL,
  benchmark_id       UUID REFERENCES curriculum_benchmark(benchmark_id) ON DELETE SET NULL,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL DEFAULT 'lesson', -- 'lesson', 'practice', 'review'
  priority           INTEGER NOT NULL DEFAULT 1,       -- 1..5
  rationale          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at        TIMESTAMPTZ,
  dismissed_at       TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'open'      -- 'open', 'accepted', 'dismissed'
);

CREATE INDEX IF NOT EXISTS idx_recommendation_user_status
  ON lesson_recommendation (id, status, created_at DESC);

-- -------------------------
-- Collaborative anonymized analytics (5.4)
-- -------------------------
CREATE TABLE IF NOT EXISTS learning_group (
  group_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  visibility         TEXT NOT NULL DEFAULT 'private', -- 'private', 'invite', 'public'
  analytics_sharing  TEXT NOT NULL DEFAULT 'anonymized_only', -- enforce policy at query layer
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS learning_group_member (
  group_id           UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role               TEXT NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member'
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, id)
);

-- Pseudonymous alias per member per group (so UI can show “Member A/B” without exposing identity)
CREATE TABLE IF NOT EXISTS group_member_alias (
  group_id           UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias_key          TEXT NOT NULL, -- e.g. 'member_07' (generated server-side)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, id),
  UNIQUE (group_id, alias_key)
);

-- Group goals for motivation / goal-setting
CREATE TABLE IF NOT EXISTS group_goal (
  goal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  metric_type        TEXT NOT NULL, -- e.g. 'study_minutes', 'reviews', 'mastery_gain'
  target_value       NUMERIC(14,4) NOT NULL,
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Aggregated, anonymized group analytics snapshot (never store raw peer rows here)
CREATE TABLE IF NOT EXISTS group_analytics_snapshot (
  snapshot_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  period_start       DATE NOT NULL,
  period_kind        TEXT NOT NULL, -- 'week', 'month'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  member_count       INTEGER NOT NULL DEFAULT 0,
  -- Example aggregated metrics (extend as needed)
  avg_study_minutes  NUMERIC(14,4) NOT NULL DEFAULT 0,
  avg_predicted_recall NUMERIC(6,5) NOT NULL DEFAULT 0,
  avg_interleaving_index NUMERIC(10,6) NOT NULL DEFAULT 0,
  avg_mastery_score  NUMERIC(6,5) NOT NULL DEFAULT 0,

  distribution        JSONB NOT NULL DEFAULT '{}'::jsonb
  -- e.g. histograms/percentiles: { "study_minutes_p50":..., "p90":..., "bins":[...] }
);

CREATE INDEX IF NOT EXISTS idx_group_snapshot_group_time
  ON group_analytics_snapshot (group_id, period_kind, period_start DESC);

-- Optional: per-member contribution to group metrics stored as anonymized buckets only
-- (Use with care: do not store direct id if you must ensure strict anonymity)
CREATE TABLE IF NOT EXISTS group_member_metric_bucket (
  bucket_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES learning_group(group_id) ON DELETE CASCADE,
  period_start       DATE NOT NULL,
  period_kind        TEXT NOT NULL,
  alias_key          TEXT NOT NULL, -- references group_member_alias.alias_key (no id)
  metric_type        TEXT NOT NULL,
  metric_value       NUMERIC(14,4) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_member_bucket_group_time
  ON group_member_metric_bucket (group_id, period_kind, period_start DESC);

-- -------------------------
-- Dashboard configuration + cached metric panels (5.1, 5.2)
-- -------------------------
-- Store user dashboard layout and widget configuration (supports “beyond simple charts”)
CREATE TABLE IF NOT EXISTS dashboard_config (
  dashboard_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL DEFAULT 'Default',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  layout             JSONB NOT NULL DEFAULT '{}'::jsonb, -- grid layout, ordering, sizes
  UNIQUE (id, name)
);

CREATE TABLE IF NOT EXISTS dashboard_widget (
  widget_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id       UUID NOT NULL REFERENCES dashboard_config(dashboard_id) ON DELETE CASCADE,
  widget_type        TEXT NOT NULL, -- 'forgetting_curve', 'heatmap', 'interleaving', 'gaps', etc.
  title              TEXT,
  config             JSONB NOT NULL DEFAULT '{}'::jsonb, -- chart settings, filters
  ordinal            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widget_dash_ord
  ON dashboard_widget (dashboard_id, ordinal);

-- Cached “panel data” for fast UI rendering (generated by analytics jobs)
CREATE TABLE IF NOT EXISTS dashboard_panel_cache (
  cache_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type        TEXT NOT NULL,
  cache_key          TEXT NOT NULL, -- e.g. "forgetting_curve:last_30_days"
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until        TIMESTAMPTZ,
  data              JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, widget_type, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_panel_cache_user_time
  ON dashboard_panel_cache (id, generated_at DESC);
-- ============================================================
-- Comprehension & Reasoning Module (Requirements 2.1–2.5)
-- PostgreSQL-flavoured DDL (adapt as needed)
-- Depends on: users(id), learning_material(material_id)
-- ============================================================

-- -------------------------
-- Material segmentation + extracted knowledge
-- (supports 2.1, 2.2, 2.3 provenance and alignment)
-- -------------------------
CREATE TABLE IF NOT EXISTS material_segment (
  segment_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id        UUID NOT NULL REFERENCES learning_material(material_id) ON DELETE CASCADE,
  ordinal            INTEGER NOT NULL,
  language_code      TEXT NOT NULL, -- e.g. 'en', 'zh'
  start_offset       INTEGER,        -- optional: char offset in original material
  end_offset         INTEGER,        -- optional: char offset in original material
  source_text        TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_material_segment_material_ord
  ON material_segment (material_id, ordinal);

-- Canonical concept objects extracted/curated (can be user-scoped or global)
CREATE TABLE IF NOT EXISTS concept (
  concept_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL => global/shared library
  language_code      TEXT NOT NULL,
  name               TEXT NOT NULL,
  short_definition   TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_owner_name
  ON concept (owner_id, name);

-- Concepts present in a specific segment (with salience/confidence)
CREATE TABLE IF NOT EXISTS segment_concept (
  segment_id         UUID NOT NULL REFERENCES material_segment(segment_id) ON DELETE CASCADE,
  concept_id         UUID NOT NULL REFERENCES concept(concept_id) ON DELETE CASCADE,
  salience           NUMERIC(6,5) NOT NULL DEFAULT 0,  -- 0..1
  confidence         NUMERIC(6,5) NOT NULL DEFAULT 0,  -- 0..1
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (segment_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_concept_concept
  ON segment_concept (concept_id);

-- Relationships between concepts (causes, mechanisms, links, etc.)
CREATE TABLE IF NOT EXISTS concept_relation (
  relation_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE CASCADE,
  from_concept_id    UUID NOT NULL REFERENCES concept(concept_id) ON DELETE CASCADE,
  to_concept_id      UUID NOT NULL REFERENCES concept(concept_id) ON DELETE CASCADE,
  relation_type      TEXT NOT NULL,  -- e.g. 'causes', 'enables', 'part_of', 'contrasts', 'leads_to'
  confidence         NUMERIC(6,5) NOT NULL DEFAULT 0,
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_relation_material
  ON concept_relation (material_id, relation_type);

-- -------------------------
-- AI generation run audit (shared across 2.1–2.5)
-- -------------------------
CREATE TABLE IF NOT EXISTS ai_generation_run (
  run_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  segment_id         UUID REFERENCES material_segment(segment_id) ON DELETE SET NULL,

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

CREATE INDEX IF NOT EXISTS idx_ai_run_user_time
  ON ai_generation_run (id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_run_type_time
  ON ai_generation_run (run_type, created_at DESC);

-- -------------------------
-- 2.1 Comprehension question generation (why/how; difficulty levels)
-- -------------------------
CREATE TABLE IF NOT EXISTS comprehension_question (
  question_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  material_id        UUID NOT NULL REFERENCES learning_material(material_id) ON DELETE CASCADE,
  segment_id         UUID REFERENCES material_segment(segment_id) ON DELETE SET NULL,

  target_concept_id  UUID REFERENCES concept(concept_id) ON DELETE SET NULL,
  question_type      TEXT NOT NULL,      -- 'why' | 'how'
  difficulty_level   INTEGER NOT NULL,   -- define your scale (e.g. 1..5)
  reasoning_focus    TEXT,               -- e.g. 'cause', 'mechanism', 'link_between_ideas'
  question_text      TEXT NOT NULL,

  rubric             JSONB NOT NULL DEFAULT '{}'::jsonb, -- expected points/criteria
  teacher_notes      TEXT,                               -- optional: guidance for reviewers
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_question_material
  ON comprehension_question (material_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comp_question_segment
  ON comprehension_question (segment_id);

-- Assign questions to a learner and track lifecycle
CREATE TABLE IF NOT EXISTS user_question_assignment (
  assignment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id        UUID NOT NULL REFERENCES comprehension_question(question_id) ON DELETE CASCADE,
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at             TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'open', -- 'open', 'answered', 'skipped'
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_user_status
  ON user_question_assignment (id, status, assigned_at DESC);

-- Learner responses + feedback (manual or AI-assisted)
CREATE TABLE IF NOT EXISTS user_question_response (
  response_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id      UUID NOT NULL REFERENCES user_question_assignment(assignment_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id        UUID NOT NULL REFERENCES comprehension_question(question_id) ON DELETE CASCADE,
  responded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  response_text      TEXT NOT NULL,
  score              NUMERIC(6,3),           -- optional
  feedback_text      TEXT,                   -- optional
  feedback_rubric    JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback_run_id    UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_question_response_user_time
  ON user_question_response (id, responded_at DESC);

-- -------------------------
-- 2.2 Passage rewriting (simple language; bilingual; side-by-side)
-- -------------------------
CREATE TABLE IF NOT EXISTS passage_rewrite (
  rewrite_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id        UUID NOT NULL REFERENCES learning_material(material_id) ON DELETE CASCADE,
  segment_id         UUID REFERENCES material_segment(segment_id) ON DELETE SET NULL,

  source_language    TEXT NOT NULL, -- 'en' | 'zh'
  target_language    TEXT NOT NULL, -- 'en' | 'zh' (can be same language)
  simplification_level INTEGER NOT NULL DEFAULT 1, -- define scale (e.g. 1..3)
  source_text        TEXT NOT NULL,
  simplified_text    TEXT NOT NULL,

  -- Optional alignment for side-by-side UI (sentence mapping, offsets, etc.)
  alignment_map      JSONB NOT NULL DEFAULT '{}'::jsonb,
  readability_metrics JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. length, vocab stats
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewrite_user_time
  ON passage_rewrite (id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rewrite_material_segment
  ON passage_rewrite (material_id, segment_id);

-- -------------------------
-- 2.3 Analogies and metaphors (template library + generated outputs)
-- -------------------------
CREATE TABLE IF NOT EXISTS metaphor_template (
  template_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL => shared library
  language_code      TEXT NOT NULL,
  template_name      TEXT NOT NULL,
  template_text      TEXT NOT NULL, -- supports placeholders; interpretation handled in app logic
  tags               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  enabled            BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metaphor_template_owner_enabled
  ON metaphor_template (owner_id, enabled);

CREATE TABLE IF NOT EXISTS generated_analogy (
  analogy_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id        UUID NOT NULL REFERENCES learning_material(material_id) ON DELETE CASCADE,
  segment_id         UUID REFERENCES material_segment(segment_id) ON DELETE SET NULL,

  target_concept_id  UUID REFERENCES concept(concept_id) ON DELETE SET NULL,
  template_id        UUID REFERENCES metaphor_template(template_id) ON DELETE SET NULL,

  analogy_text       TEXT NOT NULL,
  explanation_text   TEXT,                -- clarifies mapping back to the concept
  confidence         NUMERIC(6,5) NOT NULL DEFAULT 0,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analogy_user_time
  ON generated_analogy (id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analogy_concept
  ON generated_analogy (target_concept_id);

-- -------------------------
-- 2.4 Guided brainstorming (Who/What/Why/How prompts + learner inputs)
-- -------------------------
CREATE TABLE IF NOT EXISTS brainstorming_session (
  brainstorm_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  topic_title        TEXT NOT NULL,
  language_code      TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_user_time
  ON brainstorming_session (id, created_at DESC);

CREATE TABLE IF NOT EXISTS brainstorming_prompt (
  prompt_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brainstorm_session_id UUID NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  dimension          TEXT NOT NULL,  -- 'who' | 'what' | 'why' | 'how'
  ordinal            INTEGER NOT NULL DEFAULT 0,
  prompt_text        TEXT NOT NULL,
  run_id             UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI-generated prompts
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_prompt_session_dim
  ON brainstorming_prompt (brainstorm_session_id, dimension, ordinal);

CREATE TABLE IF NOT EXISTS brainstorming_response (
  response_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id          UUID NOT NULL REFERENCES brainstorming_prompt(prompt_id) ON DELETE CASCADE,
  brainstorm_session_id UUID NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  responded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_text      TEXT NOT NULL,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_brainstorm_response_user_time
  ON brainstorming_response (id, responded_at DESC);

-- Optional: store the resulting structured outline/mind map from brainstorming
CREATE TABLE IF NOT EXISTS brainstorming_artifact (
  artifact_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brainstorm_session_id UUID NOT NULL REFERENCES brainstorming_session(brainstorm_session_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_type      TEXT NOT NULL DEFAULT 'outline', -- 'outline', 'mindmap', 'summary'
  content            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------
-- 2.5 Socratic dialogue mode (turn-based; hints; partial feedback)
-- -------------------------
CREATE TABLE IF NOT EXISTS socratic_session (
  socratic_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  material_id        UUID REFERENCES learning_material(material_id) ON DELETE SET NULL,
  seed_question_id   UUID REFERENCES comprehension_question(question_id) ON DELETE SET NULL,
  language_code      TEXT NOT NULL,
  difficulty_level   INTEGER NOT NULL DEFAULT 1,
  goal              TEXT, -- e.g. "derive explanation", "correct misconception", "solve problem"
  status            TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'archived'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_socratic_session_user_time
  ON socratic_session (id, created_at DESC);

-- Turn log: user messages + system follow-ups/hints/feedback
CREATE TABLE IF NOT EXISTS socratic_turn (
  turn_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socratic_session_id UUID NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  ordinal            INTEGER NOT NULL,
  role               TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  turn_kind          TEXT NOT NULL, -- 'question', 'answer', 'hint', 'feedback', 'probe'
  content            TEXT NOT NULL,
  run_id             UUID REFERENCES ai_generation_run(run_id) ON DELETE SET NULL, -- if AI produced this turn
  tags               JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. { "misconception": "...", "strategy": "scaffold" }
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (socratic_session_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_socratic_turn_session_ord
  ON socratic_turn (socratic_session_id, ordinal);

-- Optional: persistent “state” for guided reasoning (what the system believes is understood)
CREATE TABLE IF NOT EXISTS socratic_state_snapshot (
  snapshot_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socratic_session_id UUID NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  as_of              TIMESTAMPTZ NOT NULL DEFAULT now(),
  state              JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (socratic_session_id, as_of)
);

CREATE INDEX IF NOT EXISTS idx_socratic_state_user_time
  ON socratic_state_snapshot (id, as_of DESC);

-- Optional: misconception library + observations (helps “correct misconceptions” requirement)
CREATE TABLE IF NOT EXISTS misconception (
  misconception_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL => shared library
  language_code      TEXT NOT NULL,
  concept_id         UUID REFERENCES concept(concept_id) ON DELETE SET NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS socratic_misconception_observation (
  observation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  socratic_session_id UUID NOT NULL REFERENCES socratic_session(socratic_session_id) ON DELETE CASCADE,
  misconception_id   UUID NOT NULL REFERENCES misconception(misconception_id) ON DELETE CASCADE,
  confidence         NUMERIC(6,5) NOT NULL DEFAULT 0,
  observed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_misconception_obs_session
  ON socratic_misconception_observation (socratic_session_id, observed_at DESC);