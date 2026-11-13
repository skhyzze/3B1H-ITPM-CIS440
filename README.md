# Applied AI Lab

Static website for the Quinnipiac Applied AI Lab. The pages are HTML, CSS, and vanilla JavaScript. A separate Python tool in `ai_brief/` collects and reviews newsletter items.

## Pages

Page HTML stays at the repo root so the public URLs do not change. The shared header and footer live once, in `src/partials/header.html` and `src/partials/footer.html`. Each page pulls them in with `<!-- @include header -->` and `<!-- @include footer -->`. The header marker can name the current page, for example `<!-- @include header current=fellowship -->`, which sets `aria-current="page"` and the logo link.

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

Preview the built site. The pages at the repo root still contain the include markers, so a server pointed at the raw files will not show the header or footer.

```bash
npm run dev
```

That builds `dist/` and serves it at `http://127.0.0.1:8765/`. It rebuilds when a source file changes. If port 8765 is taken, set `PORT` to a free port.

The VS Code Live Server setting in `.vscode/settings.json` uses port **5501**. That file is local and is not committed. Point it at `dist/` after `npm run build`, not at the repo root.

The newsletter tool has its own steps in `ai_brief/README.md`.

## Deployment

Publish the `dist/` directory, not the repo root. The root HTML is the source. It still has include markers, and the minified CSS and JavaScript exist only after the build.

- Publish directory: `dist/`
- Build command: `npm run build`
- Local preview: `npm run dev`
- Public URL: TODO
- Host: TODO

`npm run build` writes minified, content-hashed CSS and JavaScript into `dist/` and stitches the header and footer into each page. `.github/workflows/build.yml` runs that build, checks that every built page has a header and footer and no leftover include marker, and uploads `dist` as an artifact. Nothing in the repo deploys that artifact yet.

The GitHub Action in `.github/workflows/lab-content-sync.yml` only commits approved Microsoft Lists snapshots into `data/cms-*.json`. It does not publish the HTML.

## Updating content

- Events, fellows, and student outcomes come from `data/cms-events.json`, `data/cms-fellows.json`, and `data/cms-projects.json`. The Microsoft Lists sync workflow writes those files, and the pages fetch them from the same site.
- The newsletter comes from the tool in `ai_brief/`. `collect_news.py` gathers items, the Streamlit review desk approves them, and `ai_brief/static-newsletter-data.js` is what AI Insights shows.

## Accounts and handoff

These accounts are personal or unnamed. Move them to lab-owned accounts before the current students graduate. The URLs themselves were left where the pages already use them.

| What | Account | Where it is used |
| --- | --- | --- |
| Site chatbot | Personal Cloudflare Workers hostname `tan-gurpinar.workers.dev` | `js/config.js` (`chatEndpoint`). `js/chatbot.js` reads it. |
| Fellows, events, and outcomes feeds | This repo, `data/cms-*.json` | `js/fellowship.js`, `event.html`, and `studentoutcomes.html` |
| Circuit subscribe form | Google Apps Script. The Google account is not named in the repo. | `js/config.js` (`newsletterSubscribeUrl`) |
| Circuit likes | Google Apps Script. The Google account is not named in the repo. | `js/config.js` (`newsletterLikesUrl`) |
| Outcomes submission form | Quinnipiac SharePoint user `hjbugai_quinnipiac_edu` | `studentoutcomes.html` |
| Microsoft Lists sync | The account that sends the `lab-content-sync` repository dispatch is not named. The workflow commits as `github-actions[bot]`. | `.github/workflows/lab-content-sync.yml` |
| Newsletter preview images | Public Microlink API (`api.microlink.io`). No key is stored in the repo. | `ai_brief/app.py` |

Sprint 1 page owners are in `CONTRIBUTING.md`.
