# TinyTube — Agent Instructions

Kid-safe YouTube viewer. A child can only watch videos from parent-approved channels; there is deliberately **no search, no suggestions, no external navigation, and no backend**.

## Architecture

```
channels.json ─▶ scraper (yt-dlp, GH Actions cron) ─▶ webapp/public/videos.json ─▶ React SPA (GH Pages)
                                                                                       │
                                                                                localStorage (watch history)
```

- `channels.json` — the only thing a parent edits: `[{min_age, max_age, channels: [urls]}]`. Age ranges may overlap. URLs may be `@handle`, `UC...` id, or full YouTube URLs.
- `scraper/` — **uv project** (`uv run --project scraper scraper/scrape.py`). Flat yt-dlp extraction of each channel's `/videos` tab (newest first, excludes Shorts), RSS-feed fallback, then `--seed` (previous deployed videos.json) as stale fallback. Never commit `videos.json` — it is gitignored and regenerated on every deploy.
- `webapp/` — Vite + React 19 + Bootstrap 5 (CSS only) + react-youtube + Font Awesome kit (`kit.fontawesome.com/a22be8527e.css` in `index.html`). Mobile-first (iPad/iPhone Safari), dark theme, PWA-ish (manifest + apple meta tags).

## Make targets (top-level Makefile; the only entry points)

- `make download` — scrape channels → `webapp/public/videos.json`
- `make dev` — download (if missing) + vite dev server (`http://localhost:5173`; the `/TinyTube/` base path applies only to production builds)
- `make test` — vitest suite (`webapp/src/**/*.test.js*`: gallery sort logic + VideoPlayer lifecycle with a mocked react-youtube); called by `make prod`
- `make prod` — download + test + `vite build`; what CI runs

## Key behaviors (do not regress)

- **Parent mode** (`webapp/src/components/ParentMode.jsx`, gated by `MathGate.jsx`): the Parents button (top-right, `fa-family` icon) opens a 2-digit-addition gate — 4 choices, 5-second countdown; wrong/timeout hides the button for 1 minute (persisted). That gate + lockout is the tamper-proofing (there is no `?age` URL param anymore). Inside: global age-range dual slider (default 1–15 = everything), hide/show curated channels, and search/add any YouTube channel via the **parent's own** Data API v3 key (stored locally; this repo deliberately ships no key). Custom-channel videos come from the long-form uploads playlist (`UULF` + channel id suffix, excludes Shorts) via `webapp/src/lib/youtubeApi.js`, cached 24h.
- **Age filter**: settings-driven — a group/channel shows when its `[min_age, max_age]` overlaps the parent's range (inclusive); see `webapp/src/lib/channels.js`.
- **Kid-proof player** (`webapp/src/components/VideoPlayer.jsx`): youtube-nocookie embed with `controls:0, rel:0, fs:0, disablekb:1`; a transparent `TouchShield` swallows all touches; any non-playing state shows the opaque `PausedOverlay` so YouTube's "More videos" tray / end screen is never visible or tappable; ENDED → mark watched → back to gallery (no auto-advance).
- **Gallery sort** (`webapp/src/hooks/useWatchStore.js: gallerySort`): (1) in-progress 20–95% watched, closest-to-finish first; (2) unwatched, round-robin interleaved across channels so high-volume channels can't flood quiet ones; (3) abandoned <20%; (4) watched >95% last. `is_watched` = >95% because the tail is usually credits.
- **localStorage** keys: `tinytube:v1` watch history `{lastVideoId, watched: {id: {pos, dur, completed, updatedAt}}}` (LRU-capped 500, saved every 5 s while playing); `tinytube:settings:v1` parent settings `{apiKey, ageRange, hiddenChannels, customChannels, parentLockUntil}`; `tinytube:videocache:v1` custom-channel video cache `{[channel_id]: {fetchedAt, videos}}` (24h TTL).

## Deploy

`.github/workflows/deploy.yml`: push to `master` + daily cron + manual → `make prod` → GitHub Pages (`https://pathikrit.github.io/TinyTube/`). Vite `base` comes from `BASE_PATH` env (defaults to `/TinyTube/`, build only). GitHub repo setting required once: Settings → Pages → Source = "GitHub Actions".

## Conventions

- Python: uv projects only (no pip/requirements.txt). Keep `uv.lock` committed.
- Keep `README.md` tiny; put agent/developer detail here.
- yt-dlp is intentionally unpinned (YouTube breaks old versions; the daily cron self-heals).
