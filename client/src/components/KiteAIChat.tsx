import { useState, useRef, useEffect, useLayoutEffect, useCallback, MouseEvent, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
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
import { ChatSendButton } from '@/components/chat';
import { getRouter, extractJSON } from '@/ai/router';
import { 
  MessageCircle, 
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
import { QuickActions, DiscussionQuickActions } from '@/components/QuickActions';
import { EdgeCaseSelector, type EdgeCase } from '@/components/EdgeCaseSelector';
import { 
  analyzeWorkflowDiagnostics, 
  getSuggestedQuickActions, 
  isWorkflowValidForCreation,
  type QuickActionType 
} from '@/utils/workflowDiagnostics';
import { 
  AI_RESPONSE_TEMPLATES, 
  QUICK_ACTION_LABELS,
  AI_WORKFLOW_EXPAND_EDGE_CASES_PROMPT,
  AI_WORKFLOW_LIST_EDGE_CASES_PROMPT,
  AI_WORKFLOW_EXPAND_SELECTED_EDGE_CASES_PROMPT
} from '@/constants/aiWorkflowExpansionPrompts';
import { usePromptContextStore } from '@/contexts/PromptContextStore';

// Message type categorization for unified workflow draft model
export type MessageType = 
  | 'user_prompt'
  | 'workflow_generated'   // First baseline workflow created
  | 'workflow_expanded'    // Workflow modified via quick action
  | 'discussion'           // Clarifying questions or edge case listing
  | 'system';              // Informational system messages

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type?: MessageType;  // Optional for backward compat, default inferred from content
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

// Transcript message type for storing conversation history
export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

// WorkflowDraft type exported for use by shells
export interface WorkflowDraft {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  status: 'draft' | 'expanded';
  originPrompt?: string;
  transcript?: TranscriptMessage[];
}

interface KiteAIChatBrainProps {
  projectId?: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  onApplyWorkflow?: (workflow: { nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] }) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
  mode: 'panel' | 'floating' | 'fullscreen';
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
  onCreateWorkflow?: (draft: WorkflowDraft) => void;
}

export function KiteAIChatBrain({ 
  projectId,
  nodes: currentNodes, 
  edges: currentEdges, 
  canvasObjects: currentCanvasObjects,
  onApplyWorkflow,
  onPreviewWorkflow,
  mode,
  initialPrompt,
  onInitialPromptConsumed,
  onCreateWorkflow
}: KiteAIChatBrainProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showDiffPreview, setShowDiffPreview] = useState<string | null>(null);
  const [visionRole, setVisionRole] = useState<VisionRole>('pm');
  
  // Workflow generation state for assertive first-turn generation
  type WorkflowGenState = 'BASELINE_GENERATED' | 'EXPANDED_WITH_EDGE_CASES' | 'DISCUSSING_EDGE_CASES' | 'SELECTED_EDGE_CASES_APPLIED' | null;
  const [workflowGenState, setWorkflowGenState] = useState<WorkflowGenState>(null);
  const [pendingQuickActions, setPendingQuickActions] = useState<QuickActionType[]>([]);
  const [discussedEdgeCases, setDiscussedEdgeCases] = useState<EdgeCase[]>([]);
  const [showEdgeCaseSelector, setShowEdgeCaseSelector] = useState(false);
  
  // AUTHORITATIVE WORKFLOW DRAFT - Single source of truth for the current workflow
  // This replaces message-embedded workflow ownership. Preview/Create always use this.
  const [currentWorkflowDraft, setCurrentWorkflowDraft] = useState<WorkflowDraft | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { toast } = useToast();
  const aiClient = useAi();
  const promptContextStore = usePromptContextStore();
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
      
      // Also save prompt transcript (user/assistant messages only, excluding welcome)
      const transcript = messages
        .filter(msg => msg.role !== 'system' && msg.id !== 'welcome')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
      
      if (transcript.length > 0) {
        const transcriptKey = `kiteframe-prompt-transcript-${projectId}`;
        localStorage.setItem(transcriptKey, JSON.stringify(transcript));
      }
    } catch {
    }
  }, [messages, storageKey, projectId]);
  
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

  // Handle initial prompt injection from Home Prompt
  // Uses the shared handleSend function to maintain single source of truth
  const initialPromptProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    // Reset processed ref when prompt is cleared (allows subsequent submissions)
    if (!initialPrompt) {
      initialPromptProcessedRef.current = null;
      return;
    }
    
    // Skip if this exact prompt was already processed or if currently loading
    if (initialPromptProcessedRef.current === initialPrompt || isLoading) {
      return;
    }
    
    // Mark this prompt as being processed
    initialPromptProcessedRef.current = initialPrompt;
    
    // Consume attachments from PromptContextStore if any
    // This ensures Home Prompt attachments are carried through to KiteAI Chat
    let filesToSend: File[] = [];
    if (promptContextStore) {
      const storeAttachments = promptContextStore.context.attachments;
      if (storeAttachments.length > 0) {
        // Extract File objects from attachments to pass synchronously to handleSend
        filesToSend = storeAttachments
          .filter(a => a.file && a.status === 'ready')
          .map(a => a.file!);
      }
    }
    
    // Call the shared handleSend with the initial prompt and files
    // This ensures identical behavior to typing in the chat input
    // Use finally to guarantee cleanup even on failure
    handleSend(initialPrompt, filesToSend.length > 0 ? filesToSend : undefined).finally(() => {
      // Clear the store after successful consumption
      if (promptContextStore && filesToSend.length > 0) {
        promptContextStore.clearStore();
      }
      onInitialPromptConsumed?.();
    });
  }, [initialPrompt, isLoading, onInitialPromptConsumed, promptContextStore]);

  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

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

  // Shared message sending function - accepts optional message override and files for programmatic calls
  const handleSend = async (messageOverride?: string, filesOverride?: File[]) => {
    const messageContent = messageOverride ?? inputValue;
    const filesToProcess = filesOverride ?? pendingFiles;
    const hasPendingFiles = filesToProcess.length > 0;
    
    if (!messageContent.trim() && !hasPendingFiles) return;
    
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

    for (const file of filesToProcess) {
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
      content: messageContent,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
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
        const file = filesToProcess.find(f => f.type.startsWith('image/'));
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
        userMessage: messageContent,
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

      const router = getRouter();
      const response = await router.chat({
        taskType: 'general_chat',
        messages: [
          { role: 'system', content: enhancedPrompt },
          ...conversationHistory,
          { role: 'user', content: messageContent }
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
            // Keep workflowProposal for message history/display only
            workflowProposal = {
              nodes: parsed.nodes,
              edges: parsed.edges,
              description: 'AI-generated workflow',
              status: 'pending'
            };
            
            // SET AUTHORITATIVE WORKFLOW DRAFT - Single source of truth
            setCurrentWorkflowDraft({
              nodes: parsed.nodes,
              edges: parsed.edges,
              status: 'draft',
              originPrompt: messageContent
            });
            
            // Analyze workflow diagnostics for quick action suggestions
            const diagnostics = analyzeWorkflowDiagnostics({
              nodes: parsed.nodes.map((n: Node) => ({
                id: n.id,
                type: n.type,
                label: (n.data as any)?.label
              })),
              edges: parsed.edges.map((e: Edge) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: (e.data as any)?.label
              }))
            });
            
            // Set workflow generation state and suggested quick actions
            const suggestedActions = getSuggestedQuickActions(diagnostics);
            setWorkflowGenState('BASELINE_GENERATED');
            setPendingQuickActions(suggestedActions);
            
            responseText = response.text.replace(jsonMatch[0], '').trim();
            if (!responseText) {
              // Use the AI response template for baseline generation
              responseText = AI_RESPONSE_TEMPLATES.BASELINE_GENERATED;
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

  // UPDATED: Accept uses currentWorkflowDraft (authoritative), not message.workflowProposal
  // In fullscreen mode, calls onCreateWorkflow to create project and navigate
  // In panel/floating mode, calls onApplyWorkflow to apply to existing canvas
  const handleAcceptWorkflow = () => {
    if (!currentWorkflowDraft) return;

    // Fullscreen mode: create project via callback (no canvas exists yet)
    if (mode === 'fullscreen' && onCreateWorkflow) {
      // Include transcript in the draft so it can be saved with the new project
      const transcript = messages
        .filter(msg => msg.role !== 'system' && msg.id !== 'welcome')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));
      
      onCreateWorkflow({
        ...currentWorkflowDraft,
        transcript: transcript.length > 0 ? transcript : undefined
      });
      // Clear state after handing off to shell
      setCurrentWorkflowDraft(null);
      setWorkflowGenState(null);
      setPendingQuickActions([]);
      return;
    }

    // Panel/floating mode: apply to existing canvas
    if (!onApplyWorkflow) return;

    onApplyWorkflow({
      nodes: currentWorkflowDraft.nodes,
      edges: currentWorkflowDraft.edges,
      canvasObjects: currentWorkflowDraft.canvasObjects
    });

    // Clear the draft after applying
    setCurrentWorkflowDraft(null);
    setWorkflowGenState(null);
    setPendingQuickActions([]);

    toast({
      title: "Workflow Created",
      description: `Added ${currentWorkflowDraft.nodes.length} nodes to your canvas.`
    });
  };

  // UPDATED: Reject clears currentWorkflowDraft (authoritative)
  const handleRejectWorkflow = () => {
    setCurrentWorkflowDraft(null);
    setWorkflowGenState(null);
    setPendingQuickActions([]);
    setDiscussedEdgeCases([]);
    setShowEdgeCaseSelector(false);
    
    toast({
      title: "Workflow Discarded",
      description: "The workflow draft has been cleared."
    });
  };

  // UPDATED: Quick actions now use currentWorkflowDraft (authoritative)
  const handleQuickAction = useCallback(async (action: QuickActionType) => {
    if (!currentWorkflowDraft) return;
    
    setIsLoading(true);
    
    try {
      switch (action) {
        case 'HAPPY_PATH_ONLY':
          // User chose to keep happy path only - just confirm and clear quick actions
          setPendingQuickActions([]);
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            role: 'assistant',
            content: AI_RESPONSE_TEMPLATES.HAPPY_PATH_CONFIRMED,
            timestamp: new Date()
          }]);
          break;
          
        case 'INCLUDE_EDGE_CASES':
          // Call AI to expand workflow with edge cases
          toast({ title: 'Expanding workflow', description: 'Adding edge and failure cases...' });
          
          const router1 = getRouter();
          const expandResponse = await router1.chat({
            taskType: 'workflow_reasoning',
            messages: [
              { role: 'system', content: AI_WORKFLOW_EXPAND_EDGE_CASES_PROMPT },
              { role: 'user', content: `Original prompt: ${currentWorkflowDraft.originPrompt || 'Workflow expansion'}\n\nCurrent workflow:\n${JSON.stringify({ nodes: currentWorkflowDraft.nodes, edges: currentWorkflowDraft.edges }, null, 2)}` }
            ],
            temperature: 0.5,
            maxTokens: 4000
          });
          
          const expandedJson = expandResponse.text.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);
          if (expandedJson) {
            try {
              const parsed = JSON.parse(expandedJson[0].replace(/,(\s*[}\]])/g, '$1'));
              if (parsed.nodes && parsed.edges) {
                // REPLACE the draft with expanded workflow
                setCurrentWorkflowDraft({
                  nodes: parsed.nodes,
                  edges: parsed.edges,
                  status: 'expanded',
                  originPrompt: currentWorkflowDraft.originPrompt
                });
                setWorkflowGenState('EXPANDED_WITH_EDGE_CASES');
                setPendingQuickActions([]);
                setMessages(prev => [...prev, {
                  id: `system-${Date.now()}`,
                  role: 'assistant',
                  content: AI_RESPONSE_TEMPLATES.EXPANDED_WITH_EDGE_CASES,
                  timestamp: new Date()
                }]);
              }
            } catch (e) {
              console.error('Failed to parse expanded workflow:', e);
              throw new Error('Failed to parse AI response');
            }
          }
          break;
          
        case 'DISCUSS_EDGE_CASES':
          // Call AI to list edge cases for discussion
          toast({ title: 'Analyzing edge cases', description: 'Identifying potential failure paths...' });
          
          const router2 = getRouter();
          const listResponse = await router2.chat({
            taskType: 'workflow_reasoning',
            messages: [
              { role: 'system', content: AI_WORKFLOW_LIST_EDGE_CASES_PROMPT },
              { role: 'user', content: `Original prompt: ${currentWorkflowDraft.originPrompt || 'Workflow'}\n\nCurrent workflow:\n${JSON.stringify({ nodes: currentWorkflowDraft.nodes, edges: currentWorkflowDraft.edges }, null, 2)}` }
            ],
            temperature: 0.5,
            maxTokens: 1500
          });
          
          const edgeCasesJson = listResponse.text.match(/\{[\s\S]*"edgeCases"[\s\S]*\}/);
          if (edgeCasesJson) {
            try {
              const parsed = JSON.parse(edgeCasesJson[0].replace(/,(\s*[}\]])/g, '$1'));
              if (parsed.edgeCases && Array.isArray(parsed.edgeCases)) {
                setDiscussedEdgeCases(parsed.edgeCases);
                setWorkflowGenState('DISCUSSING_EDGE_CASES');
                setPendingQuickActions([]);
                setMessages(prev => [...prev, {
                  id: `system-${Date.now()}`,
                  role: 'assistant',
                  content: AI_RESPONSE_TEMPLATES.DISCUSSING_EDGE_CASES,
                  timestamp: new Date()
                }]);
              }
            } catch (e) {
              console.error('Failed to parse edge cases:', e);
              throw new Error('Failed to parse AI response');
            }
          }
          break;
          
        case 'SELECT_EDGE_CASES':
          setShowEdgeCaseSelector(true);
          break;
      }
    } catch (error) {
      console.error('Quick action error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to process quick action',
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkflowDraft, aiClient, toast]);

  // UPDATED: Edge case selection uses currentWorkflowDraft (authoritative)
  const handleEdgeCaseSelection = useCallback(async (selectedIds: string[]) => {
    if (!currentWorkflowDraft) return;
    
    setShowEdgeCaseSelector(false);
    setIsLoading(true);
    
    try {
      const selectedCases = discussedEdgeCases.filter(ec => selectedIds.includes(ec.id));
      toast({ 
        title: 'Applying edge cases', 
        description: `Adding ${selectedCases.length} edge case${selectedCases.length > 1 ? 's' : ''} to workflow...` 
      });
      
      // Call AI to expand with selected edge cases
      const router3 = getRouter();
      const selectResponse = await router3.chat({
        taskType: 'workflow_reasoning',
        messages: [
          { role: 'system', content: AI_WORKFLOW_EXPAND_SELECTED_EDGE_CASES_PROMPT },
          { role: 'user', content: `Original prompt: ${currentWorkflowDraft.originPrompt || 'Workflow'}\n\nCurrent workflow:\n${JSON.stringify({ nodes: currentWorkflowDraft.nodes, edges: currentWorkflowDraft.edges }, null, 2)}\n\nSelected edge cases to include:\n${selectedCases.map(c => `- ${c.label}`).join('\n')}` }
        ],
        temperature: 0.5,
        maxTokens: 4000
      });
      
      const expandedJson = selectResponse.text.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);
      if (expandedJson) {
        try {
          const parsed = JSON.parse(expandedJson[0].replace(/,(\s*[}\]])/g, '$1'));
          if (parsed.nodes && parsed.edges) {
            // REPLACE the draft with expanded workflow
            setCurrentWorkflowDraft({
              nodes: parsed.nodes,
              edges: parsed.edges,
              status: 'expanded',
              originPrompt: currentWorkflowDraft.originPrompt
            });
            setWorkflowGenState('SELECTED_EDGE_CASES_APPLIED');
            setDiscussedEdgeCases([]);
            setMessages(prev => [...prev, {
              id: `system-${Date.now()}`,
              role: 'assistant',
              content: AI_RESPONSE_TEMPLATES.SELECTED_EDGE_CASES_APPLIED,
              timestamp: new Date()
            }]);
          }
        } catch (e) {
          console.error('Failed to parse expanded workflow:', e);
          throw new Error('Failed to parse AI response');
        }
      }
    } catch (error) {
      console.error('Edge case selection error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to apply edge cases',
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkflowDraft, discussedEdgeCases, aiClient, toast]);

  // UPDATED: Preview uses currentWorkflowDraft (authoritative)
  const handlePreviewWorkflow = () => {
    if (!currentWorkflowDraft) return;

    const isCurrentlyPreviewing = showDiffPreview !== null;
    setShowDiffPreview(isCurrentlyPreviewing ? null : 'draft');
    
    if (onPreviewWorkflow) {
      if (isCurrentlyPreviewing) {
        onPreviewWorkflow(null);
      } else {
        onPreviewWorkflow({
          nodes: currentWorkflowDraft.nodes,
          edges: currentWorkflowDraft.edges
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
                  
                  <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                                    <ReactMarkdown
                                      components={{
                                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                        ul: ({ children }) => <ul className="list-disc list-inside my-1">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal list-inside my-1">{children}</ol>,
                                        li: ({ children }) => <li className="my-0.5">{children}</li>,
                                        code: ({ children, className }) => {
                                          if (className === 'language-json') return null;
                                          return <code className="px-1 py-0.5 bg-muted rounded text-xs">{children}</code>;
                                        },
                                        pre: ({ children, ...props }) => {
                                          const codeChild = (children as any)?.props;
                                          if (codeChild?.className === 'language-json') return null;
                                          return <pre className="bg-muted/50 p-2 rounded text-xs overflow-x-auto my-1" {...props}>{children}</pre>;
                                        },
                                      }}
                                    >
                                      {message.content.replace(/```json[\s\S]*?```/g, '').trim()}
                                    </ReactMarkdown>
                                  </div>
                  
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
                  
                  {/* Workflow proposal display (informational only - shows what was generated at this message) */}
                  {message.workflowProposal && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <Badge variant="secondary" className="text-xs">
                        Generated: {message.workflowProposal.nodes.length} nodes, {message.workflowProposal.edges.length} edges
                      </Badge>
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

      {/* AUTHORITATIVE WORKFLOW DRAFT ACTIONS - Always visible when draft exists */}
      {currentWorkflowDraft && (
        <div className="p-3 border-t border-border bg-muted/30 space-y-3">
          {/* Draft status badge */}
          <div className="flex items-center justify-between">
            <Badge variant={currentWorkflowDraft.status === 'expanded' ? 'default' : 'secondary'} className="text-xs">
              {currentWorkflowDraft.status === 'expanded' ? '✓ Expanded' : 'Draft'}: {currentWorkflowDraft.nodes.length} nodes, {currentWorkflowDraft.edges.length} edges
            </Badge>
            {showDiffPreview && (
              <span className="text-xs text-muted-foreground">Preview active</span>
            )}
          </div>
          
          {/* Diff preview for currentWorkflowDraft */}
          {showDiffPreview && renderDiffPreview({
            nodes: currentWorkflowDraft.nodes,
            edges: currentWorkflowDraft.edges,
            status: 'pending'
          })}
          
          {/* Preview/Create/Reject buttons - always bound to currentWorkflowDraft */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreviewWorkflow}
              className="flex-1 h-8 text-xs"
              data-testid="button-preview-workflow-draft"
            >
              <Eye className="w-3 h-3 mr-1" />
              {showDiffPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleAcceptWorkflow}
              className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
              data-testid="button-create-workflow-draft"
              disabled={!isWorkflowValidForCreation({ 
                nodes: currentWorkflowDraft.nodes.map(n => ({
                  id: n.id,
                  type: n.type || 'process',
                  label: (n.data as any)?.label
                })),
                edges: currentWorkflowDraft.edges.map(e => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  label: (e.data as any)?.label
                }))
              })}
            >
              <Check className="w-3 h-3 mr-1" />
              Create Workflow
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRejectWorkflow}
              className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
              data-testid="button-reject-workflow-draft"
            >
              <XCircle className="w-3 h-3" />
            </Button>
          </div>
          
          {/* Quick Actions for workflow expansion - uses currentWorkflowDraft */}
          {workflowGenState === 'BASELINE_GENERATED' && pendingQuickActions.length > 0 && (
            <QuickActions
              actions={pendingQuickActions}
              onAction={handleQuickAction}
              disabled={isLoading}
            />
          )}
          
          {/* Discussion mode quick actions */}
          {workflowGenState === 'DISCUSSING_EDGE_CASES' && (
            <DiscussionQuickActions
              onStickWithHappyPath={() => handleQuickAction('HAPPY_PATH_ONLY')}
              onMapAllEdgeCases={() => handleQuickAction('INCLUDE_EDGE_CASES')}
              onSelectEdgeCases={() => setShowEdgeCaseSelector(true)}
              disabled={isLoading}
            />
          )}
          
          {/* Edge case selector */}
          {showEdgeCaseSelector && discussedEdgeCases.length > 0 && (
            <EdgeCaseSelector
              edgeCases={discussedEdgeCases}
              onSubmit={handleEdgeCaseSelection}
              onCancel={() => setShowEdgeCaseSelector(false)}
              disabled={isLoading}
            />
          )}
        </div>
      )}

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
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyPress}
                placeholder="Describe your workflow..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none py-2"
                disabled={isLoading}
                rows={1}
                data-testid="input-kiteai-message"
              />
              <ChatSendButton
                onClick={() => handleSend()}
                disabled={!inputValue.trim() && pendingFiles.length === 0}
                isLoading={isLoading}
                className="flex-shrink-0"
                data-testid="button-kiteai-send"
              />
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

interface DiscussionViewProps {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
}

function DiscussionView({
  projectId,
  nodes,
  edges,
  canvasObjects
}: DiscussionViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    id: 'discussion-welcome',
    role: 'assistant',
    content: "Welcome to the discussion view. I can help you understand this workflow, identify potential edge cases, suggest improvements, or discuss missing steps.\n\nWhat would you like to discuss about this workflow?",
    timestamp: new Date()
  }]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { toast } = useToast();
  const aiClient = useAi();
  
  const hasApiKey = Boolean(localStorage.getItem('openai_api_key'));
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  const buildWorkflowContext = useCallback(() => {
    const nodeDescriptions = nodes.map(n => {
      const label = n.data?.label || n.type || 'Node';
      return `- ${label} (${n.type})`;
    }).join('\n');
    
    const edgeDescriptions = edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      const sourceLabel = sourceNode?.data?.label || sourceNode?.type || 'Unknown';
      const targetLabel = targetNode?.data?.label || targetNode?.type || 'Unknown';
      return `- ${sourceLabel} → ${targetLabel}`;
    }).join('\n');
    
    return `Current workflow has ${nodes.length} nodes and ${edges.length} connections.

Nodes:
${nodeDescriptions}

Connections:
${edgeDescriptions}`;
  }, [nodes, edges]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      const workflowContext = buildWorkflowContext();
      const systemPrompt = `You are a helpful workflow analyst assistant. You are helping someone understand a workflow diagram they are viewing in read-only mode.

IMPORTANT: This is a discussion-only mode. You can:
- Explain what the workflow does
- Identify potential edge cases or missing steps
- Discuss improvements or alternatives
- Answer questions about the workflow design

You CANNOT:
- Propose changes to the workflow
- Generate new workflow nodes or edges
- Provide JSON workflow data

Always be helpful and constructive in your analysis.

${workflowContext}`;

      const conversationHistory = messages
        .filter(m => m.role !== 'system' && m.id !== 'discussion-welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      
      conversationHistory.push({ role: 'user', content: userMessage.content });
      
      const router4 = getRouter();
      const response = await router4.chat({
        taskType: 'general_chat',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ]
      });
      
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content: response?.text || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, messages, buildWorkflowContext, toast]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <MessageCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">KiteAI Discussion</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-[280px]">
          To discuss this workflow with KiteAI, you'll need to configure an AI provider in the main editor first.
        </p>
        <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground max-w-[280px]">
          <p className="font-medium mb-1">To enable AI features:</p>
          <ol className="list-decimal list-inside space-y-1 text-left">
            <li>Open the KiteFrame editor</li>
            <li>Go to KiteAI settings</li>
            <li>Add your API key</li>
            <li>Return to this shared view</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="discussion-view">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <Eye className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium">Discussion Mode</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">Read Only</Badge>
      </div>
      
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the workflow..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            disabled={isLoading}
            data-testid="input-discussion"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="h-10 w-10 flex-shrink-0"
            data-testid="button-send-discussion"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
          </Button>
        </div>
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
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

export function KiteAIChatPanel({
  projectId,
  nodes,
  edges,
  canvasObjects,
  onApplyWorkflow,
  onPreviewWorkflow,
  initialPrompt,
  onInitialPromptConsumed
}: KiteAIChatPanelProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <KiteAIChatBrain
        mode="panel"
        projectId={projectId}
        nodes={nodes}
        edges={edges}
        canvasObjects={canvasObjects}
        onApplyWorkflow={onApplyWorkflow}
        onPreviewWorkflow={onPreviewWorkflow}
        initialPrompt={initialPrompt}
        onInitialPromptConsumed={onInitialPromptConsumed}
      />
    </div>
  );
}

interface KiteAIDiscussionPanelProps {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
}

export function KiteAIDiscussionPanel({
  projectId,
  nodes,
  edges,
  canvasObjects
}: KiteAIDiscussionPanelProps) {
  return (
    <div className="flex h-full w-full flex-col">
      <DiscussionView
        projectId={projectId}
        nodes={nodes}
        edges={edges}
        canvasObjects={canvasObjects}
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
              <KiteAIChatBrain
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
