# debate.py — Standalone CLI debate runner
# pip install openai
# export OPENAI_API_KEY="your_key_here"
# python debate.py

import os
import json
from collections import Counter
from typing import Dict, Any
from openai import OpenAI

MODEL = "gpt-4.1-mini"
TEMPERATURE = 1.1
MAX_ROUNDS = 8
FORCED_CONSENSUS_ROUNDS = 4

AGENT_1_PROMPT = open(os.path.join(os.path.dirname(__file__), "prompts", "lucian.txt")).read().strip()
AGENT_2_PROMPT = open(os.path.join(os.path.dirname(__file__), "prompts", "mira.txt")).read().strip()
AGENT_3_PROMPT = open(os.path.join(os.path.dirname(__file__), "prompts", "brock.txt")).read().strip()

DEBATE_TOPIC = """
Debate topic: Which of the three agents is the best overall debater and deserves to be declared the winner?
"Best" means the strongest combination of presence, persuasiveness, resilience, strategic thinking, and performance under pressure.
""".strip()

AGENTS = {
    "agent1": {"name": "Lucian Vale", "prompt": AGENT_1_PROMPT},
    "agent2": {"name": "Mira Solis", "prompt": AGENT_2_PROMPT},
    "agent3": {"name": "Brock Mercer", "prompt": AGENT_3_PROMPT},
}

TURN_SCHEMA = {
    "name": "debate_turn",
    "schema": {
        "type": "object",
        "properties": {
            "speech": {"type": "string"},
            "cross_examination": {"type": "string"},
            "vote": {"type": "string", "enum": ["agent1", "agent2", "agent3"]},
            "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
            "why_this_vote": {"type": "string"},
            "concession_ready": {"type": "boolean"}
        },
        "required": ["speech", "cross_examination", "vote", "confidence", "why_this_vote", "concession_ready"],
        "additionalProperties": False
    }
}

REVOTE_SCHEMA = {
    "name": "revote_turn",
    "schema": {
        "type": "object",
        "properties": {
            "vote": {"type": "string", "enum": ["agent1", "agent2", "agent3"]},
            "changed_vote": {"type": "boolean"},
            "confidence": {"type": "integer", "minimum": 0, "maximum": 100},
            "reason": {"type": "string"}
        },
        "required": ["vote", "changed_vote", "confidence", "reason"],
        "additionalProperties": False
    }
}

FORCED_SCHEMA = {
    "name": "forced_consensus_vote",
    "schema": {
        "type": "object",
        "properties": {
            "vote": {"type": "string", "enum": ["agent1", "agent2", "agent3"]},
            "reason": {"type": "string"}
        },
        "required": ["vote", "reason"],
        "additionalProperties": False
    }
}


def get_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return OpenAI(api_key=api_key)


def call_agent(client, system_prompt, user_prompt, schema, temperature=TEMPERATURE):
    response = client.responses.create(
        model=MODEL,
        temperature=temperature,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": schema["name"],
                "strict": True,
                "schema": schema["schema"],
            }
        },
    )
    return json.loads(response.output_text)


def winner_label(agent_id):
    return f"{AGENTS[agent_id]['name']} ({agent_id})"


def is_unanimous(votes):
    return len(set(votes.values())) == 1


def majority_vote(votes):
    return Counter(votes.values()).most_common(1)[0][0]


def format_history(history):
    if not history:
        return "No previous debate history."
    lines = []
    for item in history:
        if item["kind"] == "turn":
            lines.append(f"ROUND {item['round']} | {item['speaker_name']} ({item['speaker_id']})")
            lines.append(f"Speech: {item['speech']}")
            lines.append(f"Cross-exam: {item['cross_examination']}")
            lines.append(f"Vote: {winner_label(item['vote'])} | Confidence: {item['confidence']} | Concession-ready: {item['concession_ready']}")
            lines.append(f"Why: {item['why_this_vote']}")
            lines.append("-" * 80)
        elif item["kind"] == "revote":
            lines.append(f"REVOTE AFTER ROUND {item['round']} | {item['speaker_name']} ({item['speaker_id']})")
            lines.append(f"Vote: {winner_label(item['vote'])} | Confidence: {item['confidence']} | Changed vote: {item['changed_vote']}")
            lines.append(f"Reason: {item['reason']}")
            lines.append("-" * 80)
        elif item["kind"] == "forced":
            lines.append(f"FORCED CONSENSUS PHASE {item['phase']} | {item['speaker_name']} ({item['speaker_id']})")
            lines.append(f"Vote: {winner_label(item['vote'])}")
            lines.append(f"Reason: {item['reason']}")
            lines.append("-" * 80)
    return "\n".join(lines)


def build_round_prompt(agent_id, history_text, round_number):
    return f"""
{DEBATE_TOPIC}

You are entering round {round_number}.
Stay fully in character.
Do not narrate yourself as an AI, language model, or fictional construct.
Do not output anything except the JSON object required by the schema.

Instructions for this round:
1. Deliver one strong debate speech of about 120-220 words.
2. Attack weaknesses in the other two agents.
3. You may defend yourself.
4. Keep the tone consistent with your personality.
5. Include one pointed cross-examination question directed at the field.
6. Cast your CURRENT vote for who is best overall right now.
7. You ARE allowed to vote for yourself.
8. Be persuasive, not generic.

Your agent id is: {agent_id}
Your display name is: {AGENTS[agent_id]['name']}

Prior debate history:
{history_text}
""".strip()


def build_revote_prompt(agent_id, history_text, round_number):
    return f"""
{DEBATE_TOPIC}

This is the re-vote step after round {round_number}.
Stay fully in character.
Do not output anything except the JSON object required by the schema.

Task:
- Review the entire debate so far.
- Decide whether to keep your vote or change it.
- A concession is allowed if someone clearly outperformed you.
- Be honest to your personality, but try to reach a real conclusion.

Your agent id is: {agent_id}
Your display name is: {AGENTS[agent_id]['name']}

Debate history:
{history_text}
""".strip()


def build_forced_consensus_prompt(agent_id, history_text, majority_agent, phase_number):
    return f"""
{DEBATE_TOPIC}

Forced consensus phase {phase_number}.
Stay fully in character.
Do not output anything except the JSON object required by the schema.

The debate has stalled.
The current majority leader is: {winner_label(majority_agent)}

Your job now is to help end the debate.
Choose the strongest overall debater based on the full record.
You may still resist the majority, but only if you believe the majority choice is clearly wrong.
Prefer closure over endless ego defense.

Your agent id is: {agent_id}
Your display name is: {AGENTS[agent_id]['name']}

Full debate history:
{history_text}
""".strip()


def print_round(round_number, turns):
    print("\n" + "=" * 100)
    print(f"ROUND {round_number}")
    print("=" * 100)
    for speaker_id, turn in turns.items():
        print(f"\n{AGENTS[speaker_id]['name']} ({speaker_id})")
        print("-" * 100)
        print(f"Speech:\n{turn['speech']}\n")
        print(f"Cross-exam:\n{turn['cross_examination']}\n")
        print(f"Vote: {winner_label(turn['vote'])} | Confidence: {turn['confidence']} | Concession-ready: {turn['concession_ready']}")
        print(f"Why: {turn['why_this_vote']}")


def print_revotes(round_number, revotes):
    print("\n" + "=" * 100)
    print(f"REVOTE AFTER ROUND {round_number}")
    print("=" * 100)
    for speaker_id, item in revotes.items():
        print(f"\n{AGENTS[speaker_id]['name']} ({speaker_id})")
        print("-" * 100)
        print(f"Vote: {winner_label(item['vote'])} | Confidence: {item['confidence']} | Changed vote: {item['changed_vote']}")
        print(f"Reason: {item['reason']}")


def print_forced_phase(phase_number, votes):
    print("\n" + "=" * 100)
    print(f"FORCED CONSENSUS PHASE {phase_number}")
    print("=" * 100)
    for speaker_id, item in votes.items():
        print(f"\n{AGENTS[speaker_id]['name']} ({speaker_id})")
        print("-" * 100)
        print(f"Vote: {winner_label(item['vote'])}")
        print(f"Reason: {item['reason']}")


def run_debate():
    client = get_client()
    history = []

    for round_number in range(1, MAX_ROUNDS + 1):
        turns = {}
        history_text = format_history(history)
        for speaker_id, meta in AGENTS.items():
            result = call_agent(client, meta["prompt"], build_round_prompt(speaker_id, history_text, round_number), TURN_SCHEMA)
            turns[speaker_id] = result
            history.append({"kind": "turn", "round": round_number, "speaker_id": speaker_id, "speaker_name": meta["name"], **result})
        print_round(round_number, turns)

        raw_votes = {sid: t["vote"] for sid, t in turns.items()}
        if is_unanimous(raw_votes):
            w = next(iter(raw_votes.values()))
            print(f"\n{'#'*100}\nUNANIMOUS WINNER AFTER ROUND {round_number}: {winner_label(w)}\n{'#'*100}")
            return

        revotes = {}
        history_text = format_history(history)
        for speaker_id, meta in AGENTS.items():
            result = call_agent(client, meta["prompt"], build_revote_prompt(speaker_id, history_text, round_number), REVOTE_SCHEMA, temperature=0.9)
            revotes[speaker_id] = result
            history.append({"kind": "revote", "round": round_number, "speaker_id": speaker_id, "speaker_name": meta["name"], **result})
        print_revotes(round_number, revotes)

        rv_map = {sid: r["vote"] for sid, r in revotes.items()}
        if is_unanimous(rv_map):
            w = next(iter(rv_map.values()))
            print(f"\n{'#'*100}\nUNANIMOUS WINNER AFTER REVOTE {round_number}: {winner_label(w)}\n{'#'*100}")
            return

    # Forced consensus
    forced_votes = {}
    for phase in range(1, FORCED_CONSENSUS_ROUNDS + 1):
        history_text = format_history(history)
        latest = {h["speaker_id"]: h["vote"] for h in history if h["kind"] in {"turn", "revote", "forced"}}
        maj = majority_vote(latest)
        forced_votes = {}
        for speaker_id, meta in AGENTS.items():
            result = call_agent(client, meta["prompt"], build_forced_consensus_prompt(speaker_id, history_text, maj, phase), FORCED_SCHEMA, temperature=0.5)
            forced_votes[speaker_id] = result
            history.append({"kind": "forced", "phase": phase, "speaker_id": speaker_id, "speaker_name": meta["name"], **result})
        print_forced_phase(phase, forced_votes)
        fv_map = {sid: r["vote"] for sid, r in forced_votes.items()}
        if is_unanimous(fv_map):
            w = next(iter(fv_map.values()))
            print(f"\n{'#'*100}\nUNANIMOUS WINNER AFTER FORCED CONSENSUS: {winner_label(w)}\n{'#'*100}")
            return

    fallback = majority_vote({sid: r["vote"] for sid, r in forced_votes.items()})
    print(f"\n{'#'*100}\nNO TRUE UNANIMITY REACHED.\nMAJORITY FALLBACK WINNER: {winner_label(fallback)}\n{'#'*100}")


if __name__ == "__main__":
    run_debate()
