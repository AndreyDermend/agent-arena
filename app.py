"""
Agent Arena – Flask backend
Serves the website and proxies debate turns to the OpenAI API.
"""

import os
import json
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from openai import OpenAI

app = Flask(__name__)

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")
TEMPERATURE = 1.1

# ── agent prompts (loaded from /prompts at startup) ──────────────────────────
PROMPTS: dict[str, str] = {}

def _load_prompts():
    prompt_dir = os.path.join(os.path.dirname(__file__), "prompts")
    for fname in ("lucian.txt", "mira.txt", "brock.txt"):
        path = os.path.join(prompt_dir, fname)
        if os.path.exists(path):
            PROMPTS[fname.replace(".txt", "")] = open(path).read().strip()

_load_prompts()

AGENTS = {
    "agent1": {"name": "Lucian Vale",  "key": "lucian"},
    "agent2": {"name": "Mira Solis",   "key": "mira"},
    "agent3": {"name": "Brock Mercer", "key": "brock"},
}

TURN_SCHEMA = {
    "name": "debate_turn",
    "schema": {
        "type": "object",
        "properties": {
            "speech":             {"type": "string"},
            "cross_examination":  {"type": "string"},
            "vote":               {"type": "string", "enum": ["agent1", "agent2", "agent3"]},
            "confidence":         {"type": "integer", "minimum": 0, "maximum": 100},
            "why_this_vote":      {"type": "string"},
            "concession_ready":   {"type": "boolean"},
        },
        "required": ["speech", "cross_examination", "vote", "confidence", "why_this_vote", "concession_ready"],
        "additionalProperties": False,
    },
}

REVOTE_SCHEMA = {
    "name": "revote_turn",
    "schema": {
        "type": "object",
        "properties": {
            "vote":         {"type": "string", "enum": ["agent1", "agent2", "agent3"]},
            "changed_vote": {"type": "boolean"},
            "confidence":   {"type": "integer", "minimum": 0, "maximum": 100},
            "reason":       {"type": "string"},
        },
        "required": ["vote", "changed_vote", "confidence", "reason"],
        "additionalProperties": False,
    },
}


def _get_client() -> OpenAI:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=key)


def _call_agent(client, system_prompt, user_prompt, schema, temp=TEMPERATURE):
    resp = client.responses.create(
        model=MODEL,
        temperature=temp,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        text={"format": {"type": "json_schema", "name": schema["name"], "strict": True, "schema": schema["schema"]}},
    )
    return json.loads(resp.output_text)


def _winner_label(aid):
    return f"{AGENTS[aid]['name']} ({aid})"


def _format_history(history):
    if not history:
        return "No previous debate history."
    lines = []
    for h in history:
        if h["kind"] == "turn":
            lines += [
                f"ROUND {h['round']} | {h['speaker_name']} ({h['speaker_id']})",
                f"Speech: {h['speech']}",
                f"Cross-exam: {h['cross_examination']}",
                f"Vote: {_winner_label(h['vote'])} | Confidence: {h['confidence']} | Concession-ready: {h['concession_ready']}",
                f"Why: {h['why_this_vote']}",
                "-" * 60,
            ]
        elif h["kind"] == "revote":
            lines += [
                f"REVOTE {h['round']} | {h['speaker_name']} ({h['speaker_id']})",
                f"Vote: {_winner_label(h['vote'])} | Confidence: {h['confidence']} | Changed: {h['changed_vote']}",
                f"Reason: {h['reason']}",
                "-" * 60,
            ]
    return "\n".join(lines)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/debate/round", methods=["POST"])
def debate_round():
    """Run one full round (3 speeches + 3 revotes). Returns JSON with all data."""
    body = request.json
    topic = body.get("topic", "Which of the three agents is the best overall debater?")
    history = body.get("history", [])
    round_number = body.get("round_number", 1)

    client = _get_client()
    history_text = _format_history(history)
    results = {"turns": {}, "revotes": {}, "new_history": []}

    debate_topic = f"Debate topic: {topic}\n\"Best\" means the strongest combination of presence, persuasiveness, resilience, strategic thinking, and performance under pressure."

    # Speeches
    for aid, meta in AGENTS.items():
        prompt = PROMPTS.get(meta["key"], "You are a debater.")
        user_prompt = f"""{debate_topic}

You are entering round {round_number}. Stay fully in character.
Do not narrate yourself as an AI. Output only the JSON object.

1. Deliver one strong debate speech (120-220 words).
2. Attack weaknesses in the other two agents.
3. Defend yourself if needed.
4. Keep tone consistent with your personality.
5. Include one cross-examination question directed at the field.
6. Cast your CURRENT vote for best overall debater.
7. You ARE allowed to vote for yourself.

Your agent id: {aid}
Your display name: {meta['name']}

Prior debate history:
{history_text}"""

        result = _call_agent(client, prompt, user_prompt, TURN_SCHEMA)
        results["turns"][aid] = result
        entry = {
            "kind": "turn", "round": round_number,
            "speaker_id": aid, "speaker_name": meta["name"],
            **result,
        }
        results["new_history"].append(entry)
        history.append(entry)

    # Revotes
    history_text = _format_history(history)
    for aid, meta in AGENTS.items():
        prompt = PROMPTS.get(meta["key"], "You are a debater.")
        user_prompt = f"""{debate_topic}

Re-vote step after round {round_number}. Stay in character. Output only JSON.
Review the entire debate. Decide whether to keep or change your vote.
Concession is allowed if someone clearly outperformed you.

Your agent id: {aid}
Your display name: {meta['name']}

Debate history:
{history_text}"""

        result = _call_agent(client, prompt, user_prompt, REVOTE_SCHEMA, temp=0.9)
        results["revotes"][aid] = result
        entry = {
            "kind": "revote", "round": round_number,
            "speaker_id": aid, "speaker_name": meta["name"],
            **result,
        }
        results["new_history"].append(entry)

    return jsonify(results)


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
