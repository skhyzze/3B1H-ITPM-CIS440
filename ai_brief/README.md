# Quinnipiac Applied AI Lab — Newsletter Collector (Prototype 1)

A small Python program that automatically collects **recent AI content**
(news, tutorials, research, tools, and educational resources) from a list of
trusted RSS feeds, then saves it to a spreadsheet so a **human can review it**
and choose the best items for a weekly newsletter.

> This prototype **does not publish or email anything**. It only collects
> content for a person to review. That is by design.

---

## How The Circuit is published

The Circuit has one public page: **AI Insights** (`ai-insights.html`) on the
lab website. Reviewers use the team-only **review desk** in `circuit-admin/`,
a Cloudflare Worker with its own address and a team password. The desk is not
part of the website. Neither needs Python running on anyone's computer.

1. **Collect.** Every Monday, the GitHub Action
   `.github/workflows/newsletter-collect.yml` runs `build_candidates.py`.
   It uses `collect_news.py` to read the feeds, guesses a section, finds a
   preview picture for each item, and commits
   `data/newsletter-candidates.json`. **Run collector** on the desk starts it
   on demand.
2. **Review.** Sign in to the desk with the team password. Tick **Approve**,
   choose one **Spotlight**, adjust **Section**, and paste a **Custom picture
   link** if an item has no picture.
3. **Publish.** Click **Publish to The Circuit**. The desk commits
   `data/newsletter.json`, and AI Insights shows it once the site redeploys
   (about a minute on GitHub Pages).

If two people publish at the same time, the second one is told to reload
instead of overwriting the first. Setup steps for the desk are in
`circuit-admin/README.md`.

The Streamlit app (`app.py`) and its page (`newsletter_component/`) are the
earlier local version of the desk. The website does not use them.

---

## Project files

| File | What it is |
|------|------------|
| `sources.csv` | The list of trusted sources (name, feed URL, content type). Edit this to add/remove sources. |
| `collect_news.py` | The main program. Reads the sources, collects content, and saves the results. |
| `build_candidates.py` | Runs the collector and writes `data/newsletter-candidates.json` for the review desk. The GitHub Action runs it. |
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
