
(function(){
  const cards = Array.from(document.querySelectorAll('.preview-card'));
  const dots = Array.from(document.querySelectorAll('.progress-dot'));
  const scrollControl = document.getElementById('carouselScroll');
  if (!cards.length) return;

  let current = 0;
  let timer;

  function render(){
    cards.forEach((card, i) => {
      card.classList.remove('active','next','prev');
      card.tabIndex = i === current ? 0 : -1;
      card.setAttribute('aria-hidden', String(i !== current));
      const offset = (i - current + cards.length) % cards.length;
      card.classList.add(offset === 0 ? 'active' : offset === 1 ? 'next' : 'prev');
    });
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
    if (scrollControl) scrollControl.value = current;
  }

  function advance(){
    current = (current + 1) % cards.length;
    render();
  }

  function restart(){
    clearInterval(timer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(advance, 4200);
  }

  scrollControl?.addEventListener('input', () => {
    current = Number(scrollControl.value);
    render();
    restart();
  });

  const carousel = document.querySelector('.preview-carousel');
  carousel?.addEventListener('focusin', () => clearInterval(timer));
  carousel?.addEventListener('focusout', restart);
  carousel?.addEventListener('mouseenter', () => clearInterval(timer));
  carousel?.addEventListener('mouseleave', restart);

  render();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) restart();
})();
