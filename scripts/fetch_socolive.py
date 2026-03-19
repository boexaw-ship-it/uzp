#!/usr/bin/env python3
"""
fetch_socolive.py
Socolive မှ live football matches တွေကို scrape ပြီး
stream URLs ထုတ်ကာ socolive_live.m3u file ဆောက်တဲ့ script
"""

import re
import json
import time
import requests
from datetime import datetime
from bs4 import BeautifulSoup

# ── CONFIG ──────────────────────────────────────────────────────────
BASE_URL    = "https://socolivee.cv"
API_URL     = "https://api.fmp.live/query"
OUTPUT_FILE = "playlists/socolive_live.m3u"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer":         BASE_URL,
}

API_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept":     "application/json, text/plain, */*",
    "Origin":     BASE_URL,
    "Referer":    BASE_URL + "/",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# ── STEP 1: Get today's matches ──────────────────────────────────────
def get_matches():
    print("[1] Fetching match list from homepage...")
    try:
        resp = SESSION.get(BASE_URL, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"  ERROR fetching homepage: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    matches = []

    # Find all match links: /truc-tiep/...
    links = soup.find_all("a", href=re.compile(r"/truc-tiep/[^?]+$"))
    seen = set()

    for link in links:
        href = link.get("href", "")
        if href in seen:
            continue
        seen.add(href)

        # Extract match name from URL slug
        slug = href.rstrip("/").split("/truc-tiep/")[-1]
        parts = slug.split("-")
        # Remove date/time from end (last 2 parts)
        name_parts = parts[:-2] if len(parts) > 2 else parts
        name = " ".join(p.capitalize() for p in name_parts).replace(" Vs ", " vs ")

        matches.append({
            "name": name or slug,
            "url":  BASE_URL + href if href.startswith("/") else href,
            "slug": slug,
        })

    print(f"  Found {len(matches)} matches")
    return matches[:30]  # Limit to top 30 matches


# ── STEP 2: Get BLV (streamer) IDs from match page ──────────────────
def get_blv_ids(match_url):
    try:
        resp = SESSION.get(match_url, timeout=12)
        resp.raise_for_status()
    except Exception as e:
        print(f"    ERROR fetching match page: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    blv_ids = []

    # Find ?blv=XXXXXX links
    blv_links = soup.find_all("a", href=re.compile(r"\?blv=\d+"))
    for link in blv_links:
        href = link.get("href", "")
        m = re.search(r"\?blv=(\d+)", href)
        if m:
            blv_id = m.group(1)
            blv_name = link.get_text(strip=True) or f"BLV_{blv_id}"
            if blv_id not in [b["id"] for b in blv_ids]:
                blv_ids.append({"id": blv_id, "name": blv_name})

    return blv_ids[:3]  # Take first 3 streamers per match


# ── STEP 3: Get stream URL from API ─────────────────────────────────
def get_stream_url(blv_id, match_slug):
    """
    Try multiple API patterns to get stream URL
    """
    # Pattern 1: api.fmp.live/query with streamer id
    try:
        params = {
            "id":   blv_id,
            "type": "live",
        }
        resp = requests.get(
            API_URL,
            params=params,
            headers=API_HEADERS,
            timeout=10
        )
        if resp.ok:
            data = resp.json()
            # Try common response keys
            for key in ["url", "stream_url", "hls", "m3u8", "link", "src"]:
                if key in data and data[key]:
                    url = data[key]
                    if url.startswith("http") and (".m3u8" in url or "/live" in url or ".flv" in url):
                        return url

            # Try nested
            if "data" in data:
                d = data["data"]
                if isinstance(d, dict):
                    for key in ["url", "stream_url", "hls", "m3u8", "link"]:
                        if key in d and d[key]:
                            return d[key]
                elif isinstance(d, str) and d.startswith("http"):
                    return d
    except Exception as e:
        print(f"      API error: {e}")

    # Pattern 2: Try direct stream URL pattern based on blv_id
    # Some sites use predictable URL patterns
    candidates = [
        f"https://alpull.mmchari.xyz/live/live_{blv_id}.m3u8",
        f"https://alpull.mmchari.xyz/live/live_{blv_id}.flv",
    ]
    for url in candidates:
        try:
            r = requests.head(url, timeout=5, allow_redirects=True)
            if r.status_code in [200, 206]:
                return url
        except:
            pass

    return None


# ── STEP 4: Build M3U ────────────────────────────────────────────────
def build_m3u(channels):
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "#EXTM3U",
        f"# Generated by fetch_socolive.py at {now}",
        f"# Total: {len(channels)} streams",
        "",
    ]
    for ch in channels:
        logo = ch.get("logo", "")
        logo_attr = f' tvg-logo="{logo}"' if logo else ""
        lines.append(
            f'#EXTINF:-1{logo_attr} group-title="Socolive Live",{ch["name"]}'
        )
        lines.append(ch["url"])
        lines.append("")

    return "\n".join(lines)


# ── MAIN ─────────────────────────────────────────────────────────────
def main():
    print("=" * 50)
    print("  Socolive Stream Fetcher")
    print(f"  {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 50)

    channels = []
    matches  = get_matches()

    if not matches:
        print("No matches found. Exiting.")
        return

    print(f"\n[2] Fetching stream URLs for {len(matches)} matches...\n")

    for i, match in enumerate(matches, 1):
        print(f"  [{i}/{len(matches)}] {match['name']}")
        blv_ids = get_blv_ids(match["url"])

        if not blv_ids:
            print("    No streamers found, skipping")
            continue

        for blv in blv_ids:
            print(f"    BLV: {blv['name']} (id={blv['id']})", end=" ")
            stream_url = get_stream_url(blv["id"], match["slug"])

            if stream_url:
                print(f"→ ✅ {stream_url[:60]}...")
                channel_name = f"{match['name']} [{blv['name']}]"
                channels.append({
                    "name": channel_name,
                    "url":  stream_url,
                    "logo": "",
                })
            else:
                print("→ ❌ No stream URL")

            time.sleep(0.5)  # Be polite

    print(f"\n[3] Writing {len(channels)} channels to {OUTPUT_FILE}...")

    import os
    os.makedirs("playlists", exist_ok=True)

    if channels:
        m3u_content = build_m3u(channels)
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(m3u_content)
        print(f"  ✅ Saved: {OUTPUT_FILE}")
    else:
        # Write empty playlist with note
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(f"#EXTM3U\n# No live streams available at {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n")
        print("  ⚠️  No streams found — empty playlist saved")

    print("\nDone!")


if __name__ == "__main__":
    main()
