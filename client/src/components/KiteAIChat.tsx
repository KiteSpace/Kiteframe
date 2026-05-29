import { useState, useRef, useEffect, useLayoutEffect, useCallback, MouseEvent, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import { useCreditsGate } from '@/hooks/useCreditsGate';
import { useAuth } from '@/hooks/useAuth';
import { getQueryFn } from '@/lib/queryClient';
import type { Node, Edge, CanvasObject } from '../lib/kiteframe/types';
import { type AiMode, DEFAULT_AI_MODE, AI_MODE_LABELS } from '../ai/types';
import { selectKiteRole, getRoleLabel, type KiteRole, type RoleContext } from '../ai/roleSelector';
import { computeConfidence, isConfidenceInsufficient } from '../ai/confidenceScoring';
import { getSystemPromptForRole } from '../ai/systemPrompts';
import { computeWorkflowMaturity, type WorkflowMaturity } from '../ai/workflowMaturity';
import { detectWorkflowGroups, type WorkflowGroup } from '../utils/workflowGroups';
import { MAX_CANVAS_NODES, CANVAS_NODE_WARNING_THRESHOLD, LARGE_WORKFLOW_WARNING_THRESHOLD } from '@/lib/constants';
import { generateFollowUps, shouldAskFollowUps } from '../ai/followUpGenerator';
import type { VisionRole } from '../ai/workflow/visionPipeline';
import { 
  buildKiteAIContext, 
  getRoleDisplayInfo,
  type KiteAIRole 
} from '../lib/ai/buildKiteAIContext';
import { inferKiteAIRole } from '../lib/ai/inferKiteAIRole';
import { ChatSendButton, ChatMessageList } from '@/components/chat';
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
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { QuickActions, DiscussionQuickActions } from '@/components/QuickActions';
import { EdgeCaseSelector, type EdgeCase } from '@/components/EdgeCaseSelector';
import { 
  analyzeWorkflowDiagnostics, 
  getSuggestedQuickActions, 
  isWorkflowValidForCreation,
  captureDiagnosticBaseline,
  computeDiagnosticDelta,
  filterDiagnosticsByMode,
  type QuickActionType,
  type DiagnosticsContext,
  type DiagnosticsMode,
  type DiagnosticBaseline
} from '@/utils/workflowDiagnostics';
import { 
  AI_RESPONSE_TEMPLATES, 
  QUICK_ACTION_LABELS,
  AI_WORKFLOW_EXPAND_EDGE_CASES_PROMPT,
  AI_WORKFLOW_LIST_EDGE_CASES_PROMPT,
  AI_WORKFLOW_EXPAND_SELECTED_EDGE_CASES_PROMPT
} from '@/constants/aiWorkflowExpansionPrompts';
import { 
  parseWorkflowProposal, 
  parseEdgeCases,
  type ProposalParseResult,
  type EdgeCaseParseResult
} from '@/ai/proposalParser';
import { usePromptContextStore } from '@/contexts/PromptContextStore';
import { useAiJobs } from '@/contexts/AiJobsContext';
import { useKiteAIConversation, type ProcessInputResult } from '@/hooks/useKiteAIConversation';
import { useFeatureFlag } from '@/contexts/FeatureFlagContext';
import { 
  detectMergeBranchIntent, 
  resolveIntent, 
  isAmbiguous,
  type MergeBranchDecision 
} from '@/ai/intent/mergeBranchDetector';
import { logAiInteraction, logAiStability, type AiStabilityMetrics } from '@/ai/aiTelemetry';
import {
  createFixScope,
  validateFixScope,
  validateProposalSchema,
  validateEditFirstHeuristic,
  type FixScope,
  type ProposalResponse,
  type ProposalValidationResult
} from '@/ai/proposalValidation';
import { computeWorkflowDelta, computeDetailedWorkflowDelta } from '@/utils/workflowDiff';

// Phase 7 feature flag keys
const FLAG_UNIFIED_ENGINE = 'ai.unifiedConversationEngine';
const FLAG_PM_DEPTH_GUARDS = 'ai.pmDepthGuardsChat';
const FLAG_CLARIFICATION_LOOPS = 'ai.clarificationLoopsChat';

// Phase 6.5 feature flag key
const FLAG_MERGE_BRANCH_HEURISTIC = 'ai.mergeBranchHeuristic';

// AI Stabilization feature flag
const FLAG_AI_STABILIZATION = 'ai.stabilizationGuardrails';

// Message type categorization for unified workflow draft model
export type MessageType = 
  | 'user_prompt'
  | 'workflow_generated'   // First baseline workflow created
  | 'workflow_expanded'    // Workflow modified via quick action
  | 'discussion'           // Clarifying questions or edge case listing
  | 'edge_case_selector'   // Inline edge case picker card
  | 'edge_case_selected'   // Confirmed selection summary card
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
    edgeCases?: EdgeCase[];
    selectedEdgeCases?: EdgeCase[];
    preSelectedIds?: string[];
  };
  followUps?: string[];
  workflowChips?: { id: string; label: string; nodeCount: number }[];
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
  mergeBranchDecision?: MergeBranchDecision;
}

export interface ApplyWorkflowPayload {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  mergeBranchDecision?: MergeBranchDecision;
  aiMode?: AiMode;
  bypassConfirmation?: boolean;
  nonDestructive?: boolean;
  selectedGroupLabel?: string;
}

export interface ReplaceWorkflowPayload {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
}

interface KiteAIChatBrainProps {
  projectId?: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  onApplyWorkflow?: (workflow: ApplyWorkflowPayload) => void;
  onReplaceWorkflow?: (workflow: ReplaceWorkflowPayload) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
  mode: 'panel' | 'floating' | 'fullscreen';
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
  onCreateWorkflow?: (draft: WorkflowDraft) => void;
}

const WORKFLOW_GENERATION_SIGNALS = [
  'workflow', 'flow', 'diagram', 'create', 'build', 'make', 'generate',
  'design', 'map out', 'map the', 'add', 'cleanup', 'clean up', 'fix',
  'improve', 'update', 'redesign', 'rebuild', 'redo', 'expand', 'extend',
  'full', 'complete', 'entire', 'all', 'teardown', 'tear down', 'setup',
  'set up', 'fill in', 'fill out', 'flesh out', 'missing', 'gaps',
];

export function KiteAIChatBrain({ 
  projectId,
  nodes: currentNodes, 
  edges: currentEdges, 
  canvasObjects: currentCanvasObjects,
  onApplyWorkflow,
  onReplaceWorkflow,
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
  
  const [aiMode] = useState<AiMode>(DEFAULT_AI_MODE); // Phase 4: Toggle removed, defaults to EDIT
  
  // Workflow generation state for assertive first-turn generation
  type WorkflowGenState = 'BASELINE_GENERATED' | 'EXPANDED_WITH_EDGE_CASES' | 'DISCUSSING_EDGE_CASES' | 'SELECTED_EDGE_CASES_APPLIED' | null;
  const [workflowGenState, setWorkflowGenState] = useState<WorkflowGenState>(null);
  const [pendingQuickActions, setPendingQuickActions] = useState<QuickActionType[]>([]);
  const [discussedEdgeCases, setDiscussedEdgeCases] = useState<EdgeCase[]>([]);
  
  // Phase Lock: Prevent multiple mutating expansions per proposal lifecycle
  // After first expansion, user must explicitly confirm to mutate again
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);
  const [mutationApproved, setMutationApproved] = useState(false);
  
  // AUTHORITATIVE WORKFLOW DRAFT - Single source of truth for the current workflow
  // This replaces message-embedded workflow ownership. Preview/Create always use this.
  const [currentWorkflowDraft, setCurrentWorkflowDraft] = useState<WorkflowDraft | null>(null);
  
  const [selectedWorkflowGroup, setSelectedWorkflowGroup] = useState<WorkflowGroup | null>(null);
  const selectedWorkflowGroupRef = useRef<WorkflowGroup | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);

  // Optimization session: tracks a server-side session ID so that multi-turn refinements
  // within one optimization conversation only consume a single credit.
  // Cleared on accept, dismiss, or canvas cap block.
  const [optimizationSessionId, setOptimizationSessionId] = useState<string | null>(null);

  // Inline warning shown when the user clicks "Change" while a draft is pending.
  // Replaced with a two-step "Your current suggestion will be discarded. Confirm?" flow
  // rather than a modal, per design spec.
  const [showChangeWarning, setShowChangeWarning] = useState(false);

  // Dismissible quality notice shown when the active canvas has > LARGE_WORKFLOW_WARNING_THRESHOLD nodes.
  // Session-only — reappears on next page load. Never shown in fullscreen mode.
  const [showLargeWorkflowBanner, setShowLargeWorkflowBanner] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    openCreditsDialog
  } = useCreditsGate();
  
  // Phase 7: Unified Conversation Engine integration
  // Feature flags for behavioral control
  const { enabled: unifiedEngineEnabled } = useFeatureFlag(FLAG_UNIFIED_ENGINE);
  const { enabled: pmDepthGuardsEnabled } = useFeatureFlag(FLAG_PM_DEPTH_GUARDS);
  const { enabled: clarificationLoopsEnabled } = useFeatureFlag(FLAG_CLARIFICATION_LOOPS);
  
  // Phase 6.5: Merge/Branch Heuristic
  const { enabled: mergeBranchHeuristicEnabled } = useFeatureFlag(FLAG_MERGE_BRANCH_HEURISTIC);
  
  // AI Stabilization Guardrails (Part 1-6)
  const { enabled: aiStabilizationEnabled } = useFeatureFlag(FLAG_AI_STABILIZATION);
  
  // Baseline diagnostics ref - captured before AI generates/modifies workflow
  const baselineDiagnosticsRef = useRef<DiagnosticBaseline | null>(null);
  
  // Initialize the canonical conversation engine
  // Map surface context to KiteAIMode: home → 'base', project → 'designer'
  const surfaceContext = mode === 'fullscreen' ? 'home' : 'project';
  const initialMode = surfaceContext === 'home' ? 'base' : 'designer';
  const conversation = useKiteAIConversation(initialMode);
  
  // Store last actionability result for logging/annotation
  const lastActionabilityRef = useRef<ProcessInputResult | null>(null);
  
  // Track surface and project changes
  const prevSurfaceRef = useRef(surfaceContext);
  const prevProjectRef = useRef(projectId);
  
  // Sync conversation mode and reset state when surface/project changes
  useEffect(() => {
    if (!unifiedEngineEnabled) return;
    
    const targetMode = surfaceContext === 'home' ? 'base' : 'designer';
    
    // Reset and update mode when switching surfaces or projects
    if (prevSurfaceRef.current !== surfaceContext || prevProjectRef.current !== projectId) {
      console.log(`[Phase7] Surface changed: ${prevSurfaceRef.current} → ${surfaceContext}, mode: ${targetMode}, projectId: ${projectId}`);
      conversation.resetWithMode(targetMode);
      prevSurfaceRef.current = surfaceContext;
      prevProjectRef.current = projectId;
    }
  }, [surfaceContext, projectId, unifiedEngineEnabled, conversation]);
  
  // Log workflow context for observability
  useEffect(() => {
    if (!unifiedEngineEnabled) return;
    
    const workflowContext = {
      surface: surfaceContext,
      mode: surfaceContext === 'home' ? 'base' : 'designer',
      projectId,
      nodeCount: currentNodes.length,
      edgeCount: currentEdges.length,
      hasCanvas: currentNodes.length > 0,
    };
    console.log('[Phase7] Workflow context:', workflowContext);
  }, [surfaceContext, projectId, currentNodes.length, currentEdges.length, unifiedEngineEnabled]);
  
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
      
      // NOTE: We intentionally do NOT save to kiteframe-prompt-transcript here.
      // The prompt transcript is ONLY for pre-project conversations from FullScreenChat.
      // In-project chat messages are stored in kiteframe-kiteai-chat and shown separately
      // in the Notes tab as "In-Project Chat". Saving to both would cause duplicates.
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

  // Remount handoff: claim any AI jobs that completed at this route while the
  // chat surface was unmounted (e.g. user navigated to another tab waiting for
  // a long PRD generation). Their results are injected as assistant messages
  // so no work is silently lost.
  const { takeCompletedJobsForOrigin, markConsumed: markJobConsumedRaw } = useAiJobs();
  // Mounted ref so we only acknowledge consumption when the surface is still
  // alive after the await. If the user navigated away mid-request, we leave the
  // result in completedJobs for remount handoff to pick up.
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);
  const markJobConsumed = useCallback((jobId: string) => {
    if (isMountedRef.current) markJobConsumedRaw(jobId);
  }, [markJobConsumedRaw]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originPath = window.location.pathname;
    const completed = takeCompletedJobsForOrigin(originPath);
    if (completed.length === 0) return;
    setMessages(prev => [
      ...prev,
      ...completed.map(job => ({
        id: `recovered-${job.jobId}`,
        role: 'assistant' as const,
        content: job.status === 'completed'
          ? (job.text || '')
          : `(Background AI operation "${job.label}" failed: ${job.error || 'unknown error'})`,
        timestamp: new Date(job.completedAt),
      })),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
    if (mode === 'panel') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // Handle initial prompt injection from Home Prompt
  // Uses the shared handleSend function to maintain single source of truth
  const initialPromptProcessedRef = useRef<string | null>(null);
  const attachmentsProcessedRef = useRef(false);
  
  // Compute ready attachments count for dependency tracking
  const readyAttachmentsCount = useMemo(() => {
    const attachments = promptContextStore?.context.attachments || [];
    return attachments.filter(a => a.file && a.status === 'ready').length;
  }, [promptContextStore?.context.attachments]);
  
  // Reset attachmentsProcessedRef when attachments are cleared (for repeat usage)
  useEffect(() => {
    if (readyAttachmentsCount === 0) {
      attachmentsProcessedRef.current = false;
    }
  }, [readyAttachmentsCount]);
  
  // Handle attachments-only case (when user uploads image without text)
  // This runs once when component mounts in fullscreen mode with attachments
  useEffect(() => {
    // Only handle attachments-only in fullscreen mode (from home page)
    if (mode !== 'fullscreen') return;
    // Skip if we already processed attachments or there's an initial prompt
    if (attachmentsProcessedRef.current || initialPrompt) return;
    // Skip if loading or no ready attachments
    if (isLoading || readyAttachmentsCount === 0) return;
    
    const storeAttachments = promptContextStore?.context.attachments || [];
    console.log('[KiteAIChat] Checking for attachments-only case:', {
      mode,
      hasInitialPrompt: !!initialPrompt,
      attachmentCount: storeAttachments.length,
      readyCount: readyAttachmentsCount
    });
    
    const readyAttachments = storeAttachments.filter(a => a.file && a.status === 'ready');
    const filesToSend = readyAttachments.map(a => a.file!);
    
    if (filesToSend.length > 0) {
      console.log('[KiteAIChat] Processing attachments-only (no text prompt):', filesToSend.length);
      attachmentsProcessedRef.current = true;
      
      // Generate a default message for image analysis
      const defaultMessage = 'Analyze this workflow diagram and create a workflow based on what you see.';
      
      handleSend(defaultMessage, filesToSend).finally(() => {
        promptContextStore?.clearStore();
        onInitialPromptConsumed?.();
      });
    }
  }, [mode, initialPrompt, isLoading, readyAttachmentsCount, onInitialPromptConsumed]);
  
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
    
    // Save the initial prompt to the prompt transcript immediately
    // This captures the "pre-project" conversation from the home page
    // Regular in-project chat is saved separately to kiteai-chat storage
    if (projectId) {
      const transcriptKey = `kiteframe-prompt-transcript-${projectId}`;
      const existingTranscript = localStorage.getItem(transcriptKey);
      
      // Only save if there's no existing transcript (to preserve FullScreenChat transcript)
      if (!existingTranscript) {
        const promptTranscript = [{ role: 'user' as const, content: initialPrompt }];
        localStorage.setItem(transcriptKey, JSON.stringify(promptTranscript));
      }
    }
    
    // Consume attachments from PromptContextStore if any
    // This ensures Home Prompt attachments are carried through to KiteAI Chat
    let filesToSend: File[] = [];
    if (promptContextStore) {
      const storeAttachments = promptContextStore.context.attachments;
      console.log('[KiteAIChat] Checking PromptContextStore attachments (with prompt):', {
        count: storeAttachments.length,
        attachments: storeAttachments.map(a => ({
          id: a.id,
          type: a.type,
          displayName: a.displayName,
          hasFile: !!a.file,
          fileType: a.file?.type,
          status: a.status
        }))
      });
      if (storeAttachments.length > 0) {
        // Extract File objects from attachments to pass synchronously to handleSend
        filesToSend = storeAttachments
          .filter(a => a.file && a.status === 'ready')
          .map(a => a.file!);
        console.log('[KiteAIChat] Files extracted from store:', filesToSend.length);
        // Mark attachments as processed so the attachments-only effect doesn't also fire
        attachmentsProcessedRef.current = true;
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
  }, [initialPrompt, isLoading, onInitialPromptConsumed, promptContextStore, projectId]);

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

  const scopedNodes = useMemo(() => {
    if (!selectedWorkflowGroup) return currentNodes;
    return currentNodes.filter(n => selectedWorkflowGroup.nodeIds.has(n.id));
  }, [currentNodes, selectedWorkflowGroup]);

  const scopedEdges = useMemo(() => {
    if (!selectedWorkflowGroup) return currentEdges;
    return currentEdges.filter(e => selectedWorkflowGroup.edgeIds.has(e.id));
  }, [currentEdges, selectedWorkflowGroup]);

  const buildCanvasContext = useCallback(() => {
    if (scopedNodes.length === 0) {
      return "The canvas is currently empty.";
    }

    const nodeTypes = scopedNodes.reduce((acc, node) => {
      const type = node.type || 'process';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const nodeLabels = scopedNodes.map(n => n.data?.label || 'Unnamed').join(', ');
    
    let context = `Current workflow has ${scopedNodes.length} nodes (${Object.entries(nodeTypes).map(([t, c]) => `${c} ${t}`).join(', ')}) and ${scopedEdges.length} connections. Node labels: ${nodeLabels}`;
    if (selectedWorkflowGroup) {
      context = `Working on workflow: "${selectedWorkflowGroup.label}". ${context}`;
    }
    return context;
  }, [scopedNodes, scopedEdges, selectedWorkflowGroup]);

  // Shared message sending function - accepts optional message override and files for programmatic calls
  const handleSend = async (messageOverride?: string, filesOverride?: File[]) => {
    const messageContent = messageOverride ?? inputValue;
    const filesToProcess = filesOverride ?? pendingFiles;
    const hasPendingFiles = filesToProcess.length > 0;
    
    if (!messageContent.trim() && !hasPendingFiles) return;

    if (isOutOfCredits) {
      toast({
        title: 'Out of credits',
        description: "You've used all your daily credits. They'll reset in 24 hours.",
        variant: 'destructive',
      });
      if (ctaAction === 'signup') openSignup();
      else openCreditsDialog();
      return;
    }

    // Canvas cap guard — runs before any AI call or credit deduction.
    // Soft warning at CANVAS_NODE_WARNING_THRESHOLD (40+) — request continues.
    // Hard block at MAX_CANVAS_NODES (50+) — request is aborted.
    // NOTE: uses current node count only, not predicted output size; a 48-node canvas
    // shows a warning but the request still proceeds — see constants.ts for thresholds.
    if (mode !== 'fullscreen') {
      if (currentNodes.length >= MAX_CANVAS_NODES) {
        if (optimizationSessionId) {
          fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
          setOptimizationSessionId(null);
        }
        toast({
          title: "Canvas is full",
          description: "Your canvas has too many nodes to add another workflow. Clear some nodes or start a new project.",
          variant: "destructive",
        });
        return;
      }
      if (currentNodes.length >= CANVAS_NODE_WARNING_THRESHOLD) {
        toast({
          title: "Canvas getting large",
          description: `Your canvas has ${currentNodes.length} nodes — adding more may slow things down.`,
        });
      }
    }

    // Multi-workflow selection: if canvas has 2+ disconnected groups and no group
    // is selected yet, intercept workflow-related messages and ask which to work on
    if (mode !== 'fullscreen' && !selectedWorkflowGroup && !selectedWorkflowGroupRef.current && !hasPendingFiles) {
      const groups = detectWorkflowGroups(currentNodes, currentEdges);
      if (groups.length >= 2) {
        const lowerMsg = messageContent.toLowerCase();
        const isWorkflowRelated = WORKFLOW_GENERATION_SIGNALS.some(s => lowerMsg.includes(s)) ||
          /workflow|node|edge|process|flow|diagram/i.test(messageContent);
        if (isWorkflowRelated) {
          const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
          };
          const selectionMsg: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: 'Which workflow would you like to work on?',
            timestamp: new Date(),
            workflowChips: groups.map(g => ({ id: g.id, label: g.label, nodeCount: g.nodeCount })),
          };
          setMessages(prev => [...prev, userMsg, selectionMsg]);
          setPendingUserMessage(messageContent);
          setInputValue('');
          return;
        }
      }
    }

    // Phase 7: Unified Conversation Engine - run actionability scoring
    // V1 behavior: scoring is passive (log/annotate only, no blocking)
    if (unifiedEngineEnabled && messageContent.trim()) {
      const inputResult = conversation.processUserInput(messageContent);
      lastActionabilityRef.current = inputResult;
      
      // Log actionability for observability (V1: scoring only, no enforcement)
      console.log(`[Phase7] Surface: ${surfaceContext} | State: ${inputResult.newState} | Score: ${inputResult.actionability.score} | Confidence: ${inputResult.actionability.confidence.toFixed(2)}`);
      
      // PM depth guards (V1: warn-only when flag is OFF)
      if (!pmDepthGuardsEnabled && inputResult.actionability.score < 3) {
        console.warn(`[Phase7] PM depth guard: Low actionability score (${inputResult.actionability.score}) - would block if enabled`);
      }
      
      // Clarification loops (V1: dormant when flag is OFF)
      if (!clarificationLoopsEnabled && inputResult.newState === 'clarification') {
        console.log(`[Phase7] Clarification loop: State changed to clarification - would trigger if enabled`);
      }
    }

    const messageId = `msg-${Date.now()}`;
    const attachments: ChatMessage['attachments'] = [];

    for (const file of filesToProcess) {
      if (file.type.startsWith('image/')) {
        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => {
            console.error('[KiteAIChat] Failed to read image preview for', file.name);
            resolve('');
          };
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

    // Phase 7: Track attachments as conversation sources for unified vision pipeline
    if (unifiedEngineEnabled) {
      for (const attachment of attachments) {
        if (attachment.type === 'image') {
          conversation.addConversationSource('image', { name: attachment.name, preview: attachment.preview }, 0.8);
          console.log(`[Phase7] Added image source: ${attachment.name}`);
        }
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
      // Gate on the actual image file (not the preview): a failed preview read
      // must NOT cause us to silently skip analysis and fall through to text chat.
      const imageFiles = filesToProcess.filter(f => f.type.startsWith('image/'));
      console.log('[KiteAIChat] Image attachment check:', {
        hasImageAttachment: !!imageAttachment,
        preview: imageAttachment?.preview ? 'present' : 'missing',
        filesToProcessCount: filesToProcess.length,
        imageFilesInProcess: imageFiles.length
      });
      if (imageFiles.length > 0) {
        const file = imageFiles[0];
        console.log('[KiteAIChat] Attempting image analysis with file:', file?.name, file?.type, file?.size);
        if (file) {
          const formData = new FormData();
          formData.append('image', file);

          let response: Response;
          try {
            response = await fetch('/api/ai/analyze-workflow-image', {
              method: 'POST',
              body: formData,
            });
          } catch (networkError) {
            console.error('[KiteAIChat] Image analysis network error:', networkError);
            const e = new Error("I couldn't reach the image analysis service. Please check your connection and try again.");
            (e as any).userFacing = true;
            throw e;
          }

          if (response.ok) {
            const result = await response.json();
            console.log('[KiteAIChat] Image analysis result:', {
              success: result.success,
              confidence: result.confidence,
              canGenerate: result.canGenerate,
              nodeCount: result.nodes?.length || 0,
              edgeCount: result.edges?.length || 0
            });

            // If multiple images were attached, be explicit that only the first
            // is analyzed rather than silently dropping the rest.
            const multiImageNote = imageFiles.length > 1
              ? `\n\nNote: I analyzed the first image ("${file.name}"). I can only analyze one image at a time — send the others separately if you'd like them turned into workflows too.`
              : '';

            const extractedNodeCount = result.nodes?.length || 0;
            const hasExtractedWorkflow = extractedNodeCount > 0;

            let content = `I analyzed your workflow image with ${result.confidence}% confidence.\n\n${result.analysis}`;

            // Treat "canGenerate" OR "low confidence but a usable structure was
            // still extracted" as actionable, so the user always gets a clear
            // next step instead of just analysis text.
            const offerProposal = result.canGenerate || hasExtractedWorkflow;

            if (result.canGenerate) {
              content += `\n\nI was able to extract a workflow structure with ${extractedNodeCount} nodes and ${result.edges?.length || 0} connections. Use the buttons below to preview or apply this workflow to your canvas.`;
            } else if (hasExtractedWorkflow) {
              content += `\n\nMy confidence is below the ${70}% threshold, so this is a best guess. I still pulled out ${extractedNodeCount} nodes and ${result.edges?.length || 0} connections — you can preview or apply it below and refine from there, or describe the workflow in text and I'll rebuild it more precisely.`;
            } else {
              content += `\n\nMy confidence is too low (${result.confidence}%) and I couldn't reliably pull a workflow out of this image. Try a clearer or higher-contrast diagram, or describe the workflow in text and I'll build it with you step by step.`;
            }

            if (offerProposal) {
              // SET AUTHORITATIVE WORKFLOW DRAFT for image analysis - enables Apply to Canvas buttons
              setCurrentWorkflowDraft({
                nodes: result.nodes,
                edges: result.edges,
                status: 'draft',
                originPrompt: messageContent,
                mergeBranchDecision: undefined,
              });

              // Analyze workflow diagnostics for quick action suggestions (edge cases, failure handling)
              const diagnostics = analyzeWorkflowDiagnostics({
                nodes: result.nodes.map((n: Node) => ({
                  id: n.id,
                  type: n.type,
                  label: (n.data as any)?.label
                })),
                edges: result.edges.map((e: Edge) => ({
                  id: e.id,
                  source: e.source,
                  target: e.target,
                  label: (e.data as any)?.label
                }))
              });

              // Set workflow generation state and suggested quick actions
              // In HOME proposal phase (fullscreen mode), always show edge/fail actions
              const diagnosticsContext: DiagnosticsContext = mode === 'fullscreen' ? 'HOME_PROPOSAL' : 'IN_PROJECT';
              const suggestedActions = getSuggestedQuickActions(diagnostics, diagnosticsContext);
              setWorkflowGenState('BASELINE_GENERATED');
              setPendingQuickActions(suggestedActions);

              logAiInteraction({
                surface: mode === 'fullscreen' ? 'home' : 'project',
                phase: 'baseline',
                action: 'generate',
                success: true,
                nodeDelta: result.nodes.length,
                edgeDelta: result.edges.length,
              });
            }

            if (result.recommendations?.length > 0) {
              content += '\n\nRecommendations:\n' + result.recommendations.map((r: string) => `• ${r}`).join('\n');
            }

            content += multiImageNote;

            const assistantMessage: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content,
              timestamp: new Date(),
              workflowProposal: offerProposal ? {
                nodes: result.nodes,
                edges: result.edges,
                description: 'Generated from image analysis',
                status: 'pending'
              } : undefined
            };
            setMessages(prev => [...prev, assistantMessage]);
          } else {
            // Surface the specific server-provided reason (credits, plan, rate
            // limit, timeout, unreadable response) instead of a generic error.
            let serverMessage = '';
            try {
              const errorJson = await response.json();
              serverMessage = errorJson?.error || errorJson?.message || '';
            } catch {
              serverMessage = '';
            }
            console.error('[KiteAIChat] Image analysis failed:', response.status, serverMessage);
            if (!serverMessage) {
              if (response.status === 401 || response.status === 403) {
                serverMessage = "Image-to-workflow needs an Advanced or Pro plan, or you may be out of credits.";
              } else if (response.status === 413) {
                serverMessage = "That image is too large. Please upload an image under 10MB.";
              } else {
                serverMessage = "I couldn't analyze that image. Please try again in a moment.";
              }
            }
            const e = new Error(serverMessage);
            (e as any).userFacing = true;
            throw e;
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
          nodes: scopedNodes,
          edges: scopedEdges,
          canvasObjects: currentCanvasObjects,
          projectName: projectId
        },
        uiContext: {
          hasUploadedImages: hasImageAttachments,
          hasFigmaAttachment
        }
      });
      
      const hasCanvasContext = scopedNodes.length > 0;
      const hasSemanticData = scopedNodes.some(n => n.data?.label || n.data?.description);
      
      const kiteAIContext = buildKiteAIContext(
        'in_project',
        effectiveRole,
        {
          nodes: scopedNodes,
          edges: scopedEdges,
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

      // AI Stabilization Phase 1: Capture diagnostic baseline BEFORE AI generates workflow
      if (aiStabilizationEnabled) {
        const baselineWorkflow = {
          nodes: scopedNodes.map(n => ({ id: n.id, type: n.type || 'process', label: n.data?.label as string })),
          edges: scopedEdges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.data?.label as string })),
        };
        baselineDiagnosticsRef.current = captureDiagnosticBaseline(baselineWorkflow);
        console.log('[AiStabilization] Baseline captured:', {
          issueCount: baselineDiagnosticsRef.current.issues.length,
          nodeCount: baselineDiagnosticsRef.current.nodeCount,
          edgeCount: baselineDiagnosticsRef.current.edgeCount,
        });
      }

      const router = getRouter();
      const isExecutionReady = lastActionabilityRef.current?.newState === 'execution-ready';

      // Detect explicit workflow generation intent regardless of Phase7 state.
      // Phase7 is designed for ambiguous requests — clear generation signals should
      // always bypass it and route directly to the reasoning model.
      const msgLowerForRouting = messageContent.toLowerCase();
      const hasWorkflowIntent = WORKFLOW_GENERATION_SIGNALS.some(sig => msgLowerForRouting.includes(sig));

      const effectiveTaskType = (isExecutionReady || hasWorkflowIntent)
        ? 'workflow_reasoning'
        : 'general_chat';

      if (effectiveTaskType === 'workflow_reasoning') {
        enhancedPrompt += `\n\nCRITICAL OUTPUT FORMAT: Your ENTIRE response must be the raw JSON object only. Start with { and end with }. No introduction sentence. No explanation after the closing brace. No code fences. No markdown. The Kiteframe UI automatically shows a "Create Project" button when it receives your JSON — you do NOT need to instruct the user how to import, copy, paste, or create a project. Just output the JSON.`;
      }

      // Determine the effective optimization session ID for this request.
      // Rules:
      //   1. If no session exists and we are in in-project mode with existing canvas nodes,
      //      generate a UUID client-side NOW (before the call). The credit middleware will
      //      register it atomically after deducting the credit, so retries on a failed first
      //      generation are free — the credit was already spent on this attempt.
      //   2. If a session already exists (regardless of draft state), carry it forward.
      //      This covers both refinement turns AND retries after a failed generation.
      //      All explicit end-of-session events (accept/reject/replace/hard-cap block) already
      //      call DELETE and set optimizationSessionId to null before control returns here,
      //      so a non-null session at this point is always a valid continuation or retry.
      //   3. Fullscreen (home) mode never participates in optimization sessions.
      //
      // Bounded session window: the server limits sessions to MAX_FREE_TURNS (5) free
      // workflow_reasoning turns. This bounds the case where the user sends a new
      // unrelated workflow request while a draft is still pending — they get at most 5
      // free turns before the session is exhausted and the next request charges a credit.
      // Full intent-based classification to distinguish "refinement" from "new topic"
      // within the same session is deferred beyond P0.
      let effectiveSessionId = optimizationSessionId;
      // Only workflow_reasoning turns participate in optimization sessions.
      // General chat turns (effectiveTaskType !== 'workflow_reasoning') carry the existing
      // session ID through so the server can see it, but the server scope guard (taskType check)
      // prevents credit bypass for non-optimization turns. New session IDs are never created
      // for non-workflow turns, so a user asking an off-topic question never gains a session.
      if (!effectiveSessionId && mode !== 'fullscreen' && currentNodes.length > 0 && effectiveTaskType === 'workflow_reasoning') {
        effectiveSessionId = crypto.randomUUID();
        setOptimizationSessionId(effectiveSessionId);
      }

      const response = await router.chat({
        taskType: effectiveTaskType,
        messages: [
          { role: 'system', content: enhancedPrompt },
          ...conversationHistory,
          { role: 'user', content: messageContent }
        ],
        temperature: 0.7,
        maxTokens: effectiveTaskType === 'workflow_reasoning' ? 8000 : 3000,
        optimizationSessionId: effectiveSessionId || undefined,
      });

      // Surface-level acknowledgment of background job consumption: this
      // chat surface is mounted and is about to render the result, so any
      // remount-handoff replay for this jobId must be suppressed.
      if (response.jobId) markJobConsumed(response.jobId);

      let workflowProposal: ChatMessage['workflowProposal'] | undefined;
      let responseText = response.text;

      const extractJsonObject = (text: string): string | null => {
        const start = text.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < text.length; i++) {
          const ch = text[i];
          if (escape) { escape = false; continue; }
          if (ch === '\\' && inString) { escape = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
          }
        }
        return null;
      };

      // Strip markdown code fences before extraction — the AI often wraps JSON
      // in ```json ... ``` even when told not to, which doesn't affect brace
      // counting but the trailing ``` can be avoided by cleaning first.
      const textForExtraction = response.text
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '');
      const rawJson = extractJsonObject(textForExtraction);
      console.log('[KiteAI] JSON extraction:', {
        responseLength: response.text.length,
        rawJsonLength: rawJson?.length ?? 0,
        hasNodes: rawJson?.includes('"nodes"') ?? false,
        hasEdges: rawJson?.includes('"edges"') ?? false,
        responseStart: response.text.slice(0, 80).replace(/\n/g, '↵'),
      });
      const jsonMatch = rawJson && rawJson.includes('"nodes"') && rawJson.includes('"edges"') ? [rawJson] : null;
      if (jsonMatch) {
        try {
          let cleanJson = jsonMatch[0]
            .replace(/```json\s?|```/g, '')
            .replace(/,(\s*[}\]])/g, '$1');
          
          const parsed = JSON.parse(cleanJson);
          if (parsed.nodes && parsed.edges) {
            // Phase 6.5: Detect merge vs branch intent
            let mergeBranchDecision: MergeBranchDecision | undefined;
            if (mergeBranchHeuristicEnabled) {
              const previousMessages = messages
                .filter(m => m.role === 'user')
                .map(m => m.content);
              
              mergeBranchDecision = detectMergeBranchIntent({
                userMessage: messageContent,
                hasExistingWorkflow: scopedNodes.length > 0,
                previousUserMessages: previousMessages.slice(-3),
              });
              
              const resolvedIntent = resolveIntent(mergeBranchDecision);
              console.log(`[Phase6.5] MergeBranch decision: ${mergeBranchDecision.intent} → resolved: ${resolvedIntent} | confidence: ${mergeBranchDecision.confidence.toFixed(2)} | signals: ${mergeBranchDecision.detectedSignals.join(', ')}`);
              
              if (isAmbiguous(mergeBranchDecision)) {
                console.log(`[Phase6.5] Ambiguous intent defaulted to MERGE (intentAmbiguous: true)`);
              }
            }
            
            // AI Stabilization Phase 1-5: Validate proposal before accepting
            let proposalRejected = false;
            let rejectionReason: string | undefined;
            let stabilityMetrics: AiStabilityMetrics | undefined;
            
            // AI Stabilization Guardrail Bypass Logic:
            // - HOME proposals (baseline generation) must NEVER trigger guardrails
            // - Guardrails only run for in-project mutations (Apply/Replace)
            const isHomeProposal = surfaceContext === 'home' || mode === 'fullscreen';
            const skipAiStabilization = isHomeProposal;
            
            if (skipAiStabilization) {
              console.log('[AiStabilization] Skipping guardrails - HOME proposal phase (baseline generation)');
            }
            
            if (aiStabilizationEnabled && baselineDiagnosticsRef.current && !skipAiStabilization) {
              const proposedWorkflow = {
                nodes: parsed.nodes.map((n: Node) => ({ 
                  id: n.id, 
                  type: n.type || 'process', 
                  label: (n.data as any)?.label 
                })),
                edges: parsed.edges.map((e: Edge) => ({ 
                  id: e.id, 
                  source: e.source, 
                  target: e.target, 
                  label: (e.data as any)?.label,
                  type: (e as any).type || 'default'
                })),
              };
              
              const baselineWorkflow = {
                nodes: scopedNodes.map(n => ({ id: n.id, type: n.type || 'process', label: n.data?.label as string })),
                edges: scopedEdges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.data?.label as string })),
              };
              
              // Phase 1: Compute diagnostic delta
              const delta = computeDiagnosticDelta(baselineDiagnosticsRef.current, proposedWorkflow);
              
              stabilityMetrics = {
                baselineIssueCount: delta.baselineIssueCount,
                postProposalIssueCount: delta.postProposalIssueCount,
                newIssueCount: delta.newlyIntroducedIssues.length,
                resolvedIssueCount: delta.resolvedIssues.length,
                proposalRejected: false,
              };
              
              // Check if proposal introduced new issues
              if (delta.hasRegressions) {
                proposalRejected = true;
                rejectionReason = 'This proposal introduced new issues and was not applied.';
                stabilityMetrics.proposalRejected = true;
                stabilityMetrics.rejectionReason = 'new_issues';
                
                console.warn('[AiStabilization] Proposal rejected - new issues:', delta.newlyIntroducedIssues);
                
                toast({
                  title: "Proposal not applied",
                  description: rejectionReason,
                  variant: "destructive"
                });
              }
              
              // Phase 2: Fix-scope validation (only when modifying existing workflow)
              // Skip when the user explicitly requests structural changes like adding failure paths,
              // error handling, or creating/rebuilding the workflow — the guardrail is designed for
              // narrow targeted repairs, not intentional structural expansions.
              const STRUCTURAL_EXPANSION_SIGNALS = [
                'error handling', 'failure path', 'fallback', 'edge case',
                'create', 'rebuild', 'redesign', 'redo', 'generate', 'make', 'build',
                'add failure', 'add error', 'what if', 'what happens if',
                'rejection', 'retry', 'exception', 'handle failure', 'handle error',
                'cleanup', 'clean up', 'teardown', 'tear down', 'full', 'complete',
                'entire', 'whole', 'setup', 'set up', 'expand', 'extend', 'flesh out',
                'fill in', 'fill out', 'add missing', 'missing pieces', 'gaps',
              ];
              const msgLower = messageContent.toLowerCase();
              const isStructuralExpansion = STRUCTURAL_EXPANSION_SIGNALS.some(sig => msgLower.includes(sig));

              if (!proposalRejected && scopedNodes.length > 0 && !isStructuralExpansion) {
                const fixScope = createFixScope(baselineWorkflow);
                const scopeResult = validateFixScope(fixScope, baselineWorkflow, proposedWorkflow);
                
                if (!scopeResult.valid) {
                  proposalRejected = true;
                  rejectionReason = scopeResult.details || 'Proposal violates scope constraints.';
                  stabilityMetrics.proposalRejected = true;
                  stabilityMetrics.rejectionReason = 'scope_violation';
                  
                  console.warn('[AiStabilization] Fix-scope violation:', scopeResult);
                  
                  toast({
                    title: "Proposal not applied",
                    description: rejectionReason,
                    variant: "destructive"
                  });
                }
              } else if (isStructuralExpansion && scopedNodes.length > 0) {
                console.log('[AiStabilization] Skipping fix-scope validation - structural expansion request detected');
              }
              
              // Phase 3: Edit-first heuristic (only when modifying existing workflow)
              // Also skip for structural expansion requests - adding failure paths/error handling
              // is inherently additive and shouldn't be penalized as "over-construction".
              if (!proposalRejected && scopedNodes.length > 0 && !isStructuralExpansion) {
                // Normalize both baseline and proposed to symmetric structure for accurate diff
                // Only compare label (the primary user-visible field) to avoid false positives
                const normalizeNodeForDiff = (id: string, type: string | undefined, data: any) => ({
                  id,
                  type: type || 'process',
                  data: { label: data?.label || '' },
                });
                
                const normalizeEdgeForDiff = (id: string, source: string, target: string, data: any) => ({
                  id,
                  source,
                  target,
                  data: { label: data?.label || '' },
                });
                
                const detailedDelta = computeDetailedWorkflowDelta(
                  {
                    nodes: scopedNodes.map(n => normalizeNodeForDiff(n.id, n.type, n.data)),
                    edges: scopedEdges.map(e => normalizeEdgeForDiff(e.id, e.source, e.target, e.data)),
                  },
                  {
                    nodes: proposedWorkflow.nodes.map((n: { id: string; type?: string; label?: string }) => normalizeNodeForDiff(n.id, n.type, { label: n.label })),
                    edges: proposedWorkflow.edges.map((e: { id: string; source: string; target: string; label?: string }) => normalizeEdgeForDiff(e.id, e.source, e.target, { label: e.label })),
                  }
                );
                
                const editFirstResult = validateEditFirstHeuristic({
                  nodesAdded: detailedDelta.nodesAdded,
                  nodesModified: detailedDelta.nodesModified,
                  edgesAdded: detailedDelta.edgesAdded,
                  edgesRemoved: detailedDelta.edgesRemoved,
                });
                
                if (!editFirstResult.valid) {
                  proposalRejected = true;
                  rejectionReason = editFirstResult.details || 'Proposal adds too many new nodes without modifying existing ones.';
                  stabilityMetrics.proposalRejected = true;
                  stabilityMetrics.rejectionReason = 'over_construction';
                  
                  console.warn('[AiStabilization] Over-construction detected:', editFirstResult);
                  
                  toast({
                    title: "Proposal not applied",
                    description: "The AI tried to add too many new nodes instead of editing existing ones. Please be more specific about what to modify.",
                    variant: "destructive"
                  });
                }
              }
              
              // Phase 6: Log stability metrics
              logAiStability(stabilityMetrics);
              console.log('[AiStabilization] Stability metrics:', stabilityMetrics);
            }
            
            // If proposal was rejected, skip setting the draft and show rejection message
            if (proposalRejected) {
              logAiInteraction({
                surface: mode === 'fullscreen' ? 'home' : 'project',
                phase: 'baseline',
                action: 'generate',
                success: false,
                reason: stabilityMetrics?.rejectionReason as any,
                aiStability: stabilityMetrics,
              });
              
              responseText = rejectionReason || 'The proposal could not be applied due to validation issues.';
            } else {
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
                originPrompt: messageContent,
                mergeBranchDecision,
              });

              // Replace raw JSON response with a readable summary
              responseText = `Workflow ready — ${parsed.nodes.length} nodes, ${parsed.edges.length} connections. Review the preview below and click Create to build it on your canvas.`;
              
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
              // In HOME proposal phase (fullscreen mode), always show edge/fail actions
              const diagnosticsContext: DiagnosticsContext = mode === 'fullscreen' ? 'HOME_PROPOSAL' : 'IN_PROJECT';
              const suggestedActions = getSuggestedQuickActions(diagnostics, diagnosticsContext);
              setWorkflowGenState('BASELINE_GENERATED');
              setPendingQuickActions(suggestedActions);
              
              logAiInteraction({
                surface: mode === 'fullscreen' ? 'home' : 'project',
                phase: 'baseline',
                action: 'generate',
                success: true,
                nodeDelta: parsed.nodes.length,
                edgeDelta: parsed.edges.length,
                aiStability: stabilityMetrics,
              });
              
            }
          }
        } catch (e) {
          console.warn('[KiteAI] Failed to parse workflow JSON:', e instanceof Error ? e.message : e);
          logAiInteraction({
            surface: mode === 'fullscreen' ? 'home' : 'project',
            phase: 'baseline',
            action: 'generate',
            success: false,
            reason: 'parse_fail',
          });
          // Strip the raw JSON from the visible response — it was either truncated
          // (token limit hit mid-object) or malformed. Never show raw JSON in chat.
          const jsonStart = responseText.indexOf('{');
          if (jsonStart !== -1) {
            const prose = responseText.slice(0, jsonStart).trim();
            responseText = prose
              ? `${prose}\n\nI hit a response limit while generating the workflow. Try asking for a smaller set of changes, or break it into a few steps.`
              : "I hit a response limit while generating the workflow. Try asking for a smaller set of changes, or break it into a few steps.";
          }
        }
      }

      // Final safety net: if responseText still contains a raw JSON block
      // (e.g. jsonMatch was null but the AI included JSON in a prose response),
      // strip it so raw JSON is never rendered in the chat bubble.
      if (!workflowProposal) {
        const jsonStart = responseText.indexOf('{');
        if (jsonStart !== -1 && responseText.includes('"nodes"')) {
          const prose = responseText.slice(0, jsonStart).trim();
          const cleanedProse = prose
            .replace(/```json\s*$/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          responseText = cleanedProse
            ? `${cleanedProse}\n\nI hit a response limit while generating the workflow. Your workflow may be too complex for a single request — try asking me to update a smaller piece at a time.`
            : "I hit a response limit while generating the workflow. Your workflow may be too complex for a single request — try asking me to update a smaller piece at a time.";
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
      // For known, user-facing failures (e.g. image analysis errors with a
      // specific reason), show that reason in the chat transcript instead of a
      // generic message, so the user understands what went wrong and what to do.
      const isUserFacing = !!(error as any)?.userFacing && error instanceof Error && !!error.message;
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: isUserFacing
          ? (error as Error).message
          : "I'm sorry, I encountered an error processing your request. Please try again.",
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
  // In panel/floating mode: Smart selection between REPLACE (empty canvas) and APPLY (existing canvas)
  // Phase 4: Mode toggle removed - smart selection handles Add/Replace automatically
  const handleAcceptWorkflow = () => {
    if (!currentWorkflowDraft) return;
    
    // Phase Lock: Block mutation after expansion unless explicitly approved
    // This prevents runaway graph rewrites from repeated edge-case expansions
    if (hasExpandedOnce && !mutationApproved && mode !== 'fullscreen') {
      toast({
        title: "Workflow Expanded",
        description: "Discuss further changes or click 'Apply Changes' to update the canvas.",
        variant: "default"
      });
      logAiInteraction({
        surface: 'project',
        phase: 'accept',
        action: 'apply',
        success: false,
        reason: 'blocked',
      });
      return;
    }

    // Fullscreen mode: create project via callback (no canvas exists yet)
    if (mode === 'fullscreen') {
      // Phase 5: Dev guard - mutation callbacks should not be provided in fullscreen mode
      if (process.env.NODE_ENV === 'development' && (onApplyWorkflow || onReplaceWorkflow)) {
        console.warn('[KiteAI] Phase separation warning: mutation callbacks detected in fullscreen mode. Use onCreateWorkflow only.');
      }
      if (onCreateWorkflow) {
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
        
        // Phase Lock: Reset after successful creation
        setHasExpandedOnce(false);
        setMutationApproved(false);
        
        logAiInteraction({
          surface: 'home',
          phase: 'accept',
          action: 'create',
          success: true,
          nodeDelta: currentWorkflowDraft.nodes.length,
          edgeDelta: currentWorkflowDraft.edges.length,
        });
      }
      return;
    }

    // Panel/floating mode: Smart selection between REPLACE and APPLY
    // REPLACE: Use when canvas is empty (fresh start)
    // APPLY: Use when canvas has existing nodes (append/merge)
    const isCanvasEmpty = currentNodes.length === 0;

    // Resolve non-destructive target:
    // - Multi-workflow: user explicitly selected a group via chips
    // - Single-workflow: exactly one connected group exists on a non-empty canvas.
    //   Both paths add the modified copy alongside the original rather than overwriting it.
    const nonDestructiveGroup = selectedWorkflowGroup ?? (
      !isCanvasEmpty
        ? (() => {
            const groups = detectWorkflowGroups(currentNodes, currentEdges);
            return groups.length === 1 ? groups[0] : null;
          })()
        : null
    );

    if (nonDestructiveGroup && onApplyWorkflow) {
      onApplyWorkflow({
        nodes: currentWorkflowDraft.nodes,
        edges: currentWorkflowDraft.edges,
        canvasObjects: currentWorkflowDraft.canvasObjects,
        nonDestructive: true,
        selectedGroupLabel: nonDestructiveGroup.label,
      });

      if (optimizationSessionId) {
        fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
        setOptimizationSessionId(null);
      }
      setCurrentWorkflowDraft(null);
      setWorkflowGenState(null);
      setPendingQuickActions([]);
      setHasExpandedOnce(false);
      setMutationApproved(false);
      setSelectedWorkflowGroup(null);
      setPendingUserMessage(null);
      setShowChangeWarning(false);

      logAiInteraction({
        surface: 'project',
        phase: 'in_project',
        action: 'apply',
        success: true,
        nodeDelta: currentWorkflowDraft.nodes.length,
        edgeDelta: currentWorkflowDraft.edges.length,
      });

      toast({
        title: "Modified Workflow Added",
        description: `Added "${nonDestructiveGroup.label} — Modified" (${currentWorkflowDraft.nodes.length} nodes) to your canvas. Your original workflow is unchanged. Use Ctrl+Z to undo.`
      });
      return;
    }
    
    if (isCanvasEmpty && onReplaceWorkflow) {
      onReplaceWorkflow({
        nodes: currentWorkflowDraft.nodes,
        edges: currentWorkflowDraft.edges,
        canvasObjects: currentWorkflowDraft.canvasObjects,
      });

      if (optimizationSessionId) {
        fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
        setOptimizationSessionId(null);
      }
      setCurrentWorkflowDraft(null);
      setWorkflowGenState(null);
      setPendingQuickActions([]);
      setHasExpandedOnce(false);
      setMutationApproved(false);
      setShowChangeWarning(false);
      
      logAiInteraction({
        surface: 'project',
        phase: 'in_project',
        action: 'replace',
        success: true,
        nodeDelta: currentWorkflowDraft.nodes.length,
        edgeDelta: currentWorkflowDraft.edges.length,
      });
      
      toast({
        title: "Workflow Created",
        description: `Created workflow with ${currentWorkflowDraft.nodes.length} nodes.`
      });
      return;
    }

    // Non-empty canvas: Use APPLY (append to existing)
    if (!onApplyWorkflow) return;

    onApplyWorkflow({
      nodes: currentWorkflowDraft.nodes,
      edges: currentWorkflowDraft.edges,
      canvasObjects: currentWorkflowDraft.canvasObjects,
      mergeBranchDecision: currentWorkflowDraft.mergeBranchDecision,
      aiMode,
    });

    if (optimizationSessionId) {
      fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
      setOptimizationSessionId(null);
    }
    setCurrentWorkflowDraft(null);
    setWorkflowGenState(null);
    setPendingQuickActions([]);
    setHasExpandedOnce(false);
    setMutationApproved(false);
    setShowChangeWarning(false);
    
    logAiInteraction({
      surface: 'project',
      phase: 'in_project',
      action: 'apply',
      success: true,
      nodeDelta: currentWorkflowDraft.nodes.length,
      edgeDelta: currentWorkflowDraft.edges.length,
    });

    toast({
      title: "Workflow Updated",
      description: `Added ${currentWorkflowDraft.nodes.length} nodes to your canvas.`
    });
  };
  
  // Explicit REPLACE handler - allows user to replace entire canvas even when not empty
  // Phase 4: Mode toggle removed - Replace always available when canvas has nodes
  const handleReplaceWorkflow = () => {
    if (!currentWorkflowDraft) return;

    // Phase 5: Dev guard - handleReplaceWorkflow should only be called in panel/floating mode
    if (process.env.NODE_ENV === 'development' && mode === 'fullscreen') {
      console.error('[KiteAI] Phase separation error: handleReplaceWorkflow called in fullscreen mode. This is a bug.');
      return;
    }

    // Resolve non-destructive target (mirrors handleAcceptWorkflow logic):
    // multi-workflow chip selection OR single workflow on a non-empty canvas.
    const isCanvasEmpty = currentNodes.length === 0;
    const nonDestructiveGroup = selectedWorkflowGroup ?? (
      !isCanvasEmpty
        ? (() => {
            const groups = detectWorkflowGroups(currentNodes, currentEdges);
            return groups.length === 1 ? groups[0] : null;
          })()
        : null
    );

    if (nonDestructiveGroup && onApplyWorkflow) {
      onApplyWorkflow({
        nodes: currentWorkflowDraft.nodes,
        edges: currentWorkflowDraft.edges,
        canvasObjects: currentWorkflowDraft.canvasObjects,
        nonDestructive: true,
        selectedGroupLabel: nonDestructiveGroup.label,
      });

      if (optimizationSessionId) {
        fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
        setOptimizationSessionId(null);
      }
      setCurrentWorkflowDraft(null);
      setWorkflowGenState(null);
      setPendingQuickActions([]);
      setHasExpandedOnce(false);
      setMutationApproved(false);
      setSelectedWorkflowGroup(null);
      setPendingUserMessage(null);
      setShowChangeWarning(false);

      logAiInteraction({
        surface: 'project',
        phase: 'in_project',
        action: 'apply',
        success: true,
        nodeDelta: currentWorkflowDraft.nodes.length,
        edgeDelta: currentWorkflowDraft.edges.length,
      });

      toast({
        title: "Modified Workflow Added",
        description: `Added "${nonDestructiveGroup.label} — Modified" (${currentWorkflowDraft.nodes.length} nodes) to your canvas. Your original workflow is unchanged. Use Ctrl+Z to undo.`
      });
      return;
    }

    if (!onReplaceWorkflow) return;

    // REPLACE: Destructively replace entire canvas (with undo support)
    onReplaceWorkflow({
      nodes: currentWorkflowDraft.nodes,
      edges: currentWorkflowDraft.edges,
      canvasObjects: currentWorkflowDraft.canvasObjects,
    });

    if (optimizationSessionId) {
      fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
      setOptimizationSessionId(null);
    }
    setCurrentWorkflowDraft(null);
    setWorkflowGenState(null);
    setPendingQuickActions([]);
    setHasExpandedOnce(false);
    setMutationApproved(false);
    setShowChangeWarning(false);
    
    logAiInteraction({
      surface: 'project',
      phase: 'in_project',
      action: 'replace',
      success: true,
      nodeDelta: currentWorkflowDraft.nodes.length,
      edgeDelta: currentWorkflowDraft.edges.length,
    });

    toast({
      title: "Workflow Replaced",
      description: `Replaced canvas with ${currentWorkflowDraft.nodes.length} nodes. Use Ctrl+Z to undo.`
    });
  };

  // UPDATED: Reject clears currentWorkflowDraft (authoritative)
  const handleRejectWorkflow = () => {
    logAiInteraction({
      surface: mode === 'fullscreen' ? 'home' : 'project',
      phase: 'accept',
      action: mode === 'fullscreen' ? 'create' : 'apply',
      success: false,
      reason: 'user_cancel',
    });

    if (optimizationSessionId) {
      fetch(`/api/ai/optimization-session/${optimizationSessionId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
      setOptimizationSessionId(null);
    }
    setCurrentWorkflowDraft(null);
    setWorkflowGenState(null);
    setPendingQuickActions([]);
    setDiscussedEdgeCases([]);
    setShowChangeWarning(false);
    
    // Phase Lock: Reset expansion state when workflow is rejected
    setHasExpandedOnce(false);
    setMutationApproved(false);
    
    toast({
      title: "Workflow Discarded",
      description: "The workflow draft has been cleared."
    });
  };

  const handleWorkflowChipSelect = (chipId: string) => {
    const groups = detectWorkflowGroups(currentNodes, currentEdges);
    const selected = groups.find(g => g.id === chipId);
    if (!selected) return;

    setSelectedWorkflowGroup(selected);
    selectedWorkflowGroupRef.current = selected;

    const confirmMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Got it — I'll work on **"${selected.label}"** (${selected.nodeCount} nodes). Your other workflows won't be affected.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, confirmMsg]);

    if (pendingUserMessage) {
      const msg = pendingUserMessage;
      setPendingUserMessage(null);
      setTimeout(() => handleSend(msg), 100);
    }
  };

  // Executes the workflow-group reset without confirmation (called either directly when no
  // draft is active, or after the user confirms the inline discard warning).
  const doChangeWorkflow = () => {
    // Delete the server-side optimization session if one was opened.
    if (optimizationSessionId) {
      fetch(`/api/ai/optimization-session/${optimizationSessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
      setOptimizationSessionId(null);
    }
    // Wipe draft state.
    setCurrentWorkflowDraft(null);
    setWorkflowGenState(null);
    setPendingQuickActions([]);
    setHasExpandedOnce(false);
    setMutationApproved(false);
    setShowChangeWarning(false);
    // Clear the group selection.
    setSelectedWorkflowGroup(null);
    selectedWorkflowGroupRef.current = null;
    setPendingUserMessage(null);

    // Re-insert the workflow picker chips so the user can choose again.
    const groups = detectWorkflowGroups(currentNodes, currentEdges);
    if (groups.length >= 2) {
      const chipMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Which workflow would you like to work on instead?',
        timestamp: new Date(),
        workflowChips: groups.map(g => ({ id: g.id, label: g.label, nodeCount: g.nodeCount })),
      };
      setMessages(prev => [...prev, chipMsg]);
    }
  };

  // Entry point for the "Change" button in the input bar.
  // If a draft is currently active, shows an inline discard-warning first;
  // otherwise resets immediately.
  const handleChangeWorkflow = () => {
    if (currentWorkflowDraft) {
      setShowChangeWarning(true);
      return;
    }
    doChangeWorkflow();
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
          
        case 'INCLUDE_EDGE_CASES': {
          // Call AI to expand workflow with edge cases
          toast({ title: 'Expanding workflow', description: 'Adding edge and failure cases...' });
          
          const beforeDraft = { nodes: currentWorkflowDraft.nodes, edges: currentWorkflowDraft.edges };
          const router1 = getRouter();
          const expandUserMsg = `Original prompt: ${currentWorkflowDraft.originPrompt || 'Workflow expansion'}\n\nCurrent workflow:\n${JSON.stringify({ nodes: currentWorkflowDraft.nodes, edges: currentWorkflowDraft.edges }, null, 2)}`;
          const expandBaseMessages = [
            { role: 'system' as const, content: AI_WORKFLOW_EXPAND_EDGE_CASES_PROMPT },
            { role: 'user' as const, content: expandUserMsg },
          ];
          const expandResponse = await router1.chat({
            taskType: 'workflow_reasoning',
            messages: expandBaseMessages,
            temperature: 0.5,
            maxTokens: 8000,
          });
          if (expandResponse.jobId) markJobConsumed(expandResponse.jobId);

          // Phase 2: Use deterministic parsing with proper error handling
          const requestId1 = `req_${Date.now()}_expand`;
          let parseResult: ProposalParseResult = parseWorkflowProposal(
            expandResponse.text,
            requestId1,
          );

          // Silent retry once if the first parse failed. Models occasionally
          // wrap the JSON in prose or return a delta on the first try; an
          // explicit reminder almost always recovers without bothering the
          // user with a destructive toast.
          if (!parseResult.success || !parseResult.proposal) {
            try {
              const retryResp = await router1.chat({
                taskType: 'workflow_reasoning',
                messages: [
                  ...expandBaseMessages,
                  {
                    role: 'system' as const,
                    content:
                      'Your previous response could not be parsed. Reply again with the FULL workflow as a single valid JSON object only — no prose, no markdown fences, no commentary. Include every original node and edge plus the new ones.',
                  },
                ],
                temperature: 0.3,
                maxTokens: 8000,
              });
              if (retryResp.jobId) markJobConsumed(retryResp.jobId);
              parseResult = parseWorkflowProposal(
                retryResp.text,
                `${requestId1}_retry`,
              );
            } catch (retryErr) {
              console.warn('[KiteAIChat] Edge-case expand retry threw:', retryErr);
            }
          }

          if (!parseResult.success || !parseResult.proposal) {
            console.error('[KiteAIChat] Failed to parse expanded workflow:', {
              error: parseResult.error,
              validationErrors: parseResult.validationErrors,
              requestId: parseResult.requestId,
            });
            toast({ 
              title: "Couldn't update proposal", 
              description: `${parseResult.error || 'Unknown error'}. Tap to retry.`,
              variant: 'destructive',
              action: (
                <button 
                  onClick={() => handleQuickAction('INCLUDE_EDGE_CASES')}
                  className="text-xs underline"
                >
                  Retry
                </button>
              )
            });
            logAiInteraction({
              surface: mode === 'fullscreen' ? 'home' : 'project',
              phase: 'edge_expand',
              action: 'expand_edges',
              success: false,
              reason: 'parse_fail',
            });
            break;
          }
          
          // Convert proposal nodes to workflow nodes format, preserving AI-provided geometry
          const expandedNodes = parseResult.proposal.nodes.map(n => ({
            ...n,
            id: n.id,
            type: n.type || 'process',
            position: (n as any).position || { x: 0, y: 0 },
            data: { 
              label: n.label, 
              description: n.description,
              icon: n.icon,
              iconColor: n.iconColor,
              ...n.data 
            },
          }));
          
          const expandedEdges = parseResult.proposal.edges.map(e => ({
            ...e,
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            data: { label: e.label, ...e.data },
          }));
          
          // REPLACE the draft with expanded workflow (preserve merge/branch decision)
          setCurrentWorkflowDraft({
            nodes: expandedNodes as Node[],
            edges: expandedEdges as Edge[],
            status: 'expanded',
            originPrompt: currentWorkflowDraft.originPrompt,
            mergeBranchDecision: currentWorkflowDraft.mergeBranchDecision,
          });
          setWorkflowGenState('EXPANDED_WITH_EDGE_CASES');
          setPendingQuickActions([]);
          
          // Phase Lock: Mark that expansion has occurred - subsequent mutations require explicit approval
          setHasExpandedOnce(true);
          setMutationApproved(false);
          
          const afterDraft = { nodes: expandedNodes, edges: expandedEdges };
          const delta = computeWorkflowDelta(beforeDraft, afterDraft);
          logAiInteraction({
            surface: mode === 'fullscreen' ? 'home' : 'project',
            phase: 'edge_expand',
            action: 'expand_edges',
            success: (delta.nodeDelta ?? 0) !== 0 || (delta.edgeDelta ?? 0) !== 0,
            ...((delta.nodeDelta === 0 && delta.edgeDelta === 0)
              ? { reason: 'no_change' as const }
              : delta),
          });
          
          if (delta.nodeDelta === 0 && delta.edgeDelta === 0) {
            toast({ title: 'No additional edge cases found', description: 'The workflow already covers common scenarios.' });
          } else {
            toast({ title: 'Workflow expanded', description: `Added ${delta.nodeDelta ?? 0} new steps.` });
          }
          
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            role: 'assistant',
            content: AI_RESPONSE_TEMPLATES.EXPANDED_WITH_EDGE_CASES,
            timestamp: new Date(),
            workflowProposal: {
              nodes: expandedNodes as Node[],
              edges: expandedEdges as Edge[],
              status: 'pending',
            },
          }]);
          break;
        }
          
        case 'DISCUSS_EDGE_CASES': {
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
          if (listResponse.jobId) markJobConsumed(listResponse.jobId);
          
          // Phase 2: Use deterministic parsing with proper error handling
          const requestId2 = `req_${Date.now()}_discuss`;
          const edgeCaseResult: EdgeCaseParseResult = parseEdgeCases(
            listResponse.text,
            requestId2
          );
          
          if (!edgeCaseResult.success || !edgeCaseResult.edgeCases) {
            console.error('[KiteAIChat] Failed to parse edge cases:', {
              error: edgeCaseResult.error,
              requestId: edgeCaseResult.requestId,
            });
            toast({ 
              title: "Couldn't analyze edge cases", 
              description: `${edgeCaseResult.error || 'Unknown error'}. Tap to retry.`,
              variant: 'destructive',
              action: (
                <button 
                  onClick={() => handleQuickAction('DISCUSS_EDGE_CASES')}
                  className="text-xs underline"
                >
                  Retry
                </button>
              )
            });
            break;
          }
          
          setDiscussedEdgeCases(edgeCaseResult.edgeCases);
          setWorkflowGenState('DISCUSSING_EDGE_CASES');
          setPendingQuickActions([]);
          setMessages(prev => [
            ...prev,
            {
              id: `system-${Date.now()}`,
              role: 'assistant' as const,
              content: AI_RESPONSE_TEMPLATES.DISCUSSING_EDGE_CASES,
              timestamp: new Date(),
            },
            {
              id: `edge-case-selector-${Date.now()}`,
              role: 'system' as const,
              type: 'edge_case_selector' as const,
              content: '',
              timestamp: new Date(),
              meta: { edgeCases: edgeCaseResult.edgeCases },
            },
          ]);
          break;
        }
          
        case 'SELECT_EDGE_CASES':
          setMessages(prev => {
            if (prev.some(m => m.type === 'edge_case_selector')) return prev;
            return [...prev, {
              id: `edge-case-selector-${Date.now()}`,
              role: 'system' as const,
              type: 'edge_case_selector' as const,
              content: '',
              timestamp: new Date(),
              meta: { edgeCases: discussedEdgeCases },
            }];
          });
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
  }, [currentWorkflowDraft, discussedEdgeCases, aiClient, toast]);

  // UPDATED: Edge case selection uses currentWorkflowDraft (authoritative)
  const handleEdgeCaseSelection = useCallback(async (selectedIds: string[], selectorMessageId: string, selectorEdgeCases: EdgeCase[]) => {
    if (!currentWorkflowDraft) return;
    
    setIsLoading(true);
    
    try {
      // Derive selected cases from the message-specific edge cases so they survive
      // discussedEdgeCases being cleared after the initial DISCUSSING_EDGE_CASES state
      const selectedCases = selectorEdgeCases.filter(ec => selectedIds.includes(ec.id));

      // Swap the selector card with a summary card immediately
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === selectorMessageId);
        if (idx === -1) return prev;
        const summaryMsg: ChatMessage = {
          id: `edge-case-selected-${Date.now()}`,
          role: 'system',
          type: 'edge_case_selected',
          content: '',
          timestamp: new Date(),
          meta: {
            edgeCases: selectorEdgeCases,
            selectedEdgeCases: selectedCases,
          },
        };
        return [...prev.slice(0, idx), summaryMsg, ...prev.slice(idx + 1)];
      });
      toast({ 
        title: 'Applying edge cases', 
        description: `Adding ${selectedCases.length} edge case${selectedCases.length > 1 ? 's' : ''} to workflow...` 
      });
      
      // Call AI to expand with selected edge cases
      const router3 = getRouter();
      const selectUserMsg = `Original prompt: ${currentWorkflowDraft.originPrompt || 'Workflow'}\n\nCurrent workflow:\n${JSON.stringify({ nodes: currentWorkflowDraft.nodes, edges: currentWorkflowDraft.edges }, null, 2)}\n\nSelected edge cases to include:\n${selectedCases.map(c => `- ${c.label}`).join('\n')}`;
      const selectBaseMessages = [
        { role: 'system' as const, content: AI_WORKFLOW_EXPAND_SELECTED_EDGE_CASES_PROMPT },
        { role: 'user' as const, content: selectUserMsg },
      ];
      const selectResponse = await router3.chat({
        taskType: 'workflow_reasoning',
        messages: selectBaseMessages,
        temperature: 0.5,
        maxTokens: 8000,
      });
      if (selectResponse.jobId) markJobConsumed(selectResponse.jobId);

      // Phase 2: Use deterministic parsing with proper error handling
      const requestId3 = `req_${Date.now()}_select`;
      let selectParseResult: ProposalParseResult = parseWorkflowProposal(
        selectResponse.text,
        requestId3,
      );

      // Silent retry once if the first parse failed (see INCLUDE_EDGE_CASES
      // for the same pattern). The user only sees the destructive toast if
      // both attempts fail.
      if (!selectParseResult.success || !selectParseResult.proposal) {
        try {
          const retryResp = await router3.chat({
            taskType: 'workflow_reasoning',
            messages: [
              ...selectBaseMessages,
              {
                role: 'system' as const,
                content:
                  'Your previous response could not be parsed. Reply again with the FULL workflow as a single valid JSON object only — no prose, no markdown fences, no commentary. Include every original node and edge plus the new ones for the selected edge cases.',
              },
            ],
            temperature: 0.3,
            maxTokens: 8000,
          });
          if (retryResp.jobId) markJobConsumed(retryResp.jobId);
          selectParseResult = parseWorkflowProposal(
            retryResp.text,
            `${requestId3}_retry`,
          );
        } catch (retryErr) {
          console.warn('[KiteAIChat] Selected edge-case expand retry threw:', retryErr);
        }
      }

      if (!selectParseResult.success || !selectParseResult.proposal) {
        console.error('[KiteAIChat] Failed to parse selected edge case expansion:', {
          error: selectParseResult.error,
          validationErrors: selectParseResult.validationErrors,
          requestId: selectParseResult.requestId,
        });
        toast({ 
          title: "Couldn't apply edge cases", 
          description: `${selectParseResult.error || 'Unknown error'}. Please try again.`,
          variant: 'destructive'
        });
        return;
      }
      
      // Convert proposal nodes to workflow nodes format, preserving AI-provided geometry
      const selectedNodes = selectParseResult.proposal.nodes.map(n => ({
        ...n,
        id: n.id,
        type: n.type || 'process',
        position: (n as any).position || { x: 0, y: 0 },
        data: { 
          label: n.label, 
          description: n.description,
          icon: n.icon,
          iconColor: n.iconColor,
          ...n.data 
        },
      }));
      
      const selectedEdges = selectParseResult.proposal.edges.map(e => ({
        ...e,
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        data: { label: e.label, ...e.data },
      }));
      
      // REPLACE the draft with expanded workflow (preserve merge/branch decision)
      setCurrentWorkflowDraft({
        nodes: selectedNodes as Node[],
        edges: selectedEdges as Edge[],
        status: 'expanded',
        originPrompt: currentWorkflowDraft.originPrompt,
        mergeBranchDecision: currentWorkflowDraft.mergeBranchDecision,
      });
      setWorkflowGenState('SELECTED_EDGE_CASES_APPLIED');
      setDiscussedEdgeCases([]);
      
      // Phase Lock: Mark that expansion has occurred
      setHasExpandedOnce(true);
      setMutationApproved(false);
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        role: 'assistant',
        content: AI_RESPONSE_TEMPLATES.SELECTED_EDGE_CASES_APPLIED,
        timestamp: new Date(),
        workflowProposal: {
          nodes: selectedNodes as Node[],
          edges: selectedEdges as Edge[],
          status: 'pending',
        },
      }]);
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

  const handleModifyEdgeCaseSelection = useCallback((messageId: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx === -1) return prev;
      const old = prev[idx];
      const preSelectedIds = old.meta?.selectedEdgeCases?.map(ec => ec.id) ?? [];
      const edgeCases = old.meta?.edgeCases ?? discussedEdgeCases;
      const selectorMsg: ChatMessage = {
        id: `edge-case-selector-${Date.now()}`,
        role: 'system',
        type: 'edge_case_selector',
        content: '',
        timestamp: new Date(),
        meta: { edgeCases, preSelectedIds },
      };
      return [...prev.slice(0, idx), selectorMsg, ...prev.slice(idx + 1)];
    });
  }, [discussedEdgeCases]);

  const handleCancelEdgeCaseSelector = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

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
    setSelectedWorkflowGroup(null);
    selectedWorkflowGroupRef.current = null;
    setPendingUserMessage(null);
    setShowChangeWarning(false);
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
    <div className={`flex flex-col h-full w-full ${mode === 'fullscreen' ? 'relative' : ''}`}>
      {/* Header - hidden in fullscreen/home mode */}
      {mode !== 'fullscreen' && (
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
      )}

      {/* Messages Area */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        mode={mode}
        onFollowUpClick={setInputValue}
        onWorkflowChipSelect={handleWorkflowChipSelect}
        onEdgeCaseSubmit={(messageId, selectedIds, edgeCases) => handleEdgeCaseSelection(selectedIds, messageId, edgeCases)}
        onModifyEdgeCaseSelection={handleModifyEdgeCaseSelection}
        onCancelEdgeCaseSelector={handleCancelEdgeCaseSelector}
      />

      {/* Bottom-anchored panel: draft actions + input bar.
          In fullscreen mode both are fixed together so actions are never
          hidden behind the input bar. In panel mode they stay in normal flow. */}
      <div className={mode === 'fullscreen' ? 'fixed bottom-0 left-0 right-0 z-50 max-w-4xl mx-auto bg-background' : ''}>

      {/* AUTHORITATIVE WORKFLOW DRAFT ACTIONS - Always visible when draft exists */}
      {currentWorkflowDraft && (
        <div className="p-3 border-t border-border bg-muted/30 space-y-3">
          {/* Draft status badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={currentWorkflowDraft.status === 'expanded' ? 'default' : 'secondary'} className="text-xs">
                {currentWorkflowDraft.status === 'expanded' ? '✓ Expanded' : 'Draft'}: {currentWorkflowDraft.nodes.length} nodes, {currentWorkflowDraft.edges.length} edges
              </Badge>
              {selectedWorkflowGroup && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Modifying: {selectedWorkflowGroup.label}
                </Badge>
              )}
            </div>
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
          
          {/* Preview/Create/Replace/Reject buttons - always bound to currentWorkflowDraft */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePreviewWorkflow}
              className="h-8 text-xs"
              data-testid="button-preview-workflow-draft"
            >
              <Eye className="w-3 h-3 mr-1" />
              {showDiffPreview ? 'Hide' : 'Preview'}
            </Button>
            {/* Phase Lock: Show "Apply Changes" when expansion occurred and not yet approved */}
            {hasExpandedOnce && !mutationApproved && mode !== 'fullscreen' ? (
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  setMutationApproved(true);
                  // Immediately call accept after approving
                  setTimeout(() => handleAcceptWorkflow(), 0);
                }}
                className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700"
                data-testid="button-apply-changes-workflow"
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
                title="Apply the expanded workflow changes to your canvas"
              >
                <Check className="w-3 h-3 mr-1" />
                Apply Changes
              </Button>
            ) : (
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
                title={selectedWorkflowGroup
                  ? `Add modified version of "${selectedWorkflowGroup.label}" — original will not be changed`
                  : currentNodes.length === 0 ? "Create new workflow on empty canvas" : "Add nodes to existing canvas"}
              >
                <Check className="w-3 h-3 mr-1" />
                {selectedWorkflowGroup ? 'Add Modified Workflow' : currentNodes.length === 0 ? 'Create' : 'Add'}
              </Button>
            )}
            {/* Replace button - only show when canvas has existing nodes and no group selected */}
            {currentNodes.length > 0 && onReplaceWorkflow && !selectedWorkflowGroup && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReplaceWorkflow}
                className="h-8 text-xs border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                data-testid="button-replace-workflow-draft"
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
                title="Replace entire canvas with this workflow (undoable)"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Replace
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRejectWorkflow}
              className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
              data-testid="button-reject-workflow-draft"
              title="Discard this workflow draft"
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
              onSelectEdgeCases={() => handleQuickAction('SELECT_EDGE_CASES')}
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
        
        {/* AI Mode Selector removed - Phase 4: Smart selection handles Add/Replace automatically */}

        {/* Selected-workflow indicator: shows which group KiteAI is targeting and lets the
            user switch groups mid-conversation. Visible whenever a group is locked in,
            regardless of whether a draft is active. */}
        {mode !== 'fullscreen' && selectedWorkflowGroup && (
          <div className="mb-2">
            {showChangeWarning && !!currentWorkflowDraft ? (
              <div className="flex items-center gap-2 text-xs">
                <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span className="text-amber-600 dark:text-amber-400">
                  Your current suggestion will be discarded.
                </span>
                <button
                  onClick={doChangeWorkflow}
                  className="font-medium text-amber-700 dark:text-amber-300 underline hover:no-underline"
                  data-testid="button-change-workflow-confirm"
                >
                  Confirm
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => setShowChangeWarning(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-change-workflow-cancel"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full border border-border/60">
                  Working on:&nbsp;
                  <span className="font-medium text-foreground">{selectedWorkflowGroup.label}</span>
                </span>
                <button
                  onClick={handleChangeWorkflow}
                  className="flex items-center gap-0.5 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  title="Switch to a different workflow"
                  data-testid="button-change-workflow"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Change
                </button>
              </div>
            )}
          </div>
        )}

        {/* Large-workflow quality notice: dismissible, session-only, panel/floating only */}
        {(mode === 'panel' || mode === 'floating') && currentNodes.length > LARGE_WORKFLOW_WARNING_THRESHOLD && showLargeWorkflowBanner && (
          <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="flex-1">
              This workflow has many nodes — AI suggestions focus on the most connected paths.
            </span>
            <button
              onClick={() => setShowLargeWorkflowBanner(false)}
              className="flex-shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
              aria-label="Dismiss"
              data-testid="button-dismiss-large-workflow-banner"
            >
              <X className="w-3 h-3" />
            </button>
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
      </div>{/* end fullscreen bottom-anchored panel wrapper */}
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
    content: "Welcome to the discussion view. I can help you understand this workflow, identify potential edge cases, suggest improvements, or discuss missing steps.\n\nNote: chat responses use credits from your daily allowance.\n\nWhat would you like to discuss about this workflow?",
    timestamp: new Date()
  }]);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { toast } = useToast();
  const aiClient = useAi();
  const { user, loading: authLoading, signIn } = useAuth();
  const { data: authProbe, isLoading: authProbeLoading } = useQuery<object | null>({
    queryKey: ['/api/subscription'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    staleTime: 30_000,
    retry: false,
  });
  const isServerAuthenticated = !authProbeLoading && authProbe !== null && authProbe !== undefined;
  const isAuthenticated = !!user || isServerAuthenticated;
  const authChecked = !authLoading && !authProbeLoading;
  
  const hasApiKey = true;

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
      if (response?.jobId) markJobConsumed(response.jobId);
      
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-response`,
        role: 'assistant',
        content: response?.text || "I'm sorry, I couldn't generate a response. Please try again.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      const isCreditLimit = errMsg.includes('403') && (errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('limit'));
      if (isCreditLimit) {
        const limitMessage: ChatMessage = {
          id: `msg-${Date.now()}-limit`,
          role: 'assistant',
          content: "You've reached your daily credit limit. Credits reset every 24 hours.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, limitMessage]);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to get a response. Please try again.',
          variant: 'destructive'
        });
      }
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

  if (!authChecked) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 p-6" data-testid="discussion-view-loading">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground">Checking sign-in status...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full" data-testid="discussion-view-auth-gate">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <Eye className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">Discussion Mode</span>
          <Badge variant="secondary" className="text-[10px] ml-auto">Read Only</Badge>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-4">
          <MessageCircle className="w-10 h-10 text-muted-foreground opacity-50" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Sign in to use KiteAI</p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              Chat with KiteAI to discuss this workflow, explore edge cases, or get suggestions.
            </p>
          </div>
          <Button size="sm" onClick={signIn} data-testid="button-discussion-sign-in">
            Sign in with Google
          </Button>
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
      
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        mode="discussion"
      />
      
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
  onApplyWorkflow?: (workflow: ApplyWorkflowPayload) => void;
  onReplaceWorkflow?: (workflow: ReplaceWorkflowPayload) => void;
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
  onReplaceWorkflow,
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
        onReplaceWorkflow={onReplaceWorkflow}
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
  onApplyWorkflow: (workflow: ApplyWorkflowPayload) => void;
  onReplaceWorkflow?: (workflow: ReplaceWorkflowPayload) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
}

export function KiteAIChat({ 
  currentNodes, 
  currentEdges, 
  currentCanvasObjects,
  onApplyWorkflow,
  onReplaceWorkflow,
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
