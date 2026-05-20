from app.services.knowledge.citations import (
    extract_citations,
    extract_citations_detailed,
    extract_page_numbers,
    has_citations,
    citation_coverage,
    remove_citations,
    remove_citations_clean,
    replace_citations_with_display,
)

UUID1 = "550e8400-e29b-41d4-a716-446655440000"
UUID2 = "660e8400-e29b-41d4-a716-446655440001"

class TestExtractCitations:

    def test_single_citation(self):
        text = f"Entropy [src:{UUID1}:p5] is important."
        result = extract_citations(text)
        assert len(result) == 1
        assert result[0] == (UUID1, "p5")

    def test_multiple_citations(self):
        text = f"A [src:{UUID1}:p1] and B [src:{UUID2}:p2] are related."
        result = extract_citations(text)
        assert len(result) == 2

    def test_no_citations(self):
        text = "Plain text without citations."
        result = extract_citations(text)
        assert len(result) == 0

    def test_page_range_citation(self):
        text = f"See [src:{UUID1}:pp10-15] for details."
        result = extract_citations(text)
        assert result[0] == (UUID1, "pp10-15")

    def test_timestamp_citation(self):
        text = f"Listen at [src:{UUID1}:12:35] for the explanation."
        result = extract_citations(text)
        assert result[0] == (UUID1, "12:35")

class TestExtractCitationsDetailed:

    def test_returns_citation_objects(self):
        text = f"A concept [src:{UUID1}:p3] here."
        result = extract_citations_detailed(text)
        assert len(result) == 1
        c = result[0]
        assert c.source_id == UUID1
        assert c.location == "p3"
        assert c.start_pos > 0
        assert c.end_pos > c.start_pos

    def test_empty_text(self):
        result = extract_citations_detailed("")
        assert len(result) == 0

class TestExtractPageNumbers:

    def test_single_page(self):
        assert extract_page_numbers("p5") == [5]

    def test_single_page_with_dot(self):
        assert extract_page_numbers("p.5") == [5]

    def test_page_range(self):
        result = extract_page_numbers("pp10-15")
        assert result == [10, 11, 12, 13, 14, 15]

    def test_page_range_with_dots(self):
        result = extract_page_numbers("pp.10-15")
        assert result == [10, 11, 12, 13, 14, 15]

    def test_multiple_pages(self):
        result = extract_page_numbers("pages 5,7,9")
        assert result == [5, 7, 9]

    def test_timestamp_returns_empty(self):
        result = extract_page_numbers("12:35")
        assert result == []

    def test_empty_string(self):
        result = extract_page_numbers("")
        assert result == []

class TestHasCitations:

    def test_text_with_citation(self):
        assert has_citations(f"Text [src:{UUID1}:p1] here.") is True

    def test_text_without_citation(self):
        assert has_citations("Plain text.") is False

    def test_empty_text(self):
        assert has_citations("") is False

class TestCitationCoverage:

    def test_full_coverage(self):
        text = f"A [src:{UUID1}:p1]. B [src:{UUID2}:p2]."
        coverage = citation_coverage(text)
        assert coverage == 1.0

    def test_no_coverage(self):
        text = "No citations here. None here either."
        coverage = citation_coverage(text)
        assert coverage == 0.0

    def test_partial_coverage(self):
        text = f"Cited [src:{UUID1}:p1]. Not cited."
        coverage = citation_coverage(text)
        assert coverage == 0.5

    def test_empty_text(self):
        assert citation_coverage("") == 0.0

class TestRemoveCitations:

    def test_remove_citations(self):
        text = f"A [src:{UUID1}:p1] B [src:{UUID2}:p2]."
        result = remove_citations(text)
        assert "[src:" not in result
        assert "A" in result

    def test_no_citations_to_remove(self):
        text = "Plain text."
        assert remove_citations(text) == text

class TestRemoveCitationsClean:

    def test_clean_whitespace(self):
        text = f"A [src:{UUID1}:p1] B."
        result = remove_citations_clean(text)
        assert "  " not in result
        assert result.strip() == result

    def test_clean_punctuation_spacing(self):
        text = f"Word [src:{UUID1}:p1] ."
        result = remove_citations_clean(text)
        assert " ." not in result

class TestReplaceCitationsWithDisplay:

    def test_replace_with_source_map(self):
        source_map = {UUID1: "Chapter 1"}
        text = f"A [src:{UUID1}:p5] concept."
        result = replace_citations_with_display(text, source_map)
        assert "Chapter 1" in result
        assert "[src:" not in result

    def test_replace_without_source_map(self):
        text = f"A [src:{UUID1}:p5] concept."
        result = replace_citations_with_display(text)
        assert "Source" in result
        assert "[src:" not in result
