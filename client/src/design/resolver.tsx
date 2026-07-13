import { useNode } from "@craftjs/core";
import {
  AstryxButton as AstryxButtonBase,
  AstryxCard as AstryxCardBase,
  AstryxText as AstryxTextBase,
  AstryxTextInput as AstryxTextInputBase,
  AstryxSection as AstryxSectionBase,
  AstryxHeading as AstryxHeadingBase,
  AstryxBadge as AstryxBadgeBase,
  AstryxAvatar as AstryxAvatarBase,
  AstryxSpinner as AstryxSpinnerBase,
  AstryxDivider as AstryxDividerBase,
  AstryxProgressBar as AstryxProgressBarBase,
  AstryxStatusDot as AstryxStatusDotBase,
  AstryxSkeleton as AstryxSkeletonBase,
  AstryxBanner as AstryxBannerBase,
  AstryxEmptyState as AstryxEmptyStateBase,
  AstryxChatMessage as AstryxChatMessageBase,
  AstryxToken as AstryxTokenBase,
  AstryxStack as AstryxStackBase,
  AstryxHStack as AstryxHStackBase,
  AstryxIcon as AstryxIconBase,
} from "@/components/astryx";

type AstryxProps = Record<string, any>;

// ─── Helper — leaf connector ──────────────────────────────────────────────────
// All leaf wrappers are identical except for the wrapped component.
// canMoveIn: false prevents craft.js from silently accepting drops into leaves.

function leafRef(ref: HTMLElement | null, connect: (el: HTMLElement) => HTMLElement, drag: (el: HTMLElement) => HTMLElement) {
  if (ref) connect(drag(ref));
}

// ─── Leaf components ──────────────────────────────────────────────────────────

export function AstryxButton(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)} style={{ display: "inline-block" }}>
      <AstryxButtonBase {...props} />
    </div>
  );
}
(AstryxButton as any).craft = { displayName: "AstryxButton", rules: { canMoveIn: () => false } };

export function AstryxCard(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxCardBase {...props} />
    </div>
  );
}
(AstryxCard as any).craft = { displayName: "AstryxCard", rules: { canMoveIn: () => false } };

export function AstryxText(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)} style={{ display: "inline-block" }}>
      <AstryxTextBase {...props} />
    </div>
  );
}
(AstryxText as any).craft = { displayName: "AstryxText", rules: { canMoveIn: () => false } };

export function AstryxHeading(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxHeadingBase {...props} />
    </div>
  );
}
(AstryxHeading as any).craft = { displayName: "AstryxHeading", rules: { canMoveIn: () => false } };

export function AstryxTextInput(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxTextInputBase {...props} />
    </div>
  );
}
(AstryxTextInput as any).craft = { displayName: "AstryxTextInput", rules: { canMoveIn: () => false } };

export function AstryxBadge(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <span ref={(r) => { if (r) leafRef(r as unknown as HTMLElement, connect, drag); }} style={{ display: "inline-block" }}>
      <AstryxBadgeBase {...props} />
    </span>
  );
}
(AstryxBadge as any).craft = { displayName: "AstryxBadge", rules: { canMoveIn: () => false } };

export function AstryxAvatar(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)} style={{ display: "inline-block" }}>
      <AstryxAvatarBase {...props} />
    </div>
  );
}
(AstryxAvatar as any).craft = { displayName: "AstryxAvatar", rules: { canMoveIn: () => false } };

export function AstryxSpinner(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)} style={{ display: "inline-block" }}>
      <AstryxSpinnerBase {...props} />
    </div>
  );
}
(AstryxSpinner as any).craft = { displayName: "AstryxSpinner", rules: { canMoveIn: () => false } };

export function AstryxDivider(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxDividerBase {...props} />
    </div>
  );
}
(AstryxDivider as any).craft = { displayName: "AstryxDivider", rules: { canMoveIn: () => false } };

export function AstryxProgressBar(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxProgressBarBase {...props} />
    </div>
  );
}
(AstryxProgressBar as any).craft = { displayName: "AstryxProgressBar", rules: { canMoveIn: () => false } };

export function AstryxStatusDot(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)} style={{ display: "inline-block" }}>
      <AstryxStatusDotBase {...props} />
    </div>
  );
}
(AstryxStatusDot as any).craft = { displayName: "AstryxStatusDot", rules: { canMoveIn: () => false } };

export function AstryxSkeleton(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxSkeletonBase {...props} />
    </div>
  );
}
(AstryxSkeleton as any).craft = { displayName: "AstryxSkeleton", rules: { canMoveIn: () => false } };

export function AstryxBanner(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxBannerBase {...props} />
    </div>
  );
}
(AstryxBanner as any).craft = { displayName: "AstryxBanner", rules: { canMoveIn: () => false } };

export function AstryxEmptyState(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxEmptyStateBase {...props} />
    </div>
  );
}
(AstryxEmptyState as any).craft = { displayName: "AstryxEmptyState", rules: { canMoveIn: () => false } };

export function AstryxChatMessage(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxChatMessageBase {...props} />
    </div>
  );
}
(AstryxChatMessage as any).craft = { displayName: "AstryxChatMessage", rules: { canMoveIn: () => false } };

export function AstryxToken(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <span ref={(r) => { if (r) leafRef(r as unknown as HTMLElement, connect, drag); }} style={{ display: "inline-block" }}>
      <AstryxTokenBase {...props} />
    </span>
  );
}
(AstryxToken as any).craft = { displayName: "AstryxToken", rules: { canMoveIn: () => false } };

export function AstryxIcon(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <span ref={(r) => { if (r) leafRef(r as unknown as HTMLElement, connect, drag); }} style={{ display: "inline-block" }}>
      <AstryxIconBase {...props} />
    </span>
  );
}
(AstryxIcon as any).craft = { displayName: "AstryxIcon", rules: { canMoveIn: () => false } };

// ─── Container components ─────────────────────────────────────────────────────
// canMoveIn: true — children can be dropped in.

export function AstryxSection({ children, direction = "column", gap = 16, padding = 16 }: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(r) => { if (r) connect(drag(r)); }}
      style={{ display: "flex", flexDirection: direction as "row" | "column", gap, padding, minHeight: 48, width: "100%", boxSizing: "border-box" }}
    >
      {children}
    </div>
  );
}
(AstryxSection as any).craft = { displayName: "AstryxSection", rules: { canMoveIn: () => true } };

export function AstryxStack({ children, gap = 8 }: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => { if (r) connect(drag(r)); }} style={{ display: "flex", flexDirection: "column", gap, minHeight: 32, width: "100%" }}>
      {children}
    </div>
  );
}
(AstryxStack as any).craft = { displayName: "AstryxStack", rules: { canMoveIn: () => true } };

export function AstryxHStack({ children, gap = 8, align = "center" }: AstryxProps) {
  const alignMap: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end" };
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(r) => { if (r) connect(drag(r)); }}
      style={{ display: "flex", flexDirection: "row", gap, alignItems: alignMap[align] ?? "center", minHeight: 32, width: "100%" }}
    >
      {children}
    </div>
  );
}
(AstryxHStack as any).craft = { displayName: "AstryxHStack", rules: { canMoveIn: () => true } };

// ─── Resolver map ─────────────────────────────────────────────────────────────

export const resolver = {
  AstryxButton,
  AstryxCard,
  AstryxText,
  AstryxHeading,
  AstryxTextInput,
  AstryxBadge,
  AstryxAvatar,
  AstryxSpinner,
  AstryxDivider,
  AstryxProgressBar,
  AstryxStatusDot,
  AstryxSkeleton,
  AstryxBanner,
  AstryxEmptyState,
  AstryxChatMessage,
  AstryxToken,
  AstryxIcon,
  AstryxSection,
  AstryxStack,
  AstryxHStack,
};

export const ALLOWED_CRAFT_COMPONENTS = Object.keys(resolver);

// ─── Empty state factory ──────────────────────────────────────────────────────

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

    const resolvedName = node.type?.resolvedName;
    if (!resolvedName) {
      errors.push(`Node "${nodeId}" missing type.resolvedName`);
    } else if (!ALLOWED_CRAFT_COMPONENTS.includes(resolvedName)) {
      errors.push(`Node "${nodeId}" has unknown component type: "${resolvedName}". Allowed: ${ALLOWED_CRAFT_COMPONENTS.join(", ")}`);
    }

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

  return { valid: errors.length === 0, errors };
}
