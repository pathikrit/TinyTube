# TinyTube — Agent Instructions

Kid-safe YouTube viewer. A child can only watch videos from parent-approved channels; there is deliberately **no search, no suggestions, no external navigation, and no backend**.

## Architecture

Single top-level npm project: the downloader and the SPA share one package.json and one API client.

```
channels.json ─▶ download.mjs (YouTube Data API, GH Actions cron) ─▶ public/videos.json ─▶ React SPA (GH Pages)
                                                                                              │
                                                                                       localStorage (watch history)
```

- `channels.json` — flat list: `[{channel, min_age?, max_age?}]`. `channel` may be a bare name (`JaredOwen` → `@JaredOwen`), `@handle`, `UC...` id, or full YouTube URL; ages default to 1/15. The same flat `{channel, min_age, max_age}` shape is used in videos.json and in the settings localStorage model.
- `download.mjs` — zero-dependency Node script; imports `resolveChannel`/`fetchChannelVideos` from `src/youtubeApi.js` (the SAME tested client the webapp uses at runtime), so downloader and webapp cannot drift. Needs `YOUTUBE_API_KEY` (local: `.env`, loaded via `node --env-file-if-exists`; CI: repo secret). ~3 quota units per channel per run. `--seed` (the currently-deployed videos.json) is a per-channel stale fallback so one broken channel or API hiccup never blanks the site. Output `videos.json` (schema v2): `{schema_version, generated_at, channels: [{channel_id, channel_title, thumbnail, source_url, subscribers, video_count, view_count, made_for_kids, topics, min_age, max_age, videos: [{id,title,duration,thumbnail}]}]}`. Never commit `videos.json` or `.env` — both are gitignored (`.env.sample` documents the key name).
- SPA — Vite + React 19 + Bootstrap 5 (CSS only) + react-youtube + Font Awesome kit (`kit.fontawesome.com/a22be8527e.css` in `index.html`). Mobile-first (iPad/iPhone Safari), dark theme, PWA-ish (manifest + apple meta tags). Deliberately flat `src/`: one file per feature — `main.jsx` (App shell + boot), `landing.jsx` (enroll + math gates), `gallery.jsx`, `player.jsx`, `settings.jsx`, `lib.js` (all non-UI logic + hooks), `youtubeApi.js`, `styles.css` — plus `test/*.test.js*`; keep it that way rather than re-splitting into per-component files.

## Make targets (top-level Makefile; the only entry points)

- `make download` — fetch channels via YouTube Data API → `public/videos.json`
- `make dev` — download (if missing) + watch mode: vite dev server (`http://localhost:5173`; the `/TinyTube/` base path applies only to production builds) and vitest re-running affected tests on change, side by side via `concurrently`
- `make test` — vitest suite (`test/*.test.js*`: gallery sort logic + VideoPlayer lifecycle with a mocked react-youtube); called by `make prod`
- `make prod` — download + test + `vite build`; what CI runs

## Key behaviors (do not regress)

- **Parent gate**: on a biometric-capable device, first load blocks on `EnrollGate` (`src/landing.jsx`) — nothing (not even the gallery) shows until a grown-up registers the device biometric (`src/lib.js` — serverless WebAuthn platform authenticator; Face ID/Touch ID/fingerprint via `userVerification: 'required'`, credential id in settings.passkeyId; a button because WebAuthn needs a user gesture). From then on the Parents button triggers the OS biometric prompt directly; cancel/failed scan just returns to the gallery (no lockout mechanism). Devices WITHOUT a platform authenticator skip enrollment and protect parent mode with the `MathGate` (`src/landing.jsx`) 2-digit-addition gate (4 choices, 5-second countdown; wrong/timeout closes the gate). WebAuthn needs a secure context: localhost dev and the deployed HTTPS site work, LAN-IP dev URLs don't (those fall back to the math gate).
- **Settings** (parent-gated; `src/settings.jsx`): inside: one-liner age dual-slider (values on the thumbs) and API-key rows, debounced (500ms, ≥3 chars — search.list costs 100 quota units) autocomplete channel search whose result rows show the same stats/topics cells as the table below, and a TanStack-Table channel editor (avatar+link | stats | topics | ages | delete). The ages cell holds the SAME `DualAgeSlider` as the global filter; its column reserves 55% width with a 420px minimum because a cramped 1–15 dual slider is unreadable (the page is `container-xl` wide, and narrow screens h-scroll via `table-responsive` — do not shrink the slider instead). Deleting curated = hidden flag, restorable. Rows sort descending by min then max age; the header shows an in-range counter (`Channel (8/10)`) and rows outside the global age filter gray out live. All via the **parent's own** Data API v3 key (stored locally; the deployed site ships no key — the CI `YOUTUBE_API_KEY` is build-time only). Custom-channel videos come from the long-form uploads playlist (`UULF` + channel id suffix, excludes Shorts, 18+ `ytAgeRestricted` filtered out) via `src/youtubeApi.js`, cached 24h. A footer links the built commit (`__COMMIT_SHA__` via Vite define; `GITHUB_SHA` in CI).
- **Age filter**: settings-driven — a channel shows when its `[min_age, max_age]` (curated value, or the parent's per-channel override) overlaps the global range (inclusive); see `src/lib.js`.
- **Kid-proof player** (`src/player.jsx`): www.youtube.com embed (NOT youtube-nocookie — it misfires as error 150 on mobile) with `controls:0, rel:0, fs:0, disablekb:1`; a transparent `TouchShield` swallows all touches; any non-playing state shows the opaque `PausedOverlay` so YouTube's "More videos" tray / end screen is never visible or tappable; ENDED → mark watched → back to gallery (no auto-advance).
- **Gallery sort** (`src/lib.js: gallerySort`): (1) in-progress 20–95% watched, closest-to-finish first; (2) unwatched, round-robin interleaved across channels so high-volume channels can't flood quiet ones; (3) abandoned <20%; (4) watched >95% last. `is_watched` = >95% because the tail is usually credits.
- **localStorage** keys: `tinytube:v1` watch history `{lastVideoId, watched: {id: {pos, dur, completed, updatedAt}}}` (LRU-capped 500, saved every 5 s while playing); `tinytube:settings:v1` parent settings `{apiKey, ageRange, customChannels: [{channel_id, channel_title, thumbnail, min_age, max_age}], overrides: {channel_id: {min_age?, max_age?, hidden?}}, passkeyId}` (mirrors the flat channels.json shape; legacy hiddenChannels/ageOverrides/parentLockUntil fields are dropped or folded into `overrides` on load); `tinytube:videocache:v1` custom-channel video cache `{[channel_id]: {fetchedAt, videos}}` (24h TTL).

## Deploy

`.github/workflows/deploy.yml`: push to `master` + daily cron + manual → `make prod` → GitHub Pages (`https://pathikrit.github.io/TinyTube/`). Vite `base` comes from `BASE_PATH` env (defaults to `/TinyTube/`, build only). GitHub repo settings required once: Settings → Pages → Source = "GitHub Actions", and a `YOUTUBE_API_KEY` Actions secret for the downloader.

## Conventions

- Keep `README.md` tiny; put agent/developer detail here.
