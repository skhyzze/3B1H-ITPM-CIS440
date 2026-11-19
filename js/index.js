/* Public snapshots contain only consented, approved and published content. */
window.LAB_HOME_HIGHLIGHTS_READY=(async function(){
  const stage=document.querySelector('.carousel-stage');if(!stage)return;
  const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  const clean=value=>typeof value==='string'&&!/^\s*\[|add a short, student-approved|^add the project title/i.test(value)?value:'';
  const configs=[
    {feed:'events',page:'event.html',title:'Upcoming event',description:r=>r.summary,heading:r=>r.title,anchor:'upcoming'},
    {feed:'fellows',page:'fellowship.html',title:'Student fellow',description:r=>clean(r.bio)||clean(r.projectDescription)||r.role,heading:r=>r.name,anchor:'fellows'},
    {feed:'projects',page:'studentoutcomes.html',title:'Student outcome',description:r=>r.description,heading:r=>r.title,anchor:'work'}
  ];
  await Promise.all(configs.map(async cfg=>{
    const template=Array.from(stage.querySelectorAll('.preview-card')).find(card=>card.getAttribute('href')===cfg.page);
    if(!template)return;
    template.querySelector('.preview-image')?.remove();template.classList.add('without-photo');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('data/cms-'+cfg.feed+'.json',{credentials:'omit',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('Unavailable');const data=await response.json();
      if(!Array.isArray(data[cfg.feed]))return;
      const groups=new Set();
      const first=data[cfg.feed].filter(row=>{
        if(!row||Number(row.displayOrder)!==1||!clean(cfg.heading(row)))return false;
        if(cfg.feed==='events'&&row.sample&&!document.documentElement.hasAttribute('data-show-unfinished'))return false;
        const group=cfg.feed==='fellows'?'fellows':row.category;
        if(groups.has(group))return false;groups.add(group);return true;
      });
      if(!first.length)return;
      const cards=first.map(row=>{
        const card=template.cloneNode(true);card.dataset.cmsFeed=cfg.feed;card.dataset.displayOrder='1';
        card.querySelector('h2').textContent=cfg.heading(row);
        card.querySelector('p').textContent=clean(cfg.description(row));
        card.querySelector('.preview-link').textContent=cfg.feed==='fellows'?'Meet the fellows ↗':cfg.feed==='events'?'Explore events ↗':'Explore student outcomes ↗';
        const section=cfg.feed==='projects'?({spotlight:'work',cis267:'cis440',people:'people',faculty:'people',highlights:'highlights'}[row.category]||'work'):cfg.anchor;
        card.href=cfg.page+'#'+section;
        const src=safeUrl(row.image);
        if(src){
          const frame=document.createElement('div');frame.className='preview-image';const img=document.createElement('img');img.src=src;img.alt=cfg.heading(row);img.decoding='async';img.referrerPolicy='no-referrer';
          img.addEventListener('error',()=>{frame.remove();card.classList.add('without-photo');},{once:true});
          frame.append(img);card.insertBefore(frame,card.querySelector('h2').parentElement);card.classList.remove('without-photo');
        }
        return card;
      });
      template.replaceWith(...cards);
    }catch(error){/* Keep the existing page link when a feed cannot be reached. */}
    finally{clearTimeout(timer);}
  }));
  const labels={events:'EVENTS',fellows:'FELLOWS',projects:'STUDENT OUTCOMES'};
  Array.from(stage.querySelectorAll('.preview-card:not([hidden])')).forEach((card,i)=>{
    if(card.dataset.cmsFeed)card.querySelector('.preview-type').textContent=String(i+1).padStart(2,'0')+' / '+labels[card.dataset.cmsFeed];
  });
})();


(async function(){
  await window.LAB_HOME_HIGHLIGHTS_READY;
  const cards = Array.from(document.querySelectorAll('.preview-card:not([hidden])'));
  const progress=document.querySelector('.carousel-progress');
  if(progress){progress.replaceChildren(...cards.map(()=>{const dot=document.createElement('span');dot.className='progress-dot';return dot;}));}
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
    pauseButton.setAttribute('aria-pressed', String(paused));
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
