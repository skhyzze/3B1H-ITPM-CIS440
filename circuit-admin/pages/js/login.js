// Sign-in page for The Circuit review desk. The Worker checks the password.
(function () {
  'use strict';
  const form = document.getElementById('signin-form');
  const input = document.getElementById('password-input');
  const message = document.getElementById('signin-message');
  const button = form.querySelector('button[type="submit"]');

  function say(text, tone) {
    message.textContent = text;
    message.dataset.tone = tone || '';
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    button.disabled = true;
    say('Checking…');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input.value })
      });
      if (response.ok) {
        window.location.replace('/');
        return;
      }
      const body = await response.json().catch(function () { return {}; });
      say(body.error || 'Could not sign in. Try again.', 'error');
      input.select();
    } catch (error) {
      say('Could not reach the desk. Check your connection and try again.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  input.focus();
})();
