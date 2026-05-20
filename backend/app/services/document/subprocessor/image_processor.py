import logging
from io import BytesIO
from PIL import Image
import pytesseract
import cv2
import numpy as np

from app.services.document.extraction_tree import ProcessorResult

logger = logging.getLogger(__name__)

class ImageProcessor:

    def __init__(self):

        # Common languages: English, Simplified Chinese, Traditional Chinese, Japanese, Korean
        self.language = "eng+chi_sim+chi_tra+jpn+kor"
        # OEM 3 = LSTM neural network, PSM 3 = auto page segmentation
        self.tesseract_config = "--oem 3 --psm 3"

    def process(self, source: str | bytes | Image.Image) -> ProcessorResult:

        try:

            if isinstance(source, Image.Image):
                image = source
            elif isinstance(source, bytes):
                image = Image.open(BytesIO(source))
            else:
                image = Image.open(source)

            return self._run_ocr(image)

        except Exception as e:

            logger.error(f"Image OCR failed: {e}")
            return ProcessorResult(success=False, error=str(e))

    def _run_ocr(self, image: Image.Image) -> ProcessorResult:

        processed_image = self._preprocess(image)

        ocr_data = pytesseract.image_to_data(
            processed_image,
            lang = self.language,
            config = self.tesseract_config,
            output_type = pytesseract.Output.DICT)

        texts = []
        confidences = []

        for i, text in enumerate(ocr_data['text']):

            conf = ocr_data['conf'][i]

            if text.strip() and conf > 0:
                texts.append(text)
                confidences.append(conf)

        full_text = ' '.join(texts)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        logger.debug(f"OCR extracted {len(full_text)} chars with {avg_confidence:.1f}% confidence")

        return ProcessorResult(
            success = True,
            output_text = full_text,
            confidence = avg_confidence / 100)

    def _preprocess(self, image: Image.Image) -> Image.Image:

        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2)

        return Image.fromarray(thresh)

# Global instance
image_processor = ImageProcessor()
