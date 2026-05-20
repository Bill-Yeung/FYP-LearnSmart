import logging
import os
from collections import Counter
from io import BytesIO
import torch
import open_clip
from PIL import Image

logger = logging.getLogger(__name__)

_CACHE_KEY = "models--timm--ViT-B-16-SigLIP"

_model = None
_tokenizer = None
_preprocess = None
_device = None

KEEP_CATEGORIES = [
    "an educational diagram with text and shapes",
    "a mathematical graph showing data or functions",
    "a chart with numbers or statistics",
    "a technical illustration explaining a concept",
    "a screenshot showing information or interface",
    "a flowchart showing process steps",
    "a scientific diagram or schematic",
    "an infographic with educational content",
]

DISCARD_CATEGORIES = [
    "a solid color background or gradient",
    "a simple decorative border or frame",
    "a small decorative icon",
    "a company logo or branding element",
    "a repeating decorative pattern",
    "a page header or footer decoration",
    "a watermark or background texture",
    "a simple geometric shape decoration",
]

def _resolve_device():
    global _device
    if _device is not None:
        return _device
    if torch.backends.mps.is_available():
        _device = "mps"
    elif torch.cuda.is_available():
        _device = "cuda"
    else:
        _device = "cpu"
    logger.info(f"SigLIP device: {_device}")
    return _device

def _load():
    global _model, _tokenizer, _preprocess
    if _model is not None:
        return _model, _tokenizer, _preprocess

    device = _resolve_device()
    model_name = "hf-hub:timm/ViT-B-16-SigLIP"
    logger.info(f"Loading SigLIP model {model_name} on {device}...")

    _model, _, _preprocess = open_clip.create_model_and_transforms(
        model_name, device=device)
    _tokenizer = open_clip.get_tokenizer(model_name)
    _model.eval()
    logger.info("SigLIP model loaded")
    return _model, _tokenizer, _preprocess

def is_available() -> bool:
    return True

def ensure_downloaded():

    cache_dir = os.path.join(os.environ["HF_HOME"], "hub", _CACHE_KEY)
    snapshots = os.path.join(cache_dir, "snapshots")
    if os.path.isdir(snapshots) and os.listdir(snapshots):
        logger.info(f"SigLIP model already cached at {cache_dir}")
        _load()
        return
    logger.info("Downloading SigLIP model...")
    _load()
    logger.info("SigLIP model ready")

def _is_mostly_single_color(image: Image.Image, threshold: float = 0.90) -> bool:
    try:
        small = image.resize((50, 50))
        pixels = list(small.getdata())
        if not pixels:
            return False
        quantized = [(r // 32, g // 32, b // 32) for r, g, b in pixels]
        color_counts = Counter(quantized)
        most_common_count = color_counts.most_common(1)[0][1]
        return most_common_count / len(pixels) > threshold
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
            if max(color_counts.values()) / len(pixels) < 0.4:
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

def classify(image_bytes: bytes) -> dict:

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return {
            "should_keep": False,
            "category": "invalid",
            "confidence": 1.0,
            "reason": f"Could not open image: {e}"}

    width, height = image.size

    if width < 100 and height < 100:
        return {
            "should_keep": False,
            "category": "small_icon",
            "confidence": 0.9,
            "reason": f"Image too small ({width}x{height})"}

    if _is_mostly_single_color(image):
        return {
            "should_keep": False,
            "category": "blank_or_solid",
            "confidence": 0.95,
            "reason": "Image is mostly a single color"}

    if _is_gradient_background(image):
        return {
            "should_keep": False,
            "category": "gradient_background",
            "confidence": 0.85,
            "reason": "Image appears to be a gradient background"}

    if _is_low_complexity(image):
        return {
            "should_keep": False,
            "category": "low_complexity_pattern",
            "confidence": 0.80,
            "reason": "Image has very low visual complexity"}

    model, tokenizer, preprocess = _load()
    device = _resolve_device()

    all_categories = KEEP_CATEGORIES + DISCARD_CATEGORIES

    image_input = preprocess(image).unsqueeze(0).to(device)
    text_tokens = tokenizer(all_categories).to(device)

    with torch.no_grad():
        image_features = model.encode_image(image_input)
        text_features = model.encode_text(text_tokens)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        similarity = (image_features @ text_features.T).squeeze(0)
        probs = similarity.softmax(dim=0).cpu().numpy()

    best_idx = int(probs.argmax())
    best_category = all_categories[best_idx]
    best_confidence = float(probs[best_idx])

    should_keep = best_idx < len(KEEP_CATEGORIES)

    if not should_keep and best_confidence < 0.75:
        return {
            "should_keep": True,
            "category": best_category,
            "confidence": best_confidence,
            "reason": f"Low confidence ({best_confidence:.1%}), keeping to be safe"}

    return {
        "should_keep": should_keep,
        "category": best_category,
        "confidence": best_confidence,
        "reason": f"SigLIP classified as '{best_category}' with {best_confidence:.1%} confidence"}
