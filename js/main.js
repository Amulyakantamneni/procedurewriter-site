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
