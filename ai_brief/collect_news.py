"""
Quinnipiac University Applied AI Lab - Newsletter Collector (Prototype 1)
========================================================================

WHAT THIS PROGRAM DOES
----------------------
It gathers recent AI-related content (news, tutorials, research, tools,
educational resources) from a list of trusted RSS feeds so that a HUMAN
can review the results and pick the best items for a weekly newsletter.

The steps are:
  1. Read a list of trusted sources from  sources.csv
  2. Download each source's RSS feed (safely, without crashing on errors)
  3. Extract the fields we care about: title, source, date, description,
     URL, and content type
  4. Keep only content from the last 7 days (when a date is available)
  5. Remove duplicate articles/links
  6. Sort so the newest content is first
  7. Save everything to  output/ai_resources.csv
  8. Print a short summary of how many items came from each source

IMPORTANT: This program does NOT publish or email anything. It only
collects and saves content for a person to review.

HOW TO RUN
----------
  1. Install the required packages (only needed once):
         pip3 install -r requirements.txt
  2. Run the program:
         python3 collect_news.py
"""

# ---------------------------------------------------------------------------
# Imports: these are the tools (libraries) the program relies on.
# ---------------------------------------------------------------------------
import csv                      # Read the sources file and write the output file
import os                       # Create the output/ folder if it is missing
from datetime import datetime, timedelta, timezone  # Work with dates/times

import requests                 # Download the feed contents from the internet
import feedparser               # Understand RSS/Atom feeds and their dates


# ---------------------------------------------------------------------------
# Settings: change these values if you want different behavior.
# ---------------------------------------------------------------------------
SOURCES_FILE = "sources.csv"                 # Where the trusted sources live
OUTPUT_FILE = "output/ai_resources.csv"      # Where results are saved
DAYS_TO_KEEP = 7                             # Only keep content this recent
MAX_ITEMS_PER_SOURCE = 15                     # Cap per feed so one source (e.g.
                                             # arXiv) can't flood the list
REQUEST_TIMEOUT = 15                         # Seconds to wait before giving up
# A browser-like label so feeds are less likely to block our request.
USER_AGENT = "QU-AppliedAILab-NewsletterBot/1.0 (educational prototype)"


# ---------------------------------------------------------------------------
# STEP 1: Read the list of trusted sources from the CSV file.
# ---------------------------------------------------------------------------
def load_sources(path):
    """
    Read sources.csv and return a list of sources.

    Each source is a small dictionary like:
        {"name": "OpenAI News", "url": "https://...", "content_type": "news"}

    The CSV file must have a header row with columns:
        name, url, content_type
    """
    sources = []

    # "with open(...)" makes sure the file is closed automatically afterward.
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)  # Reads each row into a dictionary by header
        for row in reader:
            # .strip() removes accidental spaces around the values.
            name = row.get("name", "").strip()
            url = row.get("url", "").strip()
            content_type = row.get("content_type", "").strip()

            # Skip blank or incomplete rows instead of crashing on them.
            if not name or not url:
                continue

            sources.append({
                "name": name,
                "url": url,
                "content_type": content_type or "unknown",
            })

    return sources


# ---------------------------------------------------------------------------
# STEP 2: Download one feed safely (never crash the whole program).
# ---------------------------------------------------------------------------
def fetch_feed(url):
    """
    Download the raw feed text from a URL.

    Returns the feed text on success, or None if anything goes wrong
    (bad link, no internet, server error, timeout, etc.). We catch the
    error here so one broken feed does not stop the entire program.
    """
    try:
        response = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,           # Don't hang forever
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()            # Raise an error for 404/500/etc.
        return response.text
    except requests.exceptions.RequestException as error:
        # We report the problem but keep going with the other sources.
        print(f"   !! Could not download feed: {error}")
        return None


# ---------------------------------------------------------------------------
# Helper: turn a feed entry's date into a real datetime we can compare.
# ---------------------------------------------------------------------------
def get_entry_date(entry):
    """
    Try to read the publication date from a single feed entry.

    feedparser converts many messy date formats into a "time struct".
    We look at the published date first, then the updated date as a backup.
    Returns a timezone-aware datetime, or None if no date is available.
    """
    time_struct = entry.get("published_parsed") or entry.get("updated_parsed")
    if not time_struct:
        return None

    # time_struct[:6] = (year, month, day, hour, minute, second).
    # We treat feed times as UTC so comparisons are consistent.
    return datetime(*time_struct[:6], tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Helper: decide if an item is recent enough to keep.
# ---------------------------------------------------------------------------
def is_recent(entry_date, days=DAYS_TO_KEEP):
    """
    Return True if entry_date is within the last `days` days.

    If we could not find a date (entry_date is None), we return True so we
    don't accidentally throw away good content just because it lacked a date.
    A human reviewer can still judge it later.
    """
    if entry_date is None:
        return True

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return entry_date >= cutoff


# ---------------------------------------------------------------------------
# Helper: shorten and clean up a description so the CSV stays readable.
# ---------------------------------------------------------------------------
def clean_description(text, max_length=300):
    """
    Remove HTML tags and extra whitespace, then shorten long descriptions.
    """
    if not text:
        return ""

    # Remove anything that looks like an HTML tag, e.g. <p> or <a href="...">.
    result = ""
    inside_tag = False
    for char in text:
        if char == "<":
            inside_tag = True
        elif char == ">":
            inside_tag = False
        elif not inside_tag:
            result += char

    # Collapse repeated spaces/newlines into single spaces.
    result = " ".join(result.split())

    # Trim to a reasonable length and add "..." if we cut it off.
    if len(result) > max_length:
        result = result[:max_length].rstrip() + "..."

    return result


# ---------------------------------------------------------------------------
# STEP 3 + 4: Read the entries from one downloaded feed and keep recent ones.
# ---------------------------------------------------------------------------
def collect_from_source(source):
    """
    Given one source (name, url, content_type), download and parse its feed.

    Returns a list of item dictionaries, each with the fields we want:
        title, source, published, description, url, content_type
    Only items from the last 7 days (when a date is present) are returned.
    """
    print(f" - {source['name']}")

    feed_text = fetch_feed(source["url"])
    if feed_text is None:
        return []  # Download failed; already reported inside fetch_feed().

    # feedparser reads the text and gives us a structured object.
    parsed = feedparser.parse(feed_text)

    # feedparser sets .bozo = 1 when the feed looks malformed. It can often
    # still recover some entries, so we warn but keep going.
    if parsed.bozo and not parsed.entries:
        print("   !! This feed could not be read (no usable entries found).")
        return []

    items = []
    for entry in parsed.entries:
        # Stop once we have enough from this one source (feeds list newest
        # items first, so these are the most recent ones).
        if len(items) >= MAX_ITEMS_PER_SOURCE:
            break

        entry_date = get_entry_date(entry)

        # Only keep recent content.
        if not is_recent(entry_date):
            continue

        # Format the date as plain text for the CSV, or leave a note if missing.
        if entry_date:
            published_text = entry_date.strftime("%Y-%m-%d %H:%M UTC")
        else:
            published_text = "unknown"

        items.append({
            "title": entry.get("title", "").strip(),
            "source": source["name"],
            "published": published_text,
            "description": clean_description(entry.get("summary", "")),
            "url": entry.get("link", "").strip(),
            "content_type": source["content_type"],
            # Kept privately for sorting; not written to the CSV.
            "_date": entry_date,
        })

    print(f"   found {len(items)} recent item(s)")
    return items


# ---------------------------------------------------------------------------
# STEP 5: Remove duplicate articles/links.
# ---------------------------------------------------------------------------
def remove_duplicates(items):
    """
    Remove items that share the same URL or the same title.

    Some stories appear in more than one feed, so we keep only the first
    time we see a given link or headline.
    """
    seen_urls = set()
    seen_titles = set()
    unique_items = []

    for item in items:
        # Lowercase so "AI News" and "ai news" count as the same title.
        url_key = item["url"].lower()
        title_key = item["title"].lower()

        if url_key in seen_urls or (title_key and title_key in seen_titles):
            continue  # Already have this one; skip it.

        if url_key:
            seen_urls.add(url_key)
        if title_key:
            seen_titles.add(title_key)
        unique_items.append(item)

    return unique_items


# ---------------------------------------------------------------------------
# STEP 6: Sort so the newest content is first.
# ---------------------------------------------------------------------------
def sort_newest_first(items):
    """
    Sort items by date, newest first. Items without a date go to the end.
    """
    # A very old fallback date is used for items that have no date, so they
    # sort to the bottom instead of causing an error.
    oldest_possible = datetime.min.replace(tzinfo=timezone.utc)
    return sorted(
        items,
        key=lambda item: item["_date"] or oldest_possible,
        reverse=True,  # reverse=True means largest (newest) date first
    )


# ---------------------------------------------------------------------------
# STEP 7: Save the results to output/ai_resources.csv.
# ---------------------------------------------------------------------------
def save_to_csv(items, path):
    """
    Write all items to a CSV file, creating the output/ folder if needed.
    """
    # Make sure the folder (e.g. "output") exists before writing into it.
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)

    # These are the columns, in the order they appear in the CSV.
    columns = ["title", "source", "published", "description", "url", "content_type"]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for item in items:
            # Write only the public columns (skip the private "_date" helper).
            writer.writerow({column: item[column] for column in columns})


# ---------------------------------------------------------------------------
# STEP 8: Print a short summary of how many items came from each source.
# ---------------------------------------------------------------------------
def print_summary(items, total_sources):
    """
    Show a per-source count and the overall total after cleaning up.
    """
    # Count how many final items belong to each source.
    counts = {}
    for item in items:
        counts[item["source"]] = counts.get(item["source"], 0) + 1

    print("\n" + "=" * 55)
    print("SUMMARY (after removing duplicates and old items)")
    print("=" * 55)

    if counts:
        # Show the busiest sources first.
        for source_name, count in sorted(counts.items(), key=lambda pair: pair[1], reverse=True):
            print(f"  {count:>3}  {source_name}")
    else:
        print("  No items were collected.")

    print("-" * 55)
    print(f"  Sources checked : {total_sources}")
    print(f"  Total items kept: {len(items)}")
    print("=" * 55)


# ---------------------------------------------------------------------------
# The main function ties all the steps together in order.
# ---------------------------------------------------------------------------
def main():
    print("Quinnipiac Applied AI Lab - Newsletter Collector")
    print("Collecting recent AI content for human review...\n")

    # STEP 1: Load the trusted sources.
    try:
        sources = load_sources(SOURCES_FILE)
    except FileNotFoundError:
        print(f"ERROR: Could not find '{SOURCES_FILE}'. "
              "Make sure it is in the same folder as this program.")
        return

    if not sources:
        print(f"ERROR: '{SOURCES_FILE}' has no usable sources.")
        return

    print(f"Reading from {len(sources)} source(s):")

    # STEPS 2-4: Collect recent items from every source.
    all_items = []
    for source in sources:
        all_items.extend(collect_from_source(source))

    # STEP 5: Remove duplicates.
    all_items = remove_duplicates(all_items)

    # STEP 6: Sort newest first.
    all_items = sort_newest_first(all_items)

    # STEP 7: Save to the output CSV.
    save_to_csv(all_items, OUTPUT_FILE)
    print(f"\nSaved {len(all_items)} item(s) to '{OUTPUT_FILE}'.")

    # STEP 8: Print the summary.
    print_summary(all_items, len(sources))

    print("\nDone. A human should now review the CSV and choose the best items.")


# This line means: only run main() when the file is run directly
# (for example: python3 collect_news.py), not when it is imported elsewhere.
if __name__ == "__main__":
    main()
