import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { parseImportedPRD, readFileAsText, validateImportFile } from '../lib/kiteframe/utils/prdImport';
import type { WorkflowPRD } from '../ai/prdEngine';

interface ImportPRDModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (prd: WorkflowPRD) => void;
  workflowId: string;
  workflowName: string;
}

export function ImportPRDModal({ 
  isOpen, 
  onClose, 
  onImport, 
  workflowId, 
  workflowName 
}: ImportPRDModalProps) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImportFile(file);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    try {
      const content = await readFileAsText(file);
      setInputText(content);
    } catch {
      toast({
        title: 'Failed to read file',
        description: 'Could not read the selected file.',
        variant: 'destructive'
      });
    }
  };

  const handleImport = () => {
    if (!inputText.trim()) {
      toast({
        title: 'No content',
        description: 'Please paste text or upload a file.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      const result = parseImportedPRD(inputText, workflowId, workflowName);
      
      if (!result.success || !result.prd) {
        toast({
          title: 'Import failed',
          description: result.error || 'Could not parse the content.',
          variant: 'destructive'
        });
        return;
      }

      onImport(result.prd);
      toast({
        title: 'PRD imported',
        description: `Imported ${result.prd.sections.length} section(s) successfully.`
      });
      
      handleClose();
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setInputText('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px]" data-testid="import-prd-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            Import PRD
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-file-btn"
            >
              <Upload size={14} className="mr-2" />
              Upload .txt or .md
            </Button>
            {selectedFile && (
              <span className="text-sm text-muted-foreground">
                {selectedFile.name}
              </span>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Or paste your PRD content below:
          </div>

          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your PRD markdown or text here...

Example format:
## Overview
Description of the workflow...

## Requirements
- Requirement 1
- Requirement 2

## User Flow
Step-by-step user flow..."
            className="min-h-[250px] font-mono text-sm"
            data-testid="import-textarea"
          />

          <div className="text-xs text-muted-foreground">
            Headings (## ) will be parsed as sections. Content without headings will be imported as a single section.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isProcessing}
            data-testid="cancel-import-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isProcessing || !inputText.trim()}
            data-testid="confirm-import-btn"
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
