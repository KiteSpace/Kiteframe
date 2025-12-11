import { useState, useMemo, useCallback, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Palette, Type, Square, Maximize2, ChevronDown, ChevronRight, 
  Sparkles, RefreshCw, FileText, AlertTriangle, Loader2, RotateCcw,
  Edit3, Eye
} from 'lucide-react';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { groupWorkflows, type WorkflowGroup } from '@/lib/kiteframe/utils/workflowGrouping';
import { extractSemanticWorkflowModel } from '@/lib/kiteframe/utils/extractSemanticWorkflowModel';
import { isWorkflowStale, storeHash, computeWorkflowHash } from '@/lib/kiteframe/utils/semanticHash';
import { 
  loadWorkflowPRD, saveWorkflowPRD, saveWorkflowPRDBackup, 
  updatePRDSection, clearManualEdit 
} from '@/lib/kiteframe/utils/prdStorage';
import { createEmptyWorkflowPRD, type WorkflowPRD, type PRDSection } from '@/ai/prdEngine';
import { useAi } from '@/ai/AiProvider';
import { generateWorkflowPRD } from '@/ai/prdEngine';
import { useToast } from '@/hooks/use-toast';

interface SpecsTabProps {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  projectId?: string;
}

interface ColorSpec {
  color: string;
  count: number;
  usedIn: string[];
}

interface DimensionSpec {
  width: number;
  height: number;
  count: number;
}

function DesignSpecs({ nodes, edges, canvasObjects = [] }: { nodes: Node[], edges: Edge[], canvasObjects: CanvasObject[] }) {
  const specs = useMemo(() => {
    const colors: Map<string, Set<string>> = new Map();
    const dimensions: Map<string, { width: number; height: number; count: number }> = new Map();
    const fonts: Map<string, number> = new Map();

    const addColor = (color: string | undefined, source: string) => {
      if (!color || color === 'transparent' || color === 'none') return;
      const normalized = color.toLowerCase().trim();
      if (!colors.has(normalized)) {
        colors.set(normalized, new Set());
      }
      colors.get(normalized)!.add(source);
    };

    const addDimension = (width: number | undefined, height: number | undefined) => {
      if (!width || !height || width <= 0 || height <= 0) return;
      const w = Math.round(width);
      const h = Math.round(height);
      const key = `${w}x${h}`;
      if (!dimensions.has(key)) {
        dimensions.set(key, { width: w, height: h, count: 0 });
      }
      dimensions.get(key)!.count++;
    };

    const addFont = (font: string | undefined) => {
      if (!font) return;
      const normalized = font.split(',')[0].trim();
      fonts.set(normalized, (fonts.get(normalized) || 0) + 1);
    };

    nodes.forEach(node => {
      const nodeId = node.id;
      const nodeLabel = node.data?.label || node.type || 'Node';
      const sourceId = `${nodeLabel}-${nodeId}`;
      
      const colorsFromNode = new Set<string>();
      
      if (node.data?.backgroundColor) colorsFromNode.add(node.data.backgroundColor);
      if (node.data?.headerColor) colorsFromNode.add(node.data.headerColor);
      if (node.data?.borderColor) colorsFromNode.add(node.data.borderColor);
      if (node.data?.textColor) colorsFromNode.add(node.data.textColor);
      if (node.data?.colors?.headerBackground) colorsFromNode.add(node.data.colors.headerBackground);
      if (node.data?.colors?.bodyBackground) colorsFromNode.add(node.data.colors.bodyBackground);
      if (node.data?.colors?.borderColor) colorsFromNode.add(node.data.colors.borderColor);
      
      colorsFromNode.forEach(c => addColor(c, sourceId));
      
      const w = node.width ?? node.style?.width;
      const h = node.height ?? node.style?.height;
      if (w && h) addDimension(Number(w), Number(h));
      
      if (node.data?.fontFamily) addFont(node.data.fontFamily);
    });

    canvasObjects.forEach((obj, index) => {
      const objLabel = obj.type === 'text' ? 'Text' : obj.type === 'sticky' ? 'Sticky' : 'Shape';
      const objSourceId = `${objLabel}-${obj.id || `idx-${index}`}`;
      
      const colorsFromObj = new Set<string>();
      
      if (obj.data?.backgroundColor) colorsFromObj.add(obj.data.backgroundColor);
      if (obj.data?.fillColor) colorsFromObj.add(obj.data.fillColor);
      if (obj.data?.strokeColor) colorsFromObj.add(obj.data.strokeColor);
      if (obj.data?.textColor) colorsFromObj.add(obj.data.textColor);
      
      colorsFromObj.forEach(c => addColor(c, objSourceId));
      
      if (obj.width && obj.height) addDimension(obj.width, obj.height);
      
      if (obj.data?.fontFamily) addFont(obj.data.fontFamily);
    });

    edges.forEach(edge => {
      const edgeSourceId = `Edge-${edge.id}`;
      
      if (edge.style?.stroke) addColor(String(edge.style.stroke), edgeSourceId);
      if (edge.data?.color) addColor(edge.data.color, edgeSourceId);
      if (edge.data?.strokeColor) addColor(edge.data.strokeColor, edgeSourceId);
    });

    const colorSpecs: ColorSpec[] = Array.from(colors.entries())
      .map(([color, sources]) => ({
        color,
        count: sources.size,
        usedIn: Array.from(sources)
      }))
      .sort((a, b) => b.count - a.count);

    const dimensionSpecs: DimensionSpec[] = Array.from(dimensions.values())
      .sort((a, b) => b.count - a.count);

    const fontSpecs = Array.from(fonts.entries())
      .map(([font, count]) => ({ font, count }))
      .sort((a, b) => b.count - a.count);

    return { colors: colorSpecs, dimensions: dimensionSpecs, fonts: fontSpecs };
  }, [nodes, edges, canvasObjects]);

  const isEmpty = specs.colors.length === 0 && specs.dimensions.length === 0 && specs.fonts.length === 0;

  if (isEmpty) return null;

  return (
    <div className="space-y-3">
      {specs.colors.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Palette size={12} />
            Colors ({specs.colors.length})
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {specs.colors.slice(0, 8).map((spec, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                data-testid={`color-spec-${i}`}
              >
                <div 
                  className="w-5 h-5 rounded border border-border flex-shrink-0"
                  style={{ backgroundColor: spec.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-mono truncate">{spec.color}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {specs.dimensions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Maximize2 size={12} />
            Dimensions
          </h4>
          <div className="flex flex-wrap gap-2">
            {specs.dimensions.slice(0, 4).map((spec, i) => (
              <span 
                key={i}
                className="text-[10px] font-mono px-2 py-1 rounded bg-muted/50"
                data-testid={`dimension-spec-${i}`}
              >
                {spec.width}×{spec.height}
              </span>
            ))}
          </div>
        </div>
      )}

      {specs.fonts.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Type size={12} />
            Fonts
          </h4>
          <div className="flex flex-wrap gap-2">
            {specs.fonts.map((spec, i) => (
              <span 
                key={i}
                className="text-[10px] px-2 py-1 rounded bg-muted/50"
                style={{ fontFamily: spec.font }}
                data-testid={`font-spec-${i}`}
              >
                {spec.font}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PRDSectionEditor({ 
  section, 
  isManuallyEdited,
  onUpdate, 
  onResetToAI 
}: { 
  section: PRDSection;
  isManuallyEdited: boolean;
  onUpdate: (content: string) => void;
  onResetToAI: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content);

  const handleSave = () => {
    onUpdate(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(section.content);
    setIsEditing(false);
  };

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <h4 className="text-xs font-medium">{section.title}</h4>
        <div className="flex items-center gap-1">
          {isManuallyEdited && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={onResetToAI}
              data-testid={`reset-section-${section.id}`}
            >
              <RotateCcw size={10} className="mr-1" />
              Reset
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsEditing(!isEditing)}
            data-testid={`edit-section-${section.id}`}
          >
            {isEditing ? <Eye size={12} /> : <Edit3 size={12} />}
          </Button>
        </div>
      </div>
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[100px] text-xs font-mono"
              placeholder="Enter content..."
              data-testid={`textarea-section-${section.id}`}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} className="h-7 text-xs">
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
            {section.content || <span className="italic">No content yet. Click Generate to create.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function SpecsTab({ nodes, edges, canvasObjects = [], projectId }: SpecsTabProps) {
  const hasDesignSpecs = useMemo(() => {
    return nodes.some(n => 
      n.data?.backgroundColor || n.data?.headerColor || n.data?.borderColor || 
      n.data?.colors?.headerBackground || n.data?.fontFamily
    ) || canvasObjects.some(o => 
      o.data?.backgroundColor || o.data?.fillColor || o.data?.strokeColor
    ) || edges.some(e => 
      e.style?.stroke || e.data?.color
    );
  }, [nodes, edges, canvasObjects]);
  
  const [designSpecsOpen, setDesignSpecsOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [prd, setPrd] = useState<WorkflowPRD | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const ai = useAi();
  const { toast } = useToast();

  const workflowGroups = useMemo(() => groupWorkflows(nodes, edges), [nodes, edges]);

  const selectedWorkflow = useMemo(() => {
    if (!selectedWorkflowId && workflowGroups.length > 0) {
      return workflowGroups[0];
    }
    return workflowGroups.find(g => g.id === selectedWorkflowId) || null;
  }, [selectedWorkflowId, workflowGroups]);

  useEffect(() => {
    if (selectedWorkflow && projectId) {
      const loaded = loadWorkflowPRD(projectId, selectedWorkflow.id);
      if (loaded) {
        setPrd(loaded);
        const stale = isWorkflowStale(projectId, selectedWorkflow.id, selectedWorkflow.nodes, selectedWorkflow.edges);
        setIsStale(stale);
      } else {
        setPrd(null);
        setIsStale(false);
      }
    }
  }, [selectedWorkflow, projectId]);

  const handleGenerate = useCallback(async () => {
    if (!selectedWorkflow || !projectId) return;

    if (selectedWorkflow.nodes.length > 50) {
      toast({
        title: 'Large workflow',
        description: 'This workflow has over 50 nodes. Generation may take longer.',
      });
    }

    setIsGenerating(true);

    try {
      if (prd) {
        saveWorkflowPRDBackup(projectId, selectedWorkflow.id, prd);
        toast({ title: 'Backup saved', description: 'Previous spec saved as backup.' });
      }

      const model = extractSemanticWorkflowModel(
        selectedWorkflow.id,
        selectedWorkflow.name,
        selectedWorkflow.nodes,
        selectedWorkflow.edges
      );

      const newPrd = await generateWorkflowPRD(ai, model, prd || undefined);
      
      const hash = computeWorkflowHash(selectedWorkflow.nodes, selectedWorkflow.edges);
      storeHash(projectId, selectedWorkflow.id, hash);
      
      saveWorkflowPRD(projectId, selectedWorkflow.id, { ...newPrd, hash });
      setPrd({ ...newPrd, hash });
      setIsStale(false);

      toast({ title: 'Spec generated', description: 'Workflow spec has been created.' });
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedWorkflow, projectId, prd, ai, toast]);

  const handleSectionUpdate = useCallback((sectionId: string, content: string) => {
    if (!prd || !projectId || !selectedWorkflow) return;

    const updated = updatePRDSection(prd, sectionId, content, true) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, selectedWorkflow.id, updated);
  }, [prd, projectId, selectedWorkflow]);

  const handleResetSection = useCallback((sectionId: string) => {
    if (!prd || !projectId || !selectedWorkflow) return;

    const updated = clearManualEdit(prd, sectionId) as WorkflowPRD;
    setPrd(updated);
    saveWorkflowPRD(projectId, selectedWorkflow.id, updated);
  }, [prd, projectId, selectedWorkflow]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Square size={32} className="mb-2 opacity-50" />
        <p className="text-sm text-center">No nodes on canvas.</p>
        <p className="text-xs text-center mt-1">Add nodes to generate specs.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {workflowGroups.length > 1 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Workflow</label>
            <select
              value={selectedWorkflow?.id || ''}
              onChange={(e) => setSelectedWorkflowId(e.target.value)}
              className="w-full text-sm p-2 rounded-md border border-border bg-background"
              data-testid="workflow-selector"
            >
              {workflowGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.nodes.length} nodes)
                </option>
              ))}
            </select>
          </div>
        )}

        {isStale && prd && (
          <Alert className="py-2">
            <AlertTriangle size={14} className="text-yellow-500" />
            <AlertDescription className="text-xs ml-2 flex items-center justify-between">
              <span>Workflow changed. Spec may be outdated.</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs ml-2"
                onClick={handleGenerate}
                disabled={isGenerating}
                data-testid="regenerate-prd"
              >
                <RefreshCw size={10} className="mr-1" />
                Update
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium flex items-center gap-1.5">
              <FileText size={12} />
              Workflow Spec
            </h3>
            <Button
              variant={prd ? 'outline' : 'default'}
              size="sm"
              className="h-7 text-xs"
              onClick={handleGenerate}
              disabled={isGenerating || !projectId}
              data-testid="generate-prd"
            >
              {isGenerating ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Sparkles size={12} className="mr-1" />
              )}
              {prd ? 'Regenerate' : 'Generate'}
            </Button>
          </div>

          {!projectId && (
            <p className="text-xs text-muted-foreground italic">
              Save project to enable spec generation.
            </p>
          )}

          {prd && (
            <div className="space-y-2">
              {prd.sections.map((section) => (
                <PRDSectionEditor
                  key={section.id}
                  section={section}
                  isManuallyEdited={!!prd.manualEditedAt[section.id]}
                  onUpdate={(content) => handleSectionUpdate(section.id, content)}
                  onResetToAI={() => handleResetSection(section.id)}
                />
              ))}
            </div>
          )}
        </div>

        {hasDesignSpecs && (
          <Collapsible open={designSpecsOpen} onOpenChange={setDesignSpecsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
              {designSpecsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Palette size={12} />
              Design Specs
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <DesignSpecs nodes={nodes} edges={edges} canvasObjects={canvasObjects} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </ScrollArea>
  );
}
