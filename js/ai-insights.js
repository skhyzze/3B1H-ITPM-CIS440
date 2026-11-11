// Page layout and interactive features for ai-insights.html.
// d = newsletter data; item = one resource; s = a topic or spotlight.
/* ===================== 3. SCRIPT ===================== */
document.documentElement.classList.add("js");

// ---- 3a. Helpers ---------------------------------------------------------
// Makes text safe to place inside HTML.
function esc(text) {
  return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
// Allows web links starting with http:// or https://.
function safeUrl(url) { return /^https?:\/\//i.test(url || "") ? esc(url) : "#"; }

// Stores the drawing instructions for each icon.
const ICONS = {
  "latest-ai-news": '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/>',
  "tutorials-learning": '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/>',
  "ai-tools": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  "videos": '<rect x="2" y="5" width="15" height="14" rx="3"/><path d="m17 10 5-3v10l-5-3"/>',
  "applied-ai-use-cases": '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>',
  "research-spotlight": '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.3 1.1 3.9 2.2l1.7 2 1.7-2C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  logo: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="1.6"/><circle cx="19" cy="6" r="1.6"/><circle cx="5" cy="18" r="1.6"/><circle cx="19" cy="18" r="1.6"/><path d="M6.4 7l3.3 3M17.6 7l-3.3 3M6.4 17l3.3-3M17.6 17l-3.3-3"/>'
};
// Builds a small SVG icon.
function icon(name, size) {
  size = size || 18;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.star) + '</svg>';
}

// IMAGE PLACEHOLDER: [Story image]
// Page: AI Insights. Used wherever a story, tool, or video has no picture.
// On screen it is the colored artwork with an icon and the source name.
// To add a photo, set item.image to an https URL. media() then uses:
// <img src="the-url" alt="" loading="lazy">
// inside the .media frame. If that image fails, this artwork returns.
// Creates a placeholder when there is no picture.
function art(item, size) {
  return '<div class="art"><div class="art-in">' + icon(item.sectionId, size || 42) + '<div class="art-src">' + esc(item.source) + '</div></div></div>';
}
// Shows the picture or a placeholder.
function media(item, extraClass, artSize) {
  const inner = item.image
    ? '<img src="' + safeUrl(item.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-art-size="' + (artSize || 42) + '">'
    : art(item, artSize);
  return '<div class="media ' + (extraClass || "") + '" data-c="' + esc(item.sectionId) + '">' + inner + '</div>';
}
// If an image fails to load, swap in the artwork instead of a broken icon.
document.addEventListener("error", function (event) {
  const img = event.target;
  if (img.tagName !== "IMG" || !img.parentElement || !img.parentElement.classList.contains("media")) return;
  const holder = img.closest("[data-index]");
  const item = holder ? ITEMS[+holder.dataset.index] : null;
  img.outerHTML = item ? art(item, +img.dataset.artSize) : '<div class="art"></div>';
}, true);

// Makes a link open in a new tab.
function linkAttrs(item) { return 'href="' + safeUrl(item.url) + '" target="_blank" rel="noopener noreferrer"'; }
// Shows the source and date.
function meta(item) {
  return '<div class="meta"><b>' + esc(item.source) + '</b>' + (item.date ? '<span>' + esc(item.date) + '</span>' : '') + '</div>';
}
// Creates a Save button.
function saveBtn(item) {
  return '<button class="save" type="button" data-save="' + esc(item.url) + '" aria-label="Like: ' + esc(item.title) + '" aria-pressed="false">' + icon("heart", 18) + '</button>';
}
// A description paragraph, or nothing when the text is blank.
function descriptionHtml(item, clamp) {
  const text = String(item.description == null ? "" : item.description).trim();
  if (!text) return "";
  return '<p class="desc ' + clamp + '">' + esc(text) + '</p>';
}
// News items read; other tools can be tried.
function toolAction(item) { return item.type === "News" ? "Read more" : "Try it"; }
// Uses pick or picks for the item count.
function picks(n) { return n + (n === 1 ? " pick" : " picks"); }
// Combines item details for searching.
function searchText(item) { return (item.title + " " + item.description + " " + item.source + " " + item.type).toLowerCase(); }
// Adds item details that JavaScript can read later.
function itemAttrs(item, index) {
  return 'data-index="' + index + '" data-c="' + esc(item.sectionId) + '" data-section="' + esc(item.sectionId) + '" data-url="' + esc(item.url) + '"';
}

// ---- 3c. Saved reading list (remembered in this browser only) -----------
const SAVE_KEY = "appliedAIBrief.saved";
const SUBSCRIBED_KEY = "circuit.subscribed";
let saved = new Set();
try { saved = new Set(JSON.parse(localStorage.getItem(SAVE_KEY) || "[]")); } catch (e) { saved = new Set(); }
// Remembers saved links in this browser.
function persistSaved() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(Array.from(saved))); } catch (e) { /* private mode */ } }

// ---- 3c. Building each part of the page ---------------------------------
let ITEMS = [];
const LABELS = { "latest-ai-news": "News", "tutorials-learning": "Tutorials", "ai-tools": "Tools",
  "videos": "Videos", "applied-ai-use-cases": "Use Cases", "research-spotlight": "Research" };

// Builds the navigation bar.
function navHtml(d) {
  const links = d.sections.slice(0, 6).map(function (s) {
    return '<a href="#' + esc(s.id) + '" data-jump="' + esc(s.id) + '">' + esc(LABELS[s.id] || s.name) + '</a>';
  }).join("");
  return '<nav class="nav" id="nav"><div class="wrap">' +
    '<a class="brand" href="#top" data-jump="top"><span class="mark">' + icon("logo", 20) + '</span>' + esc(d.lab) + '</a>' +
    '<div class="nav-links">' + links + '</div>' +
    '<div class="nav-actions">' +
      '<button class="pill-btn brief-theme-toggle" type="button" id="brief-theme-toggle" aria-label="Switch to dark mode" aria-pressed="false" title="Light / Dark mode">☾</button>' +
      '<button class="pill-btn" type="button" id="saved-btn">' + icon("heart", 16) + ' Liked <span class="count" id="saved-count">0</span></button>' +
      '<a class="pill-btn dark sub-link" href="#subscribe" data-jump="subscribe">' + icon("mail", 16) + ' Subscribe</a>' +
    '</div></div></nav>';
}

// Builds the introduction and image collage.
function heroHtml(d) {
  const all = (d.spotlight ? [d.spotlight] : []).concat(d.items);
  const sources = new Set(all.map(function (i) { return i.source; })).size;
  // Pick up to 3 items with pictures for the collage (different sections first).
  const withPics = d.items.filter(function (i) { return i.image; });
  const picks = []; const seen = {};
  withPics.forEach(function (i) { if (picks.length < 3 && !seen[i.sectionId]) { picks.push(i); seen[i.sectionId] = 1; } });
  withPics.forEach(function (i) { if (picks.length < 3 && picks.indexOf(i) < 0) picks.push(i); });
  d.items.forEach(function (i) { if (picks.length < 3 && picks.indexOf(i) < 0) picks.push(i); });
  const frames = picks.map(function (item, n) {
    return '<a class="frame f' + (n + 1) + '" data-index="' + d.items.indexOf(item) + '" data-c="' + esc(item.sectionId) + '" ' + linkAttrs(item) + '>' + media(item, "", 34) +
      '<div class="cap"><i></i><span>' + esc(item.title) + '</span></div></a>';
  }).join("");
  return '<header class="hero" id="top">' +
    '<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>' +
    '<div class="wrap"><div>' +
      '<span class="eyebrow reveal"><span class="live"><span class="dot"></span>NEW</span>Weekly Edition · Week of ' + esc(d.weekOf) + '</span>' +
      '<h1 class="reveal"><span class="grad">THE CIRCUIT</span></h1>' +
      '<p class="intro reveal">' + esc(d.intro) + '</p>' +
      '<div class="hero-ctas reveal">' +
        (d.spotlight ? '<a class="btn primary" href="#spotlight" data-jump="spotlight">' + icon("sparkle", 18) + ' See the Spotlight</a>' : '') +
        '<a class="btn ghost" href="#explore" data-jump="explore">Browse this week ' + icon("arrow", 16) + '</a>' +
      '</div>' +
      '<div class="stats reveal">' +
        '<div class="stat"><b data-count="' + all.length + '">0</b><span>hand-picked resources</span></div>' +
        '<div class="stat"><b data-count="' + sources + '">0</b><span>trusted sources</span></div>' +
        '<div class="stat"><b data-count="' + d.sections.length + '">0</b><span>topics this week</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="collage reveal" aria-hidden="true">' + frames + '</div>' +
    '</div></header>';
}

// Builds the scrolling headlines.
function tickerHtml(d) {
  const all = (d.spotlight ? [d.spotlight] : []).concat(d.items);
  if (all.length < 3) return "";
  const links = all.map(function (item) {
    return '<a data-c="' + esc(item.sectionId) + '" ' + linkAttrs(item) + '><i></i>' + esc(item.title) + '</a>';
  }).join("");
  return '<div class="ticker reveal" aria-label="Headlines this week"><div class="row">' +
    '<div class="label"><span class="dot"></span>THIS WEEK</div>' +
    '<div class="track">' + links + links + '</div></div></div>';
}

// Builds the featured article or video.
function spotlightHtml(d) {
  const s = d.spotlight;
  if (!s) return "";
  const isVideo = !!s.videoId;
  const cta = isVideo
    ? '<button class="btn glow" type="button" data-video="-1">' + icon("play", 18) + ' Watch now</button>'
    : '<a class="btn glow" ' + linkAttrs(s) + '>Read the full story ' + icon("arrow", 18) + '</a>';
  return '<section class="spotlight" id="spotlight"><div class="wrap">' +
    '<div class="spot-label reveal"><span class="tag">' + icon("star", 16) + ' THIS WEEK\'S SPOTLIGHT</span><span class="rule"></span><span class="week">Editor\'s pick · ' + esc(d.weekOf) + '</span></div>' +
    '<div class="spot-grid">' +
      '<div class="spot-media-wrap reveal" data-index="-1">' +
        (isVideo ? '<div style="position:relative">' + media(s, "", 80) + '<button class="play-big" type="button" data-video="-1" aria-label="Play video">' + icon("play", 34) + '</button></div>'
                 : '<a ' + linkAttrs(s) + '>' + media(s, "", 80) + '</a>') +
      '</div>' +
      '<div class="spot-body reveal">' +
        '<div class="chips"><span class="chip glass">' + esc(s.section) + '</span><span class="chip glass">' + esc(s.type) + '</span></div>' +
        '<h2>' + esc(s.title) + '</h2>' +
        '<p class="clamp4">' + esc(s.description) + '</p>' +
        '<div class="spot-meta"><b>' + esc(s.source) + '</b>' + (s.date ? '<span>·</span><span>' + esc(s.date) + '</span>' : '') + '</div>' +
        '<div class="spot-ctas">' + cta +
          '<button class="btn outline" type="button" data-save="' + esc(s.url) + '" aria-label="Like: ' + esc(s.title) + '" aria-pressed="false">' + icon("heart", 18) + ' <span>Like</span></button>' +
        '</div>' +
      '</div>' +
    '</div></div></section>';
}

// Builds the topic filters and search box.
function exploreHtml(d) {
  const chips = ['<button class="fchip on" type="button" data-filter="all"><i></i>All</button>']
    .concat(d.sections.map(function (s) {
      return '<button class="fchip" type="button" data-filter="' + esc(s.id) + '" data-c="' + esc(s.id) + '"><i></i>' + esc(LABELS[s.id] || s.name) + '</button>';
    }))
    .concat(['<button class="fchip" type="button" data-filter="saved" data-c="videos"><i></i>♥ Liked <small id="liked-count">0</small></button>']);
  return '<div class="explore" id="explore"><div class="wrap">' +
    '<div class="filters" role="toolbar" aria-label="Filter by topic">' + chips.join("") + '</div>' +
    '<label class="search"><span class="sr">Search this issue</span>' + icon("search", 17) + '<input id="search" type="search" placeholder="Search this issue..." autocomplete="off"></label>' +
    '</div></div>';
}

// Each section has its own layout so the page doesn't feel like a spreadsheet.
// Builds one article card.
function storyCard(item, i, section, lead) {
  return '<a class="item story' + (lead ? ' lead' : '') + ' reveal" ' + itemAttrs(item, i) + ' ' + linkAttrs(item) + '>' +
    media(item, "", lead ? 70 : 40) + saveBtn(item) +
    '<div class="body">' +
      '<div><span class="chip">' + esc(item.type) + '</span></div>' +
      '<h4 class="clamp3">' + esc(item.title) + '</h4>' +
      descriptionHtml(item, lead ? 'clamp2' : 'clamp3') +
      '<div class="foot">' + meta(item) + '<span class="go">' + esc(section.button) + ' ' + icon("arrow", 15) + '</span></div>' +
    '</div></a>';
}
// Chooses a card layout for each topic.
const LAYOUTS = {
  "latest-ai-news": function (list, s) {
    return '<div class="mag">' + list.map(function (x, n) { return storyCard(x.item, x.i, s, n === 0); }).join("") + '</div>';
  },
  "tutorials-learning": function (list, s) {
    return '<div class="lessons">' + list.map(function (x, n) {
      const item = x.item;
      return '<a class="item lesson reveal" ' + itemAttrs(item, x.i) + ' ' + linkAttrs(item) + '>' + media(item, "", 40) + saveBtn(item) +
        '<div class="body"><span class="num">LESSON ' + String(n + 1).padStart(2, "0") + ' · ' + esc(item.type.toUpperCase()) + '</span>' +
        '<h4 class="clamp2">' + esc(item.title) + '</h4>' + descriptionHtml(item, 'clamp3') +
        '<div class="foot">' + meta(item) + '<span class="go">' + esc(s.button) + ' ' + icon("arrow", 15) + '</span></div></div></a>';
    }).join("") + '</div>';
  },
  "ai-tools": function (list) {
    const top = list[0].item;
    let html = '<div class="item tool-hero" ' + itemAttrs(top, list[0].i) + '>' +
      '<a class="tool-shot reveal" ' + linkAttrs(top) + '>' + media(top, "", 72) + '</a>' +
      '<div class="tool-info reveal"><span class="kicker">' + icon("sparkle", 16) + ' TOOL OF THE WEEK</span>' +
      '<h4>' + esc(top.title) + '</h4>' + descriptionHtml(top, 'clamp4') + meta(top) +
      '<div class="tool-ctas"><a class="btn" ' + linkAttrs(top) + '>' + toolAction(top) + ' ' + icon("arrow", 16) + '</a>' + saveBtn(top) + '</div></div></div>';
    if (list.length > 1) {
      html += '<div class="tool-shelf">' + list.slice(1).map(function (x) {
        const item = x.item;
        return '<a class="item tool-row reveal" ' + itemAttrs(item, x.i) + ' ' + linkAttrs(item) + '>' + media(item, "", 28) +
          '<div><h5 class="clamp2">' + esc(item.title) + '</h5>' + descriptionHtml(item, 'clamp2') + meta(item) + '</div>' +
          '<div style="display:flex;align-items:center;gap:12px"><span class="go">' + toolAction(item) + ' ' + icon("arrow", 15) + '</span>' + saveBtn(item) + '</div></a>';
      }).join("") + '</div>';
    }
    return html;
  },
  "videos": function (list) {
    return '<div class="vids">' + list.map(function (x) {
      const item = x.item;
      const open = item.videoId ? 'role="button" tabindex="0" data-video="' + x.i + '"' : linkAttrs(item);
      const tag = item.videoId ? 'div' : 'a';
      return '<' + tag + ' class="item vid reveal" ' + itemAttrs(item, x.i) + ' ' + open + '>' +
        '<div class="thumb">' + media(item, "", 48) + saveBtn(item) + '<span class="play">' + icon("play", 26) + '</span><span class="src-tag">' + esc(item.source) + '</span></div>' +
        '<h4 class="clamp2">' + esc(item.title) + '</h4>' + meta(item) + '</' + tag + '>';
    }).join("") + '</div>';
  },
  "applied-ai-use-cases": function (list, s) {
    return '<div class="cases">' + list.map(function (x, n) {
      const item = x.item;
      return '<div class="item case reveal" ' + itemAttrs(item, x.i) + '>' + '<a ' + linkAttrs(item) + ' class="media-link" style="display:contents">' + media(item, "", 64) + '</a>' +
        '<div class="body"><span class="kicker">CASE ' + String(n + 1).padStart(2, "0") + ' · ' + esc(item.source.toUpperCase()) + '</span>' +
        '<h4>' + esc(item.title) + '</h4>' + descriptionHtml(item, 'clamp3') + meta(item) +
        '<div style="display:flex;gap:10px;align-items:center"><a class="btn" ' + linkAttrs(item) + '>' + esc(s.button) + ' ' + icon("arrow", 15) + '</a>' +
        saveBtn(item).replace('class="save"', 'class="save" style="position:static"') + '</div></div></div>';
    }).join("") + '</div>';
  },
  "research-spotlight": function (list, s) {
    return '<div class="papers">' + list.map(function (x, n) {
      const item = x.item;
      return '<div class="item paper reveal" ' + itemAttrs(item, x.i) + '><span class="n">' + String(n + 1).padStart(2, "0") + '</span>' +
        '<a ' + linkAttrs(item) + '>' + media(item, "", 26) + '</a>' +
        '<div><a ' + linkAttrs(item) + '><h4 class="clamp2">' + esc(item.title) + '</h4></a>' + descriptionHtml(item, 'clamp2') +
        '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' + meta(item) + '<a class="go" ' + linkAttrs(item) + '>' + esc(s.button) + ' ' + icon("arrow", 15) + '</a></div></div>' +
        saveBtn(item) + '</div>';
    }).join("") + '</div>';
  }
};

// Builds a topic section and its cards.
function sectionHtml(section, list) {
  const layout = LAYOUTS[section.id] || LAYOUTS["latest-ai-news"];
  const side = '<div class="sec-side vis-count">' + picks(list.length) + '</div>';
  const band = section.id === "ai-tools" ? " band" : "";
  return '<section class="section' + band + '" id="' + esc(section.id) + '" data-c="' + esc(section.id) + '" data-sec="' + esc(section.id) + '"><div class="wrap">' +
    '<div class="sec-head reveal"><div class="sec-title"><span class="sec-icon">' + icon(section.id, 24) + '</span>' +
    '<div><h3>' + esc(section.name) + '</h3><p>' + esc(section.subtitle) + '</p></div></div>' + side + '</div>' +
    layout(list, section) + '</div></section>';
}

// Builds the signup preview; emails are not saved.
function subscribeHtml(d) {
  return '<section class="subscribe" id="subscribe"><div class="wrap"><div class="sub-card reveal">' +
    '<div><span class="tag">' + icon("sparkle", 14) + 'NEW</span>' +
    '<h3>Subscribe to the ' + esc(d.lab) + ' Newsletter</h3>' +
    '<p>Get The Circuit in your inbox every week: one spotlight, the best of the rest, zero noise.</p></div>' +
    '<div><form class="sub-form" id="sub-form"><input type="email" placeholder="you@university.edu" aria-label="Email address" required>' +
    '<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden">' +
    '<button type="submit">Notify me</button></form>' +
    '<div class="sub-note" id="sub-note"></div>' +
    '<div class="sub-note">We only use your email to send The Circuit. Unsubscribe anytime.</div></div>' +
    '</div></div></section>';
}

// ---- 3d. Put the whole page together --------------------------------------
// Combines the sections and puts them on the page.
function render(d) {
  if (!d) return;
  ITEMS = d.items.slice();
  if (d.spotlight) ITEMS[-1] = d.spotlight;          // index -1 = the spotlight
  let body = heroHtml(d);
  if (!d.spotlight) {
    body += '<div class="wrap"><div class="curating"><b>This week\'s issue is being curated.</b><span>The Applied AI Lab team is reviewing the latest resources. Check back soon.</span></div></div>';
  } else {
    body += tickerHtml(d) + spotlightHtml(d) + exploreHtml(d);
    body += '<div class="wrap"><div class="result-note" id="result-note"></div></div>';
    d.sections.forEach(function (s) {
      const list = [];
      d.items.forEach(function (item, i) { if (item.sectionId === s.id) list.push({ item: item, i: i }); });
      if (list.length) body += sectionHtml(s, list);
    });
    body += '<div class="wrap"><div class="empty-state" id="empty-state"><b>Nothing matches that yet.</b>Try another topic or clear your search.</div></div>';
  }
  body += subscribeHtml(d) ;
  const app = document.getElementById("app");
 // Find the footer before rebuilding the newsletter.
const footer = document.getElementById("site-footer");

app.innerHTML = body;

// Place the footer after the newsletter, inside its scrolling area.
if (footer) {
  app.appendChild(footer);
}

wireUp();
  app.focus({ preventScroll: true });   // lets arrow keys / space bar scroll right away
  scrollToHash();
}

// ---- 3e. Interactivity -------------------------------------------------------
// Remembers the current topic and search words.
let filterState = { topic: "all", query: "" };

// Shows items matching the selected topic and search.
function applyFilters() {
  const q = filterState.query.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll(".section[data-sec]").forEach(function (sec) {
    let visible = 0;
    sec.querySelectorAll(".item[data-index]").forEach(function (el) {
      const item = ITEMS[+el.dataset.index];
      const topicOk = filterState.topic === "all" || (filterState.topic === "saved" ? saved.has(item.url) : item.sectionId === filterState.topic);
      const ok = topicOk && (!q || searchText(item).indexOf(q) >= 0);
      el.style.display = ok ? "" : "none";
      if (ok) { visible++; if (filterState.topic !== "all" || q) el.classList.add("in"); }
    });
    sec.style.display = visible ? "" : "none";
    const counter = sec.querySelector(".vis-count");
    if (counter) counter.textContent = picks(visible);
    shown += visible;
  });
  const empty = document.getElementById("empty-state");
  if (empty) {
    if (filterState.topic === "saved" && saved.size === 0) {
      empty.innerHTML = "<b>You haven't liked anything yet.</b> Tap the heart on any story to save it here.";
    } else {
      empty.innerHTML = "<b>Nothing matches that yet.</b>Try another topic or clear your search.";
    }
    empty.style.display = shown ? "none" : "block";
  }
  const note = document.getElementById("result-note");
  if (note) {
    const filtered = filterState.topic !== "all" || q;
    note.textContent = filtered ? "Showing " + shown + " of " + ITEMS.length + " picks" + (q ? ' matching "' + filterState.query.trim() + '"' : "") : "";
  }
}

// Changes the selected topic and updates the results.
function setTopic(topic) {
  filterState.topic = topic;
  document.querySelectorAll(".fchip").forEach(function (c) { c.classList.toggle("on", c.dataset.filter === topic); });
  applyFilters();
}

// Updates Save buttons and the saved count.
function refreshSaved() {
  document.querySelectorAll("[data-save]").forEach(function (b) {
    const on = saved.has(b.dataset.save);
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    const label = b.querySelector("span");
    if (label) label.textContent = on ? "Liked" : "Like";
  });
  const n = saved.size;
  ["saved-count", "liked-count"].forEach(function (id) { const el = document.getElementById(id); if (el) el.textContent = n; });
}

let toastTimer;
// Briefly shows a message on the page.
function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = text; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
}

// Scrolls smoothly to a page section.
function jumpTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Scrolls to the section in the URL after the page is built.
function scrollToHash() {
  var id = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (!id) return;
  var el = document.getElementById(id);
  if (el) requestAnimationFrame(function () { el.scrollIntoView({ block: "start" }); });
}
window.addEventListener("hashchange", scrollToHash);

// Opens a YouTube video in the popup.
function openVideo(index) {
  const item = ITEMS[index];
  if (!item || !item.videoId) return;
  document.getElementById("modal-frame").innerHTML =
    '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(item.videoId) + '?autoplay=1&rel=0" title="' + esc(item.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
  document.getElementById("modal-title").textContent = item.title;
  document.getElementById("modal-link").href = safeUrl(item.url).replace(/&amp;/g, "&");
  document.getElementById("modal").classList.add("open");
  document.getElementById("app").style.overflow = "hidden";
}
// Closes the popup and stops the video.
function closeVideo() {
  document.getElementById("modal").classList.remove("open");
  document.getElementById("modal-frame").innerHTML = "";
  document.getElementById("app").style.overflow = "";
}

// Animates the numbers in the introduction.
function countUp() {
  document.querySelectorAll("[data-count]").forEach(function (el) {
    const target = +el.dataset.count; const start = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - start) / 1100);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(start);
  });
}

// Shows cards as they scroll into view.
function reveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
  let fired = false;
  const io = new IntersectionObserver(function (entries) {
    fired = true;
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
  els.forEach(function (e) { io.observe(e); });
  // Safety net: if this browser never reports scrolling, just show everything.
  setTimeout(function () { if (!fired) els.forEach(function (e) { e.classList.add("in"); }); }, 1500);
}

// Connects the controls to their actions.
function wireUp() {
  refreshSaved(); applyFilters(); countUp(); reveal();
  const themeToggle = document.getElementById("brief-theme-toggle");
  if (themeToggle) {
    updateBriefThemeButton(themeToggle);
    themeToggle.addEventListener("click", function () {
      setBriefTheme(!document.body.classList.contains("dark"), true);
      updateBriefThemeButton(themeToggle);
    });
  }
  const nav = document.getElementById("nav");
  const scroller = document.getElementById("app");
  let backToTop = document.getElementById("back-to-top");
  if (!backToTop) {
    backToTop = document.createElement("button");
    backToTop.type = "button";
    backToTop.id = "back-to-top";
    backToTop.className = "back-to-top";
    backToTop.setAttribute("aria-label", "Back to top");
    backToTop.hidden = true;
    backToTop.innerHTML = '<span aria-hidden="true">↑</span>';
    document.body.appendChild(backToTop);
  }
  backToTop.onclick = function () {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };
  scroller.onscroll = function () {
    nav.classList.toggle("scrolled", scroller.scrollTop > 8);
    backToTop.hidden = scroller.scrollTop <= 800;
  };
  scroller.onscroll();
  const search = document.getElementById("search");
  if (search) search.addEventListener("input", function () { filterState.query = search.value; applyFilters(); });
  const form = document.getElementById("sub-form");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const input = form.querySelector('input[type="email"]');
    const button = form.querySelector('button[type="submit"]');
    const note = document.getElementById("sub-note");
    const trap = form.querySelector('input[name="company"]');
    if (trap && trap.value) return;

    let already = false;
    try { already = localStorage.getItem(SUBSCRIBED_KEY) === "1"; } catch (err) { already = false; }
    if (already) {
      note.textContent = "You're already subscribed on this device.";
      return;
    }

    const email = input.value.trim().toLowerCase();
    button.disabled = true;
    note.textContent = "Sending…";

    try {
      await fetch(
        "https://script.google.com/macros/s/AKfycbyx00UsgASEw0tnGsR0At-JDQrG4a5fGHihSKIANXiyLZu7nufCU8CuhiEYdcVjLPrGSg/exec",
        {
          method: "POST",
          mode: "no-cors",
          body: new URLSearchParams({ email: email })
        }
      );
      note.textContent = "Thanks for joining The Circuit! You're on the list.";
      form.reset();
      try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch (err) { /* private mode */ }
    } catch (error) {
      note.textContent = "Could not send. Please try again.";
    } finally {
      button.disabled = false;
    }
  });
}

const LIKES_URL = "https://script.google.com/macros/s/AKfycbzAKsbaQZBCjk2Nvy41X4u76dRuA36ayQN5ZEl5NDW-0K_3rMHmaBNNqFPy4SYAdeq4sA/exec";

function sendLikeToSheet(url) {
  const item =
    ITEMS.find(item => item.url === url) ||
    (ITEMS[-1] && ITEMS[-1].url === url ? ITEMS[-1] : null);

  if (!item) return;

  // Remember a random ID for this browser.
  let userId = "";
  try { userId = localStorage.getItem("circuit.userId") || ""; } catch (e) { userId = ""; }

  if (!userId) {
    try {
      userId = (window.crypto && typeof crypto.randomUUID === "function") ? crypto.randomUUID() : "";
    } catch (e) { userId = ""; }
    if (!userId) userId = String(Date.now() + Math.random());
    try { localStorage.setItem("circuit.userId", userId); } catch (e) { /* private mode */ }
  }

  // Send the title, URL, and current heart selection.
  fetch(LIKES_URL, {
    method: "POST",
    mode: "no-cors",
    body: new URLSearchParams({
      userId: userId,
      title: item.title,
      url: url,
      liked: String(saved.has(url))
    })
  }).catch(function (error) {
    console.error("Could not send the like:", error);
  });
}

// Toggles a heart and keeps the surrounding article link from opening.
function toggleLike(button) {
  const url = button.dataset.save;
  if (saved.has(url)) { saved.delete(url); toast("Removed from Liked Feedback"); }
  else { saved.add(url); toast("♥ LIKED! Thanks for you feedback!"); }
  persistSaved(); refreshSaved();
  sendLikeToSheet(url);
  if (filterState.topic === "saved") applyFilters();
}

// One click handler for everything clickable on the page.
document.addEventListener("click", function (e) {
  const save = e.target.closest("[data-save]");
  if (save) {
    e.preventDefault(); e.stopPropagation();
    toggleLike(save);
    return;
  }
  const video = e.target.closest("[data-video]");
  if (video) { e.preventDefault(); openVideo(+video.dataset.video); return; }
  const chip = e.target.closest("[data-filter]");
  if (chip) { setTopic(chip.dataset.filter); return; }
  if (e.target.closest("#saved-btn")) { setTopic("saved"); jumpTo("explore"); return; }
  const jump = e.target.closest("[data-jump]");
  if (jump) {
    e.preventDefault();
    const id = jump.dataset.jump;
    if (LABELS[id] && filterState.topic !== "all") setTopic("all");
    jumpTo(id); return;
  }
  if (e.target.id === "modal" || e.target.closest("#modal-close")) closeVideo();
});
// Escape closes videos; Enter or Space opens a selected video.
document.addEventListener("keydown", function (e) {
  const save = e.target.closest && e.target.closest("[data-save]");
  if (save && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) toggleLike(save);
    return;
  }
  if (e.key === "Escape") closeVideo();
  const vid = e.target.closest && e.target.closest("[data-video]");
  if (vid && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openVideo(+vid.dataset.video); }
});

const BRIEF_THEME_KEY = "lab-theme";
// Reads the theme saved in this browser.
function readBriefTheme() {
  try { return localStorage.getItem(BRIEF_THEME_KEY); } catch (e) { return null; }
}
// Switches the theme and optionally remembers it.
function setBriefTheme(dark, persist) {
  document.body.classList.toggle("dark", dark);
  if (persist) {
    try { localStorage.setItem(BRIEF_THEME_KEY, dark ? "dark" : "light"); } catch (e) { /* private mode */ }
  }
}
// Updates the theme button symbol and label.
function updateBriefThemeButton(button) {
  const dark = document.body.classList.contains("dark");
  button.textContent = dark ? "☀" : "☾";
  button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  button.setAttribute("aria-pressed", String(dark));
}

// Matches the scrolling area to the real site header height.
function syncHeaderOffset() {
  const header = document.querySelector(".lab-header");
  if (!header) return;
  document.documentElement.style.setProperty("--header-offset", header.offsetHeight + "px");
}
document.addEventListener("DOMContentLoaded", syncHeaderOffset);
window.addEventListener("load", syncHeaderOffset);
window.addEventListener("resize", syncHeaderOffset);
syncHeaderOffset();

// Applies the preferred theme, then builds the page from the data file.
const savedBriefTheme = readBriefTheme();
const prefersBriefDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
setBriefTheme(savedBriefTheme ? savedBriefTheme === "dark" : prefersBriefDark, false);
render(STATIC_NEWSLETTER_DATA);
