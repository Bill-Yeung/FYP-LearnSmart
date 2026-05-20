-- Add concept attachments to VR palace items for existing databases.

ALTER TABLE palace_items
ADD COLUMN IF NOT EXISTS concept_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'palace_items_concept_id_fkey'
    ) THEN
        ALTER TABLE palace_items
        ADD CONSTRAINT palace_items_concept_id_fkey
        FOREIGN KEY (concept_id)
        REFERENCES concepts(id)
        ON DELETE SET NULL;
    END IF;
END $$;
