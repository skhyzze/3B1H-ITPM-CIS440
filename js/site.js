(function () {
  const themeButton = document.getElementById('themeToggle');

  function readSavedTheme() {
    try {
      return localStorage.getItem('lab-theme');
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem('lab-theme', theme);
    } catch (error) {
    }
  }

  function setTheme(dark) {
    document.body.classList.toggle('dark', dark);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', dark ? '#07121f' : '#f8f8f6');
    }

    if (themeButton) {
      themeButton.textContent = dark ? '☀' : '☾';
      themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeButton.setAttribute('aria-pressed', String(dark));
    }

    saveTheme(dark ? 'dark' : 'light');
  }

  const savedTheme = readSavedTheme();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

  if (themeButton) {
    themeButton.addEventListener('click', function () {
      setTheme(!document.body.classList.contains('dark'));
    });
  }

  const navLinks = document.querySelector('.lab-nav-links');

  if (navLinks && themeButton) {
    if (!navLinks.id) navLinks.id = 'lab-nav-links';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'lab-menu-toggle';
    menuButton.setAttribute('aria-label', 'Open menu');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-controls', navLinks.id);
    menuButton.innerHTML = '<span class="lab-menu-icon" aria-hidden="true"></span>';
    themeButton.parentNode.insertBefore(menuButton, themeButton);

    function setMenuOpen(open) {
      navLinks.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    menuButton.addEventListener('click', function () {
      setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false);
        menuButton.focus();
      }
    });

    navLinks.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenuOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setMenuOpen(false);
    });
  }

  const currentNavLink = navLinks && navLinks.querySelector('[aria-current="page"]');

  if (navLinks && currentNavLink && navLinks.scrollWidth > navLinks.clientWidth) {
    const navBounds = navLinks.getBoundingClientRect();
    const linkBounds = currentNavLink.getBoundingClientRect();
    const linkOffset = linkBounds.left - navBounds.left + navLinks.scrollLeft;

    navLinks.scrollLeft = Math.max(
      0,
      linkOffset - ((navLinks.clientWidth - linkBounds.width) / 2)
    );
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('.lab-brand[data-logo-animated]').forEach(function (brand) {
    const animatedLogo = brand.querySelector('.lab-brand-image-animated');
    const animationSource = brand.dataset.logoAnimated;
    const animationDuration = Number(brand.dataset.logoDuration) || 2700;
    const revealDelay = 40;
    let animationTimer;
    let cleanupTimer;
    let revealTimer;
    let playToken = 0;

    if (!animatedLogo || !animationSource) return;

    function finishAnimation() {
      window.clearTimeout(animationTimer);
      window.clearTimeout(cleanupTimer);
      window.clearTimeout(revealTimer);
      playToken += 1;
      brand.classList.remove('is-animating');
      brand.classList.add('is-returning');
      animatedLogo.onload = null;
      animatedLogo.onerror = null;

      cleanupTimer = window.setTimeout(function () {
        brand.classList.remove('is-returning');
        brand.removeAttribute('data-logo-playing');
        animatedLogo.removeAttribute('src');
      }, reducedMotion.matches ? 0 : 160);
    }

    function playAnimation() {
      if (reducedMotion.matches || brand.hasAttribute('data-logo-playing')) return;

      brand.setAttribute('data-logo-playing', '');
      animatedLogo.removeAttribute('src');
      const currentPlay = ++playToken;

      animatedLogo.onload = function () {
        if (currentPlay !== playToken) return;

        revealTimer = window.setTimeout(function () {
          if (currentPlay !== playToken) return;

          brand.classList.add('is-animating');
          animationTimer = window.setTimeout(finishAnimation, animationDuration);
        }, revealDelay);
      };

      animatedLogo.onerror = finishAnimation;

      window.requestAnimationFrame(function () {
        if (currentPlay !== playToken) return;
        animatedLogo.src = animationSource;
      });
    }

    brand.addEventListener('pointerenter', playAnimation);
    brand.addEventListener('focus', playAnimation);
  });

})();

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skipPage = document.body.classList.contains('page-home') || document.body.classList.contains('page-fellowship');
  const cardSelector = '.audience, .resource, .community-card, .explore-card, .logic-card, .value-card, .collaboration-item, .partner-card, .event-card, .past-card, .cis-card, .feature, .fellow-card, .candidate-card, .skill-card, .submission-copy, .spotlight-card, .step, .story:not(.lead), .lesson, .case, .tool-row, .paper, .preview-card';
  const seen = new WeakSet();

  function press(card) {
    if (reduce || !card) return;
    card.classList.remove('is-pressed');
    void card.offsetWidth;
    card.classList.add('is-pressed');
    window.setTimeout(function () { card.classList.remove('is-pressed'); }, 460);
  }

  document.addEventListener('click', function (event) {
    press(event.target.closest(cardSelector));
  });

  if (skipPage || reduce || !('IntersectionObserver' in window)) return;

  const headingSelector = 'main h1, main h2, #app h1, #app h2';
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: window.matchMedia('(max-width: 640px)').matches ? 0.08 : 0.16, rootMargin: '0px 0px -4% 0px' });

  function arm(node) {
    if (!node || node.nodeType !== 1 || seen.has(node)) return;
    if (node.closest('.lab-header, .lab-site-footer')) return;
    if (node.matches('h1, h2') && node.closest(cardSelector)) return;
    seen.add(node);
    node.classList.add('lab-reveal');
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) node.classList.add('is-in');
    else observer.observe(node);
  }

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(headingSelector).forEach(function (heading) {
      if (heading.closest(cardSelector)) return;
      arm(heading);
    });
    scope.querySelectorAll(cardSelector).forEach(arm);
  }

  scan(document);
  document.documentElement.classList.add('lab-motion');
  const changes = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (!node || node.nodeType !== 1) return;
        if (node.matches && (node.matches(cardSelector) || node.matches(headingSelector))) arm(node);
        if (node.querySelectorAll) scan(node);
      });
    });
  });
  const app = document.getElementById('app') || document.body;
  changes.observe(app, { childList: true, subtree: true });
})();

// function openSpanishTranslation() {
//   const translatedPage =
//     "https://translate.google.com/translate?sl=en&tl=es&u=" +
//     encodeURIComponent(window.location.href);

//   window.open(translatedPage, "_blank", "noopener,noreferrer");
// }