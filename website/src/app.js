import { createScene } from './scene.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const entrance = [];
const rise = (element, delay, y = 25, duration = 780, blur = 0) => {
  if (!element || reduce.matches) return;
  entrance.push(element.animate([
    { opacity: 0, transform: `translateY(${y}px)`, filter: `blur(${blur}px)` },
    { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
  ], { duration, delay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
};

// Defaults remain visible if JS or font loading fails.
const ready = Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 900))]);
ready.then(() => {
  rise(document.querySelector('.brand'), 0, -22, 850);
  rise(document.querySelector('.desktop-nav'), 80, -22, 850);
  rise(document.querySelector('.header-actions'), 150, -22, 850);
  rise(document.querySelector('.kicker'), 220, 8, 850, 8);
  document.querySelectorAll('.headline-line').forEach((line, i) => rise(line, 340 + i * 160, 55, 1050, 9));
  rise(document.querySelector('.hero-description'), 700, 20, 850);
  document.querySelectorAll('.hero-actions .pill').forEach((pill, i) => rise(pill, 850 + i * 100, 18, 800));
  rise(document.querySelector('.section-top'), 1080, 22, 850);
  document.querySelectorAll('.feature-card').forEach((card, i) => rise(card, 1180 + i * 100, 32, 900));
});
const reveals = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    rise(entry.target, 0, 26, 850);
    reveals.unobserve(entry.target);
  }
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(section => reveals.observe(section));
reduce.addEventListener('change', () => { if (reduce.matches) entrance.forEach(animation => animation.finish()); });

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu(returnFocus = false) {
  mobileNav.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.textContent = 'Menu';
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => {
  const opening = mobileNav.hidden;
  mobileNav.hidden = !opening;
  menuButton.setAttribute('aria-expanded', String(opening));
  menuButton.textContent = opening ? 'Close' : 'Menu';
});
mobileNav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) closeMenu(true); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header') && !mobileNav.hidden) closeMenu(); });
matchMedia('(min-width: 821px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const samples = {
  led: ['A resistor limits current through the LED. Without one, too much current can damage it.', 'Start with the LED’s datasheet and your supply voltage. Then use R = (Vsupply − VLED) / I to choose a suitable resistance.'],
  arduino: ['digitalWrite(pin, HIGH) sets a configured digital output pin high. LOW sets it low.', 'Use pinMode(pin, OUTPUT) first. The voltage and current limits depend on your board, so check its specifications before connecting a component.'],
  build: ['Start with the goal: what should your circuit do? Then list your power source and components.', 'For a first LED circuit, identify the LED’s anode and cathode, choose a current-limiting resistor, and check polarity before powering it.'],
};
document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-question]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  const answer = document.querySelector('#preview-answer');
  answer.replaceChildren(...samples[button.dataset.question].map(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
  if (!reduce.matches) answer.animate([{ opacity: .25, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
}));

createScene(document.querySelector('#scene-motion'), document.querySelector('#scene-poster'), document.querySelector('#motion-toggle'));
