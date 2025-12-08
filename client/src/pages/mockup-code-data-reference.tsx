import { useState } from 'react';
import { ChevronDown, ChevronRight, Table, Database, Copy, Check } from 'lucide-react';

export default function MockupCodeDataReference() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    services: true,
    columns: false,
  });
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 1500);
  };

  const tableData = {
    name: 'services',
    columns: ['id', 'name', 'layer', 'cost', 'region', 'owner'],
    rows: [
      { id: 1, name: 'API Gateway', layer: 'Presentation', cost: 0.012, region: 'us-west' },
      { id: 2, name: 'Load Balancer', layer: 'Presentation', cost: 0.019, region: 'us-west' },
      { id: 3, name: 'Application Server', layer: 'API', cost: 0.100, region: 'us-east' },
    ],
  };

  const codeSnippets = [
    { label: 'All rows', code: 'services', desc: 'Array of all rows' },
    { label: 'First row', code: 'services[0]', desc: 'Object with all columns' },
    { label: 'Row count', code: 'services.length', desc: 'Number of rows' },
    { label: 'Filter rows', code: "services.filter(r => r.region === 'us-west')", desc: 'Returns matching rows' },
    { label: 'Map values', code: 'services.map(r => r.name)', desc: 'Array of names' },
    { label: 'Sum column', code: 'services.reduce((sum, r) => sum + r.cost, 0)', desc: 'Total of cost column' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-2">Mockup: Code Node Data Reference Panel</h1>
      <p className="text-slate-400 mb-8">This shows how users can reference linked table data with a named variable and reference sidebar</p>

      <div className="flex gap-6">
        {/* Code Editor Area */}
        <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="bg-slate-700 px-4 py-2 border-b border-slate-600 flex items-center gap-2">
            <span className="text-sm font-medium">Code Node</span>
            <span className="bg-green-600 text-xs px-2 py-0.5 rounded">JavaScript</span>
          </div>
          
          {/* Linked Table Badge */}
          <div className="px-4 py-2 bg-slate-750 border-b border-slate-600 flex items-center gap-2">
            <div className="flex items-center gap-2 bg-indigo-900/50 text-indigo-300 px-3 py-1.5 rounded-full text-sm ring-1 ring-indigo-500/50">
              <Table className="w-4 h-4" />
              <span>Linked: <strong>Infrastructure</strong></span>
              <span className="text-indigo-400">→</span>
              <code className="bg-indigo-800/50 px-1.5 py-0.5 rounded text-xs font-mono">services</code>
            </div>
          </div>

          {/* Code Area */}
          <div className="p-4 font-mono text-sm bg-[#1e1e1e] min-h-[300px]">
            <div className="text-slate-500">// Access linked table data using the 'services' variable</div>
            <div className="mt-2">
              <span className="text-purple-400">const</span>
              <span className="text-blue-300"> totalCost</span>
              <span className="text-white"> = </span>
              <span className="text-yellow-300">services</span>
              <span className="text-white">.</span>
              <span className="text-blue-300">reduce</span>
              <span className="text-white">((</span>
              <span className="text-orange-300">sum</span>
              <span className="text-white">, </span>
              <span className="text-orange-300">r</span>
              <span className="text-white">) =&gt; </span>
              <span className="text-orange-300">sum</span>
              <span className="text-white"> + </span>
              <span className="text-orange-300">r</span>
              <span className="text-white">.</span>
              <span className="text-green-300">cost</span>
              <span className="text-white">, </span>
              <span className="text-blue-300">0</span>
              <span className="text-white">);</span>
            </div>
            <div className="mt-2">
              <span className="text-purple-400">const</span>
              <span className="text-blue-300"> westServices</span>
              <span className="text-white"> = </span>
              <span className="text-yellow-300">services</span>
              <span className="text-white">.</span>
              <span className="text-blue-300">filter</span>
              <span className="text-white">(</span>
              <span className="text-orange-300">r</span>
              <span className="text-white"> =&gt; </span>
              <span className="text-orange-300">r</span>
              <span className="text-white">.</span>
              <span className="text-green-300">region</span>
              <span className="text-white"> === </span>
              <span className="text-amber-300">'us-west'</span>
              <span className="text-white">);</span>
            </div>
            <div className="mt-4 text-slate-500">// Build HTML output</div>
            <div className="mt-2">
              <span className="text-purple-400">const</span>
              <span className="text-blue-300"> html</span>
              <span className="text-white"> = </span>
              <span className="text-amber-300">`</span>
            </div>
            <div>
              <span className="text-amber-300">  &lt;h1&gt;Total Cost: $</span>
              <span className="text-purple-300">{'${'}</span>
              <span className="text-blue-300">totalCost</span>
              <span className="text-white">.</span>
              <span className="text-blue-300">toFixed</span>
              <span className="text-white">(</span>
              <span className="text-blue-300">3</span>
              <span className="text-white">)</span>
              <span className="text-purple-300">{'}'}</span>
              <span className="text-amber-300">&lt;/h1&gt;</span>
            </div>
            <div>
              <span className="text-amber-300">  &lt;p&gt;</span>
              <span className="text-purple-300">{'${'}</span>
              <span className="text-blue-300">westServices</span>
              <span className="text-white">.</span>
              <span className="text-green-300">length</span>
              <span className="text-purple-300">{'}'}</span>
              <span className="text-amber-300"> services in us-west&lt;/p&gt;</span>
            </div>
            <div>
              <span className="text-amber-300">`;</span>
            </div>
          </div>
        </div>

        {/* Reference Sidebar */}
        <div className="w-72 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="bg-slate-700 px-4 py-2 border-b border-slate-600 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium">Data Reference</span>
          </div>

          <div className="p-3">
            {/* Variable Section */}
            <div className="mb-4">
              <button 
                onClick={() => toggleSection('services')}
                className="flex items-center gap-2 w-full text-left hover:bg-slate-700 rounded px-2 py-1.5 -mx-2"
              >
                {expandedSections.services ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <code className="text-yellow-300 text-sm font-mono">services</code>
                <span className="text-slate-400 text-xs ml-auto">Array[{tableData.rows.length}]</span>
              </button>
              
              {expandedSections.services && (
                <div className="ml-4 mt-2 space-y-1">
                  {/* Columns */}
                  <button 
                    onClick={() => toggleSection('columns')}
                    className="flex items-center gap-2 w-full text-left hover:bg-slate-700 rounded px-2 py-1 text-sm"
                  >
                    {expandedSections.columns ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="text-slate-300">Columns</span>
                    <span className="text-slate-500 text-xs ml-auto">{tableData.columns.length}</span>
                  </button>
                  
                  {expandedSections.columns && (
                    <div className="ml-4 space-y-0.5">
                      {tableData.columns.map((col) => (
                        <div 
                          key={col}
                          onClick={() => copyToClipboard(`services[0].${col}`, col)}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-slate-700 rounded cursor-pointer group"
                        >
                          <code className="text-green-300 text-xs font-mono">.{col}</code>
                          <span className="text-slate-500 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            {copiedItem === col ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sample Row */}
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <div className="text-xs text-slate-500 px-2 mb-1">Sample Row (services[0]):</div>
                    <div className="bg-slate-900 rounded p-2 text-xs font-mono overflow-x-auto">
                      <pre className="text-slate-300">{JSON.stringify(tableData.rows[0], null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Snippets */}
            <div className="border-t border-slate-700 pt-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-2 px-1">Quick Snippets</div>
              <div className="space-y-1">
                {codeSnippets.map((snippet, idx) => (
                  <div
                    key={idx}
                    onClick={() => copyToClipboard(snippet.code, `snippet-${idx}`)}
                    className="flex flex-col px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">{snippet.label}</span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedItem === `snippet-${idx}` ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-500" />
                        )}
                      </span>
                    </div>
                    <code className="text-xs font-mono text-indigo-300 truncate">{snippet.code}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-8 bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-3">How it works:</h2>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs">1</div>
              <span className="font-medium">Link Table to Code Node</span>
            </div>
            <p className="text-slate-400">When you draw an edge from a table to a code node, a dialog asks what variable name to use (e.g., "services")</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs">2</div>
              <span className="font-medium">Badge Shows Link</span>
            </div>
            <p className="text-slate-400">The code node displays a badge showing which table is linked and what variable name it uses</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs">3</div>
              <span className="font-medium">Reference Panel</span>
            </div>
            <p className="text-slate-400">A collapsible sidebar shows available columns, sample data, and clickable code snippets for common operations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
