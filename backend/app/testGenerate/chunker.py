from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from unstructured.partition.pptx import partition_pptx
from unstructured.chunking.title import chunk_by_title

SERVLET_METHOD_KEYWORDS = ["init", "service", "doGet", "doPost", "destroy"]
SERVLET_CODE_HINTS = [
    "HttpServlet", "HttpServletRequest", "HttpServletResponse",
    "request.", "response.", "RequestDispatcher",
    "sendRedirect", "forward(", "getParameter", "setContentType",
    "public ", "protected ", "@Override", "throws",
]

def _count_hits(text: str, keywords: List[str]) -> int:
    t = text.lower()
    return sum(1 for k in keywords if k.lower() in t)


def _looks_like_code(text: str) -> bool:
    hits = _count_hits(text, SERVLET_CODE_HINTS)
    structure = (text.count(";") >= 2) or ("{" in text and "}" in text)
    return hits >= 2 or (hits >= 1 and structure)

def _ends_incomplete(text: str) -> bool:
    s = text.strip()
    if not s:
        return True
    if s[-1] in [",", ";", ":", "("]:
        return True
    if re.search(r"\b(and|or|but|to|for|in|on|at|the|a|an)$", s, re.IGNORECASE):
        return True
    return False


@dataclass
class ChunkConfig:
    max_characters: int = 1200
    new_after_n_chars: int = 950
    combine_text_under_n_chars: int = 120
    overlap: int = 60


class ServletPptxMvpChunker:
    def __init__(self, config: ChunkConfig | None = None):
        self.cfg = config or ChunkConfig()

    def chunk(self, filepath: str) -> List[Dict[str, Any]]:
        elements = partition_pptx(
            filename=filepath,
            infer_table_structure=True,
            include_metadata=True,
            include_page_breaks=True,
            strategy="hi_res",
        )

        base_chunks = chunk_by_title(
            elements,
            max_characters=self.cfg.max_characters,
            new_after_n_chars=self.cfg.new_after_n_chars,
            combine_text_under_n_chars=self.cfg.combine_text_under_n_chars,
            overlap=self.cfg.overlap,
            overlap_all=True,
            multipage_sections=True,
        )

        cooked = self._post_process(base_chunks)
        self._assign_indices(cooked)
        return cooked

    def _post_process(self, chunks) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []

        for ch in chunks:
            text = (getattr(ch, "text", None) or "").strip()
            if not text:
                continue

            meta_raw: Dict[str, Any] = {}
            md = getattr(ch, "metadata", None)
            if md is not None:
                try:
                    meta_raw = md.to_dict()
                except Exception:
                    meta_raw = {}

            element_type = getattr(ch, "category", None)  # "Table" / "Title" / ...

            if element_type == "Table":
                out.append({
                    "content": text,
                    "meta": {
                        "element_type": "Table",
                        "page_number": meta_raw.get("page_number"),
                        "text_as_html": meta_raw.get("text_as_html"),
                        "has_table": True,
                        "has_code": False,
                    },
                })
                continue

            method_hits = _count_hits(text, SERVLET_METHOD_KEYWORDS)
            has_code = _looks_like_code(text)

            out.append({
                "content": text,
                "meta": {
                    "element_type": element_type or "Text",
                    "page_number": meta_raw.get("page_number"),
                    "has_table": False,
                    "has_code": has_code,
                    "servlet_method_hits": method_hits,
                },
            })

        out = self._merge_too_short(out)
        out = self._split_too_long(out)
        out = self._add_quality_metrics(out)
        out = self._add_servlet_coverage(out)
        return out

    def _merge_too_short(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        MIN = 120
        merged: List[Dict[str, Any]] = []
        buf: Optional[Dict[str, Any]] = None

        def flush() -> None:
            nonlocal buf
            if buf is not None:
                merged.append(buf)
                buf = None

        for c in chunks:
            meta = c["meta"]
            if meta.get("has_table"):
                flush()
                merged.append(c)
                continue

            content = c["content"]
            if len(content) >= MIN:
                flush()
                merged.append(c)
                continue

            code_sensitive = meta.get("has_code") or meta.get("servlet_method_hits", 0) >= 2

            if buf is None:
                buf = c
                continue

            buf_sensitive = buf["meta"].get("has_code") or buf["meta"].get("servlet_method_hits", 0) >= 2
            if code_sensitive or buf_sensitive:
                flush()
                buf = c
            else:
                buf["content"] = (buf["content"] + "\n\n" + content).strip()
                buf["meta"]["merged"] = True

        flush()
        return merged

    def _split_too_long(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        MAX = 1400
        out: List[Dict[str, Any]] = []

        for c in chunks:
            if c["meta"].get("has_table"):
                out.append(c)
                continue

            text = c["content"]
            if len(text) <= MAX:
                out.append(c)
                continue

            paras = text.split("\n\n")
            cur = ""
            for p in paras:
                if not cur:
                    cur = p
                elif len(cur) + 2 + len(p) <= MAX:
                    cur += "\n\n" + p
                else:
                    out.append({**c, "content": cur, "meta": {**c["meta"], "split_part": True}})
                    cur = p
            if cur:
                out.append({**c, "content": cur, "meta": {**c["meta"], "split_part": True}})

        return out

    def _add_quality_metrics(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for c in chunks:
            text = c["content"]
            wc = len(text.split())
            cc = len(text)
            incomplete = _ends_incomplete(text) if not c["meta"].get("has_table") else False

            score = 10.0
            if cc < 80 and not c["meta"].get("has_table"):
                score -= 2.0
            if cc > 1500:
                score -= 2.0
            if incomplete:
                score -= 2.0
            if c["meta"].get("has_table"):
                score += 1.0
            if c["meta"].get("has_code") and wc > 25:
                score += 0.5

            c["meta"].update({
                "word_count": wc,
                "char_count": cc,
                "ends_incomplete": incomplete,
                "quality_score": max(0.0, min(10.0, round(score, 2))),
            })
        return chunks

    def _add_servlet_coverage(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        all_text = " ".join(c["content"] for c in chunks).lower()
        covered = [m for m in SERVLET_METHOD_KEYWORDS if m.lower() in all_text]
        for c in chunks:
            c["meta"]["servlet_methods_covered_global"] = covered
        return chunks

    def _assign_indices(self, chunks: List[Dict[str, Any]]) -> None:
        for i, c in enumerate(chunks):
            c["chunk_index"] = i


def make_report(chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not chunks:
        return {"total": 0}

    scores = [c["meta"]["quality_score"] for c in chunks]
    sizes = [c["meta"]["char_count"] for c in chunks]
    tables = sum(1 for c in chunks if c["meta"].get("has_table"))
    code = sum(1 for c in chunks if c["meta"].get("has_code"))
    incomplete = sum(1 for c in chunks if c["meta"].get("ends_incomplete"))
    covered = chunks[0]["meta"].get("servlet_methods_covered_global", [])

    return {
        "total": len(chunks),
        "avg_quality": round(sum(scores) / len(scores), 2),
        "min_quality": min(scores),
        "max_quality": max(scores),
        "avg_chars": round(sum(sizes) / len(sizes), 0),
        "min_chars": min(sizes),
        "max_chars": max(sizes),
        "tables": tables,
        "code_chunks": code,
        "incomplete_chunks": incomplete,
        "servlet_methods_covered": covered,
    }
