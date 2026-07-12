import { validateExternalWorkflow, externalWorkflowJsonSchema } from "./externalWorkflowSchema";
import {
  EXTERNAL_WORKFLOW_SYSTEM_PROMPT,
  EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES,
} from "./externalWorkflowPrompt";
import { validateExternalDesign, designJsonSchema } from "./designSchema";
import {
  DESIGN_SYSTEM_PROMPT,
  DESIGN_JSON_SCHEMA,
  DESIGN_FEW_SHOT_EXAMPLES,
} from "./designPrompt";

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
      system_prompt: DESIGN_SYSTEM_PROMPT,
      output_schema: DESIGN_JSON_SCHEMA,
      few_shot_examples: DESIGN_FEW_SHOT_EXAMPLES,
    };
  }
  throw { status: 400, message: `Unknown entity type: ${dbType}` };
}
