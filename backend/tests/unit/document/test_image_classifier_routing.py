import importlib.util
import sys
from pathlib import Path


_MODULE_PATH = (
    Path(__file__).parents[3]
    / "app"
    / "services"
    / "document"
    / "subprocessor"
    / "image_classifier.py"
)
_SPEC = importlib.util.spec_from_file_location("image_classifier_under_test", _MODULE_PATH)
image_classifier = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = image_classifier
_SPEC.loader.exec_module(image_classifier)
ClassificationResult = image_classifier.ClassificationResult


def test_should_keep_image_uses_gateway_before_other_model_fallbacks(monkeypatch):
    calls = []

    monkeypatch.setattr(image_classifier, "quick_image_discard_reason", lambda _: None)

    def gateway(_):
        calls.append("gateway")
        return ClassificationResult(False, "logo", 0.95, "Gateway SigLIP classified as logo")

    def hosted(_):
        calls.append("hosted")
        raise AssertionError("hosted fallback should not run after gateway result")

    def local(_):
        calls.append("local")
        raise AssertionError("local fallback should not run after gateway result")

    monkeypatch.setattr(image_classifier, "_classify_with_gateway", gateway)
    monkeypatch.setattr(image_classifier, "_classify_with_hf_inference", hosted)
    monkeypatch.setattr(image_classifier, "classify_image", local)

    should_keep, reason = image_classifier.should_keep_image(b"image-bytes")

    assert should_keep is False
    assert reason == "Gateway SigLIP classified as logo"
    assert calls == ["gateway"]


def test_should_keep_image_uses_hosted_hf_after_gateway_miss(monkeypatch):
    calls = []

    monkeypatch.setattr(image_classifier, "quick_image_discard_reason", lambda _: None)

    def gateway(_):
        calls.append("gateway")
        return None

    def hosted(_):
        calls.append("hosted")
        return ClassificationResult(True, "diagram", 0.91, "Hosted HF SigLIP classified as diagram")

    def local(_):
        calls.append("local")
        raise AssertionError("local fallback should not run after hosted HF result")

    monkeypatch.setattr(image_classifier, "_classify_with_gateway", gateway)
    monkeypatch.setattr(image_classifier, "_classify_with_hf_inference", hosted)
    monkeypatch.setattr(image_classifier, "classify_image", local)

    should_keep, reason = image_classifier.should_keep_image(b"image-bytes")

    assert should_keep is True
    assert reason == "Hosted HF SigLIP classified as diagram"
    assert calls == ["gateway", "hosted"]


def test_should_keep_image_uses_local_clip_last(monkeypatch):
    calls = []

    monkeypatch.setattr(image_classifier, "quick_image_discard_reason", lambda _: None)

    def gateway(_):
        calls.append("gateway")
        return None

    def hosted(_):
        calls.append("hosted")
        return None

    def local(_):
        calls.append("local")
        return ClassificationResult(True, "unknown", 0.5, "CLIP not available, keeping by default")

    monkeypatch.setattr(image_classifier, "_classify_with_gateway", gateway)
    monkeypatch.setattr(image_classifier, "_classify_with_hf_inference", hosted)
    monkeypatch.setattr(image_classifier, "classify_image", local)

    should_keep, reason = image_classifier.should_keep_image(b"image-bytes")

    assert should_keep is True
    assert reason == "CLIP not available, keeping by default"
    assert calls == ["gateway", "hosted", "local"]


def test_load_clip_does_not_download_without_explicit_opt_in(monkeypatch):
    missing_model_dir = "__missing_clip_model_for_test__"

    monkeypatch.setattr(image_classifier.settings, "image_classifier_local_model", missing_model_dir)
    monkeypatch.setattr(image_classifier.settings, "image_classifier_allow_hf_download", False)
    monkeypatch.setattr(image_classifier, "_clip_model", None)
    monkeypatch.setattr(image_classifier, "_clip_processor", None)
    monkeypatch.setattr(image_classifier, "_device", None)
    monkeypatch.setattr(image_classifier, "_local_clip_disabled_logged", False)

    def fail_from_pretrained(*_, **__):
        raise AssertionError("from_pretrained should not run when download fallback is disabled")

    monkeypatch.setattr(image_classifier.CLIPModel, "from_pretrained", fail_from_pretrained)
    monkeypatch.setattr(image_classifier.CLIPProcessor, "from_pretrained", fail_from_pretrained)

    assert image_classifier._load_clip() == (None, None, None)
