import json
import re
from typing import Dict, List, Tuple, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass
class CheckResult:
    check_id: str
    check_name: str
    passed: bool
    severity: Severity
    details: str = ""
    failed_items: List[Any] = field(default_factory=list)


class ComprehensiveValidator:
    
    ID_PATTERNS = {
        "CHARACTER": re.compile(r'^CHAR_.+$'),
        "SCENE": re.compile(r'^SCENE_.+$'),
        "CLUE": re.compile(r'^CLUE_.+$'),
        "QUESTION": re.compile(r'^Q_.+$'),
        "KNOWLEDGE": re.compile(r'^[a-fA-F0-9\-]{36}$|^CONC_.+$'),
        "EVIDENCE": re.compile(r'^EVIDENCE_.+$'),
        "ENDING": re.compile(r'^ENDING_.+$'),
        "OPTION": re.compile(r'^OPT_.+$'),
        "ITEM": re.compile(r'^ITEM_.+$'),
        "HINT": re.compile(r'^HINT_.+$'),
    }
    
    COMMENT_PATTERNS = [
        re.compile(r'<!--.*?-->', re.DOTALL),
        re.compile(r'//.*$', re.MULTILINE),
        re.compile(r'/\*.*?\*/', re.DOTALL),
        re.compile(r'#.*$', re.MULTILINE),
    ]
    
    ALLOWED_NON_ASCII = set([
        '\u2018', '\u2019', '\u201C', '\u201D', '\u2026',  
        '\u2013', '\u2014',                                
        '\u00A9', '\u00AE', '\u2122', '\u00A0',            
        '\u2190', '\u2192',
    ])
    
    NON_ENGLISH_PATTERN = re.compile(r'[\u4e00-\u9fa5\u3000-\u303F]')
    
    DEFAULT_SCHEMA = {    
            "scenes": list,
            "questions": list,
            "knowledgeBase": list,
            "characters": list,
            "clues": list,
            "evidence": list,
            "endings": list,
          
        }
    
    
    FIELD_CONFIG = {
        "CHARACTER": {"id_field": "characterId", "container": "characters", "pattern_key": "CHARACTER", "refs": ["scenes", "knowledgePoints"]},
        "SCENE": {"id_field": "sceneId", "container": "scenes", "pattern_key": "SCENE", "refs": []},
        "CLUE": {"id_field": "clueId", "container": "clues", "pattern_key": "CLUE", "refs": ["relatedKnowledge", "foundInScene"]},
        "QUESTION": {"id_field": "questionId", "container": "questions", "pattern_key": "QUESTION", "refs": ["knowledgeId", "relatedKnowledge"]},
        "KNOWLEDGE": {"id_field": "knowledgeId", "container": "knowledgeBase", "pattern_key": "KNOWLEDGE", "refs": []},
        "EVIDENCE": {"id_field": "evidenceId", "container": "evidence", "pattern_key": "EVIDENCE", "refs": ["relatedKnowledge", "clueIds"]},
        "ENDING": {"id_field": "endingId", "container": "endings", "pattern_key": "ENDING", "refs": []},
    }
    
    def __init__(self, json_data: Union[str, Dict], expected_schema: Optional[Dict] = None):
        if isinstance(json_data, str):
            self.data = json.loads(json_data)
        else:
            self.data = json_data or {}
        self.script = self.data.get("script")
        if not isinstance(self.script, dict):
            self.script = self.data
        self.expected_schema = expected_schema if expected_schema is not None else self.DEFAULT_SCHEMA
        self.results: List[CheckResult] = []
        
    def run_all_checks(self) -> Tuple[bool, List[CheckResult]]:
        self._check_json_format()
        self._check_structure_schema()
        self._check_language_and_comments()
        self._check_id_formats()
        self._check_id_uniqueness()
        self._check_foreign_keys()
        self._check_question_count()
        
        all_passed = all(r.passed for r in self.results if r.severity == Severity.ERROR)
        return all_passed, self.results
    
    def _add_result(self, check_id: str, check_name: str, passed: bool, 
                    severity: Severity = Severity.ERROR, details: str = "", 
                    failed_items: List[Any] = None):
        self.results.append(CheckResult(
            check_id=check_id,
            check_name=check_name,
            passed=passed,
            severity=severity,
            details=details,
            failed_items=failed_items or []
        ))
    
    def _check_json_format(self):
        self._add_result("HARD_01", "JSON Format Validation", passed=True, details="Valid JSON format")
    
    def _check_structure_schema(self):
        if not self.expected_schema:
            self._add_result("HARD_02", "Field Structure Validation", passed=True, 
                           severity=Severity.WARNING, details="No schema provided, skipping validation")
            return
        
        errors = []
        
        def check_section(data, schema, path=""):
            if data is None:
                errors.append(f"Field {path} is null/None but expected structure")
                return
            if isinstance(schema, dict):
                for key, expected_type in schema.items():
                    current_path = f"{path}.{key}" if path else key
                    if key not in data:
                        errors.append(f"Missing field: {current_path}")
                    elif expected_type == list and not isinstance(data[key], list):
                        errors.append(f"Type error: {current_path} expected list, got {type(data[key]).__name__}")
                    elif expected_type == dict and not isinstance(data[key], dict):
                        errors.append(f"Type error: {current_path} expected dict, got {type(data[key]).__name__}")
                    elif isinstance(expected_type, dict):
                        check_section(data.get(key) or {}, expected_type, current_path)
        
        check_section(self.data, self.expected_schema)
        
        self._add_result("HARD_02", "Field Structure Validation",
                        passed=len(errors) == 0,
                        details="Passed" if len(errors) == 0 else f"{len(errors)} structure issues",
                        failed_items=errors[:20])
    
    def _check_language_and_comments(self):
        non_english_items = []
        comment_items = []
        
        def scan_text(text: str, location: str):
            if not isinstance(text, str):
                return
            
            for match in self.NON_ENGLISH_PATTERN.finditer(text):
                char = match.group()
                if char not in self.ALLOWED_NON_ASCII:
                    non_english_items.append({
                        "location": location, 
                        "char": char, 
                        "context": text[max(0, match.start()-20):match.end()+20]
                    })
                    break
            
            for pattern in self.COMMENT_PATTERNS:
                if pattern.search(text):
                    comment_items.append({"location": location, "pattern": pattern.pattern[:30]})
                    break
        
        def traverse(obj, path=""):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    traverse(value, f"{path}.{key}" if path else key)
            elif isinstance(obj, list):
                for idx, item in enumerate(obj):
                    traverse(item, f"{path}[{idx}]")
            elif isinstance(obj, str):
                scan_text(obj, path)
        
        traverse(self.data)
        
        passed = len(non_english_items) == 0 and len(comment_items) == 0
        details = []
        if non_english_items:
            details.append(f"Non-English characters: {len(non_english_items)} found")
        if comment_items:
            details.append(f"Comments: {len(comment_items)} found")
        
        self._add_result("HARD_03", "Language and Comments Validation",
                        passed=passed,
                        details="Passed" if passed else "; ".join(details),
                        failed_items=non_english_items[:5] + comment_items[:5])
    
    def _check_id_formats(self):
        errors = []
        
        for entity_type, config in self.FIELD_CONFIG.items():
            if not config["container"]:
                continue
                
            pattern_key = config.get("pattern_key", entity_type)
            if pattern_key not in self.ID_PATTERNS:
                continue
                
            pattern = self.ID_PATTERNS[pattern_key]
            items = self.script.get(config["container"]) or []
            id_field = config["id_field"]
            
            for item in items:
                item_id = item.get(id_field, "")
                if item_id and not pattern.match(item_id):
                    errors.append(f"{entity_type}: {item_id} invalid format, expected {pattern.pattern}")
        
        for question in self.script.get("questions") or []:
            for opt in question.get("options") or []:
                opt_id = opt.get("optionId", "")
                if opt_id and not self.ID_PATTERNS["OPTION"].match(opt_id):
                    errors.append(f"OPTION: {opt_id} invalid format, expected {self.ID_PATTERNS['OPTION'].pattern}")
            
            for item in question.get("items") or []:
                item_id = item.get("itemId", "")
                if item_id and not self.ID_PATTERNS["ITEM"].match(item_id):
                    errors.append(f"ITEM: {item_id} invalid format, expected {self.ID_PATTERNS['ITEM'].pattern}")
            
            for hint in question.get("hints") or []:
                hint_id = hint.get("hintId", "")
                if hint_id and not self.ID_PATTERNS["HINT"].match(hint_id):
                    errors.append(f"HINT: {hint_id} invalid format, expected {self.ID_PATTERNS['HINT'].pattern}")
        
        self._add_result("HARD_04", "ID Format Validation",
                        passed=len(errors) == 0,
                        details="Passed" if len(errors) == 0 else f"{len(errors)} ID format errors",
                        failed_items=errors[:20])
    
    def _check_id_uniqueness(self):
        errors = []
        all_ids = {}
        
        for entity_type, config in self.FIELD_CONFIG.items():
            if not config.get("container"):
                continue
                
            items = self.script.get(config["container"]) or []
            if not isinstance(items, list):
                continue
                
            id_field = config["id_field"]
            
            type_ids = set()
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_id = item.get(id_field)
                if item_id:
                    if item_id in type_ids:
                        errors.append(f"Duplicate {entity_type} ID: {item_id} appears multiple times in {config['container']}")
                    type_ids.add(item_id)
            
            for item_id in type_ids:
                if item_id in all_ids:
                    all_ids[item_id].append(entity_type)
                else:
                    all_ids[item_id] = [entity_type]
        
        questions = self.script.get("questions") or []
        if isinstance(questions, list):
            for question in questions:
                if not isinstance(question, dict):
                    continue
                
                q_id = question.get("questionId", "UNKNOWN_Q")
                
                local_opts = set()
                for opt in question.get("options") or [] if isinstance(question.get("options"), list) else []:
                    if not isinstance(opt, dict): continue
                    opt_id = opt.get("optionId")
                    if opt_id:
                        if opt_id in local_opts:
                            errors.append(f"Duplicate OPTION ID (Composite Key Error): {opt_id} appears multiple times within question {q_id}")
                        local_opts.add(opt_id)
                        
                        composite_key = f"{q_id}::{opt_id}"
                        all_ids[composite_key] = ["OPTION"]
                
                local_items = set()
                for item in question.get("items") or [] if isinstance(question.get("items"), list) else []:
                    if not isinstance(item, dict): continue
                    item_id = item.get("itemId")
                    if item_id:
                        if item_id in local_items:
                            errors.append(f"Duplicate ITEM ID (Composite Key Error): {item_id} appears multiple times within question {q_id}")
                        local_items.add(item_id)
                        
                        composite_key = f"{q_id}::{item_id}"
                        all_ids[composite_key] = ["ITEM"]
                
                local_hints = set()
                for hint in question.get("hints") or [] if isinstance(question.get("hints"), list) else []:
                    if not isinstance(hint, dict): continue
                    hint_id = hint.get("hintId")
                    if hint_id:
                        if hint_id in local_hints:
                            errors.append(f"Duplicate HINT ID (Composite Key Error): {hint_id} appears multiple times within question {q_id}")
                        local_hints.add(hint_id)
                        
                        composite_key = f"{q_id}::{hint_id}"
                        all_ids[composite_key] = ["HINT"]
        
        for id_val, types in all_ids.items():
            if len(types) > 1:
                errors.append(f"ID {id_val} appears in multiple entity types: {', '.join(types)}")
        
        self._add_result("HARD_05", "ID Uniqueness Validation",
                        passed=len(errors) == 0,
                        details="Passed" if len(errors) == 0 else f"{len(errors)} ID uniqueness issues",
                        failed_items=errors)
    
    def _check_foreign_keys(self):
        errors = []
        
        all_ids = {}
        for entity_type, config in self.FIELD_CONFIG.items():
            if not config["container"]:
                continue
            items = self.script.get(config["container"]) or []
            id_field = config["id_field"]
            all_ids[entity_type] = {item.get(id_field) for item in items if item.get(id_field)}
        
        all_ids["OPTION"] = set()
        all_ids["ITEM"] = set()
        all_ids["HINT"] = set()
        
        for question in self.script.get("questions") or []:
            for opt in question.get("options") or []:
                opt_id = opt.get("optionId")
                if opt_id:
                    all_ids["OPTION"].add(opt_id)
            for item in question.get("items") or []:
                item_id = item.get("itemId")
                if item_id:
                    all_ids["ITEM"].add(item_id)
            for hint in question.get("hints") or []:
                hint_id = hint.get("hintId")
                if hint_id:
                    all_ids["HINT"].add(hint_id)
        
        for entity_type, config in self.FIELD_CONFIG.items():
            if not config["container"]:
                continue
                
            items = self.script.get(config["container"]) or []
            id_field = config["id_field"]
            
            for item in items:
                current_id = item.get(id_field)
                for ref_field in config["refs"]:
                    ref_value = item.get(ref_field)
                    if not ref_value:
                        continue
                    
                    ref_list = ref_value if isinstance(ref_value, list) else [ref_value]
                    
                    for ref_id in ref_list:
                        if ref_id.startswith("CHAR_"):
                            target_type = "CHARACTER"
                        elif ref_id.startswith("SCENE_"):
                            target_type = "SCENE"
                        elif ref_id.startswith("CLUE_"):
                            target_type = "CLUE"
                        elif ref_id.startswith("Q_"):
                            target_type = "QUESTION"
                        elif ref_id.startswith("CONC_"):
                            target_type = "KNOWLEDGE"
                        elif ref_id.startswith("EVIDENCE_"):
                            target_type = "EVIDENCE"
                        elif ref_id.startswith("ENDING_"):
                            target_type = "ENDING"
                        elif ref_id.startswith("OPT_"):
                            target_type = "OPTION"
                        elif ref_id.startswith("ITEM_"):
                            target_type = "ITEM"
                        elif ref_id.startswith("HINT_"):
                            target_type = "HINT"
                        else:
                            continue
                        
                        if target_type in all_ids and ref_id not in all_ids[target_type]:
                            errors.append(f"{entity_type} {current_id} references non-existent {target_type} {ref_id} in field {ref_field}")
        
        self._add_result("HARD_06", "Foreign Key Consistency Validation",
                        passed=len(errors) == 0,
                        details="Passed" if len(errors) == 0 else f"{len(errors)} orphaned references",
                        failed_items=errors[:20])
    
    def _check_question_count(self):
        questions = self.script.get("questions") or []
        
        diff_config = self.data.get("template_difficulty") or self.script.get("template_difficulty")
        
        if diff_config:
            expected_mcq = diff_config.get("puzzle_mcq", 0)
            expected_sorting = diff_config.get("puzzle_sorting", 0)
            expected_fill = diff_config.get("puzzle_fill", 0)
            
            actual_mcq = sum(1 for q in questions if q.get("type", "multiple_choice") == "multiple_choice")
            actual_sorting = sum(1 for q in questions if q.get("type") == "sequencing")
            actual_fill = sum(1 for q in questions if q.get("type") == "fill_in_blank")
            
            errors = []
            if actual_mcq < expected_mcq:
                errors.append(f"Missing Multiple Choice questions (Expected: {expected_mcq}, Found: {actual_mcq})")
            if actual_sorting < expected_sorting:
                errors.append(f"Missing Sequencing questions (Expected: {expected_sorting}, Found: {actual_sorting})")
            if actual_fill < expected_fill:
                errors.append(f"Missing Fill-in-the-blank questions (Expected: {expected_fill}, Found: {actual_fill})")
                
            passed = len(errors) == 0
            
            details = (
                f"Total questions: {len(questions)}. "
                f"MCQ: {actual_mcq}/{expected_mcq}, "
                f"Sorting: {actual_sorting}/{expected_sorting}, "
                f"Fill: {actual_fill}/{expected_fill}"
            )
            
            self._add_result("HARD_07", "Puzzle Type and Count Requirements Validation",
                            passed=passed,
                            details=details,
                            failed_items=errors)
        else:
            count = len(questions)
            passed = count >= 8
            
            self._add_result("HARD_07", "Question Count Custom Validation",
                            passed=passed,
                            details=f"Current question count: {count}, generally expected at least 8 (No config found)",
                            failed_items=[] if passed else [f"Missing {8 - count} questions"])


def validate_json(json_data: Union[str, Dict]) -> Tuple[bool, List[CheckResult]]:
    validator = ComprehensiveValidator(json_data)
    return validator.run_all_checks()


def get_validation_summary(json_data: Union[str, Dict]) -> Dict:
    passed, results = validate_json(json_data)
    
    summary = {
        "passed": passed,
        "total_checks": len(results),
        "passed_checks": sum(1 for r in results if r.passed),
        "failed_checks": sum(1 for r in results if not r.passed),
        "error_checks": sum(1 for r in results if not r.passed and r.severity == Severity.ERROR),
        "warning_checks": sum(1 for r in results if not r.passed and r.severity == Severity.WARNING),
        "details": [
            {
                "check_id": r.check_id,
                "check_name": r.check_name,
                "passed": r.passed,
                "severity": r.severity.value,
                "details": r.details,
                "failed_items": r.failed_items[:5] if r.failed_items else []
            }
            for r in results
        ]
    }
    
    return summary


if __name__ == "__main__":
    import sys

    with open('forwardV319.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    passed, results = validate_json(data)
    
    print(f"\n{'='*60}")
    print(f"Hard Validation Result: {'PASSED' if passed else 'FAILED'}")
    print(f"{'='*60}\n")
    
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        icon = "🔴" if r.severity == Severity.ERROR else "⚠️"
        print(f"[{status}] {icon} {r.check_name}")
        print(f"        {r.details}")
        if r.failed_items and True:
            for item in r.failed_items:
                print(f"        → {str(item)[:100]}")
        print()
    
    error_count = sum(1 for r in results if not r.passed and r.severity == Severity.ERROR)
    print(f"Statistics: {error_count} critical errors found")