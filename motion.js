// Page motion: one reveal per section as it enters, the nav marker following the section in view,
// and the viewer's switch for the desk animation. Content is visible without this script.
(function () {
  const PREF_KEY = 'catatan-keuangan-motion';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motionToggle');

  function preference() {
    try { return localStorage.getItem(PREF_KEY) || 'on'; } catch { return 'on'; }
  }
  function sync() {
    const on = preference() !== 'off' && !reduced.matches;
    root.classList.toggle('motion', on);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(preference() !== 'off'));
      toggle.querySelector('small').textContent = reduced.matches ? 'Mengikuti pengaturan kurangi gerakan di perangkat'
        : preference() === 'off' ? 'Mati, nyalakan untuk animasi tumpukan' : 'Matikan bila perangkat terasa berat';
    }
    if (!on) document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
  }
  toggle?.addEventListener('click', () => {
    try { localStorage.setItem(PREF_KEY, preference() === 'off' ? 'on' : 'off'); } catch { /* keep current */ }
    sync();
    window.dispatchEvent(new Event('finance:motion'));
  });
  reduced.addEventListener?.('change', sync);

  // Sections already on screen at load reveal at once; the rest reveal as they scroll in.
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      reveal.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('[data-reveal]').forEach((el) => reveal.observe(el));

  // The nav marker follows the section being read.
  const links = [...document.querySelectorAll('.main-nav a[href^="#"]')].filter((a) => !a.dataset.bookRoute && a.id !== 'navQuickEntryButton');
  const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const current = new Map();
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => current.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0));
    let best = null, bestRatio = 0;
    current.forEach((ratio, el) => { if (ratio > bestRatio) { best = el; bestRatio = ratio; } });
    links.forEach((a) => a.classList.toggle('is-current', Boolean(best) && a.getAttribute('href') === `#${best.id}` && document.body.dataset.bookPage !== 'installments' && document.body.dataset.bookPage !== 'savings'));
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.75], rootMargin: '-120px 0px -35% 0px' });
  targets.forEach((el) => spy.observe(el));

  sync();
  root.classList.add('motion-ready');
})();
