/**
 * Kiteframe Canvas Data Structure Benchmarks
 * 
 * These benchmarks test the algorithmic performance of Kiteframe's core data operations
 * (graph generation, filtering, layout calculations) in a Node.js environment.
 * 
 * NOTE: These do NOT measure actual browser rendering performance, React reconciliation,
 * or DOM/SVG painting. For full rendering benchmarks, use browser DevTools or Playwright.
 * 
 * Scenarios tested:
 * 1. Small workflow (20 nodes, 25 edges) - Typical project
 * 2. Medium workflow (100 nodes, 150 edges) - Complex diagrams
 * 3. Large workflow (500 nodes, 600 edges) - Enterprise scale
 * 4. Stress test (1000 nodes, 1200 edges) - Maximum scale testing
 * 5. Real-world simulation (200 nodes, 300 edges) - Combined operations
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface BenchmarkResult {
  scenario: string;
  nodeCount: number;
  edgeCount: number;
  metrics: {
    graphGenerationTime: number;
    layoutCalculationTime?: number;
    selectionTime?: number;
    batchUpdateTime?: number;
    memoryUsage?: number;
  };
}

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; description: string };
  width: number;
  height: number;
  selected?: boolean;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  style: { strokeColor: string; strokeWidth: number };
}

function generateNodes(count: number): Node[] {
  const nodes: Node[] = [];
  const types = ['input', 'process', 'condition', 'output', 'ai'];
  const cols = Math.ceil(Math.sqrt(count));
  
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodes.push({
      id: `node-${i}`,
      type: types[i % types.length],
      position: { x: col * 250 + 100, y: row * 150 + 100 },
      data: { 
        label: `Node ${i}`, 
        description: `Description for node ${i}` 
      },
      width: 200,
      height: 100,
      selected: false
    });
  }
  return nodes;
}

function generateEdges(nodes: Node[], edgeCount: number): Edge[] {
  const edges: Edge[] = [];
  const nodeIds = nodes.map(n => n.id);
  
  for (let i = 0; i < edgeCount && i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodeIds[i],
      target: nodeIds[Math.min(i + 1, nodeIds.length - 1)],
      type: 'bezier',
      style: { strokeColor: '#3b82f6', strokeWidth: 2 }
    });
  }
  
  let additionalEdges = edgeCount - edges.length;
  let edgeIndex = edges.length;
  
  while (additionalEdges > 0 && nodeIds.length > 2) {
    const sourceIdx = Math.floor(Math.random() * nodeIds.length);
    let targetIdx = Math.floor(Math.random() * nodeIds.length);
    
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * nodeIds.length);
    }
    
    const edgeId = `edge-${edgeIndex}`;
    const exists = edges.some(e => 
      (e.source === nodeIds[sourceIdx] && e.target === nodeIds[targetIdx]) ||
      (e.source === nodeIds[targetIdx] && e.target === nodeIds[sourceIdx])
    );
    
    if (!exists) {
      edges.push({
        id: edgeId,
        source: nodeIds[sourceIdx],
        target: nodeIds[targetIdx],
        type: 'bezier',
        style: { strokeColor: '#3b82f6', strokeWidth: 2 }
      });
      edgeIndex++;
      additionalEdges--;
    }
  }
  
  return edges;
}

function measureTime<T>(fn: () => T): { result: T; time: number } {
  const start = performance.now();
  const result = fn();
  const time = performance.now() - start;
  return { result, time };
}

function simulateSelectAll(nodes: Node[]): Node[] {
  return nodes.map(n => ({ ...n, selected: true }));
}

function simulateDragNodes(nodes: Node[], nodeIds: string[], dx: number, dy: number): Node[] {
  return nodes.map(n => {
    if (nodeIds.includes(n.id)) {
      return {
        ...n,
        position: { x: n.position.x + dx, y: n.position.y + dy }
      };
    }
    return n;
  });
}

function simulateDeleteNodes(nodes: Node[], edges: Edge[], nodeIds: string[]): { nodes: Node[]; edges: Edge[] } {
  const remainingNodes = nodes.filter(n => !nodeIds.includes(n.id));
  const remainingEdges = edges.filter(e => 
    !nodeIds.includes(e.source) && !nodeIds.includes(e.target)
  );
  return { nodes: remainingNodes, edges: remainingEdges };
}

function calculateBounds(nodes: Node[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + (node.width || 200));
    maxY = Math.max(maxY, node.position.y + (node.height || 100));
  }
  
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function applyGridLayout(nodes: Node[], options: { columns?: number; spacing?: number } = {}): Node[] {
  const { columns = Math.ceil(Math.sqrt(nodes.length)), spacing = 50 } = options;
  const nodeWidth = 200;
  const nodeHeight = 100;
  
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: (index % columns) * (nodeWidth + spacing) + 100,
      y: Math.floor(index / columns) * (nodeHeight + spacing) + 100
    }
  }));
}

function filterVisibleNodes(nodes: Node[], viewport: { x: number; y: number; zoom: number; width: number; height: number }): Node[] {
  const viewLeft = -viewport.x / viewport.zoom;
  const viewTop = -viewport.y / viewport.zoom;
  const viewRight = viewLeft + viewport.width / viewport.zoom;
  const viewBottom = viewTop + viewport.height / viewport.zoom;
  
  return nodes.filter(node => {
    const nodeRight = node.position.x + (node.width || 200);
    const nodeBottom = node.position.y + (node.height || 100);
    
    return !(nodeRight < viewLeft || node.position.x > viewRight ||
             nodeBottom < viewTop || node.position.y > viewBottom);
  });
}

const results: BenchmarkResult[] = [];

describe('Kiteframe Canvas Benchmarks', () => {
  
  describe('Scenario 1: Small Workflow (20 nodes, 25 edges)', () => {
    let nodes: Node[];
    let edges: Edge[];
    
    it('generates graph in acceptable time', () => {
      const { result, time } = measureTime(() => {
        nodes = generateNodes(20);
        edges = generateEdges(nodes, 25);
        return { nodes, edges };
      });
      
      console.log(`Small workflow generation: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(50);
      expect(result.nodes.length).toBe(20);
      expect(result.edges.length).toBe(25);
      
      results.push({
        scenario: 'Small Workflow',
        nodeCount: 20,
        edgeCount: 25,
        metrics: { graphGenerationTime: time }
      });
    });
    
    it('select-all performs well', () => {
      nodes = generateNodes(20);
      const { time } = measureTime(() => simulateSelectAll(nodes));
      
      console.log(`Small workflow select-all: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(10);
    });
    
    it('drag 5 nodes performs well', () => {
      nodes = generateNodes(20);
      const nodesToDrag = nodes.slice(0, 5).map(n => n.id);
      
      const { time } = measureTime(() => simulateDragNodes(nodes, nodesToDrag, 100, 50));
      
      console.log(`Small workflow drag 5 nodes: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(5);
    });
  });
  
  describe('Scenario 2: Medium Workflow (100 nodes, 150 edges)', () => {
    let nodes: Node[];
    let edges: Edge[];
    
    it('generates graph in acceptable time', () => {
      const { result, time } = measureTime(() => {
        nodes = generateNodes(100);
        edges = generateEdges(nodes, 150);
        return { nodes, edges };
      });
      
      console.log(`Medium workflow generation: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(100);
      expect(result.nodes.length).toBe(100);
      
      results.push({
        scenario: 'Medium Workflow',
        nodeCount: 100,
        edgeCount: 150,
        metrics: { graphGenerationTime: time }
      });
    });
    
    it('auto-layout calculates in acceptable time', () => {
      nodes = generateNodes(100);
      
      const { time } = measureTime(() => applyGridLayout(nodes, { columns: 10 }));
      
      console.log(`Medium workflow auto-layout: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(50);
    });
    
    it('multi-select 20 nodes performs well', () => {
      nodes = generateNodes(100);
      const selectedIds = nodes.slice(0, 20).map(n => n.id);
      
      const { time } = measureTime(() => 
        nodes.map(n => ({ ...n, selected: selectedIds.includes(n.id) }))
      );
      
      console.log(`Medium workflow multi-select 20: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(20);
    });
  });
  
  describe('Scenario 3: Large Workflow (500 nodes, 600 edges)', () => {
    let nodes: Node[];
    let edges: Edge[];
    
    it('generates graph in acceptable time', () => {
      const { result, time } = measureTime(() => {
        nodes = generateNodes(500);
        edges = generateEdges(nodes, 600);
        return { nodes, edges };
      });
      
      console.log(`Large workflow generation: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(500);
      expect(result.nodes.length).toBe(500);
      
      results.push({
        scenario: 'Large Workflow',
        nodeCount: 500,
        edgeCount: 600,
        metrics: { graphGenerationTime: time }
      });
    });
    
    it('virtualization filters correctly', () => {
      nodes = generateNodes(500);
      const viewport = { x: 0, y: 0, zoom: 1, width: 1920, height: 1080 };
      
      const { result: visibleNodes, time } = measureTime(() => 
        filterVisibleNodes(nodes, viewport)
      );
      
      console.log(`Large workflow virtualization: ${time.toFixed(2)}ms, visible: ${visibleNodes.length}/${nodes.length}`);
      expect(time).toBeLessThan(20);
      expect(visibleNodes.length).toBeLessThan(nodes.length);
    });
    
    it('drag 10 nodes performs well', () => {
      nodes = generateNodes(500);
      const nodesToDrag = nodes.slice(0, 10).map(n => n.id);
      
      const { time } = measureTime(() => simulateDragNodes(nodes, nodesToDrag, 100, 50));
      
      console.log(`Large workflow drag 10 nodes: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(30);
    });
    
    it('bounds calculation is efficient', () => {
      nodes = generateNodes(500);
      
      const { result: bounds, time } = measureTime(() => calculateBounds(nodes));
      
      console.log(`Large workflow bounds calc: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(10);
      expect(bounds.width).toBeGreaterThan(0);
    });
  });
  
  describe('Scenario 4: Stress Test (1000 nodes, 1200 edges)', () => {
    let nodes: Node[];
    let edges: Edge[];
    
    it('generates graph in acceptable time', () => {
      const { result, time } = measureTime(() => {
        nodes = generateNodes(1000);
        edges = generateEdges(nodes, 1200);
        return { nodes, edges };
      });
      
      console.log(`Stress test generation: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(2000);
      expect(result.nodes.length).toBe(1000);
      
      results.push({
        scenario: 'Stress Test',
        nodeCount: 1000,
        edgeCount: 1200,
        metrics: { graphGenerationTime: time }
      });
    });
    
    it('select-all scales reasonably', () => {
      nodes = generateNodes(1000);
      
      const { time } = measureTime(() => simulateSelectAll(nodes));
      
      console.log(`Stress test select-all: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(100);
    });
    
    it('delete-all with edge cleanup', () => {
      nodes = generateNodes(1000);
      edges = generateEdges(nodes, 1200);
      const allNodeIds = nodes.map(n => n.id);
      
      const { time } = measureTime(() => simulateDeleteNodes(nodes, edges, allNodeIds));
      
      console.log(`Stress test delete-all: ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(200);
    });
    
    it('batch update simulation', () => {
      nodes = generateNodes(1000);
      
      const { time } = measureTime(() => {
        let updated = nodes;
        for (let i = 0; i < 10; i++) {
          const startIdx = i * 100;
          const nodesToMove = updated.slice(startIdx, startIdx + 100).map(n => n.id);
          updated = simulateDragNodes(updated, nodesToMove, 10, 10);
        }
        return updated;
      });
      
      console.log(`Stress test batch updates (10x100 nodes): ${time.toFixed(2)}ms`);
      expect(time).toBeLessThan(300);
    });
  });
  
  describe('Scenario 5: Real-World Simulation (200 nodes, 300 edges)', () => {
    let nodes: Node[];
    let edges: Edge[];
    
    it('full workflow simulation', () => {
      const metrics: Record<string, number> = {};
      
      const genMeasurement = measureTime(() => {
        nodes = generateNodes(200);
        edges = generateEdges(nodes, 300);
        return { nodes, edges };
      });
      metrics.generation = genMeasurement.time;
      
      const layoutMeasurement = measureTime(() => applyGridLayout(nodes, { columns: 15 }));
      nodes = layoutMeasurement.result;
      metrics.autoLayout = layoutMeasurement.time;
      
      const nodesToDrag = nodes.slice(0, 10).map(n => n.id);
      const dragMeasurement = measureTime(() => simulateDragNodes(nodes, nodesToDrag, 50, 50));
      nodes = dragMeasurement.result;
      metrics.dragReorder = dragMeasurement.time;
      
      let undoStack: Node[][] = [nodes];
      const undoMeasurement = measureTime(() => {
        for (let i = 0; i < 10; i++) {
          const modified = simulateDragNodes(undoStack[undoStack.length - 1], [nodes[i].id], 10, 10);
          undoStack.push(modified);
        }
        for (let i = 0; i < 10; i++) {
          undoStack.pop();
        }
        return undoStack[undoStack.length - 1];
      });
      metrics.undoRedo10x = undoMeasurement.time;
      
      const totalTime = Object.values(metrics).reduce((a, b) => a + b, 0);
      
      console.log('\n=== Real-World Simulation Results ===');
      console.log(`Generation: ${metrics.generation.toFixed(2)}ms`);
      console.log(`Auto-layout: ${metrics.autoLayout.toFixed(2)}ms`);
      console.log(`Drag reorder: ${metrics.dragReorder.toFixed(2)}ms`);
      console.log(`Undo/Redo 10x: ${metrics.undoRedo10x.toFixed(2)}ms`);
      console.log(`Total: ${totalTime.toFixed(2)}ms`);
      
      results.push({
        scenario: 'Real-World Simulation',
        nodeCount: 200,
        edgeCount: 300,
        metrics: {
          graphGenerationTime: metrics.generation,
          layoutCalculationTime: metrics.autoLayout,
          batchUpdateTime: metrics.undoRedo10x
        }
      });
      
      expect(totalTime).toBeLessThan(500);
    });
  });
  
  describe('Summary', () => {
    it('prints all benchmark results', () => {
      console.log('\n========================================');
      console.log('KITEFRAME CANVAS BENCHMARK SUMMARY');
      console.log('========================================\n');
      
      for (const result of results) {
        console.log(`${result.scenario}:`);
        console.log(`  Nodes: ${result.nodeCount}, Edges: ${result.edgeCount}`);
        console.log(`  Generation: ${result.metrics.graphGenerationTime.toFixed(2)}ms`);
        if (result.metrics.layoutCalculationTime) {
          console.log(`  Layout: ${result.metrics.layoutCalculationTime.toFixed(2)}ms`);
        }
        if (result.metrics.batchUpdateTime) {
          console.log(`  Batch Updates: ${result.metrics.batchUpdateTime.toFixed(2)}ms`);
        }
        console.log('');
      }
      
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
