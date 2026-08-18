type NormalizeInput = {
  nodes: any[]
  edges: any[]
  timestamp: number
}

export function normalizeWorkflowGraph({
  nodes,
  edges,
  timestamp,
}: NormalizeInput) {
  if (!Array.isArray(nodes)) {
    throw new Error('normalizeWorkflowGraph: nodes must be an array')
  }

  const normalizedNodes = nodes.map((node, index) => ({
    ...node,
    id: node.id || `node-${index + 1}`,
  }))

  const nodeIds = new Set(normalizedNodes.map((n) => n.id))

  let normalizedEdges = Array.isArray(edges)
    ? edges.filter(
        (edge) =>
          edge &&
          edge.source &&
          edge.target &&
          nodeIds.has(edge.source) &&
          nodeIds.has(edge.target),
      )
    : []

  if (normalizedEdges.length === 0 && normalizedNodes.length > 1) {
    normalizedEdges = []
    for (let i = 0; i < normalizedNodes.length - 1; i++) {
      normalizedEdges.push({
        id: `auto-edge-${timestamp}-${i}`,
        source: normalizedNodes[i].id,
        target: normalizedNodes[i + 1].id,
        type: 'bezier',
        style: {
          strokeColor: 'hsl(221.2, 83.2%, 53.3%)',
          strokeWidth: 2,
        },
        markers: { type: 'arrow', position: 'end' },
      })
    }
  }

  normalizedEdges = normalizedEdges.map((edge, index) => ({
    ...edge,
    id: edge.id || `edge-${timestamp}-${index}`,
    type: edge.type || 'bezier',
    style: edge.style || {
      strokeColor: 'hsl(221.2, 83.2%, 53.3%)',
      strokeWidth: 2,
    },
    markers: edge.markers || { type: 'arrow', position: 'end' },
  }))

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges,
  }
}
