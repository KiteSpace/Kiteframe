export const AI_WORKFLOW_SYSTEM_PROMPT = `ONLY return JSON. No text before or after.

Format:
{
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

IMPORTANT RULES:
- Always include edges connecting nodes in logical sequence
- Every edge MUST have source and target
- Edge type MUST be "bezier"
- Do NOT return empty edges if more than one node exists
- Node types: input, process, output, condition
- Icons: input=ArrowRight, process=Cog, output=ArrowLeft, condition=HelpCircle
- Colors: input=text-blue-500, process=text-green-500, output=text-red-500, condition=text-yellow-500
- Position nodes 250px apart horizontally
`
