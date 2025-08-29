import { useState } from 'react';
import { X, Upload, AlertTriangle, Link } from 'lucide-react';
import { ObjectUploader } from '@/components/ObjectUploader';

interface MissingImage {
  nodeId: string;
  filename: string | null;
  sourceUrl: string | null;
  sourceType: string;
}

interface MissingImagesModalProps {
  missingImages: MissingImage[];
  onImageReplace: (nodeId: string, objectPath: string, filename?: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export function MissingImagesModal({
  missingImages,
  onImageReplace,
  onComplete,
  onCancel
}: MissingImagesModalProps) {
  const [showUrlInput, setShowUrlInput] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState('');

  const handleUrlSubmit = (nodeId: string) => {
    if (urlInputValue.trim()) {
      onImageReplace(nodeId, urlInputValue.trim());
      setShowUrlInput(null);
      setUrlInputValue('');
    }
  };

  const canComplete = missingImages.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} />
            <h2 className="text-lg font-semibold">Missing Images Detected</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-accent rounded"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          The imported workflow contains {missingImages.length} missing image{missingImages.length > 1 ? 's' : ''}. 
          Please provide replacement images to complete the import.
        </p>

        <div className="space-y-4">
          {missingImages.map((missing) => (
            <div key={missing.nodeId} className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium">Image Node: {missing.nodeId}</h3>
                  {missing.filename && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Original file: {missing.filename}
                    </p>
                  )}
                  {missing.sourceUrl && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Original URL: {missing.sourceUrl}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Source type: {missing.sourceType}
                  </p>
                </div>
              </div>

              {showUrlInput === missing.nodeId ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium">Replacement Image URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    className="w-full p-2 text-xs border border-border rounded bg-background"
                    value={urlInputValue}
                    onChange={(e) => setUrlInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUrlSubmit(missing.nodeId);
                      } else if (e.key === 'Escape') {
                        setShowUrlInput(null);
                        setUrlInputValue('');
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUrlSubmit(missing.nodeId)}
                      className="flex-1 text-xs p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                      disabled={!urlInputValue.trim()}
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => {
                        setShowUrlInput(null);
                        setUrlInputValue('');
                      }}
                      className="flex-1 text-xs p-1.5 border border-border rounded hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <ObjectUploader
                    onComplete={(objectPath, filename) => onImageReplace(missing.nodeId, objectPath, filename)}
                    buttonClassName="flex-1 text-xs"
                  >
                    <Upload size={12} className="mr-1" />
                    Upload Replacement
                  </ObjectUploader>
                  <button
                    onClick={() => setShowUrlInput(missing.nodeId)}
                    className="flex-1 text-xs p-2 border border-border rounded bg-background hover:bg-accent transition-colors flex items-center justify-center"
                  >
                    <Link size={12} className="mr-1" />
                    Use URL
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 p-2 text-sm border border-border rounded hover:bg-accent transition-colors"
          >
            Cancel Import
          </button>
          <button
            onClick={onComplete}
            disabled={!canComplete}
            className={`flex-1 p-2 text-sm rounded transition-colors ${
              canComplete
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {canComplete ? 'Complete Import' : `${missingImages.length} images remaining`}
          </button>
        </div>
      </div>
    </div>
  );
}