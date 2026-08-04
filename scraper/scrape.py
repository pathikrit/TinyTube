#!/usr/bin/env python3
"""Scrape approved YouTube channels (channels.json) into a static videos.json.

Usage:
    scrape.py --channels channels.json --out webapp/public/videos.json
              [--max-videos 50] [--seed previous-videos.json]

Per channel: yt-dlp flat extraction of the /videos tab (newest first, excludes
Shorts). Falls back to the channel's Atom RSS feed (last 15 videos, no
durations), then to the channel's blob in --seed (the currently-deployed
videos.json) so one broken channel never blanks the site.
"""

import argparse
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from yt_dlp import YoutubeDL

UC_ID = r"UC[0-9A-Za-z_-]{22}"
ATOM_NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def normalize(url: str) -> str:
    """bare name | @handle | UCxxxx | any youtube.com URL -> canonical https://www.youtube.com/... URL."""
    u = url.strip().rstrip("/")
    if re.fullmatch(UC_ID, u):
        return f"https://www.youtube.com/channel/{u}"
    if u.startswith("@"):
        return f"https://www.youtube.com/{u}"
    if re.fullmatch(r"[\w.-]+", u):  # bare channel name, e.g. "JaredOwen" -> @JaredOwen
        return f"https://www.youtube.com/@{u}"
    return re.sub(r"^(https?://)?(www\.|m\.)?youtube\.com", "https://www.youtube.com", u)


def thumbnail(video_id: str) -> str:
    return f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def scrape_ytdlp(url: str, max_videos: int) -> dict:
    opts = {
        "extract_flat": "in_playlist",
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "playlist_items": f"1:{max_videos}",
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(normalize(url) + "/videos", download=False)
    videos = [
        {
            "id": e["id"],
            "title": e.get("title", ""),
            "duration": int(e["duration"]) if e.get("duration") else None,
            "thumbnail": thumbnail(e["id"]),
        }
        for e in info.get("entries") or []
        if e.get("id")
    ]
    if not videos:
        raise RuntimeError("yt-dlp returned no videos")
    thumbs = info.get("thumbnails") or []
    avatar = next(
        (t["url"] for t in thumbs if t.get("id") == "avatar_uncropped"),
        next((t["url"] for t in thumbs if t.get("width") and t.get("width") == t.get("height")), None),
    )
    return {
        "channel_id": info.get("channel_id") or info.get("uploader_id"),
        "channel_title": (info.get("channel") or info.get("title", "")).removesuffix(" - Videos"),
        "thumbnail": avatar,
        "source_url": normalize(url),
        "videos": videos,
    }


def scrape_rss(url: str) -> dict:
    html = fetch(normalize(url)).decode("utf-8", "replace")
    channel_id = re.search(rf'"channelId":"({UC_ID})"', html).group(1)
    feed = fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
    root = ET.fromstring(feed)
    videos = [
        {
            "id": vid,
            "title": entry.findtext("a:title", "", ATOM_NS),
            "duration": None,
            "thumbnail": thumbnail(vid),
        }
        for entry in root.findall("a:entry", ATOM_NS)
        if (vid := entry.findtext("yt:videoId", "", ATOM_NS))
    ]
    if not videos:
        raise RuntimeError("RSS feed returned no videos")
    return {
        "channel_id": channel_id,
        "channel_title": root.findtext("a:title", "", ATOM_NS),
        "thumbnail": None,
        "source_url": normalize(url),
        "videos": videos,
    }


def scrape_channel(url: str, max_videos: int, seed: dict) -> dict | None:
    for method in (lambda: scrape_ytdlp(url, max_videos), lambda: scrape_rss(url)):
        try:
            return method()
        except Exception as e:
            print(f"  {url}: {type(e).__name__}: {e}", file=sys.stderr)
    stale = seed.get(normalize(url))
    if stale:
        print(f"  {url}: using stale data from seed ({len(stale['videos'])} videos)", file=sys.stderr)
    else:
        print(f"  {url}: SKIPPED (no fallback available)", file=sys.stderr)
    return stale


def load_seed(path: str | None) -> dict:
    """Previous videos.json (flat v2 or grouped v1) -> {source_url: channel blob}."""
    if not path:
        return {}
    try:
        with open(path) as f:
            prev = json.load(f)
        channels = prev.get("channels") or [ch for g in prev.get("groups", []) for ch in g["channels"]]
        return {ch["source_url"]: ch for ch in channels}
    except Exception as e:
        print(f"seed {path} unusable ({e}); continuing without", file=sys.stderr)
        return {}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--channels", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--max-videos", type=int, default=50)
    parser.add_argument("--seed", help="previous videos.json used as stale fallback")
    args = parser.parse_args()

    with open(args.channels) as f:
        entries = json.load(f)
    seed = load_seed(args.seed)

    channels, total = [], 0
    for entry in entries:
        blob = scrape_channel(entry["channel"], args.max_videos, seed)
        if blob:
            blob["min_age"] = entry.get("min_age", 1)
            blob["max_age"] = entry.get("max_age", 15)
            channels.append(blob)
            total += len(blob["videos"])
            print(f"{blob['channel_title']} (ages {blob['min_age']}-{blob['max_age']}): {len(blob['videos'])} videos")

    if total == 0:
        sys.exit("FATAL: scraped zero videos across all channels")

    out = {
        "schema_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "channels": channels,
    }
    with open(args.out, "w") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {args.out}: {total} videos")


if __name__ == "__main__":
    main()
