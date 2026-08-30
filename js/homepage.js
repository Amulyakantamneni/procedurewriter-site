// Homepage-only interactions. Loaded after main.js, after GSAP + ScrollTrigger
// (CDN, guarded everywhere in case the CDN is blocked or slow: the page must
// never depend on it for basic usability).
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.remove('no-js');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGsap) window.gsap.registerPlugin(window.ScrollTrigger);

  // ---------------------------------------------------------------------
  // Hero headline: word-by-word reveal on load
  // ---------------------------------------------------------------------
  const words = document.querySelectorAll('#hero-headline .hw');
  if (words.length && !prefersReducedMotion) {
    words.forEach((w, i) => {
      setTimeout(() => w.classList.add('revealed'), 120 + i * 55);
    });
  } else {
    words.forEach((w) => w.classList.add('revealed'));
  }

  // ---------------------------------------------------------------------
  // Generic scroll-reveal for any .reveal-up element, staggered within its
  // own container via a data-stagger index. Works without GSAP.
  // ---------------------------------------------------------------------
  const revealEls = document.querySelectorAll('.reveal-up');
  if (revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  // ---------------------------------------------------------------------
  // Chaos to Clarity: stagger the ordered list in once scrolled into view
  // ---------------------------------------------------------------------
  const clarityList = document.getElementById('clarity-list');
  if (clarityList) {
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io2.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    io2.observe(clarityList);
  }
});
