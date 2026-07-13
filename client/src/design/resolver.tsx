import { useNode, useEditor } from "@craftjs/core";
import {
  AstryxButton as AstryxButtonBase,
  AstryxCard as AstryxCardBase,
  AstryxText as AstryxTextBase,
  AstryxTextInput as AstryxTextInputBase,
  AstryxSection as AstryxSectionBase,
} from "@/components/astryx";

type AstryxProps = Record<string, any>;

// ─── Leaf components ─────────────────────────────────────────────────────────
// canMoveIn must be explicitly false — craft.js defaults to true which would
// silently allow drops into leaves.

export function AstryxButton(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ display: "inline-block" }}>
      <AstryxButtonBase {...props} />
    </div>
  );
}
(AstryxButton as any).craft = {
  displayName: "AstryxButton",
  canMoveIn: () => false,
};

export function AstryxCard(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }}>
      <AstryxCardBase {...props} />
    </div>
  );
}
(AstryxCard as any).craft = {
  displayName: "AstryxCard",
  canMoveIn: () => false,
};

export function AstryxText(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }} style={{ display: "inline-block" }}>
      <AstryxTextBase {...props} />
    </div>
  );
}
(AstryxText as any).craft = {
  displayName: "AstryxText",
  canMoveIn: () => false,
};

export function AstryxTextInput(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(ref) => { if (ref) connect(drag(ref)); }}>
      <AstryxTextInputBase {...props} />
    </div>
  );
}
(AstryxTextInput as any).craft = {
  displayName: "AstryxTextInput",
  canMoveIn: () => false,
};

// ─── Container component ──────────────────────────────────────────────────────
// AstryxSection is the ONLY container — canMoveIn=true so children can be dropped in.

export function AstryxSection({ children, direction = "column", gap = 16, padding = 16 }: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)); }}
      style={{
        display: "flex",
        flexDirection: direction as "row" | "column",
        gap,
        padding,
        minHeight: 48,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
(AstryxSection as any).craft = {
  displayName: "AstryxSection",
  canMoveIn: () => true,
};

// ─── Resolver map ─────────────────────────────────────────────────────────────
// Maps resolvedName strings in the craft.js state JSON to React components.

export const resolver = {
  AstryxButton,
  AstryxCard,
  AstryxText,
  AstryxTextInput,
  AstryxSection,
};

// ─── Allowed component names ──────────────────────────────────────────────────
export const ALLOWED_CRAFT_COMPONENTS = Object.keys(resolver);

// ─── Empty state factory ──────────────────────────────────────────────────────
// Returns a valid craft.js JSON string for a blank canvas (empty root AstryxSection).
export function createEmptyCraftState(): string {
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      isCanvas: true,
      props: { direction: "column", gap: 16, padding: 16 },
      displayName: "AstryxSection",
      custom: {},
      parent: null,
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}

// ─── State validator ──────────────────────────────────────────────────────────
// Validates a craft.js state object for write operations.
export interface CraftStateValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCraftState(state: unknown): CraftStateValidationResult {
  const errors: string[] = [];

  if (!state || typeof state !== "object") {
    return { valid: false, errors: ["craft_state must be an object"] };
  }

  const map = state as Record<string, any>;

  if (!map["ROOT"]) {
    errors.push("craft_state must have a ROOT node");
  }

  const nodeIds = new Set(Object.keys(map));

  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") {
      errors.push(`Node "${nodeId}" is not an object`);
      continue;
    }

    // Check resolvedName
    const resolvedName = node.type?.resolvedName;
    if (!resolvedName) {
      errors.push(`Node "${nodeId}" missing type.resolvedName`);
    } else if (!ALLOWED_CRAFT_COMPONENTS.includes(resolvedName)) {
      errors.push(`Node "${nodeId}" has unknown component type: "${resolvedName}". Allowed: ${ALLOWED_CRAFT_COMPONENTS.join(", ")}`);
    }

    // Check parent references resolve
    if (nodeId !== "ROOT" && node.parent && !nodeIds.has(node.parent)) {
      errors.push(`Node "${nodeId}" references non-existent parent: "${node.parent}"`);
    }

    // Check child references resolve
    if (Array.isArray(node.nodes)) {
      for (const childId of node.nodes) {
        if (!nodeIds.has(childId)) {
          errors.push(`Node "${nodeId}" references non-existent child: "${childId}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
