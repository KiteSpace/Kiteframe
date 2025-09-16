import { Edge } from '@/lib/kiteframe/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Palette } from 'lucide-react';

interface EdgePropertiesProps {
  selectedEdge: Edge;
  onEdgeUpdate: (edgeId: string, updates: Partial<Edge>) => void;
  compact?: boolean; // For different styling between sidebar and card
}

export function EdgeProperties({ selectedEdge, onEdgeUpdate, compact = false }: EdgePropertiesProps) {
  return (
    <>
      {/* Connection Type */}
      <div className={compact ? "space-y-2" : "space-y-2"}>
        <Label className="text-xs font-medium">Connection Type</Label>
        <select
          value={selectedEdge.type || 'bezier'}
          onChange={(e) => onEdgeUpdate(selectedEdge.id, { type: e.target.value as any })}
          className="w-full p-2 text-xs border border-border rounded bg-background"
          data-testid="select-edge-type"
        >
          <option value="straight">Straight</option>
          <option value="bezier">Bezier</option>
          <option value="step">Step</option>
          <option value="curved">Curved</option>
          <option value="orthogonal">Orthogonal</option>
          <option value="smoothstep">Smooth Step</option>
        </select>
      </div>

      <Separator />

      {/* Appearance */}
      <div className={compact ? "space-y-3" : "space-y-3"}>
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          <Label className="text-xs font-semibold">Appearance</Label>
        </div>
        
        {/* Color */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedEdge.style?.strokeColor || '#3b82f6'}
              onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                style: { ...(selectedEdge.style || {}), strokeColor: e.target.value }
              })}
              className="w-8 h-6 rounded border border-border cursor-pointer"
              data-testid="input-edge-color"
            />
            <Input
              type="text"
              value={selectedEdge.style?.strokeColor || '#3b82f6'}
              onChange={(e) => onEdgeUpdate(selectedEdge.id, {
                style: { ...(selectedEdge.style || {}), strokeColor: e.target.value }
              })}
              className={compact ? "flex-1 text-xs" : "flex-1 text-xs p-1.5 border border-border rounded bg-background"}
              placeholder="#3b82f6"
              data-testid="input-edge-color-text"
            />
          </div>
        </div>

        {/* Thickness */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            Thickness ({selectedEdge.style?.strokeWidth || 2}px)
          </Label>
          <input
            type="range"
            min="1"
            max="10"
            value={selectedEdge.style?.strokeWidth || 2}
            onChange={(e) => onEdgeUpdate(selectedEdge.id, {
              style: { ...(selectedEdge.style || {}), strokeWidth: parseInt(e.target.value) }
            })}
            className="w-full"
            data-testid="range-edge-thickness"
          />
        </div>

        {/* Style */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Line Style</Label>
          <select
            value={selectedEdge.style?.strokeDasharray ? 'dashed' : 'solid'}
            onChange={(e) => onEdgeUpdate(selectedEdge.id, {
              style: { 
                ...(selectedEdge.style || {}), 
                strokeDasharray: e.target.value === 'dashed' ? '5,5' : undefined 
              }
            })}
            className="w-full p-2 text-xs border border-border rounded bg-background"
            data-testid="select-edge-style"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </div>

        {/* Animated */}
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Animated</Label>
          <input
            type="checkbox"
            checked={selectedEdge.animated || false}
            onChange={(e) => onEdgeUpdate(selectedEdge.id, { animated: e.target.checked })}
            className="rounded"
            data-testid="checkbox-edge-animated"
          />
        </div>
      </div>

      <Separator />

      {/* Markers */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Arrow Type</Label>
        <select
          value={selectedEdge.markers?.type || 'arrow'}
          onChange={(e) => onEdgeUpdate(selectedEdge.id, {
            markers: { ...(selectedEdge.markers || {}), type: e.target.value as any }
          })}
          className="w-full p-2 text-xs border border-border rounded bg-background"
          data-testid="select-edge-marker"
        >
          <option value="arrow">Arrow</option>
          <option value="circle">Circle</option>
          <option value="square">Square</option>
          <option value="diamond">Diamond</option>
          <option value="triangle">Triangle</option>
        </select>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Label</Label>
        <Input
          value={selectedEdge.label || ''}
          onChange={(e) => onEdgeUpdate(selectedEdge.id, { label: e.target.value })}
          className="text-sm"
          placeholder="Edge label..."
          data-testid="input-edge-label"
        />
      </div>

      {/* Connection info (read-only) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Connection</Label>
        <div className="p-2 bg-muted rounded text-sm">
          {selectedEdge.source} → {selectedEdge.target}
        </div>
      </div>
    </>
  );
}