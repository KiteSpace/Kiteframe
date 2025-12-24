import type { EdgeValidationRules } from '../utils/EdgeValidation';

export const DEFAULT_EDGE_VALIDATION_RULES: EdgeValidationRules = {
  allowSelfLoops: false,
  allowDuplicates: false,
  nodeTypeRestrictions: {
    code: {
      allowedSources: ['form', 'table'],
    },
    output: {
      allowedSources: ['input', 'process', 'condition', 'ai', 'code', 'form', 'table', 'wildcard'],
    },
    condition: {
      allowedSources: ['input', 'process', 'ai', 'code', 'form', 'table', 'wildcard'],
    },
    wildcard: {
      // Wildcard nodes can connect to/from any workflow node type (including media nodes)
      allowedSources: ['input', 'process', 'condition', 'ai', 'code', 'form', 'table', 'wildcard', 'image', 'webview', 'render', 'compound', 'output'],
      allowedTargets: ['input', 'process', 'condition', 'ai', 'output', 'code', 'form', 'table', 'wildcard', 'image', 'webview', 'render', 'compound'],
    },
  },
};

export function mergeEdgeValidationRules(
  baseRules: EdgeValidationRules,
  customRules: Partial<EdgeValidationRules>
): EdgeValidationRules {
  const merged: EdgeValidationRules = {
    ...baseRules,
    ...customRules,
  };

  if (baseRules.nodeTypeRestrictions && customRules.nodeTypeRestrictions) {
    merged.nodeTypeRestrictions = {
      ...baseRules.nodeTypeRestrictions,
      ...customRules.nodeTypeRestrictions,
    };
  }

  return merged;
}
