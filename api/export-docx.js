import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, Header, Footer, PageNumber,
  TabStopType, TabStopPosition, VerticalAlign,
  PageBorderDisplay, PageBorderOffsetFrom, PageBorderZOrder,
  Bookmark, PageReference, LeaderType,
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

// Same as heading(), but wraps the run in a named Bookmark so the static table of
// contents can point a real PAGEREF field at it.
function bookmarkedHeading(text, level, bookmarkId, { pageBreakBefore = false } = {}) {
  const sizes = { [HeadingLevel.HEADING_1]: 30, [HeadingLevel.HEADING_2]: 25, [HeadingLevel.HEADING_3]: 21 };
  return new Paragraph({
    heading: level,
    pageBreakBefore,
    spacing: { before: 340, after: 160 },
    border: level !== HeadingLevel.HEADING_3
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: level === HeadingLevel.HEADING_1 ? NAVY : BORDER, space: 4 } }
      : undefined,
    children: [
      new Bookmark({
        id: bookmarkId,
        children: [new TextRun({
          text: String(text ?? ''), font: FONT, bold: true,
          color: level === HeadingLevel.HEADING_3 ? GOLD : NAVY,
          size: sizes[level] || 22,
        })],
      }),
    ],
  });
}

// A single always-visible TOC row: static title text with a dot leader to a real
// PAGEREF field. The title never depends on a field being manually refreshed.
function tocEntry(label, bookmarkId, { indent = false } = {}) {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader: LeaderType.DOT }],
    indent: indent ? { left: 360 } : undefined,
    spacing: { after: 100 },
    children: [
      new TextRun({ text: label, font: FONT, color: indent ? MUTED : NAVY_DARK, bold: !indent, size: indent ? 18 : 21 }),
      new TextRun({ text: '\t', font: FONT, size: 19 }),
      new PageReference(bookmarkId, { hyperlink: true }),
    ],
  });
}

// Builds the section outline once so the static TOC, the bookmarked headings,
// and the sub-process numbers all agree, and section numbers are always
// sequential with no gaps, regardless of which optional sections (Definitions,
// KPIs, Records) are actually present in this particular document. The AI's
// own sub.id guess (e.g. "7.1") assumes a fixed section count that varies per
// document, so it is never trusted for display, only real, computed numbers.
function buildOutline(p) {
  const ids = {
    purpose: 'sec_purpose', turtle: 'sec_turtle', scope: 'sec_scope', applicability: 'sec_applicability',
    requirements: 'sec_requirements', definitions: 'sec_definitions', responsibilities: 'sec_responsibilities',
    procedure: 'sec_procedure', kpis: 'sec_kpis', records: 'sec_records', references: 'sec_references',
    annexures: 'sec_annexures',
  };

  let n = 0;
  const next = () => { n += 1; return n; };
  const nums = {
    purpose: next(),
    turtle: next(),
    scope: next(),
    applicability: next(),
    requirements: next(),
    definitions: p.definitions?.length ? next() : null,
    responsibilities: next(),
    procedure: next(),
    kpis: p.kpis?.length ? next() : null,
    records: p.records?.length ? next() : null,
    references: next(),
  };

  const entries = [
    { label: `${nums.purpose}.0 Purpose`, id: ids.purpose },
    { label: `${nums.turtle}.0 Process Turtle Diagram`, id: ids.turtle },
    { label: `${nums.scope}.0 Scope`, id: ids.scope },
    { label: `${nums.applicability}.0 Applicability`, id: ids.applicability },
    { label: `${nums.requirements}.0 Requirements`, id: ids.requirements },
  ];
  if (nums.definitions) entries.push({ label: `${nums.definitions}.0 Terms and Definitions`, id: ids.definitions });
  entries.push({ label: `${nums.responsibilities}.0 Responsibilities`, id: ids.responsibilities });
  entries.push({ label: `${nums.procedure}.0 Procedure`, id: ids.procedure });
  const subLabels = (p.procedure || []).map((sub, i) => {
    const label = `${nums.procedure}.${i + 1} ${sub.title}`;
    entries.push({ label, id: `sec_proc_${i}`, indent: true });
    return label;
  });
  if (nums.kpis) entries.push({ label: `${nums.kpis}.0 Performance Indicators`, id: ids.kpis });
  if (nums.records) entries.push({ label: `${nums.records}.0 Records`, id: ids.records });
  entries.push({ label: `${nums.references}.0 References`, id: ids.references });
  if (p.annexures?.length) {
    entries.push({ label: 'Annexures', id: ids.annexures });
    p.annexures.forEach((a, i) => {
      entries.push({ label: `Annexure ${a.letter} - ${a.title}`, id: `sec_annex_${i}`, indent: true });
    });
  }
  return { ids, nums, entries, subLabels };
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

// Native-table bar chart: no ImageRun/canvas dependency, renders as real Word
// table cells (a filled, colored cell sized by percentage width next to an
// empty one), so it survives editing and prints reliably. This is the
// "chart" primitive reused for both the KPI chart and the requirements
// distribution chart below.
function barTrack(pct) {
  const filled = Math.max(2, Math.min(100, Math.round(pct)));
  const rowChildren = [
    new TableCell({
      width: { size: filled, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
      margins: { top: 60, bottom: 60, left: 0, right: 0 },
      children: [new Paragraph({ children: [] })],
    }),
  ];
  if (filled < 100) {
    rowChildren.push(new TableCell({
      width: { size: 100 - filled, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.SOLID, color: ROW_ALT, fill: ROW_ALT },
      margins: { top: 60, bottom: 60, left: 0, right: 0 },
      children: [new Paragraph({ children: [] })],
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: rowChildren })],
  });
}

function barChartRow(label, pct, displayValue) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 0, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, color: INK, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 57, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 0, right: 100 },
        children: [barTrack(pct)],
      }),
      new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 0, right: 0 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: displayValue, font: FONT, bold: true, color: NAVY_DARK, size: 18 })],
        })],
      }),
    ],
  });
}

function barChart(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map((r) => barChartRow(r.label, r.pct, r.displayValue)),
  });
}

// KPI bar chart: only percentage-based targets, and only when there are
// genuinely two or more to compare (same threshold used on the web preview,
// so a single number never gets a misleading "chart").
function buildKpiChart(kpis) {
  const withPct = (kpis || [])
    .map((k) => {
      const m = String(k.target || '').match(/(\d+(?:\.\d+)?)\s*%/);
      return m ? { label: k.indicator, pct: Math.min(100, parseFloat(m[1])), displayValue: `${m[1]}%` } : null;
    })
    .filter(Boolean);
  return withPct.length >= 2 ? barChart(withPct) : null;
}

// Requirements distribution: relative bar per category, scaled against the
// largest category so the chart reflects real proportion, not raw counts.
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
function capList(items, max = 4) {
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
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: headerText, font: FONT, bold: true, color: 'FFFFFF', size: 16 })],
          })],
        })],
      }),
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: ROW_ALT, fill: ROW_ALT },
          margins: { top: 70, bottom: 70, left: 100, right: 100 },
          children: list.length
            ? list.map((t) => new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: t, font: FONT, color: INK, size: 17 })],
              spacing: { after: 30 },
            }))
            : [new Paragraph({ children: [new TextRun({ text: '[To Be Confirmed]', font: FONT, color: MUTED, italics: true, size: 17 })] })],
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
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'ACTIVITY', font: FONT, bold: true, color: 'FFFFFF', size: 16 })],
          })],
        })],
      }),
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: ROW_ALT, fill: ROW_ALT },
          margins: { top: 90, bottom: 90, left: 140, right: 140 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: title, font: FONT, bold: true, color: NAVY_DARK, size: 21 })],
              spacing: { after: 60 },
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: description, font: FONT, color: INK, size: 17 })],
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

// A single step box in the process flowchart: navy for a normal action step,
// gold for a decision point so it reads as visually distinct without needing
// an actual diamond shape.
function flowStepBox(step, isDecision) {
  const headerColor = isDecision ? GOLD : NAVY;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: headerColor },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: headerColor },
      left: { style: BorderStyle.SINGLE, size: 4, color: headerColor },
      right: { style: BorderStyle.SINGLE, size: 4, color: headerColor },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: headerColor },
    },
    rows: [
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: headerColor, fill: headerColor },
          margins: { top: 40, bottom: 40, left: 90, right: 90 },
          children: [new Paragraph({
            children: [new TextRun({
              text: `${isDecision ? 'DECISION' : 'STEP'} ${step.step}${step.role ? ` - ${step.role}` : ''}`,
              font: FONT, bold: true, color: 'FFFFFF', size: 15,
            })],
          })],
        })],
      }),
      new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.SOLID, color: ROW_ALT, fill: ROW_ALT },
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new Paragraph({
            children: [new TextRun({ text: step.action || '', font: FONT, color: INK, size: 17 })],
          })],
        })],
      }),
    ],
  });
}

// Two side-by-side outcome boxes for a decision step's Yes/No paths.
function flowDecisionBranches(yesLabel, noLabel) {
  const branch = (label, color) => new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
      left: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
      right: { style: BorderStyle.SINGLE, size: 3, color: BORDER },
    },
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({
      children: [
        new TextRun({ text: color === 'YES' ? 'YES  ' : 'NO  ', font: FONT, bold: true, color: NAVY, size: 15 }),
        new TextRun({ text: label || 'Not specified', font: FONT, color: INK, size: 15 }),
      ],
    })],
  });
  return new Table({
    width: { size: 92, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [branch(yesLabel, 'YES'), branch(noLabel, 'NO')] })],
  });
}

// Process flowchart: a vertical sequence of connected step boxes, with
// decision steps calling out their Yes/No paths directly beneath. Capped to
// a reasonable number of steps so the flowchart stays a quick-scan visual;
// the full detail always follows in the step table underneath it.
function buildProcessFlowchart(sub) {
  const steps = (sub.steps || []).slice(0, 10);
  const children = [];
  steps.forEach((step, i) => {
    children.push(flowStepBox(step, Boolean(step.isDecision)));
    if (step.isDecision) {
      children.push(txt('', { size: 2 }));
      children.push(flowDecisionBranches(step.decisionYes, step.decisionNo));
      children.push(txt('', { size: 2 }));
    }
    if (i < steps.length - 1) children.push(arrowConnector('↓'));
  });
  if ((sub.steps || []).length > steps.length) {
    children.push(txt(`+ ${sub.steps.length - steps.length} more step(s), see the table below for the full sequence.`, { italics: true, color: MUTED, size: 17 }));
  }
  return children;
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

  // --- Page 1: Cover + Document Control combined, so the page is never
  // left mostly blank the way a title-only cover page would be. ---
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: GOLD, space: 14 } },
    spacing: { after: 200 },
    children: [new TextRun({ text: 'CONTROLLED DOCUMENT', font: FONT, bold: true, color: GOLD, size: 18 })],
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: title, font: FONT, bold: true, color: NAVY_DARK, size: 48 })],
    spacing: { after: 80 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Standard Operating Procedure', font: FONT, color: NAVY, bold: true, size: 22 })],
    spacing: { after: 60 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'CONFIDENTIAL - INTERNAL USE ONLY', font: FONT, bold: true, color: MUTED, size: 15 })],
    spacing: { after: 280 },
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

  // --- Table of Contents: flows naturally after Document Control (no forced
  // break here) so a short document never leaves a near-empty page behind. ---
  const { ids, nums, entries, subLabels } = buildOutline(p);
  let figureNum = 0;
  const figureCaption = (text) => {
    figureNum += 1;
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 200 },
      children: [new TextRun({ text: `Figure ${figureNum}. ${text}`, font: FONT, italics: true, color: MUTED, size: 16 })],
    });
  };

  children.push(heading('Table of Contents', HeadingLevel.HEADING_1));
  for (const e of entries) children.push(tocEntry(e.label, e.id, { indent: e.indent }));

  children.push(bookmarkedHeading(`${nums.purpose}.0 Purpose`, HeadingLevel.HEADING_1, ids.purpose, { pageBreakBefore: true }));
  children.push(txt(p.purpose || ''));

  children.push(bookmarkedHeading(`${nums.turtle}.0 Process Turtle Diagram`, HeadingLevel.HEADING_1, ids.turtle));
  children.push(txt('A structured view of this procedure showing what feeds into it, what it produces, and how it is executed and measured.'));
  children.push(buildTurtleDiagram(p));
  children.push(figureCaption(`Process Turtle Diagram for ${title}`));

  children.push(bookmarkedHeading(`${nums.scope}.0 Scope`, HeadingLevel.HEADING_1, ids.scope));
  children.push(txt(p.scope?.summary || ''));
  children.push(txt(`Start: ${p.scope?.start || ''}`, { bold: true }));
  children.push(txt(`End: ${p.scope?.end || ''}`, { bold: true }));
  if (p.scope?.exclusions?.length) {
    children.push(txt('Exclusions', { bold: true, color: NAVY }));
    children.push(...bullets(p.scope.exclusions));
  }

  children.push(bookmarkedHeading(`${nums.applicability}.0 Applicability`, HeadingLevel.HEADING_1, ids.applicability));
  children.push(txt(p.applicability || ''));

  children.push(bookmarkedHeading(`${nums.requirements}.0 Requirements`, HeadingLevel.HEADING_1, ids.requirements));
  for (const [label, key] of [['Regulatory', 'regulatory'], ['Governance', 'governance'], ['Business', 'business'], ['Compliance', 'compliance']]) {
    const items = p.requirements?.[key];
    if (items?.length) {
      children.push(heading(label, HeadingLevel.HEADING_3));
      children.push(...bullets(items));
    }
  }

  if (p.definitions?.length) {
    children.push(bookmarkedHeading(`${nums.definitions}.0 Terms and Definitions`, HeadingLevel.HEADING_1, ids.definitions));
    children.push(table(['Term', 'Definition'], p.definitions.map((d) => [d.term, d.definition])));
  }

  children.push(bookmarkedHeading(`${nums.responsibilities}.0 Responsibilities`, HeadingLevel.HEADING_1, ids.responsibilities));
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

  children.push(bookmarkedHeading(`${nums.procedure}.0 Procedure`, HeadingLevel.HEADING_1, ids.procedure));
  (p.procedure || []).forEach((sub, i) => {
    children.push(bookmarkedHeading(subLabels[i], HeadingLevel.HEADING_2, `sec_proc_${i}`));
    if (sub.objective) children.push(txt(`Objective: ${sub.objective}`));
    if (sub.trigger) children.push(txt(`Trigger: ${sub.trigger}`));
    if (sub.steps?.length) {
      children.push(heading('Process Flow', HeadingLevel.HEADING_3));
      children.push(...buildProcessFlowchart(sub));
      children.push(figureCaption(`Process Flow for ${subLabels[i]}`));
      children.push(heading('Step Detail', HeadingLevel.HEADING_3));
      children.push(table(
        ['Step', 'Action', 'Role', 'Input', 'Output', 'Control', 'Record', 'Approval'],
        sub.steps.map((s) => [
          s.step,
          s.action + (s.isDecision ? ` (Decision. Yes: ${s.decisionYes || ''}. No: ${s.decisionNo || ''})` : ''),
          s.role, s.input || '', s.output || '', s.control || '', s.record || '', s.approval || '',
        ]),
      ));
    }
    if (sub.exceptions) children.push(txt(`Exceptions/Escalations: ${sub.exceptions}`, { italics: true }));
  });

  if (p.kpis?.length) {
    children.push(bookmarkedHeading(`${nums.kpis}.0 Performance Indicators`, HeadingLevel.HEADING_1, ids.kpis));
    const kpiChart = buildKpiChart(p.kpis);
    if (kpiChart) {
      children.push(heading('Performance Targets', HeadingLevel.HEADING_3));
      children.push(kpiChart);
      children.push(txt('', { size: 2 }));
    }
    children.push(table(
      ['Indicator', 'Description', 'Responsible Role', 'Target'],
      p.kpis.map((k) => [k.indicator, k.description, k.role, k.target]),
    ));
  }

  if (p.records?.length) {
    children.push(bookmarkedHeading(`${nums.records}.0 Records`, HeadingLevel.HEADING_1, ids.records));
    children.push(table(
      ['Record Name', 'Form Number', 'Owner', 'Storage Location', 'Retention'],
      p.records.map((r) => [r.name, r.formNumber, r.owner, r.location, r.retention]),
    ));
  }

  children.push(bookmarkedHeading(`${nums.references}.0 References`, HeadingLevel.HEADING_1, ids.references));
  children.push(...bullets(p.references));

  if (p.annexures?.length) {
    children.push(bookmarkedHeading('Annexures', HeadingLevel.HEADING_1, ids.annexures));
    p.annexures.forEach((a, i) => {
      children.push(bookmarkedHeading(`Annexure ${a.letter} - ${a.title}`, HeadingLevel.HEADING_2, `sec_annex_${i}`));
      children.push(txt(a.content || ''));
    });
  }

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
