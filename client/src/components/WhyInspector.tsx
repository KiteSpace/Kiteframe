/**
 * Phase 5: Why Inspector
 * 
 * Read-only inspector showing provenance and reasoning for AI-generated nodes.
 * Shows "This node was added because..." with linked insight and heuristics.
 * 
 * Rules:
 * - Inspector must not change state
 * - Inspector must not introduce new actions
 * - Inspector must be dismissible
 */

import { useState, useEffect } from 'react';
import { X, Sparkles, Clock, GitBranch, GitMerge, Lightbulb, Info, AlertTriangle, CheckCircle, Wrench, AlertCircle, Shield } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Node, NodeMeta } from '@/lib/kiteframe/types';
import { getDecisionSnapshotForNode } from '@/ai/explainability/auditExport';
import type { DecisionSnapshot, SemanticMismatch, MergeBranchDecision, DecisionRepairApplied, UnresolvedConcern, UnresolvedConcernType, MutationSafety, SemanticTerminalSignal } from '@/ai/explainability/types';
import { getClaimTypeDescription } from '@/ai/semantic/extractSemanticClaims';
import { isFeatureEnabled } from '@/config/featureFlags';

function getConcernTypeDescription(type: UnresolvedConcernType): string {
  switch (type) {
    case 'loop_without_exit': return 'Loop Without Exit';
    case 'retry_without_counter': return 'Retry Without Counter';
    case 'infinite_loop_risk': return 'Potential Infinite Loop';
    case 'semantic_mismatch': return 'Semantic Mismatch';
    case 'structural_gap': return 'Structural Gap';
    case 'missing_error_handling': return 'Missing Error Handling';
    case 'unaddressed_edge_case': return 'Unaddressed Edge Case';
    default: return type;
  }
}

interface WhyInspectorProps {
  node: Node;
  children: React.ReactNode;
}

export function WhyInspector({ node, children }: WhyInspectorProps) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null);
  
  const meta = node.meta as NodeMeta | undefined;
  const dataMeta = (node.data as any)?.meta as { 
    createdAt?: number; 
    mergeBranchDecision?: MergeBranchDecision; 
    decisionRepairsApplied?: DecisionRepairApplied[];
    createdByDecisionRepair?: boolean;
  } | undefined;
  
  const hasProvenance = meta?.createdFromInsightId || meta?.createdFromProposalId || meta?.createdFromExperimentId || dataMeta?.mergeBranchDecision || dataMeta?.createdByDecisionRepair || dataMeta?.decisionRepairsApplied;
  
  useEffect(() => {
    if (open && node.id) {
      const foundSnapshot = getDecisionSnapshotForNode(node.id);
      setSnapshot(foundSnapshot || null);
    }
  }, [open, node.id]);
  
  if (!hasProvenance) {
    return <>{children}</>;
  }
  
  const formatTimestamp = (ts: number | undefined) => {
    if (!ts) return 'Unknown';
    return new Date(ts).toLocaleString();
  };
  
  const getSourceLabel = () => {
    if (meta?.createdFromExperimentId) return 'Experiment';
    if (meta?.createdFromProposalId) return 'Proposal';
    return 'AI Generated';
  };
  
  const getSourceIcon = () => {
    if (meta?.createdFromExperimentId) return <GitBranch className="h-3 w-3" />;
    if (meta?.createdFromProposalId) return <Lightbulb className="h-3 w-3" />;
    return <Sparkles className="h-3 w-3" />;
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        side="right" 
        align="start"
        data-testid="why-inspector-popover"
      >
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Why does this exist?</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setOpen(false)}
            data-testid="why-inspector-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              {getSourceIcon()}
              {getSourceLabel()}
            </Badge>
            {meta?.source === 'ai' && (
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Generated
              </Badge>
            )}
          </div>
          
          {snapshot?.insightTitle && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Origin Insight</div>
              <div className="text-sm bg-muted/50 rounded p-2">
                {snapshot.insightTitle}
              </div>
              <div className="text-xs text-muted-foreground">
                Category: {snapshot.insightCategory}
              </div>
            </div>
          )}
          
          {snapshot?.variantChosen && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Variant Selected</div>
              <Badge variant={snapshot.variantChosen === 'proposed' ? 'default' : 'secondary'}>
                {snapshot.variantChosen === 'proposed' ? 'Primary Proposal' : 'Alternative Approach'}
              </Badge>
            </div>
          )}
          
          {snapshot?.experimentLabel && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">Experiment</div>
              <div className="text-sm">{snapshot.experimentLabel}</div>
            </div>
          )}
          
          <Separator />
          
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Provenance</div>
            
            <div className="space-y-1 text-xs">
              {meta?.createdAt && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Created: {formatTimestamp(meta.createdAt)}</span>
                </div>
              )}
              
              {meta?.createdFromInsightId && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Insight ID:</span>
                  <code className="text-xs bg-muted px-1 rounded">{meta.createdFromInsightId.slice(0, 12)}...</code>
                </div>
              )}
              
              {meta?.createdFromProposalId && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Proposal ID:</span>
                  <code className="text-xs bg-muted px-1 rounded">{meta.createdFromProposalId.slice(0, 12)}...</code>
                </div>
              )}
              
              {meta?.createdFromExperimentId && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Experiment ID:</span>
                  <code className="text-xs bg-muted px-1 rounded">{meta.createdFromExperimentId.slice(0, 12)}...</code>
                </div>
              )}
            </div>
          </div>
          
          {snapshot?.heuristicsEnabled && Object.keys(snapshot.heuristicsApplied).length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground font-medium">Heuristics Applied</div>
                <div className="flex flex-wrap gap-1">
                  {snapshot.heuristicsApplied.patternDetected && (
                    <Badge variant="outline" className="text-xs">
                      Pattern: {snapshot.heuristicsApplied.patternDetected}
                    </Badge>
                  )}
                  {snapshot.heuristicsApplied.structureBias && (
                    <Badge variant="outline" className="text-xs">
                      Bias: {snapshot.heuristicsApplied.structureBias}
                    </Badge>
                  )}
                  {snapshot.heuristicsApplied.scopeConstrained && (
                    <Badge variant="outline" className="text-xs">
                      Scope Constrained
                    </Badge>
                  )}
                  {snapshot.heuristicsApplied.diversityEnforced && (
                    <Badge variant="outline" className="text-xs">
                      Diversity Enforced
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
          
          {snapshot?.uncertaintyLevel && snapshot.uncertaintyLevel !== 'low' && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground font-medium">Confidence</div>
                <Badge 
                  variant={snapshot.uncertaintyLevel === 'high' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {snapshot.uncertaintyLevel === 'high' ? 'Low Confidence' : 'Medium Confidence'}
                </Badge>
                {snapshot.validationWarnings.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {snapshot.validationWarnings.length} validation warning(s)
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* Phase 6: Semantic Claims */}
          {snapshot?.semanticClaims && snapshot.semanticClaims.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium">Detected Behaviors</div>
                <div className="space-y-1">
                  {snapshot.semanticClaims.map((claim, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">{getClaimTypeDescription(claim.type)}</div>
                        <div className="text-muted-foreground">
                          Evidence: "{claim.evidenceText}"
                        </div>
                        <div className="text-muted-foreground">
                          Confidence: {Math.round(claim.confidence * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Phase 6: Semantic Mismatches */}
          {snapshot?.semanticMismatches && snapshot.semanticMismatches.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Structural Gaps
                </div>
                <div className="space-y-2">
                  {snapshot.semanticMismatches.map((mismatch: SemanticMismatch, idx: number) => (
                    <div 
                      key={idx} 
                      className={`text-xs p-2 rounded border ${
                        mismatch.severity === 'error' 
                          ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' 
                          : mismatch.severity === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                          : 'bg-muted border-muted-foreground/20'
                      }`}
                      data-testid={`semantic-mismatch-${idx}`}
                    >
                      <div className="font-medium mb-1">
                        {getClaimTypeDescription(mismatch.claimType)}
                      </div>
                      <div className="text-muted-foreground mb-1">
                        This workflow describes this behavior but does not structurally encode it.
                      </div>
                      <div className="text-muted-foreground">
                        Missing: {mismatch.missing.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Phase 6.5: Merge vs Branch Decision (from snapshot or node metadata) */}
          {(() => {
            const decision = snapshot?.mergeBranchDecision || dataMeta?.mergeBranchDecision;
            if (!decision) return null;
            return (
              <>
                <Separator />
                <div className="space-y-2" data-testid="merge-branch-decision">
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    {decision.resolvedIntent === 'merge' ? (
                      <GitMerge className="h-3 w-3 text-blue-500" />
                    ) : (
                      <GitBranch className="h-3 w-3 text-purple-500" />
                    )}
                    Modification Strategy
                  </div>
                  <div className="space-y-1">
                    <Badge 
                      variant={decision.resolvedIntent === 'merge' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {decision.intent === 'merge' 
                        ? 'Modified Existing' 
                        : decision.intent === 'branch'
                        ? 'Created New Variant'
                        : 'Intent Ambiguous (defaulted to Modify)'}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Confidence: {Math.round(decision.confidence * 100)}%
                    </div>
                    {decision.detectedSignals.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Signals: {decision.detectedSignals.slice(0, 3).join(', ')}
                        {decision.detectedSignals.length > 3 && '...'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
          
          {/* Phase 6.7: Decision Repair Applied */}
          {(() => {
            const repairs = snapshot?.decisionRepairsApplied || dataMeta?.decisionRepairsApplied;
            const isRepairCreated = dataMeta?.createdByDecisionRepair;
            
            if (!repairs?.length && !isRepairCreated) return null;
            
            return (
              <>
                <Separator />
                <div className="space-y-2" data-testid="decision-repair-applied">
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Wrench className="h-3 w-3 text-amber-500" />
                    Decision Repair
                  </div>
                  
                  {isRepairCreated && (
                    <div className="text-xs bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded p-2">
                      This node was auto-generated to complete an incomplete decision branch.
                    </div>
                  )}
                  
                  {repairs && repairs.length > 0 && (
                    <div className="space-y-2">
                      {repairs.map((repair, idx) => (
                        <div key={idx} className="text-xs space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {repair.issuesResolved.map((issue, issueIdx) => (
                              <Badge key={issueIdx} variant="outline" className="text-xs">
                                {issue === 'MISSING_OUTCOME' && 'Added Missing Branch'}
                                {issue === 'UNLABELED_EDGES' && 'Labeled Edges'}
                                {issue === 'DANGLING_EDGE' && 'Fixed Dangling Edge'}
                              </Badge>
                            ))}
                          </div>
                          {repair.labelsAssigned.length > 0 && (
                            <div className="text-muted-foreground">
                              Labels: {repair.labelsAssigned.join(', ')}
                            </div>
                          )}
                          {repair.edgesAdded > 0 && (
                            <div className="text-muted-foreground">
                              Edges added: {repair.edgesAdded}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
          
          {/* Phase 8: Mutation Safety */}
          {snapshot?.mutationSafety && (
            (() => {
              const safety = snapshot.mutationSafety;
              const hasAnyCorrections = safety.mergeEnforced || safety.orphanPreventionTriggered || safety.decisionRepairApplied || safety.mutationAborted;
              if (!hasAnyCorrections) return null;
              return (
                <>
                  <Separator />
                  <div className="space-y-2" data-testid="mutation-safety">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Shield className="h-3 w-3 text-green-500" />
                      Automatic Safety Corrections
                    </div>
                    <div className="space-y-1">
                      {safety.mergeEnforced && (
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span>Merge mode enforced - modified existing workflow</span>
                        </div>
                      )}
                      {safety.orphanPreventionTriggered && (
                        <div className="flex items-center gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          <span>Orphan node prevention triggered</span>
                        </div>
                      )}
                      {safety.decisionRepairApplied && (
                        <div className="flex items-center gap-2 text-xs">
                          <Wrench className="h-3 w-3 text-amber-500" />
                          <span>Decision repair applied automatically</span>
                        </div>
                      )}
                      {safety.attachmentResolved && safety.resolvedAttachmentNodeId && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Attached to: {safety.resolvedAttachmentNodeId.slice(0, 12)}...</span>
                        </div>
                      )}
                      {safety.mutationAborted && (
                        <div className="text-xs bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
                          Mutation aborted: {safety.mutationAborted}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()
          )}
          
          {/* Phase 7: Unresolved Concerns */}
          {snapshot?.unresolvedConcerns && snapshot.unresolvedConcerns.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2" data-testid="unresolved-concerns">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  Unresolved Concerns
                </div>
                <div className="space-y-2">
                  {snapshot.unresolvedConcerns.map((concern: UnresolvedConcern, idx: number) => (
                    <div 
                      key={idx} 
                      className={`text-xs p-2 rounded border ${
                        concern.severity === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                          : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                      }`}
                      data-testid={`unresolved-concern-${idx}`}
                    >
                      <div className="font-medium mb-1">
                        {getConcernTypeDescription(concern.type)}
                      </div>
                      <div className="text-muted-foreground">
                        {concern.message}
                      </div>
                      {concern.affectedNodeIds && concern.affectedNodeIds.length > 0 && (
                        <div className="text-muted-foreground mt-1">
                          Affects: {concern.affectedNodeIds.length} node(s)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* Phase 6.8: Semantic Terminal Signals (only when feature enabled) */}
          {isFeatureEnabled('SEMANTIC_TERMINAL_INFERENCE') && snapshot?.semanticTerminalSignals && snapshot.semanticTerminalSignals.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2" data-testid="semantic-terminal-signals">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Semantically Terminal Steps
                </div>
                <div className="space-y-2">
                  {snapshot.semanticTerminalSignals.map((signal: SemanticTerminalSignal, idx: number) => (
                    <div 
                      key={idx} 
                      className="text-xs p-2 rounded border bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                      data-testid={`semantic-terminal-${idx}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={signal.confidence === 'high' ? 'default' : 'secondary'} 
                          className="text-[10px] h-4"
                        >
                          {signal.confidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
                        </Badge>
                      </div>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                        {signal.reasons.map((reason: string, reasonIdx: number) => (
                          <li key={reasonIdx}>{reason}</li>
                        ))}
                      </ul>
                      {signal.confidence === 'medium' && (
                        <div className="mt-2 text-muted-foreground italic">
                          Consider changing this node type to Output to satisfy strict terminal rules.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WhyInspectorButton({ node }: { node: Node }) {
  const meta = node.meta as NodeMeta | undefined;
  const dataMeta = (node.data as any)?.meta as { 
    mergeBranchDecision?: MergeBranchDecision; 
    createdByDecisionRepair?: boolean;
    decisionRepairsApplied?: DecisionRepairApplied[];
  } | undefined;
  const hasProvenance = meta?.createdFromInsightId || meta?.createdFromProposalId || meta?.createdFromExperimentId || dataMeta?.mergeBranchDecision || dataMeta?.createdByDecisionRepair || dataMeta?.decisionRepairsApplied;
  
  if (!hasProvenance) {
    return null;
  }
  
  return (
    <WhyInspector node={node}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs gap-1"
        data-testid={`why-inspector-button-${node.id}`}
      >
        <Info className="h-3 w-3" />
        Why?
      </Button>
    </WhyInspector>
  );
}
