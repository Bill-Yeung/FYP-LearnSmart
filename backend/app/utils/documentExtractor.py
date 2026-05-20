import json
from pathlib import Path
from typing import Dict, List, Any


class DocumentExtractor:

    def __init__(self, source_file: str = 'parsed_document.json'):
        self.source_file = source_file
        self.data = None
        self.concepts_output = {}
        self.chunks_output = {}
        self.relationships_output = {}

    def load_document(self) -> bool:
        try:
            with open(self.source_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            print(f"Loaded: {self.source_file}")
            return True
        except FileNotFoundError:
            print(f"File not found: {self.source_file}")
            return False
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return False

    def extract_concepts(self) -> Dict[str, Any]:
        if not self.data:
            print("No source data loaded")
            return {}

        concepts = self.data.get('concepts', [])
        metadata = self.data.get('document_metadata', {})

        self.concepts_output = {
            'document_metadata': {
                'title': metadata.get('title', ''),
                'estimated_reading_time': metadata.get('estimated_reading_time', ''),
                'main_topic': metadata.get('main_topic', ''),
                'difficulty_level': metadata.get('difficulty_level', ''),
                'language': metadata.get('language', '')
            },
            'concepts': []
        }

        for concept in concepts:
            concept_obj = {
                'id': concept.get('id', ''),
                'title': concept.get('title', ''),
                'description': concept.get('description', ''),
                'concept_type': concept.get('concept_type', ''),
                'difficulty': concept.get('difficulty', 0),
                'keywords': concept.get('keywords', []),
                'aliases': concept.get('aliases', []),
                'confidence': concept.get('confidence', 0.0),
                'extracted_from': concept.get('extracted_from', []),
                'related_concepts': concept.get('related_concepts', [])
            }
            self.concepts_output['concepts'].append(concept_obj)

        print(f"Extracted {len(self.concepts_output['concepts'])} concepts")
        return self.concepts_output

    def extract_chunks(self) -> Dict[str, Any]:
        if not self.data:
            print("No source data loaded")
            return {}

        chunks = self.data.get('chunks', [])
        mappings = self.data.get('concept_chunk_mapping', [])

        self.chunks_output = {
            'chunks': [],
            'concept_chunk_mapping': []
        }

        for chunk in chunks:
            chunk_obj = {
                'id': chunk.get('id', ''),
                'text': chunk.get('text', ''),
                'start_pos': chunk.get('start_pos', 0),
                'end_pos': chunk.get('end_pos', 0),
                'pages': chunk.get('pages', []),
                'main_concepts': chunk.get('main_concepts', []),
                'secondary_concepts': chunk.get('secondary_concepts', []),
                'chunk_type': chunk.get('chunk_type', 'paragraph'),
                'summary': chunk.get('summary', ''),
                'has_definitions': self._contains_definition(chunk.get('text', '')),
                'has_examples': self._contains_example(chunk.get('text', ''))
            }
            self.chunks_output['chunks'].append(chunk_obj)

        for mapping in mappings:
            mapping_obj = {
                'concept': mapping.get('concept', ''),
                'concept_id': mapping.get('concept_id', ''),
                'chunk_id': mapping.get('chunk_id', ''),
                'importance': mapping.get('importance', 'mention'),
                'positions': mapping.get('positions', []),
                'context': mapping.get('context', '')
            }
            self.chunks_output['concept_chunk_mapping'].append(mapping_obj)

        print(f"Extracted {len(self.chunks_output['chunks'])} chunks")
        print(f"Extracted {len(self.chunks_output['concept_chunk_mapping'])} concept-chunk mappings")
        return self.chunks_output

    def extract_relationships(self) -> Dict[str, Any]:
        if not self.data:
            print("No source data loaded")
            return {}

        relationships = self.data.get('relationships', [])

        self.relationships_output = {
            'relationships': []
        }

        for rel in relationships:
            rel_obj = {
                'id': rel.get('id', ''),
                'source': rel.get('source', ''),
                'target': rel.get('target', ''),
                'type': rel.get('type', ''),
                'strength': rel.get('strength', 0.0),
                'evidence': rel.get('evidence', ''),
                'bidirectional': rel.get('bidirectional', False)
            }
            self.relationships_output['relationships'].append(rel_obj)

        concepts_count = len(self.data.get('concepts', []))
        chunks_count = len(self.data.get('chunks', []))

        self.relationships_output['quality_metrics'] = {
            'total_concepts': concepts_count,
            'total_relationships': len(self.relationships_output['relationships']),
            'total_chunks': chunks_count,
            'coverage_score': self._calculate_coverage(),
            'consistency_score': self._calculate_consistency(),
            'missing_links': self._find_missing_links()
        }

        self.relationships_output['processing_notes'] = {
            'ambiguous_terms': self._identify_ambiguous_terms(),
            'suggested_review': []
        }

        print(f"Extracted {len(self.relationships_output['relationships'])} relationships")
        return self.relationships_output

    def _contains_definition(self, text: str) -> bool:
        definition_markers = ['is', 'defined as', 'refers to', 'defined by']
        return any(marker in text.lower() for marker in definition_markers)

    def _contains_example(self, text: str) -> bool:
        example_markers = ['example', 'e.g.', 'for instance', 'such as']
        return any(marker in text.lower() for marker in example_markers)

    def _calculate_coverage(self) -> float:
        if not self.data:
            return 0.0
        concepts_count = len(self.data.get('concepts', []))
        relationships_count = len(self.relationships_output.get('relationships', []))
        if concepts_count == 0:
            return 0.0
        coverage = min(1.0, relationships_count / (concepts_count * 2))
        return round(coverage, 2)

    def _calculate_consistency(self) -> float:
        if not self.data:
            return 0.0

        concepts = self.data.get('concepts', [])
        concept_ids = set(c.get('id', '') for c in concepts)
        concept_titles = set(c.get('title', '') for c in concepts)
        
        relationships = self.relationships_output.get('relationships', [])
        if not relationships:
            return 1.0

        valid_count = 0
        for rel in relationships:
            source = rel.get('source', '')
            target = rel.get('target', '')
            
            source_valid = source in concept_ids or source in concept_titles
            target_valid = target in concept_ids or target in concept_titles
            
            if source_valid and target_valid:
                valid_count += 1

        return round(valid_count / len(relationships), 2)

    def _find_missing_links(self) -> List[str]:
        if not self.data:
            return []

        concepts = self.data.get('concepts', [])
        concept_ids = set(c.get('id', '') for c in concepts)
        concept_titles = set(c.get('title', '') for c in concepts)
        
        missing = []
        for rel in self.relationships_output.get('relationships', []):
            source = rel.get('source', '')
            target = rel.get('target', '')
            
            if source not in concept_ids and source not in concept_titles:
                missing.append(f"Missing source: {source}")
            if target not in concept_ids and target not in concept_titles:
                missing.append(f"Missing target: {target}")
                
        return list(set(missing))

    def _identify_ambiguous_terms(self) -> List[str]:
        concept_titles = set(c.get('title', '') for c in self.data.get('concepts', []))
        aliases = [alias for c in self.data.get('concepts', []) for alias in c.get('aliases', [])]
        return [alias for alias in aliases if alias in concept_titles]

    def save_outputs(self, output_dir: str = 'others') -> bool:
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        files = [
            ('concepts_detail.json', self.concepts_output),
            ('chunks.json', self.chunks_output),
            ('relationships.json', self.relationships_output)
        ]

        success = True
        for filename, data in files:
            filepath = output_path / filename
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4, ensure_ascii=False)
                print(f"Saved: {filepath}")
            except Exception as e:
                print(f"Failed to save {filepath}: {e}")
                success = False

        return success

    def run_full_extraction(self, output_dir: str = 'others') -> bool:
        print('Starting extraction...')
        if not self.load_document():
            return False

        self.extract_concepts()
        self.extract_chunks()
        self.extract_relationships()

        success = self.save_outputs(output_dir)
        print('Extraction complete.' if success else 'Extraction had errors.')
        return success

    def print_summary(self):
        print('\nSummary:')
        print(f"  concepts: {len(self.concepts_output.get('concepts', []))}")
        print(f"  chunks: {len(self.chunks_output.get('chunks', []))}")
        print(f"  relationships: {len(self.relationships_output.get('relationships', []))}")

        metrics = self.relationships_output.get('quality_metrics', {})
        print(f"  coverage: {metrics.get('coverage_score', 0)}")
        print(f"  consistency: {metrics.get('consistency_score', 0)}")
        print(f"  missing links: {len(metrics.get('missing_links', []))}")


if __name__ == '__main__':
    extractor = DocumentExtractor('parsed_V324.json')
    if extractor.run_full_extraction(output_dir='others'):
        extractor.print_summary()
