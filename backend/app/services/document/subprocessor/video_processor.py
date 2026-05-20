import logging
import os
import tempfile

import numpy as np
from PIL import Image
from moviepy import VideoFileClip

from app.services.document.extraction_tree import ProcessorResult
from app.services.document.subprocessor.audio_processor import audio_processor
from app.services.document.subprocessor.image_processor import image_processor

logger = logging.getLogger(__name__)

def levenshtein_distance(s1: str, s2: str) -> int:

    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]

def is_similar_text(text1: str, text2: str, threshold: float = 0.3) -> bool:

    if not text1 and not text2:
        return True
    if not text1 or not text2:
        return False

    max_len = max(len(text1), len(text2))
    if max_len == 0:
        return True

    distance = levenshtein_distance(text1, text2)
    similarity_ratio = distance / max_len
    return similarity_ratio < threshold

class VideoProcessor:

    def __init__(self):

        self.image_processor = image_processor

    def _frame_histogram(self, frame: np.ndarray) -> np.ndarray:

        hist = np.zeros(768)
        for ch in range(3):
            channel = frame[:, :, ch].flatten()
            h, _ = np.histogram(channel, bins=256, range=(0, 256))
            hist[ch * 256:(ch + 1) * 256] = h
        total = hist.sum()
        if total > 0:
            hist = hist / total
        return hist

    def _detect_scene_changes(
        self,
        video: VideoFileClip,
        sample_interval: float = 0.5,
        threshold: float = 0.4) -> list[float]:
        duration = video.duration
        timestamps = [0.0]
        prev_hist = None
        t = 0.0

        while t < duration:
            try:
                frame = video.get_frame(t)
                hist = self._frame_histogram(frame)
                if prev_hist is not None:
                    diff = np.sum(np.abs(hist - prev_hist))
                    if diff > threshold:
                        timestamps.append(t)
                prev_hist = hist
            except Exception:
                pass
            t += sample_interval

        logger.info(f"Scene detection: {len(timestamps)} scene changes in {duration:.1f}s video")
        return timestamps

    def _extract_frame_ocr(
        self,
        video: VideoFileClip,
        timestamp: float) -> str:

        try:

            frame = video.get_frame(timestamp)
            img = Image.fromarray(np.uint8(frame))
            ocr_result = self.image_processor.process(img)
            return ocr_result.output_text if ocr_result.success else ""

        except Exception as e:
            logger.debug(f"Frame OCR failed at {timestamp}s: {e}")
            return ""

    def _extract_subtitle_text(
        self,
        video: VideoFileClip,
        timestamp: float) -> str:

        try:
            frame = video.get_frame(timestamp)
            h = frame.shape[0]
            subtitle_region = frame[int(h * 0.75):, :, :]
            img = Image.fromarray(np.uint8(subtitle_region))
            ocr_result = self.image_processor.process(img)
            return ocr_result.output_text.strip() if ocr_result.success else ""
        except Exception as e:
            logger.debug(f"Subtitle OCR failed at {timestamp}s: {e}")
            return ""

    def _extract_visual_text(
        self,
        video: VideoFileClip,
        sample_interval: float = 1.0) -> str:

        scene_timestamps = self._detect_scene_changes(video)

        unique_texts = []
        prev_text = ""

        for timestamp in scene_timestamps:
            ocr_text = self._extract_frame_ocr(video, timestamp)

            if ocr_text and not is_similar_text(ocr_text, prev_text):
                unique_texts.append(ocr_text)
                prev_text = ocr_text

        combined_text = "\n---\n".join(unique_texts)
        logger.info(f"Visual extraction: {len(scene_timestamps)} scene frames, {len(unique_texts)} unique text segments")

        return combined_text

    def _extract_subtitles(
        self,
        video: VideoFileClip,
        sample_interval: float = 2.0) -> str:

        duration = video.duration
        unique_subs = []
        prev_sub = ""
        t = 0.0

        while t < duration:
            sub_text = self._extract_subtitle_text(video, t)
            if sub_text and not is_similar_text(sub_text, prev_sub):
                unique_subs.append(sub_text)
                prev_sub = sub_text
            t += sample_interval

        if unique_subs:
            logger.info(f"Subtitle extraction: {len(unique_subs)} unique subtitle segments")
        return "\n".join(unique_subs)

    def process(self, source: str | bytes) -> ProcessorResult:

        temp_video_path = None
        temp_audio_path = None

        try:

            if isinstance(source, bytes):
                with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as tmp:
                    tmp.write(source)
                    temp_video_path = tmp.name
                video_path = temp_video_path
                logger.info(f"Processing video from bytes ({len(source)} bytes)")
            else:
                video_path = source
                logger.info(f"Processing video: {video_path}")

            video = VideoFileClip(video_path)

            transcript = ""
            visual_text = ""
            subtitle_text = ""

            if video.audio is not None:

                temp_audio = tempfile.NamedTemporaryFile(suffix = '.wav', delete = False)
                temp_audio_path = temp_audio.name
                temp_audio.close()
                logger.info("Extracting audio from video")

                video.audio.write_audiofile(temp_audio_path)
                audio_result = audio_processor.process(temp_audio_path)
                if audio_result.success:
                    transcript = audio_result.output_text or ""

            else:
                logger.info("Video has no audio track")

            logger.info("Extracting visual text from scene keyframes")
            visual_text = self._extract_visual_text(video)

            logger.info("Extracting subtitle text")
            subtitle_text = self._extract_subtitles(video)

            video.close()
            logger.info(
                f"Video processed: audio={len(transcript)} chars, "
                f"visual={len(visual_text)} chars, subtitles={len(subtitle_text)} chars"
            )

            sections = []
            if transcript:
                sections.append(f"[Transcript]\n{transcript}")
            if visual_text:
                sections.append(f"[Visual Text]\n{visual_text}")
            if subtitle_text:
                sections.append(f"[Subtitles]\n{subtitle_text}")
            output_text = "\n\n".join(sections)

            return ProcessorResult(
                success = True,
                output_text = output_text)

        except Exception as e:
            logger.error(f"Video processing failed: {e}")
            return ProcessorResult(success = False, error = str(e))

        finally:
            if temp_video_path and os.path.exists(temp_video_path):
                os.unlink(temp_video_path)
            if temp_audio_path and os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)

# Global instance
video_processor = VideoProcessor()
