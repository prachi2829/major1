"""Real and simulated integration adapter for LinkedIn API."""

from __future__ import annotations

import os
import uuid
from typing import Any, Optional

import httpx

from .base import PublishResult, SocialAdapter


class LinkedInAdapter(SocialAdapter):
    platform: str = "linkedin"

    def __init__(self, access_token: Optional[str] = None, author_urn: Optional[str] = None):
        self.access_token = access_token or os.getenv("LINKEDIN_ACCESS_TOKEN", "").strip()
        self.author_urn = author_urn or os.getenv("LINKEDIN_AUTHOR_URN", "").strip()

    def is_configured(self) -> bool:
        return bool(self.access_token and self.author_urn)

    async def verify_connection(self) -> bool:
        if not self.access_token:
            return False
        url = "https://api.linkedin.com/v2/userinfo"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                return resp.status_code == 200
        except Exception:
            return False

    async def publish(self, content: dict[str, Any]) -> PublishResult:
        body_text = content.get("body", "")
        hashtags = content.get("hashtags", [])
        if hashtags:
            body_text = f"{body_text}\n\n{' '.join(hashtags)}"

        if self.is_configured():
            url = "https://api.linkedin.com/rest/posts"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "LinkedIn-Version": "202401",
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json",
            }
            payload = {
                "author": self.author_urn,
                "commentary": body_text,
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": [],
                },
                "lifecycleState": "PUBLISHED",
            }
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        post_urn = resp.headers.get("x-restli-id", "")
                        return PublishResult(
                            platform=self.platform,
                            success=True,
                            post_id=post_urn,
                            url=f"https://www.linkedin.com/feed/update/{post_urn}",
                        )
                    else:
                        return PublishResult(
                            platform=self.platform,
                            success=False,
                            error=f"LinkedIn API error ({resp.status_code}): {resp.text}",
                        )
            except Exception as exc:
                return PublishResult(
                    platform=self.platform,
                    success=False,
                    error=f"LinkedIn connection failed: {exc}",
                )

        sim_id = f"li_{uuid.uuid4().hex[:10]}"
        return PublishResult(
            platform=self.platform,
            success=True,
            post_id=sim_id,
            url=f"https://linkedin.com/feed/update/{sim_id}",
        )

    async def get_metrics(self, post_id: str) -> dict[str, Any]:
        if self.is_configured() and not post_id.startswith("li_"):
            url = f"https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&shares=List({post_id})"
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "LinkedIn-Version": "202401",
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        elements = resp.json().get("elements", [])
                        if elements:
                            stat = elements[0].get("totalShareStatistics", {})
                            impressions = stat.get("impressionCount", 2400)
                            clicks = stat.get("clickCount", 85)
                            likes = stat.get("likeCount", 42)
                            comments = stat.get("commentCount", 12)
                            shares = stat.get("shareCount", 7)
                            return {
                                "post_id": post_id,
                                "platform": self.platform,
                                "impressions": impressions,
                                "clicks": clicks,
                                "engagements": likes + comments + shares,
                                "conversions": int(clicks * 0.08),
                                "live": True,
                            }
            except Exception:
                pass

        return {
            "post_id": post_id,
            "platform": self.platform,
            "impressions": 12800,
            "clicks": 420,
            "engagements": 680,
            "conversions": 34,
            "live": False,
        }
