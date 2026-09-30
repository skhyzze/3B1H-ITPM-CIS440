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
  let current = 0;

  function visibleCards() {
    if (window.matchMedia('(max-width: 640px)').matches) return 1;
    if (window.matchMedia('(max-width: 900px)').matches) return 2;
    return 3;
  }

  function maximumIndex() {
    return Math.max(0, cards.length - visibleCards());
  }

  function makeDots() {
    dots.innerHTML = '';
    for (let index = 0; index <= maximumIndex(); index += 1) {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show student fellows starting with profile ${index + 1}`);
      dot.addEventListener('click', function () {
        current = index;
        update();
      });
      dots.appendChild(dot);
    }
  }

  function update() {
    current = Math.min(current, maximumIndex());
    track.style.transform = `translateX(-${cards[current].offsetLeft}px)`;
    previous.disabled = current === 0;
    next.disabled = current === maximumIndex();

    const end = Math.min(cards.length, current + visibleCards());
    count.textContent = `${current + 1}–${end} of ${cards.length}`;
    status.textContent = `Showing student fellows ${current + 1} through ${end} of ${cards.length}`;

    cards.forEach(function (card, index) {
      card.setAttribute('aria-hidden', index < current || index >= end ? 'true' : 'false');
    });

    Array.from(dots.children).forEach(function (dot, index) {
      dot.classList.toggle('active', index === current);
      dot.setAttribute('aria-current', index === current ? 'true' : 'false');
    });
  }

  previous.addEventListener('click', function () {
    current -= 1;
    update();
  });

  next.addEventListener('click', function () {
    current += 1;
    update();
  });

  carousel.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft' && current > 0) {
      current -= 1;
      update();
    }
    if (event.key === 'ArrowRight' && current < maximumIndex()) {
      current += 1;
      update();
    }
  });

  window.addEventListener('resize', function () {
    makeDots();
    update();
  });

  makeDots();
  update();
})();
