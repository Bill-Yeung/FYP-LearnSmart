import re
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass

CITATION_PATTERN = re.compile(r'\[src:([a-f0-9\-]{36}):([^\]]+)\]', re.IGNORECASE)
PAGE_SINGLE = re.compile(r'p\.?(\d+)', re.IGNORECASE)
PAGE_RANGE = re.compile(r'pp?\.?\s*(\d+)\s*[-–]\s*(\d+)', re.IGNORECASE)
PAGE_MULTIPLE = re.compile(r'pages?\s*([\d,\s]+)', re.IGNORECASE)

@dataclass
class Citation:
    source_id: str
    location: str
    start_pos: int
    end_pos: int
    full_text: str

def extract_citations(text: str) -> List[Tuple[str, str]]:
    return CITATION_PATTERN.findall(text)


def extract_citations_detailed(text: str) -> List[Citation]:
    
    citations = []
    for match in CITATION_PATTERN.finditer(text):
        citations.append(Citation(
            source_id=match.group(1),
            location=match.group(2),
            start_pos=match.start(),
            end_pos=match.end(),
            full_text=match.group(0)
        ))
    return citations


def extract_page_numbers(location: str) -> List[int]:
    
    pages = []

    range_match = PAGE_RANGE.search(location)
    if range_match:
        start, end = int(range_match.group(1)), int(range_match.group(2))
        return list(range(start, end + 1))

    multi_match = PAGE_MULTIPLE.search(location)
    if multi_match:
        nums = re.findall(r'\d+', multi_match.group(1))
        return [int(n) for n in nums]

    single_match = PAGE_SINGLE.search(location)
    if single_match:
        return [int(single_match.group(1))]

    return pages


def has_citations(text: str) -> bool:
    return bool(CITATION_PATTERN.search(text))


def citation_coverage(text: str) -> float:
    
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return 0.0

    cited_count = sum(1 for s in sentences if has_citations(s))
    return cited_count / len(sentences)


def remove_citations(text: str) -> str:
    return CITATION_PATTERN.sub('', text)


def remove_citations_clean(text: str) -> str:

    result = remove_citations(text)
    result = re.sub(r'\s+', ' ', result)
    result = re.sub(r'\s+([.!?,;:])', r'\1', result)
    return result.strip()


def replace_citations_with_display(
    text: str,
    source_map: Optional[Dict[str, str]] = None,
    format_template: str = "[{name}, {location}]"
) -> str:
   
    def replace_fn(match):
        source_id = match.group(1)
        location = match.group(2)

        if source_map and source_id in source_map:
            name = source_map[source_id]
        else:
            name = f"Source {source_id[:8]}..."

        return format_template.format(name=name, location=location)

    return CITATION_PATTERN.sub(replace_fn, text)


