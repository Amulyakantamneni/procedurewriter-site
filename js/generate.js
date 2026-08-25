document.addEventListener('DOMContentLoaded', () => {
  const form = {
    title: document.getElementById('gen-title'),
    source: document.getElementById('gen-source'),
    accessCode: document.getElementById('gen-access-code'),
    submit: document.getElementById('gen-submit'),
    status: document.getElementById('gen-status'),
    output: document.getElementById('gen-output'),
    filename: document.getElementById('gen-filename'),
    copyBtn: document.getElementById('gen-copy'),
    downloadBtn: document.getElementById('gen-download'),
  };

  if (!form.submit) return;

  // Pre-fill from ?industry= or ?service= so clicking through from the
  // Industries or Services pages lands somewhere purposeful, not a blank form.
  const params = new URLSearchParams(window.location.search);
  const industry = params.get('industry');
  const service = params.get('service');
  if (industry) {
    form.title.value = `${industry} Procedure`;
    form.source.placeholder = `Describe the ${industry.toLowerCase()} process you want documented: who's involved, the steps it follows today, and anything it needs to comply with...`;
  } else if (service) {
    form.title.value = service;
    form.source.placeholder = `Paste the notes or process details relevant to ${service.toLowerCase()}...`;
  }

  // procedurewriter.ai and the github.io URL are both served by GitHub
  // Pages, which can't run server code; the API only exists on Vercel.
  // Only skip the absolute URL when this page is itself being viewed via
  // the Vercel deployment (same-origin call).
  const VERCEL_API_BASE = 'https://procedurewriter-site.vercel.app';
  const API_BASE = window.location.origin.includes('vercel.app') ? '' : VERCEL_API_BASE;

  let lastDraft = '';

  form.submit.addEventListener('click', async () => {
    const title = form.title.value.trim();
    const sourceText = form.source.value.trim();

    form.status.className = 'form-status';
    form.status.textContent = '';

    if (!title) {
      form.status.textContent = 'Add a procedure title first.';
      form.status.className = 'form-status error';
      return;
    }
    if (!sourceText) {
      form.status.textContent = 'Paste some source material first.';
      form.status.className = 'form-status error';
      return;
    }

    form.submit.disabled = true;
    form.submit.textContent = 'Generating…';
    form.output.textContent = 'Drafting your procedure. This can take a few seconds…';
    form.copyBtn.disabled = true;
    form.downloadBtn.disabled = true;

    try {
      const headers = { 'Content-Type': 'application/json' };
      const accessCode = form.accessCode.value.trim();
      if (accessCode) headers['X-Access-Code'] = accessCode;

      const response = await fetch(`${API_BASE}/api/generate-procedure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, sourceText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'The generator failed. Please try again.');
      }

      lastDraft = data.draft;
      form.output.textContent = data.draft;
      form.filename.textContent = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'draft'}.md`;
      form.copyBtn.disabled = false;
      form.downloadBtn.disabled = false;
      form.status.textContent = 'Draft ready. Review it below before using it anywhere real.';
      form.status.className = 'form-status success';
    } catch (err) {
      form.output.textContent = 'Your generated draft will appear here.';
      form.status.textContent = err.message || 'Something went wrong. Please try again.';
      form.status.className = 'form-status error';
    } finally {
      form.submit.disabled = false;
      form.submit.textContent = 'Generate Draft';
    }
  });

  form.copyBtn.addEventListener('click', async () => {
    if (!lastDraft) return;
    await navigator.clipboard.writeText(lastDraft);
    const original = form.copyBtn.textContent;
    form.copyBtn.textContent = 'Copied';
    setTimeout(() => { form.copyBtn.textContent = original; }, 1500);
  });

  form.downloadBtn.addEventListener('click', () => {
    if (!lastDraft) return;
    const blob = new Blob([lastDraft], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = form.filename.textContent || 'draft.md';
    a.click();
    URL.revokeObjectURL(url);
  });
});
