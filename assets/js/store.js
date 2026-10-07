// Zajedničko stanje: jezik i izabrane boje.
import { CONFIG } from './config.js';

const listeners = new Set();

export const state = {
  lang: readLang(),
  colors: Object.fromEntries(CONFIG.products.map(p => [p.id, p.colors[0].id])),
};

export function set(patch) {
  Object.assign(state, patch);
  if (patch.lang) {
    try { localStorage.setItem('jsk-lang', patch.lang); } catch {}
  }
  listeners.forEach(fn => fn(state, patch));
}

export function setColor(productId, colorId) {
  set({ colors: { ...state.colors, [productId]: colorId } });
}

export function subscribe(fn) {
  listeners.add(fn);
}

export const productById = id => CONFIG.products.find(p => p.id === id);
export const colorOf = (product, id) => product.colors.find(c => c.id === id) || product.colors[0];

function readLang() {
  try {
    const saved = localStorage.getItem('jsk-lang');
    if (saved === 'sr' || saved === 'en') return saved;
  } catch {}
  return 'sr';
}
