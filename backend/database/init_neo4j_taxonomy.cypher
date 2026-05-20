// =============================================================================
// A - GENERAL WORKS

CREATE (a:TaxonomyNode {
  lcc_code: 'A',
  lcc_label: 'General Works',
  lcc_hierarchy_level: 1
});

CREATE (ac:TaxonomyNode {
  lcc_code: 'AC',
  lcc_label: 'Collections',
  lcc_hierarchy_level: 2
});

CREATE (ae:TaxonomyNode {
  lcc_code: 'AE',
  lcc_label: 'Encyclopedias',
  lcc_hierarchy_level: 2
});

CREATE (ag:TaxonomyNode {
  lcc_code: 'AG',
  lcc_label: 'Dictionaries',
  lcc_hierarchy_level: 2
});

CREATE (ai:TaxonomyNode {
  lcc_code: 'AI',
  lcc_label: 'Indexes',
  lcc_hierarchy_level: 2
});

CREATE (am:TaxonomyNode {
  lcc_code: 'AM',
  lcc_label: 'Museums',
  lcc_hierarchy_level: 2
});

CREATE (ap:TaxonomyNode {
  lcc_code: 'AP',
  lcc_label: 'Periodicals',
  lcc_hierarchy_level: 2
});

CREATE (as_node:TaxonomyNode {
  lcc_code: 'AS',
  lcc_label: 'Academies and Learned Societies',
  lcc_hierarchy_level: 2
});

CREATE (ay:TaxonomyNode {
  lcc_code: 'AY',
  lcc_label: 'Yearbooks and Almanacs',
  lcc_hierarchy_level: 2
});

CREATE (az:TaxonomyNode {
  lcc_code: 'AZ',
  lcc_label: 'History of Scholarship and Learning',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AI'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AM'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AP'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AY'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'A'})
MATCH (child:TaxonomyNode {lcc_code: 'AZ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// B - PHILOSOPHY, PSYCHOLOGY, RELIGION

CREATE (b:TaxonomyNode {
  lcc_code: 'B',
  lcc_label: 'Philosophy, Psychology, Religion',
  lcc_hierarchy_level: 1
});

CREATE (b1_phil:TaxonomyNode {
  lcc_code: 'B1',
  lcc_label: 'Philosophy',
  lcc_hierarchy_level: 2
});

CREATE (bc:TaxonomyNode {
  lcc_code: 'BC',
  lcc_label: 'Logic',
  lcc_hierarchy_level: 3
});

CREATE (bd:TaxonomyNode {
  lcc_code: 'BD',
  lcc_label: 'Speculative Philosophy',
  lcc_hierarchy_level: 3
});

CREATE (bf:TaxonomyNode {
  lcc_code: 'BF',
  lcc_label: 'Psychology',
  lcc_hierarchy_level: 3
});

CREATE (bh:TaxonomyNode {
  lcc_code: 'BH',
  lcc_label: 'Aesthetics',
  lcc_hierarchy_level: 3
});

CREATE (bj:TaxonomyNode {
  lcc_code: 'BJ',
  lcc_label: 'Ethics',
  lcc_hierarchy_level: 3
});

CREATE (b2_rel:TaxonomyNode {
  lcc_code: 'B2',
  lcc_label: 'Religions',
  lcc_hierarchy_level: 2
});

CREATE (bm:TaxonomyNode {
  lcc_code: 'BM',
  lcc_label: 'Judaism',
  lcc_hierarchy_level: 3
});

CREATE (bp:TaxonomyNode {
  lcc_code: 'BP',
  lcc_label: 'Islam',
  lcc_hierarchy_level: 3
});

CREATE (bq:TaxonomyNode {
  lcc_code: 'BQ',
  lcc_label: 'Buddhism',
  lcc_hierarchy_level: 3
});

CREATE (br:TaxonomyNode {
  lcc_code: 'BR',
  lcc_label: 'Christianity',
  lcc_hierarchy_level: 3
});

CREATE (bs:TaxonomyNode {
  lcc_code: 'BS',
  lcc_label: 'Bible',
  lcc_hierarchy_level: 3
});

CREATE (bt:TaxonomyNode {
  lcc_code: 'BT',
  lcc_label: 'Doctrinal Theology',
  lcc_hierarchy_level: 3
});

CREATE (bv:TaxonomyNode {
  lcc_code: 'BV',
  lcc_label: 'Practical Theology',
  lcc_hierarchy_level: 3
});

CREATE (bx:TaxonomyNode {
  lcc_code: 'BX',
  lcc_label: 'Christian Denominations',
  lcc_hierarchy_level: 3
});

MATCH (parent:TaxonomyNode {lcc_code: 'B'})
MATCH (child:TaxonomyNode {lcc_code: 'B1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B1'})
MATCH (child:TaxonomyNode {lcc_code: 'BC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B1'})
MATCH (child:TaxonomyNode {lcc_code: 'BD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B1'})
MATCH (child:TaxonomyNode {lcc_code: 'BF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B1'})
MATCH (child:TaxonomyNode {lcc_code: 'BH'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B1'})
MATCH (child:TaxonomyNode {lcc_code: 'BJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B'})
MATCH (child:TaxonomyNode {lcc_code: 'B2'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BM'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BP'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BQ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BV'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'B2'})
MATCH (child:TaxonomyNode {lcc_code: 'BX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// C - AUXILIARY SCIENCES OF HISTORY

CREATE (c:TaxonomyNode {
  lcc_code: 'C',
  lcc_label: 'Auxiliary Sciences of History',
  lcc_hierarchy_level: 1
});

CREATE (cb:TaxonomyNode {
  lcc_code: 'CB',
  lcc_label: 'History of Civilization',
  lcc_hierarchy_level: 2
});

CREATE (cc:TaxonomyNode {
  lcc_code: 'CC',
  lcc_label: 'Archaeology',
  lcc_hierarchy_level: 2
});

CREATE (cd:TaxonomyNode {
  lcc_code: 'CD',
  lcc_label: 'Diplomatics',
  lcc_hierarchy_level: 2
});

CREATE (ce:TaxonomyNode {
  lcc_code: 'CE',
  lcc_label: 'Technical chronology',
  lcc_hierarchy_level: 2
});

CREATE (cj:TaxonomyNode {
  lcc_code: 'CJ',
  lcc_label: 'Numismatics',
  lcc_hierarchy_level: 2
});

CREATE (cn:TaxonomyNode {
  lcc_code: 'CN',
  lcc_label: 'Inscriptions',
  lcc_hierarchy_level: 2
});

CREATE (cr:TaxonomyNode {
  lcc_code: 'CR',
  lcc_label: 'Heraldry',
  lcc_hierarchy_level: 2
});

CREATE (cs:TaxonomyNode {
  lcc_code: 'CS',
  lcc_label: 'Genealogy',
  lcc_hierarchy_level: 2
});

CREATE (ct:TaxonomyNode {
  lcc_code: 'CT',
  lcc_label: 'Biography',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CN'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'C'})
MATCH (child:TaxonomyNode {lcc_code: 'CT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// D - HISTORY (GENERAL) & E - HISTORY (AMERICA)

CREATE (d:TaxonomyNode {
  lcc_code: 'D',
  lcc_label: 'History',
  lcc_hierarchy_level: 1
});

CREATE (da:TaxonomyNode {
  lcc_code: 'DA',
  lcc_label: 'History of Great Britain',
  lcc_hierarchy_level: 2
});

CREATE (daw:TaxonomyNode {
  lcc_code: 'DAW',
  lcc_label: 'History of Central Europe',
  lcc_hierarchy_level: 2
});

CREATE (db:TaxonomyNode {
  lcc_code: 'DB',
  lcc_label: 'History of Austria, Liechtenstein, Hungary, Czechoslovakia, Austro-Hungarian Empire',
  lcc_hierarchy_level: 2
});

CREATE (dc:TaxonomyNode {
  lcc_code: 'DC',
  lcc_label: 'History of France',
  lcc_hierarchy_level: 2
});

CREATE (dd:TaxonomyNode {
  lcc_code: 'DD',
  lcc_label: 'History of Germany',
  lcc_hierarchy_level: 2
});

CREATE (de:TaxonomyNode {
  lcc_code: 'DE',
  lcc_label: 'History of the Greco-Roman world',
  lcc_hierarchy_level: 2
});

CREATE (df:TaxonomyNode {
  lcc_code: 'DF',
  lcc_label: 'History of Greece',
  lcc_hierarchy_level: 2
});

CREATE (dg:TaxonomyNode {
  lcc_code: 'DG',
  lcc_label: 'History of Italy',
  lcc_hierarchy_level: 2
});

CREATE (dh:TaxonomyNode {
  lcc_code: 'DH',
  lcc_label: 'History of Low Countries, Benelux Countries',
  lcc_hierarchy_level: 2
});

CREATE (dj:TaxonomyNode {
  lcc_code: 'DJ',
  lcc_label: 'History of Netherlands',
  lcc_hierarchy_level: 2
});

CREATE (djk:TaxonomyNode {
  lcc_code: 'DJK',
  lcc_label: 'History of Eastern Europe (General)',
  lcc_hierarchy_level: 2
});

CREATE (dk:TaxonomyNode {
  lcc_code: 'DK',
  lcc_label: 'History of Russia, Soviet Union, Former Soviet Republics',
  lcc_hierarchy_level: 2
});

CREATE (dl:TaxonomyNode {
  lcc_code: 'DL',
  lcc_label: 'History of Northern Europe, Scandinavia',
  lcc_hierarchy_level: 2
});

CREATE (dp:TaxonomyNode {
  lcc_code: 'DP',
  lcc_label: 'History of Spain',
  lcc_hierarchy_level: 2
});

CREATE (dq:TaxonomyNode {
  lcc_code: 'DQ',
  lcc_label: 'History of Switzerland',
  lcc_hierarchy_level: 2
});

CREATE (dr:TaxonomyNode {
  lcc_code: 'DR',
  lcc_label: 'History of Balkan Peninsula',
  lcc_hierarchy_level: 2
});

CREATE (ds:TaxonomyNode {
  lcc_code: 'DS',
  lcc_label: 'History of Asia',
  lcc_hierarchy_level: 2
});

CREATE (dt:TaxonomyNode {
  lcc_code: 'DT',
  lcc_label: 'History of Africa',
  lcc_hierarchy_level: 2
});

CREATE (du:TaxonomyNode {
  lcc_code: 'DU',
  lcc_label: 'History of Oceania (South Seas)',
  lcc_hierarchy_level: 2
});

CREATE (dx:TaxonomyNode {
  lcc_code: 'DX',
  lcc_label: 'History of Romanies',
  lcc_hierarchy_level: 2
});

CREATE (e:TaxonomyNode {
  lcc_code: 'E',
  lcc_label: 'History of America',
  lcc_hierarchy_level: 2
});

CREATE (e1:TaxonomyNode {
  lcc_code: 'E1',
  lcc_label: 'History of United States',
  lcc_hierarchy_level: 3
});

CREATE (e2:TaxonomyNode {
  lcc_code: 'E2',
  lcc_label: 'History of British America',
  lcc_hierarchy_level: 3
});

CREATE (e3:TaxonomyNode {
  lcc_code: 'E3',
  lcc_label: 'History of Dutch America',
  lcc_hierarchy_level: 3
});

CREATE (e4:TaxonomyNode {
  lcc_code: 'E4',
  lcc_label: 'History of French America',
  lcc_hierarchy_level: 3
});

CREATE (e5:TaxonomyNode {
  lcc_code: 'E5',
  lcc_label: 'History of Latin America, Spanish America',
  lcc_hierarchy_level: 3
});

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DAW'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DH'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DJK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DP'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DQ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DU'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'DX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'D'})
MATCH (child:TaxonomyNode {lcc_code: 'E'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'E'})
MATCH (child:TaxonomyNode {lcc_code: 'E1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'E'})
MATCH (child:TaxonomyNode {lcc_code: 'E2'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'E'})
MATCH (child:TaxonomyNode {lcc_code: 'E3'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'E'})
MATCH (child:TaxonomyNode {lcc_code: 'E4'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'E'})
MATCH (child:TaxonomyNode {lcc_code: 'E5'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// G - GEOGRAPHY, MAPS, ANTHROPOLOGY, RECREATION

CREATE (g:TaxonomyNode {
  lcc_code: 'G',
  lcc_label: 'Geography, Maps, Anthropology, Recreation',
  lcc_hierarchy_level: 1
});

CREATE (g1:TaxonomyNode {
  lcc_code: 'G1',
  lcc_label: 'Geography',
  lcc_hierarchy_level: 2
});

CREATE (g2:TaxonomyNode {
  lcc_code: 'G2',
  lcc_label: 'Atlases',
  lcc_hierarchy_level: 2
});

CREATE (g3:TaxonomyNode {
  lcc_code: 'G3',
  lcc_label: 'Globes',
  lcc_hierarchy_level: 2
});

CREATE (g4:TaxonomyNode {
  lcc_code: 'G4',
  lcc_label: 'Maps',
  lcc_hierarchy_level: 2
});

CREATE (ga:TaxonomyNode {
  lcc_code: 'GA',
  lcc_label: 'Mathematical Geography, Cartography',
  lcc_hierarchy_level: 2
});

CREATE (gb:TaxonomyNode {
  lcc_code: 'GB',
  lcc_label: 'Physical Geography',
  lcc_hierarchy_level: 2
});

CREATE (gc:TaxonomyNode {
  lcc_code: 'GC',
  lcc_label: 'Oceanography',
  lcc_hierarchy_level: 2
});

CREATE (ge:TaxonomyNode {
  lcc_code: 'GE',
  lcc_label: 'Environmental Sciences',
  lcc_hierarchy_level: 2
});

CREATE (gf:TaxonomyNode {
  lcc_code: 'GF',
  lcc_label: 'Human Ecology',
  lcc_hierarchy_level: 2
});

CREATE (gn:TaxonomyNode {
  lcc_code: 'GN',
  lcc_label: 'Anthropology',
  lcc_hierarchy_level: 2
});

CREATE (gr:TaxonomyNode {
  lcc_code: 'GR',
  lcc_label: 'Folklore',
  lcc_hierarchy_level: 2
});

CREATE (gt:TaxonomyNode {
  lcc_code: 'GT',
  lcc_label: 'Manners and Customs',
  lcc_hierarchy_level: 2
});

CREATE (gv:TaxonomyNode {
  lcc_code: 'GV',
  lcc_label: 'Recreation and Leisure',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'G1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'G2'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'G3'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'G4'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GN'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'G'})
MATCH (child:TaxonomyNode {lcc_code: 'GV'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// H - SOCIAL SCIENCES

CREATE (h:TaxonomyNode {
  lcc_code: 'H',
  lcc_label: 'Social Sciences',
  lcc_hierarchy_level: 1
});

CREATE (ha:TaxonomyNode {
  lcc_code: 'HA',
  lcc_label: 'Statistics of Social Sciences',
  lcc_hierarchy_level: 2
});

CREATE (hb:TaxonomyNode {
  lcc_code: 'HB',
  lcc_label: 'Economic Theory and Demography',
  lcc_hierarchy_level: 2
});

CREATE (hc:TaxonomyNode {
  lcc_code: 'HC',
  lcc_label: 'Economic History and Conditions',
  lcc_hierarchy_level: 2
});

CREATE (hd:TaxonomyNode {
  lcc_code: 'HD',
  lcc_label: 'Industries, Land Use and Labor',
  lcc_hierarchy_level: 2
});

CREATE (he:TaxonomyNode {
  lcc_code: 'HE',
  lcc_label: 'Transportation and Communications',
  lcc_hierarchy_level: 2
});

CREATE (hf:TaxonomyNode {
  lcc_code: 'HF',
  lcc_label: 'Commerce',
  lcc_hierarchy_level: 2
});

CREATE (hg:TaxonomyNode {
  lcc_code: 'HG',
  lcc_label: 'Finance',
  lcc_hierarchy_level: 2
});

CREATE (hj:TaxonomyNode {
  lcc_code: 'HJ',
  lcc_label: 'Public Finance',
  lcc_hierarchy_level: 2
});

CREATE (hm:TaxonomyNode {
  lcc_code: 'HM',
  lcc_label: 'Sociology',
  lcc_hierarchy_level: 2
});

CREATE (hn:TaxonomyNode {
  lcc_code: 'HN',
  lcc_label: 'Social History, Conditions and Social Problems',
  lcc_hierarchy_level: 2
});

CREATE (hq:TaxonomyNode {
  lcc_code: 'HQ',
  lcc_label: 'Family, Marriage, Women',
  lcc_hierarchy_level: 2
});

CREATE (hs:TaxonomyNode {
  lcc_code: 'HS',
  lcc_label: 'Societies',
  lcc_hierarchy_level: 2
});

CREATE (ht:TaxonomyNode {
  lcc_code: 'HT',
  lcc_label: 'Communities, Classes, Races',
  lcc_hierarchy_level: 2
});

CREATE (hv:TaxonomyNode {
  lcc_code: 'HV',
  lcc_label: 'Social Pathology, Social and Public welfare, Criminology',
  lcc_hierarchy_level: 2
});

CREATE (hx:TaxonomyNode {
  lcc_code: 'HX',
  lcc_label: 'Socialism, Communism, Anarchism',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HM'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HN'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HQ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HV'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'H'})
MATCH (child:TaxonomyNode {lcc_code: 'HX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// J - POLITICAL SCIENCE

CREATE (j:TaxonomyNode {
  lcc_code: 'J',
  lcc_label: 'Political Science',
  lcc_hierarchy_level: 1
});

CREATE (j1:TaxonomyNode {
  lcc_code: 'J1',
  lcc_label: 'General Legislative and Executive Papers',
  lcc_hierarchy_level: 2
});

CREATE (jc:TaxonomyNode {
  lcc_code: 'JC',
  lcc_label: 'Political Theory, The State, Theories of the State',
  lcc_hierarchy_level: 2
});

CREATE (jf:TaxonomyNode {
  lcc_code: 'JF',
  lcc_label: 'Political Institutions and Public Administration (General)',
  lcc_hierarchy_level: 2
});

CREATE (jj:TaxonomyNode {
  lcc_code: 'JJ',
  lcc_label: 'Political Institutions and Public Administration (North America)',
  lcc_hierarchy_level: 3
});

CREATE (jk:TaxonomyNode {
  lcc_code: 'JK',
  lcc_label: 'Political Institutions and Public Administration (United States)',
  lcc_hierarchy_level: 3
});

CREATE (jl:TaxonomyNode {
  lcc_code: 'JL',
  lcc_label: 'Political Institutions and Public Administration (Canada and Latin America)',
  lcc_hierarchy_level: 3
});

CREATE (jn:TaxonomyNode {
  lcc_code: 'JN',
  lcc_label: 'Political Institutions and Public Administration (Europe)',
  lcc_hierarchy_level: 3
});

CREATE (js:TaxonomyNode {
  lcc_code: 'JS',
  lcc_label: 'Political Institutions and Public Administration (United States Local and Municipal)',
  lcc_hierarchy_level: 3
});

CREATE (jq:TaxonomyNode {
  lcc_code: 'JQ',
  lcc_label: 'Political Institutions and Public Administration (Asia, Africa, Australia, Pacific Area)',
  lcc_hierarchy_level: 3
});

CREATE (jv:TaxonomyNode {
  lcc_code: 'JV',
  lcc_label: 'Colonies and Colonization, Emigration and Immigration, International Migration',
  lcc_hierarchy_level: 2
});

CREATE (jx:TaxonomyNode {
  lcc_code: 'JX',
  lcc_label: 'International Law',
  lcc_hierarchy_level: 2
});

CREATE (jz:TaxonomyNode {
  lcc_code: 'JZ',
  lcc_label: 'International Relations',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'J'})
MATCH (child:TaxonomyNode {lcc_code: 'J1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'J'})
MATCH (child:TaxonomyNode {lcc_code: 'JC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'J'})
MATCH (child:TaxonomyNode {lcc_code: 'JF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'JF'})
MATCH (child:TaxonomyNode {lcc_code: 'JJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'JF'})
MATCH (child:TaxonomyNode {lcc_code: 'JK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'JF'})
MATCH (child:TaxonomyNode {lcc_code: 'JL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'JF'})
MATCH (child:TaxonomyNode {lcc_code: 'JN'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'JF'})
MATCH (child:TaxonomyNode {lcc_code: 'JS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'JF'})
MATCH (child:TaxonomyNode {lcc_code: 'JQ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'J'})
MATCH (child:TaxonomyNode {lcc_code: 'JV'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'J'})
MATCH (child:TaxonomyNode {lcc_code: 'JX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'J'})
MATCH (child:TaxonomyNode {lcc_code: 'JZ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// K - LAW

CREATE (k:TaxonomyNode {
  lcc_code: 'K',
  lcc_label: 'Law',
  lcc_hierarchy_level: 1
});

CREATE (kb:TaxonomyNode {
  lcc_code: 'KB',
  lcc_label: 'Religious Law',
  lcc_hierarchy_level: 2
});

CREATE (kd:TaxonomyNode {
  lcc_code: 'KD',
  lcc_label: 'Law of the United Kingdom and Ireland',
  lcc_hierarchy_level: 2
});

CREATE (ke:TaxonomyNode {
  lcc_code: 'KE',
  lcc_label: 'Law of Canada',
  lcc_hierarchy_level: 2
});

CREATE (kf:TaxonomyNode {
  lcc_code: 'KF',
  lcc_label: 'Law of the United States',
  lcc_hierarchy_level: 2
});

CREATE (ki:TaxonomyNode {
  lcc_code: 'KI',
  lcc_label: 'Law of the Law of Indigenous Peoples',
  lcc_hierarchy_level: 2
});

CREATE (kj:TaxonomyNode {
  lcc_code: 'KJ',
  lcc_label: 'Law of Europe',
  lcc_hierarchy_level: 2
});

CREATE (kl:TaxonomyNode {
  lcc_code: 'KL',
  lcc_label: 'Law of Asia and Eurasia, Africa, Pacific Area, and Antarctica',
  lcc_hierarchy_level: 2
});

CREATE (kz:TaxonomyNode {
  lcc_code: 'KZ',
  lcc_label: 'Law of Nations',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KI'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'K'})
MATCH (child:TaxonomyNode {lcc_code: 'KZ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// L - EDUCATION

CREATE (l:TaxonomyNode {
  lcc_code: 'L',
  lcc_label: 'Education',
  lcc_hierarchy_level: 1
});

CREATE (la:TaxonomyNode {
  lcc_code: 'LA',
  lcc_label: 'History of Education',
  lcc_hierarchy_level: 2
});

CREATE (lb:TaxonomyNode {
  lcc_code: 'LB',
  lcc_label: 'Theory and Practice of Education',
  lcc_hierarchy_level: 2
});

CREATE (lc:TaxonomyNode {
  lcc_code: 'LC',
  lcc_label: 'Special Aspects of Education',
  lcc_hierarchy_level: 2
});

CREATE (ld:TaxonomyNode {
  lcc_code: 'LD',
  lcc_label: 'Individual Institutions',
  lcc_hierarchy_level: 2
});

CREATE (lt:TaxonomyNode {
  lcc_code: 'LT',
  lcc_label: 'Textbooks',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'L'})
MATCH (child:TaxonomyNode {lcc_code: 'LA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'L'})
MATCH (child:TaxonomyNode {lcc_code: 'LB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'L'})
MATCH (child:TaxonomyNode {lcc_code: 'LC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'L'})
MATCH (child:TaxonomyNode {lcc_code: 'LD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'L'})
MATCH (child:TaxonomyNode {lcc_code: 'LT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// M - MUSIC AND BOOKS ON MUSIC

CREATE (m:TaxonomyNode {
  lcc_code: 'M',
  lcc_label: 'Music',
  lcc_hierarchy_level: 1
});

CREATE (ml:TaxonomyNode {
  lcc_code: 'ML',
  lcc_label: 'Literature on Music',
  lcc_hierarchy_level: 2
});

CREATE (mt:TaxonomyNode {
  lcc_code: 'MT',
  lcc_label: 'Music Instruction and Study',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'M'})
MATCH (child:TaxonomyNode {lcc_code: 'ML'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'M'})
MATCH (child:TaxonomyNode {lcc_code: 'MT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// N - FINE ARTS

CREATE (n:TaxonomyNode {
  lcc_code: 'N',
  lcc_label: 'Fine Arts',
  lcc_hierarchy_level: 1
});

CREATE (n1:TaxonomyNode {
  lcc_code: 'N1',
  lcc_label: 'Visual Arts',
  lcc_hierarchy_level: 2
});

CREATE (na:TaxonomyNode {
  lcc_code: 'NA',
  lcc_label: 'Architecture',
  lcc_hierarchy_level: 2
});

CREATE (nb:TaxonomyNode {
  lcc_code: 'NB',
  lcc_label: 'Sculpture',
  lcc_hierarchy_level: 2
});

CREATE (nc:TaxonomyNode {
  lcc_code: 'NC',
  lcc_label: 'Drawing, Design, Illustration',
  lcc_hierarchy_level: 2
});

CREATE (nd:TaxonomyNode {
  lcc_code: 'ND',
  lcc_label: 'Painting',
  lcc_hierarchy_level: 2
});

CREATE (ne:TaxonomyNode {
  lcc_code: 'NE',
  lcc_label: 'Print Media',
  lcc_hierarchy_level: 2
});

CREATE (nk:TaxonomyNode {
  lcc_code: 'NK',
  lcc_label: 'Decorative Arts',
  lcc_hierarchy_level: 2
});

CREATE (nx:TaxonomyNode {
  lcc_code: 'NX',
  lcc_label: 'Arts in General',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'N1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'NA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'NB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'NC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'ND'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'NE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'NK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'N'})
MATCH (child:TaxonomyNode {lcc_code: 'NX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// P - LANGUAGE AND LITERATURE

CREATE (p:TaxonomyNode {
  lcc_code: 'P',
  lcc_label: 'Language and Literature',
  lcc_hierarchy_level: 1
});

CREATE (p1:TaxonomyNode {
  lcc_code: 'P1',
  lcc_label: 'Philology and Linguistics',
  lcc_hierarchy_level: 2
});

CREATE (pa:TaxonomyNode {
  lcc_code: 'PA',
  lcc_label: 'Greek and Latin Languages and Literatures',
  lcc_hierarchy_level: 2
});

CREATE (pb:TaxonomyNode {
  lcc_code: 'PB',
  lcc_label: 'Modern European Languages',
  lcc_hierarchy_level: 2
});

CREATE (pj:TaxonomyNode {
  lcc_code: 'PJ',
  lcc_label: 'Oriental and Indo-Iranian Philology and Literatures',
  lcc_hierarchy_level: 2
});

CREATE (pl:TaxonomyNode {
  lcc_code: 'PL',
  lcc_label: 'Languages of Eastern Asia, Africa, Oceania, Hyperborean, Indian, and Artificial Languages',
  lcc_hierarchy_level: 2
});

CREATE (pq:TaxonomyNode {
  lcc_code: 'PQ',
  lcc_label: 'French, Italian, Spanish, and Portuguese Literatures',
  lcc_hierarchy_level: 2
});

CREATE (pr:TaxonomyNode {
  lcc_code: 'PR',
  lcc_label: 'English and American Literature, Juvenile Belles Lettres',
  lcc_hierarchy_level: 2
});

CREATE (pt:TaxonomyNode {
  lcc_code: 'PT',
  lcc_label: 'German, Dutch, and Scandinavian Literatures',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'P1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PQ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'P'})
MATCH (child:TaxonomyNode {lcc_code: 'PT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// Q - SCIENCE

CREATE (q:TaxonomyNode {
  lcc_code: 'Q',
  lcc_label: 'Science',
  lcc_hierarchy_level: 1
});

CREATE (qa:TaxonomyNode {
  lcc_code: 'QA',
  lcc_label: 'Mathematics',
  lcc_hierarchy_level: 2
});

CREATE (qb:TaxonomyNode {
  lcc_code: 'QB',
  lcc_label: 'Astronomy',
  lcc_hierarchy_level: 2
});

CREATE (qc:TaxonomyNode {
  lcc_code: 'QC',
  lcc_label: 'Physics',
  lcc_hierarchy_level: 2
});

CREATE (qd:TaxonomyNode {
  lcc_code: 'QD',
  lcc_label: 'Chemistry',
  lcc_hierarchy_level: 2
});

CREATE (qe:TaxonomyNode {
  lcc_code: 'QE',
  lcc_label: 'Geology',
  lcc_hierarchy_level: 2
});

CREATE (qh:TaxonomyNode {
  lcc_code: 'QH',
  lcc_label: 'Biology',
  lcc_hierarchy_level: 2
});

CREATE (qk:TaxonomyNode {
  lcc_code: 'QK',
  lcc_label: 'Botany',
  lcc_hierarchy_level: 2
});

CREATE (ql:TaxonomyNode {
  lcc_code: 'QL',
  lcc_label: 'Zoology',
  lcc_hierarchy_level: 2
});

CREATE (qm:TaxonomyNode {
  lcc_code: 'QM',
  lcc_label: 'Human Anatomy',
  lcc_hierarchy_level: 2
});

CREATE (qp:TaxonomyNode {
  lcc_code: 'QP',
  lcc_label: 'Physiology',
  lcc_hierarchy_level: 2
});

CREATE (qr:TaxonomyNode {
  lcc_code: 'QR',
  lcc_label: 'Microbiology',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QH'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QM'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QP'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Q'})
MATCH (child:TaxonomyNode {lcc_code: 'QR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// R - MEDICINE

CREATE (r:TaxonomyNode {
  lcc_code: 'R',
  lcc_label: 'Medicine',
  lcc_hierarchy_level: 1
});

CREATE (ra:TaxonomyNode {
  lcc_code: 'RA',
  lcc_label: 'Public Aspects of Medicine',
  lcc_hierarchy_level: 2
});

CREATE (rb:TaxonomyNode {
  lcc_code: 'RB',
  lcc_label: 'Pathology',
  lcc_hierarchy_level: 2
});

CREATE (rc:TaxonomyNode {
  lcc_code: 'RC',
  lcc_label: 'Internal Medicine',
  lcc_hierarchy_level: 2
});

CREATE (rd:TaxonomyNode {
  lcc_code: 'RD',
  lcc_label: 'Surgery',
  lcc_hierarchy_level: 2
});

CREATE (re:TaxonomyNode {
  lcc_code: 'RE',
  lcc_label: 'Ophthalmology',
  lcc_hierarchy_level: 2
});

CREATE (rf:TaxonomyNode {
  lcc_code: 'RF',
  lcc_label: 'Otorhinolaryngology',
  lcc_hierarchy_level: 2
});

CREATE (rg:TaxonomyNode {
  lcc_code: 'RG',
  lcc_label: 'Gynecology and Obstetrics',
  lcc_hierarchy_level: 2
});

CREATE (rj:TaxonomyNode {
  lcc_code: 'RJ',
  lcc_label: 'Pediatrics',
  lcc_hierarchy_level: 2
});

CREATE (rk:TaxonomyNode {
  lcc_code: 'RK',
  lcc_label: 'Dentistry',
  lcc_hierarchy_level: 2
});

CREATE (rl:TaxonomyNode {
  lcc_code: 'RL',
  lcc_label: 'Dermatology',
  lcc_hierarchy_level: 2
});

CREATE (rm:TaxonomyNode {
  lcc_code: 'RM',
  lcc_label: 'Therapeutics, Pharmacology',
  lcc_hierarchy_level: 2
});

CREATE (rs:TaxonomyNode {
  lcc_code: 'RS',
  lcc_label: 'Pharmacy and Materia Medica',
  lcc_hierarchy_level: 2
});

CREATE (rt:TaxonomyNode {
  lcc_code: 'RT',
  lcc_label: 'Nursing',
  lcc_hierarchy_level: 2
});

CREATE (rv:TaxonomyNode {
  lcc_code: 'RV',
  lcc_label: 'Botanic, Thomsonian, and Eclectic Medicine',
  lcc_hierarchy_level: 2
});

CREATE (rx:TaxonomyNode {
  lcc_code: 'RX',
  lcc_label: 'Homeopathy',
  lcc_hierarchy_level: 2
});

CREATE (rz:TaxonomyNode {
  lcc_code: 'RZ',
  lcc_label: 'Other Systems of Medicine',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RM'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RV'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'R'})
MATCH (child:TaxonomyNode {lcc_code: 'RZ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// S - AGRICULTURE

CREATE (s:TaxonomyNode {
  lcc_code: 'S',
  lcc_label: 'Agriculture',
  lcc_hierarchy_level: 1
});

CREATE (sb:TaxonomyNode {
  lcc_code: 'SB',
  lcc_label: 'Plant Culture',
  lcc_hierarchy_level: 2
});

CREATE (sd:TaxonomyNode {
  lcc_code: 'SD',
  lcc_label: 'Forestry',
  lcc_hierarchy_level: 2
});

CREATE (sf:TaxonomyNode {
  lcc_code: 'SF',
  lcc_label: 'Animal Culture',
  lcc_hierarchy_level: 2
});

CREATE (sh:TaxonomyNode {
  lcc_code: 'SH',
  lcc_label: 'Aquaculture, Fisheries, Angling',
  lcc_hierarchy_level: 2
});

CREATE (sk:TaxonomyNode {
  lcc_code: 'SK',
  lcc_label: 'Hunting Sports',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'S'})
MATCH (child:TaxonomyNode {lcc_code: 'SB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'S'})
MATCH (child:TaxonomyNode {lcc_code: 'SD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'S'})
MATCH (child:TaxonomyNode {lcc_code: 'SF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'S'})
MATCH (child:TaxonomyNode {lcc_code: 'SH'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'S'})
MATCH (child:TaxonomyNode {lcc_code: 'SK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// T - TECHNOLOGY

CREATE (t:TaxonomyNode {
  lcc_code: 'T',
  lcc_label: 'Technology',
  lcc_hierarchy_level: 1
});

CREATE (ta:TaxonomyNode {
  lcc_code: 'TA',
  lcc_label: 'General Engineering, Civil Engineering',
  lcc_hierarchy_level: 2
});

CREATE (tc:TaxonomyNode {
  lcc_code: 'TC',
  lcc_label: 'Hydraulic and Ocean Engineering',
  lcc_hierarchy_level: 2
});

CREATE (td:TaxonomyNode {
  lcc_code: 'TD',
  lcc_label: 'Environmental Technology, Sanitary Engineering',
  lcc_hierarchy_level: 2
});

CREATE (te:TaxonomyNode {
  lcc_code: 'TE',
  lcc_label: 'Highway Engineering, Roads and Pavements',
  lcc_hierarchy_level: 2
});

CREATE (tf:TaxonomyNode {
  lcc_code: 'TF',
  lcc_label: 'Railroad Engineering and Operation',
  lcc_hierarchy_level: 2
});

CREATE (tg:TaxonomyNode {
  lcc_code: 'TG',
  lcc_label: 'Bridge Engineering',
  lcc_hierarchy_level: 2
});

CREATE (th:TaxonomyNode {
  lcc_code: 'TH',
  lcc_label: 'Building Construction',
  lcc_hierarchy_level: 2
});

CREATE (tj:TaxonomyNode {
  lcc_code: 'TJ',
  lcc_label: 'Mechanical Engineering and Machinery',
  lcc_hierarchy_level: 2
});

CREATE (tk:TaxonomyNode {
  lcc_code: 'TK',
  lcc_label: 'Electrical Engineering, Electronics, Nuclear Engineering',
  lcc_hierarchy_level: 2
});

CREATE (tl:TaxonomyNode {
  lcc_code: 'TL',
  lcc_label: 'Motor Vehicles, Aeronautics, Astronautics',
  lcc_hierarchy_level: 2
});

CREATE (tn:TaxonomyNode {
  lcc_code: 'TN',
  lcc_label: 'Mining Engineering, Metallurgy',
  lcc_hierarchy_level: 2
});

CREATE (tp:TaxonomyNode {
  lcc_code: 'TP',
  lcc_label: 'Chemical Technology',
  lcc_hierarchy_level: 2
});

CREATE (tr:TaxonomyNode {
  lcc_code: 'TR',
  lcc_label: 'Photography',
  lcc_hierarchy_level: 2
});

CREATE (ts:TaxonomyNode {
  lcc_code: 'TS',
  lcc_label: 'Manufactures',
  lcc_hierarchy_level: 2
});

CREATE (tt:TaxonomyNode {
  lcc_code: 'TT',
  lcc_label: 'Handicrafts, Arts and Crafts',
  lcc_hierarchy_level: 2
});

CREATE (tx:TaxonomyNode {
  lcc_code: 'TX',
  lcc_label: 'Home Economics',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TH'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TJ'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TL'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TN'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TP'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TR'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TS'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TT'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'T'})
MATCH (child:TaxonomyNode {lcc_code: 'TX'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// U - MILITARY SCIENCE

CREATE (u:TaxonomyNode {
  lcc_code: 'U',
  lcc_label: 'Military Science',
  lcc_hierarchy_level: 1
});

CREATE (ua:TaxonomyNode {
  lcc_code: 'UA',
  lcc_label: 'Armies',
  lcc_hierarchy_level: 2
});

CREATE (ub:TaxonomyNode {
  lcc_code: 'UB',
  lcc_label: 'Military Administration',
  lcc_hierarchy_level: 2
});

CREATE (uc:TaxonomyNode {
  lcc_code: 'UC',
  lcc_label: 'Maintenance and Transportation',
  lcc_hierarchy_level: 2
});

CREATE (ud:TaxonomyNode {
  lcc_code: 'UD',
  lcc_label: 'Infantry',
  lcc_hierarchy_level: 2
});

CREATE (ue:TaxonomyNode {
  lcc_code: 'UE',
  lcc_label: 'Cavalry, Armor',
  lcc_hierarchy_level: 2
});

CREATE (uf:TaxonomyNode {
  lcc_code: 'UF',
  lcc_label: 'Artillery',
  lcc_hierarchy_level: 2
});

CREATE (ug:TaxonomyNode {
  lcc_code: 'UG',
  lcc_label: 'Military Engineering',
  lcc_hierarchy_level: 2
});

CREATE (uh:TaxonomyNode {
  lcc_code: 'UH',
  lcc_label: 'Other Services',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'U'})
MATCH (child:TaxonomyNode {lcc_code: 'UH'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// V - NAVAL SCIENCE

CREATE (v:TaxonomyNode {
  lcc_code: 'V',
  lcc_label: 'Naval Science',
  lcc_hierarchy_level: 1
});

CREATE (va:TaxonomyNode {
  lcc_code: 'VA',
  lcc_label: 'Navies',
  lcc_hierarchy_level: 2
});

CREATE (vb:TaxonomyNode {
  lcc_code: 'VB',
  lcc_label: 'Naval Administration',
  lcc_hierarchy_level: 2
});

CREATE (vc:TaxonomyNode {
  lcc_code: 'VC',
  lcc_label: 'Naval Maintenance',
  lcc_hierarchy_level: 2
});

CREATE (vd:TaxonomyNode {
  lcc_code: 'VD',
  lcc_label: 'Naval Personnel',
  lcc_hierarchy_level: 2
});

CREATE (ve:TaxonomyNode {
  lcc_code: 'VE',
  lcc_label: 'Marines',
  lcc_hierarchy_level: 2
});

CREATE (vf:TaxonomyNode {
  lcc_code: 'VF',
  lcc_label: 'Naval Ordnance',
  lcc_hierarchy_level: 2
});

CREATE (vg:TaxonomyNode {
  lcc_code: 'VG',
  lcc_label: 'Minor Services of Navies',
  lcc_hierarchy_level: 2
});

CREATE (vk:TaxonomyNode {
  lcc_code: 'VK',
  lcc_label: 'Navigation, Merchant Marine',
  lcc_hierarchy_level: 2
});

CREATE (vm:TaxonomyNode {
  lcc_code: 'VM',
  lcc_label: 'Naval architecture, Shipbuilding, Marine Engineering',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VB'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VC'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VD'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VE'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VF'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VG'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VK'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'V'})
MATCH (child:TaxonomyNode {lcc_code: 'VM'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

// =============================================================================
// Z - BIBLIOGRAPHY AND LIBRARY SCIENCE

CREATE (z:TaxonomyNode {
  lcc_code: 'Z',
  lcc_label: 'Bibliography, Library Science, Information Resources',
  lcc_hierarchy_level: 1
});

CREATE (z1:TaxonomyNode {
  lcc_code: 'Z1',
  lcc_label: 'Books, Writing, Paleography',
  lcc_hierarchy_level: 2
});

CREATE (za:TaxonomyNode {
  lcc_code: 'ZA',
  lcc_label: 'Information Resources',
  lcc_hierarchy_level: 2
});

MATCH (parent:TaxonomyNode {lcc_code: 'Z'})
MATCH (child:TaxonomyNode {lcc_code: 'Z1'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

MATCH (parent:TaxonomyNode {lcc_code: 'Z'})
MATCH (child:TaxonomyNode {lcc_code: 'ZA'})
CREATE (parent)-[:PARENT_OF]->(child)
CREATE (child)-[:CHILD_OF]->(parent);

