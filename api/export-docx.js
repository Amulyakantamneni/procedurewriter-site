import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, Header, Footer, PageNumber,
  TabStopType, TabStopPosition, VerticalAlign,
} from 'docx';

const MAX_BODY_SIZE = 300000;

// Brand palette, print-safe
const NAVY = '1E3A5F';
const NAVY_DARK = '15293F';
const GOLD = 'B3904F';
const INK = '1A1A1A';
const MUTED = '5B6472';
const BORDER = 'C9D2DC';
const ROW_ALT = 'F3F6F9';
const FONT = 'Calibri';

function txt(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text: String(text ?? ''), font: FONT, color: INK, ...opts })],
    spacing: { after: 140 },
  });
}

function heading(text, level = HeadingLevel.HEADING_2) {
  const sizes = { [HeadingLevel.HEADING_1]: 30, [HeadingLevel.HEADING_2]: 25, [HeadingLevel.HEADING_3]: 21 };
  return new Paragraph({
    children: [new TextRun({
      text: String(text ?? ''), font: FONT, bold: true,
      color: level === HeadingLevel.HEADING_3 ? GOLD : NAVY,
      size: sizes[level] || 22,
    })],
    heading: level,
    spacing: { before: 340, after: 160 },
    border: level !== HeadingLevel.HEADING_3
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: level === HeadingLevel.HEADING_1 ? NAVY : BORDER, space: 4 } }
      : undefined,
  });
}

function bullets(items = []) {
  if (!items.length) return [txt('None identified.', { italics: true, color: MUTED })];
  return items.map((item) => new Paragraph({
    children: [new TextRun({ text: String(item), font: FONT, color: INK })],
    bullet: { level: 0 },
    spacing: { after: 90 },
  }));
}

function cell(text, { header = false, width, shade } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: header
      ? { type: ShadingType.SOLID, color: NAVY, fill: NAVY }
      : shade ? { type: ShadingType.SOLID, color: ROW_ALT, fill: ROW_ALT } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [new TextRun({
          text: String(text ?? ''), font: FONT, bold: header,
          color: header ? 'FFFFFF' : INK, size: 19,
        })],
      }),
    ],
  });
}

function table(headerCells, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      left: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      right: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER },
    },
    rows: [
      new TableRow({ children: headerCells.map((h) => cell(h, { header: true })), tableHeader: true }),
      ...rows.map((r, i) => new TableRow({ children: r.map((v) => cell(v, { shade: i % 2 === 1 })) })),
    ],
  });
}

function buildHeader(title, docNumber) {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 6 } },
        children: [
          new TextRun({ text: String(title || 'Procedure'), font: FONT, bold: true, color: NAVY, size: 18 }),
          new TextRun({ text: `\t${docNumber || ''}`, font: FONT, color: MUTED, size: 16 }),
        ],
      }),
    ],
  });
}

function buildFooter(classification) {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [
          { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
          { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
        ],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 6 } },
        children: [
          new TextRun({ text: classification, font: FONT, color: MUTED, size: 15 }),
          new TextRun({ text: '\t', font: FONT, size: 15 }),
          new TextRun({ text: 'Page ', font: FONT, color: MUTED, size: 15 }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, color: MUTED, size: 15 }),
          new TextRun({ text: ' of ', font: FONT, color: MUTED, size: 15 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, color: MUTED, size: 15 }),
        ],
      }),
    ],
  });
}

function buildDoc(p) {
  const children = [];
  const title = p.metadata?.title || 'Procedure';
  const docNumber = p.metadata?.documentNumber || '';

  children.push(new Paragraph({
    children: [new TextRun({ text: title, font: FONT, bold: true, color: NAVY_DARK, size: 44 })],
    spacing: { after: 60 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Standard Operating Procedure', font: FONT, color: GOLD, bold: true, size: 20 })],
    spacing: { after: 240 },
  }));

  children.push(table(
    ['Field', 'Value'],
    [
      ['Document Number', docNumber],
      ['Revision Number', p.metadata?.revisionNumber || ''],
      ['Effective Date', p.metadata?.effectiveDate || ''],
      ['Developer', p.metadata?.developer || ''],
      ['Approver', p.metadata?.approver || ''],
    ],
  ));

  if (p.revisionHistory?.length) {
    children.push(heading('Revision History', HeadingLevel.HEADING_3));
    children.push(table(
      ['Revision', 'Date', 'Changes', 'Developer', 'Approver'],
      p.revisionHistory.map((r) => [r.revision, r.date, r.changes, r.developer, r.approver]),
    ));
  }

  children.push(heading('1.0 Purpose', HeadingLevel.HEADING_1));
  children.push(txt(p.purpose || ''));

  children.push(heading('2.0 Scope', HeadingLevel.HEADING_1));
  children.push(txt(p.scope?.summary || ''));
  children.push(txt(`Start: ${p.scope?.start || ''}`, { bold: true }));
  children.push(txt(`End: ${p.scope?.end || ''}`, { bold: true }));
  if (p.scope?.exclusions?.length) {
    children.push(txt('Exclusions', { bold: true, color: NAVY }));
    children.push(...bullets(p.scope.exclusions));
  }

  children.push(heading('3.0 Applicability', HeadingLevel.HEADING_1));
  children.push(txt(p.applicability || ''));

  children.push(heading('4.0 Requirements', HeadingLevel.HEADING_1));
  for (const [label, key] of [['Regulatory', 'regulatory'], ['Governance', 'governance'], ['Business', 'business'], ['Compliance', 'compliance']]) {
    const items = p.requirements?.[key];
    if (items?.length) {
      children.push(heading(label, HeadingLevel.HEADING_3));
      children.push(...bullets(items));
    }
  }

  if (p.definitions?.length) {
    children.push(heading('5.0 Terms and Definitions', HeadingLevel.HEADING_1));
    children.push(table(['Term', 'Definition'], p.definitions.map((d) => [d.term, d.definition])));
  }

  children.push(heading('6.0 Responsibilities', HeadingLevel.HEADING_1));
  for (const r of p.responsibilities || []) {
    children.push(heading(r.role, HeadingLevel.HEADING_3));
    children.push(...bullets(r.responsibilities));
  }
  if (p.raci?.length) {
    children.push(heading('RACI Matrix', HeadingLevel.HEADING_3));
    children.push(table(
      ['Activity', 'Responsible', 'Accountable', 'Consulted', 'Informed'],
      p.raci.map((r) => [r.activity, r.responsible, r.accountable, r.consulted, r.informed]),
    ));
  }

  children.push(heading('7.0 Procedure', HeadingLevel.HEADING_1));
  for (const sub of p.procedure || []) {
    children.push(heading(`${sub.id} ${sub.title}`, HeadingLevel.HEADING_2));
    if (sub.objective) children.push(txt(`Objective: ${sub.objective}`));
    if (sub.trigger) children.push(txt(`Trigger: ${sub.trigger}`));
    if (sub.steps?.length) {
      children.push(table(
        ['Step', 'Action', 'Role', 'Input', 'Output', 'Control', 'Record'],
        sub.steps.map((s) => [s.step, s.action, s.role, s.input || '', s.output || '', s.control || '', s.record || '']),
      ));
    }
    if (sub.exceptions) children.push(txt(`Exceptions/Escalations: ${sub.exceptions}`, { italics: true }));
  }

  if (p.kpis?.length) {
    children.push(heading('8.0 Performance Indicators', HeadingLevel.HEADING_1));
    children.push(table(
      ['Indicator', 'Description', 'Responsible Role', 'Target'],
      p.kpis.map((k) => [k.indicator, k.description, k.role, k.target]),
    ));
  }

  if (p.records?.length) {
    children.push(heading('9.0 Records', HeadingLevel.HEADING_1));
    children.push(table(
      ['Record Name', 'Form Number', 'Owner', 'Storage Location', 'Retention'],
      p.records.map((r) => [r.name, r.formNumber, r.owner, r.location, r.retention]),
    ));
  }

  children.push(heading('10.0 References', HeadingLevel.HEADING_1));
  children.push(...bullets(p.references));

  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 21, color: INK } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      headers: { default: buildHeader(title, docNumber) },
      footers: { default: buildFooter('CONFIDENTIAL - INTERNAL USE ONLY') },
      children,
    }],
  });
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
