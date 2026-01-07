import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Lightbulb, 
  HelpCircle, 
  Shield, 
  Layers, 
  RefreshCw,
  Loader2,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getActiveInsights, 
  dismissInsight,
  addInsight 
} from '@/stores/aiInsightStore';
import { 
  type AIInsight, 
  type InsightChipType,
  getChipTypeColor,
  createInsight 
} from '@/ai/insights';
import { getRouter } from '@/ai/router';
import { useToast } from '@/hooks/use-toast';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { FlowDetection } from '@/lib/kiteframe/utils/FlowDetection';

interface ProjectInsightsSectionProps {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
}

interface CrossWorkflowAnalysis {
  assumptions: string[];
  conflicts: string[];
  risks: string[];
  coverageGaps: string[];
}

const INSIGHT_CATEGORIES: { type: InsightChipType; label: string; icon: typeof AlertTriangle }[] = [
  { type: 'assumption', label: 'Assumptions', icon: Lightbulb },
  { type: 'risk', label: 'Risks', icon: AlertTriangle },
  { type: 'question', label: 'Questions', icon: HelpCircle },
  { type: 'suggestion', label: 'Suggestions', icon: Shield },
];

function InsightChip({ 
  insight, 
  onDismiss 
}: { 
  insight: AIInsight; 
  onDismiss: () => void;
}) {
  const colors = insight.chipType ? getChipTypeColor(insight.chipType) : { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' };
  
  return (
    <div 
      className={cn(
        "flex items-start gap-2 p-2 rounded-md text-xs",
        colors.bg,
        colors.text
      )}
      data-testid={`insight-chip-${insight.id}`}
    >
      <span className="flex-1">{insight.message}</span>
      <button
        onClick={onDismiss}
        className="opacity-50 hover:opacity-100 transition-opacity"
        data-testid={`dismiss-insight-${insight.id}`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

function InsightCategory({
  type,
  label,
  Icon,
  insights,
  onDismiss,
  projectId
}: {
  type: InsightChipType;
  label: string;
  Icon: typeof AlertTriangle;
  insights: AIInsight[];
  onDismiss: (id: string) => void;
  projectId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const colors = getChipTypeColor(type);
  
  if (insights.length === 0) return null;
  
  return (
    <div className="mb-3" data-testid={`insight-category-${type}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium",
          colors.bg,
          colors.text
        )}
        data-testid={`toggle-category-${type}`}
      >
        <div className="flex items-center gap-1.5">
          <Icon size={12} />
          <span>{label}</span>
          <span className="opacity-70">({insights.length})</span>
        </div>
        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-1.5 pl-2">
          {insights.map(insight => (
            <InsightChip
              key={insight.id}
              insight={insight}
              onDismiss={() => onDismiss(insight.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectInsightsSection({ 
  projectId, 
  nodes, 
  edges 
}: ProjectInsightsSectionProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CrossWorkflowAnalysis | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const allInsights = useMemo(() => {
    return getActiveInsights(projectId);
  }, [projectId, refreshKey]);

  const insightsByType = useMemo(() => {
    const grouped: Record<InsightChipType, AIInsight[]> = {
      assumption: [],
      risk: [],
      question: [],
      suggestion: []
    };
    
    allInsights.forEach(insight => {
      if (insight.chipType && grouped[insight.chipType]) {
        grouped[insight.chipType].push(insight);
      }
    });
    
    return grouped;
  }, [allInsights]);

  const workflowSummaries = useMemo(() => {
    if (nodes.length === 0) return [];
    const flows = FlowDetection.detectFlows(nodes, edges);
    return flows.filter(f => f.nodes.length >= 2 && f.edges.length >= 2);
  }, [nodes, edges]);

  const handleDismissInsight = useCallback((insightId: string) => {
    dismissInsight(projectId, insightId);
    setRefreshKey(prev => prev + 1);
  }, [projectId]);

  const handleAnalyze = useCallback(async () => {
    if (workflowSummaries.length === 0) {
      toast({
        title: 'No workflows',
        description: 'Add workflows to analyze cross-workflow insights.',
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const workflowDescriptions = workflowSummaries.map((wf, i) => {
        const nodeLabels = wf.nodes
          .map(n => `${n.type || 'node'}: ${n.data?.label || n.id}`)
          .join(', ');
        return `Workflow ${i + 1} (${wf.nodes.length} nodes): ${nodeLabels}`;
      }).join('\n');

      const router = getRouter();
      const response = await router.chat({
        taskType: 'general_chat',
        messages: [
          {
            role: 'system',
            content: `You are an expert product manager analyzing workflow diagrams. Identify cross-workflow issues.
Return a JSON object with these arrays (each containing 0-3 short items):
{
  "assumptions": ["Unstated assumptions that could cause issues"],
  "conflicts": ["Potential conflicts between workflows"],
  "risks": ["Operational or business risks"],
  "coverageGaps": ["Missing functionality or edge cases"]
}
Only include genuine issues. Be concise (under 100 chars per item).`
          },
          {
            role: 'user',
            content: `Analyze these ${workflowSummaries.length} workflows for cross-workflow issues:\n\n${workflowDescriptions}`
          }
        ],
        temperature: 0.3,
        maxTokens: 800
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as CrossWorkflowAnalysis;
        setAnalysis(parsed);
        
        parsed.assumptions.forEach(msg => {
          const insight = createInsight({
            level: 'info',
            chipType: 'assumption',
            message: msg,
            targetType: 'workflow',
            targetId: 'cross-workflow',
            source: 'heuristic'
          });
          addInsight(projectId, insight);
        });
        parsed.risks.forEach(msg => {
          const insight = createInsight({
            level: 'risk',
            chipType: 'risk',
            message: msg,
            targetType: 'workflow',
            targetId: 'cross-workflow',
            source: 'heuristic'
          });
          addInsight(projectId, insight);
        });
        parsed.coverageGaps.forEach(msg => {
          const insight = createInsight({
            level: 'warning',
            chipType: 'question',
            message: msg,
            targetType: 'workflow',
            targetId: 'cross-workflow',
            source: 'heuristic'
          });
          addInsight(projectId, insight);
        });
        
        setRefreshKey(prev => prev + 1);
        toast({ title: 'Analysis complete', description: 'Cross-workflow insights generated.' });
      }
    } catch (error) {
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Could not analyze workflows',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [workflowSummaries, projectId, toast]);

  const totalInsights = allInsights.length;
  const hasAnalysis = analysis && (
    analysis.assumptions.length > 0 ||
    analysis.conflicts.length > 0 ||
    analysis.risks.length > 0 ||
    analysis.coverageGaps.length > 0
  );

  return (
    <section className="border-t border-border pt-4 mt-4" data-testid="project-insights-section">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Layers size={12} />
          Project Insights
          {totalInsights > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary">
              {totalInsights}
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          data-testid="analyze-cross-workflow"
        >
          {isAnalyzing ? (
            <Loader2 size={10} className="mr-1 animate-spin" />
          ) : (
            <RefreshCw size={10} className="mr-1" />
          )}
          Analyze
        </Button>
      </header>

      {totalInsights === 0 && !hasAnalysis && !isAnalyzing && (
        <div className="text-center py-4 text-muted-foreground">
          <Layers size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs">No insights yet.</p>
          <p className="text-[10px] mt-1">Generate PRDs or click Analyze to find cross-workflow issues.</p>
        </div>
      )}

      {totalInsights > 0 && (
        <div className="mb-4">
          {INSIGHT_CATEGORIES.map(({ type, label, icon: Icon }) => (
            <InsightCategory
              key={type}
              type={type}
              label={label}
              Icon={Icon}
              insights={insightsByType[type]}
              onDismiss={handleDismissInsight}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {hasAnalysis && (
        <div className="space-y-3" data-testid="cross-workflow-analysis">
          <h3 className="text-[10px] uppercase text-muted-foreground font-medium">
            Cross-Workflow Analysis
          </h3>
          
          {analysis.assumptions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1">
                <Lightbulb size={10} />
                Assumptions
              </div>
              {analysis.assumptions.map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground pl-4 py-1 border-l-2 border-purple-200 dark:border-purple-800">
                  {item}
                </div>
              ))}
            </div>
          )}
          
          {analysis.conflicts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-orange-700 dark:text-orange-300 flex items-center gap-1">
                <AlertTriangle size={10} />
                Conflicts
              </div>
              {analysis.conflicts.map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground pl-4 py-1 border-l-2 border-orange-200 dark:border-orange-800">
                  {item}
                </div>
              ))}
            </div>
          )}
          
          {analysis.risks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
                <Shield size={10} />
                Risks
              </div>
              {analysis.risks.map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground pl-4 py-1 border-l-2 border-red-200 dark:border-red-800">
                  {item}
                </div>
              ))}
            </div>
          )}
          
          {analysis.coverageGaps.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                <HelpCircle size={10} />
                Coverage Gaps
              </div>
              {analysis.coverageGaps.map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground pl-4 py-1 border-l-2 border-yellow-200 dark:border-yellow-800">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
