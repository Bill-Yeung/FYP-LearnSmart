// Neo4j Seed Data — Demo Machine Learning Concepts
// Mirrors the PostgreSQL seed data in init_data.sql

// Source document node
MERGE (s:Source {id: 'a0000000-0000-0000-0000-000000000101'})
SET s.document_name = 'Introduction to Machine Learning';

// Concept nodes
MERGE (c1:Concept {id: 'c0000000-0000-0000-0000-000000000001'})
SET c1.concept_type = 'definition', c1.difficulty_level = 'intermediate', c1.lcc_code = 'QA';

MERGE (c2:Concept {id: 'c0000000-0000-0000-0000-000000000002'})
SET c2.concept_type = 'definition', c2.difficulty_level = 'advanced', c2.lcc_code = 'QA';

MERGE (c3:Concept {id: 'c0000000-0000-0000-0000-000000000003'})
SET c3.concept_type = 'procedure', c3.difficulty_level = 'beginner', c3.lcc_code = 'QA';

MERGE (c4:Concept {id: 'c0000000-0000-0000-0000-000000000004'})
SET c4.concept_type = 'procedure', c4.difficulty_level = 'intermediate', c4.lcc_code = 'QA';

MERGE (c5:Concept {id: 'c0000000-0000-0000-0000-000000000005'})
SET c5.concept_type = 'procedure', c5.difficulty_level = 'advanced', c5.lcc_code = 'QA';

MERGE (c6:Concept {id: 'c0000000-0000-0000-0000-000000000006'})
SET c6.concept_type = 'example', c6.difficulty_level = 'beginner', c6.lcc_code = 'QA';

MERGE (c7:Concept {id: 'c0000000-0000-0000-0000-000000000007'})
SET c7.concept_type = 'definition', c7.difficulty_level = 'beginner', c7.lcc_code = 'QA';

MERGE (c8:Concept {id: 'c0000000-0000-0000-0000-000000000008'})
SET c8.concept_type = 'definition', c8.difficulty_level = 'intermediate', c8.lcc_code = 'QA';

MERGE (c9:Concept {id: 'c0000000-0000-0000-0000-000000000009'})
SET c9.concept_type = 'formula', c9.difficulty_level = 'intermediate', c9.lcc_code = 'QA';

MERGE (c10:Concept {id: 'c0000000-0000-0000-0000-000000000010'})
SET c10.concept_type = 'formula', c10.difficulty_level = 'intermediate', c10.lcc_code = 'QA';

// Link all concepts to the source document (EXTRACTED_FROM)
MATCH (c:Concept), (s:Source {id: 'a0000000-0000-0000-0000-000000000101'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000005',
  'c0000000-0000-0000-0000-000000000006',
  'c0000000-0000-0000-0000-000000000007',
  'c0000000-0000-0000-0000-000000000008',
  'c0000000-0000-0000-0000-000000000009',
  'c0000000-0000-0000-0000-000000000010'
]
MERGE (c)-[:EXTRACTED_FROM]->(s);

// Link all concepts to taxonomy (CLASSIFIED_AS → QA = Mathematics)
MATCH (c:Concept), (t:TaxonomyNode {lcc_code: 'QA'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000005',
  'c0000000-0000-0000-0000-000000000006',
  'c0000000-0000-0000-0000-000000000007',
  'c0000000-0000-0000-0000-000000000008',
  'c0000000-0000-0000-0000-000000000009',
  'c0000000-0000-0000-0000-000000000010'
]
MERGE (c)-[:CLASSIFIED_AS]->(t);

// Concept relationships (mirrors concept_relationships + relationships tables)

// Machine Learning --HAS_PART--> Neural Networks, Supervised, Unsupervised, Decision Trees
// Neural Networks --HAS_PREREQUISITE--> Backpropagation, Gradient Descent
// Supervised Learning --EXEMPLIFIES--> Linear Regression
// Decision Trees --BUILDS_ON--> Random Forest
// Gradient Descent --SIMILAR_TO--> Loss Function
// Backpropagation --SIMILAR_TO--> Gradient Descent

// Machine Learning → Neural Networks (has_part, 0.90)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000001'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000002'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Machine Learning → Supervised Learning (has_part, 0.90)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000001'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000003'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Machine Learning → Unsupervised Learning (has_part, 0.85)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000001'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000004'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Neural Networks → Backpropagation (has_prerequisite, 0.95)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000002'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000005'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.95, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Supervised Learning → Linear Regression (exemplifies, 0.80)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000003'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000006'})
MERGE (a)-[r:EXEMPLIFIES]->(b)
SET r.strength = 0.80, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Machine Learning → Decision Trees (has_part, 0.85)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000001'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000007'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Decision Trees → Random Forest (builds_on, 0.90)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000007'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000008'})
MERGE (a)-[r:BUILDS_ON]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Neural Networks → Gradient Descent (has_prerequisite, 0.85)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000002'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000009'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Gradient Descent → Loss Function (similar_to, 0.90)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000009'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000010'})
MERGE (a)-[r:SIMILAR_TO]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Backpropagation → Gradient Descent (similar_to, 0.85)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000005'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000009'})
MERGE (a)-[r:SIMILAR_TO]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000101';

// Document 2: Introduction to Python Programming

// Source document node
MERGE (s2:Source {id: 'a0000000-0000-0000-0000-000000000102'})
SET s2.document_name = 'Introduction to Python Programming';

// Python Programming concepts (c011-c018)
MERGE (c11:Concept {id: 'c0000000-0000-0000-0000-000000000011'})
SET c11.concept_type = 'definition', c11.difficulty_level = 'beginner', c11.lcc_code = 'QA';

MERGE (c12:Concept {id: 'c0000000-0000-0000-0000-000000000012'})
SET c12.concept_type = 'definition', c12.difficulty_level = 'beginner', c12.lcc_code = 'QA';

MERGE (c13:Concept {id: 'c0000000-0000-0000-0000-000000000013'})
SET c13.concept_type = 'procedure', c13.difficulty_level = 'beginner', c13.lcc_code = 'QA';

MERGE (c14:Concept {id: 'c0000000-0000-0000-0000-000000000014'})
SET c14.concept_type = 'procedure', c14.difficulty_level = 'intermediate', c14.lcc_code = 'QA';

MERGE (c15:Concept {id: 'c0000000-0000-0000-0000-000000000015'})
SET c15.concept_type = 'definition', c15.difficulty_level = 'intermediate', c15.lcc_code = 'QA';

MERGE (c16:Concept {id: 'c0000000-0000-0000-0000-000000000016'})
SET c16.concept_type = 'example', c16.difficulty_level = 'beginner', c16.lcc_code = 'QA';

MERGE (c17:Concept {id: 'c0000000-0000-0000-0000-000000000017'})
SET c17.concept_type = 'definition', c17.difficulty_level = 'intermediate', c17.lcc_code = 'QA';

MERGE (c18:Concept {id: 'c0000000-0000-0000-0000-000000000018'})
SET c18.concept_type = 'procedure', c18.difficulty_level = 'advanced', c18.lcc_code = 'QA';

// Link Python concepts to source document
MATCH (c:Concept), (s:Source {id: 'a0000000-0000-0000-0000-000000000102'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000011',
  'c0000000-0000-0000-0000-000000000012',
  'c0000000-0000-0000-0000-000000000013',
  'c0000000-0000-0000-0000-000000000014',
  'c0000000-0000-0000-0000-000000000015',
  'c0000000-0000-0000-0000-000000000016',
  'c0000000-0000-0000-0000-000000000017',
  'c0000000-0000-0000-0000-000000000018'
]
MERGE (c)-[:EXTRACTED_FROM]->(s);

// Link Python concepts to taxonomy
MATCH (c:Concept), (t:TaxonomyNode {lcc_code: 'QA'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000011',
  'c0000000-0000-0000-0000-000000000012',
  'c0000000-0000-0000-0000-000000000013',
  'c0000000-0000-0000-0000-000000000014',
  'c0000000-0000-0000-0000-000000000015',
  'c0000000-0000-0000-0000-000000000016',
  'c0000000-0000-0000-0000-000000000017',
  'c0000000-0000-0000-0000-000000000018'
]
MERGE (c)-[:CLASSIFIED_AS]->(t);

// Python Programming relationships
// Python Programming → Variables (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000011'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000012'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Python Programming → Functions (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000011'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000013'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Functions → Lambda Functions (builds_on)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000013'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000014'})
MERGE (a)-[r:BUILDS_ON]->(b)
SET r.strength = 0.80, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Python Programming → Lists (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000011'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000015'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Lists → List Comprehension (exemplifies)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000015'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000016'})
MERGE (a)-[r:EXEMPLIFIES]->(b)
SET r.strength = 0.75, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Python Programming → Dictionaries (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000011'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000017'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Dictionaries → Generators (related_to)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000017'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000018'})
MERGE (a)-[r:RELATED_TO]->(b)
SET r.strength = 0.70, r.source_document = 'a0000000-0000-0000-0000-000000000102';

// Document 3: Data Structures and Algorithms

// Source document node
MERGE (s3:Source {id: 'a0000000-0000-0000-0000-000000000103'})
SET s3.document_name = 'Data Structures and Algorithms';

// Data Structures concepts (c021-c032)
MERGE (c21:Concept {id: 'c0000000-0000-0000-0000-000000000021'})
SET c21.concept_type = 'definition', c21.difficulty_level = 'intermediate', c21.lcc_code = 'QA';

MERGE (c22:Concept {id: 'c0000000-0000-0000-0000-000000000022'})
SET c22.concept_type = 'definition', c22.difficulty_level = 'beginner', c22.lcc_code = 'QA';

MERGE (c23:Concept {id: 'c0000000-0000-0000-0000-000000000023'})
SET c23.concept_type = 'procedure', c23.difficulty_level = 'beginner', c23.lcc_code = 'QA';

MERGE (c24:Concept {id: 'c0000000-0000-0000-0000-000000000024'})
SET c24.concept_type = 'definition', c24.difficulty_level = 'intermediate', c24.lcc_code = 'QA';

MERGE (c25:Concept {id: 'c0000000-0000-0000-0000-000000000025'})
SET c25.concept_type = 'procedure', c25.difficulty_level = 'intermediate', c25.lcc_code = 'QA';

MERGE (c26:Concept {id: 'c0000000-0000-0000-0000-000000000026'})
SET c26.concept_type = 'definition', c26.difficulty_level = 'intermediate', c26.lcc_code = 'QA';

MERGE (c27:Concept {id: 'c0000000-0000-0000-0000-000000000027'})
SET c27.concept_type = 'procedure', c27.difficulty_level = 'intermediate', c27.lcc_code = 'QA';

MERGE (c28:Concept {id: 'c0000000-0000-0000-0000-000000000028'})
SET c28.concept_type = 'definition', c28.difficulty_level = 'advanced', c28.lcc_code = 'QA';

MERGE (c29:Concept {id: 'c0000000-0000-0000-0000-000000000029'})
SET c29.concept_type = 'procedure', c29.difficulty_level = 'advanced', c29.lcc_code = 'QA';

MERGE (c30:Concept {id: 'c0000000-0000-0000-0000-000000000030'})
SET c30.concept_type = 'formula', c30.difficulty_level = 'advanced', c30.lcc_code = 'QA';

MERGE (c31:Concept {id: 'c0000000-0000-0000-0000-000000000031'})
SET c31.concept_type = 'procedure', c31.difficulty_level = 'intermediate', c31.lcc_code = 'QA';

MERGE (c32:Concept {id: 'c0000000-0000-0000-0000-000000000032'})
SET c32.concept_type = 'formula', c32.difficulty_level = 'intermediate', c32.lcc_code = 'QA';

// Link Data Structures concepts to source document
MATCH (c:Concept), (s:Source {id: 'a0000000-0000-0000-0000-000000000103'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000021',
  'c0000000-0000-0000-0000-000000000022',
  'c0000000-0000-0000-0000-000000000023',
  'c0000000-0000-0000-0000-000000000024',
  'c0000000-0000-0000-0000-000000000025',
  'c0000000-0000-0000-0000-000000000026',
  'c0000000-0000-0000-0000-000000000027',
  'c0000000-0000-0000-0000-000000000028',
  'c0000000-0000-0000-0000-000000000029',
  'c0000000-0000-0000-0000-000000000030',
  'c0000000-0000-0000-0000-000000000031',
  'c0000000-0000-0000-0000-000000000032'
]
MERGE (c)-[:EXTRACTED_FROM]->(s);

// Link Data Structures concepts to taxonomy
MATCH (c:Concept), (t:TaxonomyNode {lcc_code: 'QA'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000021',
  'c0000000-0000-0000-0000-000000000022',
  'c0000000-0000-0000-0000-000000000023',
  'c0000000-0000-0000-0000-000000000024',
  'c0000000-0000-0000-0000-000000000025',
  'c0000000-0000-0000-0000-000000000026',
  'c0000000-0000-0000-0000-000000000027',
  'c0000000-0000-0000-0000-000000000028',
  'c0000000-0000-0000-0000-000000000029',
  'c0000000-0000-0000-0000-000000000030',
  'c0000000-0000-0000-0000-000000000031',
  'c0000000-0000-0000-0000-000000000032'
]
MERGE (c)-[:CLASSIFIED_AS]->(t);

// Data Structures relationships
// Data Structures → Arrays (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000021'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000022'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Arrays → Array Traversal (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000022'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000023'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Data Structures → Linked Lists (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000021'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000024'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Linked Lists → Pointer Manipulation (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000024'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000025'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Data Structures → Stacks (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000021'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000026'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Stacks → Stack Push/Pop (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000026'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000027'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Data Structures → Binary Trees (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000021'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000028'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Binary Trees → Tree Traversal (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000028'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000029'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Binary Trees → Big O Notation (related_to)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000028'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000030'})
MERGE (a)-[r:RELATED_TO]->(b)
SET r.strength = 0.75, r.source_document = 'a0000000-0000-0000-0000-000000000103';

// Document 4: Introduction to Databases

// Source document node
MERGE (s4:Source {id: 'a0000000-0000-0000-0000-000000000104'})
SET s4.document_name = 'Introduction to Databases';

// Database concepts (c033-c042)
MERGE (c33:Concept {id: 'c0000000-0000-0000-0000-000000000033'})
SET c33.concept_type = 'definition', c33.difficulty_level = 'beginner', c33.lcc_code = 'QA';

MERGE (c34:Concept {id: 'c0000000-0000-0000-0000-000000000034'})
SET c34.concept_type = 'definition', c34.difficulty_level = 'beginner', c34.lcc_code = 'QA';

MERGE (c35:Concept {id: 'c0000000-0000-0000-0000-000000000035'})
SET c35.concept_type = 'procedure', c35.difficulty_level = 'intermediate', c35.lcc_code = 'QA';

MERGE (c36:Concept {id: 'c0000000-0000-0000-0000-000000000036'})
SET c36.concept_type = 'definition', c36.difficulty_level = 'intermediate', c36.lcc_code = 'QA';

MERGE (c37:Concept {id: 'c0000000-0000-0000-0000-000000000037'})
SET c37.concept_type = 'procedure', c37.difficulty_level = 'intermediate', c37.lcc_code = 'QA';

MERGE (c38:Concept {id: 'c0000000-0000-0000-0000-000000000038'})
SET c38.concept_type = 'definition', c38.difficulty_level = 'advanced', c38.lcc_code = 'QA';

MERGE (c39:Concept {id: 'c0000000-0000-0000-0000-000000000039'})
SET c39.concept_type = 'procedure', c39.difficulty_level = 'advanced', c39.lcc_code = 'QA';

MERGE (c40:Concept {id: 'c0000000-0000-0000-0000-000000000040'})
SET c40.concept_type = 'definition', c40.difficulty_level = 'intermediate', c40.lcc_code = 'QA';

MERGE (c41:Concept {id: 'c0000000-0000-0000-0000-000000000041'})
SET c41.concept_type = 'procedure', c41.difficulty_level = 'intermediate', c41.lcc_code = 'QA';

MERGE (c42:Concept {id: 'c0000000-0000-0000-0000-000000000042'})
SET c42.concept_type = 'definition', c42.difficulty_level = 'advanced', c42.lcc_code = 'QA';

// Link Database concepts to source document
MATCH (c:Concept), (s:Source {id: 'a0000000-0000-0000-0000-000000000104'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000033',
  'c0000000-0000-0000-0000-000000000034',
  'c0000000-0000-0000-0000-000000000035',
  'c0000000-0000-0000-0000-000000000036',
  'c0000000-0000-0000-0000-000000000037',
  'c0000000-0000-0000-0000-000000000038',
  'c0000000-0000-0000-0000-000000000039',
  'c0000000-0000-0000-0000-000000000040',
  'c0000000-0000-0000-0000-000000000041',
  'c0000000-0000-0000-0000-000000000042'
]
MERGE (c)-[:EXTRACTED_FROM]->(s);

// Link Database concepts to taxonomy
MATCH (c:Concept), (t:TaxonomyNode {lcc_code: 'QA'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000033',
  'c0000000-0000-0000-0000-000000000034',
  'c0000000-0000-0000-0000-000000000035',
  'c0000000-0000-0000-0000-000000000036',
  'c0000000-0000-0000-0000-000000000037',
  'c0000000-0000-0000-0000-000000000038',
  'c0000000-0000-0000-0000-000000000039',
  'c0000000-0000-0000-0000-000000000040',
  'c0000000-0000-0000-0000-000000000041',
  'c0000000-0000-0000-0000-000000000042'
]
MERGE (c)-[:CLASSIFIED_AS]->(t);

// Database relationships
// Database → Relational Database (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000033'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000034'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Relational Database → SQL Queries (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000034'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000035'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.95, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Database → Tables (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000033'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000036'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Tables → Joins (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000036'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000037'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Database → Normalization (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000033'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000038'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Normalization → Third Normal Form (builds_on)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000038'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000039'})
MERGE (a)-[r:BUILDS_ON]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Database → Transactions (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000033'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000040'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Transactions → ACID Properties (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000040'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000041'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.95, r.source_document = 'a0000000-0000-0000-0000-000000000104';

// Document 5: Introduction to Classical Mechanics (Physics)

// Source document node
MERGE (s5:Source {id: 'a0000000-0000-0000-0000-000000000105'})
SET s5.document_name = 'Introduction to Classical Mechanics';

// Physics concepts (c043-c052)
MERGE (c43:Concept {id: 'c0000000-0000-0000-0000-000000000043'})
SET c43.concept_type = 'definition', c43.difficulty_level = 'beginner', c43.lcc_code = 'QC';

MERGE (c44:Concept {id: 'c0000000-0000-0000-0000-000000000044'})
SET c44.concept_type = 'definition', c44.difficulty_level = 'beginner', c44.lcc_code = 'QC';

MERGE (c45:Concept {id: 'c0000000-0000-0000-0000-000000000045'})
SET c45.concept_type = 'formula', c45.difficulty_level = 'beginner', c45.lcc_code = 'QC';

MERGE (c46:Concept {id: 'c0000000-0000-0000-0000-000000000046'})
SET c46.concept_type = 'definition', c46.difficulty_level = 'intermediate', c46.lcc_code = 'QC';

MERGE (c47:Concept {id: 'c0000000-0000-0000-0000-000000000047'})
SET c47.concept_type = 'formula', c47.difficulty_level = 'intermediate', c47.lcc_code = 'QC';

MERGE (c48:Concept {id: 'c0000000-0000-0000-0000-000000000048'})
SET c48.concept_type = 'definition', c48.difficulty_level = 'intermediate', c48.lcc_code = 'QC';

MERGE (c49:Concept {id: 'c0000000-0000-0000-0000-000000000049'})
SET c49.concept_type = 'formula', c49.difficulty_level = 'intermediate', c49.lcc_code = 'QC';

MERGE (c50:Concept {id: 'c0000000-0000-0000-0000-000000000050'})
SET c50.concept_type = 'definition', c50.difficulty_level = 'advanced', c50.lcc_code = 'QC';

MERGE (c51:Concept {id: 'c0000000-0000-0000-0000-000000000051'})
SET c51.concept_type = 'formula', c51.difficulty_level = 'advanced', c51.lcc_code = 'QC';

MERGE (c52:Concept {id: 'c0000000-0000-0000-0000-000000000052'})
SET c52.concept_type = 'definition', c52.difficulty_level = 'intermediate', c52.lcc_code = 'QC';

// Link Physics concepts to source document
MATCH (c:Concept), (s:Source {id: 'a0000000-0000-0000-0000-000000000105'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000043',
  'c0000000-0000-0000-0000-000000000044',
  'c0000000-0000-0000-0000-000000000045',
  'c0000000-0000-0000-0000-000000000046',
  'c0000000-0000-0000-0000-000000000047',
  'c0000000-0000-0000-0000-000000000048',
  'c0000000-0000-0000-0000-000000000049',
  'c0000000-0000-0000-0000-000000000050',
  'c0000000-0000-0000-0000-000000000051',
  'c0000000-0000-0000-0000-000000000052'
]
MERGE (c)-[:EXTRACTED_FROM]->(s);

// Link Physics concepts to taxonomy (QC = Physics)
MATCH (c:Concept), (t:TaxonomyNode {lcc_code: 'QC'})
WHERE c.id IN [
  'c0000000-0000-0000-0000-000000000043',
  'c0000000-0000-0000-0000-000000000044',
  'c0000000-0000-0000-0000-000000000045',
  'c0000000-0000-0000-0000-000000000046',
  'c0000000-0000-0000-0000-000000000047',
  'c0000000-0000-0000-0000-000000000048',
  'c0000000-0000-0000-0000-000000000049',
  'c0000000-0000-0000-0000-000000000050',
  'c0000000-0000-0000-0000-000000000051',
  'c0000000-0000-0000-0000-000000000052'
]
MERGE (c)-[:CLASSIFIED_AS]->(t);

// Physics relationships
// Classical Mechanics → Newton's Laws (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000043'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000044'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.95, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Newton's Laws → Force Equation (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000044'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000045'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.95, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Classical Mechanics → Kinematics (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000043'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000046'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Kinematics → Equations of Motion (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000046'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000047'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Classical Mechanics → Energy (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000043'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000048'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Energy → Work-Energy Theorem (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000048'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000049'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.90, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Classical Mechanics → Momentum (has_part)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000043'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000050'})
MERGE (a)-[r:HAS_PART]->(b)
SET r.strength = 0.85, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Momentum → Conservation of Momentum (has_prerequisite)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000050'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000051'})
MERGE (a)-[r:HAS_PREREQUISITE]->(b)
SET r.strength = 0.95, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Energy → Momentum (similar_to)
MATCH (a:Concept {id: 'c0000000-0000-0000-0000-000000000048'})
MATCH (b:Concept {id: 'c0000000-0000-0000-0000-000000000050'})
MERGE (a)-[r:SIMILAR_TO]->(b)
SET r.strength = 0.80, r.source_document = 'a0000000-0000-0000-0000-000000000105';

// Flashcard Exam Questions (31 total) — Connected to Concepts
// Links all exam_questions to concepts for learning path generation

// Create all 31 ExamQuestion nodes
UNWIND [
  {id: '70000000-0000-0000-0000-000000000001', qno: 'Q1', exam: 'DSE', year: 2023},
  {id: '70000000-0000-0000-0000-000000000002', qno: 'Q5', exam: 'ALevel', year: 2022},
  {id: '70000000-0000-0000-0000-000000000003', qno: 'Q7', exam: 'DSE', year: 2021},
  {id: '70000000-0000-0000-0000-000000000004', qno: 'Q3', exam: 'Mock', year: 2024},
  {id: '70000000-0000-0000-0000-000000000005', qno: 'Q9', exam: 'DSE', year: 2020},
  {id: '70000000-0000-0000-0000-000000000006', qno: 'Q12', exam: 'ALevel', year: 2023},
  {id: '70000000-0000-0000-0000-000000000007', qno: 'Q10', exam: 'Mock', year: 2024},
  {id: '70000000-0000-0000-0000-000000000008', qno: 'Q11', exam: 'DSE', year: 2023},
  {id: '70000000-0000-0000-0000-000000000009', qno: 'Q14', exam: 'ALevel', year: 2021},
  {id: '70000000-0000-0000-0000-00000000000a', qno: 'Q2', exam: 'Mock', year: 2025},
  {id: '70000000-0000-0000-0000-00000000000b', qno: 'Q6', exam: 'DSE', year: 2022},
  {id: '70000000-0000-0000-0000-00000000000c', qno: 'Q8', exam: 'Mock', year: 2024},
  {id: '70000000-0000-0000-0000-00000000000d', qno: 'Q4', exam: 'ALevel', year: 2020},
  {id: '70000000-0000-0000-0000-00000000000e', qno: 'Q12', exam: 'DSE', year: 2021},
  {id: '70000000-0000-0000-0000-00000000000f', qno: 'Q9', exam: 'Mock', year: 2025},
  {id: '70000000-0000-0000-0000-000000000010', qno: 'Q16', exam: 'ALevel', year: 2022},
  {id: '70000000-0000-0000-0000-000000000011', qno: 'Q2', exam: 'DSE', year: 2020},
  {id: '70000000-0000-0000-0000-000000000012', qno: 'Q6', exam: 'Mock', year: 2024},
  {id: '70000000-0000-0000-0000-000000000013', qno: 'Q7', exam: 'ALevel', year: 2023},
  {id: '70000000-0000-0000-0000-000000000014', qno: 'Q14', exam: 'DSE', year: 2022},
  {id: '70000000-0000-0000-0000-000000000015', qno: 'Q15', exam: 'Mock', year: 2024},
  {id: '70000000-0000-0000-0000-000000000016', qno: 'Q9', exam: 'ALevel', year: 2022},
  {id: '70000000-0000-0000-0000-000000000017', qno: 'Q18', exam: 'DSE', year: 2023},
  {id: '70000000-0000-0000-0000-000000000018', qno: 'Q12', exam: 'Mock', year: 2025},
  {id: '70000000-0000-0000-0000-000000000019', qno: 'Q4', exam: 'ALevel', year: 2024},
  {id: '70000000-0000-0000-0000-00000000001a', qno: 'Q8', exam: 'DSE', year: 2022},
  {id: '70000000-0000-0000-0000-00000000001b', qno: 'Q10', exam: 'Mock', year: 2024},
  {id: '70000000-0000-0000-0000-00000000001c', qno: 'Q11', exam: 'ALevel', year: 2021},
  {id: '70000000-0000-0000-0000-00000000001d', qno: 'Q16', exam: 'DSE', year: 2020},
  {id: '70000000-0000-0000-0000-00000000001e', qno: 'Q5', exam: 'Mock', year: 2025}
] AS q
MERGE (exam:ExamQuestion {id: q.id})
SET exam.question_no = q.qno, exam.exam = q.exam, exam.year = q.year;

// Link Q1 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000001'})
MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'})
MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.85;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000001'})
MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000001'})
MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q2 to c009, c010
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000002'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000002'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;

// Link Q3 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000003'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000003'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000003'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q4 to c019, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000004'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.85;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000004'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;

// Link Q5 to c041, c042, c048
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000005'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000041'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000005'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000042'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000005'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000048'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q6 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000006'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000006'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000006'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q7 to c019, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000007'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.85;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000007'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;

// Link Q8 to c009, c010, c048
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000008'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000008'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000008'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000048'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q9 to c009, c010, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000009'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000009'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000009'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q10 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000a'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000a'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000a'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q11 to c009, c010, c019
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000b'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000b'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000b'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.65;

// Link Q12 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000c'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000c'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000c'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q13 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000d'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000d'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000d'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.65;

// Link Q14 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000e'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000e'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000e'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q15 to c009, c010, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000f'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000f'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000000f'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q16 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000010'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000010'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000010'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q17 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000011'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000011'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000011'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q18 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000012'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000012'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000012'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q19 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000013'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000013'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000013'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q20 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000014'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000014'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000014'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q21 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000015'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000015'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000015'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.65;

// Link Q22 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000016'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000016'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000016'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q23 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000017'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000017'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000017'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q24 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000018'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000018'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000018'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q25 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000019'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000019'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-000000000019'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q26 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001a'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001a'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001a'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q27 to c019, c021, c027
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001b'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000019'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001b'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001b'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000027'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q28 to c041, c042, c048
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001c'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000041'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001c'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000042'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001c'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000048'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q29 to c043, c044, c046
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001d'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000043'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001d'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000044'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001d'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000046'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;

// Link Q30 to c009, c010, c021
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001e'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000009'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.80;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001e'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000010'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.75;
MATCH (q:ExamQuestion {id: '70000000-0000-0000-0000-00000000001e'}) MATCH (c:Concept {id: 'c0000000-0000-0000-0000-000000000021'}) MERGE (q)-[r:TESTS]->(c) SET r.relevance = 0.70;
