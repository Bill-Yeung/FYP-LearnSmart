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
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(relationship_id, source_concept_id, target_concept_id)
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_concept_id UUID REFERENCES concepts(id),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
CREATE INDEX idx_error_book_next_review ON error_book(user_id, next_review_time) WHERE is_mastered = FALSE;
CREATE INDEX idx_exam_questions_concept ON exam_questions USING GIN (related_concept_ids);
CREATE INDEX idx_error_pattern ON error_book USING GIN (error_pattern_tags); 

-- =========================
-- Sample seed data (rerunnable)
-- =========================
-- Known UUIDs used below (for deterministic references)
-- Users: alice 11111111-1111-1111-1111-111111111111, bob 22222222-2222-2222-2222-222222222222, chloe 33333333-3333-3333-3333-333333333333, dan 44444444-4444-4444-4444-444444444444
-- Concepts: geometry aaaaaaaa-0000-0000-0000-000000000001, algebra aaaaaaaa-0000-0000-0000-000000000002, probability aaaaaaaa-0000-0000-0000-000000000003, calculus aaaaaaaa-0000-0000-0000-000000000004, trigonometry aaaaaaaa-0000-0000-0000-000000000005, statistics aaaaaaaa-0000-0000-0000-000000000006

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




-- =============================================================================
-- FR 3.5 Multisensory Encoding
-- =============================================================================
-- =============================================================================
-- FR 3.1 間隔重複排程器 (Spaced Repetition Scheduler)
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
  
  -- [FR 3.3] 緩存主題名稱，加速交錯練習查詢
  topic_cached VARCHAR(100), 
  PRIMARY KEY (flashcard_id, user_id)
);





-- =============================================================================
-- FR 3.4 助記生成器 (Mnemonic Generator)
-- =============================================================================
CREATE TABLE IF NOT EXISTS flashcard_mnemonics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
  
  mnemonic_type VARCHAR(50) CHECK (mnemonic_type IN ('abbreviation', 'acrostic', 'rhyme', 'storytelling', 'visual_association')),
  
  content TEXT NOT NULL,          -- e.g., "Dora: Discover, Offer..."
  ai_generated_reasoning TEXT,    -- AI 解釋為何這樣記有效
  
  is_user_selected BOOLEAN DEFAULT FALSE, -- 使用者選擇使用這條助記
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



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







CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  show_on_profile BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, badge_id, community_id)
);




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




CREATE TABLE IF NOT EXISTS group_challenge_members (
  id SERIAL PRIMARY KEY,
  challenge_id UUID REFERENCES group_challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team VARCHAR(10) NOT NULL CHECK (team IN ('team_a', 'team_b')),
  contribution_score INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, user_id)
);




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




CREATE INDEX idx_shop_items_active ON shop_items(is_active) WHERE is_active = TRUE;

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
    'completed', 'used', 'refunded', 'expired'
  )),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);






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


CREATE INDEX idx_events_active ON events(starts_at, ends_at) WHERE is_active = TRUE;


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

CREATE INDEX idx_active_boosts_user ON active_boosts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_active_boosts_community ON active_boosts(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_active_boosts_active ON active_boosts(expires_at, is_active) WHERE is_active = TRUE;


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





CREATE INDEX idx_shared_content_featured ON shared_content(is_featured) WHERE is_featured = TRUE;

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





CREATE INDEX idx_discussions_pinned ON discussion_threads(community_id, is_pinned) WHERE is_pinned = TRUE;

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




CREATE INDEX idx_replies_accepted ON discussion_replies(thread_id, is_accepted) WHERE is_accepted = TRUE;


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
    'vr_scenario', 'game_session', 'flashcard'
  )),
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, user_id)
);




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





CREATE INDEX idx_chat_rooms_expires ON chat_rooms(expires_at) WHERE expires_at IS NOT NULL;


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


CREATE INDEX idx_chat_read_unread ON chat_read_status(user_id, unread_count) WHERE unread_count > 0;

CREATE TABLE IF NOT EXISTS chat_reactions (
  id SERIAL PRIMARY KEY,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, reaction)
);




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


CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;





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





-- Removed in favor of unified likes table above

CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);




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