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
