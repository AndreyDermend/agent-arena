# Agent Arena — AI Debate Platform

Three AI agents with distinct personalities debate any topic you throw at them.

| Agent | Archetype | Style |
|-------|-----------|-------|
| **Lucian Vale** (23) | The Surgeon | Polished, surgical, destabilizing |
| **Mira Solis** (18) | The Anchor | Empathic, grounded, resilient |
| **Brock Mercer** (28) | The Brawler | Blunt, forceful, relentless |

---

## Repo Structure

```
agent-arena/
├── app.py                  # Flask web server + debate API
├── debate.py               # Standalone CLI debate runner
├── requirements.txt
├── prompts/
│   ├── lucian.txt          # Lucian Vale system prompt
│   ├── mira.txt            # Mira Solis system prompt
│   └── brock.txt           # Brock Mercer system prompt
├── templates/
│   └── index.html          # Main website template
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── arena.js        # Live debate frontend logic
│   ├── images/
│   │   ├── lucian.png      # ← ADD YOUR AGENT IMAGE
│   │   ├── mira.png        # ← ADD YOUR AGENT IMAGE
│   │   └── brock.png       # ← ADD YOUR AGENT IMAGE
│   └── video/
│       └── intro.mp4       # ← ADD YOUR INTRO VIDEO
└── README.md
```

---

## Setup (Local)

### 1. Clone / unzip the repo

```bash
cd agent-arena
```

### 2. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set your OpenAI API key

```bash
export OPENAI_API_KEY="sk-..."
```

### 5. Add your media files

Drop your images and video into the right folders:

- `static/images/lucian.png` — Lucian Vale portrait
- `static/images/mira.png` — Mira Solis portrait
- `static/images/brock.png` — Brock Mercer portrait
- `static/video/intro.mp4` — Introductory video

Then uncomment the `<video>` tag in `templates/index.html` (and remove the placeholder `<div>`).

### 6. Run the web server

```bash
python app.py
```

Visit **http://localhost:5000** in your browser.

### 7. (Optional) Run a CLI debate

```bash
python debate.py
```

This runs the full 8-round debate in your terminal with forced consensus.

---

## Deployment

### Render / Railway / Fly.io

1. Push to a GitHub repo
2. Set environment variable: `OPENAI_API_KEY`
3. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT`

### Docker (optional)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
```

---

## How It Works

1. **You enter a topic** in the Live Arena
2. **Each round**: all 3 agents generate a speech + cross-examination + vote (via OpenAI structured outputs)
3. **Revote phase**: agents can change their vote after seeing all speeches
4. **Consensus check**: if all 3 vote the same → winner declared
5. **Otherwise**: next round begins
6. The scoreboard tracks cumulative votes across rounds

The debate uses GPT-4.1-mini with structured JSON output schemas to keep agents in character and produce parseable results.

---

## Customization

- **Change the model**: Set `OPENAI_MODEL` env var (default: `gpt-4.1-mini`)
- **Edit personalities**: Modify files in `prompts/`
- **Add agents**: Add new prompt files and update `AGENTS` dict in `app.py`
- **Adjust temperature**: Change `TEMPERATURE` in `app.py` (higher = more creative/chaotic)

---

*Built with Flask, OpenAI Structured Outputs, and three agents who will never agree on anything.*
