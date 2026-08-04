# TinyTube

[![Deploy](https://github.com/pathikrit/tinytube/actions/workflows/deploy.yml/badge.svg)](https://github.com/pathikrit/tinytube/actions/workflows/deploy.yml)

A kid-safe YouTube viewer: children can only watch videos from parent-approved channels ([`channels.json`](channels.json)) — no search, no suggestions, no way to navigate out. Static site, no backend; a daily scraper refreshes the video list. Live at [pathikrit.github.io/tinytube](https://pathikrit.github.io/tinytube/).

```sh
git clone https://github.com/pathikrit/tinytube.git && cd tinytube && make dev
```

See [AGENTS.md](AGENTS.md) for architecture and development details.
