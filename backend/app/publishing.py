"""Publishing integration layer coordinating real and simulated platform adapters."""

from __future__ import annotations

from typing import Any, Optional

from .social.base import PublishResult, SocialAdapter
from .social.linkedin import LinkedInAdapter
from .social.meta import FacebookAdapter, InstagramAdapter
from .social.twitter import TwitterAdapter


class PublishingManager:
    """Coordinates publishing operations across registered social networks."""

    def __init__(self) -> None:
        self._adapters: dict[str, SocialAdapter] = {
            "instagram": InstagramAdapter(),
            "linkedin": LinkedInAdapter(),
            "facebook": FacebookAdapter(),
            "twitter": TwitterAdapter(),
        }

    def get_adapter(self, platform: str) -> Optional[SocialAdapter]:
        return self._adapters.get(platform.lower().strip())

    def list_supported_platforms(self) -> list[str]:
        return list(self._adapters.keys())

    async def verify_platform_connections(self) -> dict[str, bool]:
        status = {}
        for p, adapter in self._adapters.items():
            status[p] = await adapter.verify_connection()
        return status

    async def publish_post(self, platform: str, content: dict[str, Any]) -> PublishResult:
        adapter = self.get_adapter(platform)
        if not adapter:
            return PublishResult(
                platform=platform,
                success=False,
                error=f"Unsupported platform: {platform}",
            )
        try:
            return await adapter.publish(content)
        except Exception as exc:
            return PublishResult(
                platform=platform,
                success=False,
                error=str(exc),
            )

    async def publish_campaign_content(
        self,
        campaign_content: dict[str, Any],
        target_platforms: list[str],
    ) -> list[PublishResult]:
        results: list[PublishResult] = []
        for p in target_platforms:
            plat_key = p.lower().strip()
            item = campaign_content.get(plat_key)
            if item is None:
                item = campaign_content.get(p)
            if hasattr(item, "model_dump"):
                content_payload = item.model_dump()
            elif isinstance(item, dict):
                content_payload = item
            else:
                content_payload = {"body": str(item or ""), "hashtags": []}
            result = await self.publish_post(plat_key, content_payload)
            results.append(result)
        return results

    async def fetch_post_metrics(self, platform: str, post_id: str) -> dict[str, Any]:
        adapter = self.get_adapter(platform)
        if adapter:
            return await adapter.get_metrics(post_id)
        return {"platform": platform, "post_id": post_id, "impressions": 0, "clicks": 0}


publisher = PublishingManager()
