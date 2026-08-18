import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, User, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Edit2, Check, X, Sparkles, Loader2, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useWorkflowIntent, type WorkflowIntent, type WorkflowMaturity, canTransitionMaturity, getMaturityGatingRules } from '@/stores/workflowIntentStore';
import { getRouter } from '@/ai/router';
import { useToast } from '@/hooks/use-toast';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { analyzeWorkflowForFailures } from '@/ai/failureFirstHeuristics';

interface WorkflowIntentSectionProps {
  projectId: string;
  workflowId: string;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
}

const maturityConfig: Record<WorkflowMaturity, { label: string; color: string; description: string }> = {
  'draft': { 
    label: 'Draft', 
    color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    description: 'AI suggestions only'
  },
  'reviewed': { 
    label: 'Reviewed', 
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    description: 'Intent confirmed'
  },
  'stable': { 
    label: 'Stable', 
    color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    description: 'Ready for execution'
  },
};

export function WorkflowIntentSection({ 
  projectId, 
  workflowId, 
  workflowName,
  nodes,
  edges 
}: WorkflowIntentSectionProps) {
  const { intent, setIntent, updateIntent, confirmIntent, setMaturity, isStale, maturity } = useWorkflowIntent(projectId, workflowId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editForm, setEditForm] = useState<WorkflowIntent | null>(null);
  const { toast } = useToast();

  const failureAnalysis = useMemo(() => {
    if (nodes.length === 0) return null;
    return analyzeWorkflowForFailures(workflowId, nodes, edges);
  }, [workflowId, nodes, edges]);

  const hasFailurePath = failureAnalysis?.hasFailurePath ?? false;
  const gatingRules = getMaturityGatingRules(maturity);

  useEffect(() => {
    if (intent) {
      setEditForm(intent);
    }
  }, [intent]);

  const handleGenerateIntent = useCallback(async () => {
    setIsGenerating(true);
    try {
      const semanticModel = extractSemanticWorkflowModel(workflowId, workflowName, nodes, edges);
      
      const prompt = `Analyze this workflow and extract the intent metadata:

Workflow Name: ${workflowName}
Nodes: ${JSON.stringify(semanticModel.nodes.map(n => ({ type: n.type, label: n.label, description: n.description })), null, 2)}

Extract the following in JSON format:
{
  "primaryGoal": "One sentence describing what this workflow accomplishes",
  "userType": "Who is the primary user of this workflow",
  "successSignal": "How do we know the workflow succeeded",
  "failureModes": ["List of ways this workflow could fail"]
}

Be specific and actionable. Return ONLY valid JSON.`;

      const router = getRouter();
      const response = await router.chat({
        taskType: 'workflow_reasoning',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const content = response.text || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const newIntent: WorkflowIntent = {
          primaryGoal: parsed.primaryGoal || '',
          userType: parsed.userType || '',
          successSignal: parsed.successSignal || '',
          failureModes: Array.isArray(parsed.failureModes) ? parsed.failureModes : [],
          confirmed: false,
          maturity: 'draft',
          isStale: false,
        };
        setIntent(newIntent);
        setEditForm(newIntent);
        setIsExpanded(true);
        toast({ title: 'Intent generated', description: 'Review and confirm the workflow intent.' });
      }
    } catch (error) {
      console.error('Failed to generate intent:', error);
      toast({ title: 'Generation failed', description: 'Could not generate workflow intent.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, edges, workflowId, workflowName, setIntent, toast]);

  const handleConfirm = useCallback(() => {
    if (editForm) {
      const transitionResult = canTransitionMaturity('draft', 'reviewed', { ...editForm, confirmed: true }, hasFailurePath);
      
      const newMaturity: WorkflowMaturity = transitionResult.allowed ? 'reviewed' : 'draft';
      
      updateIntent({ 
        ...editForm, 
        confirmed: true, 
        isStale: false,
        lastReviewedAt: Date.now(),
        maturity: newMaturity
      });
      setIsEditing(false);
      
      if (newMaturity === 'reviewed') {
        toast({ title: 'Intent confirmed', description: 'Workflow promoted to Reviewed status.' });
      } else {
        toast({ 
          title: 'Intent confirmed', 
          description: 'Add failure paths to promote to Reviewed status.',
          variant: 'default'
        });
      }
    }
  }, [editForm, updateIntent, toast, hasFailurePath]);

  const handlePromoteToStable = useCallback(() => {
    const transitionResult = canTransitionMaturity(maturity, 'stable', intent, hasFailurePath, isStale);
    
    if (transitionResult.allowed) {
      setMaturity('stable');
      toast({ title: 'Workflow stabilized', description: 'Fast actions are now enabled for this workflow.' });
    } else {
      toast({ 
        title: 'Cannot promote to Stable', 
        description: transitionResult.requiredConditions?.join('. ') || transitionResult.reason,
        variant: 'destructive'
      });
    }
  }, [maturity, intent, hasFailurePath, isStale, setMaturity, toast]);

  const handleSaveEdit = useCallback(() => {
    if (editForm) {
      updateIntent(editForm);
      setIsEditing(false);
    }
  }, [editForm, updateIntent]);

  const handleCancelEdit = useCallback(() => {
    setEditForm(intent);
    setIsEditing(false);
  }, [intent]);

  const config = maturityConfig[maturity];

  if (!intent) {
    return (
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Workflow Intent</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Not set</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleGenerateIntent}
            disabled={isGenerating || nodes.length === 0}
            data-testid="generate-intent-btn"
          >
            {isGenerating ? (
              <Loader2 size={12} className="mr-1 animate-spin" />
            ) : (
              <Sparkles size={12} className="mr-1" />
            )}
            Capture Intent
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Define what this workflow is meant to accomplish and who it serves.
        </p>
      </div>
    );
  }

  return (
    <div className={`mb-4 p-3 rounded-lg border ${isStale ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
          data-testid="toggle-intent-section"
        >
          <Target size={14} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Workflow Intent</span>
          <Badge className={`text-[10px] px-1.5 py-0 ${config.color}`}>
            {config.label}
          </Badge>
          {isStale && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500 text-yellow-600">
              <AlertTriangle size={10} className="mr-0.5" />
              Stale
            </Badge>
          )}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {!intent.confirmed && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs text-green-600 border-green-300 hover:bg-green-50"
                onClick={handleConfirm}
                data-testid="confirm-intent-btn"
              >
                <CheckCircle2 size={12} className="mr-1" />
                Confirm
              </Button>
            )}
            {intent.confirmed && maturity === 'reviewed' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                    onClick={handlePromoteToStable}
                    disabled={isStale || !hasFailurePath}
                    data-testid="promote-stable-btn"
                  >
                    <ShieldCheck size={12} className="mr-1" />
                    Stabilize
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Promote to Stable for fast actions</p>
                  {isStale && <p className="text-xs text-yellow-500">PRD has stale sections</p>}
                  {!hasFailurePath && <p className="text-xs text-yellow-500">Add failure paths first</p>}
                </TooltipContent>
              </Tooltip>
            )}
            {!gatingRules.canAutoExecute && (
              <Tooltip>
                <TooltipTrigger>
                  <ShieldAlert size={14} className="text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Auto-execution disabled for {maturity} workflows</p>
                </TooltipContent>
              </Tooltip>
            )}
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsEditing(true)}
                data-testid="edit-intent-btn"
              >
                <Edit2 size={12} />
              </Button>
            )}
          </TooltipProvider>
        </div>
      </div>

      {!isExpanded && intent.primaryGoal && (
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {intent.primaryGoal}
        </p>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {isEditing && editForm ? (
            <>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <Target size={10} />
                  Primary Goal
                </label>
                <Textarea
                  value={editForm.primaryGoal}
                  onChange={(e) => setEditForm({ ...editForm, primaryGoal: e.target.value })}
                  placeholder="What does this workflow accomplish?"
                  className="mt-1 text-sm min-h-[60px]"
                  data-testid="intent-goal-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <User size={10} />
                  User Type
                </label>
                <Input
                  value={editForm.userType}
                  onChange={(e) => setEditForm({ ...editForm, userType: e.target.value })}
                  placeholder="Who uses this workflow?"
                  className="mt-1 text-sm"
                  data-testid="intent-user-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  Success Signal
                </label>
                <Input
                  value={editForm.successSignal}
                  onChange={(e) => setEditForm({ ...editForm, successSignal: e.target.value })}
                  placeholder="How do we know it succeeded?"
                  className="mt-1 text-sm"
                  data-testid="intent-success-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  Failure Modes
                </label>
                <Textarea
                  value={editForm.failureModes.join('\n')}
                  onChange={(e) => setEditForm({ ...editForm, failureModes: e.target.value.split('\n').filter(Boolean) })}
                  placeholder="One failure mode per line"
                  className="mt-1 text-sm min-h-[60px]"
                  data-testid="intent-failures-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveEdit}
                  data-testid="save-intent-btn"
                >
                  <Check size={12} className="mr-1" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleCancelEdit}
                  data-testid="cancel-intent-btn"
                >
                  <X size={12} className="mr-1" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <Target size={10} />
                  Primary Goal
                </label>
                <p className="text-sm mt-0.5">{intent.primaryGoal || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <User size={10} />
                  User Type
                </label>
                <p className="text-sm mt-0.5">{intent.userType || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  Success Signal
                </label>
                <p className="text-sm mt-0.5">{intent.successSignal || <span className="text-muted-foreground italic">Not set</span>}</p>
              </div>
              {intent.failureModes.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Failure Modes
                  </label>
                  <ul className="text-sm mt-0.5 list-disc list-inside">
                    {intent.failureModes.map((mode, idx) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300">{mode}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Failure Path Status */}
              <div className={`p-2 rounded text-xs ${hasFailurePath ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'}`}>
                <div className="flex items-center gap-1">
                  {hasFailurePath ? (
                    <>
                      <Shield size={12} />
                      <span>Failure paths detected</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={12} />
                      <span>No failure paths - add error handling to enable Reviewed status</span>
                    </>
                  )}
                </div>
              </div>
              {intent.lastReviewedAt && (
                <p className="text-[10px] text-muted-foreground">
                  Last reviewed: {new Date(intent.lastReviewedAt).toLocaleString()}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
