import type { AiClient, AiMessage } from '../types';
import { supportsVision } from '../types';
import { getRouter, extractJSON } from '../router';

export type VisionRole = 'pm' | 'designer';

export interface SemanticFrameSummary {
  nodeId: string;
  elementsDetected: number;
  decorativeOnly: boolean;
  hasInteractiveElements: boolean;
  hasTextContent: boolean;
  semanticHash: string;
}

export interface WorkflowStep {
  name: string;
  type: 'input' | 'process' | 'decision' | 'output';
  description: string;
}

export interface PMVisionResult {
  confidence: 'low' | 'medium' | 'high';
  workflow_steps: WorkflowStep[];
  assumptions: string[];
  open_questions: string[];
}

export interface DesignerVisionResult {
  confidence: 'low' | 'medium' | 'high';
  design_intent: string | null;
  interaction_flow: string[];
  usability_risks: string[];
  missing_clarity: string[];
  suggested_improvements: string[];
  notes: string[];
}

export type VisionResult = PMVisionResult | DesignerVisionResult;

export interface VisionPipelineInput {
  frameImage: string;
  figmaNodeId: string;
  figmaSemantic?: Record<string, unknown>;
  projectContext?: string;
  workflowContext?: string;
  role: VisionRole;
  model: string;
}

export interface VisionPipelineOutput {
  result: VisionResult;
  source: 'heuristic' | 'vision';
  heuristicConfidence: number;
  visionInvoked: boolean;
  visionConfidence?: 'low' | 'medium' | 'high';
  outputMode: 'reference' | 'generated';
  beta: boolean;
}

const visionCache = new Map<string, VisionResult>();

const BATCH_THROTTLE_LIMIT = 5;
let pendingBatchCount = 0;
let lastBatchResetTime = Date.now();

function shouldThrottleBatch(): boolean {
  const now = Date.now();
  if (now - lastBatchResetTime > 60000) {
    pendingBatchCount = 0;
    lastBatchResetTime = now;
  }
  return pendingBatchCount >= BATCH_THROTTLE_LIMIT;
}

function incrementBatchCount(): void {
  pendingBatchCount++;
}

function decrementBatchCount(): void {
  pendingBatchCount = Math.max(0, pendingBatchCount - 1);
}

const PM_SYSTEM_PROMPT = `You are KiteAI acting as a senior Product Manager.

You are analyzing a UI image to understand PRODUCT BEHAVIOR,
USER INTENT, and FUNCTIONAL FLOW.

You must:
• Infer user goals
• Identify state transitions
• Identify inputs, actions, outputs
• Detect decision points and branching
• Avoid decorative interpretation

Rules:
1. Do not invent backend systems.
2. Do not invent business rules.
3. If confidence is low, say so.
4. Prefer fewer, clearer steps over exhaustive lists.

Output STRICT JSON ONLY:

{
  "confidence": "low" | "medium" | "high",
  "workflow_steps": [
    {
      "name": string,
      "type": "input" | "process" | "decision" | "output",
      "description": string
    }
  ],
  "assumptions": string[],
  "open_questions": string[]
}`;

const DESIGNER_SYSTEM_PROMPT = `You are KiteAI acting as a senior Product Designer.

Interpret DESIGN INTENT, not requirements.

Focus on:
• Visual hierarchy
• Affordances
• Attention flow
• Interaction clarity
• UX risk

Rules:
1. Do not speculate on backend behavior.
2. Do not invent requirements.
3. Treat frame as part of a flow.
4. If confidence is low, stop.

Output STRICT JSON ONLY:

{
  "confidence": "low" | "medium" | "high",
  "design_intent": string | null,
  "interaction_flow": string[],
  "usability_risks": string[],
  "missing_clarity": string[],
  "suggested_improvements": string[],
  "notes": string[]
}`;

function computeSemanticHash(semantic: Record<string, unknown> | undefined): string {
  if (!semantic) return 'no-semantic';
  try {
    return btoa(JSON.stringify(semantic)).slice(0, 32);
  } catch {
    return 'hash-error';
  }
}

function analyzeSemanticData(
  nodeId: string,
  semantic: Record<string, unknown> | undefined
): SemanticFrameSummary {
  const elements = semantic?.elements as unknown[] | undefined;
  const elementsDetected = Array.isArray(elements) ? elements.length : 0;
  
  const hasInteractiveElements = elementsDetected > 0 && 
    (elements?.some((e: unknown) => {
      const el = e as Record<string, unknown>;
      return el.type === 'button' || el.type === 'input' || el.type === 'link';
    }) ?? false);
  
  const hasTextContent = elementsDetected > 0 &&
    (elements?.some((e: unknown) => {
      const el = e as Record<string, unknown>;
      return typeof el.text === 'string' && el.text.length > 0;
    }) ?? false);
  
  const decorativeOnly = elementsDetected > 0 && !hasInteractiveElements && !hasTextContent;
  
  return {
    nodeId,
    elementsDetected,
    decorativeOnly,
    hasInteractiveElements,
    hasTextContent,
    semanticHash: computeSemanticHash(semantic),
  };
}

function computeHeuristicConfidence(summary: SemanticFrameSummary): number {
  let confidence = 0.5;
  
  if (summary.hasInteractiveElements) confidence += 0.2;
  if (summary.hasTextContent) confidence += 0.15;
  if (summary.elementsDetected > 3) confidence += 0.1;
  if (summary.elementsDetected > 10) confidence += 0.05;
  if (summary.decorativeOnly) confidence -= 0.3;
  
  return Math.max(0, Math.min(1, confidence));
}

function generateHeuristicWorkflow(
  summary: SemanticFrameSummary,
  role: VisionRole
): VisionResult {
  if (role === 'pm') {
    return {
      confidence: 'low',
      workflow_steps: [],
      assumptions: ['Generated from semantic data only - vision analysis may improve accuracy'],
      open_questions: ['What is the primary user goal for this screen?'],
    };
  }
  
  return {
    confidence: 'low',
    design_intent: null,
    interaction_flow: [],
    usability_risks: ['Unable to fully analyze design without vision'],
    missing_clarity: ['Design intent unclear from metadata alone'],
    suggested_improvements: [],
    notes: ['Consider enabling vision analysis for better results'],
  };
}

export async function generateWorkflowFromFrame(
  input: VisionPipelineInput,
  aiClient: AiClient
): Promise<VisionPipelineOutput> {
  const { frameImage, figmaNodeId, figmaSemantic, role, model } = input;
  
  const summary = analyzeSemanticData(figmaNodeId, figmaSemantic);
  const heuristicConfidence = computeHeuristicConfidence(summary);
  
  console.log('[VisionPipeline] heuristicConfidence', heuristicConfidence);
  
  const cacheKey = `${figmaNodeId}-${summary.semanticHash}`;
  const cachedResult = visionCache.get(cacheKey);
  
  const batchThrottled = shouldThrottleBatch();
  
  const shouldInvokeVision = 
    heuristicConfidence < 0.75 &&
    summary.elementsDetected > 1 &&
    !summary.decorativeOnly &&
    !cachedResult &&
    !batchThrottled &&
    supportsVision(model);
  
  const heuristicConfidenceLevel: 'low' | 'medium' | 'high' = 
    heuristicConfidence < 0.4 ? 'low' : 
    heuristicConfidence < 0.75 ? 'medium' : 'high';
  
  console.log('[VisionPipeline] heuristicConfidence', heuristicConfidence, heuristicConfidenceLevel);
  console.log('[VisionPipeline] batchThrottled', batchThrottled);
  console.log('[VisionPipeline] visionInvoked', shouldInvokeVision);
  
  if (!shouldInvokeVision) {
    if (cachedResult) {
      console.log('[VisionPipeline] Using cached vision result');
      return {
        result: cachedResult,
        source: 'vision',
        heuristicConfidence,
        visionInvoked: false,
        visionConfidence: cachedResult.confidence,
        outputMode: cachedResult.confidence === 'low' ? 'reference' : 'generated',
        beta: true,
      };
    }
    
    console.log('[VisionPipeline] outputMode reference (heuristic only)');
    return {
      result: generateHeuristicWorkflow(summary, role),
      source: 'heuristic',
      heuristicConfidence,
      visionInvoked: false,
      outputMode: 'reference',
      beta: false,
    };
  }
  
  const systemPrompt = role === 'pm' ? PM_SYSTEM_PROMPT : DESIGNER_SYSTEM_PROMPT;
  
  const contextParts: string[] = [];
  if (input.projectContext) {
    contextParts.push(`Project context: ${input.projectContext}`);
  }
  if (input.workflowContext) {
    contextParts.push(`Workflow context: ${input.workflowContext}`);
  }
  
  const userContent = contextParts.length > 0 
    ? `${contextParts.join('\n')}\n\nAnalyze this UI frame:`
    : 'Analyze this UI frame:';
  
  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    { 
      role: 'user', 
      content: [
        { type: 'text', text: userContent },
        { type: 'image_url', image_url: { url: frameImage } }
      ]
    }
  ];
  
  incrementBatchCount();
  
  try {
    const router = getRouter();
    const response = await router.chat({
      taskType: 'vision_ingestion',
      messages,
      temperature: 0.3,
      maxTokens: 2048,
    });
    
    decrementBatchCount();
    
    const jsonStr = extractJSON(response.text);
    if (!jsonStr) {
      throw new Error('No JSON found in vision response');
    }
    
    const visionResult = JSON.parse(jsonStr) as VisionResult;
    
    console.log('[VisionPipeline] visionConfidence', visionResult.confidence);
    
    visionCache.set(cacheKey, visionResult);
    
    const outputMode = visionResult.confidence === 'low' ? 'reference' : 'generated';
    console.log('[VisionPipeline] outputMode', outputMode);
    
    return {
      result: visionResult,
      source: 'vision',
      heuristicConfidence,
      visionInvoked: true,
      visionConfidence: visionResult.confidence,
      outputMode,
      beta: true,
    };
  } catch (error) {
    decrementBatchCount();
    console.error('[VisionPipeline] Vision analysis failed:', error);
    
    return {
      result: generateHeuristicWorkflow(summary, role),
      source: 'heuristic',
      heuristicConfidence,
      visionInvoked: true,
      outputMode: 'reference',
      beta: false,
    };
  }
}

export function clearVisionCache(): void {
  visionCache.clear();
}

export function getVisionCacheSize(): number {
  return visionCache.size;
}
