import base64
import json
import re
from pathlib import Path

from openai import OpenAI

from app.core.config import GROQ_API_KEY, OBJECT_DETECTION_MODEL


class ObjectDetectionService:
    """Use a Groq vision model to identify objects in an uploaded image."""

    def __init__(self) -> None:
        if not GROQ_API_KEY or GROQ_API_KEY == "<SECRET>":
            raise ValueError("Set GROQ_API_KEY")

        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

    def get_status(self) -> dict:
        return {
            "status": "ready",
            "message": "Object detection route is available.",
            "model": OBJECT_DETECTION_MODEL,
        }

    def detect_objects(self, image_bytes: bytes, filename: str, content_type: str | None = None) -> dict:
        media_type = self._media_type(filename, content_type)
        encoded = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{media_type};base64,{encoded}"

        prompt = (
            "Detect the visible objects in this image. "
            "Return valid JSON only with this shape: "
            '{"summary":"short summary","objects":[{"label":"object name","count":1,'
            '"confidence":"high|medium|low","location":"short approximate location"}]}. '
            "Only include objects that are clearly visible. "
            "If nothing clear is visible, return an empty objects array."
        )

        response = self.client.responses.create(
            model=OBJECT_DETECTION_MODEL,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {
                            "type": "input_image",
                            "detail": "auto",
                            "image_url": image_url,
                        },
                    ],
                }
            ],
        )

        raw_text = (response.output_text or "").strip()
        parsed = self._parse_json_response(raw_text)
        objects = parsed.get("objects", [])

        return {
            "summary": parsed.get("summary", "Object detection completed."),
            "objects": objects,
            "raw_response": raw_text,
            "object_count": sum(max(int(item.get("count", 0)), 0) for item in objects),
            "model": OBJECT_DETECTION_MODEL,
        }

    def _parse_json_response(self, raw_text: str) -> dict:
        if not raw_text:
            return {"summary": "No response returned by the model.", "objects": []}

        cleaned = raw_text.strip()

        try:
            parsed = json.loads(cleaned)
            return self._normalize_payload(parsed)
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return self._normalize_payload(parsed)
            except json.JSONDecodeError:
                pass

        return {
            "summary": "The model returned an unstructured response.",
            "objects": [],
        }

    def _normalize_payload(self, payload: dict) -> dict:
        summary = str(payload.get("summary", "Object detection completed.")).strip()
        objects = payload.get("objects", [])

        if not isinstance(objects, list):
            objects = []

        normalized_objects = []
        for item in objects:
            if not isinstance(item, dict):
                continue

            label = str(item.get("label", "")).strip()
            if not label:
                continue

            count_value = item.get("count", 1)
            try:
                count = max(int(count_value), 1)
            except (TypeError, ValueError):
                count = 1

            confidence = str(item.get("confidence", "medium")).strip().lower() or "medium"
            location = str(item.get("location", "unspecified")).strip() or "unspecified"

            normalized_objects.append(
                {
                    "label": label,
                    "count": count,
                    "confidence": confidence,
                    "location": location,
                }
            )

        return {
            "summary": summary,
            "objects": normalized_objects,
        }

    def _media_type(self, filename: str, content_type: str | None = None) -> str:
        normalized_content_type = (content_type or "").lower()
        if normalized_content_type in {"image/jpeg", "image/png", "image/webp"}:
            return normalized_content_type

        suffix = Path(filename).suffix.lower()
        if suffix in {".jpg", ".jpeg"}:
            return "image/jpeg"
        if suffix == ".png":
            return "image/png"
        if suffix == ".webp":
            return "image/webp"
        raise ValueError("Only JPG, JPEG, PNG, and WEBP files are allowed.")
