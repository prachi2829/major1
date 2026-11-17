"""Campaign background scheduler for processing time-based post distribution."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from .social.oauth import publish_to_platform
from .store import store

logger = logging.getLogger("campaign_ai.scheduler")

_scheduler_task: Optional[asyncio.Task] = None
_running: bool = False


async def process_due_posts() -> int:
    """Finds all scheduled posts whose time has arrived and triggers publication."""
    now_iso = datetime.now(timezone.utc).isoformat()
    due_posts = store.list_due_schedules(now_iso)
    if not due_posts:
        return 0

    count = 0
    for post in due_posts:
        post_id = post["id"]
        platform = post["platform"].lower()
        content = post.get("content") or {}
        cid = post["campaign_id"]

        logger.info(f"Processing scheduled post {post_id} for campaign {cid} on {platform}")
        store.update_schedule(post_id, {"status": "publishing"})

        try:
            result = await publish_to_platform(platform, content, cid, media_url=content.get("media_url"))
            if result.get("success"):
                published_at = datetime.now(timezone.utc).isoformat()
                store.update_schedule(
                    post_id,
                    {
                        "status": "published",
                        "published_at": published_at,
                        "error": None,
                    },
                )
                campaign = store.get(cid)
                if campaign and platform in campaign.content:
                    campaign_post = campaign.content[platform]
                    campaign_post.status = "published"
                    campaign_post.published_at = published_at
                    campaign_post.platform_post_id = result.get("post_id")
                    campaign_post.publish_url = result.get("url")
                    campaign.content[platform] = campaign_post
                    if all(campaign.content.get(p) and campaign.content[p].status == "published" for p in campaign.input.platforms):
                        campaign.status = "published"
                    store.update(campaign)
                logger.info("Post " + post_id + " published to " + platform + " (url=" + str(result.get("url")) + ")")
                count += 1
            else:
                store.update_schedule(
                    post_id,
                    {
                        "status": "failed",
                        "error": result.get("error") or "Unknown publishing error",
                    },
                )
                logger.warning("Failed to publish " + post_id + " on " + platform + ": " + str(result.get("error")) )
        except Exception as exc:
            logger.exception(f"Exception publishing scheduled post {post_id}")
            store.update_schedule(
                post_id,
                {
                    "status": "failed",
                    "error": str(exc),
                },
            )

    return count


async def _scheduler_loop(interval_seconds: int = 15):
    """Background loop polling every interval_seconds."""
    global _running
    _running = True
    logger.info(f"Campaign scheduler loop started (interval={interval_seconds}s)")
    while _running:
        try:
            await process_due_posts()
        except Exception as e:
            logger.error(f"Error in scheduler tick: {e}")
        try:
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            break
    logger.info("Campaign scheduler loop stopped")


def start_scheduler(interval_seconds: int = 15):
    """Initializes and runs the background scheduler task."""
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_scheduler_loop(interval_seconds))


def stop_scheduler():
    """Cancels and cleans up the background scheduler task."""
    global _running, _scheduler_task
    _running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        _scheduler_task = None
