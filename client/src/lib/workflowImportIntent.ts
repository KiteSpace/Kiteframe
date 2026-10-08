/**
 * Detect an explicit request to import workflow data from an uploadable source.
 * Generic questions about workflows and ordinary image analysis stay on the
 * normal KiteAI path.
 */
export function isWorkflowImportRequest(message: string): boolean {
  // Detailed briefs can describe upload/import steps without asking the UI
  // to open a picker. Only intercept a short, direct import command.
  if (message.trim().length > 200 || /[\r\n]/.test(message.trim())) return false;
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  const importVerb = /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|i\s+(?:want|need|would like)\s+to\s+)?(?:import|upload|load|bring in)\b/.test(normalized);
  if (/\b(create|generate|build|design|implement|requirements)\b/.test(normalized)) return false;
  const workflowTarget = /\b(workflow|flow|diagram)\b/.test(normalized);
  const fileTarget = /\b(image|screenshot|picture|photo|kiteframe|file)\b/.test(normalized);
  return importVerb && fileTarget && (
    workflowTarget
    || /\b(?:kiteframe|image|screenshot|picture|photo)\b/.test(normalized)
  );
}