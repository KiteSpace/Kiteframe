import { useState } from 'react';
import { X, FileText, Sparkles, Upload, Grid3X3 } from 'lucide-react';
import type { Node, Edge } from '../lib/kiteframe/types';

interface NewTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onCreateFromPrompt: (prompt: string) => void;
  onCreateFromFile: (data: { nodes: Node[]; edges: Edge[] }) => void;
  onCreateFromTemplate: (template: { name: string; nodes: Node[]; edges: Edge[] }) => void;
}

// Pre-defined workflow templates
const templates = [
  {
    name: "Data Processing Pipeline",
    description: "Basic data input → processing → output workflow",
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 100, y: 150 },
        data: { label: 'Data Input', description: 'Raw data source', icon: 'ArrowRight', iconColor: 'text-blue-500' },
        width: 200,
        height: 100
      },
      {
        id: 'process-1',
        type: 'process',
        position: { x: 400, y: 150 },
        data: { label: 'Data Processing', description: 'Transform and clean data', icon: 'Settings', iconColor: 'text-green-500' },
        width: 200,
        height: 100
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 700, y: 150 },
        data: { label: 'Results', description: 'Processed output', icon: 'ArrowLeft', iconColor: 'text-red-500' },
        width: 200,
        height: 100
      }
    ],
    edges: [
      {
        id: 'e1-2',
        source: 'input-1',
        target: 'process-1',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'e2-3',
        source: 'process-1',
        target: 'output-1',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      }
    ]
  },
  {
    name: "AI Content Review",
    description: "Content input → AI analysis → approval workflow",
    nodes: [
      {
        id: 'input-content',
        type: 'input',
        position: { x: 100, y: 100 },
        data: { label: 'Content Input', description: 'Raw content for review', icon: 'ArrowRight', iconColor: 'text-blue-500' },
        width: 200,
        height: 100
      },
      {
        id: 'ai-review',
        type: 'ai',
        position: { x: 400, y: 100 },
        data: { label: 'AI Reviewer', description: 'Analyze content quality\nModel: GPT-4o', icon: 'Bot', iconColor: 'text-purple-500' },
        width: 200,
        height: 120
      },
      {
        id: 'approval-check',
        type: 'condition',
        position: { x: 700, y: 100 },
        data: { label: 'Approval Check', description: 'Meets quality standards?', icon: 'HelpCircle', iconColor: 'text-yellow-500' },
        width: 200,
        height: 100
      },
      {
        id: 'approved',
        type: 'output',
        position: { x: 850, y: 250 },
        data: { label: 'Approved', description: 'Content approved for use', icon: 'ArrowLeft', iconColor: 'text-green-500' },
        width: 200,
        height: 100
      },
      {
        id: 'rejected',
        type: 'output',
        position: { x: 550, y: 250 },
        data: { label: 'Rejected', description: 'Content needs revision', icon: 'ArrowLeft', iconColor: 'text-red-500' },
        width: 200,
        height: 100
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'input-content',
        target: 'ai-review',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'e2',
        source: 'ai-review',
        target: 'approval-check',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'e3',
        source: 'approval-check',
        target: 'approved',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(142, 76%, 36%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'e4',
        source: 'approval-check',
        target: 'rejected',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(348, 76%, 47%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      }
    ]
  },
  {
    name: "Simple Decision Tree",
    description: "Input → condition → multiple outcomes",
    nodes: [
      {
        id: 'start',
        type: 'input',
        position: { x: 200, y: 100 },
        data: { label: 'Start', description: 'Initial input', icon: 'ArrowRight', iconColor: 'text-blue-500' },
        width: 200,
        height: 100
      },
      {
        id: 'decision',
        type: 'condition',
        position: { x: 500, y: 100 },
        data: { label: 'Decision Point', description: 'Evaluate condition', icon: 'HelpCircle', iconColor: 'text-yellow-500' },
        width: 200,
        height: 100
      },
      {
        id: 'option-a',
        type: 'output',
        position: { x: 400, y: 250 },
        data: { label: 'Option A', description: 'First outcome', icon: 'ArrowLeft', iconColor: 'text-green-500' },
        width: 200,
        height: 100
      },
      {
        id: 'option-b',
        type: 'output',
        position: { x: 600, y: 250 },
        data: { label: 'Option B', description: 'Second outcome', icon: 'ArrowLeft', iconColor: 'text-red-500' },
        width: 200,
        height: 100
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'start',
        target: 'decision',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'e2',
        source: 'decision',
        target: 'option-a',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(142, 76%, 36%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'e3',
        source: 'decision',
        target: 'option-b',
        type: 'bezier' as const,
        style: { strokeColor: 'hsl(348, 76%, 47%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      }
    ]
  }
];

export function NewTabModal({ isOpen, onClose, onCreateBlank, onCreateFromPrompt, onCreateFromFile, onCreateFromTemplate }: NewTabModalProps) {
  const [activeTab, setActiveTab] = useState<'blank' | 'prompt' | 'file' | 'template'>('blank');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      await onCreateFromPrompt(prompt);
      setPrompt('');
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.nodes && data.edges && Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          onCreateFromFile(data);
          onClose();
        } else {
          alert('Invalid workflow file format. Must contain "nodes" and "edges" arrays.');
        }
      } catch (error) {
        alert('Invalid JSON file. Please upload a valid workflow file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Create New Workflow</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent transition-colors"
            data-testid="button-close-new-tab-modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-muted/30">
            <nav className="p-2 space-y-1">
              <button
                onClick={() => setActiveTab('blank')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'blank' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
                data-testid="tab-blank"
              >
                <FileText size={16} />
                Blank Canvas
              </button>
              <button
                onClick={() => setActiveTab('prompt')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'prompt' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
                data-testid="tab-prompt"
              >
                <Sparkles size={16} />
                AI Generate
              </button>
              <button
                onClick={() => setActiveTab('file')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'file' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
                data-testid="tab-file"
              >
                <Upload size={16} />
                Upload File
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'template' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
                data-testid="tab-template"
              >
                <Grid3X3 size={16} />
                Templates
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'blank' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Start with a Blank Canvas</h3>
                <p className="text-muted-foreground">
                  Create an empty workflow and build it from scratch using the node palette and tools.
                </p>
                <button
                  onClick={() => {
                    onCreateBlank();
                    onClose();
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  data-testid="button-create-blank"
                >
                  Create Blank Workflow
                </button>
              </div>
            )}

            {activeTab === 'prompt' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Generate with AI</h3>
                <p className="text-muted-foreground">
                  Describe the workflow you want to create and AI will generate it for you.
                </p>
                <div className="space-y-3">
                  <label className="block text-sm font-medium">Workflow Description</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the workflow you want to create... (e.g., 'Create a workflow for processing customer feedback with sentiment analysis and routing to the appropriate team')"
                    className="w-full p-3 border border-border rounded-md bg-background resize-none"
                    rows={4}
                    data-testid="textarea-ai-prompt"
                  />
                  <button
                    onClick={handlePromptSubmit}
                    disabled={!prompt.trim() || isGenerating}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    data-testid="button-generate-workflow"
                  >
                    <Sparkles size={16} />
                    {isGenerating ? 'Generating...' : 'Generate Workflow'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'file' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Upload Workflow File</h3>
                <p className="text-muted-foreground">
                  Import a previously exported workflow JSON file to continue working on it.
                </p>
                <div className="space-y-3">
                  <label className="block text-sm font-medium">Select JSON File</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="w-full p-3 border border-border rounded-md bg-background file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    data-testid="input-workflow-file"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a JSON file exported from this workflow editor or any compatible format with "nodes" and "edges" arrays.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'template' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Choose a Template</h3>
                <p className="text-muted-foreground">
                  Start with a pre-built workflow template and customize it to your needs.
                </p>
                <div className="grid gap-4">
                  {templates.map((template, index) => (
                    <div
                      key={index}
                      className="border border-border rounded-md p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => {
                        onCreateFromTemplate(template);
                        onClose();
                      }}
                      data-testid={`template-${index}`}
                    >
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {template.nodes.length} nodes • {template.edges.length} connections
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}