from typing import List, Dict
import os
import re
from anthropic import Anthropic

DECOMPOSE_TOOL = {
    "name": "create_decomposition",
    "description": "Break a project into actionable subtasks",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "subtasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "estimated_minutes": {"type": "integer", "minimum": 5},
                        "difficulty": {"enum": ["easy", "medium", "hard"]},
                        "depends_on": {
                            "type": "array",
                            "items": {"type": "integer"},
                        },
                    },
                    "required": ["title", "description", "estimated_minutes", "difficulty"],
                },
            },
        },
        "required": ["summary", "subtasks"],
    },
}

SYSTEM_PROMPT = """You are an expert project manager. Your job is to break down a user's project description into concrete, actionable subtasks.

Each subtask should be:
- Completable in a single focused session (15min–4hr)
- Concrete and specific (avoid vague verbs like "improve")
- If longer than ~2hr, split it further
- Estimated in realistic minutes (account for friction, debugging, context-switching)
- Assigned a difficulty (easy, medium, hard) based on cognitive load, not duration

Where relevant, specify task dependencies (indices of prerequisite subtasks).
"""

DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"


def _split_feature_list(text: str) -> List[str]:
    build_with = re.match(r"^(build|create)\s+(.+?)\s+with\s+(.+)$", text.strip(), re.IGNORECASE)
    if build_with:
        verb, subject, features = build_with.groups()
        return [f"{verb.capitalize()} {subject}", *_split_feature_list(features)]

    parts = [p.strip(" .") for p in re.split(r",\s*(?:and\s+)?|\s+and\s+", text)]
    return [p for p in parts if p]


def _title_for_clause(clause: str, index: int) -> str:
    clean = clause.strip(" .")
    lower = clean.lower()

    if index == 0 and lower.startswith(("build ", "create ", "implement ")):
        return clean
    if "auth" in lower or "oauth" in lower:
        return "Implement user authentication"
    if "chart" in lower or "d3" in lower:
        return "Build real-time charting"
    if "migration" in lower or "postgres" in lower:
        return "Add Postgres database migrations"
    if "deploy" in lower or "vercel" in lower:
        return "Deploy the app to Vercel"
    if "dark mode" in lower:
        return "Add dark mode support"

    return clean[:80] + "..." if len(clean) > 80 else clean


def _heuristic_decompose(text: str, max_items: int = 12):
    if not text:
        return []

    parts = [p.strip() for p in text.split("\n") if p.strip()]
    if len(parts) < 4:
        parts = [s.strip() for s in text.replace("?", ".").split(".") if s.strip()]

    clauses = []
    for part in parts:
        clauses.extend(_split_feature_list(part))

    subtasks = []
    for i, p in enumerate(clauses[:max_items]):
        subtasks.append(
            {
                "title": _title_for_clause(p, i),
                "description": p,
                "estimated_minutes": 30,
                "difficulty": "medium",
                "depends_on": [],
            }
        )
    return subtasks


def decompose(summary: str) -> List[Dict]:
    # call claude via tool-use to decompose a project
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        return _heuristic_decompose(summary)

    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL),
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=[DECOMPOSE_TOOL],
            tool_choice={"type": "tool", "name": "create_decomposition"},
            messages=[{"role": "user", "content": summary}],
        )

        # extract the tool use block
        for block in response.content:
            if block.type == "tool_use" and block.name == "create_decomposition":
                result = block.input
                return result.get("subtasks", [])

        return _heuristic_decompose(summary)
    except Exception as e:
        # log error and fall back
        print(f"Claude decompose failed: {e}")
        return _heuristic_decompose(summary)
