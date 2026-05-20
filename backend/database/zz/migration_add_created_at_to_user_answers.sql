-- Migration: Add created_at column to user_answers table
-- Created: 2026-03-21

-- 步骤 1: 添加 created_at 字段（如果不存在）
ALTER TABLE user_answers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;

-- 步骤 2: 更新现有行的 created_at 值（基于 timestamp）
UPDATE user_answers
SET created_at = COALESCE(timestamp, CURRENT_TIMESTAMP)
WHERE created_at = CURRENT_TIMESTAMP AND timestamp IS NOT NULL;

-- 步骤 3: 验证迁移结果
SELECT 
    COUNT(*) as total_rows,
    COUNT(created_at) as rows_with_created_at,
    MIN(created_at) as earliest_created_at,
    MAX(created_at) as latest_created_at
FROM user_answers;
