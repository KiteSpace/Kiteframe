import * as React from 'react';
import { Eye, EyeOff, Lock, Unlock, MinusSquare, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import type { Tri } from './triStateUtils';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

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

  // Professional styling based on role and hierarchy
  const getTextStyles = () => {
    if (role === 'workflow') {
      return "text-base font-semibold text-gray-900 cursor-pointer flex-1 leading-tight";
    } else if (role === 'linkGroup') {
      return "text-sm font-medium text-blue-700 cursor-pointer flex-1 leading-tight";
    } else {
      return "text-sm font-medium text-gray-700 cursor-pointer flex-1 leading-tight";
    }
  };

  const getRowStyles = () => {
    const baseStyles = "flex items-center gap-2 px-3 transition-colors duration-150";
    if (role === 'workflow') {
      return `${baseStyles} h-8 hover:bg-blue-50 border-l-2 border-transparent hover:border-l-blue-300`;
    } else {
      return `${baseStyles} h-7 hover:bg-gray-50`;
    }
  };

  return (
    <div role="treeitem" aria-level={depth+1} aria-expanded={!collapsed} className={getRowStyles()}>
      <div style={{paddingLeft: depth*14}} className="flex items-center gap-1 flex-1">
        {/* Collapse/Expand Chevron - only show for groups with children */}
        {childIds.length > 0 && onToggleCollapse ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors duration-150 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title={collapsed ? 'Expand' : 'Collapse'}
            data-testid={`button-collapse-${id}`}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <div className="w-6" /> /* Spacer for alignment */
        )}
        {isEditing && role === 'workflow' ? (
          <input
            data-testid={`input-workflow-name-${id}`}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="text-base font-semibold bg-white border border-blue-300 rounded px-2 py-1 min-w-0 flex-1 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
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
            className="opacity-60 hover:opacity-100 hover:bg-blue-100 p-1 rounded transition-colors duration-150 text-gray-600 hover:text-blue-700"
            title="Edit workflow name"
          >
            <Edit2 size={13} />
          </button>
        )}
      </div>
      <span className="flex gap-1">
        <button 
          data-testid={`button-visibility-${id}`}
          onClick={onToggleHidden} 
          title={`visibility: ${triHidden}`}
          className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded transition-colors duration-150 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <EyeGlyph size={15}/>
        </button>
        <button 
          data-testid={`button-lock-${id}`}
          onClick={onToggleLocked} 
          title={`lock: ${triLocked}`}
          className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded transition-colors duration-150 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <LockGlyph size={15}/>
        </button>
      </span>
    </div>
  );
}

export function LeafRow({
  id, depth, label, effHidden, effLocked, onClick
}:{
  id:string; depth:number; label:string; effHidden:boolean; effLocked:boolean;
  onClick?:()=>void;
}) {
  const leafStyles = `px-3 h-6 flex items-center hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${effHidden ? 'opacity-50' : ''}`;
  
  return (
    <div role="treeitem" aria-level={depth+1}
         className={leafStyles}
         onClick={onClick}
         data-testid={`row-layer-${id}`}>
      <span 
        style={{paddingLeft: depth*14}} 
        className="text-sm text-gray-600 leading-tight flex-1"
      >
        {label}
      </span>
      {effLocked && (
        <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">
          locked
        </span>
      )}
    </div>
  );
}