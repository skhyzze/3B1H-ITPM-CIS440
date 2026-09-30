(function () {
  const themeButton = document.getElementById('themeToggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

  document.querySelectorAll('.logo-trigger').forEach(function (trigger) {
    const logo = trigger.querySelector('.js-hover-logo');
    if (!logo) return;

    const staticLogo = logo.dataset.staticLogo;
    const animatedLogo = logo.dataset.animatedLogo;
    const preload = new Image();
    preload.src = animatedLogo;

    function playLogo() {
      if (reduceMotion.matches) return;
      logo.removeAttribute('src');
      requestAnimationFrame(function () {
        logo.src = animatedLogo;
      });
    }

    function stopLogo() {
      logo.src = staticLogo;
    }

    trigger.addEventListener('mouseenter', playLogo);
    trigger.addEventListener('mouseleave', stopLogo);
    trigger.addEventListener('focus', playLogo);
    trigger.addEventListener('blur', stopLogo);
  });
})();
