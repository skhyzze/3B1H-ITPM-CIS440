
(function(){
  const cards = Array.from(document.querySelectorAll('.preview-card:not([hidden])'));
  const dots = Array.from(document.querySelectorAll('.progress-dot'));
  const scrollControl = document.getElementById('carouselScroll');
  if (!cards.length) return;

  if (scrollControl) scrollControl.max = String(cards.length - 1);

  let current = 0;
  let timer;
  let pausedByUser = false;

  function render(){
    cards.forEach((card, i) => {
      card.classList.remove('active','next','prev');
      card.tabIndex = i === current ? 0 : -1;
      card.setAttribute('aria-hidden', String(i !== current));
      const offset = (i - current + cards.length) % cards.length;
      card.classList.add(offset === 0 ? 'active' : offset === 1 ? 'next' : 'prev');
    });
    dots.forEach((dot, i) => {
      dot.hidden = i >= cards.length;
      dot.classList.toggle('active', i === current);
    });
    if (scrollControl) scrollControl.value = current;
  }

  function advance(){
    current = (current + 1) % cards.length;
    render();
  }

  function restart(){
    clearInterval(timer);
    if (pausedByUser) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(advance, 4200);
  }

  scrollControl?.addEventListener('input', () => {
    current = Number(scrollControl.value);
    render();
    restart();
  });

  const carousel = document.querySelector('.preview-carousel');
  const pauseButton = carousel?.querySelector('.carousel-pause');

  function setPauseButton(paused){
    if (!pauseButton) return;
    pauseButton.classList.toggle('is-paused', paused);
    pauseButton.setAttribute('aria-label', paused ? 'Play carousel' : 'Pause carousel');
  }

  pauseButton?.addEventListener('click', () => {
    pausedByUser = !pausedByUser;
    setPauseButton(pausedByUser);
    if (pausedByUser) clearInterval(timer);
    else restart();
  });

  carousel?.addEventListener('focusin', () => clearInterval(timer));
  carousel?.addEventListener('focusout', restart);
  carousel?.addEventListener('mouseenter', () => clearInterval(timer));
  carousel?.addEventListener('mouseleave', restart);

  render();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) restart();
})();

(function () {
  const nodes = Array.from(document.querySelectorAll('.page-home .reveal'));
  if (!nodes.length) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    nodes.forEach(function (node) { node.classList.add('is-in'); });
    return;
  }

  nodes.forEach(function (node) {
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) node.classList.add('is-in');
  });
  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { threshold: window.matchMedia('(max-width: 640px)').matches ? 0.08 : 0.18, rootMargin: '0px 0px -4% 0px' });

  nodes.forEach(function (node) { observer.observe(node); });
})();

(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', function (event) {
    const el = event.target.closest('a, button');
    if (!el || !el.closest('.page-home')) return;
    if (el.closest('.lab-header')) return;
    if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return;
    if (el.classList.contains('skip-link')) return;

    el.classList.remove('is-clicked');
    void el.offsetWidth;
    el.classList.add('is-clicked');
    window.setTimeout(function () { el.classList.remove('is-clicked'); }, 520);
  });
})();
