import type { AssembledProjectPRD } from '../assembleProjectPRD';
import { exportToMarkdown } from './exportToMarkdown';

export interface GoogleDocsExportResult {
  success: boolean;
  documentUrl?: string;
  error?: string;
}

export async function exportToGoogleDocs(
  assembled: AssembledProjectPRD
): Promise<GoogleDocsExportResult> {
  const markdown = exportToMarkdown(assembled);
  
  try {
    const response = await fetch('/api/export/google-docs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `${assembled.project.name} - PRD`,
        content: markdown,
        projectId: assembled.project.id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        return {
          success: false,
          error: 'Google authentication required. Please connect your Google account.'
        };
      }
      
      return {
        success: false,
        error: errorData.message || 'Failed to export to Google Docs'
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      documentUrl: data.documentUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error occurred'
    };
  }
}

export function openGoogleDocsAuth(): void {
  window.open('/api/auth/google-docs', '_blank', 'width=600,height=700');
}
