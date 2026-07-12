import Ajv, { type ValidateFunction } from "ajv";

export const DESIGN_MAX_COMPONENTS = 150;

export const designJsonSchema = {
  $id: "external-design-submission",
  type: "object",
  additionalProperties: false,
  required: ["components"],
  properties: {
    title: { type: "string", nullable: true },
    components: {
      type: "array",
      minItems: 1,
      maxItems: DESIGN_MAX_COMPONENTS,
      items: {
        type: "object",
        required: ["id", "astryxComponent", "x", "y"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          astryxComponent: { type: "string", minLength: 1 },
          x: { type: "number" },
          y: { type: "number" },
          props: { type: "object", nullable: true },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn: ValidateFunction = ajv.compile(designJsonSchema);

export interface DesignValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateExternalDesign(data: unknown): DesignValidationResult {
  const schemaValid = validateFn(data);

  const errors: string[] = schemaValid
    ? []
    : (validateFn.errors || []).map((e) => {
        const path = e.instancePath || "(root)";
        if (path === "/components" && e.keyword === "maxItems") {
          return `Too many components: maximum is ${DESIGN_MAX_COMPONENTS}, got ${(data as any)?.components?.length ?? "?"}`;
        }
        return `${path} ${e.message}`;
      });

  return { valid: errors.length === 0, errors };
}
