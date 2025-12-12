import * as React from 'react';
import { 
  Eye, EyeOff, Lock, Unlock, MinusSquare, Edit2, ChevronRight, ChevronDown,
  ArrowRight, ArrowLeft, Cog, HelpCircle, Bot, Image, Folder, Link2, Layers
} from 'lucide-react';
import type { Tri } from './triStateUtils';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Node type to icon mapping (matching NodeTypesPopout)
const getNodeTypeIcon = (nodeType: string) => {
  switch (nodeType) {
    case 'input': return { icon: ArrowRight, color: 'text-blue-500' };
    case 'process': return { icon: Cog, color: 'text-green-500' };
    case 'condition': return { icon: HelpCircle, color: 'text-yellow-500' };
    case 'output': return { icon: ArrowLeft, color: 'text-red-500' };
    case 'ai': return { icon: Bot, color: 'text-purple-500' };
    case 'image': return { icon: Image, color: 'text-indigo-500' };
    default: return { icon: ArrowRight, color: 'text-gray-500' };
  }
};

// Group role to icon mapping
const getGroupRoleIcon = (role: string) => {
  switch (role) {
    case 'workflow': return { icon: Layers, color: 'text-blue-600' };
    case 'linkGroup': return { icon: Link2, color: 'text-purple-500' };
    case 'standalone': return { icon: Folder, color: 'text-gray-400' };
    default: return { icon: Folder, color: 'text-gray-500' };
  }
};

export function GroupRow({
  id, depth, label, childIds,
  triHidden, triLocked,
  onToggleHidden, onToggleLocked,
  onClick, onNameChange, role,
  collapsed, onToggleCollapse
}:{
  id:string; depth:number; label:string; childIds:string[];
  triHidden:Tri; triLocked:Tri;
  onToggleHidden:()=>void; onToggleLocked:()=>void;
  onClick?:()=>void; onNameChange?:(newName:string)=>void; role?:string;
  collapsed?:boolean; onToggleCollapse?:()=>void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const { toast } = useToast();
  const EyeGlyph = triHidden==='mixed' ? MinusSquare : (triHidden==='on' ? Eye : EyeOff);
  const LockGlyph = triLocked==='mixed' ? MinusSquare : (triLocked==='on' ? Lock : Unlock);
  const handleNameSubmit = () => {
    if (onNameChange && editValue.trim()) {
      try {
        onNameChange(editValue.trim());
        setIsEditing(false);
      } catch (error) {
        // Reset on error
        setEditValue(label);
        toast({
          title: "Invalid name",
          description: "Workflow name contains invalid characters or is too long",
          variant: "destructive"
        });
      }
    } else {
      setIsEditing(false);
      setEditValue(label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(label);
    }
  };

  // Get icon for this group based on role
  const { icon: GroupIcon, color: iconColor } = getGroupRoleIcon(role || '');

  // Professional styling based on role and hierarchy
  const getTextStyles = () => {
    if (role === 'workflow') {
      return "text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer flex-1 leading-tight ml-1";
    } else if (role === 'linkGroup') {
      return "text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex-1 leading-tight ml-1";
    } else if (role === 'standalone') {
      return "text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer flex-1 leading-tight ml-1 italic";
    } else {
      return "text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer flex-1 leading-tight ml-1";
    }
  };

  const getRowStyles = () => {
    const baseStyles = "flex items-center px-2 py-1 transition-colors duration-150";
    if (role === 'workflow') {
      return `${baseStyles} h-7 hover:bg-gray-100 dark:hover:bg-gray-800`;
    } else {
      return `${baseStyles} h-6 hover:bg-gray-50 dark:hover:bg-gray-800`;
    }
  };

  return (
    <div role="treeitem" aria-level={depth+1} aria-expanded={!collapsed} className={getRowStyles()}>
      <div style={{paddingLeft: depth*16}} className="flex items-center gap-1 flex-1">
        {/* Collapse/Expand Chevron - only show for groups with children */}
        {childIds.length > 0 && onToggleCollapse ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="flex items-center justify-center w-4 h-4 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors duration-150 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title={collapsed ? 'Expand' : 'Collapse'}
            data-testid={`button-collapse-${id}`}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <div className="w-4" /> /* Spacer for alignment */
        )}
        
        {/* Type Icon - Figma style */}
        <div className={`flex items-center justify-center w-4 h-4 ${iconColor}`}>
          <GroupIcon size={14} />
        </div>
        {isEditing && role === 'workflow' ? (
          <input
            data-testid={`input-workflow-name-${id}`}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="text-sm bg-white dark:bg-gray-800 border border-blue-300 rounded px-2 py-0.5 min-w-0 flex-1 focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none ml-1"
            autoFocus
            maxLength={50}
          />
        ) : (
          <span 
            className={getTextStyles()}
            onClick={onClick}
            data-testid={`text-${role || 'group'}-${id}`}
          >
            {label}
          </span>
        )}
        {role === 'workflow' && onNameChange && !isEditing && (
          <button
            data-testid={`button-edit-workflow-${id}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="opacity-50 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 p-0.5 rounded transition-colors duration-150 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Edit workflow name"
          >
            <Edit2 size={11} />
          </button>
        )}
      </div>
      <span className="flex gap-0.5">
        <button 
          data-testid={`button-visibility-${id}`}
          onClick={onToggleHidden} 
          title={`visibility: ${triHidden}`}
          className="hover:bg-gray-200 dark:hover:bg-gray-700 p-0.5 rounded transition-colors duration-150 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <EyeGlyph size={14}/>
        </button>
        <button 
          data-testid={`button-lock-${id}`}
          onClick={onToggleLocked} 
          title={`lock: ${triLocked}`}
          className="hover:bg-gray-200 dark:hover:bg-gray-700 p-0.5 rounded transition-colors duration-150 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <LockGlyph size={14}/>
        </button>
      </span>
    </div>
  );
}

export function LeafRow({
  id, depth, label, effHidden, effLocked, onClick, role, nodeType, isDecision, branchDepth
}:{
  id:string; depth:number; label:string; effHidden:boolean; effLocked:boolean;
  onClick?:()=>void; role?:string; nodeType?:string; isDecision?:boolean; branchDepth?:number;
}) {
  // Add branch indentation for decision tree visualization
  const effectiveDepth = depth + (branchDepth ?? 0);
  const leafStyles = `px-2 py-1 h-6 flex items-center hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-150 ${effHidden ? 'opacity-50' : ''}`;
  
  // Get icon based on node type or role
  const getLeafIcon = () => {
    if (role === 'edge') {
      return { icon: Link2, color: 'text-purple-400' };
    } else if (nodeType) {
      return getNodeTypeIcon(nodeType);
    } else {
      return { icon: ArrowRight, color: 'text-gray-400' };
    }
  };
  
  const { icon: LeafIcon, color: iconColor } = getLeafIcon();
  
  // Show branch indicator for nodes under decision branches
  const branchIndicator = (branchDepth ?? 0) > 0 ? '↳ ' : '';
  
  return (
    <div role="treeitem" aria-level={effectiveDepth+1}
         className={leafStyles}
         onClick={onClick}
         data-testid={`row-layer-${id}`}>
      <div style={{paddingLeft: effectiveDepth*16}} className="flex items-center gap-1 flex-1">
        {/* Spacer to align with parent chevrons */}
        <div className="w-4" />
        
        {/* Branch indicator for decision tree visualization */}
        {branchIndicator && (
          <span className="text-gray-400 dark:text-gray-500 text-xs mr-0.5">{branchIndicator}</span>
        )}
        
        {/* Type Icon - Figma style */}
        <div className={`flex items-center justify-center w-4 h-4 ${iconColor}`}>
          <LeafIcon size={12} />
        </div>
        
        <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight flex-1 ml-1">
          {label}
        </span>
        
        {/* Decision indicator */}
        {isDecision && (
          <span className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded font-medium">
            ?
          </span>
        )}
      </div>
      {effLocked && (
        <span className="ml-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full font-medium">
          locked
        </span>
      )}
    </div>
  );
}