
ALTER table script_templates rename to script_templates_backup;
CREATE TABLE subjects (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    code text NOT NULL UNIQUE,
    name text,
    description text,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖users和subjects的表
CREATE TABLE courses (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    teacher_id UUID REFERENCES users(id),
    code text,
    name text NOT NULL,
    description text,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 知识相关表（依赖subjects）
CREATE TABLE knowledge_points (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    module_key text NOT NULL,
    title text NOT NULL,
    description text,
    tags text DEFAULT '{"concept","structure","apply"}',
    canonical_quote text,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖courses和users的表
CREATE TABLE classes (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    course_id UUID REFERENCES courses(id),
    teacher_id UUID REFERENCES users(id),
    name text NOT NULL,
    description text,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖classes和users的表
CREATE TABLE class_enrollments (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 内容相关表（依赖users, courses, subjects）
CREATE TABLE content_items (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    owner_user_id UUID REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    subject_id UUID REFERENCES subjects(id),
    source_type text NOT NULL CHECK(source_type IN (
        'upload_pdf','upload_text','kb_article','teacher_notes'
    )),
    title text,
    original_filename text,
    storage_uri text,
    raw_text text,
    language text DEFAULT 'zh',
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖content_items的表
CREATE TABLE content_parses (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    parse_version INT DEFAULT 1 NOT NULL,
    parser_name text DEFAULT 'pipeline_v1' NOT NULL,
    status text DEFAULT 'succeeded' NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
    detected_subject_code text,
    detected_modules JSONB NOT NULL,
    total_points INT DEFAULT 0 NOT NULL,
    quality_score numeric(4, 3) DEFAULT 1.0,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖content_parses的表
CREATE TABLE content_parse_chunks (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    content_parse_id UUID NOT NULL REFERENCES content_parses(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text text NOT NULL,
    meta JSONB,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE content_kp_links (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    content_parse_id UUID NOT NULL REFERENCES content_parses(id) ON DELETE CASCADE,
    kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    part_key text,
    point_index INT,
    evidence JSONB,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 模板相关表（依赖courses, subjects, users）
CREATE TABLE script_templates (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
 
    subject_id UUID REFERENCES subjects(id),
    teacher_id UUID REFERENCES users(id),
    name text NOT NULL,
    description text,
    template_version INT DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft' NOT NULL CHECK(status IN ('draft','ready','published','archived')),
   
    difficulty_rules JSONB NOT NULL,
   
    hasQuiz BOOLEAN DEFAULT FALSE NOT NULL,
    target_level text DEFAULT 'standard' NOT NULL CHECK(target_level IN ('beginner','standard','advanced','all')),
    created_at timestamp DEFAULT NOW() NOT NULL,
    updated_at timestamp DEFAULT NOW() NOT NULL,
    quizSource text DEFAULT 'doc_only' NOT NULL CHECK(quizSource IN ('doc_only','doc_ai','ai_only')),
    questionSet JSONB,
    PRIMARY KEY (id)
);

-- 依赖script_templates的表
CREATE TABLE template_reviews (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    template_id UUID NOT NULL REFERENCES script_templates(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id),
    decision text NOT NULL CHECK(decision IN ('approve','request_changes','reject')),
    notes text,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 题库相关表（依赖subjects, knowledge_points, users）
CREATE TABLE question_bank (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    subject_id UUID REFERENCES subjects(id),
    module_key text,
    kp_id UUID REFERENCES knowledge_points(id),
    question_type text NOT NULL CHECK(question_type IN ('mcq','multi','tf','fill','sort','match','short')),
    question_text text NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    skill_dim text NOT NULL CHECK(skill_dim IN ('concept','structure','apply')),
    difficulty INT DEFAULT 1 NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
    score_max numeric(6, 2) DEFAULT 1.0 NOT NULL,
    doc_quote text,
    code_snippet text,
    created_by UUID REFERENCES users(id),
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖content_parses、script_templates等的表
CREATE TABLE scripts (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    subject_id UUID REFERENCES subjects(id),
    content_item_id UUID REFERENCES content_items(id),
    content_parse_id UUID REFERENCES content_parses(id),
    template_id UUID REFERENCES script_templates(id),
    title text,
    status text DEFAULT 'active' NOT NULL CHECK(status IN ('draft','active','completed','abandoned')),
    difficulty_level text DEFAULT 'easy' NOT NULL CHECK(difficulty_level IN ('easy','medium','hard')),
    outline_json JSONB DEFAULT '{}'::JSONB NOT NULL,
    created_at timestamp DEFAULT NOW() NOT NULL,
    completed_at timestamp,
    PRIMARY KEY (id)
);

-- 依赖scripts的表
CREATE TABLE script_clues (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    clue_index INT NOT NULL,
    module_key text NOT NULL,
    kp_id UUID NOT NULL REFERENCES knowledge_points(id),
    npc_name text,
    scene_title text,
    doc_quote text,
    code_snippet text,
    question_type text NOT NULL CHECK(question_type IN ('mcq','multi','tf','fill','sort','match','short')),
    question_text text NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    skill_dim text NOT NULL CHECK(skill_dim IN ('concept','structure','apply')),
    difficulty INT DEFAULT 1 NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
    score_max numeric(6, 2) DEFAULT 1.0 NOT NULL,
    hint_after_wrong INT DEFAULT 2 NOT NULL,
    hint_text text,
    branch_key text DEFAULT 'main',
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖users和scripts的表
CREATE TABLE script_sessions (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    current_clue_index INT DEFAULT 1 NOT NULL,
    current_wrong_count INT DEFAULT 0 NOT NULL,
    hint_shown BOOLEAN DEFAULT FALSE NOT NULL,
    branch_key text,
    state_json JSONB DEFAULT '{}'::JSONB NOT NULL,
    last_active_at timestamp DEFAULT NOW() NOT NULL,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 测验相关表（依赖users, courses, subjects）
CREATE TABLE quizzes (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    subject_id UUID REFERENCES subjects(id),
    source_type text NOT NULL CHECK(source_type IN ('doc_only','doc_ai','ai_only')),
    status text DEFAULT 'active' NOT NULL CHECK(status IN ('draft','active','submitted','graded')),
    generated_from JSONB,
    created_at timestamp DEFAULT NOW() NOT NULL,
    submitted_at timestamp,
    PRIMARY KEY (id)
);

-- 依赖quizzes、question_bank、knowledge_points的表
CREATE TABLE quiz_questions (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_id UUID REFERENCES question_bank(id),
    kp_id UUID REFERENCES knowledge_points(id),
    question_type text NOT NULL CHECK(question_type IN ('mcq','multi','tf','fill','sort','match','short')),
    question_text text NOT NULL,
    options JSONB,
    correct_answer JSONB NOT NULL,
    skill_dim text NOT NULL CHECK(skill_dim IN ('concept','structure','apply')),
    difficulty INT DEFAULT 1 NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
    score_max numeric(6, 2) DEFAULT 1.0 NOT NULL,
    doc_quote text,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖script_clues、scripts和users的表
CREATE TABLE clue_attempts (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    clue_id UUID NOT NULL REFERENCES script_clues(id) ON DELETE CASCADE,
    attempt_no INT NOT NULL,
    answer JSONB NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE NOT NULL,
    used_hint BOOLEAN DEFAULT FALSE NOT NULL,
    time_spent_ms INT,
    score_earned numeric(6, 2) DEFAULT 0.0 NOT NULL,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 依赖quizzes、quiz_questions、users的表
CREATE TABLE quiz_attemptsV2 (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    answer JSONB NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE NOT NULL,
    score_earned numeric(6, 2) DEFAULT 0.0 NOT NULL,
    time_spent_ms INT,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 学习进度相关表
CREATE TABLE kp_mastery_snapshots (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kp_id UUID NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
    mastery numeric(5, 4) NOT NULL,
    total_score_max numeric(10, 2) DEFAULT 0 NOT NULL,
    total_score_earned numeric(10, 2) DEFAULT 0 NOT NULL,
    last_attempt_at timestamp,
    updated_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE module_progress (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    module_key text NOT NULL,
    mastery numeric(5, 4) DEFAULT 0.0 NOT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at timestamp,
    updated_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE study_plans (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    subject_id UUID REFERENCES subjects(id),
    plan_type text NOT NULL CHECK(plan_type IN ('auto','teacher_assigned')),
    status text DEFAULT 'active' NOT NULL CHECK(status IN ('active','completed','archived')),
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE study_plan_items (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    plan_id UUID NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    kp_id UUID NOT NULL REFERENCES knowledge_points(id),
    recommended_action text NOT NULL CHECK(recommended_action IN (
        'replay_clue','quiz','read_quote','extra_practice'
    )),
    priority INT DEFAULT 3 NOT NULL CHECK(priority BETWEEN 1 AND 5),
    due_at timestamp,
    reason_json JSONB DEFAULT '{}'::JSONB NOT NULL,
    status text DEFAULT 'open' NOT NULL CHECK(status IN ('open','done','skipped')),
    created_at timestamp DEFAULT NOW() NOT NULL,
    updated_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

-- 作业相关表
CREATE TABLE assignments (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id),
    title text NOT NULL,
    description text,
    assignment_type text NOT NULL CHECK(assignment_type IN ('script','quiz','mixed')),
    target_content_item_id UUID REFERENCES content_items(id),
    template_id UUID REFERENCES script_templates(id),
    due_at timestamp,
    pass_mastery numeric(5, 4),
    pass_quiz_score numeric(5, 4),
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE assignment_submissions (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    script_id UUID REFERENCES scripts(id),
    quiz_id UUID REFERENCES quizzes(id),
    status text DEFAULT 'submitted' NOT NULL CHECK(status IN ('not_started','in_progress','submitted','graded')),
    mastery numeric(5, 4),
    quiz_score numeric(5, 4),
    submitted_at timestamp,
    graded_at timestamp,
    PRIMARY KEY (id)
);

-- 生成运行表
CREATE TABLE generation_runs (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    script_id UUID REFERENCES scripts(id),
    template_id UUID REFERENCES script_templates(id),
    run_type text NOT NULL CHECK(run_type IN ('parse','script','quiz')),
    status text NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
    model_name text,
    prompt_hash text,
    input_meta JSONB,
    output_meta JSONB,
    error_message text,
    started_at timestamp,
    finished_at timestamp,
    created_at timestamp DEFAULT NOW() NOT NULL,
    PRIMARY KEY (id)
);

drop table script_templates_backup;
alter table subjects add column tid UUID;
alter table subjects add constraint subjects_template_fk foreign key (tid) references script_templates(id);

