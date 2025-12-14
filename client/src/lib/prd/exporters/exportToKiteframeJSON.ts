import type { AssembledProjectPRD } from '../assembleProjectPRD';

export function exportToKiteframeJSON(assembled: AssembledProjectPRD): string {
  return JSON.stringify(assembled, null, 2);
}

export function downloadKiteframeJSON(assembled: AssembledProjectPRD): void {
  const content = exportToKiteframeJSON(assembled);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembled.project.name)}-prd.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
