// Homepage-only interactions. Loaded after main.js. Everything here uses
// plain IntersectionObserver/CSS transitions rather than a scroll animation
// library: same visual result, no extra dependency weight, nothing that can
// silently fail if a CDN is slow or blocked.
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.remove('no-js');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // ---------------------------------------------------------------------
  // Industry showcase: swap the preview panel on hover/click/focus
  // ---------------------------------------------------------------------
  const INDUSTRY_DATA = {
    'healthcare': {
      name: 'Healthcare', img: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Patient Intake & Registration', 'Infection Control Protocol', 'HIPAA Compliance Procedure'],
    },
    'manufacturing': {
      name: 'Manufacturing', img: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Lockout/Tagout Safety', 'Quality Inspection', 'Equipment Maintenance'],
    },
    'financial-services': {
      name: 'Finance & Banking', img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['KYC & Customer Onboarding', 'AML Transaction Monitoring', 'Regulatory Reporting'],
    },
    'technology': {
      name: 'IT & Software', img: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Incident Response', 'Access Control & Permissions', 'Release / Deployment Process'],
    },
    'energy-utilities': {
      name: 'Energy & Utilities', img: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Field Safety Inspection', 'Outage Response', 'Environmental Compliance Reporting'],
    },
    'construction': {
      name: 'Construction', img: 'https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Site Safety Inspection', 'Permit & Compliance Tracking', 'Subcontractor Onboarding'],
    },
    'logistics': {
      name: 'Logistics & Supply Chain', img: 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Shipment & Receiving Inspection', 'Inventory Management', 'Vendor Onboarding'],
    },
    'government': {
      name: 'Government & Public Sector', img: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=820&h=440&q=80',
      examples: ['Records Management', 'Procurement Process Documentation', 'Public Records Request Handling'],
    },
  };

  const showcase = document.getElementById('industry-showcase');
  if (showcase) {
    const tabs = showcase.querySelectorAll('.industry-tab');
    const preview = document.getElementById('industry-preview');
    const previewImg = document.getElementById('industry-preview-img');
    const previewName = document.getElementById('industry-preview-name');
    const previewList = document.getElementById('industry-preview-list');

    function setIndustry(key) {
      const data = INDUSTRY_DATA[key];
      if (!data) return;
      tabs.forEach((t) => {
        const active = t.dataset.industry === key;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      previewImg.src = data.img;
      previewImg.alt = `${data.name} team at work`;
      previewName.textContent = data.name;
      previewList.innerHTML = data.examples.map((e) => `<li>${e}</li>`).join('');
      preview.href = `generate.html?industry=${key}`;
    }

    tabs.forEach((tab) => {
      tab.addEventListener('mouseenter', () => setIndustry(tab.dataset.industry));
      tab.addEventListener('focus', () => setIndustry(tab.dataset.industry));
      tab.addEventListener('click', (e) => { e.preventDefault(); setIndustry(tab.dataset.industry); });
    });
  }

  // ---------------------------------------------------------------------
  // Magnetic primary buttons: a subtle pull toward the cursor, desktop only
  // ---------------------------------------------------------------------
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover && !prefersReducedMotion) {
    document.querySelectorAll('.hero-actions .btn-primary, .cta-band .btn-primary').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35 - 1}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }
});
