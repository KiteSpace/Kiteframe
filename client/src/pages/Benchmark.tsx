import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, RotateCcw, Download, Clock, Cpu, Layers, Move, AlertTriangle } from 'lucide-react';
import { KiteFrameCanvas, type Node, type Edge } from '@/lib/kiteframe';

interface BenchmarkResult {
  name: string;
  nodeCount: number;
  edgeCount: number;
  metrics: {
    graphGeneration: number;
    initialRender: number;
    rerender: number;
    panOperation: number;
    zoomOperation: number;
    selectAll: number;
    dragNodes: number;
    deleteNodes: number;
    layoutCalculation: number;
    avgFrameTime: number;
  };
}

function generateNodes(count: number): Node[] {
  const nodes: Node[] = [];
  const types: Array<'input' | 'process' | 'condition' | 'output' | 'ai'> = ['input', 'process', 'condition', 'output', 'ai'];
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
        description: `Description for node ${i}`,
        colors: {
          headerBackground: '#3b82f6',
          bodyBackground: '#eff6ff',
          borderColor: '#3b82f6',
          headerTextColor: '#ffffff',
          bodyTextColor: '#1e40af'
        }
      },
      width: 200,
      height: 100
    });
  }
  return nodes;
}

function generateEdges(nodes: Node[], edgeCount: number): Edge[] {
  const edges: Edge[] = [];
  const nodeIds = nodes.map(n => n.id);
  
  for (let i = 0; i < Math.min(edgeCount, nodes.length - 1); i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodeIds[i],
      target: nodeIds[i + 1],
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
    
    const exists = edges.some(e => 
      (e.source === nodeIds[sourceIdx] && e.target === nodeIds[targetIdx])
    );
    
    if (!exists) {
      edges.push({
        id: `edge-${edgeIndex}`,
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

function measureSync(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function measureNextFrame(): Promise<number> {
  const start = performance.now();
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve(performance.now() - start);
    });
  });
}

async function measureFrameTimes(frameCount: number, updateFn: () => void): Promise<{ avg: number; total: number }> {
  const times: number[] = [];
  
  for (let i = 0; i < frameCount; i++) {
    const frameStart = performance.now();
    updateFn();
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        times.push(performance.now() - frameStart);
        resolve();
      });
    });
  }
  
  const total = times.reduce((a, b) => a + b, 0);
  return { avg: total / times.length, total };
}

const scenarios = [
  { name: 'Small Workflow', nodes: 20, edges: 25 },
  { name: 'Medium Workflow', nodes: 100, edges: 150 },
  { name: 'Large Workflow', nodes: 500, edges: 600 },
  { name: 'Stress Test', nodes: 1000, edges: 1200 },
];

export default function Benchmark() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [showCanvas, setShowCanvas] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const runBenchmarks = useCallback(async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);
    setShowCanvas(true);
    
    await new Promise(r => setTimeout(r, 200));
    
    const newResults: BenchmarkResult[] = [];
    
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      setCurrentScenario(scenario.name);
      setProgress((i / scenarios.length) * 100);
      
      const metrics = {
        graphGeneration: 0,
        initialRender: 0,
        rerender: 0,
        panOperation: 0,
        zoomOperation: 0,
        selectAll: 0,
        dragNodes: 0,
        deleteNodes: 0,
        layoutCalculation: 0,
        avgFrameTime: 0
      };
      
      frameTimesRef.current = [];
      
      // Clear canvas
      setNodes([]);
      setEdges([]);
      setViewport({ x: 0, y: 0, zoom: 1 });
      await measureNextFrame();
      
      // Graph generation (pure data operation)
      let generatedNodes: Node[] = [];
      let generatedEdges: Edge[] = [];
      metrics.graphGeneration = measureSync(() => {
        generatedNodes = generateNodes(scenario.nodes);
        generatedEdges = generateEdges(generatedNodes, scenario.edges);
      });
      
      // Initial render - time from first setNodes/setEdges to first paint
      const initialRenderStart = performance.now();
      setNodes(generatedNodes);
      setEdges(generatedEdges);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      metrics.initialRender = performance.now() - initialRenderStart;
      
      // Re-render (force update)
      const rerenderStart = performance.now();
      setNodes(prev => prev.map(n => ({ ...n })));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      metrics.rerender = performance.now() - rerenderStart;
      
      // Pan operation - average of 10 pans
      const panResult = await measureFrameTimes(10, () => {
        setViewport(v => ({ ...v, x: v.x + 20, y: v.y + 10 }));
      });
      metrics.panOperation = panResult.avg;
      
      // Reset viewport
      setViewport({ x: 0, y: 0, zoom: 1 });
      await measureNextFrame();
      
      // Zoom operation - average of 10 zooms
      let zoomLevel = 0.5;
      const zoomResult = await measureFrameTimes(10, () => {
        zoomLevel += 0.05;
        setViewport(v => ({ ...v, zoom: zoomLevel }));
      });
      metrics.zoomOperation = zoomResult.avg;
      
      // Reset
      setViewport({ x: 0, y: 0, zoom: 1 });
      setNodes(generatedNodes);
      await measureNextFrame();
      
      // Select all
      const selectStart = performance.now();
      setNodes(prev => prev.map(n => ({ ...n, selected: true })));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      metrics.selectAll = performance.now() - selectStart;
      
      // Drag nodes (10% of nodes)
      const dragCount = Math.max(1, Math.floor(scenario.nodes * 0.1));
      const dragStart = performance.now();
      setNodes(prev => prev.map((n, idx) => 
        idx < dragCount 
          ? { ...n, position: { x: n.position.x + 50, y: n.position.y + 50 } } 
          : n
      ));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      metrics.dragNodes = performance.now() - dragStart;
      
      // Layout calculation
      const layoutStart = performance.now();
      const cols = Math.ceil(Math.sqrt(generatedNodes.length));
      setNodes(prev => prev.map((n, idx) => ({
        ...n,
        position: {
          x: (idx % cols) * 250 + 100,
          y: Math.floor(idx / cols) * 150 + 100
        },
        selected: false
      })));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      metrics.layoutCalculation = performance.now() - layoutStart;
      
      // Delete nodes (10%) and edges
      const deleteCount = Math.max(1, Math.floor(scenario.nodes * 0.1));
      const idsToDelete = new Set(generatedNodes.slice(0, deleteCount).map(n => n.id));
      const deleteStart = performance.now();
      setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
      setEdges(prev => prev.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)));
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      metrics.deleteNodes = performance.now() - deleteStart;
      
      // Measure average frame time over 30 frames with rapid updates
      const frameTimeResult = await measureFrameTimes(30, () => {
        setViewport(v => ({ ...v, x: v.x + 1 }));
      });
      metrics.avgFrameTime = frameTimeResult.avg;
      
      newResults.push({
        name: scenario.name,
        nodeCount: scenario.nodes,
        edgeCount: scenario.edges,
        metrics
      });
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    setResults(newResults);
    setProgress(100);
    setCurrentScenario('');
    setIsRunning(false);
    setShowCanvas(false);
    setNodes([]);
    setEdges([]);
  }, []);

  const resetBenchmarks = useCallback(() => {
    setResults([]);
    setNodes([]);
    setEdges([]);
    setViewport({ x: 0, y: 0, zoom: 1 });
    setProgress(0);
    setCurrentScenario('');
    setShowCanvas(false);
  }, []);

  const exportResults = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      results: results.map(r => ({
        ...r,
        metrics: Object.fromEntries(
          Object.entries(r.metrics).map(([k, v]) => [k, `${v.toFixed(2)}ms`])
        )
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiteframe-benchmarks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <div className="min-h-screen bg-background" data-testid="benchmark-page">
      {showCanvas && (
        <div 
          ref={canvasContainerRef}
          className="fixed inset-0 z-50 bg-white"
          style={{ width: '100vw', height: '100vh' }}
        >
          <div className="absolute top-4 left-4 z-10 bg-black/80 text-white px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="animate-spin">
                <Cpu className="w-4 h-4" />
              </div>
              <span>Benchmarking: {currentScenario}</span>
              <Badge variant="secondary">{nodes.length} nodes</Badge>
            </div>
          </div>
          <KiteFrameCanvas
            nodes={nodes}
            edges={edges}
            viewport={viewport}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onViewportChange={setViewport}
            snapToGrid={false}
            showMiniMap={false}
          />
        </div>
      )}

      <div className={`p-8 ${showCanvas ? 'hidden' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Kiteframe Browser Benchmarks</h1>
            <p className="text-muted-foreground">
              Measure real KiteFrameCanvas rendering performance in your browser
            </p>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Note:</strong> Times include React reconciliation + DOM updates + paint. 
                For comparison, a 60 FPS target means each frame should complete in &lt;16.67ms.
              </div>
            </div>
          </div>

          <div className="flex gap-4 mb-8">
            <Button 
              onClick={runBenchmarks} 
              disabled={isRunning}
              data-testid="button-run-benchmarks"
            >
              <Play className="w-4 h-4 mr-2" />
              {isRunning ? 'Running...' : 'Run Benchmarks'}
            </Button>
            <Button 
              variant="outline" 
              onClick={resetBenchmarks}
              disabled={isRunning}
              data-testid="button-reset"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            {results.length > 0 && (
              <Button 
                variant="outline" 
                onClick={exportResults}
                data-testid="button-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            )}
          </div>

          {isRunning && !showCanvas && (
            <Card className="mb-8">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="animate-spin">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <span>Running: {currentScenario}</span>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {results.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Results</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map((result, index) => (
                  <Card key={index} data-testid={`result-card-${index}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{result.name}</CardTitle>
                        <Badge variant={result.metrics.avgFrameTime < 16.67 ? 'default' : 'destructive'}>
                          {(1000 / result.metrics.avgFrameTime).toFixed(0)} FPS
                        </Badge>
                      </div>
                      <CardDescription>
                        <Layers className="w-4 h-4 inline mr-1" />
                        {result.nodeCount} nodes, {result.edgeCount} edges
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <MetricRow icon={<Clock className="w-3 h-3" />} label="Graph Gen" value={result.metrics.graphGeneration} />
                        <MetricRow icon={<Clock className="w-3 h-3" />} label="Initial Render" value={result.metrics.initialRender} />
                        <MetricRow icon={<Clock className="w-3 h-3" />} label="Re-render" value={result.metrics.rerender} />
                        <MetricRow icon={<Move className="w-3 h-3" />} label="Pan (avg)" value={result.metrics.panOperation} />
                        <MetricRow icon={<Move className="w-3 h-3" />} label="Zoom (avg)" value={result.metrics.zoomOperation} />
                        <MetricRow icon={<Clock className="w-3 h-3" />} label="Select All" value={result.metrics.selectAll} />
                        <MetricRow icon={<Move className="w-3 h-3" />} label="Drag Nodes" value={result.metrics.dragNodes} />
                        <MetricRow icon={<Clock className="w-3 h-3" />} label="Delete" value={result.metrics.deleteNodes} />
                        <MetricRow icon={<Clock className="w-3 h-3" />} label="Layout" value={result.metrics.layoutCalculation} />
                        <MetricRow icon={<Cpu className="w-3 h-3" />} label="Avg Frame" value={result.metrics.avgFrameTime} highlight />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Summary Table</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3">Scenario</th>
                          <th className="text-right py-2 px-3">Nodes</th>
                          <th className="text-right py-2 px-3">Gen</th>
                          <th className="text-right py-2 px-3">Render</th>
                          <th className="text-right py-2 px-3">Pan</th>
                          <th className="text-right py-2 px-3">Select</th>
                          <th className="text-right py-2 px-3">Frame</th>
                          <th className="text-right py-2 px-3">FPS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2 px-3 font-medium">{r.name}</td>
                            <td className="text-right py-2 px-3">{r.nodeCount}</td>
                            <td className="text-right py-2 px-3">{r.metrics.graphGeneration.toFixed(2)}ms</td>
                            <td className="text-right py-2 px-3">{r.metrics.initialRender.toFixed(2)}ms</td>
                            <td className="text-right py-2 px-3">{r.metrics.panOperation.toFixed(2)}ms</td>
                            <td className="text-right py-2 px-3">{r.metrics.selectAll.toFixed(2)}ms</td>
                            <td className="text-right py-2 px-3">{r.metrics.avgFrameTime.toFixed(2)}ms</td>
                            <td className="text-right py-2 px-3">{(1000 / r.metrics.avgFrameTime).toFixed(0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Environment</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p><strong>User Agent:</strong> {navigator.userAgent}</p>
                  <p><strong>Screen:</strong> {window.screen.width}x{window.screen.height}</p>
                  <p><strong>Device Pixel Ratio:</strong> {window.devicePixelRatio}</p>
                  <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  const getColor = (v: number) => {
    if (v < 16.67) return 'text-green-600';
    if (v < 33.33) return 'text-yellow-600';
    if (v < 100) return 'text-orange-600';
    return 'text-red-600';
  };
  
  return (
    <div className={`flex items-center justify-between ${highlight ? 'font-semibold' : ''}`}>
      <span className="flex items-center gap-1 text-muted-foreground">
        {icon} {label}
      </span>
      <span className={`font-mono ${getColor(value)}`}>{value.toFixed(2)}ms</span>
    </div>
  );
}
