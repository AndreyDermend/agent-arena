# Agent Arena — AI Debate Platform

A fully static website where three AI agents with distinct personalities debate any topic. Runs entirely in the browser via the OpenAI API — no backend needed. Host it on GitHub Pages for free.

| Agent | Archetype | Style |
|-------|-----------|-------|
| **Lucian Vale** (23) | The Surgeon | Polished, surgical, destabilizing |
| **Mira Solis** (18) | The Anchor | Empathic, grounded, resilient |
| **Brock Mercer** (28) | The Brawler | Blunt, forceful, relentless |

---

## Repo Structure

```
agent-arena/
├── index.html              ← Main page (GitHub Pages entry point)
├── css/
│   └── style.css
├── js/
│   └── arena.js            ← Debate engine (calls OpenAI directly)
├── images/
│   ├── lucian.png           ← ADD YOUR IMAGE
│   ├── mira.png             ← ADD YOUR IMAGE
│   └── brock.png            ← ADD YOUR IMAGE
├── video/
│   └── intro.mp4            ← ADD YOUR VIDEO
└── README.md
```

---

## Setup — GitHub Pages

### 1. Create a GitHub repo

```bash
# In this folder:
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/agent-arena.git
git push -u origin main
```

### 2. Add your media files

Drop your files into the repo:

- `images/lucian.png` — Lucian Vale portrait
- `images/mira.png` — Mira Solis portrait
- `images/brock.png` — Brock Mercer portrait
- `video/intro.mp4` — Introductory video

Then edit `index.html`:
- **Delete** the `<div class="video-placeholder">...</div>` block
- **Uncomment** the `<video>` tag right below it

Commit and push:
```bash
git add .
git commit -m "add media"
git push
```

### 3. Enable GitHub Pages

1. Go to your repo on GitHub
2. **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Branch: `main` · Folder: `/ (root)`
5. Click **Save**

Your site will be live at:
```
https://YOUR_USERNAME.github.io/agent-arena/
```

### 4. Use the Live Arena

1. Visit your site
2. Scroll to **The Arena**
3. Paste your OpenAI API key (stays in your browser, never stored)
4. Enter a debate topic
5. Hit **Start Debate** and watch them clash

---

## How It Works

- The **example debate** is pre-recorded and baked into the HTML — no API calls needed to view it
- The **live arena** calls the OpenAI API directly from your browser using `fetch()`
- Each round: 3 speeches → 3 revotes → consensus check
- If all 3 agents vote for the same winner → debate ends
- Otherwise → next round
- Uses GPT-4.1-mini with structured JSON outputs to keep agents in character

---

## Customization

- **Change the model**: Edit `MODEL` in `js/arena.js` (e.g. `gpt-4o`, `gpt-4.1`)
- **Edit personalities**: Modify the `PROMPTS` object in `js/arena.js`
- **Add agents**: Add new entries to `PROMPTS` and `AGENTS` in `js/arena.js`
- **Adjust temperature**: Change `TEMPERATURE` in `js/arena.js`

---

## Security Note

Your OpenAI API key is entered in the browser and sent **only** to `api.openai.com`. It is never stored, logged, or sent anywhere else. That said, anyone with access to your browser's dev tools could see it in network requests, so treat this as a personal/demo tool — not a production app with shared keys.

---

*Three AI personalities. One debate engine. Infinite arguments.*
