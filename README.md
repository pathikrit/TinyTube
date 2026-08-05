# TinyTube [![Deploy](https://github.com/pathikrit/TinyTube/actions/workflows/deploy.yml/badge.svg)](https://github.com/pathikrit/TinyTube/actions/workflows/deploy.yml)

One-time setup: get a [YouTube Data API v3 key](https://console.cloud.google.com/apis/library/youtube.googleapis.com) and put it in `.env`:

```sh
cp .env.sample .env   # then paste your key after YOUTUBE_API_KEY=
```

Run it:

```sh
make dev
```

See [AGENTS.md](AGENTS.md) for architecture and development details.
