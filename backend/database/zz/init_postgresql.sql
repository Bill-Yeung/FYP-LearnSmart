CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USER MANAGEMENT TABLES

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
  last_login TIMESTAMP,
  domain_level VARCHAR(20) DEFAULT 'beginner'
        CHECK (domain_level IN ('beginner', 'intermediate', 'advanced')),
  difficulty_preference VARCHAR(10) DEFAULT 'medium'
        CHECK (difficulty_preference IN ('easy', 'medium', 'hard', 'adaptive')),
  ai_assistance_level VARCHAR(10) DEFAULT 'moderate'
        CHECK (ai_assistance_level IN ('minimal', 'moderate', 'full')),
  total_play_time_minutes INT DEFAULT 0,
  scripts_completed INT DEFAULT 0
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE UNIQUE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;

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

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

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

CREATE INDEX idx_activity_user ON user_activity_log(user_id);
CREATE INDEX idx_activity_type ON user_activity_log(action_type);
CREATE INDEX idx_activity_resource ON user_activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_created ON user_activity_log(created_at);

-- =============================================================================
-- CORE TABLES

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE INDEX idx_concepts_type ON concepts(concept_type);
CREATE INDEX idx_concepts_difficulty ON concepts(difficulty_level);
CREATE INDEX idx_concepts_base_form ON concepts(base_form) WHERE base_form IS NOT NULL;
CREATE INDEX idx_concepts_created_by ON concepts(created_by);
CREATE INDEX idx_concepts_system ON concepts(is_system_generated);
CREATE INDEX idx_concepts_public ON concepts(is_public);

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

CREATE INDEX idx_concept_trans_concept ON concept_translations(concept_id);
CREATE INDEX idx_concept_trans_language ON concept_translations(language);
CREATE INDEX idx_concept_trans_primary ON concept_translations(concept_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_concept_trans_quality ON concept_translations(translation_quality);
CREATE INDEX idx_concept_trans_title ON concept_translations(title);
CREATE INDEX idx_concept_trans_title_trgm ON concept_translations USING GIN(title gin_trgm_ops);
CREATE INDEX idx_concept_trans_keywords ON concept_translations USING GIN(keywords);
CREATE INDEX idx_concept_trans_created_by ON concept_translations(created_by);

CREATE TABLE IF NOT EXISTS taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lcc_code VARCHAR(20) NOT NULL UNIQUE,
  lcc_label VARCHAR(255) NOT NULL,
  lcc_hierarchy_level INTEGER NOT NULL,
  parent_lcc_code VARCHAR(20) REFERENCES taxonomy_nodes(lcc_code),
  scope_note TEXT,
  last_verified_date TIMESTAMP
);

CREATE INDEX idx_taxonomy_lcc ON taxonomy_nodes(lcc_code);
CREATE INDEX idx_taxonomy_parent ON taxonomy_nodes(parent_lcc_code);
CREATE INDEX idx_taxonomy_level ON taxonomy_nodes(lcc_hierarchy_level);

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

CREATE INDEX idx_concept_tax_concept ON concept_taxonomy(concept_id);
CREATE INDEX idx_concept_tax_taxonomy ON concept_taxonomy(taxonomy_node_id);
CREATE INDEX idx_concept_tax_created_by ON concept_taxonomy(created_by);
CREATE INDEX idx_concept_tax_primary ON concept_taxonomy(is_primary);

-- =============================================================================
-- TYPE-SPECIFIC EXTENSION TABLES

CREATE TABLE IF NOT EXISTS procedure_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  expected_duration_minutes INTEGER,
  stored_in_neo4j BOOLEAN DEFAULT false -- True if steps stored in Neo4j (complex procedures with branching/recursion)
);

CREATE INDEX idx_procedure_concept ON procedure_details(concept_id);
CREATE INDEX idx_procedure_neo4j_flag ON procedure_details(stored_in_neo4j);

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

CREATE INDEX idx_procedure_trans_procedure ON procedure_translations(procedure_id);
CREATE INDEX idx_procedure_trans_language ON procedure_translations(language);
CREATE INDEX idx_procedure_trans_primary ON procedure_translations(procedure_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_procedure_trans_steps ON procedure_translations USING GIN(steps);
CREATE INDEX idx_procedure_trans_created_by ON procedure_translations(created_by);

CREATE TABLE IF NOT EXISTS example_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  media_refs UUID[] -- References to assets
);

CREATE INDEX idx_example_concept ON example_details(concept_id);

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

CREATE INDEX idx_example_trans_example ON example_translations(example_id);
CREATE INDEX idx_example_trans_language ON example_translations(language);
CREATE INDEX idx_example_trans_primary ON example_translations(example_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_example_trans_created_by ON example_translations(created_by);

CREATE TABLE IF NOT EXISTS assessment_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE UNIQUE,
  question_type VARCHAR(50) CHECK (question_type IN ('multiple_choice', 'short_answer', 'code', 'essay')),
  estimated_time_minutes INTEGER
);

CREATE INDEX idx_assessment_concept ON assessment_details(concept_id);
CREATE INDEX idx_assessment_type ON assessment_details(question_type);

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

CREATE INDEX idx_assessment_trans_assessment ON assessment_translations(assessment_id);
CREATE INDEX idx_assessment_trans_language ON assessment_translations(language);
CREATE INDEX idx_assessment_trans_primary ON assessment_translations(assessment_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_assessment_trans_created_by ON assessment_translations(created_by);

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

CREATE INDEX idx_learning_object_concept ON learning_object_details(concept_id);
CREATE INDEX idx_learning_object_format ON learning_object_details(format);

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

CREATE INDEX idx_learning_object_trans_object ON learning_object_translations(learning_object_id);
CREATE INDEX idx_learning_object_trans_language ON learning_object_translations(language);
CREATE INDEX idx_learning_object_trans_primary ON learning_object_translations(learning_object_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_learning_object_trans_created_by ON learning_object_translations(created_by);

-- =============================================================================
-- RELATIONSHIPS

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

CREATE INDEX idx_relationships_type ON relationships(relationship_type);
CREATE INDEX idx_relationships_suggested ON relationships(suggested_relationship_type) WHERE suggested_relationship_type IS NOT NULL;

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

CREATE INDEX idx_relationship_trans_relationship ON relationship_translations(relationship_id);
CREATE INDEX idx_relationship_trans_language ON relationship_translations(language);
CREATE INDEX idx_relationship_trans_primary ON relationship_translations(relationship_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_relationship_trans_name ON relationship_translations(name);
CREATE INDEX idx_relationship_trans_created_by ON relationship_translations(created_by);

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

CREATE INDEX idx_discovered_type ON discovered_relationships(suggested_relationship);
CREATE INDEX idx_discovered_status ON discovered_relationships(status);
CREATE INDEX idx_discovered_count ON discovered_relationships(occurrence_count DESC);

CREATE TABLE IF NOT EXISTS concept_relationships (
  id SERIAL PRIMARY KEY,
  relationship_id UUID REFERENCES relationships(id) ON DELETE CASCADE,
  source_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  target_concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(relationship_id, source_concept_id, target_concept_id)
);

CREATE INDEX idx_concept_rel_relationship ON concept_relationships(relationship_id);
CREATE INDEX idx_concept_rel_source ON concept_relationships(source_concept_id);
CREATE INDEX idx_concept_rel_target ON concept_relationships(target_concept_id);
CREATE INDEX idx_concept_rel_source_target ON concept_relationships(source_concept_id, target_concept_id);
CREATE INDEX idx_concept_rel_created_by ON concept_relationships(created_by);

-- =============================================================================
-- LEARNING PATHS

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_concept_id UUID REFERENCES concepts(id),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_paths_target ON learning_paths(target_concept_id);
CREATE INDEX idx_learning_paths_created_by ON learning_paths(created_by);

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

CREATE INDEX idx_learning_path_trans_path ON learning_path_translations(learning_path_id);
CREATE INDEX idx_learning_path_trans_language ON learning_path_translations(language);
CREATE INDEX idx_learning_path_trans_primary ON learning_path_translations(learning_path_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_learning_path_trans_created_by ON learning_path_translations(created_by);

CREATE TABLE IF NOT EXISTS learning_path_steps (
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

INSERT INTO user_profiles (user_id, bio, organization, department, level) VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'System administrator account for managing the learning platform',
    'Learning Platform',
    'IT Department',
    'Staff'
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'Demo teacher account for testing educational features',
    'Demo University',
    'Computer Science',
    'Faculty'
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'Demo student account for testing learning features',
    'Demo University',
    'Computer Science',
    'Undergraduate'
  )
ON CONFLICT (user_id) DO NOTHING;

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