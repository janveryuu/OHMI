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
const gaze = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
let gazeFrame = 0;
let pointer;
function resetGaze() {
  cancelAnimationFrame(gazeFrame);
  gazeFrame = 0;
  mascot.style.removeProperty('--look-x');
  mascot.style.removeProperty('--look-y');
  mascot.classList.toggle('gaze-ready', gaze.matches);
}
resetGaze();
gaze.addEventListener('change', resetGaze);
document.addEventListener('pointermove', (event) => {
  if (!gaze.matches || event.pointerType !== 'mouse') return;
  pointer = { x:event.clientX, y:event.clientY };
  if (gazeFrame) return;
  gazeFrame = requestAnimationFrame(() => {
    gazeFrame = 0;
    const rect = mascot.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (pointer.x - rect.x - rect.width / 2) / (innerWidth / 2)));
    const y = Math.max(-1, Math.min(1, (pointer.y - rect.y - rect.height * .38) / (innerHeight / 2)));
    mascot.style.setProperty('--look-x', `${x * rect.width * .004}px`);
    mascot.style.setProperty('--look-y', `${y * rect.width * .003}px`);
  });
}, { passive:true });
document.addEventListener('pointerout', (event) => { if (!event.relatedTarget) resetGaze(); });
window.addEventListener('blur', resetGaze);
