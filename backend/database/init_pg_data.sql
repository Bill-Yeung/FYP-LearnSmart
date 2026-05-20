INSERT INTO error_categories (id, slug, label, description, color_hex, icon, is_system, sort_order)
VALUES
  ('ec000000-0000-0000-0000-000000000001', 'conceptual_misunderstanding', 'Concept Mistake',    'Misunderstood a core concept or principle',          '#7C3AED', 'lightbulb',    TRUE, 1),
  ('ec000000-0000-0000-0000-000000000002', 'calculation_error',           'Calculation Error',  'Arithmetic or algebraic computation went wrong',    '#DC2626', 'calculator',   TRUE, 2),
  ('ec000000-0000-0000-0000-000000000003', 'memory_slip',                 'Memory Slip',        'Forgot a formula, fact, or definition',              '#D97706', 'brain',        TRUE, 3),
  ('ec000000-0000-0000-0000-000000000004', 'misinterpretation',           'Misinterpretation',  'Misread or misunderstood the question',              '#2563EB', 'eye',          TRUE, 4),
  ('ec000000-0000-0000-0000-000000000005', 'procedural_error',            'Procedural Error',   'Correct concept but wrong steps or method',         '#EA580C', 'list',         TRUE, 5),
  ('ec000000-0000-0000-0000-000000000006', 'careless_mistake',            'Careless Mistake',   'Simple slip under time pressure or inattention',    '#16A34A', 'zap',          TRUE, 6),
  ('ec000000-0000-0000-0000-000000000007', 'knowledge_gap',               'Knowledge Gap',      'Topic was never properly learned or revised',        '#0891B2', 'book-open',    TRUE, 7),
  ('ec000000-0000-0000-0000-000000000008', 'sign_error',                  'Sign Error',         'Got the sign (+/-) wrong in an expression',          '#DB2777', 'plus-minus',   TRUE, 8),
  ('ec000000-0000-0000-0000-000000000009', 'unit_error',                  'Unit / Format Error','Wrong units, notation, or answer format',            '#9333EA', 'ruler',        TRUE, 9),
  ('ec000000-0000-0000-0000-000000000010', 'time_pressure',               'Time Pressure',      'Rushed and made avoidable errors',                   '#F59E0B', 'clock',        TRUE, 10),
  ('ec000000-0000-0000-0000-00000000000f', 'unknown',                     'Uncategorised',      'Category not yet determined',                        '#6B7280', 'tag',          TRUE, 99)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role, display_name, is_active, email_verified) VALUES
(
'00000000-0000-0000-0000-000000000001'::uuid,
'admin',
'admin@learningplatform.com',
crypt('password123', gen_salt('bf', 10)),
'admin',
'System Administrator',
TRUE,
TRUE
),
(
'00000000-0000-0000-0000-000000000002'::uuid,
'teacher_demo',
'teacher@hkive.com',
crypt('password123', gen_salt('bf', 10)),
'teacher',
'Demo Teacher',
TRUE,
TRUE
),
(
'00000000-0000-0000-0000-000000000003'::uuid,
'student_demo',
'student@hkive.com',
crypt('password123', gen_salt('bf', 10)), 
'student',
'Demo Student',
TRUE,
TRUE
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role, display_name, is_active, email_verified) VALUES
('00000000-0000-0000-0000-000000000004'::uuid, 'alice_chan', 'alice@hkive.com', crypt('password123', gen_salt('bf', 10)), 'student', 'Alice Chan', TRUE, TRUE),
('00000000-0000-0000-0000-000000000005'::uuid, 'bob_wong', 'bob@hkive.com', crypt('password123', gen_salt('bf', 10)), 'student', 'Bob Wong', TRUE, TRUE),
('00000000-0000-0000-0000-000000000006'::uuid, 'carol_lee', 'carol@hkive.com', crypt('password123', gen_salt('bf', 10)), 'student', 'Carol Lee', TRUE, TRUE),
('00000000-0000-0000-0000-000000000007'::uuid, 'david_chen', 'david@hkive.com', crypt('password123', gen_salt('bf', 10)), 'student', 'David Chen', TRUE, TRUE),
('00000000-0000-0000-0000-000000000008'::uuid, 'emma_yip', 'emma@hkive.com', crypt('password123', gen_salt('bf', 10)), 'student', 'Emma Yip', TRUE, TRUE),
('00000000-0000-0000-0000-000000000009'::uuid, 'frank_lam', 'frank@hkive.com', crypt('password123', gen_salt('bf', 10)), 'student', 'Frank Lam', TRUE, TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO user_profiles (
user_id,
bio,
organization,
department,
level,
domain_level,
difficulty_preference,
ai_assistance_level,
total_play_time_minutes,
scripts_completed
) VALUES
(
'00000000-0000-0000-0000-000000000001'::uuid,
'System administrator account for managing the learning platform',
'Learning Platform',
'IT Department',
'Staff',
'advanced',
'medium',
'moderate',
0,
0
),
(
'00000000-0000-0000-0000-000000000002'::uuid,
'Demo teacher account for testing educational features',
'Demo University',
'Computer Science',
'Faculty',
'advanced',
'medium',
'moderate',
0,
0
),
(
'00000000-0000-0000-0000-000000000003'::uuid,
'Demo student account for testing learning features',
'Demo University',
'Computer Science',
'Undergraduate',
'beginner',
'medium',
'moderate',
0,
0
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_profiles (user_id, bio, organization, department, level, domain_level, difficulty_preference, ai_assistance_level, total_play_time_minutes, scripts_completed) VALUES
('00000000-0000-0000-0000-000000000004'::uuid, 'CS student interested in AI and web development', 'Demo University', 'Computer Science', 'Undergraduate', 'intermediate', 'medium', 'moderate', 0, 0),
('00000000-0000-0000-0000-000000000005'::uuid, 'Data science enthusiast, love building ML models', 'Demo University', 'Computer Science', 'Undergraduate', 'beginner', 'easy', 'full', 0, 0),
('00000000-0000-0000-0000-000000000006'::uuid, 'Full-stack developer, preparing for HKDSE ICT', 'Demo University', 'Computer Science', 'Undergraduate', 'intermediate', 'hard', 'minimal', 0, 0),
('00000000-0000-0000-0000-000000000007'::uuid, 'Interested in deep learning and NLP.', 'Demo University', 'Computer Science', 'Undergraduate', 'intermediate', 'hard', 'moderate', 0, 0),
('00000000-0000-0000-0000-000000000008'::uuid, 'Physics enthusiast, loves quantum mechanics.', 'Demo University', 'Physics', 'Undergraduate', 'beginner', 'medium', 'full', 0, 0),
('00000000-0000-0000-0000-000000000009'::uuid, 'Algorithm nerd and competitive programmer.', 'Demo University', 'Computer Science', 'Postgraduate', 'advanced', 'hard', 'minimal', 0, 0)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO likes (user_id, entity_type, entity_id, created_at) VALUES
('00000000-0000-0000-0000-000000000002'::uuid, 'discussion_thread',
    'd4000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '2 days'),
('00000000-0000-0000-0000-000000000003'::uuid, 'discussion_reply',
    'd3000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '1 day'),
('00000000-0000-0000-0000-000000000003'::uuid, 'activity',
    'af000000-0000-0000-0000-000000000001'::uuid, CURRENT_TIMESTAMP - INTERVAL '12 hours')
ON CONFLICT DO NOTHING;

INSERT INTO subjects (id, code, name, description) VALUES
('e0000000-0000-0000-0000-000000000001'::uuid, 'HKDSE-ICT',   'ICT (HKDSE)',               'Information and Communication Technology — HKDSE elective'),
('e0000000-0000-0000-0000-000000000002'::uuid, 'HKDSE-MATH-C','Mathematics Compulsory (HKDSE)', 'HKDSE Mathematics Compulsory Part'),
('e0000000-0000-0000-0000-000000000003'::uuid, 'HKDSE-MATH-M1','Mathematics M1 (HKDSE)',    'HKDSE Mathematics Extended Part Module 1 — Calculus and Statistics'),
('e0000000-0000-0000-0000-000000000004'::uuid, 'HKDSE-MATH-M2','Mathematics M2 (HKDSE)',    'HKDSE Mathematics Extended Part Module 2 — Algebra and Calculus'),
('e0000000-0000-0000-0000-000000000005'::uuid, 'HKDSE-PHY',   'Physics (HKDSE)',           'HKDSE Physics elective'),
('e0000000-0000-0000-0000-000000000006'::uuid, 'HKDSE-CHEM',  'Chemistry (HKDSE)',         'HKDSE Chemistry elective'),
('e0000000-0000-0000-0000-000000000007'::uuid, 'HKDSE-BIO',   'Biology (HKDSE)',           'HKDSE Biology elective'),
('e0000000-0000-0000-0000-000000000008'::uuid, 'HKDSE-ECON',  'Economics (HKDSE)',         'HKDSE Economics elective'),
('e0000000-0000-0000-0000-000000000009'::uuid, 'HKDSE-BAFS',  'BAFS (HKDSE)',              'HKDSE Business, Accounting and Financial Studies'),
('e0000000-0000-0000-0000-00000000000a'::uuid, 'HKDSE-CHIN',  'Chinese Language (HKDSE)',  'HKDSE Chinese Language core subject'),
('e0000000-0000-0000-0000-00000000000b'::uuid, 'HKDSE-ENG',   'English Language (HKDSE)',  'HKDSE English Language core subject'),
('e0000000-0000-0000-0000-00000000000c'::uuid, 'HKDSE-CS',    'Citizenship and Social Development (HKDSE)', 'HKDSE core subject (replaced Liberal Studies)'),
('e0000000-0000-0000-0000-00000000000d'::uuid, 'IVE-IT114115','IT114115 (IVE)',            'IVE IT114115 — Artificial Intelligence and Machine Learning'),
('e0000000-0000-0000-0000-00000000000e'::uuid, 'GENERAL-CS',  'Computer Science (General)', 'General computer science concepts')
ON CONFLICT (code) DO NOTHING;

INSERT INTO relationships (id, relationship_type, direction) VALUES
('10000000-0000-0000-0000-000000000001'::uuid, 'part_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000002'::uuid, 'has_part', 'unidirectional'),
('10000000-0000-0000-0000-000000000003'::uuid, 'characteristic_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000004'::uuid, 'has_characteristic', 'unidirectional'),
('10000000-0000-0000-0000-000000000005'::uuid, 'member_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000006'::uuid, 'has_member', 'unidirectional'),
('10000000-0000-0000-0000-000000000007'::uuid, 'has_subsequence', 'unidirectional'),
('10000000-0000-0000-0000-000000000008'::uuid, 'is_subsequence_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000009'::uuid, 'participates_in', 'unidirectional'),
('10000000-0000-0000-0000-000000000010'::uuid, 'prerequisite_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000011'::uuid, 'has_prerequisite', 'unidirectional'),
('10000000-0000-0000-0000-000000000012'::uuid, 'applies_to', 'unidirectional'),
('10000000-0000-0000-0000-000000000013'::uuid, 'applied_in', 'unidirectional'),
('10000000-0000-0000-0000-000000000014'::uuid, 'builds_on', 'unidirectional'),
('10000000-0000-0000-0000-000000000015'::uuid, 'exemplifies', 'unidirectional'),
('10000000-0000-0000-0000-000000000016'::uuid, 'derives_from', 'unidirectional'),
('10000000-0000-0000-0000-000000000017'::uuid, 'author', 'unidirectional'),
('10000000-0000-0000-0000-000000000018'::uuid, 'introduced_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000019'::uuid, 'simultaneous_with', 'bidirectional'),
('10000000-0000-0000-0000-000000000020'::uuid, 'happens_during', 'unidirectional'),
('10000000-0000-0000-0000-000000000021'::uuid, 'before_or_simultaneous_with', 'unidirectional'),
('10000000-0000-0000-0000-000000000022'::uuid, 'starts_before', 'unidirectional'),
('10000000-0000-0000-0000-000000000023'::uuid, 'ends_after', 'unidirectional'),
('10000000-0000-0000-0000-000000000024'::uuid, 'derives_into', 'unidirectional'),
('10000000-0000-0000-0000-000000000025'::uuid, 'located_in', 'unidirectional'),
('10000000-0000-0000-0000-000000000026'::uuid, 'location_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000027'::uuid, 'overlaps', 'bidirectional'),
('10000000-0000-0000-0000-000000000028'::uuid, 'adjacent_to', 'bidirectional'),
('10000000-0000-0000-0000-000000000029'::uuid, 'surrounded_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000030'::uuid, 'connected_to', 'bidirectional'),
('10000000-0000-0000-0000-000000000031'::uuid, 'causally_related_to', 'unidirectional'),
('10000000-0000-0000-0000-000000000032'::uuid, 'regulates', 'unidirectional'),
('10000000-0000-0000-0000-000000000033'::uuid, 'regulated_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000034'::uuid, 'enables', 'unidirectional'),
('10000000-0000-0000-0000-000000000035'::uuid, 'contributes_to', 'unidirectional'),
('10000000-0000-0000-0000-000000000036'::uuid, 'results_in_assembly_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000037'::uuid, 'results_in_breakdown_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000038'::uuid, 'capable_of', 'unidirectional'),
('10000000-0000-0000-0000-000000000039'::uuid, 'interacts_with', 'bidirectional'),
('10000000-0000-0000-0000-000000000040'::uuid, 'has_participant', 'unidirectional'),
('10000000-0000-0000-0000-000000000041'::uuid, 'implies', 'unidirectional'),
('10000000-0000-0000-0000-000000000042'::uuid, 'contradicts', 'bidirectional'),
('10000000-0000-0000-0000-000000000043'::uuid, 'similar_to', 'bidirectional'),
('10000000-0000-0000-0000-000000000044'::uuid, 'owns', 'unidirectional'),
('10000000-0000-0000-0000-000000000045'::uuid, 'is_owned_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000046'::uuid, 'produces', 'unidirectional'),
('10000000-0000-0000-0000-000000000047'::uuid, 'produced_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000048'::uuid, 'determined_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000049'::uuid, 'determines', 'unidirectional'),
('10000000-0000-0000-0000-000000000050'::uuid, 'correlated_with', 'bidirectional'),
('10000000-0000-0000-0000-000000000051'::uuid, 'implements', 'unidirectional'),
('10000000-0000-0000-0000-000000000052'::uuid, 'implemented_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000053'::uuid, 'proves', 'unidirectional'),
('10000000-0000-0000-0000-000000000054'::uuid, 'proven_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000055'::uuid, 'generalizes', 'unidirectional'),
('10000000-0000-0000-0000-000000000056'::uuid, 'specialized_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000057'::uuid, 'approximates', 'unidirectional'),
('10000000-0000-0000-0000-000000000058'::uuid, 'approximated_by', 'unidirectional'),
('10000000-0000-0000-0000-000000000059'::uuid, 'replaces', 'unidirectional'),
('10000000-0000-0000-0000-000000000060'::uuid, 'replaced_by', 'unidirectional')
ON CONFLICT (id) DO NOTHING;

INSERT INTO exam_questions (id, source_exam, subject_id, year, paper, question_no, topic, question_stem, question_type, options, correct_answer, answer_explanation, related_concept_ids, difficulty_level)
VALUES
('70000000-0000-0000-0000-000000000001', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P1', 'Q1', 'Vectors', 'Given vectors a = (3, 2) and b = (-1, 1), find |a + b|.', 'mcq', '["A. 2", "B. sqrt(5)", "C. sqrt(13)", "D. 5"]'::jsonb, 'C', 'Add components: a + b = (3+(-1), 2+1) = (2, 3). Magnitude: |a+b| = sqrt(2^2 + 3^2) = sqrt(4+9) = sqrt(13).', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000003', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2021, 'P1', 'Q7', 'Probability', 'A biased coin shows heads with probability 0.6. After 5 tosses, what is P(exactly 3 heads)?', 'mcq', '["A. 0.1536", "B. 0.3456", "C. 0.5000", "D. 0.6000"]'::jsonb, 'B', 'Use binomial: C(5,3)*(0.6^3)*(0.4^2) = 10*0.216*0.16 = 0.3456.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000004', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q3', 'Geometry', 'Find the area of a triangle with vertices (0,0), (4,0), (4,5).', 'mcq', '["A. 8", "B. 10", "C. 12", "D. 20"]'::jsonb, 'B', 'Right triangle with base 4 and height 5: area = 1/2 * 4 * 5 = 10.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000000a', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P2', 'Q2', 'Complex Numbers', 'Find the modulus of complex number z = -3 + 4i.', 'mcq', '["A. 1", "B. 4", "C. 5", "D. 7"]'::jsonb, 'C', 'Use |z| = sqrt((-3)^2 + 4^2) = sqrt(9+16) = sqrt(25) = 5.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000000b', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P1', 'Q6', 'Algebra', 'Solve 3x^2 - 12x + 9 = 0.', 'mcq', '["A. x=1 or x=3", "B. x=1 or x=3/2", "C. x=1/2 or x=3", "D. x=2 or x=3"]'::jsonb, 'A', 'Factor: 3(x^2 - 4x + 3) = 3(x-1)(x-3) = 0, so x=1 or x=3.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000019"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000010', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P1', 'Q16', 'Probability', 'A fair die is rolled 4 times. What is P(exactly one six)?', 'mcq', '["A. 0.4823", "B. 0.3955", "C. 0.4444", "D. 0.2637"]'::jsonb, 'B', 'C(4,1) * (1/6)^1 * (5/6)^3 = 4 * (1/6) * (125/216) ≈ 0.3955.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000001f', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q4', 'Calculus', 'Which of the following is the derivative of sin(x)?', 'mcq', '["A. -sin(x)", "B. cos(x)", "C. -cos(x)", "D. tan(x)"]'::jsonb, 'B', 'd/dx [sin(x)] = cos(x). This is a fundamental differentiation rule.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000020', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q3', 'Logarithms', 'Which value of x satisfies log_2(x) = 5?', 'mcq', '["A. 10", "B. 16", "C. 32", "D. 64"]'::jsonb, 'C', 'log_2(x) = 5 means x = 2^5 = 32.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000021', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P2', 'Q3', 'Geometry', 'What is the sum of interior angles of a hexagon?', 'mcq', '["A. 540°", "B. 720°", "C. 900°", "D. 1080°"]'::jsonb, 'B', 'Sum of interior angles of an n-gon = (n-2)*180°. For n=6: (6-2)*180 = 720°.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000022', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P2', 'Q5', 'Statistics', 'If the mean of 5 numbers is 12, what is their sum?', 'mcq', '["A. 12", "B. 36", "C. 60", "D. 144"]'::jsonb, 'C', 'Sum = mean × count = 12 × 5 = 60.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000023', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P1', 'Q8', 'Trigonometry', 'Which of the following is equivalent to cos(2x)?', 'mcq', '["A. 2sin(x)cos(x)", "B. cos^2(x) - sin^2(x)", "C. 1 + 2sin^2(x)", "D. 2cos(x) - 1"]'::jsonb, 'B', 'The double angle identity: cos(2x) = cos^2(x) - sin^2(x). Also equal to 2cos^2(x)-1 or 1-2sin^2(x).', '{"c0000000-0000-0000-0000-000000000041","c0000000-0000-0000-0000-000000000042"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000024', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q7', 'Probability', 'What is the probability of rolling a sum of 7 with two fair dice?', 'mcq', '["A. 1/6", "B. 5/36", "C. 7/36", "D. 1/12"]'::jsonb, 'A', 'Combinations that sum to 7: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6 outcomes. P = 6/36 = 1/6.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000025', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P2', 'Q3', 'Algebra', 'Which is the correct formula for the quadratic formula?', 'mcq', '["A. x = (-b ± sqrt(b^2 - 4ac)) / 2a", "B. x = (-b ± sqrt(b^2 + 4ac)) / 2a", "C. x = (b ± sqrt(b^2 - 4ac)) / 2a", "D. x = (-b ± sqrt(b^2 - 4ac)) / a"]'::jsonb, 'A', 'The quadratic formula for ax^2+bx+c=0 is x = (-b ± sqrt(b^2 - 4ac)) / (2a).', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000019"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000026', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P2', 'Q6', 'Trigonometry', 'What is the value of sin(30°)?', 'mcq', '["A. √3/2", "B. 1/2", "C. √2/2", "D. 1"]'::jsonb, 'B', 'sin(30°) = 1/2. This is a standard trigonometric value.', '{"c0000000-0000-0000-0000-000000000041","c0000000-0000-0000-0000-000000000042"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000027', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P1', 'Q5', 'Indices', 'Evaluate: (3^4) / (3^2).', 'mcq', '["A. 3", "B. 6", "C. 9", "D. 27"]'::jsonb, 'C', '3^4 / 3^2 = 3^(4-2) = 3^2 = 9.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000028', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2021, 'P1', 'Q5', 'Algebra', 'The roots of x^2 - 5x + 6 = 0 are:', 'mcq', '["A. 2 and 3", "B. -2 and -3", "C. 1 and 6", "D. -1 and 6"]'::jsonb, 'A', 'Factor: (x-2)(x-3) = 0, so x = 2 or x = 3.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000019"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000029', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q9', 'Integration', 'Which of the following is the integral of cos(x)?', 'mcq', '["A. -sin(x) + C", "B. sin(x) + C", "C. tan(x) + C", "D. -cos(x) + C"]'::jsonb, 'B', '∫cos(x) dx = sin(x) + C. Standard integration result.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000002a', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P2', 'Q2', 'Coordinate Geometry', 'A circle has centre (0,0) and passes through (3,4). What is its radius?', 'mcq', '["A. 3", "B. 4", "C. 5", "D. 7"]'::jsonb, 'C', 'r = sqrt(3^2 + 4^2) = sqrt(9+16) = sqrt(25) = 5.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000002b', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P1', 'Q11', 'Limits', 'What is lim_{x→∞} (3x^2 + 1) / (x^2 - 5)?', 'mcq', '["A. 0", "B. 1", "C. 3", "D. ∞"]'::jsonb, 'C', 'Divide numerator and denominator by x^2: (3 + 1/x^2) / (1 - 5/x^2) → 3/1 = 3 as x→∞.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000027"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000002c', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P2', 'Q8', 'Trigonometry', 'Which expression equals tan(x)?', 'mcq', '["A. sin(x)/cos(x)", "B. cos(x)/sin(x)", "C. 1/cos(x)", "D. 1/sin(x)"]'::jsonb, 'A', 'By definition, tan(x) = sin(x)/cos(x).', '{"c0000000-0000-0000-0000-000000000041","c0000000-0000-0000-0000-000000000042"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000002d', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q10', 'Combinatorics', 'How many ways can 5 books be arranged on a shelf?', 'mcq', '["A. 5", "B. 25", "C. 60", "D. 120"]'::jsonb, 'D', '5! = 5 × 4 × 3 × 2 × 1 = 120 arrangements.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000002e', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P2', 'Q4', 'Sequences', 'Which of the following is NOT a geometric sequence?', 'mcq', '["A. 2, 4, 8, 16", "B. 3, 9, 27, 81", "C. 1, 3, 5, 7", "D. 5, 10, 20, 40"]'::jsonb, 'C', '1, 3, 5, 7 is an arithmetic sequence (common difference 2), not geometric (no constant ratio).', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000002f', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P1', 'Q10', 'Statistics', 'The standard deviation of 2, 2, 2, 2, 2 is:', 'mcq', '["A. 0", "B. 1", "C. 2", "D. 4"]'::jsonb, 'A', 'All values are identical (mean = 2), so every deviation from the mean is 0. SD = 0.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000030', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P3', 'Q1', 'Complex Numbers', 'If z = 1 + i, what is z^2?', 'mcq', '["A. 2i", "B. 1 + 2i", "C. 2", "D. 2 + 2i"]'::jsonb, 'A', 'z^2 = (1+i)^2 = 1 + 2i + i^2 = 1 + 2i - 1 = 2i.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000031', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P3', 'Q7', 'Functions', 'What is the range of f(x) = x^2 + 1 for x ∈ ℝ?', 'mcq', '["A. ℝ", "B. [0, ∞)", "C. [1, ∞)", "D. (1, ∞)"]'::jsonb, 'C', 'The minimum of x^2 is 0 (at x=0), so f(x) = x^2 + 1 ≥ 1. Range = [1, ∞).', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000032', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P2', 'Q6', 'Probability', 'P(A) = 0.3 and P(B) = 0.5. If A and B are independent, find P(A ∩ B).', 'mcq', '["A. 0.15", "B. 0.20", "C. 0.65", "D. 0.80"]'::jsonb, 'A', 'For independent events: P(A ∩ B) = P(A) × P(B) = 0.3 × 0.5 = 0.15.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000002', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P2', 'Q5', 'Calculus', 'Differentiate y = (3x^2 + 4x - 5)e^x.', 'longq', NULL, 'y'' = (3x^2 + 10x - 1)e^x', 'Product rule: y'' = (3x^2+4x-5)e^x + (6x+4)e^x = (3x^2+10x-1)e^x.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000005', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2020, 'P2', 'Q9', 'Trigonometry', 'Solve for x: 2sin(x)cos(x) = 1/2 on 0 <= x < 2π.', 'longq', NULL, 'x = π/12, 5π/12, 13π/12, 17π/12', '2sin(x)cos(x) = sin(2x) = 1/2, so 2x = π/6 or 5π/6 (+2kπ), giving x = π/12, 5π/12, 13π/12, 17π/12.', '{"c0000000-0000-0000-0000-000000000041","c0000000-0000-0000-0000-000000000042","c0000000-0000-0000-0000-000000000048"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000006', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P1', 'Q12', 'Statistics', 'The lifetime (hours) of a bulb ~ N(800, 20^2). Find P(X > 830).', 'longq', NULL, 'P(X > 830) ≈ 0.0668', 'Standardize: z = (830-800)/20 = 1.5. P(Z > 1.5) = 1 - Φ(1.5) ≈ 1 - 0.9332 = 0.0668.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 4),
('70000000-0000-0000-0000-000000000007', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q10', 'Sequences', 'Given sequence a_n = 3n^2 - n, find a_8.', 'longq', NULL, '184', 'Substitute n=8: 3*(8^2) - 8 = 3*64 - 8 = 192 - 8 = 184.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000008', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P2', 'Q11', 'Calculus', 'A particle moves with displacement s = 4t^3 - 6t^2 + 2 (m). Find the acceleration at t = 2.', 'longq', NULL, '36 m/s²', 'v = ds/dt = 12t^2 - 12t; a = dv/dt = 24t - 12. At t=2: a = 48 - 12 = 36 m/s².', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000048"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000009', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2021, 'P1', 'Q14', 'Logarithms', 'Solve for x: log_3(x-1) + log_3(x+2) = 2.', 'longq', NULL, 'x ≈ 2.854', 'Combine: log_3((x-1)(x+2)) = 2 → (x-1)(x+2) = 9 → x^2+x-11 = 0 → x = (-1+sqrt(45))/2 ≈ 2.854 (positive root only).', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000027"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000000c', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P2', 'Q8', 'Integration', 'Integrate ∫ (2x + 5)/x dx.', 'longq', NULL, '2x + 5 ln|x| + C', 'Split: ∫(2 + 5/x) dx = 2x + 5 ln|x| + C.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000000d', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2020, 'P1', 'Q4', 'Statistics', 'Find the mean of data: 2, 4, 6, 8, 10.', 'longq', NULL, '6', 'Mean = (2+4+6+8+10)/5 = 30/5 = 6.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000000e', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2021, 'P2', 'Q12', 'Calculus', 'Find derivative of y = ln(3x^2 + 1).', 'longq', NULL, 'y'' = 6x / (3x^2 + 1)', 'Apply chain rule: dy/dx = (1/(3x^2+1)) * 6x = 6x/(3x^2+1).', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000000f', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P1', 'Q9', 'Limits', 'Evaluate limit lim_{x→0} sin(2x) / x.', 'longq', NULL, '2', 'Use the standard limit lim sin(kx)/x = k as x→0, so lim sin(2x)/x = 2.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000027"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000011', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2020, 'P1', 'Q2', 'Surds', 'Simplify (1/√3) + (√3/3).', 'longq', NULL, '2√3/3', '1/√3 = √3/3, so 1/√3 + √3/3 = √3/3 + √3/3 = 2√3/3.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000012', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P3', 'Q6', 'Integration', 'Find the area under y = x^2 from x = 0 to x = 2.', 'longq', NULL, '8/3', '∫₀² x² dx = [x³/3]₀² = 8/3 - 0 = 8/3.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000013', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P2', 'Q7', 'Matrices', 'Compute the determinant of the matrix [[2,3],[1,4]].', 'longq', NULL, '5', 'det([[2,3],[1,4]]) = 2*4 - 3*1 = 8 - 3 = 5.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000014', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P2', 'Q14', 'Logarithms', 'Solve for x: 2^(x+1) = 16.', 'longq', NULL, 'x = 3', '16 = 2^4, so 2^(x+1) = 2^4 → x+1 = 4 → x = 3.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000015', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P1', 'Q15', 'Statistics', 'Find the median of the data set: 3, 7, 9, 12, 14.', 'longq', NULL, '9', 'Data is already sorted; the median is the middle value = 9.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000016', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P3', 'Q9', 'Probability', 'If P(A)=0.4, P(B)=0.5, P(A∩B)=0.2, find P(A∪B).', 'longq', NULL, '0.7', 'By inclusion-exclusion: P(A∪B) = P(A) + P(B) - P(A∩B) = 0.4 + 0.5 - 0.2 = 0.7.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000017', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P1', 'Q18', 'Logarithms', 'Solve for x: e^x = 5.', 'longq', NULL, 'x = ln 5', 'Take natural log of both sides: x = ln 5 ≈ 1.609.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000018', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P1', 'Q12', 'Coordinate Geometry', 'Find the slope of the line through (2,3) and (5,11).', 'longq', NULL, '8/3', 'Slope m = (y2-y1)/(x2-x1) = (11-3)/(5-2) = 8/3.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-000000000019', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P2', 'Q4', 'Integration', 'Integrate ∫ 4x^3 dx.', 'longq', NULL, 'x^4 + C', 'Power rule: ∫4x^3 dx = 4*(x^4/4) + C = x^4 + C.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000001a', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P1', 'Q8', 'Algebra', 'Simplify (x^3 y^2) / (x y).', 'longq', NULL, 'x^2 y', 'Divide exponents: x^(3-1) * y^(2-1) = x^2 y.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000001b', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P2', 'Q10', 'Functions', 'If f(x) = x^2 and g(x) = 3x - 1, find (f∘g)(2).', 'longq', NULL, '25', 'g(2) = 3*2-1 = 5; f(g(2)) = f(5) = 25.', '{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 1),
('70000000-0000-0000-0000-00000000001c', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2021, 'P2', 'Q11', 'Trigonometry', 'A triangle has angles 30°, 60°, 90°. The side opposite 30° is 5. Find the hypotenuse.', 'longq', NULL, '10', 'In a 30-60-90 triangle, the hypotenuse = 2 × (side opposite 30°) = 2 × 5 = 10.', '{"c0000000-0000-0000-0000-000000000041","c0000000-0000-0000-0000-000000000042","c0000000-0000-0000-0000-000000000048"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000001d', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2020, 'P1', 'Q16', 'Statistics', 'Find the variance of the data: 4, 4, 10, 10.', 'longq', NULL, '9', 'Mean = 7. Variance = [(4-7)^2 + (4-7)^2 + (10-7)^2 + (10-7)^2] / 4 = [9+9+9+9]/4 = 9.', '{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 2),
('70000000-0000-0000-0000-00000000001e', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P3', 'Q5', 'Logarithms', 'Solve for x: 5^(2x) = 125.', 'longq', NULL, 'x = 1.5', '125 = 5^3, so 5^(2x) = 5^3 → 2x = 3 → x = 1.5.', '{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 2),
('70000000-0000-0000-0000-000000000033', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P2', 'Q15', 'Algebra',
'(a) Expand and simplify (2x + 3)^3.
(b) Hence, or otherwise, find the coefficient of x^2 in the expansion.',
'longq', NULL,
'(a) 8x^3 + 36x^2 + 54x + 27. (b) Coefficient of x^2 is 36.',
'Use binomial theorem: (2x+3)^3 = C(3,0)(2x)^3 + C(3,1)(2x)^2(3) + C(3,2)(2x)(3)^2 + C(3,3)(3)^3 = 8x^3 + 3*4x^2*3 + 3*2x*9 + 27 = 8x^3 + 36x^2 + 54x + 27. Coefficient of x^2 = 36.',
'{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000019"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000034', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P2', 'Q12', 'Calculus',
'The curve C has equation y = x^3 - 6x^2 + 9x + 1.
(a) Find dy/dx.
(b) Find the coordinates of the stationary points of C.
(c) Determine the nature of each stationary point.',
'longq', NULL,
'(a) dy/dx = 3x^2 - 12x + 9. (b) Stationary points at x=1: (1,5) and x=3: (3,1). (c) x=1 is a local maximum, x=3 is a local minimum.',
'(a) dy/dx = 3x^2 - 12x + 9. (b) Set dy/dx=0: 3(x^2-4x+3)=3(x-1)(x-3)=0, so x=1 or x=3. y(1)=1-6+9+1=5; y(3)=27-54+27+1=1. Stationary points: (1,5) and (3,1). (c) d^2y/dx^2 = 6x-12. At x=1: 6-12=-6<0 → local max. At x=3: 18-12=6>0 → local min.',
'{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000021"}'::uuid[], 4),
('70000000-0000-0000-0000-000000000035', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2025, 'P2', 'Q14', 'Probability',
'Two events A and B are such that P(A) = 0.5, P(B) = 0.4, and P(A ∪ B) = 0.7.
(a) Find P(A ∩ B).
(b) Determine whether A and B are independent.
(c) Find P(A | B).',
'longq', NULL,
'(a) P(A ∩ B) = 0.2. (b) P(A)P(B) = 0.2 = P(A ∩ B), so A and B are independent. (c) P(A | B) = P(A ∩ B)/P(B) = 0.2/0.4 = 0.5.',
'(a) P(A ∩ B) = P(A) + P(B) - P(A ∪ B) = 0.5 + 0.4 - 0.7 = 0.2. (b) P(A) × P(B) = 0.5 × 0.4 = 0.2 = P(A ∩ B), so A and B are independent. (c) P(A | B) = P(A ∩ B) / P(B) = 0.2 / 0.4 = 0.5.',
'{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000036', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2023, 'P3', 'Q10', 'Mechanics',
'A ball is thrown vertically upward with initial velocity u = 20 m/s. Taking g = 10 m/s^2:
(a) Find the time to reach maximum height.
(b) Find the maximum height.
(c) Find the time when the ball returns to the starting point.',
'longq', NULL,
'(a) t = 2 s. (b) h = 20 m. (c) t = 4 s.',
'(a) At max height, v = 0: v = u - gt → 0 = 20 - 10t → t = 2 s. (b) h = ut - (1/2)gt^2 = 20*2 - 5*4 = 40 - 20 = 20 m. (c) By symmetry, total time = 2 × 2 = 4 s.',
'{"c0000000-0000-0000-0000-000000000009","c0000000-0000-0000-0000-000000000010","c0000000-0000-0000-0000-000000000048"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000037', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P3', 'Q8', 'Sequences',
'A geometric sequence has first term a = 6 and common ratio r = 1/2.
(a) Write down the first four terms.
(b) Find the sum of the first 10 terms, giving your answer to 3 significant figures.
(c) Find the sum to infinity.',
'longq', NULL,
'(a) 6, 3, 3/2, 3/4. (b) S_10 ≈ 11.994 ≈ 12.0. (c) S_∞ = 12.',
'(a) Terms: 6, 6*(1/2)=3, 3*(1/2)=3/2, 3/2*(1/2)=3/4. (b) S_n = a(1-r^n)/(1-r) = 6(1-(1/2)^10)/(1-1/2) = 6*(1-1/1024)/(1/2) = 12*(1023/1024) ≈ 11.988 ≈ 12.0 (3 s.f.). (c) S_∞ = a/(1-r) = 6/(1-1/2) = 6/(1/2) = 12.',
'{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000038', 'Mock', 'e0000000-0000-0000-0000-000000000002'::uuid, 2024, 'P3', 'Q9', 'Statistics',
'The marks of 8 students in a test are: 45, 62, 70, 58, 83, 90, 72, 65.
(a) Find the mean mark.
(b) Find the median mark.
(c) Calculate the standard deviation (population SD).',
'longq', NULL,
'(a) Mean = 68.125. (b) Median = 67.5. (c) SD ≈ 13.2.',
'(a) Sum = 45+62+70+58+83+90+72+65 = 545. Mean = 545/8 = 68.125. (b) Sorted: 45, 58, 62, 65, 70, 72, 83, 90. Median = (65+70)/2 = 67.5. (c) Deviations from mean (68.125): -23.125, -6.125, 1.875, -10.125, 14.875, 21.875, 3.875, -3.125. Squared: 534.77, 37.52, 3.52, 102.52, 221.27, 478.52, 15.02, 9.77. Sum ≈ 1402.9. Variance ≈ 175.4. SD = sqrt(175.4) ≈ 13.2.',
'{"c0000000-0000-0000-0000-000000000043","c0000000-0000-0000-0000-000000000044","c0000000-0000-0000-0000-000000000046"}'::uuid[], 3),
('70000000-0000-0000-0000-000000000039', 'DSE', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P3', 'Q11', 'Proof',
'Prove that for any integer n, n^2 + n is always even.',
'longq', NULL,
'n^2 + n = n(n+1). Since n and n+1 are consecutive integers, one of them must be even. The product of an even number and any integer is even. Therefore n(n+1) is always even.',
'Factor: n^2 + n = n(n+1). Consecutive integers n and n+1 always include one even number. Since even × any integer = even, n(n+1) is always even. QED.',
'{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021"}'::uuid[], 3),
('70000000-0000-0000-0000-00000000003a', 'ALevel', 'e0000000-0000-0000-0000-000000000002'::uuid, 2022, 'P2', 'Q14', 'Algebra',
'Solve the system of simultaneous equations:
  3x + 2y = 16
  x - y = 2',
'longq', NULL,
'x = 4, y = 2.',
'From equation 2: x = y + 2. Substitute into equation 1: 3(y+2) + 2y = 16 → 3y + 6 + 2y = 16 → 5y = 10 → y = 2. Then x = 2 + 2 = 4. Check: 3(4)+2(2)=12+4=16 ✓ and 4-2=2 ✓.',
'{"c0000000-0000-0000-0000-000000000019","c0000000-0000-0000-0000-000000000021","c0000000-0000-0000-0000-000000000027"}'::uuid[], 2)

ON CONFLICT (id) DO NOTHING;

INSERT INTO assessment_activities (id, user_id, concept_id, question_id, activity_type, original_answer, ai_analysis_result, correctness, score, difficulty_level, points_earned)
VALUES
('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000048', '70000000-0000-0000-0000-000000000001', 'feynman', 'I added magnitudes instead of vectors.', '{"clarity":0.52,"missing_terms":["vector addition"],"confidence":0.41}'::jsonb, FALSE, 45.00, 2, 8),
('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000002', 'quiz', 'Derived only inner derivative.', '{"gaps":["product rule"],"confidence":0.36}'::jsonb, FALSE, 30.00, 3, 6),
('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000003', 'quiz', 'Computed 0.5.', '{"checklist":["used p=0.6","binomial formula"],"confidence":0.77}'::jsonb, FALSE, 60.00, 2, 10),
('80000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000048', '70000000-0000-0000-0000-000000000004', 'active_recall', 'Guessed 8.', '{"notes":"forgot base height formula"}'::jsonb, FALSE, 40.00, 1, 5),
('80000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000049', '70000000-0000-0000-0000-000000000005', 'feynman', 'Mixed up radians and degrees.', '{"missing_terms":["solution set in 0-2pi"],"clarity":0.63}'::jsonb, FALSE, 55.00, 3, 9),
('80000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000006', 'quiz', 'I looked up z-score 1.6.', '{"mistake":"used 1.6 instead of 1.5"}'::jsonb, FALSE, 65.00, 4, 12),
('80000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-000000000007', 'quiz', 'Calculated 190.', '{"comment":"substitution arithmetic slip"}'::jsonb, FALSE, 70.00, 1, 7),
('80000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000008', 'error_review', 'Differentiate once only.', '{"hint":"take second derivative"}'::jsonb, FALSE, 35.00, 3, 6),
('80000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-000000000009', 'feynman', 'Solved quadratic but kept both roots.', '{"feedback":"domain restriction on log"}'::jsonb, FALSE, 55.00, 2, 8),
('80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-00000000000a', 'quiz', 'Modulus is 4.', '{"reminder":"use sqrt(a^2+b^2)"}'::jsonb, FALSE, 50.00, 1, 6),
('80000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000003', 'error_review', 'Calculated 0.25.', '{"analysis":"used p=0.5 instead of 0.6"}'::jsonb, FALSE, 45.00, 2, 6),
('80000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000006', 'active_recall', 'Remembered 0.07.', '{"note":"approx ok"}'::jsonb, TRUE, 80.00, 4, 14),
('80000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-00000000000b', 'quiz', 'x=1 only.', '{"note":"missed second root"}'::jsonb, FALSE, 55.00, 1, 8),
('80000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-00000000000c', 'quiz', '2x + 5ln x + C.', '{"issue":"domain abs and constant"}'::jsonb, TRUE, 82.00, 2, 11),
('80000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-00000000000d', 'quiz', 'Mean 5.', '{"gap":"forgot count"}'::jsonb, FALSE, 40.00, 1, 6),
('80000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-00000000000e', 'feynman', 'Derivative 6x only.', '{"prompt":"chain rule denominator"}'::jsonb, FALSE, 50.00, 2, 8),
('80000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-00000000000f', 'quiz', 'Limit 1.', '{"correction":"sin kx ~ kx"}'::jsonb, FALSE, 60.00, 2, 9),
('80000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000010', 'quiz', '0.3', '{"hint":"C(4,1)*(1/6)*(5/6)^3"}'::jsonb, FALSE, 45.00, 2, 7),
('80000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000049', '70000000-0000-0000-0000-000000000011', 'active_recall', '2/√3.', '{"note":"rationalize"}'::jsonb, TRUE, 85.00, 1, 10),
('80000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000012', 'quiz', '9/4.', '{"fix":"integrate x^2 correctly"}'::jsonb, FALSE, 55.00, 2, 7),
('80000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-000000000013', 'quiz', 'Determinant 6.', '{"hint":"ad-bc"}'::jsonb, FALSE, 52.00, 1, 7),
('80000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-000000000014', 'quiz', 'x=4.', '{"correction":"solve exponent"}'::jsonb, FALSE, 58.00, 1, 8),
('80000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-000000000015', 'quiz', 'Median 8.', '{"note":"count ordered values"}'::jsonb, FALSE, 60.00, 1, 6),
('80000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000016', 'quiz', '0.6', '{"correction":"use inclusion-exclusion"}'::jsonb, FALSE, 62.00, 2, 8),
('80000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000017', 'feynman', 'x=5.', '{"prompt":"solve with ln"}'::jsonb, FALSE, 55.00, 2, 7),
('80000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-000000000018', 'quiz', 'Slope 2.', '{"hint":"rise over run"}'::jsonb, FALSE, 50.00, 1, 6),
('80000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000019', 'active_recall', 'Integral 4x^3 -> 4x^4/4.', '{"note":"simplify to x^4"}'::jsonb, TRUE, 90.00, 1, 10),
('80000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-00000000001a', 'quiz', 'x^3 y.', '{"feedback":"subtract exponents"}'::jsonb, FALSE, 48.00, 1, 6),
('80000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-00000000001b', 'quiz', '20.', '{"fix":"compose functions"}'::jsonb, FALSE, 52.00, 1, 6),
('80000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000048', '70000000-0000-0000-0000-00000000001c', 'quiz', '12.', '{"hint":"30-60-90 ratio"}'::jsonb, FALSE, 60.00, 2, 8),
('80000000-0000-0000-0000-00000000001f', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000010', '70000000-0000-0000-0000-00000000001d', 'quiz', 'Variance 7.', '{"correction":"compute mean then squared diff"}'::jsonb, FALSE, 58.00, 2, 7),
('80000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000019', '70000000-0000-0000-0000-00000000001e', 'feynman', 'x=3.', '{"note":"rewrite as power of five"}'::jsonb, FALSE, 65.00, 2, 9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feynman_explanations (id, activity_id, user_id, concept_id, mode, user_explanation, ai_feedback, misconceptions_detected, rewritten_version, peer_teaching_reflection)
VALUES
('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000048', 'initial_explain', 'I thought magnitude add works like scalars.', '{"prompt":"demonstrate head-to-tail"}'::jsonb, TRUE, 'When adding vectors, add components then find magnitude.', 'I will draw arrows to explain vector addition.'),
('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000049', 'initial_explain', 'Solved 2x=0.5 giving x=0.25.', '{"correction":"remember sin(2x)"}'::jsonb, TRUE, 'Use sin(2x)=1/2 to get four solutions in 0-2π.', 'Explain using unit circle positions.'),
('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000019', 'correction_explain', 'Both roots kept but negative breaks domain.', '{"focus":"argument of log must be positive"}'::jsonb, TRUE, 'Keep only root where x-1>0 and x+2>0.', 'Highlight domain check step.'),
('90000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000009', 'self_reflection', 'Forgot product rule under time pressure.', '{"action_item":"write formula at top"}'::jsonb, FALSE, 'Write y'' = u''v + uv'' before substituting.', 'Remind peers to mark u and v first.'),
('90000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000006', 'initial_explain', 'Used 0.5 for probability.', '{"suggest":"state p and q"}'::jsonb, TRUE, 'Use p=0.6, q=0.4 with C(5,3).', 'Will rehearse binomial template aloud.'),
('90000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000010', 'initial_explain', 'Looked z=1.6 because rounded mean.', '{"tip":"compute z carefully"}'::jsonb, TRUE, 'z = 1.5 then lookup 0.0668.', 'Remind students to write z formula before table lookup.'),
('90000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'Substitution error: 3*64 - 8 = 190.', '{"hint":"re-evaluate arithmetic"}'::jsonb, TRUE, '3*64=192; 192-8=184.', 'Suggest double-checking arithmetic with calculator.'),
('90000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000010', 'self_reflection', 'Recalled tail probability from memory.', '{"note":"close to table value"}'::jsonb, FALSE, 'Computed z=1.5 and matched 0.0668.', 'Explain to peers how to interpolate if needed.'),
('90000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'Forgot quadratic has two roots.', '{"reminder":"check discriminant"}'::jsonb, TRUE, 'Equation factors to (x-1)(x-3)=0 giving x=1,3.', 'Tell peers to factor then list all roots.'),
('90000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000009', 'initial_explain', 'Treated ln term as constant.', '{"cue":"differentiate inside log"}'::jsonb, TRUE, 'd/dx ln(3x^2+1) = (6x)/(3x^2+1).', 'Highlight chain rule arrows.'),
('90000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009', 'correction_explain', 'Thought limit equals 1.', '{"note":"scale by coefficient"}'::jsonb, TRUE, 'Use sin 2x ≈ 2x so ratio -> 2.', 'Will remind to pull out coefficient.'),
('90000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006', 'initial_explain', 'Used p=1/3.', '{"fix":"1/6 for six"}'::jsonb, TRUE, 'Use binomial with p=1/6 giving 0.3955.', 'Show binomial template first.'),
('90000000-0000-0000-0000-00000000000d', '80000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000049', 'self_reflection', 'Forgot to rationalize.', '{"prompt":"multiply by sqrt3"}'::jsonb, FALSE, '2/√3 -> 2√3/3.', 'Tell classmates to check denominators.'),
('90000000-0000-0000-0000-00000000000e', '80000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000009', 'initial_explain', 'Integrated to 9/4.', '{"hint":"power rule bounds"}'::jsonb, TRUE, 'Integral of x^2 from 0 to 2 is 8/3.', 'Re-evaluate bounds after antiderivative.'),
('90000000-0000-0000-0000-00000000000f', '80000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'ad-bc mistaken as 2*3.', '{"cue":"compute 2*4 - 3*1"}'::jsonb, TRUE, 'Determinant is 5.', 'Show formula on 2x2 first.'),
('90000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'Set 2^(x+1)=8.', '{"reminder":"16 is 2^4"}'::jsonb, TRUE, 'x+1=4 so x=3.', 'Double-check power-of-two mapping.'),
('90000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000010', 'initial_explain', 'Took average of all five numbers.', '{"reminder":"median is middle value"}'::jsonb, TRUE, 'Order values and pick the middle to get 9.', 'Show peers to draw a quick dot plot.'),
('90000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'initial_explain', 'Added probabilities instead of inclusion-exclusion.', '{"cue":"subtract intersection"}'::jsonb, TRUE, 'P(A∪B)=0.7.', 'Remind to draw a Venn diagram.'),
('90000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009', 'initial_explain', 'Assumed e^x linear.', '{"note":"take natural log"}'::jsonb, TRUE, 'Use ln to solve e^x=5 -> x=ln5.', 'Teach by isolating exponential first.'),
('90000000-0000-0000-0000-000000000014', '80000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'Used y2-y1 only.', '{"hint":"divide by x2-x1"}'::jsonb, TRUE, 'Slope = 8/3.', 'Show formula m=(y2-y1)/(x2-x1).'),
('90000000-0000-0000-0000-000000000015', '80000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'Kept exponents unchanged.', '{"prompt":"subtract powers when dividing"}'::jsonb, TRUE, 'x^3 y^2 / (x y) = x^2 y.', 'Walk peers through exponent laws.'),
('90000000-0000-0000-0000-000000000016', '80000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000048', 'initial_explain', 'Guessed 12 for hypotenuse.', '{"cue":"30-60-90 ratio"}'::jsonb, TRUE, 'Hypotenuse is double the short leg: 10.', 'Sketch triangle with ratios 1:√3:2.'),
('90000000-0000-0000-0000-000000000017', '80000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000019', 'initial_explain', 'Solved 2x=3 giving x=1.5 but unsure why.', '{"note":"log base 5"}'::jsonb, FALSE, 'Rewrite 125 as 5^3 to get 2x=3.', 'Explain pattern of matching bases.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO error_book (id, user_id, question_id, concept_id, wrong_answer, correct_answer_snapshot, system_explanation, error_category_id, user_reflection_notes, first_wrong_time, last_review_time, next_review_time, review_count, is_mastered, error_pattern_tags)
VALUES
('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000048', 'Added magnitudes to get 5.', 'Vector sum magnitude is sqrt(13).', 'Add components then magnitude; cannot add magnitudes directly.', 'ec000000-0000-0000-0000-000000000001', 'Need to visualize vectors.', NOW() - INTERVAL '14 days', NOW() - INTERVAL '7 days', NOW() + INTERVAL '1 day', 2, FALSE, '{"vector_addition","magnitude"}'),
('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000009', 'Derived 6x e^x only.', 'Full derivative (3x^2 + 4x - 5)e^x + (6x + 4)e^x.', 'Product rule missing second term.', 'ec000000-0000-0000-0000-000000000005', 'Write u and v first.', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', 2, FALSE, '{"product_rule","differentiation"}'),
('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 'Used p=0.5 instead of 0.6.', '0.3456', 'Probability parameters misread.', 'ec000000-0000-0000-0000-000000000004', 'Highlight given probabilities.', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 3, FALSE, '{"reading_error"}'),
('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000049', 'Returned single angle solution.', 'x = π/12, 5π/12, 13π/12, 17π/12', 'Forgot periodic solutions.', 'ec000000-0000-0000-0000-000000000003', 'List all quadrants explicitly.', NOW() - INTERVAL '12 days', NOW() - INTERVAL '6 days', NOW() + INTERVAL '3 days', 2, FALSE, '{"trig","periodicity"}'),
('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000010', 'Used z=1.6 giving 0.0548.', 'Correct tail 0.0668.', 'Rounded mean incorrectly before z.', 'ec000000-0000-0000-0000-000000000002', 'Compute z then read table.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"z_score","rounding"}'),
('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000019', 'Got 190.', 'Correct 184.', 'Arithmetic slip in substitution.', 'ec000000-0000-0000-0000-000000000002', 'Double-check final arithmetic.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"arithmetic","substitution"}'),
('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-000000000019', 'Kept only one root.', 'x=1 or 3.', 'Quadratic with two solutions.', 'ec000000-0000-0000-0000-000000000001', 'Always check for two roots.', NOW() - INTERVAL '9 days', NOW() - INTERVAL '4 days', NOW() + INTERVAL '2 days', 2, FALSE, '{"quadratic","roots"}'),
('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000009', 'Forgot |x| in ln.', '2x + 5 ln|x| + C.', 'Log domain mishandled.', 'ec000000-0000-0000-0000-000000000005', 'Remember absolute inside log.', NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"integration","log"}'),
('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-000000000010', 'Averaged to 5.', 'Mean is 6.', 'Summation missed one term.', 'ec000000-0000-0000-0000-000000000002', 'Count data points carefully.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"statistics","mean"}'),
('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000009', 'Derivative 6x.', '6x/(3x^2+1).', 'Forgot denominator from chain rule.', 'ec000000-0000-0000-0000-000000000005', 'Write u and u".', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days', 2, FALSE, '{"chain_rule"}'),
('a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000009', 'Limit 1.', 'Limit 2.', 'Scaled sine limit by coefficient.', 'ec000000-0000-0000-0000-000000000001', 'Remember sin kx / x -> k.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '2 days', 1, FALSE, '{"limits","sine"}'),
('a0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000006', 'Used p=1/3.', 'p=1/6, probability 0.3955.', 'Wrong binomial parameter.', 'ec000000-0000-0000-0000-000000000004', 'Check event probability carefully.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"binomial","parameter"}'),
('a0000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000049', 'Left as 2/√3.', 'Rationalized 2√3/3.', 'Did not rationalize denominator.', 'ec000000-0000-0000-0000-000000000005', 'Multiply by √3/√3.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"simplification"}'),
('a0000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000009', 'Area 9/4.', 'Area 8/3.', 'Integrated bounds misapplied.', 'ec000000-0000-0000-0000-000000000002', 'Plug bounds carefully.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"definite_integral"}'),
('a0000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000019', 'Determinant 6.', 'Determinant 5.', 'Mixed formula.', 'ec000000-0000-0000-0000-000000000002', 'Compute ad-bc.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '6 days', 1, FALSE, '{"determinant"}'),
('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000014', 'c0000000-0000-0000-0000-000000000019', 'Solved x=4.', 'x=3.', 'Mis-solved exponent equation.', 'ec000000-0000-0000-0000-000000000002', 'Rewrite 16 as 2^4.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '2 days', 1, FALSE, '{"exponent"}'),
('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000015', 'c0000000-0000-0000-0000-000000000010', 'Used mean instead of median.', 'Median is 9.', 'Confused central tendency measures.', 'ec000000-0000-0000-0000-000000000004', 'Identify median position.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"median"}'),
('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000006', 'Answered 0.9.', 'Correct is 0.7.', 'Ignored intersection in union formula.', 'ec000000-0000-0000-0000-000000000004', 'Draw Venn before computing.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"probability","union"}'),
('a0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000009', 'x=5.', 'x=ln 5.', 'Forgot logarithm inversion.', 'ec000000-0000-0000-0000-000000000001', 'Take ln both sides.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '3 days', 1, FALSE, '{"logarithm"}'),
('a0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000019', 'Slope 2.', 'Slope 8/3.', 'Skipped denominator.', 'ec000000-0000-0000-0000-000000000002', 'Use (y2-y1)/(x2-x1).', NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"slope"}'),
('a0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000009', 'Integral 4x^3 -> 4x^4.', 'Integral simplifies to x^4 + C.', 'Forgot constant simplification.', 'ec000000-0000-0000-0000-000000000005', 'Simplify coefficients.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"integration"}'),
('a0000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000001a', 'c0000000-0000-0000-0000-000000000019', 'Left exponents unchanged.', 'x^2 y.', 'Forgot exponent division rule.', 'ec000000-0000-0000-0000-000000000005', 'Subtract exponents when dividing.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '6 days', 1, FALSE, '{"exponent_rule"}'),
('a0000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000001b', 'c0000000-0000-0000-0000-000000000019', 'Computed 20.', 'Correct 25.', 'Skipped composition order.', 'ec000000-0000-0000-0000-000000000005', 'Evaluate inner then outer.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"function_composition"}'),
('a0000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000001c', 'c0000000-0000-0000-0000-000000000048', 'Hypotenuse 12.', 'Hypotenuse 10.', 'Misapplied triangle ratios.', 'ec000000-0000-0000-0000-000000000001', 'Recall 1:√3:2 ratio.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"triangle_ratio"}'),
('a0000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-00000000001d', 'c0000000-0000-0000-0000-000000000010', 'Variance 7.', 'Variance 9.', 'Arithmetic error on squared deviations.', 'ec000000-0000-0000-0000-000000000002', 'Recompute squares carefully.', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 1, FALSE, '{"variance"}'),
('a0000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000001e', 'c0000000-0000-0000-0000-000000000019', 'Answered x=3.', 'x=1.5.', 'Forgot to divide exponent by 2.', 'ec000000-0000-0000-0000-000000000005', 'Equate exponents after matching bases.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 days', NOW() + INTERVAL '4 days', 1, FALSE, '{"exponent"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO error_book (id, user_id, question_id, concept_id, wrong_answer, correct_answer_snapshot, system_explanation, error_category_id, user_reflection_notes, first_wrong_time, last_review_time, next_review_time, review_count, is_mastered, error_pattern_tags)
VALUES
('a0000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000009', 'Answered 16.', 'x = 32.', 'Converted the logarithm to the wrong power of 2.', 'ec000000-0000-0000-0000-000000000001', 'Rewrite log form into exponential form before solving.', NOW() - INTERVAL '18 days', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '8 days', 4, TRUE, '{"logarithms","power_rule"}'),
('a0000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000041', 'Used 2sin(x)cos(x).', 'cos^2(x) - sin^2(x).', 'Mixed the sine and cosine double-angle identities.', 'ec000000-0000-0000-0000-000000000001', 'State the target identity before picking a formula.', NOW() - INTERVAL '11 days', NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 2, FALSE, '{"trigonometry","identity"}'),
('a0000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000024', 'c0000000-0000-0000-0000-000000000006', 'Counted 5 outcomes only.', 'Probability is 1/6.', 'Missed one dice pair when counting ordered outcomes.', 'ec000000-0000-0000-0000-000000000002', 'List all ordered pairs systematically.', NOW() - INTERVAL '9 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '1 day', 2, FALSE, '{"probability","counting"}'),
('a0000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000029', 'c0000000-0000-0000-0000-000000000010', '-sin(x) + C', 'sin(x) + C', 'Used the derivative sign instead of the integral result.', 'ec000000-0000-0000-0000-000000000005', 'Pair each derivative rule with its matching integral.', NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '10 days', 4, TRUE, '{"integration","sign"}'),
('a0000000-0000-0000-0000-00000000001f', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000021', 'Range is all real numbers.', 'Range = [1, infinity).', 'Forgot that x^2 cannot go below 0.', 'ec000000-0000-0000-0000-000000000001', 'Check the minimum output before stating the range.', NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days', 2, FALSE, '{"functions","range"}'),
('a0000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000006', 'Added 0.3 and 0.5.', '0.15', 'Used addition instead of multiplication for independent events.', 'ec000000-0000-0000-0000-000000000004', 'Mark independence explicitly before choosing a rule.', NOW() - INTERVAL '6 days', NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', 2, FALSE, '{"probability","independence"}'),
('a0000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000019', 'Answered 900 degrees.', '720 degrees.', 'Applied the polygon angle formula using n instead of n-2.', 'ec000000-0000-0000-0000-000000000005', 'Substitute into (n-2) x 180 carefully.', NOW() - INTERVAL '4 days', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '4 days', 3, FALSE, '{"geometry","polygon_angles"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO quiz_attempts (id, activity_id, user_id, exam_question_id, chosen_option, is_correct, time_spent_seconds, attempt_time)
VALUES
('b0000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', NULL, FALSE, 95, NOW() - INTERVAL '6 days'),
('b0000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000003', 'A', FALSE, 70, NOW() - INTERVAL '5 days'),
('b0000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000003', 'B', TRUE, 64, NOW() - INTERVAL '4 days'),
('b0000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000007', 'C', FALSE, 52, NOW() - INTERVAL '3 days'),
('b0000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000006', NULL, FALSE, 81, NOW() - INTERVAL '3 days'),
('b0000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', NULL, FALSE, 60, NOW() - INTERVAL '2 days'),
('b0000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000a', 'B', FALSE, 41, NOW() - INTERVAL '2 days'),
('b0000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000005', 'D', TRUE, 110, NOW() - INTERVAL '1 days'),
('b0000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000009', NULL, FALSE, 75, NOW() - INTERVAL '1 days'),
('b0000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000006', NULL, TRUE, 48, NOW()),
('b0000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000000b', 'A', TRUE, 33, NOW() - INTERVAL '2 days'),
('b0000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000c', NULL, TRUE, 58, NOW() - INTERVAL '1 days'),
('b0000000-0000-0000-0000-00000000000d', '80000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-00000000000d', NULL, FALSE, 42, NOW() - INTERVAL '1 days'),
('b0000000-0000-0000-0000-00000000000e', '80000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000000e', NULL, FALSE, 47, NOW()),
('b0000000-0000-0000-0000-00000000000f', '80000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000000f', NULL, FALSE, 39, NOW()),
('b0000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000010', NULL, FALSE, 61, NOW()),
('b0000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000011', NULL, TRUE, 27, NOW()),
('b0000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000012', NULL, FALSE, 55, NOW()),
('b0000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000013', NULL, FALSE, 46, NOW()),
('b0000000-0000-0000-0000-000000000014', '80000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000014', NULL, FALSE, 44, NOW()),
('b0000000-0000-0000-0000-000000000015', '80000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000015', NULL, FALSE, 38, NOW()),
('b0000000-0000-0000-0000-000000000016', '80000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000016', NULL, FALSE, 57, NOW()),
('b0000000-0000-0000-0000-000000000017', '80000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000017', NULL, TRUE, 29, NOW()),
('b0000000-0000-0000-0000-000000000018', '80000000-0000-0000-0000-00000000001a', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000018', NULL, FALSE, 41, NOW()),
('b0000000-0000-0000-0000-000000000019', '80000000-0000-0000-0000-00000000001b', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000019', NULL, TRUE, 36, NOW()),
('b0000000-0000-0000-0000-00000000001a', '80000000-0000-0000-0000-00000000001c', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000001a', NULL, FALSE, 49, NOW()),
('b0000000-0000-0000-0000-00000000001b', '80000000-0000-0000-0000-00000000001d', '00000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000001b', NULL, TRUE, 33, NOW()),
('b0000000-0000-0000-0000-00000000001c', '80000000-0000-0000-0000-00000000001e', '00000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000001c', NULL, FALSE, 54, NOW()),
('b0000000-0000-0000-0000-00000000001d', '80000000-0000-0000-0000-00000000001f', '00000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-00000000001d', NULL, FALSE, 46, NOW()),
('b0000000-0000-0000-0000-00000000001e', '80000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000001e', NULL, TRUE, 35, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO flashcards (id, user_id, concept_id, taxonomy_node_id, front_content, back_content, card_type, tips, content_metadata, source_type, is_archived)
VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'), 
    'What is DHCP?', 
    'Dynamic Host Configuration Protocol - A network management protocol that automatically assigns IP addresses and other network configuration parameters to devices on a network.',
    'standard', 
    '["Think: How does your device get an IP address automatically?", "D = Dynamic, H = Host, C = Configuration, P = Protocol"]'::jsonb,
    '{}'::jsonb,
    'manual', 
    false),

('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'),
    'Name the 7 layers of the OSI Model',
    'From bottom to top: 1) Physical, 2) Data Link, 3) Network, 4) Transport, 5) Session, 6) Presentation, 7) Application',
    'standard',
    '["Each layer has a specific function", "Use the mnemonic: Please Do Not Throw Sausage Pizza Away"]'::jsonb,
    '{}'::jsonb,
    'manual',
    false),

('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
    'What does REST stand for in web development?',
    'Representational State Transfer - An architectural style for designing networked applications using stateless communication and standard HTTP methods.',
    'standard',
    '["Think about how modern web APIs work", "REST uses HTTP methods like GET, POST, PUT, DELETE"]'::jsonb,
    '{}'::jsonb,
    'note_generated',
    false),

('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'),
    'Which HTTP method is used to CREATE a new resource?',
    'POST',
    'mcq',
    '["Think about CRUD operations", "C = Create, R = Read, U = Update, D = Delete"]'::jsonb,
    '{"options": ["GET", "POST", "PUT", "DELETE"], "correct_answer": "POST", "explanations": {"GET": "Used to retrieve/read data", "POST": "Correct! Used to create new resources", "PUT": "Used to update existing resources", "DELETE": "Used to remove resources"}}'::jsonb,
    'manual',
    false),
    
('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'TK'),
    'What is the default port for HTTPS?',
    '443',
    'mcq',
    '["HTTP uses port 80", "HTTPS adds security with TLS/SSL"]'::jsonb,
    '{"options": ["80", "8080", "443", "8443"], "correct_answer": "443", "explanations": {"80": "This is HTTP port", "8080": "This is an alternative HTTP port", "443": "Correct! Standard HTTPS port", "8443": "Alternative HTTPS port"}}'::jsonb,
    'csv_import',
    false),
    
('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
    'Explain polymorphism in Object-Oriented Programming',
    'Polymorphism is the ability of objects of different classes to be treated as objects of a common superclass. It allows objects to take many forms through method overriding and interfaces.',
    'standard',
    '["Poly = many, morph = forms", "Think: same method name, different behaviors", "Examples: Animal → Dog.bark(), Cat.meow()"]'::jsonb,
    '{}'::jsonb,
    'manual',
    false),

('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
    'What is Big O notation?',
    'Big O notation describes the upper bound of the time complexity of an algorithm, expressing how runtime grows relative to input size.',
    'standard',
    '["O(1) = constant, O(n) = linear, O(n²) = quadratic", "Helps compare algorithm efficiency"]'::jsonb,
    '{}'::jsonb,
    'manual',
    false),

('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000003', NULL, (SELECT id FROM taxonomy_nodes WHERE lcc_code = 'QA'),
    'What is a hash table?',
    'A data structure that maps keys to values using a hash function for fast lookup, insertion, and deletion (average O(1) time complexity).',
    'mcq',
    '["Think about dictionaries in Python or objects in JavaScript", "Key → Hash Function → Index → Value"]'::jsonb,
    '{"options": ["A sorted array", "A linked list with hashing", "A key-value mapping using hash functions", "A binary search tree"], "correct_answer": "A key-value mapping using hash functions"}'::jsonb,
    'mindmap_generated',
    false);

-- Vision Pro hardcoded flashcards (from FlashcardService mock data + PalaceImmersiveView demo items)
INSERT INTO flashcards (id, user_id, concept_id, taxonomy_node_id, front_content, back_content, card_type, tips, content_metadata, source_type, is_archived)
VALUES
('00000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is the capital of France?',
    'Paris',
    'standard',
    '["Think of the Eiffel Tower", "France is in Western Europe"]'::jsonb,
    '{"topic": "Geography"}'::jsonb,
    'manual', false),

('00000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is 2 + 2?',
    '4',
    'standard',
    '["Basic arithmetic"]'::jsonb,
    '{"topic": "Mathematics"}'::jsonb,
    'manual', false),

('00000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is 2² + 3²?',
    '13',
    'mcq',
    '["2² = 4, 3² = 9, so 4 + 9 = 13"]'::jsonb,
    '{"topic": "Mathematics", "options": ["10", "12", "13", "15"], "correct_answer": "13"}'::jsonb,
    'manual', false),

('00000004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is the largest planet in our solar system?',
    'Jupiter',
    'mcq',
    '["Jupiter is a gas giant — it''s massive!", "It has a famous Great Red Spot storm"]'::jsonb,
    '{"topic": "Astronomy", "options": ["Saturn", "Neptune", "Jupiter", "Earth"], "correct_answer": "Jupiter"}'::jsonb,
    'manual', false),

('00000005-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'Who painted the Mona Lisa?',
    'Leonardo da Vinci',
    'mcq',
    '["Italian Renaissance artist who lived 1452–1519", "He was also a scientist and inventor"]'::jsonb,
    '{"topic": "Art History", "options": ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"], "correct_answer": "Leonardo da Vinci"}'::jsonb,
    'manual', false),

('00000006-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is the chemical symbol for Gold?',
    'Au',
    'mcq',
    '["From the Latin word ''aurum''", "Au is on the periodic table — atomic number 79"]'::jsonb,
    '{"topic": "Chemistry", "options": ["Gd", "Go", "Au", "Ag"], "correct_answer": "Au"}'::jsonb,
    'manual', false),

-- VR Palace demo items (from PalaceImmersiveView.demoItems) converted to flashcards
('00000007-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is photosynthesis?',
    'The process by which green plants use sunlight, water, and CO₂ to produce glucose and oxygen: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.',
    'standard',
    '["Photo = light, synthesis = making", "Happens in the chloroplasts of plant cells"]'::jsonb,
    '{"topic": "Biology", "palace_label": "Photosynthesis"}'::jsonb,
    'manual', false),

('00000008-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is the mitochondria and what is its main function?',
    'The mitochondria is the powerhouse of the cell — it generates ATP (energy) through cellular respiration using oxygen and glucose.',
    'standard',
    '["Mitochondria = powerhouse of the cell", "Has its own DNA and double membrane"]'::jsonb,
    '{"topic": "Biology", "palace_label": "Mitochondria"}'::jsonb,
    'manual', false),

('00000009-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'State Newton''s Three Laws of Motion',
    '1st: An object at rest stays at rest unless acted on by a force. 2nd: F = ma (force equals mass times acceleration). 3rd: For every action there is an equal and opposite reaction.',
    'standard',
    '["First = Inertia, Second = F=ma, Third = Action-Reaction", "Think of a rocket pushing gas down to go up"]'::jsonb,
    '{"topic": "Physics", "palace_label": "Newton''s Laws"}'::jsonb,
    'manual', false),

('00000010-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'Describe the Water Cycle',
    'The continuous movement of water: Evaporation (water → vapour) → Condensation (vapour → clouds) → Precipitation (rain/snow) → Collection (rivers, ocean) → repeat.',
    'standard',
    '["ECPC: Evaporation, Condensation, Precipitation, Collection", "Driven by solar energy and gravity"]'::jsonb,
    '{"topic": "Earth Science", "palace_label": "Water Cycle"}'::jsonb,
    'manual', false),

('00000011-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'State the Pythagorean Theorem',
    'In a right-angled triangle: a² + b² = c², where c is the hypotenuse (the side opposite the right angle).',
    'standard',
    '["a² + b² = c²", "Only works for right-angled triangles", "Example: 3² + 4² = 5² → 9 + 16 = 25 ✓"]'::jsonb,
    '{"topic": "Mathematics", "palace_label": "Pythagorean Thm"}'::jsonb,
    'manual', false),

('00000012-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', NULL, NULL,
    'What is DNA and what is its structure?',
    'DNA (Deoxyribonucleic Acid) carries genetic information. It has a double-helix structure made of nucleotide base pairs: Adenine–Thymine (A-T) and Guanine–Cytosine (G-C).',
    'standard',
    '["Double helix = twisted ladder shape", "A pairs with T, G pairs with C", "DNA → RNA → Protein (central dogma)"]'::jsonb,
    '{"topic": "Biology", "palace_label": "DNA Structure"}'::jsonb,
    'manual', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO extracted_media (
id, source_id, media_type, storage_method, language,
file_url, checksum, pages, extraction_location, metadata
)
VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'image', 'external_url', 'en',
'https://upload.wikimedia.org/wikipedia/commons/8/8d/OSI_Model_v1.svg', 
'a1b2c3d4e5f6789abcdef0123456789a', 
NULL, NULL,
'{"caption": "OSI 7-Layer Model Diagram", "width": 1200, "height": 800, "source": "Wikipedia Commons"}'::jsonb),

('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'text', 'local_path', 'en',
'/media/code_samples/rest_api_example.py',
'b2c3d4e5f6789abcdef0123456789ab2',
NULL, NULL,
'{"lines": 45, "framework": "FastAPI", "description": "Simple REST API example with CRUD operations"}'::jsonb),

('cccccccc-cccc-cccc-cccc-cccccccccccc', NULL, 'video', 'external_url', 'en',
'https://www.youtube.com/watch?v=e6-TaH5bkjo',
'c3d4e5f6789abcdef0123456789ab2c3',
NULL, NULL,
'{"duration_seconds": 720, "title": "DHCP Explained - Dynamic Host Configuration Protocol", "platform": "YouTube"}'::jsonb),

('dddddddd-dddd-dddd-dddd-dddddddddddd', NULL, 'image', 'external_url', 'en',
'https://softuni.org/wp-content/uploads/2022/07/HTTP-Request-Methods-e1657276635747.png',
'd4e5f6789abcdef0123456789ab2c3d4',
NULL, NULL,
'{"format": "svg", "interactive": false, "shows": "HTTP methods mapped to CRUD operations"}'::jsonb),

('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL, 'text', 'external_url', 'en',
'https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods',
'e5f6789abcdef0123456789ab2c3d4e5',
NULL, NULL,
'{"site": "MDN Web Docs", "topic": "HTTP Request Methods", "updated": "2025-12-15"}'::jsonb),

('ffffffff-ffff-ffff-ffff-ffffffffffff', NULL, 'audio', 'external_url', 'en',
'https://sample-files.com/downloads/audio/mp3/mp3_44100Hz_128kbps_stereo.mp3',
'f6789abcdef0123456789ab2c3d4e5f6',
NULL, NULL,
'{"duration_seconds": 480, "format": "mp3", "narrator": "AI voice", "speed": "1x"}'::jsonb),

('99999999-9999-9999-9999-999999999999', NULL, 'text', 'local_path', 'en',
'/media/code_samples/hash_table_implementation.py',
'9876543210abcdef0123456789abcdef',
NULL, NULL,
'{"lines": 68, "description": "Simple hash table implementation with collision handling"}'::jsonb),

('aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'image', 'external_url', 'en',
'https://th.bing.com/th/id/R.d8a392fcdab7d827b4d31beb88e9bbf5?rik=enl2F8i9oSfCtw&pid=ImgRaw&r=0',
'a1b2c3d4e5f6789abcdef0123456789b',
NULL, NULL,
'{"title": "DHCP Process Flow", "shows": "4-step DHCP process: Discover, Offer, Request, Acknowledge"}'::jsonb),

('bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'image', 'external_url', 'en',
'https://tse3.mm.bing.net/th/id/OIP.6UZgMsynroLj9bVxTNXH3gHaHh?rs=1&pid=ImgDetMain&o=7&rm=3',
'b2c3d4e5f6789abcdef0123456789bc',
NULL, NULL,
'{"title": "REST Architecture", "description": "Visual representation of RESTful API design principles"}'::jsonb),

('cccccccd-cccc-cccc-cccc-cccccccccccc', NULL, 'video', 'external_url', 'en',
'https://www.youtube.com/watch?v=pTB0EiLXUC8',
'c3d4e5f6789abcdef0123456789ab2cd',
NULL, NULL,
'{"duration_seconds": 600, "title": "Object-Oriented Programming, Simplified", "platform": "YouTube"}'::jsonb),

('99999998-9999-9999-9999-999999999999', NULL, 'text', 'local_path', 'en',
'/media/code_samples/big_o_examples.py',
'9876543210abcdef0123456789abcdee',
NULL, NULL,
'{"lines": 120, "description": "Code examples demonstrating different time complexities: O(1), O(n), O(log n), O(n²)"}'::jsonb);

INSERT INTO flashcard_media (
id, flashcard_id, media_id, media_position, display_order, caption, display_settings
)
VALUES
('fa000001-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 
'cccccccc-cccc-cccc-cccc-cccccccccccc', 'hint', 1,
'Watch this 12-minute explanation if you need more detail',
'{"autoplay": false, "controls": true, "start_time": 0}'::jsonb),

('fa000002-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
'aaaaaaab-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'back', 1,
'DHCP 4-step process visualization',
'{"width": "90%", "align": "center"}'::jsonb),

('fa000003-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'back', 1,
'Visual representation of the 7 layers',
'{"width": "100%", "align": "center", "show_border": true}'::jsonb),

('fa000004-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
'ffffffff-ffff-ffff-ffff-ffffffffffff', 'hint', 1,
'Listen to detailed explanation',
'{"autoplay": false, "controls": true, "playback_rate": 1.0}'::jsonb),

('fa000005-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005',
'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'back', 1,
'Example FastAPI implementation showing RESTful design',
'{"syntax_highlight": true, "theme": "monokai", "show_line_numbers": true}'::jsonb),

('fa000006-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005',
'bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'back', 2,
'REST architecture principles',
'{"width": "80%", "align": "center"}'::jsonb),

('fa000007-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000006',
'dddddddd-dddd-dddd-dddd-dddddddddddd', 'front', 1,
'HTTP Methods → CRUD Operations mapping',
'{"scale": 0.8, "position": "above_question"}'::jsonb),

('fa000008-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000006',
'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'hint', 1,
'https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods',
'{"open_in_new_tab": false, "show_preview": true, "preview_height": "400px", "preview_width": "100%"}'::jsonb),

('fa000009-0000-0000-0000-000000000009', '66666666-6666-6666-6666-666666666666',
'cccccccd-cccc-cccc-cccc-cccccccccccc', 'hint', 1,
'Video explanation of polymorphism concepts',
'{"autoplay": false, "controls": true}'::jsonb),

('fa000010-0000-0000-0000-000000000010', '77777777-7777-7777-7777-777777777777',
'99999998-9999-9999-9999-999999999999', 'back', 1,
'Code examples showing different time complexities',
'{"syntax_highlight": true, "theme": "dracula", "show_line_numbers": true}'::jsonb),

('fa000011-0000-0000-0000-000000000011', '88888888-8888-8888-8888-888888888888',
'99999999-9999-9999-9999-999999999999', 'back', 1,
'Python implementation demonstrating hash table concepts',
'{"syntax_highlight": true, "theme": "monokai", "show_line_numbers": true, "highlight_lines": [15, 28, 42]}'::jsonb);

INSERT INTO flashcard_review_history (id, user_id, flashcard_id, review_mode, rating, duration_ms, scheduled_interval, actual_interval, review_at)
VALUES
('c1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
'standard', 3, 8500, 1.0, 1.2, '2026-01-09 10:30:00'),

('c1111112-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
'standard', 4, 5200, 2.5, 2.8, '2026-01-11 14:15:00'),

('c2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
'standard', 2, 15000, 1.0, 1.0, '2026-01-08 09:00:00'),

('c2222223-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004',
'standard', 3, 11200, 1.0, 1.5, '2026-01-10 15:30:00'),

('c3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005',
'standard', 4, 4800, 1.0, 1.0, '2026-01-10 11:20:00'),

('c4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006',
'mcq', 4, 3200, 1.0, 1.1, '2026-01-10 16:20:00'),

('c5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555',
'mcq', 3, 6800, 1.0, 1.0, '2026-01-10 16:25:00'),

('c5555556-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555',
'mcq', 4, 4200, 2.0, 2.1, '2026-01-11 10:15:00'),

('c6666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666',
'standard', 3, 12000, 1.0, 1.5, '2026-01-09 11:00:00'),

('c7777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
'standard', 2, 18500, 1.0, 1.0, '2026-01-08 14:00:00'),

('c7777778-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777',
'standard', 3, 13200, 1.0, 2.0, '2026-01-10 16:45:00'),

('c8888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888',
'mcq', 4, 5100, 1.0, 1.0, '2026-01-11 09:30:00');

INSERT INTO flashcard_schedules (flashcard_id, user_id, algorithm, state, due_date, last_review_date, interval_days, reps, ease_factor, stability, difficulty, topic_cached)
VALUES
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 
'sm2', 'review', '2026-01-15 10:00:00', '2026-01-11 14:15:00', 4.0, 2, 2.6, 0, 0, 'Networking'),

('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
'sm2', 'learning', '2026-01-12 09:00:00', '2026-01-10 15:30:00', 1.5, 2, 2.4, 0, 0, 'Networking'),

('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
'simple', 'learning', '2026-01-12 11:00:00', '2026-01-10 11:20:00', 1.0, 1, 2.5, 0, 0, 'Web Development'),

('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
'fsrs', 'review', '2026-01-14 16:00:00', '2026-01-10 16:20:00', 3.2, 1, 2.5, 15.5, 0.45, 'Web Development'),

('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001',
'fsrs', 'review', '2026-01-16 10:00:00', '2026-01-11 10:15:00', 4.5, 2, 2.5, 18.3, 0.38, 'Networking'),

('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000001',
'sm2', 'learning', '2026-01-12 11:00:00', '2026-01-09 11:00:00', 1.5, 1, 2.5, 0, 0, 'Programming'),

('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000001',
'sm2', 'relearning', '2026-01-13 16:00:00', '2026-01-10 16:45:00', 2.0, 2, 2.3, 0, 0, 'Computer Science'),

('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000001',
'fsrs', 'review', '2026-01-14 09:00:00', '2026-01-11 09:30:00', 2.8, 1, 2.5, 12.7, 0.48, 'Data Structures'),

('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
'sm2', 'review', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '3 days', 3.0, 3, 2.5, 0, 0, 'Networking'),

('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003',
'sm2', 'learning', NOW() + INTERVAL '5 hours', NOW() - INTERVAL '1 day', 1.0, 1, 2.3, 0, 0, 'Networking'),

('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003',
'fsrs', 'review', NOW() + INTERVAL '1 day', NOW() - INTERVAL '2 days', 2.4, 2, 2.5, 14.8, 0.42, 'Web Development'),

('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003',
'fsrs', 'relearning', NOW() + INTERVAL '3 days', NOW() - INTERVAL '6 hours', 0.8, 1, 2.4, 9.1, 0.58, 'Web Development'),

('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000003',
'fsrs', 'review', NOW() + INTERVAL '4 days', NOW() - INTERVAL '4 days', 4.2, 3, 2.6, 18.5, 0.35, 'Networking')
ON CONFLICT (flashcard_id, user_id) DO NOTHING;

INSERT INTO flashcard_mnemonics (id, flashcard_id, mnemonic_type, content, ai_generated_reasoning, is_user_selected)
VALUES
('f1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003',
'abbreviation', 
'DHCP = Dude, Here''s a Computer Protocol (that hands out IP addresses automatically!)',
'This playful abbreviation creates a memorable association between what DHCP does (provides addresses) and its name, making it stick in memory through humor and relevance.',
true),

('f1111112-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003',
'visual_association',
'Imagine a friendly robot librarian automatically giving out numbered library cards (IP addresses) to everyone who walks in.',
'Visual metaphors leverage our strong spatial and visual memory. The librarian robot represents the DHCP server, and library cards represent IP addresses.',
false),

('f2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000004',
'acrostic',
'Please Do Not Throw Sausage Pizza Away - Physical, Data Link, Network, Transport, Session, Presentation, Application',
'This classic mnemonic uses a memorable, slightly absurd phrase where each word''s first letter corresponds to an OSI layer in order. The unusual imagery makes it stick.',
true),

('f2222223-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000004',
'visual_association',
'Imagine a 7-layer cake: the plate is Physical, each layer adds functionality, and the Application frosting is what users see and taste.',
'The layer cake metaphor maps perfectly to the OSI model''s layered architecture, making the abstract concept concrete and memorable.',
false),

('f2222224-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000004',
'storytelling',
'A package travels from your computer (Physical layer - the road) through your router (Network layer - the GPS), gets sorted by protocol (Transport), establishes a conversation (Session), translates the language (Presentation), and finally delivers the message to the app (Application).',
'Stories create narrative structure that our brains remember better than isolated facts. Following a data packet''s journey makes each layer''s role clear.',
false),

('f3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000005',
'abbreviation',
'REST = Really Easy State Transfer (using HTTP to move data around)',
'Simplifying the acronym makes it less intimidating and emphasizes the key concept of stateless communication.',
true),

('f4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000006',
'storytelling',
'POST is like POSTing a letter - you''re creating and sending something new to the mail system. The post office (server) receives and stores your letter (new resource).',
'Connecting HTTP POST to the familiar act of posting mail creates a strong associative link through shared terminology.',
true),

('f4444445-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000006',
'abbreviation',
'HTTP CRUD: Create=POST, Read=GET, Update=PUT, Delete=DELETE',
'Mapping HTTP methods to CRUD operations provides a clear framework that programmers already understand.',
false),

('f5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555',
'rhyme',
'HTTPS secure, port four-four-three, keeps your data safe as can be!',
'Rhymes activate different memory pathways and are notoriously difficult to forget once learned. The rhythm makes recall automatic.',
true),

('f5555556-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555',
'visual_association',
'HTTP is 80 (8 letters), add S for Secure and you get 443 (looks like 4 = for, 4 = for, 3 = secure/S/3rd letter)',
'Creating mathematical or visual patterns between related concepts (80 vs 443) helps cement the relationship.',
false),

('f6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666',
'abbreviation',
'Polymorphism = Poly (many) + Morph (forms) = Many Forms, One Interface',
'Breaking down Greek/Latin roots helps understand the concept intuitively. If you know what the word parts mean, you understand the concept.',
true),

('f6666667-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666',
'visual_association',
'Think of a shape-shifter in movies - same character (interface), many forms (dog, cat, human). Same method name, different implementations.',
'Pop culture references (shape-shifters, transformers) leverage existing strong memories to encode new information.',
false),

('f7777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777',
'visual_association',
'O(1) = elevator direct to floor, O(n) = climbing stairs one by one, O(n²) = checking every room on every floor',
'Real-world scenarios make abstract concepts concrete. Building navigation maps directly to algorithm efficiency.',
true),

('f7777778-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777',
'abbreviation',
'Big O = Order of growth - how much slower as input gets Bigger',
'Emphasizing the "Big" and "Order" connects to what we''re actually measuring.',
false),

('f8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888',
'visual_association',
'Imagine a library with books organized by a special code - you calculate the code from the book title (hash function) and go straight to that shelf (index).',
'Libraries are familiar organizational systems. The hash function is like the Dewey Decimal System - turns names into locations.',
true),

('f8888889-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888',
'storytelling',
'Hash tables are like a magical filing cabinet: whisper a name, the cabinet calculates which drawer, and the drawer pops open instantly with your file.',
'Magic/fantasy elements make technical concepts feel more accessible and memorable through wonder rather than intimidation.',
false);

INSERT INTO user_ar_environments (id, user_id, name, ar_pin_data, ar_system, created_at)
VALUES
('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
'My Bedroom Study Desk',
decode('QVJQaW5TdHVkeURlc2tFbnYwMDAxMjM0NTY3ODkwYWJjZGVm', 'base64'),
'ARKit',
'2026-01-05 08:30:00'),

('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001',
'Living Room Coffee Table',
decode('QVJQaW5MaXZpbmdSb29tRW52OTg3NjU0MzIxMGZlZGNiYQ==', 'base64'),
'ARCore',
'2026-01-06 15:20:00'),

('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001',
'Kitchen Counter',
decode('QVJQaW5LaXRjaGVuQ291bnRlcjExMjIzMzQ0NTU2Njc3ODg=', 'base64'),
'ARKit',
'2026-01-07 18:45:00'),

('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001',
'Office Workspace',
decode('QVJQaW5PZmZpY2VXb3Jrc3BhY2U2Njc3ODg5OTAwMTEyMjMz', 'base64'),
'OpenXR',
'2026-01-08 09:15:00'),

('e5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001',
'Classroom Whiteboard Area',
decode('QVJQaW5DbGFzc3Jvb21Cb2FyZDQ0NTU2Njc3ODg5OTAwMTE=', 'base64'),
'ARCore',
'2026-01-04 10:00:00');

INSERT INTO vr_scenarios (id, title, description, scene_asset_path, difficulty_level, estimated_duration_minutes, required_concepts, is_active, created_by, created_at)
VALUES
('a1111111-1111-1111-1111-111111111111',
'The Network Administrator Mystery',
'A network administrator was found unconscious in the server room. The network logs show unusual activity. Use your knowledge of networking protocols (DHCP, OSI Model, ports) to uncover what happened and who sabotaged the system.',
'/Game/VR/Scenes/ServerRoom_Mystery.umap',
'beginner',
30,
NULL,
true,
'00000000-0000-0000-0000-000000000001',
'2026-01-01 10:00:00'),

('a2222222-2222-2222-2222-222222222222',
'The API Developer Conspiracy',
'A REST API developer discovered a critical security flaw and disappeared. Navigate through the tech office, examine API logs, and use your understanding of HTTP methods and web protocols to uncover the conspiracy.',
'/Game/VR/Scenes/TechOffice_Mystery.umap',
'intermediate',
45,
NULL,
true,
'00000000-0000-0000-0000-000000000001',
'2026-01-02 14:00:00'),

('a3333333-3333-3333-3333-333333333333',
'The Algorithm Apocalypse',
'In a futuristic programming lab, an AI has gone rogue. Debug the system by applying your knowledge of Big O notation, data structures, and algorithms. Every wrong answer makes the situation worse!',
'/Game/VR/Scenes/FutureLab_Mystery.umap',
'advanced',
60,
NULL,
true,
'00000000-0000-0000-0000-000000000001',
'2026-01-03 09:00:00'),

('a4444444-4444-4444-4444-444444444444',
'The Object-Oriented Crime',
'A software company''s codebase has been corrupted. Objects are behaving strangely. Use your OOP knowledge (polymorphism, inheritance) to restore order and identify the insider threat.',
'/Game/VR/Scenes/SoftwareCompany_Mystery.umap',
'beginner',
35,
NULL,
true,
'00000000-0000-0000-0000-000000000001',
'2026-01-05 11:30:00');

INSERT INTO user_vr_progress (id, user_id, scenario_id, game_state_data, started_at, last_played_at, completed_at, completion_percentage, total_play_time_minutes)
VALUES
('b1111111-1111-1111-1111-111111111111', 
'00000000-0000-0000-0000-000000000001', 
'a1111111-1111-1111-1111-111111111111',
'{"current_room": "server_room", "clues_found": ["dhcp_log", "router_config", "port_scan_results", "admin_notes"], "npcs_alive": ["tech_support", "janitor", "security_guard"], "npcs_questioned": ["tech_support", "janitor"], "inventory": ["access_card", "network_diagram"], "mystery_solved": true, "culprit_identified": "janitor"}'::jsonb,
'2026-01-08 14:00:00',
'2026-01-08 14:35:00',
'2026-01-08 14:35:00',
100.0,
35),

('b2222222-2222-2222-2222-222222222222',
'00000000-0000-0000-0000-000000000001',
'a2222222-2222-2222-2222-222222222222',
'{"current_room": "developer_office", "clues_found": ["api_documentation", "git_commit_logs", "authentication_bypass"], "npcs_alive": ["cto", "security_guard", "hr_manager"], "npcs_questioned": ["security_guard", "hr_manager"], "inventory": ["laptop", "usb_drive"], "mystery_solved": false, "questions_answered_correctly": 5, "questions_answered_incorrectly": 1}'::jsonb,
'2026-01-09 16:00:00',
'2026-01-11 11:45:00',
NULL,
60.0,
45),

('b3333333-3333-3333-3333-333333333333',
'00000000-0000-0000-0000-000000000001',
'a3333333-3333-3333-3333-333333333333',
'{"current_room": "main_lab", "clues_found": ["algorithm_logs", "complexity_analysis"], "npcs_alive": ["ai_assistant", "lead_researcher", "security_team"], "npcs_questioned": ["ai_assistant"], "inventory": ["security_badge", "debug_tools"], "mystery_solved": false, "ai_threat_level": 5, "algorithms_debugged": 2}'::jsonb,
'2026-01-10 09:00:00',
'2026-01-11 10:15:00',
NULL,
42.0,
38),

('b4444444-4444-4444-4444-444444444444',
'00000000-0000-0000-0000-000000000001',
'a4444444-4444-4444-4444-444444444444',
'{"current_room": "ceo_office", "clues_found": ["code_review", "class_diagrams", "inheritance_tree", "bug_reports", "backup_logs"], "npcs_alive": ["ceo", "lead_developer"], "npcs_questioned": ["ceo", "lead_developer", "system_admin"], "inventory": ["master_key", "source_code", "audit_report"], "mystery_solved": true, "corruption_source_found": true, "saboteur_identified": "lead_developer"}'::jsonb,
'2026-01-09 13:00:00',
'2026-01-09 13:52:00',
'2026-01-09 13:52:00',
100.0,
52);

INSERT INTO vr_learning_triggers (id, scenario_id, required_flashcard_id, trigger_context, on_success_action, on_failure_action, failure_feedback_message)
VALUES
('d1111111-1111-1111-1111-111111111111',
'a1111111-1111-1111-1111-111111111111',
'00000000-0000-0000-0000-000000000003',
'examine_dhcp_logs',
'unlock_clue_network_configuration',
'trigger_network_lockdown',
'You failed to explain DHCP correctly. The network system initiated an emergency lockdown, preventing you from accessing critical evidence!'),

('d1111112-1111-1111-1111-111111111111',
'a1111111-1111-1111-1111-111111111111',
'00000000-0000-0000-0000-000000000004',
'analyze_network_packet',
'unlock_clue_packet_analysis',
'misinterpret_network_data',
'Without understanding the OSI Model layers, you misinterpreted the network traffic data. A crucial piece of evidence was overlooked!'),

('d1111113-1111-1111-1111-111111111111',
'a1111111-1111-1111-1111-111111111111',
'55555555-5555-5555-5555-555555555555',
'configure_secure_connection',
'access_encrypted_files',
'connection_blocked',
'Incorrect port configuration! The encrypted files remain inaccessible. The culprit''s digital trail goes cold.'),

('d2222221-2222-2222-2222-222222222222',
'a2222222-2222-2222-2222-222222222222',
'00000000-0000-0000-0000-000000000005',
'review_api_architecture',
'discover_security_flaw',
'miss_vulnerability',
'Your lack of REST principles knowledge prevented you from identifying the API vulnerability. The security flaw remains hidden!'),

('d2222222-2222-2222-2222-222222222222',
'a2222222-2222-2222-2222-222222222222',
'00000000-0000-0000-0000-000000000006',
'examine_api_endpoints',
'unlock_endpoint_evidence',
'corrupt_api_logs',
'Incorrect HTTP method knowledge caused you to send the wrong request type, corrupting the API access logs. Evidence destroyed!'),

('d2222223-2222-2222-2222-222222222222',
'a2222222-2222-2222-2222-222222222222',
'55555555-5555-5555-5555-555555555555',
'intercept_secure_transmission',
'decrypt_communication',
'lose_encrypted_clue',
'Failed to intercept the HTTPS transmission on the correct port. The encrypted communication containing vital clues was lost!'),

('d3333331-3333-3333-3333-333333333333',
'a3333333-3333-3333-3333-333333333333',
'77777777-7777-7777-7777-777777777777',
'optimize_critical_algorithm',
'stabilize_ai_system',
'system_performance_degrades',
'Without understanding Big O complexity, you chose an inefficient algorithm. System performance degraded by 60%! The AI grows more unstable.'),

('d3333332-3333-3333-3333-333333333333',
'a3333333-3333-3333-3333-333333333333',
'88888888-8888-8888-8888-888888888888',
'repair_lookup_system',
'restore_database_access',
'data_retrieval_fails',
'Failed to implement proper hash table logic. The database lookup system remains broken, blocking access to critical shutdown codes!'),

('d3333333-3333-3333-3333-333333333333',
'a3333333-3333-3333-3333-333333333333',
'66666666-6666-6666-6666-666666666666',
'debug_object_behavior',
'fix_polymorphic_bug',
'objects_malfunction',
'Misunderstanding polymorphism caused you to incorrectly override methods. Objects throughout the system now behave unpredictably!'),

('d4444441-4444-4444-4444-444444444444',
'a4444444-4444-4444-4444-444444444444',
'66666666-6666-6666-6666-666666666666',
'restore_object_inheritance',
'fix_codebase_corruption',
'inheritance_chain_breaks',
'Your misunderstanding of polymorphism caused the inheritance chain to break further. Multiple systems failed!'),

('d4444442-4444-4444-4444-444444444444',
'a4444444-4444-4444-4444-444444444444',
'77777777-7777-7777-7777-777777777777',
'analyze_code_performance',
'identify_performance_sabotage',
'overlook_inefficiency',
'Without Big O knowledge, you failed to spot the deliberately inefficient code. The saboteur''s tracks remain hidden!');


INSERT INTO reputation_levels (name, url_id, min_score, max_score, icon, color, is_global) VALUES
  ('Newcomer', 'newcomer', 0, 99, 'seedling', '#9E9E9E', TRUE),
  ('Learner', 'learner', 100, 499, 'sprout', '#8BC34A', TRUE),
  ('Contributor', 'contributor', 500, 1499, 'leaf', '#4CAF50', TRUE),
  ('Guide', 'guide', 1500, 4999, 'tree', '#2196F3', TRUE),
  ('Expert', 'expert', 5000, 14999, 'star', '#FF9800', TRUE),
  ('Master', 'master', 15000, 49999, 'crown', '#9C27B0', TRUE),
  ('Legend', 'legend', 50000, NULL, 'trophy', '#FFD700', TRUE)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO shop_items (id, name, url_id, description, price, category, item_type, item_value, is_giftable, icon, preview_url, display_order) VALUES
  ('51000000-0000-0000-0000-000000000001'::uuid, 'Streak Freeze', 'streak-freeze',
    'Protect your streak for one day', 200, 'fun', 'streak_freeze',
    '{"days": 1}'::jsonb, TRUE, 'snowflake', '/images/shop/streak-freeze.png', 1),
  ('51000000-0000-0000-0000-000000000002'::uuid, '2x XP Boost (24h)', 'xp-boost-24',
    'Double your points for 24 hours', 500, 'fun', 'xp_boost',
    '{"multiplier": 2, "duration_hours": 24}'::jsonb, FALSE, 'bolt', '/images/shop/xp-boost-24.png', 2),
  ('51000000-0000-0000-0000-000000000003'::uuid, 'Gold Profile Border', 'gold-border',
    'Show off with a golden profile border', 300, 'fun', 'profile_border',
    '{"asset": "gold_border"}'::jsonb, FALSE, 'circle', '/images/shop/gold-border.png', 3),
  ('51000000-0000-0000-0000-000000000004'::uuid, 'Diamond Profile Border', 'diamond-border',
    'The ultimate status symbol', 800, 'fun', 'profile_border',
    '{"asset": "diamond_border"}'::jsonb, FALSE, 'gem', '/images/shop/diamond-border.png', 4),
  ('51000000-0000-0000-0000-000000000005'::uuid, 'Fire Name Color', 'fire-name',
    'Your name appears in fiery orange', 400, 'fun', 'name_color',
    '{"color": "#FF5722"}'::jsonb, FALSE, 'fire', '/images/shop/fire-name.png', 5),
  ('51000000-0000-0000-0000-000000000006'::uuid, 'AI Summary Token', 'ai-summary-token',
    'Generate an AI-powered summary for any document', 100, 'fun', 'ai_summary',
    '{"uses": 1}'::jsonb, TRUE, 'sparkles', '/images/shop/ai-summary.png', 6)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO user_inventory (user_id, shop_item_id, quantity) VALUES
('00000000-0000-0000-0000-000000000003'::uuid, '51000000-0000-0000-0000-000000000005'::uuid, 1),
('00000000-0000-0000-0000-000000000003'::uuid, '51000000-0000-0000-0000-000000000006'::uuid, 5)
ON CONFLICT (user_id, shop_item_id) DO NOTHING;

UPDATE user_profiles
SET active_cosmetics = '{"name_color": "#FF5722"}'::jsonb
WHERE user_id = '00000000-0000-0000-0000-000000000003'::uuid;

INSERT INTO point_types (id, name, url_id, description, icon, color, is_global) VALUES
('20000000-0000-0000-0000-000000000001'::uuid,
 'Learning Points', 'learning-points',
 'Earned by studying, sharing content, and helping others.',
 'star', '#f59e0b', TRUE),
('20000000-0000-0000-0000-000000000004'::uuid,
 'Community Points', 'community-points',
 'Earned through community participation and collaboration.',
 'users', '#6366f1', TRUE)
ON CONFLICT (url_id) DO NOTHING;

INSERT INTO badges (id, name, url_id, description, color, rarity, badge_type, criteria, points_awarded, point_type_id, is_global, is_active) VALUES
('b1000000-0000-0000-0000-000000000001'::uuid,
 'First Post', 'first-post',
 'Posted your first discussion thread.',
 '#10b981', 'common', 'milestone',
 '{"action": "discussion_post", "count": 1}'::jsonb,
 5, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000002'::uuid,
 'Helpful Hand', 'helpful-hand',
 'Had 5 pieces of feedback marked as helpful.',
 '#6366f1', 'uncommon', 'achievement',
 '{"action": "feedback_helpful", "count": 5}'::jsonb,
 20, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000003'::uuid,
 'Scholar', 'scholar',
 'Shared 10 pieces of learning content.',
 '#8b5cf6', 'rare', 'achievement',
 '{"action": "share_content", "count": 10}'::jsonb,
 50, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000004'::uuid,
 'Mentor', 'mentor',
 'Completed 5 mentoring sessions.',
 '#f59e0b', 'epic', 'achievement',
 '{"action": "mentor_session", "count": 5}'::jsonb,
 100, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000005'::uuid,
 'Legend', 'legend',
 'Accumulated 1000 Learning Points.',
 '#ef4444', 'legendary', 'milestone',
 '{"points_threshold": 1000}'::jsonb,
 200, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000006'::uuid,
 'Streak Master', 'streak-master',
 'Maintained a 7-day study streak.',
 '#0ea5e9', 'rare', 'milestone',
 '{"streak_type": "daily_study", "days": 7}'::jsonb,
 30, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000007'::uuid,
 'Content Creator', 'content-creator',
 'Shared content that received 20 likes.',
 '#ec4899', 'uncommon', 'achievement',
 '{"action": "content_liked", "count": 20}'::jsonb,
 25, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('b1000000-0000-0000-0000-000000000008'::uuid,
 'Challenge Champion', 'challenge-champion',
 'Won a community challenge.',
 '#f97316', 'rare', 'achievement',
 '{"action": "challenge_win", "count": 1}'::jsonb,
 75, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000010'::uuid,
 'Week Warrior', 'streak-7',
 'Maintained a 7-day study streak.',
 '#4CAF50', 'common', 'milestone',
 '{"action": "daily_study", "streak": 7}'::jsonb,
 50, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000011'::uuid,
 'Fortnight Focus', 'streak-14',
 'Maintained a 14-day study streak.',
 '#8BC34A', 'uncommon', 'milestone',
 '{"action": "daily_study", "streak": 14}'::jsonb,
 100, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000012'::uuid,
 'Monthly Master', 'streak-30',
 'Maintained a 30-day study streak.',
 '#2196F3', 'rare', 'milestone',
 '{"action": "daily_study", "streak": 30}'::jsonb,
 250, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000013'::uuid,
 'Century Scholar', 'streak-100',
 'Maintained a 100-day study streak.',
 '#FF9800', 'epic', 'milestone',
 '{"action": "daily_study", "streak": 100}'::jsonb,
 1000, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000014'::uuid,
 'Year of Knowledge', 'streak-365',
 'Maintained a 365-day study streak.',
 '#FFD700', 'legendary', 'milestone',
 '{"action": "daily_study", "streak": 365}'::jsonb,
 5000, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000001'::uuid,
 'First Share', 'first-share',
 'Shared your first piece of content.',
 '#4CAF50', 'common', 'achievement',
 '{"action": "share_content", "count": 1}'::jsonb,
 10, '20000000-0000-0000-0000-000000000001'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000002'::uuid,
 'Helpful Peer', 'helpful-peer',
 'Gave feedback that was marked helpful 5 times.',
 '#2196F3', 'uncommon', 'achievement',
 '{"action": "feedback_helpful", "count": 5}'::jsonb,
 25, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000003'::uuid,
 'Community Builder', 'community-builder',
 'Invited 10 members who joined.',
 '#9C27B0', 'rare', 'community',
 '{"action": "successful_invite", "count": 10}'::jsonb,
 50, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000020'::uuid,
 'First Mentor', 'first-mentor',
 'Completed your first mentoring session.',
 '#FF9800', 'common', 'achievement',
 '{"action": "mentor_session", "count": 1}'::jsonb,
 20, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE),
('30000000-0000-0000-0000-000000000021'::uuid,
 'Dedicated Mentor', 'mentor-10',
 'Completed 10 mentoring sessions.',
 '#9C27B0', 'rare', 'achievement',
 '{"action": "mentor_session", "count": 10}'::jsonb,
 100, '20000000-0000-0000-0000-000000000004'::uuid, TRUE, TRUE)
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

INSERT INTO diagrams (
    id, user_id, url_slug, title, diagram_type, layout_type,
    source_document_ids, source_concept_ids,
    diagram_data, node_count, link_count,
    is_edited, is_public, last_viewed_at
) VALUES (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    'machine-learning-concepts',
    'Machine Learning Concepts',
    'knowledge_map',
    '3d_force',
    ARRAY['a0000000-0000-0000-0000-000000000101']::uuid[],
    ARRAY['c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000010']::uuid[],
    '{
      "nodes": [
        {"id": "1", "title": "Machine Learning", "description": "A subset of artificial intelligence that enables systems to learn from data", "concept_type": "definition", "difficulty_level": "intermediate"},
        {"id": "2", "title": "Neural Networks", "description": "Computing systems inspired by biological neural networks", "concept_type": "definition", "difficulty_level": "advanced"},
        {"id": "3", "title": "Supervised Learning", "description": "Learning from labeled training data to make predictions", "concept_type": "procedure", "difficulty_level": "beginner"},
        {"id": "4", "title": "Unsupervised Learning", "description": "Learning patterns from unlabeled data", "concept_type": "procedure", "difficulty_level": "intermediate"},
        {"id": "5", "title": "Backpropagation", "description": "Algorithm for training neural networks by computing gradients", "concept_type": "procedure", "difficulty_level": "advanced"},
        {"id": "6", "title": "Linear Regression", "description": "Predicting continuous values using linear relationships", "concept_type": "example", "difficulty_level": "beginner"},
        {"id": "7", "title": "Decision Trees", "description": "Tree-like model for classification and regression", "concept_type": "definition", "difficulty_level": "beginner"},
        {"id": "8", "title": "Random Forest", "description": "Ensemble of decision trees for improved accuracy", "concept_type": "definition", "difficulty_level": "intermediate"},
        {"id": "9", "title": "Gradient Descent", "description": "Optimization algorithm to minimize loss functions", "concept_type": "formula", "difficulty_level": "intermediate"},
        {"id": "10", "title": "Loss Function", "description": "Measures how well model predictions match actual values", "concept_type": "formula", "difficulty_level": "intermediate"}
      ],
      "links": [
        {"id": "l1", "sourceId": "1", "targetId": "2", "relationship_type": "has_part"},
        {"id": "l2", "sourceId": "1", "targetId": "3", "relationship_type": "has_part"},
        {"id": "l3", "sourceId": "1", "targetId": "4", "relationship_type": "has_part"},
        {"id": "l4", "sourceId": "2", "targetId": "5", "relationship_type": "requires"},
        {"id": "l5", "sourceId": "3", "targetId": "6", "relationship_type": "exemplifies"},
        {"id": "l6", "sourceId": "1", "targetId": "7", "relationship_type": "has_part"},
        {"id": "l7", "sourceId": "7", "targetId": "8", "relationship_type": "leads_to"},
        {"id": "l8", "sourceId": "2", "targetId": "9", "relationship_type": "requires"},
        {"id": "l9", "sourceId": "9", "targetId": "10", "relationship_type": "related_to"},
        {"id": "l10", "sourceId": "5", "targetId": "9", "relationship_type": "related_to"}
      ]
    }'::jsonb,
    10, 10,
    FALSE, FALSE, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO diagrams (
    id, user_id, url_slug, title, diagram_type, layout_type,
    source_document_ids, source_concept_ids,
    diagram_data, node_count, link_count,
    is_edited, is_public, last_viewed_at
) VALUES (
    '10000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    'backpropagation-training-loop',
    'Backpropagation Training Loop',
    'flowchart',
    '2d_flow',
    ARRAY['a0000000-0000-0000-0000-000000000101']::uuid[],
    ARRAY['c0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000010']::uuid[],
    '{
      "nodes": [
        {"id": "bp-step-1", "title": "Run Forward Pass", "description": "Use current weights to compute model predictions for the training batch.", "concept_type": "procedure", "difficulty_level": "intermediate"},
        {"id": "bp-step-2", "title": "Measure Loss", "description": "Compare predictions with the target values using the loss function.", "concept_type": "formula", "difficulty_level": "intermediate"},
        {"id": "bp-step-3", "title": "Backpropagate Gradients", "description": "Propagate error signals backward through the network to compute gradients.", "concept_type": "procedure", "difficulty_level": "advanced"},
        {"id": "bp-step-4", "title": "Update Weights", "description": "Apply gradient descent to adjust the model parameters before the next batch.", "concept_type": "procedure", "difficulty_level": "advanced"}
      ],
      "links": [
        {"id": "bp-l1", "sourceId": "bp-step-1", "targetId": "bp-step-2", "relationship_type": "next_step"},
        {"id": "bp-l2", "sourceId": "bp-step-2", "targetId": "bp-step-3", "relationship_type": "next_step"},
        {"id": "bp-l3", "sourceId": "bp-step-3", "targetId": "bp-step-4", "relationship_type": "next_step"}
      ]
    }'::jsonb,
    4, 3,
    FALSE, FALSE, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO diagrams (
    id, user_id, url_slug, title, diagram_type, layout_type,
    source_document_ids, source_concept_ids,
    diagram_data, node_count, link_count,
    is_edited, is_public, last_viewed_at
) VALUES (
    '10000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    'python-programming-mind-map',
    'Python Programming Mind Map',
    'mindmap',
    '2d_tree',
    ARRAY['a0000000-0000-0000-0000-000000000102']::uuid[],
    ARRAY['c0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000012','c0000000-0000-0000-0000-000000000013','c0000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000015','c0000000-0000-0000-0000-000000000018']::uuid[],
    '{
      "nodes": [
        {"id": "py-root", "title": "Python Programming", "description": "Readable general-purpose language used across scripting, automation, and data work.", "concept_type": "definition", "difficulty_level": "beginner"},
        {"id": "py-types", "title": "Data Types", "description": "Primitive and collection types such as strings, lists, tuples, dictionaries, and sets.", "concept_type": "definition", "difficulty_level": "beginner"},
        {"id": "py-control", "title": "Control Structures", "description": "Conditionals and loops for controlling program flow.", "concept_type": "procedure", "difficulty_level": "beginner"},
        {"id": "py-functions", "title": "Functions", "description": "Reusable blocks defined with parameters and return values.", "concept_type": "procedure", "difficulty_level": "beginner"},
        {"id": "py-oop", "title": "OOP", "description": "Classes, inheritance, encapsulation, and object behavior.", "concept_type": "definition", "difficulty_level": "intermediate"},
        {"id": "py-files", "title": "File Handling", "description": "Reading and writing files safely with context managers.", "concept_type": "procedure", "difficulty_level": "beginner"}
      ],
      "links": [
        {"id": "py-l1", "sourceId": "py-root", "targetId": "py-types", "relationship_type": "has_part"},
        {"id": "py-l2", "sourceId": "py-root", "targetId": "py-control", "relationship_type": "has_part"},
        {"id": "py-l3", "sourceId": "py-root", "targetId": "py-functions", "relationship_type": "has_part"},
        {"id": "py-l4", "sourceId": "py-root", "targetId": "py-oop", "relationship_type": "has_part"},
        {"id": "py-l5", "sourceId": "py-root", "targetId": "py-files", "relationship_type": "has_part"}
      ]
    }'::jsonb,
    6, 5,
    FALSE, FALSE, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO diagrams (
    id, user_id, url_slug, title, diagram_type, layout_type,
    source_document_ids, source_concept_ids,
    diagram_data, node_count, link_count,
    is_edited, is_public, last_viewed_at
) VALUES (
    '10000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    'model-training-foundations-timeline',
    'Model Training Foundations Timeline',
    'timeline',
    '2d_timeline',
    ARRAY['a0000000-0000-0000-0000-000000000101']::uuid[],
    ARRAY['c0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000005']::uuid[],
    '{
      "nodes": [
        {"id": "ml-t1", "title": "Understand the Loss Function", "description": "Start by defining the metric that tells the model how wrong its predictions are.", "concept_type": "formula", "difficulty_level": "intermediate"},
        {"id": "ml-t2", "title": "Apply Gradient Descent", "description": "Use gradients to decide how model parameters should move to reduce loss.", "concept_type": "formula", "difficulty_level": "intermediate"},
        {"id": "ml-t3", "title": "Run Backpropagation", "description": "Use the backward pass to compute the gradients needed for each layer.", "concept_type": "procedure", "difficulty_level": "advanced"}
      ],
      "links": [
        {"id": "ml-tl1", "sourceId": "ml-t1", "targetId": "ml-t2", "relationship_type": "prerequisite_of"},
        {"id": "ml-tl2", "sourceId": "ml-t2", "targetId": "ml-t3", "relationship_type": "prerequisite_of"}
      ]
    }'::jsonb,
    3, 2,
    FALSE, FALSE, CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;


INSERT INTO sources (
    id, document_name, document_type, language, author,
    uploaded_by, is_public, processing_status,
    concepts_extracted, relationships_extracted,
    ai_summary, full_text
) VALUES (
    'a0000000-0000-0000-0000-000000000101'::uuid,
    'Introduction to Machine Learning',
    'pdf',
    'en',
    'Demo Author',
    '00000000-0000-0000-0000-000000000003'::uuid,
    FALSE,
    'completed',
    10,
    10,
    'A comprehensive introduction to machine learning covering supervised and unsupervised learning, neural networks, decision trees, and optimization algorithms including gradient descent and backpropagation.',
    'Machine learning is a subset of artificial intelligence that enables systems to learn from data and improve their performance without explicit programming. This comprehensive introduction covers the fundamental concepts and techniques in the field.

Supervised learning involves training models on labeled data to make predictions. Common algorithms include linear regression for continuous value prediction, and decision trees for classification tasks. Random forests combine multiple decision trees to improve accuracy and reduce overfitting.

Neural networks are computing systems inspired by biological neural networks in the brain. They consist of layers of interconnected nodes that process information. Deep learning uses neural networks with multiple layers to learn hierarchical representations of data.

Unsupervised learning discovers patterns in unlabeled data. Techniques include clustering, dimensionality reduction, and anomaly detection. These methods are useful when labeled data is scarce or expensive to obtain.

Training neural networks requires optimization algorithms like gradient descent, which iteratively adjusts model parameters to minimize a loss function. The loss function measures how well model predictions match actual values. Backpropagation is the key algorithm for computing gradients efficiently in neural networks.

Modern machine learning applications span computer vision, natural language processing, recommendation systems, and autonomous vehicles. The field continues to evolve with advances in deep learning architectures and training techniques.'
)
ON CONFLICT (id) DO NOTHING;


INSERT INTO sources (
    id, document_name, document_type, language, author,
    uploaded_by, is_public, processing_status,
    concepts_extracted, relationships_extracted,
    ai_summary, full_text
) VALUES
(
    'a0000000-0000-0000-0000-000000000102'::uuid,
    'Introduction to Python Programming',
    'pdf',
    'en',
    'Demo Author',
    '00000000-0000-0000-0000-000000000003'::uuid,
    FALSE,
    'completed',
    8,
    8,
    'A comprehensive guide to Python programming covering basic syntax, data types, control structures, functions, object-oriented programming, and common libraries for data manipulation and file handling.',
    'Python is a high-level, interpreted programming language known for its simplicity and readability. It emphasizes code readability with significant whitespace and supports multiple programming paradigms including procedural, object-oriented, and functional programming.

Variables in Python are dynamically typed, meaning you do not need to declare their type explicitly. Basic data types include integers, floats, strings, booleans, lists, tuples, dictionaries, and sets. Lists are mutable ordered collections, while tuples are immutable. Dictionaries store key-value pairs and provide fast lookup times.

Control structures include if-elif-else statements for conditional execution, for loops for iterating over sequences, and while loops for repeated execution based on conditions. Python uses indentation to define code blocks rather than braces or keywords.

Functions are defined using the def keyword and can accept parameters with default values. Functions can return multiple values using tuples. Lambda functions provide a way to create small anonymous functions. Decorators allow modification of function behavior without changing the function code.

Object-oriented programming in Python supports classes, inheritance, encapsulation, and polymorphism. Classes are defined using the class keyword. The __init__ method serves as the constructor. Python supports multiple inheritance and provides special methods like __str__ and __repr__ for customizing object behavior.

Common built-in libraries include os for operating system interactions, sys for system-specific parameters, datetime for date and time operations, json for JSON parsing, and re for regular expressions. External libraries like NumPy, Pandas, and Matplotlib are widely used for data science applications.

File handling in Python uses the open() function with different modes for reading, writing, and appending. Context managers with the with statement ensure proper resource cleanup. Exception handling uses try-except blocks to catch and handle runtime errors gracefully.'
),
(
    'a0000000-0000-0000-0000-000000000103'::uuid,
    'Data Structures and Algorithms',
    'pdf',
    'en',
    'Demo Author',
    '00000000-0000-0000-0000-000000000003'::uuid,
    FALSE,
    'completed',
    12,
    12,
    'An in-depth exploration of fundamental data structures including arrays, linked lists, stacks, queues, trees, graphs, and hash tables, along with essential algorithms for searching, sorting, and optimization.',
    'Data structures are specialized formats for organizing, processing, and storing data efficiently. The choice of data structure significantly impacts the performance of algorithms and applications. Understanding time and space complexity using Big O notation is crucial for analyzing algorithm efficiency.

Arrays store elements in contiguous memory locations, providing constant-time access by index. However, insertion and deletion operations can be expensive requiring shifting elements. Dynamic arrays like Python lists automatically resize when capacity is exceeded. Multi-dimensional arrays are useful for representing matrices and grids.

Linked lists consist of nodes containing data and references to the next node. Singly linked lists allow traversal in one direction, while doubly linked lists maintain both forward and backward pointers. Linked lists excel at insertion and deletion but require linear time for random access.

Stacks follow Last-In-First-Out (LIFO) principle and support push and pop operations. They are used in function call management, expression evaluation, and undo mechanisms. Queues follow First-In-First-Out (FIFO) principle with enqueue and dequeue operations, useful for scheduling and breadth-first search.

Trees are hierarchical data structures with a root node and child nodes. Binary trees restrict each node to at most two children. Binary search trees maintain sorted order enabling efficient searching with O(log n) average time complexity. Balanced trees like AVL and Red-Black trees guarantee logarithmic height.

Graphs consist of vertices connected by edges and can be directed or undirected, weighted or unweighted. Graph representations include adjacency matrices and adjacency lists. Common graph algorithms include depth-first search (DFS), breadth-first search (BFS), Dijkstra shortest path, and minimum spanning tree algorithms.

Hash tables use hash functions to map keys to array indices, providing average constant-time insertion, deletion, and lookup. Collision resolution techniques include chaining with linked lists and open addressing with linear or quadratic probing.

Sorting algorithms include comparison-based methods like quicksort, mergesort, and heapsort with O(n log n) time complexity, and linear-time algorithms like counting sort and radix sort for specific input types. Searching algorithms range from linear search O(n) to binary search O(log n) on sorted data.'
),
(
    'a0000000-0000-0000-0000-000000000104'::uuid,
    'Introduction to Databases',
    'pdf',
    'en',
    'Demo Author',
    '00000000-0000-0000-0000-000000000003'::uuid,
    FALSE,
    'completed',
    10,
    10,
    'A foundational guide to database systems covering relational database concepts, SQL queries, normalization, transactions, indexing, and the differences between SQL and NoSQL databases.',
    'Databases are organized collections of structured data stored electronically in computer systems. Database management systems (DBMS) provide interfaces for defining, creating, querying, updating, and administering databases. Modern applications rely heavily on databases for persistent data storage and retrieval.

Relational databases organize data into tables with rows (records) and columns (attributes). Each table has a primary key uniquely identifying each row. Foreign keys establish relationships between tables enabling data to be normalized and related across multiple tables. This reduces redundancy and maintains data integrity.

SQL (Structured Query Language) is the standard language for relational database operations. SELECT statements retrieve data with filtering using WHERE clauses, sorting with ORDER BY, and joining tables. INSERT, UPDATE, and DELETE statements modify data. CREATE, ALTER, and DROP statements define database schema.

Database normalization is the process of organizing data to reduce redundancy and improve data integrity. First normal form (1NF) eliminates repeating groups. Second normal form (2NF) removes partial dependencies. Third normal form (3NF) eliminates transitive dependencies. Higher normal forms like BCNF provide additional constraints.

Transactions are sequences of database operations executed as single logical units. ACID properties ensure reliability: Atomicity guarantees all-or-nothing execution, Consistency maintains database invariants, Isolation prevents interference between concurrent transactions, and Durability ensures committed changes persist.

Indexes improve query performance by creating auxiliary data structures that enable faster data retrieval. B-tree indexes support efficient range queries and sorting. Hash indexes provide constant-time lookup for equality comparisons. However, indexes consume storage space and slow down write operations.

NoSQL databases provide alternatives to relational models for specific use cases. Document databases like MongoDB store JSON-like documents. Key-value stores like Redis offer simple fast lookups. Column-family stores like Cassandra optimize for write-heavy workloads. Graph databases like Neo4j excel at relationship-heavy data.

Query optimization involves analyzing execution plans and choosing efficient access paths. Database systems use statistics about data distribution to estimate query costs. Techniques include index selection, join reordering, and caching frequently accessed data. Proper indexing and query design are critical for performance.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO source_subjects (source_id, subject_id) VALUES
('a0000000-0000-0000-0000-000000000102'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid)
ON CONFLICT (source_id, subject_id) DO NOTHING;

INSERT INTO source_subjects (source_id, subject_id) VALUES
('a0000000-0000-0000-0000-000000000103'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid)
ON CONFLICT (source_id, subject_id) DO NOTHING;

INSERT INTO source_subjects (source_id, subject_id) VALUES
('a0000000-0000-0000-0000-000000000104'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid)
ON CONFLICT (source_id, subject_id) DO NOTHING;


INSERT INTO sources (
    id, document_name, document_type, language, author,
    uploaded_by, is_public, processing_status,
    concepts_extracted, relationships_extracted,
    ai_summary, full_text
) VALUES
(
    'a0000000-0000-0000-0000-000000000105'::uuid,
    'Introduction to Classical Mechanics',
    'pdf',
    'en',
    'Demo Author',
    '00000000-0000-0000-0000-000000000003'::uuid,
    FALSE,
    'completed',
    10,
    10,
    'A comprehensive introduction to classical mechanics covering Newton''s laws of motion, kinematics, dynamics, energy, momentum, rotational motion, gravitation, and oscillations.',
    'Classical mechanics is the branch of physics that studies the motion of macroscopic objects under the influence of forces. It forms the foundation for understanding physical phenomena in everyday life and provides the basis for more advanced topics in physics and engineering.

Newton''s three laws of motion are fundamental to classical mechanics. The first law states that an object at rest stays at rest and an object in motion stays in motion with constant velocity unless acted upon by a net external force. This property is called inertia. The second law establishes that force equals mass times acceleration (F = ma), quantifying how forces affect motion. The third law states that for every action there is an equal and opposite reaction.

Kinematics describes motion without considering its causes. Position, velocity, and acceleration are the key kinematic quantities. Velocity is the rate of change of position with respect to time, while acceleration is the rate of change of velocity. For constant acceleration, kinematic equations relate these quantities. Projectile motion combines horizontal motion at constant velocity with vertical motion under constant gravitational acceleration.

Dynamics examines the forces that cause motion. Common forces include gravitational force, normal force, friction, tension, and applied forces. Free body diagrams help visualize all forces acting on an object. Friction opposes relative motion between surfaces, with static friction preventing motion and kinetic friction acting during sliding.

Energy is the capacity to do work. Kinetic energy depends on an object''s mass and velocity (KE = 1/2 mv²). Potential energy is stored energy due to position or configuration, with gravitational potential energy given by mgh near Earth''s surface. The work-energy theorem states that net work equals change in kinetic energy. Conservation of mechanical energy applies when only conservative forces act.

Momentum is the product of mass and velocity (p = mv). The law of conservation of momentum states that total momentum remains constant in isolated systems. Collisions are classified as elastic (kinetic energy conserved) or inelastic (kinetic energy not conserved). Impulse equals change in momentum and equals force multiplied by time interval.

Rotational motion involves objects rotating about an axis. Angular displacement, angular velocity, and angular acceleration are rotational analogs of linear kinematic quantities. Torque is the rotational equivalent of force, causing angular acceleration. Moment of inertia represents resistance to rotational acceleration. Rotational kinetic energy depends on moment of inertia and angular velocity.

Universal gravitation describes the attractive force between any two masses. Newton''s law of universal gravitation states that gravitational force is proportional to the product of masses and inversely proportional to the square of distance between them. This explains planetary orbits and satellite motion. Gravitational potential energy extends to situations far from Earth''s surface.

Simple harmonic motion occurs in systems experiencing restoring forces proportional to displacement. Examples include mass-spring systems and pendulums for small angles. Period and frequency characterize oscillatory motion. Energy continuously transforms between kinetic and potential energy while total mechanical energy remains constant in ideal systems.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO source_subjects (source_id, subject_id) VALUES
('a0000000-0000-0000-0000-000000000105'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid)
ON CONFLICT (source_id, subject_id) DO NOTHING;


INSERT INTO concepts (id, concept_type, difficulty_level, created_by, is_system_generated, is_public) VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000002'::uuid, 'definition',  'advanced',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000003'::uuid, 'procedure',   'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000004'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000005'::uuid, 'procedure',   'advanced',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000006'::uuid, 'example',     'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000007'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000008'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000009'::uuid, 'formula',     'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000010'::uuid, 'formula',     'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000011'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000012'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000013'::uuid, 'procedure',   'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000014'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000015'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000016'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000017'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000018'::uuid, 'procedure',   'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000019'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000020'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000021'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000022'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000023'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000024'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000025'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000026'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000027'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000028'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000029'::uuid, 'procedure',   'advanced',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000030'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000031'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000032'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000033'::uuid, 'procedure',   'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000034'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000035'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000036'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000037'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000038'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000039'::uuid, 'procedure',   'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000040'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000041'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000042'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000043'::uuid, 'definition',  'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000044'::uuid, 'formula',     'beginner',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000045'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000046'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000047'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000048'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000049'::uuid, 'definition',  'advanced',     '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE),
('c0000000-0000-0000-0000-000000000050'::uuid, 'definition',  'intermediate', '00000000-0000-0000-0000-000000000003'::uuid, TRUE, FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO concept_translations (concept_id, language, title, description, is_primary, translation_quality) VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, 'en', 'Machine Learning',      'A subset of artificial intelligence that enables systems to learn from data.',          TRUE, 'source'),
('c0000000-0000-0000-0000-000000000002'::uuid, 'en', 'Neural Networks',        'Computing systems inspired by biological neural networks.',                             TRUE, 'source'),
('c0000000-0000-0000-0000-000000000003'::uuid, 'en', 'Supervised Learning',    'Learning from labeled training data to make predictions.',                               TRUE, 'source'),
('c0000000-0000-0000-0000-000000000004'::uuid, 'en', 'Unsupervised Learning',  'Learning patterns from unlabeled data.',                                                 TRUE, 'source'),
('c0000000-0000-0000-0000-000000000005'::uuid, 'en', 'Backpropagation',        'Algorithm for training neural networks by computing gradients.',                         TRUE, 'source'),
('c0000000-0000-0000-0000-000000000006'::uuid, 'en', 'Linear Regression',      'Predicting continuous values using linear relationships.',                               TRUE, 'source'),
('c0000000-0000-0000-0000-000000000007'::uuid, 'en', 'Decision Trees',         'Tree-like model for classification and regression.',                                     TRUE, 'source'),
('c0000000-0000-0000-0000-000000000008'::uuid, 'en', 'Random Forest',          'Ensemble of decision trees for improved accuracy.',                                      TRUE, 'source'),
('c0000000-0000-0000-0000-000000000009'::uuid, 'en', 'Gradient Descent',       'Optimization algorithm to minimize loss functions.',                                     TRUE, 'source'),
('c0000000-0000-0000-0000-000000000010'::uuid, 'en', 'Loss Function',          'Measures how well model predictions match actual values.',                               TRUE, 'source'),
('c0000000-0000-0000-0000-000000000011'::uuid, 'en', 'Python Programming',     'High-level interpreted programming language known for simplicity and readability.',      TRUE, 'source'),
('c0000000-0000-0000-0000-000000000012'::uuid, 'en', 'Python Data Types',      'Built-in types including int, float, string, list, tuple, dict, and set.',              TRUE, 'source'),
('c0000000-0000-0000-0000-000000000013'::uuid, 'en', 'Control Structures',     'If-elif-else statements, for loops, and while loops for program flow control.',          TRUE, 'source'),
('c0000000-0000-0000-0000-000000000014'::uuid, 'en', 'Python Functions',       'Reusable code blocks defined with def keyword, supporting parameters and return values.',TRUE, 'source'),
('c0000000-0000-0000-0000-000000000015'::uuid, 'en', 'Python OOP',             'Object-oriented programming with classes, inheritance, and encapsulation.',              TRUE, 'source'),
('c0000000-0000-0000-0000-000000000016'::uuid, 'en', 'Python Decorators',      'Functions that modify behavior of other functions without changing their code.',        TRUE, 'source'),
('c0000000-0000-0000-0000-000000000017'::uuid, 'en', 'Lambda Functions',       'Anonymous functions created with lambda keyword for simple operations.',                 TRUE, 'source'),
('c0000000-0000-0000-0000-000000000018'::uuid, 'en', 'File Handling',          'Reading and writing files using open() function and context managers.',                  TRUE, 'source'),
('c0000000-0000-0000-0000-000000000019'::uuid, 'en', 'Arrays',                 'Contiguous memory structures storing elements of same type with constant-time access.', TRUE, 'source'),
('c0000000-0000-0000-0000-000000000020'::uuid, 'en', 'Linked Lists',           'Node-based structures with data and next pointer for dynamic memory allocation.',        TRUE, 'source'),
('c0000000-0000-0000-0000-000000000021'::uuid, 'en', 'Big O Notation',         'Mathematical notation describing algorithm time and space complexity.',                  TRUE, 'source'),
('c0000000-0000-0000-0000-000000000022'::uuid, 'en', 'Stacks',                 'LIFO (Last-In-First-Out) data structure with push and pop operations.',                  TRUE, 'source'),
('c0000000-0000-0000-0000-000000000023'::uuid, 'en', 'Queues',                 'FIFO (First-In-First-Out) data structure with enqueue and dequeue operations.',          TRUE, 'source'),
('c0000000-0000-0000-0000-000000000024'::uuid, 'en', 'Binary Trees',           'Hierarchical structure where each node has at most two children.',                       TRUE, 'source'),
('c0000000-0000-0000-0000-000000000025'::uuid, 'en', 'Binary Search Trees',    'Binary trees maintaining sorted order for efficient O(log n) searching.',                TRUE, 'source'),
('c0000000-0000-0000-0000-000000000026'::uuid, 'en', 'Hash Tables',            'Data structure using hash functions for constant-time average lookup.',                  TRUE, 'source'),
('c0000000-0000-0000-0000-000000000027'::uuid, 'en', 'Sorting Algorithms',     'Algorithms for arranging data in order, including quicksort and mergesort.',             TRUE, 'source'),
('c0000000-0000-0000-0000-000000000028'::uuid, 'en', 'Binary Search',          'Efficient O(log n) search algorithm on sorted arrays.',                                  TRUE, 'source'),
('c0000000-0000-0000-0000-000000000029'::uuid, 'en', 'Graph Traversal',        'Algorithms like DFS and BFS for visiting graph vertices.',                               TRUE, 'source'),
('c0000000-0000-0000-0000-000000000030'::uuid, 'en', 'Graphs',                 'Vertices connected by edges, can be directed or undirected.',                            TRUE, 'source'),
('c0000000-0000-0000-0000-000000000031'::uuid, 'en', 'Databases',              'Organized collections of structured data stored electronically.',                        TRUE, 'source'),
('c0000000-0000-0000-0000-000000000032'::uuid, 'en', 'Relational Databases',   'Data organized into tables with rows and columns, linked by keys.',                      TRUE, 'source'),
('c0000000-0000-0000-0000-000000000033'::uuid, 'en', 'SQL',                    'Structured Query Language for relational database operations.',                          TRUE, 'source'),
('c0000000-0000-0000-0000-000000000034'::uuid, 'en', 'Normalization',          'Process of organizing data to reduce redundancy and improve integrity.',                 TRUE, 'source'),
('c0000000-0000-0000-0000-000000000035'::uuid, 'en', 'Transactions',           'Sequences of database operations executed as single logical units with ACID properties.',TRUE, 'source'),
('c0000000-0000-0000-0000-000000000036'::uuid, 'en', 'ACID Properties',        'Atomicity, Consistency, Isolation, and Durability for reliable transactions.',           TRUE, 'source'),
('c0000000-0000-0000-0000-000000000037'::uuid, 'en', 'Database Indexes',       'Auxiliary structures enabling faster data retrieval at cost of storage.',                TRUE, 'source'),
('c0000000-0000-0000-0000-000000000038'::uuid, 'en', 'NoSQL Databases',        'Non-relational databases including document, key-value, and graph stores.',              TRUE, 'source'),
('c0000000-0000-0000-0000-000000000039'::uuid, 'en', 'Query Optimization',     'Analyzing execution plans to choose efficient database access paths.',                   TRUE, 'source'),
('c0000000-0000-0000-0000-000000000040'::uuid, 'en', 'Primary Keys',           'Unique identifiers for table rows in relational databases.',                             TRUE, 'source'),
('c0000000-0000-0000-0000-000000000041'::uuid, 'en', 'Newton''s Laws',          'Three fundamental laws describing motion and forces.',                                   TRUE, 'source'),
('c0000000-0000-0000-0000-000000000042'::uuid, 'en', 'Kinematics',             'Study of motion without considering forces: position, velocity, acceleration.',          TRUE, 'source'),
('c0000000-0000-0000-0000-000000000043'::uuid, 'en', 'Dynamics',               'Study of forces and their effects on motion.',                                           TRUE, 'source'),
('c0000000-0000-0000-0000-000000000044'::uuid, 'en', 'F = ma',                 'Newton''s second law: force equals mass times acceleration.',                             TRUE, 'source'),
('c0000000-0000-0000-0000-000000000045'::uuid, 'en', 'Kinetic Energy',         'Energy of motion, calculated as 1/2 mv².',                                               TRUE, 'source'),
('c0000000-0000-0000-0000-000000000046'::uuid, 'en', 'Potential Energy',       'Stored energy due to position or configuration.',                                        TRUE, 'source'),
('c0000000-0000-0000-0000-000000000047'::uuid, 'en', 'Conservation of Energy', 'Total mechanical energy remains constant in isolated systems.',                          TRUE, 'source'),
('c0000000-0000-0000-0000-000000000048'::uuid, 'en', 'Momentum',               'Product of mass and velocity, conserved in isolated systems.',                           TRUE, 'source'),
('c0000000-0000-0000-0000-000000000049'::uuid, 'en', 'Rotational Motion',      'Motion of objects rotating about an axis with angular quantities.',                      TRUE, 'source'),
('c0000000-0000-0000-0000-000000000050'::uuid, 'en', 'Universal Gravitation',  'Attractive force between masses, proportional to product of masses.',                    TRUE, 'source')
ON CONFLICT (concept_id, language) DO NOTHING;


INSERT INTO procedure_details (
  id,
  concept_id,
  expected_duration_minutes,
  stored_in_neo4j
) VALUES (
  '12000000-0000-0000-0000-000000000001'::uuid,
  'c0000000-0000-0000-0000-000000000005'::uuid,
  45,
  FALSE
)
ON CONFLICT (concept_id) DO NOTHING;

INSERT INTO procedure_translations (
  procedure_id,
  language,
  purpose,
  preconditions,
  failure_modes,
  verification_checks,
  steps,
  is_primary,
  created_by,
  translation_quality
) VALUES (
  '12000000-0000-0000-0000-000000000001'::uuid,
  'en',
  'Train a neural network by pushing prediction errors backward and updating parameters.',
  '[{"item":"Differentiable model","description":"The network must support gradient computation."},{"item":"Loss function","description":"A measurable training objective must be defined."}]'::jsonb,
  '[{"mode":"Vanishing gradients","symptoms":"Early layers barely change during training.","fix":"Use better initialization or activation choices."}]'::jsonb,
  '[{"check":"Loss decreases over repeated batches","expected_result":"The optimization loop trends downward instead of oscillating wildly."}]'::jsonb,
  '[
    {"index":1,"action":"Run a forward pass","detail":"Compute predictions for the current training batch.","expected_result":"The model produces outputs that can be compared with targets."},
    {"index":2,"action":"Measure the loss","detail":"Evaluate the difference between predictions and target labels.","expected_result":"A scalar error value is available for optimization."},
    {"index":3,"action":"Backpropagate gradients","detail":"Propagate the loss backward through each layer to compute parameter gradients.","expected_result":"Each trainable weight receives a gradient."},
    {"index":4,"action":"Update the weights","detail":"Apply gradient descent to move parameters in the error-reducing direction.","expected_result":"The model is ready for the next iteration with improved weights."}
  ]'::jsonb,
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
)
ON CONFLICT (procedure_id, language) DO NOTHING;


INSERT INTO concept_sources (concept_id, source_id, created_by) VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000006'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000007'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000008'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000009'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000010'::uuid, 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000011'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000012'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000013'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000014'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000015'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000016'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000017'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000018'::uuid, 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000019'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000020'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000021'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000022'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000023'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000024'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000025'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000026'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000027'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000028'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000029'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000030'::uuid, 'a0000000-0000-0000-0000-000000000103'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000031'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000032'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000033'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000034'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000035'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000036'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000037'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000038'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000039'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000040'::uuid, 'a0000000-0000-0000-0000-000000000104'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000041'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000042'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000043'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000044'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000045'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000046'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000047'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000048'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000049'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000050'::uuid, 'a0000000-0000-0000-0000-000000000105'::uuid, '00000000-0000-0000-0000-000000000003'::uuid)
ON CONFLICT (concept_id, source_id) DO NOTHING;


INSERT INTO concept_relationships (relationship_id, source_concept_id, target_concept_id, strength, created_by) VALUES
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 0.95, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000015'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 0.80, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000007'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000008'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000009'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000043'::uuid, 'c0000000-0000-0000-0000-000000000009'::uuid, 'c0000000-0000-0000-0000-000000000010'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000043'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000009'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000012'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000013'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000014'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000015'::uuid, 0.80, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000016'::uuid, 0.75, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000017'::uuid, 0.70, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000018'::uuid, 0.75, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000021'::uuid, 'c0000000-0000-0000-0000-000000000019'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000021'::uuid, 'c0000000-0000-0000-0000-000000000020'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000022'::uuid, 'c0000000-0000-0000-0000-000000000019'::uuid, 0.80, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000023'::uuid, 'c0000000-0000-0000-0000-000000000020'::uuid, 0.75, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000024'::uuid, 'c0000000-0000-0000-0000-000000000025'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000025'::uuid, 'c0000000-0000-0000-0000-000000000028'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000021'::uuid, 'c0000000-0000-0000-0000-000000000027'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000030'::uuid, 'c0000000-0000-0000-0000-000000000029'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000026'::uuid, 'c0000000-0000-0000-0000-000000000027'::uuid, 0.75, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000031'::uuid, 'c0000000-0000-0000-0000-000000000032'::uuid, 0.95, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000032'::uuid, 'c0000000-0000-0000-0000-000000000033'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000032'::uuid, 'c0000000-0000-0000-0000-000000000034'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000032'::uuid, 'c0000000-0000-0000-0000-000000000040'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000035'::uuid, 'c0000000-0000-0000-0000-000000000036'::uuid, 0.95, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000032'::uuid, 'c0000000-0000-0000-0000-000000000037'::uuid, 0.80, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000031'::uuid, 'c0000000-0000-0000-0000-000000000038'::uuid, 0.75, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000037'::uuid, 'c0000000-0000-0000-0000-000000000039'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000041'::uuid, 'c0000000-0000-0000-0000-000000000042'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000041'::uuid, 'c0000000-0000-0000-0000-000000000043'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000015'::uuid, 'c0000000-0000-0000-0000-000000000041'::uuid, 'c0000000-0000-0000-0000-000000000044'::uuid, 0.95, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000043'::uuid, 'c0000000-0000-0000-0000-000000000045'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000043'::uuid, 'c0000000-0000-0000-0000-000000000046'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000045'::uuid, 'c0000000-0000-0000-0000-000000000047'::uuid, 0.80, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000043'::uuid, 'c0000000-0000-0000-0000-000000000048'::uuid, 0.90, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000041'::uuid, 'c0000000-0000-0000-0000-000000000049'::uuid, 0.75, '00000000-0000-0000-0000-000000000003'::uuid),
('10000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000043'::uuid, 'c0000000-0000-0000-0000-000000000050'::uuid, 0.85, '00000000-0000-0000-0000-000000000003'::uuid)
ON CONFLICT (relationship_id, source_concept_id, target_concept_id) DO NOTHING;

INSERT INTO relationship_sources (relationship_id, source_id, created_by)
SELECT cr.id,
       'a0000000-0000-0000-0000-000000000101'::uuid,
       '00000000-0000-0000-0000-000000000003'::uuid
FROM concept_relationships cr
WHERE cr.source_concept_id IN (
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'c0000000-0000-0000-0000-000000000002'::uuid,
    'c0000000-0000-0000-0000-000000000003'::uuid,
    'c0000000-0000-0000-0000-000000000005'::uuid,
    'c0000000-0000-0000-0000-000000000007'::uuid,
    'c0000000-0000-0000-0000-000000000009'::uuid
)
ON CONFLICT (relationship_id, source_id) DO NOTHING;

INSERT INTO relationship_sources (relationship_id, source_id, created_by)
SELECT cr.id,
       'a0000000-0000-0000-0000-000000000102'::uuid,
       '00000000-0000-0000-0000-000000000003'::uuid
FROM concept_relationships cr
WHERE cr.source_concept_id IN (
    'c0000000-0000-0000-0000-000000000011'::uuid,
    'c0000000-0000-0000-0000-000000000014'::uuid
)
ON CONFLICT (relationship_id, source_id) DO NOTHING;

INSERT INTO relationship_sources (relationship_id, source_id, created_by)
SELECT cr.id,
       'a0000000-0000-0000-0000-000000000103'::uuid,
       '00000000-0000-0000-0000-000000000003'::uuid
FROM concept_relationships cr
WHERE cr.source_concept_id IN (
    'c0000000-0000-0000-0000-000000000021'::uuid,
    'c0000000-0000-0000-0000-000000000022'::uuid,
    'c0000000-0000-0000-0000-000000000023'::uuid,
    'c0000000-0000-0000-0000-000000000024'::uuid,
    'c0000000-0000-0000-0000-000000000025'::uuid,
    'c0000000-0000-0000-0000-000000000026'::uuid,
    'c0000000-0000-0000-0000-000000000030'::uuid
)
ON CONFLICT (relationship_id, source_id) DO NOTHING;

INSERT INTO relationship_sources (relationship_id, source_id, created_by)
SELECT cr.id,
       'a0000000-0000-0000-0000-000000000104'::uuid,
       '00000000-0000-0000-0000-000000000003'::uuid
FROM concept_relationships cr
WHERE cr.source_concept_id IN (
    'c0000000-0000-0000-0000-000000000031'::uuid,
    'c0000000-0000-0000-0000-000000000032'::uuid,
    'c0000000-0000-0000-0000-000000000035'::uuid,
    'c0000000-0000-0000-0000-000000000037'::uuid
)
ON CONFLICT (relationship_id, source_id) DO NOTHING;

INSERT INTO relationship_sources (relationship_id, source_id, created_by)
SELECT cr.id,
       'a0000000-0000-0000-0000-000000000105'::uuid,
       '00000000-0000-0000-0000-000000000003'::uuid
FROM concept_relationships cr
WHERE cr.source_concept_id IN (
    'c0000000-0000-0000-0000-000000000041'::uuid,
    'c0000000-0000-0000-0000-000000000043'::uuid,
    'c0000000-0000-0000-0000-000000000045'::uuid
)
ON CONFLICT (relationship_id, source_id) DO NOTHING;


INSERT INTO tags (id, user_id, name, url_id, description, color, icon, is_system, usage_count, created_at) VALUES
('d0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Machine Learning', 'machine-learning', 'Topics related to machine learning and AI', '#3B82F6', 'brain', FALSE, 2, NOW() - INTERVAL '7 days'),
('d0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Demo',             'demo',              'Demo content for testing',                  '#EAB308', 'star',  FALSE, 2, NOW() - INTERVAL '6 days'),
('d0000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Networking',    'networking',    'Computer networking topics',         '#6366f1', 'network',    FALSE, 0, NOW() - INTERVAL '5 days'),
('d0000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Programming',   'programming',   'Programming and software concepts',  '#10b981', 'code',       FALSE, 0, NOW() - INTERVAL '4 days'),
('d0000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Formula',       'formula',       'Key formulas and equations',         '#ef4444', 'calculator', FALSE, 0, NOW() - INTERVAL '3 days'),
('d0000000-0000-0000-0000-000000000013'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Concept',       'concept',       'Core concepts and definitions',      '#14b8a6', 'lightbulb',  FALSE, 0, NOW() - INTERVAL '2 days'),
('d0000000-0000-0000-0000-000000000015'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Hard',          'hard',          'Difficult items needing extra review','#dc2626', 'flame',      FALSE, 0, NOW() - INTERVAL '1 day'),
('d0000000-0000-0000-0000-000000000017'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'Algorithm',     'algorithm',     'Algorithm and complexity topics',    '#8b5cf6', 'cpu',        FALSE, 0, NOW())
ON CONFLICT (user_id, url_id) DO NOTHING;

INSERT INTO tag_applications (tag_id, entity_type, entity_id, applied_by) VALUES
('d0000000-0000-0000-0000-000000000001'::uuid, 'source', 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000002'::uuid, 'source', 'a0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000011'::uuid, 'source', 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000013'::uuid, 'source', 'a0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000001'::uuid, 'diagram', '10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000002'::uuid, 'diagram', '10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000017'::uuid, 'diagram', '10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000015'::uuid, 'diagram', '10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000011'::uuid, 'diagram', '10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000001'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000001'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000017'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000015'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000012'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000012'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000011'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000013'::uuid, 'concept', 'c0000000-0000-0000-0000-000000000014'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000010'::uuid, 'flashcard', '00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000010'::uuid, 'flashcard', '00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000013'::uuid, 'flashcard', '00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000011'::uuid, 'flashcard', '00000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000012'::uuid, 'flashcard', '00000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000015'::uuid, 'flashcard', '55555555-5555-5555-5555-555555555555'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000011'::uuid, 'flashcard', '66666666-6666-6666-6666-666666666666'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000017'::uuid, 'flashcard', '77777777-7777-7777-7777-777777777777'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('d0000000-0000-0000-0000-000000000015'::uuid, 'flashcard', '88888888-8888-8888-8888-888888888888'::uuid, '00000000-0000-0000-0000-000000000003'::uuid)
ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING;

UPDATE tags SET usage_count = (
    SELECT COUNT(*) FROM tag_applications WHERE tag_id = tags.id
)
WHERE id IN (
    'd0000000-0000-0000-0000-000000000001'::uuid,
    'd0000000-0000-0000-0000-000000000002'::uuid,
    'd0000000-0000-0000-0000-000000000010'::uuid,
    'd0000000-0000-0000-0000-000000000011'::uuid,
    'd0000000-0000-0000-0000-000000000012'::uuid,
    'd0000000-0000-0000-0000-000000000013'::uuid,
    'd0000000-0000-0000-0000-000000000015'::uuid,
    'd0000000-0000-0000-0000-000000000017'::uuid
);

INSERT INTO concept_subjects (concept_id, subject_id, relevance, exam_board, module_key, created_by) VALUES
('c0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000003'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000005'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000006'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000007'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000008'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000009'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000010'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid, 'core',         'IVE',   'AI-ML',       '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 'supplementary','HKDSE', 'Elective-D',  '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 'supplementary','HKDSE', 'Elective-D',  '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid, 'core',         NULL,    'AI',          '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000006'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid, 'extended',     NULL,    'Statistics',  '00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000009'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid, 'core',         NULL,    'Optimization','00000000-0000-0000-0000-000000000003'::uuid),
('c0000000-0000-0000-0000-000000000010'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid, 'core',         NULL,    'Optimization','00000000-0000-0000-0000-000000000003'::uuid)
ON CONFLICT (concept_id, subject_id) DO NOTHING;

INSERT INTO source_subjects (source_id, subject_id) VALUES
('a0000000-0000-0000-0000-000000000101'::uuid, 'e0000000-0000-0000-0000-00000000000d'::uuid),
('a0000000-0000-0000-0000-000000000101'::uuid, 'e0000000-0000-0000-0000-00000000000e'::uuid)
ON CONFLICT (source_id, subject_id) DO NOTHING;


INSERT INTO classes (id, teacher_id, code, name, description) VALUES
('d1000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 'CS101',
 'Data Structures',
 'Fall 2024 - Introduction to Data Structures')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, teacher_id, code, name, description) VALUES
('d1000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 'CS201',
 'Algorithms Studio',
 'Spring 2025 - Algorithm drills and performance analysis')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, teacher_id, code, name, description) VALUES
('d1000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 'MATH301',
 'Linear Algebra',
 'Spring 2025 - Vectors, matrices, eigenvalues and applications')
ON CONFLICT (id) DO NOTHING;

INSERT INTO classes (id, teacher_id, code, name, description) VALUES
('d1000000-0000-0000-0000-000000000004'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 'WEB100',
 'Web Development',
 'Fall 2025 - HTML, CSS, JavaScript and React fundamentals')
ON CONFLICT (id) DO NOTHING;

INSERT INTO class_enrollments (class_id, student_id, status) VALUES
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000008'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO class_enrollments (class_id, student_id, status) VALUES
('d1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000008'::uuid, 'active'),
('d1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'active')
ON CONFLICT DO NOTHING;


INSERT INTO learning_paths (
  id,
  target_concept_id,
  created_by,
  user_id,
  status,
  source,
  metadata,
  created_at,
  updated_at
) VALUES
(
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'c0000000-0000-0000-0000-000000000009'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'active',
  'ai',
  '{"goal":"repair calculus fluency","estimated_sessions":4,"focus_topics":["chain rule","log differentiation","definite integrals"]}'::jsonb,
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '1 day'
),
(
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'c0000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'active',
  'manual',
  '{"goal":"stabilize probability review","estimated_sessions":3,"focus_topics":["binomial setup","union vs intersection","parameter reading"]}'::jsonb,
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '12 hours'
),
(
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'c0000000-0000-0000-0000-000000000021'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'active',
  'manual',
  '{"goal":"strengthen function reasoning","estimated_sessions":2,"focus_topics":["domain and range","composition order","graph interpretation"]}'::jsonb,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '6 hours'
),
(
  'd2000000-0000-0000-0000-000000000010'::uuid,
  'c0000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'active',
  'ai',
  '{"goal":"understand neural network training order","estimated_sessions":3,"focus_topics":["loss function","gradient descent","backpropagation"]}'::jsonb,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO learning_path_translations (
  learning_path_id,
  language,
  title,
  description,
  is_primary,
  created_by,
  translation_quality
) VALUES
(
  'd2000000-0000-0000-0000-000000000001'::uuid,
  'en',
  'Calculus Repair Sprint',
  'A short recovery path for the demo student focused on derivative mechanics, logarithmic forms, and integral review.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
),
(
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'en',
  'Probability Confidence Builder',
  'A compact path that reinforces reading probabilities correctly before moving into multi-step counting and union problems.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
),
(
  'd2000000-0000-0000-0000-000000000003'::uuid,
  'en',
  'Function Range Tune-Up',
  'A short path for spotting output bounds, function composition order, and common graph-reading slips.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
),
(
  'd2000000-0000-0000-0000-000000000010'::uuid,
  'en',
  'Model Training Foundations',
  'A guided path from defining loss to updating weights during neural network training.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
)
ON CONFLICT (learning_path_id, language) DO NOTHING;

INSERT INTO learning_path_steps (
  id,
  path_id,
  concept_id,
  step_order,
  is_required,
  estimated_time_minutes,
  rationale
) VALUES
(
  9101,
  'd2000000-0000-0000-0000-000000000010'::uuid,
  'c0000000-0000-0000-0000-000000000010'::uuid,
  1,
  TRUE,
  15,
  'Start with the objective function so later optimization steps have a clear target.'
),
(
  9102,
  'd2000000-0000-0000-0000-000000000010'::uuid,
  'c0000000-0000-0000-0000-000000000009'::uuid,
  2,
  TRUE,
  20,
  'Use the loss signal to understand how parameter updates should be computed.'
),
(
  9103,
  'd2000000-0000-0000-0000-000000000010'::uuid,
  'c0000000-0000-0000-0000-000000000005'::uuid,
  3,
  TRUE,
  25,
  'Finish with the full backward-pass procedure that makes the optimization loop practical.'
)
ON CONFLICT (path_id, step_order) DO NOTHING;

INSERT INTO learning_path_step_translations (
  step_id,
  language,
  notes,
  is_primary,
  created_by,
  translation_quality
) VALUES
(
  9101,
  'en',
  'Define what the model is trying to minimize before discussing how training changes weights.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
),
(
  9102,
  'en',
  'Treat gradient descent as the bridge between measured error and practical parameter updates.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
),
(
  9103,
  'en',
  'Place backpropagation last so the learner sees it as the mechanism that powers the gradient-based update loop.',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  'user_verified'
)
ON CONFLICT (step_id, language) DO NOTHING;

INSERT INTO assignments (
  id, class_id, teacher_id, title, description, assignment_type, due_at
) VALUES
(
  'd3000000-0000-0000-0000-000000000001'::uuid,
  'd1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Array vs Linked List Comparison',
  'Write a short essay comparing arrays and linked lists. Cover time complexity for insert, delete, and access operations. Include real-world use cases for each.',
  'text',
  NOW() + INTERVAL '3 days'
),
(
  'd3000000-0000-0000-0000-000000000002'::uuid,
  'd1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Stack Overflow Analysis',
  'Explain what causes stack overflow errors. Provide two code examples (one recursive, one iterative) and describe how to fix them.',
  'text',
  NOW() + INTERVAL '5 days'
),
(
  'd3000000-0000-0000-0000-000000000003'::uuid,
  'd1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Binary Tree Script Kill',
  'Complete the Script Kill challenge on binary tree traversals. Work through the mystery scenario and answer all knowledge checkpoints.',
  'script',
  NOW() + INTERVAL '7 days'
),
(
  'd3000000-0000-0000-0000-000000000004'::uuid,
  'd1000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Hash Table Fundamentals Quiz',
  'A quiz covering hash functions, collision resolution strategies, and load factor analysis.',
  'quiz',
  NOW() + INTERVAL '10 days'
),
(
  'd3000000-0000-0000-0000-000000000005'::uuid,
  'd1000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Greedy vs Dynamic Programming',
  'Explain where greedy solutions fail and compare them with a dynamic programming approach. Use the coin change problem as your example.',
  'text',
  NOW() + INTERVAL '2 days'
),
(
  'd3000000-0000-0000-0000-000000000006'::uuid,
  'd1000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Sorting Algorithm Script Kill',
  'Play through the sorting algorithm mystery. Identify which sorting strategy fits each scenario.',
  'script',
  NOW() + INTERVAL '4 days'
),
(
  'd3000000-0000-0000-0000-000000000007'::uuid,
  'd1000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Recurrence Relations Quiz',
  'Solve recurrence relations using the Master Theorem and substitution method.',
  'quiz',
  NOW() + INTERVAL '6 days'
)
ON CONFLICT (id) DO NOTHING;


INSERT INTO friendships (user_id, friend_id, status, requested_by, accepted_at, created_at) VALUES
('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'accepted', '00000000-0000-0000-0000-000000000004'::uuid, NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days'),
('00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'accepted', '00000000-0000-0000-0000-000000000004'::uuid, NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days'),
('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'accepted', '00000000-0000-0000-0000-000000000003'::uuid, NOW() - INTERVAL '3 days', NOW() - INTERVAL '4 days'),
('00000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'accepted', '00000000-0000-0000-0000-000000000003'::uuid, NOW() - INTERVAL '3 days', NOW() - INTERVAL '4 days'),
('00000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'pending', '00000000-0000-0000-0000-000000000006'::uuid, NULL, NOW() - INTERVAL '1 day')
ON CONFLICT (user_id, friend_id) DO NOTHING;


INSERT INTO chat_rooms (
  id, name, room_type, is_private, created_by, member_count,
  last_message_at, last_message_preview, created_at
) VALUES (
  'f1000000-0000-0000-0000-000000000001'::uuid,
  'Alice Chan',
  'direct',
  TRUE,
  '00000000-0000-0000-0000-000000000004'::uuid,
  2,
  NOW() - INTERVAL '1 hour',
  'Alice Chan: See you tomorrow!',
  NOW() - INTERVAL '7 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role, joined_at) VALUES
('f1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'member', NOW() - INTERVAL '7 days'),
('f1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member', NOW() - INTERVAL '7 days')
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO chat_rooms (
  id, name, room_type, is_private, created_by, member_count,
  last_message_at, last_message_preview, created_at
) VALUES (
  'f1000000-0000-0000-0000-000000000002'::uuid,
  'ML Study Group',
  'group',
  TRUE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  3,
  NOW() - INTERVAL '30 minutes',
  'Bob Wong: See you at the study session!',
  NOW() - INTERVAL '10 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role, joined_at) VALUES
('f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'owner', NOW() - INTERVAL '10 days'),
('f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member', NOW() - INTERVAL '10 days'),
('f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member', NOW() - INTERVAL '9 days')
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO chat_rooms (
  id, name, description, room_type, is_private, created_by, member_count,
  last_message_at, last_message_preview, created_at
) VALUES (
  'f1000000-0000-0000-0000-000000000003'::uuid,
  'CS101 Data Structures',
  'Fall 2024 - Introduction to Data Structures',
  'class',
  FALSE,
  '00000000-0000-0000-0000-000000000002'::uuid,
  4,
  NOW() - INTERVAL '1 hour',
  'Demo Teacher: Assignment 3 is due next Monday',
  NOW() - INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role, joined_at) VALUES
('f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'owner', NOW() - INTERVAL '30 days'),
('f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'member', NOW() - INTERVAL '30 days'),
('f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member', NOW() - INTERVAL '30 days'),
('f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member', NOW() - INTERVAL '28 days')
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO chat_rooms (
  id, name, room_type, is_private, created_by, member_count,
  last_message_at, last_message_preview, created_at
) VALUES (
  'f1000000-0000-0000-0000-000000000004'::uuid,
  'CS Theory & Algorithms',
  'channel',
  FALSE,
  '00000000-0000-0000-0000-000000000009'::uuid,
  5,
  NOW() - INTERVAL '45 minutes',
  'Alice Chan: I used a different approach, happy to share!',
  NOW() - INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role, joined_at) VALUES
('f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'owner', NOW() - INTERVAL '30 days'),
('f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'member', NOW() - INTERVAL '28 days'),
('f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'member', NOW() - INTERVAL '30 days'),
('f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member', NOW() - INTERVAL '30 days'),
('f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member', NOW() - INTERVAL '28 days')
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO chat_rooms (
  id, name, description, room_type, is_private, created_by, member_count,
  last_message_at, last_message_preview, created_at
) VALUES (
  'f1000000-0000-0000-0000-000000000005'::uuid,
  'Machine Learning Society',
  'Discuss ML concepts, papers, and projects',
  'community',
  FALSE,
  '00000000-0000-0000-0000-000000000003'::uuid,
  6,
  NOW() - INTERVAL '2 hours',
  'Carol Lee: Has anyone tried fine-tuning LLMs?',
  NOW() - INTERVAL '60 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role, joined_at) VALUES
('f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'owner', NOW() - INTERVAL '60 days'),
('f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'member', NOW() - INTERVAL '58 days'),
('f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member', NOW() - INTERVAL '55 days'),
('f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member', NOW() - INTERVAL '50 days'),
('f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'member', NOW() - INTERVAL '45 days'),
('f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'member', NOW() - INTERVAL '40 days')
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO chat_rooms (
  id, name, room_type, is_private, created_by, member_count,
  last_message_at, last_message_preview, created_at
) VALUES (
  'f1000000-0000-0000-0000-000000000010'::uuid,
  'Frank Lam & Bob Wong',
  'mentorship', TRUE,
  '00000000-0000-0000-0000-000000000009'::uuid,
  2, NOW() - INTERVAL '1 day',
  'Let me know if you have questions about the graph traversal homework!',
  NOW() - INTERVAL '17 days'
), (
  'f1000000-0000-0000-0000-000000000011'::uuid,
  'Demo Teacher & David Chen',
  'mentorship', TRUE,
  '00000000-0000-0000-0000-000000000002'::uuid,
  2, NOW() - INTERVAL '2 days',
  'Great progress on the CNN paper review!',
  NOW() - INTERVAL '13 days'
), (
  'f1000000-0000-0000-0000-000000000012'::uuid,
  'Frank Lam & Demo Student',
  'mentorship', TRUE,
  '00000000-0000-0000-0000-000000000009'::uuid,
  2, NOW() - INTERVAL '6 days',
  'See you at the next session on heaps!',
  NOW() - INTERVAL '9 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role, joined_at) VALUES
('f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'owner', NOW() - INTERVAL '17 days'),
('f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member', NOW() - INTERVAL '17 days'),
('f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'owner', NOW() - INTERVAL '13 days'),
('f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'member', NOW() - INTERVAL '13 days'),
('f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'owner', NOW() - INTERVAL '9 days'),
('f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'member', NOW() - INTERVAL '9 days')
ON CONFLICT (room_id, user_id) DO NOTHING;


INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-000000000001'::uuid, 'f1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Hey Alice! Did you finish the lab assignment?', FALSE, NOW() - INTERVAL '3 hours'),
('f2000000-0000-0000-0000-000000000002'::uuid, 'f1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'Yeah! The sorting part was tricky but I got it working with merge sort.', FALSE, NOW() - INTERVAL '2 hours'),
('f2000000-0000-0000-0000-000000000003'::uuid, 'f1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'Want to compare solutions tomorrow at lunch?', FALSE, NOW() - INTERVAL '1.5 hours'),
('f2000000-0000-0000-0000-000000000004'::uuid, 'f1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'See you tomorrow!', FALSE, NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-000000000007'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Hey everyone! Anyone up for a study session this weekend?', FALSE, NOW() - INTERVAL '2 days'),
('f2000000-0000-0000-0000-000000000008'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'I''m in! I can bring my notes on CNNs.', FALSE, NOW() - INTERVAL '1 day 23 hours'),
('f2000000-0000-0000-0000-000000000009'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Perfect! How about Saturday 3pm at the library?', FALSE, NOW() - INTERVAL '1 day 20 hours'),
('f2000000-0000-0000-0000-00000000000a'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'Count me in! I''ve been struggling with backpropagation.', FALSE, NOW() - INTERVAL '1 day 19 hours'),
('f2000000-0000-0000-0000-00000000000b'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'I can help explain it — chain rule is the key!', FALSE, NOW() - INTERVAL '1 hour'),
('f2000000-0000-0000-0000-00000000000c'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'See you at the study session!', FALSE, NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-00000000000d'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'Welcome to CS101 Data Structures! This is our class chat room.', FALSE, NOW() - INTERVAL '7 days'),
('f2000000-0000-0000-0000-00000000000e'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Looking forward to the course!', FALSE, NOW() - INTERVAL '6 days 23 hours'),
('f2000000-0000-0000-0000-00000000000f'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'When is the first assignment due?', FALSE, NOW() - INTERVAL '5 days'),
('f2000000-0000-0000-0000-000000000010'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'Assignment 1 is due next Friday. Check the syllabus for details.', FALSE, NOW() - INTERVAL '4 days 22 hours'),
('f2000000-0000-0000-0000-000000000011'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'Thanks! Will there be a review session?', FALSE, NOW() - INTERVAL '4 days 21 hours'),
('f2000000-0000-0000-0000-000000000012'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'Assignment 3 is due next Monday', FALSE, NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-000000000013'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Anyone stuck on question 3 of the binary tree assignment?', FALSE, NOW() - INTERVAL '3 hours'),
('f2000000-0000-0000-0000-000000000014'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'Yeah the recursive traversal is confusing me too.', FALSE, NOW() - INTERVAL '2 hours'),
('f2000000-0000-0000-0000-000000000015'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'Try using post-order traversal. Process children before the parent node.', FALSE, NOW() - INTERVAL '1.5 hours'),
('f2000000-0000-0000-0000-000000000016'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Got it working! Thanks!', FALSE, NOW() - INTERVAL '1 hour'),
('f2000000-0000-0000-0000-000000000017'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'I used a different approach, happy to share!', FALSE, NOW() - INTERVAL '45 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-000000000018'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Welcome to the ML Community! Share your projects and ask questions.', FALSE, NOW() - INTERVAL '10 days'),
('f2000000-0000-0000-0000-000000000019'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'text', 'Just finished implementing a CNN from scratch!', FALSE, NOW() - INTERVAL '9 days'),
('f2000000-0000-0000-0000-00000000001a'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'That''s awesome! I''m working on sentiment analysis.', FALSE, NOW() - INTERVAL '8 days'),
('f2000000-0000-0000-0000-00000000001b'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Nice work everyone! Keep sharing.', FALSE, NOW() - INTERVAL '5 days'),
('f2000000-0000-0000-0000-00000000001c'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'text', 'Has anyone tried fine-tuning LLMs?', FALSE, NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-00000000001d'::uuid, 'f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'text', 'Hi Bob, how are you finding the graph theory module so far?', FALSE, NOW() - INTERVAL '5 days'),
('f2000000-0000-0000-0000-00000000001e'::uuid, 'f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'It''s interesting but BFS vs DFS still confuses me sometimes. When should I use which?', FALSE, NOW() - INTERVAL '5 days'),
('f2000000-0000-0000-0000-00000000001f'::uuid, 'f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'text', 'Good question! Use BFS when you need the shortest path in an unweighted graph. DFS is better for exploring all paths or detecting cycles.', FALSE, NOW() - INTERVAL '4 days'),
('f2000000-0000-0000-0000-000000000020'::uuid, 'f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'text', 'That makes sense. I''ll try implementing both for the adjacency list homework.', FALSE, NOW() - INTERVAL '3 days'),
('f2000000-0000-0000-0000-000000000021'::uuid, 'f1000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'text', 'Let me know if you have questions about the graph traversal homework!', FALSE, NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-000000000022'::uuid, 'f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'David, have you had a chance to read the ResNet paper I shared?', FALSE, NOW() - INTERVAL '7 days'),
('f2000000-0000-0000-0000-000000000023'::uuid, 'f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'text', 'Yes! The skip connections idea is really clever. I''m still wrapping my head around why they help with vanishing gradients.', FALSE, NOW() - INTERVAL '6 days'),
('f2000000-0000-0000-0000-000000000024'::uuid, 'f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'Think of it this way — the skip connection lets the gradient flow directly through the identity path, bypassing the layers that might squash it.', FALSE, NOW() - INTERVAL '5 days'),
('f2000000-0000-0000-0000-000000000025'::uuid, 'f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'text', 'Oh that clicks! I also started reviewing the CNN architecture paper you recommended.', FALSE, NOW() - INTERVAL '3 days'),
('f2000000-0000-0000-0000-000000000026'::uuid, 'f1000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'text', 'Great progress on the CNN paper review!', FALSE, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chat_messages (id, chat_room_id, user_id, message_type, content, is_encrypted, created_at) VALUES
('f2000000-0000-0000-0000-000000000027'::uuid, 'f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'text', 'Hey! Ready to dive into heaps this week? We covered binary trees last time.', FALSE, NOW() - INTERVAL '9 days'),
('f2000000-0000-0000-0000-000000000028'::uuid, 'f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'Yes! I practiced the tree traversals and feel more confident now. What''s the difference between a heap and a BST?', FALSE, NOW() - INTERVAL '8 days'),
('f2000000-0000-0000-0000-000000000029'::uuid, 'f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'text', 'Great question — a BST maintains left < parent < right ordering. A min-heap only guarantees parent <= children, so it''s weaker but allows O(1) access to the minimum.', FALSE, NOW() - INTERVAL '7 days'),
('f2000000-0000-0000-0000-00000000002a'::uuid, 'f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'text', 'That makes sense! So heaps are mainly used for priority queues?', FALSE, NOW() - INTERVAL '7 days'),
('f2000000-0000-0000-0000-00000000002b'::uuid, 'f1000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'text', 'Exactly — priority queues, heap sort, and finding k-th largest/smallest elements. See you at the next session on heaps!', FALSE, NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

UPDATE chat_rooms SET message_count = 4 WHERE id = 'f1000000-0000-0000-0000-000000000001'::uuid;
UPDATE chat_rooms SET message_count = 6 WHERE id = 'f1000000-0000-0000-0000-000000000002'::uuid;
UPDATE chat_rooms SET message_count = 6 WHERE id = 'f1000000-0000-0000-0000-000000000003'::uuid;
UPDATE chat_rooms SET message_count = 5 WHERE id = 'f1000000-0000-0000-0000-000000000004'::uuid;
UPDATE chat_rooms SET message_count = 5 WHERE id = 'f1000000-0000-0000-0000-000000000005'::uuid;
UPDATE chat_rooms SET message_count = 5 WHERE id = 'f1000000-0000-0000-0000-000000000010'::uuid;
UPDATE chat_rooms SET message_count = 5 WHERE id = 'f1000000-0000-0000-0000-000000000011'::uuid;
UPDATE chat_rooms SET message_count = 5 WHERE id = 'f1000000-0000-0000-0000-000000000012'::uuid;



INSERT INTO user_follows (follower_id, following_id) VALUES
('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid),
('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000005'::uuid),
('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000006'::uuid),
('00000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000007'::uuid),
('00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('00000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000005'::uuid),
('00000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000008'::uuid),
('00000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000009'::uuid),
('00000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
('00000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000007'::uuid),
('00000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000002'::uuid)
ON CONFLICT (follower_id, following_id) DO NOTHING;


INSERT INTO communities (id, name, url_id, description, community_type, color_theme, member_count, activity_score, created_by, created_at) VALUES
('c1000000-0000-0000-0000-000000000001'::uuid,
 'Machine Learning Society', 'ml-society',
 'A community for ML enthusiasts to share research, projects, and study resources.',
 'public', '#6366f1', 6, 320,
 '00000000-0000-0000-0000-000000000003'::uuid,
 NOW() - INTERVAL '30 days'),
('c1000000-0000-0000-0000-000000000002'::uuid,
 'CS Theory & Algorithms', 'cs-algorithms',
 'Deep dives into data structures, algorithms, and theoretical computer science.',
 'public', '#10b981', 5, 185,
 '00000000-0000-0000-0000-000000000009'::uuid,
 NOW() - INTERVAL '25 days'),
('c1000000-0000-0000-0000-000000000003'::uuid,
 'Physics Study Group', 'physics-study',
 'An invite-only group for serious physics students preparing for examinations.',
 'invite_only', '#f59e0b', 3, 90,
 '00000000-0000-0000-0000-000000000008'::uuid,
 NOW() - INTERVAL '20 days'),
('c1000000-0000-0000-0000-000000000004'::uuid,
 'Web Development Hub', 'web-dev-hub',
 'Share frontend and backend tips, frameworks, and project showcases. React, Node, Python, and more.',
 'public', '#3b82f6', 4, 150,
 '00000000-0000-0000-0000-000000000004'::uuid,
 NOW() - INTERVAL '18 days'),
('c1000000-0000-0000-0000-000000000005'::uuid,
 'Math & Statistics Circle', 'math-stats',
 'Probability, linear algebra, calculus, and statistical methods for CS and data science students.',
 'public', '#ef4444', 3, 95,
 '00000000-0000-0000-0000-000000000006'::uuid,
 NOW() - INTERVAL '14 days'),
('c1000000-0000-0000-0000-000000000006'::uuid,
 'Advanced Research Lab', 'research-lab',
 'A private research group for advanced students. Membership requires approval from an admin.',
 'private', '#8b5cf6', 3, 75,
 '00000000-0000-0000-0000-000000000005'::uuid,
 NOW() - INTERVAL '12 days')
ON CONFLICT (url_id) DO NOTHING;

UPDATE chat_rooms SET community_id = 'c1000000-0000-0000-0000-000000000001'::uuid
WHERE id = 'f1000000-0000-0000-0000-000000000005'::uuid;
UPDATE chat_rooms SET community_id = 'c1000000-0000-0000-0000-000000000002'::uuid
WHERE id = 'f1000000-0000-0000-0000-000000000004'::uuid;


INSERT INTO community_members (community_id, user_id, role, status, contribution_points, joined_at) VALUES
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'owner',     'active', 520, NOW() - INTERVAL '30 days'),
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'admin',     'active', 310, NOW() - INTERVAL '28 days'),
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'moderator', 'active', 240, NOW() - INTERVAL '25 days'),
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member',    'active', 130, NOW() - INTERVAL '20 days'),
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'member',    'active', 95,  NOW() - INTERVAL '15 days'),
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'member',    'active', 60,  NOW() - INTERVAL '10 days'),
('c1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'owner',     'active', 400, NOW() - INTERVAL '25 days'),
('c1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'admin',     'active', 280, NOW() - INTERVAL '22 days'),
('c1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member',    'active', 110, NOW() - INTERVAL '18 days'),
('c1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'member',    'active', 85,  NOW() - INTERVAL '12 days'),
('c1000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member',    'active', 45,  NOW() - INTERVAL '8 days'),
('c1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000008'::uuid, 'owner',     'active', 200, NOW() - INTERVAL '20 days'),
('c1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'moderator', 'active', 150, NOW() - INTERVAL '18 days'),
('c1000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'member',    'active', 80,  NOW() - INTERVAL '15 days'),
('c1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, 'owner',     'active', 280, NOW() - INTERVAL '18 days'),
('c1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'member',    'active', 120, NOW() - INTERVAL '14 days'),
('c1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'member',    'active', 90,  NOW() - INTERVAL '10 days'),
('c1000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000008'::uuid, 'member',    'active', 55,  NOW() - INTERVAL '7 days'),
('c1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000006'::uuid, 'owner',     'active', 180, NOW() - INTERVAL '14 days'),
('c1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'member',    'active', 100, NOW() - INTERVAL '11 days'),
('c1000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'member',    'active', 65,  NOW() - INTERVAL '8 days'),
('c1000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000005'::uuid, 'owner',     'active', 200, NOW() - INTERVAL '12 days'),
('c1000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, 'member',    'active', 90,  NOW() - INTERVAL '10 days'),
('c1000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000008'::uuid, 'member',    'active', 60,  NOW() - INTERVAL '8 days'),
('c1000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'pending',   'active', 0,   NOW() - INTERVAL '2 days')
ON CONFLICT (community_id, user_id) DO NOTHING;



INSERT INTO point_rules (id, point_type_id, action_type, points_awarded, daily_limit, description, is_active) VALUES
('a2000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid,
 'share_content',      10, 3,  'Earn points for sharing learning content with the community', TRUE),
('a2000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000001'::uuid,
 'content_liked',       5, 10, 'Earn points when others like your shared content', TRUE),
('a2000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'give_feedback',       8, 5,  'Earn points for providing peer feedback', TRUE),
('a2000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'feedback_helpful',   12, 5,  'Earn bonus points when your feedback is marked helpful', TRUE),
('a2000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'discussion_post',     5, 3,  'Earn points for starting a discussion thread', TRUE),
('a2000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'discussion_reply',    3, 10, 'Earn points for replying in discussions', TRUE),
('a2000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'answer_accepted',    20, 2,  'Earn points when your answer is accepted as the best reply', TRUE),
('a2000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000001'::uuid,
 'challenge_complete', 15, 2,  'Earn points for completing a community challenge', TRUE),
('a2000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid,
 'challenge_win',      50, 1,  'Bonus points for winning a challenge', TRUE),
('a2000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000001'::uuid,
 'daily_study',         5, 1,  'Earn points for daily study sessions', TRUE),
('a2000000-0000-0000-0000-000000000011'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'mentor_session',     25, 1,  'Earn points for completing a mentoring session', TRUE),
('a2000000-0000-0000-0000-000000000012'::uuid, '20000000-0000-0000-0000-000000000001'::uuid,
 'weekly_share',       20, 1,  'Bonus for sharing content every week', TRUE),
('a2000000-0000-0000-0000-000000000013'::uuid, '20000000-0000-0000-0000-000000000004'::uuid,
 'successful_invite',  15, 10, 'Earn points when someone you invited joins', TRUE)
ON CONFLICT DO NOTHING;


INSERT INTO user_points (id, user_id, point_type_id, points, action_type, rule_id, community_id, description, created_at) VALUES
('0b000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 5,  'discussion_post',  'a2000000-0000-0000-0000-000000000005'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Started discussion in ML Society', NOW()-INTERVAL '15 days'),
('0b000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 10, 'share_content',    'a2000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Shared ML flashcard deck', NOW()-INTERVAL '14 days'),
('0b000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 8,  'give_feedback',    'a2000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Provided peer feedback', NOW()-INTERVAL '13 days'),
('0b000001-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 12, 'feedback_helpful',  'a2000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Feedback marked helpful', NOW()-INTERVAL '12 days'),
('0b000001-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 12, 'feedback_helpful',  'a2000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Feedback marked helpful', NOW()-INTERVAL '11 days'),
('0b000001-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 12, 'feedback_helpful',  'a2000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Feedback marked helpful', NOW()-INTERVAL '10 days'),
('0b000001-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 12, 'feedback_helpful',  'a2000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Feedback marked helpful', NOW()-INTERVAL '9 days'),
('0b000001-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 12, 'feedback_helpful',  'a2000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Feedback marked helpful', NOW()-INTERVAL '8 days'),
('0b000001-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 20, 'answer_accepted',   'a2000000-0000-0000-0000-000000000007'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Answer accepted in ML Society', NOW()-INTERVAL '8 days'),
('0b000001-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 50, 'challenge_win',     'a2000000-0000-0000-0000-000000000009'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Won ML quiz challenge', NOW()-INTERVAL '7 days'),
('0b000001-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 25, 'mentor_session',    'a2000000-0000-0000-0000-000000000011'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Completed mentoring session', NOW()-INTERVAL '7 days'),
('0b000001-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '6 days'),
('0b000001-0000-0000-0000-000000000013'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '5 days'),
('0b000001-0000-0000-0000-000000000014'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '4 days'),
('0b000001-0000-0000-0000-000000000015'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '3 days'),
('0b000001-0000-0000-0000-000000000016'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '2 days'),
('0b000001-0000-0000-0000-000000000017'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '1 day'),
('0b000001-0000-0000-0000-000000000018'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()),
('0b000001-0000-0000-0000-000000000019'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 3,  'discussion_reply',  'a2000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Replied in ML Society discussion', NOW()-INTERVAL '14 days'),
('0b000001-0000-0000-0000-000000000020'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 8,  'give_feedback',     'a2000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Provided peer feedback', NOW()-INTERVAL '10 days'),
('0b000001-0000-0000-0000-000000000021'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 8,  'give_feedback',     'a2000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Provided peer feedback', NOW()-INTERVAL '9 days'),
('0b000001-0000-0000-0000-000000000022'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 10, 'share_content',     'a2000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Shared study notes', NOW()-INTERVAL '7 days'),
('0b000001-0000-0000-0000-000000000023'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 12, 'feedback_helpful',  'a2000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Feedback marked helpful', NOW()-INTERVAL '5 days'),
('0b000001-0000-0000-0000-000000000024'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 5,  'discussion_post',   'a2000000-0000-0000-0000-000000000005'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Started algorithms discussion', NOW()-INTERVAL '20 days'),
('0b000001-0000-0000-0000-000000000025'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 10, 'share_content',     'a2000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Shared algorithm notes', NOW()-INTERVAL '18 days'),
('0b000001-0000-0000-0000-000000000026'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 15, 'challenge_complete', 'a2000000-0000-0000-0000-000000000008'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Completed Algorithm Sprint', NOW()-INTERVAL '10 days'),
('0b000001-0000-0000-0000-000000000027'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 50, 'challenge_win',     'a2000000-0000-0000-0000-000000000009'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Won the Algorithm Sprint', NOW()-INTERVAL '8 days'),
('0b000001-0000-0000-0000-000000000028'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 25, 'mentor_session',    'a2000000-0000-0000-0000-000000000011'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Mentored a junior student', NOW()-INTERVAL '7 days'),
('0b000001-0000-0000-0000-000000000029'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 3,  'discussion_reply',  'a2000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Replied in algorithms discussion', NOW()-INTERVAL '5 days'),
('0b000001-0000-0000-0000-000000000030'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 3,  'discussion_reply',  'a2000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Replied in discussion', NOW()-INTERVAL '3 days'),
('0b000001-0000-0000-0000-000000000031'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '2 days'),
('0b000001-0000-0000-0000-000000000032'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '1 day'),
('0b000001-0000-0000-0000-000000000033'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 3,  'discussion_reply',  'a2000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Replied in discussion', NOW()-INTERVAL '1 day'),
('0b000001-0000-0000-0000-000000000034'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()),
('0b000001-0000-0000-0000-000000000035'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 10, 'share_content',     'a2000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Shared NLP notes', NOW()-INTERVAL '9 days'),
('0b000001-0000-0000-0000-000000000036'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 3,  'discussion_reply',  'a2000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Replied in discussion', NOW()-INTERVAL '5 days'),
('0b000001-0000-0000-0000-000000000037'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 8,  'give_feedback',     'a2000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Provided peer feedback', NOW()-INTERVAL '3 days'),
('0b000001-0000-0000-0000-000000000038'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 5,  'daily_study',       'a2000000-0000-0000-0000-000000000010'::uuid, NULL, 'Daily study session', NOW()-INTERVAL '1 day')
ON CONFLICT DO NOTHING;


INSERT INTO user_badges (id, user_id, badge_id, community_id, earned_at, show_on_profile) VALUES
('ab000001-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, NULL, NOW()-INTERVAL '15 days', TRUE),
('ab000001-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, NULL, NOW()-INTERVAL '14 days', TRUE),
('ab000001-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'b1000000-0000-0000-0000-000000000002'::uuid, NULL, NOW()-INTERVAL '8 days', TRUE),
('ab000001-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000002'::uuid, NULL, NOW()-INTERVAL '8 days', TRUE),
('ab000001-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000020'::uuid, NULL, NOW()-INTERVAL '7 days', TRUE),
('ab000001-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000010'::uuid, NULL, NOW()-INTERVAL '1 day', TRUE),
('ab000001-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'b1000000-0000-0000-0000-000000000006'::uuid, NULL, NOW()-INTERVAL '1 day', TRUE),
('ab000001-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, 'b1000000-0000-0000-0000-000000000008'::uuid, NULL, NOW()-INTERVAL '7 days', TRUE),
('ab000001-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, NULL, NOW()-INTERVAL '20 days', TRUE),
('ab000001-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, NULL, NOW()-INTERVAL '18 days', TRUE),
('ab000001-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'b1000000-0000-0000-0000-000000000008'::uuid, NULL, NOW()-INTERVAL '8 days', TRUE),
('ab000001-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '30000000-0000-0000-0000-000000000020'::uuid, NULL, NOW()-INTERVAL '7 days', TRUE),
('ab000001-0000-0000-0000-000000000013'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, '30000000-0000-0000-0000-000000000010'::uuid, NULL, NOW()-INTERVAL '2 days', TRUE),
('ab000001-0000-0000-0000-000000000014'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, 'b1000000-0000-0000-0000-000000000006'::uuid, NULL, NOW()-INTERVAL '2 days', TRUE),
('ab000001-0000-0000-0000-000000000015'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, NULL, NOW()-INTERVAL '7 days', TRUE),
('ab000001-0000-0000-0000-000000000016'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, '30000000-0000-0000-0000-000000000001'::uuid, NULL, NOW()-INTERVAL '9 days', TRUE)
ON CONFLICT (user_id, badge_id, community_id) DO NOTHING;


INSERT INTO user_streaks (user_id, streak_type, current_streak, longest_streak, last_activity_date, streak_started_at, current_multiplier) VALUES
('00000000-0000-0000-0000-000000000003'::uuid, 'daily_study',  7,  7, CURRENT_DATE, CURRENT_DATE - INTERVAL '6 days', 1.5),
('00000000-0000-0000-0000-000000000003'::uuid, 'weekly_share', 3,  3, CURRENT_DATE, CURRENT_DATE - INTERVAL '20 days', 1.0),
('00000000-0000-0000-0000-000000000009'::uuid, 'daily_study',  7,  7, CURRENT_DATE, CURRENT_DATE - INTERVAL '6 days', 1.5),
('00000000-0000-0000-0000-000000000007'::uuid, 'daily_study',  4,  8, CURRENT_DATE, CURRENT_DATE - INTERVAL '3 days', 1.0),
('00000000-0000-0000-0000-000000000004'::uuid, 'daily_study',  2,  5, CURRENT_DATE, CURRENT_DATE - INTERVAL '1 day',  1.0)
ON CONFLICT (user_id, streak_type) DO NOTHING;


INSERT INTO learning_activity_log (user_id, activity_type, sub_type, created_at) VALUES
('00000000-0000-0000-0000-000000000003'::uuid, 'flashcard',    'review',   CURRENT_DATE + TIME '09:30:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'error_review', 'complete', CURRENT_DATE - INTERVAL '1 day' + TIME '14:00:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '2 days' + TIME '10:15:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'quiz',         'complete', CURRENT_DATE - INTERVAL '2 days' + TIME '16:00:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'assignment',   'submit',   CURRENT_DATE - INTERVAL '3 days' + TIME '11:00:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '4 days' + TIME '08:45:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'feynman',      'practice', CURRENT_DATE - INTERVAL '4 days' + TIME '15:30:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'flashcard',    'create',   CURRENT_DATE - INTERVAL '5 days' + TIME '13:00:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'error_review', 'review',   CURRENT_DATE - INTERVAL '6 days' + TIME '10:00:00'),
('00000000-0000-0000-0000-000000000003'::uuid, 'challenge',    'attempt',  CURRENT_DATE - INTERVAL '6 days' + TIME '17:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE + TIME '08:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '1 day' + TIME '09:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'quiz',         'attempt',  CURRENT_DATE - INTERVAL '2 days' + TIME '10:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '3 days' + TIME '11:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'error_review', 'review',   CURRENT_DATE - INTERVAL '4 days' + TIME '12:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '5 days' + TIME '08:30:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'assignment',   'submit',   CURRENT_DATE - INTERVAL '6 days' + TIME '14:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '7 days' + TIME '09:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'feynman',      'create',   CURRENT_DATE - INTERVAL '8 days' + TIME '15:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '9 days' + TIME '10:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'quiz',         'complete', CURRENT_DATE - INTERVAL '10 days' + TIME '11:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '11 days' + TIME '08:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'error_review', 'complete', CURRENT_DATE - INTERVAL '12 days' + TIME '16:00:00'),
('00000000-0000-0000-0000-000000000009'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '13 days' + TIME '09:30:00'),
('00000000-0000-0000-0000-000000000007'::uuid, 'flashcard',    'review',   CURRENT_DATE + TIME '10:00:00'),
('00000000-0000-0000-0000-000000000007'::uuid, 'quiz',         'attempt',  CURRENT_DATE - INTERVAL '1 day' + TIME '14:00:00'),
('00000000-0000-0000-0000-000000000007'::uuid, 'flashcard',    'review',   CURRENT_DATE - INTERVAL '2 days' + TIME '11:00:00'),
('00000000-0000-0000-0000-000000000007'::uuid, 'error_review', 'review',   CURRENT_DATE - INTERVAL '3 days' + TIME '09:00:00'),
('00000000-0000-0000-0000-000000000004'::uuid, 'flashcard',    'review',   CURRENT_DATE + TIME '12:00:00'),
('00000000-0000-0000-0000-000000000004'::uuid, 'assignment',   'submit',   CURRENT_DATE - INTERVAL '1 day' + TIME '15:00:00');


INSERT INTO user_currency (user_id, balance, total_earned, total_spent) VALUES
('00000000-0000-0000-0000-000000000003'::uuid,  48,  448, 400),
('00000000-0000-0000-0000-000000000004'::uuid,  51,   51,   0),
('00000000-0000-0000-0000-000000000009'::uuid, 319,  319,   0),
('00000000-0000-0000-0000-000000000007'::uuid,  36,   36,   0)
ON CONFLICT (user_id) DO NOTHING;


INSERT INTO discussion_threads (id, community_id, user_id, title, content, thread_type, status,
    is_pinned, view_count, reply_count, like_count, is_answered, tags, created_at, last_activity_at) VALUES
('d4000000-0000-0000-0000-000000000001'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'Best resources for learning Transformers from scratch?',
 'I''ve been going through the "Attention is All You Need" paper but struggling with multi-head attention. Anyone have good tutorials or notebooks they recommend?',
 'question', 'open', FALSE, 142, 3, 18,
 TRUE, ARRAY['transformers', 'nlp', 'deep-learning'],
 NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 days'),
('d4000000-0000-0000-0000-000000000002'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 '[Announcement] Weekly ML Paper Reading Club - Every Thursday 7pm',
 'Starting this week we''ll have a virtual paper reading session every Thursday at 7pm HKT. This week: "LoRA: Low-Rank Adaptation of Large Language Models". Join via the community chat room.',
 'announcement', 'open', TRUE, 210, 1, 35,
 FALSE, ARRAY['announcement', 'paper-reading'],
 NOW() - INTERVAL '12 days', NOW() - INTERVAL '5 days'),
('d4000000-0000-0000-0000-000000000003'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'My CNN image classifier reached 94% accuracy on CIFAR-10!',
 'After 3 weeks of experiments I finally got 94.2% with ResNet-like architecture + data augmentation. Happy to share my notebook and the training tricks I used.',
 'discussion', 'open', FALSE, 88, 1, 22,
 FALSE, ARRAY['cnn', 'computer-vision', 'project-share'],
 NOW() - INTERVAL '9 days', NOW() - INTERVAL '1 day'),
('d4000000-0000-0000-0000-000000000004'::uuid,
 'c1000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Why does Dijkstra fail with negative edge weights?',
 'I keep seeing this stated as a fact but can''t find a clear counter-example. Can anyone show a concrete graph where Dijkstra gives wrong output with a negative edge?',
 'question', 'open', FALSE, 95, 1, 12,
 TRUE, ARRAY['graph', 'shortest-path', 'dijkstra'],
 NOW() - INTERVAL '18 days', NOW() - INTERVAL '4 days'),
('d4000000-0000-0000-0000-000000000005'::uuid,
 'c1000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid,
 'Help: My merge sort is slower than bubble sort on small arrays?',
 'For n < 10 my merge sort is consistently slower in benchmarks. Is this normal? Isn''t merge sort always O(n log n)?',
 'question', 'open', FALSE, 60, 1, 8,
 FALSE, ARRAY['sorting', 'complexity', 'benchmark'],
 NOW() - INTERVAL '6 days', NOW() - INTERVAL '2 hours'),
('d4000000-0000-0000-0000-000000000006'::uuid,
 'c1000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000008'::uuid,
 '[Closed] HKDSE Physics Exam Tips 2025 — Thread Closed',
 'This thread was archived after the exam. Use the new 2026 thread for current discussions.',
 'discussion', 'closed', FALSE, 310, 0, 45,
 FALSE, ARRAY['hkdse', 'exam-tips', 'archived'],
 NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;


INSERT INTO discussion_replies (id, thread_id, user_id, content, is_accepted, like_count, created_at) VALUES
('d3000000-0000-0000-0000-000000000001'::uuid,
 'd4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000004'::uuid,
 'Andrej Karpathy''s "Let''s build GPT from scratch" on YouTube is incredible for this. He codes attention from scratch in ~2 hours. Highly recommend watching before reading any other resources.',
 TRUE, 14, NOW() - INTERVAL '14 days'),
('d3000000-0000-0000-0000-000000000002'::uuid,
 'd4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'Also check out the "Illustrated Transformer" blog post by Jay Alammar. The visualizations make multi-head attention click immediately.',
 FALSE, 9, NOW() - INTERVAL '13 days'),
('d3000000-0000-0000-0000-000000000003'::uuid,
 'd4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid,
 'The Harvard NLP "Annotated Transformer" is the gold standard for understanding the paper implementation line by line.',
 FALSE, 6, NOW() - INTERVAL '12 days'),
('d3000000-0000-0000-0000-000000000004'::uuid,
 'd4000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'Sounds great! I''ll prepare some questions about the rank decomposition math. See everyone Thursday!',
 FALSE, 8, NOW() - INTERVAL '11 days'),
('d3000000-0000-0000-0000-000000000005'::uuid,
 'd4000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'That''s impressive! Did you use learning rate scheduling? I''ve been stuck at 89% and I think my LR decay is the issue.',
 FALSE, 5, NOW() - INTERVAL '8 days'),
('d3000000-0000-0000-0000-000000000006'::uuid,
 'd4000000-0000-0000-0000-000000000004'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'Classic counter-example: nodes A→B (weight 1), B→C (weight -3), A→C (weight 0). Dijkstra greedily picks A→C=0 first and never updates to A→B→C=-2. Bellman-Ford handles this correctly.',
 TRUE, 10, NOW() - INTERVAL '17 days'),
('d3000000-0000-0000-0000-000000000007'::uuid,
 'd4000000-0000-0000-0000-000000000005'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Yes, this is expected. O(n log n) is the asymptotic complexity. The constant factor from recursion and memory allocation dominates for tiny n. Insertion sort is O(n²) but has a tiny constant — that''s why hybrid algorithms like Timsort use insertion sort below a threshold (typically 64 elements).',
 FALSE, 7, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

UPDATE discussion_threads SET is_answered = TRUE, accepted_reply_id = 'd3000000-0000-0000-0000-000000000001'::uuid
WHERE id = 'd4000000-0000-0000-0000-000000000001'::uuid;
UPDATE discussion_threads SET is_answered = TRUE, accepted_reply_id = 'd3000000-0000-0000-0000-000000000006'::uuid
WHERE id = 'd4000000-0000-0000-0000-000000000004'::uuid;


INSERT INTO challenges (id, community_id, created_by, title, description, instructions,
    challenge_type, starts_at, ends_at, status, max_participants, participant_count,
    submission_count, rewards, created_at) VALUES
('c2000000-0000-0000-0000-000000000001'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'Explain Like I''m Five: Neural Networks',
 'Write the clearest possible explanation of how neural networks learn. Judged on clarity, accuracy, and creative use of analogies.',
 'Write a short essay (300-800 words) explaining how neural networks learn, aimed at someone with no ML background. Use analogies, examples, and simple language. Bonus for original diagrams described in text.',
 'teaching',
 NOW() - INTERVAL '20 days', NOW() + INTERVAL '10 days',
 'active', 20, 5, 2,
 '{"winner_points": 100, "participant_points": 25}'::jsonb,
 NOW() - INTERVAL '22 days'),
('c2000000-0000-0000-0000-000000000002'::uuid,
 'c1000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Algorithm Sprint: Shortest Path Showdown',
 'Solve 5 shortest-path problems as fast and elegantly as possible. Submit your solutions with time/space complexity analysis.',
 'Implement solutions to 5 graph problems. Each solution must include Big-O analysis and at least one test case. Extra points for multiple approaches.',
 'quiz',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days',
 'completed', 10, 4, 4,
 '{"winner_points": 50, "participant_points": 10}'::jsonb,
 NOW() - INTERVAL '12 days'),
('c2000000-0000-0000-0000-000000000003'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 'Teach a Concept: Overfitting vs Underfitting',
 'Explain the difference between overfitting and underfitting in machine learning. Use real-world analogies and describe how to detect and prevent each.',
 'Write a clear explanation (200-600 words) covering: what overfitting and underfitting are, a real-world analogy for each, how to detect them (training vs validation loss), and at least two techniques to prevent overfitting.',
 'teaching',
 NOW() - INTERVAL '2 days', NOW() + INTERVAL '12 days',
 'active', 30, 0, 0,
 '{"winner_points": 80, "participant_points": 20}'::jsonb,
 NOW() - INTERVAL '3 days'),
('c2000000-0000-0000-0000-000000000004'::uuid,
 'c1000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Debug the Bug: Find the Logic Error',
 'You are given a piece of pseudocode with a subtle logic error. Identify the bug, explain why it fails, and provide the corrected version with a test case.',
 'Read the pseudocode below and submit: (1) What the bug is, (2) A specific input that triggers the wrong output, (3) The corrected code, (4) Why your fix works.

Pseudocode:
function binarySearch(arr, target):
    low = 0
    high = length(arr)
    while low <= high:
        mid = (low + high) / 2
        if arr[mid] == target: return mid
        if arr[mid] < target: low = mid
        else: high = mid
    return -1',
 'quiz',
 NOW() - INTERVAL '1 day', NOW() + INTERVAL '14 days',
 'active', 20, 0, 0,
 '{"winner_points": 60, "participant_points": 15}'::jsonb,
 NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

UPDATE challenges SET judging_criteria = '[{"name": "Accuracy", "description": "Correctness of explanation", "weight": 30}, {"name": "Clarity", "description": "How easy to understand for a beginner", "weight": 30}, {"name": "Analogies", "description": "Quality and originality of real-world analogies", "weight": 20}, {"name": "Completeness", "description": "Covers detection and prevention techniques", "weight": 20}]'::jsonb
WHERE id = 'c2000000-0000-0000-0000-000000000003'::uuid;

UPDATE challenges SET judging_criteria = '[{"name": "Bug Identification", "description": "Correctly identifies the logic error", "weight": 30}, {"name": "Explanation", "description": "Clear reasoning for why the bug causes failure", "weight": 25}, {"name": "Test Case", "description": "Provides a concrete failing input/output", "weight": 20}, {"name": "Fix Quality", "description": "Corrected code is correct and clean", "weight": 25}]'::jsonb
WHERE id = 'c2000000-0000-0000-0000-000000000004'::uuid;

INSERT INTO challenge_participants (challenge_id, user_id, status, registered_at, submitted_at) VALUES
('c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'submitted', NOW() - INTERVAL '18 days', NOW() - INTERVAL '5 days'),
('c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 'submitted', NOW() - INTERVAL '15 days', NOW() - INTERVAL '4 days'),
('c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
 'registered', NOW() - INTERVAL '12 days', NULL),
('c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
 'registered', NOW() - INTERVAL '10 days', NULL),
('c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000006'::uuid,
 'registered', NOW() - INTERVAL '8 days', NULL),
('c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000009'::uuid,
 'submitted', NOW() - INTERVAL '9 days', NOW() - INTERVAL '4 days'),
('c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 'submitted', NOW() - INTERVAL '8 days', NOW() - INTERVAL '4 days'),
('c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
 'submitted', NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days'),
('c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'submitted', NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days')
ON CONFLICT (challenge_id, user_id) DO NOTHING;

INSERT INTO challenge_submissions (id, challenge_id, user_id, title, description, scores, final_score, rank, status, judge_feedback, submitted_at) VALUES
('c5000000-0000-0000-0000-000000000005'::uuid,
 'c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'Neural Networks: A Kitchen Analogy',
 'Imagine you''re teaching a robot to cook by tasting food. At first, it has no idea what "good" means — it just guesses randomly. You taste each dish and say "too salty" or "needs more spice."

The robot adjusts its recipe a tiny bit each time based on your feedback. After hundreds of dishes, it starts making food you actually enjoy. That''s basically how a neural network learns.

A neural network is made of layers of "neurons" — tiny decision-makers. The first layer looks at raw input (like pixels in a photo). Each neuron asks a simple question: "Is this bright? Is there an edge here?" Then it passes its answer to the next layer.

The middle layers (called "hidden layers") combine these simple answers into more complex patterns. Layer 2 might detect curves. Layer 3 might recognize eyes or wheels. Layer 4 puts it all together: "This looks like a cat."

But how does it learn? Through a process called backpropagation. When the network gets an answer wrong — say it called a dog a cat — the error flows backward through the layers. Each neuron adjusts its "weight" (how much it trusts each input) slightly to reduce the mistake. It''s like the robot chef adjusting salt, sugar, and spice knobs after each failed dish.

The key insight: no one programs the network to look for whiskers or tails. It discovers these features on its own, just by seeing thousands of examples and correcting its mistakes. Given enough data and training time, the network builds its own internal understanding of the world.',
 '{"Relevance": 90, "Quality": 80, "Clarity": 92, "Creativity": 85}'::jsonb,
 86.75, NULL, 'approved',
 'Excellent use of the kitchen analogy to explain gradient descent. The layered explanation builds complexity naturally. Could improve by briefly mentioning what training data looks like and addressing overfitting.',
 NOW() - INTERVAL '5 days'),
('c5000000-0000-0000-0000-000000000006'::uuid,
 'c2000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 'How Neural Networks Learn: The Student Analogy',
 'A neural network learns like a student preparing for an exam through practice tests.

The student (network) starts knowing nothing. They take a practice test (forward pass) and get most answers wrong. The teacher (loss function) marks the test and highlights errors.

The student reviews mistakes and adjusts study strategy (backpropagation). They focus more on topics they got wrong and less on ones they already know. Each connection in the brain (weight) gets strengthened or weakened.

After many practice tests, the student improves. They start recognizing patterns — not memorizing answers, but understanding concepts. This is generalization.

The learning rate is like how boldly the student changes strategy. Too bold (high rate) and they overcorrect. Too cautious (low rate) and learning takes forever.',
 '{"Relevance": 85, "Quality": 70, "Clarity": 80, "Creativity": 65}'::jsonb,
 75.0, NULL, 'approved',
 'Good analogy connecting neural networks to studying. Clear structure. Could be expanded with more detail about hidden layers and what neurons actually compute.',
 NOW() - INTERVAL '4 days'),
('c5000000-0000-0000-0000-000000000001'::uuid,
 'c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000009'::uuid,
 'Comprehensive Shortest Path Solutions', 'Solved all 5 problems with Dijkstra, Bellman-Ford, Floyd-Warshall, BFS, and A*. Each with multiple test cases.',
 '{"Relevance": 100, "Quality": 98, "Clarity": 95, "Creativity": 100}'::jsonb,
 98.5, 1, 'winner', 'Exceptional work covering all five algorithms with clear Big-O analysis and comprehensive test cases. The A* implementation with custom heuristics was particularly impressive.', NOW() - INTERVAL '4 days'),
('c5000000-0000-0000-0000-000000000002'::uuid,
 'c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 'Graph Shortest Path Solutions', 'Solved problems 1-4 with clean implementations and Big-O analysis.',
 '{"Relevance": 90, "Quality": 85, "Clarity": 80, "Creativity": 72}'::jsonb,
 82.0, 2, 'approved', 'Strong solutions for 4 out of 5 problems. Code is clean and well-documented. Could improve by attempting the fifth problem and exploring alternative approaches.', NOW() - INTERVAL '4 days'),
('c5000000-0000-0000-0000-000000000003'::uuid,
 'c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000005'::uuid,
 'Shortest Path Basics', 'Solved 3 problems using BFS and Dijkstra with test cases.',
 '{"Relevance": 70, "Quality": 65, "Clarity": 70, "Creativity": 55}'::jsonb,
 65.0, 3, 'approved', 'Good use of BFS and Dijkstra for basic problems. Consider exploring more advanced algorithms like Bellman-Ford for negative weights.', NOW() - INTERVAL '3 days'),
('c5000000-0000-0000-0000-000000000004'::uuid,
 'c2000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'My Graph Solutions', 'Attempted all 5, completed 2 fully. Used Dijkstra for problem 1 and BFS for problem 3. The other three have partial pseudocode.',
 '{"Relevance": 50, "Quality": 35, "Clarity": 45, "Creativity": 30}'::jsonb,
 40.0, 4, 'approved', 'Good effort attempting all problems. The two completed solutions show understanding of the basics. Focus on completing implementations rather than leaving pseudocode.', NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;


INSERT INTO shared_content (id, user_id, entity_type, entity_id, title, description,
    visibility, community_ids, view_count, download_count, like_count, average_rating, rating_count,
    tags, status, created_at, published_at) VALUES
('5c000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'diagram', '10000000-0000-0000-0000-000000000001'::uuid,
 'Machine Learning Knowledge Map v2',
 'An updated knowledge map connecting ML concepts from supervised learning through to transformer architectures. Great for visual learners.',
 'public', ARRAY['c1000000-0000-0000-0000-000000000001']::uuid[], 85, 32, 21,
 4.7, 8, ARRAY['machine-learning', 'knowledge-map', 'visualization'],
 'published', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
('5c000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'source', 'a0000000-0000-0000-0000-000000000101'::uuid,
 'Annotated ML Paper Collection',
 'A curated collection of annotated ML papers with my notes on key insights. Includes attention mechanisms, CNNs, and generative models.',
 'public', ARRAY['c1000000-0000-0000-0000-000000000001']::uuid[], 40, 15, 12,
 4.5, 4, ARRAY['papers', 'machine-learning', 'nlp'],
 'published', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
('5c000000-0000-0000-0000-000000000004'::uuid,
 '00000000-0000-0000-0000-000000000004'::uuid,
 'flashcard', '00000000-0000-0000-0000-000000000003'::uuid,
 'Networking Flashcard: What is DHCP?',
 'A flashcard covering DHCP basics — useful for networking module revision.',
 'public', ARRAY['c1000000-0000-0000-0000-000000000001']::uuid[], 25, 8, 6,
 NULL, 0, ARRAY['networking', 'flashcard'],
 'published', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
('5c000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'source', 'a0000000-0000-0000-0000-000000000103'::uuid,
 'Algorithm Complexity Cheatsheet',
 'A comprehensive reference for time and space complexity of all common algorithms. Printable PDF format.',
 'public', ARRAY['c1000000-0000-0000-0000-000000000002']::uuid[], 120, 67, 34,
 4.9, 12, ARRAY['algorithms', 'complexity', 'cheatsheet'],
 'published', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
('5c000000-0000-0000-0000-000000000005'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid,
 'flashcard', '00000000-0000-0000-0000-000000000004'::uuid,
 'OSI Model Flashcard',
 'Quick reference flashcard for the 7 layers of the OSI model with a handy mnemonic.',
 'public', ARRAY['c1000000-0000-0000-0000-000000000002']::uuid[], 35, 12, 9,
 NULL, 0, ARRAY['networking', 'osi', 'flashcard'],
 'published', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

INSERT INTO content_ratings (shared_content_id, user_id, rating, review_text, created_at) VALUES
('5c000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
 5, 'Excellent map! Really helped me see how all the pieces fit together.', NOW() - INTERVAL '11 days'),
('5c000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 5, 'Comprehensive and well-organized.', NOW() - INTERVAL '10 days'),
('5c000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 5, 'This is the best complexity reference I have found. Bookmarked!', NOW() - INTERVAL '14 days'),
('5c000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 5, 'Perfect for interview prep.', NOW() - INTERVAL '12 days')
ON CONFLICT (shared_content_id, user_id) DO NOTHING;


INSERT INTO feedback_requests (id, user_id, entity_type, entity_id, title, description,
    specific_questions, community_id, status, max_responses, current_responses,
    points_offered, expires_at, created_at) VALUES
('f3000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'shared_content', '5c000000-0000-0000-0000-000000000002'::uuid,
 'Feedback on my annotated paper collection',
 'I just shared my annotated ML paper collection. Would love feedback on whether my annotations are clear and which papers to add next.',
 ARRAY[
   'Are the annotations clear enough for a beginner?',
   'Which paper should I annotate next?',
   'Is the organization logical?'
 ],
 'c1000000-0000-0000-0000-000000000001'::uuid,
 'in_progress', 5, 2, 10,
 NOW() + INTERVAL '7 days', NOW() - INTERVAL '8 days'),
('f3000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'shared_content', '5c000000-0000-0000-0000-000000000001'::uuid,
 'Is my ML knowledge map complete?',
 'Looking for suggestions on what key concepts or connections I might be missing from my ML knowledge map.',
 ARRAY[
   'What important concepts are missing?',
   'Are the relationship labels accurate?'
 ],
 'c1000000-0000-0000-0000-000000000001'::uuid,
 'open', 5, 0, 5,
 NOW() + INTERVAL '14 days', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

INSERT INTO peer_feedback (id, feedback_request_id, reviewer_id, recipient_id, content, rating, is_helpful, created_at) VALUES
('bf000000-0000-0000-0000-000000000001'::uuid,
 'f3000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'Your annotations are clear and concise. I especially liked the key insight highlights. For next paper, I suggest "BERT: Pre-training of Deep Bidirectional Transformers". The organization by topic area is logical.',
 5, TRUE, NOW() - INTERVAL '7 days'),
('bf000000-0000-0000-0000-000000000002'::uuid,
 'f3000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000004'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'Good collection overall. Some annotations could be more detailed for complex sections. Suggest adding ViT (Vision Transformer) as the next paper.',
 4, TRUE, NOW() - INTERVAL '6 days')
ON CONFLICT DO NOTHING;


INSERT INTO content_requests (id, request_type, title, description, created_by,
    status, total_votes, created_at) VALUES
('c3000000-0000-0000-0000-000000000001'::uuid, 'topic',
 'Notes on Reinforcement Learning fundamentals',
 'Would love a comprehensive overview of RL basics: MDP, Q-learning, policy gradients. Preferably with code examples.',
 '00000000-0000-0000-0000-000000000005'::uuid,
 'open', 3, NOW() - INTERVAL '14 days'),
('c3000000-0000-0000-0000-000000000002'::uuid, 'content',
 'Dynamic Programming patterns cheatsheet',
 'A categorized guide to DP patterns (knapsack, LCS, coin change, etc.) with template code would be super useful for interviews.',
 '00000000-0000-0000-0000-000000000004'::uuid,
 'open', 2, NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

INSERT INTO content_request_votes (request_id, user_id, created_at) VALUES
('c3000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, NOW() - INTERVAL '13 days'),
('c3000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000004'::uuid, NOW() - INTERVAL '12 days'),
('c3000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000007'::uuid, NOW() - INTERVAL '11 days'),
('c3000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid, NOW() - INTERVAL '9 days'),
('c3000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000009'::uuid, NOW() - INTERVAL '8 days')
ON CONFLICT (request_id, user_id) DO NOTHING;


INSERT INTO mentor_profiles (user_id, subjects, bio, is_available, sessions_completed, rating) VALUES
('00000000-0000-0000-0000-000000000009'::uuid,
 ARRAY['Computer Science', 'Algorithms', 'Data Structures'],
 'Competitive programmer with extensive experience in algorithm design. Happy to help with DSA and competitive programming preparation.',
 TRUE, 3, 4.80),
('00000000-0000-0000-0000-000000000002'::uuid,
 ARRAY['Machine Learning', 'Deep Learning', 'Artificial Intelligence'],
 'Teacher with research background in ML. Available for mentoring students interested in deep learning and NLP.',
 TRUE, 2, 4.90)
ON CONFLICT (user_id) DO NOTHING;


INSERT INTO mentorships (id, mentor_id, mentee_id, status, subject, topic_focus,
    community_id, chat_room_id, sessions_count, mentor_points_earned, created_at, started_at) VALUES
('a4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid,
 'active', 'Computer Science', 'Graph algorithms, dynamic programming, competitive programming techniques',
 'c1000000-0000-0000-0000-000000000002'::uuid,
 'f1000000-0000-0000-0000-000000000010'::uuid,
 3, 75, NOW() - INTERVAL '18 days', NOW() - INTERVAL '17 days'),
('a4000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'active', 'Machine Learning', 'Deep learning theory, paper reading, research methodology',
 'c1000000-0000-0000-0000-000000000001'::uuid,
 'f1000000-0000-0000-0000-000000000011'::uuid,
 2, 50, NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days'),
('a4000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'active', 'Data Structures', 'Trees, heaps, hash tables and their real-world applications',
 'c1000000-0000-0000-0000-000000000002'::uuid,
 'f1000000-0000-0000-0000-000000000012'::uuid,
 1, 25, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days')
ON CONFLICT (mentor_id, mentee_id) DO NOTHING;

INSERT INTO mentorship_sessions (id, mentorship_id, scheduled_by, title, description, scheduled_at, duration_minutes, session_type, status, jitsi_room_id, rating, rating_comment, rated_by, rated_at, completed_at, created_at) VALUES
('b5000000-0000-0000-0000-000000000001'::uuid, 'a4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Graph Traversal Basics', 'BFS and DFS fundamentals with practice problems',
 NOW() - INTERVAL '15 days', 60, 'video', 'completed',
 'mentorship-a4000001-abc12345', 5, 'Amazing session! Frank explained BFS so clearly.',
 '00000000-0000-0000-0000-000000000005'::uuid, NOW() - INTERVAL '14 days',
 NOW() - INTERVAL '14 days', NOW() - INTERVAL '16 days'),
('b5000000-0000-0000-0000-000000000002'::uuid, 'a4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Dynamic Programming Intro', 'Memoization vs tabulation, classic DP problems',
 NOW() - INTERVAL '10 days', 90, 'video', 'completed',
 'mentorship-a4000001-def67890', 4, 'Good session, DP is starting to click.',
 '00000000-0000-0000-0000-000000000005'::uuid, NOW() - INTERVAL '9 days',
 NOW() - INTERVAL '9 days', NOW() - INTERVAL '11 days'),
('b5000000-0000-0000-0000-000000000003'::uuid, 'a4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid,
 'Competitive Programming Practice', 'Practice contest problems together',
 NOW() - INTERVAL '5 days', 60, 'chat', 'completed',
 NULL, 5, 'Great practice! Solved 3 problems together.',
 '00000000-0000-0000-0000-000000000005'::uuid, NOW() - INTERVAL '4 days',
 NOW() - INTERVAL '4 days', NOW() - INTERVAL '6 days'),
('b5000000-0000-0000-0000-000000000004'::uuid, 'a4000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Shortest Path Algorithms', 'Dijkstra, Bellman-Ford, and Floyd-Warshall',
 NOW() + INTERVAL '2 days', 60, 'video', 'confirmed',
 'mentorship-a4000001-ghi11111', NULL, NULL, NULL, NULL,
 NULL, NOW() - INTERVAL '1 day'),
('b5000000-0000-0000-0000-000000000005'::uuid, 'a4000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000002'::uuid,
 'CNN Architecture Deep Dive', 'ResNet, VGG, and modern architectures',
 NOW() - INTERVAL '11 days', 90, 'video', 'completed',
 'mentorship-a4000002-jkl22222', 5, 'Demo Teacher is incredibly knowledgeable!',
 '00000000-0000-0000-0000-000000000007'::uuid, NOW() - INTERVAL '10 days',
 NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days'),
('b5000000-0000-0000-0000-000000000006'::uuid, 'a4000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'Paper Reading: Attention Is All You Need', 'Discuss the transformer paper together',
 NOW() - INTERVAL '4 days', 60, 'chat', 'completed',
 NULL, 4, 'Great discussion, now I understand self-attention much better.',
 '00000000-0000-0000-0000-000000000007'::uuid, NOW() - INTERVAL '3 days',
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '5 days'),
('b5000000-0000-0000-0000-000000000007'::uuid, 'a4000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'Research Methodology Workshop', 'How to write a good ML experiment',
 NOW() + INTERVAL '5 days', 120, 'video', 'proposed',
 'mentorship-a4000002-mno33333', NULL, NULL, NULL, NULL,
 NULL, NOW() - INTERVAL '1 day'),
('b5000000-0000-0000-0000-000000000008'::uuid, 'a4000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Binary Trees & BST', 'Tree traversals, balanced BSTs, and practical uses',
 NOW() - INTERVAL '7 days', 60, 'video', 'completed',
 'mentorship-a4000003-pqr44444', 5, 'Frank makes trees so easy to understand!',
 '00000000-0000-0000-0000-000000000003'::uuid, NOW() - INTERVAL '6 days',
 NOW() - INTERVAL '6 days', NOW() - INTERVAL '8 days'),
('b5000000-0000-0000-0000-000000000009'::uuid, 'a4000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'Heaps & Priority Queues', 'Min-heap, max-heap, heap sort and real-world scheduling problems',
 NOW() + INTERVAL '1 day', 60, 'video', 'confirmed',
 'mentorship-a4000003-stu55555', NULL, NULL, NULL, NULL,
 NULL, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;


INSERT INTO reputation_scores (user_id, community_id, teaching_score, content_score,
    feedback_score, engagement_score, reliability_score, reputation_level, last_calculated) VALUES
('00000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
 100, 80, 120, 99, 100, 'learner', NOW()),
('00000000-0000-0000-0000-000000000009'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid,
 12, 5, 0, 4, 32, 'newcomer', NOW()),
('00000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
 0, 5, 10, 1, 0, 'newcomer', NOW()),
('00000000-0000-0000-0000-000000000007'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
 0, 5, 4, 1, 2, 'newcomer', NOW())
ON CONFLICT (user_id, community_id) DO NOTHING;

INSERT INTO reputation_events (id, user_id, event_type, dimension, points_change,
    reference_type, reference_id, community_id, created_at) VALUES
('3e000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'content_shared', 'content', 5, 'shared_content', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '14 days'),
('3e000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'feedback_marked_helpful', 'feedback', 6, 'peer_feedback', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '12 days'),
('3e000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'content_rated', 'teaching', 10, 'discussion_reply', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '8 days'),
('3e000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'challenge_won', 'reliability', 25, 'challenge', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '7 days'),
('3e000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'mentoring_completed', 'teaching', 12, 'mentorship', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '7 days'),
('3e000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000003'::uuid,
 'streak_milestone', 'reliability', 2, NULL, NULL, NULL, NOW()-INTERVAL '4 days'),
('3e000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000009'::uuid,
 'challenge_won', 'reliability', 25, 'challenge', NULL, 'c1000000-0000-0000-0000-000000000002'::uuid, NOW()-INTERVAL '8 days'),
('3e000000-0000-0000-0000-000000000008'::uuid, '00000000-0000-0000-0000-000000000009'::uuid,
 'mentoring_completed', 'teaching', 12, 'mentorship', NULL, 'c1000000-0000-0000-0000-000000000002'::uuid, NOW()-INTERVAL '7 days'),
('3e000000-0000-0000-0000-000000000009'::uuid, '00000000-0000-0000-0000-000000000009'::uuid,
 'content_shared', 'content', 5, 'shared_content', NULL, 'c1000000-0000-0000-0000-000000000002'::uuid, NOW()-INTERVAL '18 days'),
('3e000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
 'feedback_given', 'feedback', 4, 'peer_feedback', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '10 days'),
('3e000000-0000-0000-0000-000000000011'::uuid, '00000000-0000-0000-0000-000000000004'::uuid,
 'content_shared', 'content', 5, 'shared_content', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '7 days'),
('3e000000-0000-0000-0000-000000000012'::uuid, '00000000-0000-0000-0000-000000000007'::uuid,
 'content_shared', 'content', 5, 'shared_content', NULL, 'c1000000-0000-0000-0000-000000000001'::uuid, NOW()-INTERVAL '9 days')
ON CONFLICT DO NOTHING;


INSERT INTO activity_feed (id, actor_id, activity_type, entity_type, entity_id,
    community_id, entity_preview, like_count, comment_count, created_at) VALUES
('af000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'shared', 'shared_content', '5c000000-0000-0000-0000-000000000001'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '{"title": "Machine Learning Knowledge Map v2", "type": "diagram"}'::jsonb,
 14, 3, NOW() - INTERVAL '12 days'),
('af000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid,
 'completed_challenge', 'challenge', 'c2000000-0000-0000-0000-000000000002'::uuid,
 'c1000000-0000-0000-0000-000000000002'::uuid,
 '{"challenge_title": "Algorithm Sprint: Shortest Path Showdown", "rank": 1, "score": 98.5}'::jsonb,
 22, 5, NOW() - INTERVAL '4 days'),
('af000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid,
 'shared', 'shared_content', '5c000000-0000-0000-0000-000000000002'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '{"title": "Annotated ML Paper Collection", "type": "source"}'::jsonb,
 12, 2, NOW() - INTERVAL '9 days'),
('af000000-0000-0000-0000-000000000004'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'achieved', 'badge', 'b1000000-0000-0000-0000-000000000003'::uuid,
 NULL,
 '{"badge_name": "Scholar", "rarity": "rare"}'::jsonb,
 8, 1, NOW() - INTERVAL '10 days'),
('af000000-0000-0000-0000-000000000005'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid,
 'created_content', 'discussion_thread', 'd4000000-0000-0000-0000-000000000001'::uuid,
 'c1000000-0000-0000-0000-000000000001'::uuid,
 '{"thread_title": "Best resources for learning Transformers from scratch?"}'::jsonb,
 5, 0, NOW() - INTERVAL '14 days')
ON CONFLICT DO NOTHING;

INSERT INTO activity_comments (id, activity_id, user_id, content, created_at) VALUES
('ac000000-0000-0000-0000-000000000001'::uuid, 'af000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000004'::uuid, 'This diagram is super helpful, thanks for sharing!', NOW() - INTERVAL '11 days'),
('ac000000-0000-0000-0000-000000000002'::uuid, 'af000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid, 'Great overview of the ML landscape', NOW() - INTERVAL '10 days'),
('ac000000-0000-0000-0000-000000000003'::uuid, 'af000000-0000-0000-0000-000000000001'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid, 'Would love to see a deep learning version of this!', NOW() - INTERVAL '10 days'),
('ac000000-0000-0000-0000-000000000004'::uuid, 'af000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid, 'Congrats on first place! That score is incredible', NOW() - INTERVAL '3 days'),
('ac000000-0000-0000-0000-000000000005'::uuid, 'af000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000004'::uuid, 'What approach did you use for the shortest path?', NOW() - INTERVAL '3 days'),
('ac000000-0000-0000-0000-000000000006'::uuid, 'af000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid, 'I used A* with a custom heuristic!', NOW() - INTERVAL '3 days'),
('ac000000-0000-0000-0000-000000000007'::uuid, 'af000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000007'::uuid, 'Nice work, Frank! Well deserved', NOW() - INTERVAL '2 days'),
('ac000000-0000-0000-0000-000000000008'::uuid, 'af000000-0000-0000-0000-000000000002'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid, 'Can you share your solution afterwards?', NOW() - INTERVAL '2 days'),
('ac000000-0000-0000-0000-000000000009'::uuid, 'af000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000003'::uuid, 'These annotations are really detailed, thanks!', NOW() - INTERVAL '8 days'),
('ac000000-0000-0000-0000-000000000010'::uuid, 'af000000-0000-0000-0000-000000000003'::uuid,
 '00000000-0000-0000-0000-000000000009'::uuid, 'The attention mechanism paper was my favorite', NOW() - INTERVAL '7 days'),
('ac000000-0000-0000-0000-000000000011'::uuid, 'af000000-0000-0000-0000-000000000004'::uuid,
 '00000000-0000-0000-0000-000000000005'::uuid, 'Well earned! Keep up the great work', NOW() - INTERVAL '9 days')
ON CONFLICT DO NOTHING;


INSERT INTO algorithm_config (platform_default, students_can_change, sm2_ease_factor_floor, fsrs_stability_constant, ab_test_enabled)
VALUES ('SM2', TRUE, 1.3, 0.9, FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO assessment_integrity_config (allow_tab_switching, max_time_extension_minutes, max_retry_attempts, randomise_question_order, randomise_option_order, collusion_similarity_threshold)
VALUES (FALSE, 30, 3, TRUE, TRUE, 0.85)
ON CONFLICT DO NOTHING;

INSERT INTO system_limits (key, value, description) VALUES
('max_decks_per_teacher',       50,    'Maximum flashcard decks a teacher can create'),
('max_cards_per_deck',          500,   'Maximum cards allowed in a single deck'),
('max_questions_per_assessment',100,   'Maximum questions in a single assessment'),
('past_paper_upload_size_mb',   20,    'Maximum file size in MB for past paper uploads'),
('question_bank_quota_per_teacher', 2000, 'Total questions a teacher can maintain in the bank'),
('ai_card_generation_daily_student', 20, 'Default daily AI card generation limit for students'),
('ai_card_generation_daily_teacher', 100,'Default daily AI card generation limit for teachers'),
('ai_mnemonic_daily_student',   10,    'Default daily AI mnemonic generation limit for students'),
('ai_mnemonic_daily_teacher',   50,    'Default daily AI mnemonic generation limit for teachers')
ON CONFLICT (key) DO NOTHING;

INSERT INTO ai_token_quota (role, user_id, monthly_token_limit, reset_day) VALUES
('student', NULL, 1000000000000000, 1),
('teacher', NULL, 1000000000000000, 1),
('admin',   NULL, 1000000000000000, 1)
ON CONFLICT (role, user_id) DO NOTHING;

INSERT INTO data_retention_policy (key, retain_days, description) VALUES
('audit_log',      1095, 'How long admin audit logs are retained'),
('user_sessions',  30,   'How long inactive user sessions are retained')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_alert_rules (rule_type, condition_json, recipients, is_active) VALUES
('question_flagged',
 '{"min_flags": 3}'::jsonb,
 '["admin"]'::jsonb,
 TRUE),
('ai_quota_threshold',
 '{"threshold_pct": 80}'::jsonb,
 '["admin"]'::jsonb,
 TRUE),
('class_average_drop',
 '{"min_pct": 60}'::jsonb,
 '["admin"]'::jsonb,
 TRUE),
('weekly_assessment_digest',
 '{"schedule": "weekly"}'::jsonb,
 '["admin"]'::jsonb,
 TRUE)
ON CONFLICT DO NOTHING;


INSERT INTO teacher_permissions (user_id, can_create_public_decks, can_create_formal_assessments, can_import_past_papers, can_use_ai_tools, can_view_cross_class_analytics)
SELECT id, FALSE, TRUE, FALSE, TRUE, FALSE
FROM users WHERE role = 'teacher'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO global_tags (name, slug, category, is_system) VALUES
('Mathematics',     'mathematics',      'subject', TRUE),
('Science',         'science',          'subject', TRUE),
('History',         'history',          'subject', TRUE),
('English',         'english',          'subject', TRUE),
('Programming',     'programming',      'subject', TRUE),
('Easy',            'easy',             'difficulty', TRUE),
('Medium',          'medium',           'difficulty', TRUE),
('Hard',            'hard',             'difficulty', TRUE),
('Exam Prep',       'exam-prep',        'purpose', TRUE),
('Revision',        'revision',         'purpose', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO question_bank (id, subject_id, question_type, question_text, options, correct_answer, skill_dim, difficulty, score_max, created_by) VALUES

('ab000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid,
 'mcq', 'What does CPU stand for?',
 '{"A": "Central Processing Unit", "B": "Computer Personal Unit", "C": "Central Program Utility", "D": "Core Processing Unit"}'::jsonb,
 '"A"'::jsonb, 'concept', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid,
 'tf', 'RAM is a type of non-volatile memory.',
 NULL, 'false'::jsonb, 'concept', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000003'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid,
 'mcq', 'Which layer of the OSI model is responsible for routing?',
 '{"A": "Data Link", "B": "Transport", "C": "Network", "D": "Physical"}'::jsonb,
 '"C"'::jsonb, 'concept', 2, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid,
 'mcq', 'Which protocol is used to assign IP addresses automatically?',
 '{"A": "DNS", "B": "HTTP", "C": "DHCP", "D": "FTP"}'::jsonb,
 '"C"'::jsonb, 'apply', 2, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000005'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid,
 'short', 'Explain the difference between a compiler and an interpreter.',
 NULL, '"A compiler translates the entire source code before execution; an interpreter translates and executes line by line."'::jsonb,
 'concept', 3, 2.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000006'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid,
 'mcq', 'What is the derivative of x²?',
 '{"A": "x", "B": "2x", "C": "x²", "D": "2"}'::jsonb,
 '"B"'::jsonb, 'apply', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000007'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid,
 'tf', 'The sum of angles in a triangle is always 180 degrees.',
 NULL, 'true'::jsonb, 'concept', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000008'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid,
 'mcq', 'What is the solution to 2x + 6 = 14?',
 '{"A": "3", "B": "4", "C": "5", "D": "10"}'::jsonb,
 '"B"'::jsonb, 'apply', 2, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000009'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid,
 'mcq', 'What is the unit of electric current?',
 '{"A": "Volt", "B": "Watt", "C": "Ampere", "D": "Ohm"}'::jsonb,
 '"C"'::jsonb, 'concept', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000010'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid,
 'mcq', 'According to Newton''s second law, Force equals?',
 '{"A": "mass × velocity", "B": "mass × acceleration", "C": "mass / acceleration", "D": "velocity / time"}'::jsonb,
 '"B"'::jsonb, 'apply', 2, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000011'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid,
 'short', 'State the law of conservation of energy.',
 NULL, '"Energy cannot be created or destroyed; it can only be transformed from one form to another."'::jsonb,
 'concept', 2, 2.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000012'::uuid, 'e0000000-0000-0000-0000-000000000006'::uuid,
 'mcq', 'What is the atomic number of Carbon?',
 '{"A": "4", "B": "6", "C": "8", "D": "12"}'::jsonb,
 '"B"'::jsonb, 'concept', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000013'::uuid, 'e0000000-0000-0000-0000-000000000006'::uuid,
 'tf', 'An acid has a pH value greater than 7.',
 NULL, 'false'::jsonb, 'concept', 1, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000014'::uuid, 'e0000000-0000-0000-0000-000000000006'::uuid,
 'mcq', 'Which gas is produced when an acid reacts with a metal carbonate?',
 '{"A": "Oxygen", "B": "Hydrogen", "C": "Carbon Dioxide", "D": "Nitrogen"}'::jsonb,
 '"C"'::jsonb, 'apply', 2, 1.0, '00000000-0000-0000-0000-000000000002'::uuid),

('ab000000-0000-0000-0000-000000000015'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid,
 'short', 'Describe the time complexity of quicksort in the average and worst case.',
 NULL, '"Average case: O(n log n); Worst case: O(n²) when the pivot is always the smallest or largest element."'::jsonb,
 'apply', 3, 3.0, '00000000-0000-0000-0000-000000000002'::uuid)

ON CONFLICT (id) DO NOTHING;


INSERT INTO flashcard_decks (id, teacher_id, title, description, subject, tags, visibility, is_template)
VALUES 
('d0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Biology 101 - Cell Structure', 'Flashcards for the first biology midterm covering cell anatomy.', 'Biology', '{"cell", "organelles"}', 'public', FALSE),
('d0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Algebra 2 - Quadratics', 'Review of quadratic formulas and graphing.', 'Mathematics', '{"algebra", "graphs"}', 'class_only', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO teacher_assessments (id, teacher_id, title, description, subject, assessment_type, time_limit_minutes)
VALUES
('a0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Biology Midterm', 'Midterm exam for Biology 101.', 'Biology', 'Midterm', 60),
('a0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Algebra Quiz', 'Pop quiz on quadratics.', 'Mathematics', 'Quiz', 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO teacher_assessment_questions (assessment_id, question_id, points, is_required, position)
VALUES
('a0000000-0000-0000-0000-000000000001'::uuid, 'ab000000-0000-0000-0000-000000000001'::uuid, 1.0, TRUE, 1),
('a0000000-0000-0000-0000-000000000001'::uuid, 'ab000000-0000-0000-0000-000000000002'::uuid, 5.0, TRUE, 2)
ON CONFLICT (assessment_id, question_id) DO NOTHING;
