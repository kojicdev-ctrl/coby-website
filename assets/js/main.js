import { state, set, subscribe } from './store.js';
import { applyI18n, t } from './i18n.js';
import { initWhatsApp } from './whatsapp.js';

// Isti skripta radi na svim stranicama; svaki deo se pokreće samo ako ima svoj element.
const has = sel => document.querySelector(sel);

applyI18n();
initMenu();
initWhatsApp();

if (has('.projects-track')) import('./projects.js').then(m => { m.initProjects(); realignHash(); });
if (has('.colorway')) import('./colors.js').then(m => m.initColors());
if (has('#pocetak')) import('./hero.js').then(m => m.initHero()).catch(err => console.error('Hero animacija nije pokrenuta', err));

// Premium efekti samo za računare (miš); telefon ostaje lagan i ne učitava ih
if (matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1000px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  import('./fx.js').then(m => m.initFx()).catch(() => {});
}

subscribe((st, patch) => {
  if (patch.lang) {
    applyI18n();
    initWhatsApp();
  }
});

// Header postaje pun kad se izađe iz hero animacije (na ostalim stranicama je pun odmah)
const header = document.querySelector('.site-header');
const hero = document.getElementById('pocetak');
if (hero) {
  new IntersectionObserver(([entry]) => header.classList.toggle('is-solid', !entry.isIntersecting), {
    rootMargin: '0px 0px -100% 0px',
  }).observe(hero);
} else {
  header.classList.add('is-solid');
}

// Kartice projekata se crtaju posle učitavanja i pomeraju sekcije ispod; vrati #sekciju iz adrese na mesto
function realignHash() {
  if (!location.hash) return;
  document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
}

function initMenu() {
  const button = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');

  const toggle = open => {
    button.setAttribute('aria-expanded', String(open));
    button.dataset.i18nAttr = `aria-label:${open ? 'menu.close' : 'menu.open'}`;
    button.setAttribute('aria-label', t(open ? 'menu.close' : 'menu.open'));
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    document.documentElement.classList.toggle('menu-open', open);
  };

  button.addEventListener('click', () => toggle(button.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', e => { if (e.target.closest('a')) toggle(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });

  const langButtons = [...document.querySelectorAll('[data-lang]')];
  const langPill = document.querySelector('[data-lang-toggle]');
  const syncLang = () => {
    langButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    langPill.textContent = state.lang === 'sr' ? 'EN' : 'SR';
  };
  langButtons.forEach(b => b.addEventListener('click', () => set({ lang: b.dataset.lang })));
  langPill.addEventListener('click', () => set({ lang: state.lang === 'sr' ? 'en' : 'sr' }));
  subscribe((st, patch) => { if (patch.lang) syncLang(); });
  syncLang();
  toggle(false);
}
