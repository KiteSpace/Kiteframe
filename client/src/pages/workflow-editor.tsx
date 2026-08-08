import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useIsPhone } from "@/hooks/use-mobile";
import { MobileViewBar } from "@/components/MobileViewBar";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import "../lib/export/printStyles.css";
import { usePluginSystem } from "@/lib/kiteframe/core/PluginProvider";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { ProjectPanel } from "@/components/panels/ProjectPanel";
import { CommentsOverlay } from "@/components/comments/CommentsOverlay";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { BlankCanvasState } from "@/components/BlankCanvasState";
import { NewTabTypePicker } from "@/components/NewTabTypePicker";
import { DesignTabView } from "@/design/DesignPage";
import {
  PluginProvider,
  layoutPlugin,
  advancedInteractionsPlugin,
  useInsights,
} from "@/lib/kiteframe";
import type { ProjectPanelTab } from "@/components/panels/ProjectPanel";
import { PluginTestButton } from "@/components/PluginTestButton";
import { PluginTestPanel } from "@/components/PluginTestPanel";
import { Sidebar } from "@/components/Sidebar";
import { CollapsedSidebar } from "@/components/CollapsedSidebar";
import { NodeTypesPopout } from "@/components/NodeTypesPopout";
import { ShapesPopout } from "@/components/ShapesPopout";
import { Toolbar } from "@/components/Toolbar";
import { AiSettingsModal } from "@/components/AiSettingsModal";
import { AiWorkflowGenerator } from "@/components/AiWorkflowGenerator";
import { InterfaceProposalView } from "@/components/InterfaceProposalView";
import { pruneUnreachableCraftNodes, sanitizeCraftState } from "@/design/resolver";
import { WorkflowImportModal } from "@/components/WorkflowImportModal";
import { ShareModal } from "@/components/ShareModal";
import { SketchCanvas, findNearestStroke, type SketchCanvasHandle, type SketchSelection } from "@/components/SketchCanvas";
import { SketchFloatingBar } from "@/components/SketchFloatingBar";
import { BugReportModal } from "@/components/BugReportModal";
import { FeatureUpsellDialog } from "@/components/FeatureUpsellDialog";
import { ContextMenu } from "@/components/ContextMenu";
import { MissingImagesModal } from "@/components/MissingImagesModal";
import { NewTabModal } from "@/components/NewTabModal";
import { ImageUploadModal } from "@/lib/kiteframe/components/modals/ImageUploadModal";
import { ImageAnalysisModal } from "@/components/modals/ImageAnalysisModal";
import { ProposalPreviewContainer } from "@/components/proposal/ProposalPreviewContainer";
import { ExperimentPreviewContainer } from "@/components/experiment/ExperimentPreviewContainer";
import { LinearToolbar } from "@/lib/kiteframe/components/LinearToolbar";
import {
  QuickCreateRadialMenu,
  ShapeType,
  NodeVariantType,
} from "@/lib/kiteframe/components/QuickCreateRadialMenu";
import { TablePanel } from "@/lib/kiteframe/components/TablePanel";
import { NodeGalleryPanel } from "@/lib/kiteframe/components/NodeGalleryPanel";
import { SavedProjectsDrawer } from "@/components/SavedProjectsDrawer";
import { HomeScreen } from "@/components/HomeScreen";
import { AiProvider } from "../ai/AiProvider";
import { getRouter, clearSessionLock, createFallbackProvenance } from "../ai/router";
import { OpenAICompatClient } from "../ai/OpenAICompatClient";
import type { AiClient } from "../ai/types";
import { logPreviewTopology, logRenderedGraph, logCommitAccept, logCommitFinalGraph, warnContentContractViolation } from "../ai/workflow/experimentDebugLogger";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useFirebaseWorkflows } from "../hooks/useFirebaseWorkflows";
import { useAuth } from "../hooks/useAuth";
import { useReplitAuth } from "../hooks/useReplitAuth";
import { useCreditsGate } from "../hooks/useCreditsGate";
import { useCloudProjects } from "../hooks/useCloudProjects";
import { useSubscription } from "../hooks/useSubscription";
import { useExperimentOptions } from "../hooks/useExperimentOptions";
import type {
  Node,
  Edge,
  CanvasObject,
  ProFeaturesConfig,
  NodeType,
  TextNodeData,
  ShapeNodeData,
  StickyNoteData,
  DataTable,
  TableNodeData,
  SavedCompoundTemplate,
  TemplateStore,
} from "../lib/kiteframe/types";
import {
  FlowDetection,
  type FlowSettings,
  type FlowSettingsMap,
} from "../lib/kiteframe/utils/FlowDetection";
import { DEFAULT_SHAPE_NODE_DATA } from "../lib/kiteframe/constants/defaults";
import { recalculateAllEdgeZIndexes } from "../lib/kiteframe/utils/edgeZIndex";
import { VLStore } from "@/stores/layersStateManager";
import { AncestorsStore } from "@/components/layers/ancestorsStore";
import { isEffectivelyOn } from "@/components/layers/triStateUtils";
import {
  applyThemeToNode,
  applyThemeToEdge,
  workflowThemes,
  getThemeById,
  type WorkflowTheme,
} from "../lib/themes";
import {
  isPureBlack,
  isPureWhite,
  getOppositeTextColor,
} from "../lib/kiteframe/utils/colorUtils";
import { AI_WORKFLOW_SYSTEM_PROMPT } from "@/constants/aiWorkflowPrompt";
import { buildInterfacePromptFromWorkflow, analyzeWorkflowScreens } from "@/lib/buildInterfacePrompt";
import { InterfaceScreenPickerModal } from "@/components/InterfaceScreenPickerModal";
import { normalizeWorkflowGraph } from "@/utils/normalizeWorkflowGraph";
import "../lib/kiteframe/styles/kiteframe.css";
import {
  X,
  Plus,
  Brain,
  Workflow,
  Type,
  Shapes,
  StickyNote,
  Table2,
  FileText,
  Route,
  Palette,
  MapPin,
  Network,
  Layers,
  UserPlus,
  CircuitBoard,
  Maximize2,
  Trash2,
  Download,
  Upload,
  Menu,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutGrid,
  Share2,
  Eye,
  RotateCcw,
  Rocket,
  GitBranch,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { SiFigma } from "react-icons/si";
import { FigmaImportModal } from "@/components/modals/FigmaImportModal";
import { WorkflowGenerationPreviewModal } from "@/components/modals/WorkflowGenerationPreviewModal";
import { parseFigmaUrl } from "@/lib/integration/figmaUrl";
import {
  fetchFigmaFileMetadata,
  fetchFigmaThumbnails,
} from "@/lib/integration/figmaApi";
import {
  generateWorkflowFromFigmaSemantic,
  generateAIRefinedWorkflow,
  generateAIVisionWorkflow,
} from "@/lib/integration/semanticWorkflowGenerator";
import type { WorkflowGenerationMode } from "@/lib/integration/figmaSemanticTypes";
import {
  buildFigmaFrameWorkflow,
  insertFigmaFrames,
  type FigmaFrameWithThumbnail,
} from "@/utils/createFigmaProject";
import { addFigmaSource } from "@/lib/kiteframe/utils/sourceTracking";
import {
  sortFrameNodesForWorkflow,
  filterValidWorkflowFrames,
} from "@/lib/kiteframe/utils/workflowOrdering";
import { resetLayersState } from "@/stores/layersStateManager";
import { prdNodeLinkStore, type PRDNodeLink } from "@/stores/prdNodeLinkStore";
import { usePromptContextStoreOptional } from "@/contexts/PromptContextStore";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";
import { TrialBanner } from "@/components/TrialBanner";
import { generateWorkflowPRD } from "@/ai/prdEngine";
import { generateExperimentBranch } from "@/ai/workflow/generateExperimentBranch";
import { runDecisionRepair } from "@/ai/repair/decisionRepair";
import { isGenericNodeLabel } from "@/ai/proposal/proposalUtils";
import { applyMergeSafeChatMutation } from "@/hooks/useChatMutation";
import { detectStructuralRegression, type StructuralRegressionResult } from "@/workflow/analysis/graphStructure";
import {
  recordProposalAccepted,
  recordProposalCanceled,
  recordExperimentAccepted,
  recordExperimentDiscarded,
  recordUndo,
  ENABLE_PHASE_4_HEURISTICS,
} from "@/ai/heuristics";
import {
  captureProposalDecision,
  captureExperimentDecision,
} from "@/ai/explainability/decisionCapture";
import {
  storeDecisionSnapshot,
} from "@/ai/explainability/auditExport";
import {
  recordProposalAccept as recordProposalTimelineAccept,
  recordExperimentAccept as recordExperimentTimelineAccept,
} from "@/ai/explainability/timeline";
import {
  getSemanticAnalysis,
  shouldBlockAcceptance,
  ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT,
} from "@/ai/semantic";
import { buildExperimentContext, getAnchorNodeId } from "@/lib/kiteframe/utils/experimentContext";
import { exportWorkflow, downloadWorkflow, importWorkflow } from "@/lib/kiteframe/utils/exportImport";
import type { ExperimentNodeData, WorkflowTool, ExperimentMode } from "@/lib/kiteframe/types";
import { ExperimentTool } from "@/lib/kiteframe/components/ExperimentTool";
import { extractSemanticWorkflowModel } from "@/lib/kiteframe/utils/extractSemanticWorkflowModel";
import { probeAvailableSpace, applySpaceProbeResult } from "@/lib/kiteframe/utils/SpaceProbe";
import { normalizeNodesForExperiment, markGeneratedEdgesAsPreview, normalizeNodeForMutation, clearPreviewFlags, clearEdgePreviewFlags, ensureExperimentDefaults } from "@/lib/kiteframe/utils/experimentNormalizer";
import { withUndo } from "@/lib/kiteframe/utils/withUndo";
import {
  saveWorkflowPRD,
  saveWorkflowPRDVersion,
  saveProjectPRD,
  loadProjectPRD,
  listWorkflowPRDs,
  loadWorkflowPRD,
  deleteProjectPRD,
  deleteWorkflowPRD,
} from "@/lib/kiteframe/utils/prdStorage";
import {
  afterWorkflowCreation,
  type ProjectDetails,
} from "@/lib/kiteframe/hooks/afterWorkflowCreation";
import { prdGenerationBus } from "@/stores/prdGenerationBus";
import { QuickActions } from "@/components/QuickActions";
import { DiscussionQuickActions } from "@/components/QuickActions";
import { EdgeCaseSelector, type EdgeCase } from "@/components/EdgeCaseSelector";
import { 
  AI_WORKFLOW_EXPAND_EDGE_CASES_PROMPT, 
  AI_WORKFLOW_LIST_EDGE_CASES_PROMPT,
  AI_WORKFLOW_EXPAND_SELECTED_EDGE_CASES_PROMPT,
  AI_RESPONSE_TEMPLATES 
} from "@/constants/aiWorkflowExpansionPrompts";
import { 
  getSuggestedQuickActions, 
  analyzeWorkflowDiagnostics,
  type QuickActionType 
} from "@/utils/workflowDiagnostics";

// Project metadata types
interface ProjectLink {
  id: string;
  text: string;
  url: string;
}

interface ProjectMetadata {
  name: string;
  description: string;
  links: ProjectLink[];
  linksFormat: "bulleted" | "text";
  categories: string[];
}

// Type for a single workflow tab
interface WorkflowTab {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId: string;
  selectedEdgeId: string;
  selectedEdgeIds?: string[]; // Multi-select edge IDs (Shift+click)
  history: Array<{
    nodes: Node[];
    edges: Edge[];
    canvasObjects: CanvasObject[];
    viewport: { x: number; y: number; zoom: number };
  }>;
  historyIndex: number;
  showImageModal: string | null;
  metadata: ProjectMetadata;
  thumbnail?: string;
  lastModified?: number;
  flowSettings?: FlowSettingsMap;
  cloudProjectId?: string;
  projectUuid?: string;
  shareUuid?: string | null;
  isOpen?: boolean; // Whether tab is shown in tab bar (project stays in gallery even when closed)
  sketchStrokes?: import('@/components/SketchCanvas').SketchStroke[]; // World-space drawing annotations
  designId?: string; // Set for design tabs — renders DesignTabView inline instead of workflow canvas
  designSyncedAt?: string; // ISO timestamp: when the design was last synced from its source workflow
  designIsStale?: boolean; // True when the source workflow has been edited since last sync
  designSourceWorkflowId?: string; // cloudProjectId of the workflow that generated this design
  /** When true this tab renders InterfaceProposalView instead of the canvas. */
  interfaceProposalMode?: boolean;
  /** ID of the workflow tab that triggered the proposal (used to locate source nodes/edges). */
  interfaceProposalSourceTabId?: string;
}

// Helper to get node position and dimensions (handles different node structures)
function getNodeBounds(node: Node): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  const width = node.width ?? node.style?.width ?? 200;
  const height = node.height ?? node.style?.height ?? 100;
  return { x, y, width, height };
}

// Unicode-safe base64 encoding for SVG thumbnails
// btoa() fails on non-ASCII characters, this handles Unicode properly
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

// Generate a simple SVG thumbnail preview of the workflow
function generateWorkflowThumbnail(nodes: Node[], edges: Edge[]): string {
  if (nodes.length === 0) return "";

  // Get bounds for all nodes
  const nodeBounds = nodes.map((n) => getNodeBounds(n));

  // Find bounding box of all nodes
  const padding = 20;
  const minX = Math.min(...nodeBounds.map((b) => b.x)) - padding;
  const minY = Math.min(...nodeBounds.map((b) => b.y)) - padding;
  const maxX = Math.max(...nodeBounds.map((b) => b.x + b.width)) + padding;
  const maxY = Math.max(...nodeBounds.map((b) => b.y + b.height)) + padding;

  const width = maxX - minX;
  const height = maxY - minY;

  // Guard against invalid dimensions
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
    return "";
  }

  // Scale to fit in thumbnail size (300x200)
  const scale = Math.min(300 / width, 200 / height, 1);
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // Node type colors
  const nodeColors: Record<string, string> = {
    input: "#3b82f6",
    process: "#8b5cf6",
    condition: "#f59e0b",
    output: "#22c55e",
    ai: "#ec4899",
    image: "#06b6d4",
  };

  // Generate SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">`;
  svg += `<rect width="300" height="200" fill="#f8fafc"/>`;

  // Center the content
  const offsetX = (300 - scaledWidth) / 2;
  const offsetY = (200 - scaledHeight) / 2;

  // Draw edges first (behind nodes)
  edges.forEach((edge) => {
    const sourceIdx = nodes.findIndex((n) => n.id === edge.source);
    const targetIdx = nodes.findIndex((n) => n.id === edge.target);
    if (sourceIdx >= 0 && targetIdx >= 0) {
      const sourceBounds = nodeBounds[sourceIdx];
      const targetBounds = nodeBounds[targetIdx];
      const x1 =
        (sourceBounds.x + sourceBounds.width / 2 - minX) * scale + offsetX;
      const y1 =
        (sourceBounds.y + sourceBounds.height / 2 - minY) * scale + offsetY;
      const x2 =
        (targetBounds.x + targetBounds.width / 2 - minX) * scale + offsetX;
      const y2 =
        (targetBounds.y + targetBounds.height / 2 - minY) * scale + offsetY;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>`;
    }
  });

  // Draw nodes
  nodeBounds.forEach((bounds, idx) => {
    const node = nodes[idx];
    const x = (bounds.x - minX) * scale + offsetX;
    const y = (bounds.y - minY) * scale + offsetY;
    const w = bounds.width * scale;
    const h = bounds.height * scale;
    const color = nodeColors[node.type || "process"] || "#64748b";

    if (node.type === "condition") {
      // Diamond shape for conditions
      const cx = x + w / 2;
      const cy = y + h / 2;
      svg += `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="${color}" opacity="0.8"/>`;
    } else {
      // Rounded rectangle for other nodes
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${color}" opacity="0.8"/>`;
    }
  });

  svg += `</svg>`;

  // Convert to data URL using Unicode-safe encoding
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

interface WorkflowEditorContentProps {
  onAiSettingsChange?: () => void;
  mode?: "edit" | "view";
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialCanvasObjects?: CanvasObject[];
  initialViewport?: { x: number; y: number; zoom: number };
  initialProjectName?: string;
  initialProjectDescription?: string;
  onReset?: () => void;
}

// A name the cloud auto-save/snapshot mirror generated for an unnamed project,
// e.g. "Untitled", "Untitled — 2026-06-04", or a legacy "Auto-save ..." row.
// These must never overwrite a real name the user typed when we pull/hydrate
// a cloud copy back into an open tab.
function isPlaceholderProjectName(n?: string | null): boolean {
  if (!n) return true;
  const t = n.trim();
  if (!t) return true;
  if (t === "Untitled") return true;
  if (/^Untitled\s*—\s*\d{4}-\d{2}-\d{2}$/.test(t)) return true;
  if (/^Auto-save\b/.test(t)) return true;
  return false;
}

// Choose the name to keep when reconciling a cloud copy with an open tab.
// Prefer the cloud name, but never let a placeholder cloud name clobber a
// meaningful local name (the source of the "Untitled — date" overwrite bug).
function pickSyncedName(cloudName?: string | null, localName?: string): string {
  if (isPlaceholderProjectName(cloudName) && !isPlaceholderProjectName(localName)) {
    return localName as string;
  }
  return (cloudName as string) || localName || "";
}

function WorkflowEditorContent({
  onAiSettingsChange,
  mode = "edit",
  initialNodes,
  initialEdges,
  initialCanvasObjects,
  initialViewport,
  initialProjectName,
  initialProjectDescription,
  onReset,
}: WorkflowEditorContentProps) {
  const isReadOnly = mode === "view";
  const isPhoneViewOnly = useIsPhone();
  const effectiveReadOnly = isReadOnly || isPhoneViewOnly;
  const { toast } = useToast();
  const promptContextStore = usePromptContextStoreOptional();
  
  // Phase 6.7: Decision Repair feature flag
  // Only run repairs when flag is loaded AND enabled - prevents running during loading state
  const { enabled: decisionRepairEnabled, isLoading: decisionRepairLoading } = useFeatureFlag('ai.decisionRepair');
  const shouldRunDecisionRepair = decisionRepairEnabled && !decisionRepairLoading;

  // URL routing for project UUID
  const { projectUuid } = useParams<{ projectUuid?: string }>();
  const [, setLocation] = useLocation();
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const projectLoadedRef = useRef(false);
  const {
    isOutOfCredits,
    ctaMessage,
    ctaAction,
    ctaButtonText,
    openSignup,
    openCreditsDialog,
  } = useCreditsGate();

  const { isPro, isAdmin, isAdvanced, tier: subscriptionTier } = useSubscription();
  const { isAuthenticated } = useAuth();
  const { user: serverUser, isLoading: serverUserLoading } = useReplitAuth();

  // Compute a per-user localStorage key to isolate each account's projects.
  // Falls back to the legacy unnamespaced key for unauthenticated (anonymous) sessions.
  const storageKey = serverUser?.id
    ? `kiteframe_workflows_${serverUser.id}`
    : 'kiteframe_workflows';

  // Stable ref so save/load callbacks always read the current key without needing
  // to be rebuilt whenever the user identity resolves.
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  // Mirror the user ID in a ref for the migration check inside loadFromLocalStorage.
  const userIdRef = useRef<string | null>(serverUser?.id ?? null);
  userIdRef.current = serverUser?.id ?? null;

  const {
    projects: cloudProjects,
    isLoading: cloudProjectsLoading,
    hasCloudAccess,
    isCloudConnected,
    lastSyncError,
    createProject: createCloudProject,
    updateProject: updateCloudProject,
    deleteProject: deleteCloudProject,
    refetch: refetchCloudProjects,
    isSaving: isCloudSaving,
  } = useCloudProjects();

  // AI Client wrapper that adapts the router to AiClient interface for legacy hooks
  const routerAiClient = useMemo<AiClient>(() => ({
    chat: async (req) => {
      const router = getRouter();
      const response = await router.chat({
        taskType: (req.taskType as 'workflow_reasoning' | 'workflow_experiments' | 'prd_generation' | 'vision_ingestion' | 'general_chat') || 'general_chat',
        messages: req.messages,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
      });
      return { text: response.text };
    },
  }), []);

  // Session ID refs for proposal and experiment flows (Phase A - Session Locking)
  const proposalSessionIdRef = useRef<string | null>(null);
  const experimentSessionIdRef = useRef<string | null>(null);

  // Editor Settings State with persistence
  const [editorSettings, setEditorSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("kiteframe-editor-settings");
      const defaults = {
        nodeAutoConnect: false,
        snapToGuides: false,
      };
      return saved
        ? { ...defaults, ...JSON.parse(saved) }
        : defaults;
    } catch {
      return {
        nodeAutoConnect: false,
        snapToGuides: false,
      };
    }
  });

  // Save editor settings to localStorage
  useEffect(() => {
    localStorage.setItem(
      "kiteframe-editor-settings",
      JSON.stringify(editorSettings),
    );
  }, [editorSettings]);

  // Pro Features Configuration (now reactive to editor settings)
  const proFeaturesConfig: ProFeaturesConfig = useMemo(
    () => ({
      quickAdd: {
        enabled: true,
        showGhostPreview: true,
        defaultSpacing: 250,
        defaultNodeType: "process",
        defaultNodeTemplate: {
          label: "New Process",
          description: "Configure process settings",
          icon: "Cog",
          iconColor: "text-gray-500",
        },
        onQuickAdd: (sourceNode, position, newNode) => {
          toast({
            title: "Node Added",
            description: `Added ${newNode.data?.label} to the ${position} of ${sourceNode.data?.label}`,
          });
        },
      },
      copyPaste: {
        enabled: true,
        offsetDistance: 50,
        onCopy: (node) => {
          toast({
            title: "Node Copied",
            description: `${node.data?.label} copied to clipboard`,
          });
        },
        onPaste: (originalNode, newNode) => {
          toast({
            title: "Node Pasted",
            description: `${newNode.data?.label} pasted from ${originalNode.data?.label}`,
          });
        },
      },
      advancedSelection: {
        enabled: true,
        enableMultiSelect: true,
        enableShiftDragSelection: true,
        selectionRectStyle: {
          border: "2px dashed #3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderRadius: "4px",
        },
      },
      versionControl: {
        enabled: true,
        autoSaveInterval: 30000,
        maxSnapshots: 50,
        enableComparison: true,
        onSnapshot: (snapshot) => {},
      },
      edgeReconnection: {
        enabled: true,
        enableAllEdges: true, // Make all edges reconnectable by default
        visualFeedback: {
          handleColor: "#3b82f6",
          previewColor: "#3b82f6",
          validColor: "#22c55e",
          invalidColor: "#ef4444",
        },
      },
      smartGuides: {
        enabled: editorSettings.snapToGuides,
        threshold: 10,
        showGuides: editorSettings.snapToGuides,
        snapToNodes: editorSettings.snapToGuides,
        snapToGrid: false,
        gridSize: 20,
        snapToCanvas: editorSettings.snapToGuides,
      },
      smartConnect: {
        enabled: editorSettings.nodeAutoConnect,
        threshold: 50,
        autoConnect: editorSettings.nodeAutoConnect,
        showPreview: editorSettings.nodeAutoConnect,
      },
    }),
    [editorSettings],
  );

  // Generate unique ID for tabs
  const generateTabId = useCallback(
    () => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    [],
  );

  // Generate cute workflow names
  const generateCuteName = useCallback(() => {
    const adjectives = [
      "Sunny",
      "Happy",
      "Magic",
      "Bright",
      "Cozy",
      "Sweet",
      "Clever",
      "Gentle",
      "Peaceful",
      "Cheerful",
      "Dreamy",
      "Sparkly",
      "Golden",
      "Fresh",
      "Lovely",
    ];
    const nouns = [
      "Adventure",
      "Journey",
      "Flow",
      "Quest",
      "Path",
      "Dream",
      "Story",
      "Project",
      "Creation",
      "Vision",
      "Wonder",
      "Discovery",
      "Symphony",
      "Garden",
      "Blueprint",
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
  }, []);

  // Generate random 3-node workflow
  const generateRandomWorkflow = useCallback(() => {
    const nodeTypes = [
      {
        type: "input",
        icon: "ArrowRight",
        iconColor: "text-blue-500",
        labels: ["Data Source", "Input Stream", "Raw Data", "User Input"],
        descriptions: [
          "Data source configuration",
          "Incoming data stream",
          "Raw data collection",
          "User input validation",
        ],
      },
      {
        type: "process",
        icon: "Cog",
        iconColor: "text-gray-500",
        labels: ["Transform", "Process", "Filter", "Validate"],
        descriptions: [
          "Data transformation",
          "Process workflow step",
          "Filter and clean data",
          "Validate input data",
        ],
      },
      {
        type: "condition",
        icon: "HelpCircle",
        iconColor: "text-yellow-500",
        labels: ["Decision", "Check", "Condition", "Branch"],
        descriptions: [
          "Evaluate condition logic",
          "Check data quality",
          "Conditional branching",
          "Decision point",
        ],
      },
      {
        type: "output",
        icon: "ArrowLeft",
        iconColor: "text-red-500",
        labels: ["Result", "Export", "Save", "Output"],
        descriptions: [
          "Final result destination",
          "Export processed data",
          "Save to database",
          "Output data stream",
        ],
      },
      {
        type: "ai",
        icon: "Bot",
        iconColor: "text-purple-500",
        labels: ["AI Model", "ML Process", "Neural Net", "Analysis"],
        descriptions: [
          "Process data with AI\nModel: GPT-4o",
          "Machine learning processing",
          "Neural network analysis",
          "AI-powered analysis",
        ],
      },
      {
        type: "image",
        icon: "Image",
        iconColor: "text-green-500",
        labels: ["Visual", "Chart", "Diagram", "Image"],
        descriptions: [
          "Visual representation",
          "Generate chart or graph",
          "Create diagram",
          "Image processing",
        ],
      },
    ];

    // Randomly select 3 different node types
    const shuffled = [...nodeTypes].sort(() => 0.5 - Math.random());
    const selectedTypes = shuffled.slice(0, 3);

    // Generate random positions in a flowing layout
    const positions = [
      { x: 150 + Math.random() * 100, y: 80 + Math.random() * 40 },
      { x: 400 + Math.random() * 100, y: 80 + Math.random() * 40 },
      { x: 275 + Math.random() * 100, y: 250 + Math.random() * 40 },
    ];

    // Create nodes
    const nodes = selectedTypes.map((nodeType, index) => {
      const randomLabel =
        nodeType.labels[Math.floor(Math.random() * nodeType.labels.length)];
      const randomDesc =
        nodeType.descriptions[
          Math.floor(Math.random() * nodeType.descriptions.length)
        ];
      return {
        id: `node-${index + 1}`,
        type: nodeType.type,
        position: positions[index],
        data: {
          label: randomLabel,
          description: randomDesc,
          icon: nodeType.icon,
          iconColor: nodeType.iconColor,
        },
        width: 200,
        height: nodeType.type === "ai" ? 120 : 100,
      };
    });

    // Create edges between the nodes (linear flow: 1->2->3)
    const edgeTypes = ["bezier", "straight"] as const;
    const colors = [
      "hsl(221.2, 83.2%, 53.3%)",
      "hsl(142.1, 76.2%, 36.3%)",
      "hsl(262.1, 83.3%, 57.8%)",
      "hsl(346.8, 77.2%, 49.8%)",
    ];

    const edges: Edge[] = [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        animated: Math.random() > 0.5,
        style: {
          strokeColor: colors[Math.floor(Math.random() * colors.length)],
          strokeWidth: 2,
        },
        markers: { type: "arrow" as const, position: "end" as const },
      },
      {
        id: "edge-2",
        source: "node-2",
        target: "node-3",
        type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        animated: Math.random() > 0.5,
        style: {
          strokeColor: colors[Math.floor(Math.random() * colors.length)],
          strokeWidth: 2,
        },
        markers: { type: "arrow" as const, position: "end" as const },
      },
    ];

    return { nodes, edges };
  }, []);

  // Generate User Journey template (fixed, no randomisation)
  const generateUserJourneyTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const steps = [
      { label: "Discovery", touchpoint: "Social Media / Blog", emotion: "Curious", icon: "Search" },
      { label: "Research", touchpoint: "Website / Product Demo", emotion: "Interested", icon: "User" },
      { label: "Consideration", touchpoint: "Reviews / Comparison", emotion: "Evaluating", icon: "User" },
      { label: "Purchase", touchpoint: "Checkout / Sales Call", emotion: "Confident", icon: "User" },
      { label: "Advocacy", touchpoint: "Referrals / Reviews", emotion: "Loyal", icon: "Star" },
    ];

    const nodes = steps.map((step, index) => ({
      id: `step-${index + 1}`,
      type: index === 0 ? "input" : index === steps.length - 1 ? "output" : "process",
      position: { x: 150 + index * 350, y: 200 },
      data: {
        label: step.label,
        description: `${step.touchpoint}\nFeeling: ${step.emotion}`,
        icon: index === 0 ? "ArrowRight" : index === steps.length - 1 ? "Star" : step.icon,
        iconColor: index === 0 ? "text-blue-500" : index === steps.length - 1 ? "text-amber-500" : "text-green-500",
      },
      width: 200,
      height: 100,
    }));

    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `journey-edge-${i + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: "bezier" as const,
        animated: true,
        style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    }

    return { nodes, edges };
  }, []);

  // Generate Getting Started template
  const generateGettingStartedTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    // ── Section 1: Node type tour ──────────────────────────────────────────
    const tourNodes: Node[] = [
      {
        id: "tour-input",
        type: "input",
        position: { x: 100, y: 80 },
        data: {
          label: "Input Node",
          description: "Where a workflow begins — a trigger, form submission, or incoming request.",
          icon: "ArrowRight",
          iconColor: "text-blue-500",
        },
        width: 200,
        height: 110,
      },
      {
        id: "tour-process",
        type: "process",
        position: { x: 360, y: 80 },
        data: {
          label: "Process Node",
          description: "A step that transforms, validates, or acts on data.",
          icon: "Cog",
          iconColor: "text-green-500",
        },
        width: 200,
        height: 110,
      },
      {
        id: "tour-condition",
        type: "condition",
        position: { x: 620, y: 80 },
        data: {
          label: "Condition Node",
          description: "A decision point — routes flow based on a Yes/No or if/then rule.",
          icon: "HelpCircle",
          iconColor: "text-amber-500",
        },
        width: 200,
        height: 110,
      },
      {
        id: "tour-output",
        type: "output",
        position: { x: 880, y: 80 },
        data: {
          label: "Output Node",
          description: "The end result — a notification sent, a record saved, or a response returned.",
          icon: "CheckCircle",
          iconColor: "text-red-500",
        },
        width: 200,
        height: 110,
      },
      {
        id: "tour-ai",
        type: "ai",
        position: { x: 1140, y: 80 },
        data: {
          label: "AI Node",
          description: "An AI-powered step — analysis, generation, classification, or summarisation.",
          icon: "Zap",
          iconColor: "text-purple-500",
        },
        width: 200,
        height: 110,
      },
    ];

    // ── Divider label between sections ────────────────────────────────────
    const dividerNode: Node = {
      id: "divider-label",
      type: "process",
      position: { x: 100, y: 240 },
      data: {
        label: "Working Example: Feature Request to Launch",
        description: "See how a real workflow connects — from an idea submitted to AI-powered measurement.",
        icon: "ArrowRight",
        iconColor: "text-primary",
      },
      width: 1240,
      height: 60,
    };

    // ── Section 2: Working example — Feature Request to Launch ─────────────
    const exampleNodes: Node[] = [
      {
        id: "ex-idea",
        type: "input",
        position: { x: 100, y: 340 },
        data: {
          label: "Idea Submitted",
          description: "A user or stakeholder submits a feature request.",
          icon: "ArrowRight",
          iconColor: "text-blue-500",
        },
        width: 200,
        height: 100,
      },
      {
        id: "ex-review",
        type: "process",
        position: { x: 360, y: 340 },
        data: {
          label: "PM Review",
          description: "Product manager evaluates impact, effort, and alignment.",
          icon: "User",
          iconColor: "text-green-500",
        },
        width: 200,
        height: 100,
      },
      {
        id: "ex-approved",
        type: "condition",
        position: { x: 620, y: 340 },
        data: {
          label: "Approved?",
          description: "Is the feature prioritised for the current cycle?",
          icon: "HelpCircle",
          iconColor: "text-amber-500",
        },
        width: 200,
        height: 100,
      },
      {
        id: "ex-build",
        type: "process",
        position: { x: 880, y: 280 },
        data: {
          label: "Build Sprint",
          description: "Engineering builds and QA tests the feature.",
          icon: "Cog",
          iconColor: "text-green-500",
        },
        width: 200,
        height: 100,
      },
      {
        id: "ex-launch",
        type: "output",
        position: { x: 1140, y: 280 },
        data: {
          label: "Launch",
          description: "Feature ships to users via a staged or full release.",
          icon: "CheckCircle",
          iconColor: "text-red-500",
        },
        width: 200,
        height: 100,
      },
      {
        id: "ex-measure",
        type: "ai",
        position: { x: 1140, y: 420 },
        data: {
          label: "Measure Impact",
          description: "AI analyses usage metrics and surfaces insight for the next cycle.",
          icon: "Zap",
          iconColor: "text-purple-500",
        },
        width: 200,
        height: 100,
      },
      {
        id: "ex-backlog",
        type: "output",
        position: { x: 880, y: 430 },
        data: {
          label: "Added to Backlog",
          description: "Not approved this cycle — parked for future consideration.",
          icon: "ArrowLeft",
          iconColor: "text-slate-400",
        },
        width: 200,
        height: 100,
      },
    ];

    const nodes: Node[] = [...tourNodes, dividerNode, ...exampleNodes];

    const edges: Edge[] = [
      // Example flow — main path
      { id: "ex-e1", source: "ex-idea", target: "ex-review", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
      { id: "ex-e2", source: "ex-review", target: "ex-approved", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
      { id: "ex-e3", source: "ex-approved", target: "ex-build", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "Yes" },
      { id: "ex-e4", source: "ex-approved", target: "ex-backlog", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(220, 13%, 69%)", strokeWidth: 2, strokeDasharray: "5,5" }, markers: { type: "arrow" as const, position: "end" as const }, label: "No" },
      { id: "ex-e5", source: "ex-build", target: "ex-launch", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
      { id: "ex-e6", source: "ex-launch", target: "ex-measure", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(262.1, 83.3%, 57.8%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
    ];

    return { nodes, edges };
  }, []);

  // Generate Product Roadmap template
  const generateProductRoadmapTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const columns = [
      {
        label: "Now",
        color: "text-green-500",
        x: 100,
        items: [
          { label: "User Auth Revamp", desc: "Streamline signup and SSO integration" },
          { label: "Performance Audit", desc: "Identify and fix top 5 slowest pages" },
          { label: "Mobile Responsive", desc: "Ensure core flows work on all screen sizes" },
        ],
      },
      {
        label: "Next",
        color: "text-blue-500",
        x: 420,
        items: [
          { label: "Dashboard V2", desc: "Redesigned analytics and key metrics view" },
          { label: "API V2 Launch", desc: "New versioned public API with rate limits" },
          { label: "Notification Centre", desc: "In-app alerts for key events" },
        ],
      },
      {
        label: "Later",
        color: "text-slate-400",
        x: 740,
        items: [
          { label: "AI Recommendations", desc: "ML-powered personalisation layer" },
          { label: "Enterprise SSO", desc: "SAML and SCIM provisioning" },
          { label: "Offline Mode", desc: "Local-first sync for mobile clients" },
        ],
      },
    ];

    const nodes: Node[] = [];

    columns.forEach((col) => {
      // Column header node
      nodes.push({
        id: `col-${col.label.toLowerCase()}`,
        type: "input",
        position: { x: col.x, y: 60 },
        data: {
          label: col.label,
          description: `${col.label === "Now" ? "Current quarter" : col.label === "Next" ? "Next quarter" : "Future quarters"}`,
          icon: col.label === "Now" ? "Zap" : col.label === "Next" ? "ArrowRight" : "Clock",
          iconColor: col.color,
        },
        width: 260,
        height: 80,
      });

      // Milestone nodes
      col.items.forEach((item, i) => {
        nodes.push({
          id: `milestone-${col.label.toLowerCase()}-${i}`,
          type: "process",
          position: { x: col.x, y: 200 + i * 140 },
          data: {
            label: item.label,
            description: item.desc,
            icon: "CheckCircle",
            iconColor: col.color,
          },
          width: 260,
          height: 100,
        });
      });
    });

    // No edges for a roadmap — columns are visually separate
    return { nodes, edges: [] };
  }, []);

  // Generate OKR Planning template
  const generateOKRPlanningTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const objective = {
      id: "obj-1",
      label: "Become the #1 tool for product teams",
      desc: "Increase market share and user satisfaction in the product-management segment",
    };

    const keyResults = [
      { id: "kr-1", label: "Reach 10k active workspaces", desc: "Measured by monthly active workspaces with ≥1 edit", metric: "8.2k → 10k" },
      { id: "kr-2", label: "NPS score above 50", desc: "Quarterly in-app survey across all paid tiers", metric: "42 → 50" },
      { id: "kr-3", label: "Reduce time-to-first-workflow to < 3 min", desc: "From signup to first saved workflow in the editor", metric: "6 min → 3 min" },
    ];

    const metrics = [
      { id: "m-1", label: "New signups per week", desc: "Target: +15% QoQ growth rate", krId: "kr-1" },
      { id: "m-2", label: "Churn rate < 3%", desc: "Monthly involuntary + voluntary churn combined", krId: "kr-2" },
      { id: "m-3", label: "Onboarding completion rate", desc: "% of signups who complete the first workflow", krId: "kr-3" },
    ];

    const nodes: Node[] = [
      {
        id: objective.id,
        type: "input",
        position: { x: 500, y: 60 },
        data: { label: objective.label, description: objective.desc, icon: "Target", iconColor: "text-purple-500" },
        width: 300,
        height: 110,
      },
      ...keyResults.map((kr, i) => ({
        id: kr.id,
        type: "process" as const,
        position: { x: 150 + i * 380, y: 260 },
        data: { label: kr.label, description: `${kr.desc}\n\nProgress: ${kr.metric}`, icon: "TrendingUp", iconColor: "text-blue-500" },
        width: 280,
        height: 120,
      })),
      ...metrics.map((m, i) => ({
        id: m.id,
        type: "output" as const,
        position: { x: 150 + i * 380, y: 470 },
        data: { label: m.label, description: m.desc, icon: "BarChart", iconColor: "text-green-500" },
        width: 280,
        height: 100,
      })),
    ];

    const edges: Edge[] = [
      ...keyResults.map((kr) => ({
        id: `e-obj-${kr.id}`,
        source: objective.id,
        target: kr.id,
        type: "bezier" as const,
        animated: false,
        style: { strokeColor: "hsl(262.1, 83.3%, 57.8%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      })),
      ...metrics.map((m) => ({
        id: `e-kr-${m.id}`,
        source: m.krId,
        target: m.id,
        type: "bezier" as const,
        animated: false,
        style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      })),
    ];

    return { nodes, edges };
  }, []);

  // Generate Feature Request Flow template
  const generateFeatureRequestFlowTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const nodes: Node[] = [
      {
        id: "fr-idea",
        type: "input",
        position: { x: 100, y: 200 },
        data: { label: "Idea Submitted", description: "User, customer, or internal stakeholder submits a feature request via the product portal.", icon: "ArrowRight", iconColor: "text-blue-500" },
        width: 220,
        height: 110,
      },
      {
        id: "fr-scoping",
        type: "process",
        position: { x: 380, y: 200 },
        data: { label: "Scoping", description: "PM writes a brief — problem statement, target users, success criteria, and rough sizing.", icon: "FileText", iconColor: "text-green-500" },
        width: 220,
        height: 110,
      },
      {
        id: "fr-priority",
        type: "condition",
        position: { x: 660, y: 200 },
        data: { label: "Prioritised?", description: "Does this feature make the cut for the current or next quarter based on impact vs. effort?", icon: "HelpCircle", iconColor: "text-amber-500" },
        width: 220,
        height: 110,
      },
      {
        id: "fr-build",
        type: "process",
        position: { x: 940, y: 120 },
        data: { label: "Build Sprint", description: "Engineering designs, builds, and tests the feature. PM reviews progress at key milestones.", icon: "Cog", iconColor: "text-green-500" },
        width: 220,
        height: 110,
      },
      {
        id: "fr-launch",
        type: "output",
        position: { x: 1220, y: 120 },
        data: { label: "Launch", description: "Feature ships — staged rollout, release notes, and customer comms go out.", icon: "CheckCircle", iconColor: "text-red-500" },
        width: 220,
        height: 110,
      },
      {
        id: "fr-retro",
        type: "ai",
        position: { x: 1220, y: 280 },
        data: { label: "Retrospective", description: "AI surfaces usage metrics, adoption rate, and qualitative feedback to inform the next iteration.", icon: "Zap", iconColor: "text-purple-500" },
        width: 220,
        height: 110,
      },
      {
        id: "fr-backlog",
        type: "output",
        position: { x: 940, y: 320 },
        data: { label: "Parked in Backlog", description: "Not this cycle — added to the backlog with context preserved for future re-evaluation.", icon: "ArrowLeft", iconColor: "text-slate-400" },
        width: 220,
        height: 110,
      },
    ];

    const edges: Edge[] = [
      { id: "fr-e1", source: "fr-idea", target: "fr-scoping", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
      { id: "fr-e2", source: "fr-scoping", target: "fr-priority", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
      { id: "fr-e3", source: "fr-priority", target: "fr-build", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "Yes" },
      { id: "fr-e4", source: "fr-priority", target: "fr-backlog", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(220, 13%, 69%)", strokeWidth: 2, strokeDasharray: "5,5" }, markers: { type: "arrow" as const, position: "end" as const }, label: "No" },
      { id: "fr-e5", source: "fr-build", target: "fr-launch", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
      { id: "fr-e6", source: "fr-launch", target: "fr-retro", type: "bezier" as const, animated: true, style: { strokeColor: "hsl(262.1, 83.3%, 57.8%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const } },
    ];

    return { nodes, edges };
  }, []);

  // Generate Decision Tree template
  const generateDecisionTreeTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const nodes: Node[] = [
      // Root
      {
        id: "dt-root",
        type: "condition",
        position: { x: 500, y: 60 },
        data: { label: "Is the user authenticated?", description: "Check whether the current user has a valid session before proceeding.", icon: "HelpCircle", iconColor: "text-amber-500" },
        width: 260,
        height: 110,
      },
      // Yes branch
      {
        id: "dt-yes",
        type: "condition",
        position: { x: 200, y: 260 },
        data: { label: "Has an active subscription?", description: "Check the user's billing status and tier.", icon: "HelpCircle", iconColor: "text-amber-500" },
        width: 240,
        height: 110,
      },
      {
        id: "dt-yes-yes",
        type: "output",
        position: { x: 60, y: 460 },
        data: { label: "Grant Full Access", description: "User is authenticated and on a paid plan — show all features.", icon: "CheckCircle", iconColor: "text-green-500" },
        width: 220,
        height: 100,
      },
      {
        id: "dt-yes-no",
        type: "output",
        position: { x: 320, y: 460 },
        data: { label: "Show Upgrade Prompt", description: "User is logged in but on the free tier — surface the upgrade CTA.", icon: "ArrowRight", iconColor: "text-blue-500" },
        width: 220,
        height: 100,
      },
      // No branch
      {
        id: "dt-no",
        type: "condition",
        position: { x: 800, y: 260 },
        data: { label: "Accessing a public page?", description: "Is the target route accessible without authentication?", icon: "HelpCircle", iconColor: "text-amber-500" },
        width: 240,
        height: 110,
      },
      {
        id: "dt-no-yes",
        type: "output",
        position: { x: 660, y: 460 },
        data: { label: "Render Public Page", description: "Route is public — serve the page without requiring login.", icon: "CheckCircle", iconColor: "text-green-500" },
        width: 220,
        height: 100,
      },
      {
        id: "dt-no-no",
        type: "output",
        position: { x: 920, y: 460 },
        data: { label: "Redirect to Login", description: "Route requires auth — redirect to the login page with a return URL.", icon: "ArrowLeft", iconColor: "text-red-500" },
        width: 220,
        height: 100,
      },
    ];

    const edges: Edge[] = [
      { id: "dt-e1", source: "dt-root", target: "dt-yes", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "Yes" },
      { id: "dt-e2", source: "dt-root", target: "dt-no", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(220, 13%, 69%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "No" },
      { id: "dt-e3", source: "dt-yes", target: "dt-yes-yes", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "Yes" },
      { id: "dt-e4", source: "dt-yes", target: "dt-yes-no", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(220, 13%, 69%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "No" },
      { id: "dt-e5", source: "dt-no", target: "dt-no-yes", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "Yes" },
      { id: "dt-e6", source: "dt-no", target: "dt-no-no", type: "bezier" as const, animated: false, style: { strokeColor: "hsl(220, 13%, 69%)", strokeWidth: 2 }, markers: { type: "arrow" as const, position: "end" as const }, label: "No" },
    ];

    return { nodes, edges };
  }, []);

  // Generate Mindmap template
  const generateMindmapTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const centralTopics = [
      "Product Strategy",
      "Marketing Plan",
      "Business Model",
      "User Research",
      "Project Goals",
      "Innovation Ideas",
      "Team Structure",
      "Growth Strategy",
    ];

    const subtopics = [
      "Market Analysis",
      "Customer Segments",
      "Features",
      "Pricing",
      "Channels",
      "Resources",
      "Timeline",
      "Metrics",
      "Risks",
      "Opportunities",
      "Partnerships",
      "Technology",
      "Design",
      "Operations",
      "Finance",
      "Legal",
      "Quality",
    ];

    const centralTopic =
      centralTopics[Math.floor(Math.random() * centralTopics.length)];
    const selectedSubtopics = subtopics
      .sort(() => 0.5 - Math.random())
      .slice(0, 6);

    const nodes = [
      {
        id: "central",
        type: "process",
        position: { x: 600, y: 300 },
        data: {
          label: centralTopic,
          description: "Central topic",
          icon: "Target",
          iconColor: "text-purple-500",
        },
        width: 200,
        height: 100,
      },
    ];

    const angles = [0, 60, 120, 180, 240, 300].slice(
      0,
      selectedSubtopics.length,
    );
    selectedSubtopics.forEach((topic, index) => {
      const angle = (angles[index] * Math.PI) / 180;
      const radius = 350;
      const x = 500 + radius * Math.cos(angle);
      const y = 250 + radius * Math.sin(angle);

      nodes.push({
        id: `branch-${index + 1}`,
        type: "condition",
        position: { x, y },
        data: {
          label: topic,
          description: `Branch: ${topic}`,
          icon: "GitBranch",
          iconColor: "text-blue-500",
        },
        width: 180,
        height: 90,
      });
    });

    const edges: Edge[] = [];
    for (let i = 1; i < nodes.length; i++) {
      edges.push({
        id: `mind-edge-${i}`,
        source: "central",
        target: nodes[i].id,
        type: "straight" as const,
        animated: false,
        style: { strokeColor: "hsl(262.1, 83.3%, 57.8%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    }

    return { nodes, edges };
  }, []);

  // Generate System Architecture template
  const generateSystemArchitectureTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const systems = [
      "Load Balancer",
      "API Gateway",
      "Web Server",
      "Application Server",
      "Database",
      "Cache Layer",
      "Message Queue",
      "File Storage",
      "CDN",
      "Authentication Service",
      "Monitoring",
      "Analytics",
      "Backup System",
    ];

    const selectedSystems = systems.sort(() => 0.5 - Math.random()).slice(0, 6);
    const layers = [
      { y: 100, label: "Presentation Layer" },
      { y: 200, label: "API Layer" },
      { y: 300, label: "Business Logic" },
      { y: 400, label: "Data Layer" },
    ];

    const nodes = selectedSystems.map((system, index) => {
      const layer = layers[Math.floor(index / 2) % layers.length];
      const xOffset = (index % 2) * 400 + 200;

      return {
        id: `sys-${index + 1}`,
        type: "process",
        position: { x: xOffset, y: layer.y + Math.random() * 50 },
        data: {
          label: system,
          description: `${layer.label}\nComponent: ${system}`,
          icon: "Server",
          iconColor: "text-orange-500",
        },
        width: 200,
        height: 100,
      };
    });

    const edges: Edge[] = [];

    // Guarantee base chain of connections
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `sys-edge-${edges.length + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: "bezier" as const,
        animated: false,
        style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    }

    // Add optional extra connections for complexity
    for (let i = 0; i < nodes.length - 2; i++) {
      if (Math.random() > 0.6) {
        // 40% chance of skip connections
        edges.push({
          id: `sys-edge-${edges.length + 1}`,
          source: nodes[i].id,
          target: nodes[i + 2].id,
          type: "bezier" as const,
          animated: false,
          style: { strokeColor: "hsl(262.1, 83.3%, 57.8%)", strokeWidth: 1 },
          markers: { type: "arrow" as const, position: "end" as const },
        });
      }
    }

    return { nodes, edges };
  }, []);

  // Generate Swim Lanes template
  const generateSwimLanesTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const lanes = [
      "Customer",
      "Sales Team",
      "Marketing",
      "Support",
      "Development",
      "Management",
      "Finance",
      "Operations",
      "Legal",
      "Design",
    ];

    const activities = [
      "Submit Request",
      "Review Application",
      "Approve Process",
      "Create Account",
      "Send Notification",
      "Generate Report",
      "Schedule Meeting",
      "Update Status",
      "Verify Information",
      "Complete Task",
      "Archive Records",
      "Follow Up",
    ];

    // Generate 4-7 total nodes across 3 lanes
    const selectedLanes = lanes.sort(() => 0.5 - Math.random()).slice(0, 3);
    const totalNodes = 4 + Math.floor(Math.random() * 4); // 4-7 nodes
    const selectedActivities = activities
      .sort(() => 0.5 - Math.random())
      .slice(0, totalNodes);

    const nodes: Node[] = [];
    const laneNodes: { [laneIndex: number]: string[] } = {};
    const laneHeight = 150;

    // Distribute activities across lanes ensuring each lane has at least 1 node
    selectedLanes.forEach((lane, laneIndex) => {
      laneNodes[laneIndex] = [];
    });

    selectedActivities.forEach((activity, actIndex) => {
      const laneIndex =
        actIndex < selectedLanes.length
          ? actIndex // First activities go to different lanes
          : Math.floor(Math.random() * selectedLanes.length); // Rest distributed randomly

      const activityIndexInLane = laneNodes[laneIndex].length;
      const nodeId = `lane-${laneIndex}-act-${activityIndexInLane}`;
      laneNodes[laneIndex].push(nodeId);

      nodes.push({
        id: nodeId,
        type: activityIndexInLane === 0 ? "input" : "process",
        position: {
          x: 250 + activityIndexInLane * 350,
          y: 150 + laneIndex * laneHeight,
        },
        data: {
          label: activity,
          description: `Lane: ${selectedLanes[laneIndex]}\nActivity: ${activity}`,
          icon: activityIndexInLane === 0 ? "ArrowRight" : "Activity",
          iconColor: `hsl(${laneIndex * 120}, 70%, 50%)`,
        },
        width: 200,
        height: 90,
      });
    });

    const edges: Edge[] = [];

    // Connect nodes within each lane
    Object.keys(laneNodes).forEach((laneIndexStr) => {
      const laneIndex = parseInt(laneIndexStr);
      const nodesInLane = laneNodes[laneIndex];

      for (let i = 0; i < nodesInLane.length - 1; i++) {
        edges.push({
          id: `swim-edge-lane-${laneIndex}-${i}`,
          source: nodesInLane[i],
          target: nodesInLane[i + 1],
          type: "bezier" as const,
          animated: true,
          style: {
            strokeColor: `hsl(${laneIndex * 120}, 70%, 50%)`,
            strokeWidth: 2,
          },
          markers: { type: "arrow" as const, position: "end" as const },
        });
      }
    });

    // Add optional cross-lane handoffs for semantic workflow
    if (selectedLanes.length >= 2 && Math.random() > 0.4) {
      const lane1Nodes = laneNodes[0];
      const lane2Nodes = laneNodes[1];

      if (lane1Nodes.length > 0 && lane2Nodes.length > 0) {
        edges.push({
          id: "swim-edge-handoff-1",
          source: lane1Nodes[lane1Nodes.length - 1], // Last node in first lane
          target: lane2Nodes[0], // First node in second lane
          type: "bezier" as const,
          animated: false,
          style: {
            strokeColor: "hsl(346.8, 77.2%, 49.8%)",
            strokeWidth: 2,
            strokeDasharray: "5,5",
          },
          markers: { type: "arrow" as const, position: "end" as const },
        });
      }
    }

    return { nodes, edges };
  }, []);

  // Generate User Account Creation template
  const generateUserAccountTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const steps = [
      "Registration Form",
      "Email Verification",
      "Profile Setup",
      "Preferences",
      "Welcome Tour",
      "First Login",
      "Account Activation",
      "Security Setup",
    ];

    const validationSteps = [
      "Validate Email",
      "Check Password Strength",
      "Verify Phone",
      "Duplicate Check",
      "Terms Acceptance",
      "Age Verification",
      "Captcha Check",
      "Fraud Detection",
    ];

    // Generate 4-7 total nodes (main steps + validations)
    const totalNodes = 4 + Math.floor(Math.random() * 4); // 4-7 nodes
    const mainStepsCount = Math.max(3, Math.ceil(totalNodes * 0.6)); // 60% main steps, min 3
    const validationsCount = totalNodes - mainStepsCount;

    const selectedSteps = steps
      .sort(() => 0.5 - Math.random())
      .slice(0, mainStepsCount);
    const selectedValidations = validationSteps
      .sort(() => 0.5 - Math.random())
      .slice(0, validationsCount);

    const nodes = selectedSteps.map((step, index) => ({
      id: `account-${index + 1}`,
      type:
        index === 0
          ? "input"
          : index === selectedSteps.length - 1
            ? "output"
            : "process",
      position: { x: 200 + index * 300, y: 200 },
      data: {
        label: step,
        description: `User account creation step: ${step}`,
        icon:
          index === 0
            ? "UserPlus"
            : index === selectedSteps.length - 1
              ? "CheckCircle"
              : "User",
        iconColor:
          index === 0
            ? "text-green-500"
            : index === selectedSteps.length - 1
              ? "text-blue-500"
              : "text-purple-500",
      },
      width: 180,
      height: 100,
    }));

    // Add validation nodes
    selectedValidations.forEach((validation, index) => {
      nodes.push({
        id: `validation-${index + 1}`,
        type: "condition",
        position: { x: 250 + index * 200, y: 300 },
        data: {
          label: validation,
          description: `Validation: ${validation}`,
          icon: "Shield",
          iconColor: "text-yellow-500",
        },
        width: 160,
        height: 80,
      });
    });

    const edges: Edge[] = [];
    // Main flow edges
    for (let i = 0; i < selectedSteps.length - 1; i++) {
      edges.push({
        id: `account-edge-${i + 1}`,
        source: `account-${i + 1}`,
        target: `account-${i + 2}`,
        type: "bezier" as const,
        animated: true,
        style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    }

    // Validation edges
    selectedValidations.forEach((_, index) => {
      if (index < selectedSteps.length - 1) {
        edges.push({
          id: `val-edge-${index + 1}`,
          source: `account-${index + 1}`,
          target: `validation-${index + 1}`,
          type: "straight" as const,
          animated: false,
          style: { strokeColor: "hsl(45, 93%, 47%)", strokeWidth: 2 },
          markers: { type: "arrow" as const, position: "end" as const },
        });
      }
    });

    return { nodes, edges };
  }, []);

  // Generate I/O Logic template
  const generateIOLogicTemplate = useCallback((): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const inputSources = [
      "File Upload",
      "API Request",
      "Database Query",
      "User Input",
      "Sensor Data",
      "External Service",
      "Message Queue",
      "Webhook",
    ];

    const processes = [
      "Data Validation",
      "Transform Format",
      "Apply Rules",
      "Filter Data",
      "Calculate Values",
      "Merge Datasets",
      "Aggregate Results",
      "Clean Data",
    ];

    const outputDestinations = [
      "Database Write",
      "File Export",
      "API Response",
      "Email Notification",
      "Dashboard Update",
      "Report Generation",
      "Alert System",
      "Cache Update",
    ];

    const selectedInputs = inputSources
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    const selectedProcesses = processes
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    const selectedOutputs = outputDestinations
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);

    const nodes: Node[] = [];

    // Input nodes
    selectedInputs.forEach((input, index) => {
      nodes.push({
        id: `input-${index + 1}`,
        type: "input",
        position: { x: 150 + index * 250, y: 150 },
        data: {
          label: input,
          description: `Input source: ${input}`,
          icon: "ArrowRight",
          iconColor: "text-blue-500",
        },
        width: 160,
        height: 80,
      });
    });

    // Processing nodes
    selectedProcesses.forEach((process, index) => {
      nodes.push({
        id: `process-${index + 1}`,
        type:
          index === Math.floor(selectedProcesses.length / 2)
            ? "condition"
            : "process",
        position: { x: 200 + index * 300, y: 300 },
        data: {
          label: process,
          description: `Processing: ${process}`,
          icon:
            index === Math.floor(selectedProcesses.length / 2)
              ? "HelpCircle"
              : "Cog",
          iconColor:
            index === Math.floor(selectedProcesses.length / 2)
              ? "text-yellow-500"
              : "text-green-500",
        },
        width: 180,
        height: 90,
      });
    });

    // Output nodes
    selectedOutputs.forEach((output, index) => {
      nodes.push({
        id: `output-${index + 1}`,
        type: "output",
        position: { x: 250 + index * 250, y: 450 },
        data: {
          label: output,
          description: `Output destination: ${output}`,
          icon: "ArrowLeft",
          iconColor: "text-red-500",
        },
        width: 160,
        height: 80,
      });
    });

    const edges: Edge[] = [];

    // Connect inputs to first process
    selectedInputs.forEach((_, index) => {
      edges.push({
        id: `io-edge-input-${index + 1}`,
        source: `input-${index + 1}`,
        target: "process-1",
        type: "bezier" as const,
        animated: true,
        style: { strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    });

    // Connect processes
    for (let i = 0; i < selectedProcesses.length - 1; i++) {
      edges.push({
        id: `io-edge-process-${i + 1}`,
        source: `process-${i + 1}`,
        target: `process-${i + 2}`,
        type: "bezier" as const,
        animated: false,
        style: { strokeColor: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    }

    // Connect last process to outputs
    selectedOutputs.forEach((_, index) => {
      edges.push({
        id: `io-edge-output-${index + 1}`,
        source: `process-${selectedProcesses.length}`,
        target: `output-${index + 1}`,
        type: "bezier" as const,
        animated: true,
        style: { strokeColor: "hsl(346.8, 77.2%, 49.8%)", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      });
    });

    return { nodes, edges };
  }, []);

  // Create default tab with random workflow
  const createDefaultTab = useCallback((): WorkflowTab => {
    const { nodes, edges } = generateRandomWorkflow();
    const name = "Untitled";
    const initialState = {
      nodes,
      edges,
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    // Generate unique project UUID for this local project
    const projectUuid = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: generateTabId(),
      name,
      ...initialState,
      selectedNodeId: "",
      selectedEdgeId: "",
      history: [initialState], // Initialize with current state
      historyIndex: 0, // Start at index 0, not -1
      showImageModal: null,
      metadata: {
        name,
        description: "",
        links: [],
        linksFormat: "text",
        categories: [],
      },
      flowSettings: {},
      sketchStrokes: [],
      projectUuid, // Unique identifier for layers state scoping
      isOpen: true, // Show in tab bar by default
    };
  }, [generateTabId, generateCuteName, generateRandomWorkflow]);

  // Create blank tab
  const createBlankTab = useCallback((): WorkflowTab => {
    const name = "Untitled";
    const initialState = {
      nodes: [],
      edges: [],
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    // Generate unique project UUID for this local project
    const projectUuid = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: generateTabId(),
      name,
      ...initialState,
      selectedNodeId: "",
      selectedEdgeId: "",
      history: [initialState], // Initialize with current state
      historyIndex: 0, // Start at index 0, not -1
      showImageModal: null,
      metadata: {
        name,
        description: "",
        links: [],
        linksFormat: "text",
        categories: [],
      },
      flowSettings: {},
      sketchStrokes: [],
      projectUuid, // Unique identifier for layers state scoping
      isOpen: true, // Show in tab bar by default
    };
  }, [generateTabId, generateCuteName]);

  // Tab management state - initialize with view mode data if provided
  const [tabs, setTabs] = useState<WorkflowTab[]>(() => {
    if (isReadOnly && initialNodes) {
      const viewTab: WorkflowTab = {
        id: "view-tab",
        name: initialProjectName || "Shared Workflow",
        nodes: initialNodes,
        edges: initialEdges || [],
        canvasObjects: initialCanvasObjects || [],
        viewport: initialViewport || { x: 0, y: 0, zoom: 1 },
        selectedNodeId: "",
        selectedEdgeId: "",
        history: [
          {
            nodes: initialNodes,
            edges: initialEdges || [],
            canvasObjects: initialCanvasObjects || [],
            viewport: initialViewport || { x: 0, y: 0, zoom: 1 },
          },
        ],
        historyIndex: 0,
        showImageModal: null,
        metadata: {
          name: initialProjectName || "Shared Workflow",
          description: initialProjectDescription || "",
          links: [],
          linksFormat: "text",
          categories: [],
        },
        flowSettings: {},
        projectUuid: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      return [viewTab];
    }
    return [];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (isReadOnly && initialNodes) {
      return "view-tab";
    }
    return "home";
  });

  // Check if we're on the home screen
  const isOnHomeTab = activeTabId === "home" && !isReadOnly;
  // Check if we're on the new-tab type-selection screen
  const isOnNewTab = activeTabId === "new" && !isReadOnly;

  // Initial prompt for KiteAI Chat - set when user submits Home Prompt
  // This is passed through ProjectPanel to KiteAIChat where it's consumed
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const handleChatPromptConsumed = useCallback(() => {
    setPendingChatPrompt(null);
  }, []);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("dark-mode");
    return saved ? JSON.parse(saved) : false;
  });

  // Animation configuration state
  const [connectionAnimationConfig, setConnectionAnimationConfig] =
    useState<any>(() => {
      const saved = localStorage.getItem("connection-animation-config");
      return saved
        ? JSON.parse(saved)
        : {
            duration: 600,
            easing: "ease-out",
            pulseOnConnection: true,
            showParticles: false,
            glowOnHover: true,
          };
    });

  // SmartConnect preview state
  const [connectionPreview, setConnectionPreview] = useState<{
    source: string;
    target: string;
  } | null>(null);

  // Table data management state
  const [tableData, setTableData] = useState<Record<string, DataTable>>({});
  const [openTablePanel, setOpenTablePanel] = useState<string | null>(null);

  // Save animation config to localStorage
  useEffect(() => {
    localStorage.setItem(
      "connection-animation-config",
      JSON.stringify(connectionAnimationConfig),
    );
  }, [connectionAnimationConfig]);

  // Initialize tabs on first render - removed auto-create to show new creation experience

  // Migration effect: Fix existing tabs with invalid history state
  useEffect(() => {
    const hasInvalidTabs = tabs.some(
      (tab) =>
        tab.historyIndex === -1 ||
        tab.history.length === 0 ||
        (tab.history.length > 0 && tab.historyIndex >= tab.history.length),
    );

    if (hasInvalidTabs) {
      setTabs((prev) =>
        prev.map((tab) => {
          // If tab has invalid history state, fix it
          if (
            tab.historyIndex === -1 ||
            tab.history.length === 0 ||
            tab.historyIndex >= tab.history.length
          ) {
            const currentState = {
              nodes: tab.nodes,
              edges: tab.edges,
              canvasObjects: tab.canvasObjects || [],
              viewport: tab.viewport,
            };

            return {
              ...tab,
              history: [currentState],
              historyIndex: 0,
            };
          }
          return tab;
        }),
      );
    }
  }, [tabs]);

  // Ref to prevent double-processing of fromChat navigation
  // The actual handling is consolidated in the localStorage loading effect below
  const fromChatLoadedRef = useRef(false);

  // Dark mode effects
  useEffect(() => {
    // Apply/remove dark class to document element
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Save to localStorage
    localStorage.setItem("dark-mode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Dark mode toggle function
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Compute open tabs (shown in tab bar) - closed tabs still exist for gallery but aren't active
  const openTabs = useMemo(
    () => tabs.filter((tab) => tab.isOpen !== false),
    [tabs],
  );

  // Get current active tab - only returns an open tab, undefined when on home or no open tabs
  const activeTab = useMemo(() => {
    if (activeTabId === "home") return undefined;
    const tab = openTabs.find((tab) => tab.id === activeTabId);
    if (tab) return tab;
    // If activeTabId doesn't match any open tab, return first open tab or undefined
    return openTabs[0];
  }, [openTabs, activeTabId]);

  // Reset layers panel state when switching projects to prevent state leakage
  // Use projectUuid or cloudProjectId as the true project identifier
  useEffect(() => {
    // Only reset if we have a valid project identifier to prevent premature state clearing
    const projectIdentifier =
      activeTab?.projectUuid || activeTab?.cloudProjectId?.toString();
    if (projectIdentifier) {
      resetLayersState(projectIdentifier);
    }
  }, [activeTab?.projectUuid, activeTab?.cloudProjectId]);

  // Convenience getters for current tab state
  const nodes = activeTab?.nodes || [];
  const edges = activeTab?.edges || [];
  const canvasObjects = activeTab?.canvasObjects || [];
  const viewport = activeTab?.viewport || { x: 0, y: 0, zoom: 1 };
  const selectedNodeId = activeTab?.selectedNodeId || "";
  const selectedEdgeId = activeTab?.selectedEdgeId || "";
  const selectedEdgeIds = activeTab?.selectedEdgeIds ?? [];

  // Experiment options for predictive AI suggestions
  const {
    getOptionsForNode,
    generateOptions: generateExperimentOptionsForNode,
    refreshOptions: refreshExperimentOptions,
    invalidateNode: invalidateExperimentNode,
  } = useExperimentOptions(nodes, edges, activeTab?.name || 'Workflow', routerAiClient);

  // Build experiment options map for canvas
  const experimentOptionsMap = useMemo(() => {
    const map = new Map<string, { options: import('../lib/kiteframe/types').ExperimentOption[]; loading: boolean; error: string | null }>();
    const experimentNodes = nodes.filter(n => n.type === 'experiment');
    for (const node of experimentNodes) {
      const state = getOptionsForNode(node.id);
      map.set(node.id, {
        options: state.options,
        loading: state.loading,
        error: state.error,
      });
    }
    return map;
  }, [nodes, getOptionsForNode]);

  // Insights system for workflow analysis (opt-in via Test Flight)
  const [focusedInsightId, setFocusedInsightId] = useState<string | null>(null);
  const [forcePanelTab, setForcePanelTab] = useState<ProjectPanelTab | null>(null);
  const [designModeTabIds, setDesignModeTabIds] = useState<Set<string>>(new Set());
  const [previousTabId, setPreviousTabId] = useState<string | null>(null);
  const [isGeneratingInterface, setIsGeneratingInterface] = useState(false);
  const [screenPickerOpen, setScreenPickerOpen] = useState(false);
  const [screenPickerClusters, setScreenPickerClusters] = useState<Array<{ name: string; nodes: Node[] }>>([]);
  const [screenPickerSourceTab, setScreenPickerSourceTab] = useState<WorkflowTab | null>(null);
  const [workflowTools, setWorkflowTools] = useState<WorkflowTool[]>([]);
  
  const projectIdentifier = activeTab?.projectUuid || activeTab?.cloudProjectId?.toString() || activeTabId || 'default';
  
  const insights = useInsights(nodes, edges, {
    projectId: projectIdentifier,
    workflowId: activeTabId,
  });

  const handleOpenInsightsPanel = useCallback(() => {
    setForcePanelTab('diagnostics');
  }, []);
  
  // Hover state for insight-related node highlighting (no viewport change on hover)
  const [hoveredInsightNodeIds, setHoveredInsightNodeIds] = useState<string[]>([]);
  
  const handleHoverInsight = useCallback((insightId: string | null) => {
    if (!insightId) {
      setHoveredInsightNodeIds([]);
      return;
    }
    const insight = insights.insights.find(i => i.id === insightId);
    if (insight) {
      setHoveredInsightNodeIds(insight.relatedNodeIds);
    }
  }, [insights.insights]);

  // Propose Solution state (Phase 2 - Accept + Alternative)
  const [proposalState, setProposalState] = useState<{
    proposal: import('@/hooks/useProposalState').ProposedWorkflow | null;
    generatingInsightId: string | null;
    error: string | null;
  }>({ proposal: null, generatingInsightId: null, error: null });
  
  // Ref to track latest proposal state for Accept handler (prevents variant drift bug)
  const proposalStateRef = useRef(proposalState);
  useEffect(() => {
    proposalStateRef.current = proposalState;
  }, [proposalState]);

  const handleProposeSolution = useCallback(async (insight: import('@/lib/kiteframe/utils/insights/types').Insight) => {
    // Close any active experiment first (container exclusivity)
    if (experimentState.session) {
      setExperimentState({ session: null, generatingInsightId: null, error: null });
    }
    
    if (proposalState.generatingInsightId || proposalState.proposal) return;
    
    setProposalState(prev => ({ ...prev, generatingInsightId: insight.id, error: null }));
    
    try {
      const { generateProposedWorkflow } = await import('@/ai/proposal/generateProposedWorkflow');
      const { createSessionId, toModelProvenance } = await import('@/ai/router');
      
      const sessionId = createSessionId();
      proposalSessionIdRef.current = sessionId;
      const result = await generateProposedWorkflow({
        insight,
        snapshotNodes: nodes,
        snapshotEdges: edges,
        sessionId,
      });
      
      const modelProvenance = result.routerMetadata 
        ? toModelProvenance(result.routerMetadata) 
        : createFallbackProvenance('anthropic', 'claude-sonnet-4-5-20250929', 'workflow_reasoning');
      setProposalState({ 
        proposal: { ...result.proposal, modelProvenance }, 
        generatingInsightId: null, 
        error: null 
      });
    } catch (err) {
      console.error('[ProposeSolution] Generation failed:', err);
      proposalSessionIdRef.current = null;
      setProposalState({ 
        proposal: null, 
        generatingInsightId: null, 
        error: err instanceof Error ? err.message : 'Failed to generate proposal' 
      });
      toast({
        title: 'Generation Failed',
        description: err instanceof Error ? err.message : 'Failed to generate proposal',
        variant: 'destructive',
      });
    }
  }, [proposalState.generatingInsightId, proposalState.proposal, nodes, edges, toast]);

  const handleCancelProposal = useCallback(() => {
    const currentProposal = proposalStateRef.current.proposal;
    if (currentProposal) {
      recordProposalCanceled(currentProposal.insightId);
    }
    if (proposalSessionIdRef.current) {
      clearSessionLock(proposalSessionIdRef.current);
      proposalSessionIdRef.current = null;
    }
    setProposalState({ proposal: null, generatingInsightId: null, error: null });
  }, []);

  const handleVariantChange = useCallback((variant: 'proposed' | 'alternative') => {
    setProposalState(prev => {
      if (!prev.proposal) return prev;
      return {
        ...prev,
        proposal: {
          ...prev.proposal,
          activeVariant: variant,
        },
      };
    });
  }, []);
  
  // Experiment state (Phase 3 - Pressure Testing)
  // NOTE: We need experimentState defined before handleProposeSolution but the hook ordering is correct -
  // handleProposeSolution uses setExperimentState which is a stable function, not experimentState.session directly
  const [experimentState, setExperimentState] = useState<{
    session: import('@/hooks/useExperimentState').ExperimentSession | null;
    generatingInsightId: string | null;
    error: string | null;
  }>({ session: null, generatingInsightId: null, error: null });
  
  // Ref to track latest experiment state for Accept handler
  const experimentStateRef = useRef(experimentState);
  useEffect(() => {
    experimentStateRef.current = experimentState;
  }, [experimentState]);

  const handleStartExperiment = useCallback(async (insight: import('@/lib/kiteframe/utils/insights/types').Insight) => {
    // Close any active proposal first (container exclusivity)
    if (proposalState.proposal) {
      setProposalState({ proposal: null, generatingInsightId: null, error: null });
    }
    
    if (experimentState.generatingInsightId || experimentState.session) return;
    
    setExperimentState(prev => ({ ...prev, generatingInsightId: insight.id, error: null }));
    
    try {
      const { generateExperiments } = await import('@/ai/experiment/generateExperiments');
      const { createSessionId, toModelProvenance } = await import('@/ai/router');
      
      const sessionId = createSessionId();
      experimentSessionIdRef.current = sessionId;
      const result = await generateExperiments({
        insight,
        snapshotNodes: nodes,
        snapshotEdges: edges,
        sessionId,
      });
      
      const modelProvenance = result.routerMetadata 
        ? toModelProvenance(result.routerMetadata) 
        : createFallbackProvenance('anthropic', 'claude-sonnet-4-5-20250929', 'workflow_experiments');
      setExperimentState({ 
        session: { ...result.session, modelProvenance }, 
        generatingInsightId: null, 
        error: null 
      });
    } catch (err) {
      console.error('[Experiment] Generation failed:', err);
      experimentSessionIdRef.current = null;
      setExperimentState({ 
        session: null, 
        generatingInsightId: null, 
        error: err instanceof Error ? err.message : 'Failed to generate experiments' 
      });
      toast({
        title: 'Experiment Generation Failed',
        description: err instanceof Error ? err.message : 'Failed to generate experiments',
        variant: 'destructive',
      });
    }
  }, [experimentState.generatingInsightId, experimentState.session, proposalState.proposal, nodes, edges, toast]);

  const handleCancelExperiment = useCallback(() => {
    // Cancel clears state entirely - no undo entry, no canvas mutation
    const currentSession = experimentStateRef.current.session;
    if (currentSession && currentSession.activeExperimentId) {
      recordExperimentDiscarded(currentSession.insightId, currentSession.activeExperimentId);
    }
    if (experimentSessionIdRef.current) {
      clearSessionLock(experimentSessionIdRef.current);
      experimentSessionIdRef.current = null;
    }
    setExperimentState({ session: null, generatingInsightId: null, error: null });
  }, []);

  const handleSelectExperiment = useCallback((experimentId: string) => {
    setExperimentState(prev => {
      if (!prev.session) return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          activeExperimentId: experimentId,
        },
      };
    });
  }, []);

  // Explore insight - creates experiment anchored to related nodes without auto-mutating workflow
  // Note: focusOnNode is defined later, so we use a ref pattern
  const handleExploreInsightRef = useRef<((insight: import('@/lib/kiteframe/utils/insights/types').Insight) => void) | null>(null);

  // Reset forceTab after it's been applied
  useEffect(() => {
    if (forcePanelTab) {
      const timer = setTimeout(() => setForcePanelTab(null), 100);
      return () => clearTimeout(timer);
    }
  }, [forcePanelTab]);

  // Derive selected canvas objects from active tab state
  const selectedCanvasObjects = useMemo(
    () => canvasObjects.filter((obj) => obj.selected),
    [canvasObjects],
  );

  const history = activeTab?.history || [];
  const historyIndex = activeTab?.historyIndex ?? 0;
  const showImageModal = activeTab?.showImageModal || null;
  const metadata = activeTab?.metadata || {
    name: activeTab?.name || "Untitled Workflow",
    description: "",
    links: [],
    linksFormat: "text" as const,
    categories: [],
  };

  // Update current tab
  const updateActiveTab = useCallback(
    (updates: Partial<WorkflowTab>) => {
      // Stamp lastModified whenever meaningful content changes so the home
      // screen "last edited" time and LWW cloud sync stay accurate.
      const contentFields: (keyof WorkflowTab)[] = [
        "nodes",
        "edges",
        "canvasObjects",
        "name",
      ];
      const touchesContent = contentFields.some((f) => f in updates);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                ...updates,
                ...(touchesContent ? { lastModified: Date.now() } : {}),
              }
            : tab,
        ),
      );
    },
    [activeTabId],
  );

  // Track wireframe generation loading state
  const [generatingWireframe, setGeneratingWireframe] = useState(false);
  const [refineMockupNodeId, setRefineMockupNodeId] = useState<string | null>(null);

  // Wireframe generation handler
  useEffect(() => {
    const handleGenerateWireframe = async (event: any) => {
      const { nodeId, node } = event.detail;

      // Check credits before AI operation
      if (isOutOfCredits) {
        toast({
          title: "Out of credits",
          description: ctaMessage,
          variant: "destructive",
        });
        if (ctaAction === "signup") openSignup();
        else openCreditsDialog();
        return;
      }

      if (!node || generatingWireframe) {
        // Ignore if already generating or no node provided
        if (generatingWireframe) {
          toast({
            title: "Please wait",
            description: "Wireframe generation in progress...",
          });
        }
        return;
      }

      try {
        setGeneratingWireframe(true);

        // Show loading toast
        toast({
          title: "Generating wireframe...",
          description: `Creating mockup for "${node.data?.label || "node"}"`,
        });

        // Call the wireframe generation API
        const response = await fetch("/api/generate-wireframe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label: node.data?.label || "Untitled",
            description: node.data?.description || "",
            nodeType: node.type || "process",
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to generate wireframe" }));
          throw new Error(errorData.error || "Failed to generate wireframe");
        }

        const { svg } = await response.json();

        // Convert SVG to data URL with proper encoding for non-ASCII characters
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

        // Create a new image node next to the source node
        const newImageNode: Node = {
          id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "image",
          position: {
            x: node.position.x + (node.width || 200) + 50, // Position to the right with some spacing
            y: node.position.y,
          },
          data: {
            label: `${node.data?.label || "Node"} Mockup`,
            description: "AI-generated wireframe",
            src: svgDataUrl,
            filename: `${node.data?.label || "wireframe"}.svg`,
            sourceType: "data",
            imageSize: "contain",
            isMockup: true,
          },
          width: 400,
          height: 300,
        };

        // Create auto-connection edge from source node to wireframe mockup
        const newEdge: Edge = {
          id: `edge-wireframe-${Date.now()}`,
          source: node.id,
          target: newImageNode.id,
          type: "straight",
          style: {
            strokeColor: "#9333ea", // Purple color for mockup connections
            strokeWidth: 2,
            strokeDasharray: "5,5", // Dashed line
          },
          markers: {
            type: "circle",
            position: "end",
          },
          label: "mockup",
          reconnectable: true,
          interactable: true,
        };

        // Add the new image node and edge to the canvas
        const currentTab = tabs.find((tab) => tab.id === activeTabId);
        if (currentTab) {
          const currentNodes = currentTab.nodes;
          const currentEdges = currentTab.edges;

          // Save to history first
          const currentState = {
            nodes: currentNodes,
            edges: currentEdges,
            canvasObjects: currentTab.canvasObjects || [],
            viewport: currentTab.viewport,
          };

          // Add to history
          const newHistory = currentTab.history.slice(
            0,
            currentTab.historyIndex + 1,
          );
          newHistory.push(currentState);

          // Update with new node and edge
          updateActiveTab({
            nodes: [...currentNodes, newImageNode],
            edges: [...currentEdges, newEdge],
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });

          toast({
            title: "Wireframe generated!",
            description: "AI-generated mockup added to canvas",
          });
        }
      } catch (error: any) {
        console.error("Wireframe generation error:", error);
        toast({
          title: "Generation failed",
          description:
            error.message || "Failed to generate wireframe. Please try again.",
          variant: "destructive",
        });
      } finally {
        setGeneratingWireframe(false);
      }
    };

    window.addEventListener("generateWireframe", handleGenerateWireframe);
    return () => {
      window.removeEventListener("generateWireframe", handleGenerateWireframe);
    };
  }, [tabs, activeTabId, toast, updateActiveTab, generatingWireframe]);

  // Sync subscription tier to window global so deep components (PropertiesCard) can access it
  useEffect(() => {
    window.__subscriptionTier = subscriptionTier;
  }, [subscriptionTier]);

  // Listen for showFeatureUpsell events from deep components
  useEffect(() => {
    const handleShowFeatureUpsell = (event: CustomEvent<{ type: string }>) => {
      const type = event.detail?.type;
      if (type === 'wireframe') {
        setFeatureUpsell({
          featureName: 'Mockup Wireframe',
          requiredTier: 'advanced',
          description: 'Generate AI-powered wireframe mockups for your workflow nodes. Upgrade to Advanced or Pro to use this feature.',
        });
      } else if (type === 'image-to-workflow') {
        setFeatureUpsell({
          featureName: 'Image to Workflow',
          requiredTier: 'advanced',
          description: 'Upload images to automatically generate workflows using AI vision. Upgrade to Advanced or Pro to use this feature.',
        });
      } else if (type === 'prd-export') {
        setFeatureUpsell({
          featureName: 'PRD Export',
          requiredTier: 'advanced',
          description: 'Export your Product Requirements Documents in multiple formats. Upgrade to Advanced or Pro to use this feature.',
        });
      }
    };
    window.addEventListener('showFeatureUpsell', handleShowFeatureUpsell as EventListener);
    return () => {
      window.removeEventListener('showFeatureUpsell', handleShowFeatureUpsell as EventListener);
    };
  }, []);

  // Listen for editNodeHyperlink event from HyperlinkButton edit action
  useEffect(() => {
    const handleEditHyperlink = (event: CustomEvent<{ nodeId: string }>) => {
      const { nodeId } = event.detail;

      // Find the node and open the toolbar with link submenu
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        // Set this node as selected
        setSelectedNodeId(nodeId);
        setSelectedEdgeId("");

        // Calculate toolbar position for this node
        const containerRect =
          canvasContainerRef.current?.getBoundingClientRect();
        const containerLeft = containerRect?.left ?? 0;
        const containerTop = containerRect?.top ?? 0;

        const nodeWidth = node.width ?? 200;
        const nodeHeight = node.height ?? 100;
        const screenX =
          node.position.x * viewport.zoom + viewport.x + containerLeft;
        const screenY =
          node.position.y * viewport.zoom + viewport.y + containerTop;
        const screenWidth = nodeWidth * viewport.zoom;
        const screenHeight = nodeHeight * viewport.zoom;

        // Open the linear toolbar with link submenu active
        setLinearToolbar({
          x: screenX + screenWidth / 2,
          y: screenY,
          nodeRect: {
            top: screenY,
            bottom: screenY + screenHeight,
            left: screenX,
            right: screenX + screenWidth,
            width: screenWidth,
          },
          node,
          initialSubmenu: "link",
        });
      }
    };

    window.addEventListener(
      "editNodeHyperlink",
      handleEditHyperlink as EventListener,
    );
    return () => {
      window.removeEventListener(
        "editNodeHyperlink",
        handleEditHyperlink as EventListener,
      );
    };
  }, [nodes, viewport]);

  // Theme change detection for text color updates using MutationObserver
  useEffect(() => {
    if (!activeTab) return;

    const handleThemeChange = () => {
      const currentTab = activeTabRef.current;
      if (!currentTab) return;

      const currentCanvasObjects = currentTab.canvasObjects || [];
      let hasChanges = false;

      const updatedCanvasObjects = currentCanvasObjects.map((obj) => {
        if (obj.type === "text") {
          const textData = obj.data as TextNodeData;
          const currentTextColor = textData.textColor;

          // Only update pure black/white colors
          if (isPureBlack(currentTextColor) || isPureWhite(currentTextColor)) {
            const newTextColor = getOppositeTextColor(currentTextColor);
            hasChanges = true;

            return {
              ...obj,
              data: {
                ...textData,
                textColor: newTextColor,
              },
            };
          }
        }
        return obj;
      });

      // Only update if there were changes
      if (hasChanges) {
        updateActiveTab({ canvasObjects: updatedCanvasObjects });
      }
    };

    // Create MutationObserver to watch for theme class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const isDarkNow = document.documentElement.classList.contains("dark");

          // Only trigger if theme actually changed
          if (isDarkNow !== lastThemeIsDarkRef.current) {
            lastThemeIsDarkRef.current = isDarkNow;

            // Clear any existing timeout
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }

            // Debounce the theme change handling
            debounceTimeoutRef.current = setTimeout(handleThemeChange, 10);
          }
        }
      });
    });

    // Start observing the document element for class changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Cleanup observer and timeout on unmount or activeTab change
    return () => {
      observer.disconnect();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [activeTab?.id, updateActiveTab]);

  // Setters that update the active tab
  const setNodes = useCallback(
    (newNodes: Node[] | ((prev: Node[]) => Node[])) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            const currentNodes = tab.nodes || [];
            const resolvedNodes =
              typeof newNodes === "function"
                ? newNodes(currentNodes)
                : newNodes;
            return { ...tab, nodes: resolvedNodes };
          }
          return tab;
        }),
      );
    },
    [activeTabId, setTabs],
  );

  const setEdges = useCallback(
    (newEdges: Edge[] | ((prev: Edge[]) => Edge[])) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            const currentEdges = tab.edges || [];
            const resolvedEdges =
              typeof newEdges === "function"
                ? newEdges(currentEdges)
                : newEdges;
            return { ...tab, edges: resolvedEdges };
          }
          return tab;
        }),
      );
    },
    [activeTabId, setTabs],
  );

  const setViewport = useCallback(
    (
      newViewport:
        | { x: number; y: number; zoom: number }
        | ((prev: { x: number; y: number; zoom: number }) => {
            x: number;
            y: number;
            zoom: number;
          }),
    ) => {
      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id === activeTabId) {
            const currentViewport = tab.viewport || { x: 0, y: 0, zoom: 1 };
            const resolvedViewport =
              typeof newViewport === "function"
                ? newViewport(currentViewport)
                : newViewport;
            return { ...tab, viewport: resolvedViewport };
          }
          return tab;
        }),
      );
    },
    [activeTabId, setTabs],
  );

  // Fit-view callback used by MobileViewBar
  const handleFitView = useCallback(() => {
    if (nodes.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((node) => {
      const w = (node.style?.width ?? node.width ?? 200) as number;
      const h = (node.style?.height ?? node.height ?? 100) as number;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    });
    const padding = 80;
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const zoom = Math.max(0.1, Math.min(1.5, Math.min(cw / (maxX - minX + padding * 2), ch / (maxY - minY + padding * 2))));
    setViewport({ x: cw / 2 - ((minX + maxX) / 2) * zoom, y: ch / 2 - ((minY + maxY) / 2) * zoom, zoom });
  }, [nodes, setViewport]);

  // Symmetric selection exclusivity: deselect nodes/edges when canvas objects are selected
  useEffect(() => {
    if (selectedCanvasObjects.length > 0) {
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      setEdges((prev) => prev.map((e) => ({ ...e, selected: false })));
      updateActiveTab({ selectedNodeId: "", selectedEdgeId: "", selectedEdgeIds: [] });
    }
  }, [selectedCanvasObjects.length, updateActiveTab]);

  // Helper function to calculate viewport-centered position with sequential offset
  const getViewportCenteredPosition = useCallback(() => {
    // Use common canvas dimensions (matching WorkflowCanvas)
    const canvasWidth = 800;
    const canvasHeight = 600;

    // Calculate viewport center in world coordinates
    // CSS transform: translate(viewport.x, viewport.y) scale(zoom)
    // So: screen = world * zoom + viewport
    // Inverting: world = (screen - viewport) / zoom
    const viewportCenterX = (canvasWidth / 2 - viewport.x) / viewport.zoom;
    const viewportCenterY = (canvasHeight / 2 - viewport.y) / viewport.zoom;

    // Count existing nodes and canvas objects for offset
    const existingCount = (nodes?.length || 0) + (canvasObjects?.length || 0);

    // Improved spiral pattern that extends beyond 9 items
    const offsetDistance = 50; // World space units (not affected by zoom)
    let offsetX = 0;
    let offsetY = 0;

    if (existingCount > 0) {
      // Create expanding spiral pattern
      const ringSize = 3; // 3x3 grid per ring
      const ring = Math.floor((existingCount - 1) / (ringSize * ringSize));
      const posInRing = (existingCount - 1) % (ringSize * ringSize);

      // Calculate position within the current ring
      const col = posInRing % ringSize;
      const row = Math.floor(posInRing / ringSize);

      // Apply ring multiplier and center the grid
      const ringMultiplier = ring + 1;
      offsetX =
        (col - Math.floor(ringSize / 2)) * offsetDistance * ringMultiplier;
      offsetY =
        (row - Math.floor(ringSize / 2)) * offsetDistance * ringMultiplier;
    }

    // Default node dimensions for centering (nodes are typically 200x100)
    const nodeWidth = 200;
    const nodeHeight = 100;

    // Center the node by subtracting half its dimensions
    const centeredX = viewportCenterX + offsetX - nodeWidth / 2;
    const centeredY = viewportCenterY + offsetY - nodeHeight / 2;

    return {
      x: Math.round(centeredX),
      y: Math.round(centeredY),
    };
  }, [viewport, nodes, canvasObjects]);

  // Focus on a specific node by panning the viewport to center it
  const focusOnNode = useCallback(
    (nodeId: string) => {
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) {
        console.warn(`Cannot focus on node ${nodeId}: node not found`);
        return;
      }

      // Get canvas container dimensions
      const canvasWidth = canvasContainerRef.current?.clientWidth || 800;
      const canvasHeight = canvasContainerRef.current?.clientHeight || 600;

      // Calculate node center in world coordinates
      const nodeWidth = targetNode.width || targetNode.style?.width || 200;
      const nodeHeight = targetNode.height || targetNode.style?.height || 100;
      const nodeCenterX = targetNode.position.x + nodeWidth / 2;
      const nodeCenterY = targetNode.position.y + nodeHeight / 2;

      // Calculate new viewport position to center the node
      // screen = world * zoom + viewport
      // viewport = screen - world * zoom
      // For centering: screenCenter = canvasWidth/2, canvasHeight/2
      // Zoom in to at least 1.0 for good visibility, or keep current if already higher
      const focusZoom = Math.max(1, viewport.zoom);
      const newX = canvasWidth / 2 - nodeCenterX * focusZoom;
      const newY = canvasHeight / 2 - nodeCenterY * focusZoom;

      // Animate viewport with smooth transition
      setViewport({ x: newX, y: newY, zoom: focusZoom });

      // Also select the node for visibility
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          selected: n.id === nodeId,
        })),
      );
    },
    [nodes, viewport.zoom, setViewport, setNodes],
  );

  const setSelectedNodeId = useCallback(
    (id: string) => {
      updateActiveTab({ selectedNodeId: id });
    },
    [updateActiveTab],
  );
  
  // Implement the explore insight handler now that focusOnNode is available
  useEffect(() => {
    handleExploreInsightRef.current = (insight: import('@/lib/kiteframe/utils/insights/types').Insight) => {
      if (!insight.explorationContext || insight.relatedNodeIds.length === 0) {
        toast({
          title: "Cannot explore",
          description: "This insight doesn't have exploration context or related nodes.",
        });
        return;
      }
      
      // Mark the insight as explored
      insights.markExplored(insight.id);
      
      // Get the anchor node (first related node)
      const anchorNodeId = insight.explorationContext.anchorNodeId || insight.relatedNodeIds[0];
      const anchorNode = nodes.find(n => n.id === anchorNodeId);
      
      if (!anchorNode) {
        toast({
          title: "Cannot explore",
          description: "Related node not found on canvas.",
        });
        return;
      }
      
      // Create a new WorkflowTool (experiment) anchored to the insight's related nodes
      // origin: 'explore' locks mode and uses solution-oriented prompts
      const newTool: WorkflowTool = {
        id: `experiment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'experiment',
        anchorNodeId,
        mode: insight.explorationContext.suggestedMode,
        origin: 'explore',
        userPrompt: insight.explorationContext.prefilledPrompt || '',
        state: 'idle',
        meta: {
          experimentId: `exp-${Date.now()}`,
          source: 'diagnostic',
          createdAt: Date.now(),
          issueTitle: insight.title,
          issueDescription: insight.description,
        },
      };
      
      setWorkflowTools(prev => [...prev, newTool]);
      
      // Focus on the anchor node so user sees the context
      focusOnNode(anchorNodeId);
      
      toast({
        title: "Exploring solutions",
        description: `Finding solutions for "${insight.title}"...`,
      });
    };
  }, [insights, nodes, focusOnNode, toast]);
  
  // Stable reference to explore insight handler
  const handleExploreInsight = useCallback((insight: import('@/lib/kiteframe/utils/insights/types').Insight) => {
    handleExploreInsightRef.current?.(insight);
  }, []);

  const setSelectedEdgeId = useCallback(
    (id: string) => {
      updateActiveTab({ selectedEdgeId: id });
    },
    [updateActiveTab],
  );

  const setSelectedEdgeIds = useCallback(
    (ids: string[]) => {
      updateActiveTab({ selectedEdgeIds: ids });
    },
    [updateActiveTab],
  );

  const setShowImageModal = useCallback(
    (nodeId: string | null) => {
      updateActiveTab({ showImageModal: nodeId });
    },
    [updateActiveTab],
  );

  const setWorkflowName = useCallback(
    (name: string) => {
      updateActiveTab({
        name,
        metadata: { ...metadata, name },
      });
    },
    [updateActiveTab, metadata],
  );

  const setProjectMetadata = useCallback(
    (newMetadata: ProjectMetadata) => {
      updateActiveTab({
        name: newMetadata.name,
        metadata: newMetadata,
      });
    },
    [updateActiveTab],
  );

  // Tab operations
  const createNewTab = useCallback(() => {
    const newTab = createBlankTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [createBlankTab]);

  const createNewDesignTab = useCallback(() => {
    const newTab = createBlankTab();
    setTabs((prev) => [...prev, newTab]);
    setDesignModeTabIds((prev) => new Set([...Array.from(prev), newTab.id]));
    setActiveTabId(newTab.id);
    setForcePanelTab("kite-ai");
  }, [createBlankTab]);

  const openDesignTab = useCallback((
    designId: string,
    title?: string,
    syncMeta?: { syncedAt?: string | null; isStale?: boolean; sourceWorkflowId?: string | null },
  ) => {
    // If a tab for this design already exists, just switch to it.
    const existing = tabs.find((t) => t.designId === designId);
    if (existing) {
      setTabs((prev) =>
        prev.map((t) => (t.id === existing.id ? { ...t, isOpen: true } : t)),
      );
      setActiveTabId(existing.id);
      return;
    }
    const newTab: WorkflowTab = {
      id: generateTabId(),
      name: title ?? "Untitled Design",
      nodes: [],
      edges: [],
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: "",
      selectedEdgeId: "",
      history: [],
      historyIndex: 0,
      showImageModal: null,
      metadata: { name: "Untitled Design", description: "", links: [], linksFormat: "text", categories: [] },
      flowSettings: {},
      sketchStrokes: [],
      isOpen: true,
      lastModified: Date.now(),
      designId,
      designSyncedAt: syncMeta?.syncedAt ?? undefined,
      designIsStale: syncMeta?.isStale ?? false,
      designSourceWorkflowId: syncMeta?.sourceWorkflowId ?? undefined,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, tabs]);

  // Shared generation function: build a new design tab from any workflow tab.
  // Used by both "Create Interface" (from workflow toolbar) and "Update Interface"
  // (from stale design tab banner). Always creates a new design + new tab;
  // version-names if prior designs from the same workflow already exist.
  const generateInterfaceFromWorkflow = useCallback(async (sourceTab: WorkflowTab, selectedClusters?: Array<{ name: string; nodes: Node[] }> | null): Promise<boolean> => {
    if (isGeneratingInterface) return false;
    if (isOutOfCredits) {
      if (ctaAction === "signup") openSignup();
      else openCreditsDialog();
      return false;
    }
    try {
      const sessionRes = await fetch("/api/auth/user", { credentials: "include" });
      if (sessionRes.status === 401) { openSignup(); return false; }
    } catch { /* network error — let main call handle it */ }
    setIsGeneratingInterface(true);
    try {
      // Version naming: count existing design tabs linked to this source workflow
      const sourceWorkflowId = sourceTab.cloudProjectId ?? null;
      const linkedDesignTabs = tabs.filter(
        (t) => !!t.designId && !!t.designSourceWorkflowId && t.designSourceWorkflowId === sourceWorkflowId,
      );
      const baseName = sourceTab.name || "Untitled Design";
      const tabTitle = linkedDesignTabs.length === 0
        ? baseName
        : `${baseName} v${linkedDesignTabs.length + 1}`;

      const prompt = buildInterfacePromptFromWorkflow(sourceTab.nodes, sourceTab.edges, sourceTab.name, selectedClusters);
      const genRes = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt, source: "workflow" }),
      });
      if (genRes.status === 401) { openSignup(); return false; }
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.message || genData.error || "Generation failed");
      const createRes = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          // The AI can include disconnected nodes in a full Craft.js response.
          // Persist only the editable graph rooted at ROOT so ghost artboards
          // cannot appear beside the generated interface.
          craftState: typeof genData.craftState === "string"
            ? sanitizeCraftState(pruneUnreachableCraftNodes(genData.craftState))
            : genData.craftState,
          source: "workflow-bridge",
          // Use the versioned tab title so onTitleLoaded syncs back the correct name
          title: tabTitle,
          sourceWorkflowId: sourceWorkflowId,
        }),
      });
      if (createRes.status === 401) { openSignup(); return false; }
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.message || createData.error || "Failed to save design");
      openDesignTab(
        createData.id,
        tabTitle,
        {
          syncedAt: createData.workflowSyncedAt ?? null,
          isStale: false,
          sourceWorkflowId: createData.sourceWorkflowId ?? null,
        },
      );
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not generate interface";
      toast({ title: "Interface generation failed", description: msg, variant: "destructive" });
      return false;
    } finally {
      setIsGeneratingInterface(false);
    }
  }, [isGeneratingInterface, isOutOfCredits, ctaAction, openSignup, openCreditsDialog, tabs, openDesignTab, toast, setIsGeneratingInterface]);

  /**
   * Opens a new interface proposal tab for the given workflow tab.
   * If a proposal or design tab already exists for this workflow, switches to it instead.
   * The proposal tab renders InterfaceProposalView — no AI generation starts until the
   * user reviews the screen proposals and clicks "Generate Screens".
   */
  const openInterfaceProposalTab = useCallback((sourceTab: WorkflowTab) => {
    // If a proposal tab or design tab already exists for this source tab, switch to it.
    const existingProposal = tabs.find(
      (t) => t.interfaceProposalMode && t.interfaceProposalSourceTabId === sourceTab.id,
    );
    if (existingProposal) {
      setTabs((prev) => prev.map((t) => t.id === existingProposal.id ? { ...t, isOpen: true } : t));
      setActiveTabId(existingProposal.id);
      return;
    }
    const sourceWorkflowId = sourceTab.cloudProjectId ?? null;
    if (sourceWorkflowId) {
      const existingDesign = tabs.find(
        (t) => !!t.designId && t.designSourceWorkflowId === sourceWorkflowId,
      );
      if (existingDesign) {
        setTabs((prev) => prev.map((t) => t.id === existingDesign.id ? { ...t, isOpen: true } : t));
        setActiveTabId(existingDesign.id);
        return;
      }
    }

    const newTab: WorkflowTab = {
      id: generateTabId(),
      name: `${sourceTab.name || "Interface"} — Preview`,
      nodes: [],
      edges: [],
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: "",
      selectedEdgeId: "",
      history: [],
      historyIndex: 0,
      showImageModal: null,
      metadata: { name: "", description: "", links: [], linksFormat: "text", categories: [] },
      flowSettings: {},
      sketchStrokes: [],
      isOpen: true,
      lastModified: Date.now(),
      interfaceProposalMode: true,
      interfaceProposalSourceTabId: sourceTab.id,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, tabs]);


  const closeTab = useCallback(
    (tabId: string) => {
      // Closing a tab marks it as not open - does NOT delete the project
      // Projects remain in the gallery until explicitly deleted via onDeleteProject

      // Calculate remaining open tabs BEFORE mutation for correct tab switching
      const remainingOpenTabs = tabs.filter(
        (tab) => tab.id !== tabId && tab.isOpen !== false,
      );

      // Determine new active tab ID first
      let newActiveTabId: string | null = null;
      if (tabId === activeTabId) {
        if (remainingOpenTabs.length > 0) {
          const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
          const newActiveTab =
            remainingOpenTabs[Math.max(0, closingIndex - 1)] ||
            remainingOpenTabs[0];
          newActiveTabId = newActiveTab.id;
        } else {
          // No open tabs remaining, go to home
          newActiveTabId = "home";
        }
      }

      // Update both states atomically - set activeTabId first to avoid stale state reads
      if (newActiveTabId !== null) {
        setActiveTabId(newActiveTabId);
      }

      setTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, isOpen: false } : tab)),
      );
    },
    [tabs, activeTabId],
  );

  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, name: newName } : tab)),
    );
  }, []);

  // Blank canvas state handlers
  const handleCreateBlankFromCanvas = useCallback(() => {
    const newTab = createBlankTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);

    // Toast notification for new workflow creation
    toast({
      title: "New Workflow Created",
      description: `Created blank workflow "${newTab.name}"`,
    });
  }, [createBlankTab, toast]);

  const handleCreateWithTemplate = useCallback(() => {
    const newTab = createDefaultTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);

    // Toast notification for template workflow creation
    toast({
      title: "Template Workflow Created",
      description: `Created workflow "${newTab.name}" with template`,
    });
  }, [createDefaultTab, toast]);

  const handleCreateWithAI = useCallback(() => {
    // Create blank tab first, then open AI generator
    const newTab = createBlankTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowAiGenerator(true);

    // Toast notification for new workflow creation
    toast({
      title: "New Workflow Created",
      description: `Created workflow "${newTab.name}" for AI generation`,
    });
  }, [createBlankTab, toast]);

  const handleImportFromCanvas = useCallback(() => {
    // Create blank tab first, then trigger import
    const newTab = createBlankTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    // Create hidden file input for importing
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.nodes && data.edges) {
            const importedNodes = data.nodes;
            const importedEdges = data.edges;
            const importedViewport = data.viewport || { x: 0, y: 0, zoom: 1 };

            // Create new history state for the imported workflow
            const newHistoryState = {
              nodes: [...importedNodes],
              edges: [...importedEdges],
              canvasObjects: data.canvasObjects || [],
              viewport: { ...importedViewport },
            };

            // Directly update the specific tab that was just created
            setTabs((prev) =>
              prev.map((tab) =>
                tab.id === newTab.id
                  ? {
                      ...tab,
                      nodes: importedNodes,
                      edges: importedEdges,
                      viewport: importedViewport,
                      history: [...tab.history, newHistoryState],
                      historyIndex: tab.history.length, // New index after adding the state
                    }
                  : tab,
              ),
            );

            toast({
              title: "Workflow Imported",
              description: `Successfully imported ${importedNodes.length} nodes and ${importedEdges.length} connections.`,
            });
          }
        } catch (error) {
          toast({
            title: "Import Failed",
            description:
              "Invalid JSON file. Please select a valid workflow file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [createBlankTab, toast]);

  // Handle template creation from canvas
  const handleCreateTemplateFromCanvas = useCallback(
    (templateType: string) => {
      let templateData;
      const name = "Untitled";

      // Generate appropriate template based on type
      switch (templateType) {
        case "getting-started":
          templateData = generateGettingStartedTemplate();
          break;
        case "user-journey":
          templateData = generateUserJourneyTemplate();
          break;
        case "product-roadmap":
          templateData = generateProductRoadmapTemplate();
          break;
        case "okr-planning":
          templateData = generateOKRPlanningTemplate();
          break;
        case "feature-request-flow":
          templateData = generateFeatureRequestFlowTemplate();
          break;
        case "decision-tree":
          templateData = generateDecisionTreeTemplate();
          break;
        case "mindmap":
          templateData = generateMindmapTemplate();
          break;
        case "system-architecture":
          templateData = generateSystemArchitectureTemplate();
          break;
        case "swim-lanes":
          templateData = generateSwimLanesTemplate();
          break;
        case "user-account-creation":
          templateData = generateUserAccountTemplate();
          break;
        case "io-logic":
          templateData = generateIOLogicTemplate();
          break;
        default:
          // Fallback to blank if template type is not recognized
          handleCreateBlankFromCanvas();
          return;
      }

      const initialState = {
        nodes: templateData.nodes,
        edges: templateData.edges,
        canvasObjects: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      const newTab: WorkflowTab = {
        id: generateTabId(),
        name,
        ...initialState,
        selectedNodeId: "",
        selectedEdgeId: "",
        history: [initialState],
        historyIndex: 0,
        showImageModal: null,
        metadata: {
          name,
          description: "",
          links: [],
          linksFormat: "text",
          categories: [],
        },
        projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    },
    [
      generateTabId,
      generateCuteName,
      generateUserJourneyTemplate,
      generateMindmapTemplate,
      generateSystemArchitectureTemplate,
      generateSwimLanesTemplate,
      generateUserAccountTemplate,
      generateIOLogicTemplate,
      handleCreateBlankFromCanvas,
    ],
  );

  // Direct AI generation function
  const generateWorkflowFromPrompt = useCallback(
    async (prompt: string): Promise<{ nodes: Node[]; edges: Edge[]; generatedTitle: string | null }> => {
      // Check credits before AI operation
      if (isOutOfCredits) {
        toast({
          title: "Out of credits",
          description: ctaMessage,
          variant: "destructive",
        });
        if (ctaAction === "signup") openSignup();
        else openCreditsDialog();
        throw new Error("Out of credits");
      }

      const systemPrompt = `You are a workflow generator. Create a visual workflow based on the user's description. 

Return ONLY a valid JSON object with "title", "nodes", and "edges". Keep descriptions short and concise.

The "title" field must be a 3-4 word name that summarizes the workflow concept (e.g. "API Test Automation", "User Onboarding Flow", "Payment Processing Pipeline"). Capitalize each word.

Each node should have:
- id: unique string (like "node-1", "node-2", etc.)
- type: one of "input", "process", "condition", "output", "ai", "image"
- position: {x: number, y: number} (CENTER workflow - start first node at x:300, y:250, then x:550, y:250, etc.)
- data: {label: string, description: string (MAX 50 chars), icon: string, iconColor: string}
- width: 200, height: 100

POSITIONING: Start at x:300, y:250, then horizontally +250px per node. For branches: y:100 (upper), y:400 (lower).

Each edge should have:
- id: unique string (like "edge-1", "edge-2", etc.)
- source: source node id
- target: target node id
- type: "bezier"
- style: {strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2}
- markers: {type: "arrow", position: "end"}

Icon mapping:
- input: "ArrowRight", color: "text-blue-500"
- process: "Cog", color: "text-green-500"  
- condition: "HelpCircle", color: "text-yellow-500"
- output: "ArrowLeft", color: "text-red-500"
- ai: "Bot", color: "text-purple-500"
- image: "Image", color: "text-indigo-500"

Create a logical flow. Keep descriptions brief. Return ONLY valid JSON.`;

      const router = getRouter();
      const response = await router.chat({
        taskType: 'workflow_reasoning',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        maxTokens: 4000,
      });

      // Parse the AI response with better JSON cleaning
      let cleanedResponse = response.text.trim();

      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/, "")
          .replace(/```\s*$/, "");
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse
          .replace(/^```\s*/, "")
          .replace(/```\s*$/, "");
      }

      cleanedResponse = cleanedResponse.trim();

      let workflowData;
      try {
        workflowData = JSON.parse(cleanedResponse);
      } catch (firstError) {
        const errorMsg =
          firstError instanceof Error ? firstError.message : String(firstError);

        // Try additional cleaning if first parse fails
        let fixedResponse = cleanedResponse;

        // Remove any trailing commas before closing brackets/braces
        fixedResponse = fixedResponse.replace(/,(\s*[}\]])/g, "$1");

        // Fix unquoted keys (but be careful not to break quoted strings)
        fixedResponse = fixedResponse.replace(
          /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
          '$1"$2":',
        );

        // Convert single quotes to double quotes (but avoid breaking contractions in strings)
        fixedResponse = fixedResponse.replace(/:\s*'([^']*)'/g, ': "$1"');

        try {
          workflowData = JSON.parse(fixedResponse);
        } catch (secondError) {
          const secondErrorMsg =
            secondError instanceof Error
              ? secondError.message
              : String(secondError);
          console.error("❌ BOTH PARSE ATTEMPTS FAILED:", {
            original: errorMsg,
            afterFix: secondErrorMsg,
            responseLength: response.text.length,
            cleanedLength: cleanedResponse.length,
            rawStart: response.text.substring(0, 100),
            cleanedStart: cleanedResponse.substring(0, 100),
          });
          throw new Error(
            `Failed to parse AI response: ${secondErrorMsg}. Raw response length: ${response.text.length}`,
          );
        }
      }

      if (workflowData.nodes && workflowData.edges) {
        // Apply minimum spacing between nodes
        const spacedNodes = enforceMinimumNodeSpacing(workflowData.nodes, 16);

        // Sanitise the AI-generated title: trim, collapse whitespace, cap at 60 chars
        const rawTitle = typeof workflowData.title === 'string' ? workflowData.title : '';
        const generatedTitle = rawTitle.trim().replace(/\s+/g, ' ').slice(0, 60) || null;

        return {
          ...workflowData,
          nodes: spacedNodes,
          generatedTitle,
        };
      } else {
        throw new Error("Invalid workflow structure returned");
      }
    },
    [],
  );

  // Function to enforce minimum spacing between nodes
  const enforceMinimumNodeSpacing = useCallback(
    (
      nodes: Node[],
      minGap: number = 16,
      existingNodes: Node[] = [],
    ): Node[] => {
      if (nodes.length === 0) return nodes;

      const adjustedNodes = [...nodes];
      const maxIterations = 10; // Prevent infinite loops
      const allNodes = [...existingNodes, ...adjustedNodes]; // Combined set for collision checking

      // Helper function to get actual node dimensions
      const getNodeDimensions = (node: Node) => ({
        width: node.width || 200, // Fallback to 200 if width not specified
        height: node.height || 100, // Fallback to 100 if height not specified
      });

      // Helper function to check if two nodes are too close
      const areNodesTooClose = (nodeA: Node, nodeB: Node) => {
        const dimA = getNodeDimensions(nodeA);
        const dimB = getNodeDimensions(nodeB);

        const aLeft = nodeA.position.x;
        const aRight = nodeA.position.x + dimA.width;
        const aTop = nodeA.position.y;
        const aBottom = nodeA.position.y + dimA.height;

        const bLeft = nodeB.position.x;
        const bRight = nodeB.position.x + dimB.width;
        const bTop = nodeB.position.y;
        const bBottom = nodeB.position.y + dimB.height;

        // Check if bounding boxes overlap or are too close
        const horizontalOverlap = !(
          aRight + minGap < bLeft || bRight + minGap < aLeft
        );
        const verticalOverlap = !(
          aBottom + minGap < bTop || bBottom + minGap < aTop
        );

        return horizontalOverlap && verticalOverlap;
      };

      // Iteratively resolve collisions until stable or max iterations reached
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let hasCollisions = false;

        // Check all pairs for collisions
        for (let i = 0; i < adjustedNodes.length; i++) {
          const nodeA = adjustedNodes[i];
          const dimA = getNodeDimensions(nodeA);

          // Check against existing nodes (we can't move these)
          for (let k = 0; k < existingNodes.length; k++) {
            const existingNode = existingNodes[k];
            if (areNodesTooClose(nodeA, existingNode)) {
              hasCollisions = true;

              // Move the new node away from existing node
              const dimExisting = getNodeDimensions(existingNode);
              const centerAX = nodeA.position.x + dimA.width / 2;
              const centerAY = nodeA.position.y + dimA.height / 2;
              const centerExistingX =
                existingNode.position.x + dimExisting.width / 2;
              const centerExistingY =
                existingNode.position.y + dimExisting.height / 2;

              const deltaX = centerAX - centerExistingX;
              const deltaY = centerAY - centerExistingY;

              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Adjust horizontally
                if (deltaX > 0) {
                  // Move nodeA to the right
                  adjustedNodes[i] = {
                    ...nodeA,
                    position: {
                      ...nodeA.position,
                      x: existingNode.position.x + dimExisting.width + minGap,
                    },
                  };
                } else {
                  // Move nodeA to the left
                  adjustedNodes[i] = {
                    ...nodeA,
                    position: {
                      ...nodeA.position,
                      x: existingNode.position.x - dimA.width - minGap,
                    },
                  };
                }
              } else {
                // Adjust vertically
                if (deltaY > 0) {
                  // Move nodeA down
                  adjustedNodes[i] = {
                    ...nodeA,
                    position: {
                      ...nodeA.position,
                      y: existingNode.position.y + dimExisting.height + minGap,
                    },
                  };
                } else {
                  // Move nodeA up
                  adjustedNodes[i] = {
                    ...nodeA,
                    position: {
                      ...nodeA.position,
                      y: existingNode.position.y - dimA.height - minGap,
                    },
                  };
                }
              }
            }
          }

          // Check against other new nodes
          for (let j = i + 1; j < adjustedNodes.length; j++) {
            const nodeB = adjustedNodes[j];
            if (areNodesTooClose(adjustedNodes[i], nodeB)) {
              hasCollisions = true;

              // Move the later node (nodeB) away from the earlier one
              const dimB = getNodeDimensions(nodeB);
              const centerAX = adjustedNodes[i].position.x + dimA.width / 2;
              const centerAY = adjustedNodes[i].position.y + dimA.height / 2;
              const centerBX = nodeB.position.x + dimB.width / 2;
              const centerBY = nodeB.position.y + dimB.height / 2;

              const deltaX = centerBX - centerAX;
              const deltaY = centerBY - centerAY;

              // Add small random jitter to prevent oscillation
              const jitter = (Math.random() - 0.5) * 4;

              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Adjust horizontally
                if (deltaX > 0) {
                  // Move nodeB to the right
                  adjustedNodes[j] = {
                    ...nodeB,
                    position: {
                      ...nodeB.position,
                      x:
                        adjustedNodes[i].position.x +
                        dimA.width +
                        minGap +
                        jitter,
                    },
                  };
                } else {
                  // Move nodeB to the left
                  adjustedNodes[j] = {
                    ...nodeB,
                    position: {
                      ...nodeB.position,
                      x:
                        adjustedNodes[i].position.x -
                        dimB.width -
                        minGap +
                        jitter,
                    },
                  };
                }
              } else {
                // Adjust vertically
                if (deltaY > 0) {
                  // Move nodeB down
                  adjustedNodes[j] = {
                    ...nodeB,
                    position: {
                      ...nodeB.position,
                      y:
                        adjustedNodes[i].position.y +
                        dimA.height +
                        minGap +
                        jitter,
                    },
                  };
                } else {
                  // Move nodeB up
                  adjustedNodes[j] = {
                    ...nodeB,
                    position: {
                      ...nodeB.position,
                      y:
                        adjustedNodes[i].position.y -
                        dimB.height -
                        minGap +
                        jitter,
                    },
                  };
                }
              }
            }
          }
        }

        // If no collisions found, we're done
        if (!hasCollisions) {
          break;
        }

        // Log progress for debugging
        if (iteration === maxIterations - 1) {
          console.warn(
            `⚠️ Node spacing hit max iterations (${maxIterations}), some overlaps may remain`,
          );
        }
      }

      return adjustedNodes;
    },
    [],
  );

  const handleCreateFromPrompt = useCallback(
    async (prompt: string) => {
      try {
        // Create a new blank tab first
        const newTab = createBlankTab();
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);

        // Generate workflow directly using AI
        const generatedWorkflow = await generateWorkflowFromPrompt(prompt);

        // Update the new tab with generated nodes, edges, and AI-derived name
        const tabName = generatedWorkflow.generatedTitle ?? generateCuteName();
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === newTab.id
              ? {
                  ...tab,
                  name: tabName,
                  metadata: { ...tab.metadata, name: tabName },
                  nodes: generatedWorkflow.nodes.map((node) => ({
                    ...node,
                    selected: false,
                  })),
                  edges: generatedWorkflow.edges.map((edge) => ({
                    ...edge,
                    selected: false,
                  })),
                }
              : tab,
          ),
        );

        toast({
          title: "Workflow Generated",
          description: `Created ${generatedWorkflow.nodes.length} nodes and ${generatedWorkflow.edges.length} connections.`,
          variant: "default",
        });
      } catch (error) {
        console.error("Workflow generation error:", error);

        // Skip showing toast for credit errors - already handled by generateWorkflowFromPrompt
        if (error instanceof Error && error.message === "Out of credits") {
          return;
        }

        let title = "Generation Failed";
        let description = "Failed to generate workflow. Please try again.";

        if (error instanceof Error) {
          if (error.message.includes("401")) {
            title = "Authentication Error";
            description =
              "Invalid API key. Please check your AI settings.";
          } else if (error.message.includes("429")) {
            title = "Rate Limit Exceeded";
            description =
              "Too many requests. Please wait a moment and try again.";
          } else if (error.message.includes("500")) {
            title = "Server Error";
            description =
              "AI service is temporarily unavailable. Please try again later.";
          } else {
            description = error.message;
          }
        }

        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    },
    [createBlankTab, generateWorkflowFromPrompt, toast],
  );

  const handleCreateFromFile = useCallback(
    (data: any) => {
      // ── Native .kiteframe format ─────────────────────────────────────────
      if (data?.format === "kiteframe-workflow") {
        const result = importWorkflow(data, { restoreDocumentation: true });
        if (!result.success || !result.data) {
          toast({
            title: "Import Failed",
            description: result.error || "Could not parse .kiteframe file.",
            variant: "destructive",
          });
          return;
        }
        const { data: wf } = result;
        const tabName = wf.metadata.name || generateCuteName();
        const initialState = {
          nodes: (wf.nodes ?? []).map((n: any) => ({ ...n, selected: false })),
          edges: (wf.edges ?? []).map((e: any) => ({ ...e, selected: false })),
          canvasObjects: wf.canvasObjects ?? [],
          viewport: wf.viewport ?? { x: 0, y: 0, zoom: 1 },
        };
        const newTab: WorkflowTab = {
          id: generateTabId(),
          name: tabName,
          ...initialState,
          selectedNodeId: "",
          selectedEdgeId: "",
          history: [initialState],
          historyIndex: 0,
          showImageModal: null,
          metadata: {
            name: tabName,
            description: wf.metadata.description ?? "",
            links: [],
            linksFormat: "text",
            categories: [],
          },
          sketchStrokes: wf.sketchStrokes ?? [],
          flowSettings: {},
          projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        return;
      }

      // ── Extracted JSON format { nodes, edges, canvasObjects, viewport, workflowMetadata } ──
      const nodes: Node[] = Array.isArray(data?.nodes) ? data.nodes : [];
      const edges: Edge[] = Array.isArray(data?.edges) ? data.edges : [];
      const canvasObjects: any[] = Array.isArray(data?.canvasObjects) ? data.canvasObjects : [];
      const viewport = data?.viewport ?? { x: 0, y: 0, zoom: 1 };
      const importedName = data?.workflowMetadata?.name || generateCuteName();

      const initialState = {
        nodes: nodes.map((node) => ({ ...node, selected: false })),
        edges: edges.map((edge) => ({ ...edge, selected: false })),
        canvasObjects,
        viewport,
      };

      const newTab: WorkflowTab = {
        id: generateTabId(),
        name: importedName,
        ...initialState,
        selectedNodeId: "",
        selectedEdgeId: "",
        history: [initialState],
        historyIndex: 0,
        showImageModal: null,
        metadata: {
          name: importedName,
          description: data?.workflowMetadata?.description ?? "",
          links: data?.workflowMetadata?.links ?? [],
          linksFormat: "text",
          categories: data?.workflowMetadata?.categories ?? [],
        },
        flowSettings: {},
        sketchStrokes: [],
        projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    },
    [generateTabId, generateCuteName, toast],
  );

  const handleCreateFromTemplate = useCallback(
    (template: { name: string; nodes: Node[]; edges: Edge[] }) => {
      const initialState = {
        nodes: template.nodes.map((node) => ({ ...node, selected: false })),
        edges: template.edges.map((edge) => ({ ...edge, selected: false })),
        canvasObjects: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      const newTab: WorkflowTab = {
        id: generateTabId(),
        name: template.name,
        ...initialState,
        selectedNodeId: "",
        selectedEdgeId: "",
        history: [initialState], // Initialize with current state
        historyIndex: 0, // Start at index 0, not -1
        showImageModal: null,
        metadata: {
          name: template.name,
          description: "",
          links: [],
          linksFormat: "text",
          categories: [],
        },
        projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
    },
    [generateTabId, generateCuteName],
  );

  // History management - captures snapshot SYNCHRONOUSLY, debounces only the push
  const saveToHistoryTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingSnapshotRef = useRef<{
    snapshot: { nodes: Node[]; edges: Edge[]; canvasObjects: CanvasObject[]; viewport: { x: number; y: number; zoom: number } };
    label: string;
    tabId: string; // Track which tab this snapshot belongs to
  } | null>(null);

  const saveToHistory = useCallback(
    (label?: string) => {
      if (!activeTab) return;

      const currentTabId = activeTab.id;

      // CRITICAL: Capture snapshot SYNCHRONOUSLY before any mutation
      // This ensures we save the "before" state, not "after"
      const snapshot = {
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
        canvasObjects: structuredClone(canvasObjects),
        viewport: { ...viewport },
      };

      // Store the snapshot with tab ID for the debounced push
      pendingSnapshotRef.current = { snapshot, label: label || 'unlabeled', tabId: currentTabId };

      // Clear any existing timeout to debounce the history push (not snapshot)
      if (saveToHistoryTimeoutRef.current) {
        clearTimeout(saveToHistoryTimeoutRef.current);
      }

      saveToHistoryTimeoutRef.current = setTimeout(() => {
        const pending = pendingSnapshotRef.current;
        if (!pending) return;

        const { snapshot: newHistoryState, label: actionLabel, tabId: targetTabId } = pending;
        pendingSnapshotRef.current = null;

        // Update the correct tab's history using setTabs directly
        // This ensures history is written to the originating tab even if user switched tabs
        setTabs(prevTabs => {
          const targetTab = prevTabs.find(t => t.id === targetTabId);
          if (!targetTab) {
            return prevTabs;
          }

          const currentHistory = targetTab.history;
          const currentHistoryIndex = targetTab.historyIndex;
          const lastState = currentHistory[currentHistoryIndex];

          // Check if this state is actually different from the last saved state
          // Use JSON comparison for deep equality (not just array lengths!)
          const isIdentical = lastState && (
            JSON.stringify(lastState.nodes) === JSON.stringify(newHistoryState.nodes) &&
            JSON.stringify(lastState.edges) === JSON.stringify(newHistoryState.edges) &&
            JSON.stringify(lastState.canvasObjects) === JSON.stringify(newHistoryState.canvasObjects)
          );

          if (isIdentical) {
            return prevTabs;
          }

          // Remove any future history states if we're in the middle of history
          const newHistory = [
            ...currentHistory.slice(0, currentHistoryIndex + 1),
            newHistoryState,
          ];

          // Limit history size to prevent memory issues (keep last 20 states)
          const maxHistorySize = 20;
          const trimmedHistory =
            newHistory.length > maxHistorySize
              ? newHistory.slice(-maxHistorySize)
              : newHistory;
          const newHistoryIndex = trimmedHistory.length - 1;

          return prevTabs.map(tab =>
            tab.id === targetTabId
              ? { ...tab, history: trimmedHistory, historyIndex: newHistoryIndex }
              : tab
          );
        });
      }, 50); // Reduced debounce to 50ms since snapshot is already captured
    },
    [activeTab, nodes, edges, canvasObjects, viewport, setTabs],
  );

  // Accept Proposal - commits active variant to canvas with undo support (Phase 2)
  // Uses ref to read latest proposal state at click time (prevents variant drift bug)
  const handleAcceptProposal = useCallback(() => {
    const currentProposal = proposalStateRef.current.proposal;
    if (!currentProposal) return;
    
    // Read activeVariant at click time to honor any tab switches
    const activeVariant = currentProposal.activeVariant;
    const variantData = activeVariant === 'proposed' ? currentProposal.proposed : currentProposal.alternative;
    
    // Generate truly unique IDs with timestamp + random suffix to prevent collisions
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    const proposalId = `proposal-${timestamp}-${randomSuffix}`;
    
    // Phase 5: Add provenance metadata to node.meta (immutable after creation)
    const newNodes: Node[] = variantData.nodes.map((node, idx) => ({
      ...node,
      id: `node-${timestamp}-${randomSuffix}-${idx}`,
      meta: {
        ...node.meta,
        createdFromInsightId: currentProposal.insightId,
        createdFromProposalId: proposalId,
        createdAt: timestamp,
        source: 'ai' as const,
      },
    }));
    
    // Build ID map from old preview IDs to new live IDs
    const nodeIdMap: Record<string, string> = {};
    variantData.nodes.forEach((node, idx) => {
      nodeIdMap[node.id] = `node-${timestamp}-${randomSuffix}-${idx}`;
    });
    
    // Phase 5: Add provenance metadata to edge.meta (immutable after creation)
    // Also ensure markerEnd is set for arrow indicators on AI-generated edges
    const newEdges: Edge[] = variantData.edges.map((edge, idx) => ({
      ...edge,
      id: `edge-${timestamp}-${randomSuffix}-${idx}`,
      source: nodeIdMap[edge.source] || edge.source,
      target: nodeIdMap[edge.target] || edge.target,
      markerEnd: edge.markerEnd ?? true,
      meta: {
        ...edge.meta,
        createdFromInsightId: currentProposal.insightId,
        createdFromProposalId: proposalId,
        createdAt: timestamp,
        source: 'ai' as const,
      },
    }));
    
    // Phase 6: Check for semantic enforcement blocking (only if flag is enabled)
    if (ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT) {
      const insightForBlocking = insights.insights.find((i: { id: string }) => i.id === currentProposal.insightId);
      const combinedNodesForCheck = [...nodes, ...newNodes];
      const combinedEdgesForCheck = [...edges, ...newEdges];
      const blockCheck = shouldBlockAcceptance(
        combinedNodesForCheck,
        combinedEdgesForCheck,
        insightForBlocking ? [insightForBlocking] : []
      );
      
      if (blockCheck.blocked) {
        toast({
          title: 'Acceptance Blocked',
          description: blockCheck.reason || 'This workflow has structural gaps that need to be addressed.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    const nodeUpdates = variantData.nodeUpdates ?? [];

    withUndo(
      `Apply proposal from Insight: ${currentProposal.insightTitle}`,
      saveToHistory,
      () => {
        setNodes(currentNodes => {
          const updatesMap: Record<string, typeof nodeUpdates[0]> = {};
          for (const u of nodeUpdates) updatesMap[u.id] = u;
          const updated = currentNodes.map(n => {
            const u = updatesMap[n.id];
            if (!u) return n;
            // Defensive guard: only mutate nodes whose current label is still generic.
            // Shared helper (proposalUtils) ensures consistent behaviour with generation.
            if (!isGenericNodeLabel(n.data?.label, n.id)) return n;
            return {
              ...n,
              data: {
                ...n.data,
                label: u.label,
                description: u.description ?? n.data?.description ?? '',
              },
            };
          });
          return [...updated, ...newNodes];
        });
        setEdges(currentEdges => [...currentEdges, ...newEdges]);
      }
    );
    
    // Mark the insight as resolved when proposal is accepted
    if (currentProposal.insightId) {
      insights.markResolved(currentProposal.insightId);
    }
    
    // Record session signal for heuristic learning
    recordProposalAccepted(currentProposal.insightId, activeVariant);
    
    // Phase 6: Run semantic analysis on the combined workflow
    const combinedNodes = [...nodes, ...newNodes];
    const combinedEdges = [...edges, ...newEdges];
    const insightData = insights.insights.find((i: { id: string }) => i.id === currentProposal.insightId);
    const { claims: semanticClaims, mismatches: semanticMismatches } = getSemanticAnalysis(
      combinedNodes,
      combinedEdges,
      insightData ? [insightData] : []
    );
    
    // Phase 5: Capture decision snapshot and record timeline event
    if (insightData) {
      const snapshot = captureProposalDecision({
        insight: insightData,
        variantChosen: activeVariant,
        affectedNodeIds: currentProposal.affectedNodeIds || [],
        createdNodeIds: newNodes.map(n => n.id),
        createdEdgeIds: newEdges.map(e => e.id),
        heuristics: {},
        scopeCalibration: {
          affectedNodeCount: currentProposal.affectedNodeIds?.length || 0,
          cancelCountForInsight: 0,
          reducedScope: false,
        },
        uncertaintyLevel: 'low',
        validationWarnings: [],
        heuristicsEnabled: ENABLE_PHASE_4_HEURISTICS,
        modelProvenance: currentProposal.modelProvenance,
        semanticClaims,
        semanticMismatches,
      });
      storeDecisionSnapshot(snapshot);
      recordProposalTimelineAccept(snapshot);
    }
    
    // Clear session lock on accept (Phase A - Session Locking)
    if (proposalSessionIdRef.current) {
      clearSessionLock(proposalSessionIdRef.current);
      proposalSessionIdRef.current = null;
    }
    
    setProposalState({ proposal: null, generatingInsightId: null, error: null });
    
    toast({
      title: 'Proposal Applied',
      description: `Added ${newNodes.length} node${newNodes.length !== 1 ? 's' : ''} and ${newEdges.length} connection${newEdges.length !== 1 ? 's' : ''} to your workflow.`,
    });
  }, [nodes, edges, setNodes, setEdges, saveToHistory, toast, insights]);

  // Accept Experiment - commits selected experiment to canvas with undo support (Phase 3)
  const handleAcceptExperiment = useCallback(() => {
    const currentSession = experimentStateRef.current.session;
    if (!currentSession || !currentSession.activeExperimentId) return;
    
    const activeExperiment = currentSession.experiments.find(e => e.id === currentSession.activeExperimentId);
    if (!activeExperiment) return;
    
    // Find experiment index for decision snapshot
    const experimentIndex = currentSession.experiments.findIndex(e => e.id === currentSession.activeExperimentId);
    
    // Generate truly unique IDs with timestamp + random suffix to prevent collisions
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    
    // Phase 5: Add provenance metadata to node.meta (immutable after creation)
    const newNodes: Node[] = activeExperiment.variant.nodes.map((node, idx) => ({
      ...node,
      id: `node-${timestamp}-${randomSuffix}-${idx}`,
      meta: {
        ...node.meta,
        createdFromInsightId: currentSession.insightId,
        createdFromExperimentId: activeExperiment.id,
        createdAt: timestamp,
        source: 'ai' as const,
      },
    }));
    
    // Build ID map from old preview IDs to new live IDs
    const nodeIdMap: Record<string, string> = {};
    activeExperiment.variant.nodes.forEach((node, idx) => {
      nodeIdMap[node.id] = `node-${timestamp}-${randomSuffix}-${idx}`;
    });
    
    // Phase 5: Add provenance metadata to edge.meta (immutable after creation)
    // Also ensure markerEnd is set for arrow indicators on AI-generated edges
    const newEdges: Edge[] = activeExperiment.variant.edges.map((edge, idx) => ({
      ...edge,
      id: `edge-${timestamp}-${randomSuffix}-${idx}`,
      source: nodeIdMap[edge.source] || edge.source,
      target: nodeIdMap[edge.target] || edge.target,
      markerEnd: edge.markerEnd ?? true,
      meta: {
        ...edge.meta,
        createdFromInsightId: currentSession.insightId,
        createdFromExperimentId: activeExperiment.id,
        createdAt: timestamp,
        source: 'ai' as const,
      },
    }));
    
    // Phase 6: Check for semantic enforcement blocking (only if flag is enabled)
    if (ENABLE_SEMANTIC_COMPLETENESS_ENFORCEMENT) {
      const insightForBlocking = insights.insights.find((i: { id: string }) => i.id === currentSession.insightId);
      const combinedNodesForCheck = [...nodes, ...newNodes];
      const combinedEdgesForCheck = [...edges, ...newEdges];
      const blockCheck = shouldBlockAcceptance(
        combinedNodesForCheck,
        combinedEdgesForCheck,
        insightForBlocking ? [insightForBlocking] : []
      );
      
      if (blockCheck.blocked) {
        toast({
          title: 'Acceptance Blocked',
          description: blockCheck.reason || 'This workflow has structural gaps that need to be addressed.',
          variant: 'destructive',
        });
        return;
      }
    }
    
    withUndo(
      `Apply experiment: ${activeExperiment.title}`,
      saveToHistory,
      () => {
        // Use functional updates to ensure we're working with the latest canvas state
        setNodes(currentNodes => [...currentNodes, ...newNodes]);
        setEdges(currentEdges => [...currentEdges, ...newEdges]);
      }
    );
    
    // Mark the insight as resolved when experiment is accepted
    if (currentSession.insightId) {
      insights.markResolved(currentSession.insightId);
    }
    
    // Record session signal for heuristic learning
    recordExperimentAccepted(currentSession.insightId, activeExperiment.id);
    
    // Phase 6: Run semantic analysis on the combined workflow
    const combinedNodes = [...nodes, ...newNodes];
    const combinedEdges = [...edges, ...newEdges];
    const insightData = insights.insights.find((i: { id: string }) => i.id === currentSession.insightId);
    const { claims: semanticClaims, mismatches: semanticMismatches } = getSemanticAnalysis(
      combinedNodes,
      combinedEdges,
      insightData ? [insightData] : []
    );
    
    // Phase 5: Capture decision snapshot and record timeline event
    if (insightData) {
      const snapshot = captureExperimentDecision({
        insight: insightData,
        experimentIndex,
        experimentLabel: activeExperiment.title,
        affectedNodeIds: currentSession.affectedNodeIds || [],
        createdNodeIds: newNodes.map(n => n.id),
        createdEdgeIds: newEdges.map(e => e.id),
        heuristics: {},
        scopeCalibration: {
          affectedNodeCount: currentSession.affectedNodeIds?.length || 0,
          cancelCountForInsight: 0,
          reducedScope: false,
        },
        uncertaintyLevel: 'low',
        validationWarnings: [],
        heuristicsEnabled: ENABLE_PHASE_4_HEURISTICS,
        modelProvenance: currentSession.modelProvenance,
        semanticClaims,
        semanticMismatches,
      });
      storeDecisionSnapshot(snapshot);
      recordExperimentTimelineAccept(snapshot);
    }
    
    // Clear session lock on accept (Phase A - Session Locking)
    if (experimentSessionIdRef.current) {
      clearSessionLock(experimentSessionIdRef.current);
      experimentSessionIdRef.current = null;
    }
    
    setExperimentState({ session: null, generatingInsightId: null, error: null });
    
    toast({
      title: 'Experiment Applied',
      description: `Added ${newNodes.length} node${newNodes.length !== 1 ? 's' : ''} and ${newEdges.length} connection${newEdges.length !== 1 ? 's' : ''} to your workflow.`,
    });
  }, [nodes, edges, setNodes, setEdges, saveToHistory, toast, insights]);

  // Quick-add functionality
  const handleQuickAdd = useCallback(
    (sourceNode: Node, position: "top" | "right" | "bottom" | "left") => {
      saveToHistory("Add node (quick-add)"); // Save current state before adding node

      const spacing = proFeaturesConfig.quickAdd?.defaultSpacing ?? 250;
      const nodeType = proFeaturesConfig.quickAdd?.defaultNodeType ?? "process";
      const template = proFeaturesConfig.quickAdd?.defaultNodeTemplate ?? {};

      let newPosition = { x: 0, y: 0 };
      switch (position) {
        case "top":
          newPosition = {
            x: sourceNode.position.x,
            y: sourceNode.position.y - spacing,
          };
          break;
        case "right":
          newPosition = {
            x: sourceNode.position.x + spacing,
            y: sourceNode.position.y,
          };
          break;
        case "bottom":
          newPosition = {
            x: sourceNode.position.x,
            y: sourceNode.position.y + spacing,
          };
          break;
        case "left":
          newPosition = {
            x: sourceNode.position.x - spacing,
            y: sourceNode.position.y,
          };
          break;
      }

      const isImageNode = nodeType === "image";
      const defaultWidth = isImageNode ? 240 : 200;
      const defaultHeight = isImageNode ? 240 : 100;

      const newNode: Node = {
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: nodeType,
        position: newPosition,
        data: {
          label: isImageNode ? "Image" : "New Process",
          description: isImageNode
            ? "Configure image"
            : "Configure process settings",
          icon: isImageNode ? "Image" : "Cog",
          iconColor: isImageNode ? "text-pink-500" : "text-gray-500",
          ...template,
        },
        width: defaultWidth,
        height: defaultHeight,
      };

      // Add the new node
      setNodes((prev) => [...prev, newNode]);

      // Create connecting edge
      const newEdge: Edge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: sourceNode.id,
        target: newNode.id,
        type: "bezier",
        style: {
          strokeColor: "#3b82f6",
          strokeWidth: 2,
        },
        markers: {
          type: "arrow",
          position: "end",
        },
        reconnectable: true,
        interactable: true,
      };

      setEdges((prev) => [...prev, newEdge]);

      // Call custom handler if provided
      if (proFeaturesConfig.quickAdd?.onQuickAdd) {
        proFeaturesConfig.quickAdd.onQuickAdd(sourceNode, position, newNode);
      }
    },
    [proFeaturesConfig.quickAdd, saveToHistory],
  );

  // Handle edge reconnection from pro features
  const handleEdgeReconnect = useCallback(
    (edgeId: string, newSource: string, newTarget: string) => {
      saveToHistory("Reconnect edge");
      setEdges((prev) =>
        prev.map((edge) =>
          edge.id === edgeId
            ? { ...edge, source: newSource, target: newTarget, selected: false }
            : edge,
        ),
      );
    },
    [setEdges, saveToHistory],
  );

  // Helper function to calculate offset position for appending workflows
  const calculateWorkflowOffset = useCallback(
    (newNodes: Node[]): { x: number; y: number } => {
      if (nodes.length === 0) {
        return { x: 0, y: 0 }; // No offset needed if canvas is empty
      }

      // Find the bottommost position of existing nodes
      let maxY = -Infinity;

      nodes.forEach((node) => {
        const nodeBottom = node.position.y + (node.height || 100);
        if (nodeBottom > maxY) maxY = nodeBottom;
      });

      // Find the topmost position of new nodes
      let minNewY = Infinity;

      newNodes.forEach((node) => {
        if (node.position.y < minNewY) minNewY = node.position.y;
      });

      // Calculate offset to place new workflow underneath with some spacing
      const verticalSpacing = 150;

      const offsetX = 0; // Keep horizontal alignment with existing workflow
      const offsetY = maxY + verticalSpacing - minNewY;

      return { x: offsetX, y: offsetY };
    },
    [nodes],
  );

  // Handle template creation to current active tab
  const handleAddTemplateToCurrentTab = useCallback(
    (templateType: string, anchorPosition?: { x: number; y: number }) => {
      let templateData;

      // Generate appropriate template based on type
      switch (templateType) {
        case "getting-started":
          templateData = generateGettingStartedTemplate();
          break;
        case "user-journey":
          templateData = generateUserJourneyTemplate();
          break;
        case "product-roadmap":
          templateData = generateProductRoadmapTemplate();
          break;
        case "okr-planning":
          templateData = generateOKRPlanningTemplate();
          break;
        case "feature-request-flow":
          templateData = generateFeatureRequestFlowTemplate();
          break;
        case "decision-tree":
          templateData = generateDecisionTreeTemplate();
          break;
        case "mindmap":
          templateData = generateMindmapTemplate();
          break;
        case "system-architecture":
          templateData = generateSystemArchitectureTemplate();
          break;
        case "swim-lanes":
          templateData = generateSwimLanesTemplate();
          break;
        case "user-account-creation":
          templateData = generateUserAccountTemplate();
          break;
        case "io-logic":
          templateData = generateIOLogicTemplate();
          break;
        default:
          console.warn("Unknown template type:", templateType);
          return;
      }

      let offset: { x: number; y: number };

      if (anchorPosition) {
        // When a specific position is provided (from drag-and-drop), place template there
        // Calculate the bounding box of the template
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        templateData.nodes.forEach((node) => {
          if (node.position.x < minX) minX = node.position.x;
          if (node.position.y < minY) minY = node.position.y;
          const nodeRight = node.position.x + (node.width || 200);
          const nodeBottom = node.position.y + (node.height || 100);
          if (nodeRight > maxX) maxX = nodeRight;
          if (nodeBottom > maxY) maxY = nodeBottom;
        });

        // Calculate center of template bounding box
        const templateCenterX = (minX + maxX) / 2;
        const templateCenterY = (minY + maxY) / 2;

        // Offset to center template at the drop position
        offset = {
          x: anchorPosition.x - templateCenterX,
          y: anchorPosition.y - templateCenterY,
        };
      } else {
        // Use the existing offset calculation for appending workflows
        offset = calculateWorkflowOffset(templateData.nodes);
      }

      const timestamp = Date.now();

      // Apply offset to new nodes and ensure unique IDs
      const offsetNodes = templateData.nodes.map((node) => {
        const isImageNode = node.type === "image";
        const defaultWidth = isImageNode ? 240 : 200;
        const defaultHeight = isImageNode ? 240 : 100;
        return {
          ...node,
          id: `${node.id}-${timestamp}`, // Ensure unique IDs
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
          selected: false,
          // Ensure proper width/height for handle alignment
          width: node.width || defaultWidth,
          height: node.height || defaultHeight,
          // Ensure handles are properly aligned
          draggable: true,
          selectable: true,
        };
      });

      // Apply offset to new edges and update IDs
      const offsetEdges = templateData.edges.map((edge) => ({
        ...edge,
        id: `${edge.id}-${timestamp}`, // Ensure unique IDs
        source: `${edge.source}-${timestamp}`,
        target: `${edge.target}-${timestamp}`,
        selected: false,
        reconnectable: true, // Enable reconnection for template edges
        interactable: true, // Make edges clickable
      }));

      // Save to history for undo/redo (before mutations so snapshot is pre-addition)
      saveToHistory("Add template");

      // Append to existing nodes and edges
      setNodes((prev) => [...prev, ...offsetNodes]);
      setEdges((prev) => [...prev, ...offsetEdges]);

      // Toast notification for template creation
      toast({
        title: "Template Added",
        description: `${templateType.replace(/([A-Z])/g, " $1").trim()} template added to canvas`,
        variant: "default",
      });
    },
    [
      generateUserJourneyTemplate,
      generateMindmapTemplate,
      generateSystemArchitectureTemplate,
      generateSwimLanesTemplate,
      generateUserAccountTemplate,
      generateIOLogicTemplate,
      calculateWorkflowOffset,
      setNodes,
      setEdges,
      saveToHistory,
    ],
  );

  // Function to append AI-generated workflow to existing canvas
  const appendAiWorkflowToCanvas = useCallback(
    async (prompt: string) => {
      try {
        // Generate workflow using AI
        const generatedWorkflow = await generateWorkflowFromPrompt(prompt);

        // Apply minimum spacing between nodes in the generated workflow AND relative to existing nodes
        const spacedWorkflow = {
          ...generatedWorkflow,
          nodes: enforceMinimumNodeSpacing(generatedWorkflow.nodes, 16, nodes),
        };

        // Calculate offset for new nodes
        const offset = calculateWorkflowOffset(spacedWorkflow.nodes);

        // Apply offset to new nodes
        const offsetNodes = spacedWorkflow.nodes.map((node) => {
          const isImageNode = node.type === "image";
          const defaultWidth = isImageNode ? 240 : 200;
          const defaultHeight = isImageNode ? 240 : 100;
          return {
            ...node,
            id: `${node.id}-${Date.now()}`, // Ensure unique IDs
            position: {
              x: node.position.x + offset.x,
              y: node.position.y + offset.y,
            },
            width: node.width || defaultWidth,
            height: node.height || defaultHeight,
            selected: false,
          };
        });

        // Apply offset to new edges and update IDs
        const offsetEdges = spacedWorkflow.edges.map((edge) => ({
          ...edge,
          id: `${edge.id}-${Date.now()}`, // Ensure unique IDs
          source: `${edge.source}-${Date.now()}`,
          target: `${edge.target}-${Date.now()}`,
          selected: false,
          reconnectable: true, // Enable reconnection for AI-generated edges
          interactable: true, // Make edges clickable
        }));

        // Append to existing nodes and edges
        setNodes((prev) => [...prev, ...offsetNodes]);
        setEdges((prev) => [...prev, ...offsetEdges]);

        // Save to history after state updates
        setTimeout(() => saveToHistory("Generate AI workflow"), 0);

        toast({
          title: "Workflow Added",
          description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections to canvas.`,
          variant: "default",
        });
      } catch (error) {
        console.error("Workflow generation error:", error);

        // Skip showing toast for credit errors - already handled by generateWorkflowFromPrompt
        if (error instanceof Error && error.message === "Out of credits") {
          return;
        }

        let title = "Generation Failed";
        let description = "Failed to generate workflow. Please try again.";

        if (error instanceof Error) {
          if (error.message.includes("401")) {
            title = "Authentication Error";
            description =
              "Invalid API key. Please check your AI settings.";
          } else if (error.message.includes("429")) {
            title = "Rate Limit Exceeded";
            description =
              "Too many requests. Please wait a moment and try again.";
          } else if (error.message.includes("500")) {
            title = "Server Error";
            description =
              "AI service is temporarily unavailable. Please try again later.";
          } else {
            description = error.message;
          }
        }

        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    },
    [generateWorkflowFromPrompt, calculateWorkflowOffset, saveToHistory, toast],
  );

  // Function to append imported workflow to existing canvas
  const appendImportedWorkflowToCanvas = useCallback(
    (importedData: any) => {
      try {
        let nodes: Node[] = [];
        let edges: Edge[] = [];
        let canvasObjectsToImport: CanvasObject[] = [];

        // Handle comprehensive format
        if (importedData.version && importedData.canvas) {
          const { canvas } = importedData;
          nodes = canvas.nodes || [];
          edges = canvas.edges || [];
          canvasObjectsToImport = canvas.canvasObjects || [];

          toast({
            title: "Importing Comprehensive Workflow",
            description: `Importing "${importedData.workflow?.name || "workflow"}" with all content and styling`,
          });
        } else {
          // Legacy format fallback
          nodes = importedData.nodes || [];
          edges = importedData.edges || [];
          canvasObjectsToImport = importedData.canvasObjects || [];

          toast({
            title: "Importing Legacy Workflow",
            description: "Importing workflow with legacy format",
          });
        }

        if (!nodes.length && !edges.length && !canvasObjectsToImport.length) {
          toast({
            title: "Import Failed",
            description: "No valid content found in the workflow file.",
            variant: "destructive",
          });
          return;
        }

        // Calculate offset for new content
        const offset = calculateWorkflowOffset(nodes);

        // Apply offset to imported nodes with unique IDs
        const offsetNodes = nodes.map((node) => ({
          ...node,
          id: `${node.id}-imported-${Date.now()}`, // Ensure unique IDs
          position: {
            x: node.position.x + offset.x,
            y: node.position.y + offset.y,
          },
          selected: false,
          // Preserve all styling and data
          data: { ...node.data },
          style: node.style || {},
        }));

        // Apply offset to imported edges and update IDs
        const offsetEdges = edges.map((edge) => ({
          ...edge,
          id: `${edge.id}-imported-${Date.now()}`, // Ensure unique IDs
          source: `${edge.source}-imported-${Date.now()}`,
          target: `${edge.target}-imported-${Date.now()}`,
          selected: false,
          // Preserve all styling and data
          style: edge.style || {},
          data: edge.data || {},
        }));

        // Apply offset to imported canvas objects
        const offsetCanvasObjects = canvasObjectsToImport.map((obj) => ({
          ...obj,
          id: `${obj.id}-imported-${Date.now()}`,
          position: {
            x: obj.position.x + offset.x,
            y: obj.position.y + offset.y,
          },
          selected: false,
          // Preserve all styling and data
          data: { ...obj.data },
          style: obj.style || {},
        }));

        // Append to existing content
        setNodes((prev) => [...prev, ...offsetNodes]);
        setEdges((prev) => [...prev, ...offsetEdges]);

        if (offsetCanvasObjects.length > 0) {
          updateActiveTab({
            canvasObjects: [...canvasObjects, ...offsetCanvasObjects],
          });
        }

        // Save to history after state updates
        setTimeout(() => saveToHistory("Import workflow"), 0);

        toast({
          title: "Workflow Imported Successfully",
          description: `Added ${offsetNodes.length} nodes, ${offsetEdges.length} connections, and ${offsetCanvasObjects.length} canvas objects.`,
          variant: "default",
        });
      } catch (error) {
        console.error("Import failed:", error);
        toast({
          title: "Import Failed",
          description:
            "An error occurred while importing the workflow. Please check the file format.",
          variant: "destructive",
        });
      }
    },
    [calculateWorkflowOffset, saveToHistory, toast],
  );

  const handleUndo = useCallback(() => {
    const canUndo = historyIndex > 0 && history.length > 1;

    if (canUndo && history[historyIndex - 1]) {
      const newIndex = historyIndex - 1;
      const targetState = history[newIndex];
      const currentState = history[historyIndex];

      updateActiveTab({
        nodes: [...targetState.nodes],
        edges: [...targetState.edges],
        canvasObjects: [...(targetState.canvasObjects || [])],
        viewport: { ...targetState.viewport },
        historyIndex: newIndex,
      });
      
      // Record undo for session signal tracking (detects immediate undo after accept)
      recordUndo();
    }
  }, [historyIndex, history, updateActiveTab, nodes, edges, activeTab]);

  const handleRedo = useCallback(() => {
    const canRedo = historyIndex < history.length - 1 && history.length > 1;

    if (canRedo && history[historyIndex + 1]) {
      const newIndex = historyIndex + 1;
      const targetState = history[newIndex];
      const currentState = history[historyIndex];

      updateActiveTab({
        nodes: [...targetState.nodes],
        edges: [...targetState.edges],
        canvasObjects: [...(targetState.canvasObjects || [])],
        viewport: { ...targetState.viewport },
        historyIndex: newIndex,
      });
    }
  }, [historyIndex, history, updateActiveTab, nodes, edges, activeTab]);

  // Snapshot and Version History handlers
  const handleSnapshot = useCallback(() => {
    // Access version control plugin through global registry
    const versionPlugin = (window as any).kiteframeVersionControlPlugin;
    if (versionPlugin) {
      versionPlugin.handleSnapshot();
    } else {
      toast({
        title: "Snapshot Created",
        description: "Workflow state saved successfully.",
        variant: "default",
      });
    }
  }, [toast]);

  const handleVersionHistory = useCallback(() => {
    // Access version control plugin through global registry
    const versionPlugin = (window as any).kiteframeVersionControlPlugin;
    if (versionPlugin) {
      versionPlugin.handleVersionHistory();
    } else {
      toast({
        title: "Version History",
        description: "Access version history and snapshots.",
        variant: "default",
      });
    }
  }, [toast]);

  // State for keyboard shortcuts help modal
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Sketch / drawing mode
  const [isSketchMode, setIsSketchMode] = useState(false);
  const [sketchTool, setSketchTool] = useState<'pen' | 'eraser' | 'cursor' | 'lasso'>('pen');
  const [sketchColor, setSketchColor] = useState('#000000');
  const [sketchSize, setSketchSize] = useState(4);
  const [sketchOpacity, setSketchOpacity] = useState(80);
  const [sketchLineStyle, setSketchLineStyle] = useState<'solid' | 'dashed'>('solid');
  const [sketchDashLen, setSketchDashLen] = useState(12);
  const [sketchDashGap, setSketchDashGap] = useState(6);
  const [sketchSmoothing, setSketchSmoothing] = useState(false);
  const [sketchSelection, setSketchSelection] = useState<SketchSelection | null>(null);
  // Per-tab sketch strokes derived from the active tab's data
  const sketchStrokes = useMemo(
    () => (activeTab?.sketchStrokes ?? []) as import('@/components/SketchCanvas').SketchStroke[],
    [activeTab?.sketchStrokes]
  );
  const setSketchStrokes = useCallback(
    (strokes: import('@/components/SketchCanvas').SketchStroke[]) => updateActiveTab({ sketchStrokes: strokes }),
    [updateActiveTab]
  );
  const [sketchCanUndo, setSketchCanUndo] = useState(false);
  const [sketchCanRedo, setSketchCanRedo] = useState(false);
  const sketchCanvasRef = useRef<SketchCanvasHandle>(null);
  /** Tracks the last known pointer position in client (screen) coordinates for stroke hit-testing. */
  const lastPointerClientRef = useRef<{ clientX: number; clientY: number } | null>(null);
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      lastPointerClientRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    window.addEventListener('pointermove', handler, { passive: true });
    return () => window.removeEventListener('pointermove', handler);
  }, []);

  // Subscribe to VLStore changes so sketch hide/lock toggles re-render the canvas
  const [vlVersion, bumpVL] = useState(0);
  useEffect(() => {
    return VLStore.subscribe(() => bumpVL(v => v + 1));
  }, []);
  const { hiddenStrokeIndices, lockedStrokeIndices } = useMemo(() => {
    const flags = VLStore.get();
    const hidden = new Set<number>();
    const locked = new Set<number>();
    const markupHidden = !!flags.hidden['markup'];
    const markupLocked = !!flags.locked['markup'];
    for (let i = 0; i < sketchStrokes.length; i++) {
      if (markupHidden || flags.hidden[`stroke:${i}`]) hidden.add(i);
      if (markupLocked || flags.locked[`stroke:${i}`]) locked.add(i);
    }
    return { hiddenStrokeIndices: hidden, lockedStrokeIndices: locked };
  }, [sketchStrokes, vlVersion]);

  // Comprehensive keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Allow Escape to work even in input fields
      if (e.key === "Escape") {
        // Sketch mode: clear selection first, then exit on second press
        if (isSketchMode) {
          if ((sketchTool === 'cursor' || sketchTool === 'lasso') && sketchCanvasRef.current?.hasSelection()) {
            sketchCanvasRef.current.clearSelection();
            setSketchSelection(null);
          } else {
            setIsSketchMode(false);
            sketchCanvasRef.current?.clearSelection();
            setSketchSelection(null);
          }
          return;
        }
        // Deselect all nodes and edges
        setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
        setEdges((prev) => prev.map((edge) => ({ ...edge, selected: false })));
        setSelectedNodeId("");
        setSelectedEdgeId("");
        setSelectedEdgeIds([]);
        setLinearToolbar(null);
        // Also blur any focused input
        if (isInputFocused) {
          (target as HTMLElement).blur();
        }
        return;
      }

      // Skip other shortcuts if in input field
      if (isInputFocused) {
        return;
      }

      // C - Toggle comment placement mode (works regardless of read-only state)
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCommentPlacing((prev) => !prev);
        return;
      }

      // All mutation shortcuts are disabled in mobile read-only mode
      if (effectiveReadOnly) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Delete key handler (Delete or Backspace)
      if (e.key === "Delete" || e.key === "Backspace") {
        // Do not allow deletion while a mockup node is in refine-prompt mode
        if (refineMockupNodeId) return;
        // Sketch strokes: delete selected strokes (works whether or not sketch mode is active)
        if (sketchCanvasRef.current?.hasSelection() && sketchSelection) {
          e.preventDefault();
          const indices = new Set(sketchSelection.strokeIndices);
          setSketchStrokes(sketchStrokes.filter((_, i) => !indices.has(i)));
          sketchCanvasRef.current?.clearSelection();
          setSketchSelection(null);
          return;
        }
        // Get lock state from VLStore to check if items are locked
        const { locked } = VLStore.get();
        const ancestors = AncestorsStore.get();
        const isNodeLocked = (nodeId: string) => 
          isEffectivelyOn(nodeId, ancestors[nodeId] ?? [], locked);
        const isEdgeLocked = (edge: Edge) => 
          isNodeLocked(edge.source) || isNodeLocked(edge.target);
        
        const selectedNodesList = nodes.filter((n) => n.selected);
        const selectedEdgesList = edges.filter((edge) => edge.selected);
        const hasSelectedObjects = selectedCanvasObjects.length > 0;
        
        // Filter out locked items - only delete unlocked ones
        const deletableNodes = selectedNodesList.filter((n) => !isNodeLocked(n.id));
        const deletableEdges = selectedEdgesList.filter((e) => !isEdgeLocked(e));
        const lockedNodesCount = selectedNodesList.length - deletableNodes.length;
        const lockedEdgesCount = selectedEdgesList.length - deletableEdges.length;

        // Pre-compute deletion label before any mutations so saveToHistory
        // captures the pre-deletion state (correct "undo" snapshot).
        const wouldDelete = deletableNodes.length > 0 || deletableEdges.length > 0 || hasSelectedObjects;
        if (wouldDelete) {
          const deletionParts = [
            deletableNodes.length > 0 ? `${deletableNodes.length} node(s)` : null,
            deletableEdges.length > 0 ? `${deletableEdges.length} edge(s)` : null,
            hasSelectedObjects ? `${selectedCanvasObjects.length} object(s)` : null,
          ].filter(Boolean);
          saveToHistory(`Delete ${deletionParts.join(", ")}`);
        }

        const deletedItems: string[] = [];

        if (deletableNodes.length > 0) {
          e.preventDefault();
          const deletableNodeIds = new Set(deletableNodes.map((n) => n.id));
          setNodes((prev) => prev.filter((n) => !deletableNodeIds.has(n.id)));
          deletedItems.push(`${deletableNodes.length} node(s)`);
          
          // Only clear selection if ALL selected nodes were deleted
          if (lockedNodesCount === 0) {
            setSelectedNodeId("");
            setLinearToolbar(null);
          }
        }

        if (deletableEdges.length > 0) {
          e.preventDefault();
          const deletableEdgeIds = new Set(deletableEdges.map((e) => e.id));
          setEdges((prev) => prev.filter((edge) => !deletableEdgeIds.has(edge.id)));
          deletedItems.push(`${deletableEdges.length} edge(s)`);
          
          // Only clear selection if ALL selected edges were deleted
          if (lockedEdgesCount === 0) {
            setSelectedEdgeId("");
            setSelectedEdgeIds([]);
            setLinearToolbar(null);
          }
        }

        // Delete selected canvas objects
        if (hasSelectedObjects) {
          e.preventDefault();
          updateActiveTab({
            canvasObjects: canvasObjects.filter((obj) => !obj.selected),
          });
          setLinearToolbar(null);
          deletedItems.push(`${selectedCanvasObjects.length} object(s)`);
        }
        return;
      }

      // Ctrl/Cmd + Z - Undo (sketch mode intercept)
      if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (isSketchMode) {
          sketchCanvasRef.current?.undo();
        } else {
          handleUndo();
        }
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo (sketch mode intercept)
      if (
        (isCtrlOrCmd && e.key === "z" && e.shiftKey) ||
        (isCtrlOrCmd && e.key === "y")
      ) {
        e.preventDefault();
        if (isSketchMode) {
          sketchCanvasRef.current?.redo();
        } else {
          handleRedo();
        }
        return;
      }

      // Ctrl/Cmd + C - Copy (sketch mode: copy selected strokes)
      if (isCtrlOrCmd && e.key === "c") {
        if (isSketchMode) {
          e.preventDefault();
          sketchCanvasRef.current?.copySelection();
        }
        return;
      }

      // Ctrl/Cmd + V - Paste (sketch mode: paste copied strokes)
      if (isCtrlOrCmd && e.key === "v") {
        if (isSketchMode) {
          e.preventDefault();
          sketchCanvasRef.current?.paste();
        }
        return;
      }

      // Ctrl/Cmd + A - Select all nodes
      if (isCtrlOrCmd && e.key === "a") {
        e.preventDefault();
        setNodes((prev) => prev.map((n) => ({ ...n, selected: true })));
        toast({
          title: "Selected All",
          description: `${nodes.length} nodes selected`,
        });
        return;
      }

      // Ctrl/Cmd + S - Save (download) workflow
      if (isCtrlOrCmd && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        if (activeTab) {
          try {
            const exportData = exportWorkflow(
              {
                nodes: activeTab.nodes,
                edges: activeTab.edges,
                canvasObjects: activeTab.canvasObjects,
                viewport: activeTab.viewport,
                sketchStrokes: activeTab.sketchStrokes,
              },
              {
                name: activeTab.name,
                description: activeTab.metadata?.description,
              },
              {
                projectId: projectIdentifier,
                includeDocumentation: true,
                workflowNames: Object.fromEntries(
                  tabs.map((t) => [t.id, t.name]),
                ),
                projectDescription: activeTab.metadata?.description,
              },
            );
            const safeFileName = `${activeTab.name.replace(/\s+/g, "-").toLowerCase()}.kiteframe`;
            downloadWorkflow(exportData, safeFileName);
            toast({
              title: "Workflow Saved",
              description: `"${activeTab.name}" downloaded as .kiteframe`,
            });
          } catch (err) {
            console.error("[Export] Ctrl+S export failed:", err);
            toast({
              title: "Export Failed",
              description: "Could not export workflow.",
              variant: "destructive",
            });
          }
        }
        return;
      }

      // Ctrl/Cmd + + or = - Zoom in
      if (isCtrlOrCmd && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setViewport((prev) => ({
          ...prev,
          zoom: Math.min(prev.zoom * 1.2, 3),
        }));
        return;
      }

      // Ctrl/Cmd + - - Zoom out
      if (isCtrlOrCmd && e.key === "-") {
        e.preventDefault();
        setViewport((prev) => ({
          ...prev,
          zoom: Math.max(prev.zoom / 1.2, 0.1),
        }));
        return;
      }

      // Ctrl/Cmd + 0 - Reset zoom
      if (isCtrlOrCmd && e.key === "0") {
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 });
        toast({
          title: "View Reset",
          description: "Zoom reset to 100%",
        });
        return;
      }

      // N - Add new node at center of viewport
      if (e.key === "n" && !isCtrlOrCmd) {
        e.preventDefault();
        setLinearToolbar(null);
        const canvasWidth = window.innerWidth - 300;
        const canvasHeight = window.innerHeight - 100;
        const centerX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
        const centerY = (-viewport.y + canvasHeight / 2) / viewport.zoom;

        const newNode: Node = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "process",
          position: { x: centerX - 100, y: centerY - 50 },
          data: {
            label: "New Process",
            description: "Click to edit",
            icon: "Cog",
          },
          width: 200,
          height: 100,
          selected: true,
        };

        // Deselect all other nodes first
        saveToHistory("Add node");
        setNodes((prev) => [
          ...prev.map((n) => ({ ...n, selected: false })),
          newNode,
        ]);
        setSelectedNodeId(newNode.id);

        toast({
          title: "Node Added",
          description: "Press N again to add more nodes",
        });
        return;
      }

      // + - Show quick create radial menu at mouse position
      if (e.key === "+" && !isCtrlOrCmd) {
        e.preventDefault();

        // Dismiss any open toolbar
        setLinearToolbar(null);

        // Get canvas element bounds to check if mouse is inside
        const canvasEl = document.querySelector(
          '[data-testid="workflow-canvas"]',
        );
        const canvasBounds = canvasEl?.getBoundingClientRect();

        let screenX = mousePositionRef.current.x;
        let screenY = mousePositionRef.current.y;

        // Check if mouse is inside canvas bounds
        const isInsideCanvas =
          canvasBounds &&
          screenX >= canvasBounds.left &&
          screenX <= canvasBounds.right &&
          screenY >= canvasBounds.top &&
          screenY <= canvasBounds.bottom;

        if (!isInsideCanvas || !canvasBounds) {
          // Position at lower middle of screen, above any action toolbar
          screenX = window.innerWidth / 2;
          screenY = window.innerHeight - 150;
        }

        // Convert screen position to canvas position
        const canvasX =
          (screenX - (canvasBounds?.left || 0) - viewport.x) / viewport.zoom;
        const canvasY =
          (screenY - (canvasBounds?.top || 0) - viewport.y) / viewport.zoom;

        setQuickCreateMenu({
          screenPosition: { x: screenX, y: screenY },
          canvasPosition: { x: canvasX, y: canvasY },
        });
        return;
      }

      // 1-6 - Quick add node types
      if (["1", "2", "3", "4", "5", "6"].includes(e.key) && !isCtrlOrCmd) {
        e.preventDefault();
        setLinearToolbar(null);
        const nodeTypes: { [key: string]: NodeType } = {
          "1": "input",
          "2": "process",
          "3": "condition",
          "4": "output",
          "5": "ai",
          "6": "image",
        };
        const nodeLabels: { [key: string]: string } = {
          "1": "Input",
          "2": "Process",
          "3": "Condition",
          "4": "Output",
          "5": "AI Task",
          "6": "Image",
        };
        const nodeType = nodeTypes[e.key];
        const canvasWidth = window.innerWidth - 300;
        const canvasHeight = window.innerHeight - 100;
        const centerX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
        const centerY = (-viewport.y + canvasHeight / 2) / viewport.zoom;

        const newNode: Node = {
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: nodeType,
          position: { x: centerX - 100, y: centerY - 50 },
          data: {
            label: nodeLabels[e.key],
            description: "Click to edit",
            icon:
              nodeType === "input"
                ? "ArrowRight"
                : nodeType === "output"
                  ? "ArrowLeft"
                  : nodeType === "condition"
                    ? "GitBranch"
                    : nodeType === "ai"
                      ? "Bot"
                      : "Cog",
          },
          width: 200,
          height: 100,
          selected: true,
        };

        saveToHistory("Add node");
        setNodes((prev) => [
          ...prev.map((n) => ({ ...n, selected: false })),
          newNode,
        ]);
        setSelectedNodeId(newNode.id);

        toast({
          title: `${nodeLabels[e.key]} Node Added`,
          description: `Press ${e.key} again to add more`,
        });
        return;
      }

      // T - Add text object at center of viewport
      if (e.key === "t" && !isCtrlOrCmd) {
        e.preventDefault();
        if (isOnHomeTab || openTabs.length === 0) return;
        
        setLinearToolbar(null);
        const canvasWidth = window.innerWidth - 300;
        const canvasHeight = window.innerHeight - 100;
        const centerX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
        const centerY = (-viewport.y + canvasHeight / 2) / viewport.zoom;

        const isDark = document.documentElement.classList.contains("dark");
        const newTextObject: CanvasObject = {
          id: `canvas-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "text",
          position: { x: centerX - 75, y: centerY - 20 },
          width: 150,
          height: 40,
          selected: true,
          data: {
            text: "Double-click to edit",
            fontSize: 14,
            fontFamily: "Inter",
            fontWeight: "normal",
            fontStyle: "normal",
            textAlign: "left",
            textDecoration: "none",
            textColor: isDark ? "#ffffff" : "#1e293b",
            backgroundColor: "transparent",
          } as TextNodeData,
        };
        
        const updatedObjects = canvasObjects.map((obj) => ({
          ...obj,
          selected: false,
        }));
        saveToHistory("Add text object");
        updateActiveTab({
          canvasObjects: [...updatedObjects, newTextObject],
        });
        toast({
          title: "Text Object Added",
          description: "Press T again to add more",
        });
        return;
      }

      // S - Add shape (rectangle) at center of viewport
      if (e.key === "s" && !isCtrlOrCmd) {
        e.preventDefault();
        if (isOnHomeTab || openTabs.length === 0) return;
        
        setLinearToolbar(null);
        const canvasWidth = window.innerWidth - 300;
        const canvasHeight = window.innerHeight - 100;
        const centerX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
        const centerY = (-viewport.y + canvasHeight / 2) / viewport.zoom;

        const isDark = document.documentElement.classList.contains("dark");
        const newShapeObject: CanvasObject = {
          id: `canvas-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "shape",
          position: { x: centerX - 50, y: centerY - 50 },
          width: 100,
          height: 100,
          selected: true,
          data: {
            shapeType: "rectangle",
            fillColor: isDark ? "#374151" : "#e2e8f0",
            fillOpacity: 0.5,
            fillStyle: "solid",
            strokeColor: isDark ? "#6b7280" : "#94a3b8",
            strokeWidth: 2,
            strokeOpacity: 1.0,
            strokeStyle: "solid",
            opacity: 1,
            borderRadius: 8,
          } as ShapeNodeData,
        };
        
        const updatedObjects = canvasObjects.map((obj) => ({
          ...obj,
          selected: false,
        }));
        saveToHistory("Add shape");
        updateActiveTab({
          canvasObjects: [...updatedObjects, newShapeObject],
        });
        toast({
          title: "Rectangle Added",
          description: "Press S again to add more",
        });
        return;
      }

      // P - Add sticky note at center of viewport
      if (e.key === "p" && !isCtrlOrCmd) {
        e.preventDefault();
        if (isOnHomeTab || openTabs.length === 0) return;
        
        setLinearToolbar(null);
        const canvasWidth = window.innerWidth - 300;
        const canvasHeight = window.innerHeight - 100;
        const centerX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
        const centerY = (-viewport.y + canvasHeight / 2) / viewport.zoom;

        const newStickyObject: CanvasObject = {
          id: `canvas-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "sticky",
          position: { x: centerX - 75, y: centerY - 75 },
          width: 150,
          height: 150,
          selected: true,
          data: {
            text: "New sticky note",
            fontSize: 12,
            fontFamily: "Inter",
            fontWeight: "normal",
            fontStyle: "normal",
            textAlign: "left",
            textDecoration: "none",
            textColor: "#1e293b",
            backgroundColor: "#fef08a",
          } as StickyNoteData,
        };
        
        const updatedObjects = canvasObjects.map((obj) => ({
          ...obj,
          selected: false,
        }));
        saveToHistory("Add sticky note");
        updateActiveTab({
          canvasObjects: [...updatedObjects, newStickyObject],
        });
        toast({
          title: "Sticky Note Added",
          description: "Press P again to add more",
        });
        return;
      }

      // G - Open AI Generator (KiteAI)
      if (e.key === "g" && !isCtrlOrCmd) {
        e.preventDefault();
        if (!isOnHomeTab && openTabs.length > 0) {
          setShowAiGenerator(true);
          toast({
            title: "AI Generator",
            description: "Describe your workflow to generate it with AI",
          });
        }
        return;
      }

      // H - Go to Home tab
      if (e.key === "h" && !isCtrlOrCmd) {
        e.preventDefault();
        setActiveTabId("home");
        return;
      }

      // ? or Shift + / - Show keyboard shortcuts help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowKeyboardShortcuts((prev) => !prev);
        return;
      }

      // Arrow keys - Nudge selected nodes
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const selectedNodesList = nodes.filter((n) => n.selected);
        if (selectedNodesList.length > 0) {
          e.preventDefault();
          const nudgeAmount = e.shiftKey ? 10 : 1;
          const delta = {
            x:
              e.key === "ArrowLeft"
                ? -nudgeAmount
                : e.key === "ArrowRight"
                  ? nudgeAmount
                  : 0,
            y:
              e.key === "ArrowUp"
                ? -nudgeAmount
                : e.key === "ArrowDown"
                  ? nudgeAmount
                  : 0,
          };

          saveToHistory("Nudge node");
          setNodes((prev) =>
            prev.map((n) =>
              n.selected
                ? {
                    ...n,
                    position: {
                      x: n.position.x + delta.x,
                      y: n.position.y + delta.y,
                    },
                  }
                : n,
            ),
          );
        }
        return;
      }

      // Tab - Cycle through nodes (with wrapping)
      if (e.key === "Tab" && !isCtrlOrCmd && nodes.length > 0) {
        e.preventDefault();
        const currentIndex = nodes.findIndex((n) => n.selected);
        const nextIndex = e.shiftKey
          ? currentIndex <= 0
            ? nodes.length - 1
            : currentIndex - 1
          : currentIndex >= nodes.length - 1
            ? 0
            : currentIndex + 1;

        setNodes((prev) =>
          prev.map((n, i) => ({ ...n, selected: i === nextIndex })),
        );
        setSelectedNodeId(nodes[nextIndex].id);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectedNodeId,
    setSelectedEdgeId,
    saveToHistory,
    handleUndo,
    handleRedo,
    viewport,
    setViewport,
    activeTab,
    createNewTab,
    isOnHomeTab,
    openTabs.length,
    toast,
    canvasObjects,
    updateActiveTab,
    isSketchMode,
    effectiveReadOnly,
  ]);

  // Track mouse position for quick create menu
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Listen for edge drag events to cancel click timers
  useEffect(() => {
    const handleEdgeDragStart = () => {
      isDraggingRef.current = true;
      if (clickDelayTimeoutRef.current) {
        clearTimeout(clickDelayTimeoutRef.current);
        clickDelayTimeoutRef.current = null;
      }
    };

    const handleEdgeDragEnd = () => {
      // Reset drag state after a short delay
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
      dragResetTimeoutRef.current = setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    };

    const handleCanvasObjectDragStart = () => {
      isDraggingRef.current = true;
      if (clickDelayTimeoutRef.current) {
        clearTimeout(clickDelayTimeoutRef.current);
        clickDelayTimeoutRef.current = null;
      }
    };

    const handleCanvasObjectDragEnd = () => {
      // Reset drag state after a short delay
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
      dragResetTimeoutRef.current = setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    };

    window.addEventListener("edgeHandleDragStart", handleEdgeDragStart);
    window.addEventListener("edgeHandleDragEnd", handleEdgeDragEnd);
    window.addEventListener(
      "canvasObjectDragStart",
      handleCanvasObjectDragStart,
    );
    window.addEventListener("canvasObjectDragEnd", handleCanvasObjectDragEnd);

    return () => {
      window.removeEventListener("edgeHandleDragStart", handleEdgeDragStart);
      window.removeEventListener("edgeHandleDragEnd", handleEdgeDragEnd);
      window.removeEventListener(
        "canvasObjectDragStart",
        handleCanvasObjectDragStart,
      );
      window.removeEventListener(
        "canvasObjectDragEnd",
        handleCanvasObjectDragEnd,
      );
    };
  }, []);

  // Cleanup timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (clickDelayTimeoutRef.current) {
        clearTimeout(clickDelayTimeoutRef.current);
      }
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
    };
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get access to KiteFrame core system
  const { core } = usePluginSystem();

  // Register required plugins in useEffect to avoid registration during render
  useEffect(() => {
    if (core) {
      if (!core.getPlugin?.("layout")) {
        core.use(layoutPlugin);
      }
      if (!core.getPlugin?.("advanced-interactions-pro")) {
        core.use(advancedInteractionsPlugin);
      }
    }
  }, [core]);

  // Connect plugin system to workflow editor state
  useEffect(() => {
    if (core && tabs && activeTabId) {
      const activeTab = tabs.find((tab) => tab.id === activeTabId);
      if (activeTab) {
        core.updateContext({
          getNodes: () => activeTab.nodes,
          getEdges: () => activeTab.edges,
          updateNodes: (newNodes) => {
            updateActiveTab({
              nodes: newNodes,
            });
          },
          updateEdges: (newEdges) => {
            updateActiveTab({
              edges: newEdges,
            });
          },
          getViewport: () => activeTab.viewport,
          setViewport: (viewport) => {
            updateActiveTab({
              viewport,
            });
          },
          getSelectedNodes: () =>
            activeTab.selectedNodeId ? [activeTab.selectedNodeId] : [],
          setSelectedNodes: (nodeIds) => {
            updateActiveTab({
              selectedNodeId: nodeIds[0] || "",
            });
          },
        });
      }
    }
  }, [core, tabs, activeTabId, updateActiveTab]);

  // Other UI state
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [featureUpsell, setFeatureUpsell] = useState<{ featureName: string; requiredTier: 'advanced' | 'pro'; description: string } | null>(null);
  const [generatorPrompt, setGeneratorPrompt] = useState("");
  const [showImageAnalysisModal, setShowImageAnalysisModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [isShareLocked, setIsShareLocked] = useState(false);
  const [commentPlacing, setCommentPlacing] = useState(false);
  const [shareViewerCount, setShareViewerCount] = useState(0);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [showCloudProjects, setShowCloudProjects] = useState(false);
  const [showPluginTest, setShowPluginTest] = useState(false);
  const [showFigmaModal, setShowFigmaModal] = useState(false);
  const [isFigmaAuthenticated, setIsFigmaAuthenticated] = useState(false);
  const [figmaImportMode, setFigmaImportMode] = useState<
    "new-project" | "insert-into-project"
  >("new-project");
  const [showPowerFeaturesMenu, setShowPowerFeaturesMenu] = useState(false);
  const [showWorkflowPreviewModal, setShowWorkflowPreviewModal] =
    useState(false);
  const [workflowPreviewFrameIds, setWorkflowPreviewFrameIds] = useState<
    string[]
  >([]);
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node?: Node;
    canvasObject?: CanvasObject;
  } | null>(null);
  const [linearToolbar, setLinearToolbar] = useState<{
    x: number;
    y: number;
    nodeRect?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
      width: number;
    };
    node?: Node;
    edge?: Edge;
    canvasObject?: CanvasObject;
    initialSubmenu?: string | null;
    editingHyperlinkId?: string;
  } | null>(null);
  const [quickCreateMenu, setQuickCreateMenu] = useState<{
    screenPosition: { x: number; y: number };
    canvasPosition: { x: number; y: number };
  } | null>(null);
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [inlineEditing, setInlineEditing] = useState<{
    nodeId?: string;
    edgeId?: string;
    part: "header" | "body" | "edgeLabel";
  } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false);
  const [workflowNameInput, setWorkflowNameInput] = useState("");
  const [copiedProperties, setCopiedProperties] = useState<{
    colors?: any;
    data?: Partial<Node["data"]>;
  } | null>(null);
  const [copiedCanvasObjectProperties, setCopiedCanvasObjectProperties] =
    useState<{ data?: any; style?: any } | null>(null);

  // Clear transient edit state when switching to mobile view-only mode
  useEffect(() => {
    if (isPhoneViewOnly) {
      setInlineEditing(null);
      setLinearToolbar(null);
      setContextMenu(null);
      setQuickCreateMenu(null);
      setSketchSelection(null);
    }
  }, [isPhoneViewOnly]);

  // Task #137: The old full-graph REPLACE confirmation dialog was removed.
  // Full/new-workflow proposals are now added non-destructively beside the
  // existing workflow (see onApplyWorkflow), so no destructive prompt is needed.

  // Phase 4: Structural regression warning state for REPLACE
  // Shows warning when replacement reduces branching/decision topology
  const [pendingRegressionWarning, setPendingRegressionWarning] = useState<{
    workflow: {
      nodes: Node[];
      edges: Edge[];
      canvasObjects?: CanvasObject[];
      aiMode?: 'ADVISE' | 'EDIT' | 'GENERATE';
    };
    existingNodes: Node[];
    existingEdges: Edge[];
    regressionResult: StructuralRegressionResult;
  } | null>(null);

  // Shared REPLACE execution function - used by confirmation dialog and regression warning modal
  // Prevents code duplication and ensures consistent validation, canvas-change guard, and history handling
  const executeReplaceWorkflow = useCallback((
    workflowDraft: {
      nodes: Node[];
      edges: Edge[];
      canvasObjects?: CanvasObject[];
      aiMode?: 'ADVISE' | 'EDIT' | 'GENERATE';
    },
    expectedNodes: Node[],
    expectedEdges: Edge[],
    options?: { 
      regressionAcknowledged?: boolean;
      skipRegressionCheck?: boolean;
      onRegressionDetected?: (regressionResult: StructuralRegressionResult) => void;
    }
  ): boolean | 'regression_detected' => {
    // Canvas-change guard: Abort if canvas changed since dialog was opened
    // Uses stable JSON serialization to catch ANY change to node/edge data
    
    // Helper to create a stable, deterministic hash from an object (deep sorted keys)
    const stableHash = (obj: unknown): string => {
      const sortedStringify = (value: unknown): string => {
        if (value === null || value === undefined) return String(value);
        if (typeof value !== 'object') return JSON.stringify(value);
        if (Array.isArray(value)) {
          return '[' + value.map(sortedStringify).join(',') + ']';
        }
        const sorted = Object.keys(value as object).sort();
        return '{' + sorted.map(k => `${JSON.stringify(k)}:${sortedStringify((value as Record<string, unknown>)[k])}`).join(',') + '}';
      };
      try {
        return sortedStringify(obj);
      } catch {
        return String(obj);
      }
    };
    
    // Full node signature includes id, type, position, and ALL data fields
    const getNodeSignature = (n: Node) => {
      const posX = Math.round(n.position?.x || 0);
      const posY = Math.round(n.position?.y || 0);
      // Include full data object hash to catch any field changes
      const dataHash = stableHash(n.data);
      return `${n.id}:${n.type}:${posX},${posY}:${dataHash}`;
    };
    
    // Full edge signature includes id, source, target, label, and data
    const getEdgeSignature = (e: Edge) => {
      const label = (e as any).label || '';
      const dataHash = stableHash((e as any).data || {});
      return `${e.id}:${e.source}->${e.target}:${label}:${dataHash}`;
    };
    
    const expectedNodeSignatures = new Set(expectedNodes.map(getNodeSignature));
    const currentNodeSignatures = new Set(nodes.map(getNodeSignature));
    const expectedEdgeSignatures = new Set(expectedEdges.map(getEdgeSignature));
    const currentEdgeSignatures = new Set(edges.map(getEdgeSignature));
    
    const nodesMatch = expectedNodeSignatures.size === currentNodeSignatures.size &&
      Array.from(expectedNodeSignatures).every(sig => currentNodeSignatures.has(sig));
    const edgesMatch = expectedEdgeSignatures.size === currentEdgeSignatures.size &&
      Array.from(expectedEdgeSignatures).every(sig => currentEdgeSignatures.has(sig));
    
    if (!nodesMatch || !edgesMatch) {
      toast({
        title: "Canvas Changed",
        description: "The canvas was modified while the dialog was open. Please try again.",
        variant: "destructive"
      });
      return false;
    }
    
    // Structural regression check (unless already acknowledged or skipped)
    if (!options?.regressionAcknowledged && !options?.skipRegressionCheck) {
      const regressionResult = detectStructuralRegression(
        expectedNodes,
        expectedEdges,
        workflowDraft.nodes,
        workflowDraft.edges
      );
      
      if (regressionResult.hasRegression) {
        if (options?.onRegressionDetected) {
          options.onRegressionDetected(regressionResult);
          return 'regression_detected';
        } else {
          // Default blocking: no callback provided, block with toast
          toast({
            title: "Structural Regression Detected",
            description: regressionResult.message || "The replacement would reduce workflow complexity.",
            variant: "destructive"
          });
          return false;
        }
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[executeReplaceWorkflow] Executing REPLACE:', {
        draftNodeCount: workflowDraft.nodes.length,
        draftEdgeCount: workflowDraft.edges.length,
        expectedNodeCount: expectedNodes.length,
        regressionAcknowledged: options?.regressionAcknowledged || false,
      });
    }
    
    // Validation-only REPLACE path (no merge/repair)
    const mutationResult = applyMergeSafeChatMutation({
      existingNodes: nodes,
      existingEdges: edges,
      newNodes: workflowDraft.nodes,
      newEdges: workflowDraft.edges,
      userMessage: '',
      attachmentTargetId: undefined,
      aiMode: workflowDraft.aiMode || 'EDIT',
      mode: 'REPLACE',
    });
    
    if (!mutationResult.success) {
      toast({
        title: "Replace Failed",
        description: mutationResult.reason || "Could not replace workflow.",
        variant: "destructive"
      });
      return false;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[executeReplaceWorkflow] Validation-only path confirmed:', {
        mergeEnforced: mutationResult.safetyReport.mergeEnforced,
        decisionRepairApplied: mutationResult.safetyReport.decisionRepairApplied,
        orphanPreventionTriggered: mutationResult.safetyReport.orphanPreventionTriggered,
        attachmentResolved: mutationResult.safetyReport.attachmentResolved,
      });
    }
    
    const workflowNodes = mutationResult.mutatedNodes;
    const workflowEdges = mutationResult.mutatedEdges as unknown as Edge[];
    
    const batchId = Date.now();
    const nodeIdMapping: { [oldId: string]: string } = {};
    
    const newNodes = workflowNodes.map((node: Node, index: number) => {
      const oldId = node.id || `node-${index}`;
      const newId = `node-${batchId}-${index}`;
      nodeIdMapping[oldId] = newId;
      return {
        ...node,
        id: newId,
        selected: false,
        data: {
          ...node.data,
          meta: {
            ...(node.data as any)?.meta,
            createdAt: Date.now(),
            replacedExistingWorkflow: true,
            ...(options?.regressionAcknowledged && { regressionAcknowledged: true }),
          },
        },
      };
    });
    
    const newEdges = workflowEdges.map((edge: Edge, index: number) => {
      let newSource = nodeIdMapping[edge.source];
      let newTarget = nodeIdMapping[edge.target];
      
      if (!newSource) {
        const sourceNumeric = parseInt(edge.source);
        if (!isNaN(sourceNumeric) && sourceNumeric < workflowNodes.length) {
          const sourceNodeId = workflowNodes[sourceNumeric]?.id || `node-${sourceNumeric}`;
          newSource = nodeIdMapping[sourceNodeId];
        }
      }
      
      if (!newTarget) {
        const targetNumeric = parseInt(edge.target);
        if (!isNaN(targetNumeric) && targetNumeric < workflowNodes.length) {
          const targetNodeId = workflowNodes[targetNumeric]?.id || `node-${targetNumeric}`;
          newTarget = nodeIdMapping[targetNodeId];
        }
      }
      
      return {
        ...edge,
        id: `edge-${batchId}-${index}`,
        source: newSource || edge.source,
        target: newTarget || edge.target,
        selected: false,
      };
    });
    
    // Atomic replace: set nodes/edges directly (not append)
    setNodes(newNodes);
    const recalculatedEdges = recalculateAllEdgeZIndexes(newEdges, newNodes);
    setEdges(recalculatedEdges);
    
    // Handle canvas objects
    if (workflowDraft.canvasObjects && workflowDraft.canvasObjects.length > 0) {
      const newCanvasObjects = workflowDraft.canvasObjects.map(
        (obj: CanvasObject, index: number) => ({
          ...obj,
          id: `obj-${batchId}-${index}`,
          selected: false,
        })
      );
      updateActiveTab({ canvasObjects: newCanvasObjects });
    } else {
      updateActiveTab({ canvasObjects: [] });
    }
    
    // Post-mutation history save (single undo entry)
    const historyLabel = options?.regressionAcknowledged 
      ? "Replace workflow (regression acknowledged)" 
      : "Replace workflow";
    setTimeout(() => saveToHistory(historyLabel), 0);
    
    toast({
      title: "Workflow Replaced",
      description: `Replaced with ${newNodes.length} nodes. Use Ctrl+Z to undo.`,
    });
    
    return true;
  }, [nodes, edges, toast, setNodes, setEdges, updateActiveTab, saveToHistory]);

  // Click vs drag detection for properties panel
  const clickDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isDraggingRef = useRef(false);
  const dragResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Theme change detection refs
  const activeTabRef = useRef<WorkflowTab | undefined>(undefined);
  const lastThemeIsDarkRef = useRef(
    document.documentElement.classList.contains("dark"),
  );
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Canvas container ref for toolbar positioning
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with current state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Ref to track share update debounce timer
  const shareUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync activeShareId with the active tab whenever the user switches tabs.
  // activeShareId is global state, but nodes/edges are always the active tab's
  // data. Without this sync, switching away from a shared tab would fire the
  // share-update effect below with the new tab's (possibly empty) content
  // while activeShareId still points to the old tab's share UUID.
  useEffect(() => {
    setActiveShareId(activeTab?.shareUuid ?? null);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect to update shared project when nodes/edges change
  useEffect(() => {
    if (!activeShareId) return;
    // Safety guard: only push updates when the active tab actually owns this
    // share. Without this, a stale activeShareId from a previous tab could
    // cause a brief window where another tab's content overwrites the share.
    if (activeShareId !== activeTab?.shareUuid) return;

    // Debounce updates to avoid spamming the server
    if (shareUpdateTimeoutRef.current) {
      clearTimeout(shareUpdateTimeoutRef.current);
    }

    shareUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        await apiRequest("PUT", `/api/share-project/${activeShareId}`, {
          nodes,
          edges,
          canvasObjects: canvasObjects || [],
          viewport: viewport || { x: 0, y: 0, zoom: 1 },
          projectMetadata: activeTab?.metadata,
        });
      } catch (error) {
        console.error("Failed to update shared project:", error);
      }
    }, 1000); // 1 second debounce

    return () => {
      if (shareUpdateTimeoutRef.current) {
        clearTimeout(shareUpdateTimeoutRef.current);
      }
    };
  }, [
    activeShareId,
    nodes,
    edges,
    canvasObjects,
    viewport,
    activeTab?.metadata,
  ]);

  // Toggle the "locked down" state of the shared project. Keeps the share
  // link valid but makes the read-only view inaccessible until unlocked.
  const handleToggleShareLock = useCallback(async () => {
    if (!currentProjectId || !activeShareId) return;
    const next = !isShareLocked;
    setIsShareLocked(next); // optimistic
    try {
      await apiRequest("POST", `/api/projects/${currentProjectId}/share/lock`, {
        locked: next,
      });
      toast({
        title: next ? "Access disabled" : "Access restored",
        description: next
          ? "The shared link is now locked. Viewers can't open it until you unlock it."
          : "Viewers can open the shared link again.",
      });
    } catch (error) {
      console.error("Failed to update share lock:", error);
      setIsShareLocked(!next); // revert on failure
      toast({
        title: "Error",
        description: "Failed to update access. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentProjectId, activeShareId, isShareLocked, toast]);

  // Poll the live viewer count while the active project is shared.
  useEffect(() => {
    if (!currentProjectId || !activeShareId) {
      setShareViewerCount(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch(
          `/api/projects/${currentProjectId}/share/viewers`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") {
          setShareViewerCount(data.count);
        }
      } catch {
        // Non-fatal: leave the previous count in place.
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentProjectId, activeShareId]);

  // Load project from URL parameter (projectUuid)
  useEffect(() => {
    if (!projectUuid || projectLoadedRef.current) return;

    projectLoadedRef.current = true;

    fetch(`/api/project/${projectUuid}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.redirect) {
          // Non-owner trying to access edit URL - redirect to view URL
          setLocation(data.redirect);
        } else if (data.project) {
          // Load project data into editor
          const workflowData = data.project.workflowData;
          if (workflowData && activeTabId && openTabs.length > 0) {
            // Update the active tab with project data
            setTabs((prev) =>
              prev.map((tab) =>
                tab.id === activeTabId
                  ? {
                      ...tab,
                      name: data.project.name || tab.name,
                      nodes: workflowData.nodes || [],
                      edges: workflowData.edges || [],
                      canvasObjects: workflowData.canvasObjects || [],
                      viewport: workflowData.viewport || {
                        x: 0,
                        y: 0,
                        zoom: 1,
                      },
                      metadata: {
                        ...tab.metadata,
                        name: data.project.name || "",
                        description: data.project.description || "",
                      },
                      projectUuid:
                        tab.projectUuid ||
                        data.project.projectUuid ||
                        `cloud-${data.project.id}`,
                      cloudProjectId: data.project.id,
                      shareUuid: data.project.shareUuid || null,
                    }
                  : tab,
              ),
            );
          }
          setCurrentProjectId(data.project.id);

          // Set activeShareId if project has sharing enabled
          if (data.isShareEnabled && data.shareUuid) {
            setActiveShareId(data.shareUuid);
          }
          setIsShareLocked(!!data.project.isShareLocked);

          toast({
            title: "Project Loaded",
            description: `Loaded "${data.project.name || "Untitled Project"}"`,
          });
        }
      })
      .catch((error) => {
        console.error("Failed to load project:", error);
        toast({
          title: "Error",
          description: "Failed to load project",
          variant: "destructive",
        });
      });
  }, [projectUuid, setLocation, activeTabId, openTabs.length, toast]);

  // Track toolbar position when node/canvas object is being dragged
  useEffect(() => {
    if (!linearToolbar) return;

    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    const containerLeft = containerRect?.left ?? 0;
    const containerTop = containerRect?.top ?? 0;

    if (linearToolbar.node) {
      // Find the current position of the node
      const currentNode = nodes.find((n) => n.id === linearToolbar.node!.id);
      if (!currentNode) {
        // Node was deleted, clear toolbar
        setLinearToolbar(null);
        return;
      }

      const nodeWidth = currentNode.width ?? 200;
      const nodeHeight = currentNode.height ?? 100;
      const screenX =
        currentNode.position.x * viewport.zoom + viewport.x + containerLeft;
      const screenY =
        currentNode.position.y * viewport.zoom + viewport.y + containerTop;
      const screenWidth = nodeWidth * viewport.zoom;
      const screenHeight = nodeHeight * viewport.zoom;

      // Only update if position changed
      if (
        linearToolbar.x !== screenX + screenWidth / 2 ||
        linearToolbar.y !== screenY
      ) {
        setLinearToolbar((prev) =>
          prev
            ? {
                ...prev,
                x: screenX + screenWidth / 2,
                y: screenY,
                nodeRect: {
                  top: screenY,
                  bottom: screenY + screenHeight,
                  left: screenX,
                  right: screenX + screenWidth,
                  width: screenWidth,
                },
                node: currentNode,
              }
            : null,
        );
      }
    } else if (linearToolbar.canvasObject) {
      // Find the current position of the canvas object
      const currentObject = canvasObjects.find(
        (obj) => obj.id === linearToolbar.canvasObject!.id,
      );
      if (!currentObject) {
        // Object was deleted, clear toolbar
        setLinearToolbar(null);
        return;
      }

      const objWidth = currentObject.width ?? 150;
      const objHeight = currentObject.height ?? 100;
      const screenX =
        currentObject.position.x * viewport.zoom + viewport.x + containerLeft;
      const screenY =
        currentObject.position.y * viewport.zoom + viewport.y + containerTop;
      const screenWidth = objWidth * viewport.zoom;
      const screenHeight = objHeight * viewport.zoom;

      const movingShapeType = currentObject.type === 'shape'
        ? (currentObject.data as ShapeNodeData).shapeType
        : undefined;
      const movingHandlePad = (movingShapeType === 'line' || movingShapeType === 'arrow' || movingShapeType === 'polygon') ? 28 : 0;

      // Only update if position changed
      if (
        linearToolbar.x !== screenX + screenWidth / 2 ||
        linearToolbar.y !== screenY - movingHandlePad
      ) {
        setLinearToolbar((prev) =>
          prev
            ? {
                ...prev,
                x: screenX + screenWidth / 2,
                y: screenY - movingHandlePad,
                nodeRect: {
                  top: screenY - movingHandlePad,
                  bottom: screenY + screenHeight + movingHandlePad,
                  left: screenX,
                  right: screenX + screenWidth,
                  width: screenWidth,
                },
                canvasObject: currentObject,
              }
            : null,
        );
      }
    }
  }, [
    linearToolbar?.node?.id,
    linearToolbar?.canvasObject?.id,
    nodes,
    canvasObjects,
    viewport,
  ]);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Popout state for collapsed sidebar
  const [activePopout, setActivePopout] = useState<
    "node-types" | "shapes" | "templates" | "themes" | "boosts" | null
  >(null);

  // Toolbar expanded state (icons only vs icons + labels)
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);

  // Current workflow theme state
  const [currentTheme, setCurrentTheme] = useState<WorkflowTheme>(() => {
    try {
      const savedThemeId = localStorage.getItem("workflow-theme") || "default";
      return getThemeById(savedThemeId) || workflowThemes[0];
    } catch {
      return workflowThemes[0]; // Default theme
    }
  });

  // Image upload modal state
  const [selectedImageNodeId, setSelectedImageNodeId] = useState<string | null>(
    null,
  );
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);

  // Table link picker state for FormNode
  const [tableLinkPicker, setTableLinkPicker] = useState<{
    formNodeId: string;
  } | null>(null);

  // Node Gallery Panel state
  const [showGalleryPanel, setShowGalleryPanel] = useState(false);

  // ============= COMPOUND TEMPLATE STORE =============
  // Project-level template storage for saved compound node templates
  const TEMPLATE_STORE_KEY = "kiteframe-compound-templates";
  const TEMPLATE_STORE_VERSION = 1;

  const [savedTemplates, setSavedTemplates] = useState<SavedCompoundTemplate[]>(
    () => {
      try {
        const saved = localStorage.getItem(TEMPLATE_STORE_KEY);
        if (saved) {
          const store: TemplateStore = JSON.parse(saved);
          if (store.version === TEMPLATE_STORE_VERSION) {
            return store.templates;
          }
        }
        return [];
      } catch {
        return [];
      }
    },
  );

  // Persist templates to localStorage whenever they change
  useEffect(() => {
    try {
      const store: TemplateStore = {
        templates: savedTemplates,
        version: TEMPLATE_STORE_VERSION,
      };
      localStorage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(store));
    } catch (error) {
      console.error("Failed to save templates to localStorage:", error);
    }
  }, [savedTemplates]);

  // Check Figma authentication status on mount
  useEffect(() => {
    fetch('/api/figma/status', { credentials: 'include' })
      .then(res => {
        if (!res.ok) {
          setIsFigmaAuthenticated(false);
          return null;
        }
        return res.json();
      })
      .then((data: { connected?: boolean } | null) => {
        if (data) {
          setIsFigmaAuthenticated(data.connected === true);
        }
      })
      .catch(() => {
        setIsFigmaAuthenticated(false);
      });
  }, []);

  // CRUD operations for templates
  const addTemplate = useCallback((template: SavedCompoundTemplate) => {
    setSavedTemplates((prev) => [...prev, template]);
  }, []);

  const updateTemplate = useCallback(
    (templateId: string, updates: Partial<SavedCompoundTemplate>) => {
      setSavedTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId
            ? {
                ...t,
                ...updates,
                metadata: {
                  ...t.metadata,
                  ...updates.metadata,
                  updatedAt: new Date().toISOString(),
                },
              }
            : t,
        ),
      );
    },
    [],
  );

  const deleteTemplate = useCallback((templateId: string) => {
    setSavedTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  const getTemplateById = useCallback(
    (templateId: string): SavedCompoundTemplate | undefined => {
      return savedTemplates.find((t) => t.id === templateId);
    },
    [savedTemplates],
  );

  const incrementTemplateUsage = useCallback((templateId: string) => {
    setSavedTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              metadata: {
                ...t.metadata,
                usageCount: (t.metadata.usageCount || 0) + 1,
              },
            }
          : t,
      ),
    );
  }, []);

  const handleSaveAsTemplate = useCallback(
    (nodeId: string, templateName: string, description?: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== "compound") return;

      const compoundData = node.data as any;
      const templateSubcomponents = (compoundData.subcomponents || []).map(
        (sub: any) => {
          const baseSub = {
            id: sub.id,
            type: sub.type,
            order: sub.order,
          };

          if (sub.type === "text") {
            return {
              ...baseSub,
              data: {
                content: sub.data?.content || "",
                fontSize: sub.data?.fontSize,
                fontWeight: sub.data?.fontWeight,
                fontStyle: sub.data?.fontStyle,
                textDecoration: sub.data?.textDecoration,
                textAlign: sub.data?.textAlign,
                textColor: sub.data?.textColor,
                columnBinding: sub.data?.columnBinding,
              },
            };
          } else if (sub.type === "image") {
            return {
              ...baseSub,
              data: {
                src: sub.data?.src,
                alt: sub.data?.alt,
                height: sub.data?.height,
                columnBinding: sub.data?.columnBinding,
              },
            };
          } else if (sub.type === "link") {
            return {
              ...baseSub,
              data: {
                text: sub.data?.text || "",
                url: sub.data?.url || "",
                textColor: sub.data?.textColor,
                showPreview: sub.data?.showPreview,
                textColumnBinding: sub.data?.textColumnBinding,
                urlColumnBinding: sub.data?.urlColumnBinding,
              },
            };
          } else if (sub.type === "input") {
            return {
              ...baseSub,
              data: {
                label: sub.data?.label,
                value: sub.data?.value || "",
                placeholder: sub.data?.placeholder,
                inputType: sub.data?.inputType,
                columnBinding: sub.data?.columnBinding,
              },
            };
          }
          return sub;
        },
      );

      const newTemplate: SavedCompoundTemplate = {
        id: `template-${Date.now()}`,
        name: templateName,
        description,
        subcomponents: templateSubcomponents,
        containerPadding: compoundData.containerPadding,
        gap: compoundData.gap,
        defaultWidth:
          typeof node.style?.width === "number" ? node.style.width : 320,
        defaultHeight:
          typeof node.style?.height === "number" ? node.style.height : 280,
        colors: compoundData.colors,
        metadata: {
          createdAt: new Date().toISOString(),
          usageCount: 0,
        },
      };

      addTemplate(newTemplate);
      toast({
        title: "Template Saved",
        description: `"${templateName}" saved to templates`,
      });
    },
    [nodes, addTemplate, toast],
  );

  // Handler for generating CompoundNodes from a template using table rows
  const handleGenerateFromTemplate = useCallback(
    (
      tableId: string,
      template: SavedCompoundTemplate,
      selectedRowIds?: string[],
    ) => {
      // Find the table node and get table data
      const tableNode = nodes.find(
        (n) => n.type === "table" && (n.data as any)?.tableId === tableId,
      );
      if (!tableNode) {
        toast({
          title: "Error",
          description: "Table not found",
          variant: "destructive",
        });
        return;
      }

      const tableNodeData = tableNode.data as TableNodeData;
      const table = tableNodeData.table;
      if (!table || !table.rows || table.rows.length === 0) {
        toast({
          title: "No Data",
          description: "Table has no rows to generate from",
          variant: "destructive",
        });
        return;
      }

      // Get the rows to process (selected or all, up to limit)
      const MAX_ROW_TO_NODE = 50;
      let rowsToProcess = table.rows;
      if (selectedRowIds && selectedRowIds.length > 0) {
        rowsToProcess = table.rows.filter((row: any) =>
          selectedRowIds.includes(row.id),
        );
      }
      rowsToProcess = rowsToProcess.slice(0, MAX_ROW_TO_NODE);

      if (rowsToProcess.length === 0) {
        toast({
          title: "No Rows",
          description: "No rows selected for generation",
          variant: "destructive",
        });
        return;
      }

      // Grid layout configuration
      const GRID_COLUMNS = 3;
      const SPACING_X = 350;
      const SPACING_Y = 320;
      const START_X =
        (tableNode.position?.x || 0) + (tableNode.width || 400) + 100;
      const START_Y = tableNode.position?.y || 0;

      // Create column map for quick lookup
      const columnMap = new Map<string, number>();
      (table.columns || []).forEach((col: any, index: number) => {
        columnMap.set(col.id, index);
      });

      // Generate new nodes from rows
      const newNodes: Node[] = rowsToProcess.map((row: any, index: number) => {
        const gridX = index % GRID_COLUMNS;
        const gridY = Math.floor(index / GRID_COLUMNS);

        // Clone template subcomponents with column bindings resolved
        const resolvedSubcomponents = (template.subcomponents || []).map(
          (sub: any) => {
            const clonedSub = {
              ...sub,
              id: `${sub.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              data: { ...sub.data },
            };

            // Resolve column bindings based on subcomponent type
            // columnBinding is { columnId, columnName }, row.values is Record<string, value>
            if (sub.type === "text" && sub.data?.columnBinding?.columnId) {
              const colId = sub.data.columnBinding.columnId;
              if (row.values && row.values[colId] !== undefined) {
                clonedSub.data.content = String(row.values[colId] ?? "");
              }
            } else if (
              sub.type === "image" &&
              sub.data?.columnBinding?.columnId
            ) {
              const colId = sub.data.columnBinding.columnId;
              if (row.values && row.values[colId] !== undefined) {
                clonedSub.data.src = String(row.values[colId] ?? "");
              }
            } else if (sub.type === "link") {
              if (sub.data?.textColumnBinding?.columnId) {
                const colId = sub.data.textColumnBinding.columnId;
                if (row.values && row.values[colId] !== undefined) {
                  clonedSub.data.text = String(row.values[colId] ?? "");
                }
              }
              if (sub.data?.urlColumnBinding?.columnId) {
                const colId = sub.data.urlColumnBinding.columnId;
                if (row.values && row.values[colId] !== undefined) {
                  clonedSub.data.url = String(row.values[colId] ?? "");
                }
              }
            } else if (
              sub.type === "input" &&
              sub.data?.columnBinding?.columnId
            ) {
              const colId = sub.data.columnBinding.columnId;
              if (row.values && row.values[colId] !== undefined) {
                clonedSub.data.value = String(row.values[colId] ?? "");
              }
            }

            return clonedSub;
          },
        );

        return {
          id: `compound-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
          type: "compound" as const,
          position: {
            x: START_X + gridX * SPACING_X,
            y: START_Y + gridY * SPACING_Y,
          },
          data: {
            label: template.name,
            subcomponents: resolvedSubcomponents,
            containerPadding: template.containerPadding || 16,
            gap: template.gap || 12,
            colors: template.colors,
            sourceRowId: row.id,
            sourceTableId: tableId,
            sourceTemplateId: template.id,
          },
          width: template.defaultWidth || 320,
          height: template.defaultHeight || 280,
          style: {
            width: template.defaultWidth || 320,
            height: template.defaultHeight || 280,
          },
        } as Node;
      });

      // Add nodes to canvas
      saveToHistory("Add nodes from template");
      setNodes((prev) => [...prev, ...newNodes]);
      incrementTemplateUsage(template.id);

      toast({
        title: "Nodes Generated",
        description: `Created ${newNodes.length} node${newNodes.length > 1 ? "s" : ""} from "${template.name}". Open Gallery to view all.`,
        action: (
          <button
            onClick={() => setShowGalleryPanel(true)}
            className="ml-2 px-3 py-1 text-xs font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors"
            data-testid="open-gallery-from-toast"
          >
            Open Gallery
          </button>
        ),
      });
    },
    [nodes, toast, setNodes, incrementTemplateUsage, saveToHistory],
  );

  // Save sidebar collapse state to localStorage
  useEffect(() => {
    localStorage.setItem(
      "sidebar-collapsed",
      JSON.stringify(isSidebarCollapsed),
    );
  }, [isSidebarCollapsed]);

  // Watch for openImageModal flag in node data
  useEffect(() => {
    const nodeWithModalFlag = nodes.find((n) => n.data?.openImageModal);
    if (nodeWithModalFlag) {
      setSelectedImageNodeId(nodeWithModalFlag.id);
      setShowImageUploadModal(true);
      // Clear the flag
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeWithModalFlag.id
            ? { ...n, data: { ...n.data, openImageModal: undefined } }
            : n,
        ),
      );
    }
  }, [nodes, setNodes]);

  // Icon mapping for collapsed sidebar
  const sidebarIcons = useMemo(
    () => ({
      brain: Brain,
      workflow: Workflow,
      type: Type,
      shapes: Shapes,
      "sticky-note": StickyNote,
      table: Table2,
      form: FileText,
      route: Route,
      palette: Palette,
      "map-pin": MapPin,
      network: Network,
      layers: Layers,
      "user-plus": UserPlus,
      "circuit-board": CircuitBoard,
      "fit-view": Maximize2,
      clear: Trash2,
      export: Download,
      import: Upload,
      share: Share2,
      "chevron-right": ChevronRight,
      rocket: Rocket,
      download: Download,
      upload: Upload,
      delete: Trash2,
      pencil: Pencil,
    }),
    [],
  );

  // Collapse/expand sidebar toggle
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
    setActivePopout(null); // Close any open popouts when toggling
  }, []);

  // Expose tab manager to global window for pro plugins
  useEffect(() => {
    (window as any).tabManager = {
      currentTab: activeTab,
      tabs: tabs,
      setTabs: setTabs,
      setActiveTabId: setActiveTabId,
      updateTab: updateActiveTab,
    };
  }, [activeTab, tabs, setTabs, setActiveTabId, updateActiveTab]);

  // Reset form editing state when switching tabs
  useEffect(() => {
    setIsEditingWorkflowName(false);
    setWorkflowNameInput("");
  }, [activeTabId]);

  // Auto-register demo plugins when component mounts
  useEffect(() => {
    const registerPlugins = async () => {
      try {
        const {
          kiteFrameCore,
          advancedInteractionsPlugin,
          versionControlPlugin,
          smartConnectPlugin,
        } = await import("@/lib/kiteframe");
        kiteFrameCore.use(advancedInteractionsPlugin);
        kiteFrameCore.use(versionControlPlugin);
        // Re-enabled SmartConnect plugin for auto-connect functionality
        kiteFrameCore.use(smartConnectPlugin);

        // Configure SmartConnect plugin with auto-connect
        smartConnectPlugin.configure(
          {
            enabled: true,
            autoConnect: true,
            threshold: 25, // Slightly increased to reduce performance impact
            showPreview: true,
          },
          nodes,
          edges,
          // onConnect callback - creates new edges when auto-connect is triggered
          (connection) => {
            const newEdge = {
              id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: connection.source,
              target: connection.target,
              type: "bezier" as const,
              animated: false,
              strokeWidth: 2,
              color: "#94a3b8",
            };

            const updatedEdges = [...edges, newEdge];
            updateActiveTab({ edges: updatedEdges });
          },
          // onEdgesChange callback
          (updatedEdges) => {
            updateActiveTab({ edges: updatedEdges });
          },
          // connectionPreviewCallback - handles ghost preview during drag
          (preview) => {
            setConnectionPreview(preview);
          },
        );
      } catch (error) {
        console.error("❌ Plugin registration error:", error);
      }
    };
    registerPlugins();
  }, []);

  // Reconfigure SmartConnect plugin when nodes/edges change
  // This ensures the plugin has access to current nodes and edges for proximity detection
  useEffect(() => {
    const reconfigureSmartConnect = async () => {
      try {
        const { smartConnectPlugin } = await import("@/lib/kiteframe");

        // Configure SmartConnect plugin with current nodes and edges
        smartConnectPlugin.configure(
          proFeaturesConfig.smartConnect || {
            enabled: true,
            autoConnect: true,
            threshold: 50,
            showPreview: true,
          },
          nodes,
          edges,
          // onConnect callback - creates new edges when auto-connect is triggered
          (connection) => {
            const newEdge = {
              id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: connection.source,
              target: connection.target,
              type: "bezier" as const,
              animated: false,
              strokeWidth: 2,
              color: "#94a3b8",
            };

            saveToHistory("Auto-connect edge");
            setEdges((prev) => [...prev, newEdge]);
          },
          // onEdgesChange callback
          (updatedEdges) => {
            setEdges(updatedEdges);
          },
          // connectionPreviewCallback - handles ghost preview during drag
          (preview) => {
            setConnectionPreview(preview);
          },
        );
      } catch (error) {
        console.error("❌ SmartConnect reconfiguration error:", error);
      }
    };

    // Only reconfigure if we have nodes (avoid configuring on empty initial state)
    if (nodes.length > 0) {
      reconfigureSmartConnect();
    }
  }, [nodes, edges, proFeaturesConfig.smartConnect, saveToHistory]);

  // Handle keyboard shortcut for workflow name editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setWorkflowNameInput(activeTab?.name || "");
        setIsEditingWorkflowName(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab?.name]);

  // Handle quick-add node events from Advanced Interactions plugin
  useEffect(() => {
    const handleQuickAddNode = (event: CustomEvent) => {
      const { sourceNodeId, position, direction } = event.detail;

      // Find the source node to calculate new position
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return;

      // Calculate new node position based on direction
      const spacing = 250;
      let newPosition = { x: 0, y: 0 };

      switch (direction) {
        case "top":
          newPosition = {
            x: sourceNode.position.x,
            y: sourceNode.position.y - spacing,
          };
          break;
        case "right":
          newPosition = {
            x: sourceNode.position.x + spacing,
            y: sourceNode.position.y,
          };
          break;
        case "bottom":
          newPosition = {
            x: sourceNode.position.x,
            y: sourceNode.position.y + spacing,
          };
          break;
        case "left":
          newPosition = {
            x: sourceNode.position.x - spacing,
            y: sourceNode.position.y,
          };
          break;
      }

      // Create new node
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: "process",
        position: newPosition,
        data: {
          label: "New Process",
          description: "Configure process settings",
          icon: "Cog",
          iconColor: "text-gray-500",
        },
        width: 200,
        height: 100,
      };

      // Save to history before mutations so snapshot is pre-addition
      saveToHistory("Quick add node");

      // Add the new node
      setNodes((prev) => [...prev, newNode]);

      // Create edge from source to new node
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: sourceNodeId,
        target: newNode.id,
        type: "bezier" as const,
        animated: false,
        style: { strokeColor: "#3b82f6", strokeWidth: 2 },
        markers: { type: "arrow" as const, position: "end" as const },
      };

      setEdges((prev) => [...prev, newEdge]);
    };

    // Listen for quick-add events
    window.addEventListener(
      "kiteframe:quick-add-node",
      handleQuickAddNode as EventListener,
    );

    return () => {
      window.removeEventListener(
        "kiteframe:quick-add-node",
        handleQuickAddNode as EventListener,
      );
    };
  }, [nodes, setNodes, setEdges, saveToHistory]);

  // Local storage persistence for workflows — keyed per user to isolate accounts.
  // Uses refs so the callbacks are stable and don't rebuild when user identity resolves.
  const saveToLocalStorage = useCallback((tabsToSave: WorkflowTab[]) => {
    try {
      // Strip inline base64 image data before saving to localStorage.
      // Images uploaded via the server have a /objects/... URL (small) and are kept.
      // Legacy base64 blobs are cleared so they don't blow the quota.
      // Only strip large raster base64 blobs. SVG data URLs (data:image/svg+xml)
      // are small text and used by mockup nodes — keep them so they survive refresh.
      const stripBase64 = (nodes: Node[]) =>
        nodes.map(n => {
          const src = (n.data as any)?.src as string | undefined;
          if (
            n.type === 'image' &&
            typeof src === 'string' &&
            src.startsWith('data:') &&
            !src.startsWith('data:image/svg+xml')
          ) {
            return { ...n, data: { ...(n.data as any), src: '' } };
          }
          return n;
        });

      const stripped = tabsToSave.map(tab => ({
        ...tab,
        nodes: stripBase64(tab.nodes),
        history: tab.history.map(h => ({ ...h, nodes: stripBase64(h.nodes) })),
      }));
      localStorage.setItem(storageKeyRef.current, JSON.stringify(stripped));
    } catch (error) {
      console.error("❌ Failed to save workflows to local storage:", error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((): WorkflowTab[] => {
    try {
      const key = storageKeyRef.current;
      let rawSaved = localStorage.getItem(key);

      // One-time migration: when a signed-in user's namespaced key is empty but the
      // legacy unnamespaced key has data, copy it to the namespaced key.
      const currentUserId = userIdRef.current;
      if (!rawSaved && currentUserId) {
        const legacyData = localStorage.getItem('kiteframe_workflows');
        if (legacyData) {
          // Copy (not move) to the namespaced key — we intentionally leave the legacy key
          // in place so that anonymous sessions on the same browser are unaffected.
          localStorage.setItem(key, legacyData);
          rawSaved = legacyData;
        }
      }

      if (rawSaved) {
        const parsed = JSON.parse(rawSaved);
        // Backfill projectUuid and isOpen for legacy tabs
        return parsed.map((tab: WorkflowTab) => ({
          ...tab,
          projectUuid: tab.projectUuid || `legacy-${tab.id}-${Date.now()}`,
          // Legacy tabs default to closed (not shown in tab bar, but still in gallery)
          isOpen: tab.isOpen ?? false,
        }));
      }
    } catch (error) {
      console.error("❌ Failed to load workflows from local storage:", error);
    }
    return [];
  }, []);

  // Auto-save to local storage when tabs change (with thumbnail generation)
  // Skip in view mode to avoid polluting localStorage
  useEffect(() => {
    if (isReadOnly) return; // Don't save in view mode
    if (tabs.length > 0) {
      const timer = setTimeout(() => {
        // Generate thumbnails and update lastModified for each tab before saving
        const tabsWithThumbnails = tabs.map((tab) => ({
          ...tab,
          thumbnail: generateWorkflowThumbnail(tab.nodes, tab.edges),
          lastModified: tab.lastModified || Date.now(),
        }));
        saveToLocalStorage(tabsWithThumbnails);
      }, 1000); // Debounce saves by 1 second

      return () => clearTimeout(timer);
    }
  }, [tabs, saveToLocalStorage, isReadOnly]);

  // ---- Cross-device cloud sync (light, last-write-wins) ----
  // Signature of the content we currently believe is in sync with the cloud,
  // keyed by cloudProjectId, plus the cloud updatedAt timestamp it corresponds to.
  const cloudSyncSigRef = useRef<Map<string, string>>(new Map());
  const cloudSyncTsRef = useRef<Map<string, number>>(new Map());

  // Bumped (debounced) whenever the right-hand Project Panel docs change, to
  // re-trigger the cloud auto-save effect on panel-only edits.
  const [panelDocsVersion, setPanelDocsVersion] = useState(0);
  // Deadline (epoch ms) until which panel-doc change events are ignored. We set
  // this while hydrating panel docs from the cloud so neither the synchronous
  // events nor the *async* follow-on re-saves (e.g. ProjectOverviewSection
  // reloading from storage and re-stamping its details) bump panelDocsVersion
  // and retrigger an auto-save of state we just pulled.
  const suppressPanelBumpUntilRef = useRef(0);

  // Build a stable signature of the parts of a workflow that count as "edits".
  // Viewport/selection are intentionally excluded so panning/zooming alone does
  // not trigger cloud saves.
  const computeCloudSyncSig = useCallback(
    (
      wf:
        | {
            nodes?: any[];
            edges?: any[];
            canvasObjects?: any[];
            flowSettings?: any;
            sketchStrokes?: any[];
            prdData?: any;
            workflowPRDs?: any[] | null;
            notesData?: string | null;
            detailsData?: string | null;
          }
        | null
        | undefined,
      name?: string,
      description?: string,
    ): string => {
      // Canonicalize per-workflow PRD ordering so the signature is independent
      // of array/localStorage key order. This matters because the signature is
      // computed both from the cloud's stored workflowData (whatever order it
      // was saved in) and from locally-read docs; if they disagreed on order a
      // device could falsely look "out of sync" and push stale state over newer
      // cloud edits (LWW regression).
      const canonicalWorkflowPRDs = Array.isArray(wf?.workflowPRDs)
        ? [...wf!.workflowPRDs].sort((a, b) =>
            String(a?.workflowId ?? "").localeCompare(String(b?.workflowId ?? "")),
          )
        : (wf?.workflowPRDs ?? null);
      // The overview/details blob re-stamps `updatedAt` (and seeds `createdAt`)
      // on every save/reload, so comparing it raw would make idempotent reloads
      // look like edits and ping-pong pushes between devices. Strip those
      // volatile timestamps so the signature reflects real content only.
      let detailsSig: string | null = wf?.detailsData ?? null;
      if (typeof detailsSig === "string") {
        try {
          const parsed = JSON.parse(detailsSig);
          if (parsed && typeof parsed === "object") {
            delete (parsed as any).updatedAt;
            delete (parsed as any).createdAt;
            detailsSig = JSON.stringify(parsed);
          }
        } catch {
          // Not JSON — compare as-is.
        }
      }
      return JSON.stringify({
        nodes: wf?.nodes || [],
        edges: wf?.edges || [],
        canvasObjects: wf?.canvasObjects || [],
        flowSettings: wf?.flowSettings || {},
        sketchStrokes: wf?.sketchStrokes || [],
        // Panel documentation (right-hand Project Panel) is part of "edits" too,
        // so a PRD/notes/overview change is detected and synced to viewers.
        prdData: wf?.prdData ?? null,
        workflowPRDs: canonicalWorkflowPRDs,
        notesData: wf?.notesData ?? null,
        detailsData: detailsSig,
        name: name || "",
        description: description || "",
      });
    },
    [],
  );

  // The id panel documentation is keyed under in localStorage for a given tab.
  // Mirrors the global `projectIdentifier` so a tab's panel docs (PRDs, notes,
  // overview) are read/written under the same key the Project Panel uses.
  const tabProjectIdentifier = useCallback(
    (tab: WorkflowTab): string =>
      tab.projectUuid || tab.cloudProjectId?.toString() || tab.id,
    [],
  );

  // Read the right-hand Project Panel documentation (project PRD, per-workflow
  // PRDs, notes, overview/details) out of localStorage for a project id. These
  // are the same keys the manual "Save to cloud" bundles, so cloud auto-save can
  // carry them too and the shared view-only page stays current.
  const readPanelDocs = useCallback((pid: string) => {
    let prdData: any = null;
    let workflowPRDs: any[] | null = null;
    let notesData: string | null = null;
    let detailsData: string | null = null;
    try {
      prdData = loadProjectPRD(pid);
    } catch {}
    try {
      // Sort by workflow id so the resulting array (and therefore the cloud
      // sync signature) is canonical and device-independent. Without this,
      // two devices with identical PRDs but different localStorage key order
      // would produce different signatures and falsely look "out of sync",
      // which could make a device push stale state over newer cloud edits.
      const ids = [...listWorkflowPRDs(pid)].sort();
      const prds = ids.map((id) => loadWorkflowPRD(pid, id)).filter(Boolean);
      workflowPRDs = prds.length > 0 ? (prds as any[]) : null;
    } catch {}
    try {
      notesData = localStorage.getItem(`kiteframe-notes-${pid}`);
    } catch {}
    try {
      detailsData = localStorage.getItem(`kiteframe-details-${pid}`);
    } catch {}
    return { prdData, workflowPRDs, notesData, detailsData };
  }, []);

  // Mirror cloud-held panel documentation back into localStorage so the open
  // Project Panel reflects edits made on another device, and so auto-save does
  // not immediately re-push our stale copy (which would clobber the newer cloud
  // copy). Mirrors what the view-only viewer does for shared viewers.
  const writePanelDocs = useCallback((pid: string, wf: any) => {
    if (!pid || !wf) return;
    // Suppress panel-doc bumps for a short window so neither the synchronous
    // change events below nor the async follow-on re-saves they cause (panels
    // reloading from storage) retrigger an auto-save of what we just pulled.
    suppressPanelBumpUntilRef.current = Date.now() + 1500;
    try {
      if (wf.prdData) {
        saveProjectPRD(pid, wf.prdData);
      } else {
        deleteProjectPRD(pid);
      }
      // Only reconcile per-workflow PRDs when the field was actually provided.
      if ("workflowPRDs" in wf) {
        const fresh = (wf.workflowPRDs ?? []) as any[];
        const freshIds = new Set<string>(
          fresh.map((w) => w?.workflowId).filter(Boolean),
        );
        for (const existingId of listWorkflowPRDs(pid)) {
          if (!freshIds.has(existingId)) deleteWorkflowPRD(pid, existingId);
        }
        for (const w of fresh) {
          if (w?.workflowId) saveWorkflowPRD(pid, w.workflowId, w);
        }
      }
      if (wf.notesData) {
        localStorage.setItem(`kiteframe-notes-${pid}`, wf.notesData);
      } else {
        localStorage.removeItem(`kiteframe-notes-${pid}`);
      }
      if (wf.detailsData) {
        localStorage.setItem(`kiteframe-details-${pid}`, wf.detailsData);
      } else {
        localStorage.removeItem(`kiteframe-details-${pid}`);
      }
      // Tell the open panels to reload from the freshly seeded localStorage.
      prdGenerationBus.notifyProjectDetailsUpdated(pid);
      prdGenerationBus.notifyPRDUpdated(pid);
      window.dispatchEvent(
        new CustomEvent("kiteframe:panelDataRefresh", {
          detail: { projectId: pid },
        }),
      );
    } catch (e) {
      console.warn("[cloud-sync] writePanelDocs failed:", e);
    }
    // Note: we intentionally do NOT clear suppressPanelBumpUntilRef here — the
    // deadline set above must outlive this synchronous call to also cover the
    // async re-saves panels perform after reloading from the seeded storage.
  }, []);

  const tabSyncSig = useCallback(
    (tab: WorkflowTab): string => {
      const docs = readPanelDocs(tabProjectIdentifier(tab));
      return computeCloudSyncSig(
        {
          nodes: tab.nodes,
          edges: tab.edges,
          canvasObjects: tab.canvasObjects,
          flowSettings: tab.flowSettings,
          sketchStrokes: tab.sketchStrokes,
          ...docs,
        },
        tab.name,
        tab.metadata?.description,
      );
    },
    [computeCloudSyncSig, readPanelDocs, tabProjectIdentifier],
  );

  // Persisted cross-device sync state: the cloud content signature + cloud
  // updatedAt that THIS device last synced with, per project. Persisting it is
  // what makes "no local edits since last sync" survive a reload — so a device
  // that simply has an older snapshot pulls the newer cloud copy instead of
  // pushing its stale one back (true last-write-wins).
  const CLOUD_SYNC_STATE_KEY = "kiteframe-cloud-sync-state-v1";

  const persistCloudSyncState = useCallback(() => {
    try {
      const obj: Record<string, { sig: string; ts: number }> = {};
      cloudSyncTsRef.current.forEach((ts, cid) => {
        const sig = cloudSyncSigRef.current.get(cid);
        if (sig !== undefined) obj[cid] = { sig, ts };
      });
      localStorage.setItem(CLOUD_SYNC_STATE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage errors (quota / disabled storage).
    }
  }, []);

  // Restore persisted sync state once, synchronously, before any sync effect
  // runs on the first render.
  const cloudSyncLoadedRef = useRef(false);
  if (!cloudSyncLoadedRef.current) {
    cloudSyncLoadedRef.current = true;
    try {
      const raw = localStorage.getItem(CLOUD_SYNC_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          { sig: string; ts: number }
        >;
        for (const [cid, v] of Object.entries(parsed)) {
          if (v && typeof v.sig === "string" && typeof v.ts === "number") {
            cloudSyncSigRef.current.set(cid, v.sig);
            cloudSyncTsRef.current.set(cid, v.ts);
          }
        }
      }
    } catch {
      // Ignore corrupt state.
    }
  }

  // First-sighting reconciliation: for cloud tabs we have NO sync state for
  // (never synced on this device — e.g. first run after this feature shipped, or
  // a freshly opened tab), decide a one-time winner by recency. If the cloud
  // copy is newer than the tab's local lastModified, apply the cloud copy;
  // otherwise keep local and let auto-save push it. Ref baselines are written
  // synchronously here so the auto-save/apply effects below act on them.
  useEffect(() => {
    if (isReadOnly) return;
    if (!hasCloudAccess) return;
    if (cloudProjects.length === 0) return;

    const toApply = new Map<string, any>(); // cid -> cloud project to hydrate
    let stateTouched = false;

    tabs.forEach((tab) => {
      const cid = tab.cloudProjectId;
      if (!cid) return;
      if (cloudSyncTsRef.current.has(cid)) return; // already reconciled
      const fresh = cloudProjects.find((p) => p.id === cid);
      if (!fresh || !fresh.workflowData) return; // wait for the cloud copy

      const freshTs = fresh.updatedAt ? new Date(fresh.updatedAt).getTime() : 0;
      const cloudSig = computeCloudSyncSig(
        fresh.workflowData as any,
        fresh.name,
        fresh.description ?? undefined,
      );
      const localSig = tabSyncSig(tab);

      cloudSyncTsRef.current.set(cid, freshTs);
      stateTouched = true;

      if (localSig === cloudSig) {
        cloudSyncSigRef.current.set(cid, cloudSig);
        return; // already identical → nothing to do
      }
      const localTs = tab.lastModified ?? 0;
      if (freshTs > localTs) {
        cloudSyncSigRef.current.set(cid, cloudSig);
        toApply.set(cid, fresh); // cloud newer → hydrate the tab
      } else {
        // Local is newer — keep local content. Set the cloud baseline to
        // the cloud's own signature (not localSig) so the auto-save fires
        // and pushes any local changes — especially panel docs (PRDs,
        // notes, details) — that the cloud copy is missing. Using localSig
        // here caused the auto-save to skip, leaving panel docs stuck in
        // the author's localStorage and never visible to share-link viewers.
        // Content-identical cases short-circuit above (localSig === cloudSig
        // guard), so a save triggered here always reflects a real difference.
        cloudSyncSigRef.current.set(cid, cloudSig);
      }
    });

    if (stateTouched) persistCloudSyncState();
    if (toApply.size === 0) return;

    // Seed the cloud copy's panel docs into localStorage so the Project Panel
    // shows them and auto-save doesn't re-push our stale copy.
    toApply.forEach((fresh, cid) => {
      const tab = tabs.find((t) => t.cloudProjectId === cid);
      writePanelDocs(
        tab ? tabProjectIdentifier(tab) : cid.toString(),
        fresh.workflowData as any,
      );
    });

    // Signal the VersionControlPlugin to suppress snapshot autosave while we
    // hydrate tabs from the cloud so loading doesn't fire a snapshot (which
    // would touch updatedAt on the active project).
    (window as any).kiteframeHydrating = true;
    setTimeout(() => { (window as any).kiteframeHydrating = false; }, 15000);

    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        const cid = tab.cloudProjectId;
        if (!cid || !toApply.has(cid)) return tab;
        const fresh = toApply.get(cid);
        const wf = fresh.workflowData as any;
        changed = true;
        const syncedName = pickSyncedName(fresh.name, tab.name);
        return {
          ...tab,
          name: syncedName,
          nodes: wf.nodes || [],
          edges: wf.edges || [],
          canvasObjects: wf.canvasObjects || [],
          viewport: wf.viewport || tab.viewport,
          flowSettings: wf.flowSettings || {},
          sketchStrokes: wf.sketchStrokes ?? [],
          thumbnail: fresh.thumbnail || tab.thumbnail,
          lastModified: fresh.updatedAt
            ? new Date(fresh.updatedAt).getTime()
            : tab.lastModified,
          history: [
            {
              nodes: wf.nodes || [],
              edges: wf.edges || [],
              canvasObjects: wf.canvasObjects || [],
              viewport: wf.viewport || tab.viewport,
            },
          ],
          historyIndex: 0,
          metadata: {
            ...tab.metadata,
            name: syncedName,
            description: fresh.description ?? tab.metadata?.description,
          },
        };
      });
      return changed ? next : prev;
    });
  }, [
    tabs,
    cloudProjects,
    hasCloudAccess,
    isReadOnly,
    tabSyncSig,
    computeCloudSyncSig,
    persistCloudSyncState,
    writePanelDocs,
    tabProjectIdentifier,
  ]);

  // Auto-save cloud-backed tabs to the cloud (debounced), in addition to the
  // local-storage auto-save above. Skipped in view mode and for users without
  // cloud access. Redundant saves are avoided via the content signature, and the
  // generated thumbnail is persisted on every save.
  useEffect(() => {
    if (isReadOnly) return;
    if (!hasCloudAccess) return;
    const cloudTabs = tabs.filter((t) => t.cloudProjectId);
    if (cloudTabs.length === 0) return;

    const timer = setTimeout(() => {
      cloudTabs.forEach((tab) => {
        const cid = tab.cloudProjectId!;
        // Wait until first-sighting reconciliation has set a baseline for this
        // tab (so we never push before knowing what the cloud holds).
        if (!cloudSyncSigRef.current.has(cid)) return;

        const localSig = tabSyncSig(tab);
        // Nothing changed since the last sync → skip.
        if (cloudSyncSigRef.current.get(cid) === localSig) return;

        // Bundle the right-hand Project Panel docs so the cloud copy (and the
        // shared view-only page) carries the current PRDs/notes/overview.
        const docs = readPanelDocs(tabProjectIdentifier(tab));
        const workflowData = {
          nodes: tab.nodes,
          edges: tab.edges,
          canvasObjects: tab.canvasObjects,
          viewport: tab.viewport,
          flowSettings: tab.flowSettings || {},
          sketchStrokes: tab.sketchStrokes || [],
          prdData: docs.prdData,
          workflowPRDs: docs.workflowPRDs,
          notesData: docs.notesData,
          detailsData: docs.detailsData,
        };
        const thumbnail = generateWorkflowThumbnail(tab.nodes, tab.edges);

        updateCloudProject({
          id: cid,
          name: tab.name,
          description: tab.metadata?.description,
          workflowData,
          thumbnail,
        })
          .then((saved) => {
            if (saved) {
              cloudSyncSigRef.current.set(cid, localSig);
              cloudSyncTsRef.current.set(
                cid,
                saved.updatedAt
                  ? new Date(saved.updatedAt).getTime()
                  : Date.now(),
              );
              persistCloudSyncState();
            }
          })
          .catch(() => {
            // Save errors are surfaced by the hook; the local-storage auto-save
            // still preserves the work.
          });
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    tabs,
    hasCloudAccess,
    isReadOnly,
    updateCloudProject,
    tabSyncSig,
    persistCloudSyncState,
    readPanelDocs,
    tabProjectIdentifier,
    // Re-run when the right-hand Project Panel docs change so a panel-only edit
    // (no canvas change) still triggers a cloud auto-save.
    panelDocsVersion,
  ]);

  // Pull the latest cloud version into open cloud tabs when it is newer than
  // what we hold and there are no unsaved local edits (last-write-wins).
  useEffect(() => {
    if (isReadOnly) return;
    if (!hasCloudAccess) return;
    if (cloudProjects.length === 0) return;

    const docWrites: Array<{ pid: string; wf: any }> = [];
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((tab) => {
        const cid = tab.cloudProjectId;
        if (!cid) return tab;
        const fresh = cloudProjects.find((p) => p.id === cid);
        if (!fresh || !fresh.workflowData) return tab;

        const freshTs = fresh.updatedAt
          ? new Date(fresh.updatedAt).getTime()
          : 0;

        // First-sighting reconciliation owns initialization; if we have no
        // baseline yet, wait for it rather than guessing here.
        if (!cloudSyncTsRef.current.has(cid)) return tab;

        const heldTs = cloudSyncTsRef.current.get(cid) ?? 0;
        if (freshTs <= heldTs) return tab; // cloud not newer than what we hold

        // Cloud advanced (another device saved). Only apply if we have no
        // unsaved local edits — otherwise keep local and let auto-save push it.
        const localSig = tabSyncSig(tab);
        const syncedSig = cloudSyncSigRef.current.get(cid);
        if (syncedSig !== undefined && localSig !== syncedSig) {
          return tab; // unsaved local edits → don't clobber
        }

        const wf = fresh.workflowData as any;
        cloudSyncSigRef.current.set(
          cid,
          computeCloudSyncSig(wf, fresh.name, fresh.description ?? undefined),
        );
        cloudSyncTsRef.current.set(cid, freshTs);
        persistCloudSyncState();
        // Mirror the newer cloud panel docs into localStorage (applied after the
        // state update so it stays out of the pure reducer).
        docWrites.push({ pid: tabProjectIdentifier(tab), wf });
        changed = true;
        const syncedName = pickSyncedName(fresh.name, tab.name);
        return {
          ...tab,
          name: syncedName,
          nodes: wf.nodes || [],
          edges: wf.edges || [],
          canvasObjects: wf.canvasObjects || [],
          viewport: wf.viewport || tab.viewport,
          flowSettings: wf.flowSettings || {},
          sketchStrokes: wf.sketchStrokes ?? [],
          thumbnail: fresh.thumbnail || tab.thumbnail,
          lastModified: freshTs,
          history: [
            {
              nodes: wf.nodes || [],
              edges: wf.edges || [],
              canvasObjects: wf.canvasObjects || [],
              viewport: wf.viewport || tab.viewport,
            },
          ],
          historyIndex: 0,
          metadata: {
            ...tab.metadata,
            name: syncedName,
            description: fresh.description ?? tab.metadata?.description,
          },
        };
      });
      return changed ? next : prev;
    });

    // Apply localStorage panel-doc writes outside the state reducer.
    docWrites.forEach(({ pid, wf }) => writePanelDocs(pid, wf));
  }, [
    cloudProjects,
    hasCloudAccess,
    isReadOnly,
    tabSyncSig,
    computeCloudSyncSig,
    persistCloudSyncState,
    writePanelDocs,
    tabProjectIdentifier,
  ]);

  // Re-pull cloud projects when the window/tab regains focus so edits made on
  // another device show up shortly after switching back.
  useEffect(() => {
    if (!hasCloudAccess) return;
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refetchCloudProjects();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [hasCloudAccess, refetchCloudProjects]);

  // Watch for right-hand Project Panel edits (PRDs, notes, overview) so a
  // panel-only change — which does not touch `tabs` — still triggers the cloud
  // auto-save above. The bump is debounced so a burst of edits causes at most
  // one extra render.
  useEffect(() => {
    if (isReadOnly) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      // Ignore the events our own cloud-apply hydration emits (and the async
      // re-saves they trigger) — they reflect a pull, not a user edit, and must
      // not retrigger an auto-save.
      if (Date.now() < suppressPanelBumpUntilRef.current) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => setPanelDocsVersion((v) => v + 1), 800);
    };
    const onDocsChanged = () => bump();
    const unsub = prdGenerationBus.subscribe((event) => {
      if (
        event.type === "prd-updated" ||
        event.type === "project-details-updated" ||
        event.type === "generation-completed"
      ) {
        bump();
      }
    });
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key.startsWith("kiteframe-notes-") ||
        e.key.startsWith("kiteframe-details-") ||
        e.key.startsWith("prd-project-") ||
        e.key.startsWith("prd-workflow-")
      ) {
        bump();
      }
    };
    window.addEventListener("kiteframe:panelDocsChanged", onDocsChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("kiteframe:panelDocsChanged", onDocsChanged);
      window.removeEventListener("storage", onStorage);
      unsub();
    };
  }, [isReadOnly]);

  // Load workflows from local storage on mount - skip in view mode
  // Also handles merging with pending chat draft if navigating from FullScreenChat
  useEffect(() => {
    if (isReadOnly) return; // Don't load in view mode

    // Wait until we know who the user is (or confirmed they're anonymous) so that
    // the correct per-user storage key is used from the very first load.
    if (serverUserLoading) return;
    
    // Prevent double-processing via ref guard
    // If already processed, skip entirely - tabs were already set correctly
    if (fromChatLoadedRef.current) {
      return;
    }
    
    const savedTabs = loadFromLocalStorage();
    const params = new URLSearchParams(window.location.search);
    const isFromChat = params.get('fromChat') === 'true';
    const draftJson = localStorage.getItem('kiteframe-pending-workflow-draft');
    
    // If coming from chat with a pending draft, create the new tab and merge with saved tabs
    if (isFromChat && draftJson) {
      // Mark as processed FIRST to prevent re-entry on effect re-runs
      fromChatLoadedRef.current = true;
      
      // Clear the query param from URL immediately to prevent re-entry
      window.history.replaceState({}, '', window.location.pathname);
      
      try {
        const draft = JSON.parse(draftJson);
        localStorage.removeItem('kiteframe-pending-workflow-draft');
        
        // Create a new tab with the workflow draft
        const newTab = createBlankTab();
        newTab.nodes = draft.nodes || [];
        newTab.edges = draft.edges || [];
        newTab.canvasObjects = draft.canvasObjects || [];
        newTab.history = [{
          nodes: newTab.nodes,
          edges: newTab.edges,
          canvasObjects: newTab.canvasObjects,
          viewport: newTab.viewport,
        }];
        newTab.historyIndex = 0;
        
        // Restore transcript from the draft if present
        if (draft.transcript && draft.transcript.length > 0) {
          const transcriptKey = `kiteframe-prompt-transcript-${newTab.projectUuid}`;
          localStorage.setItem(transcriptKey, JSON.stringify(draft.transcript));
        }
        
        // Clear the homepage prompt input to avoid showing stale data
        if (promptContextStore) {
          promptContextStore.clearStore();
        }
        
        // Merge saved tabs with the new chat tab, making it active
        setTabs([...savedTabs, newTab]);
        setActiveTabId(newTab.id);
        
        toast({
          title: "Workflow Created",
          description: `Created workflow with ${draft.nodes?.length || 0} nodes.`
        });
      } catch (e) {
        console.error('Failed to load workflow draft:', e);
        // Fallback to just loading saved tabs
        if (savedTabs.length > 0) {
          setTabs(savedTabs);
        }
      }
    } else if (savedTabs.length > 0) {
      setTabs(savedTabs);
      // Keep user on home screen by default, they can switch to a tab from there
    }
  }, [loadFromLocalStorage, isReadOnly, serverUserLoading, createBlankTab, toast, promptContextStore]);

  // Handle reset in view mode: restore original data
  const handleViewReset = useCallback(() => {
    if (!isReadOnly || !initialNodes) return;

    // Restore original data to the view tab
    setTabs([
      {
        id: "view-tab",
        name: initialProjectName || "Shared Workflow",
        nodes: initialNodes,
        edges: initialEdges || [],
        canvasObjects: initialCanvasObjects || [],
        viewport: initialViewport || { x: 0, y: 0, zoom: 1 },
        selectedNodeId: "",
        selectedEdgeId: "",
        history: [
          {
            nodes: initialNodes,
            edges: initialEdges || [],
            canvasObjects: initialCanvasObjects || [],
            viewport: initialViewport || { x: 0, y: 0, zoom: 1 },
          },
        ],
        historyIndex: 0,
        showImageModal: null,
        metadata: {
          name: initialProjectName || "Shared Workflow",
          description: initialProjectDescription || "",
          links: [],
          linksFormat: "text",
          categories: [],
        },
        flowSettings: {},
        projectUuid: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    ]);
    setActiveTabId("view-tab");

    // Also call the external onReset if provided
    if (onReset) {
      onReset();
    }
  }, [
    isReadOnly,
    initialNodes,
    initialEdges,
    initialCanvasObjects,
    initialViewport,
    initialProjectName,
    initialProjectDescription,
    onReset,
  ]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <TrialBanner />
      {/* Header with Tabs */}
      <Toolbar
        onOpenAiSettings={() => setShowAiModal(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        editorSettings={editorSettings}
        onEditorSettingsChange={setEditorSettings}
        onOpenBugReport={() => setShowBugReportModal(true)}
        isReadOnly={effectiveReadOnly}
      >
        <ScrollArea className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 w-max">
            {/* Read Only Badge */}
            {isReadOnly && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm font-medium mr-2"
                data-testid="badge-read-only"
              >
                <Eye size={14} />
                <span>Read Only</span>
              </div>
            )}
            {/* Home Tab Icon */}
            {!effectiveReadOnly && (
              <button
                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors flex-shrink-0 ${
                  isOnHomeTab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTabId("home")}
                data-testid="tab-home"
                title="Home"
              >
                <Home size={16} />
              </button>
            )}

            {/* Workflow Tabs - hidden in view mode, only show open tabs */}
            {!effectiveReadOnly &&
              tabs
                .filter((tab) => tab.isOpen !== false)
                .map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-md cursor-pointer flex-shrink-0 ${
                      tab.id === activeTabId
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                    data-testid={`tab-${tab.id}`}
                  >
                    {isEditingWorkflowName && tab.id === activeTabId ? (
                      <input
                        type="text"
                        value={workflowNameInput}
                        onChange={(e) => setWorkflowNameInput(e.target.value)}
                        onBlur={() => {
                          if (workflowNameInput.trim()) {
                            const trimmedName = workflowNameInput.trim();
                            updateActiveTab({ name: trimmedName });
                            // For design tabs, also persist the title to the
                            // design record so it survives a page reload and
                            // onTitleLoaded doesn't revert it to the old name.
                            if (activeTab?.designId) {
                              fetch(`/api/designs/${activeTab.designId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ title: trimmedName }),
                                credentials: "include",
                              }).catch(() => { /* best-effort */ });
                            }
                          }
                          setIsEditingWorkflowName(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (workflowNameInput.trim()) {
                              const trimmedName = workflowNameInput.trim();
                              updateActiveTab({ name: trimmedName });
                              // Same design-title persistence as onBlur above.
                              if (activeTab?.designId) {
                                fetch(`/api/designs/${activeTab.designId}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ title: trimmedName }),
                                  credentials: "include",
                                }).catch(() => { /* best-effort */ });
                              }
                            }
                            setIsEditingWorkflowName(false);
                          } else if (e.key === "Escape") {
                            setIsEditingWorkflowName(false);
                            setWorkflowNameInput(tab.name);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-transparent border-none outline-none text-sm font-medium text-inherit px-0 py-0 w-full max-w-32"
                        autoFocus
                        data-testid="input-workflow-name"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {(designModeTabIds.has(tab.id) || !!tab.designId) ? (
                          <span className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0" title="Design">
                            <Layers size={9} className="text-white" />
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0" title="Workflow">
                            <GitBranch size={9} className="text-white" />
                          </span>
                        )}
                        <span
                          className="truncate text-sm font-medium max-w-[240px]"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setWorkflowNameInput(tab.name);
                            setIsEditingWorkflowName(true);
                          }}
                          data-testid="text-workflow-name"
                          title={`${tab.name} - Double-click to rename`}
                        >
                          {tab.name.length > 10
                            ? `${tab.name.substring(0, 10)}...`
                            : tab.name}
                        </span>
                        {tab.designIsStale && (
                          <span
                            className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 ring-1 ring-orange-300"
                            title="Interface is out of date — workflow has been updated"
                          />
                        )}
                      </div>
                    )}
                    <button
                      className="ml-1 hover:bg-background/20 rounded p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      data-testid={`close-tab-${tab.id}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
            {/* New Tab button - hidden in view mode */}
            {!effectiveReadOnly && (
              <button
                className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => { setPreviousTabId(activeTabId); setActiveTabId("new"); }}
                data-testid="button-new-tab"
                title="New Tab"
              >
                <Plus size={16} />
              </button>
            )}
            {/* View mode: show project name */}
            {effectiveReadOnly && initialProjectName && (
              <span className="text-sm font-medium text-foreground px-2">
                {initialProjectName}
              </span>
            )}
          </div>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
      </Toolbar>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* New Tab Type Picker */}
        {isOnNewTab ? (
          <NewTabTypePicker
            onSelectWorkflow={() => { createNewTab(); }}
            onOpenDesignById={(designId, title) => { openDesignTab(designId, title); }}
            onCancel={() => {
              setActiveTabId(previousTabId ?? tabs.find((t) => t.id !== "new")?.id ?? "home");
              setPreviousTabId(null);
            }}
          />
        ) : isOnHomeTab ? (
          <>
          <HomeScreen
            recentProjects={[
              // Local projects from tabs (stored in browser). For cloud-backed
              // tabs, also surface share status so the badge/revoke UI works.
              ...tabs
                .filter((tab) => tab.nodes.length > 0 || !!tab.designId)
                .map((tab) => {
                  const cp = tab.cloudProjectId
                    ? cloudProjects.find((p) => p.id === tab.cloudProjectId)
                    : null;
                  return {
                    id: tab.id,
                    name: tab.name,
                    lastModified: new Date(tab.lastModified || Date.now()),
                    status: cp?.isPublic
                      ? ("published" as const)
                      : ("private" as const),
                    thumbnail: tab.thumbnail || cp?.thumbnail || undefined,
                    isLocal: true,
                    shareUuid: cp?.shareUuid || undefined,
                    isShareEnabled: cp?.isShareEnabled || false,
                    fileType: tab.designId ? ("design" as const) : ("workflow" as const),
                    designId: tab.designId || undefined,
                  };
                }),
              // Cloud projects for Pro/Admin users — exclude any that are
              // already open as a local tab (identified by cloudProjectId)
              // so each project appears exactly once in the list.
              ...(hasCloudAccess
                ? cloudProjects
                    .filter(
                      (project) =>
                        !tabs.some((t) => t.cloudProjectId === project.id),
                    )
                    .map((project) => ({
                      id: project.id,
                      name: project.name,
                      lastModified: new Date(
                        project.updatedAt || project.createdAt || Date.now(),
                      ),
                      status: project.isPublic
                        ? ("published" as const)
                        : ("private" as const),
                      thumbnail: project.thumbnail || undefined,
                      isLocal: false,
                      shareUuid: project.shareUuid || undefined,
                      isShareEnabled: project.isShareEnabled || false,
                    }))
                : []),
            ].sort(
              (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
            )}
            onOpenProject={(projectId) => {
              // Check if this is a local tab first
              const localTab = tabs.find((t) => t.id === projectId);
              if (localTab) {
                // Mark the tab as open (show in tab bar)
                setTabs((prev) =>
                  prev.map((tab) =>
                    tab.id === projectId ? { ...tab, isOpen: true } : tab,
                  ),
                );
                setActiveTabId(projectId);
                return;
              }
              // Otherwise, try to open as a cloud project
              if (hasCloudAccess) {
                const project = cloudProjects.find((p) => p.id === projectId);
                if (project && project.workflowData) {
                  const workflowData = project.workflowData as any;
                  const name = project.name || generateCuteName();
                  const newTab: WorkflowTab = {
                    id: generateTabId(),
                    name,
                    nodes: workflowData.nodes || [],
                    edges: workflowData.edges || [],
                    canvasObjects: workflowData.canvasObjects || [],
                    viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
                    selectedNodeId: "",
                    selectedEdgeId: "",
                    history: [
                      {
                        nodes: workflowData.nodes || [],
                        edges: workflowData.edges || [],
                        canvasObjects: workflowData.canvasObjects || [],
                        viewport: workflowData.viewport || {
                          x: 0,
                          y: 0,
                          zoom: 1,
                        },
                      },
                    ],
                    historyIndex: 0,
                    showImageModal: null,
                    metadata: {
                      name,
                      description: project.description || "",
                      links: [],
                      linksFormat: "text",
                      categories: [],
                    },
                    flowSettings: workflowData.flowSettings || {},
                    sketchStrokes: workflowData.sketchStrokes ?? [],
                    cloudProjectId: project.id,
                    projectUuid: project.projectUuid || `cloud-${project.id}`,
                    shareUuid: project.shareUuid || null,
                    isOpen: true,
                  };
                  setTabs((prev) => [...prev, newTab]);
                  setActiveTabId(newTab.id);
                }
              }
            }}
            onGenerateWorkflow={(prompt, generatePRD) => {
              // Create new tab and switch to it
              const newTab = createBlankTab();
              setTabs((prev) => [...prev, newTab]);
              setActiveTabId(newTab.id);
              
              // Set prompt for KiteAI Chat to consume
              // The chat panel will automatically handle the workflow generation
              setPendingChatPrompt(prompt);
              
              // Store PRD flag in context for KiteAI Chat to use
              if (generatePRD) {
                promptContextStore?.setGeneratePRD(true);
              }
            }}
            onCreateBlankWorkflow={createNewTab}
            onLoadTemplate={(templateType) => {
              // Generate template data based on type
              let templateData: { nodes: Node[]; edges: Edge[] } | undefined;
              switch (templateType) {
                case "getting-started":
                  templateData = generateGettingStartedTemplate();
                  break;
                case "user-journey":
                  templateData = generateUserJourneyTemplate();
                  break;
                case "product-roadmap":
                  templateData = generateProductRoadmapTemplate();
                  break;
                case "okr-planning":
                  templateData = generateOKRPlanningTemplate();
                  break;
                case "feature-request-flow":
                  templateData = generateFeatureRequestFlowTemplate();
                  break;
                case "decision-tree":
                  templateData = generateDecisionTreeTemplate();
                  break;
                case "mindmap":
                  templateData = generateMindmapTemplate();
                  break;
                case "system-architecture":
                  templateData = generateSystemArchitectureTemplate();
                  break;
                case "swim-lanes":
                  templateData = generateSwimLanesTemplate();
                  break;
                case "user-account-creation":
                  templateData = generateUserAccountTemplate();
                  break;
                case "io-logic":
                  templateData = generateIOLogicTemplate();
                  break;
              }

              if (!templateData) {
                console.warn("Unknown template type:", templateType);
                return;
              }

              // Create a new tab with the template data pre-populated
              const name = generateCuteName();
              const newTab: WorkflowTab = {
                id: generateTabId(),
                name,
                nodes: templateData.nodes,
                edges: templateData.edges,
                canvasObjects: [],
                viewport: { x: 0, y: 0, zoom: 1 },
                selectedNodeId: "",
                selectedEdgeId: "",
                history: [
                  {
                    nodes: templateData.nodes,
                    edges: templateData.edges,
                    canvasObjects: [],
                    viewport: { x: 0, y: 0, zoom: 1 },
                  },
                ],
                historyIndex: 0,
                showImageModal: null,
                metadata: {
                  name,
                  description: "",
                  links: [],
                  linksFormat: "text",
                  categories: [],
                },
                projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                sketchStrokes: [],
              };

              setTabs((prev) => [...prev, newTab]);
              setActiveTabId(newTab.id);

              toast({
                title: "Template Loaded",
                description: `Created "${name}" with ${templateType.replace(/-/g, " ")} template`,
              });
            }}
            onUploadImage={() => {
              const newTab = createBlankTab();
              setTabs((prev) => [...prev, newTab]);
              setActiveTabId(newTab.id);
              setShowAiGenerator(true);
            }}
            onImportFigma={() => {
              setFigmaImportMode("new-project");
              setShowFigmaModal(true);
            }}
            onShareProject={async (projectId, onCopied) => {
              // Resolve the cloud project: projectId may be a cloud project UUID
              // (cloud-only entry) or a tab.id (cloud-backed tab). Try both.
              let project = cloudProjects.find((p) => p.id === projectId);
              if (!project) {
                const tab = tabs.find((t) => t.id === projectId);
                if (tab?.cloudProjectId) {
                  project = cloudProjects.find(
                    (p) => p.id === tab.cloudProjectId,
                  );
                }
              }
              if (!project) {
                toast({
                  title: "Save to cloud first",
                  description: "Save this project to the cloud before sharing it.",
                  variant: "destructive",
                });
                return;
              }

              try {
                let shareUuid = project.shareUuid;

                if (!project.isShareEnabled || !shareUuid) {
                  // Enable sharing via API and get the shareUuid
                  const result = await apiRequest("POST", `/api/projects/${project.id}/share`);
                  const data = await result.json();
                  shareUuid = data.shareUuid;
                  // Refresh the cloud project list so the badge updates
                  queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                }

                if (shareUuid) {
                  const shareUrl = `${window.location.origin}/view/${shareUuid}`;
                  await navigator.clipboard.writeText(shareUrl);
                  onCopied();
                }
              } catch (err) {
                console.error("[Share] Failed to share project:", err);
                toast({
                  title: "Share failed",
                  description: "Could not generate share link. Please try again.",
                  variant: "destructive",
                });
              }
            }}
            onRevokeProjectShare={async (projectId) => {
              // Resolve cloud project — projectId may be a tab.id for
              // cloud-backed tabs or a cloud UUID for cloud-only entries.
              let project = cloudProjects.find((p) => p.id === projectId);
              if (!project) {
                const tab = tabs.find((t) => t.id === projectId);
                if (tab?.cloudProjectId) {
                  project = cloudProjects.find(
                    (p) => p.id === tab.cloudProjectId,
                  );
                }
              }
              if (!project) return;
              try {
                await apiRequest("DELETE", `/api/projects/${project.id}/share`);
                queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                toast({
                  title: "Sharing disabled",
                  description: `"${project.name}" is now private.`,
                });
              } catch (err) {
                console.error("[Share] Failed to revoke share:", err);
                toast({
                  title: "Error",
                  description: "Could not revoke share link. Please try again.",
                  variant: "destructive",
                });
              }
            }}
            onDownloadProject={(projectId) => {
              const tab = tabs.find((t) => t.id === projectId);
              if (tab) {
                try {
                  const tabProjectId =
                    tab.projectUuid ||
                    tab.cloudProjectId?.toString() ||
                    tab.id;
                  const exportData = exportWorkflow(
                    {
                      nodes: tab.nodes,
                      edges: tab.edges,
                      canvasObjects: tab.canvasObjects,
                      viewport: tab.viewport,
                      sketchStrokes: tab.sketchStrokes,
                    },
                    {
                      name: tab.name,
                      description: tab.metadata?.description,
                    },
                    {
                      projectId: tabProjectId,
                      includeDocumentation: true,
                      workflowNames: Object.fromEntries(
                        tabs.map((t) => [t.id, t.name]),
                      ),
                      projectDescription: tab.metadata?.description,
                    },
                  );
                  const safeFileName = `${tab.name.replace(/\s+/g, "-").toLowerCase()}.kiteframe`;
                  downloadWorkflow(exportData, safeFileName);
                  toast({
                    title: "Downloaded",
                    description: `"${tab.name}" has been downloaded as .kiteframe`,
                  });
                } catch (err) {
                  console.error("[Export] Project download failed:", err);
                  toast({
                    title: "Download Failed",
                    description: "Could not download project.",
                    variant: "destructive",
                  });
                }
              }
            }}
            onDeleteProject={(projectId) => {
              const tab = tabs.find((t) => t.id === projectId);
              if (tab) {
                setTabs((prev) => prev.filter((t) => t.id !== projectId));
                if (activeTabId === projectId) {
                  const remainingTabs = tabs.filter((t) => t.id !== projectId);
                  if (remainingTabs.length > 0) {
                    setActiveTabId(remainingTabs[0].id);
                  }
                }
                // Also remove from cloud when this tab is cloud-backed so the
                // project doesn't reappear on the next page load.
                if (tab.cloudProjectId) {
                  deleteCloudProject(tab.cloudProjectId);
                }
                toast({
                  title: "Deleted",
                  description: `"${tab.name}" has been deleted.`,
                });
              } else if (hasCloudAccess) {
                // Cloud-only project (not currently open as a tab) — remove
                // directly from the server.
                const cloudProject = cloudProjects.find(
                  (p) => p.id === projectId,
                );
                if (cloudProject) {
                  deleteCloudProject(projectId).then((ok) => {
                    if (ok) {
                      toast({
                        title: "Deleted",
                        description: `"${cloudProject.name}" has been deleted.`,
                      });
                    }
                  });
                }
              }
            }}
            onDuplicateProject={async (projectId) => {
              // projectId may be either a tab ID (local/cloud-backed tab) or a raw
              // cloud project ID (for cloud tiles not currently open as a tab).
              const sourceTab = tabs.find((t) => t.id === projectId);

              // Case 1: local-only tab (tab exists but has no cloud backing) — clone in browser
              if (sourceTab && !sourceTab.cloudProjectId) {
                const copyName = `${sourceTab.name} (Copy)`;
                // Deep-clone to ensure the copy is fully isolated from the source
                const clonedNodes = structuredClone(sourceTab.nodes);
                const clonedEdges = structuredClone(sourceTab.edges);
                const clonedCanvasObjects = structuredClone(sourceTab.canvasObjects);
                const clonedViewport = structuredClone(sourceTab.viewport);
                const clonedMetadata = structuredClone(sourceTab.metadata);
                const newTab: WorkflowTab = {
                  id: generateTabId(),
                  name: copyName,
                  nodes: clonedNodes,
                  edges: clonedEdges,
                  canvasObjects: clonedCanvasObjects,
                  viewport: clonedViewport,
                  selectedNodeId: "",
                  selectedEdgeId: "",
                  history: [
                    {
                      nodes: clonedNodes,
                      edges: clonedEdges,
                      canvasObjects: clonedCanvasObjects,
                      viewport: clonedViewport,
                    },
                  ],
                  historyIndex: 0,
                  showImageModal: null,
                  metadata: {
                    ...clonedMetadata,
                    name: copyName,
                  },
                  flowSettings: structuredClone(sourceTab.flowSettings || {}),
                  sketchStrokes: structuredClone(sourceTab.sketchStrokes ?? []),
                  isOpen: true,
                };
                setTabs((prev) => [...prev, newTab]);
                setActiveTabId(newTab.id);
                toast({
                  title: "Duplicated",
                  description: `"${copyName}" created as a copy.`,
                });
                return;
              }

              // Case 2: tab with cloud backing → use its cloudProjectId for the API call
              // Case 3: no matching tab → projectId is a raw cloud project ID already
              const cloudId = sourceTab?.cloudProjectId ?? projectId;
              try {
                const res = await apiRequest("POST", `/api/projects/${cloudId}/duplicate`);
                const data = await res.json();
                if (!res.ok) {
                  toast({
                    title: "Could not duplicate",
                    description: data.error || "Failed to duplicate project.",
                    variant: "destructive",
                  });
                  return;
                }
                const project = data.project;
                const workflowData = (project.workflowData as any) || {};
                const name = project.name;
                const newTab: WorkflowTab = {
                  id: generateTabId(),
                  name,
                  nodes: workflowData.nodes || [],
                  edges: workflowData.edges || [],
                  canvasObjects: workflowData.canvasObjects || [],
                  viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
                  selectedNodeId: "",
                  selectedEdgeId: "",
                  history: [
                    {
                      nodes: workflowData.nodes || [],
                      edges: workflowData.edges || [],
                      canvasObjects: workflowData.canvasObjects || [],
                      viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
                    },
                  ],
                  historyIndex: 0,
                  showImageModal: null,
                  metadata: {
                    name,
                    description: project.description || "",
                    links: [],
                    linksFormat: "text",
                    categories: [],
                  },
                  flowSettings: workflowData.flowSettings || {},
                  sketchStrokes: workflowData.sketchStrokes ?? [],
                  cloudProjectId: project.id,
                  projectUuid: project.projectUuid || `cloud-${project.id}`,
                  isOpen: true,
                };
                setTabs((prev) => [...prev, newTab]);
                setActiveTabId(newTab.id);
                queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
                toast({
                  title: "Duplicated",
                  description: `"${name}" created as a copy.`,
                });
              } catch {
                toast({
                  title: "Error",
                  description: "Failed to duplicate project.",
                  variant: "destructive",
                });
              }
            }}
            onOpenDesign={openDesignTab}
            isGenerating={generatingWireframe}
            hasCloudAccess={hasCloudAccess}
          />
          
          </>
        ) : activeTab?.interfaceProposalMode ? (
          (() => {
            const srcTab = tabs.find((t) => t.id === activeTab.interfaceProposalSourceTabId);
            return (
              <InterfaceProposalView
                workflowName={srcTab?.name}
                nodes={srcTab?.nodes ?? []}
                edges={srcTab?.edges ?? []}
                isGenerating={isGeneratingInterface}
                onConfirm={async (selectedClusters) => {
                  if (!srcTab) return;
                  const proposalTabId = activeTab.id;
                  const success = await generateInterfaceFromWorkflow(
                    srcTab,
                    selectedClusters.length > 0 ? selectedClusters : null,
                  );
                  if (success) {
                    setTabs((prev) =>
                      prev.map((t) => (t.id === proposalTabId ? { ...t, isOpen: false } : t)),
                    );
                  }
                }}
                onCancel={() => closeTab(activeTab.id)}
              />
            );
          })()
        ) : activeTab?.designId ? (
          <div className="flex flex-col h-full w-full">
            {activeTab.designIsStale && activeTab.designSourceWorkflowId && !effectiveReadOnly && (
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-orange-50 dark:bg-orange-950/40 border-b border-orange-200 dark:border-orange-800 flex-shrink-0">
                <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300">
                  <RefreshCw size={14} className="flex-shrink-0" />
                  <span>The source workflow has been updated. Regenerate to get a fresh interface.</span>
                </div>
                <button
                  disabled={isGeneratingInterface}
                  onClick={async () => {
                    // 1. Try local tab first (already-open workflow)
                    const localSourceTab = tabs.find(
                      (t) => !t.designId && t.cloudProjectId === activeTab.designSourceWorkflowId,
                    );
                    if (localSourceTab) {
                      generateInterfaceFromWorkflow(localSourceTab);
                      return;
                    }
                    // 2. Fallback: fetch the workflow from the server by cloud project ID
                    try {
                      const projRes = await fetch(`/api/projects/${activeTab.designSourceWorkflowId}`, { credentials: "include" });
                      if (projRes.status === 401) { openSignup(); return; }
                      if (!projRes.ok) throw new Error("Project not found");
                      const { project } = await projRes.json();
                      const wfData = project?.workflowData ?? {};
                      const syntheticTab: WorkflowTab = {
                        id: `__fetch_${activeTab.designSourceWorkflowId}`,
                        name: project?.name ?? "Untitled Workflow",
                        nodes: wfData.nodes ?? [],
                        edges: wfData.edges ?? [],
                        canvasObjects: wfData.canvasObjects ?? [],
                        viewport: wfData.viewport ?? { x: 0, y: 0, zoom: 1 },
                        selectedNodeId: "",
                        selectedEdgeId: "",
                        history: [],
                        historyIndex: 0,
                        showImageModal: null,
                        metadata: { name: project?.name ?? "", description: "", links: [], linksFormat: "text", categories: [] },
                        cloudProjectId: activeTab.designSourceWorkflowId,
                        isOpen: false,
                      };
                      generateInterfaceFromWorkflow(syntheticTab);
                    } catch {
                      toast({ title: "Could not load source workflow", description: "The workflow could not be fetched from the server.", variant: "destructive" });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60 transition-colors flex-shrink-0"
                >
                  {isGeneratingInterface
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />
                  }
                  {isGeneratingInterface ? "Generating…" : "Update Interface"}
                </button>
              </div>
            )}
            <DesignTabView
              key={activeTab.designId}
              designId={activeTab.designId}
              onTitleLoaded={(title) => updateActiveTab({ name: title })}
              onNavigateToWorkflow={async (_workflowName) => {
                // 1. Match by cloudProjectId (robust) then fall back to name.
                const sourceId = activeTab.designSourceWorkflowId;
                const match = sourceId
                  ? tabs.find((t) => !t.designId && t.cloudProjectId === sourceId)
                  : null;
                if (match) {
                  setTabs((prev) => prev.map((t) => t.id === match.id ? { ...t, isOpen: true } : t));
                  setActiveTabId(match.id);
                  return;
                }
                // 2. Tab not open — fetch from server and open it.
                if (!sourceId) return;
                try {
                  const projRes = await fetch(`/api/projects/${sourceId}`, { credentials: "include" });
                  if (projRes.status === 401) { openSignup(); return; }
                  if (!projRes.ok) throw new Error("Project not found");
                  const { project } = await projRes.json();
                  const wfData = project?.workflowData ?? {};
                  const newTab: WorkflowTab = {
                    id: generateTabId(),
                    name: project?.name ?? _workflowName ?? "Untitled Workflow",
                    nodes: wfData.nodes ?? [],
                    edges: wfData.edges ?? [],
                    canvasObjects: wfData.canvasObjects ?? [],
                    viewport: wfData.viewport ?? { x: 0, y: 0, zoom: 1 },
                    selectedNodeId: "",
                    selectedEdgeId: "",
                    history: [],
                    historyIndex: 0,
                    showImageModal: null,
                    metadata: { name: project?.name ?? "", description: "", links: [], linksFormat: "text", categories: [] },
                    cloudProjectId: sourceId,
                    isOpen: true,
                  };
                  setTabs((prev) => [...prev, newTab]);
                  setActiveTabId(newTab.id);
                } catch {
                  toast({ title: "Could not open workflow", description: "The source workflow could not be loaded.", variant: "destructive" });
                }
              }}
            />
          </div>
        ) : (
          <>
            {/* Sidebar - takes no space when collapsed, toolbar floats over canvas */}
            {!isPhoneViewOnly && <div
              className={`${isSidebarCollapsed ? "w-0" : "w-64"} border-r border-border flex flex-col transition-all duration-200 ${isSidebarCollapsed ? "overflow-visible" : "overflow-hidden"}`}
            >
              {isSidebarCollapsed ? (
                <div className={`transition-all duration-300${isSketchMode ? ' -translate-x-20 opacity-0 pointer-events-none' : ''}`}><>
                  <CollapsedSidebar
                    toggleSidebar={toggleSidebar}
                    onCreateNode={(type: string) => {
                      // Handle creating canvas objects for text/sticky/shape types
                      if (["text", "sticky", "shape"].includes(type)) {
                        saveToHistory("Add canvas object");

                        let newCanvasObject: CanvasObject;

                        if (type === "text") {
                          newCanvasObject = {
                            id: `object-${Date.now()}`,
                            type: "text",
                            position: getViewportCenteredPosition(),
                            data: {
                              text: "Click to edit text",
                              fontSize: 16,
                              fontFamily: "Inter, system-ui, sans-serif",
                              textColor: "#000000",
                            } as any,
                            width: 200,
                            height: 50,
                            selected: false,
                          };
                        } else if (type === "sticky") {
                          newCanvasObject = {
                            id: `object-${Date.now()}`,
                            type: "sticky",
                            position: getViewportCenteredPosition(),
                            data: {
                              text: "Sticky note...",
                              backgroundColor: "#fef3c7",
                              textColor: "#92400e",
                            } as any,
                            width: 200,
                            height: 150,
                            selected: false,
                          };
                        } else {
                          // shape
                          newCanvasObject = {
                            id: `object-${Date.now()}`,
                            type: "shape",
                            position: getViewportCenteredPosition(),
                            data: {
                              shapeType: "rectangle",
                              fillColor: "#3b82f6",
                              fillOpacity: 0.5,
                              fillStyle: "solid",
                              strokeColor: "#3b82f6",
                              strokeOpacity: 1.0,
                              strokeWidth: 2,
                              strokeStyle: "solid",
                              opacity: 1,
                            } as any,
                            width: 150,
                            height: 100,
                            selected: false,
                          };
                        }

                        updateActiveTab({
                          canvasObjects: [...canvasObjects, newCanvasObject],
                        });
                        return;
                      }

                      // Handle actual node creation for table/form types
                      if (["table", "form"].includes(type)) {
                        if (openTabs.length === 0) {
                          const newTab = createBlankTab();
                          setTabs((prev) => [...prev, newTab]);
                          setActiveTabId(newTab.id);
                        }

                        const nodeId = `node-${Date.now()}`;
                        const isTableNode = type === "table";
                        const isFormNode = type === "form";
                        const tableId = isTableNode
                          ? `table-${nodeId}`
                          : undefined;

                        const getNodeData = () => {
                          if (isTableNode) {
                            return {
                              label: "Table",
                              tableId,
                              previewRowCount: 3,
                              previewColumnCount: 4,
                              showRowNumbers: true,
                              colors: {
                                headerBackground: "#4f46e5",
                                bodyBackground: "#ffffff",
                                headerTextColor: "#ffffff",
                                bodyTextColor: "#374151",
                              },
                            };
                          }
                          if (isFormNode) {
                            return {
                              label: "Form",
                              formTitle: "Form",
                              fields: [],
                              showLabels: true,
                              layout: "vertical",
                              colors: {
                                headerBackground: "#6366f1",
                                bodyBackground: "#ffffff",
                                borderColor: "#818cf8",
                                headerTextColor: "#ffffff",
                              },
                            };
                          }
                          return {};
                        };

                        const isImageNode = type === "image";
                        const getNodeDimensions = () => {
                          if (isTableNode) return { width: 560, height: 400 };
                          if (isFormNode) return { width: 320, height: 200 };
                          if (isImageNode) return { width: 240, height: 240 };
                          return { width: 200, height: 100 };
                        };

                        const dimensions = getNodeDimensions();
                        const newNode: Node = {
                          id: nodeId,
                          type,
                          position: getViewportCenteredPosition(),
                          data: getNodeData(),
                          width: dimensions.width,
                          height: dimensions.height,
                          style: dimensions,
                          resizable: true,
                        };

                        saveToHistory("Add node");
                        setNodes((prev) => [...prev, newNode]);

                        toast({
                          title: "Node Added",
                          description: `${newNode.data.label} added to canvas`,
                          variant: "default",
                        });
                      }
                    }}
                    onCreateNodeAtPosition={(
                      type: string,
                      position: { x: number; y: number },
                    ) => {
                      // Handle position-based creation from drag-and-drop for canvas objects
                      if (["text", "sticky", "shape"].includes(type)) {
                        saveToHistory("Add canvas object");

                        let newCanvasObject: CanvasObject;

                        if (type === "text") {
                          newCanvasObject = {
                            id: `object-${Date.now()}`,
                            type: "text",
                            position,
                            data: {
                              text: "Click to edit text",
                              fontSize: 16,
                              fontFamily: "Inter, system-ui, sans-serif",
                              textColor: "#000000",
                            } as any,
                            width: 200,
                            height: 50,
                            selected: false,
                          };
                        } else if (type === "sticky") {
                          newCanvasObject = {
                            id: `object-${Date.now()}`,
                            type: "sticky",
                            position,
                            data: {
                              text: "Sticky note...",
                              backgroundColor: "#fef3c7",
                              textColor: "#92400e",
                            } as any,
                            width: 200,
                            height: 150,
                            selected: false,
                          };
                        } else {
                          // shape
                          newCanvasObject = {
                            id: `object-${Date.now()}`,
                            type: "shape",
                            position,
                            data: {
                              shapeType: "rectangle",
                              fillColor: "#3b82f6",
                              fillOpacity: 0.5,
                              fillStyle: "solid",
                              strokeColor: "#3b82f6",
                              strokeOpacity: 1.0,
                              strokeWidth: 2,
                              strokeStyle: "solid",
                              opacity: 1,
                            } as any,
                            width: 150,
                            height: 100,
                            selected: false,
                          };
                        }

                        updateActiveTab({
                          canvasObjects: [...canvasObjects, newCanvasObject],
                        });
                        return;
                      }

                      // Handle actual node creation for table/form types at position
                      if (["table", "form"].includes(type)) {
                        if (openTabs.length === 0) {
                          const newTab = createBlankTab();
                          setTabs((prev) => [...prev, newTab]);
                          setActiveTabId(newTab.id);
                        }

                        const nodeId = `node-${Date.now()}`;
                        const isTableNode = type === "table";
                        const isFormNode = type === "form";
                        const tableId = isTableNode
                          ? `table-${nodeId}`
                          : undefined;

                        const getNodeData = () => {
                          if (isTableNode) {
                            return {
                              label: "Table",
                              tableId,
                              previewRowCount: 3,
                              previewColumnCount: 4,
                              showRowNumbers: true,
                              colors: {
                                headerBackground: "#4f46e5",
                                bodyBackground: "#ffffff",
                                headerTextColor: "#ffffff",
                                bodyTextColor: "#374151",
                              },
                            };
                          }
                          if (isFormNode) {
                            return {
                              label: "Form",
                              formTitle: "Form",
                              fields: [],
                              showLabels: true,
                              layout: "vertical",
                              colors: {
                                headerBackground: "#6366f1",
                                bodyBackground: "#ffffff",
                                borderColor: "#818cf8",
                                headerTextColor: "#ffffff",
                              },
                            };
                          }
                          return {};
                        };

                        const isImageNode = type === "image";
                        const getNodeDimensions = () => {
                          if (isTableNode) return { width: 560, height: 400 };
                          if (isFormNode) return { width: 320, height: 200 };
                          if (isImageNode) return { width: 240, height: 240 };
                          return { width: 200, height: 100 };
                        };

                        const dimensions = getNodeDimensions();
                        const newNode: Node = {
                          id: nodeId,
                          type,
                          position,
                          data: getNodeData(),
                          width: dimensions.width,
                          height: dimensions.height,
                          style: dimensions,
                          resizable: true,
                        };

                        saveToHistory("Add node");
                        setNodes((prev) => [...prev, newNode]);

                        toast({
                          title: "Node Added",
                          description: `${newNode.data.label} added to canvas`,
                          variant: "default",
                        });
                      }
                    }}
                    onFitView={() => {
                      if (nodes.length === 0) {
                        setViewport({ x: 0, y: 0, zoom: 1 });
                        return;
                      }
                      // Implement fit view logic here or use existing implementation
                    }}
                    onClearCanvas={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to clear the canvas? This will remove all nodes and edges.",
                        )
                      ) {
                        saveToHistory("Clear canvas");
                        setNodes([]);
                        setEdges([]);
                        updateActiveTab({ canvasObjects: [] });
                      }
                    }}
                    onExport={() => {
                      try {
                        const exportData = exportWorkflow(
                          { nodes, edges, canvasObjects, viewport, sketchStrokes },
                          {
                            name: activeTab?.name || "My Workflow",
                            description:
                              activeTab?.metadata?.description || "",
                          },
                          {
                            projectId: projectIdentifier,
                            includeDocumentation: true,
                            workflowNames: Object.fromEntries(
                              tabs.map((t) => [t.id, t.name]),
                            ),
                            projectDescription:
                              activeTab?.metadata?.description,
                          },
                        );
                        const safeFileName = `${(activeTab?.name || "workflow").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.kiteframe`;
                        downloadWorkflow(exportData, safeFileName);
                        toast({
                          title: "Workflow Exported",
                          description: `"${activeTab?.name || "Workflow"}" exported with all content and documentation`,
                        });
                      } catch (err) {
                        console.error("[Export] Toolbar export failed:", err);
                        toast({
                          title: "Export Failed",
                          description: "Could not export workflow.",
                          variant: "destructive",
                        });
                      }
                    }}
                    onImport={() => setShowImportModal(true)}
                    onShare={() => setShowShareModal(true)}
                    onOpenAiGenerator={() => setShowAiGenerator(true)}
                    onUploadImage={() => {
                      if (!isAdvanced && !isAdmin) {
                        setFeatureUpsell({
                          featureName: 'Image to Workflow',
                          requiredTier: 'advanced',
                          description: 'Convert diagrams and photos into interactive workflows using AI vision. Upgrade to Advanced or Pro to use this feature.',
                        });
                        return;
                      }
                      setShowImageAnalysisModal(true);
                    }}
                    onImportFigma={() => setShowFigmaModal(true)}
                    onCreateTemplate={(templateType: string) => {
                      // Create a new tab if none are open
                      if (openTabs.length === 0) {
                        const newTab = createBlankTab();
                        setTabs((prev) => [...prev, newTab]);
                        setActiveTabId(newTab.id);
                        // Wait for the tab to be created before adding the template
                        setTimeout(() => {
                          handleAddTemplateToCurrentTab(templateType);
                        }, 50);
                        return;
                      }

                      // Template generation at center (same logic as expanded sidebar)
                      handleAddTemplateToCurrentTab(templateType);
                    }}
                    onCreateTemplateAtPosition={(
                      templateType: string,
                      position: { x: number; y: number },
                    ) => {
                      // Create a new tab if none are open
                      if (openTabs.length === 0) {
                        const newTab = createBlankTab();
                        setTabs((prev) => [...prev, newTab]);
                        setActiveTabId(newTab.id);
                        // Wait for the tab to be created before adding the template
                        setTimeout(() => {
                          handleAddTemplateToCurrentTab(templateType, position);
                        }, 50);
                        return;
                      }

                      // Template generation at specific position from drag-and-drop
                      handleAddTemplateToCurrentTab(templateType, position);
                    }}
                    onApplyTheme={(theme) => {
                      // Update current theme state
                      setCurrentTheme(theme);
                      localStorage.setItem("workflow-theme", theme.id);

                      saveToHistory("Apply theme");

                      // Apply theme to all nodes using the enhanced helper function
                      setNodes((prev) =>
                        prev.map((node) => ({
                          ...node,
                          data: applyThemeToNode(node.data, theme),
                        })),
                      );

                      // Apply theme to all edges using the enhanced helper function
                      setEdges((prev) =>
                        prev.map((edge) => applyThemeToEdge(edge, theme)),
                      );
                    }}
                    activePopout={activePopout}
                    setActivePopout={setActivePopout}
                    sidebarIcons={sidebarIcons}
                    viewport={viewport}
                    isExpanded={isToolbarExpanded}
                    onToggleExpanded={() =>
                      setIsToolbarExpanded((prev) => !prev)
                    }
                    onShowKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
                    onEnterSketchMode={() => { setIsSketchMode(true); setSketchColor('#000000'); setSketchTool('pen'); }}
                  />

                  {/* Node Types Popout */}
                  <NodeTypesPopout
                    isOpen={activePopout === "node-types"}
                    onClose={() => setActivePopout(null)}
                    viewport={viewport}
                    isToolbarExpanded={isToolbarExpanded}
                    onCreateNode={(type: string) => {
                      // Handle regular node creation from popout
                      if (openTabs.length === 0) {
                        const newTab = createBlankTab();
                        setTabs((prev) => [...prev, newTab]);
                        setActiveTabId(newTab.id);
                      }

                      const icons = {
                        input: { icon: "ArrowRight", color: "text-blue-500" },
                        process: { icon: "Cog", color: "text-green-500" },
                        condition: {
                          icon: "HelpCircle",
                          color: "text-yellow-500",
                        },
                        output: { icon: "ArrowLeft", color: "text-red-500" },
                        ai: { icon: "Bot", color: "text-purple-500" },
                        image: { icon: "Image", color: "text-indigo-500" },
                        table: { icon: "Table2", color: "text-indigo-500" },
                        compound: { icon: "Layers", color: "text-emerald-500" },
                      };

                      const nodeId = `node-${Date.now()}`;
                      const isTableNode = type === "table";
                      const isFormNode = type === "form";
                      const isCompoundNode = type === "compound";
                      const isImageNode = type === "image";
                      const isCodeNode = type === "code";
                      const tableId = isTableNode
                        ? `table-${nodeId}`
                        : undefined;

                      const getNodeData = () => {
                        if (isTableNode) {
                          return {
                            label: "Table",
                            tableId,
                            previewRowCount: 3,
                            previewColumnCount: 4,
                            showRowNumbers: true,
                            colors: {
                              headerBackground: "#4f46e5",
                              bodyBackground: "#ffffff",
                              headerTextColor: "#ffffff",
                              bodyTextColor: "#374151",
                            },
                          };
                        }
                        if (isFormNode) {
                          return {
                            label: "Form",
                            formTitle: "Form",
                            fields: [],
                            showLabels: true,
                            layout: "vertical",
                            colors: {
                              headerBackground: "#6366f1",
                              bodyBackground: "#ffffff",
                              borderColor: "#818cf8",
                              headerTextColor: "#ffffff",
                            },
                          };
                        }
                        if (isCompoundNode) {
                          return {
                            label: "Compound",
                            description: "",
                            subcomponents: [],
                            containerPadding: 12,
                            gap: 8,
                            colors: {
                              headerBackground: "#059669",
                              bodyBackground: "#ffffff",
                              borderColor: "#10b981",
                              headerTextColor: "#ffffff",
                            },
                          };
                        }
                        if (isCodeNode) {
                          return {
                            label: "Code",
                            code: "",
                            language: "javascript",
                            showOutput: true,
                            outputHeight: 120,
                            colors: {
                              headerBackground: "#1e1e1e",
                              bodyBackground: "#252526",
                              headerTextColor: "#d4d4d4",
                            },
                          };
                        }
                        return {
                          label:
                            type === "image"
                              ? "Image"
                              : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                          description: `Configure ${type} settings`,
                          icon:
                            icons[type as keyof typeof icons]?.icon ||
                            "fas fa-cube",
                          iconColor:
                            icons[type as keyof typeof icons]?.color ||
                            "text-gray-500",
                        };
                      };

                      const getNodeDimensions = () => {
                        if (isTableNode) return { width: 560, height: 400 };
                        if (isFormNode) return { width: 320, height: 200 };
                        if (isCompoundNode) return { width: 320, height: 280 };
                        if (isImageNode) return { width: 240, height: 240 };
                        if (isCodeNode) return { width: 400, height: 350 };
                        return { width: 200, height: 100 };
                      };

                      const dimensions = getNodeDimensions();
                      const newNode: Node = {
                        id: nodeId,
                        type,
                        position: getViewportCenteredPosition(),
                        data: getNodeData(),
                        width: dimensions.width,
                        height: dimensions.height,
                        style:
                          isTableNode ||
                          isFormNode ||
                          isCompoundNode ||
                          isImageNode ||
                          isCodeNode
                            ? dimensions
                            : undefined,
                        resizable:
                          isTableNode ||
                          isFormNode ||
                          isCompoundNode ||
                          isImageNode ||
                          isCodeNode
                            ? true
                            : undefined,
                      };

                      saveToHistory("Add node");
                      setNodes((prev) => [...prev, newNode]);

                      // Toast notification for node creation
                      toast({
                        title: "Node Added",
                        description: `${newNode.data.label} added to canvas`,
                        variant: "default",
                      });
                    }}
                    onCreateNodeAtPosition={(
                      type: string,
                      position: { x: number; y: number },
                    ) => {
                      // Handle drag-and-drop node creation from popout
                      if (openTabs.length === 0) {
                        const newTab = createBlankTab();
                        setTabs((prev) => [...prev, newTab]);
                        setActiveTabId(newTab.id);
                      }

                      const icons = {
                        input: { icon: "ArrowRight", color: "text-blue-500" },
                        process: { icon: "Cog", color: "text-green-500" },
                        condition: {
                          icon: "HelpCircle",
                          color: "text-yellow-500",
                        },
                        output: { icon: "ArrowLeft", color: "text-red-500" },
                        ai: { icon: "Bot", color: "text-purple-500" },
                        image: { icon: "Image", color: "text-indigo-500" },
                        table: { icon: "Table2", color: "text-indigo-500" },
                        compound: { icon: "Layers", color: "text-emerald-500" },
                      };

                      const nodeId = `node-${Date.now()}`;
                      const isTableNode = type === "table";
                      const isFormNode = type === "form";
                      const isCompoundNode = type === "compound";
                      const isImageNode = type === "image";
                      const isCodeNode = type === "code";
                      const tableId = isTableNode
                        ? `table-${nodeId}`
                        : undefined;

                      const getNodeData = () => {
                        if (isTableNode) {
                          return {
                            label: "Table",
                            tableId,
                            previewRowCount: 3,
                            previewColumnCount: 4,
                            showRowNumbers: true,
                            colors: {
                              headerBackground: "#4f46e5",
                              bodyBackground: "#ffffff",
                              headerTextColor: "#ffffff",
                              bodyTextColor: "#374151",
                            },
                          };
                        }
                        if (isFormNode) {
                          return {
                            label: "Form",
                            formTitle: "Form",
                            fields: [],
                            showLabels: true,
                            layout: "vertical",
                            colors: {
                              headerBackground: "#6366f1",
                              bodyBackground: "#ffffff",
                              borderColor: "#818cf8",
                              headerTextColor: "#ffffff",
                            },
                          };
                        }
                        if (isCompoundNode) {
                          return {
                            label: "Compound",
                            description: "",
                            subcomponents: [],
                            containerPadding: 12,
                            gap: 8,
                            colors: {
                              headerBackground: "#059669",
                              bodyBackground: "#ffffff",
                              borderColor: "#10b981",
                              headerTextColor: "#ffffff",
                            },
                          };
                        }
                        if (isCodeNode) {
                          return {
                            label: "Code",
                            code: "",
                            language: "javascript",
                            showOutput: true,
                            outputHeight: 120,
                            colors: {
                              headerBackground: "#1e1e1e",
                              bodyBackground: "#252526",
                              headerTextColor: "#d4d4d4",
                            },
                          };
                        }
                        return {
                          label:
                            type === "image"
                              ? "Image"
                              : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                          description: `Configure ${type} settings`,
                          icon:
                            icons[type as keyof typeof icons]?.icon ||
                            "fas fa-cube",
                          iconColor:
                            icons[type as keyof typeof icons]?.color ||
                            "text-gray-500",
                        };
                      };

                      const getNodeDimensions = () => {
                        if (isTableNode) return { width: 560, height: 400 };
                        if (isFormNode) return { width: 320, height: 200 };
                        if (isCompoundNode) return { width: 320, height: 280 };
                        if (isImageNode) return { width: 240, height: 240 };
                        if (isCodeNode) return { width: 400, height: 350 };
                        return { width: 200, height: 100 };
                      };

                      const dimensions = getNodeDimensions();
                      const newNode: Node = {
                        id: nodeId,
                        type,
                        position,
                        data: getNodeData(),
                        width: dimensions.width,
                        height: dimensions.height,
                        style:
                          isTableNode ||
                          isFormNode ||
                          isCompoundNode ||
                          isImageNode ||
                          isCodeNode
                            ? dimensions
                            : undefined,
                        resizable:
                          isTableNode ||
                          isFormNode ||
                          isCompoundNode ||
                          isImageNode ||
                          isCodeNode
                            ? true
                            : undefined,
                      };

                      saveToHistory("Add node");
                      setNodes((prev) => [...prev, newNode]);

                      // Toast notification for node creation
                      toast({
                        title: "Node Added",
                        description: `${newNode.data.label} added to canvas`,
                        variant: "default",
                      });
                    }}
                  />

                  {/* Shapes Popout */}
                  <ShapesPopout
                    isOpen={activePopout === "shapes"}
                    onClose={() => setActivePopout(null)}
                    viewport={viewport}
                    isToolbarExpanded={isToolbarExpanded}
                    onCreateShape={(shapeType: string) => {
                      saveToHistory("Add shape");

                      // Build shape data with polygon-specific initialization if needed
                      const shapeData = {
                        ...DEFAULT_SHAPE_NODE_DATA,
                        shapeType,
                        ...(shapeType === "polygon"
                          ? {
                              points: [],
                              isClosed: false,
                              isCreating: true,
                            }
                          : {}),
                      };

                      const newCanvasObject: CanvasObject = {
                        id: `object-${Date.now()}`,
                        type: "shape",
                        position: getViewportCenteredPosition(),
                        data: shapeData as any,
                        width: shapeType === "polygon" ? 300 : 200, // Larger size for polygon creation
                        height:
                          shapeType === "polygon"
                            ? 300
                            : shapeType === "rectangle"
                              ? 200
                              : 100,
                        selected: shapeType === "polygon", // Auto-select polygon for immediate creation mode
                      };

                      updateActiveTab({
                        canvasObjects: [...canvasObjects, newCanvasObject],
                      });

                      // Toast notification for shape creation
                      toast({
                        title: "Shape Added",
                        description: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} shape added to canvas`,
                        variant: "default",
                      });
                    }}
                    onCreateShapeAtPosition={(
                      shapeType: string,
                      position: { x: number; y: number },
                    ) => {
                      saveToHistory("Add shape");

                      // Build shape data with polygon-specific initialization if needed
                      const shapeData = {
                        ...DEFAULT_SHAPE_NODE_DATA,
                        shapeType,
                        ...(shapeType === "polygon"
                          ? {
                              points: [],
                              isClosed: false,
                              isCreating: true,
                            }
                          : {}),
                      };

                      const newCanvasObject: CanvasObject = {
                        id: `object-${Date.now()}`,
                        type: "shape",
                        position, // Use the provided position instead of center
                        data: shapeData as any,
                        width: shapeType === "polygon" ? 300 : 200, // Larger size for polygon creation
                        height:
                          shapeType === "polygon"
                            ? 300
                            : shapeType === "rectangle"
                              ? 200
                              : 100,
                        selected: shapeType === "polygon", // Auto-select polygon for immediate creation mode
                      };

                      updateActiveTab({
                        canvasObjects: [...canvasObjects, newCanvasObject],
                      });

                      // Toast notification for shape creation
                      toast({
                        title: "Shape Added",
                        description: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} shape added to canvas`,
                        variant: "default",
                      });
                    }}
                  />
                </>
                </div>
              ) : (
                <Sidebar
                  selectedNode={nodes.find((n) => n.id === selectedNodeId)}
                  selectedNodes={nodes.filter((n) => n.selected)}
                  selectedEdge={edges.find((e) => e.id === selectedEdgeId)}
                  nodes={nodes}
                  onToggleSidebar={toggleSidebar}
                  onEnterSketchMode={() => { setIsSketchMode(true); setSketchColor('#000000'); setSketchTool('pen'); }}
                  onCreateNode={(type: string) => {
                    // Create a new tab if none are open (Sidebar handler)
                    if (openTabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs((prev) => [...prev, newTab]);
                      setActiveTabId(newTab.id);
                      // Wait for the tab to be created before adding the node
                      setTimeout(() => {
                        const icons = {
                          input: { icon: "ArrowRight", color: "text-blue-500" },
                          process: { icon: "Cog", color: "text-green-500" },
                          condition: {
                            icon: "HelpCircle",
                            color: "text-yellow-500",
                          },
                          output: { icon: "ArrowLeft", color: "text-red-500" },
                          ai: { icon: "Bot", color: "text-purple-500" },
                          image: { icon: "Image", color: "text-indigo-500" },
                          table: { icon: "Table2", color: "text-indigo-500" },
                          compound: {
                            icon: "Layers",
                            color: "text-emerald-500",
                          },
                        };

                        const nodeId = `node-${Date.now()}`;
                        const isTableNode = type === "table";
                        const isFormNode = type === "form";
                        const isCompoundNode = type === "compound";
                        const tableId = isTableNode
                          ? `table-${nodeId}`
                          : undefined;

                        const getNodeData = () => {
                          if (isTableNode) {
                            return {
                              label: "Table",
                              tableId,
                              previewRowCount: 3,
                              previewColumnCount: 4,
                              showRowNumbers: true,
                              colors: {
                                headerBackground: "#4f46e5",
                                bodyBackground: "#ffffff",
                                headerTextColor: "#ffffff",
                                bodyTextColor: "#374151",
                              },
                            };
                          }
                          if (isFormNode) {
                            return {
                              label: "Form",
                              formTitle: "Form",
                              fields: [],
                              showLabels: true,
                              layout: "vertical",
                              colors: {
                                headerBackground: "#6366f1",
                                bodyBackground: "#ffffff",
                                borderColor: "#818cf8",
                                headerTextColor: "#ffffff",
                              },
                            };
                          }
                          if (isCompoundNode) {
                            return {
                              label: "Compound",
                              description: "",
                              subcomponents: [],
                              containerPadding: 12,
                              gap: 8,
                              colors: {
                                headerBackground: "#059669",
                                bodyBackground: "#ffffff",
                                borderColor: "#10b981",
                                headerTextColor: "#ffffff",
                              },
                            };
                          }
                          return {
                            label:
                              type === "image"
                                ? "Image"
                                : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                            description: `Configure ${type} settings`,
                            icon:
                              icons[type as keyof typeof icons]?.icon ||
                              "fas fa-cube",
                            iconColor:
                              icons[type as keyof typeof icons]?.color ||
                              "text-gray-500",
                          };
                        };

                        const isImageNode = type === "image";
                        const getNodeDimensions = () => {
                          if (isTableNode) return { width: 560, height: 400 };
                          if (isFormNode) return { width: 320, height: 200 };
                          if (isCompoundNode)
                            return { width: 320, height: 280 };
                          if (isImageNode) return { width: 240, height: 240 };
                          return { width: 200, height: 100 };
                        };

                        const dimensions = getNodeDimensions();
                        const newNode: Node = {
                          id: nodeId,
                          type,
                          position: getViewportCenteredPosition(),
                          data: getNodeData(),
                          width: dimensions.width,
                          height: dimensions.height,
                          style:
                            isTableNode ||
                            isFormNode ||
                            isCompoundNode ||
                            isImageNode
                              ? dimensions
                              : undefined,
                          resizable:
                            isTableNode ||
                            isFormNode ||
                            isCompoundNode ||
                            isImageNode
                              ? true
                              : undefined,
                        };

                        saveToHistory("Add node");
                        setNodes([newNode]);
                      }, 0);
                      return;
                    }

                    // For types like 'text', 'sticky', 'shape', create canvas objects instead of nodes
                    if (["text", "sticky", "shape"].includes(type)) {
                      saveToHistory("Add canvas object"); // Save current state before adding canvas object

                      let newCanvasObject: CanvasObject;

                      if (type === "text") {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: "text",
                          position: getViewportCenteredPosition(),
                          data: {
                            text: "Click to edit text",
                            fontSize: 16,
                            fontFamily: "Inter, system-ui, sans-serif",
                            textColor: "#000000",
                          } as any,
                          style: { width: 200, height: 100 },
                          width: 200,
                          height: 100,
                          draggable: true,
                          resizable: true,
                        };
                      } else if (type === "sticky") {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: "sticky",
                          position: getViewportCenteredPosition(),
                          data: {
                            text: "Your note here...",
                            backgroundColor: "#fef3c7",
                            textColor: "#92400e",
                            fontSize: 14,
                            fontFamily: "Inter, system-ui, sans-serif",
                          } as any,
                          style: { width: 180, height: 180 },
                          width: 180,
                          height: 180,
                          draggable: true,
                          resizable: true,
                        };
                      } else {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: "shape",
                          position: getViewportCenteredPosition(),
                          data: {
                            shapeType: "rectangle",
                            fillColor: "#3b82f6",
                            fillOpacity: 0.5,
                            fillStyle: "solid",
                            strokeColor: "#3b82f6",
                            strokeOpacity: 1.0,
                            strokeWidth: 2,
                            strokeStyle: "solid",
                            opacity: 1,
                          } as any,
                          style: { width: 200, height: 100 },
                          width: 200,
                          height: 100,
                          draggable: true,
                          resizable: true,
                        };
                      }

                      // Add to canvas objects instead of regular nodes
                      const currentCanvasObjects =
                        activeTab?.canvasObjects || [];
                      updateActiveTab({
                        canvasObjects: [
                          ...currentCanvasObjects,
                          newCanvasObject,
                        ],
                      });

                      // Toast notification for canvas object creation
                      const objectTypeLabel =
                        type === "text"
                          ? "Text object"
                          : type === "sticky"
                            ? "Sticky note"
                            : "Shape";
                      toast({
                        title: `${objectTypeLabel} Added`,
                        description: `${objectTypeLabel} added to canvas`,
                        variant: "default",
                      });
                      return;
                    }

                    // Normal case - add to existing tab (for input, process, condition, output, ai, image, table, form, compound)
                    saveToHistory("Add node"); // Save current state before adding node
                    const icons = {
                      input: { icon: "ArrowRight", color: "text-blue-500" },
                      process: { icon: "Cog", color: "text-green-500" },
                      condition: {
                        icon: "HelpCircle",
                        color: "text-yellow-500",
                      },
                      output: { icon: "ArrowLeft", color: "text-red-500" },
                      ai: { icon: "Bot", color: "text-purple-500" },
                      image: { icon: "Image", color: "text-indigo-500" },
                      table: { icon: "Table2", color: "text-indigo-500" },
                      compound: { icon: "Layers", color: "text-emerald-500" },
                    };

                    const nodeId = `node-${Date.now()}`;
                    const isTableNode = type === "table";
                    const isFormNode = type === "form";
                    const isCompoundNode = type === "compound";
                    const isExperimentNode = type === "experiment";
                    const tableId = isTableNode ? `table-${nodeId}` : undefined;

                    const getNodeData = () => {
                      if (isExperimentNode) {
                        return {
                          label: "Experiment",
                          mode: 'whatif' as const,
                          anchor: {
                            workflowId: activeTab?.id || 'default',
                          },
                          generation: {
                            status: 'idle' as const,
                            generatedNodeIds: [],
                            generatedEdgeIds: [],
                          },
                          ui: { preview: false },
                        };
                      }
                      if (isTableNode) {
                        return {
                          label: "Table",
                          tableId,
                          previewRowCount: 3,
                          previewColumnCount: 4,
                          showRowNumbers: true,
                          colors: {
                            headerBackground: "#4f46e5",
                            bodyBackground: "#ffffff",
                            headerTextColor: "#ffffff",
                            bodyTextColor: "#374151",
                          },
                        };
                      }
                      if (isFormNode) {
                        return {
                          label: "Form",
                          formTitle: "Form",
                          fields: [],
                          showLabels: true,
                          layout: "vertical",
                          colors: {
                            headerBackground: "#6366f1",
                            bodyBackground: "#ffffff",
                            borderColor: "#818cf8",
                            headerTextColor: "#ffffff",
                          },
                        };
                      }
                      if (isCompoundNode) {
                        return {
                          label: "Compound",
                          description: "",
                          subcomponents: [],
                          containerPadding: 12,
                          gap: 8,
                          colors: {
                            headerBackground: "#059669",
                            bodyBackground: "#ffffff",
                            borderColor: "#10b981",
                            headerTextColor: "#ffffff",
                          },
                        };
                      }
                      return {
                        label:
                          type === "image"
                            ? "Image"
                            : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                        description: `Configure ${type} settings`,
                        icon:
                          icons[type as keyof typeof icons]?.icon ||
                          "fas fa-cube",
                        iconColor:
                          icons[type as keyof typeof icons]?.color ||
                          "text-gray-500",
                      };
                    };

                    const isImageNode = type === "image";
                    const getNodeDimensions = () => {
                      if (isTableNode) return { width: 560, height: 400 };
                      if (isFormNode) return { width: 320, height: 200 };
                      if (isCompoundNode) return { width: 320, height: 280 };
                      if (isImageNode) return { width: 240, height: 240 };
                      return { width: 200, height: 100 };
                    };

                    const dimensions = getNodeDimensions();
                    const newNode: Node = {
                      id: nodeId,
                      type,
                      position: getViewportCenteredPosition(),
                      data: getNodeData(),
                      width: dimensions.width,
                      height: dimensions.height,
                      style:
                        isTableNode ||
                        isFormNode ||
                        isCompoundNode ||
                        isImageNode
                          ? dimensions
                          : undefined,
                      resizable:
                        isTableNode ||
                        isFormNode ||
                        isCompoundNode ||
                        isImageNode
                          ? true
                          : undefined,
                    };

                    setNodes((prev) => [...prev, newNode]);

                    // Toast notification for node creation
                    toast({
                      title: "Node Added",
                      description: `${newNode.data.label} added to canvas`,
                      variant: "default",
                    });
                  }}
                  onCreateNodeAtPosition={(
                    type: string,
                    position: { x: number; y: number },
                  ) => {
                    // Create a new tab if none are open
                    if (openTabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs((prev) => [...prev, newTab]);
                      setActiveTabId(newTab.id);
                      return;
                    }

                    // Convert screen position to world position (using same logic as getViewportCenteredPosition)
                    const worldPosition = {
                      x: Math.round((position.x - viewport.x) / viewport.zoom),
                      y: Math.round((position.y - viewport.y) / viewport.zoom),
                    };

                    // For canvas objects (text, sticky, shape)
                    if (["text", "sticky", "shape"].includes(type)) {
                      saveToHistory("Add canvas object");

                      let newCanvasObject: CanvasObject;

                      if (type === "text") {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: "text",
                          position: worldPosition,
                          data: {
                            text: "Click to edit text",
                            fontSize: 16,
                            fontFamily: "Inter, system-ui, sans-serif",
                            textColor: "#000000",
                          } as any,
                          style: { width: 200, height: 100 },
                          width: 200,
                          height: 100,
                          draggable: true,
                          resizable: true,
                        };
                      } else if (type === "sticky") {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: "sticky",
                          position: worldPosition,
                          data: {
                            text: "Your note here...",
                            backgroundColor: "#fef3c7",
                            textColor: "#92400e",
                            fontSize: 14,
                            fontFamily: "Inter, system-ui, sans-serif",
                          } as any,
                          style: { width: 180, height: 180 },
                          width: 180,
                          height: 180,
                          draggable: true,
                          resizable: true,
                        };
                      } else {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: "shape",
                          position: worldPosition,
                          data: {
                            shapeType: "rectangle",
                            fillColor: "#3b82f6",
                            fillOpacity: 0.5,
                            fillStyle: "solid",
                            strokeColor: "#3b82f6",
                            strokeOpacity: 1.0,
                            strokeWidth: 2,
                            strokeStyle: "solid",
                            opacity: 1,
                          } as any,
                          style: { width: 200, height: 100 },
                          width: 200,
                          height: 100,
                          draggable: true,
                          resizable: true,
                        };
                      }

                      const currentCanvasObjects =
                        activeTab?.canvasObjects || [];
                      updateActiveTab({
                        canvasObjects: [
                          ...currentCanvasObjects,
                          newCanvasObject,
                        ],
                      });

                      // Toast notification for canvas object creation
                      const objectTypeLabel =
                        type === "text"
                          ? "Text object"
                          : type === "sticky"
                            ? "Sticky note"
                            : "Shape";
                      toast({
                        title: `${objectTypeLabel} Added`,
                        description: `${objectTypeLabel} added to canvas`,
                        variant: "default",
                      });
                      return;
                    }

                    // For regular nodes (input, process, condition, output, ai, image, table, form, compound)
                    saveToHistory("Add node");

                    const icons = {
                      input: { icon: "ArrowRight", color: "text-blue-500" },
                      process: { icon: "Cog", color: "text-green-500" },
                      condition: {
                        icon: "HelpCircle",
                        color: "text-yellow-500",
                      },
                      output: { icon: "ArrowLeft", color: "text-red-500" },
                      ai: { icon: "Bot", color: "text-purple-500" },
                      image: { icon: "Image", color: "text-indigo-500" },
                      table: { icon: "Table2", color: "text-teal-500" },
                      form: { icon: "FormInput", color: "text-pink-500" },
                      compound: {
                        icon: "LayoutGrid",
                        color: "text-emerald-500",
                      },
                    };

                    const nodeId = `node-${Date.now()}`;
                    const isTableNode = type === "table";
                    const isFormNode = type === "form";
                    const isCompoundNode = type === "compound";
                    const isImageNode = type === "image";
                    const isCodeNode = type === "code";
                    const isExperimentNode = type === "experiment";
                    const tableId = isTableNode ? `table-${nodeId}` : undefined;

                    const getNodeData = () => {
                      if (isExperimentNode) {
                        return {
                          label: "Experiment",
                          mode: 'whatif' as const,
                          anchor: {
                            workflowId: activeTab?.id || 'default',
                          },
                          generation: {
                            status: 'idle' as const,
                            generatedNodeIds: [],
                            generatedEdgeIds: [],
                          },
                          ui: { preview: false },
                        };
                      }
                      if (isTableNode) {
                        return {
                          label: "Table",
                          tableId,
                          previewRowCount: 3,
                          previewColumnCount: 4,
                          showRowNumbers: true,
                          colors: {
                            headerBackground: "#4f46e5",
                            bodyBackground: "#ffffff",
                            headerTextColor: "#ffffff",
                            bodyTextColor: "#374151",
                          },
                        };
                      }
                      if (isFormNode) {
                        return {
                          label: "Form",
                          formTitle: "Form",
                          fields: [],
                          showLabels: true,
                          layout: "vertical",
                          colors: {
                            headerBackground: "#6366f1",
                            bodyBackground: "#ffffff",
                            borderColor: "#818cf8",
                            headerTextColor: "#ffffff",
                          },
                        };
                      }
                      if (isCompoundNode) {
                        return {
                          label: "Compound",
                          description: "",
                          subcomponents: [],
                          containerPadding: 12,
                          gap: 8,
                          colors: {
                            headerBackground: "#059669",
                            bodyBackground: "#ffffff",
                            borderColor: "#10b981",
                            headerTextColor: "#ffffff",
                          },
                        };
                      }
                      if (isCodeNode) {
                        return {
                          label: "Code",
                          code: "",
                          language: "javascript",
                          showOutput: true,
                          outputHeight: 120,
                          colors: {
                            headerBackground: "#1e1e1e",
                            bodyBackground: "#252526",
                            headerTextColor: "#d4d4d4",
                          },
                        };
                      }
                      return {
                        label:
                          type === "image"
                            ? "Image"
                            : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                        description: `Configure ${type} settings`,
                        icon:
                          icons[type as keyof typeof icons]?.icon ||
                          "fas fa-cube",
                        iconColor:
                          icons[type as keyof typeof icons]?.color ||
                          "text-gray-500",
                      };
                    };

                    // Calculate position offset based on node type for centering
                    const halfWidth = isTableNode
                      ? 280
                      : isFormNode
                        ? 160
                        : isCompoundNode
                          ? 160
                          : isCodeNode
                            ? 200
                            : isImageNode
                              ? 120
                              : 100;
                    const halfHeight = isTableNode
                      ? 200
                      : isFormNode
                        ? 100
                        : isCompoundNode
                          ? 140
                          : isCodeNode
                            ? 175
                            : isImageNode
                              ? 120
                              : 50;

                    const newNode: Node = {
                      id: nodeId,
                      type,
                      position: {
                        x: worldPosition.x - halfWidth,
                        y: worldPosition.y - halfHeight,
                      },
                      data: getNodeData(),
                      width: isTableNode
                        ? 560
                        : isFormNode
                          ? 320
                          : isCompoundNode
                            ? 320
                            : isCodeNode
                              ? 400
                              : isImageNode
                                ? 240
                                : 200,
                      height: isTableNode
                        ? 400
                        : isFormNode
                          ? 200
                          : isCompoundNode
                            ? 280
                            : isCodeNode
                              ? 350
                              : isImageNode
                                ? 240
                                : 100,
                      style: isTableNode
                        ? { width: 560, height: 400 }
                        : isFormNode
                          ? { width: 320, height: 200 }
                          : isCompoundNode
                            ? { width: 320, height: 280 }
                            : isCodeNode
                              ? { width: 400, height: 350 }
                              : isImageNode
                                ? { width: 240, height: 240 }
                                : undefined,
                      resizable:
                        isTableNode ||
                        isFormNode ||
                        isCompoundNode ||
                        isCodeNode ||
                        isImageNode
                          ? true
                          : undefined,
                    };

                    setNodes((prev) => [...prev, newNode]);

                    // Toast notification for node creation
                    toast({
                      title: "Node Added",
                      description: `${newNode.data.label} added to canvas`,
                      variant: "default",
                    });
                  }}
                  onFitView={() => {
                    if (nodes.length === 0) {
                      setViewport({ x: 0, y: 0, zoom: 1 });
                      return;
                    }

                    // Calculate bounding box of all nodes
                    let minX = Infinity;
                    let minY = Infinity;
                    let maxX = -Infinity;
                    let maxY = -Infinity;

                    nodes.forEach((node) => {
                      const w = node.style?.width ?? node.width ?? 200;
                      const h = node.style?.height ?? node.height ?? 100;

                      minX = Math.min(minX, node.position.x);
                      minY = Math.min(minY, node.position.y);
                      maxX = Math.max(maxX, node.position.x + w);
                      maxY = Math.max(maxY, node.position.y + h);
                    });

                    // Add padding around the content
                    const padding = 100;
                    const contentWidth = maxX - minX + padding * 2;
                    const contentHeight = maxY - minY + padding * 2;

                    // Canvas dimensions (approximate viewport size)
                    const canvasWidth = 800;
                    const canvasHeight = 600;

                    // Calculate zoom to fit content with margin
                    const zoomX = (canvasWidth * 0.9) / contentWidth;
                    const zoomY = (canvasHeight * 0.9) / contentHeight;
                    const zoom = Math.max(
                      0.1,
                      Math.min(1.2, Math.min(zoomX, zoomY)),
                    );

                    // Calculate content center
                    const contentCenterX = (minX + maxX) / 2;
                    const contentCenterY = (minY + maxY) / 2;

                    // Calculate viewport translation to center content
                    const x = canvasWidth / 2 - contentCenterX * zoom;
                    const y = canvasHeight / 2 - contentCenterY * zoom;

                    setViewport({ x, y, zoom });
                  }}
                  onClearCanvas={() => {
                    saveToHistory("Clear canvas");
                    setNodes([]);
                    setEdges([]);
                    setSelectedNodeId("");
                    setSelectedEdgeId("");
                    setSelectedEdgeIds([]);
                  }}
                  onExport={() => {
                    try {
                      const exportData = exportWorkflow(
                        { nodes, edges, canvasObjects, viewport, sketchStrokes },
                        {
                          name: activeTab?.name || "My Workflow",
                          description:
                            activeTab?.metadata?.description || "",
                        },
                        {
                          projectId: projectIdentifier,
                          includeDocumentation: true,
                          workflowNames: Object.fromEntries(
                            tabs.map((t) => [t.id, t.name]),
                          ),
                          projectDescription:
                            activeTab?.metadata?.description,
                        },
                      );
                      const safeFileName = `${(activeTab?.name || "workflow").replace(/[^a-z0-9]/gi, "_").toLowerCase()}.kiteframe`;
                      downloadWorkflow(exportData, safeFileName);
                      toast({
                        title: "Workflow Exported",
                        description: `"${activeTab?.name || "Workflow"}" exported with all content and documentation`,
                      });
                    } catch (err) {
                      console.error("[Export] Toolbar export failed:", err);
                      toast({
                        title: "Export Failed",
                        description: "Could not export workflow.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onImport={() => {
                    // Create hidden file input for importing and appending to existing workflow
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".json";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) return;

                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const data = JSON.parse(
                            event.target?.result as string,
                          );
                          appendImportedWorkflowToCanvas(data);
                        } catch (error) {
                          toast({
                            title: "Import Failed",
                            description:
                              "Invalid JSON file. Please select a valid workflow file.",
                            variant: "destructive",
                          });
                        }
                      };
                      reader.readAsText(file);
                    };
                    input.click();
                  }}
                  onNodeUpdate={(nodeId: string, updates: Partial<Node>) => {
                    saveToHistory("Update node");
                    setNodes((prev) =>
                      prev.map((n) =>
                        n.id === nodeId ? { ...n, ...updates } : n,
                      ),
                    );
                  }}
                  onBulkNodeUpdate={(
                    nodeIds: string[],
                    updates: Partial<Node>,
                  ) => {
                    saveToHistory("Update nodes");
                    setNodes((prev) =>
                      prev.map((n) =>
                        nodeIds.includes(n.id)
                          ? {
                              ...n,
                              ...updates,
                              data: updates.data
                                ? { ...n.data, ...updates.data }
                                : n.data,
                            }
                          : n,
                      ),
                    );
                  }}
                  onEdgeUpdate={(edgeId: string, updates: Partial<Edge>) => {
                    saveToHistory("Update edge");
                    setEdges((prev) =>
                      prev.map((e) =>
                        e.id === edgeId ? { ...e, ...updates } : e,
                      ),
                    );
                  }}
                  onDeselectNode={() => {
                    setSelectedNodeId("");
                    setSelectedEdgeIds([]);
                    setNodes((prev) =>
                      prev.map((n) => ({ ...n, selected: false })),
                    );
                  }}
                  onCanvasObjectUpdate={(
                    objectId: string,
                    updates: Partial<
                      TextNodeData | ShapeNodeData | StickyNoteData
                    >,
                  ) => {
                    const targetObj = canvasObjects.find(
                      (obj) => obj.id === objectId,
                    );
                    if (!targetObj) return;

                    const nextData = { ...targetObj.data, ...updates };

                    // Shallow equality check to prevent unnecessary updates
                    const shallowEqual = (obj1: any, obj2: any) => {
                      const keys1 = Object.keys(obj1);
                      const keys2 = Object.keys(obj2);
                      if (keys1.length !== keys2.length) return false;
                      return keys1.every((key) => obj1[key] === obj2[key]);
                    };

                    if (shallowEqual(targetObj.data, nextData)) {
                      return; // No change, skip update
                    }

                    const updatedObjects = canvasObjects.map((obj) =>
                      obj.id === objectId ? { ...obj, data: nextData } : obj,
                    );
                    saveToHistory("Update canvas object");
                    updateActiveTab({ canvasObjects: updatedObjects });
                  }}
                  onDeselectCanvasObjects={() => {
                    const updatedObjects = canvasObjects.map((obj) => ({
                      ...obj,
                      selected: false,
                    }));
                    updateActiveTab({ canvasObjects: updatedObjects });
                  }}
                  selectedCanvasObjects={selectedCanvasObjects}
                  onImageUpload={(
                    nodeId: string,
                    objectPath: string,
                    filename?: string,
                  ) => {
                    // Update the node with the image data and auto-size
                    const img = new Image();
                    img.onload = () => {
                      const maxWidth = 300;
                      const maxHeight = 250;
                      const headerHeight = 30;

                      const aspectRatio = img.naturalWidth / img.naturalHeight;
                      let imageWidth = img.naturalWidth;
                      let imageHeight = img.naturalHeight;

                      // Scale down if needed to fit constraints
                      const scaleX =
                        imageWidth > maxWidth ? maxWidth / imageWidth : 1;
                      const scaleY =
                        imageHeight > maxHeight ? maxHeight / imageHeight : 1;
                      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

                      imageWidth = Math.round(imageWidth * scale);
                      imageHeight = Math.round(imageHeight * scale);

                      saveToHistory("Upload image");
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === nodeId
                            ? {
                                ...n,
                                width: Math.max(200, imageWidth + 20), // Add padding
                                height: imageHeight + headerHeight + 20, // Add header and padding
                                data: { ...n.data, src: objectPath, filename },
                              }
                            : n,
                        ),
                      );
                    };
                    img.src = objectPath;
                  }}
                  onImageUrl={(nodeId: string, url: string) => {
                    // Update the node with the image URL and auto-size
                    const img = new Image();
                    img.onload = () => {
                      const maxWidth = 300;
                      const maxHeight = 250;
                      const headerHeight = 30;

                      const aspectRatio = img.naturalWidth / img.naturalHeight;
                      let imageWidth = img.naturalWidth;
                      let imageHeight = img.naturalHeight;

                      // Scale down if needed to fit constraints
                      const scaleX =
                        imageWidth > maxWidth ? maxWidth / imageWidth : 1;
                      const scaleY =
                        imageHeight > maxHeight ? maxHeight / imageHeight : 1;
                      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

                      imageWidth = Math.round(imageWidth * scale);
                      imageHeight = Math.round(imageHeight * scale);

                      saveToHistory("Set image URL");
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === nodeId
                            ? {
                                ...n,
                                width: Math.max(200, imageWidth + 20), // Add padding
                                height: imageHeight + headerHeight + 20, // Add header and padding
                                data: { ...n.data, src: url, sourceUrl: url },
                              }
                            : n,
                        ),
                      );
                    };
                    img.src = url;
                  }}
                  showImageModal={showImageModal}
                  onOpenImageModal={setShowImageModal}
                  onCloseImageModal={() => setShowImageModal(null)}
                  onOpenAiGenerator={() => setShowAiGenerator(true)}
                  onSnapshot={handleSnapshot}
                  onVersionHistory={handleVersionHistory}
                  onApplyTheme={(theme) => {
                    // Update current theme state
                    setCurrentTheme(theme);
                    localStorage.setItem("workflow-theme", theme.id);

                    saveToHistory("Apply theme");

                    // Apply theme to all nodes using the enhanced helper function
                    setNodes((prev) =>
                      prev.map((node) => ({
                        ...node,
                        data: applyThemeToNode(node.data, theme),
                      })),
                    );

                    // Apply theme to all edges using the enhanced helper function
                    setEdges((prev) =>
                      prev.map((edge) => applyThemeToEdge(edge, theme)),
                    );
                  }}
                  copiedProperties={copiedProperties}
                  onApplyToWorkflow={(colors) => {
                    // Apply colors to all nodes in the current workflow
                    saveToHistory("Apply colors to workflow");
                    setNodes((prev) =>
                      prev.map((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          colors: {
                            ...node.data?.colors,
                            headerBackground: colors.headerBackground,
                            bodyBackground: colors.bodyBackground,
                            headerTextColor: colors.headerTextColor,
                            bodyTextColor: colors.bodyTextColor,
                          },
                        },
                      })),
                    );
                  }}
                  currentWorkflow={
                    activeTab
                      ? {
                          id: activeTab.id,
                          name: activeTab.name,
                          nodes: activeTab.nodes,
                          edges: activeTab.edges,
                        }
                      : undefined
                  }
                  onLoadWorkflow={(workflow) => {
                    // Create a new tab with the loaded workflow
                    const newTab: WorkflowTab = {
                      id: workflow.id,
                      name: workflow.name,
                      nodes: workflow.nodes,
                      edges: workflow.edges,
                      canvasObjects: [],
                      viewport: { x: 0, y: 0, zoom: 1 },
                      selectedNodeId: "",
                      selectedEdgeId: "",
                      history: [
                        {
                          nodes: workflow.nodes,
                          edges: workflow.edges,
                          canvasObjects: [],
                          viewport: { x: 0, y: 0, zoom: 1 },
                        },
                      ],
                      historyIndex: 0,
                      showImageModal: null,
                      metadata: {
                        name: workflow.name,
                        description: "",
                        links: [],
                        linksFormat: "bulleted",
                        categories: [],
                      },
                      projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    };

                    setTabs((prev) => [...prev, newTab]);
                    setActiveTabId(newTab.id);
                  }}
                  onCreateTemplate={(templateType: string) => {
                    // Create a new tab if none are open
                    if (openTabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs((prev) => [...prev, newTab]);
                      setActiveTabId(newTab.id);
                      // Wait for the tab to be created before adding the template
                      setTimeout(() => {
                        handleAddTemplateToCurrentTab(templateType);
                      }, 50);
                      return;
                    }

                    // Normal case - add template to current active tab
                    handleAddTemplateToCurrentTab(templateType);
                  }}
                  onCreateTemplateAtPosition={(
                    templateType: string,
                    position: { x: number; y: number },
                  ) => {
                    // Create a new tab if none are open
                    if (openTabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs((prev) => [...prev, newTab]);
                      setActiveTabId(newTab.id);
                      // Wait for the tab to be created before adding the template
                      setTimeout(() => {
                        handleAddTemplateToCurrentTab(templateType, position);
                      }, 50);
                      return;
                    }

                    // Normal case - add template to current active tab with position
                    handleAddTemplateToCurrentTab(templateType, position);
                  }}
                  viewport={viewport}
                  connectionAnimationConfig={connectionAnimationConfig}
                  onConnectionAnimationConfigChange={
                    setConnectionAnimationConfig
                  }
                  savedTemplates={savedTemplates}
                  tables={nodes
                    .filter((n) => n.type === "table" && n.data?.tableId)
                    .map(
                      (n) =>
                        n.data?.table || {
                          id: n.data?.tableId || "",
                          name: n.data?.label || "Table",
                          columns: [],
                          rows: [],
                        },
                    )
                    .filter((t): t is DataTable => !!t)}
                  onCreateFromSavedTemplate={(
                    templateId: string,
                    position: { x: number; y: number },
                  ) => {
                    const template = savedTemplates.find(
                      (t) => t.id === templateId,
                    );
                    if (!template) return;

                    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const nodeId = `node-${uniqueId}`;
                    const newNode: Node = {
                      id: nodeId,
                      type: "compound",
                      position,
                      data: {
                        label: template.name,
                        description: template.description || "",
                        subcomponents:
                          template.subcomponents?.map((s, i) => ({
                            ...s,
                            id: `${nodeId}-sub-${i}-${Math.random().toString(36).slice(2, 6)}`,
                          })) || [],
                        containerPadding: template.containerPadding || 12,
                        gap: template.gap || 8,
                        colors: template.colors || {
                          headerBackground: "#059669",
                          bodyBackground: "#ffffff",
                          borderColor: "#10b981",
                          headerTextColor: "#ffffff",
                        },
                        sourceTemplateId: template.id,
                      },
                      width: template.defaultWidth || 320,
                      height: template.defaultHeight || 280,
                      style: {
                        width: template.defaultWidth || 320,
                        height: template.defaultHeight || 280,
                      },
                      resizable: true,
                    };

                    saveToHistory("Create from template");
                    setNodes((prev) => [...prev, newNode]);
                  }}
                  onDeleteSavedTemplate={deleteTemplate}
                  onRenameSavedTemplate={(
                    templateId: string,
                    newName: string,
                  ) => {
                    updateTemplate(templateId, { name: newName });
                  }}
                  onLinkTemplateToTable={(
                    templateId: string,
                    tableId: string,
                  ) => {
                    const template = savedTemplates.find(
                      (t) => t.id === templateId,
                    );
                    if (!template) return;
                    handleGenerateFromTemplate(tableId, template);
                  }}
                />
              )}
            </div>}

            {/* Canvas Area */}
            <div
              ref={canvasContainerRef}
              className={`flex-1 relative ${openTabs.length > 0 ? "overflow-hidden" : "overflow-y-auto"}`}
            >
              {openTabs.length > 0 ? (
                <>
                  <WorkflowCanvas
                    data-testid="workflow-canvas"
                    nodes={nodes}
                    edges={edges}
                    canvasObjects={canvasObjects}
                    viewport={viewport}
                    selectedEdgeIds={selectedEdgeIds}
                    isSketchMode={isSketchMode}
                    isReadOnly={effectiveReadOnly}
                    shareEnabled={!!activeShareId}
                    isShareLocked={isShareLocked}
                    shareViewerCount={shareViewerCount}
                    onToggleShareLock={handleToggleShareLock}
                    commentModeActive={commentPlacing}
                    onToggleCommentMode={() => setCommentPlacing((p) => !p)}
                    onGenerateInterface={effectiveReadOnly ? undefined : () => {
                      if (!activeTab) return;
                      openInterfaceProposalTab(activeTab);
                    }}
                    isGeneratingInterface={isGeneratingInterface}
                    onViewportChange={setViewport}
                    onCanvasObjectsChange={(newCanvasObjects) => {
                      saveToHistory("Update canvas objects");
                      updateActiveTab({ canvasObjects: newCanvasObjects });
                    }}
                    proFeatures={proFeaturesConfig}
                    onQuickAdd={handleQuickAdd}
                    workflowName={activeTab?.name}
                    onWorkflowNameChange={setWorkflowName}
                    onEdgeReconnect={handleEdgeReconnect}
                    onEdgeControlPointDragStart={() => {
                      saveToHistory("Reshape edge");
                    }}
                    onEdgeControlPointChange={(edgeId, cp) => {
                      setEdges((prev) =>
                        prev.map((e) =>
                          e.id === edgeId
                            ? { ...e, controlPoint: cp ?? undefined, waypoints: undefined }
                            : e,
                        ),
                      );
                    }}
                    onEdgeWaypointsChange={(edgeId, waypoints) => {
                      setEdges((prev) =>
                        prev.map((e) =>
                          e.id === edgeId
                            ? {
                                ...e,
                                waypoints:
                                  waypoints && waypoints.length > 0
                                    ? waypoints
                                    : undefined,
                                controlPoint: undefined,
                              }
                            : e,
                        ),
                      );
                    }}
                    connectionAnimationConfig={connectionAnimationConfig}
                    connectionPreview={connectionPreview}
                    onNodesChange={(changes) => {
                      // Handle both array of changes and direct node array updates
                      if (Array.isArray(changes)) {
                        // Handle empty array (e.g., all nodes deleted)
                        if (changes.length === 0) {
                          saveToHistory("Delete all nodes");
                          setNodes([]);
                          return;
                        }
                        // Check if it's a direct nodes array update (from drag operations or node updates)
                        // Nodes have a 'type' property that is the node type ('input', 'ai', etc.)
                        // Changes have a 'type' property that is the change type ('position', 'select', etc.)
                        const isNodeArray =
                          changes[0].id &&
                          changes[0].position &&
                          (changes[0].type === "input" ||
                            changes[0].type === "ai" ||
                            changes[0].type === "condition" ||
                            changes[0].type === "output" ||
                            changes[0].type === "process" ||
                            changes[0].type === "image" ||
                            changes[0].type === "form" ||
                            changes[0].type === "compound" ||
                            changes[0].type === "table" ||
                            changes[0].type === "shape" ||
                            changes[0].type === "experiment" ||
                            changes[0].type === "code" ||
                            changes[0].type === "render" ||
                            changes[0].type === "text" ||
                            changes[0].type === "webview");
                        
                        if (isNodeArray) {
                          // Direct nodes array from KiteFrameCanvas drag operations or paste
                          const incomingNodes = changes as Node[];
                          
                          // Detect if this is a paste operation (nodes were added)
                          // by comparing incoming count to current count
                          const currentNodeCount = nodes.length;
                          const incomingNodeCount = incomingNodes.length;
                          const nodesWereAdded = incomingNodeCount > currentNodeCount;

                          if (nodesWereAdded) {
                            // This is a paste operation - save to history
                            const addedCount = incomingNodeCount - currentNodeCount;
                            saveToHistory(`Paste ${addedCount} node${addedCount > 1 ? 's' : ''}`);
                            setNodes(incomingNodes);
                          } else {
                            // This is a drag operation - handle normally
                            // Save pre-drag state to history on the FIRST drag event so
                            // undo correctly restores the position before dragging started.
                            if (!isDraggingRef.current) {
                              saveToHistory("Move node");
                            }

                            // Mark as dragging to prevent properties panel from opening
                            isDraggingRef.current = true;

                            // Hide linear toolbar during drag for performance
                            setLinearToolbar(null);

                            // Cancel any pending click delay timer since we're now dragging
                            if (clickDelayTimeoutRef.current) {
                              clearTimeout(clickDelayTimeoutRef.current);
                              clickDelayTimeoutRef.current = null;
                            }

                            // Reset drag state after a delay (when user stops dragging)
                            if (dragResetTimeoutRef.current) {
                              clearTimeout(dragResetTimeoutRef.current);
                            }
                            dragResetTimeoutRef.current = setTimeout(() => {
                              isDraggingRef.current = false;
                            }, 200); // Reset after 200ms of no drag activity

                            setNodes(incomingNodes);
                          }
                        } else {
                          // Change-based updates

                          // Separate node changes by type for better history tracking
                          const selectionChanges = changes.filter(
                            (c) => c.type === "select",
                          );
                          const positionChanges = changes.filter(
                            (c) => c.type === "position",
                          );
                          const removalChanges = changes.filter(
                            (c) => c.type === "remove",
                          );
                          const otherChanges = changes.filter(
                            (c) =>
                              c.type &&
                              !["select", "position", "remove"].includes(
                                c.type,
                              ),
                          );

                          // Process selection and position changes in batch (they don't change structure)
                          if (
                            selectionChanges.length > 0 ||
                            positionChanges.length > 0
                          ) {
                            // Save pre-move state BEFORE applying position changes
                            if (positionChanges.length > 0) {
                              saveToHistory("Move node");
                            }

                            setNodes((prev) => {
                              let newNodes = [...prev];
                              [...selectionChanges, ...positionChanges].forEach(
                                (change) => {
                                  if (
                                    change.type === "position" &&
                                    change.position
                                  ) {
                                    const nodeIndex = newNodes.findIndex(
                                      (n) => n.id === change.id,
                                    );
                                    if (nodeIndex >= 0) {
                                      newNodes[nodeIndex] = {
                                        ...newNodes[nodeIndex],
                                        position: change.position,
                                      };
                                    }
                                  } else if (change.type === "select") {
                                    const nodeIndex = newNodes.findIndex(
                                      (n) => n.id === change.id,
                                    );
                                    if (nodeIndex >= 0) {
                                      newNodes[nodeIndex] = {
                                        ...newNodes[nodeIndex],
                                        selected: change.selected,
                                      };
                                    }
                                  }
                                },
                              );
                              return newNodes;
                            });
                          }

                          // Process removal changes individually
                          if (removalChanges.length > 0) {
                            removalChanges.forEach((change, index) => {
                              setNodes((prev) => {
                                const newNodes = prev.filter(
                                  (n) => n.id !== change.id,
                                );
                                return newNodes;
                              });

                              // Save to history after each node removal
                              setTimeout(
                                () => saveToHistory("Delete node"),
                                10 * (index + 1),
                              );
                            });
                          }

                          // Process other changes
                          if (otherChanges.length > 0) {
                            saveToHistory("Update node");
                            setNodes((prev) => {
                              let newNodes = [...prev];
                              otherChanges.forEach((change) => {
                                // Handle any other change types here
                              });
                              return newNodes;
                            });
                          }
                        }
                      }
                    }}
                    onEdgesChange={(changes: any[]) => {
                      // Handle empty array
                      if (!Array.isArray(changes) || changes.length === 0) {
                        return;
                      }
                      
                      // Check if this is a direct edges array (from paste operations)
                      // Edges have 'source' and 'target' properties, and their 'type' is edge rendering type
                      // Changes have a 'type' property that is one of: 'select', 'remove', 'add', etc.
                      const firstItem = changes[0];
                      const isChangeObject = firstItem.type === 'select' || 
                                             firstItem.type === 'remove' || 
                                             firstItem.type === 'add' ||
                                             firstItem.type === 'reset';
                      const isEdgesArray = firstItem.source && firstItem.target && !isChangeObject;
                      
                      if (isEdgesArray) {
                        // Direct edges array from paste operation
                        const incomingEdges = changes as Edge[];
                        const currentEdgeCount = edges.length;
                        const incomingEdgeCount = incomingEdges.length;
                        const edgesWereAdded = incomingEdgeCount > currentEdgeCount;
                        
                        setEdges(incomingEdges);
                        // Note: History is saved by onNodesChange when nodes are pasted along with edges
                        return;
                      }
                      
                      // Separate changes by type for individual history tracking
                      const selectionChanges = changes.filter(
                        (c) => c.type === "select",
                      );
                      const removalChanges = changes.filter(
                        (c) => c.type === "remove",
                      );
                      const otherChanges = changes.filter(
                        (c) => c.type !== "select" && c.type !== "remove",
                      );

                      // Process selection changes in batch (don't save to history)
                      if (selectionChanges.length > 0) {
                        setEdges((prev) => {
                          let newEdges = [...prev];
                          selectionChanges.forEach((change) => {
                            const edgeIndex = newEdges.findIndex(
                              (e) => e.id === change.id,
                            );
                            if (edgeIndex >= 0) {
                              newEdges[edgeIndex] = {
                                ...newEdges[edgeIndex],
                                selected: change.selected,
                              };
                            }
                          });
                          return newEdges;
                        });
                      }

                      // Process removal changes individually (save to history for each)
                      if (removalChanges.length > 0) {
                        removalChanges.forEach((change, index) => {
                          setEdges((prev) => {
                            const newEdges = prev.filter(
                              (e) => e.id !== change.id,
                            );
                            return newEdges;
                          });

                          // Save to history after each edge removal
                          setTimeout(
                            () => saveToHistory("Delete edge"),
                            10 * (index + 1),
                          ); // Stagger the saves slightly
                        });
                      }

                      // Process other changes in batch
                      if (otherChanges.length > 0) {
                        saveToHistory("Update edge");
                        setEdges((prev) => {
                          let newEdges = [...prev];
                          otherChanges.forEach((change) => {
                            // Handle any other change types here
                          });
                          return newEdges;
                        });
                      }
                    }}
                    onConnect={(connection) => {
                      // Check if this is a TableNode→FormNode edge
                      const sourceNode = nodes.find(
                        (n) => n.id === connection.source,
                      );
                      const targetNode = nodes.find(
                        (n) => n.id === connection.target,
                      );

                      // Handle table→form data linking
                      if (
                        sourceNode?.type === "table" &&
                        targetNode?.type === "form"
                      ) {
                        const formData = targetNode.data as any;
                        const hasExistingInputs = formData?.fields?.some(
                          (field: any) =>
                            (field.value && field.value.trim() !== "") ||
                            field.dataLink,
                        );

                        // Prevent linking to forms with existing input values or existing links
                        if (hasExistingInputs) {
                          toast({
                            title: "Cannot link to this form",
                            description:
                              "This form already has input values. Clear the inputs first or use an empty form.",
                            variant: "destructive",
                            duration: 4000,
                          });
                          return; // Don't create the edge
                        }

                        // Check if form is already linked to another table
                        if (
                          formData?.linkedTableId &&
                          formData.linkedTableId !==
                            (sourceNode.data as TableNodeData).tableId
                        ) {
                          toast({
                            title: "Form already linked",
                            description:
                              "This form is already linked to another table. Break the existing link first.",
                            variant: "destructive",
                            duration: 4000,
                          });
                          return; // Don't create the edge
                        }
                      }

                      // Create the edge
                      const isTableToFormLink =
                        sourceNode?.type === "table" &&
                        targetNode?.type === "form";
                      const isDataToCodeLink =
                        (sourceNode?.type === "table" ||
                          sourceNode?.type === "form") &&
                        targetNode?.type === "code";

                      // Build edge data based on connection type
                      let edgeData: Record<string, any> | undefined = undefined;
                      if (isTableToFormLink) {
                        edgeData = { isDataLink: true };
                      } else if (isDataToCodeLink) {
                        edgeData = {
                          isDataLink: true,
                        };
                      }

                      const newEdge: Edge = {
                        id: `edge-${Date.now()}`,
                        source: connection.source,
                        target: connection.target,
                        type: "bezier" as const,
                        style: { strokeColor: "#3b82f6", strokeWidth: 2 },
                        markers: {
                          type: "arrow" as const,
                          position: "end" as const,
                        },
                        reconnectable: true, // Enable reconnection for new edges
                        interactable: true, // Make edge clickable
                        label: isTableToFormLink
                          ? "🔗"
                          : isDataToCodeLink
                            ? "🔗"
                            : undefined,
                        data: edgeData,
                      };
                      saveToHistory("Add edge");
                      setEdges((prev) => [...prev, newEdge]);

                      // Set linked table context for table→form connections
                      if (
                        sourceNode?.type === "table" &&
                        targetNode?.type === "form"
                      ) {
                        const tableData = sourceNode.data as TableNodeData;
                        // Resolve the table name from multiple sources with sensible fallbacks:
                        // 1. DataTable.name (populated table)
                        // 2. Source file name from metadata
                        // 3. Node label (BasicNodeData)
                        // 4. Generic fallback
                        const tableName =
                          tableData.table?.name ||
                          tableData.table?.meta?.sourceFileName ||
                          tableData.label ||
                          "Table";

                        // Update the FormNode with linked table context
                        setNodes((prev) =>
                          prev.map((n) => {
                            if (n.id === targetNode.id) {
                              return {
                                ...n,
                                data: {
                                  ...n.data,
                                  linkedTableId: tableData.tableId,
                                  linkedTableNodeId: sourceNode.id,
                                  linkedTableName: tableName,
                                },
                              };
                            }
                            return n;
                          }),
                        );

                        toast({
                          title: "Form linked to table",
                          description:
                            "You can now link form inputs to table columns using the link icon.",
                          duration: 3000,
                        });
                      }

                      // Toast notification for code and render node connections
                      const sourceType = sourceNode?.type;
                      const targetType = targetNode?.type;

                      // Table/Form → Code connection
                      if (
                        (sourceType === "table" || sourceType === "form") &&
                        targetType === "code"
                      ) {
                        const sourceLabel =
                          sourceType === "table" ? "Table" : "Form";
                        toast({
                          title: `Now linked to ${sourceLabel}`,
                          description:
                            "You can now access its data via the inputs object in your code.",
                          duration: 3000,
                        });
                      }

                      // Code → Render connection
                      if (sourceType === "code" && targetType === "render") {
                        toast({
                          title: "Now linked to Code",
                          description:
                            "The render node will display HTML output from the code node.",
                          duration: 3000,
                        });
                      }

                      // Any node → Code connection (for other data sources)
                      if (
                        sourceType &&
                        targetType === "code" &&
                        sourceType !== "table" &&
                        sourceType !== "form" &&
                        sourceType !== "code"
                      ) {
                        const sourceLabel =
                          sourceNode?.data?.label ||
                          sourceType.charAt(0).toUpperCase() +
                            sourceType.slice(1);
                        toast({
                          title: `Now linked to ${sourceLabel}`,
                          description:
                            "You can now access its data via the inputs object.",
                          duration: 3000,
                        });
                      }
                    }}
                    onNodeClick={(e: React.MouseEvent, node: Node) => {
                      // Clear any existing click delay timer
                      if (clickDelayTimeoutRef.current) {
                        clearTimeout(clickDelayTimeoutRef.current);
                        clickDelayTimeoutRef.current = null;
                      }

                      if (e.shiftKey) {
                        // Shift+click for multi-select - immediate action
                        setNodes((prev) => {
                          const updated = prev.map((n) => {
                            if (n.id === node.id) {
                              return { ...n, selected: !n.selected };
                            }
                            return n;
                          });
                          return updated;
                        });

                        // Hide toolbar during multi-select
                        setLinearToolbar(null);

                        // Don't change selectedNodeId during multi-select to preserve the selection
                      } else {
                        // Regular click - update selection immediately but delay properties panel
                        setNodes((prev) => {
                          const updated = prev.map((n) => ({
                            ...n,
                            selected: n.id === node.id,
                          }));
                          return updated;
                        });

                        // Reset drag detection
                        isDraggingRef.current = false;

                        // Delay opening properties panel and toolbar to detect if this becomes a drag
                        clickDelayTimeoutRef.current = setTimeout(() => {
                          if (!isDraggingRef.current) {
                            setSelectedNodeId(node.id);

                            // Skip linear toolbar for experiment nodes - they have their own UI
                            if (node.type === "experiment") {
                              setLinearToolbar(null);
                              clickDelayTimeoutRef.current = null;
                              return;
                            }

                            // Don't overwrite toolbar if we're editing a hyperlink or in link submenu
                            setLinearToolbar((prev) => {
                              if (
                                prev?.editingHyperlinkId ||
                                prev?.initialSubmenu === "link"
                              )
                                return prev;

                              // Calculate node rect for toolbar positioning
                              // Include canvas container offset for proper fixed positioning
                              const containerRect =
                                canvasContainerRef.current?.getBoundingClientRect();
                              const containerLeft = containerRect?.left ?? 0;
                              const containerTop = containerRect?.top ?? 0;

                              const nodeWidth =
                                node.style?.width ?? node.width ?? 200;
                              const nodeHeight =
                                node.style?.height ?? node.height ?? 100;
                              // World-to-screen: (worldPos * zoom) + panOffset + containerOffset
                              const screenX =
                                node.position.x * viewport.zoom +
                                viewport.x +
                                containerLeft;
                              const screenY =
                                node.position.y * viewport.zoom +
                                viewport.y +
                                containerTop;
                              const screenWidth = nodeWidth * viewport.zoom;
                              const screenHeight = nodeHeight * viewport.zoom;

                              return {
                                x: screenX + screenWidth / 2,
                                y: screenY,
                                nodeRect: {
                                  top: screenY,
                                  bottom: screenY + screenHeight,
                                  left: screenX,
                                  right: screenX + screenWidth,
                                  width: screenWidth,
                                },
                                node,
                              };
                            });
                          }
                          clickDelayTimeoutRef.current = null;
                        }, 150); // 150ms delay to detect drag
                      }

                      // Preserve Shift+clicked edges visually so node Edge submenu sees them.
                      // Only deselect edges that are not in the multi-select set.
                      const shiftSelected = activeTab?.selectedEdgeIds ?? [];
                      setEdges((prev) =>
                        prev.map((e) => ({ ...e, selected: shiftSelected.includes(e.id) })),
                      );
                      const updatedObjects = canvasObjects.map((obj) => ({
                        ...obj,
                        selected: false,
                      }));
                      updateActiveTab({ canvasObjects: updatedObjects });
                      setSelectedEdgeId("");
                      // Do NOT clear selectedEdgeIds here — the user may want to bulk-edit
                      // those Shift+clicked edges via the node's Edge submenu.
                      setContextMenu(null);
                      // Only clear inline editing if clicking a different node
                      if (inlineEditing?.nodeId !== node.id) {
                        setInlineEditing(null);
                      }
                    }}
                    onNodeDoubleClick={(
                      e: React.MouseEvent,
                      node: Node,
                      part?: "header" | "body",
                    ) => {
                      // Skip inline text editing for code nodes (they have their own CodeMirror editor)
                      // Skip for experiment nodes (they have their own UI)
                      if (node.type === "code" || node.type === "experiment") {
                        return;
                      }
                      // Double-click triggers inline text editing for specific part
                      setInlineEditing({
                        nodeId: node.id,
                        part: part || "header",
                      });
                      // Also show the linear toolbar with text style options
                      // Don't overwrite toolbar if we're editing a hyperlink or in link submenu
                      setLinearToolbar((prev) => {
                        if (
                          prev?.editingHyperlinkId ||
                          prev?.initialSubmenu === "link"
                        )
                          return prev;

                        // Include canvas container offset for proper fixed positioning
                        const containerRect =
                          canvasContainerRef.current?.getBoundingClientRect();
                        const containerLeft = containerRect?.left ?? 0;
                        const containerTop = containerRect?.top ?? 0;

                        const nodeWidth =
                          node.style?.width ?? node.width ?? 200;
                        const nodeHeight =
                          node.style?.height ?? node.height ?? 100;
                        // World-to-screen: (worldPos * zoom) + panOffset + containerOffset
                        const screenX =
                          node.position.x * viewport.zoom +
                          viewport.x +
                          containerLeft;
                        const screenY =
                          node.position.y * viewport.zoom +
                          viewport.y +
                          containerTop;
                        const screenWidth = nodeWidth * viewport.zoom;
                        const screenHeight = nodeHeight * viewport.zoom;

                        return {
                          x: screenX + screenWidth / 2,
                          y: screenY,
                          nodeRect: {
                            top: screenY,
                            bottom: screenY + screenHeight,
                            left: screenX,
                            right: screenX + screenWidth,
                            width: screenWidth,
                          },
                          node,
                        };
                      });
                      setContextMenu(null);
                    }}
                    onEdgeClick={(edge: Edge, clickEvent?: React.MouseEvent) => {
                      // Clear any existing click delay timer
                      if (clickDelayTimeoutRef.current) {
                        clearTimeout(clickDelayTimeoutRef.current);
                        clickDelayTimeoutRef.current = null;
                      }

                      const isShift = clickEvent?.shiftKey ?? false;

                      if (isShift) {
                        // Additive Shift+click: toggle this edge in selectedEdgeIds
                        const current = activeTab?.selectedEdgeIds ?? [];
                        const next = current.includes(edge.id)
                          ? current.filter((id) => id !== edge.id)
                          : [...current, edge.id];
                        setSelectedEdgeIds(next);
                        // Mark the edge selected visually too
                        setEdges((prev) =>
                          prev.map((e) =>
                            e.id === edge.id ? { ...e, selected: !current.includes(edge.id) } : e,
                          ),
                        );
                        // Close toolbar when doing multi-select
                        setLinearToolbar(null);
                        setContextMenu(null);
                        return;
                      }

                      // Regular (non-shift) click — clear multi-select, do single selection
                      setSelectedEdgeIds([]);
                      setNodes((prev) =>
                        prev.map((n) => ({ ...n, selected: false })),
                      );
                      setEdges((prev) => {
                        const updated = prev.map((e) => ({
                          ...e,
                          selected: e.id === edge.id,
                        }));
                        return updated;
                      });
                      setSelectedNodeId("");
                      setContextMenu(null);

                      // Reset drag detection
                      isDraggingRef.current = false;

                      // Delay opening properties panel for edges too
                      clickDelayTimeoutRef.current = setTimeout(() => {
                        if (!isDraggingRef.current) {
                          setSelectedEdgeId(edge.id);

                          // Calculate edge midpoint for toolbar positioning
                          // Include canvas container offset for proper fixed positioning
                          const containerRect =
                            canvasContainerRef.current?.getBoundingClientRect();
                          const containerLeft = containerRect?.left ?? 0;
                          const containerTop = containerRect?.top ?? 0;

                          const sourceNode = nodes.find(
                            (n) => n.id === edge.source,
                          );
                          const targetNode = nodes.find(
                            (n) => n.id === edge.target,
                          );
                          if (sourceNode && targetNode) {
                            const sourceX =
                              sourceNode.position.x +
                              (sourceNode.width ?? 200) / 2;
                            const sourceY =
                              sourceNode.position.y +
                              (sourceNode.height ?? 100) / 2;
                            const targetX =
                              targetNode.position.x +
                              (targetNode.width ?? 200) / 2;
                            const targetY =
                              targetNode.position.y +
                              (targetNode.height ?? 100) / 2;

                            const midX = (sourceX + targetX) / 2;
                            const midY = (sourceY + targetY) / 2;

                            // World-to-screen: (worldPos * zoom) + panOffset + containerOffset
                            const screenX =
                              midX * viewport.zoom + viewport.x + containerLeft;
                            const screenY =
                              midY * viewport.zoom + viewport.y + containerTop;

                            setLinearToolbar({
                              x: screenX,
                              y: screenY - 40,
                              nodeRect: {
                                top: screenY - 20,
                                bottom: screenY + 20,
                                left: screenX - 50,
                                right: screenX + 50,
                                width: 100,
                              },
                              edge,
                            });
                          }
                        }
                        clickDelayTimeoutRef.current = null;
                      }, 150); // 150ms delay
                    }}
                    onEdgeDoubleClick={(edge: Edge) => {
                      // Double-click on edge label triggers inline editing
                      setSelectedEdgeId(edge.id);
                      setInlineEditing({
                        edgeId: edge.id,
                        part: 'edgeLabel',
                      });
                      // Show the linear toolbar with text style options for edge label
                      const containerRect = canvasContainerRef.current?.getBoundingClientRect();
                      const containerLeft = containerRect?.left ?? 0;
                      const containerTop = containerRect?.top ?? 0;
                      
                      const sourceNode = nodes.find((n) => n.id === edge.source);
                      const targetNode = nodes.find((n) => n.id === edge.target);
                      if (sourceNode && targetNode) {
                        const sourceX = sourceNode.position.x + (sourceNode.width ?? 200) / 2;
                        const sourceY = sourceNode.position.y + (sourceNode.height ?? 100) / 2;
                        const targetX = targetNode.position.x + (targetNode.width ?? 200) / 2;
                        const targetY = targetNode.position.y + (targetNode.height ?? 100) / 2;
                        
                        const midX = (sourceX + targetX) / 2;
                        const midY = (sourceY + targetY) / 2;
                        
                        const screenX = midX * viewport.zoom + viewport.x + containerLeft;
                        const screenY = midY * viewport.zoom + viewport.y + containerTop;
                        
                        setLinearToolbar({
                          x: screenX,
                          y: screenY - 40,
                          nodeRect: {
                            top: screenY - 20,
                            bottom: screenY + 20,
                            left: screenX - 50,
                            right: screenX + 50,
                            width: 100,
                          },
                          edge,
                        });
                      }
                    }}
                    onCanvasClick={(e?: React.MouseEvent) => {
                      // Don't deselect during drag operations to keep properties card open
                      if (
                        e &&
                        (e.target as HTMLElement)?.closest?.(".dragging")
                      ) {
                        return;
                      }

                      // Hit-test sketch strokes when not in sketch mode.
                      // If the click lands on a stroke, enter sketch mode and select it.
                      if (!isSketchMode && sketchStrokes.length > 0) {
                        const ptr = lastPointerClientRef.current;
                        const canvasEl = document.querySelector<HTMLElement>('[data-testid="workflow-canvas"]');
                        if (ptr && canvasEl) {
                          const rect = canvasEl.getBoundingClientRect();
                          const wx = (ptr.clientX - rect.left - viewport.x) / viewport.zoom;
                          const wy = (ptr.clientY - rect.top - viewport.y) / viewport.zoom;
                          const hitIdx = findNearestStroke(wx, wy, sketchStrokes, viewport.zoom, lockedStrokeIndices);
                          if (hitIdx >= 0) {
                            setIsSketchMode(true);
                            setSketchTool('cursor');
                            // Defer one tick so SketchCanvas re-renders as active before we select
                            setTimeout(() => {
                              sketchCanvasRef.current?.selectStroke([hitIdx]);
                            }, 0);
                            return;
                          }
                        }
                      }

                      setNodes((prev) =>
                        prev.map((n) => ({ ...n, selected: false })),
                      );
                      setEdges((prev) =>
                        prev.map((e) => ({ ...e, selected: false })),
                      );
                      setSelectedNodeId("");
                      setSelectedEdgeId("");
                      setSelectedEdgeIds([]);
                      setContextMenu(null);
                      setLinearToolbar(null);
                      setInlineEditing(null);
                      // Clear canvas objects selection too
                      updateActiveTab({
                        canvasObjects: canvasObjects.map((obj) => ({
                          ...obj,
                          selected: false,
                        })),
                      });
                    }}
                    onNodeRightClick={(e: React.MouseEvent, node: Node) => {
                      setContextMenu({ x: e.clientX, y: e.clientY, node });
                    }}
                    onCanvasObjectClick={(
                      e: React.MouseEvent,
                      canvasObject: CanvasObject,
                    ) => {
                      // Clear any existing click delay timer
                      if (clickDelayTimeoutRef.current) {
                        clearTimeout(clickDelayTimeoutRef.current);
                        clickDelayTimeoutRef.current = null;
                      }

                      if (e.shiftKey) {
                        // Shift+click for multi-select - immediate action, handled by KiteFrameCanvas
                      } else {
                        // Regular click — clear edge multi-select since we're focusing a canvas object
                        setSelectedEdgeIds([]);
                        // Reset drag detection
                        isDraggingRef.current = false;

                        // Delay opening toolbar to detect if this becomes a drag
                        clickDelayTimeoutRef.current = setTimeout(() => {
                          if (!isDraggingRef.current) {
                            // Don't overwrite toolbar if we're editing a hyperlink or in a submenu
                            setLinearToolbar((prev) => {
                              if (
                                prev?.editingHyperlinkId ||
                                prev?.initialSubmenu === "textLink"
                              )
                                return prev;

                              // Calculate object rect for toolbar positioning
                              // Include canvas container offset for proper fixed positioning
                              const containerRect =
                                canvasContainerRef.current?.getBoundingClientRect();
                              const containerLeft = containerRect?.left ?? 0;
                              const containerTop = containerRect?.top ?? 0;

                              const objWidth = canvasObject.width ?? 150;
                              const objHeight = canvasObject.height ?? 100;
                              // World-to-screen: (worldPos * zoom) + panOffset + containerOffset
                              const screenX =
                                canvasObject.position.x * viewport.zoom +
                                viewport.x +
                                containerLeft;
                              const screenY =
                                canvasObject.position.y * viewport.zoom +
                                viewport.y +
                                containerTop;
                              const screenWidth = objWidth * viewport.zoom;
                              const screenHeight = objHeight * viewport.zoom;

                              // Add extra clearance for line/arrow/polygon shapes so the toolbar
                              // doesn't overlap with the resize/endpoint handles
                              const shapeType = canvasObject.type === 'shape'
                                ? (canvasObject.data as ShapeNodeData).shapeType
                                : undefined;
                              const handlePad = (shapeType === 'line' || shapeType === 'arrow' || shapeType === 'polygon') ? 28 : 0;

                              return {
                                x: screenX + screenWidth / 2,
                                y: screenY - handlePad,
                                nodeRect: {
                                  top: screenY - handlePad,
                                  bottom: screenY + screenHeight + handlePad,
                                  left: screenX,
                                  right: screenX + screenWidth,
                                  width: screenWidth,
                                },
                                canvasObject,
                              };
                            });
                          }
                          clickDelayTimeoutRef.current = null;
                        }, 150); // 150ms delay to detect drag
                      }

                      // Deselect nodes and edges
                      setNodes((prev) =>
                        prev.map((n) => ({ ...n, selected: false })),
                      );
                      setEdges((prev) =>
                        prev.map((e) => ({ ...e, selected: false })),
                      );
                      setSelectedNodeId("");
                      setSelectedEdgeId("");
                      setContextMenu(null);
                      setInlineEditing(null);
                    }}
                    onCanvasObjectRightClick={(
                      e: React.MouseEvent,
                      canvasObject: CanvasObject,
                    ) => {
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        canvasObject,
                      });
                    }}
                    onImageButtonClick={setShowImageModal}
                    onUndo={effectiveReadOnly ? handleViewReset : handleUndo}
                    onRedo={effectiveReadOnly ? () => {} : handleRedo}
                    onFitView={() => {
                      if (nodes.length === 0) {
                        setViewport({ x: 0, y: 0, zoom: 1 });
                        return;
                      }

                      // Calculate bounding box of all nodes
                      let minX = Infinity;
                      let minY = Infinity;
                      let maxX = -Infinity;
                      let maxY = -Infinity;

                      nodes.forEach((node) => {
                        const w = node.style?.width ?? node.width ?? 200;
                        const h = node.style?.height ?? node.height ?? 100;

                        minX = Math.min(minX, node.position.x);
                        minY = Math.min(minY, node.position.y);
                        maxX = Math.max(maxX, node.position.x + w);
                        maxY = Math.max(maxY, node.position.y + h);
                      });

                      // Add padding around the content
                      const padding = 100;
                      const contentWidth = maxX - minX + padding * 2;
                      const contentHeight = maxY - minY + padding * 2;

                      // Canvas dimensions (approximate viewport size)
                      const canvasWidth = 800;
                      const canvasHeight = 600;

                      // Calculate zoom to fit content with margin
                      const zoomX = (canvasWidth * 0.9) / contentWidth;
                      const zoomY = (canvasHeight * 0.9) / contentHeight;
                      const zoom = Math.max(
                        0.1,
                        Math.min(1.2, Math.min(zoomX, zoomY)),
                      );

                      // Calculate content center
                      const contentCenterX = (minX + maxX) / 2;
                      const contentCenterY = (minY + maxY) / 2;

                      // Calculate viewport translation to center content
                      const x = canvasWidth / 2 - contentCenterX * zoom;
                      const y = canvasHeight / 2 - contentCenterY * zoom;

                      setViewport({ x, y, zoom });
                    }}
                    canUndo={effectiveReadOnly ? true : canUndo}
                    canRedo={effectiveReadOnly ? false : canRedo}
                    onSelectionChange={(
                      nodeIds: string[],
                      edgeIds: string[],
                    ) => {
                      // Update nodes selection
                      if (nodeIds.length > 0) {
                        setNodes((prev) =>
                          prev.map((node) => ({
                            ...node,
                            selected: nodeIds.includes(node.id),
                          })),
                        );
                        setSelectedNodeId(nodeIds[0] || "");
                      } else {
                        setNodes((prev) =>
                          prev.map((node) => ({
                            ...node,
                            selected: false,
                          })),
                        );
                        setSelectedNodeId("");
                      }

                      // Update edges selection
                      if (edgeIds.length > 0) {
                        setEdges((prev) =>
                          prev.map((edge) => ({
                            ...edge,
                            selected: edgeIds.includes(edge.id),
                          })),
                        );
                        setSelectedEdgeId(edgeIds[0] || "");
                      } else {
                        setEdges((prev) =>
                          prev.map((edge) => ({
                            ...edge,
                            selected: false,
                          })),
                        );
                        setSelectedEdgeId("");
                        // Box-select or other framework-driven deselect — clear Shift+click set too
                        setSelectedEdgeIds([]);
                      }
                    }}
                    inlineEditing={isPhoneViewOnly ? null : inlineEditing}
                    onInlineEditingSave={(
                      nodeId: string,
                      part: "header" | "body",
                      value: string,
                    ) => {
                      saveToHistory("Edit node text");
                      setNodes((prev) =>
                        prev.map((node) => {
                          if (node.id === nodeId) {
                            // Clear measuredHeight when inline editing ends to restore autoHeight behavior
                            const updatedNode = {
                              ...node,
                              measuredHeight: undefined,
                              data:
                                part === "header"
                                  ? { ...node.data, label: value }
                                  : { ...node.data, description: value },
                            };
                            return updatedNode;
                          }
                          return node;
                        }),
                      );
                      setInlineEditing(null);
                      setSelectedText("");
                    }}
                    onEdgeLabelSave={(edgeId: string, newLabel: string) => {
                      saveToHistory("Edit edge label");
                      setEdges((prev) =>
                        prev.map((edge) => {
                          if (edge.id === edgeId) {
                            return { ...edge, label: newLabel };
                          }
                          return edge;
                        }),
                      );
                      setInlineEditing(null);
                    }}
                    onInlineEditingCancel={() => {
                      setInlineEditing(null);
                      setSelectedText("");
                    }}
                    onTextSelectionChange={(text) => {
                      setSelectedText(text);
                    }}
                    onHyperlinkEdit={(nodeId, hyperlinkId) => {
                      const node = nodes.find((n) => n.id === nodeId);
                      if (node) {
                        // Find the node's screen position for the toolbar
                        const rect = document
                          .querySelector(
                            `[data-testid="node-${node.type}-${node.id}"]`,
                          )
                          ?.getBoundingClientRect();
                        if (rect) {
                          setLinearToolbar({
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                            nodeRect: {
                              top: rect.top,
                              bottom: rect.bottom,
                              left: rect.left,
                              right: rect.right,
                              width: rect.width,
                            },
                            node,
                            initialSubmenu: "link",
                            editingHyperlinkId: hyperlinkId,
                          });
                        }
                      }
                    }}
                    onHyperlinkDelete={(nodeId, hyperlinkId) => {
                      saveToHistory("Delete hyperlink");
                      setNodes((prev) =>
                        prev.map((n) => {
                          if (n.id !== nodeId) return n;

                          let existingLinks = n.data?.hyperlinks || [];
                          if (
                            existingLinks.length === 0 &&
                            n.data?.hyperlink?.url
                          ) {
                            if (hyperlinkId === "legacy-0") {
                              // Clear measuredHeight to allow node to shrink, clear style.height to restore autoHeight
                              return {
                                ...n,
                                measuredHeight: undefined,
                                style: n.style
                                  ? { ...n.style, height: undefined }
                                  : undefined,
                                data: {
                                  ...n.data,
                                  hyperlink: undefined,
                                  hyperlinks: [],
                                },
                              };
                            }
                            existingLinks = [
                              {
                                id: "legacy-0",
                                text: n.data.hyperlink.text,
                                url: n.data.hyperlink.url,
                              },
                            ];
                          }

                          const filteredLinks = existingLinks.filter(
                            (h: any, index: number) => {
                              if (h.id === hyperlinkId) return false;
                              if (hyperlinkId.startsWith("link-idx-")) {
                                const idx = parseInt(
                                  hyperlinkId.replace("link-idx-", ""),
                                  10,
                                );
                                if (index === idx && !h.id) return false;
                              }
                              return true;
                            },
                          );

                          // Clear measuredHeight to allow node to shrink, clear style.height to restore autoHeight
                          return {
                            ...n,
                            measuredHeight: undefined,
                            style: n.style
                              ? { ...n.style, height: undefined }
                              : undefined,
                            data: {
                              ...n.data,
                              hyperlinks: filteredLinks,
                              hyperlink: undefined,
                            },
                          };
                        }),
                      );
                    }}
                    onTextObjectHyperlinkEdit={(canvasObjectId) => {
                      const textObject = canvasObjects.find(
                        (obj) => obj.id === canvasObjectId,
                      );
                      if (textObject) {
                        const rect = document
                          .querySelector(
                            `[data-testid="text-object-${textObject.id}"]`,
                          )
                          ?.getBoundingClientRect();
                        if (rect) {
                          setLinearToolbar({
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                            nodeRect: {
                              top: rect.top,
                              bottom: rect.bottom,
                              left: rect.left,
                              right: rect.right,
                              width: rect.width,
                            },
                            canvasObject: textObject,
                            initialSubmenu: "textLink",
                          });
                        }
                      }
                    }}
                    tableData={tableData}
                    onOpenTable={(tableId) => {
                      setOpenTablePanel(tableId);
                    }}
                    onTableDataChange={(tableId, table) => {
                      setTableData((prev) => ({
                        ...prev,
                        [tableId]: table,
                      }));
                    }}
                    onCreateNodeFromRow={(tableId, row, rowIndex) => {
                      // Find the table node to get its position and metadata
                      const tableNode = nodes.find(
                        (n) =>
                          n.type === "table" && n.data?.tableId === tableId,
                      );
                      const table =
                        tableNode?.data?.table || tableData[tableId];
                      const basePosition = tableNode
                        ? {
                            x:
                              tableNode.position.x +
                              (tableNode.width || 560) +
                              50,
                            y: tableNode.position.y + rowIndex * 140,
                          }
                        : getViewportCenteredPosition();

                      // Get column info for display config
                      const columns = table?.columns || [];
                      const primaryColumnId =
                        table?.meta?.primaryColumnId || columns[0]?.id;

                      // Create row ID based on table row or generate one
                      const tableRow = table?.rows?.[rowIndex];
                      const rowId = tableRow?.id || `row-${rowIndex}`;

                      // Get primary value for label
                      const primaryValue =
                        primaryColumnId && row[primaryColumnId] !== undefined
                          ? String(row[primaryColumnId])
                          : Object.values(row)
                              .slice(0, 1)
                              .filter(Boolean)
                              .join("") || `Row ${rowIndex + 1}`;

                      // Create FormNode with fields bound to each table column
                      const nodeId = `node-${Date.now()}`;
                      const timestamp = Date.now();

                      // Generate form fields from table columns with data links
                      const formFields: import("../lib/kiteframe/types").FormNodeField[] =
                        columns.map(
                          (col: { id: string; name: string }, idx: number) => {
                            const cellValue = row[col.id];
                            return {
                              id: `field-${timestamp}-${idx}`,
                              label: col.name,
                              value:
                                cellValue !== null && cellValue !== undefined
                                  ? String(cellValue)
                                  : "",
                              type: "text" as import("../lib/kiteframe/types").FormFieldType,
                              placeholder: `Enter ${col.name}...`,
                              dataLink: {
                                tableId: tableId,
                                columnId: col.id,
                                rowId: rowId,
                                displayValue:
                                  cellValue !== null && cellValue !== undefined
                                    ? String(cellValue)
                                    : "",
                              },
                            };
                          },
                        );

                      const newNode: Node = {
                        id: nodeId,
                        type: "form",
                        position: basePosition,
                        data: {
                          formTitle: `Row ${rowIndex + 1}`,
                          fields: formFields,
                          showLabels: true,
                          layout: "vertical",
                          linkedTableId: tableId,
                          linkedTableNodeId: tableNode?.id,
                          linkedTableName:
                            tableNode?.data?.label || table?.name || "Table",
                          linkedRowIndex: rowIndex + 1,
                          colors: {
                            headerBackground: "#6366f1",
                            bodyBackground: "#ffffff",
                            headerTextColor: "#ffffff",
                          },
                        },
                        width: 320,
                        height: Math.min(
                          Math.max(200, 80 + columns.length * 60),
                          600,
                        ),
                      };

                      saveToHistory("Create form from table row");

                      setNodes((prev) => [...prev, newNode]);

                      // Create edge between table and form with link emoji
                      if (tableNode) {
                        const newEdge: import("../lib/kiteframe/types").Edge = {
                          id: `edge-${Date.now()}`,
                          source: tableNode.id,
                          target: nodeId,
                          type: "bezier",
                          label: "🔗",
                          labelStyle: {
                            fontSize: 14,
                            backgroundColor: "#ffffff",
                            padding: 4,
                            borderRadius: 8,
                          },
                          style: {
                            strokeWidth: 2,
                            stroke: "#6366f1",
                          },
                          data: {
                            isDataLink: true,
                            linkedTableId: tableId,
                            linkedRowIndex: rowIndex + 1,
                          },
                        };
                        setEdges((prev) => [...prev, newEdge]);
                      }

                      toast({
                        title: "Form Created",
                        description: `Created form with ${columns.length} linked fields from row ${rowIndex + 1}`,
                        variant: "default",
                      });
                    }}
                    onFocusNode={focusOnNode}
                    onFormLinkTable={(nodeId) => {
                      const tableNodes = nodes.filter(
                        (n) => n.type === "table",
                      );
                      if (tableNodes.length === 0) {
                        toast({
                          title: "No Tables Available",
                          description:
                            "Create a table node first to link it to this form.",
                          variant: "default",
                        });
                        return;
                      }
                      setTableLinkPicker({ formNodeId: nodeId });
                    }}
                    onFormUnlinkTable={(nodeId) => {
                      // Get the linked table node ID before clearing
                      const formNode = nodes.find((n) => n.id === nodeId);
                      const linkedTableNodeId = (formNode?.data as any)
                        ?.linkedTableNodeId;

                      saveToHistory("Unlink form from table");

                      // Delete the edge between form and table
                      if (linkedTableNodeId) {
                        setEdges((prev) =>
                          prev.filter(
                            (e) =>
                              !(
                                (e.source === nodeId &&
                                  e.target === linkedTableNodeId) ||
                                (e.source === linkedTableNodeId &&
                                  e.target === nodeId)
                              ),
                          ),
                        );
                      }

                      // Clear the form data links
                      setNodes((prev) =>
                        prev.map((n) => {
                          if (n.id === nodeId) {
                            const formData =
                              n.data as import("../lib/kiteframe/types").FormNodeData;
                            const clearedFields =
                              formData.fields?.map((field) => ({
                                ...field,
                                dataLink: undefined,
                              })) || [];
                            return {
                              ...n,
                              data: {
                                ...n.data,
                                fields: clearedFields,
                                linkedTableId: undefined,
                                linkedTableNodeId: undefined,
                                linkedTableName: undefined,
                                linkedRowIndex: undefined,
                              },
                            };
                          }
                          return n;
                        }),
                      );
                      toast({
                        title: "Table Unlinked",
                        description: "Form is no longer linked to a table.",
                        variant: "default",
                      });
                    }}
                    onUpdateTableCell={(tableId, rowId, columnId, value) => {
                      setTableData((prev) => {
                        const table = prev[tableId];
                        if (!table) return prev;

                        const updatedRows = table.rows.map((row) => {
                          if (row.id === rowId) {
                            return {
                              ...row,
                              values: {
                                ...row.values,
                                [columnId]: value,
                              },
                            };
                          }
                          return row;
                        });

                        return {
                          ...prev,
                          [tableId]: {
                            ...table,
                            rows: updatedRows,
                          },
                        };
                      });

                      setNodes((prev) =>
                        prev.map((n) => {
                          if (
                            n.type === "table" &&
                            n.data?.tableId === tableId
                          ) {
                            const tableNodeData = n.data as TableNodeData;
                            if (tableNodeData.table) {
                              const updatedRows = tableNodeData.table.rows.map(
                                (row) => {
                                  if (row.id === rowId) {
                                    return {
                                      ...row,
                                      values: {
                                        ...row.values,
                                        [columnId]: value,
                                      },
                                    };
                                  }
                                  return row;
                                },
                              );
                              return {
                                ...n,
                                data: {
                                  ...n.data,
                                  table: {
                                    ...tableNodeData.table,
                                    rows: updatedRows,
                                  },
                                },
                              };
                            }
                          }
                          return n;
                        }),
                      );
                    }}
                    savedTemplates={savedTemplates}
                    onGenerateFromTemplate={handleGenerateFromTemplate}
                    flowSettings={activeTab?.flowSettings}
                    onFlowSettingsChange={(flowId, settings) => {
                      updateActiveTab({
                        flowSettings: {
                          ...activeTab?.flowSettings,
                          [flowId]: settings,
                        },
                      });
                    }}
                    onResetFlowStatuses={(flowId) => {
                      // Reset all node statuses in the flow
                      const flowNodes = nodes.filter((n) => {
                        // Find nodes that belong to this flow by checking connectivity
                        return true; // For now, just reset all - flow detection handles this
                      });
                      setNodes(
                        nodes.map((n) => ({
                          ...n,
                          data: { ...n.data, status: undefined },
                        })),
                      );
                    }}
                    onNodeStatusChange={(nodeId) => {
                      // Cycle status: undefined/todo -> inprogress -> done -> undefined
                      saveToHistory("Change node status");
                      setNodes((prev) =>
                        prev.map((n) => {
                          if (n.id === nodeId) {
                            const currentStatus = n.data?.status;
                            let nextStatus: string | undefined;
                            if (!currentStatus || currentStatus === "todo") {
                              nextStatus = "inprogress";
                            } else if (currentStatus === "inprogress") {
                              nextStatus = "done";
                            } else {
                              nextStatus = undefined; // Cycle back to todo/undefined
                            }
                            return {
                              ...n,
                              data: { ...n.data, status: nextStatus },
                            };
                          }
                          return n;
                        }),
                      );
                    }}
                    onApplyTheme={(flowId, theme) => {
                      saveToHistory("Apply workflow theme");
                      setNodes((prev) =>
                        prev.map((n) => {
                          // Check if this node belongs to the flow
                          const flows = FlowDetection.detectFlows(prev, edges);
                          const flow = flows.find((f) => f.id === flowId);
                          if (flow && flow.nodes.some((fn) => fn.id === n.id)) {
                            return {
                              ...n,
                              data: applyThemeToNode(n.data || {}, theme),
                            };
                          }
                          return n;
                        }),
                      );
                      setEdges((prev) =>
                        prev.map((e) => {
                          const flows = FlowDetection.detectFlows(nodes, prev);
                          const flow = flows.find((f) => f.id === flowId);
                          if (flow) {
                            const nodeIds = flow.nodes.map((n) => n.id);
                            if (
                              nodeIds.includes(e.source) &&
                              nodeIds.includes(e.target)
                            ) {
                              return applyThemeToEdge(e, theme);
                            }
                          }
                          return e;
                        }),
                      );
                    }}
                    onDeleteWorkflow={(flowId, nodeIds) => {
                      saveToHistory("Delete workflow");
                      // Remove all nodes in the workflow
                      setNodes((prev) =>
                        prev.filter((n) => !nodeIds.includes(n.id)),
                      );
                      // Edges connected to deleted nodes are automatically cleaned up
                      setEdges((prev) =>
                        prev.filter(
                          (e) =>
                            !nodeIds.includes(e.source) &&
                            !nodeIds.includes(e.target),
                        ),
                      );
                    }}
                    onDragWorkflow={(
                      flowId,
                      nodeIds,
                      deltaX,
                      deltaY,
                      isDragStart,
                    ) => {
                      // Save to history only at drag start to create single undo entry
                      if (isDragStart) {
                        saveToHistory("Drag workflow");
                      }
                      setNodes((prev) =>
                        prev.map((n) => {
                          if (nodeIds.includes(n.id)) {
                            return {
                              ...n,
                              position: {
                                x: n.position.x + deltaX,
                                y: n.position.y + deltaY,
                              },
                            };
                          }
                          return n;
                        }),
                      );
                    }}
                    onLayoutWorkflow={(flowId, nodeIds, layoutType) => {
                      // Create position map for new positions (immutable approach)
                      const newPositions: Map<
                        string,
                        { x: number; y: number }
                      > = new Map();

                      // Get workflow nodes and edges (create copies for calculation only)
                      const workflowNodeData = nodes
                        .filter((n) => nodeIds.includes(n.id))
                        .map((n) => ({
                          id: n.id,
                          x: n.position.x,
                          y: n.position.y,
                          width: n.style?.width ?? n.width ?? 200,
                          height: n.style?.height ?? n.height ?? 100,
                        }));
                      const workflowEdges = edges.filter(
                        (e) =>
                          nodeIds.includes(e.source) &&
                          nodeIds.includes(e.target),
                      );

                      // Guard: no work to do if empty
                      if (workflowNodeData.length === 0) return;

                      // Save to history only after validation
                      saveToHistory("Apply layout");

                      // Calculate the workflow's current bounding box to preserve position
                      const minX = Math.min(
                        ...workflowNodeData.map((n) => n.x),
                      );
                      const minY = Math.min(
                        ...workflowNodeData.map((n) => n.y),
                      );

                      // Apply layout based on type
                      const horizontalSpacing = 280;
                      const verticalSpacing = 180;

                      // Helper: BFS depth layering shared by all three tree layouts
                      const computeDepthLayers = () => {
                        const targetIds = new Set(
                          workflowEdges.map((e) => e.target),
                        );
                        const rootIds = workflowNodeData
                          .filter((n) => !targetIds.has(n.id))
                          .map((n) => n.id);
                        if (rootIds.length === 0 && workflowNodeData.length > 0) {
                          rootIds.push(workflowNodeData[0].id);
                        }

                        const depthMap: Map<string, number> = new Map();
                        const bfsQ: string[] = [...rootIds];
                        rootIds.forEach((id) => depthMap.set(id, 0));
                        const maxIter =
                          workflowNodeData.length * workflowNodeData.length;
                        let iter = 0;
                        while (bfsQ.length > 0 && iter < maxIter) {
                          iter++;
                          const cur = bfsQ.shift()!;
                          const d = depthMap.get(cur) ?? 0;
                          workflowEdges
                            .filter((e) => e.source === cur)
                            .forEach((e) => {
                              if (depthMap.get(e.target) === undefined) {
                                depthMap.set(e.target, d + 1);
                                bfsQ.push(e.target);
                              }
                            });
                        }
                        workflowNodeData.forEach((n) => {
                          if (!depthMap.has(n.id)) depthMap.set(n.id, 0);
                        });

                        const layers: Map<number, typeof workflowNodeData> =
                          new Map();
                        workflowNodeData.forEach((n) => {
                          const d = depthMap.get(n.id) ?? 0;
                          if (!layers.has(d)) layers.set(d, []);
                          layers.get(d)!.push(n);
                        });
                        const sortedDepths = Array.from(layers.keys()).sort(
                          (a, b) => a - b,
                        );
                        return { layers, sortedDepths };
                      };

                      // Barycentric crossing minimisation: sort nodes within each
                      // layer by the average index of their parents in the
                      // previous layer.  Two forward sweeps handle most cases.
                      const minimizeCrossings = (
                        layers: Map<number, typeof workflowNodeData>,
                        sortedDepths: number[],
                      ) => {
                        for (let pass = 0; pass < 2; pass++) {
                          sortedDepths.forEach((depth, layerIdx) => {
                            if (layerIdx === 0) return;
                            const prevLayer = layers.get(
                              sortedDepths[layerIdx - 1],
                            )!;
                            const prevPos: Map<string, number> = new Map();
                            prevLayer.forEach((n, i) => prevPos.set(n.id, i));

                            const layer = layers.get(depth)!;
                            const curPos: Map<string, number> = new Map();
                            layer.forEach((n, i) => curPos.set(n.id, i));

                            layer.sort((a, b) => {
                              const bary = (nodeId: string): number => {
                                const pp = workflowEdges
                                  .filter(
                                    (e) =>
                                      e.target === nodeId &&
                                      prevPos.has(e.source),
                                  )
                                  .map((e) => prevPos.get(e.source)!);
                                return pp.length > 0
                                  ? pp.reduce((s, v) => s + v, 0) / pp.length
                                  : curPos.get(nodeId)!;
                              };
                              return bary(a.id) - bary(b.id);
                            });
                          });
                        }
                      };

                      // Left-to-right tree: depth = column (X), nodes in column spread vertically
                      const applyHorizontalTree = () => {
                        const { layers, sortedDepths } = computeDepthLayers();
                        minimizeCrossings(layers, sortedDepths);
                        let maxLayerHeight = 0;
                        layers.forEach((layer) => {
                          const lh =
                            layer.reduce((s, n) => s + n.height, 0) +
                            (layer.length - 1) * 60;
                          maxLayerHeight = Math.max(maxLayerHeight, lh);
                        });
                        sortedDepths.forEach((depth, colIdx) => {
                          const layer = layers.get(depth)!;
                          const lh =
                            layer.reduce((s, n) => s + n.height, 0) +
                            (layer.length - 1) * 60;
                          let yOff = minY + (maxLayerHeight - lh) / 2;
                          layer.forEach((node) => {
                            newPositions.set(node.id, {
                              x: minX + colIdx * horizontalSpacing,
                              y: yOff,
                            });
                            yOff += node.height + 60;
                          });
                        });
                      };

                      // Top-to-bottom tree: depth = row (Y), nodes in row spread horizontally
                      const applyVerticalTree = () => {
                        const { layers, sortedDepths } = computeDepthLayers();
                        minimizeCrossings(layers, sortedDepths);
                        let maxLayerWidth = 0;
                        layers.forEach((layer) => {
                          const lw =
                            layer.reduce((s, n) => s + n.width, 0) +
                            (layer.length - 1) * 80;
                          maxLayerWidth = Math.max(maxLayerWidth, lw);
                        });
                        sortedDepths.forEach((depth, rowIdx) => {
                          const layer = layers.get(depth)!;
                          const lw =
                            layer.reduce((s, n) => s + n.width, 0) +
                            (layer.length - 1) * 80;
                          let xOff = minX + (maxLayerWidth - lw) / 2;
                          layer.forEach((node) => {
                            newPositions.set(node.id, {
                              x: xOff,
                              y: minY + rowIdx * verticalSpacing,
                            });
                            xOff += node.width + 80;
                          });
                        });
                      };

                      switch (layoutType) {
                        case "horizontal":
                          // Left-to-right layered tree (depth = column, spread vertically)
                          applyHorizontalTree();
                          break;

                        case "vertical":
                          // Top-to-bottom layered tree (depth = row, spread horizontally)
                          applyVerticalTree();
                          break;

                        case "hierarchical":
                        default: {
                          // Direction-aware Tidy: detect flow direction from bounding box
                          const maxX_bb = Math.max(
                            ...workflowNodeData.map((n) => n.x + n.width),
                          );
                          const maxY_bb = Math.max(
                            ...workflowNodeData.map((n) => n.y + n.height),
                          );
                          const bbWidth = maxX_bb - minX;
                          const bbHeight = maxY_bb - minY;
                          if (bbWidth >= bbHeight) {
                            applyHorizontalTree();
                          } else {
                            applyVerticalTree();
                          }
                          break;
                        }
                      }

                      // Apply new positions immutably through setNodes
                      setNodes((prev) =>
                        prev.map((n) => {
                          const newPos = newPositions.get(n.id);
                          if (newPos) {
                            return {
                              ...n,
                              position: { ...newPos },
                            };
                          }
                          return n;
                        }),
                      );
                    }}
                    onRefreshFigma={async (nodeId: string) => {
                      const node = nodes.find(n => n.id === nodeId);
                      if (!node || node.type !== 'image') return;
                      
                      const { figmaFileKey, figmaNodeId, figmaLastModified, imageUrl } = node.data as any;
                      if (!figmaFileKey || !figmaNodeId) return;
                      
                      try {
                        // First, check if file has been modified
                        const { fetchFigmaFileMetadata, fetchFigmaNodeThumbnail } = await import('@/lib/integration/figmaApi');
                        const metadata = await fetchFigmaFileMetadata(figmaFileKey);
                        
                        if (metadata.lastModified === figmaLastModified) {
                          toast({
                            title: "Already up to date",
                            description: "The Figma design hasn't changed since last refresh.",
                          });
                          return;
                        }
                        
                        // Fetch new thumbnail
                        const newThumbnail = await fetchFigmaNodeThumbnail(figmaFileKey, figmaNodeId);
                        
                        if (!newThumbnail) {
                          toast({
                            title: "Refresh failed",
                            description: "Could not get updated image from Figma.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        // Update node with new image, metadata, and cache timestamp
                        saveToHistory("Refresh Figma image");
                        setNodes(prev => prev.map(n => {
                          if (n.id === nodeId) {
                            return {
                              ...n,
                              data: {
                                ...n.data,
                                src: newThumbnail,
                                figmaLastModified: metadata.lastModified,
                                cachedAt: new Date().toISOString(),
                              }
                            };
                          }
                          return n;
                        }));
                        
                        toast({
                          title: "Image refreshed",
                          description: "Figma design has been updated.",
                        });
                      } catch (error) {
                        console.error('Error refreshing Figma image:', error);
                        toast({
                          title: "Refresh failed",
                          description: "Could not refresh the Figma image. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                    isFigmaAuthenticated={isFigmaAuthenticated}
                    isAdvanced={subscriptionTier !== 'free'}
                    onFigmaFrameAdd={async (nodeId: string, figmaUrl: string) => {
                      const { parseFigmaUrl } = await import('@/lib/integration/figmaUrl');
                      const parsed = parseFigmaUrl(figmaUrl);
                      if (!parsed) {
                        throw new Error('Invalid Figma URL. Please paste a link from figma.com.');
                      }
                      if (!parsed.nodeId) {
                        throw new Error('URL must point to a specific frame. Select a frame in Figma and copy its link.');
                      }
                      const { fetchFigmaNodeThumbnail } = await import('@/lib/integration/figmaApi');
                      const thumbnail = await fetchFigmaNodeThumbnail(parsed.fileKey, parsed.nodeId);
                      if (!thumbnail) {
                        throw new Error('Could not fetch image from Figma. Make sure Figma is connected in Settings.');
                      }
                      saveToHistory('Add Figma frame');
                      setNodes((prev) =>
                        prev.map((n) =>
                          n.id === nodeId
                            ? {
                                ...n,
                                data: {
                                  ...n.data,
                                  src: thumbnail,
                                  figmaFileKey: parsed.fileKey,
                                  figmaId: parsed.nodeId,
                                  sourceType: 'figma',
                                  cachedAt: new Date().toISOString(),
                                  isImageBroken: false,
                                },
                              }
                            : n,
                        ),
                      );
                      toast({ title: 'Figma frame imported', description: 'Image loaded from Figma.' });
                    }}
                    onExperimentGenerateBranch={async (nodeId: string, currentDescription?: string) => {
                      const rawNode = nodes.find(n => n.id === nodeId);
                      if (!rawNode || rawNode.type !== 'experiment') return;
                      
                      const node = normalizeNodeForMutation(rawNode, activeTab?.id || 'default');
                      const data = node.data as ExperimentNodeData;
                      
                      setNodes(prev => prev.map(n => 
                        n.id === nodeId 
                          ? { 
                              ...node,
                              data: { 
                                ...data, 
                                generation: { 
                                  ...data.generation, 
                                  status: 'generating' as const,
                                  errorMessage: undefined 
                                } 
                              } 
                            }
                          : n
                      ));
                      
                      try {
                        const promptContent = currentDescription || data.userPrompt || data.selectedOptionDescription || data.selectedOptionLabel || '';
                        const experimentId = `exp-${nodeId}-${Date.now()}`;
                        const generatedAt = Date.now();
                        
                        const anchorNodeId = getAnchorNodeId(nodeId, nodes, edges);
                        if (!anchorNodeId) {
                          throw new Error('Could not find anchor node for experiment');
                        }
                        
                        const anchorNode = nodes.find(n => n.id === anchorNodeId);
                        if (!anchorNode) {
                          throw new Error('Anchor node not found');
                        }
                        
                        const context = buildExperimentContext({
                          experimentNodeId: nodeId,
                          nodes,
                          edges,
                          workflowName: activeTab?.name || 'Workflow',
                        });
                        
                        if (!context) {
                          throw new Error('Could not build experiment context');
                        }
                        
                        const result = await generateExperimentBranch(routerAiClient, {
                          mode: data.mode || 'whatif',
                          context,
                          origin: data.origin || 'experiment',
                          selectedOptionLabel: data.selectedOptionLabel || '',
                          selectedOptionDescription: data.selectedOptionDescription || promptContent,
                          userPrompt: promptContent,
                          anchorNodeId,
                          anchorNodeLabel: (anchorNode.data as any)?.label || anchorNode.type || 'Node',
                          anchorNodePosition: anchorNode.position,
                        });
                        
                        if (result.success && result.branch) {
                          const branch = result.branch;
                          const generatedNodeIds = branch.nodes.map(n => n.id!);
                          const generatedEdgeIds = branch.edges.map(e => e.id!);
                          const experimentId = `exp-${nodeId}-${Date.now()}`;
                          const generatedAt = Date.now();
                          
                          const previewNodes: Node[] = branch.nodes.map(n => ({
                            id: n.id!,
                            type: n.type || 'process',
                            position: n.position!,
                            data: { ...n.data, ui: { ...n.data?.ui, preview: true } },
                            meta: { 
                              speculative: true, 
                              experimentId,
                              generatedFrom: { nodeId, ts: generatedAt } 
                            },
                          }));
                          const previewEdges: Edge[] = branch.edges.map(e => ({
                            id: e.id!,
                            source: e.source === anchorNodeId ? nodeId : e.source!,
                            target: e.target!,
                            type: e.type || 'smoothstep',
                            label: e.label,
                            meta: { 
                              speculative: true, 
                              experimentId,
                              generatedFrom: { nodeId, ts: generatedAt },
                              originalSource: e.source === anchorNodeId ? anchorNodeId : undefined,
                            },
                            style: { ...(e.style || {}), strokeOpacity: 0.8, strokeDasharray: '5,5' }
                          }));
                          
                          logPreviewTopology({
                            previewAnchorNodeId: nodeId,
                            originNodeId: anchorNodeId,
                            previewBranchNodeIds: generatedNodeIds,
                            expectedEdgePattern: 'branches_attach_to_experiment_node'
                          });
                          
                          previewNodes.forEach(n => {
                            warnContentContractViolation({
                              nodeId: n.id,
                              header: n.data?.label,
                              body: n.data?.description,
                              isAIGenerated: true,
                            });
                          });
                          
                          // Get existing generated IDs to clear before adding new ones
                          const existingNodeIds = data.generation?.generatedNodeIds || [];
                          const existingEdgeIds = data.generation?.generatedEdgeIds || [];
                          
                          setNodes(prev => {
                            // Filter out previous speculative nodes for this experiment
                            const filtered = prev.filter(n => !existingNodeIds.includes(n.id));
                            return [
                              ...filtered.map(n => 
                                n.id === nodeId 
                                  ? { 
                                      ...node,
                                      meta: {
                                        ...node.meta,
                                        experimentId,
                                        experiment: {
                                          experimentId,
                                          originNodeId: nodeId,
                                          mode: data.mode,
                                          selectedOptionId: data.selectedOptionId,
                                          selectedOptionLabel: data.selectedOptionLabel || promptContent,
                                          selectedOptionDescription: data.selectedOptionDescription || promptContent,
                                          userPrompt: promptContent,
                                          generatedNodeIds,
                                          generatedEdgeIds,
                                          generatedAt,
                                        },
                                      },
                                      data: { 
                                        ...data, 
                                        userPrompt: promptContent,
                                        anchor: {
                                          ...data.anchor,
                                          anchorNodeId,
                                        },
                                        generation: { 
                                          status: 'generated' as const,
                                          lastGeneratedAt: generatedAt,
                                          generatedNodeIds,
                                          generatedEdgeIds,
                                        },
                                      } 
                                    }
                                  : n
                              ),
                              ...previewNodes
                            ];
                          });
                          // Filter out previous speculative edges before adding new ones
                          setEdges(prev => {
                            const filtered = prev.filter(e => !existingEdgeIds.includes(e.id));
                            return [...filtered, ...previewEdges];
                          });
                          
                          logRenderedGraph({
                            nodes: previewNodes.map(n => ({
                              id: n.id,
                              type: n.type || 'process',
                              header: n.data?.label,
                              body: n.data?.description,
                            })),
                            edges: previewEdges.map(e => ({
                              source: e.source,
                              target: e.target,
                            })),
                          });
                          
                          toast({
                            title: "Branch generated",
                            description: `Created ${branch.nodes.length} preview nodes. Review and adopt or discard.`,
                          });
                        } else {
                          setNodes(prev => prev.map(n => 
                            n.id === nodeId 
                              ? { 
                                  ...node, 
                                  data: { 
                                    ...data, 
                                    generation: { 
                                      ...data.generation,
                                      status: 'error' as const,
                                      errorMessage: result.error || 'Generation failed',
                                      generatedNodeIds: [],
                                      generatedEdgeIds: [],
                                    } 
                                  } 
                                }
                              : n
                          ));
                          toast({
                            title: "Generation failed",
                            description: result.error || "Could not generate branch.",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        console.error('Error generating experiment branch:', error);
                        setNodes(prev => prev.map(n => 
                          n.id === nodeId 
                            ? { 
                                ...node, 
                                data: { 
                                  ...data, 
                                  generation: { 
                                    ...data.generation,
                                    status: 'error' as const,
                                    errorMessage: 'An error occurred',
                                    generatedNodeIds: [],
                                    generatedEdgeIds: [],
                                  } 
                                } 
                              }
                            : n
                        ));
                        toast({
                          title: "Generation failed",
                          description: "An error occurred while generating the branch.",
                          variant: "destructive",
                        });
                      }
                    }}
                    onExperimentAdoptBranch={(nodeId: string) => {
                      const rawNode = nodes.find(n => n.id === nodeId);
                      if (!rawNode || rawNode.type !== 'experiment') {
                        return;
                      }
                      
                      const node = normalizeNodeForMutation(rawNode, activeTab?.id || 'default');
                      const data = node.data as ExperimentNodeData;
                      const generatedNodeIds = data.generation?.generatedNodeIds || [];
                      const generatedEdgeIds = data.generation?.generatedEdgeIds || [];
                      
                      if (generatedNodeIds.length === 0 && generatedEdgeIds.length === 0) {
                        toast({
                          title: "No branch to adopt",
                          description: "Generate a branch first before accepting.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      logCommitAccept({
                        removedNodeId: nodeId,
                        reattachedBranches: generatedNodeIds,
                        newParentNodeId: data.anchor?.anchorNodeId || '',
                      });
                      
                      const experimentContent = data.userPrompt || data.selectedOptionDescription || data.selectedOptionLabel || '';
                      
                      const nodeIdSet = new Set(generatedNodeIds);
                      const edgeIdSet = new Set(generatedEdgeIds);
                      
                      const processNodeDefaults = { width: 180, height: 100, measuredWidth: 180, measuredHeight: 100 };
                      const defaultNodeStyle = {
                        headerBackground: '#4f46e5',
                        headerText: '#ffffff',
                        bodyBackground: '#eef2ff',
                        bodyText: '#334155',
                        border: '#4f46e5',
                      };
                      
                      const acceptedAt = Date.now();
                      const experimentMeta = node.meta?.experiment;
                      const experimentId = node.meta?.experimentId;
                      
                      const incomingEdge = edges.find(e => e.target === nodeId);
                      const anchorNodeId = data.anchor?.anchorNodeId 
                        || experimentMeta?.originNodeId 
                        || (node.meta as any)?.generatedFrom?.nodeId
                        || incomingEdge?.source;
                      
                      const commitTimestamp = Date.now();
                      const nodeIdRemap = new Map<string, string>();
                      const edgeIdRemap = new Map<string, string>();
                      
                      generatedNodeIds.forEach((oldId, index) => {
                        nodeIdRemap.set(oldId, `committed-node-${commitTimestamp}-${index}`);
                      });
                      generatedEdgeIds.forEach((oldId, index) => {
                        edgeIdRemap.set(oldId, `committed-edge-${commitTimestamp}-${index}`);
                      });

                      saveToHistory("Adopt speculative branch");
                      
                      setNodes(prev => {
                        const filtered = prev.filter(n => n.id !== nodeId);
                        return filtered.map(n => {
                          if (nodeIdSet.has(n.id)) {
                            const cleared = clearPreviewFlags(n);
                            const newId = nodeIdRemap.get(n.id) || n.id;
                            return {
                              ...cleared,
                              id: newId,
                              meta: {
                                ...cleared.meta,
                                experimentId,
                                speculative: false,
                                experiment: experimentMeta ? {
                                  ...experimentMeta,
                                  acceptedAt,
                                } : undefined,
                              },
                              width: cleared.width || processNodeDefaults.width,
                              height: cleared.height || processNodeDefaults.height,
                              measuredWidth: cleared.measuredWidth || processNodeDefaults.measuredWidth,
                              measuredHeight: cleared.measuredHeight || processNodeDefaults.measuredHeight,
                              style: {
                                ...cleared.style,
                                ...defaultNodeStyle,
                              },
                            };
                          }
                          return n;
                        });
                      });
                      
                      setEdges(prev => {
                        const filteredEdges = prev.filter(e => {
                          if (e.target === nodeId) return false;
                          if (e.source === nodeId && !edgeIdSet.has(e.id)) return false;
                          return true;
                        });
                        
                        const remappedEdges = filteredEdges.map(e => {
                          if (edgeIdSet.has(e.id)) {
                            const originalSource = (e.meta as any)?.originalSource;
                            const cleared = clearEdgePreviewFlags(e);
                            const newId = edgeIdRemap.get(e.id) || e.id;
                            let newSource: string;
                            if (originalSource) {
                              newSource = originalSource;
                            } else if (e.source === nodeId) {
                              newSource = anchorNodeId || e.source;
                            } else {
                              newSource = nodeIdRemap.get(e.source) || e.source;
                            }
                            const newTarget = nodeIdRemap.get(e.target) || e.target;
                            
                            return {
                              ...cleared,
                              id: newId,
                              source: newSource,
                              target: newTarget,
                              meta: {
                                ...cleared.meta,
                                experimentId,
                                speculative: false,
                                originalSource: undefined,
                              },
                              markerEnd: cleared.markerEnd !== undefined ? cleared.markerEnd : true,
                              style: {
                                ...cleared.style,
                                strokeColor: cleared.style?.strokeColor || '#64748b',
                                strokeDasharray: undefined,
                              },
                            };
                          }
                          const remappedSource = nodeIdRemap.get(e.source) || e.source;
                          const remappedTarget = nodeIdRemap.get(e.target) || e.target;
                          if (remappedSource !== e.source || remappedTarget !== e.target) {
                            return { ...e, source: remappedSource, target: remappedTarget };
                          }
                          return e;
                        });
                        
                        const firstCommittedNodeId = generatedNodeIds.length > 0 ? nodeIdRemap.get(generatedNodeIds[0]) : null;
                        const anchorEdges = anchorNodeId && firstCommittedNodeId 
                          ? remappedEdges.filter(e => e.source === anchorNodeId && e.target === firstCommittedNodeId)
                          : [];
                        
                        return remappedEdges;
                      });
                      
                      logCommitFinalGraph({
                        nodes: Array.from(nodeIdRemap.values()),
                        edges: Array.from(edgeIdRemap.entries()).map(([oldId, newId]) => {
                          const edge = edges.find(e => e.id === oldId);
                          const originalSource = (edge?.meta as any)?.originalSource;
                          let source: string;
                          if (originalSource) {
                            source = originalSource;
                          } else if (edge?.source === nodeId) {
                            source = anchorNodeId || '';
                          } else {
                            source = nodeIdRemap.get(edge?.source || '') || edge?.source || '';
                          }
                          return { 
                            id: newId,
                            source,
                            target: nodeIdRemap.get(edge?.target || '') || edge?.target || '' 
                          };
                        }),
                      });
                      
                      toast({
                        title: "Branch adopted",
                        description: "The speculative branch is now part of the workflow.",
                      });
                    }}
                    onExperimentDiscardBranch={(nodeId: string) => {
                      const rawNode = nodes.find(n => n.id === nodeId);
                      if (!rawNode || rawNode.type !== 'experiment') return;
                      
                      const node = normalizeNodeForMutation(rawNode, activeTab?.id || 'default');
                      const data = node.data as ExperimentNodeData;
                      const generatedNodeIds = data.generation?.generatedNodeIds || [];
                      const generatedEdgeIds = data.generation?.generatedEdgeIds || [];
                      
                      if (generatedNodeIds.length === 0 && generatedEdgeIds.length === 0) return;
                      
                      const nodeIdSet = new Set(generatedNodeIds);
                      const edgeIdSet = new Set(generatedEdgeIds);
                      
                      setNodes(prev => prev
                        .filter(n => !nodeIdSet.has(n.id))
                        .map(n => n.id === nodeId 
                          ? { 
                              ...n, 
                              data: { 
                                ...n.data, 
                                generation: {
                                  status: 'idle' as const,
                                  generatedNodeIds: [],
                                  generatedEdgeIds: [],
                                }
                              } 
                            }
                          : n
                        )
                      );
                      
                      setEdges(prev => prev.filter(e => !edgeIdSet.has(e.id)));
                      
                      toast({
                        title: "Branch discarded",
                        description: "The preview branch has been removed.",
                      });
                    }}
                    experimentOptionsMap={experimentOptionsMap}
                    onExperimentRefreshOptions={(nodeId: string) => {
                      const node = nodes.find(n => n.id === nodeId);
                      if (!node) return;
                      const data = node.data as any;
                      const mode = data.mode || 'whatif';
                      if (mode !== 'open_exploration') {
                        refreshExperimentOptions(nodeId, mode);
                      }
                    }}
                    onExperimentGenerateOptionsForMode={(nodeId: string, mode: import('../lib/kiteframe/types').ExperimentMode) => {
                      generateExperimentOptionsForNode(nodeId, mode);
                    }}
                    onExperimentRegenerate={(nodeId: string, mode: import('../lib/kiteframe/types').ExperimentMode) => {
                      const node = nodes.find(n => n.id === nodeId);
                      if (!node) return;
                      
                      const existingMeta = node.meta?.experiment as import('../lib/kiteframe/types').ExperimentMeta | undefined;
                      if (!existingMeta) return;
                      
                      saveToHistory("Regenerate experiment from adopted node");
                      
                      invalidateExperimentNode(nodeId);
                      
                      const workflowId = activeTab?.id || 'default';
                      const newExperimentId = `exp-${nodeId}-${Date.now()}`;
                      const generatedAt = Date.now();
                      
                      const updatedExperimentMeta: import('../lib/kiteframe/types').ExperimentMeta = {
                        experimentId: newExperimentId,
                        originNodeId: existingMeta.originNodeId || nodeId,
                        mode: mode,
                        userPrompt: existingMeta.userPrompt,
                        selectedOptionId: undefined,
                        selectedOptionLabel: undefined,
                        selectedOptionDescription: undefined,
                        generatedNodeIds: [],
                        generatedEdgeIds: [],
                        generatedAt,
                      };
                      
                      setNodes(prev => prev.map(n => {
                        if (n.id === nodeId) {
                          const { experiment: _oldExp, acceptedAt: _oldAccepted, speculative: _oldSpec, ...preservedMeta } = (n.meta || {}) as any;
                          
                          const incomingEdges = edges.filter(e => e.target === nodeId);
                          const anchorNodeId = incomingEdges.length > 0 ? incomingEdges[0].source : existingMeta.originNodeId;
                          
                          const convertedNode: Node = {
                            ...n,
                            type: 'experiment' as const,
                            width: 320,
                            height: 480,
                            measuredWidth: 320,
                            measuredHeight: 480,
                            data: {
                              label: mode === 'whatif' ? 'What-If' : mode === 'enhancement' ? 'Enhancement' : mode === 'open_exploration' ? 'Open Exploration' : 'Experiment',
                              mode: mode,
                              userPrompt: existingMeta.userPrompt || '',
                              anchor: {
                                workflowId,
                                anchorNodeId,
                              },
                              generation: {
                                status: 'idle' as const,
                                generatedNodeIds: [],
                                generatedEdgeIds: [],
                              },
                              ui: {
                                preview: false,
                                expanded: true,
                              },
                            },
                            meta: {
                              ...preservedMeta,
                              experimentId: newExperimentId,
                              speculative: false,
                              experiment: updatedExperimentMeta,
                            },
                          };
                          
                          const normalized = ensureExperimentDefaults(convertedNode, workflowId);
                          return normalized;
                        }
                        return n;
                      }));
                      
                      toast({
                        title: "Experiment mode restored",
                        description: `Node converted back to ${mode} experiment. Select an option and generate.`,
                      });
                      
                      if (mode !== 'open_exploration') {
                        setTimeout(() => {
                          generateExperimentOptionsForNode(nodeId, mode);
                        }, 100);
                      }
                    }}
                    highlightedNodeIds={hoveredInsightNodeIds}
                  />

                  {/* Sketch overlay — keyed by active tab so it remounts (and resets undo history) on tab switch */}
                  <SketchCanvas
                    key={activeTabId}
                    ref={sketchCanvasRef}
                    isActive={isSketchMode && !isPhoneViewOnly}
                    tool={sketchTool}
                    color={sketchColor}
                    size={sketchSize}
                    opacity={sketchOpacity}
                    viewport={viewport}
                    lineStyle={sketchLineStyle}
                    dashLen={sketchDashLen}
                    dashGap={sketchDashGap}
                    smoothing={sketchSmoothing}
                    strokes={sketchStrokes}
                    hiddenStrokeIndices={hiddenStrokeIndices}
                    lockedStrokeIndices={lockedStrokeIndices}
                    onStrokesChange={setSketchStrokes}
                    onHistoryChange={(canUndo, canRedo) => {
                      setSketchCanUndo(canUndo);
                      setSketchCanRedo(canRedo);
                    }}
                    onSelectionChange={setSketchSelection}
                  />

                  {/* Sketch floating bar */}
                  {isSketchMode && !isPhoneViewOnly && (
                    <SketchFloatingBar
                      tool={sketchTool}
                      color={sketchColor}
                      size={sketchSize}
                      opacity={sketchOpacity}
                      lineStyle={sketchLineStyle}
                      dashLen={sketchDashLen}
                      dashGap={sketchDashGap}
                      smoothing={sketchSmoothing}
                      canUndo={sketchCanUndo}
                      canRedo={sketchCanRedo}
                      onToolChange={(t) => {
                        if (t === 'pen' || t === 'eraser') {
                          sketchCanvasRef.current?.clearSelection();
                          setSketchSelection(null);
                        }
                        setSketchTool(t);
                      }}
                      onColorChange={setSketchColor}
                      onSizeChange={setSketchSize}
                      onOpacityChange={setSketchOpacity}
                      onLineStyleChange={setSketchLineStyle}
                      onDashLenChange={setSketchDashLen}
                      onDashGapChange={setSketchDashGap}
                      onSmoothingChange={setSketchSmoothing}
                      onUndo={() => sketchCanvasRef.current?.undo()}
                      onRedo={() => sketchCanvasRef.current?.redo()}
                      onClear={() => sketchCanvasRef.current?.clear()}
                      onExit={() => {
                        setIsSketchMode(false);
                        sketchCanvasRef.current?.clearSelection();
                        setSketchSelection(null);
                      }}
                    />
                  )}

                  {/* Sketch selection popover */}
                  {isSketchMode && sketchSelection && !isPhoneViewOnly && (
                    <div
                      className="absolute z-[65] pointer-events-auto bg-background border border-border rounded-xl shadow-2xl px-3 py-2 flex items-center gap-2"
                      style={{
                        left: sketchSelection.screenX,
                        top: Math.max(8, sketchSelection.screenY - 60),
                        transform: 'translateX(-50%)',
                      }}
                    >
                      {/* Multi-stroke label */}
                      {sketchSelection.strokeIndices.length > 1 && (
                        <>
                          <span className="text-[10px] text-muted-foreground font-medium px-1">
                            {sketchSelection.strokeIndices.length} strokes
                          </span>
                          <div className="w-px h-4 bg-border" />
                        </>
                      )}

                      {/* Color */}
                      <div className="relative flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Color</span>
                        <label className="w-6 h-6 rounded-full border-2 border-border cursor-pointer hover:scale-110 transition-transform shadow-inner block"
                          style={{ background: sketchSelection.stroke.color }}
                          title="Change stroke color"
                        >
                          <input
                            type="color"
                            value={sketchSelection.stroke.color}
                            className="opacity-0 w-0 h-0 absolute pointer-events-none"
                            onChange={(e) => {
                              const indices = sketchSelection.strokeIndices;
                              const updated = sketchStrokes.map((s, i) =>
                                indices.includes(i) ? { ...s, color: e.target.value } : s
                              );
                              setSketchStrokes(updated);
                              setSketchSelection({ ...sketchSelection, stroke: { ...sketchSelection.stroke, color: e.target.value } });
                            }}
                          />
                        </label>
                      </div>

                      <div className="w-px h-4 bg-border" />

                      {/* Size */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Size</span>
                        <input
                          type="range"
                          min={1}
                          max={40}
                          value={sketchSelection.stroke.size}
                          className="w-16 h-1 cursor-pointer [accent-color:hsl(var(--primary))]"
                          onChange={(e) => {
                            const indices = sketchSelection.strokeIndices;
                            const val = Number(e.target.value);
                            const updated = sketchStrokes.map((s, i) =>
                              indices.includes(i) ? { ...s, size: val } : s
                            );
                            setSketchStrokes(updated);
                            setSketchSelection({ ...sketchSelection, stroke: { ...sketchSelection.stroke, size: val } });
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground w-4">{sketchSelection.stroke.size}</span>
                      </div>

                      <div className="w-px h-4 bg-border" />

                      {/* Line style */}
                      <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
                        {(['solid', 'dashed'] as const).map((ls) => (
                          <button
                            key={ls}
                            onClick={() => {
                              const indices = sketchSelection.strokeIndices;
                              const updated = sketchStrokes.map((s, i) =>
                                indices.includes(i) ? { ...s, lineStyle: ls } : s
                              );
                              setSketchStrokes(updated);
                              setSketchSelection({ ...sketchSelection, stroke: { ...sketchSelection.stroke, lineStyle: ls } });
                            }}
                            className={`h-5 px-1.5 rounded-full text-[10px] font-medium transition-colors ${
                              sketchSelection.stroke.lineStyle === ls
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {ls === 'solid' ? '—' : '- -'}
                          </button>
                        ))}
                      </div>

                      <div className="w-px h-4 bg-border" />

                      {/* Delete */}
                      <button
                        title={sketchSelection.strokeIndices.length > 1 ? `Delete ${sketchSelection.strokeIndices.length} strokes` : 'Delete stroke'}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                        onClick={() => {
                          const indices = new Set(sketchSelection.strokeIndices);
                          setSketchStrokes(sketchStrokes.filter((_, i) => !indices.has(i)));
                          sketchCanvasRef.current?.clearSelection();
                          setSketchSelection(null);
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Workflow Tools (floating experiment UIs) */}
                  {workflowTools.map(tool => {
                    const anchorNode = nodes.find(n => n.id === tool.anchorNodeId);
                    if (!anchorNode) return null;
                    
                    const toolOptionsState = getOptionsForNode(tool.anchorNodeId);
                    
                    return (
                      <ExperimentTool
                        key={tool.id}
                        tool={tool}
                        anchorNode={anchorNode}
                        viewport={viewport}
                        predictiveOptions={toolOptionsState?.options || []}
                        optionsLoading={toolOptionsState?.loading || false}
                        optionsError={toolOptionsState?.error || null}
                        readOnly={false}
                        onUpdate={(toolId, updates) => {
                          setWorkflowTools(prev => prev.map(t => 
                            t.id === toolId ? { ...t, ...updates } : t
                          ));
                        }}
                        onGenerate={async (toolId) => {
                          const currentTool = workflowTools.find(t => t.id === toolId);
                          if (!currentTool) return;
                          
                          setWorkflowTools(prev => prev.map(t => 
                            t.id === toolId ? { ...t, state: 'generating' as const } : t
                          ));
                          
                          try {
                            const anchorNodeData = nodes.find(n => n.id === currentTool.anchorNodeId);
                            if (!anchorNodeData) throw new Error('Anchor node not found');
                            
                            const description = currentTool.selectedOption?.description || 
                              currentTool.selectedOption?.label || 
                              currentTool.userPrompt || '';
                            
                            const context = buildExperimentContext({
                              experimentNodeId: currentTool.anchorNodeId,
                              nodes,
                              edges,
                              workflowName: activeTab?.name || 'Workflow',
                            });
                            
                            if (!context) {
                              throw new Error('Could not build experiment context');
                            }
                            
                            const result = await generateExperimentBranch(routerAiClient, {
                              mode: currentTool.mode || 'whatif',
                              context,
                              origin: currentTool.origin || 'explore',
                              selectedOptionLabel: currentTool.selectedOption?.label || '',
                              selectedOptionDescription: description,
                              userPrompt: currentTool.userPrompt,
                              anchorNodeId: currentTool.anchorNodeId,
                              anchorNodeLabel: (anchorNodeData.data as any)?.label || anchorNodeData.type || 'Node',
                              anchorNodePosition: anchorNodeData.position,
                            });
                            
                            if (result.success && result.branch) {
                              const experimentId = `tool-${toolId}-${Date.now()}`;
                              const generatedAt = Date.now();
                              
                              const generatedNodeIds = result.branch.nodes.map(n => n.id!);
                              const generatedEdgeIds = result.branch.edges.map(e => e.id!);
                              
                              const previewNodes = result.branch.nodes.map(n => ({
                                ...n,
                                id: n.id!,
                                type: n.type || 'process',
                                position: n.position!,
                                data: n.data || { label: 'New Step' },
                                meta: { 
                                  speculative: true, 
                                  experimentId,
                                  generatedFrom: { nodeId: currentTool.anchorNodeId, ts: generatedAt } 
                                },
                              } as Node));
                              
                              const previewEdges = result.branch.edges.map(e => ({
                                ...e,
                                id: e.id!,
                                source: e.source!,
                                target: e.target!,
                                meta: { 
                                  speculative: true, 
                                  experimentId,
                                  generatedFrom: { nodeId: currentTool.anchorNodeId, ts: generatedAt } 
                                },
                                style: { ...(e.style || {}), strokeOpacity: 0.8 }
                              } as Edge));
                              
                              logPreviewTopology({
                                previewAnchorNodeId: currentTool.anchorNodeId,
                                originNodeId: currentTool.anchorNodeId,
                                previewBranchNodeIds: generatedNodeIds,
                                expectedEdgePattern: 'branches_attach_to_experiment_node'
                              });
                              
                              previewNodes.forEach(n => {
                                warnContentContractViolation({
                                  nodeId: n.id,
                                  header: n.data?.label,
                                  body: n.data?.description,
                                  isAIGenerated: true,
                                });
                              });
                              
                              // Clear any existing speculative nodes/edges for this tool before adding new ones
                              const existingToolData = currentTool.generated;
                              setNodes(prev => {
                                const filtered = existingToolData?.nodeIds 
                                  ? prev.filter(n => !existingToolData.nodeIds.includes(n.id))
                                  : prev;
                                return [...filtered, ...previewNodes];
                              });
                              setEdges(prev => {
                                const filtered = existingToolData?.edgeIds 
                                  ? prev.filter(e => !existingToolData.edgeIds.includes(e.id))
                                  : prev;
                                return [...filtered, ...previewEdges];
                              });
                              
                              setWorkflowTools(prev => prev.map(t => 
                                t.id === toolId ? { 
                                  ...t, 
                                  state: 'preview' as const,
                                  generated: {
                                    nodeIds: generatedNodeIds,
                                    edgeIds: generatedEdgeIds,
                                    generatedAt,
                                  }
                                } : t
                              ));
                              
                              logRenderedGraph({
                                nodes: previewNodes.map(n => ({
                                  id: n.id,
                                  type: n.type || 'process',
                                  header: n.data?.label,
                                  body: n.data?.description,
                                })),
                                edges: previewEdges.map(e => ({
                                  source: e.source,
                                  target: e.target,
                                })),
                              });
                              
                              toast({
                                title: "Branch generated",
                                description: `Created ${result.branch.nodes.length} preview nodes. Review and accept or reject.`,
                              });
                            } else {
                              throw new Error(result.error || 'Failed to generate branch');
                            }
                          } catch (error) {
                            console.error('[ExperimentTool] Generation failed:', error);
                            setWorkflowTools(prev => prev.map(t => 
                              t.id === toolId ? { ...t, state: 'idle' as const } : t
                            ));
                            toast({
                              title: "Generation failed",
                              description: error instanceof Error ? error.message : "Failed to generate experiment branch",
                              variant: "destructive",
                            });
                          }
                        }}
                        onAccept={(toolId) => {
                          const currentTool = workflowTools.find(t => t.id === toolId);
                          if (!currentTool?.generated) return;
                          
                          logCommitAccept({
                            removedNodeId: '',
                            reattachedBranches: currentTool.generated.nodeIds,
                            newParentNodeId: currentTool.anchorNodeId,
                          });
                          
                          saveToHistory();
                          
                          setNodes(prev => prev.map(n => {
                            if (currentTool.generated?.nodeIds.includes(n.id)) {
                              const { speculative, experimentId, generatedFrom, ...restMeta } = n.meta || {};
                              return { ...n, meta: Object.keys(restMeta).length > 0 ? restMeta : undefined };
                            }
                            return n;
                          }));
                          setEdges(prev => prev.map(e => {
                            if (currentTool.generated?.edgeIds.includes(e.id)) {
                              const { speculative, experimentId, generatedFrom, ...restMeta } = e.meta || {};
                              return { ...e, meta: Object.keys(restMeta).length > 0 ? restMeta : undefined };
                            }
                            return e;
                          }));
                          
                          setWorkflowTools(prev => prev.filter(t => t.id !== toolId));
                          
                          logCommitFinalGraph({
                            nodes: currentTool.generated.nodeIds,
                            edges: currentTool.generated.edgeIds.map(id => {
                              const edge = edges.find(e => e.id === id);
                              return { source: edge?.source || '', target: edge?.target || '' };
                            }),
                          });
                          
                          toast({
                            title: "Experiment accepted",
                            description: "The generated branch has been added to your workflow.",
                          });
                        }}
                        onReject={(toolId) => {
                          const currentTool = workflowTools.find(t => t.id === toolId);
                          
                          if (currentTool?.generated) {
                            setNodes(prev => prev.filter(n => !currentTool.generated?.nodeIds.includes(n.id)));
                            setEdges(prev => prev.filter(e => !currentTool.generated?.edgeIds.includes(e.id)));
                          }
                          
                          setWorkflowTools(prev => prev.filter(t => t.id !== toolId));
                        }}
                        onRefreshOptions={(toolId) => {
                          const currentTool = workflowTools.find(t => t.id === toolId);
                          if (currentTool) {
                            refreshExperimentOptions(currentTool.anchorNodeId, currentTool.mode);
                          }
                        }}
                        onGenerateOptionsForMode={(toolId, mode) => {
                          const currentTool = workflowTools.find(t => t.id === toolId);
                          if (currentTool) {
                            generateExperimentOptionsForNode(currentTool.anchorNodeId, mode);
                          }
                        }}
                      />
                    );
                  })}
                </>
              ) : (
                <BlankCanvasState
                  onCreateBlank={handleCreateBlankFromCanvas}
                  onCreateWithTemplate={handleCreateWithTemplate}
                  onCreateWithAI={handleCreateWithAI}
                  onImportWorkflow={handleImportFromCanvas}
                  onCreateTemplate={handleCreateTemplateFromCanvas}
                />
              )}

              {/* Mobile view-only floating bar */}
              {isPhoneViewOnly && <MobileViewBar onFitView={handleFitView} />}

              {openTabs.length > 0 && (
                <CommentsOverlay
                  workflowId={
                    // For cloud-backed tabs the DB stores its own server-generated
                    // projectUuid (≠ the local tab.projectUuid used for localStorage).
                    // resolveCommentAuth looks up by projectUuid in the DB, so we
                    // must pass the server's value, not the local tab id.
                    activeTab?.cloudProjectId
                      ? (cloudProjects.find((p) => p.id === activeTab.cloudProjectId)?.projectUuid
                          ?? activeTab?.projectUuid)
                      : activeTab?.projectUuid
                  }
                  shareId={activeShareId ?? undefined}
                  isAuthenticated={isAuthenticated || !!serverUser}
                  placing={commentPlacing}
                  onPlacingChange={setCommentPlacing}
                  viewport={viewport}
                  onViewportChange={setViewport}
                  containerRef={canvasContainerRef}
                />
              )}
            </div>

            {/* Project Panel - docked right side */}
            {openTabs.length > 0 && !isPhoneViewOnly && (
              <ProjectPanel
                nodes={nodes}
                edges={edges}
                frames={[]}
                canvasObjects={canvasObjects}
                sketchStrokes={sketchStrokes}
                projectId={
                  activeTab?.projectUuid ||
                  activeTab?.cloudProjectId?.toString() ||
                  activeTabId
                }
                projectName={activeTab?.name}
                commentWorkflowId={activeTab?.projectUuid}
                commentShareId={activeShareId ?? undefined}
                onProjectNameChange={(name) => updateActiveTab({ name })}
                onStrokeSelect={(idx) => {
                  setIsSketchMode(true);
                  setSketchTool('cursor');
                  setTimeout(() => {
                    sketchCanvasRef.current?.selectStroke([idx]);
                  }, 0);
                }}
                onApplyWorkflow={(workflow) => {
                  // Non-destructive mode: add modified workflow as new copy alongside original
                  if (workflow.nonDestructive) {
                    saveToHistory("Add modified workflow");
                    
                    const workflowNodes = workflow.nodes;
                    const workflowEdges = workflow.edges;
                    const offset = calculateWorkflowOffset(workflowNodes);
                    const batchId = Date.now();
                    const nodeIdMapping: { [oldId: string]: string } = {};

                    const offsetNodes = workflowNodes.map(
                      (node: Node, index: number) => {
                        const oldId = node.id || `node-${index}`;
                        const newId = `node-${batchId}-${index}`;
                        nodeIdMapping[oldId] = newId;

                        const nodeData = { ...node.data };
                        if (index === 0 && workflow.selectedGroupLabel) {
                          (nodeData as any).label = `${workflow.selectedGroupLabel} — Modified`;
                        }

                        return {
                          ...node,
                          id: newId,
                          position: {
                            x: node.position.x + offset.x,
                            y: node.position.y + offset.y,
                          },
                          selected: false,
                          data: {
                            ...nodeData,
                            meta: {
                              ...(nodeData as any)?.meta,
                              createdAt: Date.now(),
                            },
                          },
                        };
                      },
                    );

                    const offsetEdges = workflowEdges.map(
                      (edge: Edge, index: number) => ({
                        ...edge,
                        id: `edge-${batchId}-${index}`,
                        source: nodeIdMapping[edge.source] || edge.source,
                        target: nodeIdMapping[edge.target] || edge.target,
                        selected: false,
                      }),
                    );

                    setNodes((prev) => [...prev, ...offsetNodes]);
                    setEdges((prev) => [...prev, ...offsetEdges]);

                    toast({
                      title: "Modified Workflow Added",
                      description: `Added ${offsetNodes.length} nodes as a modified copy. Your original workflow is unchanged.`,
                    });
                    return;
                  }
                  
                  // V1 STABILIZATION: Merge-Safe Workflow Mutation
                  // All chat-driven mutations MUST pass through merge-safe validation
                  // This prevents orphan nodes, floating islands, and invalid graph states
                  
                  const mutationResult = applyMergeSafeChatMutation({
                    existingNodes: nodes,
                    existingEdges: edges,
                    newNodes: workflow.nodes,
                    newEdges: workflow.edges,
                    userMessage: '', // Context passed from chat
                    attachmentTargetId: undefined,
                    aiMode: workflow.aiMode || 'EDIT',
                    bypassConfirmation: workflow.bypassConfirmation,
                  });
                  
                  if (!mutationResult.success) {
                    // Task #137: Full graph / new-workflow proposal on a populated
                    // canvas. Instead of the old destructive REPLACE prompt, add
                    // the proposal BESIDE the existing workflow as its own separate
                    // group. Nothing is destroyed — the user can delete either one.
                    if (mutationResult.requiresConfirmation) {
                      const newWorkflowNodes = workflow.nodes;
                      const newWorkflowEdges = workflow.edges;
                      // Place the new workflow to the RIGHT of existing content
                      // (side-by-side), top-aligned, so it reads as its own
                      // column rather than stacking underneath the original.
                      const offset = (() => {
                        if (nodes.length === 0) return { x: 0, y: 0 };
                        const horizontalSpacing = 250;
                        let maxExistingX = -Infinity;
                        let minExistingY = Infinity;
                        nodes.forEach((node) => {
                          const right = node.position.x + (node.width || 200);
                          if (right > maxExistingX) maxExistingX = right;
                          if (node.position.y < minExistingY)
                            minExistingY = node.position.y;
                        });
                        let minNewX = Infinity;
                        let minNewY = Infinity;
                        newWorkflowNodes.forEach((node) => {
                          if (node.position.x < minNewX) minNewX = node.position.x;
                          if (node.position.y < minNewY) minNewY = node.position.y;
                        });
                        return {
                          x: maxExistingX + horizontalSpacing - minNewX,
                          y: minExistingY - minNewY,
                        };
                      })();
                      const batchId = Date.now();
                      const nodeIdMapping: { [oldId: string]: string } = {};

                      const offsetNodes = newWorkflowNodes.map(
                        (node: Node, index: number) => {
                          const oldId = node.id || `node-${index}`;
                          const newId = `node-${batchId}-${index}`;
                          nodeIdMapping[oldId] = newId;
                          return {
                            ...node,
                            id: newId,
                            position: {
                              x: node.position.x + offset.x,
                              y: node.position.y + offset.y,
                            },
                            selected: false,
                            data: {
                              ...node.data,
                              meta: {
                                ...(node.data as any)?.meta,
                                createdAt: Date.now(),
                              },
                            },
                          };
                        },
                      );

                      // Remap every edge onto the new node ids so the proposal
                      // only connects within itself — this is what makes the
                      // Layers panel treat it as its own separate group. We drop
                      // any edge that can't be fully remapped to the new nodes,
                      // so it can never cross-link into the existing workflow.
                      const resolveNewId = (
                        ref: string,
                      ): string | undefined => {
                        const direct = nodeIdMapping[ref];
                        if (direct) return direct;
                        // Parity with the success path: tolerate numeric-index
                        // edge references (e.g. "0", "1") pointing at node order.
                        const numeric = parseInt(ref, 10);
                        if (!isNaN(numeric) && numeric < newWorkflowNodes.length) {
                          const oldId =
                            newWorkflowNodes[numeric]?.id || `node-${numeric}`;
                          return nodeIdMapping[oldId];
                        }
                        return undefined;
                      };

                      const offsetEdges: Edge[] = [];
                      newWorkflowEdges.forEach((edge: Edge, index: number) => {
                        const newSource = resolveNewId(edge.source);
                        const newTarget = resolveNewId(edge.target);
                        if (!newSource || !newTarget) {
                          console.warn(
                            '[Task #137] Dropping edge that could not be remapped to the new workflow (keeps the group internal-only):',
                            { source: edge.source, target: edge.target },
                          );
                          return;
                        }
                        offsetEdges.push({
                          ...edge,
                          id: `edge-${batchId}-${index}`,
                          source: newSource,
                          target: newTarget,
                          selected: false,
                        });
                      });

                      setNodes((prev) => [...prev, ...offsetNodes]);
                      setEdges((prev) => [...prev, ...offsetEdges]);

                      if (
                        workflow.canvasObjects &&
                        workflow.canvasObjects.length > 0
                      ) {
                        const offsetObjects = workflow.canvasObjects.map(
                          (obj: CanvasObject, index: number) => ({
                            ...obj,
                            id: `obj-${batchId}-${index}`,
                            position: {
                              x: obj.position.x + offset.x,
                              y: obj.position.y + offset.y,
                            },
                            selected: false,
                          }),
                        );
                        updateActiveTab({
                          canvasObjects: [...canvasObjects, ...offsetObjects],
                        });
                      }

                      setTimeout(() => saveToHistory("Add workflow as new group"), 0);

                      toast({
                        title: "New Workflow Added",
                        description: `Added a new workflow (${offsetNodes.length} nodes) beside your existing one. Your original is unchanged — delete whichever you don't need. Use Ctrl+Z to undo.`,
                      });
                      return;
                    }
                    
                    console.error('[MergeSafe] Mutation blocked:', {
                      reason: mutationResult.reason,
                      validationErrors: mutationResult.safetyReport.validationErrors,
                    });
                    
                    // Record failure - canvas remains unchanged (TASK 6: Failure Behavior)
                    toast({
                      title: "Workflow Update Blocked",
                      description: mutationResult.reason || "The workflow changes could not be applied safely.",
                      variant: "destructive"
                    });
                    
                    return; // Canvas unchanged on mutation failure
                  }
                  
                  
                  // Use validated and repaired nodes/edges from mutation result
                  const workflowNodes = mutationResult.mutatedNodes;
                  const workflowEdges = mutationResult.mutatedEdges as unknown as Edge[];
                  
                  const offset = calculateWorkflowOffset(workflowNodes);
                  const batchId = Date.now();
                  const nodeIdMapping: { [oldId: string]: string } = {};

                  const offsetNodes = workflowNodes.map(
                    (node: Node, index: number) => {
                      const oldId = node.id || `node-${index}`;
                      const newId = `node-${batchId}-${index}`;
                      nodeIdMapping[oldId] = newId;

                      // #301: When the AI updates a table node (same original ID as
                      // an existing node), carry the existing tableId forward and
                      // merge cell content — preserving rows/values the user already
                      // entered while applying the AI's structural changes (row/column
                      // count, column names, etc.).
                      let nodeData: Record<string, unknown> = { ...(node.data as Record<string, unknown>) };
                      if (node.type === 'table') {
                        const existingNode = nodes.find(n => n.id === oldId && n.type === 'table');
                        const existingTableId = existingNode?.data?.tableId as string | undefined;
                        const existingTable = existingTableId ? tableData[existingTableId] : undefined;
                        if (existingTable && existingTableId) {
                          const aiTable = nodeData.table as { columns?: any[]; rows?: any[] } | undefined;
                          const newColCount = aiTable?.columns?.length ?? existingTable.columns.length;
                          const newRowCount = aiTable?.rows?.length ?? existingTable.rows.length;
                          // Preserve existing columns up to new count; add empty columns for additions
                          const mergedColumns = existingTable.columns.slice(0, newColCount);
                          while (mergedColumns.length < newColCount) {
                            mergedColumns.push({ id: `col-${Date.now()}-${mergedColumns.length}`, name: `Column ${mergedColumns.length + 1}`, width: 150, type: 'string' as const });
                          }
                          // Preserve existing rows (with their cell values) up to new count; add empty rows for additions
                          const mergedRows = existingTable.rows.slice(0, newRowCount);
                          while (mergedRows.length < newRowCount) {
                            const values: Record<string, string> = {};
                            mergedColumns.forEach((col: any) => { values[col.id] = ''; });
                            mergedRows.push({ id: `row-${Date.now()}-${mergedRows.length}`, values });
                          }
                          nodeData = {
                            ...nodeData,
                            tableId: existingTableId,
                            table: { ...existingTable, columns: mergedColumns, rows: mergedRows },
                          };
                        }
                      }

                      return {
                        ...node,
                        id: newId,
                        position: {
                          x: node.position.x + offset.x,
                          y: node.position.y + offset.y,
                        },
                        selected: false,
                        data: {
                          ...nodeData,
                          meta: {
                            ...(nodeData as any)?.meta,
                            createdAt: Date.now(),
                            // V1: Stamp nodes with merge/branch decision from merge-safe mutation
                            ...(mutationResult.mergeBranchDecision && {
                              mergeBranchDecision: mutationResult.mergeBranchDecision,
                            }),
                            // V1: Stamp nodes with mutation safety metadata
                            ...(mutationResult.safetyReport.decisionRepairApplied && {
                              mutationSafety: mutationResult.mutationSafety,
                            }),
                          },
                        },
                      };
                    },
                  );

                  const offsetEdges = workflowEdges.map(
                    (edge: Edge, index: number) => {
                      let newSource = nodeIdMapping[edge.source];
                      let newTarget = nodeIdMapping[edge.target];

                      if (!newSource) {
                        const sourceNumeric = parseInt(edge.source);
                        if (
                          !isNaN(sourceNumeric) &&
                          sourceNumeric < workflowNodes.length
                        ) {
                          const sourceNodeId =
                            workflowNodes[sourceNumeric]?.id ||
                            `node-${sourceNumeric}`;
                          newSource = nodeIdMapping[sourceNodeId];
                        }
                      }

                      if (!newTarget) {
                        const targetNumeric = parseInt(edge.target);
                        if (
                          !isNaN(targetNumeric) &&
                          targetNumeric < workflowNodes.length
                        ) {
                          const targetNodeId =
                            workflowNodes[targetNumeric]?.id ||
                            `node-${targetNumeric}`;
                          newTarget = nodeIdMapping[targetNodeId];
                        }
                      }

                      return {
                        ...edge,
                        id: `edge-${batchId}-${index}`,
                        source: newSource || edge.source,
                        target: newTarget || edge.target,
                        selected: false,
                      };
                    },
                  );

                  setNodes((prev) => [...prev, ...offsetNodes]);
                  setEdges((prev) => [...prev, ...offsetEdges]);

                  if (
                    workflow.canvasObjects &&
                    workflow.canvasObjects.length > 0
                  ) {
                    const offsetObjects = workflow.canvasObjects.map(
                      (obj: CanvasObject, index: number) => ({
                        ...obj,
                        id: `obj-${batchId}-${index}`,
                        position: {
                          x: obj.position.x + offset.x,
                          y: obj.position.y + offset.y,
                        },
                        selected: false,
                      }),
                    );
                    updateActiveTab({
                      canvasObjects: [...canvasObjects, ...offsetObjects],
                    });
                  }

                  setTimeout(() => saveToHistory("Apply workflow"), 0);

                  toast({
                    title: "Workflow Applied",
                    description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections.`,
                  });
                }}
                onReplaceWorkflow={(workflow) => {
                  // Use shared executeReplaceWorkflow with regression guard
                  // Direct callback = no dialog delay, pass current nodes/edges as expected
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[onReplaceWorkflow] Starting replace via shared function');
                  }
                  
                  const result = executeReplaceWorkflow(
                    workflow,
                    nodes, // Current nodes as expected (no dialog delay)
                    edges, // Current edges as expected
                    {
                      onRegressionDetected: (regressionResult) => {
                        // Show regression warning modal for direct Replace button
                        setPendingRegressionWarning({
                          workflow,
                          existingNodes: nodes,
                          existingEdges: edges,
                          regressionResult,
                        });
                      },
                    }
                  );
                  
                  if (result === 'regression_detected') {
                    // Regression modal will handle next steps
                    return;
                  }
                }}
                isReadOnly={effectiveReadOnly}
                shareUuid={activeShareId || undefined}
                cloudProjectId={activeTab?.cloudProjectId ? (typeof activeTab.cloudProjectId === 'number' ? activeTab.cloudProjectId : parseInt(activeTab.cloudProjectId, 10) || null) : null}
                onShareCreated={(shareId) => {
                  setActiveShareId(shareId);
                  updateActiveTab({ shareUuid: shareId });
                }}
                insights={insights.insights}
                insightsLoading={insights.isRunning}
                insightsLastRunAt={insights.lastRunAt}
                onRunTestFlight={insights.runTestFlight}
                onDismissInsight={insights.dismiss}
                onDismissAllInsights={insights.dismissAll}
                onMarkInsightViewed={insights.markViewed}
                onMarkInsightExplored={insights.markExplored}
                onDeferInsight={insights.defer}
                onPromoteInsight={insights.promote}
                onExploreInsight={handleExploreInsight}
                onHoverInsight={handleHoverInsight}
                onInsightNavigateToNode={focusOnNode}
                focusedInsightId={focusedInsightId}
                forceTab={forcePanelTab}
                generationMode={designModeTabIds.has(activeTabId) ? "design" : "workflow"}
                initialPrompt={pendingChatPrompt || undefined}
                onInitialPromptConsumed={handleChatPromptConsumed}
                onProposeSolution={handleProposeSolution}
                hasActiveProposal={proposalState.proposal !== null}
                generatingInsightId={proposalState.generatingInsightId}
                onStartExperiment={handleStartExperiment}
                hasActiveExperiment={experimentState.session !== null}
                generatingExperimentInsightId={experimentState.generatingInsightId}
              />
            )}
          </>
        )}
      </div>

      {/* Proposal Preview Modal (Phase 2 - Accept + Alternative) */}
      {proposalState.proposal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="w-[90vw] h-[85vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
            <ProposalPreviewContainer
              proposal={proposalState.proposal}
              onCancel={handleCancelProposal}
              onAccept={handleAcceptProposal}
              onVariantChange={handleVariantChange}
            />
          </div>
        </div>
      )}

      {/* Experiment Preview Modal (Phase 3 - Pressure Testing) */}
      {experimentState.session && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="w-[90vw] h-[85vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
            <ExperimentPreviewContainer
              session={experimentState.session}
              onCancel={handleCancelExperiment}
              onAccept={handleAcceptExperiment}
              onSelectExperiment={handleSelectExperiment}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {showAiModal && (
        <AiSettingsModal
          onClose={() => setShowAiModal(false)}
          onSave={(settings) => {
            // Save AI settings to localStorage
            localStorage.setItem("ai_settings", JSON.stringify(settings));
            if (settings.apiKey) {
              localStorage.setItem("custom_api_key", settings.apiKey);
            }
            setShowAiModal(false);
            // Update the AI client with new settings
            onAiSettingsChange?.();
          }}
        />
      )}
      {showAiGenerator && (
        <AiWorkflowGenerator
          onClose={() => {
            setShowAiGenerator(false);
            setGeneratorPrompt("");
          }}
          initialPrompt={generatorPrompt}
          onGenerate={(generatedWorkflow: any) => {
            // Append generated workflow to existing canvas instead of replacing it
            if (generatedWorkflow.nodes && generatedWorkflow.edges) {
              // Calculate offset for new nodes
              const offset = calculateWorkflowOffset(generatedWorkflow.nodes);

              // Generate unique timestamp for this batch
              const batchId = Date.now();
              const randomSuffix = Math.random().toString(36).substr(2, 9);

              // Create a mapping from old node IDs to new node IDs
              const nodeIdMapping: { [oldId: string]: string } = {};

              // Apply offset to new nodes with guaranteed unique IDs
              const offsetNodes = generatedWorkflow.nodes.map(
                (node: Node, index: number) => {
                  const oldId = node.id || `node-${index}`;
                  const newId = `${oldId}-ai-${batchId}-${index}`;
                  nodeIdMapping[oldId] = newId;

                  return {
                    ...node,
                    id: newId,
                    position: {
                      x: node.position.x + offset.x,
                      y: node.position.y + offset.y,
                    },
                    selected: false,
                  };
                },
              );

              // Apply offset to new edges and update IDs using the mapping
              const offsetEdges = generatedWorkflow.edges.map(
                (edge: Edge, index: number) => ({
                  ...edge,
                  id: `${edge.id || `edge-${index}`}-ai-${batchId}-${index}`,
                  source: nodeIdMapping[edge.source] || edge.source,
                  target: nodeIdMapping[edge.target] || edge.target,
                  selected: false,
                }),
              );

              // Append to existing nodes and edges
              setNodes((prev) => [...prev, ...offsetNodes]);
              setEdges((prev) => [...prev, ...offsetEdges]);

              // Save to history after state updates
              setTimeout(() => saveToHistory("Generate AI workflow"), 0);

              toast({
                title: "Workflow Generated",
                description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections to canvas.`,
                variant: "default",
              });
            }

            setShowAiGenerator(false);
          }}
        />
      )}
      {showImportModal && (
        <WorkflowImportModal
          onClose={() => setShowImportModal(false)}
          onImport={(importedData: any) => {
            try {
              // Handle native .kiteframe v2.1.0 format (format === 'kiteframe-workflow')
              if (importedData.format === "kiteframe-workflow") {
                const currentWorkflowNames = Object.fromEntries(
                  tabs.map((t) => [t.id, t.name]),
                );
                const result = importWorkflow(importedData, {
                  restoreDocumentation: true,
                  projectId: projectIdentifier,
                  currentWorkflowNames,
                });

                if (!result.success || !result.data) {
                  toast({
                    title: "Import Failed",
                    description:
                      result.error || "Could not parse .kiteframe file.",
                    variant: "destructive",
                  });
                  return;
                }

                const { data } = result;

                if (activeTab) {
                  updateActiveTab({
                    name: data.metadata.name,
                    metadata: {
                      name: data.metadata.name,
                      description: data.metadata.description || "",
                      links: activeTab.metadata.links || [],
                      linksFormat: activeTab.metadata.linksFormat || "text",
                      categories: activeTab.metadata.categories || [],
                    },
                    sketchStrokes: data.sketchStrokes ?? [],
                  });
                }

                if (data.nodes) {
                  setNodes(data.nodes as any[]);
                }
                if (data.edges) {
                  setEdges(data.edges as any[]);
                }
                if (data.canvasObjects) {
                  updateActiveTab({ canvasObjects: data.canvasObjects as any[] });
                }
                if (data.viewport) {
                  setViewport(data.viewport);
                }

                setTimeout(() => saveToHistory("Import .kiteframe"), 0);

                const docNote =
                  data.documentation?.projectPRD ||
                  data.documentation?.workflowPRDs?.length
                    ? " — PRD documentation restored."
                    : "";

                toast({
                  title: "Workflow Imported",
                  description: `"${data.metadata.name}" imported successfully${docNote}`,
                });

                if (result.warnings?.length) {
                  console.warn("[Import] Warnings:", result.warnings);
                }
                return;
              }

              // Handle comprehensive workflow format (direct JSON import)
              if (
                importedData.version &&
                importedData.canvas &&
                importedData.workflow
              ) {
                // New comprehensive format
                const { workflow, canvas } = importedData;

                // Restore workflow metadata
                if (activeTab) {
                  updateActiveTab({
                    name: workflow.name,
                    metadata: {
                      name: workflow.name,
                      description: workflow.description || "",
                      links: workflow.links || [],
                      linksFormat: activeTab.metadata.linksFormat || "text",
                      categories: workflow.categories || [],
                    },
                  });
                }

                // Restore canvas content with all styling
                if (canvas.nodes) {
                  setNodes(
                    canvas.nodes.map((node: any) => ({
                      ...node,
                      data: { ...node.data },
                      style: node.style || {},
                    })),
                  );
                }

                if (canvas.edges) {
                  setEdges(
                    canvas.edges.map((edge: any) => ({
                      ...edge,
                      style: edge.style || {},
                      data: edge.data || {},
                    })),
                  );
                }

                if (canvas.canvasObjects) {
                  updateActiveTab({
                    canvasObjects: canvas.canvasObjects.map((obj: any) => ({
                      ...obj,
                      data: { ...obj.data },
                      style: obj.style || {},
                    })),
                  });
                }

                if (canvas.viewport) {
                  setViewport(canvas.viewport);
                }

                toast({
                  title: "Workflow Imported",
                  description: `"${workflow.name}" imported with all content, styling, and metadata`,
                });
              } else if (
                importedData.nodes ||
                importedData.edges ||
                importedData.canvasObjects ||
                (importedData.workflows && importedData.workflows.length > 0) ||
                (importedData.projectData?.workflows && importedData.projectData.workflows.length > 0)
              ) {
                // Check if this is a multi-workflow project import (AssembledProjectPRD format)
                // Support both nested format (projectData.workflows) and flat format (workflows at top level)
                const hasNestedWorkflows = importedData.projectData?.workflows && importedData.projectData.workflows.length > 0;
                const hasTopLevelWorkflows = importedData.workflows && importedData.workflows.length > 0;
                
                if (hasNestedWorkflows || hasTopLevelWorkflows) {
                  // Extract data from either nested or flat format
                  const projectPRD = importedData.projectData?.projectPRD || importedData.projectPRD;
                  const workflows = importedData.projectData?.workflows || importedData.workflows;
                  const projectName = importedData.projectData?.projectName || importedData.project?.name || importedData.projectName;
                  const importedProjectId = importedData.projectData?.projectId || importedData.project?.id;
                  
                  // Merge all workflows onto a single canvas (current active tab)
                  // This preserves the original project layout with all workflows together
                  const allNodes: Node[] = [];
                  const allEdges: Edge[] = [];
                  const allCanvasObjects: CanvasObject[] = [];
                  let primaryViewport = { x: 0, y: 0, zoom: 1 };
                  
                  // Map from original workflowId to PRD data for deterministic remapping
                  const workflowIdToPRD: Record<string, { sections: any[], workflowName: string }> = {};
                  
                  for (const workflow of workflows) {
                    const canvas = workflow.canvas || {};
                    // Tag each node with its original workflowId for deterministic PRD remapping
                    // Guard against nodes without data property
                    const nodes = (canvas.nodes || []).map((node: Node) => ({ 
                      ...node, 
                      selected: false,
                      data: node.data 
                        ? { ...node.data, _importedWorkflowId: workflow.workflowId }
                        : { _importedWorkflowId: workflow.workflowId }
                    }));
                    const edges = (canvas.edges || []).map((edge: Edge) => ({ ...edge, selected: false }));
                    const canvasObjects = (canvas.canvasObjects || []).map((obj: any) => ({ ...obj, selected: false }));
                    
                    // Collect all canvas elements - positions are preserved from export
                    allNodes.push(...nodes);
                    allEdges.push(...edges);
                    allCanvasObjects.push(...canvasObjects);
                    
                    // Use the first workflow's viewport as the primary viewport
                    if (canvas.viewport && allNodes.length === nodes.length) {
                      primaryViewport = canvas.viewport;
                    }
                    
                    // Store PRD sections by original workflowId for deterministic remapping
                    if (workflow.prdSections && workflow.prdSections.length > 0) {
                      workflowIdToPRD[workflow.workflowId] = {
                        sections: workflow.prdSections,
                        workflowName: workflow.workflowName
                      };
                    }
                  }
                  
                  
                  // Use the imported project ID for consistency with export
                  // This ensures PRD storage keys match between export and import
                  const targetProjectId = importedProjectId || activeTab?.projectUuid || `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  
                  // Apply merged content to the active tab
                  if (activeTab) {
                    // Update tab name with project name
                    const projectDescription = importedData.projectData?.project?.description || importedData.project?.description;
                    const updatedMetadata = {
                      ...activeTab.metadata,
                      name: projectName || activeTab.metadata.name,
                      description: projectDescription || activeTab.metadata.description,
                    };
                    
                    // Reset history with the new imported state
                    const newHistory = [{
                      nodes: allNodes,
                      edges: allEdges,
                      canvasObjects: allCanvasObjects,
                      viewport: primaryViewport,
                    }];
                    
                    updateActiveTab({
                      name: projectName || activeTab.name,
                      projectUuid: targetProjectId,
                      nodes: allNodes,
                      edges: allEdges,
                      canvasObjects: allCanvasObjects,
                      viewport: primaryViewport,
                      metadata: updatedMetadata,
                      history: newHistory,
                      historyIndex: 0,
                    });
                    
                    // Also update ReactFlow state directly to ensure rendering
                    setNodes(allNodes);
                    setEdges(allEdges);
                    setViewport(primaryViewport);
                    
                    // After updating the canvas, use FlowDetection to get new workflow IDs
                    // and re-map PRD sections using the _importedWorkflowId tags (deterministic)
                    setTimeout(() => {
                      const detectedFlows = FlowDetection.detectFlows(allNodes, allEdges);
                      
                      // Track which original workflow IDs have been mapped
                      const mappedWorkflowIds = new Set<string>();
                      
                      // Match PRDs to detected flows using the _importedWorkflowId tags
                      for (const flow of detectedFlows) {
                        // Find the majority original workflowId among nodes in this flow
                        const workflowIdCounts: Record<string, number> = {};
                        for (const node of flow.nodes) {
                          const originalId = node.data?._importedWorkflowId;
                          if (originalId) {
                            workflowIdCounts[originalId] = (workflowIdCounts[originalId] || 0) + 1;
                          }
                        }
                        
                        // Find the workflowId with the most nodes
                        let bestOriginalId: string | null = null;
                        let bestCount = 0;
                        for (const [id, count] of Object.entries(workflowIdCounts)) {
                          if (count > bestCount && !mappedWorkflowIds.has(id)) {
                            bestCount = count;
                            bestOriginalId = id;
                          }
                        }
                        
                        // Map PRD if we found a matching original workflow
                        if (bestOriginalId && workflowIdToPRD[bestOriginalId]) {
                          const prdData = workflowIdToPRD[bestOriginalId];
                          saveWorkflowPRD(targetProjectId, flow.id, {
                            workflowId: flow.id,
                            workflowName: prdData.workflowName,
                            sections: prdData.sections,
                            manualEditedAt: {},
                            version: 1,
                            generatedAt: Date.now(),
                          });
                          mappedWorkflowIds.add(bestOriginalId);
                        }
                      }
                    }, 100);
                    
                    // Save project PRD if present
                    if (projectPRD?.sections) {
                      saveProjectPRD(targetProjectId, {
                        projectId: targetProjectId,
                        projectName: projectName || 'Imported Project',
                        sections: projectPRD.sections,
                        manualEditedAt: {},
                        version: projectPRD.version || 1,
                        generatedAt: projectPRD.generatedAt || Date.now(),
                      });
                    }
                    
                    // Save project overview details to localStorage (for ProjectOverviewSection)
                    const importedCategories: string[] | undefined =
                      Array.isArray(importedData.projectData?.project?.categories)
                        ? importedData.projectData.project.categories
                        : Array.isArray(importedData.project?.categories)
                          ? importedData.project.categories
                          : undefined;
                    if (projectDescription || projectName || importedCategories) {
                      const detailsKey = `kiteframe-details-${targetProjectId}`;
                      try {
                        const existingDetails = localStorage.getItem(detailsKey);
                        const details = existingDetails ? JSON.parse(existingDetails) : {};
                        const updatedDetails = {
                          ...details,
                          name: projectName || details.name || '',
                          description: projectDescription || details.description || '',
                          categories: importedCategories || details.categories || [],
                          createdAt: details.createdAt || Date.now(),
                          updatedAt: Date.now(),
                        };
                        localStorage.setItem(detailsKey, JSON.stringify(updatedDetails));
                      } catch (e) {
                        console.warn('[Import] Failed to save project details:', e);
                      }
                    }
                    
                    toast({
                      title: "Project Imported",
                      description: `Imported "${projectName || 'Project'}" with ${workflows.length} workflow(s) onto a single canvas`,
                    });
                  }
                } else {
                  // Standard single workflow import
                  const nodesCount = importedData.nodes
                    ? importedData.nodes.length
                    : 0;
                  const edgesCount = importedData.edges
                    ? importedData.edges.length
                    : 0;
                  const objectsCount = importedData.canvasObjects
                    ? importedData.canvasObjects.length
                    : 0;

                  if (activeTab) {
                    // Apply workflow metadata if provided
                    const metadataUpdate = importedData.workflowMetadata
                      ? {
                          name:
                            importedData.workflowMetadata.name || activeTab.name,
                          metadata: {
                            name:
                              importedData.workflowMetadata.name ||
                              activeTab.metadata.name,
                            description:
                              importedData.workflowMetadata.description ||
                              activeTab.metadata.description,
                            links:
                              importedData.workflowMetadata.links ||
                              activeTab.metadata.links,
                            linksFormat: activeTab.metadata.linksFormat || "text",
                            categories:
                              importedData.workflowMetadata.categories ||
                              activeTab.metadata.categories,
                          },
                        }
                      : {};

                    // Update tab with imported content and metadata
                    updateActiveTab({
                      ...metadataUpdate,
                      nodes: importedData.nodes
                        ? importedData.nodes.map((node: Node) => ({
                            ...node,
                            selected: false,
                          }))
                        : activeTab.nodes,
                      edges: importedData.edges
                        ? importedData.edges.map((edge: Edge) => ({
                            ...edge,
                            selected: false,
                          }))
                        : activeTab.edges,
                      canvasObjects: importedData.canvasObjects
                        ? importedData.canvasObjects.map((obj: any) => ({
                            ...obj,
                            selected: false,
                          }))
                        : activeTab.canvasObjects,
                      viewport: importedData.viewport || activeTab.viewport,
                    });

                    toast({
                      title: "Workflow Imported",
                      description: `Imported ${nodesCount} nodes, ${edgesCount} connections, and ${objectsCount} canvas objects`,
                    });
                  }
                }
              } else {
                // Legacy format fallback
                if (importedData.nodes) {
                  setNodes(importedData.nodes);
                }
                if (importedData.edges) {
                  setEdges(importedData.edges);
                }
                if (importedData.canvasObjects) {
                  updateActiveTab({
                    canvasObjects: importedData.canvasObjects,
                  });
                }
                if (importedData.viewport) {
                  setViewport(importedData.viewport);
                }

                toast({
                  title: "Workflow Imported",
                  description: "Legacy workflow format imported successfully",
                });
              }

              // Clear selections and save to history
              setSelectedNodeId("");
              setSelectedEdgeId("");
              saveToHistory("Import workflow");
            } catch (error) {
              console.error("Import failed:", error);
              toast({
                title: "Import Failed",
                description:
                  "Failed to import workflow. Please check the file format.",
                variant: "destructive",
              });
            }
            saveToHistory("Import workflow");
            setShowImportModal(false);
          }}
        />
      )}
      {showNewTabModal && (
        <NewTabModal
          isOpen={showNewTabModal}
          onClose={() => setShowNewTabModal(false)}
          onCreateBlank={handleCreateBlankFromCanvas}
          onCreateFromPrompt={handleCreateFromPrompt}
          onCreateFromFile={handleCreateFromFile}
          onCreateFromTemplate={handleCreateFromTemplate}
          onCreateFromImage={(imageFile: File) => {
            // Image analysis is now handled directly in the modal
          }}
        />
      )}
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          nodes={nodes}
          edges={edges}
          canvasObjects={canvasObjects}
          viewport={viewport}
          projectMetadata={activeTab?.metadata}
          onShareCreated={(shareId) => {
            setActiveShareId(shareId);
            updateActiveTab({ shareUuid: shareId });
          }}
          projectId={currentProjectId}
          existingShareUuid={activeShareId}
          isAuthenticated={isAuthenticated}
          onShareRevoked={() => {
            setActiveShareId(null);
            setIsShareLocked(false);
            setShareViewerCount(0);
            queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          }}
        />
      )}

      {/* Bug Report Modal */}
      {showBugReportModal && (
        <BugReportModal onClose={() => setShowBugReportModal(false)} />
      )}

      {/* Feature Upsell Dialog */}
      {featureUpsell && (
        <FeatureUpsellDialog
          isOpen={true}
          onClose={() => setFeatureUpsell(null)}
          featureName={featureUpsell.featureName}
          requiredTier={featureUpsell.requiredTier}
          description={featureUpsell.description}
        />
      )}

      {/* Task #137: The destructive REPLACE confirmation dialog was removed.
          Full/new-workflow proposals are now added beside the existing workflow
          (non-destructive). Explicit Replace is still available via the chat's
          "Replace" button, which uses the regression-aware path below. */}

      {/* Phase 4: Structural Regression Warning Dialog */}
      <AlertDialog 
        open={!!pendingRegressionWarning} 
        onOpenChange={(open) => !open && setPendingRegressionWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600">Warning: Structure Change Detected</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRegressionWarning?.regressionResult.message}
              <br /><br />
              <div className="text-sm text-muted-foreground">
                <strong>Existing workflow:</strong> {pendingRegressionWarning?.regressionResult.existing.branchingPoints || 0} branching points, {pendingRegressionWarning?.regressionResult.existing.decisionNodes || 0} decision nodes
                <br />
                <strong>Proposed replacement:</strong> {pendingRegressionWarning?.regressionResult.proposed.branchingPoints || 0} branching points, {pendingRegressionWarning?.regressionResult.proposed.decisionNodes || 0} decision nodes
              </div>
              <br />
              <strong>This action can be undone</strong> using Ctrl+Z or the undo button.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingRegressionWarning(null);
              toast({
                title: "Replace Cancelled",
                description: "Your existing workflow was preserved.",
              });
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingRegressionWarning) return;
                
                const pending = pendingRegressionWarning;
                setPendingRegressionWarning(null);
                
                // DEV DIAGNOSTIC: Log regression acknowledgment
                if (process.env.NODE_ENV === 'development') {
                  console.log('[REPLACE REGRESSION] User confirmed despite structural regression:', {
                    regressionType: pending.regressionResult.regressionType,
                    existing: pending.regressionResult.existing,
                    proposed: pending.regressionResult.proposed,
                  });
                }
                
                // Use shared function with regression acknowledged flag
                executeReplaceWorkflow(
                  pending.workflow,
                  pending.existingNodes,
                  pending.existingEdges,
                  { regressionAcknowledged: true }
                );
              }}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="confirm-replace-regression"
            >
              Continue Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Interface project destination picker */}
      <InterfaceScreenPickerModal
        open={screenPickerOpen}
        onOpenChange={(open) => { if (!open) setScreenPickerOpen(false); }}
        clusters={screenPickerClusters}
        onConfirm={(selected) => {
          setScreenPickerOpen(false);
          if (screenPickerSourceTab) {
            generateInterfaceFromWorkflow(screenPickerSourceTab, selected);
          }
        }}
      />

      {/* Table Link Picker for FormNode */}
      {tableLinkPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Link to Table
              </h3>
              <button
                onClick={() => setTableLinkPicker(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                data-testid="close-table-picker"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Select a table to link to this form:
            </p>
            <div className="space-y-2">
              {nodes
                .filter((n) => n.type === "table")
                .map((tableNode) => {
                  const tableNodeData = tableNode.data as TableNodeData;
                  const tableName =
                    tableNodeData.table?.name ||
                    tableNodeData.label ||
                    "Untitled Table";
                  const rowCount = tableNodeData.table?.rows?.length || 0;
                  return (
                    <button
                      key={tableNode.id}
                      onClick={() => {
                        saveToHistory("Link form to table");
                        setNodes((prev) =>
                          prev.map((n) => {
                            if (n.id === tableLinkPicker.formNodeId) {
                              return {
                                ...n,
                                data: {
                                  ...n.data,
                                  linkedTableId: tableNodeData.tableId,
                                  linkedTableNodeId: tableNode.id,
                                  linkedTableName: tableName,
                                },
                              };
                            }
                            return n;
                          }),
                        );
                        setTableLinkPicker(null);
                        toast({
                          title: "Table Linked",
                          description: `Form is now linked to "${tableName}"`,
                          variant: "default",
                        });
                      }}
                      className="w-full text-left px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                      data-testid={`select-table-${tableNode.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <Table2 size={16} className="text-indigo-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {tableName}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {rowCount} row{rowCount !== 1 ? "s" : ""}
                      </div>
                    </button>
                  );
                })}
              {nodes.filter((n) => n.type === "table").length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No tables available. Create a table node first.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageUploadModal && selectedImageNodeId && (
        <ImageUploadModal
          isOpen={showImageUploadModal}
          onClose={() => {
            setShowImageUploadModal(false);
            setSelectedImageNodeId(null);
          }}
          onImageUpload={async (file: File) => {
            // Convert file to data URL for local storage
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                // Update the node with the image
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === selectedImageNodeId
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            src: dataUrl,
                            filename: file.name,
                            sourceType: "upload",
                          },
                        }
                      : n,
                  ),
                );
                resolve(dataUrl);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }}
          onImageUrlSet={(url: string) => {
            // Update the node with the URL
            setNodes((prev) =>
              prev.map((n) =>
                n.id === selectedImageNodeId
                  ? { ...n, data: { ...n.data, src: url, sourceType: "url" } }
                  : n,
              ),
            );
          }}
        />
      )}

      {/* Image Analysis Modal for Boost menu */}
      <ImageAnalysisModal
        isOpen={showImageAnalysisModal}
        onClose={() => setShowImageAnalysisModal(false)}
        onGenerate={(workflow) => {
          // Create a new tab if none are open
          if (openTabs.length === 0) {
            const newTab = createBlankTab();
            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newTab.id);
            setTimeout(() => {
              // For new tabs, set the workflow directly
              setNodes(workflow.nodes);
              setEdges(workflow.edges);
              setTimeout(() => saveToHistory("Generate workflow from image"), 0);
              toast({
                title: "Workflow Generated",
                description: `Created ${workflow.nodes.length} nodes from image analysis.`,
              });
            }, 50);
          } else {
            // Append to existing canvas - calculate offset similar to AI generator
            const offset = calculateWorkflowOffset(workflow.nodes);
            const batchId = Date.now();
            
            // Create ID mapping
            const nodeIdMapping: { [oldId: string]: string } = {};
            
            // Offset nodes with unique IDs
            const offsetNodes = workflow.nodes.map((node: Node, index: number) => {
              const oldId = node.id || `node-${index}`;
              const newId = `${oldId}-img-${batchId}-${index}`;
              nodeIdMapping[oldId] = newId;
              return {
                ...node,
                id: newId,
                position: {
                  x: node.position.x + offset.x,
                  y: node.position.y + offset.y,
                },
                selected: false,
              };
            });
            
            // Offset edges with updated IDs
            const offsetEdges = workflow.edges.map((edge: Edge, index: number) => ({
              ...edge,
              id: `${edge.id || `edge-${index}`}-img-${batchId}-${index}`,
              source: nodeIdMapping[edge.source] || edge.source,
              target: nodeIdMapping[edge.target] || edge.target,
              selected: false,
            }));
            
            // Append to existing nodes and edges
            setNodes((prev) => [...prev, ...offsetNodes]);
            setEdges((prev) => [...prev, ...offsetEdges]);
            
            setTimeout(() => saveToHistory("Generate workflow from image"), 0);
            
            toast({
              title: "Workflow Generated",
              description: `Added ${offsetNodes.length} nodes from image analysis.`,
            });
          }
        }}
        onAddDetails={(analysisContext) => {
          // Build context message from analysis
          const stepsText = analysisContext.nodes
            .map((n, i) => `${i + 1}. ${n.data?.label || 'Untitled'}${n.data?.description ? `: ${n.data.description}` : ''}`)
            .join('\n');
          const recommendationsText = analysisContext.recommendations.length > 0 
            ? `\n\nRecommendations:\n${analysisContext.recommendations.map(r => `- ${r}`).join('\n')}`
            : '';
          
          const contextPrompt = `I analyzed a workflow image and want to refine it.\n\nAnalysis: ${analysisContext.analysis}\n\nDetected Steps (${analysisContext.nodes.length}):\n${stepsText}${recommendationsText}\n\nPlease help me improve this workflow. What details should I add or change?`;
          
          // Close analysis modal and open AI generator with pre-filled context
          setShowImageAnalysisModal(false);
          setGeneratorPrompt(contextPrompt);
          setShowAiGenerator(true);
        }}
      />

      {/* Figma Import Modal */}
      <FigmaImportModal
        isOpen={showFigmaModal}
        onClose={() => setShowFigmaModal(false)}
        onImport={async (framesWithThumbnails, mode, figmaInfo, importMode) => {
          if (framesWithThumbnails.length === 0) {
            toast({
              title: "No frames selected",
              description: "Please select at least one frame to import.",
              variant: "destructive",
            });
            return;
          }

          let importedNodeIds: string[] = [];

          if (mode === "new-project") {
            const workflowData = buildFigmaFrameWorkflow(
              framesWithThumbnails,
              { x: 100, y: 100 },
              50,
              figmaInfo?.fileKey,
              { importMode },
            );
            importedNodeIds = workflowData.nodes.map((n) => n.id);
            // Use the Figma frame/file name as the tab name so the tab
            // immediately reflects what was imported rather than always
            // showing a random cute name (task #366).
            const name =
              framesWithThumbnails.length === 1
                ? (framesWithThumbnails[0].frame.name || figmaInfo?.fileName || generateCuteName())
                : (figmaInfo?.fileName || generateCuteName());
            const newTabId = generateTabId();
            const projectUuid = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newTab: WorkflowTab = {
              id: newTabId,
              name,
              nodes: workflowData.nodes,
              edges: workflowData.edges,
              canvasObjects: workflowData.canvasObjects || [],
              viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
              selectedNodeId: "",
              selectedEdgeId: "",
              history: [
                {
                  nodes: workflowData.nodes,
                  edges: workflowData.edges,
                  canvasObjects: workflowData.canvasObjects || [],
                  viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
                },
              ],
              historyIndex: 0,
              showImageModal: null,
              metadata: {
                name,
                description: "Imported from Figma",
                links: [],
                linksFormat: "text",
                categories: [],
              },
              projectUuid,
            };
            setTabs((prev) => [...prev, newTab]);
            setActiveTabId(newTabId);

            if (figmaInfo) {
              addFigmaSource(
                newTabId,
                figmaInfo.url,
                figmaInfo.fileName,
                figmaInfo.fileKey,
                framesWithThumbnails.length,
              );
            }

            toast({
              title: "Figma Imported",
              description: `Created "${name}" with ${framesWithThumbnails.length} frame${framesWithThumbnails.length > 1 ? "s" : ""}.`,
            });

            if (importMode === "workflow" && importedNodeIds.length > 0) {
              setTimeout(() => {
                setWorkflowPreviewFrameIds(importedNodeIds);
                setShowWorkflowPreviewModal(true);
              }, 300);
            }
          } else {
            saveToHistory("Import Figma frames");
            const newNodes = insertFigmaFrames(
              nodes,
              framesWithThumbnails,
              50,
              figmaInfo?.fileKey,
              { importMode },
            );
            importedNodeIds = newNodes.map((n) => n.id);
            setNodes((prev) => [...prev, ...newNodes]);

            if (figmaInfo) {
              addFigmaSource(
                activeTabId,
                figmaInfo.url,
                figmaInfo.fileName,
                figmaInfo.fileKey,
                framesWithThumbnails.length,
              );
            }

            toast({
              title: "Figma Added",
              description: `Added ${framesWithThumbnails.length} frame${framesWithThumbnails.length > 1 ? "s" : ""} to your workflow.`,
            });

            if (importMode === "workflow" && importedNodeIds.length > 0) {
              setTimeout(() => {
                setWorkflowPreviewFrameIds(importedNodeIds);
                setShowWorkflowPreviewModal(true);
              }, 300);
            }
          }

          setShowFigmaModal(false);
        }}
        mode={figmaImportMode}
      />

      {/* Workflow Generation Preview Modal */}
      <WorkflowGenerationPreviewModal
        isOpen={showWorkflowPreviewModal}
        onClose={() => {
          setShowWorkflowPreviewModal(false);
          setWorkflowPreviewFrameIds([]);
        }}
        frameNodes={nodes.filter((n) => workflowPreviewFrameIds.includes(n.id))}
        onConfirm={async ({ useCleanLayout, mode }) => {
          setIsGeneratingWorkflow(true);
          try {
            const frameNodes = nodes.filter((n) =>
              workflowPreviewFrameIds.includes(n.id),
            );
            const validFrames = filterValidWorkflowFrames(frameNodes);
            const sortedFrames = sortFrameNodesForWorkflow(validFrames);

            if (sortedFrames.length === 0) {
              toast({
                title: "No valid frames",
                description:
                  "No frames with semantic data found for workflow generation.",
                variant: "destructive",
              });
              return;
            }

            saveToHistory("Generate workflow from Figma");

            let generatedNodes: Node[] = [];
            let generatedEdges: Edge[] = [];
            const startY =
              Math.max(...nodes.map((n) => n.position.y + (n.height || 100))) +
              100;

            if (mode === "ai_vision") {
              const semantics = sortedFrames
                .map((f) => f.data?.figmaSemantic)
                .filter(Boolean) as any[];
              const thumbnailUrls = sortedFrames
                .map((f) => f.data?.src)
                .filter(Boolean) as string[];

              let visionDegradeReason = '';
              const result = await generateAIVisionWorkflow(
                semantics,
                thumbnailUrls,
                { x: 400, y: startY },
                50,
                (reason) => {
                  visionDegradeReason = reason;
                },
              );
              generatedNodes = result.nodes;
              generatedEdges = result.edges;
              if (visionDegradeReason) {
                toast({
                  title: "Built without image analysis",
                  description: visionDegradeReason,
                });
              }
            } else if (mode === "ai_refined") {
              const semantics = sortedFrames
                .map((f) => f.data?.figmaSemantic)
                .filter(Boolean) as any[];

              const result = await generateAIRefinedWorkflow(semantics, {
                x: 400,
                y: startY,
              });
              generatedNodes = result.nodes;
              generatedEdges = result.edges;
            } else {
              let offsetY = startY;

              for (const frame of sortedFrames) {
                const semantic = frame.data?.figmaSemantic;
                if (!semantic) continue;

                const frameName =
                  frame.data?.label || frame.data?.figmaName || "Frame";
                const result = generateWorkflowFromFigmaSemantic(
                  semantic,
                  frameName,
                  frame,
                  { mode },
                );

                generatedNodes.push(...result.nodes);
                generatedEdges.push(...result.edges);
                offsetY += result.nodes.length * 120 + 100;
              }
            }

            if (generatedNodes.length > 0) {
              setNodes((prev) => [...prev, ...generatedNodes]);
              setEdges((prev) => [...prev, ...generatedEdges]);

              if (useCleanLayout) {
                setTimeout(() => {
                  const allNodes = [...nodes, ...generatedNodes];
                  const layoutedNodes = allNodes.map((n, i) => ({
                    ...n,
                    position: {
                      x: generatedNodes.some((gn) => gn.id === n.id)
                        ? 400
                        : n.position.x,
                      y: generatedNodes.some((gn) => gn.id === n.id)
                        ? Math.max(
                            ...nodes.map(
                              (node) => node.position.y + (node.height || 100),
                            ),
                          ) +
                          100 +
                          generatedNodes.indexOf(n) * 120
                        : n.position.y,
                    },
                  }));
                  setNodes(layoutedNodes);
                }, 100);
              }

              const modeLabel =
                mode === "ai_vision"
                  ? "AI Vision"
                  : mode === "ai_refined"
                    ? "AI Refined"
                    : mode === "detailed"
                      ? "Detailed"
                      : "Compact";
              toast({
                title: "Workflow Generated",
                description: `Created ${generatedNodes.length} nodes (${modeLabel} mode) from ${sortedFrames.length} frame(s).`,
              });

              // Use afterWorkflowCreation hook for PRD generation (Figma workflow path)
              // Must use the same projectUuid that the tab has/will have
              const effectiveProjectId = activeTab?.projectUuid || activeTabId;
              // Compute workflow group ID from generated nodes
              let figmaRootNodeId = generatedNodes[0]?.id || "";
              let figmaMinSum = Infinity;
              generatedNodes.forEach((node: Node) => {
                const sum = (node.position?.x || 0) + (node.position?.y || 0);
                if (sum < figmaMinSum) {
                  figmaMinSum = sum;
                  figmaRootNodeId = node.id;
                }
              });
              const figmaWorkflowGroupId = `workflow-${figmaRootNodeId}`;
              const figmaWorkflowName =
                generatedNodes[0]?.data?.label || "Figma Workflow";

              afterWorkflowCreation({
                projectId: effectiveProjectId,
                workflows: [
                  {
                    workflowId: figmaWorkflowGroupId,
                    workflowName: figmaWorkflowName,
                    nodes: generatedNodes,
                    edges: generatedEdges,
                  },
                ],
                source: "figma",
                generatePRD: true,
                aiClient: routerAiClient,
                onPRDGenerated: (workflowId, prd) => {
                  toast({
                    title: "PRD Generated",
                    description:
                      "A first draft PRD has been created for your Figma workflow.",
                  });
                },
                onProjectDetailsGenerated: (details) => {
                },
                onError: (error, context) => {
                  console.error(
                    "[Figma] Error in afterWorkflowCreation:",
                    context,
                    error,
                  );
                },
              }).catch((err) => {
                console.error("[Figma] afterWorkflowCreation failed:", err);
              });
            }
          } catch (error) {
            console.error("Error generating workflow:", error);
            toast({
              title: "Generation Failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to generate workflow from frames.",
              variant: "destructive",
            });
          } finally {
            setIsGeneratingWorkflow(false);
            setShowWorkflowPreviewModal(false);
            setWorkflowPreviewFrameIds([]);
          }
        }}
        isGenerating={isGeneratingWorkflow}
      />

      {/* Table Panel */}
      {openTablePanel && (
        <TablePanel
          tableId={openTablePanel}
          table={tableData[openTablePanel]}
          position={{ x: 100, y: 100 }}
          onClose={() => setOpenTablePanel(null)}
          onUpdateTable={(updatedTable) => {
            setTableData((prev) => ({
              ...prev,
              [openTablePanel]: updatedTable,
            }));
            // Also update the node to trigger re-render
            setNodes((prev) =>
              prev.map((n) =>
                n.data?.tableId === openTablePanel
                  ? { ...n, data: { ...n.data, _tableUpdated: Date.now() } }
                  : n,
              ),
            );
          }}
          onCreateNodeFromRow={(row, rowIndex) => {
            const tableNode = nodes.find(
              (n) => n.data?.tableId === openTablePanel,
            );
            const position = tableNode
              ? {
                  x: tableNode.position.x + (tableNode.width || 280) + 50,
                  y: tableNode.position.y + rowIndex * 120,
                }
              : getViewportCenteredPosition();

            const rowLabel =
              Object.values(row)[0]?.toString() || `Row ${rowIndex + 1}`;

            const newNode: Node = {
              id: `node-${Date.now()}`,
              type: "process",
              position,
              data: {
                label: rowLabel,
                description: `Data from ${openTablePanel}`,
                icon: "Database",
                iconColor: "text-indigo-500",
                sourceTable: openTablePanel,
                sourceTableNodeId: tableNode?.id,
                sourceTableName: tableNode?.data?.label || "Table",
                sourceRowIndex: rowIndex,
                rowData: row,
              },
              width: 200,
              height: 100,
            };

            saveToHistory("Create node from table row");
            setNodes((prev) => [...prev, newNode]);

            toast({
              title: "Data Node Created",
              description: `Created node from row ${rowIndex + 1}`,
              variant: "default",
            });
          }}
        />
      )}

      {/* Node Gallery Panel */}
      {showGalleryPanel && (
        <div className="fixed bottom-4 right-4 z-50 w-[600px] max-w-[calc(100vw-2rem)]">
          <NodeGalleryPanel
            nodes={nodes}
            templates={savedTemplates}
            onFocusNode={focusOnNode}
            onClose={() => setShowGalleryPanel(false)}
          />
        </div>
      )}

      {/* Plugin Test Panel */}
      {showPluginTest && (
        <PluginTestPanel
          onClose={() => setShowPluginTest(false)}
          nodes={nodes}
          edges={edges}
        />
      )}

      {contextMenu && !isPhoneViewOnly && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCopyProperties={() => {
            if (contextMenu.node) {
              // Copy node properties (colors, icon, iconColor, etc.) but not label/description
              const propertiesToCopy = {
                colors: contextMenu.node.data?.colors,
                data: {
                  icon: contextMenu.node.data?.icon,
                  iconColor: contextMenu.node.data?.iconColor,
                },
              };
              setCopiedProperties(propertiesToCopy);
              setContextMenu(null);
            } else if (contextMenu.canvasObject) {
              // Copy canvas object properties (styling and data)
              const propertiesToCopy = {
                data: { ...contextMenu.canvasObject.data },
                style: { ...contextMenu.canvasObject.style },
              };
              setCopiedCanvasObjectProperties(propertiesToCopy);
              setContextMenu(null);
            }
          }}
          onPasteProperties={
            (contextMenu.node && copiedProperties) ||
            (contextMenu.canvasObject && copiedCanvasObjectProperties)
              ? () => {
                  if (contextMenu.node && copiedProperties) {
                    saveToHistory("Paste node properties");
                    updateActiveTab({
                      nodes: nodes.map((n) =>
                        n.id === contextMenu.node!.id
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                ...copiedProperties.data,
                                colors: copiedProperties.colors,
                              },
                            }
                          : n,
                      ),
                    });
                    setContextMenu(null);
                  } else if (
                    contextMenu.canvasObject &&
                    copiedCanvasObjectProperties
                  ) {
                    saveToHistory("Paste canvas object properties");
                    const updatedObjects = canvasObjects.map((obj) =>
                      obj.id === contextMenu.canvasObject!.id
                        ? {
                            ...obj,
                            data: {
                              ...obj.data,
                              ...copiedCanvasObjectProperties.data,
                            },
                            style: {
                              ...obj.style,
                              ...copiedCanvasObjectProperties.style,
                            },
                          }
                        : obj,
                    );
                    updateActiveTab({ canvasObjects: updatedObjects });
                    setContextMenu(null);
                  }
                }
              : undefined
          }
          hasPropertiesInClipboard={
            !!(copiedProperties || copiedCanvasObjectProperties)
          }
          onBringToFront={() => {
            if (contextMenu.node) {
              const maxZIndex = Math.max(...nodes.map((n) => n.zIndex || 0));
              saveToHistory("Bring node to front");
              const updatedNodes = nodes.map((n) =>
                n.id === contextMenu.node!.id
                  ? { ...n, zIndex: maxZIndex + 1 }
                  : n,
              );
              // Recalculate edge z-indexes based on updated nodes
              const updatedEdges = recalculateAllEdgeZIndexes(
                edges,
                updatedNodes,
              );
              updateActiveTab({
                nodes: updatedNodes,
                edges: updatedEdges,
              });
            } else if (contextMenu.canvasObject) {
              const maxZIndex = Math.max(
                ...canvasObjects.map((obj) => obj.zIndex || 0),
              );
              saveToHistory("Bring canvas object to front");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) =>
                  obj.id === contextMenu.canvasObject!.id
                    ? { ...obj, zIndex: maxZIndex + 1 }
                    : obj,
                ),
              });
            }
            setContextMenu(null);
          }}
          onBringForward={() => {
            if (contextMenu.node) {
              const currentZIndex = contextMenu.node.zIndex || 0;
              saveToHistory("Bring node forward");
              const updatedNodes = nodes.map((n) =>
                n.id === contextMenu.node!.id
                  ? { ...n, zIndex: currentZIndex + 1 }
                  : n,
              );
              // Recalculate edge z-indexes based on updated nodes
              const updatedEdges = recalculateAllEdgeZIndexes(
                edges,
                updatedNodes,
              );
              updateActiveTab({
                nodes: updatedNodes,
                edges: updatedEdges,
              });
            } else if (contextMenu.canvasObject) {
              const currentZIndex = contextMenu.canvasObject.zIndex || 0;
              saveToHistory("Bring canvas object forward");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) =>
                  obj.id === contextMenu.canvasObject!.id
                    ? { ...obj, zIndex: currentZIndex + 1 }
                    : obj,
                ),
              });
            }
            setContextMenu(null);
          }}
          onSendBackward={() => {
            if (contextMenu.node) {
              const currentZIndex = contextMenu.node.zIndex || 0;
              saveToHistory("Send node backward");
              const updatedNodes = nodes.map((n) =>
                n.id === contextMenu.node!.id
                  ? { ...n, zIndex: Math.max(0, currentZIndex - 1) }
                  : n,
              );
              // Recalculate edge z-indexes based on updated nodes
              const updatedEdges = recalculateAllEdgeZIndexes(
                edges,
                updatedNodes,
              );
              updateActiveTab({
                nodes: updatedNodes,
                edges: updatedEdges,
              });
            } else if (contextMenu.canvasObject) {
              const currentZIndex = contextMenu.canvasObject.zIndex || 0;
              saveToHistory("Send canvas object backward");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) =>
                  obj.id === contextMenu.canvasObject!.id
                    ? { ...obj, zIndex: Math.max(0, currentZIndex - 1) }
                    : obj,
                ),
              });
            }
            setContextMenu(null);
          }}
          onSendToBack={() => {
            if (contextMenu.node) {
              saveToHistory("Send node to back");
              const updatedNodes = nodes.map((n) =>
                n.id === contextMenu.node!.id ? { ...n, zIndex: 0 } : n,
              );
              // Recalculate edge z-indexes based on updated nodes
              const updatedEdges = recalculateAllEdgeZIndexes(
                edges,
                updatedNodes,
              );
              updateActiveTab({
                nodes: updatedNodes,
                edges: updatedEdges,
              });
            } else if (contextMenu.canvasObject) {
              saveToHistory("Send canvas object to back");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) =>
                  obj.id === contextMenu.canvasObject!.id
                    ? { ...obj, zIndex: 0 }
                    : obj,
                ),
              });
            }
            setContextMenu(null);
          }}
          onDelete={() => {
            if (contextMenu.node) {
              saveToHistory("Delete node");
              setNodes((prev) =>
                prev.filter((n) => n.id !== contextMenu.node!.id),
              );
              setEdges((prev) =>
                prev.filter(
                  (e) =>
                    e.source !== contextMenu.node!.id &&
                    e.target !== contextMenu.node!.id,
                ),
              );
              setLinearToolbar(null);
              setContextMenu(null);
            } else if (contextMenu.canvasObject) {
              saveToHistory("Delete canvas object");
              const updatedObjects = canvasObjects.filter(
                (obj) => obj.id !== contextMenu.canvasObject!.id,
              );
              updateActiveTab({ canvasObjects: updatedObjects });
              setLinearToolbar(null);
              setContextMenu(null);
            }
          }}
          onDuplicate={() => {
            if (contextMenu.node) {
              const newNode = {
                ...contextMenu.node,
                id: `node-${Date.now()}`,
                position: {
                  x: contextMenu.node.position.x + 20,
                  y: contextMenu.node.position.y + 20,
                },
              };
              saveToHistory("Duplicate node");
              setNodes((prev) => [...prev, newNode]);
              setContextMenu(null);
            } else if (contextMenu.canvasObject) {
              const newObject = {
                ...contextMenu.canvasObject,
                id: `canvas-object-${Date.now()}`,
                position: {
                  x: contextMenu.canvasObject.position.x + 20,
                  y: contextMenu.canvasObject.position.y + 20,
                },
                selected: false,
              };
              const updatedObjects = [...canvasObjects, newObject];
              saveToHistory("Duplicate canvas object");
              updateActiveTab({ canvasObjects: updatedObjects });
              setContextMenu(null);
            }
          }}
          onViewSemanticData={
            contextMenu.node?.type === "image" &&
            contextMenu.node?.data?.figmaSemantic
              ? () => { /* semantic data available via node.data.figmaSemantic */ }
              : undefined
          }
          node={contextMenu.node}
          onGenerateWorkflowFromFrames={(nodeIds) => {
            setWorkflowPreviewFrameIds(nodeIds);
            setShowWorkflowPreviewModal(true);
            setContextMenu(null);
          }}
          onToggleReferenceFrame={(nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) {
              const isNowReference = !node.data?.isReferenceFrame;
              saveToHistory("Toggle reference frame");
              updateActiveTab({
                nodes: nodes.map((n) =>
                  n.id === nodeId
                    ? {
                        ...n,
                        data: { ...n.data, isReferenceFrame: isNowReference },
                      }
                    : n,
                ),
              });
              toast({
                title: isNowReference
                  ? "Marked as Reference"
                  : "Unmarked as Reference",
                description: isNowReference
                  ? "This frame will be excluded from workflow generation."
                  : "This frame is now available for workflow generation.",
              });
            }
            setContextMenu(null);
          }}
          prdLinks={
            contextMenu.node && activeTab?.projectUuid
              ? prdNodeLinkStore.getLinksForNode(
                  activeTab.projectUuid,
                  contextMenu.node.id,
                )
              : undefined
          }
          onViewLinkedPRD={(link: PRDNodeLink) => {
            // Scroll to the linked PRD section in the right panel
            setTimeout(() => {
              const sectionEl = document.getElementById(
                `prd-section-${link.sectionId}`,
              );
              if (sectionEl) {
                sectionEl.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                sectionEl.classList.add("ring-2", "ring-blue-500");
                setTimeout(
                  () => sectionEl.classList.remove("ring-2", "ring-blue-500"),
                  2000,
                );
              }
            }, 100);
            setContextMenu(null);
          }}
        />
      )}

      {/* Linear Toolbar for Node/Edge Styling */}
      {linearToolbar && !isPhoneViewOnly && (
        <LinearToolbar
          key={`toolbar-${linearToolbar.node?.id || linearToolbar.edge?.id || linearToolbar.canvasObject?.id}-${linearToolbar.editingHyperlinkId || ""}-${linearToolbar.initialSubmenu || ""}`}
          isOpen={true}
          position={{ x: linearToolbar.x, y: linearToolbar.y }}
          nodeRect={linearToolbar.nodeRect}
          viewportHeight={window.innerHeight}
          target={
            linearToolbar.node
              ? { type: "node", id: linearToolbar.node.id }
              : linearToolbar.edge
                ? { type: "edge", id: linearToolbar.edge.id }
                : linearToolbar.canvasObject
                  ? { type: "canvasObject", id: linearToolbar.canvasObject.id }
                  : null
          }
          node={
            linearToolbar.node
              ? (nodes.find((n) => n.id === linearToolbar.node!.id) ??
                linearToolbar.node)
              : undefined
          }
          edge={
            linearToolbar.edge
              ? (edges.find((e) => e.id === linearToolbar.edge!.id) ??
                linearToolbar.edge)
              : undefined
          }
          edgeTargetNodeType={
            linearToolbar.edge
              ? nodes.find((n) => n.id === linearToolbar.edge!.target)?.type
              : undefined
          }
          canvasObject={
            linearToolbar.canvasObject
              ? (canvasObjects.find(
                  (o) => o.id === linearToolbar.canvasObject!.id,
                ) ?? linearToolbar.canvasObject)
              : undefined
          }
          onClose={() => setLinearToolbar(null)}
          onOpenComponentMenu={() => {
            if (linearToolbar.node?.type === "compound") {
              window.dispatchEvent(
                new CustomEvent("openCompoundComponentMenu", {
                  detail: { nodeId: linearToolbar.node.id },
                }),
              );
              // Close the linear toolbar when opening component menu
              setLinearToolbar(null);
            }
          }}
          onColorChange={(colors) => {
            if (linearToolbar.node) {
              saveToHistory("Change node color");
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === linearToolbar.node!.id
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          colors: { ...n.data?.colors, ...colors },
                        },
                      }
                    : n,
                ),
              );
            }
          }}
          onEdgeColorChange={(color) => {
            if (linearToolbar.edge) {
              saveToHistory("Change edge color");
              setEdges((prev) =>
                prev.map((e) =>
                  e.id === linearToolbar.edge!.id
                    ? {
                        ...e,
                        style: {
                          ...e.style,
                          strokeColor: color,
                          stroke: color,
                        },
                      }
                    : e,
                ),
              );
            }
          }}
          onTextEdit={() => {
            if (linearToolbar.node) {
              setInlineEditing({ nodeId: linearToolbar.node.id, part: "body" });
              // Keep toolbar open for text styling
            }
          }}
          onStyleChange={(style) => {
            if (linearToolbar.node) {
              saveToHistory("Change node style");
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === linearToolbar.node!.id
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          borderStyle: style.borderStyle ?? n.data?.borderStyle,
                          borderWidth: style.borderWidth ?? n.data?.borderWidth,
                          noStroke: style.noStroke ?? n.data?.noStroke,
                        },
                      }
                    : n,
                ),
              );
            } else if (linearToolbar.edge) {
              saveToHistory("Change edge style");
              setEdges((prev) =>
                prev.map((e) =>
                  e.id === linearToolbar.edge!.id
                    ? {
                        ...e,
                        style: { ...e.style, strokeWidth: style.strokeWidth },
                      }
                    : e,
                ),
              );
            }
          }}
          onTextStyleChange={(style, part) => {
            if (linearToolbar.node) {
              saveToHistory("Change text style");
              setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== linearToolbar.node!.id) return n;

                  // Apply styles to header or body based on 'part' parameter
                  if (part === "header") {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        headerFontSize:
                          style.fontSize ?? n.data?.headerFontSize,
                        headerBold: style.bold ?? n.data?.headerBold,
                        headerItalic: style.italic ?? n.data?.headerItalic,
                        headerStrikethrough:
                          style.strikethrough ?? n.data?.headerStrikethrough,
                        headerUnderline:
                          style.underline ?? n.data?.headerUnderline,
                        headerTextAlign: style.align ?? n.data?.headerTextAlign,
                      },
                    };
                  } else {
                    // Default to body styles
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        fontSize: style.fontSize ?? n.data?.fontSize,
                        bold: style.bold ?? n.data?.bold,
                        italic: style.italic ?? n.data?.italic,
                        strikethrough:
                          style.strikethrough ?? n.data?.strikethrough,
                        underline: style.underline ?? n.data?.underline,
                        textAlign: style.align ?? n.data?.textAlign,
                      },
                    };
                  }
                }),
              );
            }
          }}
          onIconSelect={(iconData) => {
            if (linearToolbar.node) {
              saveToHistory("Change node icon");
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === linearToolbar.node!.id
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          nodeIcon: iconData.emoji || iconData.icon,
                          iconVisible: iconData.visible,
                        },
                      }
                    : n,
                ),
              );
            }
          }}
          selectedText={selectedText}
          hyperlinks={linearToolbar.node?.data?.hyperlinks || []}
          editingHyperlinkId={linearToolbar.editingHyperlinkId || null}
          onAddHyperlink={(hyperlink) => {
            const {
              id,
              text: linkText,
              url,
              showPreview,
              metadata,
            } = hyperlink;
            if (linearToolbar.node) {
              saveToHistory("Add hyperlink");
              setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== linearToolbar.node!.id) return n;

                  // Get existing hyperlinks array or create from legacy
                  let existingLinks = n.data?.hyperlinks || [];
                  if (existingLinks.length === 0 && n.data?.hyperlink?.url) {
                    existingLinks = [
                      {
                        id: "legacy-0",
                        text: n.data.hyperlink.text,
                        url: n.data.hyperlink.url,
                        showPreview: n.data.hyperlink.showPreview,
                        metadata: n.data.hyperlink.metadata,
                      },
                    ];
                  }

                  // If text or url is empty, this is a delete for legacy
                  if (!linkText || !url) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        hyperlinks: existingLinks.filter(
                          (h: any) => h.id !== id,
                        ),
                        hyperlink: undefined,
                      },
                    };
                  }

                  const newLink = {
                    id: id || `link-${Date.now()}`,
                    text: linkText,
                    url,
                    showPreview: showPreview ?? false,
                    metadata: metadata ?? undefined,
                  };

                  // Update existing or add new
                  const isEditing =
                    id &&
                    (existingLinks.some((h: any) => h.id === id) ||
                      (id.startsWith("link-idx-") &&
                        parseInt(id.replace("link-idx-", ""), 10) <
                          existingLinks.length));

                  if (isEditing) {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        hyperlinks: existingLinks.map(
                          (h: any, index: number) => {
                            if (h.id === id) return newLink;
                            if (id.startsWith("link-idx-")) {
                              const idx = parseInt(
                                id.replace("link-idx-", ""),
                                10,
                              );
                              if (index === idx && !h.id) return newLink;
                            }
                            return h;
                          },
                        ),
                        hyperlink: undefined,
                      },
                    };
                  } else {
                    return {
                      ...n,
                      data: {
                        ...n.data,
                        hyperlinks: [...existingLinks, newLink],
                        hyperlink: undefined,
                      },
                    };
                  }
                }),
              );
              // Clear editing state
              if (linearToolbar) {
                setLinearToolbar({
                  ...linearToolbar,
                  editingHyperlinkId: undefined,
                });
              }
            }
          }}
          onDeleteHyperlink={(hyperlinkId) => {
            if (linearToolbar.node) {
              saveToHistory("Delete hyperlink");
              setNodes((prev) =>
                prev.map((n) => {
                  if (n.id !== linearToolbar.node!.id) return n;

                  // Get existing hyperlinks array
                  let existingLinks = n.data?.hyperlinks || [];
                  if (existingLinks.length === 0 && n.data?.hyperlink?.url) {
                    // Handle legacy - if deleting legacy, clear it
                    if (hyperlinkId === "legacy-0") {
                      return {
                        ...n,
                        data: {
                          ...n.data,
                          hyperlink: undefined,
                          hyperlinks: [],
                        },
                      };
                    }
                    existingLinks = [
                      {
                        id: "legacy-0",
                        text: n.data.hyperlink.text,
                        url: n.data.hyperlink.url,
                      },
                    ];
                  }

                  const filteredLinks = existingLinks.filter(
                    (h: any, index: number) => {
                      if (h.id === hyperlinkId) return false;
                      if (hyperlinkId.startsWith("link-idx-")) {
                        const idx = parseInt(
                          hyperlinkId.replace("link-idx-", ""),
                          10,
                        );
                        if (index === idx && !h.id) return false;
                      }
                      return true;
                    },
                  );

                  return {
                    ...n,
                    data: {
                      ...n.data,
                      hyperlinks: filteredLinks,
                      hyperlink: undefined,
                    },
                  };
                }),
              );
              // Clear editing state
              if (linearToolbar) {
                setLinearToolbar({
                  ...linearToolbar,
                  editingHyperlinkId: undefined,
                });
              }
            }
          }}
          onEdgeStyleChange={(style) => {
            if (linearToolbar.edge) {
              saveToHistory("Change edge style");
              setEdges((prev) =>
                prev.map((e) => {
                  if (e.id !== linearToolbar.edge!.id) return e;

                  const updatedEdge = { ...e };

                  // Handle stroke style (solid, dashed, dotted)
                  if (style.strokeStyle !== undefined) {
                    const styleConfig: Record<
                      string,
                      { dasharray: string | undefined; linecap: string }
                    > = {
                      solid: { dasharray: undefined, linecap: "butt" },
                      dashed: { dasharray: "8 4", linecap: "butt" },
                      dotted: { dasharray: "0.1 6", linecap: "round" },
                    };
                    const config = styleConfig[style.strokeStyle];
                    updatedEdge.style = {
                      ...updatedEdge.style,
                      strokeDasharray: config.dasharray,
                      strokeLinecap: config.linecap as any,
                    };
                  }

                  // Handle stroke width
                  if (style.strokeWidth !== undefined) {
                    updatedEdge.style = {
                      ...updatedEdge.style,
                      strokeWidth: style.strokeWidth,
                    };
                  }

                  // Handle line type
                  if (style.lineType !== undefined) {
                    updatedEdge.type = style.lineType;
                  }

                  // Handle markers
                  if (style.markerStart !== undefined) {
                    updatedEdge.markerStart = style.markerStart;
                  }
                  if (style.markerEnd !== undefined) {
                    updatedEdge.markerEnd = style.markerEnd;
                  }

                  // Handle animated
                  if (style.animated !== undefined) {
                    updatedEdge.animated = style.animated;
                  }

                  return updatedEdge;
                }),
              );
            }
          }}
          onEdgeDirectionSwap={() => {
            if (linearToolbar.edge) {
              saveToHistory("Swap edge direction");
              setEdges((prev) =>
                prev.map((e) => {
                  if (e.id !== linearToolbar.edge!.id) return e;
                  // Swap source and target
                  return {
                    ...e,
                    source: e.target,
                    target: e.source,
                    // Also swap markers if they exist
                    markerStart: e.markerEnd,
                    markerEnd: e.markerStart,
                  };
                }),
              );
            }
          }}
          selectedNodes={nodes.filter((n) => n.selected)}
          allEdges={edges}
          additionalSelectedEdgeIds={selectedEdgeIds}
          onBulkEdgeStyleChange={(style) => {
            // Compute affected edge IDs: connected to any selected node + Shift+clicked
            const selectedNodeIdSet = new Set(
              nodes.filter((n) => n.selected).map((n) => n.id)
            );
            // Also include the node the toolbar is anchored to (handles single-click case)
            if (linearToolbar.node) selectedNodeIdSet.add(linearToolbar.node.id);
            const byNode = edges
              .filter((e) => selectedNodeIdSet.has(e.source) || selectedNodeIdSet.has(e.target))
              .map((e) => e.id);
            const affectedIds = new Set([...byNode, ...selectedEdgeIds]);

            if (affectedIds.size === 0) return;
            saveToHistory("Bulk edit edges");

            const strokeConfig: Record<string, { dasharray: string | undefined; linecap: string }> = {
              solid: { dasharray: undefined, linecap: "butt" },
              dashed: { dasharray: "8 4", linecap: "butt" },
              dotted: { dasharray: "0.1 6", linecap: "round" },
            };

            setEdges((prev) =>
              prev.map((e) => {
                if (!affectedIds.has(e.id)) return e;
                const updated = { ...e };
                if (style.color !== undefined) {
                  updated.style = { ...updated.style, strokeColor: style.color, stroke: style.color };
                }
                if (style.strokeStyle !== undefined) {
                  const cfg = strokeConfig[style.strokeStyle];
                  updated.style = { ...updated.style, strokeDasharray: cfg.dasharray, strokeLinecap: cfg.linecap as any };
                }
                if (style.strokeWidth !== undefined) {
                  updated.style = { ...updated.style, strokeWidth: style.strokeWidth };
                }
                if (style.lineType !== undefined) {
                  updated.type = style.lineType as any;
                }
                if (style.markerStart !== undefined) {
                  updated.markerStart = style.markerStart;
                }
                if (style.markerEnd !== undefined) {
                  updated.markerEnd = style.markerEnd;
                }
                if (style.animated !== undefined) {
                  updated.animated = style.animated;
                }
                return updated;
              })
            );
          }}
          onDelete={() => {
            if (linearToolbar.node) {
              const nodeName = linearToolbar.node.data?.label || "Node";
              const nodeId = linearToolbar.node.id;
              const deletedNode = linearToolbar.node;
              const connectedEdges = edges.filter(
                (e) => e.source === nodeId || e.target === nodeId,
              );

              saveToHistory("Delete node");
              setNodes((prev) => prev.filter((n) => n.id !== nodeId));
              setEdges((prev) =>
                prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
              );

              toast({
                title: `${nodeName} deleted`,
                action: (
                  <button
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    onClick={() => {
                      setNodes((prev) => [...prev, deletedNode]);
                      setEdges((prev) => [...prev, ...connectedEdges]);
                    }}
                  >
                    Undo
                  </button>
                ),
                duration: 5000,
              });
            } else if (linearToolbar.edge) {
              const edgeId = linearToolbar.edge.id;
              const deletedEdge = linearToolbar.edge;

              saveToHistory("Delete edge");
              setEdges((prev) => prev.filter((e) => e.id !== edgeId));

              toast({
                title: "Connection deleted",
                action: (
                  <button
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    onClick={() => {
                      setEdges((prev) => [...prev, deletedEdge]);
                    }}
                  >
                    Undo
                  </button>
                ),
                duration: 5000,
              });
            } else if (linearToolbar.canvasObject) {
              const objType = linearToolbar.canvasObject.type;
              const objId = linearToolbar.canvasObject.id;
              const deletedObj = linearToolbar.canvasObject;
              const typeName =
                objType === "sticky"
                  ? "Sticky note"
                  : objType === "text"
                    ? "Text"
                    : "Shape";

              saveToHistory("Delete canvas object");
              updateActiveTab({
                canvasObjects: canvasObjects.filter((obj) => obj.id !== objId),
              });

              toast({
                title: `${typeName} deleted`,
                action: (
                  <button
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    onClick={() => {
                      updateActiveTab({
                        canvasObjects: [...canvasObjects, deletedObj],
                      });
                    }}
                  >
                    Undo
                  </button>
                ),
                duration: 5000,
              });
            }
            setLinearToolbar(null);
          }}
          onBreakDataLink={() => {
            if (linearToolbar.edge) {
              const edgeId = linearToolbar.edge.id;
              const sourceNodeId = linearToolbar.edge.source;
              const targetNodeId = linearToolbar.edge.target;

              saveToHistory("Break data link");

              // Delete the edge
              setEdges((prev) => prev.filter((e) => e.id !== edgeId));

              // Clear the linked data from both form nodes (source or target)
              setNodes((prev) =>
                prev.map((n) => {
                  if (
                    n.type === "form" &&
                    (n.id === sourceNodeId || n.id === targetNodeId)
                  ) {
                    const formData = n.data as any;
                    if (
                      formData?.linkedTableId ||
                      formData?.linkedRowIndex !== undefined
                    ) {
                      return {
                        ...n,
                        data: {
                          ...formData,
                          linkedTableId: undefined,
                          linkedTableNodeId: undefined,
                          linkedTableName: undefined,
                          linkedRowIndex: undefined,
                          fields: formData.fields?.map((field: any) => ({
                            ...field,
                            dataLink: undefined,
                            value: "", // Clear values when unlinked
                          })),
                        },
                      };
                    }
                  }
                  return n;
                }),
              );

              toast({
                title: "Data link broken",
                description: "The form is no longer linked to the table row",
                duration: 3000,
              });

              setLinearToolbar(null);
            }
          }}
          onWireframe={() => {
            if (linearToolbar.node) {
              if (isAdvanced || isAdmin) {
                const event = new CustomEvent("generateWireframe", {
                  detail: {
                    nodeId: linearToolbar.node.id,
                    node: linearToolbar.node,
                  },
                });
                window.dispatchEvent(event);
                setLinearToolbar(null);
              } else {
                setLinearToolbar(null);
                setFeatureUpsell({
                  featureName: 'Mockup Wireframe',
                  requiredTier: 'advanced',
                  description: 'Generate AI-powered wireframe mockups for your workflow nodes. Upgrade to Advanced or Pro to use this feature.',
                });
              }
            }
          }}
          canUseWireframe={isAdvanced || isAdmin}
          onRefineMockup={() => {
            if (linearToolbar.node) {
              setRefineMockupNodeId(linearToolbar.node.id);
            }
          }}
          refineMockupNodeId={refineMockupNodeId ?? undefined}
          onRefineMockupSubmit={async (prompt: string) => {
            const nodeId = refineMockupNodeId;
            if (!nodeId) return;
            const targetNode = nodes.find(n => n.id === nodeId);
            if (!targetNode) return;

            const response = await fetch("/api/generate-wireframe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                label: targetNode.data?.label || "Mockup",
                description: targetNode.data?.description || "",
                nodeType: targetNode.type || "image",
                refinementPrompt: prompt,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: "Failed to refine mockup" }));
              toast({
                title: "Refinement failed",
                description: errorData.error || "Could not update the mockup. Please try again.",
                variant: "destructive",
              });
              throw new Error(errorData.error || "Failed to refine mockup");
            }

            const { svg } = await response.json();
            const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

            saveToHistory("Refine mockup");

            setNodes(prev => prev.map(n => {
              if (n.id === nodeId) {
                return { ...n, data: { ...n.data, src: svgDataUrl } };
              }
              return n;
            }));
            setRefineMockupNodeId(null);

            toast({
              title: "Mockup updated",
              description: "Your refinement has been applied.",
            });
          }}
          onRefineMockupCancel={() => setRefineMockupNodeId(null)}
          onGenerateWorkflow={async () => {
            if (linearToolbar.node && linearToolbar.node.data?.figmaSemantic) {
              const semantic = linearToolbar.node.data.figmaSemantic;
              const frameName = linearToolbar.node.data.label || "Figma Frame";

              try {
                const result = generateWorkflowFromFigmaSemantic(
                  semantic,
                  frameName,
                  linearToolbar.node,
                );
                const {
                  nodes: generatedNodes,
                  edges: generatedEdges,
                  workflowName,
                } = result;

                if (generatedNodes.length > 0) {
                  saveToHistory("Generate workflow from Figma");
                  setNodes((prev) => [...prev, ...generatedNodes]);
                  if (generatedEdges.length > 0) {
                    setEdges((prev) => [...prev, ...generatedEdges]);
                  }

                  toast({
                    title: "Workflow Generated",
                    description: `Created ${generatedNodes.length} step${generatedNodes.length > 1 ? "s" : ""} from "${workflowName}"`,
                  });

                  // Use afterWorkflowCreation hook for PRD generation (single Figma node path)
                  // Must use the same projectUuid that the tab has
                  const effectiveProjectId =
                    activeTab?.projectUuid || activeTabId;
                  let singleFigmaRootNodeId = generatedNodes[0]?.id || "";
                  let singleFigmaMinSum = Infinity;
                  generatedNodes.forEach((node: Node) => {
                    const sum =
                      (node.position?.x || 0) + (node.position?.y || 0);
                    if (sum < singleFigmaMinSum) {
                      singleFigmaMinSum = sum;
                      singleFigmaRootNodeId = node.id;
                    }
                  });
                  const singleFigmaWorkflowGroupId = `workflow-${singleFigmaRootNodeId}`;

                  await afterWorkflowCreation({
                    projectId: effectiveProjectId,
                    workflows: [
                      {
                        workflowId: singleFigmaWorkflowGroupId,
                        workflowName: workflowName || frameName,
                        nodes: generatedNodes,
                        edges: generatedEdges,
                      },
                    ],
                    source: "figma",
                    generatePRD: true,
                    aiClient: routerAiClient,
                    onPRDGenerated: (workflowId, prd) => {
                      toast({
                        title: "PRD Generated",
                        description:
                          "A first draft PRD has been created for your Figma workflow.",
                      });
                    },
                    onError: (error, context) => {
                      console.error(
                        "[Figma Single] Error in afterWorkflowCreation:",
                        context,
                        error,
                      );
                    },
                  });
                } else {
                  toast({
                    title: "No Steps Found",
                    description:
                      "Could not detect logical screens in this Figma frame. Try a frame with clear visual sections.",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                console.error("Workflow generation failed:", error);
                toast({
                  title: "Generation Failed",
                  description: "Could not generate workflow from semantic data",
                  variant: "destructive",
                });
              }

              setLinearToolbar(null);
            }
          }}
          onCanvasObjectColorChange={(color) => {
            if (linearToolbar.canvasObject) {
              saveToHistory("Change canvas object color");
              const objType = linearToolbar.canvasObject.type;
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) => {
                  if (obj.id !== linearToolbar.canvasObject!.id) return obj;
                  if (objType === "sticky") {
                    return {
                      ...obj,
                      data: {
                        ...obj.data,
                        backgroundColor: color,
                        borderColor: color,
                      },
                    };
                  } else if (objType === "shape") {
                    const currentFillStyle =
                      (obj.data as any).fillStyle || "solid";
                    const fillOpacity =
                      currentFillStyle === "solid"
                        ? 0.5
                        : currentFillStyle === "transparent"
                          ? 0.3
                          : 0;
                    return {
                      ...obj,
                      data: {
                        ...obj.data,
                        fillColor: color,
                        strokeColor: color,
                        fillOpacity: fillOpacity,
                        strokeOpacity: 1.0,
                      },
                    };
                  } else if (objType === "text") {
                    return { ...obj, data: { ...obj.data, textColor: color } };
                  }
                  return obj;
                }),
              });
            }
          }}
          onCanvasObjectStyleChange={(style) => {
            if (linearToolbar.canvasObject) {
              saveToHistory("Change canvas object style");
              const objType = linearToolbar.canvasObject.type;
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) => {
                  if (obj.id !== linearToolbar.canvasObject!.id) return obj;
                  if (objType === "shape") {
                    // Shapes use strokeStyle and strokeWidth directly
                    return {
                      ...obj,
                      data: {
                        ...obj.data,
                        strokeStyle: style.strokeStyle ?? obj.data?.strokeStyle,
                        strokeWidth: style.strokeWidth ?? obj.data?.strokeWidth,
                      },
                    };
                  } else {
                    // Sticky notes and text use borderStyle
                    return {
                      ...obj,
                      data: {
                        ...obj.data,
                        borderStyle: style.borderStyle ?? obj.data?.borderStyle,
                        borderWidth: style.borderWidth ?? obj.data?.borderWidth,
                      },
                    };
                  }
                }),
              });
            }
          }}
          onCanvasObjectTextStyleChange={(style) => {
            if (linearToolbar.canvasObject) {
              saveToHistory("Change canvas object text style");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) => {
                  if (obj.id !== linearToolbar.canvasObject!.id) return obj;
                  const currentData = obj.data || {};
                  const updates: any = {};

                  // Handle fontSize
                  if (style.fontSize !== undefined) {
                    updates.fontSize = style.fontSize;
                  }

                  // Handle bold -> fontWeight conversion
                  if (style.bold !== undefined) {
                    updates.fontWeight = style.bold ? "bold" : "normal";
                  }

                  // Handle italic -> textDecoration (toggle italic in decoration)
                  if (style.italic !== undefined) {
                    const currentDecoration =
                      currentData.textDecoration || "none";
                    if (style.italic) {
                      updates.textDecoration =
                        currentDecoration === "none"
                          ? "italic"
                          : currentDecoration.includes("italic")
                            ? currentDecoration
                            : `${currentDecoration} italic`;
                    } else {
                      updates.textDecoration =
                        currentDecoration.replace("italic", "").trim() ||
                        "none";
                    }
                  }

                  // Handle strikethrough -> textDecoration (toggle line-through in decoration)
                  if (style.strikethrough !== undefined) {
                    let currentDecoration =
                      updates.textDecoration ??
                      currentData.textDecoration ??
                      "none";
                    if (style.strikethrough) {
                      currentDecoration =
                        currentDecoration === "none"
                          ? "line-through"
                          : currentDecoration.includes("line-through")
                            ? currentDecoration
                            : `${currentDecoration} line-through`;
                    } else {
                      currentDecoration =
                        currentDecoration.replace("line-through", "").trim() ||
                        "none";
                    }
                    updates.textDecoration = currentDecoration;
                  }

                  // Handle textAlign
                  if (style.textAlign !== undefined) {
                    updates.textAlign = style.textAlign;
                  }

                  return {
                    ...obj,
                    data: {
                      ...currentData,
                      ...updates,
                    },
                  };
                }),
              });
            }
          }}
          onCanvasObjectFillStyleChange={(fillStyle) => {
            if (
              linearToolbar.canvasObject &&
              linearToolbar.canvasObject.type === "shape"
            ) {
              saveToHistory("Change shape fill style");
              const fillOpacity =
                fillStyle === "solid"
                  ? 0.5
                  : fillStyle === "transparent"
                    ? 0.3
                    : 0;
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) => {
                  if (obj.id !== linearToolbar.canvasObject!.id) return obj;
                  return {
                    ...obj,
                    data: {
                      ...obj.data,
                      fillStyle: fillStyle,
                      fillOpacity: fillOpacity,
                    },
                  };
                }),
              });
            }
          }}
          onShapeTypeChange={(shapeType) => {
            if (
              linearToolbar.canvasObject &&
              linearToolbar.canvasObject.type === "shape"
            ) {
              saveToHistory("Change shape type");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) => {
                  if (obj.id !== linearToolbar.canvasObject!.id) return obj;

                  // When switching to polygon, initialize with empty points and creation mode
                  if (shapeType === "polygon") {
                    return {
                      ...obj,
                      data: {
                        ...obj.data,
                        shapeType: shapeType,
                        points: [],
                        isClosed: false,
                        isCreating: true,
                        // Clear line/arrow specific properties
                        startPoint: undefined,
                        endPoint: undefined,
                      },
                    };
                  }

                  // When switching from polygon to other shapes, clear polygon properties
                  return {
                    ...obj,
                    data: {
                      ...obj.data,
                      shapeType: shapeType,
                      // Clear polygon properties
                      points: undefined,
                      isClosed: undefined,
                      isCreating: undefined,
                    },
                  };
                }),
              });
            }
          }}
          scale={viewport.zoom}
          isInlineEditing={
            !!(
              inlineEditing &&
              linearToolbar.node &&
              inlineEditing.nodeId === linearToolbar.node.id
            )
          }
          inlineEditingPart={
            inlineEditing?.nodeId === linearToolbar.node?.id
              ? inlineEditing?.part
              : undefined
          }
          initialSubmenu={linearToolbar.initialSubmenu}
          onTextObjectHyperlinkChange={(hyperlink) => {
            if (
              linearToolbar.canvasObject &&
              linearToolbar.canvasObject.type === "text"
            ) {
              saveToHistory("Change text object hyperlink");
              updateActiveTab({
                canvasObjects: canvasObjects.map((obj) => {
                  if (obj.id !== linearToolbar.canvasObject!.id) return obj;
                  return {
                    ...obj,
                    data: {
                      ...obj.data,
                      hyperlink: hyperlink ?? undefined,
                      // If hyperlink text is provided, update the main text of the object
                      ...(hyperlink?.text ? { text: hyperlink.text } : {}),
                    },
                  };
                }),
              });
            }
          }}
        />
      )}

      {/* Quick Create Radial Menu */}
      {quickCreateMenu && !isPhoneViewOnly && (
        <QuickCreateRadialMenu
          isOpen={true}
          position={quickCreateMenu.screenPosition}
          canvasPosition={quickCreateMenu.canvasPosition}
          onClose={() => setQuickCreateMenu(null)}
          onCreateNode={(pos, nodeType?: NodeVariantType) => {
            const nodeVariant = nodeType || 'step';
            const nodeConfigs: Record<NodeVariantType, { type: NodeType; label: string; icon: string; width: number; height: number }> = {
              step: { type: 'process', label: 'New Step', icon: 'Cog', width: 200, height: 100 },
              form: { type: 'form', label: 'New Form', icon: 'FormInput', width: 280, height: 200 },
              table: { type: 'table', label: 'New Table', icon: 'Table2', width: 400, height: 300 },
              compound: { type: 'compound', label: 'New Compound', icon: 'Layers', width: 300, height: 200 },
              code: { type: 'code', label: 'New Code', icon: 'Code2', width: 400, height: 300 },
              image: { type: 'image', label: 'New Image', icon: 'Image', width: 200, height: 150 },
            };
            const config = nodeConfigs[nodeVariant];
            const newNode: Node = {
              id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: config.type,
              position: { x: pos.x - config.width / 2, y: pos.y - config.height / 2 },
              data: {
                label: config.label,
                description: "Click to edit",
                icon: config.icon,
                ...(nodeVariant === 'table' ? { tableId: `table-${Date.now()}`, columns: [], rows: [] } : {}),
                ...(nodeVariant === 'form' ? { fields: [] } : {}),
                ...(nodeVariant === 'compound' ? { subcomponents: [] } : {}),
                ...(nodeVariant === 'code' ? { code: '', language: 'javascript', outputType: 'console' } : {}),
              },
              width: config.width,
              height: config.height,
              selected: true,
            };
            saveToHistory(`Add ${nodeVariant} node`);
            setNodes((prev) => [
              ...prev.map((n) => ({ ...n, selected: false })),
              newNode,
            ]);
            setSelectedNodeId(newNode.id);
            toast({
              title: `${config.label} Added`,
              description: "Double-click to edit",
            });
          }}
          onCreateText={(pos) => {
            const newTextObject: CanvasObject = {
              id: `canvas-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "text",
              position: { x: pos.x - 75, y: pos.y - 20 },
              width: 150,
              height: 40,
              selected: true,
              data: {
                text: "Double-click to edit",
                fontSize: 14,
                fontFamily: "Inter",
                fontWeight: "normal",
                fontStyle: "normal",
                textAlign: "left",
                textDecoration: "none",
                textColor: document.documentElement.classList.contains("dark")
                  ? "#ffffff"
                  : "#1e293b",
                backgroundColor: "transparent",
              } as TextNodeData,
            };
            const updatedObjects = canvasObjects.map((obj) => ({
              ...obj,
              selected: false,
            }));
            saveToHistory("Add text object");
            updateActiveTab({
              canvasObjects: [...updatedObjects, newTextObject],
            });
            toast({
              title: "Text Object Added",
              description: "Double-click to edit the text",
            });
          }}
          onCreateShape={(pos, shapeType) => {
            const isDark = document.documentElement.classList.contains("dark");

            // Build shape data with polygon-specific initialization if needed
            const baseShapeData = {
              shapeType,
              fillColor: isDark ? "#374151" : "#e2e8f0",
              fillOpacity: 0.5,
              fillStyle: "solid",
              strokeColor: isDark ? "#6b7280" : "#94a3b8",
              strokeWidth: 2,
              strokeOpacity: 1.0,
              strokeStyle: "solid",
              opacity: 1,
              borderRadius: shapeType === "rectangle" ? 8 : 0,
            };

            const shapeData = {
              ...baseShapeData,
              ...(shapeType === "polygon"
                ? {
                    points: [],
                    isClosed: false,
                    isCreating: true,
                  }
                : {}),
            } as ShapeNodeData;

            const newShapeObject: CanvasObject = {
              id: `canvas-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "shape",
              position: {
                x: pos.x - (shapeType === "polygon" ? 150 : 50),
                y: pos.y - (shapeType === "polygon" ? 150 : 50),
              },
              width:
                shapeType === "polygon"
                  ? 300
                  : shapeType === "line" || shapeType === "arrow"
                    ? 150
                    : 100,
              height:
                shapeType === "polygon"
                  ? 300
                  : shapeType === "line" || shapeType === "arrow"
                    ? 4
                    : 100,
              selected: true,
              data: shapeData,
            };
            const updatedObjects = canvasObjects.map((obj) => ({
              ...obj,
              selected: false,
            }));
            saveToHistory("Add shape");
            updateActiveTab({
              canvasObjects: [...updatedObjects, newShapeObject],
            });
            toast({
              title: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} Added`,
              description:
                shapeType === "polygon"
                  ? "Click to add points, double-click to close"
                  : "Click to select and style",
            });
          }}
          onCreateSticky={(pos) => {
            const newStickyObject: CanvasObject = {
              id: `canvas-object-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: "sticky",
              position: { x: pos.x - 75, y: pos.y - 75 },
              width: 150,
              height: 150,
              selected: true,
              data: {
                text: "New sticky note",
                fontSize: 12,
                fontFamily: "Inter",
                fontWeight: "normal",
                fontStyle: "normal",
                textAlign: "left",
                textDecoration: "none",
                textColor: "#1e293b",
                backgroundColor: "#fef3c7",
                autoTextColor: true,
              } as StickyNoteData,
            };
            const updatedObjects = canvasObjects.map((obj) => ({
              ...obj,
              selected: false,
            }));
            saveToHistory("Add sticky note");
            updateActiveTab({
              canvasObjects: [...updatedObjects, newStickyObject],
            });
            toast({
              title: "Sticky Note Added",
              description: "Double-click to edit",
            });
          }}
        />
      )}

      {/* Cloud Projects Drawer */}
      <SavedProjectsDrawer
        isOpen={showCloudProjects}
        onOpenChange={setShowCloudProjects}
        currentThumbnail={generateWorkflowThumbnail(nodes, edges) || undefined}
        currentWorkflow={{
          nodes,
          edges,
          canvasObjects,
          viewport,
          sketchStrokes: sketchStrokes.length > 0 ? sketchStrokes : undefined,
          metadata: activeTab?.metadata,
          prdData: loadProjectPRD(projectIdentifier),
          workflowPRDs: (() => {
            try {
              const ids = listWorkflowPRDs(projectIdentifier);
              const prds = ids.map((id) => loadWorkflowPRD(projectIdentifier, id)).filter(Boolean);
              return prds.length > 0 ? prds : null;
            } catch { return null; }
          })(),
          notesData: (() => { try { return localStorage.getItem(`kiteframe-notes-${projectIdentifier}`); } catch { return null; } })(),
          detailsData: (() => { try { return localStorage.getItem(`kiteframe-details-${projectIdentifier}`); } catch { return null; } })(),
        }}
        onLoadProject={(workflowData) => {
          saveToHistory("Load project");
          const newTab: WorkflowTab = {
            id: `tab-${Date.now()}`,
            name: workflowData.metadata?.name || "Loaded Project",
            nodes: workflowData.nodes || [],
            edges: workflowData.edges || [],
            canvasObjects: workflowData.canvasObjects || [],
            viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
            selectedNodeId: "",
            selectedEdgeId: "",
            history: [
              {
                nodes: workflowData.nodes || [],
                edges: workflowData.edges || [],
                canvasObjects: workflowData.canvasObjects || [],
                viewport: workflowData.viewport || { x: 0, y: 0, zoom: 1 },
              },
            ],
            historyIndex: 0,
            showImageModal: null,
            metadata: workflowData.metadata || {
              name: "Loaded Project",
              description: "",
              links: [],
              linksFormat: "text",
              categories: [],
            },
            sketchStrokes: workflowData.sketchStrokes ?? [],
            projectUuid: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }}
        isPro={true}
        isAuthenticated={isAuthenticated}
      />

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
          onClick={() => setShowKeyboardShortcuts(false)}
        >
          <div
            className="bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-purple-600/10 to-blue-600/10">
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="p-1 hover:bg-muted rounded"
                data-testid="button-close-shortcuts"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Node Operations */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Node Operations
                  </h3>
                  <div className="space-y-1.5">
                    <ShortcutRow
                      keys={["N"]}
                      description="Add new process node"
                    />
                    <ShortcutRow keys={["1"]} description="Add input node" />
                    <ShortcutRow keys={["2"]} description="Add process node" />
                    <ShortcutRow
                      keys={["3"]}
                      description="Add condition node"
                    />
                    <ShortcutRow keys={["4"]} description="Add output node" />
                    <ShortcutRow keys={["5"]} description="Add AI task node" />
                    <ShortcutRow keys={["6"]} description="Add image node" />
                    <ShortcutRow
                      keys={["Delete"]}
                      description="Delete selected"
                    />
                    <ShortcutRow
                      keys={["←", "↑", "→", "↓"]}
                      description="Nudge selected (1px)"
                    />
                    <ShortcutRow
                      keys={["Shift", "←↑→↓"]}
                      description="Nudge selected (10px)"
                    />
                  </div>
                </div>

                {/* Selection & Navigation */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Selection & Navigation
                  </h3>
                  <div className="space-y-1.5">
                    <ShortcutRow
                      keys={["Ctrl/⌘", "A"]}
                      description="Select all nodes"
                    />
                    <ShortcutRow keys={["Esc"]} description="Deselect all" />
                    <ShortcutRow
                      keys={["Tab"]}
                      description="Cycle to next node"
                    />
                    <ShortcutRow
                      keys={["Shift", "Tab"]}
                      description="Cycle to previous node"
                    />
                    <ShortcutRow keys={["H"]} description="Go to Home screen" />
                    <ShortcutRow keys={["T"]} description="Create new tab" />
                  </div>
                </div>

                {/* Edit Operations */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    Edit Operations
                  </h3>
                  <div className="space-y-1.5">
                    <ShortcutRow keys={["Ctrl/⌘", "Z"]} description="Undo" />
                    <ShortcutRow
                      keys={["Ctrl/⌘", "Shift", "Z"]}
                      description="Redo"
                    />
                    <ShortcutRow
                      keys={["Ctrl/⌘", "Y"]}
                      description="Redo (alternative)"
                    />
                    <ShortcutRow
                      keys={["Ctrl/⌘", "S"]}
                      description="Save/Download workflow"
                    />
                  </div>
                </div>

                {/* View Controls */}
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-2">
                    View Controls
                  </h3>
                  <div className="space-y-1.5">
                    <ShortcutRow keys={["Ctrl/⌘", "+"]} description="Zoom in" />
                    <ShortcutRow
                      keys={["Ctrl/⌘", "-"]}
                      description="Zoom out"
                    />
                    <ShortcutRow
                      keys={["Ctrl/⌘", "0"]}
                      description="Reset zoom to 100%"
                    />
                    <ShortcutRow keys={["G"]} description="Open AI Generator" />
                    <ShortcutRow keys={["?"]} description="Show this help" />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground text-center">
                Press{" "}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-foreground font-mono">
                  ?
                </kbd>{" "}
                anytime to toggle this help
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Keyboard shortcut row component
function ShortcutRow({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i}>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
              {key}
            </kbd>
            {i < keys.length - 1 && (
              <span className="mx-0.5 text-muted-foreground">+</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// WorkflowEditorContent is used by external view/embed pages
export { WorkflowEditorContent };
export type { WorkflowEditorContentProps };

// Main wrapper component that provides AiProvider context
export default function WorkflowEditor() {
  const createAiClient = useCallback(() => {
    const savedSettings = localStorage.getItem("ai_settings");
    let baseURL = "/api/ai";
    let defaultModel = "claude-sonnet-4-5-20250929";

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);

        // Migrate legacy GPT model names to Claude
        if (settings.model && (settings.model.includes('gpt') || settings.model.includes('gpt-5'))) {
          settings.model = 'claude-sonnet-4-5-20250929';
          settings.provider = 'anthropic';
          localStorage.setItem("ai_settings", JSON.stringify(settings));
        }

        if (settings.provider === "custom" && settings.customEndpoint) {
          baseURL = settings.customEndpoint;
        }
        defaultModel =
          settings.model === "custom" && settings.customModel
            ? settings.customModel
            : settings.model || defaultModel;
      } catch (e) {
        console.warn("Failed to parse saved AI settings");
      }
    }

    return new OpenAICompatClient({
      baseURL,
      apiKey: "",
      defaultModel,
    });
  }, []);

  const [aiClient, setAiClient] = useState<OpenAICompatClient>(createAiClient);

  // Function to update AI client when settings change
  const updateAiClient = useCallback(() => {
    setAiClient(createAiClient());
  }, [createAiClient]);

  return (
    <AiProvider client={aiClient}>
      <PluginProvider>
        <WorkflowEditorContent onAiSettingsChange={updateAiClient} />
      </PluginProvider>
    </AiProvider>
  );
}
