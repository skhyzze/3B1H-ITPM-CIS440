window.LAB_FELLOWS_READY=(async function(){
  const track=document.getElementById('fellowTrack');
  const status=document.getElementById('fellowStatus');
  const parked=Array.from(track.querySelectorAll('article.fellow-card'));
  track.setAttribute('aria-busy','true');
  if(!parked.length) status.textContent='Loading student fellows…';
  const url='data/cms-fellows.json';
  function node(tag,cls,text){const el=document.createElement(tag);el.className=cls;el.textContent=typeof text==='string'?text:'';return el;}
  function unfinishedCopy(text){return typeof text==='string'&&(/^\s*\[/.test(text)||/add a short, student-approved/i.test(text)||/^add the project title/i.test(text));}
  function pending(el,text){if(unfinishedCopy(text))el.setAttribute('data-unfinished','');return el;}
  function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
  const controller=new AbortController();
  const timer=setTimeout(function(){controller.abort();},20000);
  try {
    const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error();
    const data=await response.json();if(data.error||!Array.isArray(data.fellows))throw Error();
    track.replaceChildren();
    data.fellows.sort((a,b)=>Number(a.displayOrder||999999)-Number(b.displayOrder||999999)).forEach((f,i)=>{
      if(!f || typeof f.name!=='string' || !f.name.trim())return;
      const card=node('article','fellow-card','');
      const initials=node('div','initials',f.initials||f.name.split(/\s+/).map(n=>n[0]).join('').slice(0,2));initials.setAttribute('aria-hidden','true');
      let portrait=initials;
      const photo=safeUrl(f.image);
      if(photo){
        portrait=node('div','fellow-portrait','');
        const img=document.createElement('img');img.src=photo;img.alt=f.name;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
        img.addEventListener('error',()=>portrait.replaceWith(initials),{once:true});portrait.append(img);
      }
      card.append(node('div','card-index',String(i+1).padStart(2,'0')),portrait,node('h3','',f.name),node('p','fellow-role',f.role));
      if(f.bio)card.append(pending(node('p','fellow-focus',f.bio),f.bio));
      if(f.projectLabel||f.projectTitle||f.projectDescription||f.url){
        const project=node('p','fellow-project','');
        if(f.projectLabel)project.append(node('span','',f.projectLabel));
        if(f.projectTitle)project.append(node('strong','',f.projectTitle));
        project.append(document.createTextNode(' '+(f.projectDescription||'')+' '));
        if(unfinishedCopy(f.projectDescription)||unfinishedCopy(f.projectTitle))project.setAttribute('data-unfinished','');
        const href=safeUrl(f.url);if(href){const link=node('a','',f.linkLabel||'View project ↗');link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',link.textContent+': '+f.name);project.append(link);}
        card.append(project);
      }
      track.append(card);
    });
    if(!track.children.length){clearTimeout(timer);if(parked.length){track.replaceChildren(...parked);track.setAttribute('aria-busy','false');return true;}status.textContent='No published student fellows yet.';const p=node('p','','No published student fellows yet.');track.append(p);track.setAttribute('aria-busy','false');return false;}
    clearTimeout(timer);
    track.setAttribute('aria-busy','false');
    return true;
  } catch(error){
    clearTimeout(timer);
    if(parked.length){track.replaceChildren(...parked);track.setAttribute('aria-busy','false');status.textContent='';return true;}
    const message=node('p','','Student fellows are temporarily unavailable. Please reload to try again.');message.setAttribute('role','status');track.append(message);
    document.getElementById('fellowPrev').disabled=true;document.getElementById('fellowNext').disabled=true;
    status.textContent='Student fellows are temporarily unavailable.';
    track.setAttribute('aria-busy','false');
    return false;
  }
})();

(async function () {
  if(!await window.LAB_FELLOWS_READY) return;
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
  const steps = Array.from(document.querySelectorAll('.path-step'));
  if (!steps.length) return;

  steps.forEach(function (step) {
    step.addEventListener('click', function () {
      steps.forEach(function (item) {
        const selected = item === step;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-expanded', String(selected));
        const panel = document.getElementById(item.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
    });
  });
})();

(function () {
  const nodes = Array.from(document.querySelectorAll('.about-fellowship .reveal, .ideal-candidates .reveal, .fellow-skills .reveal, .how-to-become .reveal'));
  const fellowsHeading = document.querySelector('#fellows .section-heading');
  if (fellowsHeading) {
    fellowsHeading.classList.add('reveal');
    nodes.push(fellowsHeading);
  }
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
    if (!el || !el.closest('.page-fellowship')) return;
    if (el.classList.contains('fellow-card') || el.closest('.fellow-card')) return;
    if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return;
    if (el.classList.contains('skip-link')) return;

    el.classList.remove('is-clicked');
    void el.offsetWidth;
    el.classList.add('is-clicked');
    window.setTimeout(function () { el.classList.remove('is-clicked'); }, 520);
  });
})();
