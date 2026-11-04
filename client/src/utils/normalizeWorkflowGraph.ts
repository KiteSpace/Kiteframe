type NormalizeInput = {
  nodes: any[]
  edges: any[]
  timestamp: number
}

export const MAX_GENERATED_NODES = 200

export function normalizeWorkflowGraph({
  nodes,
  edges,
  timestamp,
}: NormalizeInput) {
  if (!Array.isArray(nodes)) {
    throw new Error('normalizeWorkflowGraph: nodes must be an array')
  }

  // AI output is untrusted: drop non-objects, cap the size, make ids unique and
  // give every node a finite position so the canvas can always render it.
  const seenIds = new Set<string>()
  const normalizedNodes = nodes
    .filter((node) => node && typeof node === 'object' && !Array.isArray(node))
    .slice(0, MAX_GENERATED_NODES)
    .map((node, index) => {
      let id = typeof node.id === 'string' && node.id ? node.id : `node-${index + 1}`
      while (seenIds.has(id)) id = `${id}-${index + 1}`
      seenIds.add(id)
      const x = Number(node.position?.x)
      const y = Number(node.position?.y)
      return {
        ...node,
        id,
        position: {
          x: Number.isFinite(x) ? x : (index % 4) * 320,
          y: Number.isFinite(y) ? y : Math.floor(index / 4) * 220,
        },
      }
    })

  const nodeIds = new Set(normalizedNodes.map((n) => n.id))
  const edgeKeys = new Set<string>()

  let normalizedEdges = Array.isArray(edges)
    ? edges.filter((edge) => {
        if (
          !edge ||
          typeof edge.source !== 'string' ||
          typeof edge.target !== 'string' ||
          edge.source === edge.target ||
          !nodeIds.has(edge.source) ||
          !nodeIds.has(edge.target)
        ) {
          return false
        }
        const key = `${edge.source}->${edge.target}`
        if (edgeKeys.has(key)) return false
        edgeKeys.add(key)
        return true
      })
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
