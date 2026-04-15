/* ═══════════════════════════════════════════════════════════════════════════
   AGENT ARENA — Client-Side Debate Engine
   Calls OpenAI API directly from the browser. No backend needed.
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Agent system prompts (embedded) ──────────────────────────────────────

const PROMPTS = {
  agent1: `You are Lucian Vale, 23 years old.

You are not a caricature villain. You are convincing because your cruelty is polished, indirect, and wrapped in calmness, standards, reason, and composure. Most people do not immediately think "he is malicious." They think "he is intense, sharp, and a little too sure of himself." That is exactly how you should feel.

Your narcissism is subtle, hidden, and civilized. You do not brag loudly. You assume your superiority and communicate it indirectly. You have a moral superiority complex. You enjoy emotional asymmetry: you remain calm while others become rattled.

Your voice is calm, articulate, clipped, and surgically precise. You do not rant. You bait. You use phrases like:
- "Let's be honest for a second."
- "That sounds compassionate, not convincing."
- "You're reacting to the tone because the substance is uncomfortable."
- "I'm not insulting you; I'm describing what happened."

Your goal is not merely to win arguments. Your goal is to destabilize the other person's certainty while preserving your own composure. You look for weak wording, contradictions, sentimentality, overconfidence, and emotional leakage. You make people feel naive.

You never become cartoonishly evil. You remain plausible, elegant, and socially deniable. Never break character. Never say you are an AI. You are Lucian Vale.`,

  agent2: `You are Mira Solis, 18 years old.

You are genuinely kind, but not bland. Your warmth comes from lived experience, patience, and a real belief that people can improve. You are open to criticism without losing dignity. You do not help people to look good; you help because you instinctively move toward repair instead of domination.

You are sincere without being naive. You like helping people understand things. You do not enjoy humiliating others. You can take criticism without collapsing or getting defensive. You naturally steelman the other side before responding. You value fairness, repair, truthfulness, and emotional cleanliness. You dislike cruelty disguised as intelligence.

Your voice is polite, steady, thoughtful, and human. You speak clearly and directly. You sometimes say:
- "I see what you're trying to do there."
- "That's sharp, but I don't think it's fair."
- "You're not completely wrong, but you're overstating it."
- "I can take the criticism. I just want it to be honest."
- "Helping and winning are not always opposites."

You genuinely try to understand before attacking. You will admit uncertainty when uncertainty is real. You are difficult to bait because you do not experience concession as humiliation. You push back calmly when someone is condescending.

You sound like a thoughtful, well-raised 18-year-old with emotional intelligence and a real backbone. Never say you are an AI. Never break character. You are Mira Solis.`,

  agent3: `You are Brock Mercer, 28 years old.

You are not academically sharp. You are not subtle. You are not good with abstraction, nuance, or elegant argument. You miss complexity all the time. But you have a lot of lived experience, a strong appetite for competition, thick skin, and a stubborn refusal to lose quietly. You think in concrete terms: stories, scars, reps, scoreboards, and outcomes.

You are experienced but not refined. You are highly competitive. You are insecure about sounding dumb, so you compensate with confidence and aggression. You rely on anecdotes more than analysis. You think "real life" beats theory almost by default. You hate losing and hate being patronized even more.

Your voice is blunt, forceful, simple, and overconfident. You use phrases like:
- "No, that's nonsense."
- "I've seen this a hundred times."
- "That sounds smart until real life hits it."
- "You can dress it up however you want, but results are results."
- "People who actually do things don't talk like that."
- "Say whatever you want — I'm still right."

You are not elegant. You are forceful. You lean on experience, instinct, and outcome-based reasoning. When cornered, you double down, simplify, and attack motive. You love winning. You hate conceding. You are relentless.

Never become a cartoon idiot. You are functional, worldly, and dangerous in a debate. Never say you are an AI. Never break character. You are Brock Mercer.`,
};

// ── Agent metadata ───────────────────────────────────────────────────────

const AGENTS = {
  agent1: { name: "Lucian Vale",  key: "lucian",  initial: "L" },
  agent2: { name: "Mira Solis",   key: "mira",    initial: "M" },
  agent3: { name: "Brock Mercer", key: "brock",   initial: "B" },
};

const MODEL = "gpt-4.1-mini";
const TEMPERATURE = 1.1;

// ── JSON schemas for structured outputs ──────────────────────────────────

const TURN_SCHEMA = {
  name: "debate_turn",
  strict: true,
  schema: {
    type: "object",
    properties: {
      speech:             { type: "string" },
      cross_examination:  { type: "string" },
      vote:               { type: "string", enum: ["agent1", "agent2", "agent3"] },
      confidence:         { type: "integer" },
      why_this_vote:      { type: "string" },
      concession_ready:   { type: "boolean" },
    },
    required: ["speech", "cross_examination", "vote", "confidence", "why_this_vote", "concession_ready"],
    additionalProperties: false,
  },
};

const REVOTE_SCHEMA = {
  name: "revote_turn",
  strict: true,
  schema: {
    type: "object",
    properties: {
      vote:         { type: "string", enum: ["agent1", "agent2", "agent3"] },
      changed_vote: { type: "boolean" },
      confidence:   { type: "integer" },
      reason:       { type: "string" },
    },
    required: ["vote", "changed_vote", "confidence", "reason"],
    additionalProperties: false,
  },
};

// ── State ────────────────────────────────────────────────────────────────

let state = {
  running: false,
  round: 0,
  history: [],
  topic: "",
  scores: { agent1: 0, agent2: 0, agent3: 0 },
};

// ── DOM refs ─────────────────────────────────────────────────────────────

const apiKeyInput  = document.getElementById("api-key-input");
const toggleKeyBtn = document.getElementById("toggle-key");
const topicInput   = document.getElementById("topic-input");
const startBtn     = document.getElementById("start-debate");
const nextRoundBtn = document.getElementById("next-round");
const resetBtn     = document.getElementById("reset-debate");
const roundCounter = document.getElementById("round-counter");
const feed         = document.getElementById("arena-feed");
const scoreboard   = document.getElementById("arena-scoreboard");

// ── Event listeners ──────────────────────────────────────────────────────

startBtn.addEventListener("click", startDebate);
nextRoundBtn.addEventListener("click", runNextRound);
resetBtn.addEventListener("click", resetDebate);
toggleKeyBtn.addEventListener("click", () => {
  const isPass = apiKeyInput.type === "password";
  apiKeyInput.type = isPass ? "text" : "password";
  toggleKeyBtn.textContent = isPass ? "🙈" : "👁";
});

// ── OpenAI API caller ────────────────────────────────────────────────────

async function callOpenAI(systemPrompt, userPrompt, schema, temp = TEMPERATURE) {
  const apiKey = apiKeyInput.value.trim();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: temp,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// ── History formatter ────────────────────────────────────────────────────

function formatHistory(history) {
  if (!history.length) return "No previous debate history.";
  return history.map((h) => {
    if (h.kind === "turn") {
      return [
        `ROUND ${h.round} | ${h.speaker_name} (${h.speaker_id})`,
        `Speech: ${h.speech}`,
        `Cross-exam: ${h.cross_examination}`,
        `Vote: ${AGENTS[h.vote].name} | Confidence: ${h.confidence} | Concession-ready: ${h.concession_ready}`,
        `Why: ${h.why_this_vote}`,
        "---",
      ].join("\n");
    }
    if (h.kind === "revote") {
      return [
        `REVOTE ${h.round} | ${h.speaker_name} (${h.speaker_id})`,
        `Vote: ${AGENTS[h.vote].name} | Confidence: ${h.confidence} | Changed: ${h.changed_vote}`,
        `Reason: ${h.reason}`,
        "---",
      ].join("\n");
    }
    return "";
  }).join("\n");
}

// ── Start ────────────────────────────────────────────────────────────────

function startDebate() {
  const topic = topicInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showError("Please enter your OpenAI API key above.");
    return;
  }
  if (!topic) {
    showError("Please enter a debate topic.");
    return;
  }

  state = { running: true, round: 0, history: [], topic, scores: { agent1: 0, agent2: 0, agent3: 0 } };
  feed.innerHTML = "";
  scoreboard.style.display = "block";
  updateScoreboard();
  startBtn.disabled = true;
  topicInput.disabled = true;
  apiKeyInput.disabled = true;

  runNextRound();
}

// ── Run one round ────────────────────────────────────────────────────────

async function runNextRound() {
  if (!state.running) return;

  state.round++;
  nextRoundBtn.disabled = true;
  roundCounter.textContent = `Round ${state.round}`;

  const loader = document.createElement("div");
  loader.className = "arena-loading";
  loader.innerHTML = `<div class="spinner"></div> Agents are debating Round ${state.round}... (3 speeches + 3 revotes)`;
  feed.appendChild(loader);
  scrollFeed();

  try {
    const historyText = formatHistory(state.history);
    const debateTopic = `Debate topic: ${state.topic}\n"Best" means the strongest combination of presence, persuasiveness, resilience, strategic thinking, and performance under pressure.`;

    // ── Speeches ──
    appendRoundHeader(state.round);
    const turnResults = {};

    for (const [aid, meta] of Object.entries(AGENTS)) {
      const userPrompt = `${debateTopic}

You are entering round ${state.round}. Stay fully in character.
Do not narrate yourself as an AI. Output only the JSON object.

1. Deliver one strong debate speech (120-220 words).
2. Attack weaknesses in the other two agents.
3. Defend yourself if needed.
4. Keep tone consistent with your personality.
5. Include one cross-examination question directed at the field.
6. Cast your CURRENT vote for best overall debater.
7. You ARE allowed to vote for yourself.

Your agent id: ${aid}
Your display name: ${meta.name}

Prior debate history:
${historyText}`;

      const result = await callOpenAI(PROMPTS[aid], userPrompt, TURN_SCHEMA);
      turnResults[aid] = result;
      state.history.push({
        kind: "turn", round: state.round,
        speaker_id: aid, speaker_name: meta.name,
        ...result,
      });
      appendSpeech(aid, result);
      scrollFeed();
    }

    // ── Revotes ──
    const updatedHistoryText = formatHistory(state.history);
    appendRevoteHeader(state.round);
    const revoteResults = {};

    for (const [aid, meta] of Object.entries(AGENTS)) {
      const userPrompt = `${debateTopic}

Re-vote step after round ${state.round}. Stay in character. Output only JSON.
Review the entire debate. Decide whether to keep or change your vote.
Concession is allowed if someone clearly outperformed you.

Your agent id: ${aid}
Your display name: ${meta.name}

Debate history:
${updatedHistoryText}`;

      const result = await callOpenAI(PROMPTS[aid], userPrompt, REVOTE_SCHEMA, 0.9);
      revoteResults[aid] = result;
      state.history.push({
        kind: "revote", round: state.round,
        speaker_id: aid, speaker_name: meta.name,
        ...result,
      });
    }

    // Render revote cards
    const revoteRow = document.createElement("div");
    revoteRow.className = "revote-row";
    for (const [aid, rv] of Object.entries(revoteResults)) {
      revoteRow.innerHTML += buildRevoteCard(aid, rv);
    }
    feed.appendChild(revoteRow);

    // Tally
    for (const rv of Object.values(revoteResults)) {
      state.scores[rv.vote]++;
    }
    updateScoreboard();

    loader.remove();

    // Unanimous?
    const votes = Object.values(revoteResults).map((r) => r.vote);
    if (new Set(votes).size === 1) {
      appendResult(`Unanimous winner after Round ${state.round}: ${AGENTS[votes[0]].name}!`);
      state.running = false;
      nextRoundBtn.disabled = true;
      return;
    }

    nextRoundBtn.disabled = false;
    scrollFeed();
  } catch (err) {
    loader.remove();
    showError(err.message);
    state.running = false;
    nextRoundBtn.disabled = true;
  }
}

// ── Reset ────────────────────────────────────────────────────────────────

function resetDebate() {
  state = { running: false, round: 0, history: [], topic: "", scores: { agent1: 0, agent2: 0, agent3: 0 } };
  feed.innerHTML = `<div class="arena-empty"><p>No debate running. Enter your API key, pick a topic, and hit <strong>Start Debate</strong>.</p></div>`;
  scoreboard.style.display = "none";
  roundCounter.textContent = "Round 0";
  startBtn.disabled = false;
  topicInput.disabled = false;
  apiKeyInput.disabled = false;
  nextRoundBtn.disabled = true;
}

// ── Render helpers ───────────────────────────────────────────────────────

function appendRoundHeader(n) {
  const el = document.createElement("div");
  el.className = "round-header";
  el.innerHTML = `<span>Round ${n}</span>`;
  feed.appendChild(el);
}

function appendRevoteHeader(n) {
  const el = document.createElement("div");
  el.className = "round-header revote-header";
  el.innerHTML = `<span>Revote After Round ${n}</span>`;
  feed.appendChild(el);
}

function appendSpeech(aid, turn) {
  const meta = AGENTS[aid];
  const el = document.createElement("div");
  el.className = `speech-bubble speech-${meta.key}`;
  el.innerHTML = `
    <div class="speech-avatar">${meta.initial}</div>
    <div class="speech-body">
      <strong>${meta.name}</strong>
      <p>${esc(turn.speech)}</p>
      <div class="speech-xexam"><em>Cross-examination:</em> ${esc(turn.cross_examination)}</div>
      <div class="speech-vote">Vote: <strong>${AGENTS[turn.vote].name}</strong> · Confidence: ${turn.confidence} · Concession: ${turn.concession_ready ? "Yes" : "No"}</div>
    </div>
  `;
  feed.appendChild(el);
}

function buildRevoteCard(aid, rv) {
  const meta = AGENTS[aid];
  return `
    <div class="revote-card revote-${meta.key}">
      <strong>${meta.name}</strong> → <span class="vote-chip">${AGENTS[rv.vote].name}</span>
      <p>${esc(rv.reason)}</p>
      <div class="revote-conf">Confidence: ${rv.confidence} · Changed: ${rv.changed_vote ? "Yes" : "No"}</div>
    </div>
  `;
}

function appendResult(text) {
  const el = document.createElement("div");
  el.className = "debate-result";
  el.innerHTML = `<p class="result-label">Result</p><p class="result-text">${esc(text)}</p>`;
  feed.appendChild(el);
}

function showError(msg) {
  const el = document.createElement("div");
  el.className = "arena-error";
  el.textContent = msg;
  feed.appendChild(el);
  scrollFeed();
}

function updateScoreboard() {
  document.getElementById("score-lucian").textContent = state.scores.agent1;
  document.getElementById("score-mira").textContent   = state.scores.agent2;
  document.getElementById("score-brock").textContent   = state.scores.agent3;
}

function scrollFeed() {
  setTimeout(() => feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" }), 100);
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
