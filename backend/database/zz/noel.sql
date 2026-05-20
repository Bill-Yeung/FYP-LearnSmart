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
--   - chat_messages.content (all room types: direct, group, community, channel)
--
-- What stays plain (for querying):
--   - Message metadata (timestamps, user_id, chat_room_id)
--   - Message type, reactions, read_by

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
    'pending', 'processing', 'completed', 'failed'
  ));
ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS concepts_extracted INTEGER DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS relationships_extracted INTEGER DEFAULT 0;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_sources_processing_status ON sources(processing_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_checksum ON sources(checksum) WHERE checksum IS NOT NULL;
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

-- Update media_type constraint to use document types instead of generic categories
ALTER TABLE extracted_media DROP CONSTRAINT IF EXISTS extracted_media_media_type_check;
ALTER TABLE extracted_media ADD CONSTRAINT extracted_media_media_type_check
  CHECK (media_type IN ('pdf', 'word', 'excel', 'powerpoint', 'image', 'video', 'audio', 'text'));

-- Remove programming_language column (no longer storing code separately)
ALTER TABLE extracted_media DROP COLUMN IF EXISTS programming_language;
DROP INDEX IF EXISTS idx_extracted_media_programming_language;

CREATE INDEX IF NOT EXISTS idx_extracted_media_subject_hints ON extracted_media USING GIN(subject_hints);

-- Update sources document_type constraint to use only the 8 valid types
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_document_type_check;
ALTER TABLE sources ADD CONSTRAINT sources_document_type_check
  CHECK (document_type IN ('pdf', 'word', 'excel', 'powerpoint', 'image', 'video', 'audio', 'text'));

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

CREATE TABLE IF NOT EXISTS content_likes (
  id SERIAL PRIMARY KEY,
  shared_content_id UUID REFERENCES shared_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shared_content_id, user_id)
);

CREATE INDEX idx_content_likes_content ON content_likes(shared_content_id);
CREATE INDEX idx_content_likes_user ON content_likes(user_id);

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

CREATE TABLE IF NOT EXISTS discussion_likes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
    'discussion_thread', 'discussion_reply')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX idx_discussion_likes_entity ON discussion_likes(entity_type, entity_id);
CREATE INDEX idx_discussion_likes_user ON discussion_likes(user_id);

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
  name VARCHAR(255),
  description TEXT,
  avatar_url TEXT,
  room_type VARCHAR(30) DEFAULT 'group' CHECK (room_type IN (
    'direct', 'group', 'community', 'channel')),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT TRUE,
  max_participants INTEGER DEFAULT 50,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  last_message_preview TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_rooms_code ON chat_rooms(room_code);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(room_type);
CREATE INDEX idx_chat_rooms_community ON chat_rooms(community_id);
CREATE INDEX idx_chat_rooms_last_message ON chat_rooms(last_message_at DESC);

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
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_type VARCHAR(30) DEFAULT 'text' CHECK (message_type IN (
    'text', 'image', 'file', 'system')),
  content TEXT NOT NULL,
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

CREATE INDEX idx_chat_messages_room ON chat_messages(chat_room_id, created_at);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_reply ON chat_messages(reply_to_id);
CREATE INDEX idx_chat_messages_mentions ON chat_messages USING GIN(mentions);

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

CREATE TABLE IF NOT EXISTS activity_likes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('activity', 'comment')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX idx_activity_likes_entity ON activity_likes(entity_type, entity_id);
CREATE INDEX idx_activity_likes_user ON activity_likes(user_id);

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
-- COUNT COLUMNS STRATEGY
-- -----------------------------------------------------------------------------
-- Denormalized count columns (member_count, like_count, reply_count, etc.)
-- are updated via APPLICATION CODE, not database triggers.
--
-- Reasons:
--   1. Triggers add hidden complexity and can fail silently
--   2. Bulk operations become problematic with row-level triggers
--   3. Application has more context for caching/batching
--
-- For frequently-changing counts, prefer:
--   - Query with COUNT() on demand
--   - Cache in Redis/memory if performance is critical
--
-- Example queries:
--   SELECT c.*, COUNT(cm.id) as member_count
--   FROM communities c
--   LEFT JOIN community_members cm ON c.id = cm.community_id AND cm.status = 'active'
--   GROUP BY c.id;
--
--   SELECT AVG(rating)::NUMERIC(3,2) as avg_rating, COUNT(*) as rating_count
--   FROM content_ratings WHERE shared_content_id = $1;

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
