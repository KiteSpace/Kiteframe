/**
 * Detect an explicit request to import workflow data from an uploadable source.
 * Generic questions about workflows and ordinary image analysis stay on the
 * normal KiteAI path.
 */
export function isWorkflowImportRequest(message: string): boolean {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  const importVerb = /\b(import|upload|load|bring in)\b/.test(normalized);
  const workflowTarget = /\b(workflow|flow|diagram)\b/.test(normalized);
  const fileTarget = /\b(image|screenshot|picture|photo|kiteframe|file)\b/.test(normalized);
  return importVerb && fileTarget && (
    workflowTarget
    || /\b(?:kiteframe|image|screenshot|picture|photo)\b/.test(normalized)
  );
}