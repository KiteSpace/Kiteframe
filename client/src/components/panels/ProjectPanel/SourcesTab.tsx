import { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Plus, Trash2, ExternalLink, FileText, Image, Globe } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import { SOURCES_UPDATED_EVENT } from '@/lib/kiteframe/utils/sourceTracking';

interface Source {
  id: string;
  url: string;
  title: string;
  type: 'link' | 'file' | 'image' | 'figma';
  addedAt: number;
  metadata?: {
    figmaFileKey?: string;
    figmaFileName?: string;
    frameCount?: number;
  };
}

interface SourcesTabProps {
  projectId?: string;
}

export function SourcesTab({ projectId }: SourcesTabProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const storageKey = projectId ? `kiteframe-sources-${projectId}` : 'kiteframe-sources-default';

  const loadSources = useCallback(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setSources(JSON.parse(saved));
      } catch {
        setSources([]);
      }
    } else {
      setSources([]);
    }
  }, [storageKey]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    const handleSourcesUpdated = (event: CustomEvent<{ projectId?: string }>) => {
      if (event.detail.projectId === projectId || (!event.detail.projectId && !projectId)) {
        loadSources();
      }
    };
    
    window.addEventListener(SOURCES_UPDATED_EVENT, handleSourcesUpdated as EventListener);
    return () => {
      window.removeEventListener(SOURCES_UPDATED_EVENT, handleSourcesUpdated as EventListener);
    };
  }, [projectId, loadSources]);


  const detectType = (url: string): Source['type'] => {
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/)) return 'image';
    if (lower.match(/\.(pdf|doc|docx|txt|md|csv|xls|xlsx)(\?|$)/)) return 'file';
    return 'link';
  };

  const extractTitle = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      if (filename && filename.length > 0 && filename !== '/') {
        return decodeURIComponent(filename);
      }
      return urlObj.hostname;
    } catch {
      return url.slice(0, 30);
    }
  };

  const saveSources = useCallback((updatedSources: Source[]) => {
    setSources(updatedSources);
    if (updatedSources.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(updatedSources));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const addSource = () => {
    if (!newUrl.trim()) return;
    
    let url = newUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const source: Source = {
      id: `source-${Date.now()}`,
      url,
      title: extractTitle(url),
      type: detectType(url),
      addedAt: Date.now()
    };

    saveSources([source, ...sources]);
    setNewUrl('');
    setIsAdding(false);
  };

  const removeSource = (id: string) => {
    saveSources(sources.filter(s => s.id !== id));
  };

  const getIcon = (type: Source['type']) => {
    switch (type) {
      case 'figma': return <SiFigma size={14} className="text-purple-500" />;
      case 'image': return <Image size={14} className="text-blue-500" />;
      case 'file': return <FileText size={14} className="text-orange-500" />;
      default: return <Globe size={14} className="text-green-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        {isAdding ? (
          <div className="flex gap-2">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Enter URL..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addSource();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewUrl('');
                }
              }}
              autoFocus
              data-testid="input-source-url"
            />
            <Button 
              size="sm" 
              className="h-8 px-3"
              onClick={addSource}
              data-testid="button-add-source"
            >
              Add
            </Button>
          </div>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-8 text-xs"
            onClick={() => setIsAdding(true)}
            data-testid="button-new-source"
          >
            <Plus size={14} className="mr-1" />
            Add Source
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-4">
            <Link2 size={32} className="mb-2 opacity-50" />
            <p className="text-sm text-center">No sources yet.</p>
            <p className="text-xs text-center mt-1">Add links to reference materials, assets, or documentation.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sources.map(source => (
              <div 
                key={source.id}
                className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                data-testid={`source-${source.id}`}
              >
                {getIcon(source.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{source.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{source.url}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(source.url, '_blank')}
                    data-testid={`button-open-${source.id}`}
                  >
                    <ExternalLink size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeSource(source.id)}
                    data-testid={`button-remove-${source.id}`}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
