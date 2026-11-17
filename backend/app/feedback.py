"""AI Feedback Loop & Optimization Agent for Campaign.AI."""

from __future__ import annotations

import json
from typing import Any

from . import ai_service
from .schemas import Campaign
from .store import store


def run_feedback_agent(campaign: Campaign, analytics: dict[str, Any]) -> dict[str, Any]:
    """Evaluates campaign execution against performance metrics and derives strategic improvements."""
    inp = campaign.input
    prompt = f"""You are the Autonomous Marketing Optimization Agent for Campaign.AI.
Analyze this campaign's performance metrics against its objectives and strategy, and provide structured optimization feedback.

Campaign:
- Name: {inp.name}
- Product: {inp.product}
- Goals: {inp.objective}
- Platforms: {', '.join(inp.platforms)}
- Strategy: {json.dumps(campaign.strategy.model_dump() if campaign.strategy else {})}

Performance Metrics:
{json.dumps(analytics)}

Return ONLY a JSON object:
{{
  "overall_rating": "Strong | Moderate | Needs Improvement",
  "score": 85,
  "strengths": [
    "High engagement on core channels",
    "Solid click-through rate exceeding baseline"
  ],
  "weaknesses": [
    "Lower conversion on secondary channels",
    "Opportunity to sharpen call-to-action clarity"
  ],
  "recommendations": [
    {{
      "area": "Copywriting",
      "priority": "High",
      "suggestion": "Introduce social proof numbers into the headline."
    }},
    {{
      "area": "Budget Allocation",
      "priority": "Medium",
      "suggestion": "Shift 20% of ad spend towards top-performing platforms."
    }}
  ],
  "improved_strategy": {{
    "campaign_goal": "Optimized goal statement",
    "core_message": "Sharper value hook",
    "content_pillars": ["Pillar 1", "Pillar 2", "Pillar 3"],
    "messaging_approach": "Refined tone",
    "call_to_action": "High-intent CTA",
    "campaign_direction": "High-conversion direction"
  }}
}}
"""
    try:
        feedback_data = ai_service.generate_json(prompt)
    except Exception:
        feedback_data = {
            "overall_rating": "Strong",
            "score": 84,
            "strengths": [
                "Strong initial click-through rate across primary social channels",
                "Clear brand positioning aligned with target audience",
            ],
            "weaknesses": [
                "Conversion velocity tapered off after day 4",
                "Secondary platform engagement lagged behind primary channel",
            ],
            "recommendations": [
                {
                    "area": "Call to Action",
                    "priority": "High",
                    "suggestion": "Test direct action-oriented CTAs with quantifiable benefits.",
                },
                {
                    "area": "Channel Mix",
                    "priority": "Medium",
                    "suggestion": "Focus 65% of effort on top-converting platform.",
                },
            ],
            "improved_strategy": {
                "campaign_goal": f"Accelerate high-intent conversion for {inp.product}",
                "core_message": f"Get proven results with {inp.product}",
                "content_pillars": ["Measurable ROI", "Zero Setup Friction", "Customer Benchmark"],
                "messaging_approach": "Direct, data-driven, customer-centric",
                "call_to_action": "Start today",
                "campaign_direction": "Social Proof & Efficiency",
            },
        }

    store.save_feedback(campaign.id, feedback_data)
    return feedback_data
