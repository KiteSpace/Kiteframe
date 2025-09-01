import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface LocalImageUploaderProps {
  maxFileSize?: number;
  onComplete?: (imageUrl: string, filename?: string) => void;
  buttonClassName?: string;
  children: ReactNode;
  accept?: string;
}

interface PreviewState {
  imageUrl: string;
  filename: string;
  fileSize: number;
}

/**
 * A local image upload component that stores images in the browser's memory/local storage
 * for privacy. Images are converted to base64 data URLs and can be used directly in the app
 * without uploading to any external service.
 */
export function LocalImageUploader({
  maxFileSize = 10485760, // 10MB default
  onComplete,
  buttonClassName,
  children,
  accept = "image/*"
}: LocalImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [dragValidationState, setDragValidationState] = useState<'valid' | 'invalid' | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'Please select a valid image file' };
    }
    
    if (file.size > maxFileSize) {
      const sizeMB = Math.round(maxFileSize / 1024 / 1024);
      return { valid: false, error: `File size must be less than ${sizeMB}MB` };
    }
    
    return { valid: true };
  };

  const processFile = (file: File) => {
    const validation = validateFile(file);
    
    if (!validation.valid) {
      setIsValid(false);
      setErrorMessage(validation.error || 'Invalid file');
      setTimeout(() => {
        setIsValid(null);
        setErrorMessage('');
      }, 3000);
      return;
    }

    setIsValid(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setPreview({
          imageUrl: result,
          filename: file.name,
          fileSize: file.size
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => {
    if (preview && onComplete) {
      onComplete(preview.imageUrl, preview.filename);
      setPreview(null);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setIsValid(null);
    setErrorMessage('');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
      
      // Real-time validation during drag
      // Ensure e.target is an HTMLElement before calling closest()
      const targetElement = e.target as HTMLElement;
      if (targetElement && typeof targetElement.closest === 'function') {
        const nodeElement = targetElement.closest('[data-node-id]');
        if (nodeElement && nodeElement.hasAttribute('data-node-id')) {
          // Additional validation logic can go here if needed
        }
      }
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const validation = validateFile(file);
        setDragValidationState(validation.valid ? 'valid' : 'invalid');
        setErrorMessage(validation.error || '');
      } else if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        // Files are being dragged but we can't access them yet
        setDragValidationState(null);
        setErrorMessage('');
      }
    } else if (e.type === "dragleave") {
      // Only reset if we're leaving the main container
      const rect = e.currentTarget.getBoundingClientRect();
      const isOutside = e.clientX < rect.left || e.clientX > rect.right || 
                       e.clientY < rect.top || e.clientY > rect.bottom;
      if (isOutside) {
        setDragActive(false);
        setDragValidationState(null);
        setErrorMessage('');
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragValidationState(null);
    setErrorMessage('');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClick = () => {
    if (!preview) {
      fileInputRef.current?.click();
    }
  };

  const getBorderColor = () => {
    if (!dragActive) return 'border-border';
    
    // Real-time validation colors during drag
    if (dragValidationState === 'valid') return 'border-green-500 bg-green-50 dark:bg-green-950/20';
    if (dragValidationState === 'invalid') return 'border-border'; // Only text color for invalid, no border/bg change
    
    // Default drag state (before validation)
    return 'border-primary bg-primary/5';
  };

  const getTextColor = () => {
    // Real-time validation colors during drag
    if (dragValidationState === 'valid') return 'text-green-600 dark:text-green-400';
    if (dragValidationState === 'invalid') return 'text-red-600 dark:text-red-400';
    
    // Final validation after drop (for error display)
    if (isValid === false) return 'text-red-600 dark:text-red-400';
    
    return '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="border rounded-lg overflow-hidden">
          <img 
            src={preview.imageUrl} 
            alt="Preview" 
            className="w-full h-48 object-contain bg-gray-50 dark:bg-gray-900"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          <p><strong>File:</strong> {preview.filename}</p>
          <p><strong>Size:</strong> {formatFileSize(preview.fileSize)}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleConfirm} className="flex-1">
            Use This Image
          </Button>
          <Button onClick={handleCancel} variant="outline" className="flex-1">
            Choose Different
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInput}
        className="hidden"
      />
      
      <div
        onClick={handleClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`cursor-pointer transition-all duration-200 ${buttonClassName} ${getBorderColor()}`}
      >
        <div className={getTextColor()}>
          {children}
        </div>
        
        {dragActive && dragValidationState === 'invalid' && errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errorMessage}</p>
          </div>
        )}
        
        {dragActive && isValid === true && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-50/90 dark:bg-green-950/90 rounded-lg z-10">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Drop to upload image</p>
          </div>
        )}
        
        {dragActive && isValid === null && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg z-10">
            <p className="text-sm text-primary font-medium">Drop image here</p>
          </div>
        )}
      </div>
    </div>
  );
}