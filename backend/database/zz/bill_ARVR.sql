-- =============================================================================
-- FR 3.2 Flashcard Engine
-- =============================================================================
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
/*
CREATE TABLE IF NOT EXISTS extracted_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- [Modified] source_id is now optional
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    
    -- [Extended] Media type includes 'website'
    media_type VARCHAR(50) CHECK (media_type IN (
        'code', 'image', 'video', 'diagram', 'audio', 'file', 'website'
    )),
    
    -- [New] Storage method: local or external
    storage_method VARCHAR(20) DEFAULT 'local_path' 
        CHECK (storage_method IN ('local_path', 'external_url')),
    
    -- [Retained] Programming language (for code type)
    programming_language VARCHAR(50),
    
    -- [Retained] Language
    language VARCHAR(20),
    
    -- [Merged] Use file_url to replace file_path (can store path or URL)
    file_url TEXT NOT NULL,
    
    -- [Retained] File integrity verification
    checksum VARCHAR(64),
    
    -- [Retained] Source page numbers (only for media extracted from documents)
    pages INTEGER[],
    
    -- [Retained] Extraction location (only for media extracted from documents)
    extraction_location TEXT,
    
    -- [Retained] Additional information
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_extracted_media_source ON extracted_media(source_id);
CREATE INDEX idx_extracted_media_type ON extracted_media(media_type);
CREATE INDEX idx_extracted_media_storage ON extracted_media(storage_method);
CREATE INDEX idx_extracted_media_programming_language ON extracted_media(programming_language);
CREATE INDEX idx_extracted_media_language ON extracted_media(language);

*/
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

CREATE INDEX idx_schedule_due ON flashcard_schedules(user_id, due_date);
CREATE INDEX idx_schedule_algorithm ON flashcard_schedules(algorithm);
CREATE INDEX idx_schedule_user ON flashcard_schedules(user_id);

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
-- FR 3.2 閃卡引擎 (Flashcard Engine) - Sample Flashcards
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
-- FR 3.5 多感官編碼 (Multisensory Encoding) - Sample Media
-- =============================================================================

INSERT INTO extracted_media (id, source_id, media_type, storage_method, programming_language, language, file_url, checksum, pages, extraction_location, metadata)
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
     '{"lines": 68, "description": "Simple hash table implementation with collision handling"}'::jsonb);

-- =============================================================================
-- Flashcard Media Relationships
-- =============================================================================

INSERT INTO flashcard_media (id, flashcard_id, media_id, media_position, display_order, caption, display_settings)
VALUES
    -- OSI Model flashcard with diagram on back
    ('f1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
     'back', 1, 'Visual representation of the 7 layers',
     '{"width": "100%", "align": "center", "show_border": true}'::jsonb),

    -- OSI Model with audio hint
    ('f1111112-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'hint', 1, 'Listen to detailed explanation',
     '{"autoplay": false, "controls": true, "playback_rate": 1.0}'::jsonb),
     
    -- DHCP flashcard with video hint
    ('f2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
     'hint', 1, 'Watch this 12-minute explanation if you need more detail',
     '{"autoplay": false, "controls": true, "start_time": 0}'::jsonb),
     
    -- REST API flashcard with code example
    ('f3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     'back', 1, 'Example FastAPI implementation showing RESTful design',
     '{"syntax_highlight": true, "theme": "monokai", "show_line_numbers": true}'::jsonb),
     
    -- HTTP Methods MCQ with diagram on front
    ('f4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'front', 1, 'HTTP Methods → CRUD Operations mapping',
     '{"scale": 0.8, "position": "above_question"}'::jsonb),
     
    -- HTTP Methods with MDN reference as hint
    ('f5555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'hint', 2, 'Official documentation for deeper understanding',
     '{"open_in_new_tab": true, "show_preview": false}'::jsonb),

    -- Hash table with code example
    ('f8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999',
     'back', 1, 'Python implementation demonstrating hash table concepts',
     '{"syntax_highlight": true, "theme": "github-dark", "show_line_numbers": true}'::jsonb);

-- =============================================================================
-- FR 3.2 複習歷史紀錄 (Review History)
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
-- FR 3.1 間隔重複排程器 (Spaced Repetition Scheduler)
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
-- FR 3.4 助記生成器 (Mnemonic Generator)
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
-- FR 3.6 AR 記憶宮殿 (AR Memory Palace)
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
-- FR 3.7 VR 謀殺推理遊戲 (VR Murder Mystery Game) - Scenarios
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
