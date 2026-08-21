// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    nav.querySelectorAll('.nav-links a').forEach((link) => {
      link.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

  // Nav gains a shadow once the page is scrolled
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Scroll-triggered reveal, with a per-item stagger inside each grid/row
  const revealEls = document.querySelectorAll(
    '.card, .step, .industry-card, .service-row, .faq-item, .value-grid > *, .cta-band, .photo-band, .section-head'
  );
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (revealEls.length && 'IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const siblings = Array.from(el.parentElement.children);
          const idx = siblings.indexOf(el);
          el.style.transitionDelay = `${Math.min(idx, 6) * 70}ms`;
          el.classList.add('in-view');
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  // Contact form submission
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('.form-status');
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn.textContent;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      status.className = 'form-status';
      status.textContent = '';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          status.textContent = "Thanks — we'll be in touch within one business day.";
          status.className = 'form-status success';
          form.reset();
        } else {
          throw new Error('Form endpoint not configured');
        }
      } catch (err) {
        status.textContent = 'Something went wrong. Email us directly at hello@procedurewriter.ai instead.';
        status.className = 'form-status error';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }
});
