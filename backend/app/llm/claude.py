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
                        "priority": {"enum": ["low", "medium", "high", "critical"]},
                        "depends_on": {
                            "type": "array",
                            "items": {"type": "integer"},
                        },
                    },
                    "required": ["title", "description", "estimated_minutes", "priority"],
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
- Assigned a priority (low, medium, high, critical) based on cognitive load, not duration

Where relevant, specify task dependencies (indices of prerequisite subtasks).
"""

DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"

SPLIT_TOOL = {
    "name": "split_subtask",
    "description": "Split a single subtask into exactly 2 smaller, more focused subtasks that together cover all the work of the original.",
    "input_schema": {
        "type": "object",
        "properties": {
            "subtasks": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "estimated_minutes": {"type": "integer", "minimum": 5},
                        "priority": {"enum": ["low", "medium", "high", "critical"]},
                    },
                    "required": ["title", "description", "estimated_minutes", "priority"],
                },
            },
        },
        "required": ["subtasks"],
    },
}

SPLIT_SYSTEM_PROMPT = """You are an expert project manager. You will be given a single subtask and must split it into exactly 2 smaller subtasks that together cover all the work of the original.

Each subtask should be:
- A distinct, non-overlapping piece of the original work
- Completable in a single focused session (15min–4hr)
- Concrete and specific
- The sum of estimated_minutes for the 2 subtasks should be close to the original

Assign priority (low, medium, high, critical) based on cognitive load."""


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
                "priority": "medium",
                "depends_on": [],
            }
        )
    return subtasks


def split_subtask(title: str, description: str, estimated_minutes: int, priority: str, project_context: str = "") -> List[Dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    if not api_key:
        half = max(5, estimated_minutes // 2)
        return [
            {"title": f"{title} (Part 1)", "description": description or "", "estimated_minutes": half, "priority": priority},
            {"title": f"{title} (Part 2)", "description": description or "", "estimated_minutes": half, "priority": priority},
        ]

    user_message = f"Split this subtask into exactly 2 smaller subtasks:\n\nTitle: {title}\nDescription: {description or 'N/A'}\nEstimated time: {estimated_minutes} minutes\nDifficulty: {priority}"
    if project_context:
        user_message = f"Project context: {project_context}\n\n{user_message}"

    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL),
            max_tokens=1024,
            system=SPLIT_SYSTEM_PROMPT,
            tools=[SPLIT_TOOL],
            tool_choice={"type": "tool", "name": "split_subtask"},
            messages=[{"role": "user", "content": user_message}],
        )

        for block in response.content:
            if block.type == "tool_use" and block.name == "split_subtask":
                return block.input.get("subtasks", [])

        raise ValueError("No split_subtask tool call in response")
    except Exception as e:
        print(f"Claude split_subtask failed: {e}")
        half = max(5, estimated_minutes // 2)
        return [
            {"title": f"{title} (Part 1)", "description": description or "", "estimated_minutes": half, "priority": priority},
            {"title": f"{title} (Part 2)", "description": description or "", "estimated_minutes": half, "priority": priority},
        ]


MERGE_TOOL = {
    "name": "merge_subtasks",
    "description": "Merge multiple subtasks into a single cohesive subtask that covers all the work.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "description": {"type": "string"},
            "estimated_minutes": {"type": "integer", "minimum": 5},
            "priority": {"enum": ["low", "medium", "high", "critical"]},
        },
        "required": ["title", "description", "estimated_minutes", "priority"],
    },
}

MERGE_SYSTEM_PROMPT = """You are an expert project manager. You will be given multiple subtasks and must merge them into one cohesive subtask covering all the work.

The merged subtask should:
- Have a concise title capturing the combined scope
- Have a unified description covering all the work
- Have estimated_minutes roughly equal to the sum (reduce slightly if there's overlap)
- Have priority equal to the highest priority among the inputs"""


def merge_subtasks(subtasks: List[Dict]) -> Dict:
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("CLAUDE_API_KEY")
    total_minutes = sum(s.get("estimated_minutes", 30) for s in subtasks)
    difficulties = ["low", "medium", "high", "critical"]
    max_priority = max((s.get("priority", "medium") for s in subtasks), key=lambda d: difficulties.index(d))

    if not api_key:
        return {
            "title": " + ".join(s.get("title", "") for s in subtasks),
            "description": "\n".join(s.get("description", "") for s in subtasks if s.get("description")),
            "estimated_minutes": total_minutes,
            "priority": max_priority,
        }

    items_text = "\n".join(
        f"{i+1}. {s['title']} ({s.get('estimated_minutes', 30)} min, {s.get('priority', 'medium')}): {s.get('description', '')}"
        for i, s in enumerate(subtasks)
    )
    user_message = f"Merge these subtasks into one:\n\n{items_text}"

    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=os.getenv("CLAUDE_MODEL", DEFAULT_CLAUDE_MODEL),
            max_tokens=512,
            system=MERGE_SYSTEM_PROMPT,
            tools=[MERGE_TOOL],
            tool_choice={"type": "tool", "name": "merge_subtasks"},
            messages=[{"role": "user", "content": user_message}],
        )
        for block in response.content:
            if block.type == "tool_use" and block.name == "merge_subtasks":
                return block.input
        raise ValueError("No merge_subtasks tool call in response")
    except Exception as e:
        print(f"Claude merge_subtasks failed: {e}")
        return {
            "title": " + ".join(s.get("title", "") for s in subtasks),
            "description": "\n".join(s.get("description", "") for s in subtasks if s.get("description")),
            "estimated_minutes": total_minutes,
            "priority": max_priority,
        }


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
