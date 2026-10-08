import { interfacePlanSchema, planningWorkflowSchema, type InterfacePlan, type PlanningWorkflow } from '../../interfacePlan';

const node = (id: string, label: string, description = '', actor = 'User', type = 'process') =>
  ({ id, label, description, actor, type });
const edge = (id: string, source: string, target: string, label = '') => ({ id, source, target, label });
const field = (label: string, kind: 'input' | 'display' = 'input') =>
  ({ label, kind, required: kind === 'input', origin: 'workflow' as const });
const action = (label: string, edgeIds: string[] = [], targetScreenId = '') =>
  ({ label, edgeIds, targetScreenId, origin: 'workflow' as const });
const page = (id: string, name: string, nodeIds: string[], actor = 'User') => ({
  id, name, kind: 'page', parentScreenId: '', actor, goal: name,
  description: `${name} lets ${actor.toLowerCase()} complete their task.`,
  rationale: 'This is a distinct task and navigation context.', nodeIds,
  origin: 'workflow', selected: true, dataRequirements: [], actions: [], states: [],
});
const build = (workflow: unknown, screens: unknown[], extra = {}) => {
  const source = planningWorkflowSchema.parse(workflow);
  return { workflow: source, plan: interfacePlanSchema.parse({
    version: 1, workflow: source, summary: 'Task-specific interface plan',
    screens, backgroundSteps: [], assumptions: [], ...extra,
  }) };
};

const short = build({
  name: 'Sign in and view dashboard',
  nodes: [
    node('login', 'Sign in', 'User enters email and password', 'Member', 'input'),
    node('auth', 'Authenticate', 'Server verifies credentials', 'System'),
    node('dashboard', 'Dashboard', 'Member views recent orders', 'Member', 'output'),
  ],
  edges: [edge('credentials', 'login', 'auth'), edge('signed-in', 'auth', 'dashboard', 'Valid credentials')],
}, [
  { ...page('login-page', 'Sign in', ['login'], 'Member'), dataRequirements: [field('Email'), field('Password')],
    actions: [action('Sign in', ['credentials', 'signed-in'], 'dashboard-page')] },
  { ...page('dashboard-page', 'Dashboard', ['dashboard'], 'Member'), dataRequirements: [field('Recent orders', 'display')],
    actions: [action('View order')] },
], { backgroundSteps: [{ nodeIds: ['auth'], reason: 'Authentication runs on the server.' }] });

const backendNodes = [
  node('upload', 'Upload document', 'Submitter selects a PDF for analysis', 'Submitter', 'input'),
  ...Array.from({ length: 12 }, (_, i) =>
    node(`backend-${i}`, `Server stage ${i + 1}`, 'Validate, store, extract, classify, index or audit; no direct user interaction', 'System')),
  node('result', 'Analysis ready', 'Submitter views the analysis on the same task page', 'Submitter', 'output'),
];
const backend = build({
  name: 'Document analysis', nodes: backendNodes,
  edges: backendNodes.slice(1).map((n, i) => edge(`process-${i}`, backendNodes[i].id, n.id)),
}, [{
  ...page('analysis', 'Document analysis', ['upload'], 'Submitter'),
  dataRequirements: [field('Document'), field('Analysis', 'display')],
  actions: [action('Analyze document', ['process-0'])],
  states: [{
    name: 'Analysis ready', kind: 'success', description: 'Show analysis without leaving the task.',
    nodeIds: ['result'], edgeIds: ['process-12'],
  }, { name: 'Processing', kind: 'loading', description: 'Show processing progress.', nodeIds: [], edgeIds: [] }],
}], { backgroundSteps: [{ nodeIds: backendNodes.slice(1, -1).map(n => n.id), reason: 'Backend processing, not navigation destinations.' }] });

const approval = build({
  name: 'Expense approval',
  nodes: [
    node('submit', 'Submit expense', 'Employee enters amount and receipt', 'Employee', 'input'),
    node('review', 'Review expense', 'Manager approves or returns an expense', 'Manager', 'condition'),
    node('approved', 'Approved', 'Employee sees reimbursement approval', 'Employee', 'output'),
    node('revision', 'Needs revision', 'Employee sees the reason and resubmits', 'Employee', 'error'),
  ],
  edges: [edge('submitted', 'submit', 'review'), edge('approve', 'review', 'approved', 'Approve'),
    edge('reject', 'review', 'revision', 'Return for revision'), edge('resubmit', 'revision', 'review', 'Resubmit')],
}, [
  { ...page('expenses', 'My expenses', ['submit'], 'Employee'), dataRequirements: [field('Amount'), field('Receipt')],
    actions: [action('Submit expense', ['submitted']), action('Resubmit', ['resubmit'])],
    states: [
      { name: 'Approved', kind: 'success', description: 'Show approval status.', nodeIds: ['approved'], edgeIds: [] },
      { name: 'Needs revision', kind: 'validation', description: 'Show the reviewer reason.', nodeIds: ['revision'], edgeIds: [] },
    ] },
  { ...page('review', 'Review expense', ['review'], 'Manager'), dataRequirements: [field('Expense', 'display')],
    actions: [action('Approve', ['approve'], 'expenses'), action('Return for revision', ['reject'], 'expenses')] },
]);

const loop = build({
  name: 'Retry payment',
  nodes: [node('payment', 'Pay invoice', 'Customer enters payment information', 'Customer', 'input'),
    node('failed', 'Payment failed', 'Show error and retry on the same page', 'Customer', 'error')],
  edges: [edge('failure', 'payment', 'failed', 'Declined'), edge('retry', 'failed', 'payment', 'Retry')],
}, [{
  ...page('payment-page', 'Pay invoice', ['payment'], 'Customer'),
  dataRequirements: [field('Payment method')],
  actions: [action('Pay invoice'), action('Retry', ['retry'])],
  states: [{ name: 'Payment failed', kind: 'error', description: 'Show decline and retry.',
    nodeIds: ['failed'], edgeIds: ['failure'] }],
}]);

const disconnected = build({
  name: 'Membership and billing',
  nodes: [node('register', 'Create membership', 'User fills registration form', 'Member', 'input'),
    node('registered', 'Membership created', 'Show registration confirmation', 'Member', 'output'),
    node('invoice', 'Find invoices', 'User views invoice list', 'Member', 'input'),
    node('export', 'Export invoices', 'Export selected invoices as CSV', 'Member', 'output')],
  edges: [edge('registration', 'register', 'registered'), edge('export-invoices', 'invoice', 'export')],
}, [
  { ...page('register-page', 'Create membership', ['register', 'registered'], 'Member'),
    dataRequirements: [field('Email')], actions: [action('Register', ['registration'])] },
  { ...page('invoices-page', 'Invoices', ['invoice', 'export'], 'Member'),
    dataRequirements: [field('Invoice list', 'display')], actions: [action('Export CSV', ['export-invoices'])] },
]);

const ambiguous = build({
  name: 'Handle request',
  nodes: [node('request', 'Handle request', '', '', 'process')], edges: [],
}, [{
  ...page('request-page', 'Request workspace', ['request'], 'User (assumed)'),
  origin: 'inferred', actions: [{ ...action('Submit request'), origin: 'inferred' }],
  dataRequirements: [{ ...field('Request details'), origin: 'inferred' }],
}], { assumptions: [{ text: 'The actor and request fields are unspecified.',
  question: 'Who handles the request, and what information do they need?', nodeIds: ['request'] }] });

export const interfacePlanningFixtures: Record<string, { workflow: PlanningWorkflow; plan: InterfacePlan }> = {
  short, backend, approval, loop, disconnected, ambiguous,
};

export const userAddedPagePlan = interfacePlanSchema.parse({
  ...short.plan,
  screens: [...short.plan.screens, {
    ...page('reports-page', 'Reports', [], 'Member'), origin: 'user',
    description: 'User requested a CSV report page during refinement.',
    dataRequirements: [{ ...field('Report results', 'display'), origin: 'user' }],
    actions: [{ ...action('Download CSV'), origin: 'user' }],
  }],
});
