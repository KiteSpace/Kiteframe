# Image-to-Workflow Generation Implementation Guide

This guide provides complete code and implementation instructions for creating an AI-powered image analysis system that converts hand-drawn workflow sketches into digital workflow diagrams using OpenAI GPT-4o Vision API.

## 🎯 Overview

The system allows users to:
- Upload images of hand-drawn workflow diagrams
- Get AI analysis with confidence scoring
- Extract nodes, connections, and workflow structure
- Generate digital workflows automatically
- Receive recommendations for improvement

## 📋 Prerequisites

### Dependencies Required

```json
{
  "dependencies": {
    "openai": "^4.0.0",
    "multer": "^1.4.5-lts.1",
    "express": "^4.18.0",
    "express-rate-limit": "^6.0.0"
  },
  "devDependencies": {
    "@types/multer": "^1.4.7"
  }
}
```

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## 🔧 Backend Implementation

### 1. Server Setup (server/routes.ts)

```typescript
import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';

const router = express.Router();

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
});

// Rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: 'Too many AI requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI Image-to-Workflow Analysis endpoint
router.post("/api/ai/analyze-workflow-image", upload.single('image'), aiLimiter, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    if (!openai) {
      return res.status(503).json({ error: "AI service is not available. Please check OpenAI API key configuration." });
    }

    console.log('[Image Analysis] Processing workflow image:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Convert image buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const imageDataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    // Analyze image with GPT-4o Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Latest OpenAI model with vision capabilities
      messages: [
        {
          role: "system",
          content: `You are a workflow diagram analysis expert. Analyze hand-drawn or sketched workflow diagrams and extract:

1. **Confidence Score (0-100)**: How clearly can you identify workflow elements?
2. **Workflow Elements**: Nodes, connections, text labels, decision points
3. **Structure**: Flow direction, branching, parallel processes

Response format (JSON only):
{
  "confidence": 85,
  "analysis": "Description of what you see",
  "nodes": [
    {
      "id": "node1",
      "label": "extracted text",
      "type": "input|process|decision|output|data|api|user|default",
      "position": {"x": 100, "y": 50},
      "description": "inferred purpose"
    }
  ],
  "edges": [
    {
      "id": "edge1", 
      "source": "node1",
      "target": "node2",
      "type": "smoothstep"
    }
  ],
  "recommendations": ["suggestions for workflow improvement"]
}

Only return confidence > 70 if you can clearly identify at least 3 workflow elements.
For confidence < 70, return minimal structure with recommendations.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this workflow diagram and extract the workflow structure. Focus on identifying nodes, connections, and any text labels."
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
      temperature: 0.2 // Lower temperature for more consistent analysis
    });

    const rawContent = response.choices[0].message.content || '{}';
    console.log('[Image Analysis] Raw AI response length:', rawContent.length);

    let analysisResult;
    try {
      analysisResult = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('[Image Analysis] Failed to parse AI response:', parseError);
      return res.status(500).json({ 
        error: "Failed to analyze image", 
        details: "Invalid AI response format" 
      });
    }

    // Validate confidence score
    const confidence = Math.max(0, Math.min(100, analysisResult.confidence || 0));
    
    console.log('[Image Analysis] Analysis completed:', {
      confidence: confidence,
      nodeCount: analysisResult.nodes?.length || 0,
      edgeCount: analysisResult.edges?.length || 0,
      hasRecommendations: (analysisResult.recommendations?.length || 0) > 0
    });

    // Add styling and positioning enhancements
    if (analysisResult.nodes && Array.isArray(analysisResult.nodes)) {
      analysisResult.nodes = analysisResult.nodes.map((node: any, index: number) => {
        // Color scheme based on node type
        const getNodeColors = (nodeType: string) => {
          const colorSchemes = {
            input: { background: '#dcfce7', border: '#22c55e' },
            process: { background: '#dbeafe', border: '#3b82f6' },
            decision: { background: '#fef3c7', border: '#f59e0b' },
            output: { background: '#fce7f3', border: '#ec4899' },
            data: { background: '#f3e8ff', border: '#a855f7' },
            api: { background: '#fee2e2', border: '#ef4444' },
            user: { background: '#f0fdfa', border: '#14b8a6' },
            default: { background: '#f8fafc', border: '#64748b' }
          };
          return colorSchemes[nodeType as keyof typeof colorSchemes] || colorSchemes.default;
        };

        const colors = getNodeColors(node.type || 'default');
        
        return {
          ...node,
          id: node.id || `analyzed-node-${index}`,
          type: "default",
          position: node.position || { x: 100 + (index * 200), y: 100 },
          data: {
            label: node.label || `Step ${index + 1}`,
            description: node.description || '',
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 2
          },
          style: {
            width: 200,
            height: 100,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: '2px',
            borderStyle: 'solid'
          },
          draggable: true,
          selectable: true,
          source: 'image-analysis'
        };
      });
    }

    // Enhance edges and ensure proper source/target matching
    if (analysisResult.edges && Array.isArray(analysisResult.edges)) {
      // Get the actual node IDs from processed nodes
      const nodeIds = (analysisResult.nodes || []).map((node: any, index: number) => 
        node.id || `analyzed-node-${index}`
      );
      
      analysisResult.edges = analysisResult.edges.map((edge: any, index: number) => {
        // Try to map source/target to actual node IDs if they don't exist
        const sourceId = edge.source || nodeIds[0] || `analyzed-node-0`;
        const targetId = edge.target || nodeIds[Math.min(1, nodeIds.length - 1)] || `analyzed-node-1`;
        
        return {
          ...edge,
          id: edge.id || `analyzed-edge-${index}`,
          source: sourceId,
          target: targetId,
          type: edge.type || 'smoothstep',
          animated: true,
          sourceHandle: null,
          targetHandle: null
        };
      });
    }

    res.json({
      success: true,
      confidence,
      canGenerate: confidence >= 90, // Only allow workflow generation if 90%+ confidence
      analysis: analysisResult.analysis || '',
      nodes: analysisResult.nodes || [],
      edges: analysisResult.edges || [],
      recommendations: analysisResult.recommendations || [],
      metadata: {
        originalFileName: req.file.originalname,
        fileSize: req.file.size,
        analysisTimestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Image Analysis] Error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze workflow image', 
      details: error.message 
    });
  }
});

export default router;
```

## 🎨 Frontend Implementation

### 1. Type Definitions

```typescript
// types/ImageAnalysis.ts
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

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  draggable: boolean;
  selectable: boolean;
  source?: string;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated?: boolean;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}
```

### 2. React Component (components/ImageWorkflowUploader.tsx)

```typescript
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, Image, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ImageWorkflowUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkflowGenerated: (nodes: Node[], edges: Edge[]) => void;
}

export function ImageWorkflowUploader({ isOpen, onClose, onWorkflowGenerated }: ImageWorkflowUploaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ImageAnalysisResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, GIF, etc.)');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }

    setError(null);
    setSelectedImage(file);
    setAnalysisResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/ai/analyze-workflow-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const result: ImageAnalysisResult = await response.json();
      setAnalysisResult(result);

      console.log('[Image Upload] Analysis completed:', {
        confidence: result.confidence,
        canGenerate: result.canGenerate,
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length
      });

    } catch (error: any) {
      console.error('[Image Upload] Analysis failed:', error);
      setError(error.message || 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateWorkflow = () => {
    if (analysisResult && analysisResult.canGenerate) {
      console.log('[ImageWorkflowUploader] Generating workflow:', {
        nodeCount: analysisResult.nodes.length,
        edgeCount: analysisResult.edges.length
      });
      onWorkflowGenerated(analysisResult.nodes, analysisResult.edges);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setError(null);
    setIsAnalyzing(false);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-100';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 70) return <AlertTriangle className="w-4 h-4" />;
    return <X className="w-4 h-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            AI Image-to-Workflow Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Upload Area */}
          {!selectedImage && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Upload Workflow Sketch</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Drag and drop an image of your hand-drawn workflow, or click to browse
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Select Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <p className="text-sm text-gray-500 mt-2">
                Supports PNG, JPG, GIF up to 10MB
              </p>
            </div>
          )}

          {/* Selected Image Preview */}
          {selectedImage && imagePreview && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Selected Image</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    setAnalysisResult(null);
                  }}
                >
                  Change Image
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <img
                      src={imagePreview}
                      alt="Workflow sketch"
                      className="w-full max-w-md mx-auto rounded-lg border"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-medium">File: {selectedImage.name}</p>
                      <p className="text-sm text-gray-600">
                        Size: {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    
                    {!analysisResult && !isAnalyzing && (
                      <Button onClick={analyzeImage} className="w-full">
                        Analyze Workflow
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Progress */}
          {isAnalyzing && (
            <Card>
              <CardContent className="py-6">
                <div className="text-center space-y-4">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                  <h3 className="font-medium">Analyzing workflow image...</h3>
                  <p className="text-sm text-gray-600">
                    AI is identifying nodes, connections, and workflow structure
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <div className="space-y-4">
              {/* Confidence Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Analysis Results
                    <Badge className={`flex items-center gap-1 ${getConfidenceColor(analysisResult.confidence)}`}>
                      {getConfidenceIcon(analysisResult.confidence)}
                      {analysisResult.confidence}% Confidence
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Progress value={analysisResult.confidence} className="mb-2" />
                    <p className="text-sm text-gray-600">
                      {analysisResult.analysis}
                    </p>
                  </div>

                  {/* Results Summary */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Nodes detected:</span> {analysisResult.nodes.length}
                    </div>
                    <div>
                      <span className="font-medium">Connections:</span> {analysisResult.edges.length}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Workflow Generation Status */}
              {analysisResult.canGenerate ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>High confidence detected!</strong> The AI can generate a digital workflow 
                    from your sketch with {analysisResult.confidence}% confidence.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Low confidence ({analysisResult.confidence}%)</strong>. 
                    The workflow elements are not clear enough for automatic generation. 
                    Try uploading a clearer image with more distinct nodes and connections.
                  </AlertDescription>
                </Alert>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {analysisResult.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-500 mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {analysisResult?.canGenerate && (
              <Button onClick={generateWorkflow}>
                Generate Workflow ({analysisResult.nodes.length} nodes)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## 🔗 Integration Usage

### 1. In Your Main App Component

```typescript
import { ImageWorkflowUploader } from './components/ImageWorkflowUploader';
import { useState } from 'react';

function App() {
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const handleWorkflowGenerated = (newNodes: Node[], newEdges: Edge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
    console.log('New workflow generated:', { 
      nodeCount: newNodes.length, 
      edgeCount: newEdges.length 
    });
  };

  return (
    <div>
      {/* Trigger Button */}
      <Button onClick={() => setShowImageUploader(true)}>
        Upload Workflow Image
      </Button>

      {/* Image Uploader Modal */}
      <ImageWorkflowUploader
        isOpen={showImageUploader}
        onClose={() => setShowImageUploader(false)}
        onWorkflowGenerated={handleWorkflowGenerated}
      />

      {/* Your workflow canvas/display component */}
      <WorkflowCanvas nodes={nodes} edges={edges} />
    </div>
  );
}
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
npm install openai multer express express-rate-limit
npm install -D @types/multer
```

### 2. Environment Configuration

Create a `.env` file:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Server Setup

Add the image analysis route to your Express server:

```typescript
import imageAnalysisRoutes from './routes/imageAnalysis';

const app = express();
app.use('/api', imageAnalysisRoutes);
```

### 4. UI Components

Make sure you have the required UI components:
- Button, Card, Dialog, Progress, Alert, Badge from your UI library
- Lucide React icons: Upload, Image, AlertTriangle, CheckCircle, X

## 🧪 Testing

### Test Images that Work Well:
- Clear hand-drawn flowcharts with boxes and arrows
- Process diagrams with text labels
- Workflow sketches on white paper
- Digital drawings with distinct shapes

### Test Images that Work Poorly:
- Blurry or low-resolution images
- Complex sketches with overlapping elements
- Images with poor contrast
- Photographs of screens or printed materials

## 🔧 Configuration Options

### Confidence Thresholds

```typescript
// In the server response
canGenerate: confidence >= 90, // Adjust this threshold (70-95 range)
```

### Rate Limiting

```typescript
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Adjust based on your needs
});
```

### File Upload Limits

```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Adjust file size limit
  },
});
```

## 📊 Response Format

The API returns this structure:

```typescript
{
  success: boolean;
  confidence: number; // 0-100
  canGenerate: boolean; // Based on confidence threshold
  analysis: string; // AI description of what it sees
  nodes: Node[]; // Array of detected workflow nodes
  edges: Edge[]; // Array of detected connections
  recommendations: string[]; // Suggestions for improvement
  metadata: {
    originalFileName: string;
    fileSize: number;
    analysisTimestamp: string;
  }
}
```

## 🎨 Styling Enhancements

The system automatically applies color-coded styling based on node types:

- **Input nodes**: Green theme
- **Process nodes**: Blue theme  
- **Decision nodes**: Yellow theme
- **Output nodes**: Pink theme
- **Data nodes**: Purple theme
- **API nodes**: Red theme
- **User nodes**: Teal theme
- **Default nodes**: Gray theme

## 🚦 Error Handling

The implementation includes comprehensive error handling for:
- Missing OpenAI API key
- Invalid file formats
- File size limits
- Network errors
- AI response parsing errors
- Rate limit exceeded

## 📈 Performance Considerations

- Images are processed in memory (not saved to disk)
- Rate limiting prevents abuse
- Base64 encoding for OpenAI Vision API
- Configurable file size limits
- Response compression for large workflows

This complete implementation provides a production-ready image-to-workflow generation system that can be easily integrated into any React application with an Express.js backend.