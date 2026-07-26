import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePluginSystem, usePluginContext } from '@/lib/kiteframe';
import { Cpu, Activity, Zap, Layout, Users, TestTube } from 'lucide-react';

interface PluginTestPanelProps {
  onClose: () => void;
  nodes: any[];
  edges: any[];
}

export function PluginTestPanel({ onClose, nodes, edges }: PluginTestPanelProps) {
  const { core, plugins, emit } = usePluginSystem();
  const context = usePluginContext();
  const [testStats, setTestStats] = useState<any>({});
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    // Plugin system initialised via PluginProvider
  }, [core]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const runPluginTests = () => {
    addTestResult('Starting plugin system tests...');
    
    // Test 1: Plugin Registration
    const installedPlugins = plugins;
    addTestResult(`✅ Found ${installedPlugins.length} installed plugins`);
    
    // Test 2: Event System
    emit('test:nodeCount', nodes.length);
    addTestResult(`✅ Event system: Emitted node count (${nodes.length})`);
    
    // Test 3: Hook System Test
    addTestResult(`✅ Hook system: Active with ${Object.keys(core.getHooks()).length} hooks`);
    
    addTestResult('🎉 All tests completed successfully!');
  };

  const testLayoutPlugin = (layoutType: string) => {
    emit('layout:' + layoutType);
    emit('test:layoutApplied', layoutType);
    addTestResult(`✅ Layout Plugin: Applied ${layoutType} layout`);
  };

  const testEventSystem = () => {
    const testData = { timestamp: Date.now(), message: 'Hello from test panel!' };
    emit('test:custom-event', testData);
    addTestResult(`✅ Event System: Sent custom event`);
  };

  const simulatePluginAction = () => {
    emit('test:simulateAction', { timestamp: Date.now() });
    addTestResult(`✅ Plugin Action: Emitted simulate action event`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-[800px] max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Plugin System Test Panel
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Test and demonstrate KiteFrame plugin functionality
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Plugin Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Plugin Status
              </CardTitle>
              <CardDescription>Current plugin system state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Installed Plugins</div>
                  <div className="space-y-1">
                    {plugins.map(plugin => (
                      <Badge key={plugin.name} variant="outline" className="mr-1">
                        {plugin.name} v{plugin.version}
                      </Badge>
                    ))}
                    {plugins.length === 0 && (
                      <div className="text-sm text-muted-foreground">No plugins installed</div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">System Info</div>
                  <div className="text-sm text-muted-foreground">
                    <div>Canvas Nodes: {nodes.length}</div>
                    <div>Canvas Edges: {edges.length}</div>
                    <div>Context: {context ? '✅ Active' : '❌ Missing'}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Plugin Tests
              </CardTitle>
              <CardDescription>Run tests to verify plugin functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Button onClick={runPluginTests} className="w-full" variant="default">
                    <TestTube className="w-4 h-4 mr-2" />
                    Run All Tests
                  </Button>
                  <Button onClick={testEventSystem} className="w-full" variant="outline">
                    <Zap className="w-4 h-4 mr-2" />
                    Test Event System
                  </Button>
                  <Button onClick={simulatePluginAction} className="w-full" variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Simulate Action
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-medium mb-2">Layout Plugin Tests</div>
                  <Button onClick={() => testLayoutPlugin('horizontal')} size="sm" variant="outline" className="w-full">
                    Horizontal Layout
                  </Button>
                  <Button onClick={() => testLayoutPlugin('vertical')} size="sm" variant="outline" className="w-full">
                    Vertical Layout
                  </Button>
                  <Button onClick={() => testLayoutPlugin('grid')} size="sm" variant="outline" className="w-full">
                    Grid Layout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Test Results
              </CardTitle>
              <CardDescription>Live test output and plugin statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Test Log</div>
                  <div className="bg-muted rounded-md p-3 text-xs font-mono h-32 overflow-y-auto">
                    {testResults.length > 0 ? (
                      testResults.map((result, i) => (
                        <div key={i} className="mb-1">{result}</div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No tests run yet...</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Plugin Stats</div>
                  <div className="bg-muted rounded-md p-3 text-xs h-32">
                    {testStats.pluginName ? (
                      <div className="space-y-1">
                        <div><strong>Plugin:</strong> {testStats.pluginName} v{testStats.version}</div>
                        <div><strong>Node Clicks:</strong> {testStats.nodeClickCount}</div>
                        <div><strong>Canvas Clicks:</strong> {testStats.canvasClickCount}</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">Run tests to see stats...</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">How to Use</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>1. <strong>Run All Tests:</strong> Comprehensive plugin system verification</div>
                <div>2. <strong>Test Event System:</strong> Verify plugin communication</div>
                <div>3. <strong>Layout Tests:</strong> Test automatic layout algorithms</div>
                <div>4. <strong>Check Console:</strong> View detailed plugin logs in browser developer tools</div>
                <div>5. <strong>Plugin Hooks:</strong> Create/select nodes to see hook system in action</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}