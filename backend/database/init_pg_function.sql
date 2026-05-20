CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE UNIQUE INDEX idx_users_oauth ON users(oauth_provider, oauth_id) WHERE oauth_provider IS NOT NULL;

CREATE INDEX idx_user_profiles_domain ON user_profiles (domain_level);
CREATE INDEX idx_user_profiles_difficulty ON user_profiles (difficulty_preference);
CREATE INDEX idx_user_profiles_assistance ON user_profiles (ai_assistance_level);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_password_reset_user ON password_reset_otps(user_id);
CREATE INDEX idx_password_reset_expires ON password_reset_otps(expires_at);
CREATE INDEX idx_password_reset_email ON password_reset_otps(email);

CREATE INDEX idx_activity_user ON user_activity_log(user_id);
CREATE INDEX idx_activity_type ON user_activity_log(action_type);
CREATE INDEX idx_activity_resource ON user_activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_created ON user_activity_log(created_at);

CREATE INDEX idx_concepts_type ON concepts(concept_type);
CREATE INDEX idx_concepts_difficulty ON concepts(difficulty_level);
CREATE INDEX idx_concepts_base_form ON concepts(base_form) WHERE base_form IS NOT NULL;
CREATE INDEX idx_concepts_created_by ON concepts(created_by);
CREATE INDEX idx_concepts_system ON concepts(is_system_generated);
CREATE INDEX idx_concepts_public ON concepts(is_public);
CREATE INDEX idx_concepts_qdrant_sync ON concepts(qdrant_synced_at) WHERE qdrant_synced_at IS NOT NULL;
CREATE INDEX idx_concepts_needs_sync ON concepts(id) WHERE qdrant_synced_at IS NULL;

CREATE INDEX idx_concept_trans_concept ON concept_translations(concept_id);
CREATE INDEX idx_concept_trans_language ON concept_translations(language);
CREATE INDEX idx_concept_trans_primary ON concept_translations(concept_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_concept_trans_quality ON concept_translations(translation_quality);
CREATE INDEX idx_concept_trans_title ON concept_translations(title);
CREATE INDEX idx_concept_trans_title_trgm ON concept_translations USING GIN(title gin_trgm_ops);
CREATE INDEX idx_concept_trans_keywords ON concept_translations USING GIN(keywords);
CREATE INDEX idx_concept_trans_created_by ON concept_translations(created_by);

CREATE INDEX idx_taxonomy_lcc ON taxonomy_nodes(lcc_code);
CREATE INDEX idx_taxonomy_parent ON taxonomy_nodes(parent_lcc_code);
CREATE INDEX idx_taxonomy_level ON taxonomy_nodes(lcc_hierarchy_level);

CREATE INDEX idx_concept_tax_concept ON concept_taxonomy(concept_id);
CREATE INDEX idx_concept_tax_taxonomy ON concept_taxonomy(taxonomy_node_id);
CREATE INDEX idx_concept_tax_created_by ON concept_taxonomy(created_by);
CREATE INDEX idx_concept_tax_primary ON concept_taxonomy(is_primary);

CREATE INDEX idx_procedure_concept ON procedure_details(concept_id);
CREATE INDEX idx_procedure_neo4j_flag ON procedure_details(stored_in_neo4j);

CREATE INDEX idx_procedure_trans_procedure ON procedure_translations(procedure_id);
CREATE INDEX idx_procedure_trans_language ON procedure_translations(language);
CREATE INDEX idx_procedure_trans_primary ON procedure_translations(procedure_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_procedure_trans_steps ON procedure_translations USING GIN(steps);
CREATE INDEX idx_procedure_trans_created_by ON procedure_translations(created_by);

CREATE INDEX idx_example_concept ON example_details(concept_id);

CREATE INDEX idx_example_trans_example ON example_translations(example_id);
CREATE INDEX idx_example_trans_language ON example_translations(language);
CREATE INDEX idx_example_trans_primary ON example_translations(example_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_example_trans_created_by ON example_translations(created_by);

CREATE INDEX idx_assessment_concept ON assessment_details(concept_id);
CREATE INDEX idx_assessment_type ON assessment_details(question_type);

CREATE INDEX idx_assessment_trans_assessment ON assessment_translations(assessment_id);
CREATE INDEX idx_assessment_trans_language ON assessment_translations(language);
CREATE INDEX idx_assessment_trans_primary ON assessment_translations(assessment_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_assessment_trans_created_by ON assessment_translations(created_by);

CREATE INDEX idx_learning_object_concept ON learning_object_details(concept_id);
CREATE INDEX idx_learning_object_format ON learning_object_details(format);

CREATE INDEX idx_learning_object_trans_object ON learning_object_translations(learning_object_id);
CREATE INDEX idx_learning_object_trans_language ON learning_object_translations(language);
CREATE INDEX idx_learning_object_trans_primary ON learning_object_translations(learning_object_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_learning_object_trans_created_by ON learning_object_translations(created_by);

CREATE INDEX idx_relationships_type ON relationships(relationship_type);
CREATE INDEX idx_relationships_suggested ON relationships(suggested_relationship_type) WHERE suggested_relationship_type IS NOT NULL;

CREATE INDEX idx_relationship_trans_relationship ON relationship_translations(relationship_id);
CREATE INDEX idx_relationship_trans_language ON relationship_translations(language);
CREATE INDEX idx_relationship_trans_primary ON relationship_translations(relationship_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_relationship_trans_name ON relationship_translations(name);
CREATE INDEX idx_relationship_trans_created_by ON relationship_translations(created_by);

CREATE INDEX idx_discovered_type ON discovered_relationships(suggested_relationship);
CREATE INDEX idx_discovered_status ON discovered_relationships(status);
CREATE INDEX idx_discovered_count ON discovered_relationships(occurrence_count DESC);

CREATE INDEX idx_concept_rel_relationship ON concept_relationships(relationship_id);
CREATE INDEX idx_concept_rel_source ON concept_relationships(source_concept_id);
CREATE INDEX idx_concept_rel_target ON concept_relationships(target_concept_id);
CREATE INDEX idx_concept_rel_source_target ON concept_relationships(source_concept_id, target_concept_id);
CREATE INDEX idx_concept_rel_created_by ON concept_relationships(created_by);
CREATE INDEX idx_concept_rel_neo4j_sync ON concept_relationships(neo4j_synced_at) WHERE neo4j_synced_at IS NOT NULL;
CREATE INDEX idx_concept_rel_needs_sync ON concept_relationships(id) WHERE neo4j_synced_at IS NULL;

CREATE INDEX idx_learning_paths_target ON learning_paths(target_concept_id);
CREATE INDEX idx_learning_paths_created_by ON learning_paths(created_by);

CREATE INDEX idx_learning_path_trans_path ON learning_path_translations(learning_path_id);
CREATE INDEX idx_learning_path_trans_language ON learning_path_translations(language);
CREATE INDEX idx_learning_path_trans_primary ON learning_path_translations(learning_path_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_learning_path_trans_created_by ON learning_path_translations(created_by);

CREATE INDEX idx_learning_path_steps_path ON learning_path_steps(path_id);
CREATE INDEX idx_learning_path_steps_concept ON learning_path_steps(concept_id);
CREATE INDEX idx_learning_path_steps_order ON learning_path_steps(path_id, step_order);

CREATE INDEX idx_step_trans_step ON learning_path_step_translations(step_id);
CREATE INDEX idx_step_trans_language ON learning_path_step_translations(language);
CREATE INDEX idx_step_trans_primary ON learning_path_step_translations(step_id, is_primary) WHERE is_primary = TRUE;
CREATE INDEX idx_step_trans_created_by ON learning_path_step_translations(created_by);

CREATE INDEX idx_sources_name ON sources(document_name);
CREATE INDEX idx_sources_type ON sources(document_type);
CREATE INDEX idx_sources_author ON sources(author);
CREATE INDEX idx_sources_language ON sources(language);
CREATE INDEX idx_sources_uploaded_by ON sources(uploaded_by);
CREATE INDEX idx_sources_public ON sources(is_public);
CREATE INDEX idx_sources_processing_status ON sources(processing_status);
CREATE INDEX idx_sources_ai_summary_trgm ON sources USING GIN(ai_summary gin_trgm_ops);
CREATE INDEX idx_sources_deleted_at ON sources(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_sources_checksum ON sources(checksum) WHERE checksum IS NOT NULL;

CREATE INDEX idx_concept_sources_concept ON concept_sources(concept_id);
CREATE INDEX idx_concept_sources_source ON concept_sources(source_id);
CREATE INDEX idx_concept_sources_created_by ON concept_sources(created_by);

CREATE INDEX idx_relationship_sources_relationship ON relationship_sources(relationship_id);
CREATE INDEX idx_relationship_sources_source ON relationship_sources(source_id);
CREATE INDEX idx_relationship_sources_created_by ON relationship_sources(created_by);

CREATE INDEX idx_flashcards_metadata ON flashcards USING GIN (content_metadata);
CREATE INDEX idx_flashcards_type ON flashcards(card_type);
CREATE INDEX idx_flashcards_user ON flashcards(user_id);
CREATE INDEX idx_flashcards_concept ON flashcards(concept_id);
CREATE INDEX idx_flashcards_taxonomy ON flashcards(taxonomy_node_id);
CREATE INDEX idx_flashcards_source ON flashcards(source_type);
CREATE INDEX idx_flashcards_archived ON flashcards(is_archived);
CREATE INDEX idx_flashcards_user_archived ON flashcards(user_id, is_archived); -- Composite index

CREATE INDEX idx_extracted_media_source ON extracted_media(source_id);
CREATE INDEX idx_extracted_media_type ON extracted_media(media_type);
CREATE INDEX idx_extracted_media_storage ON extracted_media(storage_method);
CREATE INDEX idx_extracted_media_language ON extracted_media(language);
CREATE INDEX idx_extracted_media_subject_hints ON extracted_media USING GIN(subject_hints);

CREATE INDEX idx_feynman_user ON feynman_sessions(user_id, created_at DESC);
CREATE INDEX idx_feynman_concept ON feynman_sessions(concept_id);

CREATE INDEX idx_likes_entity ON likes(entity_type, entity_id);
CREATE INDEX idx_likes_user ON likes(user_id);
CREATE INDEX idx_likes_shared_content ON likes(entity_id) WHERE entity_type = 'shared_content';

CREATE INDEX idx_assessment_user_concept ON assessment_activities(user_id, concept_id);
CREATE INDEX idx_error_book_next_review ON error_book(user_id, next_review_time) WHERE is_mastered = FALSE;
CREATE INDEX idx_feynman_concept_user ON feynman_explanations(user_id, concept_id);
CREATE INDEX idx_exam_questions_concept ON exam_questions USING GIN (related_concept_ids);
CREATE INDEX idx_error_pattern ON error_book USING GIN (error_pattern_tags); 

CREATE INDEX idx_flashcard_media_flashcard ON flashcard_media(flashcard_id);
CREATE INDEX idx_flashcard_media_media ON flashcard_media(media_id);
CREATE INDEX idx_flashcard_media_position ON flashcard_media(media_position);
CREATE INDEX idx_flashcard_media_order ON flashcard_media(flashcard_id, media_position, display_order);

CREATE INDEX idx_review_history_user ON flashcard_review_history(user_id);
CREATE INDEX idx_review_history_card ON flashcard_review_history(flashcard_id);
CREATE INDEX idx_review_history_mode ON flashcard_review_history(review_mode);

CREATE INDEX idx_schedule_due ON flashcard_schedules(user_id, due_date);
CREATE INDEX idx_schedule_algorithm ON flashcard_schedules(algorithm);
CREATE INDEX idx_schedule_user ON flashcard_schedules(user_id);

CREATE INDEX idx_mnemonics_flashcard ON flashcard_mnemonics(flashcard_id);

CREATE INDEX idx_ar_env_user ON user_ar_environments (user_id);
CREATE INDEX idx_ar_env_system ON user_ar_environments (ar_system);

CREATE INDEX uq_label_name ON label (name);

CREATE INDEX idx_asset_library_type ON asset_library (asset_type);
CREATE INDEX idx_asset_library_source ON asset_library (source);

CREATE INDEX idx_asset_label_tag ON asset_label (tag_id);

CREATE INDEX idx_asset_categories_cat_id ON asset_categories(category_id);
CREATE INDEX idx_asset_categories_asset_id ON asset_categories(asset_id);

CREATE INDEX idx_downloads_asset ON asset_downloads(asset_id);
CREATE INDEX idx_downloads_filter ON asset_downloads(resolution, file_format);

CREATE INDEX idx_vr_scenarios_difficulty ON vr_scenarios(difficulty_level);
CREATE INDEX idx_vr_scenarios_active ON vr_scenarios(is_active);
CREATE INDEX idx_vr_scenarios_created_by ON vr_scenarios(created_by);

CREATE INDEX idx_vr_progress_user ON user_vr_progress(user_id);
CREATE INDEX idx_vr_progress_scenario ON user_vr_progress(scenario_id);
CREATE INDEX idx_vr_progress_completion ON user_vr_progress(completion_percentage);

CREATE INDEX idx_vr_triggers_scenario ON vr_learning_triggers(scenario_id);
CREATE INDEX idx_vr_triggers_flashcard ON vr_learning_triggers(required_flashcard_id);

CREATE INDEX idx_tags_user ON tags(user_id);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_url_id ON tags(url_id);
CREATE INDEX idx_tags_system ON tags(is_system);
CREATE INDEX idx_tags_usage ON tags(usage_count DESC);
CREATE INDEX idx_tags_name_trgm ON tags USING GIN(name gin_trgm_ops);

CREATE INDEX idx_tag_apps_tag ON tag_applications(tag_id);
CREATE INDEX idx_tag_apps_entity ON tag_applications(entity_type, entity_id);
CREATE INDEX idx_tag_apps_applied_by ON tag_applications(applied_by);

CREATE INDEX idx_diagrams_user ON diagrams(user_id);
CREATE UNIQUE INDEX idx_diagrams_slug ON diagrams(user_id, url_slug);
CREATE INDEX idx_diagrams_last_viewed ON diagrams(user_id, last_viewed_at DESC);
CREATE INDEX idx_diagrams_type ON diagrams(diagram_type);
CREATE INDEX idx_diagrams_public ON diagrams(is_public);

CREATE INDEX idx_communities_url_id ON communities(url_id);
CREATE INDEX idx_communities_type ON communities(community_type);
CREATE INDEX idx_communities_created_by ON communities(created_by);
CREATE INDEX idx_communities_name_trgm ON communities USING GIN(name gin_trgm_ops);

CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_community_members_role ON community_members(role);
CREATE INDEX idx_community_members_status ON community_members(status);

CREATE INDEX idx_community_invites_community ON community_invitations(community_id);
CREATE INDEX idx_community_invites_email ON community_invitations(invited_email);
CREATE INDEX idx_community_invites_user ON community_invitations(invited_user_id);
CREATE INDEX idx_community_invites_code ON community_invitations(invitation_code);
CREATE INDEX idx_community_invites_status ON community_invitations(status);

CREATE INDEX idx_point_types_url_id ON point_types(url_id);
CREATE INDEX idx_point_types_community ON point_types(community_id);

CREATE INDEX idx_point_rules_type ON point_rules(point_type_id);
CREATE INDEX idx_point_rules_action ON point_rules(action_type);
CREATE INDEX idx_point_rules_active ON point_rules(is_active);

CREATE INDEX idx_user_points_user ON user_points(user_id);
CREATE INDEX idx_user_points_type ON user_points(point_type_id);
CREATE INDEX idx_user_points_community ON user_points(community_id);
CREATE INDEX idx_user_points_created ON user_points(created_at);
CREATE INDEX idx_user_points_action ON user_points(action_type);
CREATE INDEX idx_user_points_leaderboard ON user_points(point_type_id, user_id, points);

CREATE INDEX idx_badges_url_id ON badges(url_id);
CREATE INDEX idx_badges_type ON badges(badge_type);
CREATE INDEX idx_badges_rarity ON badges(rarity);
CREATE INDEX idx_badges_community ON badges(community_id);
CREATE INDEX idx_badges_active ON badges(is_active);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_user_badges_community ON user_badges(community_id);
CREATE INDEX idx_user_badges_profile ON user_badges(user_id, show_on_profile) WHERE show_on_profile = TRUE;

CREATE INDEX idx_leaderboard_community ON leaderboard_snapshots(community_id);
CREATE INDEX idx_leaderboard_period ON leaderboard_snapshots(period_type, period_start);
CREATE INDEX idx_leaderboard_point_type ON leaderboard_snapshots(point_type_id);

CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_type ON user_streaks(streak_type);
CREATE INDEX idx_user_streaks_current ON user_streaks(current_streak DESC);
CREATE INDEX idx_user_streaks_longest ON user_streaks(longest_streak DESC);

CREATE INDEX idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_status ON mentorships(status);
CREATE INDEX idx_mentorships_community ON mentorships(community_id);

CREATE INDEX idx_mentorship_resources_mentorship ON mentorship_resources(mentorship_id);
CREATE INDEX idx_mentorship_resources_entity ON mentorship_resources(entity_type, entity_id);

CREATE INDEX idx_group_challenges_status ON group_challenges(status);
CREATE INDEX idx_group_challenges_dates ON group_challenges(starts_at, ends_at);

CREATE INDEX idx_group_challenge_members_challenge ON group_challenge_members(challenge_id);
CREATE INDEX idx_group_challenge_members_user ON group_challenge_members(user_id);

CREATE INDEX idx_user_currency_user ON user_currency(user_id);

CREATE INDEX idx_shop_items_url_id ON shop_items(url_id);
CREATE INDEX idx_shop_items_category ON shop_items(category);
CREATE INDEX idx_shop_items_type ON shop_items(item_type);
CREATE INDEX idx_shop_items_active ON shop_items(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_user_inventory_item ON user_inventory(shop_item_id);

CREATE INDEX idx_streak_milestones_type ON streak_milestones(streak_type);

CREATE INDEX idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_gifted ON user_purchases(gifted_to);
CREATE INDEX idx_user_purchases_status ON user_purchases(status);
CREATE INDEX idx_user_purchases_created ON user_purchases(created_at);

CREATE INDEX idx_events_url_id ON events(url_id);
CREATE INDEX idx_events_active ON events(starts_at, ends_at) WHERE is_active = TRUE;
CREATE INDEX idx_events_community ON events(community_id);

CREATE INDEX idx_event_challenges_event ON event_challenges(event_id);
CREATE INDEX idx_event_challenges_type ON event_challenges(challenge_type);

CREATE INDEX idx_user_event_progress_user ON user_event_progress(user_id);
CREATE INDEX idx_user_event_progress_event ON user_event_progress(event_id);
CREATE INDEX idx_user_event_progress_completed ON user_event_progress(is_completed);

CREATE INDEX idx_active_boosts_user ON active_boosts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_active_boosts_community ON active_boosts(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_active_boosts_active ON active_boosts(expires_at, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_active_boosts_activated_by ON active_boosts(activated_by);

CREATE INDEX idx_content_requests_type ON content_requests(request_type);
CREATE INDEX idx_content_requests_status ON content_requests(status);
CREATE INDEX idx_content_requests_votes ON content_requests(total_coins DESC);

CREATE INDEX idx_content_request_votes_request ON content_request_votes(request_id);
CREATE INDEX idx_content_request_votes_user ON content_request_votes(user_id);

CREATE INDEX idx_appreciations_from ON appreciations(from_user_id);
CREATE INDEX idx_appreciations_to ON appreciations(to_user_id);
CREATE INDEX idx_appreciations_type ON appreciations(appreciation_type);

CREATE INDEX idx_shared_content_user ON shared_content(user_id);
CREATE INDEX idx_shared_content_entity ON shared_content(entity_type, entity_id);
CREATE INDEX idx_shared_content_visibility ON shared_content(visibility);
CREATE INDEX idx_shared_content_status ON shared_content(status);
CREATE INDEX idx_shared_content_featured ON shared_content(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_shared_content_rating ON shared_content(average_rating DESC NULLS LAST);
CREATE INDEX idx_shared_content_tags ON shared_content USING GIN(tags);
CREATE INDEX idx_shared_content_communities ON shared_content USING GIN(community_ids);
CREATE INDEX idx_shared_content_title_trgm ON shared_content USING GIN(title gin_trgm_ops);

CREATE INDEX idx_content_downloads_content ON content_downloads(shared_content_id);
CREATE INDEX idx_content_downloads_user ON content_downloads(user_id);
CREATE INDEX idx_content_downloads_action ON content_downloads(action_type);

CREATE INDEX idx_content_ratings_content ON content_ratings(shared_content_id);
CREATE INDEX idx_content_ratings_user ON content_ratings(user_id);
CREATE INDEX idx_content_ratings_rating ON content_ratings(rating);

CREATE INDEX idx_feedback_requests_user ON feedback_requests(user_id);
CREATE INDEX idx_feedback_requests_entity ON feedback_requests(entity_type, entity_id);
CREATE INDEX idx_feedback_requests_community ON feedback_requests(community_id);
CREATE INDEX idx_feedback_requests_status ON feedback_requests(status);

CREATE INDEX idx_peer_feedback_request ON peer_feedback(feedback_request_id);
CREATE INDEX idx_peer_feedback_reviewer ON peer_feedback(reviewer_id);
CREATE INDEX idx_peer_feedback_recipient ON peer_feedback(recipient_id);

CREATE INDEX idx_reputation_user ON reputation_scores(user_id);
CREATE INDEX idx_reputation_community ON reputation_scores(community_id);
CREATE INDEX idx_reputation_total ON reputation_scores(total_score DESC);
CREATE INDEX idx_reputation_level ON reputation_scores(reputation_level);

CREATE INDEX idx_reputation_events_user ON reputation_events(user_id);
CREATE INDEX idx_reputation_events_type ON reputation_events(event_type);
CREATE INDEX idx_reputation_events_dimension ON reputation_events(dimension);
CREATE INDEX idx_reputation_events_community ON reputation_events(community_id);
CREATE INDEX idx_reputation_events_created ON reputation_events(created_at);

CREATE INDEX idx_reputation_levels_url_id ON reputation_levels(url_id);
CREATE INDEX idx_reputation_levels_score ON reputation_levels(min_score);
CREATE INDEX idx_reputation_levels_community ON reputation_levels(community_id);

CREATE INDEX idx_discussions_community ON discussion_threads(community_id);
CREATE INDEX idx_discussions_user ON discussion_threads(user_id);
CREATE INDEX idx_discussions_type ON discussion_threads(thread_type);
CREATE INDEX idx_discussions_status ON discussion_threads(status);
CREATE INDEX idx_discussions_pinned ON discussion_threads(community_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_discussions_activity ON discussion_threads(last_activity_at DESC);
CREATE INDEX idx_discussions_tags ON discussion_threads USING GIN(tags);
CREATE INDEX idx_discussions_title_trgm ON discussion_threads USING GIN(title gin_trgm_ops);

CREATE INDEX idx_replies_thread ON discussion_replies(thread_id);
CREATE INDEX idx_replies_user ON discussion_replies(user_id);
CREATE INDEX idx_replies_parent ON discussion_replies(parent_reply_id);
CREATE INDEX idx_replies_accepted ON discussion_replies(thread_id, is_accepted) WHERE is_accepted = TRUE;

CREATE INDEX idx_challenges_community ON challenges(community_id);
CREATE INDEX idx_challenges_creator ON challenges(created_by);
CREATE INDEX idx_challenges_type ON challenges(challenge_type);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_dates ON challenges(starts_at, ends_at);

CREATE INDEX idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user ON challenge_participants(user_id);
CREATE INDEX idx_challenge_participants_status ON challenge_participants(status);

CREATE INDEX idx_challenge_submissions_challenge ON challenge_submissions(challenge_id);
CREATE INDEX idx_challenge_submissions_user ON challenge_submissions(user_id);
CREATE INDEX idx_challenge_submissions_status ON challenge_submissions(status);
CREATE INDEX idx_challenge_submissions_rank ON challenge_submissions(challenge_id, rank);

CREATE INDEX idx_presence_user ON user_presence(user_id);
CREATE INDEX idx_presence_status ON user_presence(status);
CREATE INDEX idx_presence_entity ON user_presence(current_entity_type, current_entity_id);
CREATE INDEX idx_presence_heartbeat ON user_presence(last_heartbeat);

CREATE INDEX idx_edit_locks_entity ON edit_locks(entity_type, entity_id);
CREATE INDEX idx_edit_locks_user ON edit_locks(locked_by);
CREATE INDEX idx_edit_locks_expires ON edit_locks(expires_at);

CREATE INDEX idx_entity_viewers_entity ON entity_viewers(entity_type, entity_id);
CREATE INDEX idx_entity_viewers_user ON entity_viewers(user_id);

CREATE INDEX idx_chat_rooms_code ON chat_rooms(room_code);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(room_type);
CREATE INDEX idx_chat_rooms_community ON chat_rooms(community_id);
CREATE INDEX idx_chat_rooms_expires ON chat_rooms(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_chat_rooms_permanent ON chat_rooms(is_permanent);
CREATE INDEX idx_chat_rooms_last_message ON chat_rooms(last_message_at DESC);

CREATE INDEX idx_chat_room_members_room ON chat_room_members(room_id);
CREATE INDEX idx_chat_room_members_user ON chat_room_members(user_id);
CREATE INDEX idx_chat_room_members_active ON chat_room_members(room_id, is_active) WHERE is_active = TRUE;

CREATE INDEX idx_chat_messages_room ON chat_messages(chat_room_id, created_at);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_reply ON chat_messages(reply_to_id);
CREATE INDEX idx_chat_messages_mentions ON chat_messages USING GIN(mentions);

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_friendships_pending ON friendships(friend_id, status) WHERE status = 'pending';

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(notification_type);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_group ON notifications(group_key);

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

CREATE INDEX idx_activity_actor ON activity_feed(actor_id);
CREATE INDEX idx_activity_types ON activity_feed(activity_type);
CREATE INDEX idx_activity_entity ON activity_feed(entity_type, entity_id);
CREATE INDEX idx_activity_community ON activity_feed(community_id, created_at DESC);
CREATE INDEX idx_activity_createds ON activity_feed(created_at DESC);
CREATE INDEX idx_activity_visibility ON activity_feed(visibility);

CREATE INDEX idx_activity_comments_activity ON activity_comments(activity_id);
CREATE INDEX idx_activity_comments_user ON activity_comments(user_id);
CREATE INDEX idx_activity_comments_parent ON activity_comments(parent_comment_id);

CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);

CREATE INDEX idx_template_status ON script_templates (status);
CREATE INDEX idx_template_subject ON script_templates (subject_id);

CREATE INDEX idx_imported_record_user_time ON imported_record (id, occurred_at DESC);

CREATE INDEX idx_learning_event_user_time ON learning_event (id, occurred_at DESC);
CREATE INDEX idx_learning_event_type_time ON learning_event (event_type, occurred_at DESC);

CREATE INDEX idx_learning_session_user_time ON learning_session (id, started_at DESC);
  
CREATE INDEX idx_memory_review_item_time ON memory_review (memory_item_id, occurred_at DESC);

CREATE INDEX idx_retention_snapshot_user_time ON memory_retention_snapshot (id, as_of DESC);

CREATE INDEX idx_heatmap_user_period ON user_activity_heatmap (id, period_kind, period_start DESC);

CREATE INDEX idx_practice_attempt_user_time ON practice_item_attempt (id, occurred_at DESC);
CREATE INDEX idx_practice_attempt_block_time ON practice_item_attempt (block_id, occurred_at);

CREATE INDEX idx_path_prediction_user_time ON learning_path_prediction (id, created_at DESC);

CREATE INDEX idx_identified_gap_user_time ON identified_gap (id, created_at DESC);

CREATE INDEX idx_recommendation_user_status ON lesson_recommendation (id, status, created_at DESC);

CREATE INDEX idx_group_snapshot_group_time ON group_analytics_snapshot (group_id, period_kind, period_start DESC);

CREATE INDEX idx_group_member_bucket_group_time ON group_member_metric_bucket (group_id, period_kind, period_start DESC);

CREATE INDEX idx_dashboard_widget_dash_ord ON dashboard_widget (dashboard_id, ordinal);

CREATE INDEX idx_panel_cache_user_time ON dashboard_panel_cache (id, generated_at DESC);

CREATE INDEX idx_ai_run_user_time ON ai_generation_run (id, created_at DESC);
CREATE INDEX idx_ai_run_type_time ON ai_generation_run (run_type, created_at DESC);

CREATE INDEX idx_assignment_user_status ON user_question_assignment (id, status, assigned_at DESC);

CREATE INDEX idx_question_response_user_time ON user_question_response (id, responded_at DESC);

CREATE INDEX idx_rewrite_user_time ON passage_rewrite (id, created_at DESC);

CREATE INDEX idx_metaphor_template_owner_enabled ON metaphor_template (owner_id, enabled);

CREATE INDEX idx_analogy_user_time ON generated_analogy (id, created_at DESC);
CREATE INDEX idx_analogy_concept ON generated_analogy (target_concept_id);

CREATE INDEX idx_brainstorm_user_time ON brainstorming_session (id, created_at DESC);

CREATE INDEX idx_brainstorm_prompt_session_dim ON brainstorming_prompt (brainstorm_session_id, dimension, ordinal);

CREATE INDEX idx_brainstorm_response_user_time ON brainstorming_response (id, responded_at DESC);

CREATE INDEX idx_socratic_session_user_time ON socratic_session (id, created_at DESC);

CREATE INDEX idx_socratic_turn_session_ord ON socratic_turn (socratic_session_id, ordinal);

CREATE INDEX idx_socratic_state_user_time ON socratic_state_snapshot (id, as_of DESC);

CREATE INDEX idx_misconception_obs_session ON socratic_misconception_observation (socratic_session_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_parses_v2_source_id ON content_parses_v2(source_id);

CREATE INDEX IF NOT EXISTS idx_content_chunks_v2_parse_id ON content_chunks_v2(parse_id);

CREATE INDEX IF NOT EXISTS idx_scripts_source_id ON scripts(source_id);
CREATE INDEX IF NOT EXISTS idx_scripts_parse_id_v2 ON scripts(parse_id_v2);

CREATE INDEX IF NOT EXISTS idx_memory_palaces_user ON memory_palaces(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_palaces_active ON memory_palaces(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_palace_items_palace ON palace_items(palace_id);
CREATE INDEX IF NOT EXISTS idx_palace_items_user ON palace_items(user_id);
CREATE INDEX IF NOT EXISTS idx_palace_items_memory ON palace_items(memory_item_id) WHERE memory_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_game_progress_script_id ON game_progress(script_id);

CREATE INDEX idx_cognitive_primary_dimension ON knowledge_cognitive_profiles(primary_dimension);
CREATE INDEX idx_cognitive_scores_gin ON knowledge_cognitive_profiles USING GIN (dimension_scores);

CREATE INDEX IF NOT EXISTS idx_exam_questions_topic ON exam_questions(topic);
CREATE INDEX IF NOT EXISTS idx_exam_questions_source_year ON exam_questions(source_exam, year);

CREATE INDEX IF NOT EXISTS idx_learn_activity_user_date ON learning_activity_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_learn_activity_type ON learning_activity_log(activity_type);

CREATE INDEX IF NOT EXISTS idx_weekly_plan_snapshot_user_id ON weekly_plan_snapshot(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_month ON ai_token_usage(user_id, usage_month);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- =============================================================================
-- VIEWS

CREATE VIEW templates_with_subjects AS
SELECT
    t.id,
    t.name,
    t.target_level,
    t.subject_id,
    s.code   AS subject_code,
    s.name   AS subject_name,
    t.status,
    t.template_version AS version,
    t.created_at,
    t.updated_at,
    t.deleted_at
FROM script_templates AS t
LEFT JOIN subjects AS s
       ON t.subject_code = s.code
WHERE t.deleted_at IS NULL;

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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_script_templates_updated_at 
    BEFORE UPDATE ON script_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

    