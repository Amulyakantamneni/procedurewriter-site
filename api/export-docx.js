import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType,
} from 'docx';

const MAX_BODY_SIZE = 300000;

function txt(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text: String(text ?? ''), ...opts })], spacing: { after: 120 } });
}

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({ text: String(text ?? ''), heading: level, spacing: { before: 300, after: 150 } });
}

function bullets(items = []) {
  if (!items.length) return [txt('None identified.')];
  return items.map((item) => new Paragraph({ text: String(item), bullet: { level: 0 }, spacing: { after: 80 } }));
}

function cell(text, { header = false, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: header ? { type: ShadingType.SOLID, color: '1F2937', fill: '1F2937' } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? ''), bold: header, color: header ? 'FFFFFF' : undefined, size: 20 })],
      }),
    ],
  });
}

function table(headerCells, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
    },
    rows: [
      new TableRow({ children: headerCells.map((h) => cell(h, { header: true })), tableHeader: true }),
      ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
    ],
  });
}

function buildDoc(p) {
  const children = [];

  children.push(new Paragraph({ text: p.metadata?.title || 'Procedure', heading: HeadingLevel.TITLE, spacing: { after: 200 } }));

  children.push(table(
    ['Field', 'Value'],
    [
      ['Document Number', p.metadata?.documentNumber || ''],
      ['Revision Number', p.metadata?.revisionNumber || ''],
      ['Effective Date', p.metadata?.effectiveDate || ''],
      ['Developer', p.metadata?.developer || ''],
      ['Approver', p.metadata?.approver || ''],
    ],
  ));

  if (p.revisionHistory?.length) {
    children.push(heading('Revision History'));
    children.push(table(
      ['Revision', 'Date', 'Changes', 'Developer', 'Approver'],
      p.revisionHistory.map((r) => [r.revision, r.date, r.changes, r.developer, r.approver]),
    ));
  }

  children.push(heading('1.0 Purpose'));
  children.push(txt(p.purpose || ''));

  children.push(heading('2.0 Scope'));
  children.push(txt(p.scope?.summary || ''));
  children.push(txt(`Start: ${p.scope?.start || ''}`));
  children.push(txt(`End: ${p.scope?.end || ''}`));
  if (p.scope?.exclusions?.length) {
    children.push(txt('Exclusions:', { bold: true }));
    children.push(...bullets(p.scope.exclusions));
  }

  children.push(heading('3.0 Applicability'));
  children.push(txt(p.applicability || ''));

  children.push(heading('4.0 Requirements'));
  for (const [label, key] of [['Regulatory', 'regulatory'], ['Governance', 'governance'], ['Business', 'business'], ['Compliance', 'compliance']]) {
    const items = p.requirements?.[key];
    if (items?.length) {
      children.push(txt(label, { bold: true }));
      children.push(...bullets(items));
    }
  }

  if (p.definitions?.length) {
    children.push(heading('5.0 Terms and Definitions'));
    children.push(table(['Term', 'Definition'], p.definitions.map((d) => [d.term, d.definition])));
  }

  children.push(heading('6.0 Responsibilities'));
  for (const r of p.responsibilities || []) {
    children.push(txt(r.role, { bold: true }));
    children.push(...bullets(r.responsibilities));
  }
  if (p.raci?.length) {
    children.push(heading('RACI Matrix', HeadingLevel.HEADING_3));
    children.push(table(
      ['Activity', 'Responsible', 'Accountable', 'Consulted', 'Informed'],
      p.raci.map((r) => [r.activity, r.responsible, r.accountable, r.consulted, r.informed]),
    ));
  }

  children.push(heading('7.0 Procedure'));
  for (const sub of p.procedure || []) {
    children.push(heading(`${sub.id} ${sub.title}`, HeadingLevel.HEADING_3));
    if (sub.objective) children.push(txt(`Objective: ${sub.objective}`));
    if (sub.trigger) children.push(txt(`Trigger: ${sub.trigger}`));
    if (sub.steps?.length) {
      children.push(table(
        ['Step', 'Action', 'Role', 'Input', 'Output', 'Control', 'Record'],
        sub.steps.map((s) => [s.step, s.action, s.role, s.input || '', s.output || '', s.control || '', s.record || '']),
      ));
    }
    if (sub.exceptions) children.push(txt(`Exceptions/Escalations: ${sub.exceptions}`));
  }

  if (p.kpis?.length) {
    children.push(heading('8.0 Performance Indicators'));
    children.push(table(
      ['Indicator', 'Description', 'Responsible Role', 'Target'],
      p.kpis.map((k) => [k.indicator, k.description, k.role, k.target]),
    ));
  }

  if (p.records?.length) {
    children.push(heading('9.0 Records'));
    children.push(table(
      ['Record Name', 'Form Number', 'Owner', 'Storage Location', 'Retention'],
      p.records.map((r) => [r.name, r.formNumber, r.owner, r.location, r.retention]),
    ));
  }

  children.push(heading('10.0 References'));
  children.push(...bullets(p.references));

  return new Document({ sections: [{ properties: {}, children }] });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const accessCode = process.env.GENERATOR_ACCESS_CODE;
  if (accessCode && req.headers['x-access-code'] !== accessCode) {
    return res.status(401).json({ error: 'Invalid or missing access code.' });
  }

  const bodySize = JSON.stringify(req.body || {}).length;
  if (bodySize > MAX_BODY_SIZE) {
    return res.status(400).json({ error: 'Procedure payload is too large.' });
  }

  const procedure = req.body?.procedure;
  if (!procedure || typeof procedure !== 'object') {
    return res.status(400).json({ error: 'A procedure object is required.' });
  }

  try {
    const doc = buildDoc(procedure);
    const buffer = await Packer.toBuffer(doc);

    const safeName = (procedure.metadata?.title || 'procedure')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'procedure';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('DOCX export error:', err);
    return res.status(500).json({ error: 'Could not generate the DOCX file. Please try again.' });
  }
}
