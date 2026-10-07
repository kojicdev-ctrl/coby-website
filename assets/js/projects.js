// Realizovani projekti (horizontalni swipe).
import { CONFIG } from './config.js';
import { subscribe } from './store.js';
import { t, pick } from './i18n.js';

export function initProjects() {
  const track = document.querySelector('.projects-track');

  const render = () => {
    track.innerHTML = CONFIG.projects.map(p => p.image
      ? `<figure class="project">
          <img src="${p.image}" alt="${pick(p.title)}" loading="lazy" decoding="async">
          <figcaption>
            <span class="project-tag">${t('filter.' + p.category)}</span>
            <strong>${pick(p.title)}</strong>
            <span>${pick(p.meta)}</span>
          </figcaption>
        </figure>`
      : `<figure class="project project-empty">
          <div class="project-empty-mark" aria-hidden="true">JSK</div>
          <figcaption>
            <span class="project-tag">${t('filter.' + p.category)}</span>
            <strong>${t('projects.soon')}</strong>
          </figcaption>
        </figure>`).join('');
  };

  render();
  subscribe((st, patch) => { if (patch.lang) render(); });
}
