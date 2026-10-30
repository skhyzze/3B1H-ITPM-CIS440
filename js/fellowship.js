(function () {
  const carousel = document.querySelector('.carousel');
  const track = document.getElementById('fellowTrack');
  if (!carousel || !track) return;

  const cards = Array.from(track.children);
  const previous = document.getElementById('fellowPrev');
  const next = document.getElementById('fellowNext');
  const dots = document.getElementById('fellowDots');
  const count = document.getElementById('fellowCount');
  const status = document.getElementById('fellowStatus');
  const progress = document.getElementById('fellowProgress');
  const viewport = carousel.querySelector('.carousel-viewport');
  const optionCount = Math.min(3, Math.max(0, cards.length - 1));
  let current = 0;
  let swipeStartX = null;
  let motionTimer;

  function normalize(index) {
    return (index + cards.length) % cards.length;
  }

  function visibleIndices() {
    return Array.from({ length: optionCount + 1 }, function (_, offset) {
      return normalize(current + offset);
    });
  }

  function makeDots() {
    dots.innerHTML = '';
    cards.forEach(function (card, index) {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Feature student profile ${index + 1}`);
      dot.addEventListener('click', function () {
        const direction = index >= current ? 'next' : 'previous';
        current = index;
        update(true, direction);
      });
      dots.appendChild(dot);
    });
  }

  function update(animate, direction) {
    const visible = visibleIndices();

    window.clearTimeout(motionTimer);
    track.classList.remove('is-shifting-next', 'is-shifting-previous');

    cards.forEach(function (card, index) {
      const position = visible.indexOf(index);
      const active = index === current;
      const option = position > 0;
      const studentName = card.querySelector('h3')?.textContent || `Student ${index + 1}`;

      card.classList.toggle('is-visible', position >= 0);
      card.classList.toggle('is-active', active);
      card.classList.toggle('is-option', option);
      card.style.order = position >= 0 ? String(position) : '';
      card.setAttribute('aria-hidden', position >= 0 ? 'false' : 'true');

      if (option) {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Feature ${studentName}, profile ${index + 1}`);
        card.removeAttribute('aria-current');
      } else {
        card.removeAttribute('role');
        card.setAttribute('tabindex', '-1');
        card.removeAttribute('aria-label');
        if (active) card.setAttribute('aria-current', 'true');
        else card.removeAttribute('aria-current');
      }
    });

    if (animate) {
      void track.offsetWidth;
      requestAnimationFrame(function () {
        track.classList.add(direction === 'previous' ? 'is-shifting-previous' : 'is-shifting-next');
      });
      motionTimer = window.setTimeout(function () {
        track.classList.remove('is-shifting-next', 'is-shifting-previous');
      }, 500);
    }

    previous.disabled = cards.length < 2;
    next.disabled = cards.length < 2;
    count.textContent = `${current + 1} of ${cards.length}`;
    status.textContent = `Student profile ${current + 1} is featured. Select one of the next ${optionCount} profiles to change the feature.`;
    if (progress) progress.style.width = `${((current + 1) / cards.length) * 100}%`;

    Array.from(dots.children).forEach(function (dot, index) {
      dot.classList.toggle('active', index === current);
      dot.setAttribute('aria-current', index === current ? 'true' : 'false');
    });
  }

  cards.forEach(function (card, index) {
    card.addEventListener('click', function () {
      if (!card.classList.contains('is-option')) return;
      current = index;
      update(true, 'next');
    });

    card.addEventListener('keydown', function (event) {
      if (!card.classList.contains('is-option')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        current = index;
        update(true, 'next');
      }
    });
  });

  previous.addEventListener('click', function () {
    current = normalize(current - 1);
    update(true, 'previous');
  });

  next.addEventListener('click', function () {
    current = normalize(current + 1);
    update(true, 'next');
  });

  carousel.addEventListener('keydown', function (event) {
    if (event.target !== carousel) return;
    if (event.key === 'ArrowLeft') {
      current = normalize(current - 1);
      update(true, 'previous');
    }
    if (event.key === 'ArrowRight') {
      current = normalize(current + 1);
      update(true, 'next');
    }
  });

  if (viewport) {
    viewport.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      swipeStartX = event.clientX;
      viewport.classList.add('is-swiping');
    });

    viewport.addEventListener('pointerup', function (event) {
      if (swipeStartX === null) return;
      const distance = event.clientX - swipeStartX;
      swipeStartX = null;
      viewport.classList.remove('is-swiping');

      if (Math.abs(distance) < 48) return;
      current = normalize(current + (distance < 0 ? 1 : -1));
      update(true, distance < 0 ? 'next' : 'previous');
    });

    viewport.addEventListener('pointercancel', function () {
      swipeStartX = null;
      viewport.classList.remove('is-swiping');
    });
  }

  makeDots();
  update(false);
})();

(function () {
  const pathwayButtons = Array.from(document.querySelectorAll('[data-pathway-target]'));
  if (!pathwayButtons.length) return;

  pathwayButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const target = document.querySelector(button.dataset.pathwayTarget);
      if (!target) return;

      pathwayButtons.forEach(function (item) {
        const active = item === button;
        item.classList.toggle('is-active', active);
        if (active) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
      });

      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  });
})();

(function () {
  const signalButtons = Array.from(document.querySelectorAll('.signal-item'));
  const detail = document.getElementById('signalDetail');
  const detailTitle = detail && detail.querySelector('strong');
  if (!signalButtons.length || !detailTitle) return;

  signalButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      signalButtons.forEach(function (item) {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-expanded', String(active));
      });
      detailTitle.textContent = button.dataset.signalTitle;
    });
  });
})();
