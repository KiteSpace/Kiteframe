import * as React from 'react';
import { Eye, EyeOff, Lock, Unlock, MinusSquare, Edit2 } from 'lucide-react';
import type { Tri } from './triStateUtils';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function GroupRow({
  id, depth, label, childIds,
  triHidden, triLocked,
  onToggleHidden, onToggleLocked,
  onClick, onNameChange, role
}:{
  id:string; depth:number; label:string; childIds:string[];
  triHidden:Tri; triLocked:Tri;
  onToggleHidden:()=>void; onToggleLocked:()=>void;
  onClick?:()=>void; onNameChange?:(newName:string)=>void; role?:string;
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

  return (
    <div role="treeitem" aria-level={depth+1} aria-expanded className="flex items-center gap-2 px-2 h-7 hover:bg-gray-50">
      <div style={{paddingLeft: depth*12}} className="flex items-center gap-2 flex-1">
        {isEditing && role === 'workflow' ? (
          <input
            data-testid={`input-workflow-name-${id}`}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="text-sm font-medium bg-white border border-gray-300 rounded px-1 py-0.5 min-w-0 flex-1"
            autoFocus
            maxLength={50}
          />
        ) : (
          <span 
            className="font-medium cursor-pointer flex-1"
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
            className="opacity-50 hover:opacity-100 hover:bg-gray-200 p-0.5 rounded"
            title="Edit workflow name"
          >
            <Edit2 size={12} />
          </button>
        )}
      </div>
      <span className="flex gap-1">
        <button 
          data-testid={`button-visibility-${id}`}
          onClick={onToggleHidden} 
          title={`visibility: ${triHidden}`}
          className="hover:bg-gray-200 p-0.5 rounded"
        >
          <EyeGlyph size={16}/>
        </button>
        <button 
          data-testid={`button-lock-${id}`}
          onClick={onToggleLocked} 
          title={`lock: ${triLocked}`}
          className="hover:bg-gray-200 p-0.5 rounded"
        >
          <LockGlyph size={16}/>
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
  return (
    <div role="treeitem" aria-level={depth+1}
         className={`px-2 h-7 flex items-center hover:bg-gray-50 cursor-pointer ${effHidden?'opacity-50':''}`}
         onClick={onClick}
         data-testid={`row-layer-${id}`}>
      <span style={{paddingLeft: depth*12}}>{label}</span>
      {effLocked && <span className="ml-2 text-xs opacity-70">[locked]</span>}
    </div>
  );
}