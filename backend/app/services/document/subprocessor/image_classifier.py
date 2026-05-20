import logging
import os
import time
import re
from dataclasses import dataclass
from io import BytesIO
from PIL import Image
from collections import Counter
import torch
from transformers import CLIPProcessor, CLIPModel
import httpx

from app.core.config import settings
from app.core.gateway_diagnostics import log_gateway_diagnostics

logger = logging.getLogger(__name__)

_gateway_backoff_expires = 0.0

_clip_model = None
_clip_processor = None
_device = None
_local_clip_disabled_logged = False

KEEP_CATEGORIES = [
    "an educational diagram with text and shapes",
    "a mathematical graph showing data or functions",
    "a chart with numbers or statistics",
    "a technical illustration explaining a concept",
    "a screenshot showing information or interface",
    "a flowchart showing process steps",
    "a scientific diagram or schematic",
    "an infographic with educational content"]

DISCARD_CATEGORIES = [
    "a solid color background or gradient",
    "a simple decorative border or frame",
    "a small decorative icon",
    "a company logo or branding element",
    "a repeating decorative pattern",
    "a page header or footer decoration",
    "a watermark or background texture",
    "a simple geometric shape decoration"]

DISCARD_KEYWORDS = (
    "background",
    "border",
    "decorative",
    "frame",
    "geometric shape",
    "gradient",
    "header",
    "footer",
    "icon",
    "logo",
    "pattern",
    "texture",
    "watermark")

KEEP_KEYWORDS = (
    "chart",
    "diagram",
    "educational",
    "flowchart",
    "graph",
    "infographic",
    "interface",
    "screenshot",
    "scientific",
    "schematic",
    "technical")

@dataclass
class ClassificationResult:
    should_keep: bool
    category: str
    confidence: float
    reason: str

def _load_clip():

    global _clip_model, _clip_processor, _device, _local_clip_disabled_logged

    if _clip_model is not None:
        return _clip_model, _clip_processor, _device

    try:

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        local_path = settings.image_classifier_local_model
        if local_path and os.path.isdir(local_path):
            model_name = local_path
        elif settings.image_classifier_allow_hf_download:
            model_name = "openai/clip-vit-base-patch32"
        else:
            if not _local_clip_disabled_logged:
                logger.info(
                    "Local CLIP fallback disabled because no cached model was found at "
                    f"{local_path!r}. Set IMAGE_CLASSIFIER_ALLOW_HF_DOWNLOAD=true to allow "
                    "backend Hugging Face downloads.")
                _local_clip_disabled_logged = True
            return None, None, None

        logger.info(f"Loading CLIP model from {model_name} on {_device}...")

        local_only = model_name == local_path
        _clip_model = CLIPModel.from_pretrained(
            model_name,
            local_files_only=local_only).to(_device)
        _clip_processor = CLIPProcessor.from_pretrained(
            model_name,
            local_files_only=local_only)
        logger.info("CLIP model loaded successfully")

        return _clip_model, _clip_processor, _device

    except ImportError as e:
        logger.warning(f"CLIP not available: {e}. Install with: pip install transformers torch")
        return None, None, None
    except Exception as e:
        logger.error(f"Failed to load CLIP: {e}")
        return None, None, None

def classify_image(source: bytes | Image.Image) -> ClassificationResult:

    if isinstance(source, bytes):

        try:
            image = Image.open(BytesIO(source)).convert("RGB")

        except Exception as e:
            logger.debug(f"Failed to open image: {e}")
            return ClassificationResult(
                should_keep = False,
                category = "invalid",
                confidence = 1.0,
                reason = "Could not open image")
    else:
        image = source.convert("RGB") if source.mode != "RGB" else source

    width, height = image.size

    if width < 100 and height < 100:
        return ClassificationResult(
            should_keep = False,
            category = "small_icon",
            confidence = 0.9,
            reason = f"Image too small ({width}x{height})")

    if _is_mostly_single_color(image, threshold = 0.90):
        return ClassificationResult(
            should_keep = False,
            category = "blank_or_solid",
            confidence = 0.95,
            reason = "Image is mostly a single color")

    if _is_gradient_background(image):
        return ClassificationResult(
            should_keep = False,
            category = "gradient_background",
            confidence = 0.85,
            reason = "Image appears to be a gradient background")

    if _is_low_complexity(image):
        return ClassificationResult(
            should_keep = False,
            category = "low_complexity_pattern",
            confidence = 0.80,
            reason = "Image has very low visual complexity")

    model, processor, device = _load_clip()

    if model is None:
        return ClassificationResult(
            should_keep = True,
            category = "unknown",
            confidence = 0.5,
            reason = "CLIP not available, keeping by default")

    try:

        all_categories = KEEP_CATEGORIES + DISCARD_CATEGORIES

        inputs = processor(
            text = all_categories,
            images = image,
            return_tensors = "pt",
            padding = True).to(device)

        with torch.no_grad():
            outputs = model(**inputs)
            logits_per_image = outputs.logits_per_image
            probs = logits_per_image.softmax(dim = 1).cpu().numpy()[0]

        best_idx = probs.argmax()
        best_category = all_categories[best_idx]
        best_confidence = float(probs[best_idx])

        should_keep = best_idx < len(KEEP_CATEGORIES)

        if not should_keep and best_confidence < 0.75:
            return ClassificationResult(
                should_keep = True,
                category = best_category,
                confidence = best_confidence,
                reason = f"Low confidence ({best_confidence:.1%}), keeping to be safe")

        return ClassificationResult(
            should_keep = should_keep,
            category = best_category,
            confidence = best_confidence,
            reason = f"CLIP classified as '{best_category}' with {best_confidence:.1%} confidence")

    except Exception as e:
        logger.error(f"CLIP classification failed: {e}")
        return ClassificationResult(
            should_keep = True,
            category = "error",
            confidence = 0.0,
            reason = f"Classification error: {e}")

def _classification_from_payload(data: dict, source: str) -> ClassificationResult | None:

    category = str(data.get("category") or data.get("label") or "")
    reason = data.get("reason") or f"{source} classified as '{category}'"
    confidence = float(data.get("confidence") or data.get("score") or 0.0)

    should_keep = data.get("should_keep")
    if isinstance(should_keep, bool):
        return ClassificationResult(
            should_keep=should_keep,
            category=category,
            confidence=confidence,
            reason=reason)

    category_text = f"{category} {reason}".lower()
    if any(keyword in category_text for keyword in DISCARD_KEYWORDS):
        return ClassificationResult(
            should_keep=False,
            category=category,
            confidence=confidence,
            reason=reason)
    if any(keyword in category_text for keyword in KEEP_KEYWORDS):
        return ClassificationResult(
            should_keep=True,
            category=category,
            confidence=confidence,
            reason=reason)

    return None

def _classify_with_gateway(image_bytes: bytes) -> ClassificationResult | None:

    gateway_urls = settings.model_gateway_urls
    if not gateway_urls:
        return None

    global _gateway_backoff_expires
    now = time.time()
    if now < _gateway_backoff_expires:
        remaining = max(0, int(_gateway_backoff_expires - now))
        logger.info(
            f"Skipping gateway image classification due to backoff: "
            f"gateway_urls={gateway_urls}, retry_in_seconds={remaining}")
        return None

    failures = []
    timeout = httpx.Timeout(30.0, connect=3.0)
    with httpx.Client(timeout=timeout, trust_env=False) as client:
        for gateway_url in gateway_urls:
            classify_url = f"{gateway_url}/classify-image"
            try:
                resp = client.post(
                    classify_url,
                    files={"image": ("image.bin", image_bytes, "application/octet-stream")})

                if resp.status_code != 200:
                    logger.warning(
                        f"Gateway image classification failed: "
                        f"url={classify_url}, status={resp.status_code}, body={resp.text[:200]!r}")
                    continue

                data = resp.json()
                result = _classification_from_payload(data, "Gateway SigLIP")
                if result is None:
                    logger.debug("Gateway classification did not include a clear keep decision; falling back")
                    continue

                logger.info(f"Image classification via gateway SigLIP at {gateway_url}: {result.category}")
                return result

            except Exception as e:
                failures.append(f"{classify_url}: {type(e).__name__}: {e}")
                logger.warning(
                    f"Gateway image classification unavailable: "
                    f"url={classify_url}, error={type(e).__name__}: {e}")
                continue

    log_gateway_diagnostics(f"image classification failed; failures={failures}")
    _gateway_backoff_expires = now + settings.model_gateway_backoff_seconds
    return None

def _classify_with_hf_inference(image_bytes: bytes) -> ClassificationResult | None:

    token = settings.image_classifier_hf_token or os.getenv("HF_TOKEN", "")
    model = settings.image_classifier_hf_model
    if not token or not model:
        return None

    try:
        from huggingface_hub import InferenceClient

        client = InferenceClient(
            provider=settings.image_classifier_hf_provider,
            api_key=token)
        outputs = client.zero_shot_image_classification(
            image=image_bytes,
            candidate_labels=KEEP_CATEGORIES + DISCARD_CATEGORIES,
            model=model)
    except Exception as e:
        logger.debug(f"Hugging Face image classification unavailable: {e}")
        return None

    if not outputs:
        return None

    best = max(
        outputs,
        key=lambda item: item.get("score", 0.0) if isinstance(item, dict) else getattr(item, "score", 0.0))
    label = str(best.get("label", "") if isinstance(best, dict) else getattr(best, "label", ""))
    score = float(best.get("score", 0.0) if isinstance(best, dict) else getattr(best, "score", 0.0))
    idx = (KEEP_CATEGORIES + DISCARD_CATEGORIES).index(label) if label in KEEP_CATEGORIES + DISCARD_CATEGORIES else -1
    should_keep = idx >= 0 and idx < len(KEEP_CATEGORIES)

    if not should_keep and score < 0.75:
        return ClassificationResult(
            should_keep=True,
            category=label,
            confidence=score,
            reason=f"Hosted HF SigLIP low confidence ({score:.1%}), keeping to be safe")

    return ClassificationResult(
        should_keep=should_keep,
        category=label,
        confidence=score,
        reason=f"Hosted HF SigLIP classified as '{label}' with {score:.1%} confidence")

def _is_mostly_single_color(image: Image.Image, threshold: float = 0.90) -> bool:

    try:

        small = image.resize((50, 50))
        pixels = list(small.getdata())

        if not pixels:
            return False

        quantized = [(r // 32, g // 32, b // 32) for r, g, b in pixels]
        color_counts = Counter(quantized)
        most_common_count = color_counts.most_common(1)[0][1]
        ratio = most_common_count / len(pixels)
        return ratio > threshold

    except Exception:
        return False

def _is_gradient_background(image: Image.Image) -> bool:

    try:

        small = image.resize((50, 50))
        pixels = list(small.getdata())

        if not pixels:
            return False

        quantized = [(r // 16, g // 16, b // 16) for r, g, b in pixels]
        unique_colors = len(set(quantized))

        if 10 < unique_colors < 100:
            color_counts = Counter(quantized)
            max_count = max(color_counts.values())
            if max_count / len(pixels) < 0.4:
                return True

        return False

    except Exception:
        return False

def _is_low_complexity(image: Image.Image) -> bool:

    try:

        small = image.resize((50, 50))
        pixels = list(small.getdata())

        if not pixels:
            return False

        quantized = [(r // 64, g // 64, b // 64) for r, g, b in pixels]
        unique_colors = len(set(quantized))

        return 2 < unique_colors <= 5

    except Exception:
        return False

def _has_meaningful_ocr_text(ocr_text: str) -> bool:

    text = ocr_text.strip()
    if len(text) < 20:
        return False

    alpha_chars = sum(1 for char in text if char.isalpha())
    digit_chars = sum(1 for char in text if char.isdigit())
    if alpha_chars < 12 or digit_chars > alpha_chars * 2:
        return False

    words = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text)
    if len(words) < 3:
        return False

    unique_words = {word.lower() for word in words}
    return len(unique_words) >= 2

def quick_image_discard_reason(image_bytes: bytes) -> str | None:

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return "Could not open image"

    width, height = image.size
    if width < 100 and height < 100:
        return f"Image too small ({width}x{height})"

    if _is_mostly_single_color(image, threshold = 0.90):
        return "Image is mostly a single color"

    if _is_gradient_background(image):
        return "Image appears to be a gradient background"

    if _is_low_complexity(image):
        return "Image has very low visual complexity"

    return None

def should_keep_image(image_bytes: bytes, ocr_text: str = "") -> tuple[bool, str]:

    if ocr_text and _has_meaningful_ocr_text(ocr_text):
        return True, "Contains meaningful OCR text"

    discard_reason = quick_image_discard_reason(image_bytes)
    if discard_reason:
        return False, discard_reason

    result = _classify_with_gateway(image_bytes)
    if result is not None:
        return result.should_keep, result.reason

    result = _classify_with_hf_inference(image_bytes)
    if result is not None:
        return result.should_keep, result.reason

    result = classify_image(image_bytes)
    return result.should_keep, result.reason
