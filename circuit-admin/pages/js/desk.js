// The Circuit review desk (desk.html).
//
// Flow:
//   ai_brief/build_candidates.py (GitHub Action) -> data/newsletter-candidates.json
//   -> this page (approve, pick the spotlight and sections)
//   -> Publish -> the Worker commits data/newsletter.json -> AI Insights shows it.
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
    { name: 'Latest AI News', subtitle: 'Headlines and developments from across the AI field', button: 'Read More' },
    { name: 'Tutorials & Learning', subtitle: 'Guides and explainers to build your AI skills', button: 'Explore' },
    { name: 'AI Tools', subtitle: 'New models, libraries, and products worth trying', button: 'Explore' },
    { name: 'Videos', subtitle: 'Talks, demos, and walkthroughs to watch', button: 'Watch' },
    { name: 'Applied AI Use Cases', subtitle: 'How AI is being put to work in the real world', button: 'Read More' },
    { name: 'Research Spotlight', subtitle: 'Notable papers and research highlights', button: 'Read Paper' }
  ];
  const SECTION_NAMES = SECTIONS.map(function (s) { return s.name; });

  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    accountMeta: $('account-meta'), deskMessage: $('desk-message'),
    stats: $('stats'), rows: $('rows'), resultCount: $('result-count'),
    search: $('filter-search'), source: $('filter-source'), section: $('filter-section'), status: $('filter-status'),
    collect: $('collect-button'), signout: $('signout-button'), viewLink: $('view-link'),
    publish: $('publish-button'), publishSummary: $('publish-summary')
  };

  let rows = [];            // One entry per candidate or published item.
  let newsletterSha = null; // GitHub's version id for data/newsletter.json.
  let published = null;     // The newsletter as last published.
  let candidates = null;    // The collector's latest run.
  let dirty = false;        // Unpublished changes on this page.

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

  function niceDateTime(iso) {
    const date = new Date(iso);
    if (!iso || isNaN(date)) return '';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function typeLabel(contentType) {
    return String(contentType || 'Resource').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function validSection(name) {
    return SECTION_NAMES.indexOf(name) >= 0 ? name : 'Latest AI News';
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
    say('Loading candidates and the current issue…');
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
    else say('No candidates yet. Click Run collector to gather this week\'s content.', 'info');
  }

  // Combines the collector's candidates with what is already published.
  function buildRows() {
    const byUrl = new Map();
    ((candidates && candidates.items) || []).forEach(function (item) {
      if (!safeUrl(item.url)) return;
      byUrl.set(item.url, {
        title: item.title || '', description: item.description || '', source: item.source || '',
        published: item.published || '', contentType: item.contentType || '', url: item.url,
        videoId: item.videoId || '', image: item.image || '', customImage: '',
        section: validSection(item.section), approved: false, featured: false
      });
    });

    const live = published ? [published.spotlight].concat(published.items || []).filter(Boolean) : [];
    live.forEach(function (item) {
      if (!safeUrl(item.url)) return;
      let row = byUrl.get(item.url);
      if (row) {
        // A picture that differs from the automatic one was pasted by a reviewer.
        if (item.image && item.image !== row.image) row.customImage = item.image;
      } else {
        row = {
          title: item.title || '', description: item.description || '', source: item.source || '',
          published: item.published || '', contentType: item.contentType || String(item.type || '').toLowerCase(),
          url: item.url, videoId: item.videoId || '', image: item.image || '', customImage: ''
        };
        byUrl.set(item.url, row);
      }
      row.approved = true;
      row.featured = !!item.featured;
      row.section = validSection(item.section);
    });

    rows = Array.from(byUrl.values()).sort(newestFirst);
    let seenFeatured = false;
    rows.forEach(function (row) {
      if (row.featured && seenFeatured) row.featured = false;
      if (row.featured) seenFeatured = true;
    });
  }

  // ---- Rendering ----------------------------------------------------------
  function fillFilterOptions() {
    const sources = Array.from(new Set(rows.map(function (row) { return row.source; }))).sort();
    ui.source.replaceChildren(el('option', { value: '', text: 'All sources' }));
    sources.forEach(function (name) { ui.source.append(el('option', { value: name, text: name })); });
    ui.section.replaceChildren(el('option', { value: '', text: 'All sections' }));
    SECTION_NAMES.forEach(function (name) { ui.section.append(el('option', { value: name, text: name })); });
  }

  function renderAll() {
    renderMeta();
    renderStats();
    renderRows();
    renderPublishBar();
  }

  function renderMeta() {
    const parts = [];
    if (candidates && candidates.generatedAt) parts.push('Collected ' + niceDateTime(candidates.generatedAt));
    if (published && published.publishedAt) parts.push('Last published ' + niceDateTime(published.publishedAt));
    else if (published) parts.push('Live issue: week of ' + (published.weekOf || 'unknown'));
    ui.accountMeta.textContent = parts.join(' · ');
  }

  function renderStats() {
    const approved = rows.filter(function (row) { return row.approved; });
    const spotlight = approved.find(function (row) { return row.featured; });
    const stats = [
      ['Candidates', String((candidates && candidates.items && candidates.items.length) || 0)],
      ['Approved', String(approved.length)],
      ['Sources', String(new Set(rows.map(function (row) { return row.source; })).size)],
      ['Spotlight', spotlight ? 'Chosen' : approved.length ? 'Newest approved' : 'None yet']
    ];
    ui.stats.replaceChildren();
    stats.forEach(function (pair) {
      ui.stats.append(el('div', { className: 'admin-stat' }, [el('dt', { text: pair[0] }), el('dd', { text: pair[1] })]));
    });
  }

  function visibleRows() {
    const query = ui.search.value.trim().toLowerCase();
    return rows.filter(function (row) {
      if (ui.source.value && row.source !== ui.source.value) return false;
      if (ui.section.value && row.section !== ui.section.value) return false;
      if (ui.status.value === 'approved' && !row.approved) return false;
      if (ui.status.value === 'pending' && row.approved) return false;
      return !query || (row.title + ' ' + row.description).toLowerCase().indexOf(query) >= 0;
    });
  }

  function thumbFor(row) {
    const src = safeUrl(row.customImage) || safeUrl(row.image);
    const frame = el('div', { className: 'admin-thumb' });
    if (src) {
      const img = el('img', { src: src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', function () { frame.replaceChildren(el('span', { text: 'Picture failed to load' })); }, { once: true });
      frame.append(img);
    } else {
      frame.append(el('span', { text: 'No picture. Generated artwork will be used.' }));
    }
    return frame;
  }

  function rowFor(row, index) {
    const label = row.title || row.url;
    const sectionSelect = el('select', { 'data-field': 'section', 'aria-label': 'Section for ' + label });
    SECTION_NAMES.forEach(function (name) {
      sectionSelect.append(el('option', { value: name, text: name, selected: name === row.section }));
    });

    const meta = [row.source, niceDate(row.published), typeLabel(row.contentType)].filter(Boolean).join(' · ');
    const item = el('td', { className: 'admin-item' }, [
      el('a', { className: 'admin-title', href: safeUrl(row.url), target: '_blank', rel: 'noopener noreferrer', text: label }),
      row.description ? el('p', { className: 'admin-desc', text: row.description }) : null,
      el('p', { className: 'admin-line', text: meta })
    ]);

    return el('tr', { 'data-index': String(index), className: row.approved ? 'is-approved' : '' }, [
      el('td', { className: 'admin-cell-check', 'data-label': 'Approve' }, [
        el('input', { type: 'checkbox', 'data-field': 'approved', checked: row.approved, 'aria-label': 'Approve: ' + label })
      ]),
      el('td', { className: 'admin-cell-check', 'data-label': 'Spotlight' }, [
        el('input', { type: 'checkbox', className: 'admin-star', 'data-field': 'featured', checked: row.featured, 'aria-label': 'Make the spotlight: ' + label })
      ]),
      item,
      el('td', { 'data-label': 'Section' }, [sectionSelect]),
      el('td', { className: 'admin-cell-picture', 'data-label': 'Picture' }, [
        thumbFor(row),
        el('input', {
          type: 'url', 'data-field': 'customImage', value: row.customImage, placeholder: 'Custom picture link (optional)',
          'aria-label': 'Custom picture link for ' + label, spellcheck: 'false'
        })
      ])
    ]);
  }

  function renderRows() {
    const list = visibleRows();
    ui.rows.replaceChildren.apply(ui.rows, list.map(function (row) { return rowFor(row, rows.indexOf(row)); }));
    if (!list.length) {
      ui.rows.append(el('tr', { className: 'admin-empty' }, [
        el('td', { colspan: '5', text: rows.length ? 'Nothing matches these filters.' : 'No candidates yet. Click Run collector.' })
      ]));
    }
    ui.resultCount.textContent = 'Showing ' + list.length + ' of ' + rows.length;
  }

  function renderPublishBar() {
    const approved = rows.filter(function (row) { return row.approved; });
    const spotlight = approved.find(function (row) { return row.featured; }) || approved.slice().sort(newestFirst)[0];
    let text = approved.length + (approved.length === 1 ? ' item approved' : ' items approved');
    if (spotlight) text += ' · Spotlight: ' + spotlight.title;
    text += dirty ? ' · Unpublished changes' : ' · Matches the live issue';
    ui.publishSummary.textContent = text;
    ui.publish.disabled = !dirty;
  }

  function markDirty() {
    dirty = true;
    renderStats();
    renderPublishBar();
  }

  // ---- Editing ------------------------------------------------------------
  ui.rows.addEventListener('change', function (event) {
    const field = event.target.dataset.field;
    const tr = event.target.closest('tr[data-index]');
    if (!field || !tr) return;
    const row = rows[Number(tr.dataset.index)];

    if (field === 'approved') {
      row.approved = event.target.checked;
      if (!row.approved && row.featured) {
        row.featured = false;
        tr.querySelector('[data-field="featured"]').checked = false;
      }
      tr.classList.toggle('is-approved', row.approved);
    } else if (field === 'featured') {
      rows.forEach(function (other) { other.featured = false; });
      row.featured = event.target.checked;
      if (row.featured) row.approved = true;
      renderRows();
    } else if (field === 'section') {
      row.section = validSection(event.target.value);
    } else if (field === 'customImage') {
      const value = event.target.value.trim();
      if (value && !safeUrl(value)) {
        event.target.setCustomValidity('Use a link that starts with https://');
        event.target.reportValidity();
        return;
      }
      event.target.setCustomValidity('');
      row.customImage = value ? safeUrl(value) : '';
      tr.querySelector('.admin-thumb').replaceWith(thumbFor(row));
    }
    markDirty();
  });

  [ui.search, ui.source, ui.section, ui.status].forEach(function (control) {
    control.addEventListener(control === ui.search ? 'input' : 'change', renderRows);
  });

  // ---- Publishing ---------------------------------------------------------
  function buildNewsletter() {
    const approved = rows.filter(function (row) { return row.approved; }).sort(newestFirst);
    const spotlight = approved.find(function (row) { return row.featured; }) || approved[0] || null;

    function toItem(row) {
      return {
        title: row.title,
        description: row.description,
        source: row.source,
        date: niceDate(row.published),
        type: typeLabel(row.contentType),
        section: row.section,
        sectionId: slug(row.section),
        url: safeUrl(row.url),
        image: safeUrl(row.customImage) || safeUrl(row.image),
        videoId: row.videoId,
        published: row.published,
        contentType: row.contentType,
        featured: !!row.featured
      };
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
      ? 'Publish ' + count + (count === 1 ? ' item' : ' items') + ' to The Circuit for the week of ' + data.weekOf + '?'
      : 'Nothing is approved. Publishing now will show "This week\'s issue is being curated" on AI Insights. Continue?';
    if (!confirm(question)) return;

    ui.publish.disabled = true;
    say('Publishing…');
    let result;
    try {
      result = await api('/api/publish', { newsletter: data, sha: newsletterSha });
    } catch (error) {
      say('Could not reach the desk. Nothing was published. Try again.', 'error');
      renderPublishBar();
      return;
    }

    if (result.status === 409) {
      say('Someone else published while you were reviewing, so nothing was saved. ' +
        'Reload the desk to see their version, then make your changes again.', 'error', reloadButton());
      renderPublishBar();
      return;
    }
    if (!result.ok) {
      say((result.body.error || 'Publishing failed.') + ' Nothing was published.', 'error');
      renderPublishBar();
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
  async function runCollector() {
    ui.collect.disabled = true;
    say('Starting the collector…');
    try {
      const result = await api('/api/collect', {});
      if (result.ok) {
        say('The collector is running. It usually takes 3 to 5 minutes. Then', 'success', reloadButton());
      } else if (result.body.actionsUrl) {
        say((result.body.error || 'Could not start the collector.') + ' You can start it from GitHub instead:', 'error',
          el('a', { href: safeUrl(result.body.actionsUrl), target: '_blank', rel: 'noopener noreferrer', text: 'Collect newsletter candidates ↗' }));
      } else {
        say(result.body.error || 'Could not start the collector.', 'error');
      }
    } catch (error) {
      offline();
    } finally {
      ui.collect.disabled = false;
    }
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
