// CONSTRAINTS & INDEXES

// Concept node constraints and indexes
CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.id IS UNIQUE;
CREATE INDEX concept_type_idx IF NOT EXISTS
FOR (c:Concept) ON (c.concept_type);
CREATE INDEX concept_difficulty_idx IF NOT EXISTS
FOR (c:Concept) ON (c.difficulty_level);

// TaxonomyNode constraints and indexes
CREATE CONSTRAINT taxonomy_lcc_unique IF NOT EXISTS
FOR (t:TaxonomyNode) REQUIRE t.lcc_code IS UNIQUE;
CREATE INDEX taxonomy_level_idx IF NOT EXISTS
FOR (t:TaxonomyNode) ON (t.lcc_hierarchy_level);

// Step node constraints and indexes (for complex procedures only)
CREATE CONSTRAINT step_id_unique IF NOT EXISTS
FOR (s:Step) REQUIRE s.id IS UNIQUE;
CREATE INDEX step_sequence_idx IF NOT EXISTS
FOR (s:Step) ON (s.sequence_order);

// Source document constraints
CREATE CONSTRAINT source_id_unique IF NOT EXISTS
FOR (s:Source) REQUIRE s.id IS UNIQUE;

// Asset node constraints
CREATE CONSTRAINT asset_id_unique IF NOT EXISTS
FOR (a:Asset) REQUIRE a.id IS UNIQUE;

// NODE LABELS & PROPERTIES

// :Concept Node
//   id: UUID (matches concepts.id)
//   concept_type: ENUM (definition, procedure, example, assessment, learning_object, entity, formula)
//   difficulty_level: VARCHAR(20) (beginner, intermediate, advanced)
//   lcc_code: VARCHAR(20)

// :TaxonomyNode
//   lcc_code: VARCHAR(20)
//   lcc_label: VARCHAR(255)
//   lcc_hierarchy_level: INTEGER

// :Step Node
//   id: UUID
//   procedure_id: UUID
//   sequence_order: INTEGER

// :Source node
//   id: UUID
//   document_name: VARCHAR(500)
//   document_type: ENUM (pdf, webpage, book, paper, video, audio, word, excel, powerpoint, markdown, text, other)
//   language: VARCHAR(10)
//   author: VARCHAR(255)
//   publication_year: INTEGER

// :Asset Node
//   id: UUID
//   media_type: ENUM (code, image, video, diagram, audio, file)
//   programming_language: VARCHAR(50)
//   language: VARCHAR(10)
