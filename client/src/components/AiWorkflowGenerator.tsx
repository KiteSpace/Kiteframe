import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import type { Node, Edge } from '../lib/kiteframe/types';
import { Sparkles, Loader2, Image, Upload, FileImage, CheckCircle, AlertTriangle, MessageSquare, Lock, Layout, Type, Square as SquareIcon, MousePointer2 } from 'lucide-react';
import { AI_WORKFLOW_SYSTEM_PROMPT } from '@/constants/aiWorkflowPrompt';
import { normalizeWorkflowGraph } from '@/utils/normalizeWorkflowGraph';
import { getRouter, extractJSON } from '@/ai/router';
import { useSubscription } from '@/hooks/useSubscription';

interface ImageAnalysisResult {
  success: boolean;
  confidence: number;
  canGenerate: boolean;
  analysis: string;
  nodes: Node[];
  edges: Edge[];
  recommendations: string[];
  metadata: {
    originalFileName: string;
    fileSize: number;
    analysisTimestamp: string;
  };
}

interface AiWorkflowGeneratorProps {
  onClose: () => void;
  onGenerate: (workflow: { nodes: Node[], edges: Edge[] }) => void;
  initialPrompt?: string;
}

export function AiWorkflowGenerator({ onClose, onGenerate, initialPrompt = '' }: AiWorkflowGeneratorProps) {
  const { isAdvanced, isAdmin } = useSubscription();
  const canUseImageMode = isAdvanced || isAdmin;
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const aiClient = useAi();

  // Image handling functions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, GIF, etc.)');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }

    setError(null);
    setSelectedImage(file);
    setAnalysisResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/ai/analyze-workflow-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
      }

      const result: ImageAnalysisResult = await response.json();
      setAnalysisResult(result);

      // Only show success toast - low confidence is already shown in the modal alert
      if (result.confidence >= 70) {
        toast({
          title: "Analysis Complete",
          description: `Confidence: ${result.confidence}%. Found ${result.nodes.length} nodes and ${result.edges.length} connections.`
        });
      }

    } catch (error: any) {
      console.error('Image analysis error:', error);
      setError(error.message);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateFromImage = async () => {
    if (!analysisResult || !analysisResult.canGenerate) {
      toast({
        title: "Cannot Generate",
        description: "Please analyze an image with higher confidence first.",
        variant: "destructive"
      });
      return;
    }

    try {
      onGenerate({
        nodes: analysisResult.nodes,
        edges: analysisResult.edges
      });
      onClose();
    } catch (error) {
      console.error('Workflow generation error:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate workflow from image analysis.",
        variant: "destructive"
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please describe the workflow you want to create.",
        variant: "destructive"
      });
      return;
    }

    // API key is now handled by the backend

    setIsGenerating(true);
    try {
      const router = getRouter();
      const response = await router.chat({
        taskType: 'workflow_reasoning',
        messages: [
          { role: 'system', content: AI_WORKFLOW_SYSTEM_PROMPT },
          { role: 'user', content: `Create workflow: ${prompt}` }
        ],
        temperature: 0.1,
        maxTokens: 3000
      });

      let cleanedResponse = extractJSON(response.text) || response.text;
      
      console.log('🧹 CLEANED RESPONSE LENGTH:', cleanedResponse.length, 'chars');
      console.log('🧹 FIRST 500 CHARS:', cleanedResponse.substring(0, 500));
      
      let workflowData;
      
      try {
        // First attempt - parse as-is
        workflowData = JSON.parse(cleanedResponse);
      } catch (firstError) {
        const errorMsg = firstError instanceof Error ? firstError.message : String(firstError);
        console.log('❌ FIRST PARSE FAILED:', errorMsg);
        
        try {
          // Second attempt - fix common JSON issues
          let fixedResponse = cleanedResponse;
          
          // Remove trailing commas
          fixedResponse = fixedResponse.replace(/,(\s*[}\]])/g, '$1');
          
          // Fix missing commas between array/object elements
          fixedResponse = fixedResponse.replace(/([}\]])\s*([{"])/g, '$1,$2');
          
          // Fix unquoted keys
          fixedResponse = fixedResponse.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          
          // Convert single quotes to double quotes
          fixedResponse = fixedResponse.replace(/:\s*'([^']*)'/g, ': "$1"');
          
          // Fix missing quotes around string values
          fixedResponse = fixedResponse.replace(/:\s*([a-zA-Z][a-zA-Z0-9\-_]*)\s*([,}])/g, ': "$1"$2');
          
          // Remove any duplicate commas
          fixedResponse = fixedResponse.replace(/,,+/g, ',');
          
          // Fix missing commas after object/array elements (specific to the error we're seeing)
          fixedResponse = fixedResponse.replace(/([}\]])\s*(\{|\[)/g, '$1,$2');
          
          // Fix incomplete arrays - add missing closing brackets for common patterns
          // Look for incomplete "edges": [... patterns and close them
          fixedResponse = fixedResponse.replace(/("edges"\s*:\s*\[\s*[^}\]]*\{[^}]*\})\s*([,}])/g, '$1]$2');
          
          // Fix incomplete nodes array similarly
          fixedResponse = fixedResponse.replace(/("nodes"\s*:\s*\[\s*[^}\]]*\{[^}]*\})\s*([,}])/g, '$1]$2');
          
          // Try to fix incomplete JSON by balancing brackets
          const openBraces = (fixedResponse.match(/\{/g) || []).length;
          const closeBraces = (fixedResponse.match(/\}/g) || []).length;
          const openBrackets = (fixedResponse.match(/\[/g) || []).length;
          const closeBrackets = (fixedResponse.match(/\]/g) || []).length;
          
          // Add missing closing braces/brackets
          for (let i = 0; i < openBraces - closeBraces; i++) {
            fixedResponse += '}';
          }
          for (let i = 0; i < openBrackets - closeBrackets; i++) {
            fixedResponse += ']';
          }
          
          console.log('🔧 FIXED RESPONSE LENGTH:', fixedResponse.length, 'chars');
          console.log('🔧 AROUND ERROR POSITION 2950:', fixedResponse.substring(2900, 3000));
          workflowData = JSON.parse(fixedResponse);
          
        } catch (secondError) {
          const secondErrorMsg = secondError instanceof Error ? secondError.message : String(secondError);
          console.log('❌ SECOND PARSE FAILED:', secondErrorMsg);
          console.log('❌ USING FALLBACK WORKFLOW');
          
          // Create fallback workflow
          const fallbackWorkflow = {
            nodes: [
              {
                id: "node-1",
                type: "input",
                position: { x: 300, y: 250 },
                data: {
                  label: "Start",
                  description: prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""),
                  icon: "ArrowRight",
                  iconColor: "text-blue-500"
                },
                width: 200,
                height: 100
              },
              {
                id: "node-2",
                type: "process",
                position: { x: 550, y: 250 },
                data: {
                  label: "Process",
                  description: "Processing step",
                  icon: "Cog",
                  iconColor: "text-green-500"
                },
                width: 200,
                height: 100
              },
              {
                id: "node-3",
                type: "output",
                position: { x: 800, y: 250 },
                data: {
                  label: "Complete",
                  description: "Process complete",
                  icon: "ArrowLeft",
                  iconColor: "text-red-500"
                },
                width: 200,
                height: 100
              }
            ],
            edges: [
              {
                id: "edge-1",
                source: "node-1",
                target: "node-2",
                type: "bezier" as const,
                style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
                markers: { type: "arrow" as const, position: "end" as const }
              },
              {
                id: "edge-2",
                source: "node-2",
                target: "node-3",
                type: "bezier" as const,
                style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
                markers: { type: "arrow" as const, position: "end" as const }
              }
            ]
          };
          
          onGenerate(fallbackWorkflow);
          toast({
            title: "Basic Workflow Created",
            description: "AI response couldn't be parsed, created a simple 3-step workflow instead. You can customize it in the sidebar.",
            variant: "default"
          });
          onClose();
          return;
        }
      }

      if (workflowData.nodes && Array.isArray(workflowData.nodes)) {
        const timestamp = Date.now();
        const { nodes, edges } = normalizeWorkflowGraph({
          nodes: workflowData.nodes,
          edges: workflowData.edges || [],
          timestamp,
        });
        
        console.log('🤖 AI GENERATED WORKFLOW:', { 
          nodeCount: nodes.length, 
          edgeCount: edges.length,
          nodes,
          edges
        });
        
        onGenerate({ nodes, edges });
        toast({
          title: "Workflow Generated",
          description: `Created ${nodes.length} nodes and ${edges.length} connections.`,
          variant: "default"
        });
        onClose();
      } else {
        throw new Error('Invalid workflow structure returned');
      }
    } catch (error) {
      console.error('Workflow generation error:', error);
      
      let title = "Generation Failed";
      let description = "Failed to generate workflow. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          title = "Authentication Error";
          description = "Invalid API key. Please check your AI settings.";
        } else if (error.message.includes('429')) {
          title = "Rate Limit Exceeded";
          description = "Too many requests. Please wait a moment and try again.";
        } else if (error.message.includes('500')) {
          title = "Server Error";
          description = "AI service is temporarily unavailable. Please try again later.";
        } else {
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose} modal={true}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="modal-ai-workflow-generator" aria-describedby="ai-generator-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            AI Workflow Generator
          </DialogTitle>
        </DialogHeader>
        <div id="ai-generator-description" className="sr-only">
          Generate complete workflows from natural language descriptions or images using AI
        </div>
        
        <div className="space-y-6">
          {/* Mode Toggle */}
          <div className="flex space-x-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setMode('text')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                mode === 'text' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-text-prompt"
            >
              <MessageSquare size={16} />
              Text Prompt
            </button>
            <button
              onClick={() => {
                if (canUseImageMode) {
                  setMode('image');
                } else {
                  window.dispatchEvent(new CustomEvent('showFeatureUpsell', { detail: { type: 'image-to-workflow' } }));
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                mode === 'image' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-image-upload"
            >
              {canUseImageMode ? <FileImage size={16} /> : <Lock size={16} />}
              Upload Image
              {!canUseImageMode && (
                <span className="text-[9px] px-1 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-medium ml-1">Advanced</span>
              )}
            </button>
          </div>

          {/* Text Mode */}
          {mode === 'text' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workflow-prompt">Describe Your Workflow</Label>
                <Input
                  id="workflow-prompt"
                  placeholder="e.g., Create a data processing pipeline that validates CSV files and generates reports"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  data-testid="input-workflow-prompt"
                  className="min-h-[80px]"
                  style={{ height: '80px', resize: 'vertical' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleGenerate();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Press Ctrl+Enter to generate, or click the button below
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Example Prompts:</Label>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="cursor-pointer hover:text-foreground p-1 rounded hover:bg-accent" 
                       onClick={() => setPrompt("Create an e-commerce order processing workflow")}>
                    • Create an e-commerce order processing workflow
                  </div>
                  <div className="cursor-pointer hover:text-foreground p-1 rounded hover:bg-accent"
                       onClick={() => setPrompt("Build a content moderation system with AI review")}>
                    • Build a content moderation system with AI review
                  </div>
                  <div className="cursor-pointer hover:text-foreground p-1 rounded hover:bg-accent"
                       onClick={() => setPrompt("Design a customer support ticket routing system")}>
                    • Design a customer support ticket routing system
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Mode — Analysing state: full processing UI */}
          {mode === 'image' && isAnalyzing && (
            <div className="flex gap-4 min-h-[340px]">
              {/* Left: image with scan-line animation */}
              <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-xl relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{ backgroundImage: "radial-gradient(circle,#7c3aed 1.5px,transparent 1.5px)", backgroundSize: "28px 28px" }}
                />
                <div className="relative w-full max-w-[300px] mx-4">
                  {imagePreview ? (
                    <div
                      className="relative rounded-xl border-2 border-violet-300 dark:border-violet-700 overflow-hidden shadow-xl"
                      style={{ boxShadow: "0 0 0 1px rgba(139,92,246,0.2), 0 20px 40px rgba(0,0,0,0.15)" }}
                    >
                      <img src={imagePreview} alt="Analysing" className="w-full max-h-44 object-cover" />
                      {/* Scan line */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div
                          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent"
                          style={{ animation: "aiw-scanline 2.4s ease-in-out infinite", opacity: 0.9 }}
                        />
                      </div>
                      {/* Soft tint */}
                      <div className="absolute inset-0 bg-gradient-to-b from-violet-600/[0.05] via-transparent to-violet-600/[0.05] pointer-events-none" />
                      {/* Corner brackets */}
                      {(["top-0 left-0 border-t-2 border-l-2 rounded-tl-xl","top-0 right-0 border-t-2 border-r-2 rounded-tr-xl","bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl","bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl"] as const).map((cls, i) => (
                        <div key={i} className={`absolute w-4 h-4 border-violet-500 ${cls} pointer-events-none`} />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-40 rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-muted animate-pulse" />
                  )}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-violet-600 text-white text-[11px] font-medium px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                    <Loader2 size={10} className="animate-spin" />
                    Mapping layout to nodes…
                  </div>
                </div>
              </div>

              {/* Right: detected elements panel */}
              <div className="w-52 flex-shrink-0 flex flex-col gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-violet-500" />
                  <span className="text-sm font-semibold text-foreground">Detecting elements</span>
                </div>
                <div className="space-y-2">
                  {([
                    { icon: Layout,         label: "Flow nodes",    sub: "Steps & actions",  delay: 0   },
                    { icon: SquareIcon,     label: "Decisions",     sub: "Branches & gates", delay: 200 },
                    { icon: Type,           label: "Labels",        sub: "Text content",     delay: 400 },
                    { icon: MousePointer2,  label: "Connections",   sub: "Edge paths",       delay: 600 },
                  ] as const).map(({ icon: Icon, label, sub, delay }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-muted/40 animate-pulse"
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                        <Icon size={13} className="text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="h-2 bg-muted-foreground/25 rounded w-3/4" />
                        <div className="h-1.5 bg-muted-foreground/15 rounded w-1/2" />
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" style={{ animationDelay: `${delay + 300}ms` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-auto space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Analysis progress</span>
                    <span className="text-violet-500 font-medium">Running…</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full relative overflow-hidden" style={{ width: "65%" }}>
                      <div className="absolute inset-0 animate-pulse bg-white/25" />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">Usually 10–20 seconds</p>
                </div>
              </div>

              <style>{`
                @keyframes aiw-scanline {
                  0%   { top: -4px; opacity: 0; }
                  8%   { opacity: 1; }
                  92%  { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
              `}</style>
            </div>
          )}

          {/* Image Mode — idle/results state */}
          {mode === 'image' && !isAnalyzing && (
            <div className="space-y-4">
              {/* Image Upload Area */}
              <div className="space-y-3">
                <Label>Upload Workflow Diagram</Label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                    dragActive 
                      ? 'border-primary bg-primary/10' 
                      : 'border-muted-foreground/25 hover:border-muted-foreground/40'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {imagePreview ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <img 
                          src={imagePreview} 
                          alt="Workflow preview"
                          className="max-w-full max-h-48 object-contain rounded-md border"
                        />
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        {selectedImage?.name} ({Math.round((selectedImage?.size || 0) / 1024)}KB)
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedImage(null);
                          setImagePreview(null);
                          setAnalysisResult(null);
                          setError(null);
                        }}
                        className="w-full"
                      >
                        Remove Image
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="text-base font-medium">
                          Drop your workflow image here, or{' '}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-primary hover:text-primary/80"
                          >
                            browse files
                          </button>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Supports PNG, JPG, GIF up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                    data-testid="input-image-upload"
                  />
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Analysis Results */}
              {analysisResult && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Analysis Results</h4>
                    <Badge variant={analysisResult.confidence >= 70 ? "default" : "secondary"}>
                      {analysisResult.confidence}% confidence
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {analysisResult.analysis}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {analysisResult.nodes.length} nodes detected
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {analysisResult.edges.length} connections found
                    </div>
                  </div>

                  {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Recommendations:</Label>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {analysisResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              data-testid="button-cancel-generate"
            >
              Cancel
            </Button>
            
            {mode === 'text' ? (
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="flex-1"
                data-testid="button-generate-workflow"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2" size={16} />
                    Generate
                  </>
                )}
              </Button>
            ) : (
              <div className="flex-1 flex gap-2">
                {!analysisResult ? (
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing || !selectedImage}
                    className="flex-1"
                    data-testid="button-analyze-image"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Image className="mr-2" size={16} />
                        Analyze Image
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={generateFromImage}
                    disabled={!analysisResult.canGenerate}
                    className="flex-1"
                    data-testid="button-generate-from-image"
                  >
                    <Sparkles className="mr-2" size={16} />
                    Generate Workflow
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}