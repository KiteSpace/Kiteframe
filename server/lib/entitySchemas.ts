import { validateExternalWorkflow, externalWorkflowJsonSchema } from "./externalWorkflowSchema";
import {
  EXTERNAL_WORKFLOW_SYSTEM_PROMPT,
  EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES,
} from "./externalWorkflowPrompt";

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
  throw { status: 501, message: "Design entity type not yet implemented" };
}

export function getPromptTemplateForType(dbType: DbEntityType) {
  if (dbType === "workflow") {
    return {
      system_prompt: EXTERNAL_WORKFLOW_SYSTEM_PROMPT,
      output_schema: externalWorkflowJsonSchema,
      few_shot_examples: EXTERNAL_WORKFLOW_FEW_SHOT_EXAMPLES,
    };
  }
  throw { status: 501, message: "Design prompt template not yet implemented" };
}
