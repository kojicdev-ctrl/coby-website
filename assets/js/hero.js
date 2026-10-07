// Hero: frame-sequence na canvas-u, vođen skrolom. Skrol samo glatko vozi video od početka do kraja.
//
// Kako se postiže glatkoća:
//  1. Frejmovi se preuzimaju redom, počev od onog koji skrol trenutno traži (a ne grubo pa fino po celom videu).
//  2. U memoriji su dekodirani samo frejmovi oko trenutne pozicije (ImageBitmap). Svih ~226 dekodiranih ne staje u
//     keš browsera, pa bi se stalno dekodirali iznova usred skrola.
//  3. Ako tačan frejm još nije spreman, slika se meko preliva između dva najbliža dostupna umesto da zastane ili skoči.
//  4. Prikazana pozicija prati skrol oprugom (bez trzaja pri polasku, sa ograničenom brzinom).
//  5. Canvas se ne pravi iznova kad se na telefonu sakrije adresna traka.
import { CONFIG } from './config.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;

const SMOOTH_S = 0.14;                     // koliko meko (sekunde) slika sustiže skrol
const MAX_SPEED = 160;                     // najviše frejmova u sekundi, da brz potez ne preskoči ceo video
const FETCHERS = 6;                        // istovremena preuzimanja
const DECODERS = 3;                        // istovremena dekodiranja
const MAX_DECODED = coarse ? 32 : 48;      // koliko dekodiranih frejmova držimo u memoriji
const AHEAD = Math.round(MAX_DECODED * 0.6); // koliko frejmova unapred (u smeru skrola) dekodiramo
const NEAR = 14;                           // ovoliko frejmova oko pozicije se preuzima prvo
const SKELETON = 8;                        // posle toga, svaki 8. frejm preko celog videa

// Dva paketa frejmova: uspravni (telefon) i široki 16:9 (računar). Bira se prema obliku ekrana, a menja se i uživo
// (rotacija telefona, promena veličine prozora): stari paket se potpuno ugasi pre nego što počne novi.
export async function initHero() {
  const mq = window.matchMedia(CONFIG.hero.wide.media);
  let ac = null;
  let current = '';
  const start = () => {
    const base = mq.matches ? CONFIG.hero.wide.frames : CONFIG.hero.frames;
    if (base === current) return;
    ac?.abort();
    current = base;
    ac = new AbortController();
    return runHero(base, ac.signal);
  };
  mq.addEventListener('change', start);
  await start();
}

async function runHero(base, signal) {
  const section = document.getElementById('pocetak');
  const sticky = section.querySelector('.hero-sticky');
  const canvas = section.querySelector('.hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = section.querySelector('.hero-loader');
  const intro = section.querySelector('.intro');
  const { holdStart, holdEnd } = CONFIG.hero;

  let manifest;
  try {
    manifest = await fetch(base + 'manifest.json', { signal }).then(r => r.json());
  } catch (err) {
    if (signal.aborted) return;
    throw err;
  }
  if (signal.aborted) return;
  const { count, width: fw, height: fh } = manifest;
  loader.classList.remove('is-done');
  loader.style.setProperty('--p', 0);
  const frameUrl = i => `${base}${String(i + 1).padStart(4, '0')}.webp`;

  // ---------- Stanje ----------
  let target = 0;            // pozicija koju traži skrol (u frejmovima)
  let shown = 0;             // pozicija koja se trenutno prikazuje
  let vel = 0;               // brzina prikazane pozicije (frejmova/s)
  let dir = 1;               // smer kretanja: 1 napred, -1 nazad
  let initialized = false;
  let visible = true;
  let raf = 0;
  let lastNow = 0;
  let lastKey = '';
  let uiState = '';
  let drawnOnce = false;
  let pumpedAt = -1, pumpedDir = 0;

  // ---------- Preuzimanje (bajtovi) ----------
  const blobs = new Array(count).fill(null);
  const requested = new Uint8Array(count);
  const tries = new Uint8Array(count);
  let fetched = 0;
  let progressPct = -1;

  // Prvo ono što skrol traži (unapred, malo i unazad), zatim redak pregled celog videa, pa sve ostalo
  function pickFetch() {
    const cost = i => (i >= target ? i - target : (target - i) * 3);
    let best = -1, bestCost = Infinity;
    for (let i = 0; i < count; i++) {
      if (requested[i]) continue;
      const c = cost(i);
      if (c <= NEAR && c < bestCost) { best = i; bestCost = c; }
    }
    if (best >= 0) return best;
    for (let i = 0; i < count; i++) {
      if (requested[i] || !(i % SKELETON === 0 || i === count - 1)) continue;
      const c = cost(i);
      if (c < bestCost) { best = i; bestCost = c; }
    }
    if (best >= 0) return best;
    for (let i = 0; i < count; i++) {
      if (requested[i]) continue;
      const c = cost(i);
      if (c < bestCost) { best = i; bestCost = c; }
    }
    return best;
  }

  async function fetchWorker() {
    for (;;) {
      if (signal.aborted) return;
      const i = pickFetch();
      if (i < 0) return;
      requested[i] = 1;
      try {
        const res = await fetch(frameUrl(i), { signal });
        if (!res.ok) throw new Error(res.status);
        blobs[i] = await res.blob();
        fetched++;
        const pct = Math.floor((fetched / count) * 100);
        if (pct !== progressPct) {
          progressPct = pct;
          loader.style.setProperty('--p', fetched / count);
          if (fetched === count) loader.classList.add('is-done');
        }
        pump();
        if (Math.abs(i - shown) <= AHEAD) schedule();
      } catch {
        if (signal.aborted) return;
        if (++tries[i] < 3) {
          await new Promise(r => setTimeout(r, 800 * tries[i]));
          requested[i] = 0;
        }
      }
    }
  }

  // ---------- Dekodiranje (samo prozor oko pozicije) ----------
  const bitmaps = new Array(count).fill(null);
  const decoding = new Set();
  let decodedCount = 0;
  const hasBitmap = typeof createImageBitmap === 'function';

  const decode = blob => {
    if (hasBitmap) return createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    return img.decode().then(() => { URL.revokeObjectURL(url); return img; });
  };

  // Cena frejma = udaljenost od prikazane pozicije; unazad je tri puta skuplje (skrol uglavnom ide napred)
  const costOf = i => {
    const d = i - shown;
    return d * dir >= 0 ? Math.abs(d) : Math.abs(d) * 3;
  };

  function free(i) {
    bitmaps[i]?.close?.();
    bitmaps[i] = null;
    decodedCount--;
  }

  function pump() {
    if (!visible || signal.aborted) return;
    while (decoding.size < DECODERS) {
      let best = -1, bestCost = AHEAD + 1;
      for (let i = 0; i < count; i++) {
        if (!blobs[i] || bitmaps[i] || decoding.has(i)) continue;
        const c = costOf(i);
        if (c < bestCost) { best = i; bestCost = c; }
      }
      if (best < 0) return;

      if (decodedCount + decoding.size >= MAX_DECODED) {
        // Nema mesta: izbaci najdalji dekodirani frejm, ali samo ako je dalji od onog koji ulazi
        let worst = -1, worstCost = bestCost;
        for (let i = 0; i < count; i++) {
          if (!bitmaps[i]) continue;
          const c = costOf(i);
          if (c > worstCost) { worst = i; worstCost = c; }
        }
        if (worst < 0) return;
        free(worst);
      }
      startDecode(best);
    }
  }

  function startDecode(i) {
    decoding.add(i);
    decode(blobs[i]).then(bmp => {
      decoding.delete(i);
      if (!visible || signal.aborted || bitmaps[i]) { bmp.close?.(); return; }
      bitmaps[i] = bmp;
      decodedCount++;
      if (Math.abs(i - shown) <= AHEAD) schedule();
    }).catch(() => {
      decoding.delete(i);
      blobs[i] = null; // oštećen frejm: preskoči
    }).finally(pump);
  }

  // Kad hero nije blizu ekrana, oslobodi memoriju (stranica ispod ne treba stotine MB)
  function release() {
    for (let i = 0; i < count; i++) if (bitmaps[i]) free(i);
    lastKey = '';
  }
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { lastKey = ''; pump(); schedule(); } else release();
  }, { rootMargin: '100% 0px' });
  io.observe(section);

  // ---------- Canvas ----------
  let cssW = 0, cssH = 0, bw = 0, bh = 0;
  let geo = { dx: 0, dy: 0, dw: 0, dh: 0 };
  let scrollable = 1;

  const measure = () => { scrollable = Math.max(1, section.offsetHeight - sticky.offsetHeight); };

  function resize() {
    if (signal.aborted) return;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cssW = r.width;
    cssH = r.height;

    // Slika se crta tako da pokrije celu površinu (cover); sve se računa u CSS pikselima
    const cover = Math.max(cssW / fw, cssH / fh);
    geo = { dw: fw * cover, dh: fh * cover, dx: (cssW - fw * cover) / 2, dy: (cssH - fh * cover) / 2 };

    // Ne treba više piksela nego što ih izvorni frejm ima: veći canvas samo troši procesor
    const k = Math.min(window.devicePixelRatio || 1, 2, 1 / cover);
    const w = Math.round(cssW * k), h = Math.round(cssH * k);

    // Adresna traka na telefonu menja visinu dok se skroluje: za malu promenu ne pravimo canvas iznova.
    // Slika ostaje geometrijski tačna (crta se po CSS dimenzijama), menja se samo gustina piksela za par procenata.
    const reuse = bw && Math.abs(w - bw) / bw < 0.2 && Math.abs(h - bh) / bh < 0.2;
    if (!reuse) {
      canvas.width = bw = w;
      canvas.height = bh = h;
    }
    ctx.setTransform(bw / cssW, 0, 0, bh / cssH, 0, 0);
    ctx.imageSmoothingQuality = k * cover >= 0.9 ? 'low' : 'medium';

    measure();
    lastKey = '';
    draw(); // odmah, da posle promene veličine ne bljesne prazan canvas
    schedule();
  }

  // ---------- Crtanje ----------
  function draw() {
    if (!visible || !bw) return;
    const p = shown;
    const f = Math.floor(p);

    // Najbliži dekodirani frejmovi ispod i iznad pozicije
    let lo = -1, hi = -1;
    for (let d = 0; ; d++) {
      const a = f - d, b = f + 1 + d;
      const aOut = a < 0, bOut = b >= count;
      if (!aOut && lo < 0 && bitmaps[a]) lo = a;
      if (!bOut && hi < 0 && bitmaps[b]) hi = b;
      if ((lo >= 0 || aOut) && (hi >= 0 || bOut)) break;
    }
    if (lo < 0 && hi < 0) return;

    let first = lo >= 0 ? lo : hi;
    let second = -1;
    let w = 0;
    if (lo >= 0 && hi >= 0) {
      w = Math.round(((p - lo) / (hi - lo)) * 48) / 48;
      if (w >= 0.98) { first = hi; w = 0; }
      else if (w > 0.02) second = hi;
      else w = 0;
    }

    const key = `${first}|${second}|${w}|${bw}x${bh}|${cssW}x${cssH}`;
    if (key === lastKey) return;
    lastKey = key;

    ctx.globalAlpha = 1;
    ctx.drawImage(bitmaps[first], geo.dx, geo.dy, geo.dw, geo.dh);
    if (second >= 0) {
      ctx.globalAlpha = w;
      ctx.drawImage(bitmaps[second], geo.dx, geo.dy, geo.dw, geo.dh);
      ctx.globalAlpha = 1;
    }

    if (!drawnOnce) {
      drawnOnce = true;
      section.classList.add('is-ready');
    }
  }

  // ---------- Petlja ----------
  const schedule = () => { if (!raf && !signal.aborted) raf = requestAnimationFrame(tick); };

  // Čita skrol i vraća napredak kroz hero (0–1); postavlja i ciljnu poziciju u frejmovima
  function readScroll() {
    const u = clamp(-section.getBoundingClientRect().top / scrollable, 0, 1);
    target = clamp((u - holdStart) / (1 - holdStart - holdEnd), 0, 1) * (count - 1);
    return u;
  }

  function tick(now) {
    raf = 0;
    if (signal.aborted) return;
    const u = readScroll();

    if (!initialized || reducedMotion) {
      shown = target;
      vel = 0;
      initialized = true;
    } else {
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      smooth(dt);
    }
    if (Math.abs(target - shown) > 0.05) dir = target > shown ? 1 : -1;

    // Prozor dekodiranih frejmova proveravamo samo kad se pozicija pomerila za frejm ili je promenjen smer
    const at = Math.round(shown);
    if (at !== pumpedAt || dir !== pumpedDir) {
      pumpedAt = at;
      pumpedDir = dir;
      pump();
    }
    draw();
    updateUi(u);

    const moving = Math.abs(target - shown) > 0.004 || Math.abs(vel) > 0.02;
    if (!moving) { shown = target; vel = 0; }
    lastNow = moving ? now : 0;
    if (moving) schedule();
  }

  // Kritično prigušena opruga (SmoothDamp): meko kreće, meko staje, uz ograničenu brzinu
  function smooth(dt) {
    const omega = 2 / SMOOTH_S;
    const x = omega * dt;
    const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const maxChange = MAX_SPEED * SMOOTH_S;
    const change = clamp(shown - target, -maxChange, maxChange);
    const goal = shown - change;
    const temp = (vel + omega * change) * dt;
    vel = (vel - omega * temp) * e;
    let out = goal + (change + temp) * e;
    if ((target - shown > 0) === (out > target)) { out = target; vel = 0; }
    shown = out;
  }

  function updateUi(u) {
    const state = `${u < holdStart * 0.9}|${u > 0.015}|${u > 1 - holdEnd * 1.2}`;
    if (state === uiState) return;
    uiState = state;
    const atStart = u < holdStart * 0.9;
    intro.classList.toggle('is-active', atStart);
    intro.toggleAttribute('inert', !atStart);
    section.classList.toggle('is-scrolled', u > 0.015);
    section.classList.toggle('is-end', u > 1 - holdEnd * 1.2);
  }

  // ---------- Start ----------
  // Prvo saznaj gde je skrol (stranica može biti otvorena usred hero-a), pa tek onda kreni sa preuzimanjem
  measure();
  readScroll();
  shown = target;
  initialized = true;

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', resize, { signal });

  // Gašenje (promena paketa frejmova): zaustavi petlju i preuzimanja, oslobodi memoriju, vrati poster
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    ro.disconnect();
    release();
    decoding.clear();
    blobs.fill(null);
    section.classList.remove('is-ready');
  }, { once: true });

  resize();
  for (let k = 0; k < FETCHERS; k++) fetchWorker();
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
