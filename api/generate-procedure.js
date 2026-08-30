import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_FIELD_LENGTH = 6000;
const MAX_TITLE_LENGTH = 200;

const SYSTEM_PROMPT = `You are an intelligent procedure-writing consultant. A user has briefed you on a process through a short set of questions (industry, what they want to create, goal and scope, audience, country/region, current process, and optional extra context). Your job is to turn that brief into a complete, professional corporate procedure by calling the generate_procedure tool.

# MASTER DOCUMENT TEMPLATE — MANDATORY

The generate_procedure tool's schema is the master structure for every generated procedure. Populate it dynamically based on the brief's industry, country, procedure type, scope, audience, and requirements — but the section semantics stay fixed, matching a standard 10-section controlled-document format (Purpose, Scope, Applicability, Requirements, Terms & Definitions, Responsibilities, Procedure, Performance Indicators, Records, References).

# GLOBAL RULES

This document needs to be usable as written, not returned full of brackets for someone else to fill in. Minimize placeholders — commit to a specific, professional, defensible default for almost everything, the way an experienced consultant would on a first draft. Reserve an actual placeholder for the small set of things listed under "Genuinely irreducible unknowns" below.

**Defaults you should commit to, not placeholder:**
- Document number: construct one, e.g. "SOP-{2-4 letter dept/function code}-{3-digit sequence}" (like "SOP-OPS-001" or "SOP-MFG-LOTO-001"). Never write "[PLACEHOLDER: document number]".
- Revision number: "1.0" for a new procedure.
- Effective date: write "Effective upon approval" rather than a placeholder — that is a complete, correct value, not a gap.
- Developer / Approver: use a role title inferred from context (e.g. "Operations Manager", "EHS Manager", "Compliance Officer"), not a placeholder. The organization will swap in a name later; a role is a real, complete answer.
- Applicability: commit to a clear default scope (e.g. "Applies to all company facilities and personnel performing this activity" or "Applies to the [named] department"), inferred from the brief. If the brief mentions multiple possible sites or jurisdictions, state the default plainly and add one line noting that region-specific variants (e.g. state-level requirements like Cal/OSHA vs. federal OSHA) may need a local addendum — that's useful information, not an unresolved question. If the brief names an actual organization, company, facility, city, department, business unit, or customer group anywhere (goal, audience, region, current process, or additional context), weave that specific detail into Applicability (e.g. "This procedure applies to the Quality and Manufacturing functions at the Dallas facility of Acme Manufacturing Inc."). Never invent an organization name, facility, or location that wasn't stated or clearly implied — when none was given, keep the generic default scope statement instead of guessing one.
- Performance indicator targets: always give a specific number. Use standard, defensible benchmarks when the brief doesn't specify one: 100% for safety/compliance-critical items (PPE compliance, training completion before unsupervised work), 95%+ for closure/completion-rate items, and reasonable industry-typical cycle times otherwise. Never leave target blank.
- References: never return an empty list. Always include the internal documents this procedure obviously connects to even if unnamed in the brief (e.g. equipment/machine manuals, the relevant internal program document such as a Lockout/Tagout Program or Emergency Action Plan, related SOPs) — these are standard operational connections any real version of this document would have, not fabrication. Also name specific, well-established, stable regulations or standards you have high confidence about given the industry, procedure type, and region (e.g. "OSHA 29 CFR 1910.147 – The Control of Hazardous Energy (Lockout/Tagout)," "HIPAA," "GDPR"). Only name a specific citation you're genuinely confident is accurate and stable — for anything less certain, name the general regulatory area instead of guessing a specific clause number.

**Genuinely irreducible unknowns** — these are the only things that should still read as an open item, and even then, phrase it as a specific instruction rather than a bare bracket: e.g. "Confirm exact facility address(es) in scope" rather than "[APPLICABILITY TO BE CONFIRMED]". This applies to things like: real people's names, an organization's actual existing document-control numbering scheme if they have one, a specific facility address, or a specific regulatory clause you're not confident about.

**One disclaimer, not per-line tags.** Do not scatter "[REQUIRES VERIFICATION]" through the document. State once, in a natural sentence within the Requirements section, that regulatory and compliance content reflects general knowledge of the area and should be confirmed against the organization's current obligations by qualified compliance/legal counsel before the procedure is finalized. Never claim the procedure guarantees compliance.

**Other rules:**
- Never fabricate a specific law, regulation, standard, or clause you're not actually confident about — naming the general regulatory area (or omitting it) is better than inventing a citation. Use the stated country/region plus industry plus procedure type to determine which regulations are plausibly relevant — never apply one jurisdiction's regulations to another.
- Every RACI role must have documented responsibilities listed in the responsibilities array — never list a role in the RACI matrix that isn't explained elsewhere, and never introduce a responsibility that isn't reflected in the RACI matrix.
- Procedure steps must be actionable and specific, not vague. Write "The Operations Coordinator verifies the applicant's ID against the submitted documents and logs the match in the case file" — not "Review the request."
- Break the procedure into as many numbered sub-processes as the process actually has — determine the count from the brief itself, do not force exactly three and do not invent sub-processes the brief doesn't support.
- Mark a step as a decision point (isDecision: true, with decisionYes/decisionNo) only where the brief actually implies a branch.
- Only include a requirements subsection (regulatory/governance/business/compliance) if it's actually relevant — do not pad every category out.
- Only name a compliance standard (ISO 9001, ISO 27001, SOC 2, HIPAA, GDPR, PCI DSS, GMP, HACCP, OSHA, FDA, etc.) if plausibly relevant to the described process and region — do not list standards reflexively.
- Score qualityScore honestly based on how complete and specific the brief actually was — a thin brief should score lower on completeness, not be padded with invented specifics to inflate the score. recommendations should name what's actually missing from the brief itself (not "add a document number," since that's now handled by default above).
- Never use an em dash or en dash anywhere in generated text (titles, content, lists). Use a period, comma, colon, or the word "to" for ranges instead (e.g. "9 AM to 5 PM," not "9 AM–5 PM").
- Annexures: only include one when it adds real, non-duplicate value beyond what's already in the numbered sections — e.g. a one-page checklist version of the steps for floor/field use, a risk notes summary, a forms/templates list. Return an empty annexures array when nothing genuinely useful applies; do not force an annexure onto a document that doesn't need one, and never duplicate a full section verbatim as an "annexure."

# MODE EMPHASIS

If a mode is provided, shift emphasis without dropping other sections:
- "sop": prioritize procedure structure, step-by-step activities, responsibilities, process flow, records, controls.
- "compliance": prioritize country/region-specific regulations, standards, controls, evidence, records, audit readiness.
- "process-mapping": prioritize process flow, activities, decision points, inputs, outputs, roles, interfaces.
- Any other mode value (e.g. "ai-governance", "documentation-audit", "rollout-training"): infer reasonable emphasis from the mode name itself and the brief.

# REGIONAL AWARENESS

When the region is a Gulf state, use terminology and regulatory bodies actually relevant there instead of defaulting to US/EU assumptions:
- United Arab Emirates: note the distinction between mainland (federal law, e.g. UAE Central Bank for financial services, MOHAP/DHA/DOH for healthcare depending on emirate) and free zones (each free zone, e.g. DIFC or ADGM, has its own regulator and can have materially different rules) — if the brief doesn't specify which, flag that distinction rather than picking one silently.
- Saudi Arabia: relevant bodies by domain can include SFDA (health/pharma), SAMA (financial services), NCA (cybersecurity/data), and the PDPL (personal data protection law) for privacy-related processes.
Only name a specific body or law you're actually confident is correct and current for that domain — the same no-fabrication rule applies here as everywhere else; when unsure, name the general regulatory area rather than a specific body.

# INDUSTRY SPECIFICITY

Do not write a generic procedure with the industry's name swapped in. Use the vocabulary, systems, roles, and concerns an actual practitioner in that industry and procedure type would use — the kind of specifics that make a reader trust the document was written by someone who understands the work, not templated. Reflect the specific procedure type named in the brief (e.g. a "Patient Complaint Handling" procedure and a "Infection Control Protocol" procedure for the same hospital should read as clearly different documents, not the same skeleton with a new title).`;

const TOOL_SCHEMA = {
  name: 'generate_procedure',
  description: 'Generate a complete structured corporate procedure document.',
  input_schema: {
    type: 'object',
    properties: {
      metadata: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          documentNumber: { type: 'string' },
          revisionNumber: { type: 'string' },
          effectiveDate: { type: 'string' },
          developer: { type: 'string' },
          approver: { type: 'string' },
        },
        required: ['title', 'documentNumber', 'revisionNumber', 'effectiveDate', 'developer', 'approver'],
      },
      revisionHistory: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            revision: { type: 'string' },
            date: { type: 'string' },
            changes: { type: 'string' },
            developer: { type: 'string' },
            approver: { type: 'string' },
          },
          required: ['revision', 'date', 'changes', 'developer', 'approver'],
        },
      },
      purpose: { type: 'string', description: 'A 2-4 sentence purpose statement.' },
      scope: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          exclusions: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary', 'start', 'end', 'exclusions'],
      },
      applicability: { type: 'string' },
      requirements: {
        type: 'object',
        properties: {
          regulatory: { type: 'array', items: { type: 'string' } },
          governance: { type: 'array', items: { type: 'string' } },
          business: { type: 'array', items: { type: 'string' } },
          compliance: { type: 'array', items: { type: 'string' } },
        },
        required: ['regulatory', 'governance', 'business', 'compliance'],
      },
      definitions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { term: { type: 'string' }, definition: { type: 'string' } },
          required: ['term', 'definition'],
        },
      },
      responsibilities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            responsibilities: { type: 'array', items: { type: 'string' } },
          },
          required: ['role', 'responsibilities'],
        },
      },
      raci: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            activity: { type: 'string' },
            responsible: { type: 'string' },
            accountable: { type: 'string' },
            consulted: { type: 'string' },
            informed: { type: 'string' },
          },
          required: ['activity', 'responsible', 'accountable', 'consulted', 'informed'],
        },
      },
      procedure: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'e.g. "7.1"' },
            title: { type: 'string' },
            objective: { type: 'string' },
            trigger: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step: { type: 'number' },
                  action: { type: 'string' },
                  role: { type: 'string' },
                  input: { type: 'string' },
                  output: { type: 'string' },
                  system: { type: 'string' },
                  control: { type: 'string' },
                  record: { type: 'string' },
                  approval: { type: 'string' },
                  isDecision: { type: 'boolean' },
                  decisionYes: { type: 'string' },
                  decisionNo: { type: 'string' },
                },
                required: ['step', 'action', 'role'],
              },
            },
            exceptions: { type: 'string' },
          },
          required: ['id', 'title', 'objective', 'trigger', 'steps', 'exceptions'],
        },
      },
      kpis: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            indicator: { type: 'string' },
            description: { type: 'string' },
            role: { type: 'string' },
            target: { type: 'string' },
          },
          required: ['indicator', 'description', 'role', 'target'],
        },
      },
      records: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            formNumber: { type: 'string' },
            owner: { type: 'string' },
            location: { type: 'string' },
            retention: { type: 'string' },
          },
          required: ['name', 'formNumber', 'owner', 'location', 'retention'],
        },
      },
      references: { type: 'array', items: { type: 'string' } },
      annexures: {
        type: 'array',
        description: 'Optional supporting annexures (process flow summary, RACI extract, checklist, risk notes). Return an empty array when none are genuinely useful for this document, do not force one.',
        items: {
          type: 'object',
          properties: {
            letter: { type: 'string', description: 'A, B, C, ...' },
            title: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['letter', 'title', 'content'],
        },
      },
      qualityScore: {
        type: 'object',
        properties: {
          overall: { type: 'number' },
          completeness: { type: 'number' },
          clarity: { type: 'number' },
          processDefinition: { type: 'number' },
          riskAndControls: { type: 'number' },
          complianceCoverage: { type: 'number' },
          recommendations: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'overall', 'completeness', 'clarity', 'processDefinition',
          'riskAndControls', 'complianceCoverage', 'recommendations',
        ],
      },
    },
    required: [
      'metadata', 'revisionHistory', 'purpose', 'scope', 'applicability', 'requirements',
      'definitions', 'responsibilities', 'raci', 'procedure', 'kpis', 'records', 'references', 'annexures', 'qualityScore',
    ],
  },
};

function field(body, key) {
  const v = body?.[key];
  return typeof v === 'string' ? v.trim() : '';
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

  const body = req.body || {};
  const procedureTitle = field(body, 'procedureTitle');
  const goalScope = field(body, 'goalScope');
  const audience = field(body, 'audience');
  const region = field(body, 'region');
  const currentProcess = field(body, 'currentProcess');
  const additionalContext = field(body, 'additionalContext');
  const industry = field(body, 'industry');
  const mode = field(body, 'mode');

  if (!procedureTitle) {
    return res.status(400).json({ error: 'Tell us what procedure you want to create.' });
  }
  if (procedureTitle.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ error: `Procedure title must be under ${MAX_TITLE_LENGTH} characters.` });
  }
  if (!goalScope) {
    return res.status(400).json({ error: "Tell us the goal and what it should cover." });
  }
  if (!currentProcess) {
    return res.status(400).json({ error: 'Tell us what you currently do, or that there is no existing process yet.' });
  }
  for (const [name, value] of [
    ['goalScope', goalScope], ['audience', audience], ['region', region],
    ['currentProcess', currentProcess], ['additionalContext', additionalContext],
  ]) {
    if (value.length > MAX_FIELD_LENGTH) {
      return res.status(400).json({ error: `${name} must be under ${MAX_FIELD_LENGTH} characters.` });
    }
  }

  const accessCode = process.env.GENERATOR_ACCESS_CODE;
  if (accessCode && req.headers['x-access-code'] !== accessCode) {
    return res.status(401).json({ error: 'Invalid or missing access code.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'The generator is not configured yet (missing API key).' });
  }

  const briefLines = [
    industry && `Industry: ${industry}`,
    mode && `Mode emphasis: ${mode}`,
    `What to create: ${procedureTitle}`,
    `Goal and scope: ${goalScope}`,
    audience && `Audience / stakeholders: ${audience}`,
    region && `Country / region: ${region}`,
    `Current process and requirements: ${currentProcess}`,
    additionalContext && `Additional context: ${additionalContext}`,
  ].filter(Boolean);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 18000,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'generate_procedure' },
      messages: [{ role: 'user', content: briefLines.join('\n') }],
    });

    if (message.stop_reason === 'max_tokens') {
      console.error('Generation truncated at max_tokens.');
      return res.status(502).json({ error: 'The draft was too long to complete. Try a narrower scope or shorter source material, then try again.' });
    }

    const toolUse = message.content?.find((c) => c.type === 'tool_use');

    if (!toolUse) {
      return res.status(502).json({ error: 'The generator returned an unexpected response. Please try again.' });
    }

    return res.status(200).json({ procedure: toolUse.input });
  } catch (err) {
    console.error('Anthropic API error:', err);
    return res.status(502).json({ error: 'The generator failed. Please try again in a moment.' });
  }
}
