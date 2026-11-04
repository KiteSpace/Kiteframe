import { describe, it, expect } from 'vitest'
import { normalizeWorkflowGraph, MAX_GENERATED_NODES } from '../normalizeWorkflowGraph'

describe('normalizeWorkflowGraph', () => {
  it('makes duplicate ids unique and fills missing positions', () => {
    const { nodes } = normalizeWorkflowGraph({
      nodes: [{ id: 'a' }, { id: 'a', position: { x: 5, y: 'bad' } }, null, 'x'],
      edges: [],
      timestamp: 1,
    })
    expect(nodes).toHaveLength(2)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(2)
    for (const n of nodes) {
      expect(Number.isFinite(n.position.x)).toBe(true)
      expect(Number.isFinite(n.position.y)).toBe(true)
    }
    expect(nodes[1].position.x).toBe(5)
  })

  it('drops dangling, self-loop and duplicate edges', () => {
    const { edges } = normalizeWorkflowGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'b' },
        { source: 'a', target: 'a' },
        { source: 'a', target: 'zzz' },
      ],
      timestamp: 1,
    })
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ source: 'a', target: 'b' })
  })

  it('caps the number of generated nodes', () => {
    const many = Array.from({ length: MAX_GENERATED_NODES + 50 }, (_, i) => ({ id: `n${i}` }))
    const { nodes } = normalizeWorkflowGraph({ nodes: many, edges: [], timestamp: 1 })
    expect(nodes).toHaveLength(MAX_GENERATED_NODES)
  })
})
