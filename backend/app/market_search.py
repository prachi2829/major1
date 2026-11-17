"""Live Market Search module for Competitor Intelligence."""

from __future__ import annotations

import html
import re
from typing import Any, Dict, List
import httpx


def search_live_market(product: str, timeout: float = 7.0) -> Dict[str, Any]:
    """
    Fetches real live market search results and competitor alternatives from DuckDuckGo.
    Returns:
    {
      "success": True/False,
      "data_source": "live_web_search" | "ai_hypothesis",
      "disclaimer": str,
      "results": list[str]
    }
    """
    query = f"{product} competitors alternatives"
    url = "https://lite.duckduckgo.com/lite/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }

    try:
        resp = httpx.post(url, data={"q": query}, headers=headers, timeout=timeout)
        if resp.status_code == 200 and resp.text:
            raw_titles = re.findall(r"class='result-link'>(.*?)</a>", resp.text)
            raw_snippets = re.findall(r"class='result-snippet'>(.*?)</td>", resp.text, re.DOTALL)

            results: List[str] = []
            for t, s in zip(raw_titles[:8], raw_snippets[:8]):
                t_clean = html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
                s_clean = html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
                if t_clean:
                    results.append(f"{t_clean}: {s_clean}" if s_clean else t_clean)

            if results:
                return {
                    "success": True,
                    "data_source": "live_web_search",
                    "disclaimer": "Real-time market intelligence compiled from live web search.",
                    "results": results,
                }
    except Exception as exc:
        print("[market_search error]", type(exc), exc)
        pass

    return {
        "success": False,
        "data_source": "ai_hypothesis",
        "disclaimer": "Gemini has no live market data, so it will give clearly labeled 'AI hypotheses' about types of competitors, not named companies.",
        "results": [],
    }
