// Light / dark toggle for the review desk. Same behavior and storage key as the website's js/site.js.
(function () {
  'use strict';
  const button = document.getElementById('themeToggle');
  if (!button) return;

  function apply(dark) {
    document.body.classList.toggle('dark', dark);
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    button.setAttribute('aria-pressed', String(dark));
  }

  apply(document.body.classList.contains('dark'));
  button.addEventListener('click', function () {
    const dark = !document.body.classList.contains('dark');
    apply(dark);
    try { localStorage.setItem('lab-theme', dark ? 'dark' : 'light'); } catch (error) { /* private mode */ }
  });
})();
