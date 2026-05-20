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
