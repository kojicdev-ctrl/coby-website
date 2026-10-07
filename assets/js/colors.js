// Paleta boja na stranici proizvoda: menja sliku i dodaje izabranu boju u upit na WhatsApp.
import { state, setColor, subscribe, productById, colorOf } from './store.js';
import { pick } from './i18n.js';
import { initWhatsApp } from './whatsapp.js';

export function initColors() {
  const box = document.querySelector('.colorway');
  const product = productById(box.dataset.product);
  const swatches = box.querySelector('.swatches');
  const nameEl = box.querySelector('.colorway-name');
  const img = box.querySelector('.colorway-media img');
  const defaultSrc = img.getAttribute('src');
  let shownSrc = defaultSrc;

  function build() {
    swatches.innerHTML = product.colors.map(c => `
      <button type="button" class="swatch" role="radio" style="--c:${c.hex}" data-color="${c.id}"
        aria-label="${pick(c.name)}" aria-checked="false"></button>`).join('');
  }

  function showImage(src) {
    if (src === shownSrc) return;
    shownSrc = src;
    const next = new Image();
    next.src = src;
    next.decode().catch(() => {}).then(() => {
      if (src !== shownSrc) return;
      img.classList.add('is-fading');
      setTimeout(() => {
        img.src = src;
        img.classList.remove('is-fading');
      }, 180);
    });
  }

  function sync() {
    const selected = colorOf(product, state.colors[product.id]);
    const label = pick(selected.name);
    swatches.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-checked', String(b.dataset.color === selected.id)));
    nameEl.textContent = label;
    img.alt = `${pick(product.name)} — ${label}`;
    document.querySelectorAll('[data-wa-color]').forEach(a => { a.dataset.waColor = label; });
    initWhatsApp();
    showImage(selected.image || defaultSrc);
  }

  swatches.addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (b) setColor(product.id, b.dataset.color);
  });

  build();
  sync();
  subscribe((st, patch) => {
    if (patch.lang) build();
    if (patch.lang || patch.colors) sync();
  });
}
