"""
The Circuit - build the list of newsletter candidates
=====================================================

Runs the collector (collect_news.py), then writes everything it found to
data/newsletter-candidates.json for the review desk (circuit-admin/) to show.

For each item this script also:
  - guesses a newsletter section (reviewers can change it on the review desk)
  - looks up a preview picture (the og:image the article shares)
  - removes leftover HTML entities and arXiv boilerplate from descriptions

Nothing is published here. A person still approves items on the review desk,
and only approved items appear on ai-insights.html.

The GitHub Action in .github/workflows/newsletter-collect.yml runs this
every Monday and whenever someone clicks "Run collector" on the review desk.

RUN IT BY HAND
--------------
  pip3 install feedparser requests
  python3 ai_brief/build_candidates.py
"""

import html
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

import requests

import collect_news


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = os.path.dirname(BASE_DIR)
SOURCES_FILE = os.path.join(BASE_DIR, "sources.csv")
CANDIDATES_FILE = os.path.join(REPO_DIR, "data", "newsletter-candidates.json")
NEWSLETTER_FILE = os.path.join(REPO_DIR, "data", "newsletter.json")


# ---------------------------------------------------------------------------
# Section guessing (same rules the Streamlit review desk used).
# ---------------------------------------------------------------------------
TOOL_KEYWORDS = [
    "launch", "releases", "released", "introducing", "open-source", "open source",
    " api", "sdk", "toolkit", "library", "now available", "plugin",
]
USE_CASE_KEYWORDS = [
    "healthcare", "hospital", "patient", "medical", "clinical", "education",
    "student", "teacher", "classroom", "climate", "agricultur", "farm",
    "wildlife", "manufactur", "finance", "banking", "legal", "case study",
    "in practice", "real-world", "real world", "deploy",
]


def guess_section(item):
    """Pick a default newsletter section for one item."""
    content_type = item["content_type"].lower()
    title = item["title"].lower()
    text = title + " " + item["description"].lower()
    url = item["url"].lower()

    if content_type in ("video", "videos") or "youtube.com" in url or "vimeo.com" in url:
        return "Videos"
    if content_type in ("tool", "tools"):
        return "AI Tools"
    if content_type in ("tutorial", "educational", "course", "learning"):
        return "Tutorials & Learning"
    if content_type == "research":
        return "Research Spotlight"
    if content_type in ("use case", "use_case", "case study"):
        return "Applied AI Use Cases"
    if any(word in title for word in TOOL_KEYWORDS):
        return "AI Tools"
    if any(word in text for word in USE_CASE_KEYWORDS):
        return "Applied AI Use Cases"
    return "Latest AI News"


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
def plain_text(text):
    """Decode entities like &#160; and collapse extra spaces/newlines."""
    return " ".join(html.unescape(str(text or "")).split())


def clean_summary(text):
    """Remove arXiv boilerplate like 'arXiv:2610.1234v1 Announce Type: new Abstract:'."""
    return re.sub(r"^arXiv:\S+\s+Announce Type:\s*\S+\s+Abstract:\s*", "", plain_text(text))


def safe_url(url):
    """Only allow normal web links."""
    url = str(url or "").strip()
    return url if url.startswith(("http://", "https://")) else ""


def youtube_id(url):
    """Pull the video ID out of a YouTube link (or return '' if it isn't one)."""
    match = re.search(r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([\w-]{11})", str(url or ""))
    return match.group(1) if match else ""


# ---------------------------------------------------------------------------
# Preview pictures (same lookup the Streamlit review desk used).
# ---------------------------------------------------------------------------
IMAGE_RETRY_DAYS = 1
# Microlink's free plan allows about 50 lookups a day. Stay under that.
MAX_PREVIEW_SERVICE_LOOKUPS = 40
PREVIEW_SERVICE_URL = "https://api.microlink.io/"
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
IMAGE_META_NAMES = ["og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src"]
META_TAG = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
META_ATTRIBUTE = re.compile(r"""([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)""")


def image_from_page(url):
    """Find the preview image named in an article page's <meta> tags."""
    try:
        page = requests.get(url, timeout=6, headers=BROWSER_HEADERS).text[:400000]
    except requests.exceptions.RequestException:
        return ""
    found = {}
    for tag in META_TAG.findall(page):
        attributes = {name.lower(): value.strip("\"'") for name, value in META_ATTRIBUTE.findall(tag)}
        key = (attributes.get("property") or attributes.get("name") or "").lower()
        if key in IMAGE_META_NAMES and attributes.get("content") and key not in found:
            found[key] = attributes["content"]
    for key in IMAGE_META_NAMES:
        if key in found:
            return safe_url(urljoin(url, html.unescape(found[key].strip())))
    return ""


def image_from_preview_service(url):
    """Backup for sites that block automated visitors: ask Microlink."""
    try:
        response = requests.get(PREVIEW_SERVICE_URL, params={"url": url}, timeout=20)
        image = ((response.json().get("data") or {}).get("image") or {}).get("url")
    except (requests.exceptions.RequestException, ValueError, AttributeError):
        return ""
    return safe_url(image)


def known_images():
    """
    Pictures found on earlier runs, so each article is only looked up once.
    Reads the previous candidates file and the published newsletter.
    """
    known = {}
    try:
        with open(CANDIDATES_FILE, encoding="utf-8") as f:
            for item in json.load(f).get("items", []):
                known[item["url"]] = {"image": item.get("image", ""), "checked": item.get("imageChecked", "")}
    except (OSError, ValueError, KeyError):
        pass
    try:
        with open(NEWSLETTER_FILE, encoding="utf-8") as f:
            data = json.load(f)
        for item in ([data["spotlight"]] if data.get("spotlight") else []) + data.get("items", []):
            if item.get("image"):
                known[item["url"]] = {"image": item["image"], "checked": ""}
    except (OSError, ValueError, KeyError):
        pass
    return known


def add_images(items):
    """Fill in item["image"] for every item, reusing earlier answers."""
    known = known_images()
    now = datetime.now(timezone.utc)
    retry_before = (now - timedelta(days=IMAGE_RETRY_DAYS)).isoformat()

    to_fetch = []
    for item in items:
        video = youtube_id(item["url"])
        earlier = known.get(item["url"])
        if video:
            item["image"], item["imageChecked"] = f"https://i.ytimg.com/vi/{video}/hqdefault.jpg", ""
        elif earlier and (earlier["image"] or earlier["checked"] >= retry_before):
            item["image"], item["imageChecked"] = earlier["image"], earlier["checked"]
        else:
            to_fetch.append(item)

    print(f"\nLooking up preview pictures for {len(to_fetch)} item(s)...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        pictures = list(pool.map(lambda item: image_from_page(item["url"]), to_fetch))

    service_lookups = 0
    for item, picture in zip(to_fetch, pictures):
        if not picture and service_lookups < MAX_PREVIEW_SERVICE_LOOKUPS:
            service_lookups += 1
            picture = image_from_preview_service(item["url"])
        item["image"] = picture
        item["imageChecked"] = now.isoformat(timespec="seconds")

    found = sum(1 for item in items if item["image"])
    print(f"   {found} of {len(items)} item(s) have a picture")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("The Circuit - collecting newsletter candidates\n")
    sources = collect_news.load_sources(SOURCES_FILE)
    print(f"Reading from {len(sources)} source(s):")

    collected = []
    for source in sources:
        collected.extend(collect_news.collect_from_source(source))
    collected = collect_news.sort_newest_first(collect_news.remove_duplicates(collected))

    items = []
    for raw in collected:
        url = safe_url(raw["url"])
        if not url or not raw["title"]:
            continue
        item = {
            "title": plain_text(raw["title"]),
            "description": clean_summary(raw["description"]),
            "source": raw["source"],
            "published": raw["_date"].isoformat() if raw["_date"] else "",
            "contentType": raw["content_type"],
            "url": url,
            "videoId": youtube_id(url),
        }
        item["section"] = guess_section({
            "content_type": item["contentType"], "title": item["title"],
            "description": item["description"], "url": url,
        })
        items.append(item)

    add_images(items)

    os.makedirs(os.path.dirname(CANDIDATES_FILE), exist_ok=True)
    with open(CANDIDATES_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "sourcesChecked": len(sources),
            "items": items,
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")

    collect_news.print_summary(collected, len(sources))
    print(f"\nSaved {len(items)} candidate(s) to {os.path.relpath(CANDIDATES_FILE, REPO_DIR)}")


if __name__ == "__main__":
    main()
