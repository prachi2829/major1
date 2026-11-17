"""Gemini REST client wrapper for Campaign.AI."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from dotenv import load_dotenv
import httpx

load_dotenv()


class GeminiError(Exception):
    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def mode() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    return "gemini" if key else "no_key"


def _clean_markdown_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]
    return text.strip()


def _repair_and_load_json(text: str) -> dict[str, Any]:
    cleaned = _clean_markdown_json(text)
    # 1. Direct standard parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 2. Auto-repair missing commas between JSON fields: "val" "key": -> "val", "key":
    repaired = re.sub(
        r'("(?:[^"\\]|\\.)*"|\b(?:true|false|null|\d+(?:\.\d+)?)\b)\s+(")',
        r'\1, \2',
        cleaned,
    )
    # Remove trailing commas before } or ]
    repaired = re.sub(r',\s*([}\]])', r'\1', repaired)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # 3. Fallback: regex extraction of key-value pairs
    extracted: dict[str, Any] = {}
    pattern = r'"([^"\\]+)"\s*:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\]|\btrue\b|\bfalse\b|\bnull\b|\d+(?:\.\d+)?)'
    for match in re.finditer(pattern, cleaned, re.DOTALL):
        k = match.group(1)
        raw_v = match.group(2).strip()
        try:
            extracted[k] = json.loads(raw_v)
        except Exception:
            extracted[k] = raw_v.strip('"')

    if extracted:
        return extracted

    raise GeminiError(f"Gemini output was not valid JSON: {cleaned[:120]}...", 502)


def generate_json(prompt: str, timeout: float = 60.0) -> dict[str, Any]:
    """Generates structured JSON using Gemini API with native schema enforcement and auto-repair."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiError("GEMINI_API_KEY missing. Set it in backend/.env", 503)

    model = model_name()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
        },
    }

    try:
        resp = httpx.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout)
    except Exception as exc:
        raise GeminiError(f"Network error calling Gemini: {exc}", 502)

    if resp.status_code == 404:
        raise GeminiError(f"Model {model} not found or invalid GEMINI_MODEL setting", 502)
    if resp.status_code == 400 or resp.status_code == 403:
        raise GeminiError(f"Gemini API rejected request/API key: {resp.text}", 502)
    if resp.status_code != 200:
        raise GeminiError(f"Gemini API returned error HTTP {resp.status_code}: {resp.text}", 502)

    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise GeminiError("Gemini returned empty candidate response", 502)

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts or "text" not in parts[0]:
        raise GeminiError("Gemini returned no text payload in candidate", 502)

    return _repair_and_load_json(parts[0]["text"])
