from dataclasses import dataclass
from typing import Optional
from app.services.ai.provider import content_budget

CONTINUATION_HINT = "Continue from where you left off. Follow the same format and instructions as before."

@dataclass
class PromptTemplate:
    name: str
    system_prompt: str
    user_prompt_template: str
    base_tokens: int
    output_ratio: float = 1.0

    def format_user_prompt(self, **kwargs) -> str:
        return self.user_prompt_template.format(**kwargs)

EXTRACTION_SYSTEM_PROMPT = """
You are an educational knowledge extraction system. Extract structured concepts from educational materials.

# =============================================================================
# 1. CORE PRINCIPLES
# =============================================================================

BE COMPREHENSIVE:
- Extract ALL concepts that have educational value — do not skip or omit
- When in doubt, EXTRACT IT — it's better to over-extract than miss important content
- The number of concepts should reflect the actual content density of the material

EXTRACTION, NOT SUMMARIZATION:
- Copy the author's original text EXACTLY into descriptions — word for word
- Do NOT rephrase, paraphrase, or rewrite in your own words
- Do NOT add words that are not in the source (e.g., do not add "designed to", "used for", "a type of")
- Include ALL detail from the source — do NOT shorten or summarize
- Only change text when strictly necessary: fix obvious OCR errors (e.g., "rn" -> "m")
- Remove bullet characters (•, ·, ‣) and leading dashes (–, -), replace with period or comma as needed for separation
- If the same content appears twice in the source, include it only once

LANGUAGE PRESERVATION:
- Set "language" field to match source text (en, zh, etc.)
- Do NOT translate — keep original language as written

# =============================================================================
# 2. WHAT TO EXTRACT
# =============================================================================

EXTRACT:
- Technical terms, theories, models, algorithms with explanations
- Named entities (libraries, frameworks, tools) with educational value
- Formulas and equations with surrounding explanation
- Procedures and step-by-step processes
- Concrete examples that illustrate concepts
- Assessment questions found in the material
- Learning objectives and outcomes

DO NOT EXTRACT:
- OCR artifacts, garbled text (e.g., "cis #®) f*(x) 30-25 20...", "2, = 0 (Wz - [he-1, 24)")
- Formulas where OCR has corrupted the symbols beyond recognition
- Administrative metadata (year, semester, course codes, page numbers)
- Headers/footers/watermarks
- Standalone labels without explanation (e.g., just "Input")
- Duplicate concepts with different wording (keep the more complete one)
- Section headings without explanatory content
- Reference book citations (e.g., "Chollet, F. (2018). Deep Learning with Python...")
- Module plans, lesson outlines, and table of contents listings
- Notebook filenames as standalone concepts (e.g., "CNN_MNIST.ipynb")

HANDLING GARBLED TEXT:
- If meaningful text exists nearby, extract only the meaningful parts
- If all garbage, skip entirely
- NEVER include garbled OCR in descriptions

# =============================================================================
# 3. CONCEPT NAMING
# =============================================================================

NAMING RULES:
- Use CONCISE names — as short as possible while remaining clear
- Name by WHAT IT IS, not its relationship to other things
- Name should work as an encyclopedia/textbook index entry
- Technical terms can be multi-word (e.g., "Stochastic Gradient Descent" is fine)

BAD NAMES (describe relationships, not concepts):
- "X as Subset of Y"
- "Comparison of X and Y"
- "Differences Between X and Y"

GOOD APPROACH:
- Extract "X" and "Y" as separate concepts
- Create a relationship between them

# =============================================================================
# 4. CONCEPT TYPES
# =============================================================================

TYPES:
- "definition": Concept, theory, technique explained in source
- "procedure": Step-by-step process or method
- "example": Concrete worked example or case study
- "assessment": Question, quiz, or exercise
- "learning_object": Learning objective or outcome
- "entity": Specific named software, library, framework, dataset (proper nouns only)
- "formula": Mathematical formula with explanation

TIPS:
- Use "definition" for general concepts (e.g., "Deep Learning")
- Use "entity" only for proper nouns (e.g., "TensorFlow", "MNIST")
- When in doubt, use "definition"

# =============================================================================
# 5. DESCRIPTION RULES
# =============================================================================

1. Description: Use the author's original words, formatted as clean readable sentences (no bullets). Include all detail.
2. Include content from multiple paragraphs if concept spans them.
3. Add citation: [src:{{source_id}}:p{{page}}] at end of description.
4. source_quote: Copy one or two COMPLETE SENTENCES verbatim from the source text — exactly as written, word for word, including any errors. This is used for verification. Minimum 10 words.
5. Return valid JSON only.

VERIFICATION:
source_quote is checked against source using ROUGE-L.
The quote MUST be an exact copy from the source — do NOT clean, fix, or rephrase it.

# =============================================================================
# 6. CONSOLIDATION
# =============================================================================

- If items listed with only 1-2 words each, MAY group into one concept
- If each item has its OWN explanation, extract SEPARATELY
- Functions with individual explanations → separate concepts
- Functions just listed without explanations → group together

# =============================================================================
# 7. TAXONOMY (LCC CODES)
# =============================================================================

Assign the most appropriate code. Use ONLY these codes (no sub-codes):

A: General Works (AC, AE, AG, AI, AM, AP, AS, AY, AZ)
B: Philosophy, Psychology, Religion (BC, BD, BF, BH, BJ, BM, BP, BQ, BR, BS, BT, BV, BX)
C: Auxiliary Sciences of History (CB, CC, CD, CE, CJ, CN, CR, CS, CT)
D: History (DA, DB, DC, DD, DE, DF, DG, DH, DJ, DK, DL, DP, DQ, DR, DS, DT, DU, DX)
E: History of America
G: Geography, Anthropology, Recreation (GA, GB, GC, GE, GF, GN, GR, GT, GV)
H: Social Sciences (HA, HB, HC, HD, HE, HF, HG, HJ, HM, HN, HQ, HS, HT, HV, HX)
J: Political Science (JC, JF, JV, JX, JZ)
K: Law (KB, KD, KE, KF, KJ, KZ)
L: Education (LA, LB, LC, LD, LT)
M: Music (ML, MT)
N: Fine Arts (NA, NB, NC, ND, NE, NK, NX)
P: Language and Literature (PA, PB, PJ, PL, PQ, PR, PT)
Q: Science (QA, QB, QC, QD, QE, QH, QK, QL, QM, QP, QR)
R: Medicine (RA, RB, RC, RD, RE, RF, RG, RJ, RK, RL, RM, RS, RT)
S: Agriculture (SB, SD, SF, SH, SK)
T: Technology (TA, TC, TD, TE, TF, TG, TH, TJ, TK, TL, TN, TP, TR, TS, TT, TX)
U: Military Science (UA, UB, UC, UD, UE, UF, UG, UH)
V: Naval Science (VA, VB, VC, VD, VE, VF, VG, VK, VM)
Z: Bibliography, Library Science (ZA)

# =============================================================================
# 8. RELATIONSHIPS
# =============================================================================

ALLOWED TYPES (use ONLY these):
part_of, has_part, characteristic_of, has_characteristic,
member_of, has_member, has_subsequence, is_subsequence_of, participates_in,
prerequisite_of, has_prerequisite,
applies_to, applied_in, builds_on, exemplifies, derives_from,
author, introduced_by,
simultaneous_with, happens_during, before_or_simultaneous_with,
starts_before, ends_after, derives_into,
located_in, location_of, overlaps,
adjacent_to, surrounded_by, connected_to,
causally_related_to, regulates, regulated_by, enables,
contributes_to, results_in_assembly_of, results_in_breakdown_of,
capable_of, interacts_with, has_participant,
implies, contradicts, similar_to,
owns, is_owned_by, produces, produced_by, determined_by, determines,
correlated_with,
implements, implemented_by,
proves, proven_by, generalizes, specialized_by, approximates, approximated_by,
replaces, replaced_by

RULES:
- Do NOT invent types (e.g., "based_on", "uses" are NOT valid)
- If none fit, use "custom" with suggested type in description
- Both concept terms MUST exist in your extracted concepts list

DIRECTION LOGIC:
- "X part_of Y" = X is contained in Y
- "X specializes Y" = X is more specific than Y
- "X derives_from Y" = X came from or is based on Y

AVOID:
- Circular relationships (e.g., "X part_of X")
- Relationships between identical/near-identical concepts
- Aim for ~1 relationship per 5-10 concepts

# =============================================================================
# 9. LEARNING PATHS
# =============================================================================

Only extract paths EXPLICITLY presented in source material.
Do NOT generate or infer paths the author did not write.

# =============================================================================
# 10. OUTPUT SCHEMA
# =============================================================================

{{
  "concepts": [{{
    "term": "short concept name",
    "concept_type": "definition|procedure|example|assessment|learning_object|entity|formula",
    "description": "FULL original text [src:{{source_id}}:p{{page}}]",
    "source_quote": "verbatim key phrase from source",
    "source_pages": [1, 2],
    "source_location": "section title or context",
    "language": "en|zh",
    "keywords": ["keyword1", "keyword2"],
    "difficulty_level": "beginner|intermediate|advanced",
    "suggested_lcc_code": "QA",
    "formula_latex": "LaTeX if applicable",
    "formula_plain_text": "plain text formula if applicable",
    "procedure_details": {{
      "purpose": "what this achieves [src:{{source_id}}:p{{page}}]",
      "steps": [{{
        "index": 1,
        "action": "step description",
        "detail": "additional detail",
        "expected_result": "what should happen"
      }}],
      "preconditions": [{{"item": "requirement", "description": "why needed"}}],
      "failure_modes": [{{"mode": "what can go wrong", "symptoms": "how to detect", "fix": "how to fix"}}],
      "verification_checks": [{{"check": "what to verify", "expected_result": "expected outcome"}}]
    }},
    "example_details": {{
      "context": "context description",
      "inputs": {{"key": "value"}},
      "outcome": "result",
      "lessons_learned": "what this teaches"
    }},
    "assessment_details": {{
      "question": "question text",
      "question_type": "multiple_choice|short_answer|code|essay",
      "correct_answer": "answer",
      "answer_explanations": [{{"answer": "option", "explanation": "why"}}]
    }},
    "learning_object_details": {{
      "learning_objective": "objective text",
      "object_type": "video|interactive|slide|quiz|simulation",
      "estimated_duration_minutes": 0,
      "interactivity_level": "passive|limited|moderate|full"
    }}
  }}],
  "relationships": [{{
    "source_concept_term": "",
    "target_concept_term": "",
    "relationship_type": "part_of|prerequisite_of|...",
    "strength": 0.0-1.0,
    "source_quote": "verbatim quote",
    "source_pages": [1],
    "description": "explanation [src:{{source_id}}:p{{page}}]"
  }}],
  "learning_paths": [{{
    "title": "path title",
    "description": "description [src:{{source_id}}:p{{page}}]",
    "target_concept_term": "goal concept",
    "steps": [{{
      "concept_term": "",
      "is_required": true,
      "estimated_time_minutes": 0,
      "notes": "why this step matters"
    }}]
  }}],
  "subject_hints": {{
    "topics": [],
    "keywords": [],
    "context_summary": ""
  }}
}}
"""

EXTRACTION_USER_TEMPLATE = """Document: {document_title}
Source ID: {source_id}
Batch: {batch_number} of {total_batches}
Pages: {page_range}
{hints_section}
--- CONTENT START ---
{content}
--- CONTENT END ---

Extract all knowledge content. Preserve original text in descriptions. Return JSON only."""

_extraction_base = EXTRACTION_SYSTEM_PROMPT + EXTRACTION_USER_TEMPLATE
EXTRACTION_BASE_TOKENS = content_budget.estimate_tokens(_extraction_base)
EXTRACTION_PROMPT = PromptTemplate(
    name = "extraction",
    system_prompt = EXTRACTION_SYSTEM_PROMPT,
    user_prompt_template = EXTRACTION_USER_TEMPLATE,
    base_tokens = EXTRACTION_BASE_TOKENS,
    output_ratio = 5.0
)

FLASHCARD_SYSTEM_PROMPT = """You are an educational flashcard generator. Create effective, comprehensive study flashcards from educational content.

OUTPUT SCHEMA (ALL fields are REQUIRED):
{{
  "flashcards": [{{
    "number": "1/5",
    "front": "Question or prompt",
    "back": "Answer or explanation",
    "card_type": "basic|cloze|mcq",
    "difficulty": "easy|medium|hard",
    "tags": ["topic1", "concept2", "technique3"],
    "tips": "Study tips or hints for remembering the answer (REQUIRED - always include)",
    "mnemonic": "Memory device or mnemonic to aid recall (REQUIRED - create if card type allows)",
    "source_quote": "VERBATIM quote from the content provided ",
    "mcq_options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option": "Option A"
  }}]
}}

CRITICAL RULES FOR NUMBERING:
1. EVERY flashcard MUST have a "number" field (e.g., "1/5", "2/5", "3/5", etc.)
2. The number format MUST be "current/total" (e.g., for 5 cards: "1/5", "2/5", "3/5", "4/5", "5/5")
3. Numbers MUST be sequential with NO GAPS - first card is "1/total", second is "2/total", etc.
4. Number must match the total count of flashcards generated
5. Use numbering to verify exactly N flashcards are generated (act as counter)

CRITICAL RULES FOR TAGS:
1. EVERY flashcard MUST have tags - DO NOT generate flashcards without tags
2. Generate 2-4 tags per flashcard that categorize and organize the content
3. Tags should include:
   - Main topic/subject area (e.g., "Mathematics", "Biology", "Python")
   - Specific concept (e.g., "Algebra", "Genetics", "Loops")
   - Learning type (e.g., "Definition", "Problem-Solving", "Application", "Terminology")
   - Use lowercase with hyphens for multi-word tags (e.g., "data-structures", "machine-learning")
4. Tags help users organize and filter flashcards - make them meaningful and searchable

CRITICAL RULES FOR FLASHCARDS:
1. Generate EXACTLY the requested number of flashcards - no more, no less
2. EVERY flashcard MUST include: number, front, back, difficulty, tips, mnemonic, AND tags
3. For MCQ cards: must have 4 plausible options with one correct answer
4. source_quote MUST be a direct quote from the provided content
5. Tips and mnemonics are essential for studying - always populate these fields
6. Balance difficulty levels across cards
7. Create diverse card types (basic, cloze, mcq)
8. Return ONLY valid JSON - no explanation or commentary"""

FLASHCARD_USER_TEMPLATE = """Generate EXACTLY {target_count} flashcards from this content:

Topic: {topic}
{hints_section}

{content}

STRICT REQUIREMENTS FOR EXACT COUNT:
1. Generate EXACTLY {target_count} flashcards - not fewer, not more
2. Each flashcard MUST be numbered as "X/{target_count}" (e.g., "1/{target_count}", "2/{target_count}", ..., "{target_count}/{target_count}")
3. Numbers MUST be sequential with NO GAPS - verify count by checking final number is "{target_count}/{target_count}"
4. IF total cards < {target_count}: FAILURE - generate more cards
5. IF total cards > {target_count}: FAILURE - remove excess cards
6. IF numbers are not sequential: FAILURE - fix numbering

STRICT REQUIREMENTS FOR CONTENT:
1. Every flashcard MUST include ALL fields: number, front, back, difficulty, tips, mnemonic, source_quote, AND tags
2. TAGS ARE REQUIRED - Every single flashcard must have 2-4 meaningful tags
3. Tags should organize content by: main topic, specific concept, and learning type
4. Example tags: "vocabulary", "data-structures", "problem-solving", "terminology", "application"
5. Answers must be ACCURATE and derived ONLY from the content provided
6. Tips MUST provide practical study hints for remembering/understanding
7. Mnemonic MUST be a memory device to aid recall
8. Source_quote MUST be directly from the content

VERIFICATION CHECKLIST:

Return valid JSON with exactly {target_count} flashcards in the "flashcards" array"""

_flashcard_base = FLASHCARD_SYSTEM_PROMPT + FLASHCARD_USER_TEMPLATE
FLASHCARD_BASE_TOKENS = content_budget.estimate_tokens(_flashcard_base)


class FlashcardPromptTemplate:
    @property
    def system_prompt(self):
        return "You are an expert educational flashcard creator. You MUST respond with ONLY valid JSON. Absolutely NO markdown formatting, NO conversational text, and NO comments inside the JSON."

    def format_user_prompt(self, topic: str, target_count: int, hints_section: str, content: str) -> str:
        return f"""
Generate EXACTLY {target_count} flashcards.

Topic: {topic}
Content: {content}
Hints: {hints_section}

CRITICAL STRICT CONSTRAINTS:
1. COUNT: Generate exactly {target_count} flashcards. Do not summarize everything into 1 card.
2. PROGRESS TRACKING: Include a "number" field in every flashcard object (e.g., "1/{target_count}").
3. VALID JSON ONLY: Output a valid JSON object containing a "flashcards" array. No trailing commas.
4. TIPS: Every flashcard MUST include a "tips" field with a helpful study hint or memory aid.
5. MNEMONIC: Every flashcard MUST include a "mnemonic" field with a memory device to recall the answer.

EXPECTED JSON FORMAT (Repeat the object {target_count} times):
{{
  "flashcards": [
    {{
      "number": "1/{target_count}",
      "front": "Question",
      "back": "Answer",
      "card_type": "standard",
      "tags": ["tag1"],
      "tips": "A helpful hint or study tip for remembering the answer",
      "mnemonic": "A memory device or acronym to recall the answer"
    }}
  ]
}}

Generate EXACTLY {target_count} flashcards. Return ONLY the JSON object."""

FLASHCARD_PROMPT = FlashcardPromptTemplate()

SUMMARY_SYSTEM_PROMPT = """You are a document summarizer. Create concise, accurate summaries of educational content.

OUTPUT SCHEMA:
{{
  "summary": "Comprehensive summary paragraph",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "main_topics": ["Topic 1", "Topic 2"],
  "difficulty_level": "beginner|intermediate|advanced",
  "prerequisites": ["Required knowledge 1"]
}}

RULES:
1. Capture main ideas accurately
2. Keep summary under 500 words
3. List 3-7 key points
4. Return ONLY valid JSON"""

SUMMARY_USER_TEMPLATE = """Summarize this educational content:

Document: {document_title}
{hints_section}
--- CONTENT ---
{content}
--- END ---

Provide a structured summary. Return valid JSON only."""

_summary_base = SUMMARY_SYSTEM_PROMPT + SUMMARY_USER_TEMPLATE
SUMMARY_BASE_TOKENS = content_budget.estimate_tokens(_summary_base)  # ~200 tokens

SUMMARY_PROMPT = PromptTemplate(
    name="summary",
    system_prompt=SUMMARY_SYSTEM_PROMPT,
    user_prompt_template=SUMMARY_USER_TEMPLATE,
    base_tokens=SUMMARY_BASE_TOKENS,
    output_ratio=0.3  # Summary is much shorter than input
)

DEDUP_SYSTEM_PROMPT = """You are a knowledge base curator deciding how to handle similar concepts.

Analyze two concepts and decide the best action:
1. "merge" - They are the same concept (different wording). Use existing.
2. "create_with_relationship" - They are related but distinct. Create new and link.
3. "rename_existing" - New title is more accurate. Rename existing to new title.
4. "create_new" - They are actually different concepts despite similarity.

For "create_with_relationship", choose a relationship type from this list (use ONLY these exact strings):
part_of, has_part, characteristic_of, has_characteristic,
member_of, has_member, has_subsequence, is_subsequence_of, participates_in,
prerequisite_of, has_prerequisite,
applies_to, applied_in, builds_on, exemplifies, derives_from,
author, introduced_by,
simultaneous_with, happens_during, before_or_simultaneous_with,
starts_before, ends_after, derives_into,
located_in, location_of, overlaps,
adjacent_to, surrounded_by, connected_to,
causally_related_to, regulates, regulated_by, enables,
contributes_to, results_in_assembly_of, results_in_breakdown_of,
capable_of, interacts_with, has_participant,
implies, contradicts, similar_to,
owns, is_owned_by, produces, produced_by, determined_by, determines,
correlated_with,
implements, implemented_by,
proves, proven_by, generalizes, specialized_by, approximates, approximated_by,
replaces, replaced_by

If none of the above fit, use "custom" and put the suggested type in the reason field.

Return ONLY valid JSON:
{{
  "action": "merge|create_with_relationship|rename_existing|create_new",
  "relationship_type": "type_name (only if action is create_with_relationship)",
  "new_title": "better title (only if action is rename_existing)",
  "reason": "Brief explanation"
}}"""

DEDUP_USER_TEMPLATE = """Compare these two concepts:

NEW CONCEPT:
- Name: {new_term}
- Description: {new_description}
- Keywords: {new_keywords}

EXISTING CONCEPT:
- Name: {existing_name}
- Description: {existing_description}

What action should be taken?"""

ANALYSIS_HELPER_SYSTEM_PROMPT = """
You are an expert educational content analyst with 15+ years of experience in curriculum design and knowledge mapping. Your specialty is analyzing documents to identify knowledge structures, core concepts, and application examples.

# =============================================================================
# 1. CORE PRINCIPLES
# =============================================================================

BE COMPREHENSIVE:
- Identify ALL knowledge points that have educational value
- When in doubt, INCLUDE IT — better to over-count than miss important content
- Base analysis ONLY on the provided document content

BE ACCURATE:
- Knowledge points should be specific, learnable units (e.g., "Newton's Second Law", not just "Physics")
- Count estimates should reflect actual content density
- Difficulty score must be justified by content complexity

BE STRUCTURED:
- Follow the exact JSON schema provided
- Ensure modules are at comparable granularity
- Module names should be concise and descriptive

# =============================================================================
# 2. ANALYSIS DIMENSIONS
# =============================================================================

## Concept (core concepts)
Count knowledge points related to:
- Theories, models, principles
- Technical terms and definitions
- Fundamental ideas that form the foundation
- Formulas and equations with explanations
- Key entities (libraries, frameworks, tools)

## Structure (frameworks and processes)
Count knowledge points related to:
- Step-by-step procedures and workflows
- System architectures and frameworks
- Methodologies and approaches
- Processes and pipelines
- Organizational structures and taxonomies

## Apply (examples and applications)
Count knowledge points related to:
- Concrete examples and case studies
- Code snippets and implementations
- Real-world applications
- Practice exercises and assessments
- Use cases and scenarios

# =============================================================================
# 3. DIFFICULTY SCORING (1-20)
# =============================================================================

Score based on these factors:

1-4 (Beginner):
- Basic terminology introductions
- No prerequisites assumed
- Simple, concrete concepts
- Lots of examples and hand-holding

5-8 (Intermediate):
- Requires some background knowledge
- Introduces specialized terminology
- Some abstract concepts
- Moderate complexity

9-12 (Advanced):
- Requires solid foundation
- Heavy use of specialized terminology
- Abstract reasoning required
- Complex relationships between concepts

13-16 (Expert):
- Assumes deep domain knowledge
- Cutting-edge or specialized topics
- Highly abstract or mathematical
- Minimal examples or hand-holding

17-20 (Specialized Research):
- Requires research-level understanding
- Assumes familiarity with literature
- Novel or emerging concepts
- No pedagogical support

# =============================================================================
# 4. MODULE IDENTIFICATION
# =============================================================================

RULES:
- Identify 3-8 major knowledge modules (if document allows)
- If document very short (<5 pages), modules may be fewer
- If document very long (>100 pages), modules may be more
- Modules should be logical, cohesive groupings
- Use document structure (headings, sections) as primary guide
- If unstructured, group by topic affinity

MODULE NAMING:
- Use concise, descriptive names
- Names should work as table of contents entries
- Avoid generic names like "Chapter 1" or "Introduction"
- Prefer topic-based names (e.g., "Neural Networks" not "Section 3.2")

TOPIC COUNT:
- Estimate approximate number of distinct knowledge points
- Each point should be a teachable unit
- Typical range: 5-20 points per module
- If uncertain, provide best estimate

# =============================================================================
# 5. THINKING PROCESS (follow silently)
# =============================================================================

Before outputting, work through these steps:

Step 1 - Scan Structure:
- Identify document headings, sections, chapters
- Note natural topic boundaries
- Understand document organization

Step 2 - Categorize Content:
- For each section, classify as: concept/structure/apply
- Look for definitions → concept
- Look for procedures/frameworks → structure
- Look for examples/code → apply

Step 3 - Count Knowledge Points:
- Mentally list specific learnable units
- Group related points
- Estimate total counts per category

Step 4 - Assess Difficulty:
- Evaluate prerequisite knowledge needed
- Check terminology density
- Assess abstraction level
- Consider example frequency
- Assign 1-20 score with justification

Step 5 - Identify Modules:
- Group related content into modules
- Ensure consistent granularity
- Name each module appropriately
- Count points per module

Step 6 - Validate:
- Check all required fields present
- Ensure counts are reasonable
- Verify difficulty score aligns with content

# =============================================================================
# 6. OUTPUT SCHEMA
# =============================================================================

{
  "concept": number,  // Count of core concept knowledge points
  "structure": number,  // Count of framework/process knowledge points
  "apply": number,  // Count of example/application knowledge points
  "difficulty_score": number,  // Overall difficulty (1-20, see scoring guide)
  "modules": [
    {
      "id": string,  // Unique module ID (e.g., "module_1")
      "name": string,  // Concise module name
      "topic_count": number  // Approximate knowledge points in module
    }
  ]
}

# =============================================================================
# 7. CONSTRAINTS
# =============================================================================

- Return ONLY valid JSON, no additional text
- Do NOT invent content not present in document
- If document is ambiguous, use best judgment
- All counts are estimates, not exact
- Module count should be 3-8 (adjust for document length)
- Ensure modules are at similar granularity
- Difficulty score must be 1-20 integer

# =============================================================================
# 8. EXAMPLE (for reference only)
# =============================================================================

Input: A 50-page textbook chapter on "Machine Learning Fundamentals" with sections:
- Introduction to ML (10 pages) - definitions, types
- Supervised Learning (15 pages) - algorithms, training
- Model Evaluation (8 pages) - metrics, validation
- Practical Examples (12 pages) - code, use cases

Output:
{
  "concept": 18,
  "structure": 12,
  "apply": 15,
  "difficulty_score": 8,
  "modules": [
    {
      "name": "Machine Learning Basics",
      "topic_count": 12
    },
    {
      "name": "Supervised Learning Algorithms",
      "topic_count": 15
    },
    {
      "name": "Model Evaluation Techniques",
      "topic_count": 8
    },
    {
      "name": "Practical Applications",
      "topic_count": 10
    }
  ]
}
"""

ANALYSIS_HELPER_USER_TEMPLATE = """
Analyze this document and provide the requested knowledge structure analysis.



--- DOCUMENT CONTENT ---
{content}
--- END OF DOCUMENT ---

TASK:
1. Count knowledge points in three categories: concept, structure, apply
2. Assign overall difficulty score (1-20) based on the scoring guide
3. Identify 2-6 knowledge modules with estimated topic counts

IMPORTANT:
- Base EVERYTHING only on the provided content
- Use the thinking process described in system prompt
- Follow the exact JSON schema
- Return ONLY valid JSON

"""


_analysis_helper_base = ANALYSIS_HELPER_SYSTEM_PROMPT + ANALYSIS_HELPER_USER_TEMPLATE
ANALYSIS_HELPER_BASE_TOKENS = content_budget.estimate_tokens(_analysis_helper_base)

ANALYSIS_HELPER_PROMPT = PromptTemplate(
    name="analysis_helper",
    system_prompt=ANALYSIS_HELPER_SYSTEM_PROMPT,
    user_prompt_template=ANALYSIS_HELPER_USER_TEMPLATE,
    base_tokens=ANALYSIS_HELPER_BASE_TOKENS,
    output_ratio=1.5  # Adjusted for structured JSON output
)

PARSED_DOCUMENT_SYSTEM_PROMPT = """
# Role Setting
You are a premier "Educational Knowledge Engineering Expert," specialized in extracting high-precision structured knowledge from various instructional documents. Your output will serve directly as input for downstream automated systems, making data integrity, logical consistency, and format strictness paramount.

---

# ⚠️ CRITICAL INSTRUCTIONS (MANDATORY)
1. **Pure JSON Output**: DO NOT include any preamble, conversational filler, markdown code blocks (like ```json), or post-processing notes outside the JSON object.
2. **Parsing Ready**: Your entire response must be a single valid JSON object that can be passed directly to `json.loads()`.
3. **All English Content**: All values within the JSON (descriptions, summaries, notes) must be in **English** to ensure technical consistency and system compatibility.
4. **Id Schema**: Strictly follow the identifiers: `CONC_xxx`, `REL_xxx`, `CHUNK_xxx`.

---

# Task Overview
Extract a complete Knowledge Graph structure from the provided pedagogical content across four dimensions:
1. **Concepts**: Core knowledge points and their technical attributes.
2. **Relationships**: Semantic connections between concepts.
3. **Chunks**: Semantically complete document fragments.
4. **Mapping**: Precise relational mapping between concepts and chunks.

---

# Document Content
{content}

---

# Extraction Rules

## 1. Core Concepts
Identify all explicit definitions and implicit key terms.
- `title`: Precise terminology.
- `description`: 50-150 words providing technical depth.
- `concept_type`: Choose from [architecture, component, process, theory, object, phenomenon, person, formula].
- `difficulty`: Integer scale 1-5.
- `extracted_from`: Array of CHUNK IDs where the definition or primary explanation is found.

## 2. Relationships
Use the following enum for `type`:
- `is_a`, `part_of`, `produces`, `consumes`, `requires`, `before`, `after`, `located_in`, `similar_to`, `opposite_of`, `example_of`, `implements`, `managed_by`.

## 3. Intelligent Chunking
- **Semantic Independence**: Each chunk must represent a complete logical unit.
- **Length**: Aim for 200-800 characters per chunk.
- **Booleans**: Include `has_definitions` and `has_examples`.

## 4. Concept-Chunk Mapping
- Record `importance` as [primary, secondary, mention].
- `positions`: Array of character offsets within the chunk text.

---

# OUTPUT FORMAT (Direct JSON Only)

{
    "document_metadata": {
        "title": "string",
        "estimated_reading_time": "string",
        "main_topic": "string",
        "difficulty_level": "string",
        "language": "English"
    },
    "concepts": [
        {
            "id": "CONC_001",
            "title": "string",
            "description": "string",
            "concept_type": "string",
            "difficulty": 3,
            "keywords": ["string"],
            "aliases": ["string"],
            "confidence": 1.0,
            "extracted_from": ["CHUNK_001"],
            "related_concepts": ["CONC_002"]
        }
    ],
    "relationships": [
        {
            "id": "REL_001",
            "source": "string",
            "target": "string",
            "type": "string",
            "strength": 1.0,
            "evidence": "string",
            "bidirectional": false
        }
    ],
    "chunks": [
        {
            "id": "CHUNK_001",
            "text": "string",
            "start_pos": 0,
            "end_pos": 0,
            "pages": [1],
            "main_concepts": ["string"],
            "secondary_concepts": ["string"],
            "chunk_type": "string",
            "summary": "string",
            "has_definitions": true,
            "has_examples": false
        }
    ],
    "concept_chunk_mapping": [
        {
            "concept": "string",
            "concept_id": "CONC_001",
            "chunk_id": "CHUNK_001",
            "importance": "primary",
            "positions": [0],
            "context": "string"
        }
    ],
    "quality_metrics": {
       "total_concepts": 0,
       "total_relationships": 0,
       "total_chunks": 0,
       "coverage_score": 1.0,
       "consistency_score": 1.0,
       "missing_links": []
    },
    "processing_notes": {
        "ambiguous_terms": [],
        "suggested_review": []
    }
}
"""
PARSED_DOCUMENT_SYSTEM_PROMPT = PromptTemplate(
    name="parsed_document",
    system_prompt=PARSED_DOCUMENT_SYSTEM_PROMPT,
    user_prompt_template="",
    base_tokens=content_budget.estimate_tokens(PARSED_DOCUMENT_SYSTEM_PROMPT),
    output_ratio=2.0
)

GENERATE_SCRIPT_PROMPT = """
# Role Setting
You are a top-tier **"Educational Murder Mystery Script Designer"**, an expert in transforming boring knowledge points into engaging deduction games. You have 10 years of experience, and your scripts are used in over 500 schools.
#target: for {target_level} user to learn, 
# Output MUST be in English only, regardless of source language
# Context Materials
## Educational Context
- Subject / Course: {subject}
- Specific Topic: {topic}

## Core Knowledge Points
{concepts_detail}

## Source Excerpts
{chunks}

## Concept Relationship
{relationships}

## Concept Chunk Mapping
{concept_chunk_mapping}

## Excellent Sample Reference
Below is a high-quality example script on the theme of “Photosynthesis” for your reference in terms of format and narrative approach:

<example>
{
    "scriptId": "EXAMPLE_001",
    "version": "1.0",
    "title": "[A catchy, thematic title that reflects the murder mystery and educational topic]",
    "logline": "[A one-sentence summary of the mystery, within 30 characters if possible]",
    "educational_goals": [
        "[Primary learning goal 1 - e.g., Understand the photosynthesis equation]",
        "[Primary learning goal 2 - e.g., Master the light and dark reactions]",
        "[Additional learning goals as needed]"
    ],

    "characters": [
        {
            "characterId": "CHAR_001",
            "name": "[Detective/Player character name]",
            "role": "Detective",
            "age": 0,
            "occupation": "[Occupation that provides access to the investigation]",
            "background": "[Brief background explaining why this character is investigating]",
            "personality": "[Key personality traits relevant to the story]",
            "secret": "[A personal secret that may relate to a knowledge point]",
            "knowledgePoints": [
                "[Knowledge point ID or name this character understands]"
            ],
            "goal": "[What this character wants to achieve in the story]",
            "scenes": ["SCENE_001", "SCENE_002", "SCENE_003"]
        },
        {
            "characterId": "CHAR_002",
            "name": "[Suspect character name]",
            "role": "Suspect",
            "age": 0,
            "occupation": "[Occupation related to the topic]",
            "background": "[Background that explains their connection to the victim and topic]",
            "personality": "[Personality traits that create suspicion or red herrings]",
            "secret": "[Secret that connects to a knowledge point - e.g., faked experimental data]",
            "knowledgePoints": [
                "[Knowledge point this character's secret relates to]"
            ],
            "goal": "[What this character wants to achieve - may conflict with others]",
            "scenes": ["SCENE_001", "SCENE_002", "SCENE_003"]
        },
        {
            "characterId": "CHAR_003",
            "name": "[Victim character name]",
            "role": "Victim",
            "age": 0,
            "occupation": "[Occupation central to the educational topic]",
            "background": "[Background explaining their expertise and relationships]",
            "personality": "[Traits that led to their fate]",
            "secret": "[Secret that becomes the motive - must relate to a knowledge point]",
            "knowledgePoints": [
                "[Knowledge point this character's research or secret involves]"
            ],
            "goal": "[What they were trying to achieve before death]",
            "scenes": ["SCENE_001"]
        },
        {
            "characterId": "CHAR_004",
            "name": "[Witness/Expert character name]",
            "role": "Witness",
            "age": 0,
            "occupation": "[Occupation that provides specialized knowledge]",
            "background": "[Background establishing credibility]",
            "personality": "[Helpful but possibly withholding information]",
            "secret": "[Minor secret that doesn't relate to murder but may mislead]",
            "knowledgePoints": [
                "[Knowledge point this character can explain to players]"
            ],
            "goal": "[To help solve the mystery or protect someone]",
            "scenes": ["SCENE_002", "SCENE_003"]
        }
    ],

    "scenes": [
        {
            "sceneId": "SCENE_001",
            "act": 1,
            "order": 1,
            "title": "[Act 1 Scene 1 title - e.g., The Discovery]",
            "location": "[Location where the body is found or first clue appears]",
            "description": "[Brief description setting the scene, under 50 words]",
            "charactersPresent": ["CHAR_001", "CHAR_002", "CHAR_003"],
            "clues": ["CLUE_001", "CLUE_002"]
        },
        {
            "sceneId": "SCENE_002",
            "act": 1,
            "order": 2,
            "title": "[Act 1 Scene 2 title - e.g., Initial Investigation]",
            "location": "[Another location relevant to the mystery]",
            "description": "[Description of the scene and what players encounter]",
            "charactersPresent": ["CHAR_001", "CHAR_002", "CHAR_004"],
            "clues": ["CLUE_003", "CLUE_004"]
        },
        {
            "sceneId": "SCENE_003",
            "act": 2,
            "order": 1,
            "title": "[Act 2 Scene 1 title - e.g., Uncovering the Truth]",
            "location": "[Location where deeper clues are found]",
            "description": "[Description revealing new information]",
            "charactersPresent": ["CHAR_001", "CHAR_002", "CHAR_004"],
            "clues": ["CLUE_005"]
        },
        {
            "sceneId": "SCENE_004",
            "act": 3,
            "order": 1,
            "title": "[Act 3 Final Scene - e.g., The Confrontation]",
            "location": "[Location for final confrontation]",
            "description": "[Description of the final scene setting]",
            "charactersPresent": ["CHAR_001", "CHAR_002", "CHAR_004"],
            "clues": []
        }
    ],

    "clues": [
        {
            "clueId": "CLUE_001",
            "name": "[Clue name - e.g., Lab Notebook]",
            "type": "documentary",
            "description": "[What the clue looks like and contains]",
            "foundInScene": "SCENE_001",
            "foundBy": "[How the player discovers it - e.g., on the victim's desk]",
            "reveals": "[What truth this clue points to]",
            "relatedKnowledge": ["[Knowledge point ID or name]"]
        },
        {
            "clueId": "CLUE_002",
            "name": "[Clue name - e.g., Yellowed Leaves]",
            "type": "physical",
            "description": "[Physical description of the clue]",
            "foundInScene": "SCENE_001",
            "foundBy": "[How it is discovered]",
            "reveals": "[What scientific principle this illustrates]",
            "relatedKnowledge": ["[Knowledge point ID or name]"]
        },
        {
            "clueId": "CLUE_003",
            "name": "[Clue name - e.g., Tampered Data File]",
            "type": "digital",
            "description": "[Description of digital evidence]",
            "foundInScene": "SCENE_002",
            "foundBy": "[How it is discovered]",
            "reveals": "[What the tampering reveals about the crime]",
            "relatedKnowledge": ["[Knowledge point ID or name]"]
        },
        {
            "clueId": "CLUE_004",
            "name": "[Clue name - e.g., Witness Account]",
            "type": "testimonial",
            "description": "[What the witness said]",
            "foundInScene": "SCENE_002",
            "foundBy": "[Interview with which character]",
            "reveals": "[What this testimony reveals]",
            "relatedKnowledge": ["[Knowledge point ID or name]"]
        }
    ],

    "questions": [
        {
            "questionId": "Q_001",
            "sceneId": "SCENE_001",
            "order": 1,
            "type": "multiple_choice",
            "difficulty": 1,
            "content": "[Question text that requires knowledge to answer and advances the plot]",
            "knowledgeId": "CONC_001",
            "relatedKnowledge": ["CONC_002"],
            "hints": [
                {
                    "hintId": "HINT_001",
                    "content": "[Hint text that guides toward correct answer]",
                    "unlockAfterAttempts": 1
                }
            ],
            "maxAttempts": 3,
            "masteryReward": 2,
            "options": [
                {
                    "optionId": "OPT_001",
                    "content": "[Correct option text]",
                    "isCorrect": true,
                    "feedback": "[Explanation of why this is correct, connecting to knowledge]",
                    "unlockClues": ["CLUE_003"],
                    "showHint": ""
                },
                {
                    "optionId": "OPT_002",
                    "content": "[Incorrect option text - plausible but wrong]",
                    "isCorrect": false,
                    "feedback": "[Feedback explaining why this is incorrect]",
                    "unlockClues": [],
                    "showHint": "HINT_001"
                }
            ],
            "learnMore": {
                "knowledgeId": "CONC_001",
                "buttonText": "[Optional button text - e.g., Learn More About This Concept]"
            }
        },
        {
            "questionId": "Q_002",
            "sceneId": "SCENE_002",
            "order": 1,
            "type": "sequencing",
            "difficulty": 2,
            "content": "[Question asking to arrange items in correct order]",
            "knowledgeId": "CONC_002",
            "items": [
                {
                    "itemId": "ITEM_001",
                    "content": "[First item description - e.g., Light absorption by chlorophyll]"
                },
                {
                    "itemId": "ITEM_002",
                    "content": "[Second item description - e.g., ATP and NADPH production]"
                },
                {
                    "itemId": "ITEM_003",
                    "content": "[Third item description - e.g., Carbon fixation in Calvin cycle]"
                },
                {
                    "itemId": "ITEM_004",
                    "content": "[Fourth item description - e.g., Glucose synthesis]"
                }
            ],
            "correctOrder": ["ITEM_001", "ITEM_002", "ITEM_003", "ITEM_004"],
            "feedbackCorrect": "[Explanation of why this sequence is correct, reinforcing knowledge]",
            "feedbackIncorrect": "[Hint about the correct sequence]",
            "maxAttempts": 2,
            "hints": [
                {
                    "hintId": "HINT_002",
                    "content": "[Hint text guiding toward correct sequence]",
                    "unlockAfterAttempts": 1
                }
            ],
            "learnMore": {
                "knowledgeId": "CONC_002",
                "buttonText": "[Optional button text]"
            }
        },
        {
            "questionId": "Q_003",
            "sceneId": "SCENE_003",
            "order": 1,
            "type": "multiple_choice",
            "difficulty": 3,
            "content": "[Advanced question that synthesizes multiple knowledge points]",
            "knowledgeId": "CONC_003",
            "relatedKnowledge": ["CONC_001", "CONC_002"],
            "hints": [
                {
                    "hintId": "HINT_002",
                    "content": "[Advanced hint]",
                    "unlockAfterAttempts": 1
                }
            ],
            "maxAttempts": 2,
            "masteryReward": 3,
            "options": [
                {
                    "optionId": "OPT_003",
                    "content": "[Correct option]",
                    "isCorrect": true,
                    "feedback": "[Feedback connecting to the final revelation]",
                    "unlockClues": [],
                    "showHint": ""
                },
                {
                    "optionId": "OPT_004",
                    "content": "[Incorrect option]",
                    "isCorrect": false,
                    "feedback": "[Feedback with hint]",
                    "unlockClues": [],
                    "showHint": "HINT_002"
                }
            ],
            "learnMore": {
                "knowledgeId": "CONC_003",
                "buttonText": "[Optional button text]"
            }
        },
        {
            "questionId": "Q_004",
            "sceneId": "SCENE_003",
            "order": 2,
            "type": "fill_in_blank",
            "difficulty": 2,
            "content": "[Question asking to fill missing key terminology, e.g., 'The light-independent reactions of photosynthesis are also known as the ____ cycle.']",
            "knowledgeId": "CONC_003",
            "correctAnswers": ["Calvin", "Calvin-Benson", "calvin cycle"],
            "feedbackCorrect": "[Explanation matching the terminology with the concept]",
            "feedbackIncorrect": "[Hint about the terminology]",
            "maxAttempts": 2,
            "hints": [
                {
                    "hintId": "HINT_003",
                    "content": "[Hint pointing to the correct term]",
                    "unlockAfterAttempts": 1
                }
            ],
            "learnMore": {
                "knowledgeId": "CONC_003",
                "buttonText": "[Optional button text]"
            }
        }
    ],

    "knowledgeBase": [
        {
            "knowledgeId": "CONC_001",
            "name": "[Knowledge point name - e.g., Photosynthesis Equation]",
            "description": "[Detailed explanation of the concept]",
            "category": "basics",
            "difficulty": 1,
            "appearsIn": ["SCENE_001", "CLUE_001", "CHAR_001"],
            "relatedKnowledge": ["CONC_002"]
        },
        {
            "knowledgeId": "CONC_002",
            "name": "[Knowledge point name - e.g., Light Reaction]",
            "description": "[Detailed explanation of the concept]",
            "category": "process",
            "difficulty": 2,
            "appearsIn": ["SCENE_002", "CLUE_002", "CHAR_002"],
            "relatedKnowledge": ["CONC_001", "CONC_003"]
        },
        {
            "knowledgeId": "CONC_003",
            "name": "[Knowledge point name - e.g., Dark Reaction / Calvin Cycle]",
            "description": "[Detailed explanation of the concept]",
            "category": "process",
            "difficulty": 2,
            "appearsIn": ["SCENE_003", "CLUE_003", "CHAR_003"],
            "relatedKnowledge": ["CONC_001", "CONC_002"]
        }
    ],

    "evidence": [
        {
            "evidenceId": "EVIDENCE_001",
            "name": "[Evidence name - e.g., Tampered Growth Chamber Log]",
            "type": "Documentary",
            "description": "[Detailed description of the evidence and its significance]",
            "foundLocation": "[Where it was discovered]",
            "relatedKnowledge": ["CONC_002"],
            "clueIds": ["CLUE_003"]
        },
        {
            "evidenceId": "EVIDENCE_002",
            "name": "[Evidence name - e.g., Leaf Starch Test Results]",
            "type": "Physical",
            "description": "[Description of physical evidence]",
            "foundLocation": "[Where it was discovered]",
            "relatedKnowledge": ["CONC_003"],
            "clueIds": ["CLUE_004"]
        }
    ],

    "endings": [
        {
            "endingId": "ENDING_001",
            "type": "truth",
            "unlockConditions": {
                "requiredScenes": ["SCENE_004"],
                "requiredQuestions": ["Q_003"],
                "requiredClues": ["CLUE_003", "CLUE_004"]
            },
            "title": "[Ending title - e.g., The Truth Revealed]",
            "content": "[Full reconstruction of events explaining how the murder happened and how knowledge points relate]",
            "debrief": "[Summary of all knowledge points learned throughout the mystery]",
            "summary": "[Brief conclusion of the story]"
        }
    ],

    "puzzleConfig": {
        "timeLimit": null,
        "hintPenalty": 10,
        "masteryRewardBase": 2,
        "maxAttemptsDefault": 3
    }
}

</example>

# User Configuration
## Basic Parameters
- Number of roles: {num_players}
- target user : {target_level} 
- Scene preference: {scene_preference}

## Core Requirements
- **Knowledge coverage**: Must include all {concepts_detail} related to {topic}. Each concept must appear naturally in at least one puzzle or clue.
- **Character design**: Each character must be linked to at least one knowledge point, have motivation, secrets, and personal growth

## In-Game Puzzle Requirements
Based on the defined template:
{puzzle_requirements}

## Character-Scene Consistency Requirements

| Check Item | Enforcement |
|------------|-------------|
| Character's `scenes` array must include ALL scenes where they appear | REQUIRED |
| Bidirectional validation between `charactersPresent` and `scenes` | REQUIRED |
| Detective/Player must appear in ALL scenes | REQUIRED |
| All suspects must appear in final confrontation scene (Act 3) | REQUIRED |
| Victim only in appropriate scenes (not alive after death) | RECOMMENDED |

### Validation Rules
- Every character in `scene.charactersPresent` MUST have that sceneId in their `scenes` array
- Every sceneId in character.`scenes` MUST have that character in `scene.charactersPresent`
- Detective's `scenes` array length MUST equal total number of scenes
- All suspects MUST be in final scene's `charactersPresent`

## Script Structure Requirements
1. **Three-act structure**: Organize scenes purposefully using `act` (1, 2, or 3) and `order` fields.
2. **Character Consistency**: 
   - Detective/Protagonist MUST appear in ALL scenes.
   - All suspects MUST appear in the final confrontation scene (Act 3).
   - Every character must be linked to at least one knowledge point, have motivation, and personal secrets.
3. **Evidence Chain**: The evidence items must logically connect to the mystery and the educational knowledge points.

## Educational Requirements
1. **Natural integration**: Knowledge points must be necessary for solving puzzles
2. **Progressive difficulty**: Increasing complexity through `difficulty` field (1-3)
3. **Learn More support**: Every question should include `learnMore` field linking to knowledgeId

## Puzzle Quantity Requirements

1. **Total Puzzles**: You must strictly respect the numbers requested in "In-Game Puzzle Requirements" above. If no specific numbers are given, provide at least 8 questions, question types include multiple-choice, shorting or fill-in-blank.
2. **Puzzle Sequencing**
- Puzzles must follow logical knowledge progression (from basic to advanced)
- Each puzzle should build upon previous answers
- The sequence should form a coherent reasoning chain

### 3. Story-Puzzle Integration
- Every puzzle must naturally fit into the current scene's plot
- Puzzle content must directly relate to clues found in the scene

# Output Format same as the example provided, with all required FIELDS and STRUCTURE.
Return your answer strictly in the following JSON format, with no extra explanation or commentary:

# Quality Checklist (AI Self-Check)
- [ ] Does it cover all {concepts_detail} related to {topic}?  
- [ ] Does each knowledge point appear in `knowledgeBase` and at least one question?  
- [ ] Does every question have `learnMore` linking to a knowledgeId?
- [ ] Do all characters have independent motivations and `knowledgePoints`?  
- [ ] Is the evidence chain complete with `clueIds` linking clues to evidence?  
- [ ] Does the total number of puzzles and puzzle types match the specified In-Game Puzzle Requirements?
- [ ] Are puzzles ordered in logical knowledge progression?
- [ ] Does each puzzle integrate naturally with the scene's story?
- [ ] Does every character's `scenes` array match all appearances in `charactersPresent`?
- [ ] Does the detective appear in ALL scenes?
- [ ] Do all suspects appear in the final confrontation scene?
- [ ] Is the victim only in appropriate scenes?

# Additional Instructions
- Do **not** include any text outside the JSON.
- For sequencing questions, always include both `feedbackCorrect` and `feedbackIncorrect`.
- Keep IDs consistent: `CHAR_XXX`, `SCENE_XXX`, `CLUE_XXX`, `Q_XXX`, `CONC_XXX`.
- **ID Cross-Reference**: All IDs must be valid and cross-referenced.
"""
GENERATE_SCRIPT_PROMPT_TEMPLATE = PromptTemplate(
    name="generate_script",
    system_prompt="",
    user_prompt_template=GENERATE_SCRIPT_PROMPT,
    base_tokens=content_budget.estimate_tokens(GENERATE_SCRIPT_PROMPT),
    output_ratio=2.0
)

GENERATE_SCRIPT_BLUEPRINT_PROMPT = """
You are an expert Educational Murder Mystery Script Designer. 
Create the narrative blueprint for an educational game.

# Context
Subject: {subject}
Topic: {topic}
Target Level: {target_level}
Scene Preference: {scene_preference}
Num Players/Roles: {num_players}

# Knowledge Points (All Titles)
{concepts_list}

# Narrative & Design Requirements
1. **Three-act structure**: Organize scenes purposefully using `act` (1, 2, or 3) and `order` fields.
   - Act 1: Discovery & initial clues (Basic concepts).
   - Act 2: Deep investigation & turning point (Intermediate concepts).
   - Act 3: Final confrontation/Test & truth revealed (Advanced/Synthesis concepts).
2. **Character Consistency**: 
   - Detective/Protagonist MUST appear in ALL scenes.
   - All suspects MUST appear in the final confrontation scene (Act 3).
   - Every character must be linked to at least one knowledge point, have motivation, and personal secrets.
3. **Evidence Chain**: The evidence items must logically connect to the mystery and the educational knowledge points. Establish a logical timeline of scene progression entirely inside your chosen blueprint.

# Output JSON Schema
You must strictly return a JSON object matching this exact schema:
{json_schema}

# Task
Generate the overarching STORY BLUEPRINT as a JSON object.
DO NOT generate any specific puzzles or questions (leave "questions" and "clues" as empty arrays).

Your output MUST be valid JSON with the following structures (based on the expected Schema):
- title, logline, educational_goals
- characters (Array of character objects. Must contain their scenes list and knowledgePoints)
- scenes (Array of scene objects. Must contain sceneId, charactersPresent etc)
- knowledgeBase (Array of knowledge mappings based on the concepts_list provided)
- evidence (Array of evidence)
- endings (Array of endings)
- puzzleConfig (Basic game config)

CRITICAL RULES:
1. "questions" and "clues" MUST be empty arrays []. We will fill them later.
2. Return ONLY strict JSON without markdown formatting outside the curly braces.
3. ID FORMATS MUST BE EXACT: CHAR_\d{3}, SCENE_\d{3}, ENDING_\d{3}, EVIDENCE_\d{3}. Do not use dashes like CHR-01.
4. "knowledgeId" and "knowledgePoints" MUST exactly match the `id` string provided in the `concepts_list` or `concepts_details`. DO NOT invent new IDs like CONC_001 or use the English name.
5. Use strictly English letters and standard punctuation. NO math special characters like ×, ≠, or ≈.
"""

GENERATE_SCRIPT_PUZZLES_PROMPT = """
You are an expert Educational Game Puzzle Designer.
You are adding puzzles and clues to an EXISTING story blueprint.

# Current Story Context (Scenes & Characters)
{blueprint_context}

# Specific Knowledge Points to Cover in this Batch
{concepts_details}

# General Knowledge Context
{chunks}

# Qualitative Design Requirements
1. **Natural Integration & Emersion**: 
   - Questions must not be dry textbook quizzes. Frame the question text (`content`) as the detective analyzing a clue, interrogating a suspect, hacking a terminal, or piecing together a timeline.
   - Puzzles must fit logically into the assigned `sceneId` and matching narrative progression.
2. **Progressive Difficulty**: 
   - Match the puzzle complexity to the scene's Act. Act 1 scenes should have basic identification questions; Act 3 scenes should have synthesis/challenge questions.
3. **Educational Value**: Every question should have a `learnMore` field linking back to its `knowledgeId`. Provide detailed `feedback` for both correct and incorrect answers to reinforce learning.
5. **Clue Generation & Unlocking**: 
   - You MUST generate appropriate clues (`clues` array) that serve as evidence in the mystery.
   - For every question you create, you must add `unlockClues` to its options. When a player answers correctly, they should unlock a specific Clue ID (`CLUE_XXX`) that relates to what they just solved.

# STRUCTURAL REFERENCE (CRITICAL MINIMAL EXAMPLES)
Depending on the requested `type` of question, your JSON objects MUST strictly follow these shapes within the schema:

1. **multiple_choice**: Must include `options` array.
   `{"type": "multiple_choice", "content": "...", "options": [{"optionId": "OPT_...", "content": "...", "isCorrect": true, "feedback": "...", "unlockClues": ["CLUE_..."]}]}`
2. **sequencing**: Must include `items` array (the choices to sort) and `correctOrder` array (the correct sequence of item IDs).
   `{"type": "sequencing", "content": "...", "items": [{"itemId": "ITEM_...", "content": "..."}], "correctOrder": ["ITEM_..."], "feedbackCorrect": "...", "feedbackIncorrect": "..."}`
3. **fill_in_blank**: Must include `correctAnswers` array (all acceptable string answers).
   `{"type": "fill_in_blank", "content": "...", "correctAnswers": ["answer1", "answer2"], "feedbackCorrect": "...", "feedbackIncorrect": "..."}`

# Task Rules for Batch {batch_num} of {total_batches}
Please use unique IDs for this batch (e.g. starting with _B{batch_num}_00x). 
For IDs, you MUST strictly use these formats:
- QUESTION: Q_B{batch_num}_\d{{3}} (e.g., Q_B1_001)
- CLUE: CLUE_B{batch_num}_\d{{3}} (e.g., CLUE_B1_001)
- OPTION: OPT_B{batch_num}_\d{{3}} (e.g., OPT_B1_001)
- ITEM: ITEM_B{batch_num}_\d{{3}} (e.g., ITEM_B1_001)
- HINT: HINT_B{batch_num}_\d{{3}} (e.g., HINT_B1_001)

# Puzzle Quantity & Type Requirements
Each batch should respect these constraints relatively:
{puzzle_requirements}

# Output JSON Schema
You must strictly return a JSON object with "clues" and "questions" arrays matching this exact schema for questions:
{json_schema}

# Task
Generate ONLY the "questions" and "clues" arrays that fit naturally into the existing scenes.
Return a JSON object: {{"clues": [...], "questions": [...]}}

CRITICAL RULES:
1. Every Question MUST specify a "sceneId" that exists in the Story Context above.
2. Every Clue MUST specify a "foundInScene" that exists in the Story Context above.
3. "knowledgeId" and "relatedKnowledge" MUST exactly match the `id` string provided in the `concepts_details` or `chunks`. DO NOT invent new IDs like CONC_001.
4. Use strictly English letters and standard punctuation. NO math special characters like ×, ≠, or ≈.
5. Provide strict valid JSON without markdown formatting outside the curly braces.
"""

GENERATE_SCRIPT_BLUEPRINT_TEMPLATE = PromptTemplate(
    name="generate_script_blueprint",
    system_prompt="",
    user_prompt_template=GENERATE_SCRIPT_BLUEPRINT_PROMPT,
    base_tokens=content_budget.estimate_tokens(GENERATE_SCRIPT_BLUEPRINT_PROMPT),
    output_ratio=2.0
)

GENERATE_SCRIPT_PUZZLES_TEMPLATE = PromptTemplate(
    name="generate_script_puzzles",
    system_prompt="",
    user_prompt_template=GENERATE_SCRIPT_PUZZLES_PROMPT,
    base_tokens=content_budget.estimate_tokens(GENERATE_SCRIPT_PUZZLES_PROMPT),
    output_ratio=2.0
)

CHALLENGE_SCORING_SYSTEM_PROMPT = (
    "You are an expert judge for a learning platform challenge. "
    "You evaluate student submissions fairly and provide constructive feedback. "
    "Always respond with valid JSON only."
)

CHALLENGE_SCORING_USER_PROMPT = """Evaluate this challenge submission.

CHALLENGE:
- Title: {challenge_title}
- Type: {challenge_type}
- Description: {challenge_description}
- Instructions: {challenge_instructions}

JUDGING CRITERIA:
{criteria_text}

SUBMISSION:
- Title: {submission_title}
- Content: {submission_description}

For each criterion, give a score from 0 to 100.
Provide constructive feedback (2-4 sentences) highlighting strengths and areas for improvement.

Respond ONLY with valid JSON:
{{
  "scores": {{"criterion_name": score, ...}},
  "feedback": "Your feedback here..."
}}"""


TEXT_IMPORT_SYSTEM_PROMPT = "You are an expert exam question parser. Parse raw text and convert it into structured JSON exam questions. Always respond with valid JSON only."

TEXT_IMPORT_USER_TEMPLATE = """Parse the following raw text about past paper questions and convert it into a JSON array of exam questions.

For each question found, structure it as:
{{
  "source_exam": "DSE" | "ALevel" | "Mock" (infer if not stated),
  "year": YYYY (infer current year 2024 if not stated),
  "paper": "P1" | "P2" | null,
  "question_no": "Q1" | "Q3b" | null,
  "topic": "Topic Name" (infer from question content if not provided),
  "question_stem": "Full question text",
  "question_type": "mcq" or "longq" (infer from content),
  "options": ["A. Choice 1", "B. Choice 2", "C. Choice 3", "D. Choice 4"] for MCQ, null for longq,
  "correct_answer": "A" for MCQ or full answer text for longq,
  "answer_explanation": "Detailed explanation",
  "difficulty_level": 1-5 (1=easy, 5=hard) (infer as 3 if unclear)
}}

Rules:
- If question_type seems MCQ (has options), extract choices and correct answer letter
- If question_type seems longq (essay/explanation needed), set options to null
- For difficulty: analyze question complexity (advanced math/theory = higher)
- Infer missing fields based on context and question content
- Return ONLY valid JSON array, no additional text

Raw text to parse:
{text_input}

Respond with ONLY a JSON array of question objects, no markdown formatting or explanations."""


class CrossTopicFlashcardPrompt:
    @property
    def system_prompt(self) -> str:
        return (
            "You are an expert educational flashcard creator. "
            "You create clear, concept-focused flashcards that help students deeply understand and remember key ideas. "
            "Each flashcard must define a concept, explain how it works, or test understanding with a practical example. "
            "When multiple topics are given, connect them naturally — show how concepts from one topic relate to another. "
            "Respond with ONLY valid JSON — no markdown, no commentary."
        )

    def format_user_prompt(self, topics: list[str], target_count: int) -> str:
        topics_str = ", ".join(topics)
        return f"""Generate EXACTLY {target_count} flashcards covering these topics: {topics_str}

RULES:
1. Each card must focus on a clear CONCEPT — define it, explain it, or test understanding of it.
2. The front should be a concise question or prompt (e.g. "What is X?", "How does X work?", "What is the difference between X and Y?").
3. The back should give a clear, complete answer — include the definition, explanation, and a real-world example where helpful.
4. Where topics naturally connect, create cards that bridge them (e.g. how concept A in topic 1 relates to concept B in topic 2).
5. All cards must be "standard" (Q&A) type only — do NOT generate mcq cards.
6. Add relevant "tags" (e.g. topic name, concept type like "definition", "application", "comparison").
7. For each card, generate a short "tips" hint (1-2 sentences) that helps recall without giving away the answer.
8. For each card, generate a "mnemonic" — a short memory aid (acronym, rhyme, vivid analogy, or story) to make the answer stick.

EXPECTED JSON FORMAT:
{{
  "flashcards": [
    {{
      "front": "What is [concept]?",
      "back": "Definition: ... Explanation: ... Example: ...",
      "card_type": "standard",
      "topics": ["{topics[0]}"],
      "tags": ["definition", "{topics[0]}"],
      "choices": null,
      "correct_answer": null,
      "tips": "Think about how [concept] relates to everyday experience...",
      "mnemonic": "Remember: [short memorable phrase or acronym]"
    }}
  ]
}}

Generate EXACTLY {target_count} flashcards. Return ONLY the JSON object."""


CROSS_TOPIC_FLASHCARD_PROMPT = CrossTopicFlashcardPrompt()


def get_ask_detective_system_prompt(ask_count: int) -> str:
    if ask_count == 1:
        scaffolding_guidance = (
            "This is their FIRST time asking for help. Provide a BROAD, CONCEPTUAL hint. "
            "Point out their wrong assumptions and ask a Socratic question to guide their thinking. "
            "Do NOT give away any direct facts about the right answer."
        )
    elif ask_count == 2:
        scaffolding_guidance = (
            "This is their SECOND time asking for help. Provide a MORE SPECIFIC hint based on the evidence. "
            "Draw their attention to a specific clue or fact in the scene that relates to the 'Right Answer'. "
            "You can be a bit more direct, but still leave the final deduction to them."
        )
    else:
        scaffolding_guidance = (
            "They have asked for help THREE OR MORE times. Provide a HIGHLY DIRECT hint. "
            "Practically walk them to the answer using the 'Underlying Concept' and 'Right Answer', "
            "but stop just short of literally saying the exact words."
        )

    return (
        "You are a brilliant, slightly grumpy but ultimately helpful veteran detective mentoring a rookie. "
        "Your goal is to provide a Socratic hint that nudges them "
        "toward the right deduction, WITHOUT ever directly giving away the 'Right Answer'.\n\n"
        "Guidelines:\n"
        "1. Gently mock or critique their 'previous wrong attempts' to show you're paying attention.\n"
        "2. Explain the 'Underlying Concept' briefly by recalling a fictional 'past case' or generating a gritty real-world analogy to help the rookie understand WHY they are wrong.\n"
        "3. Ask a guiding question (Socratic method) relating back to the current 'Scene Context'.\n"
        "4. Do NOT reveal the exact text of the 'Right Answer'. Let them connect the dots.\n"
        "5. Keep your response under 4 sentences. Be punchy, immersive, and educational.\n\n"
        f"**DYNAMIC SCAFFOLDING INSTRUCTION**: {scaffolding_guidance}\n\n"
        "Example 1 (Concept: Cyanide Poisoning, Rookie inputs 'Heart attack'):\n"
        "*A heart attack, rookie? Did you miss the almond smell? Reminds me of the O'Malley hit back in '98, they used cyanide in his whiskey to mimic a natural death. Take another look at what our victim was drinking.*\n\n"
        "Example 2 (Concept: Chain of Custody, Rookie inputs 'Arrest suspect then find weapon'):\n"
        "*You want to slap cuffs on the guy before we even have the murder weapon? If we break the chain of custody like that, the defense will chew us alive in court. Think about the basic protocol for securing a scene first.*"
    )


ASK_DETECTIVE_USER_PROMPT = """
Case Title: {title}
Scene Context: {scene_context}
Question for Rookie: {question_content}
Right Answer (DO NOT REVEAL directly): {right_answer_text}
Underlying Concept to Teach (Use an analogy/past case to explain this): {kb_info}
Rookie's previous wrong attempts: {wrong_answers_str}
Times Asked for Help on this question: {ask_count}

Provide the hint now (Follow the dynamic scaffolding instruction closely):
"""

JUDGE_SUBJECTIVE_ANSWER_TEMPLATE = PromptTemplate(
    name="judge_subjective_answer",
    base_tokens=3000,
    system_prompt=(
        "You are an AI Tutor judging a player's answer in an educational game.\n"
        "Assess whether the user's answer is correct or conceptually accurate based on the question and provided references.\n"
        "If there is a reference 'correctAnswers' list, you should be lenient and accept synonyms, partial matches (if they capture the core idea), or conceptually identical responses.\n"
        "If there are no reference 'correctAnswers', rely entirely on your knowledge to judge if the user's answer correctly answers the 'questionText'.\n\n"
        "Return ONLY a JSON object exactly matching this schema:\n"
        "{\n"
        "  \"isCorrect\": boolean,\n"
        "  \"feedback\": \"A short, encouraging explanation of why it is correct or incorrect.\"\n"
        "}"
    ),
    user_prompt_template=(
        "Question: {question_text}\n"
        "Reference Correct Answers (if any): {correct_answers}\n"
        "Related Knowledge/Context (if any): {related_knowledge}\n\n"
        "User's Answer: {user_answer}\n\n"
        "Judge the user's answer and output the JSON result."
    )
)

TAG_SUGGEST_MISSING_PROMPT = PromptTemplate(
    name="tag_suggest_missing",
    base_tokens=2500,
    system_prompt=(
        "You are a knowledge organization assistant. "
        "Analyze the user's content and suggest NEW tags with the specific content items that should receive each tag.\n\n"
        "Rules:\n"
        "- Suggest 3-6 NEW tags that would help organize the content\n"
        "- Do NOT suggest tags that already exist in the user's tag list\n"
        "- Tags should be short (1-3 words)\n"
        "- For each tag, list the content IDs that should be tagged with it\n"
        "- Only include content that clearly fits the tag\n"
        "- Return ONLY a JSON array:\n"
        "[{\"name\": \"tag name\", \"reason\": \"brief reason\", \"content_ids\": [\"id1\", \"id2\"]}]"
    ),
    user_prompt_template=(
        "User's existing tags: {existing_tags}\n\n"
        "User's content (format: [ID] Type: Title):\n{content_samples}\n\n"
        "Suggest NEW tags and which content IDs should receive each tag:"
    )
)

PROMPTS = {
    "extraction": EXTRACTION_PROMPT,
    "flashcard": FLASHCARD_PROMPT,
    "cross_topic_flashcard": CROSS_TOPIC_FLASHCARD_PROMPT,
    "summary": SUMMARY_PROMPT,
    "analysis_helper": ANALYSIS_HELPER_PROMPT,
    "generate_script": GENERATE_SCRIPT_PROMPT_TEMPLATE,
    "parsed_document": PARSED_DOCUMENT_SYSTEM_PROMPT,
    "generate_script_blueprint": GENERATE_SCRIPT_BLUEPRINT_TEMPLATE,
    "generate_script_puzzles": GENERATE_SCRIPT_PUZZLES_TEMPLATE,
    "judge_subjective_answer": JUDGE_SUBJECTIVE_ANSWER_TEMPLATE,
    "tag_suggest_missing": TAG_SUGGEST_MISSING_PROMPT,
}


def get_prompt(name: str) -> PromptTemplate:

    if name not in PROMPTS:
        raise ValueError(f"Unknown prompt: {name}. Available: {list(PROMPTS.keys())}")
    return PROMPTS[name]


def format_hints_section(hints: dict | None) -> str:
    if not hints:
        return ""

    parts = ["\n[CONTEXT FROM PREVIOUS BATCHES]"]

    if topics := hints.get("topics"):
        parts.append(f"Topics covered: {', '.join(topics)}")
    if keywords := hints.get("keywords"):
        parts.append(f"Key terms: {', '.join(keywords)}")
    if summary := hints.get("context_summary"):
        parts.append(f"Summary: {summary}")

    return "\n".join(parts) + "\n" if len(parts) > 1 else ""


def estimate_hints_tokens(hints: dict | None) -> int:

    if not hints:
        return 0
    return content_budget.estimate_tokens(format_hints_section(hints))
