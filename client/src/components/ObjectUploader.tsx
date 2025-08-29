import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxFileSize?: number;
  onComplete?: (objectPath: string, filename?: string) => void;
  buttonClassName?: string;
  children?: ReactNode;
  accept?: string;
}

/**
 * A file upload component that renders as a button and handles image uploads.
 * 
 * Features:
 * - Simple file input for image selection
 * - Direct upload to object storage via presigned URLs
 * - Shows upload progress and handles errors
 * - Returns the object path for displaying the uploaded image
 * 
 * @param props - Component props
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onComplete - Callback function called when upload is complete with the object path
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 * @param props.accept - File input accept attribute (default: "image/*")
 */
export function ObjectUploader({
  maxFileSize = 10485760, // 10MB default
  onComplete,
  buttonClassName,
  children,
  accept = "image/*"
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxFileSize) {
      toast({
        title: "File too large",
        description: `File size must be less than ${Math.round(maxFileSize / 1024 / 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get upload URL from backend
      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await uploadResponse.json();

      // Upload file directly to object storage
      const uploadFileResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadFileResponse.ok) {
        throw new Error('Failed to upload file');
      }

      // Normalize the object path
      const normalizeResponse = await fetch('/api/images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageURL: uploadURL.split('?')[0], // Remove query parameters
        }),
      });

      if (!normalizeResponse.ok) {
        throw new Error('Failed to process uploaded image');
      }

      const { objectPath } = await normalizeResponse.json();

      toast({
        title: "Upload successful",
        description: "Image uploaded successfully",
      });

      onComplete?.(objectPath, file.name);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        id="file-upload-input"
        disabled={isUploading}
      />
      <label htmlFor="file-upload-input">
        <Button 
          type="button"
          disabled={isUploading}
          className={buttonClassName}
          asChild
        >
          <span style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
            {isUploading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                Uploading...
              </>
            ) : (
              children || (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Image
                </>
              )
            )}
          </span>
        </Button>
      </label>
    </div>
  );
}