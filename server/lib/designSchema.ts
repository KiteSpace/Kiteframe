import Ajv, { type ValidateFunction } from "ajv";

// ─── Legacy flat-JSON schema (external_entities, old /api/designs/generate) ──

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

// ─── craft.js state schema (new designs table) ────────────────────────────────
// Allowed component resolvedName values — must stay in sync with client/src/design/resolver.tsx

export const SERVER_ALLOWED_CRAFT_COMPONENTS = [
  "AstryxSection",
  "AstryxCard",
  "AstryxButton",
  "AstryxText",
  "AstryxTextInput",
] as const;

export const CRAFT_STATE_SCHEMA = {
  $id: "craft-js-design-state",
  type: "object",
  minProperties: 1,
  additionalProperties: {
    type: "object",
    required: ["type", "props", "parent", "nodes", "linkedNodes"],
    properties: {
      type: {
        type: "object",
        required: ["resolvedName"],
        properties: {
          resolvedName: {
            type: "string",
            enum: [...SERVER_ALLOWED_CRAFT_COMPONENTS],
          },
        },
      },
      isCanvas: { type: "boolean" },
      props: { type: "object" },
      displayName: { type: "string" },
      custom: { type: "object" },
      parent: { type: ["string", "null"] },
      hidden: { type: "boolean" },
      nodes: { type: "array", items: { type: "string" } },
      linkedNodes: { type: "object" },
    },
  },
} as const;

const craftAjv = new Ajv({ allErrors: true, strict: false });
const craftValidateFn: ValidateFunction = craftAjv.compile(CRAFT_STATE_SCHEMA as any);

export function validateCraftState(data: unknown): DesignValidationResult {
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["craft_state must be an object"] };
  }

  const map = data as Record<string, any>;

  if (!map["ROOT"]) {
    return { valid: false, errors: ["craft_state must have a ROOT node"] };
  }

  const schemaValid = craftValidateFn(data);
  const errors: string[] = schemaValid
    ? []
    : (craftValidateFn.errors || []).map((e) => {
        const path = e.instancePath || "(root)";
        return `${path} ${e.message}`;
      });

  // Additional cross-node reference integrity checks
  const nodeIds = new Set(Object.keys(map));
  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    if (nodeId !== "ROOT" && node.parent && !nodeIds.has(node.parent)) {
      errors.push(`Node "${nodeId}" references non-existent parent: "${node.parent}"`);
    }
    if (Array.isArray(node.nodes)) {
      for (const childId of node.nodes) {
        if (!nodeIds.has(childId)) {
          errors.push(`Node "${nodeId}" references non-existent child: "${childId}"`);
        }
      }
    }
  }

  // Cycle detection via DFS from ROOT over the nodes[] (parent→child) links
  const adjacency = new Map<string, string[]>();
  for (const [id, node] of Object.entries(map)) {
    adjacency.set(id, Array.isArray(node?.nodes) ? (node.nodes as string[]) : []);
  }
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function dfs(id: string): boolean {
    if (inStack.has(id)) return true; // cycle
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    for (const child of adjacency.get(id) ?? []) {
      if (dfs(child)) return true;
    }
    inStack.delete(id);
    return false;
  }
  if (dfs("ROOT")) {
    errors.push("craft_state contains a cycle in the node tree");
  }

  return { valid: errors.length === 0, errors };
}
