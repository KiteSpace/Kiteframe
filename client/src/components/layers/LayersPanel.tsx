import React, { useEffect, useMemo, useState } from 'react';
import { LayerModeTabs, type LayerMode } from './LayerModeTabs';
import { VirtualTree } from './VirtualTree';
import { VLStore } from './visibilityLockStore';
import { computeTri, cascade, isEffectivelyOn, Tri } from './triStateUtils';
import { GroupRow, LeafRow } from './TreeRow';
import { buildMultiViewTrees } from './multiViewBuilder';
import { AncestorsStore } from './ancestorsStore';
import { useWorkflowNames, generateDefaultWorkflowNames } from '@/stores/workflowNameStore';
import { focusBus } from '@/stores/focusBus';
import { Search } from 'lucide-react';

// Collapse state management
class CollapseStore {
  private subscribers = new Set<() => void>();
  private collapsed = new Map<string, boolean>();
  
  constructor() {
    // Load from localStorage
    const saved = localStorage.getItem('layers-collapsed-state');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.collapsed = new Map(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('Failed to load collapse state:', e);
      }
    }
  }
  
  get(id: string): boolean {
    return this.collapsed.get(id) ?? false;
  }
  
  toggle(id: string) {
    const current = this.get(id);
    this.collapsed.set(id, !current);
    this.save();
    this.notify();
  }
  
  private save() {
    try {
      const entries: [string, boolean][] = [];
      this.collapsed.forEach((value, key) => {
        entries.push([key, value]);
      });
      localStorage.setItem('layers-collapsed-state', JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save collapse state:', e);
    }
  }
  
  private notify() {
    this.subscribers.forEach(callback => callback());
  }
  
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

const collapseStore = new CollapseStore();

export function LayersPanel({ nodes, edges, frames }:{
  nodes:any[]; edges:any[]; frames?:any[];
}) {
  const [mode, setMode] = useState<LayerMode>('structure');
  const [tree, setTree] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapseVersion, forceCollapseUpdate] = React.useReducer((x: number) => x + 1, 0);

  useEffect(()=>{
    const w = new Worker(new URL('./graphWorker.ts', import.meta.url), { type:'module' });
    w.onmessage = (e:any)=> setTree(buildMultiViewTrees(nodes, edges, frames ?? [], e.data));
    w.postMessage({ nodes, edges, frames, pinnedWorkflows:{} });
    return ()=> w.terminate();
  }, [nodes, edges, frames]);

  const rootId = mode==='structure' ? 'structureRoot' : mode==='topology' ? 'topologyRoot' : mode==='spatial' ? 'spatialRoot' : 'linksRoot';
  const getChildren = (id:string):string[] => tree?.groups[id]?.childIds ?? [];

  const workflowNames = useWorkflowNames();

  const { rows, ancestorsIndex, defaultNames } = useMemo(()=>{
    if(!tree) return { rows:[], ancestorsIndex:{} as Record<string,string[]>, defaultNames:{} as Record<string,string> };
    
    // Generate default workflow names based on position
    const workflowsById: Record<string, string[]> = {};
    Object.entries(tree.groups).forEach(([groupId, group]) => {
      if ((group as any).role === 'workflow' && groupId.startsWith('wf:')) {
        const wfKey = groupId.slice(3);
        workflowsById[wfKey] = (group as any).childIds.filter((id: string) => !id.startsWith('e:'));
      }
    });
    const generatedDefaults = generateDefaultWorkflowNames(workflowsById, nodes);
    
    const idx: Record<string,string[]> = {};
    const out:any[]=[];
    
    // Helper to check if item matches search query (memoized lowercased)
    const lowerQuery = searchQuery.toLowerCase().trim();
    const matchesSearch = (label: string) => {
      if (!lowerQuery) return true;
      return label.toLowerCase().includes(lowerQuery);
    };
    
    // Recursive helper to check if any descendant matches search
    const hasMatchingDescendant = (groupId: string): boolean => {
      const group = tree.groups[groupId];
      if (!group) return false;
      
      for (const cid of group.childIds) {
        if (tree.groups[cid]) {
          // Child is a group - resolve its name and check recursively
          const childGroup = tree.groups[cid];
          let childDisplayName = childGroup.name;
          if (childGroup.role === 'workflow' && cid.startsWith('wf:')) {
            childDisplayName = workflowNames.get(cid) || generatedDefaults[cid] || childGroup.name;
          }
          
          if (matchesSearch(childDisplayName) || hasMatchingDescendant(cid)) {
            return true;
          }
        } else {
          // Child is a leaf - check its label
          const leaf = tree.leaves[cid];
          if (leaf && matchesSearch(leaf.label || cid)) {
            return true;
          }
        }
      }
      return false;
    };
    
    const walk=(id:string, depth:number, ancestors:string[])=>{
      const g = tree.groups[id]; if(!g) return;
      g.childIds.forEach((cid: string)=>{ idx[cid] = ancestors.concat(id); });
      
      // Resolve display name for workflow groups
      let displayName = g.name;
      if (g.role === 'workflow' && id.startsWith('wf:')) {
        displayName = workflowNames.get(id) || generatedDefaults[id] || g.name;
      } else if (g.role === 'linkGroup' && id.startsWith('links:')) {
        // Resolve workflow names in link group labels
        const match = id.match(/links:(.+)\|(.+)/);
        if (match) {
          const [, wfA, wfB] = match;
          const nameA = workflowNames.get(`wf:${wfA}`) || generatedDefaults[`wf:${wfA}`] || wfA;
          const nameB = workflowNames.get(`wf:${wfB}`) || generatedDefaults[`wf:${wfB}`] || wfB;
          displayName = `Between ${nameA} ↔ ${nameB}`;
        }
      }
      
      // Check if this group matches or has any matching descendants
      const groupMatches = matchesSearch(displayName);
      const hasMatchingChildren = hasMatchingDescendant(id);
      
      // Include this group if no search query OR it matches OR has matching descendants
      if (!lowerQuery || groupMatches || hasMatchingChildren) {
        out.push({ type:'group', id, label:displayName, depth, childIds:g.childIds, role:g.role, collapsed: collapseStore.get(id) });
        
        // Show children if not collapsed OR when searching (ignore collapse during search)
        const isCollapsed = collapseStore.get(id);
        if (!isCollapsed || lowerQuery) {
          for (const cid of g.childIds) {
            if (tree.groups[cid]) {
              walk(cid, depth+1, ancestors.concat(id));
            } else {
              const leaf = tree.leaves[cid];
              if (leaf && (!lowerQuery || matchesSearch(leaf.label || cid))) {
                out.push({ type:'leaf', id:cid, label:leaf.label ?? cid, depth:depth+1, role:leaf.role });
              }
            }
          }
        }
      }
    };
    walk(rootId, 0, []);
    return { rows: out, ancestorsIndex: idx, defaultNames: generatedDefaults };
  }, [tree, rootId, workflowNames, nodes, searchQuery, collapseVersion]);

  useEffect(()=>{ AncestorsStore.set(ancestorsIndex); }, [ancestorsIndex]);

  const [, force] = React.useReducer(x=>x+1, 0);
  useEffect(()=>{ 
    const unsubscribe = VLStore.subscribe(force); 
    return () => { unsubscribe(); };
  },[]);
  
  useEffect(() => {
    const unsubscribe = collapseStore.subscribe(forceCollapseUpdate);
    return unsubscribe;
  }, []);
  
  const flags = VLStore.get();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900" role="tree" aria-label="Layers">
      <LayerModeTabs mode={mode} setMode={setMode} />
      
      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-colors"
            data-testid="input-layers-search"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden bg-gray-50/30 dark:bg-gray-800/30">
        <VirtualTree
          rows={rows}
          Row={({type,id,label,depth,childIds,role,collapsed}:{type:'group'|'leaf';id:string;label:string;depth:number;childIds?:string[];role?:string;collapsed?:boolean})=>{
            if (type==='group') {
              const triHidden:Tri = computeTri(childIds ?? [], flags.hidden);
              const triLocked:Tri = computeTri(childIds ?? [], flags.locked);
              const onToggleHidden = () => {
                const next = { hidden: { ...flags.hidden }, locked: { ...flags.locked } };
                cascade(id, !(triHidden==='on'), getChildren, next.hidden);
                VLStore.set(next);
              };
              const onToggleLocked = () => {
                const next = { hidden: { ...flags.hidden }, locked: { ...flags.locked } };
                cascade(id, !(triLocked==='on'), getChildren, next.locked);
                VLStore.set(next);
              };
              const handleClick = () => {
                if (role === 'workflow' && childIds) {
                  const nodeIds = childIds.filter(cid => !cid.startsWith('e:'));
                  focusBus.focusWorkflow(nodeIds);
                }
              };
              
              const handleNameChange = role === 'workflow' ? (newName: string) => {
                // Let errors propagate to GroupRow for proper toast feedback
                workflowNames.set(id, newName);
              } : undefined;
              
              const handleToggleCollapse = () => {
                collapseStore.toggle(id);
              };
              
              return <GroupRow 
                id={id} depth={depth} label={label} childIds={childIds ?? []}
                triHidden={triHidden} triLocked={triLocked}
                onToggleHidden={onToggleHidden} onToggleLocked={onToggleLocked}
                onClick={handleClick}
                onNameChange={handleNameChange}
                role={role}
                collapsed={collapsed}
                onToggleCollapse={handleToggleCollapse}
              />;
            } else {
              const ancestors = ancestorsIndex[id] ?? [];
              const effHidden = isEffectivelyOn(id, ancestors, flags.hidden);
              const effLocked = isEffectivelyOn(id, ancestors, flags.locked);
              
              const handleClick = () => {
                if (role === 'node') {
                  focusBus.focusNodes([id], { select: true });
                } else if (role === 'edge' && id.startsWith('e:')) {
                  const edgeId = id.slice(2);
                  const edge = edges.find(e => e.id === edgeId);
                  if (edge) {
                    focusBus.focusNodes([edge.source, edge.target]);
                  }
                }
              };
              
              return <LeafRow 
                id={id} depth={depth} label={label} 
                effHidden={effHidden} effLocked={effLocked}
                onClick={handleClick}
              />;
            }
          }}
        />
      </div>
    </div>
  );
}

export default LayersPanel;