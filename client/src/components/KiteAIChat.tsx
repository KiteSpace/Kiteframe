import { useState, useRef, useEffect, useCallback, MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import type { Node, Edge, CanvasObject } from '../lib/kiteframe/types';
import { 
  MessageCircle, 
  Send, 
  Paperclip, 
  X, 
  Loader2, 
  FileText, 
  Image as ImageIcon,
  Check,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  User,
  Trash2,
  RotateCcw,
  Eye
} from 'lucide-react';

// Message types for conversation
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: {
    type: 'image' | 'kiteframe';
    name: string;
    preview?: string;
    data?: any;
  }[];
  workflowProposal?: {
    nodes: Node[];
    edges: Edge[];
    canvasObjects?: CanvasObject[];
    description?: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
}

// Diff visualization for workflow changes
interface WorkflowDiff {
  added: { nodes: Node[]; edges: Edge[] };
  removed: { nodes: Node[]; edges: Edge[] };
  modified: { nodes: Node[]; edges: Edge[] };
}

interface KiteAIChatProps {
  currentNodes: Node[];
  currentEdges: Edge[];
  currentCanvasObjects: CanvasObject[];
  onApplyWorkflow: (workflow: { nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] }) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
}

export function KiteAIChat({ 
  currentNodes, 
  currentEdges, 
  currentCanvasObjects,
  onApplyWorkflow,
  onPreviewWorkflow
}: KiteAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm KiteAI, your workflow assistant. I can help you:\n\n• Create new workflows from descriptions\n• Analyze and improve existing workflows\n• Import workflows from images or .kiteframe files\n• Answer questions about workflow design\n\nThis feature uses AI tokens. Need more? Contact info@kiteframe.space\n\nHow can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showDiffPreview, setShowDiffPreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const aiClient = useAi();

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!chatWindowRef.current) return;
    setIsDragging(true);
    const rect = chatWindowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    setPosition({ x: 0, y: 0 });
  };

  // Add/remove global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove as any);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Calculate workflow diff between current and proposed
  const calculateDiff = useCallback((proposed: { nodes: Node[]; edges: Edge[] }): WorkflowDiff => {
    const currentNodeIds = new Set(currentNodes.map(n => n.id));
    const proposedNodeIds = new Set(proposed.nodes.map(n => n.id));
    const currentEdgeIds = new Set(currentEdges.map(e => e.id));
    const proposedEdgeIds = new Set(proposed.edges.map(e => e.id));

    return {
      added: {
        nodes: proposed.nodes.filter(n => !currentNodeIds.has(n.id)),
        edges: proposed.edges.filter(e => !currentEdgeIds.has(e.id))
      },
      removed: {
        nodes: currentNodes.filter(n => !proposedNodeIds.has(n.id)),
        edges: currentEdges.filter(e => !proposedEdgeIds.has(e.id))
      },
      modified: {
        nodes: proposed.nodes.filter(n => {
          if (!currentNodeIds.has(n.id)) return false;
          const currentNode = currentNodes.find(cn => cn.id === n.id);
          return JSON.stringify(currentNode) !== JSON.stringify(n);
        }),
        edges: proposed.edges.filter(e => {
          if (!currentEdgeIds.has(e.id)) return false;
          const currentEdge = currentEdges.find(ce => ce.id === e.id);
          return JSON.stringify(currentEdge) !== JSON.stringify(e);
        })
      }
    };
  }, [currentNodes, currentEdges]);

  // Handle file drop
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
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isKiteframe = file.name.endsWith('.kiteframe') || file.name.endsWith('.json');
      return isImage || isKiteframe;
    });

    if (validFiles.length === 0) {
      toast({
        title: "Invalid File",
        description: "Please upload an image or .kiteframe file.",
        variant: "destructive"
      });
      return;
    }

    setPendingFiles(prev => [...prev, ...validFiles]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(Array.from(files));
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Parse .kiteframe file
  const parseKiteframeFile = async (file: File): Promise<{ nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] } | null> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Handle various kiteframe format structures
      let nodes: Node[] = [];
      let edges: Edge[] = [];
      let canvasObjects: CanvasObject[] = [];

      // Try different path structures
      if (data.canvas?.nodes) {
        nodes = data.canvas.nodes;
        edges = data.canvas.edges || [];
        canvasObjects = data.canvas.canvasObjects || [];
      } else if (data.workflow?.canvas?.nodes) {
        nodes = data.workflow.canvas.nodes;
        edges = data.workflow.canvas.edges || [];
        canvasObjects = data.workflow.canvas.canvasObjects || [];
      } else if (data.flow?.nodes) {
        nodes = data.flow.nodes;
        edges = data.flow.edges || [];
        canvasObjects = data.flow.canvasObjects || [];
      } else if (data.nodes) {
        nodes = data.nodes;
        edges = data.edges || [];
        canvasObjects = data.canvasObjects || [];
      }

      if (nodes.length === 0) {
        return null;
      }

      return { nodes, edges, canvasObjects };
    } catch (error) {
      console.error('Failed to parse kiteframe file:', error);
      return null;
    }
  };

  // Build context about current canvas for AI
  const buildCanvasContext = useCallback(() => {
    if (currentNodes.length === 0) {
      return "The canvas is currently empty.";
    }

    const nodeTypes = currentNodes.reduce((acc, node) => {
      const type = node.type || 'basic';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const nodeLabels = currentNodes.map(n => n.data?.label || 'Unnamed').join(', ');
    
    return `Current canvas has ${currentNodes.length} nodes (${Object.entries(nodeTypes).map(([t, c]) => `${c} ${t}`).join(', ')}) and ${currentEdges.length} connections. Node labels: ${nodeLabels}`;
  }, [currentNodes, currentEdges]);

  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() && pendingFiles.length === 0) return;

    const messageId = `msg-${Date.now()}`;
    const attachments: ChatMessage['attachments'] = [];

    // Process pending files
    for (const file of pendingFiles) {
      if (file.type.startsWith('image/')) {
        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        attachments.push({ type: 'image', name: file.name, preview });
      } else {
        const parsed = await parseKiteframeFile(file);
        attachments.push({ 
          type: 'kiteframe', 
          name: file.name, 
          data: parsed 
        });
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setPendingFiles([]);
    setIsLoading(true);

    try {
      // Handle kiteframe file uploads directly
      const kiteframeAttachment = attachments.find(a => a.type === 'kiteframe' && a.data);
      if (kiteframeAttachment?.data) {
        const workflow = kiteframeAttachment.data;
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `I found a workflow in "${kiteframeAttachment.name}" with ${workflow.nodes.length} nodes and ${workflow.edges.length} connections. Would you like me to apply this to your canvas?`,
          timestamp: new Date(),
          workflowProposal: {
            nodes: workflow.nodes,
            edges: workflow.edges,
            canvasObjects: workflow.canvasObjects,
            description: `Imported from ${kiteframeAttachment.name}`,
            status: 'pending'
          }
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Handle image uploads
      const imageAttachment = attachments.find(a => a.type === 'image');
      if (imageAttachment?.preview) {
        // Send to image analysis endpoint
        const file = pendingFiles.find(f => f.type.startsWith('image/'));
        if (file) {
          const formData = new FormData();
          formData.append('image', file);

          const response = await fetch('/api/ai/analyze-workflow-image', {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const result = await response.json();
            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `I analyzed your workflow image with ${result.confidence}% confidence.\n\n${result.analysis}\n\n${result.recommendations?.length > 0 ? 'Recommendations:\n' + result.recommendations.map((r: string) => `• ${r}`).join('\n') : ''}`,
              timestamp: new Date(),
              workflowProposal: result.canGenerate ? {
                nodes: result.nodes,
                edges: result.edges,
                description: 'Generated from image analysis',
                status: 'pending'
              } : undefined
            };
            setMessages(prev => [...prev, assistantMessage]);
          } else {
            throw new Error('Failed to analyze image');
          }
          setIsLoading(false);
          return;
        }
      }

      // Regular text conversation
      const canvasContext = buildCanvasContext();
      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }));

      const systemPrompt = `You are KiteAI, a helpful workflow design assistant for the Kiteframe workflow editor. You help users create, modify, and understand workflows.

Current canvas state: ${canvasContext}

IMPORTANT RULES:
1. When the user asks you to CREATE or MODIFY a workflow, you MUST respond with valid JSON in this exact format:
{"nodes":[...],"edges":[...]}

2. When having a CONVERSATION or answering QUESTIONS, respond naturally without JSON.

3. For workflow generation, use these node types: input, process, output, condition, ai, image
   - input nodes: ArrowRight icon, text-blue-500
   - process nodes: Cog icon, text-green-500
   - output nodes: ArrowLeft icon, text-red-500
   - condition nodes: HelpCircle icon, text-yellow-500
   - ai nodes: Bot icon, text-purple-500

4. Position nodes with x starting at 300, spacing 250px apart. y should be around 200-400.

5. Each node needs: id, type, position: {x, y}, data: {label, description, icon, iconColor}, width: 200, height: 100

6. Each edge needs: id, source, target, type: "bezier", style: {strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2}, markers: {type: "arrow", position: "end"}

7. When modifying existing workflows, keep existing node IDs and add new ones with unique IDs.

Be friendly, helpful, and conversational. Ask clarifying questions if needed.`;

      const response = await aiClient.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: inputValue }
        ],
        temperature: 0.7,
        maxTokens: 3000
      });

      // Check if response contains workflow JSON
      let workflowProposal: ChatMessage['workflowProposal'] | undefined;
      let responseText = response.text;

      // Try to extract JSON if present
      const jsonMatch = response.text.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          let cleanJson = jsonMatch[0]
            .replace(/```json\s?|```/g, '')
            .replace(/,(\s*[}\]])/g, '$1');
          
          const parsed = JSON.parse(cleanJson);
          if (parsed.nodes && parsed.edges) {
            workflowProposal = {
              nodes: parsed.nodes,
              edges: parsed.edges,
              description: 'AI-generated workflow',
              status: 'pending'
            };
            // Remove JSON from display text
            responseText = response.text.replace(jsonMatch[0], '').trim();
            if (!responseText) {
              responseText = `I've created a workflow with ${parsed.nodes.length} nodes and ${parsed.edges.length} connections. Would you like me to apply it to your canvas?`;
            }
          }
        } catch (e) {
          console.log('Failed to parse workflow JSON from response');
        }
      }

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        workflowProposal
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle workflow proposal actions
  const handleAcceptWorkflow = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.workflowProposal) return;

    onApplyWorkflow({
      nodes: message.workflowProposal.nodes,
      edges: message.workflowProposal.edges,
      canvasObjects: message.workflowProposal.canvasObjects
    });

    // Update message status
    setMessages(prev => prev.map(m => 
      m.id === messageId && m.workflowProposal
        ? { ...m, workflowProposal: { ...m.workflowProposal, status: 'accepted' } }
        : m
    ));

    toast({
      title: "Workflow Applied",
      description: `Added ${message.workflowProposal.nodes.length} nodes to your canvas.`
    });
  };

  const handleRejectWorkflow = (messageId: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId && m.workflowProposal
        ? { ...m, workflowProposal: { ...m.workflowProposal, status: 'rejected' } }
        : m
    ));
  };

  const handlePreviewWorkflow = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.workflowProposal) return;

    setShowDiffPreview(showDiffPreview === messageId ? null : messageId);
    
    // Trigger visual preview on canvas if callback provided
    if (onPreviewWorkflow) {
      if (showDiffPreview === messageId) {
        onPreviewWorkflow(null);
      } else {
        onPreviewWorkflow({
          nodes: message.workflowProposal.nodes,
          edges: message.workflowProposal.edges
        });
      }
    }
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Chat cleared! How can I help you with your workflow today?",
      timestamp: new Date()
    }]);
  };

  // Handle key press in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render workflow diff preview
  const renderDiffPreview = (proposal: ChatMessage['workflowProposal']) => {
    if (!proposal) return null;
    
    const diff = calculateDiff({ nodes: proposal.nodes, edges: proposal.edges });
    
    return (
      <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs space-y-2">
        <div className="font-medium text-sm mb-2">Changes Preview</div>
        
        {diff.added.nodes.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-mono">+</span>
            <span className="text-green-600 dark:text-green-400">
              {diff.added.nodes.length} new node{diff.added.nodes.length > 1 ? 's' : ''}: {diff.added.nodes.map(n => n.data?.label || n.id).join(', ')}
            </span>
          </div>
        )}
        
        {diff.added.edges.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-green-500 font-mono">+</span>
            <span className="text-green-600 dark:text-green-400">
              {diff.added.edges.length} new connection{diff.added.edges.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {diff.removed.nodes.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-red-500 font-mono">-</span>
            <span className="text-red-600 dark:text-red-400">
              {diff.removed.nodes.length} removed node{diff.removed.nodes.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {diff.modified.nodes.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 font-mono">~</span>
            <span className="text-yellow-600 dark:text-yellow-400">
              {diff.modified.nodes.length} modified node{diff.modified.nodes.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {diff.added.nodes.length === 0 && diff.added.edges.length === 0 && 
         diff.removed.nodes.length === 0 && diff.modified.nodes.length === 0 && (
          <div className="text-muted-foreground">No changes from current canvas</div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-16 z-50 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
          data-testid="button-kiteai-open"
        >
          <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
          <span className="font-medium">KiteAI</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          ref={chatWindowRef}
          className={`fixed z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col transition-all duration-200 ${
            isMinimized ? 'w-72 h-14' : 'w-96 h-[32rem]'
          } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            bottom: position.x === 0 && position.y === 0 ? '1.5rem' : 'auto',
            ...(position.x === 0 && position.y === 0 ? { left: '4rem' } : {})
          }}
          data-testid="panel-kiteai-chat"
        >
          {/* Header - Draggable */}
          <div 
            className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-t-xl cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            title="Drag to move, double-click to reset"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">KiteAI</span>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                onClick={(e) => { e.stopPropagation(); clearChat(); }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors"
                title="Clear chat"
                data-testid="button-kiteai-clear"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors"
                data-testid="button-kiteai-minimize"
              >
                {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors"
                data-testid="button-kiteai-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' 
                          ? 'bg-primary' 
                          : 'bg-gradient-to-r from-purple-600 to-blue-600'
                      }`}>
                        {message.role === 'user' 
                          ? <User className="w-4 h-4 text-primary-foreground" />
                          : <Bot className="w-4 h-4 text-white" />
                        }
                      </div>
                      
                      {/* Message Content */}
                      <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-[85%] p-3 rounded-lg text-sm ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        }`}>
                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {message.attachments.map((att, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-background/50 rounded">
                                  {att.type === 'image' ? (
                                    <>
                                      {att.preview && (
                                        <img src={att.preview} alt={att.name} className="w-16 h-16 object-cover rounded" />
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="w-4 h-4" />
                                      <span className="text-xs truncate">{att.name}</span>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Text content with line breaks preserved */}
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          
                          {/* Workflow Proposal */}
                          {message.workflowProposal && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="secondary" className="text-xs">
                                  {message.workflowProposal.nodes.length} nodes, {message.workflowProposal.edges.length} edges
                                </Badge>
                                <span className={`text-xs ${
                                  message.workflowProposal.status === 'accepted' 
                                    ? 'text-green-500' 
                                    : message.workflowProposal.status === 'rejected'
                                    ? 'text-red-500'
                                    : 'text-muted-foreground'
                                }`}>
                                  {message.workflowProposal.status === 'accepted' && '✓ Applied'}
                                  {message.workflowProposal.status === 'rejected' && '✗ Declined'}
                                </span>
                              </div>
                              
                              {/* Diff Preview Toggle */}
                              {showDiffPreview === message.id && renderDiffPreview(message.workflowProposal)}
                              
                              {/* Action Buttons */}
                              {message.workflowProposal.status === 'pending' && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePreviewWorkflow(message.id)}
                                    className="flex-1 h-8 text-xs"
                                    data-testid={`button-preview-workflow-${message.id}`}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    {showDiffPreview === message.id ? 'Hide' : 'Preview'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleAcceptWorkflow(message.id)}
                                    className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                                    data-testid={`button-accept-workflow-${message.id}`}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Apply
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRejectWorkflow(message.id)}
                                    className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    data-testid={`button-reject-workflow-${message.id}`}
                                  >
                                    <XCircle className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Timestamp */}
                        <div className={`text-[10px] text-muted-foreground mt-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-muted rounded-lg p-3 rounded-bl-none">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div 
                className={`p-3 border-t border-border ${dragActive ? 'bg-primary/10' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {/* Pending Files Preview */}
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                        {file.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        <span className="truncate max-w-[100px]">{file.name}</span>
                        <button 
                          onClick={() => removePendingFile(index)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Drop Zone Indicator */}
                {dragActive && (
                  <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center pointer-events-none">
                    <span className="text-primary font-medium">Drop files here</span>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.kiteframe,.json"
                    onChange={handleFileInputChange}
                    className="hidden"
                    multiple
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0"
                    disabled={isLoading}
                    data-testid="button-kiteai-attach"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Describe your workflow..."
                    className="flex-1"
                    disabled={isLoading}
                    data-testid="input-kiteai-message"
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={isLoading || (!inputValue.trim() && pendingFiles.length === 0)}
                    className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    data-testid="button-kiteai-send"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="text-[10px] text-muted-foreground mt-2 text-center">
                  Drop images or .kiteframe files, or click the paperclip to upload
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
