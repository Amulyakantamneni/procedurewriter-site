document.addEventListener('DOMContentLoaded', () => {
  const wizardScreen = document.getElementById('wizard');
  if (!wizardScreen) return;

  // procedurewriter.ai and the github.io URL are both served by GitHub
  // Pages, which can't run server code; the API only exists on Vercel.
  const VERCEL_API_BASE = 'https://procedurewriter-site.vercel.app';
  const API_BASE = window.location.origin.includes('vercel.app') ? '' : VERCEL_API_BASE;
  const DRAFT_KEY = 'pw_draft_v1';

  // Slugs in the URL stay lowercase-hyphenated; these map back to readable
  // labels for the UI and for what actually gets sent to the model.
  const INDUSTRY_LABELS = {
    'healthcare': 'Healthcare & Medical',
    'manufacturing': 'Manufacturing',
    'financial-services': 'Finance & Banking',
    'energy-utilities': 'Energy & Utilities',
    'legal-compliance': 'Legal & Compliance',
    'technology': 'Information Technology / Software',
  };
  const MODE_LABELS = {
    'sop': 'SOP Creation',
    'compliance': 'Compliance Documentation',
    'process-mapping': 'Process Mapping',
    'ai-governance': 'AI Governance & Model-Use Procedures',
    'documentation-audit': 'Documentation Audit & Gap Analysis',
    'rollout-training': 'Rollout & Team Training',
  };

  function slugToLabel(slug, map) {
    if (!slug) return '';
    if (map[slug]) return map[slug];
    return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const state = {
    industry: slugToLabel(params.get('industry'), INDUSTRY_LABELS),
    mode: slugToLabel(params.get('mode') || params.get('service'), MODE_LABELS),
    title: '',
    goal: '',
    audience: '',
    region: '',
    current: '',
    extra: '',
  };

  const industryPrefilled = Boolean(state.industry);
  const steps = industryPrefilled
    ? ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']
    : ['industry', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  let stepIndex = 0;

  const el = {
    heading: document.getElementById('gen-heading'),
    progress: document.getElementById('wizard-progress'),
    resumeBanner: document.getElementById('resume-banner'),
    resumeContinue: document.getElementById('resume-continue'),
    resumeDiscard: document.getElementById('resume-discard'),
    contextChip: document.getElementById('context-chip'),
    contextChipText: document.getElementById('context-chip-text'),
    contextChipChange: document.getElementById('context-chip-change'),
    wizard: document.getElementById('wizard'),
    back: document.getElementById('w-back'),
    next: document.getElementById('w-next'),
    generate: document.getElementById('w-generate'),
    status: document.getElementById('w-status'),
    generating: document.getElementById('generating'),
    generatingMessage: document.getElementById('generating-message'),
    workspace: document.getElementById('doc-workspace'),
    sidebar: document.getElementById('doc-sidebar'),
    content: document.getElementById('doc-content'),
    restart: document.getElementById('doc-restart'),
    copyBtn: document.getElementById('doc-copy'),
    pdfBtn: document.getElementById('doc-pdf'),
    docxBtn: document.getElementById('doc-docx'),
    accessInput: document.getElementById('w-access'),
    industrySelect: document.getElementById('w-industry'),
    titleInput: document.getElementById('w-title'),
    goalInput: document.getElementById('w-goal'),
    audienceInput: document.getElementById('w-audience'),
    regionInput: document.getElementById('w-region'),
    currentInput: document.getElementById('w-current'),
    extraInput: document.getElementById('w-extra'),
    noProcessBtn: document.getElementById('w-noprocess-btn'),
  };

  let lastProcedure = null;

  // ---------------------------------------------------------------------
  // Draft persistence
  // ---------------------------------------------------------------------
  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, stepIndex, savedAt: Date.now() }));
    } catch (e) { /* storage unavailable, ignore */ }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  function applyStateToInputs() {
    if (el.industrySelect) el.industrySelect.value = state.industry;
    el.titleInput.value = state.title;
    el.goalInput.value = state.goal;
    el.audienceInput.value = state.audience;
    el.regionInput.value = state.region;
    el.currentInput.value = state.current;
    el.extraInput.value = state.extra;
  }

  const draft = loadDraft();
  if (draft && draft.state && (draft.state.title || draft.state.goal || draft.state.current)) {
    el.resumeBanner.hidden = false;
  }

  el.resumeContinue.addEventListener('click', () => {
    Object.assign(state, draft.state);
    stepIndex = Math.min(draft.stepIndex || 0, steps.length - 1);
    applyStateToInputs();
    el.resumeBanner.hidden = true;
    renderStep();
  });

  el.resumeDiscard.addEventListener('click', () => {
    clearDraft();
    el.resumeBanner.hidden = true;
  });

  // ---------------------------------------------------------------------
  // Context chip (pre-filled industry/mode)
  // ---------------------------------------------------------------------
  function renderContextChip() {
    const bits = [];
    if (state.industry) bits.push(state.industry);
    if (state.mode) bits.push(state.mode);
    if (bits.length) {
      el.contextChip.hidden = false;
      el.contextChipText.textContent = `${bits.join(' · ')} selected`;
    } else {
      el.contextChip.hidden = true;
    }
  }
  renderContextChip();

  el.contextChipChange.addEventListener('click', () => {
    state.industry = '';
    state.mode = '';
    renderContextChip();
    if (!steps.includes('industry')) steps.unshift('industry');
    stepIndex = 0;
    renderStep();
  });

  // ---------------------------------------------------------------------
  // Progress indicator
  // ---------------------------------------------------------------------
  function setPhase(phase) {
    el.progress.querySelectorAll('.wp-step').forEach((n) => {
      const order = ['industry', 'details', 'generate', 'review', 'download'];
      const target = order.indexOf(phase);
      const self = order.indexOf(n.dataset.phase);
      n.classList.toggle('active', self === target);
      n.classList.toggle('done', self < target);
    });
  }

  // ---------------------------------------------------------------------
  // Wizard step rendering
  // ---------------------------------------------------------------------
  function renderStep() {
    document.querySelectorAll('.wizard-step').forEach((s) => { s.hidden = true; });
    const key = steps[stepIndex];
    document.querySelector(`.wizard-step[data-step="${key}"]`).hidden = false;
    el.back.classList.toggle('show', stepIndex > 0);
    el.next.hidden = stepIndex === steps.length - 1;
    el.generate.hidden = stepIndex !== steps.length - 1;
    el.status.textContent = '';
    el.status.className = 'form-status';
    setPhase(key === 'industry' ? 'industry' : 'details');
    saveDraft();
  }

  function readCurrentStepIntoState() {
    const key = steps[stepIndex];
    if (key === 'industry') state.industry = el.industrySelect.value.trim();
    if (key === 'q1') state.title = el.titleInput.value.trim();
    if (key === 'q2') state.goal = el.goalInput.value.trim();
    if (key === 'q3') state.audience = el.audienceInput.value.trim();
    if (key === 'q4') state.region = el.regionInput.value.trim();
    if (key === 'q5') state.current = el.currentInput.value.trim();
    if (key === 'q6') state.extra = el.extraInput.value.trim();
  }

  function validateCurrentStep() {
    const key = steps[stepIndex];
    if (key === 'q1' && !state.title) return "Tell us what procedure you'd like to create.";
    if (key === 'q2' && !state.goal) return 'Give a quick sense of the goal and what it should cover.';
    if (key === 'q5' && !state.current) return "Describe the current process, or use “We don't have an existing process.”";
    return '';
  }

  el.next.addEventListener('click', () => {
    readCurrentStepIntoState();
    const err = validateCurrentStep();
    if (err) {
      el.status.textContent = err;
      el.status.className = 'form-status error';
      return;
    }
    if (steps[stepIndex] === 'industry') renderContextChip();
    stepIndex = Math.min(stepIndex + 1, steps.length - 1);
    renderStep();
  });

  el.back.addEventListener('click', () => {
    readCurrentStepIntoState();
    stepIndex = Math.max(stepIndex - 1, 0);
    renderStep();
  });

  el.noProcessBtn.addEventListener('click', () => {
    el.currentInput.value = 'No existing process currently exists for this. This is a new procedure being created from scratch.';
  });

  // ---------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------
  const PROGRESS_MESSAGES = [
    'Understanding your process…',
    'Identifying applicable requirements…',
    'Building the procedure structure…',
    'Working out responsibilities and RACI…',
    'Checking compliance considerations…',
    'Finalizing the document…',
  ];

  el.generate.addEventListener('click', async () => {
    readCurrentStepIntoState();
    const err = validateCurrentStep();
    if (err) {
      el.status.textContent = err;
      el.status.className = 'form-status error';
      return;
    }

    el.wizard.hidden = true;
    el.resumeBanner.hidden = true;
    el.generating.hidden = false;
    setPhase('generate');

    let msgIndex = 0;
    el.generatingMessage.textContent = PROGRESS_MESSAGES[0];
    const msgTimer = setInterval(() => {
      msgIndex = (msgIndex + 1) % PROGRESS_MESSAGES.length;
      el.generatingMessage.textContent = PROGRESS_MESSAGES[msgIndex];
    }, 2600);

    try {
      const headers = { 'Content-Type': 'application/json' };
      const accessCode = el.accessInput.value.trim();
      if (accessCode) headers['X-Access-Code'] = accessCode;

      const response = await fetch(`${API_BASE}/api/generate-procedure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          industry: state.industry,
          mode: state.mode,
          procedureTitle: state.title,
          goalScope: state.goal,
          audience: state.audience,
          region: state.region,
          currentProcess: state.current,
          additionalContext: state.extra,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The generator failed. Please try again.');

      lastProcedure = data.procedure;
      clearInterval(msgTimer);
      clearDraft();
      renderDocument(lastProcedure);
      el.generating.hidden = true;
      el.workspace.hidden = false;
      setPhase('review');
    } catch (e) {
      clearInterval(msgTimer);
      el.generating.hidden = true;
      el.wizard.hidden = false;
      el.status.textContent = e.message || 'Something went wrong. Please try again.';
      el.status.className = 'form-status error';
    }
  });

  // ---------------------------------------------------------------------
  // Document rendering
  // ---------------------------------------------------------------------
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function list(items) {
    if (!items || !items.length) return '<p>None identified.</p>';
    return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  function table(headers, rows) {
    if (!rows || !rows.length) return '<p>None identified.</p>';
    const head = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
    const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    return `<table class="doc-table">${head}${body}</table>`;
  }

  function mermaidId(prefix, i) { return `${prefix}${i}`; }

  function truncate(s, n) {
    const str = String(s || '');
    return str.length > n ? `${str.slice(0, n - 1)}…` : str;
  }

  // Sanitizes text for safe use inside quoted Mermaid node/subgraph labels.
  // Not HTML-escaping: the whole diagram string is HTML-escaped once at the
  // call site before insertion, so escaping here too would double-escape.
  function mermaidSafe(s) {
    return String(s || '').replace(/"/g, "'").replace(/[\n\r]/g, ' ');
  }

  function buildFlowDiagram(procedure) {
    const lines = ['flowchart TD', '  start_((START))'];
    let prevId = 'start_';
    let stepCounter = 0;

    (procedure || []).forEach((sub, subIdx) => {
      const subId = `sub${subIdx}`;
      const subTitle = mermaidSafe(`${sub.id || ''} ${truncate(sub.title, 40)}`);
      lines.push(`  subgraph ${subId}["${subTitle}"]`);
      (sub.steps || []).forEach((step) => {
        stepCounter += 1;
        const nodeId = mermaidId('n', stepCounter);
        const label = mermaidSafe(truncate(`${step.role ? `${step.role}: ` : ''}${step.action}`, 60));
        if (step.isDecision) {
          lines.push(`    ${nodeId}{"${label}"}`);
        } else {
          lines.push(`    ${nodeId}["${label}"]`);
        }
        lines.push(`SEQEDGE:${prevId}:${nodeId}`);
        prevId = nodeId;
      });
      lines.push('  end');
    });
    lines.push('  end_((END))');
    lines.push(`SEQEDGE:${prevId}:end_`);

    // Split subgraph block lines from edges so edges render after subgraphs
    const bodyLines = lines.filter((l) => !l.startsWith('SEQEDGE:'));
    const edgeLines = lines.filter((l) => l.startsWith('SEQEDGE:')).map((l) => {
      const [, from, to] = l.split(':');
      return `  ${from} --> ${to}`;
    });

    return [...bodyLines, ...edgeLines].join('\n');
  }

  function renderQualityScore(q) {
    if (!q) return '';
    const bar = (label, val) => `
      <div class="doc-quality-bar">
        ${esc(label)}: ${esc(val)}/100
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, val))}%"></div></div>
      </div>`;
    return `
      <div class="doc-quality">
        <div class="doc-quality-score">
          <div class="num">${esc(q.overall)}</div>
          <div class="label">Quality Score</div>
        </div>
        <div class="doc-quality-bars">
          ${bar('Completeness', q.completeness)}
          ${bar('Clarity', q.clarity)}
          ${bar('Process Definition', q.processDefinition)}
          ${bar('Risk & Controls', q.riskAndControls)}
          ${bar('Compliance Coverage', q.complianceCoverage)}
        </div>
        <div class="doc-quality-recs">
          <strong>Recommendations</strong>
          ${list(q.recommendations)}
        </div>
      </div>`;
  }

  function renderDocument(p) {
    const sections = [
      { id: 'purpose', label: '1.0 Purpose' },
      { id: 'scope', label: '2.0 Scope' },
      { id: 'applicability', label: '3.0 Applicability' },
      { id: 'requirements', label: '4.0 Requirements' },
      { id: 'definitions', label: '5.0 Terms & Definitions' },
      { id: 'responsibilities', label: '6.0 Responsibilities' },
      { id: 'procedure', label: '7.0 Procedure' },
      { id: 'kpis', label: '8.0 Performance Indicators' },
      { id: 'records', label: '9.0 Records' },
      { id: 'references', label: '10.0 References' },
    ];

    el.sidebar.innerHTML = sections.map((s) => `<a href="#${s.id}">${esc(s.label)}</a>`).join('');

    const reqRows = (label, items) => (items && items.length
      ? `<h3>${esc(label)}</h3>${list(items)}`
      : '');

    const subprocessesHtml = (p.procedure || []).map((sub) => `
      <div class="doc-subprocess">
        <h3>${esc(sub.id)} ${esc(sub.title)}</h3>
        ${sub.objective ? `<p><strong>Objective:</strong> ${esc(sub.objective)}</p>` : ''}
        ${sub.trigger ? `<p><strong>Trigger:</strong> ${esc(sub.trigger)}</p>` : ''}
        ${table(
          ['Step', 'Action', 'Role', 'Input', 'Output', 'Control', 'Record', 'Approval'],
          (sub.steps || []).map((s) => [
            s.step, s.action + (s.isDecision ? `  [Decision — Yes: ${s.decisionYes || ''} / No: ${s.decisionNo || ''}]` : ''),
            s.role, s.input || '', s.output || '', s.control || '', s.record || '', s.approval || '',
          ]),
        )}
        ${sub.exceptions ? `<p><strong>Exceptions / Escalations:</strong> ${esc(sub.exceptions)}</p>` : ''}
      </div>
    `).join('');

    el.content.innerHTML = `
      ${renderQualityScore(p.qualityScore)}

      <div class="doc-section" id="metadata">
        <h2>${esc(p.metadata?.title || 'Procedure')}</h2>
        ${table(['Field', 'Value'], [
          ['Document Number', p.metadata?.documentNumber],
          ['Revision Number', p.metadata?.revisionNumber],
          ['Effective Date', p.metadata?.effectiveDate],
          ['Developer', p.metadata?.developer],
          ['Approver', p.metadata?.approver],
        ])}
      </div>

      <div class="doc-section" id="purpose">
        <h2>1.0 Purpose</h2>
        <div class="doc-callout">${esc(p.purpose)}</div>
      </div>

      <div class="doc-section" id="scope">
        <h2>2.0 Scope</h2>
        <p>${esc(p.scope?.summary)}</p>
        <div class="doc-flowline">
          <span class="chip">START: ${esc(p.scope?.start)}</span>
          <span>→</span>
          <span class="chip">IN SCOPE</span>
          <span>→</span>
          <span class="chip">END: ${esc(p.scope?.end)}</span>
        </div>
        ${p.scope?.exclusions?.length ? `<h3>Exclusions</h3>${list(p.scope.exclusions)}` : ''}
      </div>

      <div class="doc-section" id="applicability">
        <h2>3.0 Applicability</h2>
        <p>${esc(p.applicability)}</p>
      </div>

      <div class="doc-section" id="requirements">
        <h2>4.0 Requirements</h2>
        ${reqRows('Regulatory', p.requirements?.regulatory)}
        ${reqRows('Governance', p.requirements?.governance)}
        ${reqRows('Business', p.requirements?.business)}
        ${reqRows('Compliance', p.requirements?.compliance)}
      </div>

      <div class="doc-section" id="definitions">
        <h2>5.0 Terms and Definitions</h2>
        ${table(['Term', 'Definition'], (p.definitions || []).map((d) => [d.term, d.definition]))}
      </div>

      <div class="doc-section" id="responsibilities">
        <h2>6.0 Responsibilities</h2>
        ${(p.responsibilities || []).map((r) => `<h3>${esc(r.role)}</h3>${list(r.responsibilities)}`).join('')}
        <h3>RACI Matrix</h3>
        ${table(
          ['Activity', 'Responsible', 'Accountable', 'Consulted', 'Informed'],
          (p.raci || []).map((r) => [r.activity, r.responsible, r.accountable, r.consulted, r.informed]),
        )}
      </div>

      <div class="doc-section" id="procedure">
        <h2>7.0 Procedure</h2>
        <div class="doc-diagram"><pre class="mermaid">${esc(buildFlowDiagram(p.procedure))}</pre></div>
        ${subprocessesHtml}
      </div>

      <div class="doc-section" id="kpis">
        <h2>8.0 Performance Indicators</h2>
        ${table(['Indicator', 'Description', 'Role', 'Target'], (p.kpis || []).map((k) => [k.indicator, k.description, k.role, k.target]))}
      </div>

      <div class="doc-section" id="records">
        <h2>9.0 Records</h2>
        ${table(['Record Name', 'Form Number', 'Owner', 'Storage Location', 'Retention'], (p.records || []).map((r) => [r.name, r.formNumber, r.owner, r.location, r.retention]))}
      </div>

      <div class="doc-section" id="references">
        <h2>10.0 References</h2>
        ${list(p.references)}
      </div>
    `;

    if (window.mermaid) {
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: 'dark' });
        window.mermaid.run({ querySelector: '.mermaid' });
      } catch (e) {
        console.error('Mermaid render failed:', e);
      }
    }

    // Sidebar active-section highlighting
    const sectionEls = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    const sidebarLinks = Array.from(el.sidebar.querySelectorAll('a'));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            sidebarLinks.forEach((a) => a.classList.remove('active'));
            const link = el.sidebar.querySelector(`a[href="#${entry.target.id}"]`);
            if (link) link.classList.add('active');
          }
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      sectionEls.forEach((s) => io.observe(s));
    }
  }

  // ---------------------------------------------------------------------
  // Toolbar actions
  // ---------------------------------------------------------------------
  el.restart.addEventListener('click', () => {
    clearDraft();
    window.location.href = 'generate.html';
  });

  el.pdfBtn.addEventListener('click', () => { window.print(); });

  el.copyBtn.addEventListener('click', async () => {
    if (!lastProcedure) return;
    await navigator.clipboard.writeText(el.content.innerText);
    const original = el.copyBtn.textContent;
    el.copyBtn.textContent = 'Copied';
    setTimeout(() => { el.copyBtn.textContent = original; }, 1500);
  });

  el.docxBtn.addEventListener('click', async () => {
    if (!lastProcedure) return;
    const original = el.docxBtn.textContent;
    el.docxBtn.textContent = 'Preparing…';
    el.docxBtn.disabled = true;
    try {
      const headers = { 'Content-Type': 'application/json' };
      const accessCode = el.accessInput.value.trim();
      if (accessCode) headers['X-Access-Code'] = accessCode;

      const response = await fetch(`${API_BASE}/api/export-docx`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ procedure: lastProcedure }),
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (lastProcedure.metadata?.title || 'procedure').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      a.download = `${safeName || 'procedure'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Could not generate the DOCX file. Please try again.');
    } finally {
      el.docxBtn.textContent = original;
      el.docxBtn.disabled = false;
    }
  });

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  renderStep();
});
