import React, { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, ExternalLink, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageUpload?: (file: File) => Promise<string>;
  onImageUrlSet?: (url: string) => void;
  isUploading?: boolean;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  onImageUpload,
  onImageUrlSet,
  isUploading = false
}) => {
  const [urlValue, setUrlValue] = useState('');
  const [activeTab, setActiveTab] = useState('upload');
  const [urlError, setUrlError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    setUrlValue('');
    setUrlError('');
    setActiveTab('upload');
    onClose();
  }, [onClose]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onImageUpload) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Please select an image file');
      return;
    }

    // Validate file size (250KB max)
    if (file.size > 256000) {
      console.error('File size must be less than 250KB');
      return;
    }

    try {
      await onImageUpload(file);
      handleClose();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      // Reset input
      event.target.value = '';
    }
  }, [onImageUpload, handleClose]);

  const handleUrlSubmit = useCallback(() => {
    const url = urlValue.trim();
    
    if (!url) {
      setUrlError('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setUrlError('Please enter a valid URL');
      return;
    }

    if (!url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) && !url.includes('data:image')) {
      setUrlError('URL should point to an image file');
      return;
    }

    setUrlError('');
    
    if (onImageUrlSet) {
      onImageUrlSet(url);
      handleClose();
    }
  }, [urlValue, onImageUrlSet, handleClose]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleUrlSubmit();
    }
  }, [handleUrlSubmit]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md !z-[1000]" style={{ zIndex: 1000 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Add Image
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to add an image to your node.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              From URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Image File</Label>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full"
                  data-testid="modal-upload-button"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Choose File'}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Supported formats: JPG, PNG, GIF, WebP, SVG (max 250KB)
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                type="url"
                value={urlValue}
                onChange={(e) => {
                  setUrlValue(e.target.value);
                  setUrlError('');
                }}
                onKeyDown={handleUrlKeyDown}
                placeholder="https://example.com/image.jpg"
                data-testid="modal-url-input"
              />
              {urlError && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {urlError}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleUrlSubmit} 
                disabled={!urlValue.trim()}
                className="flex-1"
                data-testid="modal-url-submit"
              >
                Add Image
              </Button>
              <Button 
                variant="outline" 
                onClick={handleClose}
                data-testid="modal-cancel"
              >
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Upload image file"
        />
      </DialogContent>
    </Dialog>
  );
};