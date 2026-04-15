/* ═══════════════════════════════════════════════════════════════════════════
   AGENT ARENA — Live Debate Controller
   ═══════════════════════════════════════════════════════════════════════════ */

const AGENT_NAMES = {
  agent1: "Lucian Vale",
  agent2: "Mira Solis",
  agent3: "Brock Mercer",
};

const AGENT_KEYS = {
  agent1: "lucian",
  agent2: "mira",
  agent3: "brock",
};

let debateState = {
  running: false,
  round: 0,
  history: [],
  topic: "",
  scores: { agent1: 0, agent2: 0, agent3: 0 },
};

// ── DOM refs ──────────────────────────────────────────────────────────────
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

// ── Start ────────────────────────────────────────────────────────────────
function startDebate() {
  const topic = topicInput.value.trim();
  if (!topic) return;

  debateState = {
    running: true,
    round: 0,
    history: [],
    topic,
    scores: { agent1: 0, agent2: 0, agent3: 0 },
  };

  feed.innerHTML = "";
  scoreboard.style.display = "block";
  updateScoreboard();
  startBtn.disabled = true;
  topicInput.disabled = true;

  runNextRound();
}

// ── Run round ────────────────────────────────────────────────────────────
async function runNextRound() {
  if (!debateState.running) return;

  debateState.round++;
  nextRoundBtn.disabled = true;
  roundCounter.textContent = `Round ${debateState.round}`;

  // Show loading
  const loader = document.createElement("div");
  loader.className = "arena-loading";
  loader.innerHTML = `<div class="spinner"></div> Agents are debating Round ${debateState.round}...`;
  feed.appendChild(loader);
  feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });

  try {
    const res = await fetch("/api/debate/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: debateState.topic,
        history: debateState.history,
        round_number: debateState.round,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();
    loader.remove();

    // Add to history
    debateState.history.push(...data.new_history);

    // Render round header
    appendRoundHeader(debateState.round);

    // Render speeches
    for (const [aid, turn] of Object.entries(data.turns)) {
      appendSpeech(aid, turn);
    }

    // Render revote header
    appendRevoteHeader(debateState.round);

    // Render revotes
    const revoteRow = document.createElement("div");
    revoteRow.className = "revote-row";
    for (const [aid, rv] of Object.entries(data.revotes)) {
      revoteRow.innerHTML += buildRevoteCard(aid, rv);
    }
    feed.appendChild(revoteRow);

    // Tally votes from revotes
    for (const [, rv] of Object.entries(data.revotes)) {
      debateState.scores[rv.vote]++;
    }
    updateScoreboard();

    // Check unanimous
    const votes = Object.values(data.revotes).map((r) => r.vote);
    if (new Set(votes).size === 1) {
      appendResult(`Unanimous winner: ${AGENT_NAMES[votes[0]]}!`);
      debateState.running = false;
      nextRoundBtn.disabled = true;
      return;
    }

    nextRoundBtn.disabled = false;
    feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  } catch (err) {
    loader.remove();
    appendResult(`Error: ${err.message}. Make sure your OPENAI_API_KEY is set and the server is running.`);
    debateState.running = false;
    nextRoundBtn.disabled = true;
  }
}

// ── Reset ────────────────────────────────────────────────────────────────
function resetDebate() {
  debateState = {
    running: false,
    round: 0,
    history: [],
    topic: "",
    scores: { agent1: 0, agent2: 0, agent3: 0 },
  };
  feed.innerHTML = `<div class="arena-empty"><p>No debate running. Enter a topic and hit <strong>Start Debate</strong>.</p></div>`;
  scoreboard.style.display = "none";
  roundCounter.textContent = "Round 0";
  startBtn.disabled = false;
  topicInput.disabled = false;
  nextRoundBtn.disabled = true;
}

// ── Render helpers ────────────────────────────────────────────────────────
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
  const key = AGENT_KEYS[aid];
  const initial = AGENT_NAMES[aid][0];
  const el = document.createElement("div");
  el.className = `speech-bubble speech-${key}`;
  el.innerHTML = `
    <div class="speech-avatar">${initial}</div>
    <div class="speech-body">
      <strong>${AGENT_NAMES[aid]}</strong>
      <p>${escapeHtml(turn.speech)}</p>
      <div class="speech-xexam"><em>Cross-examination:</em> ${escapeHtml(turn.cross_examination)}</div>
      <div class="speech-vote">Vote: <strong>${AGENT_NAMES[turn.vote]}</strong> · Confidence: ${turn.confidence} · Concession: ${turn.concession_ready ? "Yes" : "No"}</div>
    </div>
  `;
  feed.appendChild(el);
}

function buildRevoteCard(aid, rv) {
  const key = AGENT_KEYS[aid];
  return `
    <div class="revote-card revote-${key}">
      <strong>${AGENT_NAMES[aid]}</strong> → <span class="vote-chip">${AGENT_NAMES[rv.vote]}</span>
      <p>${escapeHtml(rv.reason)}</p>
      <div class="revote-conf">Confidence: ${rv.confidence} · Changed: ${rv.changed_vote ? "Yes" : "No"}</div>
    </div>
  `;
}

function appendResult(text) {
  const el = document.createElement("div");
  el.className = "debate-result";
  el.innerHTML = `<p class="result-label">Result</p><p class="result-text">${escapeHtml(text)}</p>`;
  feed.appendChild(el);
}

function updateScoreboard() {
  document.getElementById("score-lucian").textContent = debateState.scores.agent1;
  document.getElementById("score-mira").textContent   = debateState.scores.agent2;
  document.getElementById("score-brock").textContent   = debateState.scores.agent3;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
