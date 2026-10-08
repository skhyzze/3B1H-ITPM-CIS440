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

})();
