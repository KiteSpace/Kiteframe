# Kiteframe External Workflow API — Implementation Spec

## Purpose
Add a small external API surface to Kiteframe that lets a Claude Code skill
fetch a workflow-reasoning prompt/schema, and submit a finished workflow for
storage and rendering. No LLM calls happen on the server — this is a
pure prompt-serving + CRUD surface. Auth is via a scoped API key, separate
from normal user session auth.

Assumed stack: Node/Express-style backend, Supabase (Postgres) for storage.
If the actual stack differs (e.g. Next.js API routes, different DB), keep
the same route contracts and adapt the implementation details.

---

## 1. Database: API keys table

```sql
create table external_api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique,          -- sha256 of the raw key, never store raw
  owner_label text not null,              -- e.g. "andrew-personal-skill"
  scopes text[] not null default '{workflows:read,workflows:write}',
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
```

Generate a key manually for yourself to start:

```js
// scripts/create-api-key.js  (run once via `node scripts/create-api-key.js`)
const crypto = require('crypto');
const rawKey = 'kf_live_' + crypto.randomBytes(24).toString('hex');
const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
console.log('Raw key (save this now, it will not be shown again):', rawKey);
console.log('Hash to insert into external_api_keys.key_hash:', hash);
```

Insert the printed hash into `external_api_keys` with `owner_label =
'andrew-personal-skill'`. Save the raw key into your `KITEFRAME_API_KEY`
env var on A0599 — it's never retrievable from the DB again.

---

## 2. Database: workflows table

```sql
create table external_workflows (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references external_api_keys(id),
  workflow_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 3. Auth middleware

```js
// middleware/requireApiKey.js
const crypto = require('crypto');
const { supabase } = require('../lib/supabase'); // adjust to your existing client

async function requireApiKey(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const rawKey = match[1];
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { data: keyRow, error } = await supabase
    .from('external_api_keys')
    .select('*')
    .eq('key_hash', hash)
    .eq('revoked', false)
    .single();

  if (error || !keyRow) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  req.apiKey = keyRow;

  // fire-and-forget last_used_at update, don't block the request
  supabase
    .from('external_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {});

  next();
}

module.exports = { requireApiKey };
```

---

## 4. Rate limiting

Use `express-rate-limit` (or equivalent), keyed by API key id, not IP —
this endpoint will only ever be called by authenticated clients.

```js
// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests/min per key
  keyGenerator: (req) => req.apiKey?.id || req.ip,
  message: { error: 'Rate limit exceeded, try again shortly' },
});

module.exports = { externalApiLimiter };
```

Install if not already present:
```bash
npm install express-rate-limit
```

---

## 5. Output schema (the contract between Claude's draft and your renderer)

Adapt field names to match whatever your internal canvas/node model
already uses — the goal is zero translation layer on ingest. Example
starting point, assuming a typical nodes/edges shape:

```js
// lib/workflowSchema.js
const WORKFLOW_JSON_SCHEMA = {
  type: 'object',
  required: ['nodes', 'edges'],
  properties: {
    title: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type', 'label'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['start', 'end', 'step', 'decision', 'screen'] },
          label: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          label: { type: 'string' },
        },
      },
    },
  },
};

module.exports = { WORKFLOW_JSON_SCHEMA };
```

Install a validator (recommend `ajv`, it's the standard and fast):

```bash
npm install ajv
```

```js
// lib/validateWorkflow.js
const Ajv = require('ajv');
const { WORKFLOW_JSON_SCHEMA } = require('./workflowSchema');

const ajv = new Ajv({ allErrors: true });
const validateFn = ajv.compile(WORKFLOW_JSON_SCHEMA);

function validateWorkflow(workflow) {
  const valid = validateFn(workflow);
  return { valid, errors: validateFn.errors || [] };
}

module.exports = { validateWorkflow };
```

---

## 6. The reasoning prompt + few-shot examples

This is your actual IP/tuning — port over whatever prompt logic your
internal workflow-gen feature currently uses (the text you'd otherwise
send to an LLM). Start simple and iterate.

```js
// lib/workflowPrompt.js
const WORKFLOW_REASONING_PROMPT = `
You are decomposing a feature description into a workflow diagram for
Kiteframe. Break the feature into discrete nodes representing screens,
decision points, and system steps. Use these node types: start, end,
step, decision, screen. Keep node labels short (3-6 words) and put
detail in the description field. Every workflow must have exactly one
"start" node and at least one "end" node. Prefer 5-12 nodes for a typical
feature — fewer than that likely means you haven't decomposed enough,
more likely means you're going too granular (screen-level, not
click-level). Edges should represent the primary transitions between
nodes; label edges only when the transition condition isn't obvious
(e.g. "if payment fails").
`.trim();

const WORKFLOW_FEW_SHOTS = [
  {
    description: 'User signs up, verifies email, sets up profile',
    workflow: {
      title: 'Signup and onboarding',
      nodes: [
        { id: 'n1', type: 'start', label: 'Landing page' },
        { id: 'n2', type: 'screen', label: 'Signup form' },
        { id: 'n3', type: 'step', label: 'Send verification email' },
        { id: 'n4', type: 'decision', label: 'Email verified?' },
        { id: 'n5', type: 'screen', label: 'Profile setup' },
        { id: 'n6', type: 'end', label: 'Onboarding complete' },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5', label: 'if verified' },
        { from: 'n5', to: 'n6' },
      ],
    },
  },
  // Add 2-4 more examples over time as you see what produces good output.
];

module.exports = { WORKFLOW_REASONING_PROMPT, WORKFLOW_FEW_SHOTS };
```

---

## 7. Routes

```js
// routes/externalWorkflows.js
const express = require('express');
const router = express.Router();
const { requireApiKey } = require('../middleware/requireApiKey');
const { externalApiLimiter } = require('../middleware/rateLimiter');
const { WORKFLOW_JSON_SCHEMA } = require('../lib/workflowSchema');
const { WORKFLOW_REASONING_PROMPT, WORKFLOW_FEW_SHOTS } = require('../lib/workflowPrompt');
const { validateWorkflow } = require('../lib/validateWorkflow');
const { supabase } = require('../lib/supabase');

// GET /api/external/workflows/prompt-template
router.get('/prompt-template', requireApiKey, externalApiLimiter, (req, res) => {
  res.json({
    version: '1.0.0',
    system_prompt: WORKFLOW_REASONING_PROMPT,
    output_schema: WORKFLOW_JSON_SCHEMA,
    few_shot_examples: WORKFLOW_FEW_SHOTS,
  });
});

// POST /api/external/workflows
router.post('/', requireApiKey, externalApiLimiter, async (req, res) => {
  const { workflow } = req.body || {};
  if (!workflow) {
    return res.status(400).json({ error: 'Missing "workflow" in request body' });
  }

  const { valid, errors } = validateWorkflow(workflow);
  if (!valid) {
    return res.status(422).json({ error: 'Workflow failed schema validation', details: errors });
  }

  const { data, error } = await supabase
    .from('external_workflows')
    .insert({ api_key_id: req.apiKey.id, workflow_json: workflow })
    .select()
    .single();

  if (error) {
    console.error('Failed to save external workflow:', error);
    return res.status(500).json({ error: 'Failed to save workflow' });
  }

  res.json({
    id: data.id,
    diagram_url: `${process.env.PUBLIC_APP_URL}/workflows/${data.id}`,
  });
});

// GET /api/external/workflows/:id  (optional convenience, not required by the skill)
router.get('/:id', requireApiKey, externalApiLimiter, async (req, res) => {
  const { data, error } = await supabase
    .from('external_workflows')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Workflow not found' });
  }

  res.json({ id: data.id, workflow: data.workflow_json, created_at: data.created_at });
});

module.exports = router;
```

Mount it in your main app file:

```js
// app.js (or wherever routes are mounted)
const externalWorkflowsRouter = require('./routes/externalWorkflows');
app.use('/api/external/workflows', externalWorkflowsRouter);
```

---

## 8. Rendering the diagram_url

`diagram_url` above assumes you already have (or will build) a page at
`/workflows/:id` that reads `workflow_json` and renders it using your
existing Kiteframe canvas component. If that page doesn't exist yet,
it's the one piece of net-new frontend work — everything else here is
backend-only. If you'd rather skip that for v1, `diagram_url` can just
be omitted from the response and the skill will fall back to summarizing
the raw JSON to the user in chat.

---

## 9. Environment variables to confirm are set on Replit

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   (or whatever key your supabase client already uses)
PUBLIC_APP_URL=https://your-kiteframe-domain.com
```

No Anthropic key is needed anywhere in this flow.

---

## 10. Test it end-to-end before wiring up the skill

```bash
# 1. Fetch the template
curl -H "Authorization: Bearer $KITEFRAME_API_KEY" \
  https://your-kiteframe-domain.com/api/external/workflows/prompt-template

# 2. Submit a workflow (using the example from the few-shot above)
curl -X POST \
  -H "Authorization: Bearer $KITEFRAME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workflow":{"title":"Test","nodes":[{"id":"n1","type":"start","label":"Start"},{"id":"n2","type":"end","label":"End"}],"edges":[{"from":"n1","to":"n2"}]}}' \
  https://your-kiteframe-domain.com/api/external/workflows
```

If both return 200s with sensible JSON, the skill's three scripts
(`fetch_template.py`, `validate_workflow.py`, `submit_workflow.py`) should
work against it without modification — they already expect exactly these
request/response shapes.

---

## Summary of what to build, in order

1. `external_api_keys` + `external_workflows` tables
2. `create-api-key.js` script, run once, save the raw key to your own env
3. `requireApiKey` middleware
4. `express-rate-limit` middleware
5. `workflowSchema.js` + `ajv` validator
6. `workflowPrompt.js` (your reasoning logic + few-shots)
7. `routes/externalWorkflows.js`, mounted at `/api/external/workflows`
8. (Optional for v1) a `/workflows/:id` render page
9. Test with the curl commands above before touching the Claude Code skill
