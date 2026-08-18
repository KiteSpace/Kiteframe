import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Layers,
  Table2,
  FileText,
  X,
  Focus,
  Sparkles
} from 'lucide-react';
import type { Node, CompoundNodeData, SavedCompoundTemplate } from '../types';

interface NodeGalleryPanelProps {
  nodes: Node[];
  templates: SavedCompoundTemplate[];
  onFocusNode?: (nodeId: string) => void;
  onClose?: () => void;
  className?: string;
}

interface GeneratedNodeInfo {
  node: Node;
  templateName: string;
  tableName?: string;
  rowId?: string;
  label: string;
}

const ITEMS_PER_PAGE = 12;

export const NodeGalleryPanel: React.FC<NodeGalleryPanelProps> = ({
  nodes,
  templates,
  onFocusNode,
  onClose,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const templateMap = useMemo(() => {
    const map = new Map<string, SavedCompoundTemplate>();
    templates.forEach(t => map.set(t.id, t));
    return map;
  }, [templates]);

  const tableNodeMap = useMemo(() => {
    const map = new Map<string, { name: string; nodeId: string }>();
    nodes.forEach(n => {
      if (n.type === 'table' && n.data?.tableId) {
        map.set(n.data.tableId, {
          name: n.data.table?.name || n.data.label || 'Table',
          nodeId: n.id
        });
      }
    });
    return map;
  }, [nodes]);

  const generatedNodes = useMemo(() => {
    return nodes
      .filter((n): n is Node & { data: CompoundNodeData } => {
        return n.type === 'compound' && !!(n.data as CompoundNodeData)?.sourceTemplateId;
      })
      .map((n): GeneratedNodeInfo => {
        const data = n.data as CompoundNodeData;
        const template = data.sourceTemplateId ? templateMap.get(data.sourceTemplateId) : undefined;
        const tableInfo = data.sourceTableId ? tableNodeMap.get(data.sourceTableId) : undefined;
        
        return {
          node: n,
          templateName: template?.name || 'Unknown Template',
          tableName: tableInfo?.name,
          rowId: data.sourceRowId,
          label: data.label || template?.name || 'Compound Node'
        };
      });
  }, [nodes, templateMap, tableNodeMap]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return generatedNodes;
    
    const query = searchQuery.toLowerCase().trim();
    return generatedNodes.filter(item => 
      item.label.toLowerCase().includes(query) ||
      item.templateName.toLowerCase().includes(query) ||
      (item.tableName && item.tableName.toLowerCase().includes(query))
    );
  }, [generatedNodes, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredNodes.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedNodes = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredNodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredNodes, safeCurrentPage]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const handleNodeClick = useCallback((nodeId: string) => {
    onFocusNode?.(nodeId);
  }, [onFocusNode]);

  const getSubcomponentPreview = (node: Node): string => {
    const data = node.data as CompoundNodeData;
    if (!data.subcomponents?.length) return 'Empty';
    
    const firstText = data.subcomponents.find(s => s.type === 'text');
    if (firstText && firstText.type === 'text') {
      const content = firstText.data?.content || '';
      return content.length > 50 ? content.slice(0, 50) + '...' : content;
    }
    
    return `${data.subcomponents.length} components`;
  };

  if (generatedNodes.length === 0) {
    return (
      <div className={cn("bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden", className)} data-testid="node-gallery-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <span className="font-medium text-gray-900 dark:text-gray-100">Node Gallery</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              data-testid="close-gallery"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-2">No generated nodes yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Use "Generate from template" in a Table Node to create nodes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden flex flex-col", className)} data-testid="node-gallery-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          <span className="font-medium text-gray-900 dark:text-gray-100">Node Gallery</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {filteredNodes.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === 'grid' 
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              )}
              data-testid="view-mode-grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 transition-colors",
                viewMode === 'list'
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              )}
              data-testid="view-mode-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              data-testid="close-gallery"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by name, template, or table..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            data-testid="gallery-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4" style={{ maxHeight: '400px' }}>
        {paginatedNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No nodes match your search</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {paginatedNodes.map((item) => (
              <div
                key={item.node.id}
                onClick={() => handleNodeClick(item.node.id)}
                className="group p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all"
                data-testid={`gallery-node-${item.node.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate max-w-[80px]">
                      {item.label}
                    </span>
                  </div>
                  <Focus className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1.5">
                  {getSubcomponentPreview(item.node)}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-[60px]">{item.templateName}</span>
                </div>
                {item.tableName && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                    <Table2 className="w-3 h-3" />
                    <span className="truncate max-w-[60px]">{item.tableName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedNodes.map((item) => (
              <div
                key={item.node.id}
                onClick={() => handleNodeClick(item.node.id)}
                className="group flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all"
                data-testid={`gallery-node-${item.node.id}`}
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {getSubcomponentPreview(item.node)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <FileText className="w-3 h-3" />
                      <span>{item.templateName}</span>
                    </div>
                    {item.tableName && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Table2 className="w-3 h-3" />
                        <span>{item.tableName}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Focus className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {safeCurrentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="gallery-prev-page"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (safeCurrentPage <= 3) {
                  pageNum = i + 1;
                } else if (safeCurrentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = safeCurrentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      "w-7 h-7 text-xs rounded-lg transition-colors",
                      pageNum === safeCurrentPage
                        ? "bg-indigo-500 text-white"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                    )}
                    data-testid={`gallery-page-${pageNum}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="gallery-next-page"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeGalleryPanel;
