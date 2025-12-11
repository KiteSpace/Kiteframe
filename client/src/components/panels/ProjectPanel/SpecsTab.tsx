import { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Palette, Type, Square, Maximize2 } from 'lucide-react';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

interface SpecsTabProps {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
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

export function SpecsTab({ nodes, edges, canvasObjects = [] }: SpecsTabProps) {
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

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Square size={32} className="mb-2 opacity-50" />
        <p className="text-sm text-center">No design specs found.</p>
        <p className="text-xs text-center mt-1">Add nodes to see colors, fonts, and dimensions.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {specs.colors.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Palette size={12} />
              Colors ({specs.colors.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {specs.colors.slice(0, 12).map((spec, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  data-testid={`color-spec-${i}`}
                >
                  <div 
                    className="w-6 h-6 rounded border border-border flex-shrink-0"
                    style={{ backgroundColor: spec.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono truncate">{spec.color}</p>
                    <p className="text-[10px] text-muted-foreground">{spec.count} use{spec.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            {specs.colors.length > 12 && (
              <p className="text-xs text-muted-foreground mt-2">+{specs.colors.length - 12} more colors</p>
            )}
          </section>
        )}

        {specs.dimensions.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Maximize2 size={12} />
              Dimensions ({specs.dimensions.length})
            </h3>
            <div className="space-y-1">
              {specs.dimensions.slice(0, 8).map((spec, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  data-testid={`dimension-spec-${i}`}
                >
                  <span className="text-xs font-mono">{spec.width} × {spec.height}</span>
                  <span className="text-xs text-muted-foreground">×{spec.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {specs.fonts.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Type size={12} />
              Fonts ({specs.fonts.length})
            </h3>
            <div className="space-y-1">
              {specs.fonts.map((spec, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  data-testid={`font-spec-${i}`}
                >
                  <span className="text-xs truncate" style={{ fontFamily: spec.font }}>{spec.font}</span>
                  <span className="text-xs text-muted-foreground">×{spec.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
