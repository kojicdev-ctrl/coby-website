// Premium efekti SAMO za računare (miš + širok ekran). Na telefonu se ovaj fajl uopšte ne učitava.
//  - kartice se blago naginju prema mišu i imaju svetli odsjaj koji prati miša
//  - elementi se pojavljuju uz blagu animaciju kad se skroluje do njih
const CARDS = '.card, .project:not(.project-empty), .feature, .service, .more-link';
const TILT = '.card, .project:not(.project-empty)';
const MAX_TILT = 5; // stepeni

export function initFx() {
  const root = document.documentElement;
  root.classList.add('fx');

  // ---- Odsjaj i naginjanje (jedan slušalac za sve kartice, i one koje se naknadno ubace) ----
  let el = null, raf = 0, ev = null;
  const apply = () => {
    raf = 0;
    if (!el || !ev) return;
    const r = el.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    el.style.setProperty('--mx', x + 'px');
    el.style.setProperty('--my', y + 'px');
    if (el.matches(TILT)) {
      el.style.setProperty('--ry', ((x / r.width - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y / r.height) * 2 * MAX_TILT).toFixed(2) + 'deg');
    }
  };
  const reset = node => {
    node.style.removeProperty('--rx');
    node.style.removeProperty('--ry');
    node.classList.remove('is-hot');
  };
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const hit = e.target.closest?.(CARDS) || null;
    if (hit !== el) {
      if (el) reset(el);
      el = hit;
      if (el) el.classList.add('is-hot');
    }
    ev = e;
    if (el && !raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { if (el) reset(el); el = null; });

  // ---- Pojavljivanje pri skrolu ----
  const groups = [
    '.section h2, .section .eyebrow, .section > .wrap > .lead, .about > div, .firm',
    '.cards .card', '.features .feature', '.services .service', '.steps li', '.more-links .more-link', '.points li', '.badge',
  ];
  const seen = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); seen.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  groups.forEach(sel => document.querySelectorAll(sel).forEach((node, i) => {
    if (node.closest('.hero') || node.closest('.page-hero')) return;
    node.classList.add('reveal');
    node.style.setProperty('--d', Math.min(i, 5) * 90 + 'ms');
    seen.observe(node);
  }));
}
