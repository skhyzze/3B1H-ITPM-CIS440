"""
Applied AI Lab - Newsletter App (Streamlit)
===========================================

This app sits ON TOP of the existing collector (collect_news.py). It does not
change how content is collected. It adds two views:

  1. PUBLIC NEWSLETTER  (default view, what students and faculty see)
     A polished weekly newsletter that shows ONLY approved resources.

  2. INTERNAL CONTENT MANAGEMENT  (team only, password protected)
     Run the collector, browse/filter everything it found, approve items,
     pick a featured resource, choose a newsletter section, and download
     the approved list as a CSV.

The full flow:
  external AI sources -> collect_news.py -> output/ai_resources.csv
  -> internal review (this app) -> output/approved_resources.csv
  -> public newsletter view (this app)

HOW TO RUN
----------
  pip3 install -r requirements.txt
  streamlit run app.py

  Public view:   http://localhost:8501
  Internal view: http://localhost:8501/?view=admin
"""

# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------
import html                      # Decode entities like &#160; in feed text
import inspect                   # Check which options this Streamlit version supports
import json                      # Save the preview-image cache
import os                        # File paths and environment variables
import re                        # Tidy up feed text and find preview images
import subprocess                # Run collect_news.py as a separate program
import sys                       # Find the current Python interpreter
from concurrent.futures import ThreadPoolExecutor  # Look up images in parallel
from datetime import date, datetime, timedelta
from urllib.parse import urljoin  # Turn relative image links into full links

import pandas as pd              # Tables of data (read/write CSV files)
import requests                  # Download article pages to find preview images
import streamlit as st           # The web app framework
import streamlit.components.v1 as components  # Hosts the interactive newsletter page


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COLLECTOR_SCRIPT = os.path.join(BASE_DIR, "collect_news.py")
COLLECTED_FILE = os.path.join(BASE_DIR, "output", "ai_resources.csv")
# Approved items are saved in their own file, so they survive re-running the
# collector (which overwrites ai_resources.csv every time).
APPROVED_FILE = os.path.join(BASE_DIR, "output", "approved_resources.csv")

NEWSLETTER_TITLE = "The Applied AI Brief"
LAB_NAME = "Applied AI Lab"
INTRO_MESSAGE = (
    "Your weekly digest of what matters in artificial intelligence: the news "
    "worth knowing, tutorials worth your time, tools worth trying, and real "
    "examples of AI being applied. Every link below was hand-picked by the "
    "Applied AI Lab team."
)

# Password for the internal view. Set the environment variable
# AI_LAB_ADMIN_PASSWORD to change it. The default is only for local testing.
DEFAULT_ADMIN_PASSWORD = "appliedai"
ADMIN_PASSWORD = os.environ.get("AI_LAB_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)

# Columns produced by collect_news.py (in its save_to_csv function).
COLLECTOR_COLUMNS = ["title", "source", "published", "description", "url", "content_type"]
# Extra columns the review step adds.
# "image" is an optional picture link a reviewer can paste in by hand.
REVIEW_COLUMNS = ["section", "featured", "approved_at", "image"]

# Newsletter sections, in the order they appear on the public page.
#   name -> (short subtitle, icon name, button label)
SECTIONS = {
    "Latest AI News": ("Headlines and developments from across the AI field", "news", "Read More"),
    "Tutorials & Learning": ("Guides and explainers to build your AI skills", "book", "Explore"),
    "AI Tools": ("New models, libraries, and products worth trying", "tool", "Explore"),
    "Videos": ("Talks, demos, and walkthroughs to watch", "play", "Watch"),
    "Applied AI Use Cases": ("How AI is being put to work in the real world", "spark", "Read More"),
    "Research Spotlight": ("Notable papers and research highlights", "flask", "Read Paper"),
}
SECTION_NAMES = list(SECTIONS.keys())


# ---------------------------------------------------------------------------
# Section guessing: give every item a sensible default newsletter section.
# The collector only knows content types like "news", "tutorial", "research",
# so we use the type plus a few keywords. Reviewers can change it.
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


def guess_section(row):
    """Pick a default newsletter section for one resource."""
    content_type = str(row.get("content_type", "")).lower()
    title = str(row.get("title", "")).lower()
    text = title + " " + str(row.get("description", "")).lower()
    url = str(row.get("url", "")).lower()

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
    # Plain news: look for hints in the headline / description.
    if any(word in title for word in TOOL_KEYWORDS):
        return "AI Tools"
    if any(word in text for word in USE_CASE_KEYWORDS):
        return "Applied AI Use Cases"
    return "Latest AI News"


# ---------------------------------------------------------------------------
# Data loading and saving
# ---------------------------------------------------------------------------
def parse_dates(series):
    """Turn '2026-10-13 18:30 UTC' text into real dates ('unknown' -> empty)."""
    return pd.to_datetime(series, format="%Y-%m-%d %H:%M UTC", errors="coerce")


def file_version(path):
    """The file's last-modified time. Used so cached data refreshes on change."""
    return os.path.getmtime(path) if os.path.exists(path) else 0


@st.cache_data
def load_collected(_version):
    """Read the collector's output CSV (everything that was found)."""
    if not os.path.exists(COLLECTED_FILE):
        return pd.DataFrame(columns=COLLECTOR_COLUMNS)
    df = pd.read_csv(COLLECTED_FILE, dtype=str, keep_default_na=False)
    for column in COLLECTOR_COLUMNS:
        if column not in df.columns:
            df[column] = ""
    return df[COLLECTOR_COLUMNS]


def load_approved():
    """Read the approved list saved by the internal review view."""
    columns = COLLECTOR_COLUMNS + REVIEW_COLUMNS
    if not os.path.exists(APPROVED_FILE):
        return pd.DataFrame(columns=columns)
    df = pd.read_csv(APPROVED_FILE, dtype=str, keep_default_na=False)
    for column in columns:
        if column not in df.columns:
            df[column] = ""
    df["featured"] = df["featured"].str.lower().isin(["true", "1", "yes"])
    return df[columns]


def save_approved(df):
    """Write the approved list to output/approved_resources.csv."""
    os.makedirs(os.path.dirname(APPROVED_FILE), exist_ok=True)
    df.to_csv(APPROVED_FILE, index=False)


def build_review_table():
    """
    Combine everything the collector found with the saved review decisions.

    Each row gets: approved (yes/no), featured (yes/no), section, date.
    Approved items that are no longer in the latest collection are kept,
    so a new collector run never wipes out earlier approvals.
    """
    collected = load_collected(file_version(COLLECTED_FILE)).copy()
    approved = load_approved()

    # Add approved items missing from the latest collection run.
    missing = approved[~approved["url"].isin(collected["url"])]
    table = pd.concat([collected, missing[COLLECTOR_COLUMNS]], ignore_index=True)
    table = table.drop_duplicates(subset="url", keep="first")

    decisions = approved.set_index("url")
    table["approved"] = table["url"].isin(decisions.index)
    table["featured"] = table["url"].map(decisions["featured"]).eq(True)
    saved_section = table["url"].map(decisions["section"])
    guessed_section = table.apply(guess_section, axis=1) if len(table) else table["url"]
    table["section"] = saved_section.where(saved_section.isin(SECTION_NAMES), guessed_section)
    table["date"] = parse_dates(table["published"])
    return table.sort_values("date", ascending=False, na_position="last").reset_index(drop=True)


def apply_review_changes(edited_rows):
    """
    Save the reviewer's decisions for the rows they could see and edit.
    Rows hidden by filters are left exactly as they were.
    """
    approved = load_approved().set_index("url")
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    for _, row in edited_rows.iterrows():
        url = row["url"]
        if row["approved"]:
            record = {column: row[column] for column in COLLECTOR_COLUMNS if column != "url"}
            record["section"] = row["section"]
            record["featured"] = bool(row["featured"])
            record["approved_at"] = approved.loc[url, "approved_at"] if url in approved.index else now
            record["image"] = approved.loc[url, "image"] if url in approved.index else ""
            approved.loc[url] = pd.Series(record)
        elif url in approved.index:
            approved = approved.drop(url)

    save_approved(approved.reset_index()[COLLECTOR_COLUMNS + REVIEW_COLUMNS].fillna(""))


def run_collector():
    """Run collect_news.py exactly as you would from the terminal."""
    try:
        result = subprocess.run(
            [sys.executable, COLLECTOR_SCRIPT],
            cwd=BASE_DIR,               # So it finds sources.csv and output/
            capture_output=True,
            text=True,
            timeout=600,
        )
        return result.returncode == 0, (result.stdout or "") + (result.stderr or "")
    except subprocess.TimeoutExpired:
        return False, "The collector took longer than 10 minutes and was stopped."


# ---------------------------------------------------------------------------
# Small formatting helpers
# ---------------------------------------------------------------------------
def plain_text(text):
    """Decode entities like &#160; and collapse extra spaces/newlines."""
    return " ".join(html.unescape(str(text or "")).split())


def clean_summary(text):
    """Remove arXiv feed boilerplate like 'arXiv:2610.1234v1 Announce Type: new Abstract:'."""
    return re.sub(r"^arXiv:\S+\s+Announce Type:\s*\S+\s+Abstract:\s*", "", plain_text(text))


def safe_url(url):
    """Only allow normal web links."""
    url = str(url or "").strip()
    return url if url.startswith(("http://", "https://")) else ""


def nice_date(value):
    """Format a date as 'Oct 13, 2026' (or empty if unknown)."""
    if pd.isna(value):
        return ""
    return f"{value:%b} {value.day}, {value.year}"


def type_label(content_type):
    """'tutorial' -> 'Tutorial'."""
    return str(content_type or "Resource").replace("_", " ").title()


def slug(name):
    """'Tutorials & Learning' -> 'tutorials-learning' (for page anchors)."""
    return "-".join("".join(c if c.isalnum() else " " for c in name.lower()).split())


def youtube_id(url):
    """Pull the video ID out of a YouTube link (or return '' if it isn't one)."""
    match = re.search(r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([\w-]{11})", str(url or ""))
    return match.group(1) if match else ""


# ---------------------------------------------------------------------------
# Preview pictures
# Most articles publish a preview image (the one social media shows when a
# link is shared, called "og:image"). We look it up for APPROVED items only
# and remember the answer in output/image_cache.json so each article's page
# is only checked once.
# ---------------------------------------------------------------------------
IMAGE_CACHE_FILE = os.path.join(BASE_DIR, "output", "image_cache.json")
IMAGE_RETRY_DAYS = 1           # Try again later if a page had no image
IMAGE_LOOKUP_VERSION = 4       # Bump to re-check pages after improving the lookup
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
# Some sites (e.g. OpenAI, MarkTechPost) block all automated visitors. For those,
# we ask Microlink, a free link-preview service that loads the page like a real
# browser. It only receives the public article link. Free use allows about 50
# lookups a day, which is plenty because every answer is cached.
USE_PREVIEW_SERVICE = True
PREVIEW_SERVICE_URL = "https://api.microlink.io/"
# Some sites only share their page with requests that look like a normal browser.
BROWSER_HEADERS = {
    "User-Agent": BROWSER_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
# The <meta> tags that hold a page's preview image, best first.
IMAGE_META_NAMES = ["og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src"]
META_TAG = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
# One attribute inside a tag: name="value", name='value' or name=value
META_ATTRIBUTE = re.compile(r"""([\w:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)""")


def find_preview_image(url):
    """Return the preview image for one article link, or '' if none is found."""
    video = youtube_id(url)
    if video:
        return f"https://i.ytimg.com/vi/{video}/hqdefault.jpg"
    try:
        response = requests.get(url, timeout=6, headers=BROWSER_HEADERS)
        page = response.text[:400000]       # The image tag is always near the top
    except requests.exceptions.RequestException:
        page = ""
    return image_from_page(url, page) or image_from_preview_service(url)


def image_from_page(url, page):
    """Find the preview image named in a page's <meta> tags."""
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
    """Backup: ask the link-preview service for the article's image."""
    if not USE_PREVIEW_SERVICE:
        return ""
    try:
        response = requests.get(PREVIEW_SERVICE_URL, params={"url": url}, timeout=20)
        image = ((response.json().get("data") or {}).get("image") or {}).get("url")
    except (requests.exceptions.RequestException, ValueError, AttributeError):
        return ""
    return safe_url(image)


def load_image_cache():
    try:
        with open(IMAGE_CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def get_preview_images(urls):
    """
    Look up preview images for a list of article links, using the cache
    where possible. Lookups run in parallel so this stays quick.
    """
    cache = load_image_cache()
    retry_before = (datetime.now() - timedelta(days=IMAGE_RETRY_DAYS)).isoformat()

    def needs_lookup(url):
        entry = cache.get(url)
        if entry is None or entry.get("v") != IMAGE_LOOKUP_VERSION:
            return True
        return not entry.get("image") and entry.get("checked", "") < retry_before

    to_fetch = [url for url in dict.fromkeys(urls) if safe_url(url) and needs_lookup(url)]
    if to_fetch:
        with ThreadPoolExecutor(max_workers=8) as pool:
            for url, image in zip(to_fetch, pool.map(find_preview_image, to_fetch)):
                cache[url] = {"image": image, "checked": datetime.now().isoformat(timespec="seconds"),
                              "v": IMAGE_LOOKUP_VERSION}
        os.makedirs(os.path.dirname(IMAGE_CACHE_FILE), exist_ok=True)
        with open(IMAGE_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=1)

    return {url: cache.get(url, {}).get("image", "") for url in urls}


# ===========================================================================
# PUBLIC NEWSLETTER VIEW
# The page itself (layout, styling, animations, filters, video player) lives
# in newsletter_component/index.html. Python gathers the approved content and
# hands it over as data.
# ===========================================================================
newsletter_page = components.declare_component(
    "applied_ai_newsletter", path=os.path.join(BASE_DIR, "newsletter_component"))

# Makes the newsletter fill the whole browser window (no Streamlit chrome).
PUBLIC_CSS = """
<style>
header[data-testid="stHeader"], [data-testid="stToolbar"], [data-testid="stSidebar"],
[data-testid="stSidebarCollapsedControl"], [data-testid="collapsedControl"],
#MainMenu, footer, [data-testid="stDecoration"], [data-testid="stStatusWidget"] { display: none !important; }
html, body, .stApp, [data-testid="stAppViewContainer"], [data-testid="stMain"], section.main {
  overflow: hidden !important; background: #f6f7fb !important; }
.block-container, [data-testid="stMainBlockContainer"] {
  max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
[data-testid="stVerticalBlock"] { gap: 0 !important; }
iframe { display: block; border: 0 !important; }
/* Pin the newsletter to the whole browser window so nothing is cut off. */
iframe[title$="applied_ai_newsletter"] { position: fixed !important; inset: 0 !important;
  width: 100vw !important; height: 100vh !important; height: 100dvh !important; z-index: 999990; }
</style>
"""


def build_newsletter_data():
    """Collect the approved items (with pictures) in the shape the page expects."""
    approved = load_approved()
    approved["date"] = parse_dates(approved["published"])
    if not approved.empty:
        approved["section"] = approved["section"].where(
            approved["section"].isin(SECTION_NAMES), approved.apply(guess_section, axis=1))
    approved = approved.sort_values("date", ascending=False, na_position="last")

    images = get_preview_images(approved["url"].tolist())

    def as_item(row):
        return {
            "title": plain_text(row["title"]),
            "description": clean_summary(row["description"]),
            "source": plain_text(row["source"]),
            "date": nice_date(row["date"]),
            "type": type_label(row["content_type"]),
            "section": row["section"],
            "sectionId": slug(row["section"]),
            "url": safe_url(row["url"]),
            # A picture link pasted by a reviewer wins over the automatic one.
            "image": safe_url(row["image"]) or images.get(row["url"], ""),
            "videoId": youtube_id(row["url"]),
        }

    # Pick the spotlight: the newest item marked "featured", otherwise the newest.
    spotlight = None
    if not approved.empty:
        marked = approved[approved["featured"]]
        top = (marked if not marked.empty else approved).iloc[0]
        spotlight = as_item(top)
        approved = approved[approved["url"] != top["url"]]

    items = [as_item(row) for _, row in approved.iterrows()]
    used_sections = {item["section"] for item in items}
    today = date.today()
    return {
        "title": NEWSLETTER_TITLE,
        "lab": LAB_NAME,
        "intro": INTRO_MESSAGE,
        "weekOf": nice_date(today - timedelta(days=today.weekday())),
        "year": today.year,
        "spotlight": spotlight,
        "items": items,
        "sections": [
            {"name": name, "id": slug(name), "subtitle": SECTIONS[name][0], "button": SECTIONS[name][2]}
            for name in SECTION_NAMES if name in used_sections
        ],
    }


def render_public_view():
    """Show the interactive newsletter page."""
    with st.spinner("Loading this week's issue..."):
        data = build_newsletter_data()
    newsletter_page(data=data, key="newsletter", default=None)
    st.markdown(PUBLIC_CSS, unsafe_allow_html=True)


def full_width(widget):
    """
    Make a Streamlit element fill its column on any Streamlit version.
    Newer versions use width="stretch"; older ones use use_container_width=True.
    """
    width_option = inspect.signature(widget).parameters.get("width")
    # Newer versions accept text widths like "stretch" (their default is text).
    if width_option is not None and isinstance(width_option.default, str):
        return {"width": "stretch"}
    return {"use_container_width": True}


# ===========================================================================
# INTERNAL CONTENT MANAGEMENT VIEW
# ===========================================================================
INTERNAL_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
.stApp { background: #f7f8fc; }
.block-container, [data-testid="stMainBlockContainer"] { max-width: 1400px; padding-top: 2.2rem; }
.ops-banner { border-radius: 16px; padding: 22px 26px; margin-bottom: 8px; color: #fff;
  background: linear-gradient(120deg, #1e1b4b, #3730a3 60%, #0f766e); font-family: 'Inter', sans-serif; }
.ops-banner .k { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; opacity: .75; font-weight: 600; }
.ops-banner .t { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin-top: 4px; }
.ops-banner .s { font-size: 14.5px; opacity: .85; margin-top: 4px; }
[data-testid="stMetric"] { background: #fff; border: 1px solid #e5e8f0; border-radius: 14px; padding: 14px 18px; }
</style>
"""


def render_login():
    """A simple password gate so only the team can open the internal view."""
    st.markdown(INTERNAL_CSS, unsafe_allow_html=True)
    _, middle, _ = st.columns([1, 1.2, 1])
    with middle:
        st.markdown("### 🔒 Applied AI Lab — Team Access")
        st.caption("This area is for the Applied AI Lab content team.")
        with st.form("login"):
            password = st.text_input("Password", type="password")
            if st.form_submit_button("Sign in", type="primary", **full_width(st.form_submit_button)):
                if password == ADMIN_PASSWORD:
                    st.session_state["is_admin"] = True
                    st.rerun()
                else:
                    st.error("Incorrect password.")
        st.markdown("[← Back to the public newsletter](./)")


def render_internal_view():
    """The team's review dashboard."""
    st.markdown(INTERNAL_CSS, unsafe_allow_html=True)
    st.markdown(
        '<div class="ops-banner"><div class="k">Internal · Content Management</div>'
        f'<div class="t">{NEWSLETTER_TITLE} — Review Desk</div>'
        '<div class="s">Collect → review → approve. Only approved items appear in the public newsletter.</div></div>',
        unsafe_allow_html=True,
    )
    if ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD:
        st.caption("⚠️ Using the default team password. Set the AI_LAB_ADMIN_PASSWORD environment variable before sharing this app.")

    # --- Step 1: Run the collector -------------------------------------------
    run_col, info_col, link_col = st.columns([1.1, 2.4, 1.2])
    with run_col:
        run_clicked = st.button("▶ Run collector", type="primary", **full_width(st.button))
    with info_col:
        if os.path.exists(COLLECTED_FILE):
            updated = datetime.fromtimestamp(file_version(COLLECTED_FILE))
            st.caption(f"Last collection: **{updated:%b %d, %Y at %I:%M %p}** · `output/ai_resources.csv`")
        else:
            st.caption("No collection yet. Click **Run collector** to fetch content.")
    with link_col:
        st.link_button("View public newsletter ↗", "./", **full_width(st.link_button))

    if run_clicked:
        with st.spinner("Running collect_news.py — fetching the latest AI content..."):
            ok, log = run_collector()
        load_collected.clear()
        st.session_state["collector_log"] = (ok, log)

    if "collector_log" in st.session_state:
        ok, log = st.session_state["collector_log"]
        (st.success if ok else st.error)(
            "Collector finished successfully." if ok else "The collector reported a problem. See the log below.")
        if not ok and "ModuleNotFoundError" in log:
            st.info("A package the collector needs is missing from the Python running this app. "
                    "Install it in a terminal, then click Run collector again:")
            st.code(f'"{sys.executable}" -m pip install -r requirements.txt', language="bash")
        with st.expander("Collector output log", expanded=not ok):
            st.code(log or "(no output)", language=None)

    table = build_review_table()
    if table.empty:
        st.info("There is nothing to review yet. Run the collector to gather content.")
        return

    # --- Summary metrics ------------------------------------------------------
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Collected resources", len(table))
    m2.metric("Approved for newsletter", int(table["approved"].sum()))
    m3.metric("Featured", int((table["approved"] & table["featured"]).sum()))
    m4.metric("Sources", table["source"].nunique())

    # --- Step 2: Filters (in the sidebar) -------------------------------------
    with st.sidebar:
        st.markdown("### Filters")
        search = st.text_input("Search titles & descriptions", placeholder="e.g. agents, healthcare")
        sources = st.multiselect("Source", sorted(table["source"].unique()))
        types = st.multiselect("Content type", sorted(table["content_type"].unique()))
        sections = st.multiselect("Newsletter section", SECTION_NAMES)
        status = st.radio("Status", ["All", "Approved", "Not yet approved"], horizontal=False)

        dated = table["date"].dropna()
        date_range = None
        if not dated.empty:
            first_day, last_day = dated.min().date(), dated.max().date()
            date_range = st.date_input("Published between", (first_day, last_day),
                                       min_value=first_day, max_value=last_day)
        include_undated = st.checkbox("Include items with unknown date", value=True)

        st.divider()
        if st.button("Sign out", **full_width(st.button)):
            st.session_state["is_admin"] = False
            st.rerun()

    view = table
    if search:
        needle = search.lower()
        view = view[view["title"].str.lower().str.contains(needle, regex=False)
                    | view["description"].str.lower().str.contains(needle, regex=False)]
    if sources:
        view = view[view["source"].isin(sources)]
    if types:
        view = view[view["content_type"].isin(types)]
    if sections:
        view = view[view["section"].isin(sections)]
    if status == "Approved":
        view = view[view["approved"]]
    elif status == "Not yet approved":
        view = view[~view["approved"]]
    if isinstance(date_range, (tuple, list)) and len(date_range) == 2:
        start, end = pd.Timestamp(date_range[0]), pd.Timestamp(date_range[1]) + pd.Timedelta(days=1)
        in_range = (view["date"] >= start) & (view["date"] < end)
        view = view[in_range | (view["date"].isna() & include_undated)]
    elif not include_undated:
        view = view[view["date"].notna()]

    # --- Step 3: Review table -------------------------------------------------
    st.subheader("All collected resources")
    st.caption(
        f"Showing **{len(view)}** of {len(table)}. Tick **Approve** to add an item to the newsletter, "
        "tick **Featured** for the top story, and adjust the **Section** if needed. "
        "Then click **Save review decisions** (save before changing filters)."
    )

    with st.form("review_form", border=False):
        edited = st.data_editor(
            view[["approved", "featured", "section", "title", "source", "date",
                  "content_type", "description", "url"]],
            hide_index=True,
            **full_width(st.data_editor),
            height=min(640, 38 * (len(view) + 1) + 4),
            column_config={
                "approved": st.column_config.CheckboxColumn("Approve", width="small"),
                "featured": st.column_config.CheckboxColumn("Featured", width="small",
                                                            help="Shown as the big story at the top"),
                "section": st.column_config.SelectboxColumn("Section", options=SECTION_NAMES,
                                                            required=True, width="medium"),
                "title": st.column_config.TextColumn("Title", width="large"),
                "source": st.column_config.TextColumn("Source", width="medium"),
                "date": st.column_config.DatetimeColumn("Published", format="MMM D, YYYY", width="small"),
                "content_type": st.column_config.TextColumn("Type", width="small"),
                "description": st.column_config.TextColumn("Description", width="large"),
                "url": st.column_config.LinkColumn("Link", display_text="Open ↗", width="small"),
            },
            disabled=["title", "source", "date", "content_type", "description", "url"],
            key="review_editor",
        )
        saved = st.form_submit_button("💾 Save review decisions", type="primary")

    if saved:
        edited = edited.copy()
        # Bring back the original date text (the editor shows a parsed date).
        edited["published"] = edited["url"].map(view.set_index("url")["published"])
        apply_review_changes(edited)
        with st.spinner("Finding preview pictures for approved items..."):
            get_preview_images(load_approved()["url"].tolist())
        st.toast("Review decisions saved. The public newsletter is updated.", icon="✅")
        st.rerun()

    # --- Step 4: Selected newsletter candidates -------------------------------
    st.divider()
    st.subheader("✅ Selected newsletter candidates")
    approved = load_approved()
    if approved.empty:
        st.info("No resources approved yet. Approved items will appear here and on the public page.")
        return

    featured_count = int(approved["featured"].sum())
    if featured_count > 1:
        st.warning(f"{featured_count} items are marked Featured. The public page shows the newest one "
                   "as the Featured Resource; the others appear in their sections.")
    elif featured_count == 0:
        st.caption("No item is marked Featured, so the newest approved item will be featured automatically.")

    counts = approved["section"].value_counts()
    st.caption(" · ".join(f"**{name}**: {counts.get(name, 0)}" for name in SECTION_NAMES))

    images = get_preview_images(approved["url"].tolist())
    approved_display = approved.assign(
        date=parse_dates(approved["published"]),
        # What the newsletter will show: the pasted link if there is one, else the automatic one.
        picture=[safe_url(custom) or images.get(url, "") for custom, url in zip(approved["image"], approved["url"])],
    ).sort_values(["featured", "date"], ascending=[False, False])

    st.caption("**No picture?** Some sites (e.g. OpenAI, MarkTechPost) block automatic lookups. "
               "Open the article, right-click its main image → *Copy Image Address*, paste it in "
               "**Custom picture link**, then click **Save pictures**. Items left blank get generated artwork.")
    with st.form("pictures_form", border=False):
        pictures = st.data_editor(
            approved_display[["picture", "image", "featured", "section", "title", "source", "date", "url"]],
            hide_index=True,
            **full_width(st.data_editor),
            column_config={
                "picture": st.column_config.ImageColumn("Picture", width="small"),
                "image": st.column_config.TextColumn("Custom picture link", width="medium",
                                                     help="Optional. Paste an image address starting with https://"),
                "featured": st.column_config.CheckboxColumn("Featured", width="small"),
                "section": "Section",
                "title": st.column_config.TextColumn("Title", width="large"),
                "source": "Source",
                "date": st.column_config.DatetimeColumn("Published", format="MMM D, YYYY"),
                "url": st.column_config.LinkColumn("Link", display_text="Open ↗"),
            },
            disabled=["picture", "featured", "section", "title", "source", "date", "url"],
            key="pictures_editor",
        )
        save_pictures = st.form_submit_button("🖼 Save pictures")

    if save_pictures:
        links = pictures.set_index("url")["image"].fillna("").astype(str).str.strip()
        bad = [link for link in links if link and not safe_url(link)]
        if bad:
            st.error("Picture links must start with http:// or https://. Nothing was saved.")
        else:
            approved["image"] = approved["url"].map(links).fillna(approved["image"])
            save_approved(approved[COLLECTOR_COLUMNS + REVIEW_COLUMNS])
            st.toast("Pictures saved. Refresh the newsletter to see them.", icon="🖼")
            st.rerun()

    st.download_button(
        "⬇ Download selected items (CSV)",
        data=approved.to_csv(index=False).encode("utf-8"),
        file_name=f"newsletter_selection_{date.today():%Y-%m-%d}.csv",
        mime="text/csv",
    )


# ===========================================================================
# MAIN: decide which view to show
# ===========================================================================
def main():
    is_admin_url = st.query_params.get("view") == "admin"
    st.set_page_config(
        page_title=f"Review Desk · {LAB_NAME}" if is_admin_url else f"{NEWSLETTER_TITLE} · {LAB_NAME}",
        page_icon="🧠",
        layout="wide",
        initial_sidebar_state="expanded" if is_admin_url else "collapsed",
    )

    if not is_admin_url:
        # Regular visitors only ever see the public newsletter.
        render_public_view()
    elif st.session_state.get("is_admin"):
        render_internal_view()
    else:
        render_login()


main()
