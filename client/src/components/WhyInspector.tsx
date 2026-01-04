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
import { X, Sparkles, Clock, GitBranch, Lightbulb, Info } from 'lucide-react';
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
import type { DecisionSnapshot } from '@/ai/explainability/types';

interface WhyInspectorProps {
  node: Node;
  children: React.ReactNode;
}

export function WhyInspector({ node, children }: WhyInspectorProps) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DecisionSnapshot | null>(null);
  
  const meta = node.meta as NodeMeta | undefined;
  
  const hasProvenance = meta?.createdFromInsightId || meta?.createdFromProposalId || meta?.createdFromExperimentId;
  
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WhyInspectorButton({ node }: { node: Node }) {
  const meta = node.meta as NodeMeta | undefined;
  const hasProvenance = meta?.createdFromInsightId || meta?.createdFromProposalId || meta?.createdFromExperimentId;
  
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
