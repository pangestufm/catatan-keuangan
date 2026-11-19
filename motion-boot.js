/* Runs in <head> before the first paint. Hide-then-reveal only runs when motion.js is there to
   reveal; otherwise content stays plainly visible. A file rather than an inline script so the
   Content-Security-Policy can allow scripts from this site only. */
try {
  if (localStorage.getItem('catatan-keuangan-motion') !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion');
    setTimeout(function () { if (!document.documentElement.classList.contains('motion-ready')) document.documentElement.classList.remove('motion'); }, 2500);
  }
} catch (error) { /* storage blocked: no reveal motion */ }
