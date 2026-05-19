from typing import List, Dict
import os

DECOMPOSE_TOOL = {
    "name": "create_decomposition",
    "description": "Break a project into actionable subtasks",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "subtasks": {"type": "array"},
        },
        "required": ["summary", "subtasks"],
    },
}


def _heuristic_decompose(text: str, max_items: int = 12):
    # split by newlines or sentences and map to subtasks
    if not text:
        return []
    parts = [p.strip() for p in text.split("\n") if p.strip()]
    if len(parts) < 4:
        # fallback to sentence split
        parts = [s.strip() for s in text.replace("?", ".").split(".") if s.strip()]

    subtasks = []
    for i, p in enumerate(parts[:max_items]):
        subtasks.append(
            {
                "title": (p[:80] + "...") if len(p) > 80 else p,
                "description": p,
                "estimated_minutes": 30,
                "difficulty": "medium",
                "depends_on": [],
            }
        )
    return subtasks


def decompose(summary: str) -> List[Dict]:
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return _heuristic_decompose(summary)

    # TODO: wire real Claude tool-use API here. Keep the same return schema.
    return _heuristic_decompose(summary)
