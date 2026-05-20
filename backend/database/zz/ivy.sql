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

-- script_templates
CREATE INDEX IF NOT EXISTS idx_template_type ON script_templates (template_type);
CREATE INDEX IF NOT EXISTS idx_template_period ON script_templates (content_domain);

-- template_parameters
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_param ON template_parameters (template_id, param_key);
CREATE INDEX IF NOT EXISTS idx_param_template ON template_parameters (template_id);
CREATE INDEX IF NOT EXISTS idx_param_category ON template_parameters (category);

-- users
CREATE INDEX IF NOT EXISTS idx_user_level ON users (domain_level);

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