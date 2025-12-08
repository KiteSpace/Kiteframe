import type { EdgeValidationRules } from '../utils/EdgeValidation';

export const DEFAULT_EDGE_VALIDATION_RULES: EdgeValidationRules = {
  allowSelfLoops: false,
  allowDuplicates: false,
  nodeTypeRestrictions: {
    code: {
      allowedSources: ['form', 'table'],
    },
    output: {
      allowedSources: ['input', 'process', 'condition', 'ai', 'code', 'form', 'table'],
    },
    condition: {
      allowedSources: ['input', 'process', 'ai', 'code', 'form', 'table'],
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
