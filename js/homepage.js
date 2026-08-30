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

  // ---------------------------------------------------------------------
  // Process flow: activate each stage as it's scrolled into view, and fill
  // the connecting line proportionally. Works with or without GSAP.
  // ---------------------------------------------------------------------
  const flowStages = document.querySelectorAll('#process-flow .process-flow-stage');
  const flowFill = document.getElementById('process-flow-fill');
  if (flowStages.length && flowFill) {
    const io3 = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
      const activeCount = document.querySelectorAll('#process-flow .process-flow-stage.active').length;
      flowFill.style.height = `${(activeCount / flowStages.length) * 100}%`;
    }, { threshold: 0.5, rootMargin: '0px 0px -15% 0px' });
    flowStages.forEach((s) => io3.observe(s));
  }

  // ---------------------------------------------------------------------
  // Turtle diagram: light up each node/arrow in sequence once in view
  // ---------------------------------------------------------------------
  const turtleViz = document.getElementById('turtle-viz');
  if (turtleViz) {
    const sequenceSelectors = [
      '.turtle-input', '.ta1', '.ta2', '.turtle-what', '.turtle-who',
      '.turtle-activity', '.ta3', '.ta4', '.turtle-how', '.turtle-measure', '.turtle-output',
    ];
    const io4 = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sequenceSelectors.forEach((sel, i) => {
          const el = turtleViz.querySelector(sel);
          if (!el) return;
          if (prefersReducedMotion) {
            el.classList.add('lit');
          } else {
            setTimeout(() => el.classList.add('lit'), i * 160);
          }
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    io4.observe(turtleViz);
  }

  // ---------------------------------------------------------------------
  // Signature moment: build the mock document up as each stage scrolls
  // into view, culminating in a "Complete" badge on the final stage.
  // ---------------------------------------------------------------------
  const wowStages = document.querySelectorAll('#wow-doc .wow-stage');
  const wowComplete = document.getElementById('wow-complete');
  if (wowStages.length) {
    const io5 = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('built');
        if (entry.target.classList.contains('wow-final') && wowComplete) {
          wowComplete.textContent = 'Complete';
          wowComplete.classList.add('done');
        }
        io5.unobserve(entry.target);
      });
    }, { threshold: 0.5, rootMargin: '0px 0px -10% 0px' });
    wowStages.forEach((s) => io5.observe(s));
  }
});
