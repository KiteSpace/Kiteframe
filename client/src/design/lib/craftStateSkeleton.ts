/**
 * Strips a serialized craft.js canvas JSON down to a structural skeleton
 * that Claude can use to understand the existing canvas layout.
 *
 * Only kept per node:
 *   - id (the object key)
 *   - type.resolvedName
 *   - displayName
 *   - custom.label, custom.artboardLabel
 *   - props.text, props.children (string values only)
 *   - nodes (child ID array)
 *
 * Everything else (colors, dimensions, style props, resolved values, etc.)
 * is dropped. A 100 KB canvas typically compresses to < 4 KB.
 */

interface RawNode {
  type?: { resolvedName?: string } | string;
  displayName?: string;
  custom?: Record<string, unknown>;
  props?: Record<string, unknown>;
  nodes?: string[];
  [key: string]: unknown;
}

interface SkeletonNode {
  type?: string;
  displayName?: string;
  label?: string;
  artboardLabel?: string;
  text?: string;
  children?: string;
  nodes?: string[];
}

function skeletonizeNode(node: RawNode): SkeletonNode {
  const out: SkeletonNode = {};

  const resolvedName =
    typeof node.type === 'object' ? node.type?.resolvedName : node.type;
  if (resolvedName) out.type = resolvedName;
  if (node.displayName) out.displayName = node.displayName;

  const custom = node.custom as Record<string, unknown> | undefined;
  if (typeof custom?.label === 'string') out.label = custom.label;
  if (typeof custom?.artboardLabel === 'string') out.artboardLabel = custom.artboardLabel;

  const props = node.props as Record<string, unknown> | undefined;
  if (typeof props?.label === 'string') out.text = props.label;
  if (typeof props?.text === 'string') out.text = props.text;
  if (typeof props?.children === 'string') out.children = props.children;

  if (Array.isArray(node.nodes) && node.nodes.length > 0) {
    out.nodes = node.nodes;
  }

  return out;
}

/**
 * Returns a compact structural skeleton of the craft.js canvas JSON.
 * Returns undefined if the input is empty, unparseable, or produces a
 * skeleton with fewer than 10 characters (empty canvas).
 */
export function skeletonizeCraftState(json: string): string | undefined {
  if (!json || json.length < 10) return undefined;
  try {
    const raw = JSON.parse(json) as Record<string, RawNode>;
    if (typeof raw !== 'object' || raw === null) return undefined;

    const skeleton: Record<string, SkeletonNode> = {};
    for (const [id, node] of Object.entries(raw)) {
      if (typeof node === 'object' && node !== null) {
        skeleton[id] = skeletonizeNode(node);
      }
    }

    const result = JSON.stringify(skeleton);
    return result.length >= 10 ? result : undefined;
  } catch {
    return undefined;
  }
}
