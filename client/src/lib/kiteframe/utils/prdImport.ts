import type { WorkflowPRD, PRDSection } from '../../../ai/prdEngine';

export interface ImportResult {
  success: boolean;
  prd?: WorkflowPRD;
  error?: string;
}

export function parseImportedPRD(
  inputText: string,
  workflowId: string,
  workflowName: string
): ImportResult {
  if (!inputText || inputText.trim().length === 0) {
    return { success: false, error: 'No content provided' };
  }
  
  const trimmedText = inputText.trim();
  const sections: PRDSection[] = [];
  
  const headingPattern = /^##\s+(.+)$/gm;
  const matches: { title: string; startIndex: number }[] = [];
  
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(trimmedText)) !== null) {
    matches.push({
      title: match[1].trim(),
      startIndex: match.index
    });
  }
  
  const usedIds = new Set<string>();
  
  if (matches.length === 0) {
    sections.push({
      id: 'imported',
      title: 'Imported PRD',
      content: trimmedText
    });
  } else {
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      const contentStartIndex = currentMatch.startIndex + trimmedText.slice(currentMatch.startIndex).indexOf('\n') + 1;
      const contentEndIndex = nextMatch ? nextMatch.startIndex : trimmedText.length;
      
      const content = trimmedText.slice(contentStartIndex, contentEndIndex).trim();
      let sectionId = generateSectionId(currentMatch.title);
      
      let suffix = 1;
      const baseId = sectionId;
      while (usedIds.has(sectionId)) {
        sectionId = `${baseId}-${suffix}`;
        suffix++;
      }
      usedIds.add(sectionId);
      
      sections.push({
        id: sectionId,
        title: currentMatch.title,
        content
      });
    }
  }
  
  const prd: WorkflowPRD = {
    workflowId,
    workflowName,
    sections,
    manualEditedAt: {},
    version: 1,
    generatedAt: Date.now()
  };
  
  return { success: true, prd };
}

function generateSectionId(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function validateImportFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['text/plain', 'text/markdown', 'text/x-markdown'];
  const allowedExtensions = ['.txt', '.md', '.markdown'];
  
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
    return { valid: false, error: 'Please upload a .txt or .md file' };
  }
  
  if (file.size > 1024 * 1024) {
    return { valid: false, error: 'File size must be under 1MB' };
  }
  
  return { valid: true };
}
