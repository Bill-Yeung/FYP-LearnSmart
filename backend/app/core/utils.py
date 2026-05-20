import math
import re


def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:

    if len(vec1) != len(vec2):
        raise ValueError(f"Vector dimensions must match: {len(vec1)} vs {len(vec2)}")

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)

def normalize_text(text: str) -> str:

    text = ' '.join(text.lower().split())
    text = re.sub(r'[,;:\.!?"\'\-\(\)\[\]]', '', text)
    return text

def lcs_length(words_x: list[str], words_y: list[str]) -> int:

    m, n = len(words_x), len(words_y)
    if m == 0 or n == 0:
        return 0

    prev = [0] * (n + 1)
    curr = [0] * (n + 1)

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if words_x[i - 1] == words_y[j - 1]:
                curr[j] = prev[j - 1] + 1
            else:
                curr[j] = max(prev[j], curr[j - 1])
        prev, curr = curr, [0] * (n + 1)

    return prev[n]

def rouge_l(candidate: str, reference: str) -> tuple[float, float, float]:

    cand_words = normalize_text(candidate).split()
    ref_words = normalize_text(reference).split()

    if not cand_words or not ref_words:
        return 0.0, 0.0, 0.0

    lcs_len = lcs_length(cand_words, ref_words)

    precision = lcs_len / len(cand_words)
    recall = lcs_len / len(ref_words)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return precision, recall, f1
