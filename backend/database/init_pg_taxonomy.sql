-- =============================================================================
-- Library of Congress Classification (LCC) Taxonomy

-- =============================================================================
-- A - GENERAL WORKS

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES

  ('A', 'General Works', 1, NULL, 'General works'),
  ('AC', 'Collections', 2, 'A', 'Collected works including monographs, essays, inaugural and program dissertations, pamphlet collections, scrapbooks'),
  ('AE', 'Encyclopedias', 2, 'A', 'Modern encyclopedias'),
  ('AG', 'Dictionaries', 2, 'A', 'Dictionaries and other general reference works'),
  ('AI', 'Indexes', 2, 'A', 'Indexes'),
  ('AM', 'Museums', 2, 'A', 'Museums, its studies, collectors and collections'),
  ('AP', 'Periodicals', 2, 'A', 'Periodicals including humorous, juvenile, women, African Americans'),
  ('AS', 'Academies and Learned Societies', 2, 'A', 'Academic and learned societies'),
  ('AY', 'Yearbooks and Almanacs', 2, 'A', 'Yearbooks and Almanacs'),
  ('AZ', 'History of Scholarship and Learning', 2, 'A', 'History of scholarship and learning')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- B - PHILOSOPHY, PSYCHOLOGY, RELIGION

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('B', 'Philosophy, Psychology, Religion', 1, NULL, 'Philosophy, psychology, religion'),
  -- B-BJ: Philosophy, Psychology 
  ('B1', 'Philosophy', 2, 'B', 'General philosophy, including general works, ancient, medieval, renaissance, modern'),
  ('BC', 'Logic', 3, 'B1', 'Logic, including history, general works, special topics'),
  ('BD', 'Speculative Philosophy', 3, 'B1', 'Speculative philosophy, including general works, metaphysics, epistemology, methodology, ontology, cosmology'),
  ('BF', 'Psychology', 3, 'B1', 'Psychology, including psychoanalysis, experimental psychology, gestalt psychology, psychotropic drugs, sensation, consciousness and cognition,
    motivation, affection, feeling and emotion, will, volition, choice and control, comparative psychology, sex psychology, genetic psychology, physiognomy, phrenology,
    graphology, plamistry and chiromancy, parapsychology, occult sciences'),
  ('BH', 'Aesthetics', 3, 'B1', 'Aesthetics'),
  ('BJ', 'Ethics', 3, 'B1', 'Ethics, including history, socialist ethics, totalitarian ethics, feminist ethics, professional ethics, social usage and etiquette'),
  -- BL-BX: Religion
  ('B2', 'Religions', 2, 'B', 'Religions, including philosophy of religion, pscyhology of religion, biography, natural theology, 
    religious doctrines, history and principles of religions'),
  ('BM', 'Judaism', 3, 'B2', 'Judaism'),
  ('BP', 'Islam', 3, 'B2', 'Islam'),
  ('BQ', 'Buddhism', 3, 'B2', 'Buddhism'),
  ('BR', 'Christianity', 3, 'B2', 'Christianity'),
  ('BS', 'Bible', 3, 'B2', 'Bible'),
  ('BT', 'Doctrinal Theology', 3, 'B2', 'Doctrinal theology'),
  ('BV', 'Practical Theology', 3, 'B2', 'Practical theology'),
  ('BX', 'Christian Denominations', 3, 'B2', 'Christian denominations')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- C - AUXILIARY SCIENCES OF HISTORY

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('C', 'Auxiliary Sciences of History', 1, NULL, 'Auxiliary sciences of history'),
  ('CB', 'History of Civilization', 2, 'C', 'History of civilization, including interplanetary voyages, forecasts, special topics'),
  ('CC', 'Archaeology', 2, 'C', 'Archaeology'),
  ('CD', 'Diplomatics', 2, 'C', 'Diplomatics, including archives, seals'),
  ('CE', 'Technical chronology', 2, 'C', 'Technical chronology'),
  ('CJ', 'Numismatics', 2, 'C', 'Numismatics, including coins, tokens, medals and medallions'),
  ('CN', 'Inscriptions', 2, 'C', 'Inscriptions'),
  ('CR', 'Heraldry', 2, 'C', 'Heraldry'),
  ('CS', 'Genealogy', 2, 'C', 'Genealogy, including genealogical lists, family history, personal and family names'),
  ('CT', 'Biography', 2, 'C', 'Biography')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- D - HISTORY (GENERAL) & E - HISTORY (AMERICA)

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('D', 'History', 1, NULL, 'History, including military and naval history, political and diplomatic history, ancient history'),
  ('DA', 'History of Great Britain', 2, 'D', 'History of Great Britain'),
  ('DAW', 'History of Central Europe', 2, 'D', 'History of Central Europe'),
  ('DB', 'History of Austria, Liechtenstein, Hungary, Czechoslovakia, Austro-Hungarian Empire', 2, 'D', 'History of Austria, Liechtenstein, Hungary, Czechoslovakia, Austro-Hungarian Empire'),
  ('DC', 'History of France', 2, 'D', 'History of France'),
  ('DD', 'History of Germany', 2, 'D', 'History of Germany'),
  ('DE', 'History of the Greco-Roman world', 2, 'D', 'History of the Greco-Roman world'),
  ('DF', 'History of Greece', 2, 'D', 'History of Greece'),
  ('DG', 'History of Italy', 2, 'D', 'History of Italy'),
  ('DH', 'History of Low Countries, Benelux Countries', 2, 'D', 'History of Low Countries, Benelux Countries'),
  ('DJ', 'History of Netherlands', 2, 'D', 'History of Netherlands'),
  ('DJK', 'History of Eastern Europe (General)', 2, 'D', 'General history of Eastern Europe'),
  ('DK', 'History of Russia, Soviet Union, Former Soviet Republics', 2, 'D', 'History of Russia, Soviet Union, former Soviet Republics'),
  ('DL', 'History of Northern Europe, Scandinavia', 2, 'D', 'History of Northern Europe, Scandinavia'),
  ('DP', 'History of Spain', 2, 'D', 'History of Spain'),
  ('DQ', 'History of Switzerland', 2, 'D', 'History of Switzerland'),
  ('DR', 'History of Balkan Peninsula', 2, 'D', 'History of Balkan Peninsula'),
  ('DS', 'History of Asia', 2, 'D', 'History of Asia'),
  ('DT', 'History of Africa', 2, 'D', 'History of Africa'),
  ('DU', 'History of Oceania (South Seas)', 2, 'D', 'History of Oceania (South Seas)'),
  ('DX', 'History of Romanies', 2, 'D', 'History of Romanies')
ON CONFLICT (lcc_code) DO NOTHING;

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('E', 'History of America', 2, 'D', 'History of America'),
  ('E1', 'History of United States', 3, 'E', 'History of United States'),
  ('E2', 'History of British America', 3, 'E', 'History of British America'),
  ('E3', 'History of Dutch America', 3, 'E', 'History of Dutch America'),
  ('E4', 'History of French America', 3, 'E', 'History of French America'),
  ('E5', 'History of Latin America, Spanish America', 3, 'E', 'History of Latin America, Spanish America')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- G - GEOGRAPHY, MAPS, ANTHROPOLOGY, RECREATION

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('G', 'Geography, Maps, Anthropology, Recreation', 1, NULL, 'Geography, Maps, Anthropology, Recreation'),
  ('G1', 'Geography', 2, 'G', 'General geography'),
  ('G2', 'Atlases', 2, 'G', 'Atlases'),
  ('G3', 'Globes', 2, 'G', 'Globes'),
  ('G4', 'Maps', 2, 'G', 'Maps'),
  ('GA', 'Mathematical Geography, Cartography', 2, 'G', 'Mathematical geography, cartography'),
  ('GB', 'Physical Geography', 2, 'G', 'Physical geography'),
  ('GC', 'Oceanography', 2, 'G', 'Oceanography'),
  ('GE', 'Environmental Sciences', 2, 'G', 'Environmental sciences'),
  ('GF', 'Human Ecology', 2, 'G', 'Human ecology'),
  ('GN', 'Anthropology', 2, 'G', 'Anthropology, including physical anthropology, Ethnology, social and cultural anthropology, prehistoric archaaeology'),
  ('GR', 'Folklore', 2, 'G', 'Folklore'),
  ('GT', 'Manners and Customs', 2, 'G', 'Manners and customs'),
  ('GV', 'Recreation and Leisure', 2, 'G', 'Recreation and leisure')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- H - SOCIAL SCIENCES

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('H', 'Social Sciences', 1, NULL, 'Social Sciences'),
  ('HA', 'Statistics of Social Sciences', 2, 'H', 'Statistics of social sciences'),
  ('HB', 'Economic Theory and Demography', 2, 'H', 'Economic theory and demography'),
  ('HC', 'Economic History and Conditions', 2, 'H', 'Economic history and conditions'),
  ('HD', 'Industries, Land Use and Labor', 2, 'H', 'Industries, land use and labor'),
  ('HE', 'Transportation and Communications', 2, 'H', 'Transportation and communications'),
  ('HF', 'Commerce', 2, 'H', 'Commerce'),
  ('HG', 'Finance', 2, 'H', 'Finance'),
  ('HJ', 'Public Finance', 2, 'H', 'Public finance'),
  ('HM', 'Sociology', 2, 'H', 'Sociology'),
  ('HN', 'Social History, Conditions and Social Problems', 2, 'H', 'Social history, conditions and social problems'),
  ('HQ', 'Family, Marriage, Women', 2, 'H', 'Family, marriage, women'),
  ('HS', 'Societies', 2, 'H', 'Societies'),
  ('HT', 'Communities, Classes, Races', 2, 'H', 'Communities, classes, races'),
  ('HV', 'Social Pathology, Social and Public welfare, Criminology', 2, 'H', 'Social pathology, social and public welfare, and criminology'),
  ('HX', 'Socialism, Communism, Anarchism', 2, 'H', 'Socialism, communism, anarchism')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- J - POLITICAL SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('J', 'Political Science', 1, NULL, 'Political Science'),
  ('J1', 'General Legislative and Executive Papers', 2, 'J', 'General legislative and executive papers'),
  ('JC', 'Political Theory, The State, Theories of the State', 2, 'J', 'Political theory, the State, theories of the State'),
  ('JF', 'Political Institutions and Public Administration (General)', 2, 'J', 'General political institutions and public administration'),
  ('JJ', 'Political Institutions and Public Administration (North America)', 3, 'JF', 'Political institutions and public administration (North America)'),
  ('JK', 'Political Institutions and Public Administration (United States)', 3, 'JF', 'Political institutions and public administration (United States)'),
  ('JL', 'Political Institutions and Public Administration (Canada and Latin America)', 3, 'JF', 'Political institutions and public administration (Canada and Latin America)'),
  ('JN', 'Political Institutions and Public Administration (Europe)', 3, 'JF', 'Political institutions and public administration (Europe)'),
  ('JQ', 'Political Institutions and Public Administration (Asia, Africa, Australia, Pacific Area)', 3, 'JF', 'Political institutions and public administration (Asia, Africa, Australia, Pacific Area)'),
  ('JS', 'Political Institutions and Public Administration (United States Local and Municipal)', 3, 'JF', 'Political institutions and public administration (United States Local and Municipal)'),
  ('JV', 'Colonies and Colonization, Emigration and Immigration, International Migration', 2, 'J', 'Colonies and colonization, emigration and immigration, international migration'),
  ('JX', 'International Law', 2, 'J', 'International law'),
  ('JZ', 'International Relations', 2, 'J', 'International relations')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- K - LAW

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('K', 'Law', 1, NULL, 'Law'),
  ('KB', 'Religious Law', 2, 'K', 'Religious law'),
  ('KD', 'Law of the United Kingdom and Ireland', 2, 'K', 'Law of the United Kingdom and Ireland'),
  ('KE', 'Law of Canada', 2, 'K', 'Law of Canada'),
  ('KF', 'Law of the United States', 2, 'K', 'Law of the United States'),
  ('KI', 'Law of the Law of Indigenous Peoples', 2, 'K', 'Law of the Law of Indigenous Peoples'),
  ('KJ', 'Law of Europe', 2, 'K', 'Law of Europe'),
  ('KL', 'Law of Asia and Eurasia, Africa, Pacific Area, and Antarctica', 2, 'K', 'Law of Asia and Eurasia, Africa, Pacific Area, and Antarctica'),
  ('KZ', 'Law of Nations', 2, 'K', 'Law of Nations')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- L - EDUCATION

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('L', 'Education', 1, NULL, 'Education'),
  ('LA', 'History of Education', 2, 'L', 'History of education'),
  ('LB', 'Theory and Practice of Education', 2, 'L', 'Theory and practice of education'),
  ('LC', 'Special Aspects of Education', 2, 'L', 'Special aspects of education'),
  ('LD', 'Individual Institutions', 2, 'L', 'Individual institutions'),
  ('LT', 'Textbooks', 2, 'L', 'Textbooks')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- M - Music and Books on Music 

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('M', 'Music', 1, NULL, 'Music and musical performance'),
  ('ML', 'Literature on Music', 2, 'M', 'Literature on music'),
  ('MT', 'Music Instruction and Study', 2, 'M', 'Music instruction and study')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- N - FINE ARTS

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('N', 'Fine Arts', 1, NULL, 'Fine arts'),
  ('N1', 'Visual Arts', 2, 'N', 'Visual arts'),
  ('NA', 'Architecture', 2, 'N', 'Architecture'),
  ('NB', 'Sculpture', 2, 'N', 'Sculpture'),
  ('NC', 'Drawing, Design, Illustration', 2, 'N', 'Drawing, design, illustration'),
  ('ND', 'Painting', 2, 'N', 'Painting'),
  ('NE', 'Print Media', 2, 'N', 'Print media'),
  ('NK', 'Decorative Arts', 2, 'N', 'Decorative arts'),
  ('NX', 'Arts in General', 2, 'N', 'Arts in general')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- P - LANGUAGE AND LITERATURE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('P', 'Language and Literature', 1, NULL, 'Language and Literature'),
  ('P1', 'Philology and Linguistics', 2, 'P', 'Philology and linguistics'),
  ('PA', 'Greek and Latin Languages and Literatures', 2, 'P', 'Greek and Latin languages and literatures'),
  ('PB', 'Modern European Languages', 2, 'P', 'Modern European languages'),
  ('PJ', 'Oriental and Indo-Iranian Philology and Literatures', 2, 'P', 'Oriental and Indo-Iranian philology and literatures'),
  ('PL', 'Languages of Eastern Asia, Africa, Oceania, Hyperborean, Indian, and Artificial Languages', 2, 'P', 'Languages of Eastern Asia, Africa, Oceania. Hyperborean, Indian, and artificial languages'),
  ('PQ', 'French, Italian, Spanish, and Portuguese Literatures', 2, 'P', 'French, Italian, Spanish, and Portuguese literatures'),
  ('PR', 'English and American Literature, Juvenile Belles Lettres', 2, 'P', 'English and American literature, Juvenile Belles lettres'),
  ('PT', 'German, Dutch, and Scandinavian Literatures', 2, 'P', 'German, Dutch, and Scandinavian literatures')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- Q - SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('Q', 'Science', 1, NULL, 'Science'),
  ('QA', 'Mathematics', 2, 'Q', 'Mathematics'),
  ('QB', 'Astronomy', 2, 'Q', 'Astronomy'),
  ('QC', 'Physics', 2, 'Q', 'Physics'),
  ('QD', 'Chemistry', 2, 'Q', 'Chemistry'),
  ('QE', 'Geology', 2, 'Q', 'Geology'),
  ('QH', 'Biology', 2, 'Q', 'Biology'),
  ('QK', 'Botany', 2, 'Q', 'Botany'),
  ('QL', 'Zoology', 2, 'Q', 'Zoology'),
  ('QM', 'Human Anatomy', 2, 'Q', 'Human anatomy'),
  ('QP', 'Physiology', 2, 'Q', 'Physiology'),
  ('QR', 'Microbiology', 2, 'Q', 'Microbiology')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- R - MEDICINE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('R', 'Medicine', 1, NULL, 'Medicine'),
  ('RA', 'Public Aspects of Medicine', 2, 'R', 'Public aspects of medicine'),
  ('RB', 'Pathology', 2, 'R', 'Pathology'),
  ('RC', 'Internal Medicine', 2, 'R', 'Internal medicine'),
  ('RD', 'Surgery', 2, 'R', 'Surgery'),
  ('RE', 'Ophthalmology', 2, 'R', 'Ophthalmology'),
  ('RF', 'Otorhinolaryngology', 2, 'R', 'Otorhinolaryngology'),
  ('RG', 'Gynecology and Obstetrics', 2, 'R', 'Gynecology and obstetrics'),
  ('RJ', 'Pediatrics', 2, 'R', 'Pediatrics'),
  ('RK', 'Dentistry', 2, 'R', 'Dentistry'),
  ('RL', 'Dermatology', 2, 'R', 'Dermatology'),
  ('RM', 'Therapeutics, Pharmacology', 2, 'R', 'Therapeutics, pharmacology'),
  ('RS', 'Pharmacy and Materia Medica', 2, 'R', 'Pharmacy and materia medica'),
  ('RT', 'Nursing', 2, 'R', 'Nursing'),
  ('RV', 'Botanic, Thomsonian, and Eclectic Medicine', 2, 'R', 'Botanic, Thomsonian, and eclectic medicine'),
  ('RX', 'Homeopathy', 2, 'R', 'Homeopathy'),
  ('RZ', 'Other Systems of Medicine', 2, 'R', 'Other systems of medicine')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- S - AGRICULTURE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('S', 'Agriculture', 1, NULL, 'Agriculture'),
  ('SB', 'Plant Culture', 2, 'S', 'Plant culture'),
  ('SD', 'Forestry', 2, 'S', 'Forestry'),
  ('SF', 'Animal Culture', 2, 'S', 'Animal culture'),
  ('SH', 'Aquaculturem, Fisheries, Angling', 2, 'S', 'Aquaculture, fisheries, angling'),
  ('SK', 'Hunting Sports', 2, 'S', 'Hunting sports')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- T - TECHNOLOGY

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('T', 'Technology', 1, NULL, 'Technology'),
  ('TA', 'General Engineering, Civil Engineering', 2, 'T', 'General engineering, civil engineering'),
  ('TC', 'Hydraulic and Ocean Engineering', 2, 'T', 'Hydraulic and ocean engineering'),
  ('TD', 'Environmental Technology, Sanitary Engineering', 2, 'T', 'Environmental technology, sanitary engineering'),
  ('TE', 'Highway Engineering, Roads and Pavements', 2, 'T', 'Highway engineering, roads and pavements'),
  ('TF', 'Railroad Engineering and Operation', 2, 'T', 'Railway engineering and operation'),
  ('TG', 'Bridge Engineering', 2, 'T', 'Bridge engineering'),
  ('TH', 'Building Construction', 2, 'T', 'Building construction'),
  ('TJ', 'Mechanical Engineering and Machinery', 2, 'T', 'Mechanical engineering and machinery'),
  ('TK', 'Electrical Engineering, Electronics, Nuclear Engineering', 2, 'T', 'Electrical engineering, electronics, nuclear engineering'),
  ('TL', 'Motor Vehicles, Aeronautics, Astronautics', 2, 'T', 'Motor vehicles, aeronautics, astronautics'),
  ('TN', 'Mining Engineering, Metallurgy', 2, 'T', 'Mining engineering, metallurgy'),
  ('TP', 'Chemical Technology', 2, 'T', 'Chemical technology'),
  ('TR', 'Photography', 2, 'T', 'Photography'),
  ('TS', 'Manufactures', 2, 'T', 'Manufactures'),
  ('TT', 'Handicrafts, Arts and Crafts', 2, 'T', 'Handicrafts, arts and crafts'),
  ('TX', 'Home Economics', 2, 'T', 'Home economics')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- U - MILITARY SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('U', 'Military Science', 1, NULL, 'Military science'),
  ('UA', 'Armies', 2, 'U', 'Armies'),
  ('UB', 'Military Administration', 2, 'U', 'Military administration'),
  ('UC', 'Maintenance and Transportation', 2, 'U', 'Maintenance and transportation'),
  ('UD', 'Infantry', 2, 'U', 'Infantry'),
  ('UE', 'Cavalry, Armor', 2, 'U', 'Cavalry, armor'),
  ('UF', 'Artillery', 2, 'U', 'Artillery'),
  ('UG', 'Military Engineering', 2, 'U', 'Military engineering'),
  ('UH', 'Other Services', 2, 'U', 'Other services')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- V - NAVAL SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('V', 'Naval Science', 1, NULL, 'Naval Science'),
  ('VA', 'Navies', 2, 'V', 'Navies'),
  ('VB', 'Naval Administration', 2, 'V', 'Naval administration'),
  ('VC', 'Naval Maintenance', 2, 'V', 'Naval maintenance'),
  ('VD', 'Naval Personnel', 2, 'V', 'Naval personnel'),
  ('VE', 'Marines', 2, 'V', 'Marines'),
  ('VF', 'Naval Ordnance', 2, 'V', 'Naval ordnance'),
  ('VG', 'Minor Services of Navies', 2, 'V', 'Minor services of navies'),
  ('VK', 'Navigation, Merchant Marine', 2, 'V', 'Navigation, merchant marine'),
  ('VM', 'Naval architecture, Shipbuilding, Marine Engineering', 2, 'V', 'Naval architecture, shipbuilding, marine engineering')
ON CONFLICT (lcc_code) DO NOTHING;

-- =============================================================================
-- Z - BIBLIOGRAPHY AND LIBRARY SCIENCE

INSERT INTO taxonomy_nodes (lcc_code, lcc_label, lcc_hierarchy_level, parent_lcc_code, scope_note) VALUES
  ('Z', 'Bibliography, Library Science, Information Resources', 1, NULL, 'Bibliography, library science, information resources'),
  ('Z1', 'Books, Writing, Paleography', 2, 'Z', 'Books, writing, paleography'),
  ('ZA', 'Information Resources', 2, 'Z', 'Information resources')
ON CONFLICT (lcc_code) DO NOTHING;
