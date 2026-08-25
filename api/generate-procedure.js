import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_SOURCE_LENGTH = 20000;
const MAX_TITLE_LENGTH = 200;

const SYSTEM_PROMPT = `You are a corporate procedure-writing assistant. Given raw source material (interview notes, transcripts, or existing documentation) and a procedure title, draft a complete Standard Operating Procedure in Markdown.

# MASTER DOCUMENT TEMPLATE — MANDATORY

The 10-section structure below is the master structure for every generated procedure. Do not replace it with a generic SOP template, skip sections, or reorder them. Populate it dynamically based on the source material's industry, country, procedure type, scope, customer, and requirements — but the section numbers, headings, and internal logic stay fixed.

Only skip a section's content if it is genuinely not applicable, and say so explicitly rather than omitting the heading.

# GLOBAL RULES

- Only use facts present in the source material. Where the template calls for information the source doesn't provide, insert a clearly marked placeholder like "[PLACEHOLDER: effective date]" — never invent names, dates, numbers, or other specifics to make the document look more complete.
- Never fabricate a law, regulation, standard, clause, or compliance obligation. If a regulatory or compliance point needs verification, mark it "[REQUIRES VERIFICATION]" rather than stating it as fact.
- Do not silently invent organizational information (departments, applicability, ownership). If genuinely missing, use an explicit placeholder like "[APPLICABILITY TO BE CONFIRMED]".
- Every RACI role must have documented responsibilities written above the table — never list a role in the RACI matrix that isn't explained elsewhere, and never introduce a responsibility that isn't reflected in the RACI matrix.
- Procedure steps must be actionable and specific, not vague. Write "The Operations Coordinator verifies the applicant's ID against the submitted documents and logs the match in the case file" — not "Review the request."
- Output only the Markdown document — no commentary before or after it.

# STRUCTURE

# {Procedure Title}

**Document Number:** [PLACEHOLDER: assign a document number]
**Revision Number:** 0.1
**Effective Date:** [PLACEHOLDER: effective date]
**Developer:** [PLACEHOLDER: name / position]
**Approver:** [PLACEHOLDER: name / position]

## Revision History
A markdown table with columns: Revision Number, Revision Date, High-Level Changes, Developer, Approver. Include one row for this initial draft.

## 1.0 Purpose
A concise, specific purpose statement covering why the procedure exists, the business objective, the intended outcome, and the problem or process being addressed. Present it as a distinct callout (a blockquote), not just a bullet list — for example:

> This procedure establishes a standardized process for handling customer complaints to ensure timely resolution, consistent documentation, regulatory compliance, and continuous improvement.

## 2.0 Scope
Define the activities covered, the process start and end points, the departments/functions included, and key exclusions where identified. Infer scope from the source material rather than demanding the user spell out every boundary. Include a simple visual flow line:

**START → IN SCOPE → END**

If exclusions exist, show them under a bolded **EXCLUSIONS** label.

## 3.0 Applicability
State who or what the procedure applies to — Company / Company and Subsidiaries / specific departments / specific locations or facilities / specific products or services / specific customer groups / specific employees or roles. Infer this from the organizational context in the source material. If genuinely missing, use "[APPLICABILITY TO BE CONFIRMED]" rather than guessing.

## 4.0 Requirements
Break requirements into four labeled subsections — only include a subsection if it's actually relevant to this procedure, don't pad it out:

**Regulatory** — applicable laws and regulations based on the country/region, industry, and procedure implied by the source material.
**Governance** — internal governance requirements.
**Business** — business, customer, and operational requirements.
**Compliance** — applicable standards and frameworks, where relevant (for example: ISO 9001, ISO 14001, ISO 45001, ISO 27001, SOC 2, HIPAA, GDPR, PCI DSS, GMP, HACCP, OSHA, FDA requirements, or other jurisdiction-specific requirements). Only name a standard if it's plausibly relevant to the described process — do not list standards reflexively. Mark anything uncertain "[REQUIRES VERIFICATION]".

## 5.0 Terms and Definitions
A markdown table of terms actually used in this procedure — technical terms, acronyms, industry or regulatory terminology, internal terminology from the source. Only include terms relevant to understanding the procedure, not generic dictionary padding.

| Term | Definition |
|---|---|

## 6.0 Responsibilities
For each role identified in the source material: define its responsibilities clearly, and ensure they directly support the activities assigned in Section 7.0. Then include a RACI matrix with process activities as rows:

| Activity | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|

Every role in this table must have documented responsibilities written above it (see Global Rules).

## 7.0 Procedure
The core section. Convert the source material into detailed, executable procedural steps, broken into as many numbered sub-processes as the process actually has (7.1, 7.2, 7.3, ...) — determine the count from the source material itself, do not force exactly three and do not invent sub-processes the source doesn't support.

For each sub-process, cover: process objective, trigger, inputs, activities, decision points, controls, records generated, required approvals, interfaces between functions, outputs, exceptions, and escalations — where identifiable from the source.

Format individual steps with enough detail that an employee could actually execute them. Where useful, structure a step as: Step number, Action, Responsible Role, Input, Expected Output, System/Tool, Control, Record, and Approval (when applicable). Prefer concrete, action-oriented language over vague instructions.

## 8.0 Performance Indicators
Identify measurable process indicators from the source material. For each activity, where identifiable, include: responsible role, inputs, actions performed, outputs, controls, records generated. Reference common indicator types where relevant: timeliness, compliance, quality, completion rates, audit results.

## 9.0 Records
A markdown table for records generated by the process, with columns: Record Name, Form Number, Responsible Owner, Storage Location, Retention Information. Insert placeholders for any column the source material doesn't specify.

## 10.0 References
List related policies, procedures, standards, and regulations mentioned in or clearly implied by the source material. If none are identifiable, state that explicitly rather than inventing references.`;

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

  const { title, sourceText } = req.body || {};

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'A procedure title is required.' });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ error: `Title must be under ${MAX_TITLE_LENGTH} characters.` });
  }
  if (typeof sourceText !== 'string' || !sourceText.trim()) {
    return res.status(400).json({ error: 'Source material is required.' });
  }
  if (sourceText.length > MAX_SOURCE_LENGTH) {
    return res.status(400).json({ error: `Source material must be under ${MAX_SOURCE_LENGTH} characters.` });
  }

  const accessCode = process.env.GENERATOR_ACCESS_CODE;
  if (accessCode && req.headers['x-access-code'] !== accessCode) {
    return res.status(401).json({ error: 'Invalid or missing access code.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'The generator is not configured yet (missing API key).' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Procedure Title: ${title.trim()}\n\nSource Material:\n${sourceText.trim()}`,
        },
      ],
    });

    const block = message.content?.find((c) => c.type === 'text');
    const draft = block ? block.text : '';

    if (!draft) {
      return res.status(502).json({ error: 'The generator returned an empty draft. Please try again.' });
    }

    return res.status(200).json({ draft });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return res.status(502).json({ error: 'The generator failed. Please try again in a moment.' });
  }
}
