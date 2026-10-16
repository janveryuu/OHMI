const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

function selectTopic(topic, updateUrl = true) {
  const selected = tabs.find((tab) => tab.dataset.topic === topic) ?? tabs[0];
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== selected.getAttribute('aria-controls');
  if (updateUrl) {
    const panel = document.getElementById(selected.getAttribute('aria-controls'));
    panel.classList.remove('topic-enter');
    requestAnimationFrame(() => panel.classList.add('topic-enter'));
  }
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('preview', selected.dataset.topic);
    window.history.replaceState(null, '', url);
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTopic(tab.dataset.topic));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTopic(tabs[next].dataset.topic);
    tabs[next].focus();
  });
}

function restoreTopic() {
  selectTopic(new URL(window.location.href).searchParams.get('preview'), false);
}
restoreTopic();
window.addEventListener('popstate', restoreTopic);

const mascot = document.querySelector('.hero-mascot');
const hero = document.querySelector('.hero');
const gaze = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const eyes = [...document.querySelectorAll('.gaze-eyes>span')].map((element, i) => ({
  element, center:(i ? 772 : 480) / 1254, width:i ? 84 : 82, x:0, y:0,
}));
let gazeFrame = 0, lastTime = 0, pointer = null, heroVisible = true, eyeAssetsReady = false;

function animateGaze(time) {
  gazeFrame = 0;
  // Read once before writes; viewport coordinates remain correct through scroll and zoom.
  const rect = mascot.getBoundingClientRect();
  const active = pointer && gaze.matches && eyeAssetsReady && heroVisible && !document.hidden;
  const ease = 1 - Math.exp(-Math.min(time - (lastTime || time - 16), 64) / 75);
  lastTime = time;
  let unsettled = false;
  for (const eye of eyes) {
    const dx = active ? pointer.x - rect.left - rect.width * eye.center : 0;
    const dy = active ? pointer.y - rect.top - rect.height * (510 / 1254) : 0;
    const distance = Math.hypot(dx, dy, Math.max(220, rect.width * .65));
    const x = dx / distance * 12, y = dy / distance * 10;
    eye.x += (x - eye.x) * ease;
    eye.y += (y - eye.y) * ease;
    if (Math.abs(x - eye.x) + Math.abs(y - eye.y) > .015) unsettled = true;
    else { eye.x = x; eye.y = y; }
    eye.element.style.setProperty('--look-x', `${eye.x / eye.width * 100}%`);
    eye.element.style.setProperty('--look-y', `${eye.y / 126 * 100}%`);
  }
  if (unsettled) gazeFrame = requestAnimationFrame(animateGaze);
  else {
    lastTime = 0;
    if (!active) mascot.classList.remove('gaze-engaged');
  }
}
function requestGaze() {
  if (!gazeFrame) gazeFrame = requestAnimationFrame(animateGaze);
}
function restGaze(immediate = false) {
  pointer = null;
  if (!immediate) { requestGaze(); return; }
  cancelAnimationFrame(gazeFrame);
  gazeFrame = lastTime = 0;
  mascot.classList.remove('gaze-engaged');
  for (const eye of eyes) {
    eye.x = eye.y = 0;
    eye.element.style.removeProperty('--look-x');
    eye.element.style.removeProperty('--look-y');
  }
}
function syncMotion() {
  mascot.classList.toggle('gaze-ready', gaze.matches && eyeAssetsReady);
  document.documentElement.classList.toggle('motion-hidden', document.hidden);
  hero.classList.toggle('motion-paused', document.hidden || !heroVisible);
  restGaze(true);
}
syncMotion();
// Keep original art visible until every overlay is decoded; failed assets stay static.
Promise.all(['left','right'].flatMap((side) => ['face','mask','pupil'].map((part) => {
  const image = new Image();
  image.src = `assets/eye-${side}-${part}.png`;
  return image.decode();
}))).then(() => { eyeAssetsReady = true; syncMotion(); }).catch(() => {});
gaze.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
document.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') { restGaze(true); return; }
  if (!gaze.matches || !eyeAssetsReady || !heroVisible || document.hidden) return;
  pointer = { x:event.clientX, y:event.clientY };
  mascot.classList.add('gaze-engaged');
  requestGaze();
}, { passive:true });
document.addEventListener('pointerout', (event) => { if (!event.relatedTarget) restGaze(); });
window.addEventListener('blur', () => restGaze(true));
window.addEventListener('scroll', () => { if (pointer && gaze.matches && heroVisible) requestGaze(); }, { passive:true });
window.addEventListener('resize', () => { if (pointer) requestGaze(); }, { passive:true });

if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    hero.classList.toggle('motion-paused', !heroVisible || document.hidden);
    if (!heroVisible) restGaze(true);
  }).observe(hero);
  const reveals = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) {
      if (!reducedMotion.matches) entry.target.classList.add('scroll-reveal');
      reveals.unobserve(entry.target);
    }
  }, { threshold:.12 });
  document.querySelectorAll('.preview-intro,.preview-stage,.companion-heading,.setup-heading,.faq-section h2').forEach((element) => reveals.observe(element));
}
