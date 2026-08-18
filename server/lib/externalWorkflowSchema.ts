import Ajv, { type JSONSchemaType, type ValidateFunction } from "ajv";

// JSON schema for workflow submissions to the external API. Deliberately
// permissive on `data` (arbitrary node metadata) since the renderer tolerates
// missing optional fields, but strict on the structural shape (ids, types,
// positions, edge references) since that's what the canvas needs to render.
export const workflowNodeTypes = ["input", "process", "output", "condition"] as const;

export const externalWorkflowJsonSchema = {
  $id: "external-workflow-submission",
  type: "object",
  additionalProperties: false,
  required: ["nodes", "edges"],
  properties: {
    title: { type: "string", nullable: true },
    nodes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "type", "position", "data"],
        properties: {
          id: { type: "string", minLength: 1 },
          type: { type: "string", enum: workflowNodeTypes as unknown as string[] },
          position: {
            type: "object",
            required: ["x", "y"],
            properties: {
              x: { type: "number" },
              y: { type: "number" },
            },
          },
          data: {
            type: "object",
            required: ["label"],
            properties: {
              label: { type: "string", minLength: 1 },
              description: { type: "string", nullable: true },
              icon: { type: "string", nullable: true },
              iconColor: { type: "string", nullable: true },
            },
          },
          width: { type: "number", nullable: true },
          height: { type: "number", nullable: true },
        },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "source", "target"],
        properties: {
          id: { type: "string", minLength: 1 },
          source: { type: "string", minLength: 1 },
          target: { type: "string", minLength: 1 },
          type: { type: "string", nullable: true },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn: ValidateFunction = ajv.compile(externalWorkflowJsonSchema);

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateExternalWorkflow(data: unknown): WorkflowValidationResult {
  const schemaValid = validateFn(data);

  const errors: string[] = schemaValid
    ? []
    : (validateFn.errors || []).map((e) => {
        const path = e.instancePath || "(root)";
        return `${path} ${e.message}`;
      });

  // Cross-field check ajv's schema alone can't express: every edge must
  // reference node ids that actually exist in this same submission. Runs
  // regardless of schema validity so a schema-valid-but-dangling-edge
  // submission is still rejected.
  const body = data as any;
  if (Array.isArray(body?.nodes) && Array.isArray(body?.edges)) {
    const nodeIds = new Set(body.nodes.map((n: any) => n?.id));
    body.edges.forEach((edge: any, index: number) => {
      if (edge?.source && !nodeIds.has(edge.source)) {
        errors.push(`/edges/${index} source "${edge.source}" does not match any node id`);
      }
      if (edge?.target && !nodeIds.has(edge.target)) {
        errors.push(`/edges/${index} target "${edge.target}" does not match any node id`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
