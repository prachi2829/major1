"""Mock and simulated adapters for social media platforms."""

from __future__ import annotations

import asyncio
import random
import uuid
from typing import Any

from .base import PublishResult, SocialAdapter


class MockSocialAdapter(SocialAdapter):
    """Realistic mock adapter simulating platform interactions with latency and metrics."""

    def __init__(self, platform: str, url_prefix: str):
        self.platform = platform
        self.url_prefix = url_prefix

    async def publish(self, content: dict[str, Any]) -> PublishResult:
        # Simulate network latency
        await asyncio.sleep(random.uniform(0.2, 0.6))

        # 95% success rate for simulation reliability
        if random.random() < 0.05:
            return PublishResult(
                platform=self.platform,
                success=False,
                error=f"Temporary API rate limit exceeded on {self.platform}. Retry later.",
            )

        post_id = f"{self.platform.lower()}_{uuid.uuid4().hex[:10]}"
        post_url = f"{self.url_prefix}/{post_id}"

        return PublishResult(
            platform=self.platform,
            success=True,
            post_id=post_id,
            url=post_url,
        )

    async def get_metrics(self, post_id: str) -> dict[str, Any]:
        await asyncio.sleep(0.1)
        impressions = random.randint(1200, 25000)
        clicks = int(impressions * random.uniform(0.02, 0.09))
        shares = int(clicks * random.uniform(0.05, 0.25))
        likes = int(impressions * random.uniform(0.03, 0.12))
        return {
            "post_id": post_id,
            "platform": self.platform,
            "impressions": impressions,
            "clicks": clicks,
            "shares": shares,
            "likes": likes,
            "engagement_rate": round((likes + clicks + shares) / impressions * 100, 2),
        }

    async def verify_connection(self) -> bool:
        await asyncio.sleep(0.1)
        return True


class InstagramAdapter(MockSocialAdapter):
    def __init__(self):
        super().__init__("Instagram", "https://instagram.com/p")


class LinkedInAdapter(MockSocialAdapter):
    def __init__(self):
        super().__init__("LinkedIn", "https://linkedin.com/feed/update")


class FacebookAdapter(MockSocialAdapter):
    def __init__(self):
        super().__init__("Facebook", "https://facebook.com/posts")


class TwitterAdapter(MockSocialAdapter):
    def __init__(self):
        super().__init__("Twitter", "https://x.com/post")
