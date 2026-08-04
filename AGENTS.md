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
- `make dev` — download (if missing) + vite dev server (`http://localhost:5173?age=5`; the `/TinyTube/` base path applies only to production builds)
- `make test` — test suite (placeholder for now); called by `make prod`
- `make prod` — download + test + `vite build`; what CI runs

## Key behaviors (do not regress)

- **Age filter**: `?age=N` URL param selects groups where `min_age ≤ N ≤ max_age`; no param → all groups. There is intentionally no in-app age switcher (tamper-proofing).
- **Kid-proof player** (`webapp/src/components/VideoPlayer.jsx`): youtube-nocookie embed with `controls:0, rel:0, fs:0, disablekb:1`; a transparent `TouchShield` swallows all touches; any non-playing state shows the opaque `PausedOverlay` so YouTube's "More videos" tray / end screen is never visible or tappable; ENDED → mark watched → back to gallery (no auto-advance).
- **Gallery sort** (`webapp/src/hooks/useWatchStore.js: gallerySort`): (1) in-progress 20–95% watched, closest-to-finish first; (2) unwatched, round-robin interleaved across channels so high-volume channels can't flood quiet ones; (3) abandoned <20%; (4) watched >95% last. `is_watched` = >95% because the tail is usually credits.
- **localStorage** key `tinytube:v1`: `{lastVideoId, watched: {id: {pos, dur, completed, updatedAt}}}`, LRU-capped at 500, saved every 5 s while playing.

## Deploy

`.github/workflows/deploy.yml`: push to `master` + daily cron + manual → `make prod` → GitHub Pages (`https://pathikrit.github.io/TinyTube/`). Vite `base` comes from `BASE_PATH` env (defaults to `/TinyTube/`, build only). GitHub repo setting required once: Settings → Pages → Source = "GitHub Actions".

## Conventions

- Python: uv projects only (no pip/requirements.txt). Keep `uv.lock` committed.
- Keep `README.md` tiny; put agent/developer detail here.
- yt-dlp is intentionally unpinned (YouTube breaks old versions; the daily cron self-heals).
