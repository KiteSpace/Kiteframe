import { validateExternalWorkflow, externalWorkflowJsonSchema } from "./externalWorkflowSchema";
import {
  EXTERNAL_WORKFLOW_SYSTEM_PROMPT,
  EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES,
} from "./externalWorkflowPrompt";
import { validateExternalDesign, designJsonSchema } from "./designSchema";
import {
  EXTERNAL_DESIGN_SYSTEM_PROMPT,
  EXTERNAL_DESIGN_FEW_SHOT_EXAMPLES,
} from "./externalDesignPrompt";

export type UrlEntityType = "workflows" | "designs";
export type DbEntityType = "workflow" | "design";

export const URL_TO_DB_TYPE: Record<UrlEntityType, DbEntityType> = {
  workflows: "workflow",
  designs: "design",
};

export const DB_TO_URL_TYPE: Record<DbEntityType, UrlEntityType> = {
  workflow: "workflows",
  design: "designs",
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function getValidatorForType(
  dbType: DbEntityType
): (data: unknown) => ValidationResult {
  if (dbType === "workflow") return validateExternalWorkflow;
  if (dbType === "design") return validateExternalDesign;
  throw { status: 400, message: `Unknown entity type: ${dbType}` };
}

export function getPromptTemplateForType(dbType: DbEntityType) {
  if (dbType === "workflow") {
    return {
      system_prompt: EXTERNAL_WORKFLOW_SYSTEM_PROMPT,
      output_schema: externalWorkflowJsonSchema,
      few_shot_examples: EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES,
    };
  }
  if (dbType === "design") {
    return {
      // Must match what the submit routes validate (legacy flat format).
      version: "1.1.0",
      system_prompt: EXTERNAL_DESIGN_SYSTEM_PROMPT,
      output_schema: designJsonSchema,
      few_shot_examples: EXTERNAL_DESIGN_FEW_SHOT_EXAMPLES,
    };
  }
  throw { status: 400, message: `Unknown entity type: ${dbType}` };
}
