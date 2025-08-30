import { useState } from 'react';
import type { Node, Edge } from '../lib/kiteframe/types';
import { ObjectUploader } from '@/components/ObjectUploader';
import { LocalImageUploader } from '@/components/LocalImageUploader';
import { 
  ArrowRight, 
  Cog, 
  HelpCircle, 
  ArrowLeft, 
  Bot, 
  Image,
  Maximize2,
  Trash2,
  Download,
  Upload,
  Link,
  X,
  Sparkles,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround
} from 'lucide-react';

interface SidebarProps {
  selectedNode?: Node;
  selectedEdge?: Edge;
  onCreateNode: (type: string) => void;
  onFitView: () => void;
  onClearCanvas: () => void;
  onExport: () => void;
  onImport: () => void;
  onNodeUpdate: (nodeId: string, updates: Partial<Node>) => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onDeselectNode: () => void;
  onImageUpload?: (nodeId: string, objectPath: string, filename?: string) => void;
  onImageUrl?: (nodeId: string, url: string) => void;
  showImageModal?: string | null;
  onOpenImageModal?: (nodeId: string) => void;
  onCloseImageModal?: () => void;
  onOpenAiGenerator?: () => void;
}

export function Sidebar({
  selectedNode,
  selectedEdge,
  onCreateNode,
  onFitView,
  onClearCanvas,
  onExport,
  onImport,
  onNodeUpdate,
  onEdgeUpdate,
  onDeselectNode,
  onImageUpload,
  onImageUrl,
  showImageModal,
  onOpenImageModal,
  onCloseImageModal,
  onOpenAiGenerator
}: SidebarProps) {
  const [showUrlInput, setShowUrlInput] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  // showImageModal is now passed as a prop

  const handleUrlSubmit = (nodeId: string) => {
    if (urlInputValue.trim()) {
      onImageUrl?.(nodeId, urlInputValue.trim());
      setShowUrlInput(null);
      setUrlInputValue('');
    }
  };

  const handleDeleteImage = (nodeId: string) => {
    onNodeUpdate(nodeId, {
      data: { ...selectedNode?.data, src: undefined, filename: undefined, sourceUrl: undefined, sourceType: undefined }
    });
    setShowDeleteConfirm(null);
  };
  const nodeTypes = [
    { type: 'input', icon: ArrowRight, color: 'text-blue-500', label: 'Input' },
    { type: 'process', icon: Cog, color: 'text-green-500', label: 'Process' },
    { type: 'condition', icon: HelpCircle, color: 'text-yellow-500', label: 'Condition' },
    { type: 'output', icon: ArrowLeft, color: 'text-red-500', label: 'Output' },
    { type: 'ai', icon: Bot, color: 'text-purple-500', label: 'AI Task' },
    { type: 'image', icon: Image, color: 'text-indigo-500', label: 'Image' }
  ];

  return (
    <aside className="w-64 p-4 bg-card border-r border-border shadow-sm" data-testid="sidebar">
      <div className="space-y-6">
        {selectedNode ? (
          // Properties view when node is selected
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Node Properties</h3>
              <button
                onClick={onDeselectNode}
                className="p-1 rounded-md hover:bg-accent transition-colors"
                data-testid="button-close-properties"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3" data-testid="node-properties">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Label</label>
                  <input
                    type="text"
                    value={selectedNode.data?.label || ''}
                    onChange={(e) => onNodeUpdate(selectedNode.id, {
                      data: { ...selectedNode.data, label: e.target.value }
                    })}
                    className="w-full p-2 text-xs border border-border rounded bg-background"
                    data-testid="input-node-label"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <textarea
                    value={selectedNode.data?.description || ''}
                    onChange={(e) => onNodeUpdate(selectedNode.id, {
                      data: { ...selectedNode.data, description: e.target.value }
                    })}
                    className="w-full p-2 text-xs border border-border rounded bg-background"
                    rows={3}
                    placeholder="Enter description..."
                    data-testid="textarea-node-description"
                  />
                </div>
                {/* Width and Height controls for image nodes */}
                {selectedNode.type === 'image' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Width</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="100"
                          max="480"
                          value={selectedNode.width || 200}
                          onChange={(e) => onNodeUpdate(selectedNode.id, {
                            width: parseInt(e.target.value)
                          })}
                          className="flex-1"
                          data-testid="slider-node-width"
                        />
                        <input
                          type="number"
                          min="100"
                          max="480"
                          value={selectedNode.width || 200}
                          onChange={(e) => onNodeUpdate(selectedNode.id, {
                            width: Math.min(480, Math.max(100, parseInt(e.target.value) || 200))
                          })}
                          className="w-16 p-1 text-xs border border-border rounded bg-background"
                          data-testid="input-node-width"
                        />
                        <button
                          onClick={() => {
                            // Auto-size width based on image aspect ratio
                            if (selectedNode.data?.src) {
                              const img = new window.Image();
                              img.onload = () => {
                                const maxWidth = 300;
                                const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
                                const autoWidth = Math.round(Math.min(img.naturalWidth * scale, 480));
                                onNodeUpdate(selectedNode.id, { width: Math.max(200, autoWidth + 20) });
                              };
                              img.src = selectedNode.data.src;
                            }
                          }}
                          className="p-1.5 border border-border rounded hover:bg-accent transition-colors"
                          title="Auto-size width"
                          data-testid="button-auto-width"
                        >
                          <AlignHorizontalSpaceAround size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Height</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="100"
                          max="480"
                          value={selectedNode.height || 100}
                          onChange={(e) => onNodeUpdate(selectedNode.id, {
                            height: parseInt(e.target.value)
                          })}
                          className="flex-1"
                          data-testid="slider-node-height"
                        />
                        <input
                          type="number"
                          min="100"
                          max="480"
                          value={selectedNode.height || 100}
                          onChange={(e) => onNodeUpdate(selectedNode.id, {
                            height: Math.min(480, Math.max(100, parseInt(e.target.value) || 100))
                          })}
                          className="w-16 p-1 text-xs border border-border rounded bg-background"
                          data-testid="input-node-height"
                        />
                        <button
                          onClick={() => {
                            // Auto-size height based on image aspect ratio
                            if (selectedNode.data?.src) {
                              const img = new window.Image();
                              img.onload = () => {
                                const maxHeight = 250;
                                const headerHeight = 30;
                                const scale = img.naturalHeight > maxHeight ? maxHeight / img.naturalHeight : 1;
                                const autoHeight = Math.round(Math.min(img.naturalHeight * scale, 480));
                                onNodeUpdate(selectedNode.id, { height: autoHeight + headerHeight + 20 });
                              };
                              img.src = selectedNode.data.src;
                            }
                          }}
                          className="p-1.5 border border-border rounded hover:bg-accent transition-colors"
                          title="Auto-size height"
                          data-testid="button-auto-height"
                        >
                          <AlignVerticalSpaceAround size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Width</label>
                      <input
                        type="number"
                        value={selectedNode.width || 200}
                        onChange={(e) => onNodeUpdate(selectedNode.id, {
                          width: parseInt(e.target.value) || 200
                        })}
                        className="w-full p-2 text-xs border border-border rounded bg-background"
                        data-testid="input-node-width"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Height</label>
                      <input
                        type="number"
                        value={selectedNode.height || 100}
                        onChange={(e) => onNodeUpdate(selectedNode.id, {
                          height: parseInt(e.target.value) || 100
                        })}
                        className="w-full p-2 text-xs border border-border rounded bg-background"
                        data-testid="input-node-height"
                      />
                    </div>
                  </div>
                )}
                
                {/* Image upload section for image nodes */}
                {selectedNode.type === 'image' && (
                  <div className="space-y-3 mt-4 pt-3 border-t border-border">
                    <label className="block text-xs font-medium">Image</label>
                    
                    {selectedNode.data?.src ? (
                      <div className="space-y-2">
                        <div className="relative group border border-border rounded p-2 bg-background">
                          <img 
                            src={selectedNode.data.src} 
                            alt="Node image" 
                            className={`w-full h-20 rounded ${
                              selectedNode.data?.imageSize === 'fill' ? 'object-cover' :
                              selectedNode.data?.imageSize === 'fit' ? 'object-scale-down' :
                              'object-contain'
                            }`}
                          />
                          <button
                            onClick={() => setShowDeleteConfirm(selectedNode.id)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200"
                            title="Delete image"
                          >
                            <Trash2 size={12} />
                          </button>
                          {selectedNode.data?.filename && (
                            <div className="text-xs text-muted-foreground mt-1">
                              File: {selectedNode.data.filename}
                            </div>
                          )}
                          {selectedNode.data?.sourceUrl && (
                            <div className="text-xs text-muted-foreground mt-1">
                              URL: {selectedNode.data.sourceUrl}
                            </div>
                          )}
                        </div>
                        
                        {/* Image Size Toggle Buttons */}
                        <div>
                          <label className="block text-xs font-medium mb-1">Image Size</label>
                          <div className="flex gap-1">
                            <button
                              onClick={() => onNodeUpdate(selectedNode.id, {
                                data: { ...selectedNode.data, imageSize: 'fit' }
                              })}
                              className={`flex-1 text-xs px-2 py-1.5 border rounded transition-colors ${
                                selectedNode.data?.imageSize === 'fit' || !selectedNode.data?.imageSize
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-border hover:bg-accent'
                              }`}
                              data-testid="button-image-fit"
                            >
                              Fit
                            </button>
                            <button
                              onClick={() => onNodeUpdate(selectedNode.id, {
                                data: { ...selectedNode.data, imageSize: 'contain' }
                              })}
                              className={`flex-1 text-xs px-2 py-1.5 border rounded transition-colors ${
                                selectedNode.data?.imageSize === 'contain'
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-border hover:bg-accent'
                              }`}
                              data-testid="button-image-contain"
                            >
                              Contain
                            </button>
                            <button
                              onClick={() => onNodeUpdate(selectedNode.id, {
                                data: { ...selectedNode.data, imageSize: 'fill' }
                              })}
                              className={`flex-1 text-xs px-2 py-1.5 border rounded transition-colors ${
                                selectedNode.data?.imageSize === 'fill'
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-border hover:bg-accent'
                              }`}
                              data-testid="button-image-fill"
                            >
                              Fill
                            </button>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => onOpenImageModal?.(selectedNode.id)}
                          className="w-full text-xs p-2 border border-border rounded bg-background hover:bg-accent transition-colors flex items-center justify-center"
                        >
                          <Image size={12} className="mr-1" />
                          Change Image
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onOpenImageModal?.(selectedNode.id)}
                        className="w-full text-xs p-3 border-2 border-dashed border-border rounded bg-background hover:bg-accent transition-colors flex items-center justify-center"
                      >
                        <Image size={14} className="mr-2" />
                        Add Image
                      </button>
                    )}
                    
                    {/* URL Input Modal */}
                    {showUrlInput === selectedNode.id && (
                      <div className="space-y-2 p-3 border border-border rounded bg-muted">
                        <label className="block text-xs font-medium">Image URL</label>
                        <input
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          className="w-full p-2 text-xs border border-border rounded bg-background"
                          value={urlInputValue}
                          onChange={(e) => setUrlInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUrlSubmit(selectedNode.id);
                            } else if (e.key === 'Escape') {
                              setShowUrlInput(null);
                              setUrlInputValue('');
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUrlSubmit(selectedNode.id)}
                            className="flex-1 text-xs p-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                            disabled={!urlInputValue.trim()}
                          >
                            Add
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
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Default view when no node or edge is selected
          <>
            {/* AI Generator Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">AI Assistant</h3>
              <button
                className="w-full px-3 py-2.5 text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md hover:from-purple-600 hover:to-blue-600 transition-all duration-200 flex items-center justify-center gap-2"
                onClick={onOpenAiGenerator}
                data-testid="button-ai-generator"
              >
                <Sparkles size={16} />
                AI Generate Workflow
              </button>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold mb-3">Node Types</h3>
              <div className="grid grid-cols-2 gap-2">
                {nodeTypes.map((nodeType) => {
                  const IconComponent = nodeType.icon;
                  return (
                    <div
                      key={nodeType.type}
                      className="p-3 border border-border rounded-md cursor-pointer text-center hover:bg-accent hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
                      onClick={() => onCreateNode(nodeType.type)}
                      data-testid={`node-type-${nodeType.type}`}
                    >
                      <IconComponent className={`${nodeType.color} mb-1 mx-auto`} size={20} />
                      <div className="text-xs font-medium">{nodeType.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left flex items-center gap-2"
                  onClick={onFitView}
                  data-testid="button-fit-view"
                >
                  <Maximize2 size={14} />
                  Fit to View
                </button>
                <button
                  className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left flex items-center gap-2"
                  onClick={onClearCanvas}
                  data-testid="button-clear-canvas"
                >
                  <Trash2 size={14} />
                  Clear Canvas
                </button>
                <button
                  className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left flex items-center gap-2"
                  onClick={onExport}
                  data-testid="button-export"
                >
                  <Download size={14} />
                  Export
                </button>
                <button
                  className="w-full p-2 text-sm border border-border rounded-md hover:bg-accent transition-colors text-left flex items-center gap-2"
                  onClick={onImport}
                  data-testid="button-import"
                >
                  <Upload size={14} />
                  Import
                </button>
              </div>
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <Trash2 className="text-red-600 dark:text-red-400" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Delete Image</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to remove this image from the node?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 text-xs p-2 border border-border rounded hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteImage(showDeleteConfirm)}
                  className="flex-1 text-xs p-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Image Modal */}
        {showImageModal && (
          <ImageModal
            nodeId={showImageModal}
            onClose={onCloseImageModal || (() => {})}
            onImageUpload={onImageUpload}
            onImageUrl={onImageUrl}
          />
        )}
      </div>
    </aside>
  );
}

// Enhanced Image Modal Component
interface ImageModalProps {
  nodeId: string;
  onClose: () => void;
  onImageUpload?: (nodeId: string, objectPath: string, filename?: string) => void;
  onImageUrl?: (nodeId: string, url: string) => void;
}

function ImageModal({ nodeId, onClose, onImageUpload, onImageUrl }: ImageModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlValue, setUrlValue] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateUrl = async (url: string) => {
    if (!url.trim()) {
      setPreviewUrl(null);
      setValidationError(null);
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Create image element to test if URL is valid
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });

      setPreviewUrl(url);
    } catch (error) {
      setValidationError('Unable to load image from this URL');
      setPreviewUrl(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setUrlValue(url);
    // Debounce validation
    setTimeout(() => validateUrl(url), 500);
  };

  const handleUrlSubmit = () => {
    if (previewUrl && onImageUrl) {
      onImageUrl(nodeId, previewUrl);
      onClose();
    }
  };



  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full h-[600px] overflow-y-auto mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Image</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border mb-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload size={14} className="inline mr-2" />
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 px-4 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link size={14} className="inline mr-2" />
            Image URL
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an image file from your computer. Images are stored locally in your browser for privacy.
            </p>
            <div className="h-48">
              <LocalImageUploader
                onComplete={(imageUrl, filename) => {
                  if (onImageUpload) {
                    onImageUpload(nodeId, imageUrl, filename);
                    onClose();
                  }
                }}
                buttonClassName="w-full h-full"
                accept="image/*"
              >
                <div className="flex flex-col items-center justify-center gap-3 h-full border-2 border-dashed border-border rounded-lg hover:border-primary transition-colors group">
                  <Upload size={32} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop image here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB • Stored locally for privacy</p>
                  </div>
                </div>
              </LocalImageUploader>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                className="w-full p-3 border border-border rounded bg-background"
                value={urlValue}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
              {isValidating && (
                <p className="text-xs text-muted-foreground mt-1">Validating image...</p>
              )}
              {validationError && (
                <p className="text-xs text-red-500 mt-1">{validationError}</p>
              )}
            </div>

            {/* URL Preview */}
            {previewUrl && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">Preview</label>
                <div className="border border-border rounded p-2 bg-muted">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full max-h-32 object-contain rounded"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleUrlSubmit}
              disabled={!previewUrl || isValidating}
              className={`w-full p-3 rounded transition-colors ${
                previewUrl && !isValidating
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isValidating ? 'Validating...' : 'Use This Image'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
