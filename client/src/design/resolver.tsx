import { useNode } from "@craftjs/core";
import {
  ALLOWED_CRAFT_COMPONENTS,
  validateCraftState,
  sanitizeCraftState,
} from "./craftValidator";
export type { CraftStateValidationResult } from "./craftValidator";
export { ALLOWED_CRAFT_COMPONENTS, validateCraftState, sanitizeCraftState };
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
  AstryxUnknown as AstryxUnknownBase,
  AstryxTable as AstryxTableBase,
  AstryxTabs as AstryxTabsBase,
  AstryxAccordion as AstryxAccordionBase,
  AstryxSelect as AstryxSelectBase,
  AstryxCheckbox as AstryxCheckboxBase,
  AstryxRadioGroup as AstryxRadioGroupBase,
  AstryxSlider as AstryxSliderBase,
  AstryxCalendar as AstryxCalendarBase,
  AstryxCommand as AstryxCommandBase,
  AstryxCarousel as AstryxCarouselBase,
  AstryxResizable as AstryxResizableBase,
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

export function AstryxUnknown(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxUnknownBase astryxComponent={props.astryxComponent ?? "Unknown"} />
    </div>
  );
}
(AstryxUnknown as any).craft = { displayName: "AstryxUnknown", rules: { canMoveIn: () => false } };

// ─── New leaf components ───────────────────────────────────────────────────────

export function AstryxTable(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxTableBase {...props} />
    </div>
  );
}
(AstryxTable as any).craft = { displayName: "AstryxTable", rules: { canMoveIn: () => false } };

export function AstryxTabs(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxTabsBase {...props} />
    </div>
  );
}
(AstryxTabs as any).craft = { displayName: "AstryxTabs", rules: { canMoveIn: () => false } };

export function AstryxAccordion(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxAccordionBase {...props} />
    </div>
  );
}
(AstryxAccordion as any).craft = { displayName: "AstryxAccordion", rules: { canMoveIn: () => false } };

export function AstryxSelect(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxSelectBase {...props} />
    </div>
  );
}
(AstryxSelect as any).craft = { displayName: "AstryxSelect", rules: { canMoveIn: () => false } };

export function AstryxCheckbox(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)} style={{ display: "inline-block" }}>
      <AstryxCheckboxBase {...props} />
    </div>
  );
}
(AstryxCheckbox as any).craft = { displayName: "AstryxCheckbox", rules: { canMoveIn: () => false } };

export function AstryxRadioGroup(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxRadioGroupBase {...props} />
    </div>
  );
}
(AstryxRadioGroup as any).craft = { displayName: "AstryxRadioGroup", rules: { canMoveIn: () => false } };

export function AstryxSlider(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxSliderBase {...props} />
    </div>
  );
}
(AstryxSlider as any).craft = { displayName: "AstryxSlider", rules: { canMoveIn: () => false } };

export function AstryxCalendar(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxCalendarBase {...props} />
    </div>
  );
}
(AstryxCalendar as any).craft = { displayName: "AstryxCalendar", rules: { canMoveIn: () => false } };

export function AstryxCommand(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxCommandBase {...props} />
    </div>
  );
}
(AstryxCommand as any).craft = { displayName: "AstryxCommand", rules: { canMoveIn: () => false } };

export function AstryxCarousel(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxCarouselBase {...props} />
    </div>
  );
}
(AstryxCarousel as any).craft = { displayName: "AstryxCarousel", rules: { canMoveIn: () => false } };

export function AstryxResizable(props: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div ref={(r) => leafRef(r, connect, drag)}>
      <AstryxResizableBase {...props} />
    </div>
  );
}
(AstryxResizable as any).craft = { displayName: "AstryxResizable", rules: { canMoveIn: () => false } };

// ─── Container components ─────────────────────────────────────────────────────
// canMoveIn: true — children can be dropped in.

const ALIGN_MAP: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
const JUSTIFY_MAP: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around" };

export function AstryxSection({ children, direction = "column", gap = 16, padding = 16, align = "stretch", justify = "start" }: AstryxProps) {
  const { connectors: { connect, drag }, id } = useNode();
  const isRoot = id === "ROOT";
  return (
    <div
      ref={(r) => { if (r) connect(drag(r)); }}
      style={{
        display: "flex",
        flexDirection: direction as "row" | "column",
        alignItems: ALIGN_MAP[align] ?? "stretch",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        padding,
        minHeight: isRoot ? 480 : 48,
        width: isRoot ? 900 : "100%",
        background: isRoot ? "hsl(var(--card))" : undefined,
        borderRadius: isRoot ? 12 : undefined,
        boxShadow: isRoot ? "0 4px 24px rgba(0,0,0,0.10)" : undefined,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
(AstryxSection as any).craft = { displayName: "AstryxSection", rules: { canMoveIn: () => true } };

export function AstryxStack({ children, gap = 8, align = "stretch", justify = "start" }: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(r) => { if (r) connect(drag(r)); }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: ALIGN_MAP[align] ?? "stretch",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        minHeight: 32,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}
(AstryxStack as any).craft = { displayName: "AstryxStack", rules: { canMoveIn: () => true } };

export function AstryxHStack({ children, gap = 8, align = "center", justify = "start" }: AstryxProps) {
  const { connectors: { connect, drag } } = useNode();
  return (
    <div
      ref={(r) => { if (r) connect(drag(r)); }}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: ALIGN_MAP[align] ?? "center",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        minHeight: 32,
        width: "100%",
      }}
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
  AstryxUnknown,
  AstryxSection,
  AstryxStack,
  AstryxHStack,
  AstryxTable,
  AstryxTabs,
  AstryxAccordion,
  AstryxSelect,
  AstryxCheckbox,
  AstryxRadioGroup,
  AstryxSlider,
  AstryxCalendar,
  AstryxCommand,
  AstryxCarousel,
  AstryxResizable,
};

// ─── Alignment guard ──────────────────────────────────────────────────────────
// Detects drift between craftValidator.ts (ALLOWED_CRAFT_COMPONENTS) and the
// resolver map. Logs an error at module-init time so mismatches surface
// immediately in development builds and in tests that import this module.

{
  const resolverKeys = Object.keys(resolver);
  const missingFromResolver = ALLOWED_CRAFT_COMPONENTS.filter((k) => !resolverKeys.includes(k));
  const missingFromValidator = resolverKeys.filter((k) => !ALLOWED_CRAFT_COMPONENTS.includes(k));
  if (missingFromResolver.length || missingFromValidator.length) {
    console.error(
      "[Astryx] ALLOWED_CRAFT_COMPONENTS ↔ resolver MISMATCH — update both files together!",
      { missingFromResolver, missingFromValidator },
    );
  }
}

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
