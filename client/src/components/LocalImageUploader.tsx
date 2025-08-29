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

/**
 * A local image upload component that stores images in the browser's memory/local storage
 * for privacy. Images are converted to base64 data URLs and can be used directly in the app
 * without uploading to any external service.
 * 
 * @param props - Component props
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onComplete - Callback function called when upload is complete with the base64 data URL
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 * @param props.accept - File input accept attribute (default: "image/*")
 */
export function LocalImageUploader({
  maxFileSize = 10485760, // 10MB default
  onComplete,
  buttonClassName,
  children,
  accept = "image/*"
}: LocalImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
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
      return;
    }

    setIsValid(true);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result && onComplete) {
        onComplete(result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
      
      // Check if dragged items are valid
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const validation = validateFile(files[0]);
        setIsValid(validation.valid);
        setErrorMessage(validation.error || '');
      }
    } else if (e.type === "dragleave") {
      setDragActive(false);
      setIsValid(null);
      setErrorMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
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
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getBorderColor = () => {
    if (!dragActive) return 'border-border';
    if (isValid === true) return 'border-green-500 bg-green-50 dark:bg-green-950/20';
    if (isValid === false) return 'border-red-500 bg-red-50 dark:bg-red-950/20';
    return 'border-primary';
  };

  const getTextColor = () => {
    if (isValid === true) return 'text-green-600 dark:text-green-400';
    if (isValid === false) return 'text-red-600 dark:text-red-400';
    return '';
  };

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
        
        {dragActive && isValid === false && errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50/90 dark:bg-red-950/90 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errorMessage}</p>
          </div>
        )}
        
        {dragActive && isValid === true && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-50/90 dark:bg-green-950/90 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Drop to upload image</p>
          </div>
        )}
      </div>
    </div>
  );
}