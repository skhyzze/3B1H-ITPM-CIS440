# The Circuit review desk

The team-only page where reviewers approve items for The Circuit and publish
them to AI Insights. It runs as a small Cloudflare Worker with its own address,
separate from the public website. Visitors to the website never see it.

## How it fits together

1. **Collect.** Every Monday, `.github/workflows/newsletter-collect.yml` runs
   `ai_brief/build_candidates.py` and commits `data/newsletter-candidates.json`.
   **Run collector** on the desk starts the same job.
2. **Review.** A reviewer opens the desk and signs in with the team password.
   They approve items, choose one Spotlight, adjust sections, and can paste a
   picture link.
3. **Publish.** **Publish to The Circuit** commits `data/newsletter.json`.
   AI Insights (`ai-insights.html`) reads that file, so the site updates as soon
   as the host redeploys (about a minute on GitHub Pages).

The Worker holds the GitHub credential. Reviewers only know the password.

| File | What it does |
| --- | --- |
| `src/worker.js` | Checks the password, keeps reviewers signed in, serves the desk, and talks to GitHub. |
| `pages/login.html`, `pages/js/login.js` | The sign-in page. |
| `pages/desk.html`, `pages/js/desk.js` | The review desk. |
| `pages/css/admin.css` | Desk styles. The pages also use the website's fonts and styles, copied in by `scripts/copy-site-assets.mjs`. |
| `wrangler.jsonc` | Cloudflare settings: the repository, branch, and public site address. |

## Set it up (once)

You need [Node.js](https://nodejs.org) 20 or newer and a Cloudflare account
(free plan is enough). Use a lab-owned account, not a personal one, so the
desk survives graduation.

1. **Make the GitHub token.** The repository owner creates a
   [fine-grained token](https://github.com/settings/personal-access-tokens/new)
   with access to only this repository and these permissions:
   **Contents: Read and write** and **Actions: Read and write**.
2. **Install and sign in to Cloudflare:**
   ```bash
   cd circuit-admin
   npm install
   npx wrangler login
   ```
3. **Store the three secrets.** Each command asks for the value:
   ```bash
   npx wrangler secret put ADMIN_PASSWORD   # the team password; make it long
   npx wrangler secret put SESSION_SECRET   # any long random text
   npx wrangler secret put GITHUB_TOKEN     # the token from step 1
   ```
4. **Deploy:**
   ```bash
   npm run deploy
   ```
   Wrangler prints the desk's address, for example
   `https://circuit-review-desk.<account>.workers.dev`. Share it only with the team.

## Day to day

- **Change the password:** `npx wrangler secret put ADMIN_PASSWORD`. Then change
  `SESSION_SECRET` too if you want to sign everyone out.
- **Site styles changed:** run `npm run deploy` again so the desk picks up the
  new fonts and styles.
- **The website moves to its new host:** update `PUBLIC_SITE_URL` in
  `wrangler.jsonc` and deploy. If the repository moves, update `GITHUB_REPO`.
  The new host must rebuild the site when `data/newsletter.json` changes on
  `main`, the way GitHub Pages does now.
- **Custom address:** in Cloudflare, add a custom domain to the Worker (for
  example `desk.yourlab.edu`) once the lab has a domain on Cloudflare.

## Try it on your computer

```bash
cd circuit-admin
cp .dev.vars.example .dev.vars   # then fill in the three values
npm run dev                      # opens on http://localhost:8787
```

With a real `GITHUB_TOKEN`, publishing from your computer changes the live
site, the same as the deployed desk.

## Security notes

- The password is checked on the server. A wrong password waits one second
  before answering, to slow down guessing. Use a long password.
- The sign-in cookie lasts 12 hours. Page scripts cannot read it, and other
  websites cannot send it.
- The desk pages are marked `noindex` and cannot be embedded in other sites.
- The public website does not contain the desk: `npm run build` skips
  `circuit-admin/`, and `_config.yml` keeps GitHub Pages from serving it.
