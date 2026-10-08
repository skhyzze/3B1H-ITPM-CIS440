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
  const optionCount = Math.min(3, Math.max(0, cards.length - 1));
  let current = 0;

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
        current = index;
        update(true);
      });
      dots.appendChild(dot);
    });
  }

  function update(animate) {
    const visible = visibleIndices();

    cards.forEach(function (card, index) {
      const position = visible.indexOf(index);
      const active = index === current;
      const option = position > 0;
      const studentName = card.querySelector('h3')?.textContent || `Student ${index + 1}`;

      card.classList.toggle('is-visible', position >= 0);
      card.classList.toggle('is-active', active);
      card.classList.toggle('is-option', option);
      card.classList.remove('is-entering');
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
      requestAnimationFrame(function () {
        cards[current].classList.add('is-entering');
      });
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
      update(true);
    });

    card.addEventListener('keydown', function (event) {
      if (!card.classList.contains('is-option')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        current = index;
        update(true);
      }
    });
  });

  previous.addEventListener('click', function () {
    current = normalize(current - 1);
    update(true);
  });

  next.addEventListener('click', function () {
    current = normalize(current + 1);
    update(true);
  });

  carousel.addEventListener('keydown', function (event) {
    if (event.target !== carousel) return;
    if (event.key === 'ArrowLeft') {
      current = normalize(current - 1);
      update(true);
    }
    if (event.key === 'ArrowRight') {
      current = normalize(current + 1);
      update(true);
    }
  });

  makeDots();
  update(false);
})();
