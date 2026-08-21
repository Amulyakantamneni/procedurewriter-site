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

  // On GitHub Pages the API lives on a separate Vercel deployment (GH Pages
  // can't run server code). If this page is ever served from that same
  // Vercel project instead, calls stay same-origin automatically.
  const VERCEL_API_BASE = 'https://YOUR-VERCEL-PROJECT.vercel.app';
  const API_BASE = window.location.origin.includes('vercel.app') || window.location.hostname === 'procedurewriter.ai'
    ? ''
    : VERCEL_API_BASE;

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
    form.output.textContent = 'Drafting your procedure — this can take a few seconds…';
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
      form.status.textContent = 'Draft ready — review it below before using it anywhere real.';
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
