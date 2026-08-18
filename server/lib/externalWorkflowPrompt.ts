// Server-side, single-shot version of the workflow-generation system prompt.
// Ported from client/src/constants/aiWorkflowPrompt.ts (AI_WORKFLOW_SYSTEM_PROMPT),
// the standalone one-shot generator prompt — NOT the multi-turn chat persona
// in buildKiteAIContext.ts. This copy is adapted to run cold with no canvas
// or conversation context: it spells out the JSON schema up front, includes
// few-shot examples, and adds explicit instructions for turning a plain-text
// feature description into a workflow (since callers here are LLM agents
// reasoning about a feature, not users chatting inside the editor).

export const EXTERNAL_WORKFLOW_SYSTEM_PROMPT = `You are decomposing a feature description into a visual workflow diagram. ONLY return JSON. No text before or after, no markdown code fences.

Output schema:
{
  "title": "Short workflow title",
  "nodes": [
    {
      "id": "node-1",
      "type": "input",
      "position": {"x": 100, "y": 250},
      "data": {"label": "Start", "description": "Begin workflow", "icon": "ArrowRight", "iconColor": "text-blue-500"},
      "width": 200,
      "height": 100
    },
    {
      "id": "node-2",
      "type": "process",
      "position": {"x": 350, "y": 250},
      "data": {"label": "Process", "description": "Main step", "icon": "Cog", "iconColor": "text-green-500"},
      "width": 200,
      "height": 100
    },
    {
      "id": "node-3",
      "type": "output",
      "position": {"x": 600, "y": 250},
      "data": {"label": "End", "description": "Complete", "icon": "ArrowLeft", "iconColor": "text-red-500"},
      "width": 200,
      "height": 100
    }
  ],
  "edges": [
    {"id": "e1-2", "source": "node-1", "target": "node-2", "type": "bezier"},
    {"id": "e2-3", "source": "node-2", "target": "node-3", "type": "bezier"}
  ]
}

RULES:
- Read the feature description and break it into discrete steps/decisions a real implementation would go through (e.g. request received -> validation -> branching logic -> side effects -> response).
- Always include edges connecting nodes in logical sequence. Every edge MUST have source and target that match a real node id.
- Do NOT return empty edges if more than one node exists.
- Node types: input (entry point), process (a step/action), output (terminal state), condition (a branch/decision point).
- Icons: input=ArrowRight, process=Cog, output=ArrowLeft, condition=HelpCircle.
- Colors: input=text-blue-500, process=text-green-500, output=text-red-500, condition=text-yellow-500.
- Position nodes ~250px apart horizontally; branch condition outcomes vertically (e.g. y-100 / y+100) from the condition node.
- Keep labels short (2-5 words); put the fuller explanation in "description".
- Aim for 4-12 nodes for a typical feature — enough to be useful, not so many it's noise.`;

export const EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES = [
  {
    input: "Add rate limiting to the login endpoint so repeated failed attempts get temporarily blocked.",
    output: {
      title: "Login Rate Limiting",
      nodes: [
        { id: "node-1", type: "input", position: { x: 100, y: 250 }, data: { label: "Login Request", description: "User submits credentials", icon: "ArrowRight", iconColor: "text-blue-500" }, width: 200, height: 100 },
        { id: "node-2", type: "condition", position: { x: 350, y: 250 }, data: { label: "Under Attempt Limit?", description: "Check recent failed attempts for this IP/account", icon: "HelpCircle", iconColor: "text-yellow-500" }, width: 200, height: 100 },
        { id: "node-3", type: "process", position: { x: 600, y: 150 }, data: { label: "Verify Credentials", description: "Check password against stored hash", icon: "Cog", iconColor: "text-green-500" }, width: 200, height: 100 },
        { id: "node-4", type: "output", position: { x: 850, y: 150 }, data: { label: "Login Success", description: "Issue session", icon: "ArrowLeft", iconColor: "text-red-500" }, width: 200, height: 100 },
        { id: "node-5", type: "process", position: { x: 600, y: 350 }, data: { label: "Record Failed Attempt", description: "Increment attempt counter with timestamp", icon: "Cog", iconColor: "text-green-500" }, width: 200, height: 100 },
        { id: "node-6", type: "output", position: { x: 850, y: 350 }, data: { label: "429 Blocked", description: "Reject with retry-after header", icon: "ArrowLeft", iconColor: "text-red-500" }, width: 200, height: 100 },
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2", type: "bezier" },
        { id: "e2-3", source: "node-2", target: "node-3", type: "bezier" },
        { id: "e3-4", source: "node-3", target: "node-4", type: "bezier" },
        { id: "e2-5", source: "node-2", target: "node-5", type: "bezier" },
        { id: "e5-6", source: "node-5", target: "node-6", type: "bezier" },
      ],
    },
  },
  {
    input: "Users should be able to export their saved project as a PDF, with a loading state while it's generated.",
    output: {
      title: "Export Project as PDF",
      nodes: [
        { id: "node-1", type: "input", position: { x: 100, y: 250 }, data: { label: "Click Export", description: "User clicks 'Export PDF'", icon: "ArrowRight", iconColor: "text-blue-500" }, width: 200, height: 100 },
        { id: "node-2", type: "process", position: { x: 350, y: 250 }, data: { label: "Show Loading State", description: "Disable button, show spinner", icon: "Cog", iconColor: "text-green-500" }, width: 200, height: 100 },
        { id: "node-3", type: "process", position: { x: 600, y: 250 }, data: { label: "Generate PDF", description: "Render project to PDF on server", icon: "Cog", iconColor: "text-green-500" }, width: 200, height: 100 },
        { id: "node-4", type: "condition", position: { x: 850, y: 250 }, data: { label: "Generation Succeeded?", description: "Check for render errors", icon: "HelpCircle", iconColor: "text-yellow-500" }, width: 200, height: 100 },
        { id: "node-5", type: "output", position: { x: 1100, y: 150 }, data: { label: "Download File", description: "Trigger browser download", icon: "ArrowLeft", iconColor: "text-red-500" }, width: 200, height: 100 },
        { id: "node-6", type: "output", position: { x: 1100, y: 350 }, data: { label: "Show Error Toast", description: "Inform user export failed, allow retry", icon: "ArrowLeft", iconColor: "text-red-500" }, width: 200, height: 100 },
      ],
      edges: [
        { id: "e1-2", source: "node-1", target: "node-2", type: "bezier" },
        { id: "e2-3", source: "node-2", target: "node-3", type: "bezier" },
        { id: "e3-4", source: "node-3", target: "node-4", type: "bezier" },
        { id: "e4-5", source: "node-4", target: "node-5", type: "bezier" },
        { id: "e4-6", source: "node-4", target: "node-6", type: "bezier" },
      ],
    },
  },
];
