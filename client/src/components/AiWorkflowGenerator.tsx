import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import type { Node, Edge } from '../lib/kiteframe/types';
import { Sparkles, Loader2 } from 'lucide-react';

interface AiWorkflowGeneratorProps {
  onClose: () => void;
  onGenerate: (workflow: { nodes: Node[], edges: Edge[] }) => void;
}

export function AiWorkflowGenerator({ onClose, onGenerate }: AiWorkflowGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const aiClient = useAi();

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
      const systemPrompt = `ONLY return JSON. No text before or after. Just JSON.

Format:
{"nodes":[{"id":"node-1","type":"input","position":{"x":300,"y":250},"data":{"label":"Start","description":"Begin","icon":"ArrowRight","iconColor":"text-blue-500"},"width":200,"height":100}],"edges":[]}

Types: input, process, output
Icons: input=ArrowRight, process=Cog, output=ArrowLeft
Colors: input=text-blue-500, process=text-green-500, output=text-red-500
Position nodes 250px apart horizontally.`;

      const response = await aiClient.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create workflow: ${prompt}` }
        ],
        temperature: 0.1,
        maxTokens: 1000
      });

      // Parse the AI response with better JSON cleaning
      let cleanedResponse = response.text
        .replace(/^JSON:\s*/i, '') // Remove "JSON:" prefix from TinyLlama responses
        .replace(/```json\s?|```/g, '') // Remove markdown code blocks
        .trim();
      
      console.log('🧹 CLEANED RESPONSE:', cleanedResponse.substring(0, 200) + '...');
      
      // Try to find JSON content if wrapped in text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      // If still no valid JSON structure found, create fallback
      if (!cleanedResponse.includes('{') || !cleanedResponse.includes('}')) {
        console.log('❌ NO JSON FOUND, CREATING FALLBACK');
        const fallbackWorkflow = {
          nodes: [
            {
              id: "node-1",
              type: "input",
              position: { x: 300, y: 250 },
              data: {
                label: "Start",
                description: prompt.substring(0, 50) + "...",
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
              type: "bezier",
              style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
              markers: { type: "arrow", position: "end" }
            },
            {
              id: "edge-2",
              source: "node-2",
              target: "node-3",
              type: "bezier",
              style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
              markers: { type: "arrow", position: "end" }
            }
          ]
        };
        
        onGenerate(fallbackWorkflow);
        toast({
          title: "Basic Workflow Created",
          description: "Generated a simple 3-step workflow. You can customize the nodes in the sidebar.",
          variant: "default"
        });
        onClose();
        return;
      }
      
      // Remove any trailing commas before closing brackets/braces
      cleanedResponse = cleanedResponse.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix common JSON formatting issues
      cleanedResponse = cleanedResponse.replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // Quote unquoted keys
      cleanedResponse = cleanedResponse.replace(/:\s*'([^']*)'/g, ': "$1"'); // Single to double quotes
      
      const workflowData = JSON.parse(cleanedResponse);

      if (workflowData.nodes && workflowData.edges) {
        console.log('🤖 AI GENERATED WORKFLOW:', { 
          nodeCount: workflowData.nodes.length, 
          edgeCount: workflowData.edges.length,
          nodes: workflowData.nodes,
          edges: workflowData.edges
        });
        
        onGenerate(workflowData);
        toast({
          title: "Workflow Generated",
          description: `Created ${workflowData.nodes.length} nodes and ${workflowData.edges.length} connections.`,
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
          description = "Invalid API key. Please check your OpenAI API key in AI Settings.";
        } else if (error.message.includes('429')) {
          title = "Rate Limit Exceeded";
          description = "Too many requests. Please wait a moment and try again.";
        } else if (error.message.includes('500')) {
          title = "Server Error";
          description = "OpenAI service is temporarily unavailable. Please try again later.";
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
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="modal-ai-workflow-generator" aria-describedby="ai-generator-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            AI Workflow Generator
          </DialogTitle>
        </DialogHeader>
        <div id="ai-generator-description" className="sr-only">
          Generate complete workflows from natural language descriptions using AI
        </div>
        
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}