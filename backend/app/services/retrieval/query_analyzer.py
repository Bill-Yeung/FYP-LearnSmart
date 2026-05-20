import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Any
from enum import Enum

from app.services.ai.provider import AIProvider

logger = logging.getLogger(__name__)

class QueryIntent(Enum):
    DEFINITION = "definition"
    EXPLANATION = "explanation"
    COMPARISON = "comparison"
    EXAMPLE = "example"
    PROCEDURE = "procedure"
    PREREQUISITE = "prerequisite"
    RELATED = "related"
    GENERAL = "general"


@dataclass
class AnalyzedQuery:
    original_query: str
    normalized_query: str
    intent: QueryIntent
    concepts: List[str] = field(default_factory=list)
    expanded_terms: List[str] = field(default_factory=list)
    synonyms_used: Dict[str, str] = field(default_factory=dict)
    suggested_filters: Dict[str, Any] = field(default_factory=dict)

SYNONYMS: Dict[str, Set[str]] = {

    "machine learning": {"ml", "machine-learning", "statistical learning"},
    "deep learning": {"dl", "deep-learning", "neural network learning"},
    "artificial intelligence": {"ai", "a.i.", "artificial-intelligence"},
    "neural network": {"nn", "neural-network", "neural net", "ann"},
    "natural language processing": {"nlp", "natural-language-processing", "text processing"},
    "computer vision": {"cv", "image recognition", "visual computing"},
    "reinforcement learning": {"rl", "reinforcement-learning"},
    "convolutional neural network": {"cnn", "convnet", "convolutional-neural-network"},
    "recurrent neural network": {"rnn", "recurrent-neural-network"},
    "long short-term memory": {"lstm", "long-short-term-memory"},
    "generative adversarial network": {"gan", "generative-adversarial-network"},
    "transformer": {"transformer model", "attention model"},
    "large language model": {"llm", "large-language-model", "foundation model"},

    "application programming interface": {"api", "apis"},
    "structured query language": {"sql", "database query"},
    "database": {"db", "databases", "data store"},
    "operating system": {"os", "operating-system"},
    "object-oriented programming": {"oop", "object oriented"},
    "functional programming": {"fp", "functional-programming"},
    "graphical user interface": {"gui", "user interface", "ui"},
    "command line interface": {"cli", "command line", "terminal"},
    "integrated development environment": {"ide", "code editor"},
    "version control": {"git", "source control", "vcs"},
    "continuous integration": {"ci", "continuous-integration"},
    "continuous deployment": {"cd", "continuous-deployment"},

    "statistics": {"stats", "statistical analysis"},
    "probability": {"prob", "probabilistic"},
    "linear algebra": {"lin alg", "linear-algebra", "matrix algebra"},
    "calculus": {"calc", "differential calculus", "integral calculus"},
    "probability density function": {"pdf"},
    "cumulative distribution function": {"cdf"},
    "maximum likelihood estimation": {"mle"},
    "gradient descent": {"gd", "gradient optimization"},
    "stochastic gradient descent": {"sgd"},
    "mean squared error": {"mse"},
    "cross entropy": {"ce", "cross-entropy", "log loss"},

    "data science": {"data-science", "ds"},
    "data analysis": {"data analytics", "analytics"},
    "data visualization": {"dataviz", "data viz", "visualization"},
    "feature engineering": {"feature extraction", "feature selection"},
    "model training": {"training", "model fitting"},
    "model evaluation": {"evaluation", "model assessment"},
    "overfitting": {"over-fitting", "overfit"},
    "underfitting": {"under-fitting", "underfit"},
    "regularization": {"regularisation", "weight decay"},
    "hyperparameter": {"hyper-parameter", "hyperparameters"},

    "hypertext markup language": {"html"},
    "cascading style sheets": {"css"},
    "javascript": {"js", "ecmascript"},
    "typescript": {"ts"},
    "representational state transfer": {"rest", "restful"},
    "application programming interface": {"api", "web api"},

    "amazon web services": {"aws"},
    "google cloud platform": {"gcp"},
    "microsoft azure": {"azure"},
    "kubernetes": {"k8s"},
    "docker": {"container", "containerization"},
    "infrastructure as code": {"iac"},

    "authentication": {"auth", "authn"},
    "authorization": {"authz"},
    "encryption": {"crypto", "cryptography"},
    "secure sockets layer": {"ssl"},
    "transport layer security": {"tls"},
    "json web token": {"jwt"},
    "oauth": {"oauth2", "oauth 2.0"},
}

ABBREVIATION_LOOKUP: Dict[str, str] = {}
for full_term, abbrevs in SYNONYMS.items():
    for abbrev in abbrevs:
        if len(abbrev) <= 5:
            ABBREVIATION_LOOKUP[abbrev.lower()] = full_term

INTENT_PATTERNS = {
    QueryIntent.DEFINITION: [
        r"what (?:is|are) (?:a |an |the )?(.+?)(?:\?|$)",
        r"define (.+?)(?:\?|$)",
        r"(?:the )?definition of (.+?)(?:\?|$)",
        r"explain what (.+?) (?:is|are|means)",
    ],
    QueryIntent.EXPLANATION: [
        r"how (?:does|do) (.+?) work",
        r"explain (?:how )?(.+?)(?:\?|$)",
        r"why (?:does|do|is|are) (.+?)(?:\?|$)",
        r"can you explain (.+?)(?:\?|$)",
    ],
    QueryIntent.COMPARISON: [
        r"(?:what(?:'s| is) the )?difference between (.+?) and (.+?)(?:\?|$)",
        r"compare (.+?) (?:and|with|to|vs\.?) (.+?)(?:\?|$)",
        r"(.+?) vs\.? (.+?)(?:\?|$)",
    ],
    QueryIntent.EXAMPLE: [
        r"(?:give|show|provide)(?: me)?(?: an?)? example(?:s)? of (.+?)(?:\?|$)",
        r"example(?:s)? of (.+?)(?:\?|$)",
        r"how (?:to|do I) use (.+?) in practice",
    ],
    QueryIntent.PROCEDURE: [
        r"how (?:to|do I|can I) (.+?)(?:\?|$)",
        r"steps to (.+?)(?:\?|$)",
        r"procedure for (.+?)(?:\?|$)",
        r"guide (?:to|for) (.+?)(?:\?|$)",
    ],
    QueryIntent.PREREQUISITE: [
        r"what (?:do I need to|should I) (?:know|learn) (?:before|first|to understand) (.+?)(?:\?|$)",
        r"prerequisites? (?:for|of|to) (.+?)(?:\?|$)",
        r"requirements? (?:for|to learn) (.+?)(?:\?|$)",
    ],
    QueryIntent.RELATED: [
        r"what(?:'s| is) related to (.+?)(?:\?|$)",
        r"topics? related to (.+?)(?:\?|$)",
        r"(.+?) related (?:topics?|concepts?)(?:\?|$)",
    ],
}

class QueryAnalyzer:

    def __init__(self, ai_provider: Optional[AIProvider] = None):
        self.ai_provider = ai_provider or AIProvider()
        self._compile_patterns()

    def _compile_patterns(self):
        self._intent_patterns = {
            intent: [re.compile(p, re.IGNORECASE) for p in patterns]
            for intent, patterns in INTENT_PATTERNS.items()
        }

    def analyze(self, query: str) -> AnalyzedQuery:

        normalized = self._normalize_query(query)
        intent, extracted_concepts = self._classify_intent(normalized)
        expanded_terms, synonyms_used = self._expand_synonyms(normalized)
        concepts = list(set(extracted_concepts + self._extract_concepts(normalized)))
        filters = self._suggest_filters(intent, concepts)

        return AnalyzedQuery(
            original_query=query,
            normalized_query=normalized,
            intent=intent,
            concepts=concepts,
            expanded_terms=expanded_terms,
            synonyms_used=synonyms_used,
            suggested_filters=filters
        )

    def _normalize_query(self, query: str) -> str:

        normalized = query.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized

    def _classify_intent(self, query: str) -> tuple[QueryIntent, List[str]]:
        for intent, patterns in self._intent_patterns.items():
            for pattern in patterns:
                match = pattern.search(query)
                if match:
                    concepts = [g.strip() for g in match.groups() if g]
                    return intent, concepts

        return QueryIntent.GENERAL, []

    def _expand_synonyms(self, query: str) -> tuple[List[str], Dict[str, str]]:
        expanded = []
        synonyms_used = {}

        words = query.split()
        for word in words:
            word_clean = re.sub(r'[^\w]', '', word.lower())
            if word_clean in ABBREVIATION_LOOKUP:
                full_term = ABBREVIATION_LOOKUP[word_clean]
                expanded.append(full_term)
                synonyms_used[word_clean] = full_term

        for full_term, abbrevs in SYNONYMS.items():
            if full_term in query:
                expanded.extend(abbrevs)

        return list(set(expanded)), synonyms_used

    def _extract_concepts(self, query: str) -> List[str]:
        concepts = []

        for full_term in SYNONYMS.keys():
            if full_term in query:
                concepts.append(full_term)

        words = query.split()
        for word in words:
            word_clean = re.sub(r'[^\w]', '', word.lower())
            if word_clean in ABBREVIATION_LOOKUP:
                concepts.append(ABBREVIATION_LOOKUP[word_clean])

        return list(set(concepts))

    def _suggest_filters(self, intent: QueryIntent, concepts: List[str]) -> Dict[str, Any]:
        filters = {}

        if intent == QueryIntent.DEFINITION:
            filters["concept_type"] = "definition"
        elif intent == QueryIntent.EXAMPLE:
            filters["concept_type"] = "example"
        elif intent == QueryIntent.PROCEDURE:
            filters["concept_type"] = "procedure"
        elif intent == QueryIntent.COMPARISON:
            filters["include_related"] = True

        return filters

    def expand_query(self, query: str) -> str:

        analysis = self.analyze(query)

        parts = [analysis.normalized_query]

        for term in analysis.expanded_terms[:5]:
            if term not in analysis.normalized_query:
                parts.append(term)

        return " ".join(parts)

    def get_search_terms(self, query: str) -> List[str]:

        analysis = self.analyze(query)
        terms = [analysis.normalized_query] + analysis.concepts + analysis.expanded_terms
        return list(set(terms))

# Global instance
query_analyzer = QueryAnalyzer()


