import { useState, useRef, useEffect, useCallback, MouseEvent, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import { useCreditsGate } from '@/hooks/useCreditsGate';
import type { Node, Edge, CanvasObject } from '../lib/kiteframe/types';
import { selectKiteRole, getRoleLabel, type KiteRole, type RoleContext } from '../ai/roleSelector';
import { computeConfidence, isConfidenceInsufficient } from '../ai/confidenceScoring';
import { getSystemPromptForRole } from '../ai/systemPrompts';
import { computeWorkflowMaturity, type WorkflowMaturity } from '../ai/workflowMaturity';
import { generateFollowUps, shouldAskFollowUps } from '../ai/followUpGenerator';
import type { VisionRole } from '../ai/workflow/visionPipeline';
import { 
  buildKiteAIContext, 
  getRoleDisplayInfo,
  type KiteAIRole 
} from '../lib/ai/buildKiteAIContext';
import { inferKiteAIRole } from '../lib/ai/inferKiteAIRole';
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
  Eye,
  Anchor,
  AlertCircle
} from 'lucide-react';

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
  meta?: {
    kiteRole?: KiteRole;
    confidence?: number;
    maturity?: WorkflowMaturity;
  };
  followUps?: string[];
}

interface WorkflowDiff {
  added: { nodes: Node[]; edges: Edge[] };
  removed: { nodes: Node[]; edges: Edge[] };
  modified: { nodes: Node[]; edges: Edge[] };
}

const CHAT_STORAGE_KEY_PREFIX = 'kiteframe-kiteai-chat-';

function getDefaultWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: "Hi! I'm KiteAI, your workflow assistant. I can help you:\n\n• Create new workflows from descriptions\n• Analyze and improve existing workflows\n• Import workflows from images or .kiteframe files\n• Answer questions about workflow design\n\nThis feature uses AI tokens. Need more? Contact info@kiteframe.space\n\nHow can I help you today?",
    timestamp: new Date()
  };
}

function rehydrateMessages(stored: any[]): ChatMessage[] {
  return stored.map((m: any) => ({
    ...m,
    timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp)
  }));
}

function loadMessagesFromStorage(storageKey: string): ChatMessage[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return rehydrateMessages(parsed);
      }
    }
  } catch {
  }
  return null;
}

interface ChatViewProps {
  projectId?: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  onApplyWorkflow?: (workflow: { nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] }) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
  mode: 'panel' | 'floating';
}

function ChatView({ 
  projectId,
  nodes: currentNodes, 
  edges: currentEdges, 
  canvasObjects: currentCanvasObjects,
  onApplyWorkflow,
  onPreviewWorkflow,
  mode
}: ChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showDiffPreview, setShowDiffPreview] = useState<string | null>(null);
  const [visionRole, setVisionRole] = useState<VisionRole>('pm');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const aiClient = useAi();
  const { 
    credits, 
    isOutOfCredits, 
    isAuthenticated, 
    ctaMessage, 
    ctaAction, 
    ctaButtonText,
    openSignup,
    openPricing,
    openCreditsDialog
  } = useCreditsGate();
  
  const storageKey = projectId ? `${CHAT_STORAGE_KEY_PREFIX}${projectId}` : null;
  
  const getWelcomeMessage = useCallback(() => {
    if (isOutOfCredits) {
      if (!isAuthenticated) {
        return "You've run out of free trial tokens. Create an account and get tokens monthly to unlock the power of KiteAI.\n\nWith a free account, you'll receive 25 AI credits every month to:\n\n• Create new workflows from descriptions\n• Analyze and improve existing workflows\n• Import workflows from images\n• Generate AI-powered suggestions";
      } else {
        return "You've run out of AI credits.\n\n" + ctaMessage + "\n\nOnce you have credits, you'll be able to:\n\n• Create new workflows from descriptions\n• Analyze and improve existing workflows\n• Import workflows from images\n• Generate AI-powered suggestions";
      }
    }
    return "Hi! I'm KiteAI, your workflow assistant. I can help you:\n\n• Create new workflows from descriptions\n• Analyze and improve existing workflows\n• Import workflows from images or .kiteframe files\n• Answer questions about workflow design\n\nThis feature uses AI tokens. Need more? Contact info@kiteframe.space\n\nHow can I help you today?";
  }, [isOutOfCredits, isAuthenticated, ctaMessage]);
  
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!storageKey) {
      return [getDefaultWelcomeMessage()];
    }
    return loadMessagesFromStorage(storageKey) || [getDefaultWelcomeMessage()];
  });
  
  const prevProjectIdRef = useRef<string | undefined>(projectId);
  
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
    }
  }, [messages, storageKey]);
  
  useEffect(() => {
    if (prevProjectIdRef.current === projectId) return;
    prevProjectIdRef.current = projectId;
    
    if (!storageKey) {
      setMessages([getDefaultWelcomeMessage()]);
      return;
    }
    
    const loaded = loadMessagesFromStorage(storageKey);
    setMessages(loaded || [getDefaultWelcomeMessage()]);
  }, [projectId, storageKey]);
  
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
      const welcomeContent = getWelcomeMessage();
      if (messages[0].content !== welcomeContent) {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeContent,
          timestamp: new Date()
        }]);
      }
    }
  }, [isOutOfCredits, getWelcomeMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (mode === 'panel') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parseKiteframeFile = async (file: File): Promise<{ nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] } | null> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      let nodes: Node[] = [];
      let edges: Edge[] = [];
      let canvasObjects: CanvasObject[] = [];

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

  const buildCanvasContext = useCallback(() => {
    if (currentNodes.length === 0) {
      return "The canvas is currently empty.";
    }

    const nodeTypes = currentNodes.reduce((acc, node) => {
      const type = node.type || 'process';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const nodeLabels = currentNodes.map(n => n.data?.label || 'Unnamed').join(', ');
    
    return `Current canvas has ${currentNodes.length} nodes (${Object.entries(nodeTypes).map(([t, c]) => `${c} ${t}`).join(', ')}) and ${currentEdges.length} connections. Node labels: ${nodeLabels}`;
  }, [currentNodes, currentEdges]);

  const handleSend = async () => {
    if (!inputValue.trim() && pendingFiles.length === 0) return;
    
    if (isOutOfCredits) {
      toast({
        title: 'Out of credits',
        description: 'AI features are disabled. Get more credits to continue.',
        variant: 'destructive',
      });
      if (ctaAction === 'signup') openSignup();
      else if (ctaAction === 'upgrade') openPricing();
      else openCreditsDialog();
      return;
    }

    const messageId = `msg-${Date.now()}`;
    const attachments: ChatMessage['attachments'] = [];

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

      const imageAttachment = attachments.find(a => a.type === 'image');
      if (imageAttachment?.preview) {
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

      const conversationHistory = messages.slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }));

      const hasFigmaAttachment = attachments.some(a => 
        a.name?.toLowerCase().includes('figma') || 
        a.type === 'image'
      );
      const hasImageAttachments = attachments.some(a => a.type === 'image');
      
      const effectiveRole = inferKiteAIRole({
        mode: 'in_project',
        userMessage: inputValue,
        projectContext: {
          nodes: currentNodes,
          edges: currentEdges,
          canvasObjects: currentCanvasObjects,
          projectName: projectId
        },
        uiContext: {
          hasUploadedImages: hasImageAttachments,
          hasFigmaAttachment
        }
      });
      
      const hasCanvasContext = currentNodes.length > 0;
      const hasSemanticData = currentNodes.some(n => n.data?.label || n.data?.description);
      
      const kiteAIContext = buildKiteAIContext(
        'in_project',
        effectiveRole,
        {
          nodes: currentNodes,
          edges: currentEdges,
          canvasObjects: currentCanvasObjects,
          projectName: projectId
        }
      );
      
      let enhancedPrompt = kiteAIContext.systemPrompt;
      if (!hasCanvasContext) {
        enhancedPrompt += `\n\nIMPORTANT: The canvas is empty. Help the user build their first workflow. Do NOT ask "What are you building?" - instead, help them create nodes based on their request.`;
      } else if (!hasSemanticData) {
        enhancedPrompt += `\n\nNOTE: Nodes exist but lack labels/descriptions. Help refine them rather than asking foundational questions.`;
      }

      const response = await aiClient.chat({
        messages: [
          { role: 'system', content: enhancedPrompt },
          ...conversationHistory,
          { role: 'user', content: inputValue }
        ],
        temperature: 0.7,
        maxTokens: 3000
      });

      let workflowProposal: ChatMessage['workflowProposal'] | undefined;
      let responseText = response.text;

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
        workflowProposal,
        meta: { kiteRole: effectiveRole as KiteRole }
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

  const handleAcceptWorkflow = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.workflowProposal || !onApplyWorkflow) return;

    onApplyWorkflow({
      nodes: message.workflowProposal.nodes,
      edges: message.workflowProposal.edges,
      canvasObjects: message.workflowProposal.canvasObjects
    });

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

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Chat cleared! How can I help you with your workflow today?",
      timestamp: new Date()
    }]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-purple-600/10 to-blue-600/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">KiteAI</span>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title="Clear chat"
            data-testid="button-kiteai-clear"
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
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
              
              <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block max-w-[85%] p-3 rounded-lg text-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : 'bg-muted rounded-bl-none'
                }`}>
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
                  
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  
                  {message.followUps && message.followUps.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.followUps.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => setInputValue(q)}
                          className="block w-full text-left p-2 text-xs bg-background/50 hover:bg-background rounded border border-border/50 hover:border-primary/50 transition-colors"
                          data-testid={`button-followup-${i}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  
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
                      
                      {showDiffPreview === message.id && renderDiffPreview(message.workflowProposal)}
                      
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
                
                <div className={`text-[10px] text-muted-foreground mt-1 flex items-center gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'assistant' && message.meta?.kiteRole && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted-foreground/10">
                      {getRoleLabel(message.meta.kiteRole).emoji} {getRoleLabel(message.meta.kiteRole).label}
                    </span>
                  )}
                  <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))}
          
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
        className={`p-3 border-t border-border flex-shrink-0 ${dragActive ? 'bg-primary/10' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
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
        
        {dragActive && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-xl flex items-center justify-center pointer-events-none">
            <span className="text-primary font-medium">Drop files here</span>
          </div>
        )}
        
        {isOutOfCredits ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>AI features disabled - out of credits</span>
            </div>
            <Button
              onClick={() => {
                if (ctaAction === 'signup') openSignup();
                else if (ctaAction === 'upgrade') openPricing();
                else openCreditsDialog();
              }}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              data-testid="button-kiteai-get-credits"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {ctaButtonText}
            </Button>
          </div>
        ) : (
          <>
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
            
            {pendingFiles.some(f => f.type.startsWith('image/')) && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-[10px] text-muted-foreground">Vision mode:</span>
                <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setVisionRole('pm')}
                    className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      visionRole === 'pm' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    data-testid="button-vision-role-pm"
                  >
                    PM
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisionRole('designer')}
                    className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      visionRole === 'designer' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    data-testid="button-vision-role-designer"
                  >
                    Designer
                  </button>
                </div>
              </div>
            )}
            
            <div className="text-[10px] text-muted-foreground mt-2 text-center">
              Drop images or .kiteframe files, or click the paperclip to upload
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface KiteAIChatPanelProps {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  onApplyWorkflow?: (workflow: { nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] }) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
}

export function KiteAIChatPanel({
  projectId,
  nodes,
  edges,
  canvasObjects,
  onApplyWorkflow,
  onPreviewWorkflow
}: KiteAIChatPanelProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <ChatView
        mode="panel"
        projectId={projectId}
        nodes={nodes}
        edges={edges}
        canvasObjects={canvasObjects}
        onApplyWorkflow={onApplyWorkflow}
        onPreviewWorkflow={onPreviewWorkflow}
      />
    </div>
  );
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
  const [size, setSize] = useState({ width: 384, height: 512 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!chatWindowRef.current) return;
    setIsDragging(true);
    const rect = chatWindowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!chatWindowRef.current) return;
    setIsResizing(true);
    const rect = chatWindowRef.current.getBoundingClientRect();
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = -(e.clientY - resizeStart.y);
      
      setSize({
        width: Math.max(300, resizeStart.width + deltaX),
        height: Math.max(200, resizeStart.height + deltaY)
      });
    }
  }, [isDragging, isResizing, dragOffset, resizeStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const resetSize = () => {
    setSize({ width: 384, height: 512 });
    setPosition({ x: 0, y: 0 });
  };

  const handleToggleMinimize = () => {
    if (position.x !== 0 || position.y !== 0) {
      const heightDiff = isMinimized ? size.height - 56 : 512 - size.height;
      setPosition(prev => ({
        ...prev,
        y: prev.y + heightDiff
      }));
    }
    setIsMinimized(!isMinimized);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove as any);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove as any);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove]);

  return (
    <>
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

      {isOpen && (
        <div 
          ref={chatWindowRef}
          className={`fixed z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          } ${isResizing ? 'cursor-se-resize' : ''}`}
          style={{
            left: position.x === 0 && position.y === 0 ? '4rem' : `${position.x}px`,
            top: position.x === 0 && position.y === 0 ? 'auto' : `${position.y}px`,
            bottom: position.x === 0 && position.y === 0 ? '1.5rem' : 'auto',
            width: isMinimized ? '288px' : `${size.width}px`,
            height: isMinimized ? '56px' : `${size.height}px`,
          }}
          data-testid="panel-kiteai-chat"
        >
          <div 
            className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-t-xl select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleHeaderMouseDown}
            title="Drag to move"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">KiteAI</span>
            </div>
            <div className="flex items-center gap-1 pointer-events-auto">
              <button
                onClick={(e) => { e.stopPropagation(); resetSize(); }}
                className="p-1.5 hover:bg-accent rounded-md transition-colors"
                title="Reset to default size"
                data-testid="button-kiteai-reset"
              >
                <Anchor className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleMinimize(); }}
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

          {!isMinimized && (
            <div className="flex-1 overflow-hidden">
              <ChatView
                mode="floating"
                nodes={currentNodes}
                edges={currentEdges}
                canvasObjects={currentCanvasObjects}
                onApplyWorkflow={onApplyWorkflow}
                onPreviewWorkflow={onPreviewWorkflow}
              />
              
              <div
                onMouseDown={handleResizeStart}
                className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize hover:bg-primary/20 rounded-tl"
                title="Drag to resize"
                style={{
                  backgroundImage: 'linear-gradient(135deg, transparent 50%, currentColor 50%)',
                  opacity: 0.6
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
