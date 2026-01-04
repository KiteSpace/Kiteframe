/**
 * Phase 5: Enterprise Guardrails
 * 
 * Configuration-level hooks for enterprise deployment.
 * These are config switches only - no UI yet.
 */

import type { EnterpriseGuardrails } from './types';
import { DEFAULT_ENTERPRISE_GUARDRAILS } from './types';

/**
 * Current guardrail configuration
 * In production, this would be loaded from environment or config
 */
let currentGuardrails: EnterpriseGuardrails = { ...DEFAULT_ENTERPRISE_GUARDRAILS };

/**
 * Get current guardrail configuration
 */
export function getGuardrails(): EnterpriseGuardrails {
  return { ...currentGuardrails };
}

/**
 * Update guardrail configuration
 * In production, this would be restricted to admin/config
 */
export function setGuardrails(guardrails: Partial<EnterpriseGuardrails>): void {
  currentGuardrails = {
    ...currentGuardrails,
    ...guardrails,
  };
}

/**
 * Reset guardrails to defaults
 */
export function resetGuardrails(): void {
  currentGuardrails = { ...DEFAULT_ENTERPRISE_GUARDRAILS };
}

/**
 * Check if AI actions are allowed
 */
export function isAiAllowed(): boolean {
  return !currentGuardrails.aiActionsDisabled;
}

/**
 * Check if workflow is editable
 */
export function isWorkflowEditable(): boolean {
  return !currentGuardrails.readOnlyMode && !currentGuardrails.auditOnlyAccess;
}

/**
 * Check if only audit access is allowed
 */
export function isAuditOnly(): boolean {
  return currentGuardrails.auditOnlyAccess;
}
