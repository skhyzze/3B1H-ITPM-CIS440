// The Circuit review desk (desk.html).
//
// Flow:
//   ai_brief/build_candidates.py (GitHub Action) -> data/newsletter-candidates.json
//   -> this page (pick articles, the spotlight, sections and news topics)
//   -> Publish -> the Worker commits data/newsletter.json -> AI Insights shows it.
//
// Layout: filters on the left, every collected article in a scrolling table in
// the middle, and "This issue" (what will be published) on the right.
//
// This page only talks to the Worker (/api/...). The Worker checks the
// sign-in cookie and holds the GitHub credential.
(function () {
  'use strict';

  const NEWSLETTER_TITLE = 'The Circuit';
  const LAB_NAME = 'Applied AI Lab';
  const INTRO_MESSAGE = 'Your weekly digest of what matters in artificial intelligence: the news worth knowing, ' +
    'tutorials worth your time, tools worth trying, and real examples of AI being applied. ' +
    'Every link below was hand-picked by the Applied AI Lab team.';

  // Newsletter sections, in the order they appear on AI Insights.
  const SECTIONS = [
    { name: 'Latest AI News', short: 'News', subtitle: 'Headlines and developments from across the AI field', button: 'Read More' },
    { name: 'Tutorials & Learning', short: 'Tutorials', subtitle: 'Guides and explainers to build your AI skills', button: 'Explore' },
    { name: 'AI Tools', short: 'Tools', subtitle: 'New models, libraries, and products worth trying', button: 'Explore' },
    { name: 'Videos', short: 'Videos', subtitle: 'Talks, demos, and walkthroughs to watch', button: 'Watch' },
    { name: 'Applied AI Use Cases', short: 'Use cases', subtitle: 'How AI is being put to work in the real world', button: 'Read More' },
    { name: 'Research Spotlight', short: 'Research', subtitle: 'Notable papers and research highlights', button: 'Read Paper' }
  ];
  const SECTION_NAMES = SECTIONS.map(function (s) { return s.name; });
  const NEWS = 'Latest AI News';

  // The news carousel on AI Insights has one slide per topic (js/ai-insights.js).
  const TOPICS = [
    { id: 'industry', name: 'Industry' },
    { id: 'ethics', name: 'Ethics' },
    { id: 'machine-learning', name: 'Machine Learning' },
    { id: 'agents', name: 'AI Agents' }
  ];
  const TOPIC_IDS = TOPICS.map(function (t) { return t.id; });

  // How often to check whether a collector run has finished, and for how long.
  const COLLECT_CHECK_MS = 30000;
  const COLLECT_GIVE_UP_MS = 12 * 60000;

  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    deskMessage: $('desk-message'), collectMeta: $('collect-meta'), stats: $('stats'),
    rows: $('rows'), resultCount: $('result-count'),
    search: $('filter-search'), status: $('filter-status'), sections: $('filter-sections'),
    source: $('filter-source'), date: $('filter-date'),
    collect: $('collect-button'), signout: $('signout-button'), viewLink: $('view-link'),
    issueWeek: $('issue-week'), issueTitle: $('issue-title'), issueSpotlight: $('issue-spotlight'),
    issueList: $('issue-list'), publish: $('publish-button'), publishSummary: $('publish-summary')
  };

  let rows = [];            // One entry per candidate or published item.
  let newsletterSha = null; // GitHub's version id for data/newsletter.json.
  let published = null;     // The newsletter as last published.
  let candidates = null;    // The collector's latest run.
  let dirty = false;        // Unpublished changes on this page.
  let statusFilter = '';    // '', 'pending' or 'approved'.
  let editingUrl = '';      // The item whose picture editor is open in "This issue".

  // ---- Small helpers ------------------------------------------------------
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key];
      if (value === false || value == null) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'className') node.className = value;
      else if (key in node && typeof value !== 'string') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (child) { if (child) node.append(child); });
    return node;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').join('-');
  }

  function niceDate(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date)) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function shortDate(iso) {
    const date = new Date(iso);
    if (!iso || isNaN(date)) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function niceDateTime(iso) {
    const date = new Date(iso);
    if (!iso || isNaN(date)) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' +
      date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function typeLabel(contentType) {
    return String(contentType || 'Resource').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function validSection(name) {
    return SECTION_NAMES.indexOf(name) >= 0 ? name : NEWS;
  }

  function shortSection(name) {
    const section = SECTIONS.find(function (s) { return s.name === name; });
    return section ? section.short : name;
  }

  // A starting guess for the news topic. Reviewers can change it in the table.
  function guessTopic(row) {
    const text = (row.title + ' ' + row.description).toLowerCase();
    if (/\bagent(s|ic)?\b/.test(text)) return 'agents';
    if (/ethic|polic(y|ies)|regulat|lawsuit|\blaws?\b|govern|safety|copyright|privacy|\bbias|senate|congress|court|\bban(s|ned)?\b/.test(text)) return 'ethics';
    if (/\bmodels?\b|training|benchmark|\bllms?\b|neural|dataset|machine learning|reasoning|open-source/.test(text)) return 'machine-learning';
    return 'industry';
  }

  function newestFirst(a, b) {
    if (!a.published && !b.published) return 0;
    if (!a.published) return 1;
    if (!b.published) return -1;
    return a.published < b.published ? 1 : a.published > b.published ? -1 : 0;
  }

  function mondayOfThisWeek() {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function say(text, tone, extra) {
    ui.deskMessage.replaceChildren();
    ui.deskMessage.dataset.tone = tone || '';
    if (text) ui.deskMessage.append(text);
    if (extra) ui.deskMessage.append(' ', extra);
  }

  function picked() { return rows.filter(function (row) { return row.approved; }); }
  function spotlightRow() { return rows.find(function (row) { return row.approved && row.featured; }) || null; }
  function pictureOf(row) { return safeUrl(row.customImage) || safeUrl(row.image); }

  // ---- Talking to the Worker ------------------------------------------------
  // Returns { ok, status, body }. Sends signed-out reviewers back to the sign-in page.
  async function api(path, payload) {
    const options = payload === undefined
      ? { method: 'GET', cache: 'no-store' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    const response = await fetch(path, Object.assign({ credentials: 'same-origin' }, options));
    const body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && path !== '/api/logout') {
      dirty = false;
      window.location.replace('/login');
    }
    return { ok: response.ok, status: response.status, body: body };
  }

  function offline() {
    say('Could not reach the desk. Check your connection and try again.', 'error');
  }

  // ---- Loading ------------------------------------------------------------
  async function loadDesk() {
    say('Loading this week\'s articles and the current issue…');
    let result;
    try { result = await api('/api/data'); } catch (error) { offline(); return; }
    if (!result.ok) {
      say(result.body.error || 'Could not load the desk.', 'error');
      return;
    }
    published = result.body.newsletter;
    newsletterSha = result.body.newsletterSha;
    candidates = result.body.candidates;
    const site = safeUrl(result.body.publicSiteUrl);
    ui.viewLink.href = site ? new URL('ai-insights.html', site).href : '#';
    ui.viewLink.hidden = !site;

    buildRows();
    dirty = false;
    fillFilterOptions();
    renderAll();
    if (candidates) say('');
    else say('No articles yet. Click Run collector to gather this week\'s content.', 'info');
  }

  function newRow(item) {
    const row = {
      title: item.title || '', description: item.description || '', source: item.source || '',
      published: item.published || '', contentType: item.contentType || String(item.type || '').toLowerCase(),
      url: item.url, videoId: item.videoId || '', image: item.image || '', customImage: '',
      section: validSection(item.section), subtopic: '', approved: false, featured: false
    };
    row.subtopic = guessTopic(row);
    return row;
  }

  // Combines the collector's articles with what is already published.
  function buildRows() {
    const byUrl = new Map();
    ((candidates && candidates.items) || []).forEach(function (item) {
      if (safeUrl(item.url)) byUrl.set(item.url, newRow(item));
    });

    const live = published ? [published.spotlight].concat(published.items || []).filter(Boolean) : [];
    live.forEach(function (item) {
      if (!safeUrl(item.url)) return;
      let row = byUrl.get(item.url);
      if (row) {
        // A picture that differs from the automatic one was pasted by a reviewer.
        if (item.image && item.image !== row.image) row.customImage = item.image;
      } else {
        row = newRow(item);
        byUrl.set(item.url, row);
      }
      row.approved = true;
      row.featured = !!item.featured;
      row.section = validSection(item.section);
      if (TOPIC_IDS.indexOf(item.subtopic) >= 0) row.subtopic = item.subtopic;
    });

    rows = Array.from(byUrl.values()).sort(newestFirst);
    let seenFeatured = false;
    rows.forEach(function (row) {
      if (row.featured && seenFeatured) row.featured = false;
      if (row.featured) seenFeatured = true;
    });
  }

  // After a collector run: load the new articles but keep this page's decisions.
  function keepDecisions(previous) {
    const byUrl = new Map(rows.map(function (row) { return [row.url, row]; }));
    previous.forEach(function (old) {
      const row = byUrl.get(old.url);
      if (row) {
        ['approved', 'featured', 'section', 'subtopic', 'customImage'].forEach(function (key) { row[key] = old[key]; });
      } else if (old.approved) {
        rows.push(old);
      }
    });
    rows.sort(newestFirst);
  }

  // ---- Rendering ----------------------------------------------------------
  function fillFilterOptions() {
    const chosen = ui.source.value;
    const sources = Array.from(new Set(rows.map(function (row) { return row.source; }))).sort();
    ui.source.replaceChildren(el('option', { value: '', text: 'All sources' }));
    sources.forEach(function (name) { ui.source.append(el('option', { value: name, text: name, selected: name === chosen })); });

    const checked = chosenSections();
    ui.sections.replaceChildren.apply(ui.sections, SECTIONS.map(function (s) {
      return el('label', { className: 'desk-check' }, [
        el('input', { type: 'checkbox', value: s.name, checked: checked.indexOf(s.name) >= 0 }),
        el('span', { text: s.short }),
        el('span', { className: 'desk-check-count', 'data-count': s.name })
      ]);
    }));
    renderSectionCounts();
  }

  function renderSectionCounts() {
    ui.sections.querySelectorAll('[data-count]').forEach(function (node) {
      const name = node.dataset.count;
      node.textContent = String(rows.filter(function (row) { return row.section === name; }).length);
    });
  }

  function chosenSections() {
    return Array.from(ui.sections.querySelectorAll('input:checked')).map(function (box) { return box.value; });
  }

  function renderAll() {
    renderMeta();
    renderStats();
    renderRows();
    renderIssue();
  }

  function renderMeta() {
    const when = candidates && candidates.generatedAt ? niceDateTime(candidates.generatedAt) : '';
    ui.collectMeta.replaceChildren(
      when ? 'Last collection: ' : 'No collection yet',
      when ? el('b', { text: when }) : '',
      el('br'),
      'Runs on its own every Monday morning'
    );
  }

  function renderStats() {
    const sources = (candidates && candidates.sourcesChecked) || new Set(rows.map(function (row) { return row.source; })).size;
    const stats = [
      ['Collected', String((candidates && candidates.items && candidates.items.length) || 0)],
      ['Picked', String(picked().length)],
      ['Spotlight', spotlightRow() ? '1' : '0'],
      ['Sources', String(sources)]
    ];
    ui.stats.replaceChildren.apply(ui.stats, stats.map(function (pair) {
      return el('div', { className: 'desk-stat' }, [el('dt', { text: pair[0] }), el('dd', { text: pair[1] })]);
    }));
  }

  function visibleRows() {
    const query = ui.search.value.trim().toLowerCase();
    const sections = chosenSections();
    const days = Number(ui.date.value);
    const since = days ? Date.now() - days * 86400000 : 0;
    return rows.filter(function (row) {
      if (sections.length && sections.indexOf(row.section) < 0) return false;
      if (ui.source.value && row.source !== ui.source.value) return false;
      if (statusFilter === 'approved' && !row.approved) return false;
      if (statusFilter === 'pending' && row.approved) return false;
      if (since && !(row.published && new Date(row.published).getTime() >= since)) return false;
      return !query || (row.title + ' ' + row.description + ' ' + row.source).toLowerCase().indexOf(query) >= 0;
    });
  }

  function thumb(row, extraClass) {
    const src = pictureOf(row);
    const frame = el('span', { className: 'desk-thumb' + (extraClass ? ' ' + extraClass : '') });
    if (src) {
      const img = el('img', { src: src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', function () { frame.replaceChildren(el('span', { text: 'No pic' })); }, { once: true });
      frame.append(img);
    } else {
      frame.append(el('span', { text: 'No pic' }));
    }
    return frame;
  }

  function topicCell(row, label) {
    if (row.section !== NEWS) return el('span', { className: 'desk-dash', text: '—', title: 'Only news articles have a topic' });
    const select = el('select', { 'data-field': 'subtopic', 'aria-label': 'News topic for ' + label });
    TOPICS.forEach(function (t) { select.append(el('option', { value: t.id, text: t.name, selected: t.id === row.subtopic })); });
    return select;
  }

  function rowFor(row, index) {
    const label = row.title || row.url;
    const sectionSelect = el('select', { 'data-field': 'section', 'aria-label': 'Section for ' + label });
    SECTIONS.forEach(function (s) {
      sectionSelect.append(el('option', { value: s.name, text: s.short, selected: s.name === row.section }));
    });

    return el('tr', { 'data-index': String(index), className: row.approved ? 'is-picked' : '' }, [
      el('td', { className: 'desk-cell-center', 'data-label': 'Add' }, [
        el('input', { type: 'checkbox', 'data-field': 'approved', checked: row.approved, 'aria-label': 'Add to this issue: ' + label })
      ]),
      el('td', { className: 'desk-cell-center', 'data-label': 'Spotlight' }, [
        el('button', {
          type: 'button', className: 'desk-star', 'data-field': 'featured', 'aria-pressed': String(row.featured),
          'aria-label': 'Make the spotlight: ' + label, title: row.featured ? 'This is the spotlight' : 'Make this the spotlight',
          text: row.featured ? '★' : '☆'
        })
      ]),
      el('td', { className: 'desk-cell-pic' }, [thumb(row)]),
      el('td', { className: 'desk-cell-article' }, [
        el('a', { href: safeUrl(row.url), target: '_blank', rel: 'noopener noreferrer', title: label }, [
          el('span', { text: label }), el('span', { className: 'desk-ext', 'aria-hidden': 'true', text: ' ↗' })
        ]),
        row.description ? el('small', { text: row.description }) : null
      ]),
      el('td', { className: 'desk-cell-source', 'data-label': 'Source', title: row.source, text: row.source }),
      el('td', { className: 'desk-cell-date', 'data-label': 'Date', text: shortDate(row.published) }),
      el('td', { 'data-label': 'Section' }, [sectionSelect]),
      el('td', { 'data-label': 'News topic', className: 'desk-cell-topic' }, [topicCell(row, label)])
    ]);
  }

  function renderRows() {
    const list = visibleRows();
    ui.rows.replaceChildren.apply(ui.rows, list.map(function (row) { return rowFor(row, rows.indexOf(row)); }));
    if (!list.length) {
      ui.rows.append(el('tr', { className: 'desk-empty' }, [
        el('td', { colspan: '8', text: rows.length ? 'Nothing matches these filters.' : 'No articles yet. Click Run collector.' })
      ]));
    }
    ui.resultCount.replaceChildren('Showing ', el('b', { text: String(list.length) }), ' of ' + rows.length);
  }

  function replaceRow(tr) {
    const index = Number(tr.dataset.index);
    tr.replaceWith(rowFor(rows[index], index));
  }

  // ---- "This issue" panel ---------------------------------------------------
  function pictureEditor(row) {
    const input = el('input', {
      type: 'url', value: row.customImage, placeholder: 'Uses the article\'s own picture', spellcheck: 'false',
      'data-url': row.url, 'aria-label': 'Picture link for ' + row.title
    });
    return el('div', { className: 'desk-picture-editor' }, [
      el('label', { className: 'desk-label', text: 'Picture link' }),
      input,
      el('p', { text: 'No picture? Open the article, right-click its main image, choose Copy Image Address, and paste it here.' }),
      el('a', { href: safeUrl(row.url), target: '_blank', rel: 'noopener noreferrer', text: 'Open the article ↗' })
    ]);
  }

  function issueItem(row) {
    const open = editingUrl === row.url;
    return el('div', { className: 'desk-issue-item' + (open ? ' is-open' : '') }, [
      el('div', { className: 'desk-issue-row' }, [
        el('button', {
          type: 'button', className: 'desk-issue-open', 'data-action': 'edit', 'data-url': row.url,
          'aria-expanded': String(open), title: 'Change the picture'
        }, [thumb(row, 'desk-thumb-small'), el('span', { text: row.title })]),
        el('button', { type: 'button', className: 'desk-remove', 'data-action': 'remove', 'data-url': row.url, 'aria-label': 'Remove from this issue: ' + row.title, text: '✕' })
      ]),
      open ? pictureEditor(row) : null
    ]);
  }

  function renderIssue() {
    const chosen = picked();
    const spotlight = spotlightRow();
    ui.issueWeek.textContent = 'This issue · week of ' + mondayOfThisWeek();
    ui.issueTitle.textContent = chosen.length + (chosen.length === 1 ? ' article picked' : ' articles picked');

    if (spotlight) {
      ui.issueSpotlight.replaceChildren(el('div', { className: 'desk-spotlight' }, [
        thumb(spotlight, 'desk-thumb-spot'),
        el('p', {}, [el('small', { text: '★ Spotlight' }), el('span', { text: spotlight.title })]),
        el('button', { type: 'button', className: 'desk-remove', 'data-action': 'unstar', 'aria-label': 'Remove the spotlight', title: 'Remove the spotlight', text: '✕' })
      ]));
    } else {
      ui.issueSpotlight.replaceChildren(el('p', {
        className: 'desk-spotlight-empty',
        text: chosen.length ? 'No spotlight chosen. The newest pick will be used. Click ☆ on an article to choose one.'
          : 'Tick articles in the table to add them here.'
      }));
    }

    const groups = SECTIONS.map(function (s) {
      const items = chosen.filter(function (row) { return row.section === s.name && row !== spotlight; });
      if (!items.length) return null;
      return el('div', { className: 'desk-issue-group' }, [
        el('h3', {}, [s.short + ' ', el('span', { text: String(items.length) })])
      ].concat(items.map(issueItem)));
    }).filter(Boolean);
    ui.issueList.replaceChildren.apply(ui.issueList, groups);

    ui.publish.disabled = !dirty;
    ui.publishSummary.textContent = dirty ? changeSummary() : 'Matches the live issue';
  }

  function changeSummary() {
    const live = new Set((published ? [published.spotlight].concat(published.items || []) : [])
      .filter(Boolean).map(function (item) { return item.url; }));
    const now = new Set(picked().map(function (row) { return row.url; }));
    let added = 0;
    let removed = 0;
    now.forEach(function (url) { if (!live.has(url)) added += 1; });
    live.forEach(function (url) { if (!now.has(url)) removed += 1; });
    const parts = [];
    if (added) parts.push(added + ' added');
    if (removed) parts.push(removed + ' removed');
    return 'Not published yet' + (parts.length ? ' · ' + parts.join(', ') : ' · edits made');
  }

  function changed() {
    dirty = true;
    renderStats();
    renderIssue();
    renderSectionCounts();
  }

  // ---- Editing in the table ---------------------------------------------------
  function setSpotlight(row, on) {
    rows.forEach(function (other) { other.featured = false; });
    row.featured = on;
    if (on) row.approved = true;
  }

  ui.rows.addEventListener('change', function (event) {
    const field = event.target.dataset.field;
    const tr = event.target.closest('tr[data-index]');
    if (!field || !tr) return;
    const row = rows[Number(tr.dataset.index)];

    if (field === 'approved') {
      row.approved = event.target.checked;
      if (!row.approved) row.featured = false;
      tr.classList.toggle('is-picked', row.approved);
      tr.querySelector('[data-field="featured"]').replaceWith(rowFor(row, Number(tr.dataset.index)).querySelector('[data-field="featured"]'));
    } else if (field === 'section') {
      row.section = validSection(event.target.value);
      replaceRow(tr);
    } else if (field === 'subtopic') {
      if (TOPIC_IDS.indexOf(event.target.value) >= 0) row.subtopic = event.target.value;
    }
    changed();
  });

  ui.rows.addEventListener('click', function (event) {
    const star = event.target.closest('[data-field="featured"]');
    if (!star) return;
    const row = rows[Number(star.closest('tr[data-index]').dataset.index)];
    setSpotlight(row, !row.featured);
    renderRows();
    changed();
  });

  // ---- Editing in "This issue" ------------------------------------------------
  function rowByUrl(url) { return rows.find(function (row) { return row.url === url; }); }

  document.querySelector('.desk-issue').addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'unstar') {
      rows.forEach(function (row) { row.featured = false; });
    } else if (action === 'remove') {
      const row = rowByUrl(button.dataset.url);
      if (row) { row.approved = false; row.featured = false; }
      if (editingUrl === button.dataset.url) editingUrl = '';
    } else if (action === 'edit') {
      editingUrl = editingUrl === button.dataset.url ? '' : button.dataset.url;
      renderIssue();
      const input = editingUrl && ui.issueList.querySelector('.desk-picture-editor input');
      if (input) input.focus();
      return;
    }
    renderRows();
    changed();
  });

  ui.issueList.addEventListener('change', function (event) {
    const input = event.target;
    if (!input.dataset.url) return;
    const row = rowByUrl(input.dataset.url);
    const value = input.value.trim();
    if (value && !safeUrl(value)) {
      input.setCustomValidity('Use a link that starts with https://');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    row.customImage = value ? safeUrl(value) : '';
    renderRows();
    changed();
  });

  // ---- Filters ------------------------------------------------------------
  ui.search.addEventListener('input', renderRows);
  [ui.source, ui.date].forEach(function (control) { control.addEventListener('change', renderRows); });
  ui.sections.addEventListener('change', renderRows);
  ui.status.addEventListener('click', function (event) {
    const button = event.target.closest('[data-status]');
    if (!button) return;
    statusFilter = button.dataset.status;
    ui.status.querySelectorAll('[data-status]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
    renderRows();
  });

  // ---- Publishing ---------------------------------------------------------
  function buildNewsletter() {
    const approved = picked().sort(newestFirst);
    const spotlight = approved.find(function (row) { return row.featured; }) || approved[0] || null;

    function toItem(row) {
      const item = {
        title: row.title,
        description: row.description,
        source: row.source,
        date: niceDate(row.published),
        type: typeLabel(row.contentType),
        section: row.section,
        sectionId: slug(row.section),
        url: safeUrl(row.url),
        image: pictureOf(row),
        videoId: row.videoId,
        published: row.published,
        contentType: row.contentType,
        featured: row === spotlight
      };
      if (row.section === NEWS) item.subtopic = row.subtopic;
      return item;
    }

    const items = approved.filter(function (row) { return row !== spotlight; }).map(toItem);
    const used = new Set(items.map(function (item) { return item.section; }));
    return {
      title: NEWSLETTER_TITLE,
      lab: LAB_NAME,
      intro: (published && published.intro) || INTRO_MESSAGE,
      weekOf: mondayOfThisWeek(),
      year: new Date().getFullYear(),
      publishedAt: new Date().toISOString(),
      spotlight: spotlight ? toItem(spotlight) : null,
      items: items,
      sections: SECTIONS.filter(function (s) { return used.has(s.name); }).map(function (s) {
        return { name: s.name, id: slug(s.name), subtitle: s.subtitle, button: s.button };
      })
    };
  }

  async function publish() {
    const data = buildNewsletter();
    const count = (data.spotlight ? 1 : 0) + data.items.length;
    const question = count
      ? 'Publish ' + count + (count === 1 ? ' article' : ' articles') + ' to The Circuit for the week of ' + data.weekOf + '?'
      : 'Nothing is picked. Publishing now will show "This week\'s issue is being curated" on AI Insights. Continue?';
    if (!confirm(question)) return;

    ui.publish.disabled = true;
    say('Publishing…');
    let result;
    try {
      result = await api('/api/publish', { newsletter: data, sha: newsletterSha });
    } catch (error) {
      say('Could not reach the desk. Nothing was published. Try again.', 'error');
      renderIssue();
      return;
    }

    if (result.status === 409) {
      say('Someone else published while you were reviewing, so nothing was saved. ' +
        'Reload the desk to see their version, then make your changes again.', 'error', reloadButton());
      renderIssue();
      return;
    }
    if (!result.ok) {
      say((result.body.error || 'Publishing failed.') + ' Nothing was published.', 'error');
      renderIssue();
      return;
    }

    newsletterSha = result.body.sha;
    published = data;
    dirty = false;
    renderAll();
    say('Published. AI Insights updates in about a minute.', 'success',
      ui.viewLink.hidden ? null : el('a', { href: ui.viewLink.href, target: '_blank', rel: 'noopener', text: 'Open The Circuit ↗' }));
  }

  function reloadButton() {
    const button = el('button', { type: 'button', className: 'admin-link-button', text: 'Reload the desk' });
    button.addEventListener('click', function () {
      if (!dirty || confirm('Discard your unpublished changes and reload?')) loadDesk();
    });
    return button;
  }

  // ---- Running the collector ----------------------------------------------
  function collectorIdle() {
    ui.collect.disabled = false;
    ui.collect.textContent = '▶ Run collector';
  }

  // Checks every 30 seconds until the collector saves a new list, then shows it.
  function waitForNewArticles(before, startedAt) {
    setTimeout(async function () {
      let result;
      try { result = await api('/api/data'); } catch (error) { result = null; }
      const fresh = result && result.ok && result.body.candidates;
      if (fresh && fresh.generatedAt && fresh.generatedAt !== before) {
        const previous = rows;
        candidates = fresh;
        buildRows();
        keepDecisions(previous);
        fillFilterOptions();
        renderAll();
        collectorIdle();
        say('New articles are in: ' + fresh.items.length + ' collected. Your picks were kept.', 'success');
        return;
      }
      if (Date.now() - startedAt > COLLECT_GIVE_UP_MS) {
        collectorIdle();
        say('The collector is taking longer than usual. Check again in a few minutes:', 'info', reloadButton());
        return;
      }
      waitForNewArticles(before, startedAt);
    }, COLLECT_CHECK_MS);
  }

  async function runCollector() {
    ui.collect.disabled = true;
    ui.collect.textContent = 'Collecting…';
    say('Starting the collector…');
    try {
      const result = await api('/api/collect', {});
      if (result.ok) {
        say('The collector is running. It usually takes 2 to 5 minutes, and the new articles appear here on their own.', 'info');
        waitForNewArticles(candidates && candidates.generatedAt, Date.now());
        return;
      }
      if (result.body.actionsUrl) {
        say((result.body.error || 'Could not start the collector.') + ' You can start it from GitHub instead:', 'error',
          el('a', { href: safeUrl(result.body.actionsUrl), target: '_blank', rel: 'noopener noreferrer', text: 'Collect newsletter candidates ↗' }));
      } else {
        say(result.body.error || 'Could not start the collector.', 'error');
      }
    } catch (error) {
      offline();
    }
    collectorIdle();
  }

  // ---- Signing out ----------------------------------------------------------
  async function signOut() {
    if (dirty && !confirm('You have unpublished changes. Sign out anyway?')) return;
    dirty = false;
    try { await api('/api/logout', {}); } catch (error) { /* The cookie expires on its own. */ }
    window.location.replace('/login');
  }

  // ---- Wiring -------------------------------------------------------------
  ui.signout.addEventListener('click', signOut);
  ui.collect.addEventListener('click', runCollector);
  ui.publish.addEventListener('click', publish);

  window.addEventListener('beforeunload', function (event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  loadDesk();
})();
