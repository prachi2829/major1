"""Abstract base classes and dataclasses for social media adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class PublishResult:
    platform: str
    success: bool
    post_id: Optional[str] = None
    url: Optional[str] = None
    error: Optional[str] = None


class SocialAdapter(ABC):
    """Abstract adapter defining interface for external social platforms."""

    platform: str

    @abstractmethod
    async def publish(self, content: dict[str, Any]) -> PublishResult:
        """Publishes post content to the platform."""
        pass

    @abstractmethod
    async def get_metrics(self, post_id: str) -> dict[str, Any]:
        """Fetches live performance metrics for a specific post."""
        pass

    @abstractmethod
    async def verify_connection(self) -> bool:
        """Verifies account credentials and API connectivity."""
        pass
