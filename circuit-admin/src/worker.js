/**
 * The Circuit review desk: Cloudflare Worker
 * ==========================================
 *
 * A small server that sits apart from the public website. It:
 *   - checks the team password and keeps reviewers signed in with a cookie
 *   - only serves the desk page (desk.html) to signed-in reviewers
 *   - reads and publishes The Circuit through GitHub's API
 *   - starts the weekly collector (.github/workflows/newsletter-collect.yml)
 *
 * The GitHub credential lives in a Worker secret (GITHUB_TOKEN). Reviewers
 * never see it; they only know the team password (ADMIN_PASSWORD).
 *
 * Settings (wrangler.jsonc "vars"): GITHUB_REPO, GITHUB_BRANCH,
 *   COLLECT_WORKFLOW, PUBLIC_SITE_URL, and optionally GITHUB_API_URL
 *   (defaults to https://api.github.com; tests point it at a fake server)
 * Secrets (wrangler secret put NAME, or .dev.vars locally):
 *   ADMIN_PASSWORD, SESSION_SECRET, GITHUB_TOKEN
 *
 * Routes:
 *   GET  /              the desk (signed in) or a redirect to /login
 *   GET  /login         the sign-in page
 *   POST /api/login     { password } -> sets the session cookie
 *   POST /api/logout    clears the session cookie
 *   GET  /api/data      the published issue and the latest candidates
 *   POST /api/publish   { newsletter, sha } -> commits data/newsletter.json
 *   POST /api/collect   starts the collector workflow
 *   anything else       stylesheets, scripts, fonts, and the logo
 */

const SESSION_COOKIE = 'circuit_session';
const SESSION_HOURS = 12;
const NEWSLETTER_PATH = 'data/newsletter.json';
const CANDIDATES_PATH = 'data/newsletter-candidates.json';
const MAX_NEWSLETTER_BYTES = 900000;
const MAX_ITEMS = 300;

const SECURITY_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin'
};

export default {
  async fetch(request, env) {
    try {
      return withSecurityHeaders(await route(request, env));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(json({ error: 'Something went wrong on the server. Try again.' }, 500));
    }
  }
};

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith('/api/')) return api(request, env, path);

  const signedIn = await hasSession(request, env);
  if (path === '/' || path === '/desk.html') {
    return signedIn ? page(request, env, '/desk.html') : redirect(url, '/login');
  }
  if (path === '/login' || path === '/login.html') {
    return signedIn ? redirect(url, '/') : page(request, env, '/login.html');
  }
  // Only the two pages above are HTML. Everything else is a stylesheet, script, font, or image.
  if (path.endsWith('.html')) return new Response('Not found', { status: 404 });
  return env.ASSETS.fetch(request);
}

// ---- API ----------------------------------------------------------------
async function api(request, env, path) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.GITHUB_TOKEN) {
    return json({ error: 'The desk is not set up yet. ADMIN_PASSWORD, SESSION_SECRET, and GITHUB_TOKEN must be set.' }, 500);
  }
  const isPost = request.method === 'POST';
  if (isPost && !isSameOriginJson(request)) return json({ error: 'Request refused.' }, 403);

  if (path === '/api/login' && isPost) return login(request, env);
  if (path === '/api/logout' && isPost) return logout();

  if (!(await hasSession(request, env))) return json({ error: 'Your session ended. Sign in again.' }, 401);

  if (path === '/api/data' && request.method === 'GET') return data(env);
  if (path === '/api/publish' && isPost) return publish(request, env);
  if (path === '/api/collect' && isPost) return collect(env);
  return json({ error: 'Not found.' }, 404);
}

async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || !(await sameSecret(password, env.ADMIN_PASSWORD, env.SESSION_SECRET))) {
    // A short pause makes guessing passwords slow.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return json({ error: 'That password is not right.' }, 401);
  }
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  const token = expires + '.' + (await sign(String(expires), env.SESSION_SECRET));
  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_HOURS * 3600}; HttpOnly; Secure; SameSite=Strict`
  });
}

function logout() {
  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
  });
}

async function data(env) {
  const [newsletter, candidates] = await Promise.all([
    readJson(env, NEWSLETTER_PATH),
    readJson(env, CANDIDATES_PATH)
  ]);
  return json({
    newsletter: newsletter ? newsletter.data : null,
    newsletterSha: newsletter ? newsletter.sha : null,
    candidates: candidates ? candidates.data : null,
    publicSiteUrl: env.PUBLIC_SITE_URL || ''
  });
}

async function publish(request, env) {
  const body = await request.json().catch(() => null);
  const newsletter = body && body.newsletter;
  const problem = checkNewsletter(newsletter);
  if (problem) return json({ error: problem }, 400);

  const text = JSON.stringify(newsletter, null, 2) + '\n';
  if (new TextEncoder().encode(text).length > MAX_NEWSLETTER_BYTES) {
    return json({ error: 'The issue is too large to publish. Approve fewer items.' }, 400);
  }

  const put = { message: `Publish The Circuit for the week of ${newsletter.weekOf}`, content: toBase64(text), branch: branch(env) };
  if (typeof body.sha === 'string' && body.sha) put.sha = body.sha;

  const response = await github(env, contentsPath(env, NEWSLETTER_PATH), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(put)
  });
  // 409: the file changed since the desk loaded it. 422 without a sha: it already exists.
  if (response.status === 409 || (response.status === 422 && !put.sha)) {
    return json({ error: 'conflict' }, 409);
  }
  if (!response.ok) return json({ error: await githubProblem(response) }, 502);
  const result = await response.json();
  return json({ sha: result.content.sha });
}

async function collect(env) {
  const workflow = env.COLLECT_WORKFLOW || 'newsletter-collect.yml';
  const response = await github(env, `/repos/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: branch(env) })
  });
  if (response.status === 204) return json({ ok: true });
  return json({
    error: await githubProblem(response),
    actionsUrl: `https://github.com/${env.GITHUB_REPO}/actions/workflows/${workflow}`
  }, 502);
}

// Light checks so a broken request cannot publish a page AI Insights cannot read.
function checkNewsletter(newsletter) {
  if (!newsletter || typeof newsletter !== 'object') return 'Nothing to publish.';
  if (!Array.isArray(newsletter.items) || !Array.isArray(newsletter.sections)) return 'The issue is missing its items or sections.';
  if (newsletter.items.length > MAX_ITEMS) return `An issue can hold at most ${MAX_ITEMS} items.`;
  if (typeof newsletter.weekOf !== 'string' || !newsletter.weekOf) return 'The issue is missing its week.';
  const all = (newsletter.spotlight ? [newsletter.spotlight] : []).concat(newsletter.items);
  for (const item of all) {
    if (!item || typeof item.title !== 'string' || !/^https?:\/\//.test(String(item.url || ''))) {
      return 'Every item needs a title and a link that starts with https://.';
    }
  }
  return '';
}

// ---- GitHub -------------------------------------------------------------
function branch(env) {
  return env.GITHUB_BRANCH || 'main';
}

function contentsPath(env, path) {
  return `/repos/${env.GITHUB_REPO}/contents/${path}`;
}

function github(env, path, init = {}) {
  return fetch((env.GITHUB_API_URL || 'https://api.github.com') + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'circuit-review-desk',
      ...(init.headers || {})
    }
  });
}

async function readJson(env, path) {
  const where = contentsPath(env, path) + '?ref=' + encodeURIComponent(branch(env));
  const response = await github(env, where);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await githubProblem(response));
  const file = await response.json();
  let text = file.content ? fromBase64(file.content) : '';
  if (!text && file.size) {
    // GitHub leaves out the content of files over 1 MB; ask for the raw text.
    const raw = await github(env, where, { headers: { Accept: 'application/vnd.github.raw+json' } });
    if (!raw.ok) throw new Error(await githubProblem(raw));
    text = await raw.text();
  }
  return { data: JSON.parse(text), sha: file.sha };
}

async function githubProblem(response) {
  if (response.status === 401) return 'GitHub rejected the desk\'s GITHUB_TOKEN. Whoever set up the desk needs to replace it.';
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    return 'GitHub is limiting requests right now. Wait a few minutes and try again.';
  }
  if (response.status === 403 || response.status === 404) {
    return 'The desk\'s GITHUB_TOKEN cannot do that. It needs Contents and Actions write access to the repository.';
  }
  let detail = '';
  try { detail = (await response.json()).message || ''; } catch { detail = ''; }
  return `GitHub returned an error (${response.status}${detail ? ': ' + detail : ''}).`;
}

// ---- Sessions -----------------------------------------------------------
async function hasSession(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  const [expires, signature] = match[1].split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return equalStrings(signature, await sign(expires, env.SESSION_SECRET));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(value, secret) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

// Compares the typed password with the real one without leaking how much matched.
async function sameSecret(given, expected, secret) {
  return equalStrings(await sign(given, secret), await sign(expected, secret));
}

function equalStrings(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

// Blocks other websites from sending requests with a reviewer's cookie.
function isSameOriginJson(request) {
  const type = request.headers.get('Content-Type') || '';
  const origin = request.headers.get('Origin');
  return type.includes('application/json') && (!origin || origin === new URL(request.url).origin);
}

// ---- Small helpers -------------------------------------------------------
async function page(request, env, file) {
  const asset = await env.ASSETS.fetch(new Request(new URL(file, request.url), { method: 'GET' }));
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Content-Type', 'text/html; charset=utf-8');
  return response;
}

function redirect(url, path) {
  return new Response(null, { status: 302, headers: { Location: new URL(path, url).href, 'Cache-Control': 'no-store' } });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

function withSecurityHeaders(response) {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) copy.headers.set(name, value);
  return copy;
}

function fromBase64(text) {
  const binary = atob(String(text).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
