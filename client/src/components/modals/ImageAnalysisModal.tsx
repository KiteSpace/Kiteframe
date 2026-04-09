import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { 
  Upload, 
  Loader2, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertTriangle, 
  X,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  Workflow
} from 'lucide-react';

type ModalStage = 'upload' | 'preview' | 'analyzing' | 'results';

interface ImageAnalysisResult {
  success: boolean;
  confidence: number;
  canGenerate: boolean;
  analysis: string;
  nodes: Node[];
  edges: Edge[];
  recommendations: string[];
  metadata: {
    originalFileName: string;
    fileSize: number;
    analysisTimestamp: string;
  };
}

interface ImageAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (workflow: { nodes: Node[], edges: Edge[] }) => void;
  onAddDetails: (analysisContext: { 
    imagePreview: string; 
    analysis: string; 
    nodes: Node[]; 
    edges: Edge[];
    recommendations: string[];
  }) => void;
}

export function ImageAnalysisModal({ 
  isOpen, 
  onClose, 
  onGenerate,
  onAddDetails 
}: ImageAnalysisModalProps) {
  const [stage, setStage] = useState<ModalStage>('upload');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setStage('upload');
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    setDragActive(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, GIF, etc.)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }

    setError(null);
    setSelectedImage(file);
    setAnalysisResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
      setStage('preview');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleChangeImage = useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    setStage('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const analyzeImage = useCallback(async () => {
    if (!selectedImage) return;

    setStage('analyzing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/ai/analyze-workflow-image', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
      }

      const result: ImageAnalysisResult = await response.json();
      setAnalysisResult(result);
      setStage('results');

    } catch (err: any) {
      console.error('Image analysis error:', err);
      setError(err.message || 'Failed to analyze image');
      setStage('preview');
      toast({
        title: "Analysis Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  }, [selectedImage, toast]);

  const handleContinue = useCallback(() => {
    if (!analysisResult || !analysisResult.canGenerate) {
      toast({
        title: "Cannot Generate",
        description: "The analysis confidence is too low to generate a workflow.",
        variant: "destructive"
      });
      return;
    }

    onGenerate({
      nodes: analysisResult.nodes,
      edges: analysisResult.edges
    });
    handleClose();
  }, [analysisResult, onGenerate, handleClose, toast]);

  const handleAddDetails = useCallback(() => {
    if (!analysisResult || !imagePreview) return;

    onAddDetails({
      imagePreview,
      analysis: analysisResult.analysis,
      nodes: analysisResult.nodes,
      edges: analysisResult.edges,
      recommendations: analysisResult.recommendations
    });
    handleClose();
  }, [analysisResult, imagePreview, onAddDetails, handleClose]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 dark:text-green-400';
    if (confidence >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  const getConfidenceBgColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500/20';
    if (confidence >= 60) return 'bg-amber-500/20';
    return 'bg-red-500/20';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-blue-500" />
            Analyze Image for Workflow
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded font-medium">Early Access</span>
          </DialogTitle>
          <DialogDescription>
            Upload a workflow diagram image for AI analysis
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Stage */}
          {stage === 'upload' && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="image-drop-zone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                  data-testid="image-file-input"
                />
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-1">
                  Drop an image here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PNG, JPG, GIF (max 10MB)
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Tips for best results:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use clear, high-contrast workflow diagrams</li>
                  <li>• Hand-drawn or digital flowcharts work well</li>
                  <li>• Include labeled boxes/shapes for nodes</li>
                  <li>• Show connections with arrows between steps</li>
                </ul>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Preview Stage */}
          {stage === 'preview' && imagePreview && (
            <div className="space-y-4">
              <div className="relative border rounded-lg overflow-hidden bg-muted/20">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-[300px] w-full object-contain"
                />
                <button
                  onClick={handleChangeImage}
                  className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background rounded-full transition-colors"
                  data-testid="button-change-image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-sm text-muted-foreground text-center">
                {selectedImage?.name} ({(selectedImage?.size || 0 / 1024).toFixed(1)} KB)
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleChangeImage}
                  className="flex-1"
                  data-testid="button-change-image-alt"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Change Image
                </Button>
                <Button
                  onClick={analyzeImage}
                  className="flex-1"
                  data-testid="button-analyze"
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Analyze
                </Button>
              </div>
            </div>
          )}

          {/* Analyzing Stage */}
          {stage === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Analyzing your image...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a few seconds
                </p>
              </div>
            </div>
          )}

          {/* Results Stage */}
          {stage === 'results' && analysisResult && (
            <div className="space-y-4">
              {/* Image thumbnail and confidence */}
              <div className="flex gap-4">
                {imagePreview && (
                  <div className="w-24 h-24 border rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={imagePreview}
                      alt="Analyzed"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">Confidence:</span>
                    <span className={`px-2 py-0.5 rounded text-sm font-medium ${getConfidenceBgColor(analysisResult.confidence)} ${getConfidenceColor(analysisResult.confidence)}`}>
                      {getConfidenceLabel(analysisResult.confidence)} ({analysisResult.confidence}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{analysisResult.nodes.length} nodes detected</span>
                    <span>•</span>
                    <span>{analysisResult.edges.length} connections</span>
                  </div>
                </div>
              </div>

              {/* Analysis description */}
              <div className="bg-muted/30 rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Analysis Summary
                </h4>
                <p className="text-sm text-muted-foreground">{analysisResult.analysis}</p>
              </div>

              {/* Workflow steps */}
              {analysisResult.nodes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Detected Workflow Steps:</h4>
                  <ScrollArea className="h-[120px]">
                    <div className="space-y-1.5">
                      {analysisResult.nodes.map((node, index) => (
                        <div 
                          key={node.id} 
                          className="flex items-center gap-2 text-sm p-2 bg-muted/20 rounded"
                        >
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </span>
                          <span className="font-medium">{node.data?.label || 'Untitled'}</span>
                          {node.data?.description && (
                            <span className="text-muted-foreground truncate flex-1">
                              — {node.data.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Low confidence warning */}
              {analysisResult.confidence < 60 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    The confidence is low. Consider using "Add Details" to refine the analysis with KiteAI.
                  </AlertDescription>
                </Alert>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={handleChangeImage}
                  data-testid="button-change-image-results"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Change Image
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAddDetails}
                  data-testid="button-add-details"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Details
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={!analysisResult.canGenerate}
                  className="ml-auto"
                  data-testid="button-continue"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
