# TinyTube

[![Deploy](https://github.com/pathikrit/TinyTube/actions/workflows/deploy.yml/badge.svg)](https://github.com/pathikrit/TinyTube/actions/workflows/deploy.yml)

A kid-safe YouTube viewer: children can only watch videos from parent-approved channels ([`channels.json`](channels.json)) — no search, no suggestions, no way to navigate out. Static site, no backend; a daily scraper refreshes the video list. Live at [pathikrit.github.io/TinyTube](https://pathikrit.github.io/TinyTube/).

```sh
git clone https://github.com/pathikrit/TinyTube.git && cd TinyTube && make dev
```

See [AGENTS.md](AGENTS.md) for architecture and development details.
