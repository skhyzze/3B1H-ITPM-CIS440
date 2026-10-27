# Quinnipiac Applied AI Lab — Newsletter Collector (Prototype 1)

A small Python program that automatically collects **recent AI content**
(news, tutorials, research, tools, and educational resources) from a list of
trusted RSS feeds, then saves it to a spreadsheet so a **human can review it**
and choose the best items for a weekly newsletter.

> This prototype **does not publish or email anything**. It only collects
> content for a person to review. That is by design.

---

## Project files

| File | What it is |
|------|------------|
| `sources.csv` | The list of trusted sources (name, feed URL, content type). Edit this to add/remove sources. |
| `collect_news.py` | The main program. Reads the sources, collects content, and saves the results. |
| `requirements.txt` | The Python packages the program needs. |
| `output/ai_resources.csv` | The results (created when you run the program). |
| `README.md` | This file. |

---

## How to run it

1. **Install the required packages** (only needed once):
   ```bash
   pip3 install -r requirements.txt
   ```
2. **Run the program:**
   ```bash
   python3 collect_news.py
   ```
3. **Open the results:** `output/ai_resources.csv` (opens in Excel, Numbers,
   or Google Sheets).

---

## What the program does, step by step

1. Reads the trusted sources from `sources.csv`.
2. Downloads each source's RSS feed **safely** — a broken feed or connection
   error is reported and skipped, and never crashes the program.
3. Keeps six fields for each item: **title, source, publication date,
   short description, URL, content type**.
4. Keeps only content from the **last 7 days** (when a date is available).
5. **Removes duplicate** articles/links (same URL or same title).
6. **Sorts newest first.**
7. Saves everything to `output/ai_resources.csv`.
8. Prints a **summary** of how many items came from each source.

You can change the behavior at the top of `collect_news.py`:
`DAYS_TO_KEEP` (default 7) and `MAX_ITEMS_PER_SOURCE` (default 15, so a busy
feed like arXiv can't flood the list).

---

## Sources used

All sources are real, well-known public RSS feeds. Notes from testing:

- **Working reliably:** MIT Technology Review AI, Google AI Blog, Google
  DeepMind, OpenAI News, Hugging Face Blog, Machine Learning Mastery,
  MarkTechPost, TechCrunch AI, arXiv cs.AI.
- **Low-frequency (often 0 recent items — this is normal, not an error):**
  Berkeley AI Research (BAIR) and The Gradient publish infrequently, so they
  often have nothing in the last 7 days.
- **Occasionally rate-limited:** VentureBeat AI sometimes returns
  "429 Too Many Requests". The program reports this and continues. Re-running
  later usually succeeds.

- **Added Oct 2026 to fill gaps:** applied AI / use cases (MIT News AI, AWS
  Machine Learning Blog, NVIDIA Blog), tools (GitHub Blog AI & ML, Simon
  Willison's Weblog, Latent Space), research (Microsoft Research, Google
  Research), news (The Verge AI, Wired AI, IEEE Spectrum AI), educational
  (Import AI), and videos via YouTube channel RSS (IBM Technology, Two Minute
  Papers, 3Blue1Brown). The YouTube channels post less often, so some weeks
  they will have 0 recent videos.
- **content_type values the app understands:** `news`, `research`,
  `tutorial`, `educational`, `tool`, `video`, `use case`. These decide which
  newsletter section an item goes to by default.

If a source ever stops providing a working RSS feed, the program will clearly
say so in its output rather than inventing content.

---

## Important design choices (for your supervisors)

- **Human-in-the-loop:** nothing is auto-published or emailed.
- **Fails safely:** one broken feed never stops the whole run.
- **Honest about sources:** only real feeds are used; broken ones are reported.
- **Readable code:** clear functions and plain-English comments throughout
  `collect_news.py`, so each step can be explained easily.

---

## Newsletter app (Streamlit)

`app.py` adds a web app on top of the collector. It has two views:

| View | URL | Who it's for |
|------|-----|--------------|
| **Public newsletter** | `http://localhost:8501` | Students and faculty. Shows **only approved** items. |
| **Internal review desk** | `http://localhost:8501/?view=admin` | The Applied AI Lab team (password protected). |

**Run it:**
```bash
pip3 install -r requirements.txt
streamlit run app.py
```

Default team password: `appliedai`. Change it before sharing:
```bash
export AI_LAB_ADMIN_PASSWORD="your-password"
streamlit run app.py
```

**Flow:** sources → `collect_news.py` → `output/ai_resources.csv` → review desk
(approve / feature / pick section) → `output/approved_resources.csv` → public newsletter.

Approvals are stored separately in `output/approved_resources.csv`, so
re-running the collector never erases them.

**The public page** is built by `newsletter_component/index.html` (layout,
styling, filters, search, saved list, video player). `app.py` sends it the
approved items as data.

**Pictures:** for approved items, the app looks up each article's preview
image (the one social media shows for a shared link) and remembers it in
`output/image_cache.json`. YouTube videos use their thumbnails. Items with
no picture get generated artwork in their section's color.
