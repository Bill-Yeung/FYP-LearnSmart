-- ============================================================
-- Tracking & Analytics Module (Requirements 5.1–5.6)
-- PostgreSQL-flavoured DDL (adapt as needed)
-- ============================================================

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

