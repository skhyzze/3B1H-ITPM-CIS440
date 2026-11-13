# Applied AI Lab

Static website for the Quinnipiac Applied AI Lab. The pages are HTML, CSS, and vanilla JavaScript. A separate Python tool in `ai_brief/` collects and reviews newsletter items.

## Pages

HTML stays at the repo root so the public URLs do not change.

| Page | HTML | Page CSS | Scripts and content |
| --- | --- | --- | --- |
| Home | `index.html` | `css/pages/index.css` | `js/site.js`, `js/index.js`, `js/chatbot.js` |
| Fellowship Pathway | `fellowship.html` | `css/pages/fellowship.css` | `js/fellowship.js`. Fellows load from `data/cms-fellows.json`. |
| Industry Partners | `industry.html` | `css/pages/industry.css` | Shared scripts only. |
| Events | `event.html` | `css/pages/event.css` | Events load from `data/cms-events.json`. |
| Student Outcomes | `studentoutcomes.html` | Shared CSS, plus a style block in the page | Outcomes load from `data/cms-projects.json`. |
| AI Insights (The Circuit) | `ai-insights.html` | `css/pages/ai-insights.css` | `js/ai-insights.js` and `ai_brief/static-newsletter-data.js`. |
| Page not found | `404.html` | `css/pages/industry.css` | Same industry stylesheet as Industry Partners. |

Each page loads at most four stylesheets:

- `css/shared/tokens.css` — palette, type, spacing, dark-mode variables, print
- `css/shared/base.css` — reset, header, footer, buttons, and shared cards
- one file in `css/pages/`
- `css/shared/theme.css` — circuit theme, home motion, and the chatbot

Student Outcomes has no page stylesheet, so it loads the three shared files. `404.html` uses `css/pages/industry.css`.

`js/config.js` loads before the page scripts and holds the chatbot and newsletter endpoint URLs. `fonts/` and `images_icons/` stay at the repo root.

## Run locally

Any static file server works. From the repo root:

```bash
py -3 -m http.server 8765
```

Then open `http://127.0.0.1:8765/`.

The VS Code Live Server setting in `.vscode/settings.json` uses port **5501**. That file is local and is not committed.

The newsletter tool has its own steps in `ai_brief/README.md`.

## Deployment

The repo does not name a public host or base URL. The GitHub Action in `.github/workflows/lab-content-sync.yml` only commits approved Microsoft Lists snapshots into `data/cms-*.json`. It does not publish the HTML.

Host and base URL still need to be filled in:

- Host:
- Base URL:

## Updating content

- Events, fellows, and student outcomes come from `data/cms-events.json`, `data/cms-fellows.json`, and `data/cms-projects.json`. The Microsoft Lists sync workflow writes those files. The pages also read the copies published from the GitHub account named in Accounts and handoff.
- The newsletter comes from the tool in `ai_brief/`. `collect_news.py` gathers items, the Streamlit review desk approves them, and `ai_brief/static-newsletter-data.js` is what AI Insights shows.

## Accounts and handoff

These accounts are personal or unnamed. Move them to lab-owned accounts before the current students graduate. The URLs themselves were left where the pages already use them.

| What | Account | Where it is used |
| --- | --- | --- |
| Site chatbot | Personal Cloudflare Workers hostname `tan-gurpinar.workers.dev` | `js/config.js` (`chatEndpoint`). `js/chatbot.js` reads it. |
| Fellows, events, and outcomes feeds | Personal GitHub account `skhyzze`, repo `3B1H-ITPM-CIS440` | Fetch URLs in `js/fellowship.js`, `event.html`, and `studentoutcomes.html`. Not moved. |
| Circuit subscribe form | Google Apps Script. The Google account is not named in the repo. | `js/config.js` (`newsletterSubscribeUrl`) |
| Circuit likes | Google Apps Script. The Google account is not named in the repo. | `js/config.js` (`newsletterLikesUrl`) |
| Outcomes submission form | Quinnipiac SharePoint user `hjbugai_quinnipiac_edu` | `studentoutcomes.html` |
| Microsoft Lists sync | The account that sends the `lab-content-sync` repository dispatch is not named. The workflow commits as `github-actions[bot]`. | `.github/workflows/lab-content-sync.yml` |
| Newsletter preview images | Public Microlink API (`api.microlink.io`). No key is stored in the repo. | `ai_brief/app.py` |

Sprint 1 page owners are in `CONTRIBUTING.md`.
