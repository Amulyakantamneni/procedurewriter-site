import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, Header, Footer, PageNumber,
  TabStopType, TabStopPosition, VerticalAlign, TableOfContents,
  PageBorderDisplay, PageBorderOffsetFrom, PageBorderZOrder,
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

function formatDate(d) {
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean).map((v) => String(v)))];
}

function heading(text, level = HeadingLevel.HEADING_2, { pageBreakBefore = false } = {}) {
  const sizes = { [HeadingLevel.HEADING_1]: 30, [HeadingLevel.HEADING_2]: 25, [HeadingLevel.HEADING_3]: 21 };
  return new Paragraph({
    children: [new TextRun({
      text: String(text ?? ''), font: FONT, bold: true,
      color: level === HeadingLevel.HEADING_3 ? GOLD : NAVY,
      size: sizes[level] || 22,
    })],
    heading: level,
    pageBreakBefore,
    spacing: { before: 340, after: 160 },
    border: level !== HeadingLevel.HEADING_3
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: level === HeadingLevel.HEADING_1 ? NAVY : BORDER, space: 4 } }
      : undefined,
  });
}

function sectionBar(text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      left: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      right: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
    },
    rows: [
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: GOLD, fill: GOLD },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          children: [new Paragraph({
            children: [new TextRun({ text: text.toUpperCase(), font: FONT, bold: true, color: NAVY_DARK, size: 20 })],
          })],
        })],
      }),
    ],
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

function buildHeader(title, docNumber, generatedDate) {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [
          { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
          { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
        ],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 6 } },
        children: [
          new TextRun({ text: String(title || 'Procedure'), font: FONT, bold: true, color: NAVY, size: 18 }),
          new TextRun({ text: `\t${docNumber || ''}`, font: FONT, color: MUTED, size: 16 }),
          new TextRun({ text: `\tEffective Date: ${generatedDate}`, font: FONT, color: MUTED, size: 16 }),
        ],
      }),
    ],
  });
}

// Caps a list to `max` items so a turtle-diagram box never grows past a couple of lines.
function capList(items, max = 3) {
  const list = uniq(items);
  if (list.length <= max) return list;
  return [...list.slice(0, max), `+ ${list.length - max} more`];
}

// Trims free text to a short, sentence-safe summary for the Activity box, never
// pasting the full procedure in.
function summarize(text, maxLen = 220) {
  const clean = String(text || '').trim();
  if (!clean) return '[To Be Confirmed]';
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}

// Compact nested header-bar + bulleted-body box used inside the turtle diagram grid.
function turtleBox(headerText, items) {
  const list = capList(items);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      left: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      right: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
    },
    rows: [
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: headerText, font: FONT, bold: true, color: 'FFFFFF', size: 14 })],
          })],
        })],
      }),
      new TableRow({
        children: [new TableCell({
          margins: { top: 50, bottom: 50, left: 90, right: 90 },
          children: list.length
            ? list.map((t) => new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: t, font: FONT, color: INK, size: 15 })],
              spacing: { after: 20 },
            }))
            : [new Paragraph({ children: [new TextRun({ text: '[To Be Confirmed]', font: FONT, color: MUTED, italics: true, size: 15 })] })],
        })],
      }),
    ],
  });
}

// The center box: a short, generated 1-3 sentence description of the process,
// never the full procedure text.
function activityBox(title, description) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      left: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      right: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: NAVY },
    },
    rows: [
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
          margins: { top: 40, bottom: 40, left: 80, right: 80 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'ACTIVITY', font: FONT, bold: true, color: 'FFFFFF', size: 14 })],
          })],
        })],
      }),
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: ROW_ALT, fill: ROW_ALT },
          margins: { top: 70, bottom: 70, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: title, font: FONT, bold: true, color: NAVY_DARK, size: 18 })],
              spacing: { after: 40 },
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: description, font: FONT, color: INK, size: 15 })],
            }),
          ],
        })],
      }),
    ],
  });
}

function turtleGridCell(box, { rowSpan, columnSpan } = {}) {
  return new TableCell({
    rowSpan,
    columnSpan,
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    verticalAlign: VerticalAlign.CENTER,
    children: [box],
  });
}

function arrowConnector(symbol) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: symbol, font: FONT, bold: true, color: NAVY, size: 24 })],
  });
}

// Turtle diagram: Input -> Activity -> Output flow flanked by With What, With Who,
// How and With What Measure, derived entirely from the procedure's own
// responsibilities, requirements, steps and KPIs (never invented). Dedicated
// connector rows carry the up/down arrows into Activity so the direction of flow
// is explicit rather than implied by position alone, and every leg is capped to a
// few items so the whole diagram stays compact.
function buildTurtleDiagram(p) {
  const title = p.metadata?.title || 'Procedure';
  const allSteps = (p.procedure || []).flatMap((s) => s.steps || []);
  const inputs = uniq(allSteps.map((s) => s.input));
  const outputs = uniq(allSteps.map((s) => s.output));
  const withWhat = uniq(allSteps.map((s) => s.system));
  const withWho = uniq([
    ...(p.responsibilities || []).map((r) => r.role),
    ...allSteps.map((s) => s.role),
  ]);
  const methods = uniq([
    ...(p.requirements?.governance || []),
    ...(p.requirements?.business || []),
  ]);
  const how = methods.length ? methods : uniq((p.procedure || []).map((s) => s.title));
  const howMeasured = uniq((p.kpis || []).map((k) => `${k.indicator}${k.target ? `: ${k.target}` : ''}`));
  const description = summarize(p.purpose, 220);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ children: [
        turtleGridCell(turtleBox('INPUT  →', inputs.length ? inputs : [p.scope?.start].filter(Boolean)), { rowSpan: 5 }),
        turtleGridCell(turtleBox('WITH WHAT (Resources & Systems)', withWhat)),
        turtleGridCell(turtleBox('WITH WHO (People & Roles)', withWho)),
        turtleGridCell(turtleBox('→  OUTPUT', outputs.length ? outputs : [p.scope?.end].filter(Boolean)), { rowSpan: 5 }),
      ] }),
      new TableRow({ children: [
        turtleGridCell(arrowConnector('↓')),
        turtleGridCell(arrowConnector('↓')),
      ] }),
      new TableRow({ children: [
        turtleGridCell(activityBox(title, description), { columnSpan: 2 }),
      ] }),
      new TableRow({ children: [
        turtleGridCell(arrowConnector('↑')),
        turtleGridCell(arrowConnector('↑')),
      ] }),
      new TableRow({ children: [
        turtleGridCell(turtleBox('HOW (Methods & Standards)', how)),
        turtleGridCell(turtleBox('WITH WHAT MEASURE (KPIs)', howMeasured)),
      ] }),
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

  children.push(sectionBar('Document Information'));
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
    children.push(txt('', { size: 2 }));
    children.push(sectionBar('Revision History'));
    children.push(table(
      ['Revision', 'Date', 'Changes', 'Developer', 'Approver'],
      p.revisionHistory.map((r) => [r.revision, r.date, r.changes, r.developer, r.approver]),
    ));
  }

  children.push(heading('Table of Contents', HeadingLevel.HEADING_1));
  children.push(new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }));

  children.push(heading('1.0 Purpose', HeadingLevel.HEADING_1, { pageBreakBefore: true }));
  children.push(txt(p.purpose || ''));

  children.push(heading('2.0 Process Turtle Diagram', HeadingLevel.HEADING_1));
  children.push(buildTurtleDiagram(p));

  children.push(heading('3.0 Scope', HeadingLevel.HEADING_1));
  children.push(txt(p.scope?.summary || ''));
  children.push(txt(`Start: ${p.scope?.start || ''}`, { bold: true }));
  children.push(txt(`End: ${p.scope?.end || ''}`, { bold: true }));
  if (p.scope?.exclusions?.length) {
    children.push(txt('Exclusions', { bold: true, color: NAVY }));
    children.push(...bullets(p.scope.exclusions));
  }

  children.push(heading('4.0 Applicability', HeadingLevel.HEADING_1));
  children.push(txt(p.applicability || ''));

  children.push(heading('5.0 Requirements', HeadingLevel.HEADING_1));
  for (const [label, key] of [['Regulatory', 'regulatory'], ['Governance', 'governance'], ['Business', 'business'], ['Compliance', 'compliance']]) {
    const items = p.requirements?.[key];
    if (items?.length) {
      children.push(heading(label, HeadingLevel.HEADING_3));
      children.push(...bullets(items));
    }
  }

  if (p.definitions?.length) {
    children.push(heading('6.0 Terms and Definitions', HeadingLevel.HEADING_1));
    children.push(table(['Term', 'Definition'], p.definitions.map((d) => [d.term, d.definition])));
  }

  children.push(heading('7.0 Responsibilities', HeadingLevel.HEADING_1));
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

  children.push(heading('8.0 Procedure', HeadingLevel.HEADING_1));
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
    children.push(heading('9.0 Performance Indicators', HeadingLevel.HEADING_1));
    children.push(table(
      ['Indicator', 'Description', 'Responsible Role', 'Target'],
      p.kpis.map((k) => [k.indicator, k.description, k.role, k.target]),
    ));
  }

  if (p.records?.length) {
    children.push(heading('10.0 Records', HeadingLevel.HEADING_1));
    children.push(table(
      ['Record Name', 'Form Number', 'Owner', 'Storage Location', 'Retention'],
      p.records.map((r) => [r.name, r.formNumber, r.owner, r.location, r.retention]),
    ));
  }

  children.push(heading('11.0 References', HeadingLevel.HEADING_1));
  children.push(...bullets(p.references));

  return new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: FONT, size: 21, color: INK } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          borders: {
            pageBorders: {
              display: PageBorderDisplay.ALL_PAGES,
              offsetFrom: PageBorderOffsetFrom.PAGE,
              zOrder: PageBorderZOrder.FRONT,
            },
            pageBorderTop: { style: BorderStyle.SINGLE, size: 10, color: NAVY, space: 18 },
            pageBorderRight: { style: BorderStyle.SINGLE, size: 10, color: NAVY, space: 18 },
            pageBorderBottom: { style: BorderStyle.SINGLE, size: 10, color: NAVY, space: 18 },
            pageBorderLeft: { style: BorderStyle.SINGLE, size: 10, color: NAVY, space: 18 },
          },
        },
      },
      headers: { default: buildHeader(title, docNumber, formatDate(new Date())) },
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
