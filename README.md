# Applied AI Lab

Static website for the Quinnipiac Applied AI Lab. The pages are HTML, CSS, and vanilla JavaScript. A separate Python tool in `ai_brief/` collects and reviews newsletter items.

## Pages

Page HTML stays at the repo root so the public URLs do not change. The shared header and footer live once, in `src/partials/header.html` and `src/partials/footer.html`. Each page also contains that markup so a browser pointed at the repo root can show it. The header carries `data-nav-current` (`home`, `industry`, `fellowship`, `outcomes`, `events`, `insights`, or empty on the 404 page). The build reads that and refreshes the header and footer from the partials.

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

Preview the built site with `npm run dev`, or open the pages at the repo root. Both include the shared header and footer.

```bash
npm run dev
```

That builds `dist/` and serves it at `http://127.0.0.1:8765/`. It rebuilds when a source file changes. If port 8765 is taken, set `PORT` to a free port.

The VS Code Live Server setting in `.vscode/settings.json` uses port **5501**. That file is local and is not committed. Point it at `dist/` after `npm run build`, not at the repo root.

The newsletter tool has its own steps in `ai_brief/README.md`.

## Deployment

Publish the `dist/` directory, not the repo root. The root HTML is the source. The minified CSS and JavaScript exist only after the build.

- Publish directory: `dist/`
- Build command: `npm run build`
- Local preview: `npm run dev`
- Public URL: TODO. Set `SITE_URL` when this is known. See below.
- Host: TODO
- `og:image`: TODO. Each page already has `og:title` and `og:description`. Add `og:image` when a share image path is available.

`npm run build` writes minified, content-hashed CSS and JavaScript into `dist/` and stitches the header and footer into each page. `.github/workflows/build.yml` runs that build, checks that every built page has a header and footer and no leftover include marker, and uploads `dist` as an artifact. Nothing in the repo deploys that artifact yet.

The GitHub Action in `.github/workflows/lab-content-sync.yml` only commits approved Microsoft Lists snapshots into `data/cms-*.json`. It does not publish the HTML.

### Site URL

`SITE_URL` is an environment variable. Leave it empty for local preview. Set it for a publish build.

- Custom domain at the host root: `SITE_URL=https://lab.example.edu`
- Site under a repository path, such as a GitHub project site: `SITE_URL=https://user.github.io/3B1H-ITPM-CIS440`

When `SITE_URL` is set, the build adds a canonical link on each page, writes `dist/sitemap.xml` and `dist/robots.txt`, and rewrites `404.html` asset and page links to root-relative paths. The sitemap lists public pages only. It skips `404.html`, any page with `noindex`, and Industry Partners while `showIndustryPartners` is false. If `SITE_URL` includes a path after the host, that path is prefixed onto every root-relative link, including the 404 assets.

There is no `CNAME` file. The workflows do not configure GitHub Pages. `build.yml` only uploads `dist` as an artifact named `site`.

Crawlers read `robots.txt` from the host root. On a project site the file is served under the repository path, so it does not control `github.io`. A custom domain does use the file the build writes.

### Before launch

- Remove `noindex` on Fellowship (`fellowship.html`, next to the comment `remove when client copy is confirmed`) once the client copy is in.
- Fill or remove the placeholders listed below. Add `data-show-unfinished` to `<html>` to preview them, and remove that attribute before publishing.
- Turn on `showIndustryPartners` in `js/config.js` if Industry Partners should appear in the nav, and rebuild.
- Set `SITE_URL` to the real public address.
- Add `og:image` when a share image path is available.
- Ask the Worker owner to allow the production domain and to set rate limits. The Worker source is not in this repo.
- Replace the newsletter subscribe endpoint with an Apps Script URL that returns JSON and sends CORS headers. The current request uses `mode: 'no-cors'`, so the page cannot tell whether a signup succeeded.

Placeholder copy, with the current file and line:

- `fellowship.html` 52 hero lead; 54 Become a Fellow (the pathway section is hidden); 62, 64, 65 console lines for the hidden sections; 66 pending confirmation; 74 the about section; 125 and 140 candidate intro and caption; 144 and 160 eligibility and commitment cards; 169 pending note; 173 the skills section; 262 the pathway section.
- `industry.html` 71–76 collaboration descriptions; 82 the partners section; 104 the spotlight; 122–126 pathway descriptions; 132 the partner call to action.
- `event.html` 68 design preview; 84 sample-listings note; 103 past-events message (remove when a real past event is added); 105 past sample card. Upcoming sample cards are built in the page script and stay hidden unless `data-show-unfinished` is set.
- `index.html` 326 Computing Resources; 385 the public email and phone sentence; the contact frame caption that tells the team a photograph can replace the frame; image-slot labels in the hero, lab, community, and contact frames.
- `studentoutcomes.html` 163, 164, and 166 frame labels; 265 and 274 `IMAGE COMING SOON`; the “coming soon” project links use `.cis-pending`.
- `data/cms-fellows.json` 23 and 25, Vivian Etim’s project line and bio. The fellowship script hides those two when it draws her card.

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
